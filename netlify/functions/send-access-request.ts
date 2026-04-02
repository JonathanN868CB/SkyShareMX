import { Resend } from "resend";
import { BEAT_KNOWLEDGE_ATTACHMENT, EMAIL_BCC } from "./_email-assets";

type HandlerEvent = {
  httpMethod: string;
  body?: string | null;
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

function sanitize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildAccessRequestEmail(opts: {
  fullName: string;
  email: string;
  company: string;
  reason: string;
  submittedAt: string;
}): { html: string; text: string } {
  const { fullName, email, company, reason, submittedAt } = opts;
  const year = new Date().getFullYear();

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:7px 0;font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35);width:110px;vertical-align:top;">${label}</td>
      <td style="padding:7px 0;font-size:13px;color:rgba(255,255,255,0.8);vertical-align:top;">${value}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Access Request — SkyShare MX</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;padding:36px 14px;">
    <tr>
      <td align="center">
        <table width="504" cellpadding="0" cellspacing="0" border="0" style="max-width:504px;width:100%;">

          <!-- Header stripe -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#c10230 0%,#012e45 100%);border-radius:4px 4px 0 0;"></td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a1a1a;border-radius:0 0 4px 4px;padding:36px 43px 29px;border:1px solid rgba(255,255,255,0.08);border-top:none;">

              <!-- Logo / wordmark + beet -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:29px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#d4a017;border-bottom:1px solid #d4a017;padding-bottom:2px;">SKYSHARE MX</span>
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-left:11px;">Maintenance Portal</span>
                  </td>
                  <td style="vertical-align:middle;text-align:right;width:40px;">
                    <img src="cid:beat-knowledge" alt="" width="32" height="32" style="display:block;border:0;border-radius:6px;" />
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:7px;">
                    <div style="height:1px;width:43px;background:#d4a017;"></div>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 8px;font-family:'Georgia','Times New Roman',serif;font-size:27px;font-weight:400;font-style:italic;letter-spacing:0.03em;color:#ffffff;line-height:1.2;">
                New Access Request
              </h1>
              <p style="margin:0 0 28px;font-size:12px;color:rgba(255,255,255,0.35);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">${submittedAt}</p>

              <!-- Details table -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;border-top:1px solid rgba(255,255,255,0.07);">
                <tbody>
                  ${row("Name", fullName || "(not provided)")}
                  ${row("Email", email)}
                  ${row("Company", company || "(not provided)")}
                </tbody>
              </table>

              <!-- Reason block -->
              <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:16px 18px;">
                <p style="margin:0 0 8px;font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);">Reason</p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);white-space:pre-wrap;">${reason}</p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 8px 0;text-align:center;">
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.08em;">
                © ${year} SKYSHARE &nbsp;<span style="color:#d4a017;">·</span>&nbsp;
                <a href="https://www.skysharemx.com" style="color:rgba(255,255,255,0.25);text-decoration:none;">skysharemx.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "New SkyShare MX Access Request",
    `Submitted: ${submittedAt}`,
    "",
    `Name:    ${fullName || "(not provided)"}`,
    `Email:   ${email}`,
    `Company: ${company || "(not provided)"}`,
    "",
    "Reason:",
    reason,
  ].join("\n");

  return { html, text };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!event.body) {
    return jsonResponse(400, { error: "Missing request body" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const fullName = sanitize(payload.fullName);
  const email    = sanitize(payload.email);
  const company  = sanitize(payload.company);
  const reason   = sanitize(payload.reason);

  if (!email || !reason) {
    return jsonResponse(400, { error: "Email and reason are required" });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const toAddress    = process.env.ACCESS_NOTIF_TO;
  const fromAddress  = process.env.ACCESS_NOTIF_FROM;

  if (!resendApiKey || !toAddress || !fromAddress) {
    console.error("Missing Resend configuration");
    return jsonResponse(500, { error: "Email configuration is incomplete" });
  }

  const submittedAt = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });

  const { html, text } = buildAccessRequestEmail({ fullName, email, company, reason, submittedAt });

  const resend = new Resend(resendApiKey);
  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      bcc: EMAIL_BCC,
      subject: `Access Request — ${fullName || email}`,
      html,
      text,
      attachments: [BEAT_KNOWLEDGE_ATTACHMENT],
    });

    if (error) {
      console.error("Failed to send access request email", error);
      return jsonResponse(500, { error: "Failed to send access request notification" });
    }
  } catch (err) {
    console.error("Unexpected error sending access request email", err);
    return jsonResponse(500, { error: "Failed to send access request notification" });
  }

  return jsonResponse(200, { success: true });
};
