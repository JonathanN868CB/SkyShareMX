// parts-approval-action — PUBLIC (no auth required)
// Handles one-click approve / deny decisions from tokenized email links.
// Usage: GET /.netlify/functions/parts-approval-action?t=<token-uuid>

import { createClient } from "@supabase/supabase-js";

type HandlerEvent = {
  httpMethod: string;
  queryStringParameters?: Record<string, string | undefined> | null;
};
type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

const htmlHeaders = { "Content-Type": "text/html; charset=utf-8" };

function page(opts: {
  success: boolean;
  title: string;
  subtitle: string;
  detail?: string;
  portalUrl?: string;
  siteUrl: string;
}): HandlerResponse {
  const { success, title, subtitle, detail, portalUrl, siteUrl } = opts;
  const iconColor = success ? "#10b981" : "#ef4444";
  const icon = success
    ? `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="${iconColor}" fill-opacity="0.15"/><path d="M17 28.5L24.5 36L39 21" stroke="${iconColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="28" cy="28" r="28" fill="${iconColor}" fill-opacity="0.15"/><path d="M19 19L37 37M37 19L19 37" stroke="${iconColor}" stroke-width="3" stroke-linecap="round"/></svg>`;

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — SkyShare MX</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #111111; font-family: 'Inter', Arial, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #1a1a1a; border: 1px solid rgba(255,255,255,0.08); border-top: 4px solid ${iconColor}; border-radius: 6px; max-width: 480px; width: 100%; padding: 48px 44px 40px; text-align: center; }
    .brand { font-family: 'Montserrat', Arial, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; color: #d4a017; margin-bottom: 32px; display: block; }
    .icon { margin: 0 auto 24px; }
    h1 { font-family: 'Georgia', 'Times New Roman', serif; font-size: 26px; font-weight: 400; font-style: italic; color: #ffffff; margin-bottom: 12px; line-height: 1.3; }
    .subtitle { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.7; margin-bottom: ${detail ? "16px" : "32px"}; }
    .detail { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6; margin-bottom: 32px; font-family: 'Montserrat', Arial, sans-serif; letter-spacing: 0.04em; }
    .btn { display: inline-block; padding: 13px 28px; font-family: 'Montserrat', Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #111111; text-decoration: none; background: #d4a017; border-radius: 6px; }
    .footer { margin-top: 32px; font-size: 10px; color: rgba(255,255,255,0.18); font-family: 'Montserrat', Arial, sans-serif; letter-spacing: 0.08em; }
    .footer a { color: rgba(255,255,255,0.22); text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <span class="brand">SkyShare MX &nbsp;&middot;&nbsp; Parts Request</span>
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p class="subtitle">${subtitle}</p>
    ${detail ? `<p class="detail">${detail}</p>` : ""}
    ${portalUrl ? `<a href="${portalUrl}" class="btn">View Request &rarr;</a>` : ""}
    <div class="footer">&copy; ${new Date().getFullYear()} SkyShare &nbsp;&middot;&nbsp; <a href="${siteUrl}">skysharemx.com</a></div>
  </div>
</body>
</html>`;

  return { statusCode: 200, headers: htmlHeaders, body };
}

function errorPage(title: string, subtitle: string, siteUrl: string): HandlerResponse {
  return page({ success: false, title, subtitle, siteUrl });
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "") || "https://skysharemx.com";

  if (!supabaseUrl || !serviceRole) {
    return errorPage("Configuration Error", "The server is not configured correctly. Please contact SkyShare support.", siteUrl);
  }

  if (event.httpMethod !== "GET") {
    return errorPage("Invalid Request", "This link is only accessible via a browser.", siteUrl);
  }

  const tokenParam = event.queryStringParameters?.t?.trim();
  if (!tokenParam) {
    return errorPage("Invalid Link", "This approval link is missing required information.", siteUrl);
  }

  // Basic UUID format check
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(tokenParam)) {
    return errorPage("Invalid Link", "This approval link is not valid.", siteUrl);
  }

  const admin = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  // Look up the token
  const { data: tokenRow, error: tokenErr } = await admin
    .from("parts_approval_tokens")
    .select("id, request_id, action, sent_to, sent_by, used, used_at, expires_at")
    .eq("token", tokenParam)
    .single();

  if (tokenErr || !tokenRow) {
    return errorPage("Link Not Found", "This approval link doesn't exist or has already been removed.", siteUrl);
  }

  const portalUrl = `${siteUrl}/app/beet-box/parts/${tokenRow.request_id as string}`;

  if (tokenRow.used as boolean) {
    const usedAt = tokenRow.used_at
      ? new Date(tokenRow.used_at as string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    return page({
      success: false,
      title: "Already Used",
      subtitle: "This approval link has already been used.",
      detail: usedAt ? `Decision recorded on ${usedAt}.` : undefined,
      portalUrl,
      siteUrl,
    });
  }

  if (tokenRow.expires_at) {
    const expiry = new Date(tokenRow.expires_at as string);
    if (expiry < new Date()) {
      return page({
        success: false,
        title: "Link Expired",
        subtitle: "This approval link has expired. Please ask the requestor to resend.",
        portalUrl,
        siteUrl,
      });
    }
  }

  // Load the parts request
  const { data: req, error: reqErr } = await admin
    .from("parts_requests")
    .select("id, status, aircraft_tail, job_description, work_order, order_type")
    .eq("id", tokenRow.request_id as string)
    .single();

  if (reqErr || !req) {
    return errorPage("Request Not Found", "The parts request associated with this link could not be found.", siteUrl);
  }

  const currentStatus = req.status as string;

  // Only act if still pending_approval
  if (currentStatus !== "pending_approval") {
    const statusLabels: Record<string, string> = {
      approved: "approved",
      denied: "denied",
      ordered: "ordered",
      closed: "closed",
      cancelled: "cancelled",
    };
    const label = statusLabels[currentStatus] ?? currentStatus;
    return page({
      success: false,
      title: "Already Resolved",
      subtitle: `This parts request has already been ${label}. No further action is needed.`,
      portalUrl,
      siteUrl,
    });
  }

  const action = tokenRow.action as "approve" | "deny";
  const newStatus = action === "approve" ? "approved" : "denied";
  const now = new Date().toISOString();

  // Apply the status change
  const { error: updateErr } = await admin
    .from("parts_requests")
    .update({ status: newStatus, updated_at: now })
    .eq("id", tokenRow.request_id as string);

  if (updateErr) {
    console.error("Failed to update parts_request status:", updateErr);
    return errorPage("Something Went Wrong", "We couldn't record your decision. Please try again or contact support.", siteUrl);
  }

  // Mark ALL tokens for this request as used (invalidate remaining links)
  try {
    await admin
      .from("parts_approval_tokens")
      .update({ used: true, used_at: now })
      .eq("request_id", tokenRow.request_id as string)
      .eq("used", false);
  } catch { /* non-critical */ }

  // Write approval record (canonical decision history)
  try {
    await admin.from("parts_approvals").insert({
      request_id: tokenRow.request_id,
      approver_id: null,
      approver_email: tokenRow.sent_to,
      decision: action,
      comment: null,
    });
  } catch { /* non-critical */ }

  // Write status history
  try {
    await admin.from("parts_status_history").insert({
      request_id: tokenRow.request_id,
      old_status: currentStatus,
      new_status: newStatus,
      changed_by: tokenRow.sent_by ?? null,
      note: `${action === "approve" ? "Approved" : "Denied"} via email link by ${tokenRow.sent_to as string}`,
    });
  } catch { /* non-critical */ }

  // Notify the sender (portal user who sent the email)
  if (tokenRow.sent_by) {
    const aircraft = req.order_type === "stock"
      ? `Stock — ${req.job_description}`
      : (req.aircraft_tail as string) ?? "Unknown Aircraft";
    const woRef = req.work_order ? ` · WO ${req.work_order as string}` : "";

    try {
      await admin.from("notifications").insert({
        recipient_profile_id: tokenRow.sent_by,
        type: action === "approve" ? "parts_approved" : "parts_denied",
        title: action === "approve" ? "Parts Request Approved" : "Parts Request Denied",
        message: `${tokenRow.sent_to as string} ${action === "approve" ? "approved" : "denied"} the parts request for ${aircraft}${woRef}.`,
        metadata: {
          request_id: tokenRow.request_id as string,
          action,
          decided_by: tokenRow.sent_to as string,
        },
      });
    } catch { /* non-critical */ }
  }

  // Success page
  const aircraft = req.order_type === "stock"
    ? `Stock — ${req.job_description}`
    : (req.aircraft_tail as string) ?? "Unknown Aircraft";
  const woRef = req.work_order ? ` · WO ${req.work_order as string}` : "";

  if (action === "approve") {
    return page({
      success: true,
      title: "Parts Request Approved",
      subtitle: `You've approved the parts request for <strong style="color:#ffffff;">${aircraft}${woRef}</strong>.`,
      detail: "The requesting team has been notified. The request is now cleared for purchasing.",
      portalUrl,
      siteUrl,
    });
  } else {
    return page({
      success: false,
      title: "Parts Request Denied",
      subtitle: `You've denied the parts request for <strong style="color:#ffffff;">${aircraft}${woRef}</strong>.`,
      detail: "The requesting team has been notified. The request has been marked as denied.",
      portalUrl,
      siteUrl,
    });
  }
};
