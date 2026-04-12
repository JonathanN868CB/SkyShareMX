// records-vault-relabel — AUTH REQUIRED (Manager+)
//
// Thin wrapper that re-fires records-vault-label with action=generate for a
// single record_source_id. Kept separate from the label function itself so
// the Pipeline Operations Panel has a single consistent pattern for all
// row-level re-run endpoints.

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

  // Flip status back to pending so the UI clears any previous failed state.
  await adminClient
    .from("rv_record_sources")
    .update({ label_status: "pending" })
    .eq("id", recordSourceId);

  await adminClient.from("rv_ingestion_log").insert({
    record_source_id: recordSourceId,
    step:             "label_rerun_requested",
    message:          "Display label re-queued from Pipeline panel",
  });

  // Call records-vault-label with the service role as Bearer. Same-site
  // fetch keeps the request on Netlify's edge, mirroring the way
  // records-vault-textract-complete already triggers it at ingest time.
  const siteUrl = process.env.URL ?? process.env.DEPLOY_URL;
  const labelUrl = siteUrl
    ? `${siteUrl}/.netlify/functions/records-vault-label`
    : null;

  if (!labelUrl) return json(500, { error: "Cannot resolve label function URL" });

  fetch(labelUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` },
    body:    JSON.stringify({ recordSourceId, action: "generate" }),
  }).catch(() => {});

  return json(200, { ok: true, message: "Display label re-queued" });
};
