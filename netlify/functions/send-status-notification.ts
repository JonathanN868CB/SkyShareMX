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

function sanitize(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

type NotifStatus = "Active" | "Inactive" | "Suspended";

const STATUS_COPY: Record<NotifStatus, { subject: string; heading: string; body: string; ctaLabel?: string }> = {
  Active: {
    subject: "Your SkyShare MX account is now active",
    heading: "Account Activated",
    body: "Your SkyShare MX Maintenance Portal account has been activated. You can now sign in and access your assigned areas.",
    ctaLabel: "Sign In Now",
  },
  Inactive: {
    subject: "Your SkyShare MX account has been deactivated",
    heading: "Account Deactivated",
    body: "Your SkyShare MX Maintenance Portal account has been deactivated. If you believe this is an error, please contact your administrator.",
  },
  Suspended: {
    subject: "Your SkyShare MX account has been suspended",
    heading: "Account Suspended",
    body: "Your SkyShare MX Maintenance Portal account has been suspended. Please contact your administrator for further information.",
  },
};

function buildStatusEmail(opts: {
  userName: string;
  status: NotifStatus;
  adminName: string;
  siteUrl: string;
}): { html: string; text: string } {
  const { userName, status, adminName, siteUrl } = opts;
  const copy = STATUS_COPY[status];
  const year = new Date().getFullYear();

  const ctaBlock = copy.ctaLabel
    ? `
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:21px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:6px;background:#d4a017;">
                          <a href="${siteUrl}"
                             style="display:inline-block;padding:13px 29px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#111111;text-decoration:none;">
                            ${copy.ctaLabel} &#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${copy.subject}</title>
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

              <!-- Logo / wordmark -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:29px;">
                <tr>
                  <td>
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

              <!-- Heading -->
              <h1 style="margin:0 0 25px;font-family:'Georgia','Times New Roman',serif;font-size:27px;font-weight:400;font-style:italic;letter-spacing:0.03em;color:#ffffff;line-height:1.2;">
                ${copy.heading}
              </h1>

              <!-- Body -->
              <p style="margin:0 0 ${copy.ctaLabel ? "32px" : "8px"};font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);">
                ${userName ? `<strong style="color:#ffffff;">Hi ${userName},</strong><br/><br/>` : ""}${copy.body}
              </p>

              ${ctaBlock}

              <!-- Admin credit -->
              <p style="margin:${copy.ctaLabel ? "0" : "20px 0 0"};font-size:11px;color:rgba(255,255,255,0.3);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.04em;">
                This action was performed by <span style="color:rgba(255,255,255,0.5);">${adminName}</span>.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 8px 0;text-align:center;">
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.08em;">
                © ${year} SKYSHARE &nbsp;<span style="color:#d4a017;">·</span>&nbsp;
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
    copy.subject,
    "",
    userName ? `Hi ${userName},` : "",
    "",
    copy.body,
    "",
    `This action was performed by ${adminName}.`,
    "",
    `© ${year} SkyShare · ${siteUrl}`,
  ].filter(l => l !== undefined).join("\n");

  return { html, text };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const token = getAccessToken(event);
  if (!token) {
    return jsonResponse(401, { error: "Authentication required" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRole || !anonKey) {
    return jsonResponse(500, { error: "Server configuration error" });
  }

  // Verify caller is admin
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid or expired session" });
  }

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile } = await adminClient
    .from("profiles")
    .select("role, full_name, first_name")
    .eq("user_id", userData.user.id)
    .single();

  const callerRole = typeof callerProfile?.role === "string" ? callerProfile.role : "";
  if (!["Super Admin", "Admin"].includes(callerRole)) {
    return jsonResponse(403, { error: "Forbidden" });
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

  const userEmail = sanitize(payload.userEmail).toLowerCase();
  const userName  = sanitize(payload.userName);
  const newStatus = sanitize(payload.newStatus) as NotifStatus;
  const siteUrl   = sanitize(payload.siteUrl) || "https://www.skysharemx.com";

  if (!userEmail) return jsonResponse(400, { error: "userEmail is required" });
  if (!["Active", "Inactive", "Suspended"].includes(newStatus)) {
    return jsonResponse(400, { error: "Invalid status" });
  }

  const adminName = callerProfile?.full_name ?? callerProfile?.first_name ?? "A SkyShare admin";

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress  = process.env.ACCESS_NOTIF_FROM ?? "noreply@skysharemx.com";

  if (!resendApiKey) {
    return jsonResponse(500, { error: "Email service not configured" });
  }

  const { html, text } = buildStatusEmail({ userName, status: newStatus, adminName, siteUrl });

  const resend = new Resend(resendApiKey);
  const { error: emailError } = await resend.emails.send({
    from: fromAddress,
    to: [userEmail],
    subject: STATUS_COPY[newStatus].subject,
    html,
    text,
  });

  if (emailError) {
    console.error("Resend error", emailError);
    return jsonResponse(500, { error: "Failed to send notification email" });
  }

  return jsonResponse(200, { ok: true });
};
