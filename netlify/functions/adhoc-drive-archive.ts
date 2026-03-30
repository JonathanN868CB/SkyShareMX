/**
 * adhoc-drive-archive — Netlify serverless function
 *
 * POST { adHocId: number, technicianId: number }
 *
 * 1. Fetches the ad_hoc_completion record using service_role key (bypasses RLS)
 * 2. Fetches the technician record
 * 3. Generates a PDF summary using pdf-lib
 * 4. Uploads to Google Drive under:
 *    Technicians/{TechCode}_{TechName}/Training/{YYYY}/AdHoc/
 * 5. Updates ad_hoc_completion.drive_url with the shareable Drive file URL
 *
 * Required environment variables:
 *   SUPABASE_URL                — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — service role key (bypasses RLS, keep secret)
 *   GOOGLE_SERVICE_ACCOUNT_JSON — full JSON of the service account key file
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID — Drive folder ID for "Technicians/" root
 *
 * Dependencies needed (add to package.json before deploy):
 *   pdf-lib        — pure JS PDF generation, no native binaries
 *   google-auth-library — Google auth for service accounts
 */

import type { Handler, HandlerEvent } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { GoogleAuth } from "google-auth-library"

// ─── Supabase (service role — bypasses RLS) ───────────────────────────────────

function getServiceClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { db: { schema: "mxlms" } })
}

// ─── Google Drive helpers ─────────────────────────────────────────────────────

async function getDriveToken(): Promise<string> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON")
  const credentials = JSON.parse(json)
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
  const client = await auth.getClient()
  const tokenResponse = await (client as any).getAccessToken()
  if (!tokenResponse.token) throw new Error("Failed to obtain Google Drive access token")
  return tokenResponse.token
}

async function getOrCreateFolder(
  token: string,
  name: string,
  parentId: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'")
  const query = `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!searchRes.ok) throw new Error(`Drive folder search failed: ${await searchRes.text()}`)

  const { files } = await searchRes.json() as { files: { id: string }[] }
  if (files.length > 0) return files[0].id

  // Create the folder
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  })
  if (!createRes.ok) throw new Error(`Drive folder create failed: ${await createRes.text()}`)
  const created = await createRes.json() as { id: string }
  return created.id
}

async function uploadFileToDrive(
  token: string,
  fileName: string,
  pdfBytes: Uint8Array,
  folderId: string
): Promise<{ id: string; webViewLink: string }> {
  const boundary = "boundary_adhoc_pdf"
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] })

  // Multipart upload
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metadata,
    `--${boundary}`,
    "Content-Type: application/pdf",
    "",
    "",
  ].join("\r\n")

  const bodyEncoder = new TextEncoder()
  const bodyPrefix  = bodyEncoder.encode(body)
  const bodySuffix  = bodyEncoder.encode(`\r\n--${boundary}--`)
  const combined    = new Uint8Array(bodyPrefix.length + pdfBytes.length + bodySuffix.length)
  combined.set(bodyPrefix)
  combined.set(pdfBytes, bodyPrefix.length)
  combined.set(bodySuffix, bodyPrefix.length + pdfBytes.length)

  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    }
  )
  if (!uploadRes.ok) throw new Error(`Drive upload failed: ${await uploadRes.text()}`)

  const result = await uploadRes.json() as { id: string; webViewLink: string }

  // Make the file readable by anyone with the link
  await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  })

  return result
}

// ─── PDF generation ───────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  "safety-observation":  "Safety Observation",
  "procedure-refresher": "Procedure Refresher",
  "tooling-equipment":   "Tooling / Equipment",
  "regulatory-briefing": "Regulatory Briefing",
  "ojt-mentorship":      "OJT / Mentorship",
  "general":             "General",
}

function formatDate(str: string | null | undefined): string {
  if (!str) return "—"
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

interface AdHocRecord {
  id: number
  name: string
  event_type: string
  completed_date: string | null
  description: string | null
  corrective_action: string | null
  severity: string | null
  notes: string | null
  initiated_by_name: string | null
  acknowledged_at: string | null
  requires_acknowledgment: boolean
}

interface TechRecord {
  name: string
  tech_code: string | null
}

async function generatePdf(record: AdHocRecord, tech: TechRecord): Promise<Uint8Array> {
  const pdfDoc   = await PDFDocument.create()
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const page     = pdfDoc.addPage([612, 792]) // US Letter
  const { width, height } = page.getSize()
  const margin   = 56
  const contentW = width - margin * 2

  let y = height - margin

  // Header bar
  page.drawRectangle({ x: 0, y: height - 48, width, height: 48, color: rgb(0.0, 0.18, 0.27) })
  page.drawText("SkyShare MX — Ad Hoc Training Record", {
    x: margin, y: height - 31,
    size: 13, font: fontBold, color: rgb(1, 1, 1),
  })

  y -= 60

  // Helper: label + value block
  function field(label: string, value: string | null | undefined, boldValue = false) {
    if (y < margin + 60) {
      // add new page if needed
      const newPage = pdfDoc.addPage([612, 792])
      y = height - margin
      // return the new page – but since we captured `page` by reference, use addPage differently
    }
    const val = value ?? "—"
    page.drawText(label.toUpperCase(), {
      x: margin, y,
      size: 8, font, color: rgb(0.5, 0.5, 0.5),
    })
    y -= 15
    page.drawText(val, {
      x: margin, y,
      size: 10, font: boldValue ? fontBold : font, color: rgb(0.1, 0.1, 0.1),
      maxWidth: contentW,
    })
    y -= 22
  }

  function divider() {
    page.drawLine({
      start: { x: margin, y: y + 6 },
      end:   { x: width - margin, y: y + 6 },
      thickness: 0.5, color: rgb(0.85, 0.85, 0.85),
    })
    y -= 12
  }

  // Title
  page.drawText(record.name, {
    x: margin, y,
    size: 16, font: fontBold, color: rgb(0.05, 0.05, 0.05), maxWidth: contentW,
  })
  y -= 28

  divider()

  // Basic info
  field("Technician",   `${tech.name}${tech.tech_code ? ` [${tech.tech_code}]` : ""}`, true)
  field("Event Type",   EVENT_TYPE_LABELS[record.event_type] ?? record.event_type)
  field("Date",         formatDate(record.completed_date))

  if (record.severity) {
    field("Severity", record.severity.charAt(0).toUpperCase() + record.severity.slice(1))
  }

  field("Recorded By", record.initiated_by_name)

  divider()

  // Description + corrective action
  if (record.description) {
    field("What Happened / Description", record.description)
  }
  if (record.corrective_action) {
    field("Corrective Action / Training Delivered", record.corrective_action)
  }
  if (record.notes) {
    field("Notes", record.notes)
  }

  divider()

  // Acknowledgment
  field(
    "Requires Acknowledgment",
    record.requires_acknowledgment ? "Yes" : "No"
  )
  if (record.acknowledged_at) {
    field("Acknowledged At", formatDate(record.acknowledged_at))
  }

  // Footer
  const footer = `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · SkyShare MX`
  page.drawText(footer, {
    x: margin, y: margin - 16,
    size: 8, font, color: rgb(0.6, 0.6, 0.6),
  })

  return pdfDoc.save()
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" }
  }

  let adHocId: number
  let technicianId: number

  try {
    const body = JSON.parse(event.body ?? "{}")
    adHocId      = Number(body.adHocId)
    technicianId = Number(body.technicianId)
    if (!adHocId || !technicianId) throw new Error("Missing adHocId or technicianId")
  } catch (err: any) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) }
  }

  try {
    const db = getServiceClient()

    // 1. Fetch ad hoc record
    const { data: record, error: recErr } = await db
      .from("ad_hoc_completions")
      .select("id,name,event_type,completed_date,description,corrective_action,severity,notes,initiated_by_name,acknowledged_at,requires_acknowledgment")
      .eq("id", adHocId)
      .single()
    if (recErr || !record) throw new Error(recErr?.message ?? "Ad hoc record not found")

    // 2. Fetch technician
    const { data: tech, error: techErr } = await db
      .from("technicians")
      .select("name,tech_code")
      .eq("id", technicianId)
      .single()
    if (techErr || !tech) throw new Error(techErr?.message ?? "Technician not found")

    // 3. Generate PDF
    const pdfBytes = await generatePdf(record as AdHocRecord, tech as TechRecord)

    // 4. Upload to Drive
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (!rootFolderId) throw new Error("Missing GOOGLE_DRIVE_ROOT_FOLDER_ID")

    const token = await getDriveToken()

    const techFolderName = tech.tech_code
      ? `${tech.tech_code}_${tech.name}`
      : tech.name
    const techFolderId = await getOrCreateFolder(token, techFolderName, rootFolderId)

    const trainingFolderId = await getOrCreateFolder(token, "Training", techFolderId)

    const year = record.completed_date
      ? new Date(record.completed_date).getFullYear().toString()
      : new Date().getFullYear().toString()
    const yearFolderId = await getOrCreateFolder(token, year, trainingFolderId)

    const adHocFolderId = await getOrCreateFolder(token, "AdHoc", yearFolderId)

    const safeTitle = (record.name as string).replace(/[^a-zA-Z0-9 _-]/g, "").trim()
    const timestamp = new Date().toISOString().slice(0, 10)
    const fileName  = `${timestamp}-AdHoc-${safeTitle}.pdf`

    const uploaded = await uploadFileToDrive(token, fileName, pdfBytes, adHocFolderId)

    // 5. Update drive_url on the record
    const { error: updateErr } = await db
      .from("ad_hoc_completions")
      .update({ drive_url: uploaded.webViewLink })
      .eq("id", adHocId)
    if (updateErr) throw new Error(updateErr.message)

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, driveUrl: uploaded.webViewLink }),
    }
  } catch (err: any) {
    console.error("[adhoc-drive-archive]", err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message ?? "Internal error" }),
    }
  }
}
