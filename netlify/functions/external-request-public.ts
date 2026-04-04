// external-request-public — NO AUTH
// Validates a token and returns the safe public payload for the response portal.
// Used by ExternalResponsePage to load the request before the user fills out the form.

import { createClient } from "@supabase/supabase-js";
import { decodeToken } from "./_token-encoder";

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

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const raw = event.queryStringParameters?.token?.trim();
  if (!raw) {
    return jsonResponse(400, { error: "Missing token" });
  }

  let token: string;
  try {
    token = decodeToken(raw);
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

  const { data: request, error } = await adminClient
    .from("external_requests")
    .select("id, title, instructions, field_schema, recipient_name, status, expires_at")
    .eq("token", token)
    .single();

  if (error || !request) {
    return jsonResponse(404, { error: "Request not found" });
  }

  if (request.status === "draft") {
    return jsonResponse(404, { error: "Request not found" });
  }

  if (request.status === "submitted" || request.status === "reviewed") {
    return jsonResponse(409, { error: "This request has already been submitted." });
  }

  if (request.expires_at && new Date(request.expires_at) < new Date()) {
    return jsonResponse(410, { error: "This request link has expired." });
  }

  // Return only the safe public payload — never include token, created_by, parent context, review_notes
  return jsonResponse(200, {
    id: request.id,
    title: request.title,
    instructions: request.instructions,
    fieldSchema: request.field_schema,
    recipientName: request.recipient_name,
    status: request.status,
    expiresAt: request.expires_at,
  });
};
