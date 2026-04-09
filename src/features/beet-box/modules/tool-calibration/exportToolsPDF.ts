import jsPDF from "jspdf"
import type { Tool } from "../../types"

const GOLD = [212, 160, 23] as const
const DARK = [30, 30, 30] as const
const WHITE = [255, 255, 255] as const
const RED = [220, 38, 38] as const
const AMBER = [245, 158, 11] as const
const GREEN = [16, 185, 129] as const

function fmtDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getStatusColor(tool: Tool): readonly [number, number, number] {
  if (!tool.nextCalibrationDue) return WHITE
  const days = Math.ceil((new Date(tool.nextCalibrationDue).getTime() - Date.now()) / 86400000)
  if (days < 0) return RED
  if (days <= 30) return AMBER
  return GREEN
}

function getStatusText(tool: Tool): string {
  if (!tool.nextCalibrationDue && tool.toolType === "Ref") return "Reference"
  if (!tool.nextCalibrationDue) return "No Cal Date"
  const days = Math.ceil((new Date(tool.nextCalibrationDue).getTime() - Date.now()) / 86400000)
  if (days < 0) return `OVERDUE (${Math.abs(days)}d)`
  if (days <= 30) return `Due Soon (${days}d)`
  return "Current"
}

export function exportToolCalibrationPDF(tools: Tool[], title = "Tool Calibration Report") {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" })
  const pageW = 279.4
  const pageH = 215.9
  const marginX = 10
  const marginY = 10
  const usableW = pageW - marginX * 2

  const certTools = tools.filter(t => t.toolType === "Cert")
  const refTools = tools.filter(t => t.toolType === "Ref")

  const today = new Date()
  const overdueCount = certTools.filter(t => {
    if (!t.nextCalibrationDue) return false
    return new Date(t.nextCalibrationDue) < today
  }).length
  const dueSoonCount = certTools.filter(t => {
    if (!t.nextCalibrationDue) return false
    const days = Math.ceil((new Date(t.nextCalibrationDue).getTime() - today.getTime()) / 86400000)
    return days >= 0 && days <= 30
  }).length

  function drawHeader(pageNum: number, totalPages: number, sectionTitle: string) {
    // Header bar
    doc.setFillColor(...DARK)
    doc.rect(0, 0, pageW, 18, "F")
    doc.setFillColor(...GOLD)
    doc.rect(0, 17.5, pageW, 0.5, "F")

    // Logo text
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(...WHITE)
    doc.text("SKYSHARE MX", marginX, 8)

    doc.setFontSize(9)
    doc.setTextColor(...GOLD)
    doc.text("MAINTENANCE", marginX, 13)

    // Title
    doc.setFontSize(12)
    doc.setTextColor(...WHITE)
    doc.text(title.toUpperCase(), pageW / 2, 8, { align: "center" })

    doc.setFontSize(8)
    doc.setTextColor(180, 180, 180)
    doc.text(sectionTitle, pageW / 2, 13, { align: "center" })

    // Right side
    doc.setFontSize(8)
    doc.setTextColor(180, 180, 180)
    doc.text(`Generated: ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, pageW - marginX, 8, { align: "right" })
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - marginX, 13, { align: "right" })
  }

  function drawSummaryPage() {
    drawHeader(1, 0, "Summary") // page count updated later

    let y = 26

    // Summary stats
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(60, 60, 60)
    doc.text("CALIBRATION STATUS SUMMARY", marginX, y)
    y += 8

    const stats = [
      { label: "Total Tools", value: String(tools.length), color: DARK },
      { label: "Certified (Calibration Required)", value: String(certTools.length), color: GOLD },
      { label: "Reference Only", value: String(refTools.length), color: [100, 100, 100] as const },
      { label: "Currently Calibrated", value: String(certTools.length - overdueCount - dueSoonCount), color: GREEN },
      { label: "Due Within 30 Days", value: String(dueSoonCount), color: AMBER },
      { label: "Overdue", value: String(overdueCount), color: RED },
    ]

    stats.forEach(s => {
      doc.setFillColor(245, 245, 245)
      doc.roundedRect(marginX, y, usableW, 8, 1, 1, "F")
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(80, 80, 80)
      doc.text(s.label, marginX + 4, y + 5.5)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(s.color[0], s.color[1], s.color[2])
      doc.text(s.value, usableW + marginX - 4, y + 5.5, { align: "right" })
      y += 10
    })

    if (overdueCount > 0) {
      y += 5
      doc.setFillColor(254, 226, 226)
      doc.roundedRect(marginX, y, usableW, 12, 1, 1, "F")
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...RED)
      doc.text(
        `WARNING: ${overdueCount} tool${overdueCount > 1 ? "s" : ""} with overdue calibration — must not be used for FAA-tracked maintenance until recalibrated.`,
        marginX + 4, y + 7
      )
    }

    y += 20
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 120, 120)
    doc.text("This report is generated for FAA compliance review. Tool calibration records are maintained per 14 CFR Part 145.", marginX, y)
    y += 5
    doc.text(`Report prepared by SkyShare MX — Tool Room: Ogden`, marginX, y)
  }

  // Column definitions for tool table
  const cols = [
    { label: "Tool #", w: 30 },
    { label: "Description", w: 52 },
    { label: "Type", w: 14 },
    { label: "Make", w: 28 },
    { label: "Model", w: 28 },
    { label: "S/N", w: 26 },
    { label: "Location", w: 32 },
    { label: "Last Cal.", w: 22 },
    { label: "Next Due", w: 22 },
    { label: "Interval", w: 14 },
    { label: "Status", w: 24 },
  ]
  // Normalize widths to fit usable width
  const totalW = cols.reduce((s, c) => s + c.w, 0)
  const scale = usableW / totalW
  cols.forEach(c => { c.w = c.w * scale })

  function drawTableHeader(y: number) {
    doc.setFillColor(46, 46, 46)
    doc.rect(marginX, y, usableW, 7, "F")
    doc.setFontSize(6.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...WHITE)
    let x = marginX + 2
    cols.forEach(col => {
      doc.text(col.label.toUpperCase(), x, y + 5)
      x += col.w
    })
    return y + 7
  }

  function drawToolRow(tool: Tool, y: number) {
    const rowH = 6
    // Alternating row bg
    doc.setFillColor(250, 250, 250)
    doc.rect(marginX, y, usableW, rowH, "F")

    doc.setFontSize(6.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(60, 60, 60)

    let x = marginX + 2
    const vals = [
      tool.toolNumber || "—",
      (tool.description || "—").substring(0, 35),
      tool.toolType || "—",
      (tool.make || "—").substring(0, 18),
      (tool.model || "—").substring(0, 18),
      (tool.serialNumber || "—").substring(0, 16),
      (tool.location || "—").substring(0, 20),
      fmtDate(tool.lastCalibratedAt),
      fmtDate(tool.nextCalibrationDue),
      tool.calibrationIntervalDays ? `${tool.calibrationIntervalDays}d` : "—",
    ]

    vals.forEach((val, i) => {
      doc.text(val, x, y + 4)
      x += cols[i].w
    })

    // Status with color
    const statusColor = getStatusColor(tool)
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
    doc.setFont("helvetica", "bold")
    doc.text(getStatusText(tool), x, y + 4)

    return y + rowH
  }

  // Build pages
  // Page 1: Summary
  drawSummaryPage()

  // Pages 2+: Certified tools table
  const rowsPerPage = 28
  const allToolsSorted = [...certTools, ...refTools]

  let currentPage = 2
  for (let i = 0; i < allToolsSorted.length; i += rowsPerPage) {
    doc.addPage()
    const batch = allToolsSorted.slice(i, i + rowsPerPage)
    const sectionLabel = i < certTools.length ? "Certified Tools" :
      i >= certTools.length ? "Reference Tools" : "Tools"
    drawHeader(currentPage, 0, sectionLabel)
    let y = drawTableHeader(22)
    batch.forEach(tool => { y = drawToolRow(tool, y) })
    currentPage++
  }

  // Fix page numbers
  const totalPages = currentPage - 1
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    // Re-draw page number (white text over dark header)
    doc.setFillColor(...DARK)
    doc.rect(pageW - marginX - 30, 10, 30, 6, "F")
    doc.setFontSize(8)
    doc.setTextColor(180, 180, 180)
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, 13, { align: "right" })
  }

  doc.save(`Tool_Calibration_Report_${today.toISOString().slice(0, 10)}.pdf`)
}
