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
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode: number, body: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ── Email template ──────────────────────────────────────────────
function buildInterviewEmail(opts: {
  technicianName: string;
  assignerName: string;
  discrepancyTitle: string;
  tailNumber: string;
  domNote: string | null;
  siteUrl: string;
}): { html: string; text: string } {
  const { technicianName, assignerName, discrepancyTitle, tailNumber, domNote, siteUrl } = opts;

  const firstName = technicianName.split(" ")[0];

  const domNoteBlock = domNote
    ? `<tr>
        <td style="padding:18px 20px;background:rgba(212,160,23,0.06);border:1px solid rgba(212,160,23,0.12);border-radius:4px;margin-top:8px;">
          <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#d4a017;font-family:'Montserrat',Arial,sans-serif;">Note from the DOM</p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,0.8);font-style:italic;">"${domNote}"</p>
        </td>
      </tr>
      <tr><td style="height:18px;"></td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DW1GHT Interview Assignment</title>
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
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td>
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:#d4a017;border-bottom:1px solid #d4a017;padding-bottom:2px;">SKYSHARE MX</span>
                    <span style="font-family:'Montserrat',Arial,sans-serif;font-size:10px;font-weight:400;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-left:11px;">Interview Assignment</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:7px;">
                    <div style="height:1px;width:43px;background:#d4a017;"></div>
                  </td>
                </tr>
              </table>

              <!-- Beet icon + heading row -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
                <tr>
                  <td style="vertical-align:middle;width:64px;">
                    <img
                      src="cid:beat-knowledge"
                      alt="Beat Knowledge"
                      width="56"
                      height="56"
                      style="display:block;border:0;border-radius:8px;"
                    />
                  </td>
                  <td style="vertical-align:middle;padding-left:14px;">
                    <h1 style="margin:0;font-family:'Georgia','Times New Roman',serif;font-size:24px;font-weight:400;font-style:italic;letter-spacing:0.03em;color:#ffffff;line-height:1.2;">
                      You've Been Summoned
                    </h1>
                    <p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(212,160,23,0.6);font-family:'Montserrat',Arial,sans-serif;">
                      DW1GHT Interview Division
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <p style="margin:0 0 6px;font-size:14px;line-height:1.7;color:rgba(255,255,255,0.85);">
                ${firstName},
              </p>
              <p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:rgba(255,255,255,0.7);">
                <strong style="color:#ffffff;">${assignerName}</strong> needs your firsthand account on a maintenance event. DW1GHT &mdash; our digital knowledge collector &mdash; will walk you through a short interview. Your experience matters. The beet demands it.
              </p>

              <!-- Discrepancy details -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
                <tr>
                  <td style="padding:14px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-bottom:8px;">
                          <span style="font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-family:'Montserrat',Arial,sans-serif;">Aircraft</span>
                          <br/>
                          <span style="font-size:16px;font-weight:700;letter-spacing:0.06em;color:#d4a017;font-family:'Montserrat',Arial,sans-serif;">${tailNumber}</span>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span style="font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.35);font-family:'Montserrat',Arial,sans-serif;">Event</span>
                          <br/>
                          <span style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.5;">${discrepancyTitle}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- DOM note (conditional) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${domNoteBlock}
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:21px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:6px;background:#d4a017;">
                          <a href="${siteUrl}/app/discrepancy-intelligence"
                             style="display:inline-block;padding:13px 29px;font-family:'Montserrat',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#111111;text-decoration:none;">
                            Begin Interview &#8594;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Dwight quote -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top:8px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
                    <p style="margin:0;font-size:11px;font-style:italic;color:rgba(255,255,255,0.3);line-height:1.5;font-family:'Georgia','Times New Roman',serif;">
                      "Knowledge is the only weapon that doesn't need a holster."
                    </p>
                    <p style="margin:4px 0 0;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(212,160,23,0.3);font-family:'Montserrat',Arial,sans-serif;">
                      &mdash; DW1GHT
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 8px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:10px;color:rgba(255,255,255,0.18);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.04em;line-height:1.6;">
                You received this because an interview was assigned to you in SkyShare MX.
              </p>
              <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);font-family:'Montserrat',Arial,sans-serif;letter-spacing:0.08em;">
                &copy; ${new Date().getFullYear()} SKYSHARE &nbsp;<span style="color:#d4a017;">&middot;</span>&nbsp;
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
    `DW1GHT Interview Assignment`,
    ``,
    `${firstName}, ${assignerName} needs your firsthand account on a maintenance event.`,
    ``,
    `Aircraft: ${tailNumber}`,
    `Event: ${discrepancyTitle}`,
    domNote ? `\nDOM Note: "${domNote}"\n` : ``,
    `Begin your interview at: ${siteUrl}/app/discrepancy-intelligence`,
    ``,
    `"Knowledge is the only weapon that doesn't need a holster." — DW1GHT`,
    ``,
    `© ${new Date().getFullYear()} SkyShare · ${siteUrl}`,
  ].filter(Boolean).join("\n");

  return { html, text };
}

// ── Handler ─────────────────────────────────────────────────────
export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (!event.body) {
    return json(400, { error: "Missing request body" });
  }

  let payload: {
    technicianEmail: string;
    technicianName: string;
    assignerName: string;
    discrepancyTitle: string;
    tailNumber: string;
    domNote?: string | null;
  };

  try {
    payload = JSON.parse(event.body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { technicianEmail, technicianName, assignerName, discrepancyTitle, tailNumber, domNote } = payload;

  if (!technicianEmail || !technicianName || !discrepancyTitle) {
    return json(400, { error: "technicianEmail, technicianName, and discrepancyTitle are required" });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = "DW1GHT <dw1ght@skyshare.com>";

  if (!resendApiKey) {
    return json(500, { error: "Email service not configured" });
  }

  const siteUrl = "https://www.skysharemx.com";

  const { html, text } = buildInterviewEmail({
    technicianName,
    assignerName,
    discrepancyTitle,
    tailNumber: tailNumber || "N/A",
    domNote: domNote || null,
    siteUrl,
  });

  const resend = new Resend(resendApiKey);
  const { error: emailError } = await resend.emails.send({
    from: fromAddress,
    to: [technicianEmail],
    bcc: EMAIL_BCC,
    subject: `DW1GHT Interview Assignment — ${tailNumber || "Fleet Event"}`,
    html,
    text,
    attachments: [BEAT_KNOWLEDGE_ATTACHMENT],
  });

  if (emailError) {
    console.error("[Interview Invite] Resend error:", emailError);
    return json(500, { error: "Failed to send interview notification" });
  }

  console.log(`[Interview Invite] Sent to ${technicianEmail} for "${discrepancyTitle}"`);
  return json(200, { ok: true });
};
