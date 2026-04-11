// records-vault-s3-ingest — NO AUTH (SNS webhook)
//
// Receives S3 event notifications forwarded through SNS when a PDF is uploaded
// to the records-vault S3 bucket. For each uploaded object:
//
//   1. Parse the S3 key:  records-vault/{tail-number}/{doc-type}/{filename}
//   2. Look up the aircraft in the `aircraft` table by tail_number
//   3. Create an rv_record_sources row (ingestion_status: "pending")
//   4. Start a Textract async job (StartDocumentAnalysis, TABLES + FORMS)
//   5. Store the Textract job ID on the rv_record_sources row
//
// The SNS message format:
//   POST body is an SNS Notification envelope. The "Message" field is a JSON
//   string containing the standard S3 event payload (Records[].s3.object.key).
//
// SNS subscription confirmation is handled automatically: when AWS sends a
// SubscriptionConfirmation message, the function GETs the SubscribeURL to
// complete the handshake.
//
// Environment variables required:
//   TEXTRACT_REGION           — e.g. "us-east-2" (AWS_REGION is reserved by Netlify)
//   TEXTRACT_KEY_ID           — IAM access key ID (AWS_ACCESS_KEY_ID is reserved by Netlify)
//   TEXTRACT_SECRET_KEY       — IAM secret access key
//   TEXTRACT_S3_BUCKET        — S3 bucket name (e.g. "records-vault-skysharemx")
//   TEXTRACT_SNS_TOPIC_ARN    — ARN of the SNS topic Textract publishes completion to
//   TEXTRACT_ROLE_ARN         — ARN of the IAM role Textract assumes to publish SNS
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY)

import { createClient } from "@supabase/supabase-js";
import {
  TextractClient,
  StartDocumentAnalysisCommand,
  FeatureType,
} from "@aws-sdk/client-textract";
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

// ─── S3 key → source_category mapping ───────────────────────────────────────
// Folder names under records-vault/{tail-number}/ map to rv_record_sources.source_category

const DOC_TYPE_MAP: Record<string, string> = {
  "airframe-logbook":  "logbook",
  "engine-logbook":    "logbook",
  "prop-logbook":      "logbook",
  "propeller-logbook": "logbook",
  "apd-logbook":       "logbook",
  "ad-compliance":     "ad_compliance",
  "work-package":      "work_package",
  "work-order":        "work_package",
  "inspection":        "inspection",
  "major-repair":      "major_repair",
  "major-alteration":  "major_repair",
};

function docTypeToCategory(folder: string): string {
  return DOC_TYPE_MAP[folder.toLowerCase()] ?? "other";
}

// ─── SNS message types ───────────────────────────────────────────────────────

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
  SubscribeURL?: string;   // only on SubscriptionConfirmation
  UnsubscribeURL?: string; // only on Notification
}

interface S3EventRecord {
  eventName: string;
  s3: {
    bucket: { name: string };
    object: { key: string; size: number };
  };
}

interface S3Event {
  Records: S3EventRecord[];
}

// ─── SNS signature verification ─────────────────────────────────────────────
// Protects the endpoint from spoofed payloads.
// Reference: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature.html

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
          ["Message",         msg.Message],
          ["MessageId",       msg.MessageId],
          ["SubscribeURL",    msg.SubscribeURL],
          ["Timestamp",       msg.Timestamp],
          ["Token",           (msg as Record<string, string | undefined>)["Token"]],
          ["TopicArn",        msg.TopicArn],
          ["Type",            msg.Type],
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
    // Only trust certificates from AWS-owned domains
    const certUrl = msg.SigningCertURL;
    if (!/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\//.test(certUrl)) {
      console.error("[s3-ingest] Untrusted SigningCertURL:", certUrl);
      return false;
    }

    const pem  = await fetchText(certUrl);
    const text = buildSignatureString(msg);
    const sig  = Buffer.from(msg.Signature, "base64");

    const algorithm = msg.SignatureVersion === "2" ? "sha256" : "sha1";
    return crypto.createVerify(`RSA-${algorithm.toUpperCase()}`)
      .update(text)
      .verify(pem, sig);
  } catch (err) {
    console.error("[s3-ingest] Signature verification error:", err);
    return false;
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200 };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  if (!event.body) {
    return { statusCode: 400, body: "Empty body" };
  }

  // ── 1. Parse the SNS envelope ─────────────────────────────────────────────
  let sns: SnsEnvelope;
  try {
    sns = JSON.parse(event.body) as SnsEnvelope;
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // ── 2. Verify SNS signature ───────────────────────────────────────────────
  const valid = await verifySnsSignature(sns);
  if (!valid) {
    console.error("[s3-ingest] SNS signature verification failed");
    return { statusCode: 403, body: "Invalid SNS signature" };
  }

  // ── 3. Handle SubscriptionConfirmation ────────────────────────────────────
  if (sns.Type === "SubscriptionConfirmation") {
    if (sns.SubscribeURL) {
      try {
        await fetchText(sns.SubscribeURL);
        console.log("[s3-ingest] SNS subscription confirmed");
      } catch (err) {
        console.error("[s3-ingest] Failed to confirm SNS subscription:", err);
        return { statusCode: 500, body: "Subscription confirmation failed" };
      }
    }
    return { statusCode: 200, body: "Confirmed" };
  }

  if (sns.Type !== "Notification") {
    return { statusCode: 200, body: "Ignored" };
  }

  // ── 4. Parse S3 event from SNS message ───────────────────────────────────
  let s3Event: S3Event;
  try {
    s3Event = JSON.parse(sns.Message) as S3Event;
  } catch {
    console.error("[s3-ingest] Failed to parse S3 event from SNS Message");
    return { statusCode: 400, body: "Invalid S3 event" };
  }

  // Sanity: S3 test events have a single "Service" record — ignore them
  const records = (s3Event.Records ?? []).filter(
    (r) => r.eventName?.startsWith("ObjectCreated")
  );

  if (records.length === 0) {
    return { statusCode: 200, body: "No ObjectCreated events" };
  }

  // ── 5. Set up clients ─────────────────────────────────────────────────────
  const supabaseUrl  = process.env.SUPABASE_URL;
  const serviceRole  = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const awsRegion    = process.env.TEXTRACT_REGION ?? "us-east-2";
  const awsKeyId     = process.env.TEXTRACT_KEY_ID;
  const awsSecret    = process.env.TEXTRACT_SECRET_KEY;
  const s3Bucket     = process.env.TEXTRACT_S3_BUCKET;
  const snsTopicArn  = process.env.TEXTRACT_SNS_TOPIC_ARN;
  const roleArn      = process.env.TEXTRACT_ROLE_ARN;

  if (!supabaseUrl || !serviceRole || !awsKeyId || !awsSecret || !s3Bucket || !snsTopicArn || !roleArn) {
    console.error("[s3-ingest] Missing required environment variables");
    return { statusCode: 500, body: "Server configuration error" };
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const textract = new TextractClient({
    region: awsRegion,
    credentials: { accessKeyId: awsKeyId, secretAccessKey: awsSecret },
  });

  const errors: string[] = [];

  // ── 6. Process each S3 record ─────────────────────────────────────────────
  for (const record of records) {
    const rawKey  = record.s3.object.key;
    // S3 keys in SNS events are URL-encoded
    const s3Key   = decodeURIComponent(rawKey.replace(/\+/g, " "));
    const fileSize = record.s3.object.size;

    // Expected format: records-vault/{tail-number}/{doc-type}/{filename}
    const parts = s3Key.split("/");
    if (parts.length < 4 || parts[0] !== "records-vault") {
      console.warn(`[s3-ingest] Unexpected key format, skipping: ${s3Key}`);
      continue;
    }

    const tailNumber     = parts[1].toUpperCase();
    const docTypeFolder  = parts[2];
    const filename       = parts.slice(3).join("/"); // support sub-folders
    const sourceCategory = docTypeToCategory(docTypeFolder);

    // Skip non-PDF/image uploads (e.g. .DS_Store, __MACOSX)
    const lowerFilename = filename.toLowerCase();
    const isSupported = /\.(pdf|jpg|jpeg|png|tiff?|webp)$/.test(lowerFilename);
    if (!isSupported) {
      console.log(`[s3-ingest] Skipping unsupported file type: ${filename}`);
      continue;
    }

    console.log(`[s3-ingest] Processing: tail=${tailNumber} type=${sourceCategory} file=${filename}`);

    // ── 6a. Look up aircraft by tail_number ──────────────────────────────
    const { data: aircraft, error: aircraftErr } = await supabase
      .from("aircraft")
      .select("id, tail_number")
      .eq("tail_number", tailNumber)
      .maybeSingle();

    if (aircraftErr) {
      const msg = `Aircraft lookup error for ${tailNumber}: ${aircraftErr.message}`;
      console.error(`[s3-ingest] ${msg}`);
      errors.push(msg);
      continue;
    }

    let aircraftId: string;

    if (!aircraft) {
      // Unknown tail number — create a quarantine record so nothing is lost
      console.warn(`[s3-ingest] Unknown tail number: ${tailNumber} — creating unmatched record`);

      const { data: unmatched, error: unmatchedErr } = await supabase
        .from("rv_record_sources")
        .insert({
          aircraft_id:       null,
          original_filename: filename,
          storage_path:      null,
          file_size_bytes:   fileSize,
          source_category:   sourceCategory,
          s3_key:            s3Key,
          ingestion_status:  "failed",
          ingestion_error:   `Unknown tail number: ${tailNumber}. File is in S3 at ${s3Key}. Manually assign aircraft_id to reprocess.`,
          observed_registration: tailNumber,
        })
        .select("id")
        .single();

      if (unmatchedErr) {
        console.error("[s3-ingest] Failed to create unmatched record:", unmatchedErr.message);
      } else {
        console.log(`[s3-ingest] Unmatched record created: ${unmatched?.id}`);
      }
      continue;
    }

    aircraftId = aircraft.id;

    // ── 6b. Check for duplicate (same s3_key) ────────────────────────────
    const { data: existing } = await supabase
      .from("rv_record_sources")
      .select("id, ingestion_status")
      .eq("s3_key", s3Key)
      .maybeSingle();

    if (existing) {
      console.log(`[s3-ingest] Duplicate S3 key — already registered as ${existing.id} (${existing.ingestion_status}), skipping`);
      continue;
    }

    // ── 6c. Create rv_record_sources row ─────────────────────────────────
    const { data: newSource, error: insertErr } = await supabase
      .from("rv_record_sources")
      .insert({
        aircraft_id:      aircraftId,
        original_filename: filename,
        storage_path:     null,         // S3 is the canonical store; no Supabase Storage path
        file_size_bytes:  fileSize,
        source_category:  sourceCategory,
        s3_key:           s3Key,
        ingestion_status: "pending",
        observed_registration: tailNumber,
      })
      .select("id")
      .single();

    if (insertErr || !newSource) {
      const msg = `Failed to create record source for ${s3Key}: ${insertErr?.message}`;
      console.error(`[s3-ingest] ${msg}`);
      errors.push(msg);
      continue;
    }

    const recordSourceId = newSource.id;
    console.log(`[s3-ingest] Created rv_record_sources: ${recordSourceId}`);

    // ── 6d. Start Textract async job ──────────────────────────────────────
    try {
      const startCmd = new StartDocumentAnalysisCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: s3Bucket,
            Name:   s3Key,
          },
        },
        FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
        NotificationChannel: {
          SNSTopicArn: snsTopicArn,
          RoleArn:     roleArn,
        },
        // Tag the job with the record source ID so the completion webhook can
        // look it up without scanning the whole table.
        // OutputConfig is optional — Textract results are fetched via GetDocumentAnalysis.
        JobTag: recordSourceId,
      });

      const startResp = await textract.send(startCmd);
      const jobId = startResp.JobId;

      if (!jobId) {
        throw new Error("Textract StartDocumentAnalysis returned no JobId");
      }

      // ── 6e. Store job ID and update status ───────────────────────────────
      await supabase
        .from("rv_record_sources")
        .update({
          textract_job_id:  jobId,
          ingestion_status: "extracting",
        })
        .eq("id", recordSourceId);

      // Log to rv_ingestion_log for pipeline visibility
      await supabase.from("rv_ingestion_log").insert({
        record_source_id: recordSourceId,
        step:             "textract_started",
        message:          `Textract async job started — JobId: ${jobId} | S3 key: ${s3Key}`,
      });

      console.log(`[s3-ingest] Textract job started: ${jobId} for source ${recordSourceId}`);

    } catch (textractErr) {
      const msg = textractErr instanceof Error ? textractErr.message : String(textractErr);
      console.error(`[s3-ingest] Failed to start Textract job for ${recordSourceId}:`, msg);

      await supabase
        .from("rv_record_sources")
        .update({
          ingestion_status: "failed",
          ingestion_error:  `Textract job start failed: ${msg}`,
        })
        .eq("id", recordSourceId);

      errors.push(`Textract start failed for ${filename}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    console.error(`[s3-ingest] Completed with ${errors.length} error(s):`, errors);
    // Return 200 so SNS doesn't retry — errors are stored in the DB
    return {
      statusCode: 200,
      body: JSON.stringify({ processed: records.length - errors.length, errors }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: records.length }),
  };
};
