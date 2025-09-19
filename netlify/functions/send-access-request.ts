import { Resend } from "resend";

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
  const email = sanitize(payload.email);
  const company = sanitize(payload.company);
  const reason = sanitize(payload.reason);

  if (!email || !reason) {
    return jsonResponse(400, { error: "Email and reason are required" });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const toAddress = process.env.ACCESS_NOTIF_TO;
  const fromAddress = process.env.ACCESS_NOTIF_FROM;

  if (!resendApiKey || !toAddress || !fromAddress) {
    console.error("Missing Resend configuration", {
      hasApiKey: Boolean(resendApiKey),
      hasToAddress: Boolean(toAddress),
      hasFromAddress: Boolean(fromAddress),
    });
    return jsonResponse(500, { error: "Email configuration is incomplete" });
  }

  const resend = new Resend(resendApiKey);
  const submittedAt = new Date().toISOString();

  const lines = [
    "A new maintenance portal access request was submitted.",
    "",
    `Name: ${fullName || "(not provided)"}`,
    `Email: ${email}`,
    `Company: ${company || "(not provided)"}`,
    "",
    "Reason:",
    reason,
    "",
    `Submitted at: ${submittedAt}`,
  ];

  const textBody = lines.join("\n");
  const htmlBody = `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827;">
      <h2 style="color: #1d4ed8;">New SkyShareMX access request</h2>
      <p style="margin: 0 0 16px 0;">A new access request was submitted via the public portal.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 560px; margin-bottom: 16px;">
        <tbody>
          <tr>
            <td style="padding: 6px 8px; font-weight: 600; width: 160px;">Name</td>
            <td style="padding: 6px 8px;">${fullName || "(not provided)"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; font-weight: 600;">Email</td>
            <td style="padding: 6px 8px;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; font-weight: 600;">Company</td>
            <td style="padding: 6px 8px;">${company || "(not provided)"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 8px; font-weight: 600;">Submitted</td>
            <td style="padding: 6px 8px;">${submittedAt}</td>
          </tr>
        </tbody>
      </table>
      <div style="padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 8px 0; font-weight: 600;">Reason</p>
        <p style="margin: 0; white-space: pre-wrap;">${reason}</p>
      </div>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      subject: "SkyShareMX – New access request",
      text: textBody,
      html: htmlBody,
    });

    if (error) {
      console.error("Failed to send access request email", error);
      return jsonResponse(500, { error: "Failed to send access request notification" });
    }
  } catch (error) {
    console.error("Unexpected error sending access request email", error);
    return jsonResponse(500, { error: "Failed to send access request notification" });
  }

  return jsonResponse(200, { success: true });
};
