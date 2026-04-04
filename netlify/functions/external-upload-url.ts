// external-upload-url — NO AUTH
// Validates a request token and returns a signed Supabase Storage upload URL.
// The client uploads the file directly to storage; no file data passes through this function.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { decodeToken } from "./_token-encoder";

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

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
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

  const rawToken = typeof payload.token === "string" ? payload.token.trim() : "";
  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim() : "application/octet-stream";

  if (!rawToken || !fileName) {
    return jsonResponse(400, { error: "Missing token or fileName" });
  }

  let token: string;
  try {
    token = decodeToken(rawToken);
  } catch {
    return jsonResponse(404, { error: "Request not found" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validate token + status
  const { data: request, error: reqError } = await adminClient
    .from("external_requests")
    .select("id, status, expires_at")
    .eq("token", token)
    .single();

  if (reqError || !request) {
    return jsonResponse(404, { error: "Request not found" });
  }

  if (request.status !== "sent") {
    return jsonResponse(400, { error: "Request is not open for uploads." });
  }

  if (request.expires_at && new Date(request.expires_at) < new Date()) {
    return jsonResponse(410, { error: "This request link has expired." });
  }

  const safeName = sanitizeFileName(fileName);
  const storagePath = `${token}/${randomUUID()}-${safeName}`;

  const { data, error: urlError } = await adminClient.storage
    .from("external-submissions")
    .createSignedUploadUrl(storagePath);

  if (urlError || !data?.signedUrl) {
    console.error("createSignedUploadUrl error", urlError);
    return jsonResponse(500, { error: "Failed to generate upload URL" });
  }

  return jsonResponse(200, {
    signedUrl: data.signedUrl,
    storagePath,
    mimeType,
  });
};
