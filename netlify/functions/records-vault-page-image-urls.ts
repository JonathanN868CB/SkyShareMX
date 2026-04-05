// records-vault-page-image-urls — AUTH REQUIRED (Manager+)
// Returns batch signed upload URLs for pre-rendered page images.
// Called after records-vault-register when the client has rendered JBIG2
// pages to JPEG in the browser using PDFium WASM.

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

  // Manager+ check
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .single();

  const managerRoles = ["Super Admin", "Admin", "Manager"];
  if (!profile || !managerRoles.includes(profile.role)) {
    return jsonResponse(403, { error: "Manager or above required" });
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

  const recordSourceId = typeof payload.recordSourceId === "string" ? payload.recordSourceId.trim() : "";
  const pageCount = typeof payload.pageCount === "number" ? payload.pageCount : 0;

  if (!recordSourceId || pageCount < 1 || pageCount > 2000) {
    return jsonResponse(400, { error: "recordSourceId and pageCount (1-2000) required" });
  }

  // Verify the record source exists and belongs to a valid aircraft
  const { data: source } = await adminClient
    .from("rv_record_sources")
    .select("id")
    .eq("id", recordSourceId)
    .single();

  if (!source) {
    return jsonResponse(404, { error: "Record source not found" });
  }

  // Generate signed upload URLs for all pages in parallel
  const urlPromises = Array.from({ length: pageCount }, (_, i) => {
    const storagePath = `${recordSourceId}/pages/${i + 1}.jpg`;
    return adminClient.storage
      .from("records-vault")
      .createSignedUploadUrl(storagePath)
      .then(({ data, error }) => ({
        pageNumber: i + 1,
        storagePath,
        token: data?.token ?? null,
        uploadPath: data?.path ?? null,
        signedUrl: data?.signedUrl ?? null,
        error: error?.message ?? null,
      }));
  });

  const results = await Promise.all(urlPromises);
  const failed = results.filter((r) => r.error);

  if (failed.length === pageCount) {
    return jsonResponse(500, { error: "Failed to generate any upload URLs" });
  }

  return jsonResponse(200, {
    urls: results.filter((r) => !r.error),
    failedCount: failed.length,
  });
};
