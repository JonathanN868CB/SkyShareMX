// projects-attachment-url — AUTH REQUIRED
// Any authenticated board member can get a signed upload URL for project task attachments.
// Returns a signed upload URL + download URL generator path.
// No file data passes through this function.

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

  // Verify user has an active profile
  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", userData.user.id)
    .single();

  if (profileErr || !profile) {
    return jsonResponse(401, { error: "User profile not found" });
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
  const taskId   = typeof payload.taskId   === "string" ? payload.taskId.trim()   : "";

  if (!fileName || !taskId) {
    return jsonResponse(400, { error: "fileName and taskId are required" });
  }

  // Verify the caller is a member of the board that owns this task
  const { data: boardCheck } = await adminClient
    .from("pm_tasks")
    .select(`
      id,
      pm_groups!inner(
        board_id,
        pm_board_members!inner(profile_id)
      )
    `)
    .eq("id", taskId)
    .eq("pm_groups.pm_board_members.profile_id", profile.id)
    .maybeSingle();

  const isSuperAdmin = ["Super Admin", "Admin"].includes(profile.role);

  if (!boardCheck && !isSuperAdmin) {
    return jsonResponse(403, { error: "You do not have access to this task's board" });
  }

  const safeName   = sanitizeFileName(fileName);
  const storagePath = `${taskId}/${randomUUID()}-${safeName}`;

  const { data, error: urlError } = await adminClient.storage
    .from("projects-attachments")
    .createSignedUploadUrl(storagePath);

  if (urlError || !data?.signedUrl) {
    console.error("[projects-attachment-url] createSignedUploadUrl error:", urlError);
    return jsonResponse(500, { error: "Failed to generate upload URL" });
  }

  return jsonResponse(200, {
    signedUrl:   data.signedUrl,
    token:       data.token,
    uploadPath:  data.path,
    storagePath,
    mimeType:    mimeType || "application/octet-stream",
  });
};
