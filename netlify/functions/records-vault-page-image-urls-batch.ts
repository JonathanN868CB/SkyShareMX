// records-vault-page-image-urls-batch — AUTH REQUIRED
//
// Returns signed URLs for a batch of page images in one round trip. The
// viewer's thumbnail strip calls this once per visible window instead of
// firing N individual requests. Input: { recordSourceId, pageNumbers: number[] }
// Output: { urls: { [pageNumber]: string | null } } — null means not yet ready.

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

const SIGNED_URL_EXPIRY_SECONDS = 3600;
const MAX_BATCH = 50;

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

  if (!event.body) return jsonResponse(400, { error: "Missing request body" });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const recordSourceId = typeof payload.recordSourceId === "string" ? payload.recordSourceId.trim() : "";
  const rawPageNumbers = Array.isArray(payload.pageNumbers) ? payload.pageNumbers : null;

  if (!recordSourceId) return jsonResponse(400, { error: "recordSourceId is required" });
  if (!rawPageNumbers) return jsonResponse(400, { error: "pageNumbers must be an array" });

  const pageNumbers = Array.from(
    new Set(
      rawPageNumbers
        .map((n) => (typeof n === "number" ? n : parseInt(String(n), 10)))
        .filter((n) => Number.isFinite(n) && n >= 1),
    ),
  ).slice(0, MAX_BATCH);

  if (pageNumbers.length === 0) {
    return jsonResponse(200, { urls: {} });
  }

  // RLS check via user client — confirms the caller can see this source.
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: source, error: sourceErr } = await userClient
    .from("rv_record_sources")
    .select("id")
    .eq("id", recordSourceId)
    .single();
  if (sourceErr || !source) {
    return jsonResponse(404, { error: "Record source not found or access denied" });
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // One DB query for all requested pages' readiness.
  const { data: rows, error: rowsErr } = await adminClient
    .from("rv_pages")
    .select("page_number, page_image_uploaded_at")
    .eq("record_source_id", recordSourceId)
    .in("page_number", pageNumbers);

  if (rowsErr) {
    console.error("[page-image-urls-batch] rv_pages lookup error:", rowsErr);
    return jsonResponse(500, { error: "Failed to check page readiness" });
  }

  const readyPages = new Set(
    (rows ?? [])
      .filter((r: { page_image_uploaded_at: string | null }) => !!r.page_image_uploaded_at)
      .map((r: { page_number: number }) => r.page_number),
  );

  const storage = adminClient.storage.from("records-vault");
  const urls: Record<number, string | null> = {};

  await Promise.all(
    pageNumbers.map(async (pageNumber) => {
      if (!readyPages.has(pageNumber)) {
        urls[pageNumber] = null;
        return;
      }
      const path = `${recordSourceId}/pages/${pageNumber}.jpg`;
      const { data, error } = await storage.createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
      urls[pageNumber] = error || !data?.signedUrl ? null : data.signedUrl;
    }),
  );

  return jsonResponse(200, { urls });
};
