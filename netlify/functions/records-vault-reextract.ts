// records-vault-reextract — AUTH REQUIRED (Manager+)
// Triggers the extract-record-events Edge Function for one or all indexed
// documents belonging to an aircraft. Used to re-run event extraction after
// the extraction model is updated, or for documents uploaded before Phase 2.

import { createClient } from "@supabase/supabase-js";

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
};
type HandlerResponse = { statusCode: number; headers?: Record<string, string>; body?: string };

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
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
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const token = getToken(event);
  if (!token) return json(401, { error: "Authentication required" });

  const supabaseUrl  = process.env.SUPABASE_URL;
  const serviceRole  = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey      = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const edgeFnUrl    = process.env.SUPABASE_EXTRACT_FN_URL
    ?? `${supabaseUrl}/functions/v1/extract-record-events`;
  const embedFnUrl   = `${supabaseUrl}/functions/v1/generate-page-embeddings`;

  if (!supabaseUrl || !serviceRole || !anonKey) return json(500, { error: "Server config error" });

  // Verify session
  const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !user) return json(401, { error: "Invalid session" });

  // Manager+ only
  const adminClient = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
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

  // Accept either a single record_source_id or an aircraft_id (reprocess all)
  const recordSourceId = typeof payload.recordSourceId === "string" ? payload.recordSourceId : null;
  const aircraftId     = typeof payload.aircraftId === "string" ? payload.aircraftId : null;

  if (!recordSourceId && !aircraftId) {
    return json(400, { error: "recordSourceId or aircraftId required" });
  }

  // Collect source IDs to reprocess
  let sourceIds: string[] = [];

  if (recordSourceId) {
    sourceIds = [recordSourceId];
  } else {
    const { data: sources } = await adminClient
      .from("rv_record_sources")
      .select("id")
      .eq("aircraft_id", aircraftId!)
      .eq("ingestion_status", "indexed");
    sourceIds = (sources ?? []).map((s: { id: string }) => s.id);
  }

  if (sourceIds.length === 0) return json(200, { queued: 0, message: "No indexed sources found" });

  // Fire extraction + embedding re-generation for each source.
  // Fire-and-forget: don't await the edge functions — they run independently
  // on Supabase and report progress via rv_ingestion_log + Realtime.
  // Awaiting them here caused Netlify function timeouts on larger documents.
  const headers     = { "Content-Type": "application/json", Authorization: `Bearer ${serviceRole}` };
  const siteUrl     = process.env.URL ?? process.env.DEPLOY_URL;
  const rasterizeUrl = siteUrl
    ? `${siteUrl}/.netlify/functions/records-vault-rasterize-background`
    : null;

  for (const id of sourceIds) {
    const edgeBody = JSON.stringify({ record_source_id: id });
    // Reset statuses so the Pipeline UI shows them as running
    await adminClient
      .from("rv_record_sources")
      .update({ extraction_status: "extracting", chunk_status: "chunking" })
      .eq("id", id);
    fetch(edgeFnUrl,  { method: "POST", headers, body: edgeBody }).catch(() => {});
    fetch(embedFnUrl, { method: "POST", headers, body: edgeBody }).catch(() => {});

    // Also trigger background rasterization so page images are refreshed.
    if (rasterizeUrl) {
      fetch(rasterizeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordSourceId: id }),
      }).catch(() => {});
    }
  }

  return json(200, {
    queued:    sourceIds.length,
    message:   `Triggered extraction + embedding for ${sourceIds.length} document(s)`,
  });
};
