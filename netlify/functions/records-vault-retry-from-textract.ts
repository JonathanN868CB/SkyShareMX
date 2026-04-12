// records-vault-retry-from-textract — AUTH REQUIRED (Manager+)
//
// Re-runs the downstream pipeline (events → embeddings → label) from the
// existing rv_pages OCR output without re-invoking Textract. This is the
// cheapest way to recover from a downstream crash on a large document —
// the Textract bill is already paid and the OCR rows are still in the DB.

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
  const embedFnUrl  = `${supabaseUrl}/functions/v1/generate-page-embeddings`;

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

  // Verify the source actually has OCR pages already — this endpoint is
  // only meaningful when Textract already succeeded.
  const { data: source } = await adminClient
    .from("rv_record_sources")
    .select("id, ingestion_status")
    .eq("id", recordSourceId)
    .maybeSingle();

  if (!source) return json(404, { error: "Record source not found" });
  if (source.ingestion_status !== "indexed") {
    return json(400, { error: "Source is not indexed — use records-vault-retry to re-run Textract first" });
  }

  // Reset downstream stages.
  await adminClient
    .from("rv_record_sources")
    .update({
      extraction_status: "extracting",
      events_status:     "pending",
      chunk_status:      "chunking",
      chunks_generated:  null,
      label_status:      "pending",
    })
    .eq("id", recordSourceId);

  // Wipe existing chunks so the re-embed starts clean.
  await adminClient
    .from("rv_page_chunks")
    .delete()
    .eq("record_source_id", recordSourceId);

  await adminClient.from("rv_ingestion_log").insert({
    record_source_id: recordSourceId,
    step:             "retry_from_textract",
    message:          "Downstream stages (embed/label) re-queued from Pipeline panel",
  });

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` };
  const edgeBody = JSON.stringify({ record_source_id: recordSourceId });

  fetch(embedFnUrl, { method: "POST", headers, body: edgeBody }).catch(() => {});

  const siteUrl = process.env.URL ?? process.env.DEPLOY_URL;
  const labelUrl = siteUrl
    ? `${siteUrl}/.netlify/functions/records-vault-label`
    : null;
  if (labelUrl) {
    fetch(labelUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ recordSourceId, action: "generate" }),
    }).catch(() => {});
  }

  return json(200, { ok: true, message: "Downstream stages (embed/label) re-queued from existing Textract output" });
};
