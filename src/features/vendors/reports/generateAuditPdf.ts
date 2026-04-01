// ============================================================================
// Vendor Audit Report — PDF Generator
// ============================================================================
// Per-vendor compliance detail: lane statuses, reviews, missing docs, due dates
// Clearly separated 9-or-less and 10-or-more sections per vendor.

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { VendorReportRow, ReviewRow, DocumentRow } from "./data"
import type { LaneFilter } from "./types"
import {
  createDoc, drawHeader, drawFooter, drawSectionHeader,
  drawField, drawStatusBadge, ensureSpace,
  NAVY, GOLD, DARK_GRAY, MED_GRAY, RED, AMBER, GREEN, LIGHT_GRAY,
} from "./pdf-common"

const NINE_STATUS_LABEL: Record<string, string> = {
  not_evaluated: "Not Evaluated",
  usable: "Usable",
  pending_review: "Pending Review",
  restricted: "Restricted",
  not_applicable: "N/A",
}

const TEN_STATUS_LABEL: Record<string, string> = {
  not_evaluated: "Not Evaluated",
  recurring_approved: "Recurring Approved",
  ad_hoc_only: "Ad Hoc Only",
  pending_review: "Pending Review",
  expired: "Expired",
  restricted: "Restricted",
  inactive: "Inactive",
}

const OP_STATUS_LABEL: Record<string, string> = {
  discovered: "Discovered",
  pending: "Pending",
  approved: "Approved",
  restricted: "Restricted",
  inactive: "Inactive",
  archived: "Archived",
}

function statusColor(status: string): string {
  if (["usable", "recurring_approved", "approved"].includes(status)) return GREEN
  if (["pending_review", "pending", "ad_hoc_only"].includes(status)) return AMBER
  if (["restricted", "expired", "failed"].includes(status)) return RED
  return MED_GRAY
}

function fmtDate(d: string | null): string {
  if (!d) return "—"
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function daysUntil(d: string | null): number | null {
  if (!d) return null
  return Math.ceil((new Date(d + "T00:00:00").getTime() - Date.now()) / 86400000)
}

export function generateAuditPdf(
  vendors: VendorReportRow[],
  reviews: ReviewRow[],
  documents: DocumentRow[],
  laneFilter: LaneFilter,
  generatedBy: string,
): jsPDF {
  const doc = createDoc()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40

  const filterLabel = laneFilter === "nine" ? "9-or-Less Lane Only"
    : laneFilter === "ten" ? "10-or-More Lane Only"
    : "All Lanes"

  let y = drawHeader(doc, {
    title: "Vendor Audit Report",
    subtitle: `${vendors.length} vendors · ${filterLabel}`,
    dateLabel: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    pageWidth,
  })

  // Executive summary
  y = ensureSpace(doc, y, 60, pageHeight)
  y = drawSectionHeader(doc, "EXECUTIVE SUMMARY", y, pageWidth)

  const approved = vendors.filter(v => v.operational_status === "approved").length
  const pending = vendors.filter(v => v.operational_status === "pending" || v.operational_status === "discovered").length
  const restricted = vendors.filter(v => v.operational_status === "restricted").length
  const totalExpiredDocs = vendors.reduce((s, v) => s + v.expired_doc_count, 0)
  const totalFailedReviews = vendors.reduce((s, v) => s + v.failed_review_count, 0)

  const overdueNine = vendors.filter(v => {
    const d = daysUntil(v.nine_next_review_due)
    return d !== null && d <= 0
  }).length
  const overdueTen = vendors.filter(v => {
    const d = daysUntil(v.ten_next_audit_due)
    return d !== null && d <= 0
  }).length

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(DARK_GRAY)

  const summaryLines = [
    `Total Vendors: ${vendors.length}   |   Approved: ${approved}   |   Pending/Discovered: ${pending}   |   Restricted: ${restricted}`,
    `Expired Documents: ${totalExpiredDocs}   |   Failed Reviews: ${totalFailedReviews}   |   Overdue 9-or-Less Reviews: ${overdueNine}   |   Overdue 10-or-More Audits: ${overdueTen}`,
  ]
  summaryLines.forEach(line => {
    doc.text(line, margin, y)
    y += 12
  })

  if (totalExpiredDocs > 0 || totalFailedReviews > 0 || overdueNine > 0 || overdueTen > 0) {
    y += 2
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(RED)
    doc.text("ACTION REQUIRED — See individual vendor sections below for details.", margin, y)
    y += 16
  } else {
    y += 8
  }

  // Per-vendor detail
  for (let vi = 0; vi < vendors.length; vi++) {
    const v = vendors[vi]
    const vReviews = reviews.filter(r => r.vendor_id === v.id)
    const vDocs = documents.filter(d => d.vendor_id === v.id)

    // Estimate space needed: ~200 for a vendor block
    y = ensureSpace(doc, y, 200, pageHeight)

    // Vendor name header
    doc.setFillColor(242, 242, 242)
    doc.rect(margin, y, pageWidth - margin * 2, 20, "F")
    doc.setDrawColor(GOLD)
    doc.setLineWidth(2)
    doc.line(margin, y, margin, y + 20)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(NAVY)
    doc.text(`${vi + 1}. ${v.name}`, margin + 10, y + 13)

    // Op status badge
    const opLabel = OP_STATUS_LABEL[v.operational_status] ?? v.operational_status
    drawStatusBadge(doc, opLabel.toUpperCase(), statusColor(v.operational_status), pageWidth - margin - 80, y + 13)
    y += 28

    // Basic info
    const location = [v.airport_code, v.city, v.state].filter(Boolean).join(", ")
    y = drawField(doc, "Location", location || "—", margin, y)
    y = drawField(doc, "Type", v.vendor_type, margin, y)
    if (v.primary_contact_name) {
      y = drawField(doc, "Primary Contact", `${v.primary_contact_name}${v.primary_contact_phone ? " · " + v.primary_contact_phone : ""}`, margin, y)
    }
    y += 4

    // ── 9-or-Less Lane ──
    if (laneFilter !== "ten") {
      y = ensureSpace(doc, y, 80, pageHeight)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(GOLD)
      doc.text("9-OR-LESS LANE", margin + 4, y)

      if (v.lane_nine_status) {
        const nLabel = NINE_STATUS_LABEL[v.lane_nine_status] ?? v.lane_nine_status
        drawStatusBadge(doc, nLabel, statusColor(v.lane_nine_status), margin + 110, y)
      } else {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(8)
        doc.setTextColor(MED_GRAY)
        doc.text("Not evaluated", margin + 110, y)
      }
      y += 14

      if (v.lane_nine_status) {
        y = drawField(doc, "AP Certificate", v.nine_ap_verified ? `Verified${v.nine_ap_number ? " (#" + v.nine_ap_number + ")" : ""}` : "Not Verified", margin + 8, y)
        y = drawField(doc, "Last Review", fmtDate(v.nine_last_review), margin + 8, y)
        const nDays = daysUntil(v.nine_next_review_due)
        let dueText = fmtDate(v.nine_next_review_due)
        if (nDays !== null && nDays <= 0) dueText += "  *** OVERDUE ***"
        else if (nDays !== null && nDays <= 30) dueText += `  (${nDays} days)`
        y = drawField(doc, "Next Review Due", dueText, margin + 8, y)
        if (v.nine_capability_scope) y = drawField(doc, "Capability Scope", v.nine_capability_scope, margin + 8, y)
        if (v.nine_warnings.length > 0) {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(8)
          doc.setTextColor(RED)
          doc.text("Warnings: " + v.nine_warnings.join("; "), margin + 8, y)
          y += 13
        }
      }
      y += 4
    }

    // ── 10-or-More Lane ──
    if (laneFilter !== "nine") {
      y = ensureSpace(doc, y, 100, pageHeight)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(GOLD)
      doc.text("10-OR-MORE LANE", margin + 4, y)

      if (v.lane_ten_status) {
        const tLabel = TEN_STATUS_LABEL[v.lane_ten_status] ?? v.lane_ten_status
        drawStatusBadge(doc, tLabel, statusColor(v.lane_ten_status), margin + 110, y)
      } else {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(8)
        doc.setTextColor(MED_GRAY)
        doc.text("Not evaluated", margin + 110, y)
      }
      y += 14

      if (v.lane_ten_status) {
        y = drawField(doc, "CRS Number", v.ten_crs_number || "—", margin + 8, y)
        y = drawField(doc, "Drug Abatement", v.ten_drug_abatement ? "Verified" : "NOT VERIFIED", margin + 8, y)
        y = drawField(doc, "Insurance", v.ten_insurance ? "Verified" : "NOT VERIFIED", margin + 8, y)
        y = drawField(doc, "GMM Form", v.ten_gmm_complete ? "Complete" : "INCOMPLETE", margin + 8, y)
        if (v.ten_isbao_rating) y = drawField(doc, "IS-BAO Rating", v.ten_isbao_rating, margin + 8, y)
        if (v.ten_argus_rating) y = drawField(doc, "ARGUS Rating", v.ten_argus_rating, margin + 8, y)

        const aDays = daysUntil(v.ten_next_audit_due)
        let auditText = fmtDate(v.ten_next_audit_due)
        if (aDays !== null && aDays <= 0) auditText += "  *** OVERDUE ***"
        else if (aDays !== null && aDays <= 30) auditText += `  (${aDays} days)`
        y = drawField(doc, "Next Audit Due", auditText, margin + 8, y)

        const oDays = daysUntil(v.ten_next_oversight_due)
        let osText = fmtDate(v.ten_next_oversight_due)
        if (oDays !== null && oDays <= 0) osText += "  *** OVERDUE ***"
        else if (oDays !== null && oDays <= 30) osText += `  (${oDays} days)`
        y = drawField(doc, "Next Oversight Due", osText, margin + 8, y)

        if (v.ten_warnings.length > 0) {
          doc.setFont("helvetica", "bold")
          doc.setFontSize(8)
          doc.setTextColor(RED)
          doc.text("Warnings: " + v.ten_warnings.join("; "), margin + 8, y)
          y += 13
        }
      }
      y += 4
    }

    // Document summary
    if (v.doc_count > 0) {
      y = ensureSpace(doc, y, 30, pageHeight)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(DARK_GRAY)
      let docLine = `Documents: ${v.doc_count} on file`
      if (v.expired_doc_count > 0) docLine += `  |  ${v.expired_doc_count} EXPIRED`
      if (v.unverified_doc_count > 0) docLine += `  |  ${v.unverified_doc_count} unverified`
      doc.text(docLine, margin + 4, y)
      y += 14
    }

    // Review summary
    if (vReviews.length > 0) {
      y = ensureSpace(doc, y, 14 + vReviews.length * 10, pageHeight)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(8)
      doc.setTextColor(DARK_GRAY)
      doc.text(`Reviews/Audits: ${vReviews.length} on record`, margin + 4, y)
      y += 12

      vReviews.slice(0, 5).forEach(r => {
        const laneLabel = r.lane === "nine" ? "9≤" : "10+"
        const outcomeLabel = r.outcome ? r.outcome.charAt(0).toUpperCase() + r.outcome.slice(1) : "—"
        doc.setFont("helvetica", "normal")
        doc.setFontSize(7)
        doc.setTextColor(MED_GRAY)
        doc.text(
          `  ${fmtDate(r.review_date)}  [${laneLabel}]  ${r.review_type.replace(/_/g, " ")}  →  ${outcomeLabel}`,
          margin + 8, y,
        )
        y += 10
      })
      if (vReviews.length > 5) {
        doc.setFont("helvetica", "italic")
        doc.text(`  … and ${vReviews.length - 5} more`, margin + 8, y)
        y += 10
      }
    }

    // Separator between vendors
    y += 6
    doc.setDrawColor(LIGHT_GRAY)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 12
  }

  // Apply footers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawFooter(doc, { pageNum: i, totalPages, pageWidth, pageHeight, generatedBy })
  }

  return doc
}
