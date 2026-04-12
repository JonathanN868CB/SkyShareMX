// records-vault-reextract-events — AUTH REQUIRED (Manager+)
//
// Narrow re-run endpoint: re-fires the extract-record-events Edge Function
// for a single record_source_id without touching OCR, embeddings, or labels.
// Used by the Pipeline Operations Panel "Re-events" button.

import { createClient } from "@supabase/supabase-js";

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
};
type HandlerResponse = { statusCode: number; headers?: Record<string, string>; body?: string };

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return { statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function getToken(event: HandlerEvent): string | null {
  const h = event.headers?.authorization ?? event.headers?.Authorization ?? "";
  const parts = h.trim().split(/\s+/);
  const token = parts.length >= 2 ? parts.slice(1).join(" ").trim() : parts[0] ?? "";
  return token.length > 0 ? token : null;
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST")    return json(405, { error: "Method not allowed" });

  const token = getToken(event);
  if (!token) return json(401, { error: "Authentication required" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey     = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const edgeFnUrl   = process.env.SUPABASE_EXTRACT_FN_URL
    ?? `${supabaseUrl}/functions/v1/extract-record-events`;

  if (!supabaseUrl || !serviceRole || !anonKey) return json(500, { error: "Server config error" });

  const authClient  = createClient(supabaseUrl, anonKey,     { auth: { autoRefreshToken: false, persistSession: false } });
  const adminClient = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !user) return json(401, { error: "Invalid session" });

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const managerRoles = ["Manager", "Director of Maintenance", "DPE", "Admin", "Super Admin"];
  if (!profile || !managerRoles.includes(profile.role)) {
    return json(403, { error: "Manager role required" });
  }

  if (!event.body) return json(400, { error: "Missing body" });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(event.body); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const recordSourceId = typeof payload.recordSourceId === "string" ? payload.recordSourceId : null;
  if (!recordSourceId) return json(400, { error: "recordSourceId required" });

  // Reset both the legacy and new status columns so the Pipeline UI flips blue.
  await adminClient
    .from("rv_record_sources")
    .update({ extraction_status: "extracting", events_status: "pending" })
    .eq("id", recordSourceId);

  await adminClient.from("rv_ingestion_log").insert({
    record_source_id: recordSourceId,
    step:             "events_rerun_requested",
    message:          "Event extraction re-queued from Pipeline panel",
  });

  // Fire-and-forget — edge function reports progress via rv_ingestion_log.
  fetch(edgeFnUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` },
    body:    JSON.stringify({ record_source_id: recordSourceId }),
  }).catch(() => {});

  return json(200, { ok: true, message: "Event extraction re-queued" });
};
