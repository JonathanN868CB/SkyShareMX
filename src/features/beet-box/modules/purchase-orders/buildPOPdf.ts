// ============================================================================
// Purchase Order PDF Builder
// ============================================================================
// Pure jsPDF (no DOM / html2canvas) — runs in the browser for client-side
// download. Follows the same letterhead pattern as buildApprovalPDF.ts.
// ============================================================================

import jsPDFImport from "jspdf"
import autoTableImport from "jspdf-autotable"

// Normalize ESM/CJS interop (same pattern as buildApprovalPDF)
const jsPDF: typeof jsPDFImport =
  typeof jsPDFImport === "function"
    ? jsPDFImport
    : ((jsPDFImport as unknown as { default: typeof jsPDFImport }).default ?? jsPDFImport)

const autoTable: typeof autoTableImport =
  typeof autoTableImport === "function"
    ? autoTableImport
    : ((autoTableImport as unknown as { default: typeof autoTableImport }).default ?? autoTableImport)

// ── Design tokens ──────────────────────────────────────────────────────────

const GOLD       = "#d4a017"
const NAVY       = "#012e45"
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

export interface POPdfLine {
  lineNumber: number
  partNumber: string
  description: string
  woRef?: string | null
  qtyOrdered: number
  unitCost: number
}

export interface BuildPOPdfOptions {
  poNumber:         string
  vendorName:       string
  vendorContact?:   string | null
  expectedDelivery?: string | null   // ISO date string
  createdAt:        string           // ISO datetime
  notes?:           string | null
  lines:            POPdfLine[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function fmtDateShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ── Main builder ───────────────────────────────────────────────────────────

export function buildPOPdf(opts: BuildPOPdfOptions): typeof jsPDF.prototype {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" })
  const total = opts.lines.reduce((sum, l) => sum + l.qtyOrdered * l.unitCost, 0)

  // ── Header ────────────────────────────────────────────────────────────────

  // Gold top rule
  doc.setDrawColor(GOLD)
  doc.setLineWidth(3)
  doc.line(M, 54, PW - M, 54)

  // Brand wordmark (left)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(GOLD)
  doc.text("SKYSHARE MX", M, 76)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(MED_GRAY)
  doc.text("MAINTENANCE PORTAL", M, 88)

  // PO number (right)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(NAVY)
  doc.text(opts.poNumber, PW - M, 76, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(MED_GRAY)
  doc.text("PURCHASE ORDER", PW - M, 88, { align: "right" })

  // Title block
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(NAVY)
  doc.text("PURCHASE ORDER", M, 130)

  // Gold underline
  doc.setDrawColor(GOLD)
  doc.setLineWidth(1)
  doc.line(M, 138, M + 56, 138)

  // ── Meta block ────────────────────────────────────────────────────────────

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
  let y = 168
  metaLabel("Vendor", opts.vendorName + (opts.vendorContact ? `\n${opts.vendorContact}` : ""), M, y, colW)
  metaLabel("Expected Delivery", opts.expectedDelivery ? fmtDateShort(opts.expectedDelivery) : "—", M + colW + 12, y, colW)
  metaLabel("PO Total", currency(total), M + 2 * (colW + 12), y, colW)

  y += 48

  // Issued date row
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(GOLD)
  doc.text("ISSUED", M, y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(DARK_GRAY)
  doc.text(fmtDate(opts.createdAt), M, y + 12)

  y += 32

  // Crimson→Navy stripe divider
  doc.setDrawColor(NAVY)
  doc.setFillColor(NAVY)
  doc.rect(M, y, CW, 2, "F")
  y += 14

  // ── Line items table ──────────────────────────────────────────────────────

  const tableBody = opts.lines.map(l => [
    String(l.lineNumber),
    l.partNumber,
    l.description || "—",
    l.woRef || "—",
    String(l.qtyOrdered),
    currency(l.unitCost),
    currency(l.qtyOrdered * l.unitCost),
  ])

  autoTable(doc, {
    startY: y,
    head: [["#", "Part Number", "Description", "WO Ref", "Qty", "Unit Cost", "Extended"]],
    body: tableBody,
    margin: { left: M, right: M },
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 5,
      textColor: DARK_GRAY,
      lineColor: LIGHT_GRAY,
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: NAVY,
      textColor: "#ffffff",
      fontSize: 7,
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: CREAM,
    },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: 90, fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 55 },
      4: { cellWidth: 30, halign: "center" },
      5: { cellWidth: 65, halign: "right" },
      6: { cellWidth: 70, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: (data) => {
      // Repeat header on continuation pages
      if (data.pageNumber > 1) {
        doc.setDrawColor(GOLD)
        doc.setLineWidth(3)
        doc.line(M, 30, PW - M, 30)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8)
        doc.setTextColor(GOLD)
        doc.text("SKYSHARE MX", M, 46)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(7)
        doc.setTextColor(MED_GRAY)
        doc.text(`${opts.poNumber} — continued`, PW - M, 46, { align: "right" })
      }
    },
  })

  const afterTable = (doc as any).lastAutoTable.finalY as number

  // ── Totals block ──────────────────────────────────────────────────────────

  let ty = afterTable + 12
  const totalsX = PW - M - 180

  doc.setDrawColor(LIGHT_GRAY)
  doc.setLineWidth(0.5)
  doc.line(totalsX, ty, PW - M, ty)
  ty += 14

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(MED_GRAY)
  doc.text("Subtotal", totalsX, ty)
  doc.text(currency(total), PW - M, ty, { align: "right" })
  ty += 13

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(NAVY)
  doc.text("Total", totalsX, ty)
  doc.text(currency(total), PW - M, ty, { align: "right" })
  ty += 6

  doc.setDrawColor(GOLD)
  doc.setLineWidth(1.5)
  doc.line(totalsX, ty, PW - M, ty)
  ty += 16

  // ── Notes ─────────────────────────────────────────────────────────────────

  if (opts.notes?.trim()) {
    // Check if we have room; if not, add a new page
    if (ty + 50 > PH - 80) {
      doc.addPage()
      ty = M
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(GOLD)
    doc.text("ORDER NOTES", M, ty)
    ty += 14

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(DARK_GRAY)
    const noteLines = doc.splitTextToSize(opts.notes.trim(), CW) as string[]
    doc.text(noteLines, M, ty)
  }

  // ── Footer on every page ──────────────────────────────────────────────────

  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)

    // Bottom rule
    doc.setDrawColor(LIGHT_GRAY)
    doc.setLineWidth(0.5)
    doc.line(M, PH - 42, PW - M, PH - 42)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(MED_GRAY)
    doc.text(`SkyShare MX · Maintenance Portal · ${opts.poNumber}`, M, PH - 28)
    doc.text(`Page ${i} of ${totalPages}`, PW - M, PH - 28, { align: "right" })

    // Gold accent dot between brand and PO number
    doc.setTextColor(GOLD)
    doc.text("·", M + doc.getTextWidth(`SkyShare MX  Maintenance Portal  ${opts.poNumber}`) / 2 + 3, PH - 28)
  }

  return doc as any
}
