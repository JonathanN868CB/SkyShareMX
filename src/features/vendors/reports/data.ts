// ============================================================================
// Vendor Report — Data Fetching
// ============================================================================

import { supabase } from "@/lib/supabase"
import type { LaneFilter } from "./types"

export type VendorReportRow = {
  id: string
  name: string
  vendor_type: string
  operational_status: string
  airport_code: string | null
  city: string | null
  state: string | null
  country: string
  phone: string | null
  email: string | null
  website: string | null
  is_mrt: boolean
  preferred: boolean
  tags: string[]
  notes: string | null
  // Lane data
  lane_nine_status: string | null
  nine_ap_verified: boolean
  nine_ap_number: string | null
  nine_capability_scope: string | null
  nine_last_review: string | null
  nine_next_review_due: string | null
  nine_warnings: string[]
  lane_ten_status: string | null
  ten_crs_number: string | null
  ten_drug_abatement: boolean
  ten_insurance: boolean
  ten_gmm_complete: boolean
  ten_authorization_scope: string | null
  ten_last_audit: string | null
  ten_next_audit_due: string | null
  ten_last_oversight: string | null
  ten_next_oversight_due: string | null
  ten_isbao_rating: string | null
  ten_argus_rating: string | null
  ten_warnings: string[]
  // Aggregates
  doc_count: number
  expired_doc_count: number
  unverified_doc_count: number
  review_count: number
  failed_review_count: number
  // Contacts
  primary_contact_name: string | null
  primary_contact_phone: string | null
  primary_contact_email: string | null
}

export type ReviewRow = {
  id: string
  vendor_id: string
  vendor_name: string
  lane: "nine" | "ten"
  review_type: string
  review_date: string
  outcome: string | null
  notes: string | null
  next_due: string | null
}

export type DocumentRow = {
  id: string
  vendor_id: string
  vendor_name: string
  lane: string
  document_type: string
  document_name: string
  expires_at: string | null
  verified: boolean
  uploaded_at: string
}

/** Fetch all vendor data needed for reports */
export async function fetchReportData(opts: {
  laneFilter: LaneFilter
  statusFilter: string | null
  dateStart: string | null
  dateEnd: string | null
}): Promise<{
  vendors: VendorReportRow[]
  reviews: ReviewRow[]
  documents: DocumentRow[]
}> {
  // Parallel queries
  const [vendorRes, nineRes, tenRes, docRes, reviewRes, contactRes] = await Promise.all([
    supabase.from("vendors").select("*").eq("active", true).order("name"),
    supabase.from("vendor_lane_nine").select("*"),
    supabase.from("vendor_lane_ten").select("*"),
    supabase.from("vendor_documents").select("*"),
    supabase.from("vendor_review_events").select("*").order("review_date", { ascending: false }),
    supabase.from("vendor_contacts").select("*").eq("is_primary", true),
  ])

  const nineMap = new Map<string, any>()
  ;(nineRes.data ?? []).forEach((r: any) => nineMap.set(r.vendor_id, r))
  const tenMap = new Map<string, any>()
  ;(tenRes.data ?? []).forEach((r: any) => tenMap.set(r.vendor_id, r))

  // Document aggregation
  const docsByVendor = new Map<string, any[]>()
  ;(docRes.data ?? []).forEach((d: any) => {
    const arr = docsByVendor.get(d.vendor_id) ?? []
    arr.push(d)
    docsByVendor.set(d.vendor_id, arr)
  })

  // Reviews by vendor
  const reviewsByVendor = new Map<string, any[]>()
  ;(reviewRes.data ?? []).forEach((r: any) => {
    const arr = reviewsByVendor.get(r.vendor_id) ?? []
    arr.push(r)
    reviewsByVendor.set(r.vendor_id, arr)
  })

  // Primary contacts
  const contactMap = new Map<string, any>()
  ;(contactRes.data ?? []).forEach((c: any) => contactMap.set(c.vendor_id, c))

  // Build vendor name lookup
  const vendorNames = new Map<string, string>()
  ;(vendorRes.data ?? []).forEach((v: any) => vendorNames.set(v.id, v.name))

  const now = Date.now()

  let rawVendors = (vendorRes.data ?? []) as any[]

  // Apply status filter
  if (opts.statusFilter) {
    rawVendors = rawVendors.filter(v => v.operational_status === opts.statusFilter)
  }

  // Apply lane filter — only include vendors that have the relevant lane record
  if (opts.laneFilter === "nine") {
    rawVendors = rawVendors.filter(v => nineMap.has(v.id))
  } else if (opts.laneFilter === "ten") {
    rawVendors = rawVendors.filter(v => tenMap.has(v.id))
  }

  const vendors: VendorReportRow[] = rawVendors.map(v => {
    const nine = nineMap.get(v.id)
    const ten = tenMap.get(v.id)
    const docs = docsByVendor.get(v.id) ?? []
    const revs = reviewsByVendor.get(v.id) ?? []
    const contact = contactMap.get(v.id)

    const expiredDocs = docs.filter((d: any) =>
      d.expires_at && new Date(d.expires_at + "T00:00:00").getTime() < now
    )
    const unverifiedDocs = docs.filter((d: any) => !d.verified)
    const failedReviews = revs.filter((r: any) => r.outcome === "failed")

    return {
      id: v.id,
      name: v.name,
      vendor_type: v.vendor_type,
      operational_status: v.operational_status,
      airport_code: v.airport_code,
      city: v.city,
      state: v.state,
      country: v.country ?? "USA",
      phone: v.phone,
      email: v.email,
      website: v.website,
      is_mrt: v.is_mrt ?? false,
      preferred: v.preferred ?? false,
      tags: v.tags ?? [],
      notes: v.notes,
      lane_nine_status: nine?.status ?? null,
      nine_ap_verified: nine?.ap_certificate_verified ?? false,
      nine_ap_number: nine?.ap_certificate_number ?? null,
      nine_capability_scope: nine?.capability_scope ?? null,
      nine_last_review: nine?.last_review_date ?? null,
      nine_next_review_due: nine?.next_review_due ?? null,
      nine_warnings: nine?.warnings ?? [],
      lane_ten_status: ten?.status ?? null,
      ten_crs_number: ten?.crs_number ?? null,
      ten_drug_abatement: ten?.drug_abatement_verified ?? false,
      ten_insurance: ten?.insurance_verified ?? false,
      ten_gmm_complete: ten?.gmm_form_complete ?? false,
      ten_authorization_scope: ten?.authorization_scope ?? null,
      ten_last_audit: ten?.last_audit_date ?? null,
      ten_next_audit_due: ten?.next_audit_due ?? null,
      ten_last_oversight: ten?.last_oversight_review ?? null,
      ten_next_oversight_due: ten?.next_oversight_review_due ?? null,
      ten_isbao_rating: ten?.isbao_rating ?? null,
      ten_argus_rating: ten?.argus_rating ?? null,
      ten_warnings: ten?.warnings ?? [],
      doc_count: docs.length,
      expired_doc_count: expiredDocs.length,
      unverified_doc_count: unverifiedDocs.length,
      review_count: revs.length,
      failed_review_count: failedReviews.length,
      primary_contact_name: contact?.name ?? null,
      primary_contact_phone: contact?.phone ?? null,
      primary_contact_email: contact?.email ?? null,
    }
  })

  // Build flat review + document lists (for audit report)
  let allReviews = (reviewRes.data ?? []) as any[]
  let allDocs = (docRes.data ?? []) as any[]

  // Date range filter for reviews
  if (opts.dateStart) {
    allReviews = allReviews.filter(r => r.review_date >= opts.dateStart)
  }
  if (opts.dateEnd) {
    allReviews = allReviews.filter(r => r.review_date <= opts.dateEnd)
  }

  const reviews: ReviewRow[] = allReviews
    .filter(r => vendorNames.has(r.vendor_id))
    .map(r => ({
      id: r.id,
      vendor_id: r.vendor_id,
      vendor_name: vendorNames.get(r.vendor_id) ?? "Unknown",
      lane: r.lane,
      review_type: r.review_type,
      review_date: r.review_date,
      outcome: r.outcome,
      notes: r.notes,
      next_due: r.next_due,
    }))

  const documents: DocumentRow[] = allDocs
    .filter(d => vendorNames.has(d.vendor_id))
    .map(d => ({
      id: d.id,
      vendor_id: d.vendor_id,
      vendor_name: vendorNames.get(d.vendor_id) ?? "Unknown",
      lane: d.lane,
      document_type: d.document_type,
      document_name: d.document_name,
      expires_at: d.expires_at,
      verified: d.verified,
      uploaded_at: d.uploaded_at,
    }))

  return { vendors, reviews, documents }
}
