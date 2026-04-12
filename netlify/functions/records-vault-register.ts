// records-vault-register — AUTH REQUIRED (Manager+)
//
// Registers a locally-uploaded document as an rv_record_sources row, copies the
// PDF from Supabase Storage to S3, and starts an AWS Textract async job. This
// routes local uploads through the same pipeline as S3-ingested files:
//
//   register → S3 copy → Textract → SNS → textract-complete → events/embeddings/label/rasterize
//
// This file is one of THREE places in the codebase that may import @aws-sdk
// (the others are records-vault-s3-ingest and records-vault-rasterize-background).

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  TextractClient,
  StartDocumentAnalysisCommand,
  FeatureType,
} from "@aws-sdk/client-textract";

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

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getAccessToken(event: HandlerEvent): string | null {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header) return null;
  const parts = header.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const [scheme, ...rest] = parts;
  if (!/^bearer$/i.test(scheme)) return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}


export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const accessToken = getAccessToken(event);
  if (!accessToken) {
    return jsonResponse(401, { error: "Authentication required" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRole || !anonKey) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

  // Verify caller session
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid or expired session" });
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fetch profile for role check + imported_by reference
  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", userData.user.id)
    .single();

  if (profileErr || !profile) {
    return jsonResponse(401, { error: "User profile not found" });
  }

  const managerRoles = ["Super Admin", "Admin", "Manager"];
  if (!managerRoles.includes(profile.role)) {
    return jsonResponse(403, { error: "Manager or above required to register records" });
  }

  if (!event.body) {
    return jsonResponse(400, { error: "Missing request body" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const storagePath         = typeof payload.storagePath         === "string" ? payload.storagePath.trim()         : "";
  const originalFilename    = typeof payload.originalFilename    === "string" ? payload.originalFilename.trim()    : "";
  const aircraftId          = typeof payload.aircraftId          === "string" ? payload.aircraftId.trim()          : "";
  const sourceCategory      = typeof payload.sourceCategory      === "string" ? payload.sourceCategory.trim()      : "other";
  const fileHash            = typeof payload.fileHash            === "string" ? payload.fileHash.trim()            : null;
  const fileSizeBytes       = typeof payload.fileSizeBytes       === "number" ? payload.fileSizeBytes              : null;
  const observedRegistration = typeof payload.observedRegistration === "string" ? payload.observedRegistration.trim() : null;
  const dateRangeStart      = typeof payload.dateRangeStart      === "string" ? payload.dateRangeStart             : null;
  const dateRangeEnd        = typeof payload.dateRangeEnd        === "string" ? payload.dateRangeEnd               : null;
  const notes               = typeof payload.notes               === "string" ? payload.notes.trim()               : null;
  const importBatch         = typeof payload.importBatch         === "string" ? payload.importBatch.trim()         : null;
  const pageImagesPreRendered = typeof payload.pageImagesPreRendered === "number" ? payload.pageImagesPreRendered : 0;

  if (!storagePath || !originalFilename || !aircraftId) {
    return jsonResponse(400, { error: "storagePath, originalFilename, and aircraftId are required" });
  }

  const validCategories = ["logbook", "work_package", "inspection", "ad_compliance", "major_repair", "other"];
  const category = validCategories.includes(sourceCategory) ? sourceCategory : "other";

  // ── 1. Insert the record source row ─────────────────────────────────────
  const { data: newSource, error: insertErr } = await adminClient
    .from("rv_record_sources")
    .insert({
      aircraft_id: aircraftId,
      original_filename: originalFilename,
      file_hash: fileHash,
      storage_path: storagePath,
      file_size_bytes: fileSizeBytes,
      source_category: category,
      observed_registration: observedRegistration,
      date_range_start: dateRangeStart,
      date_range_end: dateRangeEnd,
      notes,
      import_batch: importBatch,
      imported_by: profile.id,
      ingestion_status: "pending",
      page_images_stored: pageImagesPreRendered > 0 ? pageImagesPreRendered : 0,
    })
    .select("id")
    .single();

  if (insertErr || !newSource) {
    console.error("[records-vault-register] Insert error:", insertErr);
    return jsonResponse(500, { error: "Failed to register record source" });
  }

  const recordSourceId = newSource.id;

  // ── 2. Copy PDF from Supabase Storage → S3 and start Textract ──────────
  // Textract can only analyze files in S3. For local uploads (which land in
  // Supabase Storage), we copy the PDF to the Textract S3 bucket and start
  // the same async job that s3-ingest starts. From here, the existing
  // SNS → textract-complete pipeline handles everything downstream.

  const textractRegion  = process.env.TEXTRACT_REGION;
  const textractKeyId   = process.env.TEXTRACT_KEY_ID;
  const textractSecret  = process.env.TEXTRACT_SECRET_KEY;
  const s3Bucket        = process.env.TEXTRACT_S3_BUCKET;
  const snsTopicArn     = process.env.TEXTRACT_SNS_TOPIC_ARN;
  const roleArn         = process.env.TEXTRACT_ROLE_ARN;

  if (!textractRegion || !textractKeyId || !textractSecret || !s3Bucket || !snsTopicArn || !roleArn) {
    console.error("[records-vault-register] Missing Textract env vars — pipeline will not start");
    await adminClient.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step: "textract_failed",
      message: "Textract environment variables not configured — pipeline cannot start",
    });
    return jsonResponse(200, { recordSourceId, warning: "Textract not configured" });
  }

  const awsCreds = { accessKeyId: textractKeyId, secretAccessKey: textractSecret };

  try {
    // 2a. Download PDF from Supabase Storage
    const { data: fileData, error: dlErr } = await adminClient.storage
      .from("records-vault")
      .download(storagePath);

    if (dlErr || !fileData) {
      throw new Error(`Supabase Storage download failed: ${dlErr?.message ?? "no data"}`);
    }

    const pdfBytes = Buffer.from(await fileData.arrayBuffer());

    // 2b. Upload to S3
    const s3Key = `local-uploads/${recordSourceId}/${originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const s3 = new S3Client({ region: textractRegion, credentials: awsCreds });

    await s3.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
      Body: pdfBytes,
      ContentType: "application/pdf",
    }));

    // 2c. Start Textract async job
    const textract = new TextractClient({ region: textractRegion, credentials: awsCreds });

    const startResp = await textract.send(new StartDocumentAnalysisCommand({
      DocumentLocation: {
        S3Object: { Bucket: s3Bucket, Name: s3Key },
      },
      FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
      NotificationChannel: {
        SNSTopicArn: snsTopicArn,
        RoleArn: roleArn,
      },
      JobTag: recordSourceId,
    }));

    const jobId = startResp.JobId;
    if (!jobId) throw new Error("Textract StartDocumentAnalysis returned no JobId");

    // 2d. Update the source row with S3 key + job ID
    await adminClient
      .from("rv_record_sources")
      .update({
        s3_key: s3Key,
        textract_job_id: jobId,
        ingestion_status: "extracting",
      })
      .eq("id", recordSourceId);

    await adminClient.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step: "textract_started",
      message: `Textract async job started — JobId: ${jobId} | S3 key: ${s3Key}`,
    });

    console.log(`[register] Textract job started: ${jobId} for source ${recordSourceId}`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[register] Pipeline start failed for ${recordSourceId}:`, msg);

    await adminClient
      .from("rv_record_sources")
      .update({
        ingestion_status: "failed",
        ingestion_error: `Pipeline start failed: ${msg}`,
      })
      .eq("id", recordSourceId);

    await adminClient.from("rv_ingestion_log").insert({
      record_source_id: recordSourceId,
      step: "textract_failed",
      message: `Pipeline start failed: ${msg}`,
    });

    // Still return the source ID — the row exists, user can retry from Pipeline
    return jsonResponse(200, { recordSourceId, warning: `Pipeline start failed: ${msg}` });
  }

  return jsonResponse(200, { recordSourceId });
};
