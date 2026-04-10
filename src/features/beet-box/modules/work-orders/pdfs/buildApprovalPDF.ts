// ============================================================================
// Quote / Change Order Approval PDF Builder
// ============================================================================
// Pure jsPDF so the same builder runs in the browser (for internal preview)
// and in Netlify Node functions (for server-side rendering at send + submit).
// No html2canvas, no DOM access.
//
// One function, variant behavior via `kind` and `signed` flags:
//   - kind='quote'         → "Quote Approval" header, Q-YY-NNNN
//   - kind='change_order'  → "Change Order Approval" header, CO-YY-NNNN,
//                            plus per-item AIRWORTHY/RECOMMENDATION badges
//                            and source-inspection label
//   - signed=false → unsigned outbound PDF with a "Respond at" footer
//   - signed=true  → signed variant with embedded signature PNG + SIG-ID +
//                    per-item ✓/✗ marks
// ============================================================================

import jsPDFImport from "jspdf"
import autoTableImport from "jspdf-autotable"

// jspdf + jspdf-autotable ship differing default-export shapes under ESM vs
// CJS. Netlify's Node bundler resolves the CJS builds, which wrap the real
// export in a { default } interop object. Normalize both so the same call
// sites work in the browser and the Netlify Node runtime.
const jsPDF: typeof jsPDFImport =
  typeof jsPDFImport === "function"
    ? jsPDFImport
    : ((jsPDFImport as unknown as { default: typeof jsPDFImport }).default ?? jsPDFImport)

const autoTable: typeof autoTableImport =
  typeof autoTableImport === "function"
    ? autoTableImport
    : ((autoTableImport as unknown as { default: typeof autoTableImport }).default ?? autoTableImport)

// ── Tokens (mirrors src/shared/styles/index.css) ───────────────────────────

const GOLD       = "#d4a017"
const NAVY       = "#012e45"
const CRIMSON    = "#8b1a1a"
const RED        = "#c10230"
const GREEN      = "#10b981"
const DARK_GRAY  = "#374151"
const MED_GRAY   = "#6b7280"
const LIGHT_GRAY = "#e5e7eb"
const CREAM      = "#f5f3ee"

// Letter portrait in points
const PW = 612
const PH = 792
const M  = 48
const CW = PW - 2 * M

// ── Types ──────────────────────────────────────────────────────────────────

export interface ApprovalPdfItem {
  itemNumber:          number
  category:            string
  discrepancy:         string
  correctiveAction:    string
  /** CO items only — airworthy or recommendation badge */
  discrepancyType?:    "airworthy" | "recommendation" | null
  /** CO items only — title of the source inspection item that uncovered this */
  sourceInspection?:   string | null
  estimatedHours:      number
  laborRate:           number
  partsTotal:          number
  shippingCost:        number
  outsideServicesCost: number
  lineTotal:           number
  /** On signed PDFs, reflects the customer's per-item choice */
  customerDecision?:   "pending" | "approved" | "declined"
}

export interface ApprovalPdfSignature {
  signerName:    string
  signerEmail:   string
  signerTitle?:  string
  signedAt:      string    // ISO
  hash:          string    // full SHA-256 hex
  /** PNG data URL of the drawn canvas (data:image/png;base64,...) */
  imageDataUrl:  string
}

export interface BuildApprovalPdfOptions {
  kind:                   "quote" | "change_order"
  signed:                 boolean
  documentNumber:         string          // "Q-26-0001" or "CO-26-0003"
  parentWoNumber?:        string          // shown on change_order only
  aircraftRegistration:   string
  aircraftSerial?:        string
  description?:           string
  recipientName:          string
  recipientEmail:         string
  items:                  ApprovalPdfItem[]
  /** Optional explicit total override; otherwise derived from items */
  total?:                 number
  /** Full URL the recipient can visit to respond. Unsigned outbound only. */
  approvalUrl?:           string
  signature?:             ApprovalPdfSignature
  /** Footer brand line, defaults to "SkyShare MX — Maintenance Portal" */
  brandFooter?:           string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function sumItems(items: ApprovalPdfItem[]): number {
  return items.reduce((acc, it) => acc + (it.lineTotal || 0), 0)
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
  return `${date} · ${time}`
}

// ── Main builder ───────────────────────────────────────────────────────────

export function buildApprovalPdf(opts: BuildApprovalPdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" })

  const isCO  = opts.kind === "change_order"
  const title = isCO ? "Change Order Approval" : "Quote Approval"
  const total = opts.total ?? sumItems(opts.items)

  // ── Header ──────────────────────────────────────────────────────────────
  // Gold top rule
  doc.setDrawColor(GOLD)
  doc.setLineWidth(3)
  doc.line(M, 54, PW - M, 54)

  // Brand wordmark
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(GOLD)
  doc.text("SKYSHARE MX", M, 76)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(MED_GRAY)
  doc.text("MAINTENANCE PORTAL", M, 88)

  // Document number (right-aligned)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(NAVY)
  doc.text(opts.documentNumber, PW - M, 76, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(MED_GRAY)
  const issuedLine = isCO && opts.parentWoNumber
    ? `CHANGE ORDER · PARENT WO ${opts.parentWoNumber}`
    : "QUOTE"
  doc.text(issuedLine, PW - M, 88, { align: "right" })

  // Title block
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(NAVY)
  doc.text(title.toUpperCase(), M, 130)

  // Gold title underline
  doc.setDrawColor(GOLD)
  doc.setLineWidth(1)
  doc.line(M, 138, M + 56, 138)

  // ── Meta block (aircraft / recipient / total) ───────────────────────────
  let y = 168

  const metaLabel = (label: string, value: string, x: number, yy: number, w: number) => {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(GOLD)
    doc.text(label.toUpperCase(), x, yy)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(DARK_GRAY)
    doc.text(doc.splitTextToSize(value || "—", w) as string[], x, yy + 13)
  }

  const colW = (CW - 24) / 3
  metaLabel("Aircraft", `${opts.aircraftRegistration}${opts.aircraftSerial ? ` · ${opts.aircraftSerial}` : ""}`, M, y, colW)
  metaLabel("Prepared For", `${opts.recipientName}\n${opts.recipientEmail}`, M + colW + 12, y, colW)
  metaLabel("Grand Total", currency(total), M + 2 * (colW + 12), y, colW)

  y += 56
  if (opts.description) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(DARK_GRAY)
    const descLines = doc.splitTextToSize(opts.description, CW) as string[]
    doc.text(descLines, M, y)
    y += descLines.length * 12 + 10
  }

  // Crimson→Navy stripe divider
  const stripeY = y + 4
  doc.setDrawColor(CRIMSON)
  doc.setLineWidth(2)
  doc.line(M, stripeY, M + CW / 2, stripeY)
  doc.setDrawColor(NAVY)
  doc.line(M + CW / 2, stripeY, PW - M, stripeY)
  y = stripeY + 18

  // ── Items table ─────────────────────────────────────────────────────────
  // Columns: # | Description | Hrs × Rate | Parts | Total | (Decision — signed only)
  const showDecisionCol = opts.signed
  const head: string[][] = [[
    "#",
    "Description",
    "Hours",
    "Parts",
    "Total",
    ...(showDecisionCol ? ["Status"] : []),
  ]]

  const body = opts.items.map(it => {
    const laborStr = `${it.estimatedHours.toFixed(1)} × ${currency(it.laborRate)}`
    const partsStr = currency(it.partsTotal + it.shippingCost + it.outsideServicesCost)

    // Description cell: category, optional badge, discrepancy, corrective action, source inspection
    const descLines: string[] = []
    descLines.push(it.category)
    if (isCO && it.discrepancyType) {
      descLines.push(
        it.discrepancyType === "airworthy" ? "[AIRWORTHY]" : "[RECOMMENDATION]"
      )
    }
    descLines.push(it.discrepancy || "—")
    if (it.correctiveAction) descLines.push(`Action: ${it.correctiveAction}`)
    if (isCO && it.sourceInspection) descLines.push(`From: ${it.sourceInspection}`)

    let decisionCell = ""
    if (showDecisionCol) {
      decisionCell =
        it.customerDecision === "approved" ? "APPROVED"
        : it.customerDecision === "declined" ? "DECLINED"
        : "PENDING"
    }

    return [
      String(it.itemNumber),
      descLines.join("\n"),
      laborStr,
      partsStr,
      currency(it.lineTotal),
      ...(showDecisionCol ? [decisionCell] : []),
    ]
  })

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: M, right: M },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      textColor: DARK_GRAY,
      lineColor: LIGHT_GRAY,
      lineWidth: 0.5,
      valign: "top",
    },
    headStyles: {
      fillColor: NAVY,
      textColor: "#ffffff",
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 72,  halign: "right" },
      3: { cellWidth: 64,  halign: "right" },
      4: { cellWidth: 72,  halign: "right", fontStyle: "bold" },
      ...(showDecisionCol ? { 5: { cellWidth: 62, halign: "center", fontStyle: "bold" } } : {}),
    },
    didParseCell: (data) => {
      // Color the decision cell when signed
      if (showDecisionCol && data.section === "body" && data.column.index === 5) {
        const v = String(data.cell.raw || "")
        if (v === "APPROVED") data.cell.styles.textColor = GREEN
        else if (v === "DECLINED") data.cell.styles.textColor = RED
        else data.cell.styles.textColor = MED_GRAY
      }
    },
  })

  // @ts-expect-error autotable augments doc
  let afterTableY: number = doc.lastAutoTable.finalY + 18

  // ── Totals block ────────────────────────────────────────────────────────
  const labelX = PW - M - 170
  const valueX = PW - M

  const drawTotalLine = (label: string, value: string, bold = false, color = DARK_GRAY) => {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(bold ? 11 : 9)
    doc.setTextColor(color)
    doc.text(label, labelX, afterTableY)
    doc.text(value, valueX, afterTableY, { align: "right" })
    afterTableY += bold ? 18 : 14
  }

  if (opts.signed) {
    const approved = opts.items.filter(i => i.customerDecision === "approved").reduce((a, i) => a + i.lineTotal, 0)
    const declined = opts.items.filter(i => i.customerDecision === "declined").reduce((a, i) => a + i.lineTotal, 0)
    drawTotalLine("Approved", currency(approved), false, GREEN)
    drawTotalLine("Declined", currency(declined), false, RED)
    afterTableY += 2
    drawTotalLine("Approved Total", currency(approved), true, NAVY)
  } else {
    drawTotalLine("Grand Total", currency(total), true, NAVY)
  }

  afterTableY += 12

  // ── Signature block (signed variant only) ──────────────────────────────
  if (opts.signed && opts.signature) {
    // Leave room; push to new page if too close to the bottom
    if (afterTableY > PH - 220) {
      doc.addPage()
      afterTableY = 80
    }

    const sig = opts.signature
    const boxTop = afterTableY

    doc.setDrawColor(GOLD)
    doc.setLineWidth(0.5)
    doc.roundedRect(M, boxTop, CW, 160, 4, 4)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(GOLD)
    doc.text("CUSTOMER SIGNATURE", M + 14, boxTop + 18)

    // Signature image — fit within ~220 × 72
    try {
      doc.addImage(sig.imageDataUrl, "PNG", M + 14, boxTop + 24, 220, 72)
    } catch {
      // If the data URL is malformed, fall back to a placeholder line
      doc.setDrawColor(MED_GRAY)
      doc.setLineWidth(0.5)
      doc.line(M + 14, boxTop + 94, M + 234, boxTop + 94)
    }

    // Signer details — right side
    const rX = M + 260
    let rY = boxTop + 32
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(NAVY)
    doc.text(sig.signerName, rX, rY); rY += 14
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(DARK_GRAY)
    doc.text(sig.signerEmail, rX, rY); rY += 12
    if (sig.signerTitle) { doc.text(sig.signerTitle, rX, rY); rY += 12 }
    doc.setTextColor(MED_GRAY)
    doc.text(formatTimestamp(sig.signedAt), rX, rY); rY += 14

    // SIG-ID
    doc.setFont("courier", "normal")
    doc.setFontSize(8)
    doc.setTextColor(GOLD)
    doc.text(`SIG-${sig.hash.slice(0, 12).toUpperCase()}`, rX, rY)
  }

  // ── Footer on every page ────────────────────────────────────────────────
  const brand = opts.brandFooter ?? "SkyShare MX — Maintenance Portal"
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(LIGHT_GRAY)
    doc.setLineWidth(0.5)
    doc.line(M, PH - 44, PW - M, PH - 44)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(MED_GRAY)
    doc.text(brand, M, PH - 28)
    doc.text(`Page ${i} of ${pageCount}`, PW - M, PH - 28, { align: "right" })

    // Unsigned outbound copies print the approval URL so recipients with a
    // paper copy know where to respond.
    if (!opts.signed && opts.approvalUrl && i === pageCount) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(GOLD)
      doc.text(`Respond at: ${opts.approvalUrl}`, PW / 2, PH - 28, { align: "center" })
    }
  }

  return doc
}
