// records-vault-delete — AUTH REQUIRED (Manager+)
//
// Permanently deletes an rv_record_sources row and all associated Storage files.
// Database children (rv_pages, rv_maintenance_events, rv_page_chunks, rv_ingestion_log)
// are handled automatically via ON DELETE CASCADE.
//
// Storage paths cleaned up:
//   - source.storage_path          (original uploaded PDF)
//   - page-cache/{sourceId}/*      (cached single-page PDFs from records-vault-page-url)
//   - {sourceId}/pages/*           (thumbnail images from OCR ingestion)

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
  const h = (event.headers?.authorization ?? event.headers?.Authorization ?? "").trim();
  const parts = h.split(/\s+/);
  const token = parts.length >= 2 ? parts.slice(1).join(" ").trim() : parts[0] ?? "";
  return token.length > 0 ? token : null;
}

// Delete all files under a Storage prefix (list → delete in batches of 100)
async function deleteStoragePrefix(
  storage: ReturnType<ReturnType<typeof createClient>["storage"]["from"]>,
  prefix: string,
): Promise<void> {
  const { data: files, error } = await storage.list(prefix, { limit: 1000 });
  if (error || !files || files.length === 0) return;

  const paths = files.map((f) => `${prefix}/${f.name}`);
  // Delete in batches of 100 (Supabase limit)
  for (let i = 0; i < paths.length; i += 100) {
    await storage.remove(paths.slice(i, i + 100));
  }
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const token = getToken(event);
  if (!token) return json(401, { error: "Authentication required" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey     = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

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
    return json(403, { error: "Manager role required to delete records" });
  }

  if (!event.body) return json(400, { error: "Missing body" });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(event.body); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const recordSourceId = typeof payload.recordSourceId === "string" ? payload.recordSourceId.trim() : "";
  if (!recordSourceId) return json(400, { error: "recordSourceId required" });

  // Fetch the source record to get storage_path + stats for the response
  const { data: source, error: fetchErr } = await adminClient
    .from("rv_record_sources")
    .select("id, storage_path, original_filename, page_count, aircraft_id")
    .eq("id", recordSourceId)
    .single();

  if (fetchErr || !source) return json(404, { error: "Record source not found" });

  // ── 1. Delete Storage files ────────────────────────────────────────────────
  const bucket = adminClient.storage.from("records-vault");

  // Delete in parallel: original PDF, cached pages, thumbnail images
  await Promise.allSettled([
    // Original uploaded PDF
    bucket.remove([source.storage_path]),
    // Cached single-page PDFs (from records-vault-page-url)
    deleteStoragePrefix(bucket, `page-cache/${recordSourceId}`),
    // Thumbnail images (from OCR ingestion with include_image_base64: true)
    deleteStoragePrefix(bucket, `${recordSourceId}/pages`),
  ]);

  // ── 2. Delete DB row — CASCADE removes all children ────────────────────────
  // Children deleted automatically: rv_pages, rv_maintenance_events,
  // rv_page_chunks, rv_ingestion_log
  const { error: deleteErr } = await adminClient
    .from("rv_record_sources")
    .delete()
    .eq("id", recordSourceId);

  if (deleteErr) {
    console.error("[records-vault-delete] DB delete failed:", deleteErr.message);
    return json(500, { error: `Delete failed: ${deleteErr.message}` });
  }

  console.log(`[records-vault-delete] Deleted ${source.original_filename} (${recordSourceId}) by user ${user.id}`);

  return json(200, {
    success:  true,
    deleted:  source.original_filename,
    pages:    source.page_count ?? 0,
  });
};
