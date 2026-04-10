// bb-approval-public — NO AUTH
// Returns the public-safe snapshot for a tokenized approval request so the
// /approval/:token portal can render without any session.

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
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "GET") return jsonResponse(405, { error: "Method not allowed" });

  const raw = event.queryStringParameters?.token?.trim();
  if (!raw) return jsonResponse(400, { error: "Missing token" });

  let token: string;
  try { token = decodeToken(raw); } catch { return jsonResponse(404, { error: "Approval not found" }); }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return jsonResponse(500, { error: "Server configuration error" });

  const admin = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: reqRow, error } = await admin
    .from("bb_approval_requests")
    .select("id, kind, status, recipient_name, recipient_email, snapshot_total, snapshot_payload, expires_at, sent_at, submitted_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !reqRow) return jsonResponse(404, { error: "Approval not found" });

  // Strip server-only fields (woItemId) from the snapshot before returning
  const snapshotSafe = (() => {
    const s = (reqRow.snapshot_payload ?? {}) as any;
    const items = Array.isArray(s.items)
      ? s.items.map((it: any) => {
          const { woItemId: _hidden, ...rest } = it ?? {};
          return rest;
        })
      : [];
    return { ...s, items };
  })();

  // Expiry check
  if (reqRow.expires_at && new Date(reqRow.expires_at) < new Date()) {
    return jsonResponse(200, { state: "expired" });
  }
  if (reqRow.status === "revoked") {
    return jsonResponse(200, { state: "revoked" });
  }
  if (reqRow.status === "submitted") {
    // Load existing submission + decisions so the portal can show a receipt
    const [{ data: sub }, { data: decisions }] = await Promise.all([
      admin
        .from("bb_approval_submissions")
        .select("signer_name, signer_email, signer_title, signed_pdf_path, submitted_at")
        .eq("approval_request_id", reqRow.id)
        .maybeSingle(),
      admin
        .from("bb_approval_item_decisions")
        .select("wo_item_id, decision")
        .eq("approval_request_id", reqRow.id),
    ]);
    return jsonResponse(200, {
      state:    "already_submitted",
      kind:     reqRow.kind,
      snapshot: snapshotSafe,
      total:    Number(reqRow.snapshot_total ?? 0),
      recipient: { name: reqRow.recipient_name, email: reqRow.recipient_email },
      submission: sub,
      decisions,
    });
  }

  // Fresh, sendable state
  return jsonResponse(200, {
    state:     "ready",
    kind:      reqRow.kind,
    snapshot:  reqRow.snapshot_payload,
    total:     Number(reqRow.snapshot_total ?? 0),
    recipient: { name: reqRow.recipient_name, email: reqRow.recipient_email },
    sentAt:    reqRow.sent_at,
    expiresAt: reqRow.expires_at,
  });
};
