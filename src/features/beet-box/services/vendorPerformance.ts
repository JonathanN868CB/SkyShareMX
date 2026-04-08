import { supabase } from "@/lib/supabase"

// ─── Vendor Performance Metrics ──────────────────────────────────────────────

export interface VendorMetric {
  vendorId: string
  vendorName: string
  city: string | null
  state: string | null
  airportCode: string | null
  preferred: boolean
  approvalStatus: string | null
  specialties: string[]
  // PO metrics
  totalPOs: number
  totalSpend: number
  totalLinesOrdered: number
  totalLinesReceived: number
  fillRate: number | null      // % of ordered qty that was received
  // Receiving metrics
  totalReceivingRecords: number
  avgLeadTimeDays: number | null  // from PO created → received
  // Catalog links
  catalogPartsLinked: number
}

export async function getVendorPerformance(): Promise<VendorMetric[]> {
  // 1. Load all vendors
  const { data: vendors, error: vErr } = await supabase
    .from("vendors")
    .select("id, name, city, state, airport_code, preferred, approval_status, specialties")
    .eq("active", true)
    .order("name")

  if (vErr) throw vErr
  if (!vendors || vendors.length === 0) return []

  // 2. Load POs with lines
  const { data: pos } = await supabase
    .from("bb_purchase_orders")
    .select("id, vendor_id, vendor_name, status, created_at, received_at, bb_purchase_order_lines(qty_ordered, qty_received, unit_cost)")

  // 3. Load catalog vendor links
  const { data: catLinks } = await supabase
    .from("parts_catalog_vendors")
    .select("vendor_id")

  // Build catalog link counts
  const catLinkCounts = new Map<string, number>()
  for (const link of catLinks ?? []) {
    catLinkCounts.set(link.vendor_id, (catLinkCounts.get(link.vendor_id) ?? 0) + 1)
  }

  // Build PO metrics per vendor
  const poMetrics = new Map<string, {
    totalPOs: number; totalSpend: number; totalOrdered: number; totalReceived: number
    totalRecords: number; leadTimes: number[]
  }>()

  for (const po of pos ?? []) {
    const key = po.vendor_id ?? po.vendor_name
    if (!key) continue

    const prev = poMetrics.get(key) ?? {
      totalPOs: 0, totalSpend: 0, totalOrdered: 0, totalReceived: 0,
      totalRecords: 0, leadTimes: [],
    }

    prev.totalPOs++
    const lines = (po as any).bb_purchase_order_lines ?? []
    for (const line of lines) {
      prev.totalSpend += (line.qty_ordered ?? 0) * (line.unit_cost ?? 0)
      prev.totalOrdered += line.qty_ordered ?? 0
      prev.totalReceived += line.qty_received ?? 0
    }

    // Lead time: created_at → received_at
    if (po.received_at && po.created_at) {
      const days = Math.ceil(
        (new Date(po.received_at).getTime() - new Date(po.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (days >= 0) prev.leadTimes.push(days)
    }

    poMetrics.set(key, prev)
  }

  return vendors.map(v => {
    // Try matching by vendor_id first, then by name
    const m = poMetrics.get(v.id) ?? poMetrics.get(v.name)
    const avgLead = m?.leadTimes.length
      ? m.leadTimes.reduce((s, d) => s + d, 0) / m.leadTimes.length
      : null

    return {
      vendorId: v.id,
      vendorName: v.name,
      city: v.city,
      state: v.state,
      airportCode: v.airport_code,
      preferred: v.preferred ?? false,
      approvalStatus: v.approval_status,
      specialties: v.specialties ?? [],
      totalPOs: m?.totalPOs ?? 0,
      totalSpend: m?.totalSpend ?? 0,
      totalLinesOrdered: m?.totalOrdered ?? 0,
      totalLinesReceived: m?.totalReceived ?? 0,
      fillRate: m && m.totalOrdered > 0
        ? Math.round((m.totalReceived / m.totalOrdered) * 100)
        : null,
      totalReceivingRecords: m?.totalRecords ?? 0,
      avgLeadTimeDays: avgLead !== null ? Math.round(avgLead) : null,
      catalogPartsLinked: catLinkCounts.get(v.id) ?? 0,
    }
  })
}

// ─── Vendor Summary Stats ────────────────────────────────────────────────────

export interface VendorSummaryStats {
  totalVendors: number
  preferredVendors: number
  withPOs: number
  totalSpend: number
  avgLeadTime: number | null
}

export async function getVendorSummaryStats(): Promise<VendorSummaryStats> {
  const metrics = await getVendorPerformance()

  const withPOs = metrics.filter(m => m.totalPOs > 0)
  const leadTimes = withPOs.filter(m => m.avgLeadTimeDays !== null).map(m => m.avgLeadTimeDays!)
  const avgLead = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length)
    : null

  return {
    totalVendors: metrics.length,
    preferredVendors: metrics.filter(m => m.preferred).length,
    withPOs: withPOs.length,
    totalSpend: metrics.reduce((s, m) => s + m.totalSpend, 0),
    avgLeadTime: avgLead,
  }
}
