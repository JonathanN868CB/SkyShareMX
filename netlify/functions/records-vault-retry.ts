// records-vault-retry — AUTH REQUIRED (Manager+)
// Resets a failed or partial rv_record_sources row and re-triggers the OCR
// Edge Function. Safe to call multiple times — upsert handles duplicates.

import { createClient } from "@supabase/supabase-js";

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

const SUPABASE_PROJECT_URL = "https://xzcrkzvonjyznzxdbpjj.supabase.co";
const EDGE_FUNCTION_URL    = `${SUPABASE_PROJECT_URL}/functions/v1/process-record-source`;

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const accessToken = getAccessToken(event);
  if (!accessToken) return jsonResponse(401, { error: "Authentication required" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey     = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRole || !anonKey) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

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

  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", userData.user.id)
    .single();

  if (profileErr || !profile) return jsonResponse(401, { error: "User profile not found" });

  const managerRoles = ["Super Admin", "Admin", "Manager"];
  if (!managerRoles.includes(profile.role)) {
    return jsonResponse(403, { error: "Manager or above required" });
  }

  if (!event.body) return jsonResponse(400, { error: "Missing request body" });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const recordSourceId = typeof payload.recordSourceId === "string"
    ? payload.recordSourceId.trim()
    : "";
  if (!recordSourceId) return jsonResponse(400, { error: "recordSourceId required" });

  // Verify the source exists
  const { data: source, error: sourceErr } = await adminClient
    .from("rv_record_sources")
    .select("id, ingestion_status, original_filename")
    .eq("id", recordSourceId)
    .single();

  if (sourceErr || !source) return jsonResponse(404, { error: "Record source not found" });

  // Only allow retry if failed, partial, or indexed (re-verify)
  const retryableStatuses = ["failed", "indexed", "pending"];
  if (!retryableStatuses.includes(source.ingestion_status)) {
    return jsonResponse(409, {
      error: `Cannot retry — source is currently '${source.ingestion_status}'`,
    });
  }

  // Reset status and clear prior results so the UI reflects a fresh attempt
  await adminClient.from("rv_record_sources").update({
    ingestion_status:       "pending",
    ingestion_error:        null,
    pages_extracted:        null,
    pages_inserted:         null,
    verification_status:    "unverified",
    ingestion_started_at:   null,
    ingestion_completed_at: null,
  }).eq("id", recordSourceId);

  // Log the retry
  await adminClient.from("rv_ingestion_log").insert({
    record_source_id: recordSourceId,
    step: "queued",
    message: `Retry triggered by ${profile.id}`,
  });

  // Fire Edge Function (fire-and-forget)
  fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({ record_source_id: recordSourceId }),
  }).catch((err) => {
    console.error("[records-vault-retry] Edge Function trigger failed:", err);
  });

  return jsonResponse(200, {
    ok: true,
    message: `Retry triggered for ${source.original_filename}`,
  });
};
