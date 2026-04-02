import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { BEAT_KNOWLEDGE_ATTACHMENT, EMAIL_BCC } from "./_email-assets";

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
              <h1 style="margin:0 0 25px;font-family:'Georgia','Times New Roman',serif;font-size:27px;font-weight:400;font-style:italic;letter-spacing:0.03em;color:#ffffff;line-height:1.2;">
                Welcome Aboard
              </h1>

              <!-- Body -->
              <p style="margin:0 0 50px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.75);">
                <strong style="color:#ffffff;">${invitedByName}</strong> has invited you to join <strong style="color:#ffffff;">SkyShare MX</strong> as a <strong style="color:#d4a017;">${role}</strong>.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:21px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:6px;background:#d4a017;">
                          <a href="${acceptUrl}"
                             style="display:inline-block;padding:13px 29px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#111111;text-decoration:none;">
                            Accept Invitation &#8594;
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
              <p style="margin:0 0 6px;font-size:10px;color:rgba(255,255,255,0.18);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.04em;line-height:1.6;">
                This invitation expires in 24 hours. If you did not expect this email, you can safely ignore it.
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

  // Grant default permissions. user_permissions.user_id = profiles.id,
  // but the profile row is created by a DB trigger on auth.user insert —
  // so we fetch it right after generateLink creates the auth user.
  const newUserId = linkData.user?.id;
  if (newUserId) {
    const { data: newProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", newUserId)
      .maybeSingle();

    if (newProfile) {
      const DEFAULT_SECTIONS = [
        "Dashboard",
        "Aircraft Info",
      ] as const;

      // Upsert so the DB trigger's pre-seeded rows are never double-inserted.
      await adminClient.from("user_permissions").upsert(
        DEFAULT_SECTIONS.map(section => ({ user_id: newProfile.id, section })),
        { onConflict: "user_id,section", ignoreDuplicates: true }
      );

      // Profile was created Active by the DB trigger — set to Pending until
      // the user actually accepts the invite and completes sign-in.
      await adminClient.from("profiles").update({ status: "Pending" }).eq("id", newProfile.id);
    }
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
    bcc: EMAIL_BCC,
    subject: `You've been invited to SkyShare MX`,
    html,
    text,
    attachments: [BEAT_KNOWLEDGE_ATTACHMENT],
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
