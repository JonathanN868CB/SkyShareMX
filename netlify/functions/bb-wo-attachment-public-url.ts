// bb-wo-attachment-public-url — NO AUTH
// Returns a short-TTL signed URL for a WO item attachment so the public
// approval portal can render discrepancy photos without a user session.
//
// Security chain verified before issuing the URL:
//   attachment → wo_item → work_order → bb_approval_requests (token match, not revoked)
//
// GET ?token=<encodedToken>&attachmentId=<uuid>

import { createClient } from "@supabase/supabase-js";
import { decodeToken } from "./_token-encoder";

type HandlerEvent = {
  httpMethod: string;
  queryStringParameters?: Record<string, string> | null;
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

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const rawToken    = event.queryStringParameters?.token?.trim();
  const attachmentId = event.queryStringParameters?.attachmentId?.trim();

  if (!rawToken || !attachmentId) {
    return jsonResponse(400, { error: "Missing token or attachmentId" });
  }

  let token: string;
  try { token = decodeToken(rawToken); } catch { return jsonResponse(404, { error: "Not found" }); }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return jsonResponse(500, { error: "Server configuration error" });

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Resolve the attachment → its work_order_id
  const { data: attachment, error: attErr } = await admin
    .from("bb_wo_item_attachments")
    .select("id, storage_path, work_order_id, kind")
    .eq("id", attachmentId)
    .maybeSingle();

  if (attErr || !attachment) return jsonResponse(404, { error: "Attachment not found" });

  // 2. Verify the work_order_id is covered by a valid (not revoked) approval
  //    request that matches the token
  const { data: reqRow, error: reqErr } = await admin
    .from("bb_approval_requests")
    .select("id, status, expires_at")
    .eq("token", token)
    .eq("work_order_id", attachment.work_order_id)
    .maybeSingle();

  if (reqErr || !reqRow) return jsonResponse(404, { error: "Not found" });
  if (reqRow.status === "revoked") return jsonResponse(410, { error: "Approval revoked" });

  // 3. Issue a short-TTL signed URL (5 minutes is enough to load the image)
  const { data: signedData, error: signErr } = await admin.storage
    .from("bb-wo-attachments")
    .createSignedUrl(attachment.storage_path as string, 300);

  if (signErr || !signedData?.signedUrl) {
    console.error("Failed to create signed URL", signErr);
    return jsonResponse(500, { error: "Failed to generate URL" });
  }

  return jsonResponse(200, { url: signedData.signedUrl });
};
