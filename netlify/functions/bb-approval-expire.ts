// bb-approval-expire — SCHEDULED (daily at 06:00 UTC)
// Marks any bb_approval_requests rows as 'expired' where:
//   - status = 'sent'
//   - expires_at IS NOT NULL
//   - expires_at < now()
//
// Runs automatically via the [functions.bb-approval-expire] schedule in
// netlify.toml. Can also be triggered manually via a POST with the service
// role key in the Authorization header for testing.

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

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return jsonResponse(500, { error: "Server configuration error" });

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Mark all open requests whose expiry has passed
  const { data, error } = await admin
    .from("bb_approval_requests")
    .update({ status: "expired" })
    .eq("status", "sent")
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    .select("id, work_order_id");

  if (error) {
    console.error("bb-approval-expire: update failed", error);
    return jsonResponse(500, { error: error.message });
  }

  const expiredIds = (data ?? []).map((r: any) => r.id as string);
  console.log(`bb-approval-expire: marked ${expiredIds.length} request(s) as expired`);

  return jsonResponse(200, { expired: expiredIds.length, ids: expiredIds });
};
