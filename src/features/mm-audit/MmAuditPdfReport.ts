// ============================================================================
// MM Audit Report — PDF Generator
// ============================================================================
// Landscape Letter, 14-page structure:
//   Cover → Fleet Summary → Type Detail Pages → MEL Page → Attestation
// Client-side generation with jspdf + jspdf-autotable.

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { localToday } from "@/shared/lib/dates"
import type { AircraftDocumentRow, AuditProfileGroup, MmMelTracking, MmCampaignRevisionChange, CampaignSummary } from "./types"

// ── Colors ──────────────────────────────────────────────────────────────────
const NAVY = "#0f172a"
const GOLD = "#d4a017"
const DARK_GRAY = "#374151"
const MED_GRAY = "#6b7280"
const LIGHT_GRAY = "#e5e7eb"
const GREEN = "#16a34a"
const AMBER = "#d97706"
const RED = "#dc2626"
const VIOLET = "#7c3aed"

// ── Page dimensions (landscape letter in pt) ────────────────────────────────
const PW = 792  // page width
const PH = 612  // page height
const M = 40    // margin
const CW = PW - 2 * M  // content width

// ── Exports ─────────────────────────────────────────────────────────────────

export interface PdfReportData {
  campaign: CampaignSummary | null
  profiles: AuditProfileGroup[]
  allRows: AircraftDocumentRow[]
  melRows: MmMelTracking[]
  auditorNames: string[]
  /** Revision changes that were applied (or staged) during this campaign */
  revisionChanges: MmCampaignRevisionChange[]
}

export type PdfExportMode = "full" | "summary" | "single"

export function generateMmAuditPdf(data: PdfReportData, mode: PdfExportMode, singleRegistration?: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" })
  let pageNum = 0

  function newPage() {
    if (pageNum > 0) doc.addPage()
    pageNum++
  }

  function drawPageFooter() {
    const pageStr = `Page ${pageNum}`
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(MED_GRAY)
    doc.text("CB Aviation Inc. — SkyShare MX", M, PH - 20)
    doc.text("GMM §4.2 — Maintenance Manual Revision Audit", PW / 2, PH - 20, { align: "center" })
    doc.text(pageStr, PW - M, PH - 20, { align: "right" })
    // Rule above footer
    doc.setDrawColor(LIGHT_GRAY)
    doc.setLineWidth(0.5)
    doc.line(M, PH - 30, PW - M, PH - 30)
  }

  function drawPageHeader(title: string) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(VIOLET)
    doc.text("MM REVISION & AUDIT TRACKING", M, 30)
    if (data.campaign) {
      doc.setFont("helvetica", "normal")
      doc.setTextColor(MED_GRAY)
      doc.text(`${data.campaign.name} — ${data.campaign.period_start} to ${data.campaign.period_end}`, PW - M, 30, { align: "right" })
    }
    doc.setDrawColor(GOLD)
    doc.setLineWidth(2)
    doc.line(M, 38, PW - M, 38)
  }

  const timestamp = new Date().toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short" })
  const campaignName = data.campaign?.name ?? "Ad-hoc Review"
  const periodStr = data.campaign ? `${data.campaign.period_start} to ${data.campaign.period_end}` : "N/A"

  // ════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ════════════════════════════════════════════════════════════════════════
  newPage()

  // Gold top rule
  doc.setDrawColor(GOLD)
  doc.setLineWidth(4)
  doc.line(M, 60, PW - M, 60)

  // Title
  doc.setFont("helvetica", "bold")
  doc.setFontSize(28)
  doc.setTextColor(NAVY)
  doc.text("Maintenance Manual", M, 110)
  doc.text("Revision & Audit Report", M, 145)

  // Campaign name
  doc.setFontSize(14)
  doc.setTextColor(VIOLET)
  doc.text(campaignName, M, 185)

  // Details
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(DARK_GRAY)
  let cy = 220
  const coverFields = [
    ["Audit Period", periodStr],
    ["Certificate Holder", "CB Aviation Inc. — Part 135"],
    ["Fleet Size", `${data.profiles.reduce((s, p) => s + p.aircraft.length, 0)} aircraft`],
    ["Documents Tracked", `${data.allRows.length} audit items`],
    ["Completion", data.campaign ? `${data.campaign.progress_pct}%` : "N/A"],
    ["Auditor(s)", data.auditorNames.join(", ") || "—"],
    ["Generated", timestamp],
    ["GMM Reference", "§4.2 — Continuous Airworthiness Maintenance Program"],
  ]
  for (const [label, value] of coverFields) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(MED_GRAY)
    doc.text(label, M, cy)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(DARK_GRAY)
    doc.text(value, M + 130, cy)
    cy += 18
  }

  // Bottom gold rule
  doc.setDrawColor(GOLD)
  doc.setLineWidth(2)
  doc.line(M, PH - 60, PW - M, PH - 60)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(MED_GRAY)
  doc.text("Confidential — For regulatory presentation only", M, PH - 45)

  if (mode === "summary") {
    // Summary mode: cover + fleet summary only
    drawFleetSummaryPage()
    return finalize()
  }

  if (mode === "single" && singleRegistration) {
    drawSingleAircraftPages(singleRegistration)
    return finalize()
  }

  // ════════════════════════════════════════════════════════════════════════
  // FLEET SUMMARY PAGE
  // ════════════════════════════════════════════════════════════════════════
  drawFleetSummaryPage()

  // ════════════════════════════════════════════════════════════════════════
  // REVISION CHANGES SUMMARY PAGE
  // ════════════════════════════════════════════════════════════════════════
  drawRevisionChangesPage()

  // ════════════════════════════════════════════════════════════════════════
  // TYPE DETAIL PAGES
  // ════════════════════════════════════════════════════════════════════════
  for (const profile of data.profiles) {
    drawProfileDetailPage(profile)
  }

  // ════════════════════════════════════════════════════════════════════════
  // MEL / POLICY LETTER PAGE
  // ════════════════════════════════════════════════════════════════════════
  if (data.melRows.length > 0) {
    drawMelPage()
  }

  // ════════════════════════════════════════════════════════════════════════
  // ATTESTATION PAGE
  // ════════════════════════════════════════════════════════════════════════
  drawAttestationPage()

  return finalize()

  // ── Helper functions ────────────────────────────────────────────────────

  function drawFleetSummaryPage() {
    newPage()
    drawPageHeader("Fleet Summary")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(NAVY)
    doc.text("Fleet Audit Summary", M, 60)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(MED_GRAY)
    doc.text(`${data.profiles.reduce((s, p) => s + p.aircraft.length, 0)} aircraft · ${data.allRows.length} document links`, M, 76)

    const tableData = data.profiles.flatMap(p =>
      p.aircraft.map(a => [
        a.registration,
        a.model,
        a.model_family,
        String(a.total_docs),
        String(a.audited_docs),
        a.status === "current" ? "CURRENT" :
        a.status === "overdue" ? "OVERDUE" :
        a.status === "due_soon" ? "DUE SOON" : "NEVER AUDITED",
      ])
    )

    autoTable(doc, {
      startY: 86,
      margin: { left: M, right: M },
      head: [["Registration", "Model", "Type Group", "Docs", "Audited", "Status"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 4, textColor: DARK_GRAY },
      headStyles: { fillColor: NAVY, textColor: "#ffffff", fontSize: 7, fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold" },
        5: { fontStyle: "bold" },
      },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 5) {
          const val = data.cell.raw as string
          if (val === "CURRENT") data.cell.styles.textColor = GREEN
          else if (val === "OVERDUE") data.cell.styles.textColor = RED
          else if (val === "DUE SOON") data.cell.styles.textColor = AMBER
          else data.cell.styles.textColor = MED_GRAY
        }
      },
    })

    drawPageFooter()
  }

  function drawRevisionChangesPage() {
    newPage()
    drawPageHeader("Revision Changes")

    let y = 52
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(NAVY)
    doc.text("Revision Changes Summary", M, y)
    y += 16

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(MED_GRAY)

    const changes = data.revisionChanges
    const unchangedDocs = new Set(data.allRows.map(r => r.source_document.document_name))
    // Remove docs that had changes
    for (const c of changes) {
      // Find the doc name from allRows
      const row = data.allRows.find(r => r.source_document_id === c.source_document_id)
      if (row) unchangedDocs.delete(row.source_document.document_name)
    }

    if (changes.length === 0) {
      doc.text("No source document revisions were updated during this audit period.", M, y)
      doc.text("All manuals remain at the same revision as the previous audit cycle.", M, y + 14)
      y += 36
    } else {
      doc.text(`${changes.length} source document${changes.length > 1 ? "s" : ""} had revision changes during this campaign.`, M, y)
      y += 18

      // Changed documents table
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(NAVY)
      doc.text("Documents with Revision Changes", M, y)
      y += 14

      const changeRows = changes.map(c => {
        const row = data.allRows.find(r => r.source_document_id === c.source_document_id)
        const affectedCount = data.allRows.filter(r => r.source_document_id === c.source_document_id).length
        return [
          row?.source_document.document_name ?? "Unknown",
          row?.source_document.document_number ?? "",
          c.old_revision,
          c.new_revision,
          String(affectedCount),
          "Reviewed — No Program Impact",
        ]
      })

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [["Document", "Doc Number", "Previous Rev", "New Rev", "Aircraft Affected", "Assessment"]],
        body: changeRows,
        styles: { fontSize: 8, cellPadding: 4, textColor: DARK_GRAY },
        headStyles: { fillColor: NAVY, textColor: "#ffffff", fontSize: 7, fontStyle: "bold" },
        columnStyles: {
          2: { textColor: MED_GRAY },
          3: { fontStyle: "bold", textColor: VIOLET },
          5: { textColor: GREEN, fontStyle: "bold" },
        },
      })

      // @ts-expect-error jspdf-autotable adds lastAutoTable
      y = (doc as any).lastAutoTable.finalY + 20
    }

    // Unchanged documents section
    const unchangedList = [...unchangedDocs].sort()
    if (unchangedList.length > 0) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.setTextColor(NAVY)
      doc.text(`Documents with No Changes (${unchangedList.length})`, M, y)
      y += 14

      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(DARK_GRAY)

      // List them in columns to save space
      const colWidth = CW / 2
      let col = 0
      for (const docName of unchangedList) {
        const x = M + (col * colWidth)
        doc.text(`• ${docName}`, x, y)
        col++
        if (col >= 2) {
          col = 0
          y += 12
        }
      }
      if (col !== 0) y += 12

      y += 8
      doc.setFontSize(9)
      doc.setTextColor(MED_GRAY)
      doc.text("All documents above remain at the same revision. No program impact.", M, y)
    }

    drawPageFooter()
  }

  function drawProfileDetailPage(profile: AuditProfileGroup) {
    newPage()
    drawPageHeader(profile.display_name)

    let y = 52
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(NAVY)
    doc.text(profile.display_name, M, y)
    y += 16

    // Aircraft list
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(DARK_GRAY)
    const regs = profile.aircraft.map(a => a.registration).join(", ")
    doc.text(`Aircraft: ${regs}`, M, y)
    y += 14
    doc.setTextColor(MED_GRAY)
    doc.text(`${profile.documents.length} documents · ${profile.aircraft.length} aircraft · ${profile.total_items} total audit items`, M, y)
    y += 18

    // Document detail table
    const tableData = profile.documents.map(d => {
      const audit = d.latest_audit
      return [
        d.assembly_type.charAt(0).toUpperCase() + d.assembly_type.slice(1),
        d.requirement_type === "awl" ? "AWL" : "Sched Mx",
        d.source_document.document_name,
        d.section ?? "—",
        d.source_document.current_revision,
        audit?.audited_revision ?? "—",
        audit ? (audit.audited_revision === d.source_document.current_revision ? "✓" : "△") : "—",
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Assembly", "Req Type", "Source Document", "Section", "Current Rev", "Audited Rev", ""]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 4, textColor: DARK_GRAY },
      headStyles: { fillColor: NAVY, textColor: "#ffffff", fontSize: 7, fontStyle: "bold" },
      columnStyles: {
        6: { halign: "center", fontStyle: "bold" },
      },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 6) {
          const val = data.cell.raw as string
          if (val === "✓") data.cell.styles.textColor = GREEN
          else if (val === "△") data.cell.styles.textColor = AMBER
          else data.cell.styles.textColor = MED_GRAY
        }
      },
    })

    drawPageFooter()
  }

  function drawMelPage() {
    newPage()
    drawPageHeader("MEL / Policy Letters")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(NAVY)
    doc.text("MEL / Policy Letter Currency", M, 60)

    const grouped = new Map<string, MmMelTracking[]>()
    for (const row of data.melRows) {
      const list = grouped.get(row.model_family) ?? []
      list.push(row)
      grouped.set(row.model_family, list)
    }

    const tableData = data.melRows.map(r => [
      r.model_family,
      r.document_type === "mmel" ? "MMEL" : "Policy Letter",
      r.document_number,
      r.revision_number ?? "—",
      r.revision_date ?? "—",
      r.review_date ?? "—",
      r.next_due_date ?? "—",
      r.update_needed ? "UPDATE NEEDED" : "Current",
    ])

    autoTable(doc, {
      startY: 74,
      margin: { left: M, right: M },
      head: [["Type Group", "Type", "Document", "Rev", "Rev Date", "Review Date", "Next Due", "Status"]],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 3, textColor: DARK_GRAY },
      headStyles: { fillColor: NAVY, textColor: "#ffffff", fontSize: 7, fontStyle: "bold" },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 7) {
          const val = data.cell.raw as string
          if (val === "UPDATE NEEDED") data.cell.styles.textColor = AMBER
          else data.cell.styles.textColor = GREEN
        }
      },
    })

    drawPageFooter()
  }

  function drawAttestationPage() {
    newPage()
    drawPageHeader("Attestation")

    let y = 60
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(NAVY)
    doc.text("Certification & Attestation", M, y)
    y += 30

    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(DARK_GRAY)
    const statement = [
      "I certify that the maintenance manual revision audit documented in this report has been",
      "conducted in accordance with the company General Maintenance Manual (GMM) §4.2 and the",
      "Continuous Airworthiness Maintenance Program (CAMP) requirements of 14 CFR Part 135.",
      "",
      "All applicable OEM maintenance manuals, service bulletins, airworthiness limitation sections,",
      "and scheduled maintenance requirements have been reviewed against the current published",
      "revisions for each aircraft on the certificate. Revisions with no program impact have been",
      "documented accordingly.",
    ]
    for (const line of statement) {
      doc.text(line, M, y)
      y += 14
    }

    y += 20

    // Signature blocks
    doc.setDrawColor(DARK_GRAY)
    doc.setLineWidth(0.5)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(NAVY)
    doc.text("Prepared By:", M, y)
    y += 30
    doc.line(M, y, M + 200, y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(MED_GRAY)
    doc.text("Name / Title", M, y + 12)
    doc.text("Date", M + 220, y + 12)
    doc.line(M + 220, y, M + 340, y)

    y += 50
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(NAVY)
    doc.text("Reviewed By (Director of Maintenance):", M, y)
    y += 30
    doc.line(M, y, M + 200, y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(MED_GRAY)
    doc.text("Name / Title", M, y + 12)
    doc.text("Date", M + 220, y + 12)
    doc.line(M + 220, y, M + 340, y)

    // Report metadata
    y += 50
    doc.setDrawColor(LIGHT_GRAY)
    doc.setLineWidth(0.5)
    doc.line(M, y, PW - M, y)
    y += 16

    const reportId = `RPT-${new Date().getFullYear()}-${campaignName.replace(/\s/g, "-")}-MM`
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(MED_GRAY)
    doc.text(`Report ID: ${reportId}`, M, y)
    doc.text(`Generated: ${timestamp}`, M + 300, y)

    drawPageFooter()
  }

  function drawSingleAircraftPages(registration: string) {
    const aircraftRows = data.allRows.filter(r => r.registration === registration)
    if (aircraftRows.length === 0) return

    newPage()
    drawPageHeader(`Single Aircraft — ${registration}`)

    let y = 52
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(NAVY)
    doc.text(`Audit Record — ${registration}`, M, y)
    y += 16

    const first = aircraftRows[0]
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(DARK_GRAY)
    doc.text(`${first.model} (${first.model_family}) · ${aircraftRows.length} documents`, M, y)
    y += 18

    const tableData = aircraftRows.map(d => {
      const audit = d.latest_audit
      return [
        d.assembly_type.charAt(0).toUpperCase() + d.assembly_type.slice(1),
        d.requirement_type === "awl" ? "AWL" : "Sched Mx",
        d.source_document.document_name,
        d.section ?? "—",
        d.source_document.current_revision,
        audit?.audited_revision ?? "—",
        audit?.audit_date ?? "—",
        audit?.next_due_date ?? "—",
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Assembly", "Req Type", "Source Document", "Section", "Current Rev", "Audited Rev", "Audit Date", "Next Due"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 4, textColor: DARK_GRAY },
      headStyles: { fillColor: NAVY, textColor: "#ffffff", fontSize: 7, fontStyle: "bold" },
    })

    drawPageFooter()
  }

  function finalize() {
    const date = localToday()
    const campaign = campaignName.replace(/\s/g, "_")
    const suffix =
      mode === "summary" ? "_Summary" :
      mode === "single" ? `_${singleRegistration ?? "Aircraft"}` :
      "_Full"
    const filename = `MM_Audit${suffix}_${campaign}_${date}.pdf`
    doc.save(filename)
  }
}
