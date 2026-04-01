// ============================================================================
// Periodic Compliance Report — PDF Generator
// ============================================================================
// Formal time-bounded summary for FAA / audit retention.
// Clearly separates 9-or-less and 10-or-more lanes with independent summaries.

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { VendorReportRow, ReviewRow, DocumentRow } from "./data"
import type { LaneFilter } from "./types"
import {
  createDoc, drawHeader, drawFooter, drawSectionHeader, ensureSpace,
  NAVY, GOLD, DARK_GRAY, MED_GRAY, RED, AMBER, GREEN, LIGHT_GRAY,
} from "./pdf-common"

function fmtDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function daysUntil(d: string | null): number | null {
  if (!d) return null
  return Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000)
}

export function generateCompliancePdf(
  vendors: VendorReportRow[],
  reviews: ReviewRow[],
  documents: DocumentRow[],
  laneFilter: LaneFilter,
  dateStart: string | null,
  dateEnd: string | null,
  generatedBy: string,
): jsPDF {
  const doc = createDoc()
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const m = 40

  const periodLabel = dateStart && dateEnd
    ? `${fmtDate(dateStart)} — ${fmtDate(dateEnd)}`
    : dateStart ? `From ${fmtDate(dateStart)}`
    : dateEnd ? `Through ${fmtDate(dateEnd)}`
    : "All Time"

  let y = drawHeader(doc, {
    title: "Vendor Compliance Report",
    subtitle: `Reporting Period: ${periodLabel}`,
    dateLabel: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    pageWidth: pw,
  })

  // ── PROGRAM OVERVIEW ────────────────────────────────────────────────────

  y = drawSectionHeader(doc, "PROGRAM OVERVIEW", y, pw)

  const approved = vendors.filter(v => v.operational_status === "approved").length
  const pending = vendors.filter(v => v.operational_status === "pending" || v.operational_status === "discovered").length
  const restricted = vendors.filter(v => v.operational_status === "restricted").length
  const inactive = vendors.filter(v => v.operational_status === "inactive").length

  const totalDocs = vendors.reduce((s, v) => s + v.doc_count, 0)
  const expiredDocs = vendors.reduce((s, v) => s + v.expired_doc_count, 0)
  const failedReviewCount = vendors.reduce((s, v) => s + v.failed_review_count, 0)

  // Overview table
  autoTable(doc, {
    startY: y,
    margin: { left: m, right: m },
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 3, textColor: DARK_GRAY },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    head: [["Metric", "Count", "Notes"]],
    body: [
      ["Total Active Vendors", String(vendors.length), ""],
      ["Approved", String(approved), approved === vendors.length ? "All vendors approved" : ""],
      ["Pending / Discovered", String(pending), pending > 0 ? "Require evaluation" : ""],
      ["Restricted", String(restricted), restricted > 0 ? "Usage limited — see details" : ""],
      ["Inactive", String(inactive), ""],
      ["Total Documents on File", String(totalDocs), ""],
      ["Expired Documents", String(expiredDocs), expiredDocs > 0 ? "ACTION REQUIRED" : "None"],
      ["Failed Reviews (all time)", String(failedReviewCount), failedReviewCount > 0 ? "See review details" : "None"],
      ["Reviews This Period", String(reviews.length), ""],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 160 },
      1: { cellWidth: 60, halign: "center" },
    },
    didParseCell(data) {
      if (data.column.index === 2 && typeof data.cell.raw === "string" && data.cell.raw.includes("ACTION")) {
        data.cell.styles.textColor = RED
        data.cell.styles.fontStyle = "bold"
      }
    },
  })
  y = (doc as any).lastAutoTable.finalY + 16


  // ── 9-OR-LESS LANE SUMMARY ──────────────────────────────────────────────

  if (laneFilter !== "ten") {
    y = ensureSpace(doc, y, 120, ph)
    y = drawSectionHeader(doc, "9-OR-LESS LANE — TRANSACTIONAL COMPLIANCE", y, pw)

    const nineVendors = vendors.filter(v => v.lane_nine_status != null)
    const nineUsable = nineVendors.filter(v => v.lane_nine_status === "usable").length
    const ninePending = nineVendors.filter(v => v.lane_nine_status === "pending_review").length
    const nineRestricted = nineVendors.filter(v => v.lane_nine_status === "restricted").length
    const nineApVerified = nineVendors.filter(v => v.nine_ap_verified).length
    const nineOverdue = nineVendors.filter(v => {
      const d = daysUntil(v.nine_next_review_due)
      return d !== null && d <= 0
    }).length
    const nineDueSoon = nineVendors.filter(v => {
      const d = daysUntil(v.nine_next_review_due)
      return d !== null && d > 0 && d <= 30
    }).length

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(DARK_GRAY)
    doc.text(`${nineVendors.length} vendors evaluated in the 9-or-less lane.`, m, y)
    y += 14

    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 3, textColor: DARK_GRAY },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      head: [["Status", "Count"]],
      body: [
        ["Usable", String(nineUsable)],
        ["Pending Review", String(ninePending)],
        ["Restricted", String(nineRestricted)],
        ["AP Certificates Verified", `${nineApVerified} of ${nineVendors.length}`],
        ["Reviews Overdue", String(nineOverdue)],
        ["Reviews Due Within 30 Days", String(nineDueSoon)],
      ],
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 200 }, 1: { cellWidth: 80, halign: "center" } },
      didParseCell(data) {
        if (data.column.index === 1 && data.row.index >= 4) {
          const val = parseInt(data.cell.raw as string)
          if (val > 0) {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = "bold"
          }
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    // Vendor roster for 9-or-less
    if (nineVendors.length > 0) {
      y = ensureSpace(doc, y, 40, ph)

      autoTable(doc, {
        startY: y,
        margin: { left: m, right: m },
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2.5, textColor: DARK_GRAY, lineColor: LIGHT_GRAY, lineWidth: 0.5 },
        headStyles: { fillColor: [212, 160, 23], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        head: [["Vendor", "Status", "AP Cert", "Last Review", "Next Due", "Warnings"]],
        body: nineVendors.map(v => {
          const dueDays = daysUntil(v.nine_next_review_due)
          let dueLabel = fmtDate(v.nine_next_review_due)
          if (dueDays !== null && dueDays <= 0) dueLabel += " OVERDUE"
          return [
            v.name,
            v.lane_nine_status?.replace(/_/g, " ") ?? "—",
            v.nine_ap_verified ? "Yes" : "No",
            fmtDate(v.nine_last_review),
            dueLabel,
            v.nine_warnings.length > 0 ? v.nine_warnings.join("; ") : "—",
          ]
        }),
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 120 },
          5: { cellWidth: 110 },
        },
        didParseCell(data) {
          if (data.column.index === 4 && typeof data.cell.raw === "string" && data.cell.raw.includes("OVERDUE")) {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = "bold"
          }
          if (data.column.index === 2 && data.cell.raw === "No" && data.section === "body") {
            data.cell.styles.textColor = AMBER
          }
        },
      })
      y = (doc as any).lastAutoTable.finalY + 16
    }
  }

  // ── 10-OR-MORE LANE SUMMARY ─────────────────────────────────────────────

  if (laneFilter !== "nine") {
    y = ensureSpace(doc, y, 120, ph)
    y = drawSectionHeader(doc, "10-OR-MORE LANE — PROVIDER GOVERNANCE", y, pw)

    const tenVendors = vendors.filter(v => v.lane_ten_status != null)
    const tenRecurring = tenVendors.filter(v => v.lane_ten_status === "recurring_approved").length
    const tenAdHoc = tenVendors.filter(v => v.lane_ten_status === "ad_hoc_only").length
    const tenPending = tenVendors.filter(v => v.lane_ten_status === "pending_review").length
    const tenExpired = tenVendors.filter(v => v.lane_ten_status === "expired").length
    const tenRestricted = tenVendors.filter(v => v.lane_ten_status === "restricted").length
    const tenDrugVerified = tenVendors.filter(v => v.ten_drug_abatement).length
    const tenInsVerified = tenVendors.filter(v => v.ten_insurance).length
    const tenGmmDone = tenVendors.filter(v => v.ten_gmm_complete).length
    const tenAuditOverdue = tenVendors.filter(v => {
      const d = daysUntil(v.ten_next_audit_due)
      return d !== null && d <= 0
    }).length

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(DARK_GRAY)
    doc.text(`${tenVendors.length} vendors evaluated in the 10-or-more lane.`, m, y)
    y += 14

    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 3, textColor: DARK_GRAY },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      head: [["Status / Metric", "Count"]],
      body: [
        ["Recurring Approved", String(tenRecurring)],
        ["Ad Hoc Only", String(tenAdHoc)],
        ["Pending Review", String(tenPending)],
        ["Expired", String(tenExpired)],
        ["Restricted", String(tenRestricted)],
        ["Drug Abatement Verified", `${tenDrugVerified} of ${tenVendors.length}`],
        ["Insurance Verified", `${tenInsVerified} of ${tenVendors.length}`],
        ["GMM Form Complete", `${tenGmmDone} of ${tenVendors.length}`],
        ["Audits Overdue", String(tenAuditOverdue)],
      ],
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 200 }, 1: { cellWidth: 80, halign: "center" } },
      didParseCell(data) {
        if (data.column.index === 1 && (data.row.index === 3 || data.row.index === 4 || data.row.index === 8)) {
          const val = parseInt(data.cell.raw as string)
          if (val > 0) {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = "bold"
          }
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 10

    // Vendor roster for 10-or-more
    if (tenVendors.length > 0) {
      y = ensureSpace(doc, y, 40, ph)

      autoTable(doc, {
        startY: y,
        margin: { left: m, right: m },
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2.5, textColor: DARK_GRAY, lineColor: LIGHT_GRAY, lineWidth: 0.5 },
        headStyles: { fillColor: [212, 160, 23], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        head: [["Vendor", "Status", "CRS", "Drug", "Ins.", "GMM", "Next Audit", "Warnings"]],
        body: tenVendors.map(v => {
          const dueDays = daysUntil(v.ten_next_audit_due)
          let dueLabel = fmtDate(v.ten_next_audit_due)
          if (dueDays !== null && dueDays <= 0) dueLabel += " OVERDUE"
          return [
            v.name,
            v.lane_ten_status?.replace(/_/g, " ") ?? "—",
            v.ten_crs_number || "—",
            v.ten_drug_abatement ? "Y" : "N",
            v.ten_insurance ? "Y" : "N",
            v.ten_gmm_complete ? "Y" : "N",
            dueLabel,
            v.ten_warnings.length > 0 ? v.ten_warnings.join("; ") : "—",
          ]
        }),
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 100 },
          3: { cellWidth: 30, halign: "center" },
          4: { cellWidth: 30, halign: "center" },
          5: { cellWidth: 30, halign: "center" },
          7: { cellWidth: 90 },
        },
        didParseCell(data) {
          if (data.column.index === 6 && typeof data.cell.raw === "string" && data.cell.raw.includes("OVERDUE")) {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = "bold"
          }
          if ([3, 4, 5].includes(data.column.index) && data.cell.raw === "N" && data.section === "body") {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = "bold"
          }
        },
      })
      y = (doc as any).lastAutoTable.finalY + 16
    }
  }

  // ── REVIEW ACTIVITY THIS PERIOD ─────────────────────────────────────────

  if (reviews.length > 0) {
    y = ensureSpace(doc, y, 60, ph)
    y = drawSectionHeader(doc, "REVIEW & AUDIT ACTIVITY — THIS PERIOD", y, pw)

    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2.5, textColor: DARK_GRAY, lineColor: LIGHT_GRAY, lineWidth: 0.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      head: [["Date", "Vendor", "Lane", "Type", "Outcome", "Next Due"]],
      body: reviews.map(r => [
        fmtDate(r.review_date),
        r.vendor_name,
        r.lane === "nine" ? "9-or-Less" : "10-or-More",
        r.review_type.replace(/_/g, " "),
        r.outcome ? r.outcome.charAt(0).toUpperCase() + r.outcome.slice(1) : "—",
        fmtDate(r.next_due),
      ]),
      columnStyles: { 0: { cellWidth: 70 }, 1: { fontStyle: "bold", cellWidth: 110 } },
      didParseCell(data) {
        if (data.column.index === 4 && data.cell.raw === "Failed") {
          data.cell.styles.textColor = RED
          data.cell.styles.fontStyle = "bold"
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 16
  }

  // ── DOCUMENT ISSUES ─────────────────────────────────────────────────────

  const expiredDocList = documents.filter(d => d.expires_at && new Date(d.expires_at + "T00:00:00").getTime() < Date.now())
  if (expiredDocList.length > 0) {
    y = ensureSpace(doc, y, 60, ph)
    y = drawSectionHeader(doc, "EXPIRED DOCUMENTS — ACTION REQUIRED", y, pw)

    autoTable(doc, {
      startY: y,
      margin: { left: m, right: m },
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 2.5, textColor: DARK_GRAY, lineColor: LIGHT_GRAY, lineWidth: 0.5 },
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      head: [["Vendor", "Document", "Type", "Lane", "Expired"]],
      body: expiredDocList.map(d => [
        d.vendor_name,
        d.document_name,
        d.document_type.replace(/_/g, " "),
        d.lane === "nine" ? "9-or-Less" : d.lane === "ten" ? "10-or-More" : "Shared",
        fmtDate(d.expires_at),
      ]),
      columnStyles: { 0: { fontStyle: "bold" } },
    })
    y = (doc as any).lastAutoTable.finalY + 16
  }

  // ── CERTIFICATION BLOCK ─────────────────────────────────────────────────

  y = ensureSpace(doc, y, 100, ph)
  doc.setDrawColor(NAVY)
  doc.setLineWidth(1)
  doc.rect(m, y, pw - m * 2, 80)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(NAVY)
  doc.text("COMPLIANCE CERTIFICATION", m + 12, y + 18)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(DARK_GRAY)
  doc.text(
    "This report represents the compliance status of the SkyShare MX vendor management program as of the",
    m + 12, y + 34,
  )
  doc.text(
    `date shown above. It was generated from live system data on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    m + 12, y + 46,
  )

  doc.setFont("helvetica", "bold")
  doc.text("Prepared by:", m + 12, y + 66)
  doc.setFont("helvetica", "normal")
  doc.text(generatedBy, m + 80, y + 66)
  doc.text("Signature: ____________________________", pw - m - 220, y + 66)

  // Apply footers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(doc, { pageNum: i, totalPages, pageWidth: pw, pageHeight: ph, generatedBy })
  }

  return doc
}
