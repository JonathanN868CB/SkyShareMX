// external-request-create — AUTH REQUIRED
// Creates a new ad hoc external request in draft status.

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

type FieldDef = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  hint?: string;
};

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

  // Get caller's profile id
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("user_id", userData.user.id)
    .single();

  if (!profile) {
    return jsonResponse(403, { error: "Profile not found" });
  }

  // Parse body
  if (!event.body) {
    return jsonResponse(400, { error: "Missing request body" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const instructions = typeof payload.instructions === "string" ? payload.instructions.trim() : null;
  const recipientName = typeof payload.recipientName === "string" ? payload.recipientName.trim() : "";
  const recipientEmail = typeof payload.recipientEmail === "string" ? payload.recipientEmail.trim().toLowerCase() : "";
  // A bare date string ("2026-04-03") from <input type="date"> has no time component,
  // so it would land as midnight UTC — already expired. Treat it as end of that day instead.
  const rawExpiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt.trim() : null;
  const expiresAt = rawExpiresAt
    ? rawExpiresAt.includes("T")
      ? rawExpiresAt
      : `${rawExpiresAt}T23:59:59Z`
    : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // default: 8 hours from now
  const fieldSchema: FieldDef[] = Array.isArray(payload.fieldSchema) ? payload.fieldSchema : [];

  // Optional cross-tab context (unused in V1 UI but stored for V2)
  const parentType = typeof payload.parentType === "string" ? payload.parentType : null;
  const parentId = typeof payload.parentId === "string" ? payload.parentId : null;
  const parentLabel = typeof payload.parentLabel === "string" ? payload.parentLabel : null;

  if (!title) return jsonResponse(400, { error: "Title is required" });
  if (!recipientName) return jsonResponse(400, { error: "Recipient name is required" });
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return jsonResponse(400, { error: "Valid recipient email is required" });
  }
  if (fieldSchema.length === 0) {
    return jsonResponse(400, { error: "At least one field is required" });
  }

  const { data: request, error: insertError } = await adminClient
    .from("external_requests")
    .insert({
      title,
      instructions: instructions || null,
      field_schema: fieldSchema,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      delivery_channel: "email",
      status: "draft",
      expires_at: expiresAt,
      parent_type: parentType,
      parent_id: parentId,
      parent_label: parentLabel,
      created_by: profile.id,
    })
    .select("id, token")
    .single();

  if (insertError || !request) {
    console.error("external_requests insert error", insertError);
    return jsonResponse(500, { error: "Failed to create request" });
  }

  return jsonResponse(200, { id: request.id, token: request.token });
};
