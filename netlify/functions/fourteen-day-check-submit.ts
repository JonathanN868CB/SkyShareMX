// fourteen-day-check-submit — NO AUTH
// Accepts a 14-day check submission from the mechanic's public form.
// Creates a submission row + attachment rows. No status lock — the same token
// always accepts new submissions (one per 14-day cycle event).

import { createClient } from "@supabase/supabase-js";
import { decodeToken } from "./_token-encoder";

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

type AttachmentMeta = {
  fieldId: string;
  fileName: string;
  storagePath: string;
  mimeType?: string;
  fileSizeBytes?: number;
};

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
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

  const rawToken = typeof payload.token === "string" ? payload.token.trim() : "";
  const submitterName = typeof payload.submitterName === "string" ? payload.submitterName.trim() : "";
  const aircraftId = typeof payload.aircraftId === "string" ? payload.aircraftId.trim() : "";
  const fieldValues = payload.fieldValues && typeof payload.fieldValues === "object" ? payload.fieldValues : {};
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : null;
  const attachments: AttachmentMeta[] = Array.isArray(payload.attachments) ? payload.attachments : [];

  if (!rawToken) {
    return jsonResponse(400, { error: "Missing token" });
  }
  if (!submitterName) {
    return jsonResponse(400, { error: "Submitter name is required" });
  }
  if (!aircraftId) {
    return jsonResponse(400, { error: "Aircraft ID is required" });
  }

  let token: string;
  try {
    token = decodeToken(rawToken);
  } catch {
    return jsonResponse(404, { error: "Check not found" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validate token exists
  const { data: tokenRow, error: tokenError } = await adminClient
    .from("fourteen_day_check_tokens")
    .select("id, aircraft_id")
    .eq("token", token)
    .single();

  if (tokenError || !tokenRow) {
    return jsonResponse(404, { error: "Check not found" });
  }

  // Create submission
  const { data: submission, error: subError } = await adminClient
    .from("fourteen_day_check_submissions")
    .insert({
      token_id: tokenRow.id,
      aircraft_id: tokenRow.aircraft_id,
      submitter_name: submitterName,
      field_values: fieldValues,
      notes: notes || null,
      submitter_ip: event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ?? null,
    })
    .select("id")
    .single();

  if (subError) {
    console.error("Submission insert error", subError);
    return jsonResponse(500, { error: "Failed to save submission" });
  }

  // Register attachments
  if (attachments.length > 0) {
    const attachmentRows = attachments.map((a) => ({
      submission_id: submission.id,
      field_id: a.fieldId,
      file_name: a.fileName,
      storage_path: a.storagePath,
      mime_type: a.mimeType ?? null,
      file_size_bytes: a.fileSizeBytes ?? null,
    }));

    const { error: attachError } = await adminClient
      .from("fourteen_day_check_attachments")
      .insert(attachmentRows);

    if (attachError) {
      console.error("Attachment insert error", attachError);
      // Don't fail the submission — attachments can be noted as missing
    }
  }

  return jsonResponse(200, { success: true, submissionId: submission.id });
};
