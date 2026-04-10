// bb-approval-pdf-url — AUTH REQUIRED
// Returns a short-lived signed URL for the unsigned or signed approval PDF.
// The bb-approvals bucket is locked down to service-role only, so authed
// users go through this function to read their own PDFs.

import { createClient } from "@supabase/supabase-js";

type HandlerEvent = {
  httpMethod: string;
  queryStringParameters?: Record<string, string> | null;
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
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const accessToken = getAccessToken(event);
  if (!accessToken) return jsonResponse(401, { error: "Authentication required" });

  const approvalRequestId = event.queryStringParameters?.approvalRequestId?.trim();
  const variant = event.queryStringParameters?.variant === "signed" ? "signed" : "unsigned";
  if (!approvalRequestId) return jsonResponse(400, { error: "Missing approvalRequestId" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceRole || !anonKey) return jsonResponse(500, { error: "Server configuration error" });

  // Verify caller session
  const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userErr } = await authClient.auth.getUser(accessToken);
  if (userErr || !userData?.user) return jsonResponse(401, { error: "Invalid or expired session" });

  const admin = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  let path: string | null = null;
  if (variant === "unsigned") {
    const { data: row } = await admin
      .from("bb_approval_requests")
      .select("unsigned_pdf_path")
      .eq("id", approvalRequestId)
      .maybeSingle();
    path = row?.unsigned_pdf_path ?? null;
  } else {
    const { data: row } = await admin
      .from("bb_approval_submissions")
      .select("signed_pdf_path")
      .eq("approval_request_id", approvalRequestId)
      .maybeSingle();
    path = row?.signed_pdf_path ?? null;
  }

  if (!path) return jsonResponse(404, { error: "PDF not available" });

  const { data: signed, error: urlErr } = await admin.storage
    .from("bb-approvals")
    .createSignedUrl(path, 300);
  if (urlErr || !signed) return jsonResponse(500, { error: "Failed to sign URL" });

  return jsonResponse(200, { url: signed.signedUrl });
};
