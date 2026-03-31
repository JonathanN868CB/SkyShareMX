// ============================================================================
// Vendor Governance Types — Dual-Lane Compliance Model
// ============================================================================

// ── Shared vendor statuses ──────────────────────────────────────────────────

/** Top-level operational status visible on map and list views */
export type VendorOperationalStatus =
  | "discovered"   // found via map / quick-add, not yet vetted
  | "pending"      // vetting in progress
  | "approved"     // usable in at least one lane
  | "restricted"   // limited use, conditions apply
  | "inactive"     // no longer active
  | "archived"     // soft-deleted, preserved for audit history

// ── Service type tags (replaces old vendor_type primary classification) ─────

/** Service capability tags — displayed as badges, not as primary icons */
export type VendorServiceTag =
  | "general_mro"
  | "avionics"
  | "engine"
  | "sheet_metal"
  | "interior"
  | "paint"
  | string         // allow freeform tags

// ── 9-or-less lane ─────────────────────────────────────────────────────────

export type NineLaneStatus =
  | "not_evaluated"
  | "usable"
  | "pending_review"
  | "restricted"
  | "not_applicable"

export type VendorLaneNine = {
  id: string
  vendor_id: string
  status: NineLaneStatus
  capability_scope: string | null
  ap_certificate_verified: boolean
  ap_certificate_number: string | null
  last_review_date: string | null       // ISO date
  next_review_due: string | null        // ISO date, null = N/A
  approved_by: string | null            // user UUID
  approved_at: string | null            // ISO timestamp
  warnings: string[]
  notes: string | null
  updated_at: string
  updated_by: string | null
}

// ── 10-or-more lane ────────────────────────────────────────────────────────

export type TenLaneStatus =
  | "not_evaluated"
  | "recurring_approved"
  | "ad_hoc_only"
  | "pending_review"
  | "expired"
  | "restricted"
  | "inactive"

export type VendorLaneTen = {
  id: string
  vendor_id: string
  status: TenLaneStatus
  crs_number: string | null
  drug_abatement_verified: boolean
  insurance_verified: boolean
  authorization_scope: string | null
  last_audit_date: string | null
  next_audit_due: string | null          // null = N/A
  last_oversight_review: string | null
  next_oversight_review_due: string | null // null = N/A
  gmm_form_complete: boolean
  isbao_rating: string | null
  argus_rating: string | null
  approved_by: string | null
  approved_at: string | null
  warnings: string[]
  notes: string | null
  updated_at: string
  updated_by: string | null
}

// ── Lane identifier ────────────────────────────────────────────────────────

export type VendorLane = "shared" | "nine" | "ten"

// ── Audit trail ────────────────────────────────────────────────────────────

export type VendorStatusHistory = {
  id: string
  vendor_id: string
  lane: VendorLane
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_by: string | null
  changed_at: string
  reason: string | null
}

// ── Review events ──────────────────────────────────────────────────────────

export type ReviewType =
  | "initial_eval"
  | "annual_review"
  | "audit"
  | "spot_check"
  | "ad_hoc"
  | "surveillance"

export type ReviewOutcome =
  | "passed"
  | "failed"
  | "conditional"
  | "deferred"

export type VendorReviewEvent = {
  id: string
  vendor_id: string
  lane: "nine" | "ten"
  review_type: ReviewType
  review_date: string
  conducted_by: string | null
  outcome: ReviewOutcome | null
  notes: string | null
  next_due: string | null
  created_at: string
}

// ── Documents ──────────────────────────────────────────────────────────────

export type SharedDocumentType = "insurance_cert" | "w9" | "other"
export type NineDocumentType = "ap_license_copy" | "rts_evidence" | "other"
export type TenDocumentType =
  | "air_agency_cert"
  | "drug_alcohol_program"
  | "argus_report"
  | "isbao_report"
  | "gmm_approval_form"
  | "gom_form"
  | "other"

export type VendorDocument = {
  id: string
  vendor_id: string
  lane: VendorLane
  document_type: string
  document_name: string
  file_path: string
  file_size: number | null
  expires_at: string | null              // null = N/A (no expiry)
  uploaded_by: string | null
  uploaded_at: string
  verified: boolean
  verified_by: string | null
  verified_at: string | null
  notes: string | null
}

// ── Extended vendor record (for detail views) ──────────────────────────────

export type VendorCore = {
  id: string
  name: string
  airport_code: string | null
  city: string | null
  state: string | null
  country: string
  lat: number | null
  lng: number | null
  phone: string | null
  email: string | null
  website: string | null
  specialties: string[] | null
  notes: string | null
  preferred: boolean                     // legacy — will be deprecated
  vendor_type: string                    // legacy — migrating to tags
  active: boolean
  is_mrt: boolean
  operational_status: VendorOperationalStatus
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  tags: string[]
}

export type VendorContact = {
  id: string
  vendor_id: string
  name: string
  title: string | null
  role: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  is_primary: boolean
}

/** Full vendor detail with both compliance lanes loaded */
export type VendorDetail = {
  vendor: VendorCore
  contacts: VendorContact[]
  lane_nine: VendorLaneNine | null       // null = lane record not yet created
  lane_ten: VendorLaneTen | null         // null = lane record not yet created
  documents: VendorDocument[]
  recent_history: VendorStatusHistory[]
  recent_reviews: VendorReviewEvent[]
}
