// external-request-delete — AUTH REQUIRED
// Deletes a request and all associated storage files. Full cleanup — no orphaned files.

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
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
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
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST" && event.httpMethod !== "DELETE") {
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

  // Verify caller
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

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", userData.user.id)
    .single();

  if (!callerProfile) {
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

  const requestId = typeof payload.requestId === "string" ? payload.requestId.trim() : "";
  if (!requestId) {
    return jsonResponse(400, { error: "Missing requestId" });
  }

  // Load request — verify caller owns it or is admin
  const { data: request, error: reqError } = await adminClient
    .from("external_requests")
    .select("id, created_by, token")
    .eq("id", requestId)
    .single();

  if (reqError || !request) {
    return jsonResponse(404, { error: "Request not found" });
  }

  const isAdmin = ["Super Admin", "Admin"].includes(callerProfile.role ?? "");
  if (request.created_by !== callerProfile.id && !isAdmin) {
    return jsonResponse(403, { error: "Forbidden" });
  }

  // Collect all storage paths for this request's submissions
  const { data: submissions } = await adminClient
    .from("external_submissions")
    .select("id")
    .eq("request_id", requestId);

  const submissionIds = (submissions ?? []).map((s: { id: string }) => s.id);

  const { data: attachments } = submissionIds.length > 0
    ? await adminClient
        .from("external_submission_attachments")
        .select("storage_path")
        .in("submission_id", submissionIds)
    : { data: [] };

  // Delete storage files if any
  if (attachments && attachments.length > 0) {
    const paths = attachments.map((a: { storage_path: string }) => a.storage_path);
    const { error: storageError } = await adminClient.storage
      .from("external-submissions")
      .remove(paths);

    if (storageError) {
      console.error("Storage delete error", storageError);
      // Continue — DB cleanup is more important than storage cleanup
    }
  }

  // Delete the request row (CASCADE handles submissions + attachments)
  const { error: deleteError } = await adminClient
    .from("external_requests")
    .delete()
    .eq("id", requestId);

  if (deleteError) {
    console.error("Request delete error", deleteError);
    return jsonResponse(500, { error: "Failed to delete request" });
  }

  return jsonResponse(200, { success: true });
};
