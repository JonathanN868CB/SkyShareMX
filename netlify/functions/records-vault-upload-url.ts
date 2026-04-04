// records-vault-upload-url — AUTH REQUIRED
// Validates a Manager+ session and returns a signed Supabase Storage upload URL
// for the records-vault bucket. Only application/pdf is accepted.
// The client uploads directly to Storage; no file data passes through this function.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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

  // Only Manager+ can upload
  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .single();

  if (profileErr || !profile) {
    return jsonResponse(401, { error: "User profile not found" });
  }

  const managerRoles = ["Super Admin", "Admin", "Manager"];
  if (!managerRoles.includes(profile.role)) {
    return jsonResponse(403, { error: "Manager or above required to upload records" });
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

  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim() : "";
  const aircraftId = typeof payload.aircraftId === "string" ? payload.aircraftId.trim() : "";

  if (!fileName || !aircraftId) {
    return jsonResponse(400, { error: "fileName and aircraftId are required" });
  }

  if (mimeType !== "application/pdf") {
    return jsonResponse(400, { error: "Only PDF files are accepted" });
  }

  const safeName = sanitizeFileName(fileName);
  const storagePath = `${aircraftId}/${randomUUID()}-${safeName}`;

  const { data, error: urlError } = await adminClient.storage
    .from("records-vault")
    .createSignedUploadUrl(storagePath);

  if (urlError || !data?.signedUrl) {
    console.error("[records-vault-upload-url] createSignedUploadUrl error:", urlError);
    return jsonResponse(500, { error: "Failed to generate upload URL" });
  }

  return jsonResponse(200, { signedUrl: data.signedUrl, storagePath });
};
