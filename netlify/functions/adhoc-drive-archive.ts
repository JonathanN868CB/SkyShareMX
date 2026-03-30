/**
 * adhoc-drive-archive — Netlify serverless function
 *
 * Called by the browser after the LAST signature in the chain makes
 * status = 'complete'. Verifies completeness, generates a signed PDF,
 * uploads to Google Drive, then sets status = 'archived' and drive_url.
 *
 * POST body: { adHocId: number, technicianId: number }
 *
 * Required environment variables:
 *   SUPABASE_URL                — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — service role key (bypasses RLS)
 *   GOOGLE_SERVICE_ACCOUNT_JSON — full JSON of service account key file
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID — Drive folder ID of the Technicians/ root
 *
 * Dependencies to add before deploy:
 *   npm install pdf-lib google-auth-library
 */

import type { Handler, HandlerEvent } from "@netlify/functions"
import { createClient } from "@supabase/supabase-js"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { GoogleAuth } from "google-auth-library"

// ─── Supabase (service role) ───────────────────────────────────────────────────

function getDb() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, { db: { schema: "mxlms" } })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdHocRecord {
  id: number
  name: string
  event_type: string
  description: string | null
  corrective_action: string | null
  severity: string | null
  notes: string | null
  completed_date: string | null
  requires_acknowledgment: boolean
  status: string
  // manager
  initiated_by_name: string | null
  initiated_by_email: string | null
  manager_signed_at: string | null
  manager_signature_hash: string | null
  // tech
  tech_signed_by_name: string | null
  tech_signed_by_email: string | null
  acknowledged_at: string | null
  tech_signature_hash: string | null
  // witness
  witness_name: string | null
  witness_email: string | null
  witness_signed_at: string | null
  witness_signature_hash: string | null
}

interface TechRecord {
  name: string
  tech_code: string | null
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

async function getDriveToken(): Promise<string> {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON")
  const auth = new GoogleAuth({
    credentials: JSON.parse(json),
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
  const client = await auth.getClient()
  const res = await (client as any).getAccessToken()
  if (!res.token) throw new Error("Could not obtain Drive access token")
  return res.token
}

async function getOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Drive search failed: ${await res.text()}`)
  const { files } = await res.json() as { files: { id: string }[] }
  if (files.length > 0) return files[0].id

  const create = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  })
  if (!create.ok) throw new Error(`Drive folder create failed: ${await create.text()}`)
  return ((await create.json()) as { id: string }).id
}

async function uploadToDrive(
  token: string,
  fileName: string,
  pdfBytes: Uint8Array,
  folderId: string
): Promise<string> {
  const boundary = "boundary_skyshare_adhoc"
  const meta     = JSON.stringify({ name: fileName, parents: [folderId] })
  const enc      = new TextEncoder()
  const prefix   = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`)
  const suffix   = enc.encode(`\r\n--${boundary}--`)
  const body     = new Uint8Array(prefix.length + pdfBytes.length + suffix.length)
  body.set(prefix); body.set(pdfBytes, prefix.length); body.set(suffix, prefix.length + pdfBytes.length)

  const up = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  )
  if (!up.ok) throw new Error(`Drive upload failed: ${await up.text()}`)
  const { id, webViewLink } = await up.json() as { id: string; webViewLink: string }

  // Make readable by anyone with the link
  await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  })
  return webViewLink
}

// ─── PDF generation ───────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  "safety-observation":  "Safety Observation",
  "procedure-refresher": "Procedure Refresher",
  "tooling-equipment":   "Tooling / Equipment",
  "regulatory-briefing": "Regulatory Briefing",
  "ojt-mentorship":      "OJT / Mentorship",
  "general":             "General",
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—"
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  })
}

async function generatePdf(record: AdHocRecord, tech: TechRecord): Promise<Uint8Array> {
  const doc      = await PDFDocument.create()
  const font     = await doc.embedFont(StandardFonts.Helvetica)
  const fontB    = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontO    = await doc.embedFont(StandardFonts.HelveticaOblique)

  const W = 612, H = 792, M = 52
  let page = doc.addPage([W, H])
  let y    = H - M

  // ── Helper: wrap and draw text ─────────────────────────────────────────────
  function text(
    str: string,
    x: number,
    size: number,
    f: typeof font,
    color: [number, number, number] = [0.1, 0.1, 0.1],
    maxW = W - M * 2
  ): number {
    // Naive word wrap
    const words  = str.split(" ")
    let line     = ""
    let lineH    = size + 4

    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      const w    = f.widthOfTextAtSize(test, size)
      if (w > maxW && line) {
        if (y - lineH < M + 120) {
          page = doc.addPage([W, H]); y = H - M
        }
        page.drawText(line, { x, y, size, font: f, color: rgb(...color) })
        y -= lineH; line = word
      } else {
        line = test
      }
    }
    if (line) {
      if (y - lineH < M + 120) {
        page = doc.addPage([W, H]); y = H - M
      }
      page.drawText(line, { x, y, size, font: f, color: rgb(...color) })
      y -= lineH
    }
    return y
  }

  function gap(n = 10) { y -= n }

  function field(label: string, value: string | null | undefined) {
    if (!value) return
    text(label.toUpperCase(), M, 7.5, font, [0.55, 0.55, 0.55])
    gap(2)
    text(value, M, 10, font, [0.12, 0.12, 0.12])
    gap(10)
  }

  function divider(accentR = 0.8, accentG = 0.8, accentB = 0.8) {
    if (y < M + 130) { page = doc.addPage([W, H]); y = H - M }
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: rgb(accentR, accentG, accentB) })
    gap(14)
  }

  // ── Header bar ─────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 50, width: W, height: 50, color: rgb(0.0, 0.18, 0.27) })
  page.drawText("SkyShare MX — Ad Hoc Training Record", {
    x: M, y: H - 33, size: 13, font: fontB, color: rgb(1, 1, 1),
  })
  // Gold accent stripe
  page.drawRectangle({ x: 0, y: H - 53, width: W, height: 3, color: rgb(0.83, 0.63, 0.09) })
  y -= 62

  // ── Title ──────────────────────────────────────────────────────────────────
  text(record.name, M, 18, fontB, [0.06, 0.06, 0.06])
  gap(4)
  text(
    `${EVENT_LABELS[record.event_type] ?? record.event_type}${record.severity ? ` · ${record.severity.toUpperCase()} severity` : ""}`,
    M, 10, fontO, [0.45, 0.45, 0.45]
  )
  gap(14)
  divider()

  // ── Event details ──────────────────────────────────────────────────────────
  field("Technician", `${tech.name}${tech.tech_code ? ` [${tech.tech_code}]` : ""}`)
  field("Event Date",   fmtDate(record.completed_date).split(",").slice(0, 2).join(","))
  field("Event Type",   EVENT_LABELS[record.event_type] ?? record.event_type)
  if (record.severity) field("Severity", record.severity.toUpperCase())
  field("Recorded By",  `${record.initiated_by_name ?? "—"}${record.initiated_by_email ? ` · ${record.initiated_by_email}` : ""}`)
  gap(4)
  divider()

  // ── Narrative ──────────────────────────────────────────────────────────────
  if (record.description) {
    text("WHAT HAPPENED / DESCRIPTION", M, 8, font, [0.5, 0.5, 0.5])
    gap(4)
    text(record.description, M, 10, font, [0.15, 0.15, 0.15])
    gap(14)
  }
  if (record.corrective_action) {
    text("CORRECTIVE ACTION / TRAINING DELIVERED", M, 8, font, [0.5, 0.5, 0.5])
    gap(4)
    text(record.corrective_action, M, 10, font, [0.15, 0.15, 0.15])
    gap(14)
  }
  if (record.notes) {
    text("ADDITIONAL NOTES", M, 8, font, [0.5, 0.5, 0.5])
    gap(4)
    text(record.notes, M, 10, font, [0.15, 0.15, 0.15])
    gap(14)
  }
  divider()

  // ── Signature blocks ───────────────────────────────────────────────────────
  // Each block: role label, name (large italic), details, sig ID
  function sigBlock(
    role:      string,
    name:      string | null | undefined,
    email:     string | null | undefined,
    timestamp: string | null | undefined,
    hash:      string | null | undefined,
    accent:    [number, number, number]
  ) {
    if (!name || !timestamp) {
      // Unsigned placeholder
      if (y - 60 < M) { page = doc.addPage([W, H]); y = H - M }
      text(role.toUpperCase(), M, 7.5, font, [0.6, 0.6, 0.6])
      gap(4)
      page.drawLine({ start: { x: M, y: y + 4 }, end: { x: M + 220, y: y + 4 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) })
      gap(6)
      text("Not signed", M, 9, fontO, [0.7, 0.7, 0.7])
      gap(16)
      return
    }
    if (y - 80 < M) { page = doc.addPage([W, H]); y = H - M }
    text(role.toUpperCase(), M, 7.5, font, [accent[0] * 0.7, accent[1] * 0.7, accent[2] * 0.7])
    gap(4)
    // Name in large oblique to simulate handwriting
    text(name, M, 20, fontO, accent)
    gap(2)
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: M + 240, y: y + 4 }, thickness: 0.5, color: rgb(...accent) })
    gap(8)
    text(`${email ?? ""}   ·   ${fmtDate(timestamp)}`, M, 8.5, font, [0.4, 0.4, 0.4])
    gap(4)
    if (hash) {
      text(`SIG-${hash.slice(0, 12).toUpperCase()}`, M, 8, font, [accent[0] * 0.55, accent[1] * 0.55, accent[2] * 0.55])
    }
    gap(16)
  }

  text("SIGNATURES", M, 8, font, [0.5, 0.5, 0.5])
  gap(10)

  sigBlock(
    "Manager — Recorded & Signed",
    record.initiated_by_name,
    record.initiated_by_email,
    record.manager_signed_at,
    record.manager_signature_hash,
    [0.83, 0.63, 0.09]   // gold
  )

  divider(0.88, 0.75, 0.15)

  sigBlock(
    "Technician Acknowledgment",
    record.tech_signed_by_name,
    record.tech_signed_by_email,
    record.acknowledged_at,
    record.tech_signature_hash,
    [0.31, 0.50, 0.63]   // blue
  )

  if (record.witness_name || record.witness_signed_at) {
    divider(0.1, 0.73, 0.51)
    sigBlock(
      "Witness / Second Manager",
      record.witness_name,
      record.witness_email,
      record.witness_signed_at,
      record.witness_signature_hash,
      [0.06, 0.73, 0.51]   // green
    )
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footerY = M - 16
  page.drawText(
    `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · SkyShare MX · Record #${record.id}`,
    { x: M, y: footerY, size: 7.5, font, color: rgb(0.65, 0.65, 0.65) }
  )

  return doc.save()
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" }

  let adHocId: number, technicianId: number
  try {
    const body   = JSON.parse(event.body ?? "{}")
    adHocId      = Number(body.adHocId)
    technicianId = Number(body.technicianId)
    if (!adHocId || !technicianId) throw new Error("Missing adHocId or technicianId")
  } catch (err: any) {
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) }
  }

  try {
    const db = getDb()

    // Fetch record
    const { data: record, error: recErr } = await db
      .from("ad_hoc_completions")
      .select("*")
      .eq("id", adHocId)
      .single()
    if (recErr || !record) throw new Error(recErr?.message ?? "Record not found")

    // Guard: only archive when complete
    if (record.status !== "complete") {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, status: record.status, message: "Not yet ready to archive" }),
      }
    }

    // Fetch technician
    const { data: tech, error: techErr } = await db
      .from("technicians")
      .select("name,tech_code")
      .eq("id", technicianId)
      .single()
    if (techErr || !tech) throw new Error(techErr?.message ?? "Technician not found")

    // Generate PDF
    const pdfBytes = await generatePdf(record as AdHocRecord, tech as TechRecord)

    // Build Drive path: Technicians/{Code}_{Name}/Training/{YYYY}/AdHoc/
    const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
    if (!rootId) throw new Error("Missing GOOGLE_DRIVE_ROOT_FOLDER_ID")

    const token = await getDriveToken()

    const techFolder    = await getOrCreateFolder(token, tech.tech_code ? `${tech.tech_code}_${tech.name}` : tech.name, rootId)
    const trainFolder   = await getOrCreateFolder(token, "Training", techFolder)
    const year          = record.completed_date ? new Date(record.completed_date).getFullYear().toString() : new Date().getFullYear().toString()
    const yearFolder    = await getOrCreateFolder(token, year, trainFolder)
    const adHocFolder   = await getOrCreateFolder(token, "AdHoc", yearFolder)

    const safeTitle = (record.name as string).replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 60)
    const dateStr   = new Date().toISOString().slice(0, 10)
    const fileName  = `${dateStr}-AdHoc-${safeTitle}-#${adHocId}.pdf`

    const driveUrl = await uploadToDrive(token, fileName, pdfBytes, adHocFolder)

    // Mark archived + set drive_url
    const { error: updateErr } = await db
      .from("ad_hoc_completions")
      .update({ drive_url: driveUrl, status: "archived" })
      .eq("id", adHocId)
    if (updateErr) throw new Error(updateErr.message)

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, driveUrl }),
    }
  } catch (err: any) {
    console.error("[adhoc-drive-archive]", err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message ?? "Internal error" }),
    }
  }
}
