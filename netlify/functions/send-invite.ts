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

const ALLOWED_DOMAIN = "skyshare.com";

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

function buildInviteEmail(opts: {
  inviteeEmail: string;
  invitedByName: string;
  role: string;
  acceptUrl: string;
  siteUrl: string;
}): { html: string; text: string } {
  const { invitedByName, role, acceptUrl, siteUrl } = opts;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to SkyShare MX</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Header stripe -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#c10230 0%,#012e45 100%);border-radius:4px 4px 0 0;"></td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#1a1a1a;border-radius:0 0 12px 12px;padding:40px 40px 32px;border:1px solid rgba(255,255,255,0.08);border-top:none;">

              <!-- Logo / wordmark -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td>
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#d4a017;">SKYSHARE MX</span>
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:400;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-left:10px;">Maintenance Portal</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;">
                    <div style="height:1px;width:48px;background:#d4a017;"></div>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 8px;font-family:'Montserrat',Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:0.03em;color:#ffffff;line-height:1.2;">
                You've been invited
              </h1>
              <p style="margin:0 0 28px;font-family:'Montserrat',Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.45);letter-spacing:0.05em;text-transform:uppercase;">
                to the SkyShare MX Maintenance Portal
              </p>

              <!-- Body -->
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.75);">
                <strong style="color:#ffffff;">${invitedByName}</strong> has invited you to join <strong style="color:#ffffff;">SkyShare MX</strong> as a <strong style="color:#d4a017;">${role}</strong>.
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.55);">
                Click the button below to accept your invitation and set up your account. This link expires in 24 hours.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
                <tr>
                  <td style="border-radius:6px;background:#d4a017;">
                    <a href="${acceptUrl}"
                       style="display:inline-block;padding:14px 32px;font-family:'Montserrat',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#111111;text-decoration:none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:24px;"></div>

              <!-- Fallback link -->
              <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.3);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.05em;">
                IF THE BUTTON DOESN'T WORK, COPY THIS LINK:
              </p>
              <p style="margin:0;font-size:12px;word-break:break-all;">
                <a href="${acceptUrl}" style="color:#d4a017;text-decoration:none;">${acceptUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 8px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.08em;">
                © ${new Date().getFullYear()} SKYSHARE &nbsp;·&nbsp;
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
    `You've been invited to SkyShare MX Maintenance Portal`,
    ``,
    `${invitedByName} has invited you to join as a ${role}.`,
    ``,
    `Accept your invitation here (expires in 24 hours):`,
    acceptUrl,
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

  // Auth check
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
    .select("role")
    .eq("user_id", userData.user.id)
    .single();

  const callerRole = typeof callerProfile?.role === "string" ? callerProfile.role : "";
  if (!["Super Admin", "Admin"].includes(callerRole)) {
    return jsonResponse(403, { error: "Forbidden" });
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

  const email = sanitize(payload.email).toLowerCase();
  const role = sanitize(payload.role) || "Technician";
  const invitedByName = sanitize(payload.invitedByName) || "A SkyShare admin";
  const siteUrl = sanitize(payload.siteUrl) || "https://www.skysharemx.com";

  if (!email) {
    return jsonResponse(400, { error: "Email is required" });
  }

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return jsonResponse(400, { error: `Only @${ALLOWED_DOMAIN} email addresses may be invited` });
  }

  // generateLink creates the invited user and returns the action link without sending any email.
  // We send our own branded email via Resend instead of relying on Supabase's default.
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { role, invited_by: invitedByName },
      redirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("Supabase generateLink error", linkError);
    return jsonResponse(500, { error: linkError?.message ?? "Failed to create invite link" });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.ACCESS_NOTIF_FROM ?? `noreply@${ALLOWED_DOMAIN}`;

  if (!resendApiKey) {
    return jsonResponse(500, { error: "Email service not configured" });
  }

  const { html, text } = buildInviteEmail({
    inviteeEmail: email,
    invitedByName,
    role,
    acceptUrl: linkData.properties.action_link,
    siteUrl,
  });

  const resend = new Resend(resendApiKey);
  const { error: emailError } = await resend.emails.send({
    from: fromAddress,
    to: [email],
    subject: `You've been invited to SkyShare MX`,
    html,
    text,
  });

  if (emailError) {
    console.error("Resend email error", emailError);
    return jsonResponse(500, { error: "Failed to send invite email" });
  }

  return jsonResponse(200, {
    ok: true,
    userId: linkData.user?.id ?? null,
  });
};
