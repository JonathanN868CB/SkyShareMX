// ============================================================================
// Vendor Reports — Orchestrator
// ============================================================================
// Ties together: data fetch → format → Supabase Storage upload → history record

import { supabase } from "@/lib/supabase"
import { localToday } from "@/shared/lib/dates"
import { fetchReportData } from "./data"
import { generateRosterCsv } from "./generateRosterCsv"
import { generateAuditPdf } from "./generateAuditPdf"
import { generateCompliancePdf } from "./generateCompliancePdf"
import type { ReportType, LaneFilter, ReportRecord } from "./types"

export type GenerateReportOpts = {
  reportType: ReportType
  laneFilter: LaneFilter
  statusFilter: string | null
  dateStart: string | null
  dateEnd: string | null
  generatedBy: string       // user display name
  generatedByUid: string    // user UUID
}

export async function generateReport(opts: GenerateReportOpts): Promise<ReportRecord> {
  // 1. Fetch data
  const { vendors, reviews, documents } = await fetchReportData({
    laneFilter: opts.laneFilter,
    statusFilter: opts.statusFilter,
    dateStart: opts.dateStart,
    dateEnd: opts.dateEnd,
  })

  // 2. Generate file
  let blob: Blob
  let fileFormat: "pdf" | "csv"
  let title: string
  let description: string

  const dateStamp = localToday()
  const laneLabel = opts.laneFilter === "nine" ? "9-or-Less"
    : opts.laneFilter === "ten" ? "10-or-More"
    : "All Lanes"

  switch (opts.reportType) {
    case "vendor_roster": {
      blob = generateRosterCsv(vendors)
      fileFormat = "csv"
      title = `Vendor Roster — ${dateStamp}`
      description = `${vendors.length} vendors · ${laneLabel}`
      break
    }
    case "vendor_audit": {
      const doc = generateAuditPdf(vendors, reviews, documents, opts.laneFilter, opts.generatedBy)
      blob = doc.output("blob")
      fileFormat = "pdf"
      title = `Vendor Audit Report — ${dateStamp}`
      description = `${vendors.length} vendors · ${laneLabel}`
      break
    }
    case "compliance_summary": {
      const periodLabel = opts.dateStart && opts.dateEnd
        ? `${opts.dateStart} to ${opts.dateEnd}`
        : opts.dateStart ? `From ${opts.dateStart}`
        : opts.dateEnd ? `Through ${opts.dateEnd}`
        : "All Time"
      const doc = generateCompliancePdf(vendors, reviews, documents, opts.laneFilter, opts.dateStart, opts.dateEnd, opts.generatedBy)
      blob = doc.output("blob")
      fileFormat = "pdf"
      title = `Compliance Report — ${dateStamp}`
      description = `${vendors.length} vendors · ${laneLabel} · ${periodLabel}`
      break
    }
    default:
      throw new Error(`Unknown report type: ${opts.reportType}`)
  }

  // 3. Upload to Supabase Storage
  const ext = fileFormat === "pdf" ? "pdf" : "csv"
  const fileName = `${opts.reportType}/${dateStamp}_${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("vendor-reports")
    .upload(fileName, blob, {
      contentType: fileFormat === "pdf" ? "application/pdf" : "text/csv",
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload report: ${uploadError.message}`)
  }

  // 4. Insert history record
  const { data: record, error: insertError } = await supabase
    .from("vendor_reports")
    .insert({
      report_type: opts.reportType,
      title,
      description,
      file_format: fileFormat,
      file_path: fileName,
      file_size: blob.size,
      lane_filter: opts.laneFilter,
      status_filter: opts.statusFilter,
      date_range_start: opts.dateStart,
      date_range_end: opts.dateEnd,
      generated_by: opts.generatedByUid,
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Failed to save report record: ${insertError.message}`)
  }

  return record as ReportRecord
}
