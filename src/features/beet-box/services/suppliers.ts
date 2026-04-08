import { supabase } from "@/lib/supabase"
import type { PartsSupplier, SupplierType, SupplierApprovalStatus } from "../types"

// ─── List / Get ──────────────────────────────────────────────────────────────

export async function getSuppliers(filters?: {
  active?: boolean
  approvalStatus?: SupplierApprovalStatus
  vendorType?: SupplierType
}): Promise<PartsSupplier[]> {
  let query = supabase
    .from("bb_parts_suppliers")
    .select("*")
    .order("name")

  if (filters?.active !== undefined) query = query.eq("active", filters.active)
  if (filters?.approvalStatus) query = query.eq("approval_status", filters.approvalStatus)
  if (filters?.vendorType) query = query.eq("vendor_type", filters.vendorType)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(mapSupplierRow)
}

export async function getSupplierById(id: string): Promise<PartsSupplier | null> {
  const { data, error } = await supabase
    .from("bb_parts_suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapSupplierRow(data)
}

// ─── Create / Update ─────────────────────────────────────────────────────────

export interface SupplierInput {
  name: string
  vendorType: SupplierType
  approvalStatus?: SupplierApprovalStatus
  approvalDate?: string
  certificateType?: string
  certificateNumber?: string
  traceabilityVerified?: boolean
  lastAuditDate?: string
  contactName?: string
  phone?: string
  email?: string
  accountNumber?: string
  website?: string
  notes?: string
}

export async function createSupplier(input: SupplierInput): Promise<PartsSupplier> {
  const { data, error } = await supabase
    .from("bb_parts_suppliers")
    .insert({
      name: input.name,
      vendor_type: input.vendorType,
      approval_status: input.approvalStatus ?? "pending",
      approval_date: input.approvalDate ?? null,
      certificate_type: input.certificateType ?? null,
      certificate_number: input.certificateNumber ?? null,
      traceability_verified: input.traceabilityVerified ?? false,
      last_audit_date: input.lastAuditDate ?? null,
      contact_name: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      account_number: input.accountNumber ?? null,
      website: input.website ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single()

  if (error) throw error
  return mapSupplierRow(data)
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<PartsSupplier> {
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.vendorType !== undefined) updates.vendor_type = input.vendorType
  if (input.approvalStatus !== undefined) updates.approval_status = input.approvalStatus
  if (input.approvalDate !== undefined) updates.approval_date = input.approvalDate || null
  if (input.certificateType !== undefined) updates.certificate_type = input.certificateType || null
  if (input.certificateNumber !== undefined) updates.certificate_number = input.certificateNumber || null
  if (input.traceabilityVerified !== undefined) updates.traceability_verified = input.traceabilityVerified
  if (input.lastAuditDate !== undefined) updates.last_audit_date = input.lastAuditDate || null
  if (input.contactName !== undefined) updates.contact_name = input.contactName || null
  if (input.phone !== undefined) updates.phone = input.phone || null
  if (input.email !== undefined) updates.email = input.email || null
  if (input.accountNumber !== undefined) updates.account_number = input.accountNumber || null
  if (input.website !== undefined) updates.website = input.website || null
  if (input.notes !== undefined) updates.notes = input.notes || null

  const { data, error } = await supabase
    .from("bb_parts_suppliers")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single()

  if (error) throw error
  return mapSupplierRow(data)
}

export async function deactivateSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from("bb_parts_suppliers")
    .update({ active: false })
    .eq("id", id)
  if (error) throw error
}

export async function reactivateSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from("bb_parts_suppliers")
    .update({ active: true })
    .eq("id", id)
  if (error) throw error
}

// ─── Supplier Performance (derived from PO data) ────────────────────────────

export interface SupplierPerformance {
  supplierId: string
  totalPOs: number
  totalSpend: number
  totalLinesOrdered: number
  totalLinesReceived: number
  fillRate: number | null
  avgLeadTimeDays: number | null
  lastUsedDate: string | null
}

export async function getSupplierPerformance(supplierId: string): Promise<SupplierPerformance> {
  // Get the supplier name for PO matching
  const { data: supplier } = await supabase
    .from("bb_parts_suppliers")
    .select("id, name")
    .eq("id", supplierId)
    .single()

  if (!supplier) {
    return { supplierId, totalPOs: 0, totalSpend: 0, totalLinesOrdered: 0, totalLinesReceived: 0, fillRate: null, avgLeadTimeDays: null, lastUsedDate: null }
  }

  // Match POs by vendor_id or vendor_name
  const { data: posByName } = await supabase
    .from("bb_purchase_orders")
    .select("id, status, created_at, received_at, bb_purchase_order_lines(qty_ordered, qty_received, unit_cost)")
    .eq("vendor_name", supplier.name)
    .range(0, 9999)

  const { data: posById } = await supabase
    .from("bb_purchase_orders")
    .select("id, status, created_at, received_at, bb_purchase_order_lines(qty_ordered, qty_received, unit_cost)")
    .eq("vendor_id", supplierId)
    .range(0, 9999)

  // Merge, deduplicate by PO id
  const poMap = new Map<string, any>()
  for (const po of [...(posById ?? []), ...(posByName ?? [])]) {
    poMap.set(po.id, po)
  }
  const allPOs = Array.from(poMap.values())

  let totalSpend = 0
  let totalOrdered = 0
  let totalReceived = 0
  const leadTimes: number[] = []
  let lastUsed: string | null = null

  for (const po of allPOs) {
    const lines = (po as any).bb_purchase_order_lines ?? []
    for (const line of lines) {
      totalSpend += (line.qty_ordered ?? 0) * (line.unit_cost ?? 0)
      totalOrdered += line.qty_ordered ?? 0
      totalReceived += line.qty_received ?? 0
    }
    if (po.received_at && po.created_at) {
      const days = Math.ceil(
        (new Date(po.received_at).getTime() - new Date(po.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (days >= 0) leadTimes.push(days)
    }
    // Track most recent PO date
    if (!lastUsed || po.created_at > lastUsed) lastUsed = po.created_at
  }

  const avgLead = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length)
    : null

  return {
    supplierId,
    totalPOs: allPOs.length,
    totalSpend,
    totalLinesOrdered: totalOrdered,
    totalLinesReceived: totalReceived,
    fillRate: totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : null,
    avgLeadTimeDays: avgLead,
    lastUsedDate: lastUsed,
  }
}

// ─── Supplier lookup for PO creation ─────────────────────────────────────────

export async function getApprovedSuppliers(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("bb_parts_suppliers")
    .select("id, name")
    .eq("active", true)
    .eq("approval_status", "approved")
    .order("name")

  if (error) throw error
  return (data ?? []).map(s => ({ id: s.id, name: s.name }))
}

// ─── Row mapper ──────────────────────────────────────────────────────────────

function mapSupplierRow(row: any): PartsSupplier {
  return {
    id: row.id,
    name: row.name,
    vendorType: row.vendor_type,
    approvalStatus: row.approval_status,
    approvalDate: row.approval_date,
    certificateType: row.certificate_type,
    certificateNumber: row.certificate_number,
    traceabilityVerified: row.traceability_verified,
    lastAuditDate: row.last_audit_date,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    accountNumber: row.account_number,
    website: row.website,
    notes: row.notes,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
