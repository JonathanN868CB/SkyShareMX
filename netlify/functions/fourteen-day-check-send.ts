// fourteen-day-check-send — AUTH REQUIRED
// Emails the permanent 14-day check link to a mechanic.
// Does NOT lock or modify the token — it's a standing link, always open.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { decodeToken } from "./_token-encoder";

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

function buildCheckEmail(opts: {
  recipientName: string;
  senderName: string;
  registration: string;
  checkUrl: string;
  siteUrl: string;
}): { html: string; text: string } {
  const { recipientName, senderName, registration, checkUrl, siteUrl } = opts;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>14-Day Check — ${registration}</title>
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

              <!-- Wordmark -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:29px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#d4a017;border-bottom:1px solid #d4a017;padding-bottom:2px;">SKYSHARE MX</span>
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-left:11px;">Maintenance Portal</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:7px;">
                    <div style="height:1px;width:43px;background:#d4a017;"></div>
                  </td>
                </tr>
              </table>

              <!-- Greeting -->
              <h1 style="margin:0 0 10px;font-family:'Georgia','Times New Roman',serif;font-size:24px;font-weight:400;font-style:italic;color:#ffffff;line-height:1.2;">
                Hi ${recipientName},
              </h1>

              <!-- Context -->
              <p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);">
                <strong style="color:#ffffff;">${senderName}</strong> is requesting your 14-day inspection for:
              </p>

              <!-- Aircraft chip -->
              <div style="margin:0 0 22px;display:inline-block;background:rgba(212,160,23,0.12);border:1px solid rgba(212,160,23,0.3);border-radius:4px;padding:8px 14px;">
                <span style="font-family:'Montserrat',Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#d4a017;">${registration}</span>
              </div>

              <!-- Instructions -->
              <p style="margin:0 0 24px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.55);border-left:2px solid rgba(212,160,23,0.3);padding-left:14px;">
                Visit the aircraft, run through the checklist, and snap the required photos. The form works on your phone — no login required.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:6px;background:#d4a017;">
                          <a href="${checkUrl}"
                             style="display:inline-block;padding:13px 29px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#111111;text-decoration:none;">
                            Open Checklist &#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <p style="margin:0;font-size:11px;line-height:1.6;color:rgba(255,255,255,0.3);text-align:center;word-break:break-all;">
                Or copy this link: <a href="${checkUrl}" style="color:rgba(212,160,23,0.6);text-decoration:none;">${checkUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 8px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:10px;color:rgba(255,255,255,0.18);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.04em;line-height:1.6;">
                This link is permanent and can be reused each cycle. No account required to submit.
              </p>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.08em;">
                © ${new Date().getFullYear()} SKYSHARE &nbsp;<span style="color:#d4a017;">·</span>&nbsp;
                <a href="${siteUrl}" style="color:rgba(255,255,255,0.25);text-decoration:none;">skysharemx.com</a>
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
    `Hi ${recipientName},`,
    ``,
    `${senderName} is requesting your 14-day inspection for aircraft ${registration}.`,
    ``,
    `Visit the aircraft, run through the checklist, and snap the required photos.`,
    `The form works on your phone — no login required.`,
    ``,
    `Open the checklist:`,
    checkUrl,
    ``,
    `This link is permanent and can be reused each cycle.`,
    ``,
    `© ${new Date().getFullYear()} SkyShare · ${siteUrl}`,
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

  const accessToken = getAccessToken(event);
  if (!accessToken) {
    return jsonResponse(401, { error: "Authentication required" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ACCESS_NOTIF_FROM ?? "noreply@skyshare.com";
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "") || "https://skysharemx.com";

  if (!supabaseUrl || !serviceRole || !anonKey) {
    return jsonResponse(500, { error: "Server configuration error" });
  }
  if (!resendApiKey) {
    return jsonResponse(500, { error: "Email service not configured" });
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

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("id, full_name, email")
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

  const encodedToken = typeof payload.encodedToken === "string" ? payload.encodedToken.trim() : "";
  const recipientName = typeof payload.recipientName === "string" ? payload.recipientName.trim() : "";
  const recipientEmail = typeof payload.recipientEmail === "string" ? payload.recipientEmail.trim().toLowerCase() : "";

  if (!encodedToken || !recipientName || !recipientEmail) {
    return jsonResponse(400, { error: "Missing encodedToken, recipientName, or recipientEmail" });
  }

  // Decode token and look up aircraft registration
  let rawToken: string;
  try {
    rawToken = decodeToken(encodedToken);
  } catch {
    return jsonResponse(404, { error: "Aircraft not found" });
  }

  const { data: tokenRow } = await adminClient
    .from("fourteen_day_check_tokens")
    .select(`
      token,
      aircraft:aircraft_id (
        aircraft_registrations (registration, is_current)
      )
    `)
    .eq("token", rawToken)
    .single();

  if (!tokenRow) {
    return jsonResponse(404, { error: "Aircraft not found" });
  }

  const regs = (tokenRow as any).aircraft?.aircraft_registrations ?? [];
  const registration = regs.find((r: any) => r.is_current)?.registration ?? "UNKNOWN";
  const checkUrl = `${siteUrl}/check/${encodedToken}`;
  const senderName = callerProfile.full_name || callerProfile.email || "SkyShare MX";

  const { html, text } = buildCheckEmail({ recipientName, senderName, registration, checkUrl, siteUrl });

  const resend = new Resend(resendApiKey);
  const bccEmail = process.env.ACCESS_NOTIF_TO;
  const { error: emailError } = await resend.emails.send({
    from: `DW1GHT <${fromEmail}>`,
    to: [recipientEmail],
    ...(bccEmail ? { bcc: [bccEmail] } : {}),
    subject: `14-Day Check requested — ${registration}`,
    html,
    text,
  });

  if (emailError) {
    console.error("Resend error", emailError);
    return jsonResponse(500, { error: "Failed to send email" });
  }

  return jsonResponse(200, { success: true });
};
