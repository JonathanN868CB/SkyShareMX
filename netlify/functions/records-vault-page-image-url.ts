// records-vault-page-image-url — AUTH REQUIRED
// Returns a short-lived signed URL for a pre-rendered page image stored in
// the records-vault bucket under {recordSourceId}/pages/{pageNumber}.jpg.
// These images are uploaded during OCR ingestion and bypass browser pdfjs
// codec limitations (JBIG2, CCITTFax, etc.).

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

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 60 minutes

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
  const anonKey     = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

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
  const pageNumber     = typeof payload.pageNumber === "number" ? payload.pageNumber : parseInt(String(payload.pageNumber), 10);

  if (!recordSourceId) {
    return jsonResponse(400, { error: "recordSourceId is required" });
  }
  if (isNaN(pageNumber) || pageNumber < 1) {
    return jsonResponse(400, { error: "pageNumber must be a positive integer" });
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the user has Records Vault permission — use user JWT for RLS check
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

  // Check that the page image actually exists in Storage
  // Try both .jpg and .png extensions
  const adminStorage = adminClient.storage.from("records-vault");

  let imagePath: string | null = null;
  for (const ext of ["jpg", "png"]) {
    const candidate = `${recordSourceId}/pages/${pageNumber}.${ext}`;
    const { data: files, error: listErr } = await adminStorage.list(
      `${recordSourceId}/pages`,
      { search: `${pageNumber}.${ext}` },
    );
    if (!listErr && files && files.length > 0) {
      imagePath = candidate;
      break;
    }
  }

  if (!imagePath) {
    return jsonResponse(404, { error: "Page image not available" });
  }

  // Generate signed download URL
  const { data, error: urlError } = await adminStorage.createSignedUrl(
    imagePath,
    SIGNED_URL_EXPIRY_SECONDS,
  );

  if (urlError || !data?.signedUrl) {
    console.error("[records-vault-page-image-url] createSignedUrl error:", urlError);
    return jsonResponse(500, { error: "Failed to generate image URL" });
  }

  return jsonResponse(200, { signedUrl: data.signedUrl });
};
