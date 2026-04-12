// records-vault-verify-upload — AUTH REQUIRED (Manager+)
//
// After the client PUTs a file to Supabase Storage via a signed upload URL,
// it calls this endpoint to confirm the object actually landed. Supabase
// Storage rarely silently drops a PUT, but browser tab closures, flaky
// networks, or content-length mismatches can all produce a "200 OK" at the
// XHR layer without the object existing. The Pipeline Operations Panel
// needs honest state, so we HEAD-check before allowing register.

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

  const managerRoles = ["Super Admin", "Admin", "Manager", "Director of Maintenance", "DPE"];
  if (!profile || !managerRoles.includes(profile.role)) {
    return json(403, { error: "Manager role required" });
  }

  if (!event.body) return json(400, { error: "Missing body" });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(event.body); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const storagePath = typeof payload.storagePath === "string" ? payload.storagePath : null;
  if (!storagePath) return json(400, { error: "storagePath required" });

  // storagePath is "{aircraftId}/{uuid}-{filename}" — split into dir + file so
  // we can ask Supabase Storage for just that one entry with search filter.
  const lastSlash = storagePath.lastIndexOf("/");
  if (lastSlash < 0) return json(400, { error: "Invalid storagePath shape" });
  const dir      = storagePath.slice(0, lastSlash);
  const fileName = storagePath.slice(lastSlash + 1);

  const { data: files, error: listErr } = await adminClient.storage
    .from("records-vault")
    .list(dir, { search: fileName, limit: 1 });

  if (listErr) {
    console.error("[verify-upload] list error:", listErr);
    return json(500, { error: `Storage list failed: ${listErr.message}` });
  }

  const match = (files ?? []).find((f) => f.name === fileName);
  if (!match) {
    return json(404, { ok: false, error: "Object not found in Storage" });
  }

  return json(200, {
    ok:          true,
    sizeBytes:   match.metadata?.size ?? null,
    contentType: match.metadata?.mimetype ?? null,
    etag:        match.metadata?.eTag ?? null,
  });
};
