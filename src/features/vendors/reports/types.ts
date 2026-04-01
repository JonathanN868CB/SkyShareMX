// ============================================================================
// Vendor Report Types
// ============================================================================

export type ReportType = "vendor_roster" | "vendor_audit" | "compliance_summary"

export type ReportFormat = "pdf" | "csv"

export type LaneFilter = "all" | "nine" | "ten"

export type ReportRecord = {
  id: string
  report_type: ReportType
  title: string
  description: string | null
  file_format: ReportFormat
  file_path: string | null
  file_size: number | null
  lane_filter: LaneFilter | null
  status_filter: string | null
  date_range_start: string | null
  date_range_end: string | null
  generated_by: string | null
  generated_at: string
  notes: string | null
}

export const REPORT_TYPE_CONFIG: Record<ReportType, {
  label: string
  description: string
  format: ReportFormat
}> = {
  vendor_roster: {
    label: "Vendor Roster",
    description: "Complete vendor list with lane statuses, contacts, and locations",
    format: "csv",
  },
  vendor_audit: {
    label: "Vendor Audit Report",
    description: "Detailed compliance status, reviews, missing documents, and due dates per vendor",
    format: "pdf",
  },
  compliance_summary: {
    label: "Periodic Compliance Report",
    description: "Formal compliance summary for FAA / audit retention — separated by lane",
    format: "pdf",
  },
}
