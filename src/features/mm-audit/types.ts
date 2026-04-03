// ─── MM Revision & Audit Tracking — Types ───────────────────────────────────

export interface MmSourceDocument {
  id: string
  document_number: string
  document_name: string
  document_url: string | null
  current_revision: string
  current_rev_date: string | null
  updated_by: string | null
  updated_at: string
  notes: string | null
}

export interface MmAircraftDocument {
  id: string
  aircraft_id: string
  source_document_id: string
  assembly_type: "airframe" | "engine" | "prop" | "apu"
  requirement_type: "awl" | "sched_mx"
  section: string | null
  assembly_detail: string | null
  is_applicable: boolean
  created_at: string
}

export interface MmAuditCampaign {
  id: string
  name: string
  period_start: string
  period_end: string
  status: "open" | "closed" | "cancelled"
  created_by: string | null
  closed_at: string | null
  approved_by_admin: string | null
  approved_by_admin_at: string | null
  approved_by_super_admin: string | null
  approved_by_super_admin_at: string | null
  cancelled_at: string | null
  created_at: string
}

export interface MmCampaignRevisionChange {
  id: string
  campaign_id: string
  source_document_id: string
  old_revision: string
  new_revision: string
  proposed_by: string | null
  proposed_at: string
}

export interface MmCampaignAssignment {
  id: string
  campaign_id: string
  assigned_to: string
  model_family: string | null
  aircraft_id: string | null
  assigned_by: string | null
  created_at: string
}

export interface MmAuditRecord {
  id: string
  aircraft_document_id: string
  campaign_id: string | null
  audited_revision: string
  audit_date: string
  next_due_date: string
  audited_by: string | null
  notes: string | null
  created_at: string
}

export interface MmMelTracking {
  id: string
  model_family: string
  document_type: "mmel" | "policy_letter"
  document_number: string
  revision_number: string | null
  revision_date: string | null
  review_date: string | null
  next_due_date: string | null
  update_needed: boolean
  updated_by: string | null
  updated_at: string
}

// ─── Computed / View Types ───────────────────────────────────────────────────

export interface AircraftDocumentRow extends MmAircraftDocument {
  registration: string
  model: string
  model_family: string
  source_document: MmSourceDocument
  latest_audit: MmAuditRecord | null
}

export type AuditStatus = "current" | "due_soon" | "overdue" | "never_audited"

export interface AircraftAuditSummary {
  aircraft_id: string
  registration: string
  model: string
  model_family: string
  total_docs: number
  audited_docs: number
  overdue_docs: number
  due_soon_docs: number
  status: AuditStatus
}

export interface AuditProfileGroup {
  fingerprint: string
  display_name: string
  aircraft: AircraftAuditSummary[]
  documents: AircraftDocumentRow[]
  total_items: number
  audited_items: number
}

export interface CampaignSummary extends MmAuditCampaign {
  total_items: number
  audited_items: number
  progress_pct: number
  days_remaining: number
  staged_revision_count: number
}
