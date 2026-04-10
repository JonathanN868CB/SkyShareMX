// bb-approval-submit — NO AUTH
// Customer-facing endpoint: accepts signature + per-item accept/decline for a
// tokenized approval request, uploads the signature PNG, writes per-item
// decisions, renders the signed PDF, and flips the parent quote/CO row's
// status to approved or declined based on what the customer chose.

import { createClient } from "@supabase/supabase-js";
import { decodeToken } from "./_token-encoder";
import { renderApprovalPdfBytes } from "./_bb-approval-pdf";
import type { ApprovalPdfItem } from "../../src/features/beet-box/modules/work-orders/pdfs/buildApprovalPDF";

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

async function sha256Hex(input: string): Promise<string> {
  // Node 18+ has the global `crypto.subtle`, same API as the browser helper.
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const bin = Buffer.from(b64, "base64");
  return new Uint8Array(bin);
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  if (!event.body) return jsonResponse(400, { error: "Missing body" });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(event.body); } catch { return jsonResponse(400, { error: "Invalid JSON" }); }

  const encodedToken = typeof payload.token === "string" ? payload.token.trim() : "";
  const signerName  = typeof payload.signerName === "string" ? payload.signerName.trim() : "";
  const signerEmail = typeof payload.signerEmail === "string" ? payload.signerEmail.trim().toLowerCase() : "";
  const signerTitle = typeof payload.signerTitle === "string" ? payload.signerTitle.trim() : null;
  const signatureDataUrl = typeof payload.signatureImageDataUrl === "string" ? payload.signatureImageDataUrl : "";
  const decisionsInput = Array.isArray(payload.decisions) ? payload.decisions : [];

  if (!encodedToken || !signerName || !signerEmail || !signatureDataUrl) {
    return jsonResponse(400, { error: "Missing signer fields" });
  }
  if (decisionsInput.length === 0) {
    return jsonResponse(400, { error: "No item decisions submitted" });
  }

  let token: string;
  try { token = decodeToken(encodedToken); } catch { return jsonResponse(404, { error: "Approval not found" }); }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return jsonResponse(500, { error: "Server configuration error" });

  const admin = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  // Load the request
  const { data: reqRow, error: reqErr } = await admin
    .from("bb_approval_requests")
    .select("id, work_order_id, kind, status, snapshot_payload, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (reqErr || !reqRow) return jsonResponse(404, { error: "Approval not found" });
  if (reqRow.status === "submitted") return jsonResponse(409, { error: "Already submitted" });
  if (reqRow.status === "revoked") return jsonResponse(410, { error: "Approval revoked" });
  if (reqRow.expires_at && new Date(reqRow.expires_at) < new Date()) {
    return jsonResponse(410, { error: "Approval expired" });
  }

  // Validate decisions against snapshot items. The snapshot stores each item
  // with its real wo_item_id (not leaked to the public GET). The portal only
  // sends { itemNumber, decision }; we resolve woItemId here server-side.
  type SnapItem = ApprovalPdfItem & { woItemId: string };
  const snapshot = (reqRow.snapshot_payload ?? {}) as {
    items?: SnapItem[]; documentNumber?: string; aircraftRegistration?: string;
    aircraftSerial?: string; description?: string; parentWoNumber?: string;
  };
  const snapItems = snapshot.items ?? [];
  const itemByNumber = new Map<number, SnapItem>();
  for (const it of snapItems) itemByNumber.set(it.itemNumber, it);

  type InDecision = { woItemId: string; itemNumber: number; decision: "approved" | "declined" };
  const decisions: InDecision[] = [];
  for (const d of decisionsInput) {
    if (!d || typeof d !== "object") continue;
    const itemNumber = Number((d as any).itemNumber ?? 0);
    const decision = (d as any).decision === "approved" ? "approved"
                   : (d as any).decision === "declined" ? "declined" : null;
    const snapItem = itemByNumber.get(itemNumber);
    if (!snapItem || !decision || !snapItem.woItemId) {
      return jsonResponse(400, { error: "Invalid decision entry" });
    }
    decisions.push({ woItemId: snapItem.woItemId, itemNumber, decision });
  }

  const submittedAt = new Date().toISOString();
  const signatureHash = await sha256Hex(`${signerName}:${signerEmail}:${reqRow.id}:${submittedAt}`);

  // Upload signature PNG
  const sigBytes = dataUrlToBytes(signatureDataUrl);
  const sigPath = `${token}/signature.png`;
  const { error: sigErr } = await admin.storage
    .from("bb-approvals")
    .upload(sigPath, sigBytes, { contentType: "image/png", upsert: true });
  if (sigErr) {
    console.error("signature upload failed", sigErr);
    return jsonResponse(500, { error: "Failed to store signature" });
  }

  // Insert submission
  const { error: subErr } = await admin
    .from("bb_approval_submissions")
    .insert({
      approval_request_id:  reqRow.id,
      signer_name:          signerName,
      signer_email:         signerEmail,
      signer_title:         signerTitle,
      signature_hash:       signatureHash,
      signature_image_path: sigPath,
      submitter_ip:         event.headers?.["x-forwarded-for"] ?? null,
      user_agent:           event.headers?.["user-agent"] ?? null,
      submitted_at:         submittedAt,
    });
  if (subErr) {
    console.error("submission insert failed", subErr);
    return jsonResponse(500, { error: "Failed to record submission" });
  }

  // Insert per-item decisions + propagate onto bb_work_order_items
  if (decisions.length > 0) {
    const decisionRows = decisions.map(d => ({
      approval_request_id: reqRow.id,
      wo_item_id:          d.woItemId,
      decision:            d.decision,
      decided_at:          submittedAt,
    }));
    const { error: decErr } = await admin.from("bb_approval_item_decisions").insert(decisionRows);
    if (decErr) {
      console.error("item decisions insert failed", decErr);
      return jsonResponse(500, { error: "Failed to record decisions" });
    }

    // Update each item's customer_approval_status
    for (const d of decisions) {
      await admin
        .from("bb_work_order_items")
        .update({ customer_approval_status: d.decision, customer_decision_at: submittedAt })
        .eq("id", d.woItemId);
    }
  }

  // Flip parent quote/CO status
  const anyApproved = decisions.some(d => d.decision === "approved");
  const nextQuoteStatus = anyApproved ? "approved" : "declined";
  await admin
    .from("bb_work_orders")
    .update({ quote_status: nextQuoteStatus })
    .eq("id", reqRow.work_order_id);

  await admin
    .from("bb_approval_requests")
    .update({ status: "submitted", submitted_at: submittedAt })
    .eq("id", reqRow.id);

  // Render signed PDF
  const pdfItems: ApprovalPdfItem[] = snapItems.map(it => {
    const d = decisions.find(x => x.itemNumber === it.itemNumber);
    return { ...it, customerDecision: d?.decision ?? "pending" };
  });
  const total = pdfItems.reduce((acc, it) => acc + it.lineTotal, 0);

  const signedBytes = renderApprovalPdfBytes({
    kind:                 reqRow.kind as "quote" | "change_order",
    signed:               true,
    documentNumber:       snapshot.documentNumber ?? "",
    parentWoNumber:       snapshot.parentWoNumber,
    aircraftRegistration: snapshot.aircraftRegistration ?? "",
    aircraftSerial:       snapshot.aircraftSerial,
    description:          snapshot.description,
    recipientName:        signerName,
    recipientEmail:       signerEmail,
    items:                pdfItems,
    total,
    signature: {
      signerName,
      signerEmail,
      signerTitle: signerTitle ?? undefined,
      signedAt:    submittedAt,
      hash:        signatureHash,
      imageDataUrl: signatureDataUrl,
    },
  });

  const signedPath = `${token}/signed.pdf`;
  const { error: upErr } = await admin.storage
    .from("bb-approvals")
    .upload(signedPath, signedBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    console.error("signed pdf upload failed", upErr);
  } else {
    await admin
      .from("bb_approval_submissions")
      .update({ signed_pdf_path: signedPath })
      .eq("approval_request_id", reqRow.id);
  }

  // Audit trail
  const approvedCount = decisions.filter(d => d.decision === "approved").length;
  const declinedCount = decisions.filter(d => d.decision === "declined").length;
  await admin.from("bb_work_order_audit_trail").insert({
    work_order_id: reqRow.work_order_id,
    entry_type:    "status_change",
    actor_id:      null,
    actor_name:    signerName,
    summary:       `Customer signed — ${approvedCount} approved / ${declinedCount} declined`,
    field_name:    "quote_status",
    new_value:     nextQuoteStatus,
  });

  return jsonResponse(200, {
    state: "submitted",
    approvedCount,
    declinedCount,
  });
};
