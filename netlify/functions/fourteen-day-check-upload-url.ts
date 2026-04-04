// fourteen-day-check-upload-url — NO AUTH
// Validates a 14-day check token and returns a signed Supabase Storage upload URL.
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
  const fieldId = typeof payload.fieldId === "string" ? payload.fieldId.trim() : "";
  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim() : "application/octet-stream";

  if (!rawToken || !fileName) {
    return jsonResponse(400, { error: "Missing token or fileName" });
  }

  let token: string;
  try {
    token = decodeToken(rawToken);
  } catch {
    return jsonResponse(404, { error: "Check not found" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validate token exists
  const { data: tokenRow, error: tokenError } = await adminClient
    .from("fourteen_day_check_tokens")
    .select("id")
    .eq("token", token)
    .single();

  if (tokenError || !tokenRow) {
    return jsonResponse(404, { error: "Check not found" });
  }

  const safeName = sanitizeFileName(fileName);
  // Path: {token_uuid}/{field_id}/{uuid}-{filename}
  const storagePath = `${token}/${fieldId || "photo"}/${randomUUID()}-${safeName}`;

  const { data, error: urlError } = await adminClient.storage
    .from("fourteen-day-checks")
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
