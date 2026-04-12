// records-vault-textract-complete — NO AUTH (SNS webhook)
//
// Thin SNS handler: receives Textract job completion notifications from AWS SNS,
// validates the signature, claims the job via idempotency guard, and delegates
// all heavy processing to records-vault-textract-process-background (15-min
// ceiling). Returns 200 to SNS within seconds so AWS doesn't redeliver.
//
// The background function handles: paginated block fetching, page upserts,
// downstream triggers (events, embeddings, rasterize, label).
//
// Environment variables required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY)

import { createClient } from "@supabase/supabase-js";
import { JobStatus } from "@aws-sdk/client-textract";
import https from "https";
import crypto from "crypto";

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
};
type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

// ─── SNS verification ────────────────────────────────────────────────────────

interface SnsEnvelope {
  Type: "SubscriptionConfirmation" | "Notification" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
}

function buildSignatureString(msg: SnsEnvelope): string {
  const fields: Array<[string, string | undefined]> =
    msg.Type === "Notification"
      ? [
          ["Message",     msg.Message],
          ["MessageId",   msg.MessageId],
          ["Subject",     msg.Subject],
          ["Timestamp",   msg.Timestamp],
          ["TopicArn",    msg.TopicArn],
          ["Type",        msg.Type],
        ]
      : [
          ["Message",      msg.Message],
          ["MessageId",    msg.MessageId],
          ["SubscribeURL", msg.SubscribeURL],
          ["Timestamp",    msg.Timestamp],
          ["Token",        (msg as Record<string, string | undefined>)["Token"]],
          ["TopicArn",     msg.TopicArn],
          ["Type",         msg.Type],
        ];

  return fields
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}\n${v}\n`)
    .join("");
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function verifySnsSignature(msg: SnsEnvelope): Promise<boolean> {
  try {
    const certUrl = msg.SigningCertURL;
    if (!/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//.test(certUrl)) {
      console.error("[textract-complete] Untrusted SigningCertURL:", certUrl);
      return false;
    }
    const pem       = await fetchText(certUrl);
    const text      = buildSignatureString(msg);
    const sig       = Buffer.from(msg.Signature, "base64");
    const algorithm = msg.SignatureVersion === "2" ? "sha256" : "sha1";
    return crypto.createVerify(`RSA-${algorithm.toUpperCase()}`).update(text).verify(pem, sig);
  } catch (err) {
    console.error("[textract-complete] Signature verification error:", err);
    return false;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200 };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!event.body) return { statusCode: 400, body: "Empty body" };

  // ── 1. Parse SNS envelope ─────────────────────────────────────────────────
  let sns: SnsEnvelope;
  try {
    sns = JSON.parse(event.body) as SnsEnvelope;
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // ── 2. Verify SNS signature ───────────────────────────────────────────────
  const valid = await verifySnsSignature(sns);
  if (!valid) {
    console.error("[textract-complete] SNS signature verification failed");
    return { statusCode: 403, body: "Invalid SNS signature" };
  }

  // ── 3. Handle SubscriptionConfirmation ────────────────────────────────────
  if (sns.Type === "SubscriptionConfirmation") {
    if (sns.SubscribeURL) {
      try {
        await fetchText(sns.SubscribeURL);
        console.log("[textract-complete] SNS subscription confirmed");
      } catch (err) {
        console.error("[textract-complete] Subscription confirmation failed:", err);
        return { statusCode: 500, body: "Subscription confirmation failed" };
      }
    }
    return { statusCode: 200, body: "Confirmed" };
  }

  if (sns.Type !== "Notification") {
    return { statusCode: 200, body: "Ignored" };
  }

  // ── 4. Parse Textract completion notification ─────────────────────────────
  let notification: Record<string, unknown>;
  try {
    notification = JSON.parse(sns.Message) as Record<string, unknown>;
  } catch {
    console.error("[textract-complete] Failed to parse Textract notification");
    return { statusCode: 400, body: "Invalid Textract notification" };
  }

  const jobId = typeof notification.JobId === "string" ? notification.JobId : null;
  const status = typeof notification.Status === "string" ? notification.Status : null;

  if (!jobId) {
    console.error("[textract-complete] No JobId in notification");
    return { statusCode: 400, body: "Missing JobId" };
  }

  console.log(`[textract-complete] Job ${jobId} status: ${status}`);

  // ── 5. Set up Supabase client ─────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return { statusCode: 500, body: "Server configuration error" };
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── 6. Look up the record source by job ID ────────────────────────────────
  const { data: source, error: sourceErr } = await supabase
    .from("rv_record_sources")
    .select("id")
    .eq("textract_job_id", jobId)
    .maybeSingle();

  if (sourceErr || !source) {
    console.error(`[textract-complete] No rv_record_sources row for job ${jobId}`);
    return { statusCode: 200, body: "Record source not found" };
  }

  const recordSourceId = source.id;

  async function log(step: string, message: string): Promise<void> {
    await supabase.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step,
      message,
    });
  }

  // ── 6b. SNS idempotency guard ─────────────────────────────────────────────
  const { data: claimed, error: claimErr } = await supabase
    .from("rv_record_sources")
    .update({ textract_handled_at: new Date().toISOString() })
    .eq("id", recordSourceId)
    .is("textract_handled_at", null)
    .select("id");

  if (claimErr) {
    console.error(`[textract-complete] Idempotency claim failed: ${claimErr.message}`);
    await log("sns_claim_error", `Idempotency claim failed: ${claimErr.message}`);
  } else if (!claimed || claimed.length === 0) {
    await log("sns_redelivery_ignored", `SNS redelivery for job ${jobId} ignored — already handled`);
    console.log(`[textract-complete] Ignoring SNS redelivery for ${recordSourceId}`);
    return { statusCode: 200, body: "Already handled" };
  }

  // ── 7. Handle failed Textract job ─────────────────────────────────────────
  if (status !== JobStatus.SUCCEEDED) {
    const msg = `Textract job ${jobId} ended with status: ${status}`;
    console.error(`[textract-complete] ${msg}`);
    await log("textract_failed", msg);
    await supabase
      .from("rv_record_sources")
      .update({ ingestion_status: "failed", ingestion_error: msg })
      .eq("id", recordSourceId);
    return { statusCode: 200, body: "Job failed — recorded" };
  }

  // ── 8. Delegate heavy processing to background function ───────────────────
  // The background function has a 15-minute ceiling — enough for 300+ page docs
  // that need minutes of paginated Textract block fetching.
  const siteUrl = process.env.URL ?? process.env.DEPLOY_URL;
  if (!siteUrl) {
    const msg = "URL/DEPLOY_URL env missing — cannot trigger background processor";
    console.error(`[textract-complete] ${msg}`);
    await log("textract_failed", msg);
    await supabase
      .from("rv_record_sources")
      .update({ ingestion_status: "failed", ingestion_error: msg })
      .eq("id", recordSourceId);
    return { statusCode: 200, body: msg };
  }

  try {
    const bgUrl = `${siteUrl}/.netlify/functions/records-vault-textract-process-background`;
    const bgResp = await fetch(bgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordSourceId, jobId }),
    });

    if (bgResp.status === 202) {
      await log("textract_processing", `Background processor accepted (202) for job ${jobId}`);
      console.log(`[textract-complete] Background processor started for ${recordSourceId}`);
    } else {
      const body = await bgResp.text().catch(() => "");
      console.warn(`[textract-complete] Background processor returned ${bgResp.status}: ${body}`);
      await log("textract_processing", `Background processor returned ${bgResp.status} for job ${jobId}`);
    }
  } catch (err) {
    const msg = `Failed to trigger background processor: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[textract-complete] ${msg}`);
    await log("textract_failed", msg);
    await supabase
      .from("rv_record_sources")
      .update({ ingestion_status: "failed", ingestion_error: msg })
      .eq("id", recordSourceId);
  }

  return { statusCode: 200, body: "Delegated to background processor" };
};
