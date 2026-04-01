// ============================================================================
// Vendor Roster — CSV Generator
// ============================================================================

import type { VendorReportRow } from "./data"

const NINE_STATUS: Record<string, string> = {
  not_evaluated: "Not Evaluated",
  usable: "Usable",
  pending_review: "Pending Review",
  restricted: "Restricted",
  not_applicable: "N/A",
}

const TEN_STATUS: Record<string, string> = {
  not_evaluated: "Not Evaluated",
  recurring_approved: "Recurring Approved",
  ad_hoc_only: "Ad Hoc Only",
  pending_review: "Pending Review",
  expired: "Expired",
  restricted: "Restricted",
  inactive: "Inactive",
}

const OP_STATUS: Record<string, string> = {
  discovered: "Discovered",
  pending: "Pending",
  approved: "Approved",
  restricted: "Restricted",
  inactive: "Inactive",
  archived: "Archived",
}

function esc(val: string | null | undefined): string {
  if (val == null) return ""
  const s = String(val)
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function generateRosterCsv(vendors: VendorReportRow[]): Blob {
  const headers = [
    "Vendor Name",
    "Type",
    "Operational Status",
    "Airport Code",
    "City",
    "State",
    "Country",
    "Phone",
    "Email",
    "Website",
    "MRT",
    "Preferred",
    "Tags",
    "Primary Contact",
    "Contact Phone",
    "Contact Email",
    "9-or-Less Status",
    "AP Certificate Verified",
    "AP Certificate #",
    "9-or-Less Next Review Due",
    "10-or-More Status",
    "CRS #",
    "Drug Abatement Verified",
    "Insurance Verified",
    "GMM Form Complete",
    "ISBAO Rating",
    "ARGUS Rating",
    "10-or-More Next Audit Due",
    "10-or-More Next Oversight Due",
    "Document Count",
    "Expired Documents",
    "Unverified Documents",
    "Review Count",
    "Failed Reviews",
  ]

  const rows = vendors.map(v => [
    esc(v.name),
    esc(v.vendor_type),
    esc(OP_STATUS[v.operational_status] ?? v.operational_status),
    esc(v.airport_code),
    esc(v.city),
    esc(v.state),
    esc(v.country),
    esc(v.phone),
    esc(v.email),
    esc(v.website),
    v.is_mrt ? "Yes" : "No",
    v.preferred ? "Yes" : "No",
    esc(v.tags.join("; ")),
    esc(v.primary_contact_name),
    esc(v.primary_contact_phone),
    esc(v.primary_contact_email),
    esc(NINE_STATUS[v.lane_nine_status ?? ""] ?? v.lane_nine_status ?? "—"),
    v.lane_nine_status ? (v.nine_ap_verified ? "Yes" : "No") : "",
    esc(v.nine_ap_number),
    esc(v.nine_next_review_due),
    esc(TEN_STATUS[v.lane_ten_status ?? ""] ?? v.lane_ten_status ?? "—"),
    esc(v.ten_crs_number),
    v.lane_ten_status ? (v.ten_drug_abatement ? "Yes" : "No") : "",
    v.lane_ten_status ? (v.ten_insurance ? "Yes" : "No") : "",
    v.lane_ten_status ? (v.ten_gmm_complete ? "Yes" : "No") : "",
    esc(v.ten_isbao_rating),
    esc(v.ten_argus_rating),
    esc(v.ten_next_audit_due),
    esc(v.ten_next_oversight_due),
    String(v.doc_count),
    String(v.expired_doc_count),
    String(v.unverified_doc_count),
    String(v.review_count),
    String(v.failed_review_count),
  ])

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n")
  return new Blob([csv], { type: "text/csv;charset=utf-8" })
}
