// records-vault-register — AUTH REQUIRED
// Registers an uploaded PDF as an rv_record_sources row, then fires the
// process-record-source Supabase Edge Function (fire-and-forget) to kick off OCR.

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
const EDGE_FUNCTION_URL = `${SUPABASE_PROJECT_URL}/functions/v1/process-record-source`;

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

  if (!storagePath || !originalFilename || !aircraftId) {
    return jsonResponse(400, { error: "storagePath, originalFilename, and aircraftId are required" });
  }

  const validCategories = ["logbook", "work_package", "inspection", "ad_compliance", "major_repair", "other"];
  const category = validCategories.includes(sourceCategory) ? sourceCategory : "other";

  // Insert the record source row
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
    })
    .select("id")
    .single();

  if (insertErr || !newSource) {
    console.error("[records-vault-register] Insert error:", insertErr);
    return jsonResponse(500, { error: "Failed to register record source" });
  }

  // Fire-and-forget: trigger Edge Function to begin OCR ingestion
  // We don't await this — the client polls ingestion_status via Supabase Realtime
  fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({ record_source_id: newSource.id }),
  }).catch((err) => {
    console.error("[records-vault-register] Edge Function trigger failed:", err);
  });

  return jsonResponse(200, { recordSourceId: newSource.id });
};
