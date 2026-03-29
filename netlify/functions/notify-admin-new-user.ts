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

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getAccessToken(event: HandlerEvent): string | null {
  const header = event.headers?.authorization ?? event.headers?.Authorization ?? "";
  const parts = header.trim().split(/\s+/);
  if (parts.length === 1) return parts[0] || null;
  const [scheme, ...rest] = parts;
  if (!/^bearer$/i.test(scheme)) return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

function buildEmail(opts: {
  newUserName: string;
  newUserEmail: string;
  siteUrl: string;
  usersUrl: string;
}): { html: string; text: string } {
  const { newUserName, newUserEmail, siteUrl, usersUrl } = opts;
  const year = new Date().getFullYear();
  const displayName = newUserName || newUserEmail;
  const now = new Date().toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New User — SkyShare MX</title>
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
            <td style="background:#1a1a1a;border-radius:0 0 4px 4px;padding:36px 43px 32px;border:1px solid rgba(255,255,255,0.08);border-top:none;">

              <!-- Logo -->
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
              <h1 style="margin:0 0 6px;font-family:'Georgia','Times New Roman',serif;font-size:27px;font-weight:400;font-style:italic;letter-spacing:0.03em;color:#ffffff;line-height:1.2;">
                New User Joined
              </h1>
              <p style="margin:0 0 28px;font-size:10px;font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.25);">
                ${now}
              </p>

              <!-- Body -->
              <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.8);">
                Hey Jonathan,
              </p>
              <p style="margin:0 0 28px;font-size:13px;line-height:1.75;color:rgba(255,255,255,0.65);">
                <strong style="color:#ffffff;">${displayName}</strong>
                ${newUserName ? `<span style="color:rgba(255,255,255,0.35);"> · ${newUserEmail}</span>` : ""}
                just joined SkyShare MX. They've been assigned the
                <strong style="color:#d4a017;">Technician</strong> role with access to
                Dashboard and Aircraft Info.
              </p>

              <!-- Info block -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;background:rgba(255,255,255,0.04);border-radius:4px;border:1px solid rgba(255,255,255,0.08);">
                <tr>
                  <td style="padding:14px 18px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:9px;font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);padding-bottom:4px;">Email</td>
                        <td style="font-size:12px;color:rgba(255,255,255,0.75);text-align:right;">${newUserEmail}</td>
                      </tr>
                      <tr>
                        <td style="font-size:9px;font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);padding-top:8px;">Role</td>
                        <td style="font-size:12px;color:#d4a017;text-align:right;padding-top:8px;font-weight:600;">Technician</td>
                      </tr>
                      <tr>
                        <td style="font-size:9px;font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.3);padding-top:8px;">Access</td>
                        <td style="font-size:12px;color:rgba(255,255,255,0.6);text-align:right;padding-top:8px;">Dashboard · Aircraft Info</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:6px;background:#d4a017;">
                          <a href="${usersUrl}"
                             style="display:inline-block;padding:13px 29px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#111111;text-decoration:none;">
                            Open User Management &#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

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
    "New User Joined — SkyShare MX",
    "",
    `Hey Jonathan,`,
    "",
    `${displayName}${newUserName ? ` (${newUserEmail})` : ""} just joined SkyShare MX.`,
    `Role: Technician  ·  Access: Dashboard, Aircraft Info`,
    "",
    `Manage them here: ${usersUrl}`,
    "",
    `© ${year} SkyShare · ${siteUrl}`,
  ].join("\n");

  return { html, text };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  // Verify the caller has a valid Supabase session (they must be a real @skyshare.com user)
  const token = getAccessToken(event);
  if (!token) return json(401, { error: "Authentication required" });

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey     = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const resendKey   = process.env.RESEND_API_KEY;
  const fromAddress = process.env.ACCESS_NOTIF_FROM ?? "noreply@skyshare.com";
  const adminEmail  = process.env.MASTER_ADMIN_EMAIL ?? "jonathan@skyshare.com";
  const siteUrl     = process.env.URL ?? "https://www.skysharemx.com";

  if (!supabaseUrl || !anonKey || !resendKey) {
    return json(500, { error: "Server configuration error" });
  }

  // Verify the session belongs to a real @skyshare.com user
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData?.user?.email?.endsWith("@skyshare.com")) {
    return json(401, { error: "Unauthorized" });
  }

  if (!event.body) return json(400, { error: "Missing body" });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const newUserEmail = typeof payload.newUserEmail === "string" ? payload.newUserEmail.trim() : "";
  const newUserName  = typeof payload.newUserName  === "string" ? payload.newUserName.trim()  : "";

  if (!newUserEmail) return json(400, { error: "newUserEmail is required" });

  const usersUrl = `${siteUrl}/app/admin/users`;

  const { html, text } = buildEmail({ newUserName, newUserEmail, siteUrl, usersUrl });
  const resend = new Resend(resendKey);

  const { error: emailError } = await resend.emails.send({
    from: fromAddress,
    to: [adminEmail],
    subject: `New User — ${newUserName || newUserEmail} joined SkyShare MX`,
    html,
    text,
  });

  if (emailError) {
    console.error("Resend error", emailError);
    return json(500, { error: "Failed to send notification email" });
  }

  return json(200, { ok: true });
};
