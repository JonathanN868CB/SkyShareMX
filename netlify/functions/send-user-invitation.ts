import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

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

const DEFAULT_SITE_URL = "https://skyshare-maintenance.netlify.app";

function normalizeSiteUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveSiteUrl() {
  return (
    normalizeSiteUrl(process.env.SITE_URL) ??
    normalizeSiteUrl(process.env.VITE_PUBLIC_SITE_URL) ??
    normalizeSiteUrl(process.env.URL) ??
    DEFAULT_SITE_URL
  );
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing request body" }),
    };
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const firstName = typeof payload.firstName === "string" ? payload.firstName.trim() : "";
  const lastName = typeof payload.lastName === "string" ? payload.lastName.trim() : "";
  const role = typeof payload.role === "string" ? payload.role.trim() : "";

  if (!email || !firstName || !lastName || !role) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Email, first name, last name, and role are required" }),
    };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase configuration");
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Supabase configuration is missing" }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let invitationId: string | undefined;

  try {
    const { data: invitation, error: insertError } = await supabase
      .from("user_invitations")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        status: "Pending",
        invited_by: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create invitation row:", insertError);
      throw new Error(`Failed to create invitation: ${insertError.message}`);
    }

    invitationId = invitation?.id;

    const smtpHost = process.env.SMTP_HOST;
    const smtpPortValue = process.env.SMTP_PORT || "587";
    const smtpPort = Number(smtpPortValue);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || `SkyShare Maintenance Portal <${smtpUser ?? ""}>`;

    if (!smtpHost || Number.isNaN(smtpPort) || !smtpUser || !smtpPass) {
      throw new Error("SMTP credentials are not fully configured");
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const siteUrl = resolveSiteUrl();
    const inviteLink = `${siteUrl}/login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb; margin-bottom: 20px;">Welcome to SkyShare Maintenance Portal</h1>
        <p>Hi ${firstName},</p>
        <p>You've been invited to join the SkyShare Maintenance Portal as a <strong>${role}</strong>.</p>
        <p>SkyShare Maintenance Portal is your central hub for aircraft maintenance operations and oversight.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Your Account Details:</h3>
          <ul style="color: #6b7280;">
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Role:</strong> ${role}</li>
          </ul>
        </div>
        <p>To get started, please visit the portal and use your email address to sign in:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}"
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Access SkyShare Portal
          </a>
        </div>
        <p>If you have any questions or need assistance, please don't hesitate to reach out to your administrator.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 14px;">
          This invitation was sent from SkyShare Maintenance Portal. If you received this email in error, please ignore it.
        </p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 12px;">
          This is an automated email from the SkyShare Maintenance Portal.
        </p>
      </div>
    `;

    const text = [
      `Hi ${firstName},`,
      ``,
      `You've been invited to join the SkyShare Maintenance Portal as a ${role}.`,
      `SkyShare Maintenance Portal is your central hub for aircraft maintenance operations and oversight.`,
      ``,
      `Account details:`,
      `- Email: ${email}`,
      `- Role: ${role}`,
      ``,
      `To get started, visit ${inviteLink} and sign in with your email address.`,
      ``,
      `If you have any questions or need assistance, please reach out to your administrator.`,
      ``,
      `This invitation was sent from SkyShare Maintenance Portal. If you received this email in error, please ignore it.`,
      `This is an automated email from the SkyShare Maintenance Portal.`,
    ].join("\n");

    const mailResponse = await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: "You've been invited to SkyShare Maintenance Portal",
      html,
      text,
    });

    await supabase
      .from("user_invitations")
      .update({
        status: "Sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    console.log("Invitation email sent", { messageId: mailResponse.messageId, to: email });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        email_sent: true,
        invitation_id: invitationId,
        message_id: mailResponse.messageId,
      }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send invitation email:", message);

    if (invitationId) {
      try {
        await supabase
          .from("user_invitations")
          .update({
            status: "Failed",
            error_message: message,
          })
          .eq("id", invitationId);
      } catch (updateError) {
        console.error("Failed to update invitation status:", updateError);
      }
    }

    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        email_sent: false,
        error: message,
      }),
    };
  }
};
