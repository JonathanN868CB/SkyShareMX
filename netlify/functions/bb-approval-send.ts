// bb-approval-send — AUTH REQUIRED
// Creates a tokenized approval request for a quote or change order, renders
// the unsigned PDF into bb-approvals/{token}/unsigned.pdf, emails the
// recipient a public portal link, and flips the parent row's quote_status
// to 'sent'.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { encodeToken } from "./_token-encoder";
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

function buildApprovalEmail(opts: {
  recipientName: string;
  senderName: string;
  kind: "quote" | "change_order";
  documentNumber: string;
  aircraftReg: string;
  total: string;
  approvalUrl: string;
  customMessage?: string;
  siteUrl: string;
}): { html: string; text: string; subject: string } {
  const { recipientName, senderName, kind, documentNumber, aircraftReg, total, approvalUrl, customMessage, siteUrl } = opts;
  const label = kind === "change_order" ? "Change Order" : "Quote";
  const subject = `${label} ${documentNumber} — ${aircraftReg} · Review & Approve`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>${label} ${documentNumber}</title></head>
<body style="margin:0;padding:0;background:#111111;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;padding:36px 14px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;width:100%;">
        <tr><td style="height:4px;background:linear-gradient(90deg,#c10230 0%,#012e45 100%);border-radius:4px 4px 0 0;"></td></tr>
        <tr><td style="background:#1a1a1a;border-radius:0 0 4px 4px;padding:36px 43px 29px;border:1px solid rgba(255,255,255,0.08);border-top:none;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:29px;"><tr><td>
            <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#d4a017;border-bottom:1px solid #d4a017;padding-bottom:2px;">SKYSHARE MX</span>
            <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-left:11px;">Maintenance Portal</span>
          </td></tr>
          <tr><td style="padding-top:7px;"><div style="height:1px;width:43px;background:#d4a017;"></div></td></tr></table>

          <h1 style="margin:0 0 10px;font-family:'Georgia','Times New Roman',serif;font-size:24px;font-weight:400;font-style:italic;color:#ffffff;line-height:1.2;">
            Hi ${recipientName},
          </h1>

          <p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);">
            <strong style="color:#ffffff;">${senderName}</strong> has prepared a ${label.toLowerCase()} for your review.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;background:rgba(212,160,23,0.08);border:1px solid rgba(212,160,23,0.25);border-radius:4px;">
            <tr><td style="padding:14px 18px;">
              <div style="font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#d4a017;margin-bottom:6px;">${label}</div>
              <div style="font-family:'Montserrat',Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:0.1em;color:#ffffff;">${documentNumber}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:8px;">Aircraft ${aircraftReg} · Total ${total}</div>
            </td></tr>
          </table>

          ${customMessage ? `<p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.7);border-left:2px solid rgba(212,160,23,0.3);padding-left:14px;font-style:italic;">${customMessage}</p>` : ""}

          <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.55);">
            Open the ${label.toLowerCase()} to review each line item and accept or decline. You'll sign once at the bottom — no account required.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;"><tr><td align="center">
            <table cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:6px;background:#d4a017;">
              <a href="${approvalUrl}" style="display:inline-block;padding:13px 29px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#111111;text-decoration:none;">Review & Sign &#8594;</a>
            </td></tr></table>
          </td></tr></table>

          <p style="margin:0;font-size:11px;line-height:1.6;color:rgba(255,255,255,0.3);text-align:center;word-break:break-all;">
            Or copy this link: <a href="${approvalUrl}" style="color:rgba(212,160,23,0.6);text-decoration:none;">${approvalUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:22px 8px 0;text-align:center;">
          <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.08em;">
            © ${new Date().getFullYear()} SKYSHARE &nbsp;<span style="color:#d4a017;">·</span>&nbsp;
            <a href="${siteUrl}" style="color:rgba(255,255,255,0.25);text-decoration:none;">skysharemx.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${recipientName},`,
    ``,
    `${senderName} has prepared ${label.toLowerCase()} ${documentNumber} for aircraft ${aircraftReg}.`,
    `Total: ${total}`,
    ``,
    customMessage ? `${customMessage}\n` : ``,
    `Review and sign:`,
    approvalUrl,
    ``,
    `© ${new Date().getFullYear()} SkyShare · ${siteUrl}`,
  ].filter(Boolean).join("\n");

  return { html, text, subject };
}

function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const accessToken = getAccessToken(event);
  if (!accessToken) return jsonResponse(401, { error: "Authentication required" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ACCESS_NOTIF_FROM ?? "noreply@skyshare.com";
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "") || "https://skysharemx.com";

  if (!supabaseUrl || !serviceRole || !anonKey) return jsonResponse(500, { error: "Server configuration error" });
  if (!resendApiKey) return jsonResponse(500, { error: "Email service not configured" });

  // Verify caller
  const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData, error: userErr } = await authClient.auth.getUser(accessToken);
  if (userErr || !userData?.user) return jsonResponse(401, { error: "Invalid or expired session" });

  const admin = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("user_id", userData.user.id)
    .single();
  if (!callerProfile) return jsonResponse(403, { error: "Profile not found" });
  if (!["Manager", "Admin", "Super Admin"].includes(callerProfile.role as string)) {
    return jsonResponse(403, { error: "Manager role required" });
  }

  if (!event.body) return jsonResponse(400, { error: "Missing body" });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(event.body); } catch { return jsonResponse(400, { error: "Invalid JSON" }); }

  const workOrderId = typeof payload.workOrderId === "string" ? payload.workOrderId.trim() : "";
  const kind = payload.kind === "change_order" ? "change_order" : "quote";
  const recipientName = typeof payload.recipientName === "string" ? payload.recipientName.trim() : "";
  const recipientEmail = typeof payload.recipientEmail === "string" ? payload.recipientEmail.trim().toLowerCase() : "";
  const expiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt : null;
  const customMessage = typeof payload.message === "string" ? payload.message.trim() : undefined;

  if (!workOrderId) return jsonResponse(400, { error: "workOrderId required" });
  if (!recipientName || !recipientEmail) return jsonResponse(400, { error: "recipientName and recipientEmail required" });

  // Load WO + items + aircraft
  const { data: woRow, error: woErr } = await admin
    .from("bb_work_orders")
    .select("id, wo_number, wo_type, description, aircraft_id, guest_registration, guest_serial, parent_wo_id, quote_status")
    .eq("id", workOrderId)
    .single();
  if (woErr || !woRow) return jsonResponse(404, { error: "Work order not found" });

  if (kind === "quote" && woRow.wo_type !== "quote") {
    return jsonResponse(400, { error: "Work order is not a quote" });
  }
  if (kind === "change_order" && woRow.wo_type !== "change_order") {
    return jsonResponse(400, { error: "Work order is not a change order" });
  }

  // Items (include parts for totals)
  const { data: itemRows, error: itemErr } = await admin
    .from("bb_work_order_items")
    .select(`
      id, item_number, category, discrepancy, corrective_action,
      estimated_hours, labor_rate, shipping_cost, outside_services_cost,
      discrepancy_type, parent_item_id,
      bb_work_order_item_parts ( qty, unit_price )
    `)
    .eq("work_order_id", workOrderId)
    .order("item_number");
  if (itemErr) return jsonResponse(500, { error: "Failed to load items" });

  // Source inspection titles (for CO variant) — one fetch for all parent ids
  const parentIds = Array.from(new Set((itemRows ?? []).map(r => r.parent_item_id).filter(Boolean))) as string[];
  const parentTitles = new Map<string, string>();
  if (parentIds.length > 0) {
    const { data: parents } = await admin
      .from("bb_work_order_items")
      .select("id, category, discrepancy")
      .in("id", parentIds);
    for (const p of parents ?? []) {
      parentTitles.set(p.id as string, (p.discrepancy as string) || (p.category as string) || "");
    }
  }

  // Aircraft registration
  let aircraftRegistration = woRow.guest_registration ?? "";
  let aircraftSerial = woRow.guest_serial ?? "";
  if (woRow.aircraft_id) {
    const { data: acRow } = await admin
      .from("aircraft")
      .select("serial_number, aircraft_registrations(registration, is_current)")
      .eq("id", woRow.aircraft_id)
      .single();
    aircraftSerial = (acRow?.serial_number as string) ?? aircraftSerial;
    const regs = (acRow as any)?.aircraft_registrations ?? [];
    const current = regs.find((r: any) => r.is_current)?.registration;
    if (current) aircraftRegistration = current;
  }

  // Parent WO number (CO only, for header)
  let parentWoNumber: string | undefined;
  if (kind === "change_order" && woRow.parent_wo_id) {
    const { data: parent } = await admin
      .from("bb_work_orders")
      .select("wo_number")
      .eq("id", woRow.parent_wo_id)
      .single();
    parentWoNumber = (parent?.wo_number as string) ?? undefined;
  }

  // Build items payload + totals. We also store wo_item_id alongside each
  // snapshot item (as an extra field on the jsonb) so bb-approval-submit can
  // resolve decisions by itemNumber → real FK without trusting the client.
  const pdfItemsWithId: (ApprovalPdfItem & { woItemId: string })[] = (itemRows ?? []).map((it) => {
    const partsTotal = ((it as any).bb_work_order_item_parts ?? []).reduce(
      (acc: number, p: any) => acc + Number(p.qty ?? 0) * Number(p.unit_price ?? 0),
      0,
    );
    const laborCost = Number(it.estimated_hours ?? 0) * Number(it.labor_rate ?? 0);
    const lineTotal = laborCost + partsTotal + Number(it.shipping_cost ?? 0) + Number(it.outside_services_cost ?? 0);
    return {
      woItemId:            it.id as string,
      itemNumber:          it.item_number,
      category:            it.category ?? "",
      discrepancy:         it.discrepancy ?? "",
      correctiveAction:    it.corrective_action ?? "",
      discrepancyType:     (it.discrepancy_type as "airworthy" | "recommendation" | null) ?? null,
      sourceInspection:    it.parent_item_id ? parentTitles.get(it.parent_item_id as string) ?? null : null,
      estimatedHours:      Number(it.estimated_hours ?? 0),
      laborRate:           Number(it.labor_rate ?? 0),
      partsTotal,
      shippingCost:        Number(it.shipping_cost ?? 0),
      outsideServicesCost: Number(it.outside_services_cost ?? 0),
      lineTotal,
      customerDecision:    "pending",
    };
  });
  // Public snapshot — strip woItemId so the public payload doesn't leak it.
  const pdfItems: ApprovalPdfItem[] = pdfItemsWithId.map(({ woItemId: _woItemId, ...rest }) => rest);
  const total = pdfItemsWithId.reduce((acc, it) => acc + it.lineTotal, 0);

  // Revoke any existing open (sent/expired) requests for this WO so the old
  // link can no longer be submitted. This prevents a stale link from racing
  // a re-send.
  await admin
    .from("bb_approval_requests")
    .update({ status: "revoked" })
    .eq("work_order_id", workOrderId)
    .in("status", ["sent", "expired"]);

  // Insert approval request row (token auto-generated)
  const { data: reqRow, error: reqErr } = await admin
    .from("bb_approval_requests")
    .insert({
      work_order_id:   workOrderId,
      kind,
      recipient_name:  recipientName,
      recipient_email: recipientEmail,
      snapshot_total:  total,
      snapshot_payload: {
        documentNumber:      woRow.wo_number,
        aircraftRegistration,
        aircraftSerial,
        description:         woRow.description ?? null,
        parentWoNumber:      parentWoNumber ?? null,
        // Stored with woItemId so the submit function can resolve decisions
        // back to real bb_work_order_items FKs. The public GET strips this.
        items:               pdfItemsWithId,
      },
      status:          "sent",
      expires_at:      expiresAt,
      sent_by:         callerProfile.id,
      user_id:         userData.user.id,
    })
    .select("id, token")
    .single();
  if (reqErr || !reqRow) {
    console.error("approval insert failed", reqErr);
    return jsonResponse(500, { error: "Failed to create approval request" });
  }

  const encodedToken = encodeToken(reqRow.token as string);
  const approvalUrl = `${siteUrl}/approval/${encodedToken}`;

  // Render + store unsigned PDF
  let unsignedBytes: Uint8Array;
  try {
    unsignedBytes = renderApprovalPdfBytes({
      kind,
      signed:               false,
      documentNumber:       woRow.wo_number ?? "",
      parentWoNumber,
      aircraftRegistration,
      aircraftSerial,
      description:          woRow.description ?? undefined,
      recipientName,
      recipientEmail,
      items:                pdfItems,
      total,
      approvalUrl,
    });
  } catch (err) {
    console.error("PDF render failed", err);
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return jsonResponse(500, { error: `Failed to render approval PDF: ${msg}` });
  }

  const unsignedPath = `${reqRow.token}/unsigned.pdf`;
  const { error: upErr } = await admin.storage
    .from("bb-approvals")
    .upload(unsignedPath, unsignedBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    console.error("bb-approvals upload failed", upErr);
    return jsonResponse(500, { error: "Failed to store PDF" });
  }

  await admin
    .from("bb_approval_requests")
    .update({ unsigned_pdf_path: unsignedPath })
    .eq("id", reqRow.id);

  // Flip parent row quote_status → 'sent'
  await admin
    .from("bb_work_orders")
    .update({ quote_status: "sent", quote_sent_at: new Date().toISOString() })
    .eq("id", workOrderId);

  // Audit trail
  await admin.from("bb_work_order_audit_trail").insert({
    work_order_id: workOrderId,
    entry_type:    "status_change",
    actor_id:      callerProfile.id,
    summary:       `${kind === "change_order" ? "Change order" : "Quote"} sent for approval to ${recipientName}`,
    field_name:    "quote_status",
    old_value:     woRow.quote_status ?? null,
    new_value:     "sent",
  });

  // Email
  const senderName = (callerProfile.full_name as string) || (callerProfile.email as string) || "SkyShare MX";
  const { html, text, subject } = buildApprovalEmail({
    recipientName,
    senderName,
    kind,
    documentNumber: woRow.wo_number ?? "",
    aircraftReg:    aircraftRegistration || "—",
    total:          currency(total),
    approvalUrl,
    customMessage,
    siteUrl,
  });

  const resend = new Resend(resendApiKey);
  const senderEmail = callerProfile.email as string | undefined;
  const { error: emailErr } = await resend.emails.send({
    from:    `SkyShare MX <${fromEmail}>`,
    to:      [recipientEmail],
    ...(senderEmail ? { bcc: [senderEmail] } : {}),
    subject,
    html,
    text,
  });
  if (emailErr) {
    console.error("Resend error", emailErr);
    return jsonResponse(500, { error: "Failed to send email" });
  }

  return jsonResponse(200, {
    approvalRequestId: reqRow.id,
    encodedToken,
    approvalUrl,
  });
};
