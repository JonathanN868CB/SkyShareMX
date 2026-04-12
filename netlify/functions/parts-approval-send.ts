// parts-approval-send — AUTH REQUIRED
// Sends parts request approval notification emails to selected recipients
// via Resend. Each recipient gets unique tokenized Approve / Deny links.
// Advances the request status to pending_approval.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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
  return rest.join(" ").trim() || null;
}

interface PartLine {
  line_number: number;
  part_number: string;
  description: string | null;
  quantity: number;
  unit_cost: number | null;
  vendor: string | null;
}

function fmt(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function buildPartsTableRows(lines: PartLine[]): string {
  return lines.map(l => {
    const lineTotal = l.unit_cost != null ? fmt(l.unit_cost * l.quantity) : "—";
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.55);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.04em;">${l.line_number}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-weight:600;">${l.part_number}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.7);font-family:'Inter',Arial,sans-serif;">${l.description ?? "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.7);font-family:'Inter',Arial,sans-serif;text-align:center;">${l.quantity}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.7);font-family:'Inter',Arial,sans-serif;text-align:right;">${fmt(l.unit_cost)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:rgba(255,255,255,0.55);font-family:'Inter',Arial,sans-serif;">${l.vendor ?? "—"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12px;color:#d4a017;font-family:'Inter',Arial,sans-serif;text-align:right;font-weight:600;">${lineTotal}</td>
      </tr>`;
  }).join("");
}

function buildEmail(opts: {
  senderName: string;
  aircraft: string;
  jobDescription: string;
  woRef: string | null;
  lines: PartLine[];
  dateNeeded: string;
  customMessage?: string;
  approveUrl: string;
  denyUrl: string;
  portalUrl: string;
  siteUrl: string;
}): { html: string; text: string; subject: string } {
  const {
    senderName, aircraft, jobDescription, woRef,
    lines, dateNeeded, customMessage,
    approveUrl, denyUrl, portalUrl, siteUrl,
  } = opts;

  const title = woRef ? `${aircraft} — WO ${woRef}` : aircraft;
  const subject = `Parts Approval Needed · ${aircraft} · ${jobDescription}`;

  const estimatedTotal = lines.reduce((sum, l) => {
    return l.unit_cost != null ? sum + l.unit_cost * l.quantity : sum;
  }, 0);
  const hasAnyPricing = lines.some(l => l.unit_cost != null);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Parts Approval Request</title></head>
<body style="margin:0;padding:0;background:#111111;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;padding:36px 14px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
        <tr><td style="height:4px;background:linear-gradient(90deg,#c10230 0%,#012e45 100%);border-radius:4px 4px 0 0;"></td></tr>
        <tr><td style="background:#1a1a1a;border-radius:0 0 4px 4px;padding:36px 40px 29px;border:1px solid rgba(255,255,255,0.08);border-top:none;">

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:29px;">
            <tr><td>
              <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#d4a017;border-bottom:1px solid #d4a017;padding-bottom:2px;">SKYSHARE MX</span>
              <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-left:11px;">Parts Request</span>
            </td></tr>
            <tr><td style="padding-top:7px;"><div style="height:1px;width:43px;background:#d4a017;"></div></td></tr>
          </table>

          <h1 style="margin:0 0 10px;font-family:'Georgia','Times New Roman',serif;font-size:22px;font-weight:400;font-style:italic;color:#ffffff;line-height:1.3;">
            Approval Needed
          </h1>

          <p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);">
            <strong style="color:#ffffff;">${senderName}</strong> is requesting approval to order parts for the following job.
          </p>

          <!-- Job summary card -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;background:rgba(212,160,23,0.07);border:1px solid rgba(212,160,23,0.2);border-radius:4px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#d4a017;margin-bottom:8px;">Parts Request</div>
              <div style="font-size:16px;font-weight:600;color:#ffffff;margin-bottom:4px;">${title}</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:12px;">${jobDescription}</div>
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="padding-right:28px;">
                  <div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px;">Parts</div>
                  <div style="font-size:15px;font-weight:600;color:#ffffff;">${lines.length} line${lines.length !== 1 ? "s" : ""}</div>
                </td>
                <td style="padding-right:28px;">
                  <div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px;">Need By</div>
                  <div style="font-size:15px;font-weight:600;color:#ffffff;">${dateNeeded}</div>
                </td>
                ${hasAnyPricing ? `
                <td>
                  <div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px;">Est. Total</div>
                  <div style="font-size:15px;font-weight:700;color:#d4a017;">${fmt(estimatedTotal)}</div>
                </td>` : ""}
              </tr></table>
            </td></tr>
          </table>

          ${customMessage ? `
          <div style="margin:0 0 22px;padding:14px 16px;border-left:2px solid rgba(212,160,23,0.35);background:rgba(255,255,255,0.025);border-radius:0 4px 4px 0;">
            <p style="margin:0;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.7);font-style:italic;">${customMessage}</p>
          </div>` : ""}

          <!-- Parts table -->
          <div style="margin:0 0 8px;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Part Details</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;border:1px solid rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;border-collapse:collapse;">
            <thead>
              <tr style="background:rgba(255,255,255,0.04);">
                <th style="padding:9px 10px;text-align:left;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);border-bottom:1px solid rgba(255,255,255,0.08);">#</th>
                <th style="padding:9px 10px;text-align:left;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);border-bottom:1px solid rgba(255,255,255,0.08);">Part No.</th>
                <th style="padding:9px 10px;text-align:left;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);border-bottom:1px solid rgba(255,255,255,0.08);">Description</th>
                <th style="padding:9px 10px;text-align:center;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);border-bottom:1px solid rgba(255,255,255,0.08);">Qty</th>
                <th style="padding:9px 10px;text-align:right;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);border-bottom:1px solid rgba(255,255,255,0.08);">Unit Cost</th>
                <th style="padding:9px 10px;text-align:left;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);border-bottom:1px solid rgba(255,255,255,0.08);">Vendor</th>
                <th style="padding:9px 10px;text-align:right;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);border-bottom:1px solid rgba(255,255,255,0.08);">Total</th>
              </tr>
            </thead>
            <tbody>
              ${buildPartsTableRows(lines)}
            </tbody>
          </table>

          <!-- Action buttons -->
          <div style="margin:0 0 8px;font-family:'Montserrat',Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Your Decision</div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
            <tr>
              <td style="padding-right:10px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr><td style="border-radius:6px;background:#10b981;text-align:center;">
                    <a href="${approveUrl}" style="display:block;padding:13px 14px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;text-decoration:none;">&#10003; Approve</a>
                  </td></tr>
                </table>
              </td>
              <td style="padding-right:10px;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr><td style="border-radius:6px;background:#7f1d1d;text-align:center;">
                    <a href="${denyUrl}" style="display:block;padding:13px 14px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.85);text-decoration:none;">&#10007; Deny</a>
                  </td></tr>
                </table>
              </td>
              <td>
                <table cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr><td style="border-radius:6px;border:1px solid rgba(212,160,23,0.5);text-align:center;">
                    <a href="${portalUrl}" style="display:block;padding:12px 14px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#d4a017;text-decoration:none;">View Request &#8594;</a>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:11px;line-height:1.6;color:rgba(255,255,255,0.2);text-align:center;">
            Approval and Deny links are single-use and expire in 7 days.
          </p>

        </td></tr>
        <tr><td style="padding:22px 8px 0;text-align:center;">
          <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.08em;">
            &copy; ${new Date().getFullYear()} SKYSHARE &nbsp;<span style="color:#d4a017;">&middot;</span>&nbsp;
            <a href="${siteUrl}" style="color:rgba(255,255,255,0.25);text-decoration:none;">skysharemx.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const partsText = lines.map(l =>
    `  ${l.line_number}. ${l.part_number} — ${l.description ?? "no description"} | Qty: ${l.quantity} | Unit: ${fmt(l.unit_cost)} | Vendor: ${l.vendor ?? "—"}`
  ).join("\n");

  const text = [
    `Parts Approval Needed`,
    ``,
    `${senderName} is requesting approval to order parts for:`,
    `${title} — ${jobDescription}`,
    `Need By: ${dateNeeded}`,
    ``,
    `Parts (${lines.length} line${lines.length !== 1 ? "s" : ""}):`,
    partsText,
    hasAnyPricing ? `\nEstimated Total: ${fmt(estimatedTotal)}` : "",
    ``,
    customMessage ? `"${customMessage}"\n` : undefined,
    `APPROVE:      ${approveUrl}`,
    `DENY:         ${denyUrl}`,
    `VIEW REQUEST: ${portalUrl}`,
    ``,
    `Approve and Deny links are single-use and expire in 7 days.`,
    ``,
    `\u00A9 ${new Date().getFullYear()} SkyShare \u00B7 ${siteUrl}`,
  ].filter(s => s !== undefined).join("\n");

  return { html, text, subject };
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

  if (!event.body) return jsonResponse(400, { error: "Missing body" });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(event.body); } catch { return jsonResponse(400, { error: "Invalid JSON" }); }

  const requestId = typeof payload.requestId === "string" ? payload.requestId.trim() : "";
  const recipients = Array.isArray(payload.recipients)
    ? payload.recipients.filter((r): r is string => typeof r === "string" && r.includes("@"))
    : [];
  const customMessage = typeof payload.message === "string" ? payload.message.trim() : undefined;

  if (!requestId) return jsonResponse(400, { error: "requestId required" });
  if (recipients.length === 0) return jsonResponse(400, { error: "At least one recipient required" });

  // Load request details
  const { data: req, error: reqErr } = await admin
    .from("parts_requests")
    .select("id, order_type, aircraft_tail, job_description, work_order, date_needed, status")
    .eq("id", requestId)
    .single();
  if (reqErr || !req) return jsonResponse(404, { error: "Parts request not found" });

  // Load parts lines
  const { data: linesData } = await admin
    .from("parts_request_lines")
    .select("line_number, part_number, description, quantity, unit_cost, vendor")
    .eq("request_id", requestId)
    .order("line_number", { ascending: true });

  const lines: PartLine[] = (linesData ?? []).map(l => ({
    line_number: l.line_number as number,
    part_number: l.part_number as string,
    description: (l.description as string | null) ?? null,
    quantity: l.quantity as number,
    unit_cost: (l.unit_cost as number | null) ?? null,
    vendor: (l.vendor as string | null) ?? null,
  }));

  const aircraft = req.order_type === "stock"
    ? `Stock — ${req.job_description}`
    : (req.aircraft_tail as string) ?? "Unknown Aircraft";

  const dateNeeded = req.date_needed
    ? new Date((req.date_needed as string) + "T00:00:00").toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : "—";

  const portalUrl = `${siteUrl}/app/beet-box/parts/${requestId}`;
  const actionBaseUrl = `${siteUrl}/.netlify/functions/parts-approval-action`;
  const senderName = (callerProfile.full_name as string) || (callerProfile.email as string) || "SkyShare MX";
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Revoke any existing unused tokens for this request (stale sends)
  try {
    await admin
      .from("parts_approval_tokens")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("request_id", requestId)
      .eq("used", false);
  } catch { /* non-critical */ }

  const resend = new Resend(resendApiKey);
  const failedRecipients: string[] = [];

  for (const recipientEmail of recipients) {
    // Generate approve + deny tokens for this recipient
    const { data: approveRow, error: approveErr } = await admin
      .from("parts_approval_tokens")
      .insert({
        request_id: requestId,
        action: "approve",
        sent_to: recipientEmail,
        sent_by: callerProfile.id as string,
        expires_at: expiresAt,
      })
      .select("token")
      .single();

    const { data: denyRow, error: denyErr } = await admin
      .from("parts_approval_tokens")
      .insert({
        request_id: requestId,
        action: "deny",
        sent_to: recipientEmail,
        sent_by: callerProfile.id as string,
        expires_at: expiresAt,
      })
      .select("token")
      .single();

    if (approveErr || denyErr || !approveRow || !denyRow) {
      console.error(`Failed to generate tokens for ${recipientEmail}:`, approveErr ?? denyErr);
      failedRecipients.push(recipientEmail);
      continue;
    }

    const approveUrl = `${actionBaseUrl}?t=${approveRow.token as string}`;
    const denyUrl = `${actionBaseUrl}?t=${denyRow.token as string}`;

    const { html, text, subject } = buildEmail({
      senderName,
      aircraft,
      jobDescription: req.job_description as string,
      woRef: (req.work_order as string | null) ?? null,
      lines,
      dateNeeded,
      customMessage: customMessage || undefined,
      approveUrl,
      denyUrl,
      portalUrl,
      siteUrl,
    });

    const { error: emailErr } = await resend.emails.send({
      from: `SkyShare MX <${fromEmail}>`,
      to: [recipientEmail],
      subject,
      html,
      text,
    });

    if (emailErr) {
      console.error(`Failed to send to ${recipientEmail}:`, emailErr);
      failedRecipients.push(recipientEmail);
    }
  }

  if (failedRecipients.length === recipients.length) {
    return jsonResponse(500, { error: "Failed to send any emails" });
  }

  // Advance status to pending_approval
  await admin.from("parts_requests").update({ status: "pending_approval" }).eq("id", requestId);
  try {
    await admin.from("parts_status_history").insert({
      request_id: requestId,
      old_status: req.status,
      new_status: "pending_approval",
      changed_by: callerProfile.id,
      note: `Sent for approval to: ${recipients.join(", ")}`,
    });
  } catch { /* non-critical */ }

  return jsonResponse(200, {
    sent: recipients.length - failedRecipients.length,
    failed: failedRecipients.length,
    failedRecipients,
  });
};
