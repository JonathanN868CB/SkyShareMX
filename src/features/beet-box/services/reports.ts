import { supabase } from "@/lib/supabase"

// ─── Inventory Analytics ──────────────────────────────���──────────────────────

export interface InventoryAnalytics {
  totalParts: number
  totalQuantity: number
  totalValue: number
  zeroStock: number
  lowStock: number       // 1–5
  mediumStock: number    // 6–50
  highStock: number      // 51+
  withLocation: number
  withoutLocation: number
  conditionBreakdown: Array<{ condition: string; count: number; totalQty: number; totalValue: number }>
  topByQuantity: Array<{ partNumber: string; description: string; qtyOnHand: number; locationBin: string | null }>
  topByValue: Array<{ partNumber: string; description: string; qtyOnHand: number; unitCost: number; totalValue: number }>
  locationSummary: Array<{ location: string; partCount: number; totalQty: number }>
}

export async function getInventoryAnalytics(): Promise<InventoryAnalytics> {
  const { data: all, error } = await supabase
    .from("bb_inventory_parts")
    .select("id, part_number, description, qty_on_hand, unit_cost, reorder_point, location_bin, condition")
    .range(0, 9999)

  if (error) throw error
  const parts = all ?? []

  const totalParts = parts.length
  const totalQuantity = parts.reduce((s, p) => s + (p.qty_on_hand ?? 0), 0)
  const totalValue = parts.reduce((s, p) => s + (p.qty_on_hand ?? 0) * (p.unit_cost ?? 0), 0)

  const zeroStock = parts.filter(p => p.qty_on_hand === 0).length
  const lowStock = parts.filter(p => p.qty_on_hand >= 1 && p.qty_on_hand <= 5).length
  const mediumStock = parts.filter(p => p.qty_on_hand >= 6 && p.qty_on_hand <= 50).length
  const highStock = parts.filter(p => p.qty_on_hand > 50).length

  const withLocation = parts.filter(p => p.location_bin).length
  const withoutLocation = parts.filter(p => !p.location_bin).length

  // Condition breakdown
  const condMap = new Map<string, { count: number; totalQty: number; totalValue: number }>()
  for (const p of parts) {
    const c = p.condition ?? "unknown"
    const prev = condMap.get(c) ?? { count: 0, totalQty: 0, totalValue: 0 }
    prev.count++
    prev.totalQty += p.qty_on_hand ?? 0
    prev.totalValue += (p.qty_on_hand ?? 0) * (p.unit_cost ?? 0)
    condMap.set(c, prev)
  }
  const conditionBreakdown = Array.from(condMap.entries())
    .map(([condition, v]) => ({ condition, ...v }))
    .sort((a, b) => b.totalQty - a.totalQty)

  // Top 20 by quantity
  const topByQuantity = [...parts]
    .sort((a, b) => (b.qty_on_hand ?? 0) - (a.qty_on_hand ?? 0))
    .slice(0, 20)
    .map(p => ({
      partNumber: p.part_number,
      description: p.description ?? "",
      qtyOnHand: p.qty_on_hand,
      locationBin: p.location_bin,
    }))

  // Top 20 by value
  const topByValue = [...parts]
    .sort((a, b) => ((b.qty_on_hand ?? 0) * (b.unit_cost ?? 0)) - ((a.qty_on_hand ?? 0) * (a.unit_cost ?? 0)))
    .slice(0, 20)
    .map(p => ({
      partNumber: p.part_number,
      description: p.description ?? "",
      qtyOnHand: p.qty_on_hand,
      unitCost: p.unit_cost ?? 0,
      totalValue: (p.qty_on_hand ?? 0) * (p.unit_cost ?? 0),
    }))

  // Location summary — top storage areas by part count
  const locMap = new Map<string, { partCount: number; totalQty: number }>()
  for (const p of parts) {
    if (!p.location_bin) continue
    // Normalize: take the main location prefix (e.g., "CABINET 1" from "CABINET 1 SHELF 2 BOX 3")
    const loc = normalizeLocation(p.location_bin)
    const prev = locMap.get(loc) ?? { partCount: 0, totalQty: 0 }
    prev.partCount++
    prev.totalQty += p.qty_on_hand ?? 0
    locMap.set(loc, prev)
  }
  const locationSummary = Array.from(locMap.entries())
    .map(([location, v]) => ({ location, ...v }))
    .sort((a, b) => b.partCount - a.partCount)
    .slice(0, 20)

  return {
    totalParts, totalQuantity, totalValue,
    zeroStock, lowStock, mediumStock, highStock,
    withLocation, withoutLocation,
    conditionBreakdown, topByQuantity, topByValue, locationSummary,
  }
}

function normalizeLocation(bin: string): string {
  // Group by first meaningful segment: "CABINET 1", "G6", "H2", "CJ Cabinet A", etc.
  const upper = bin.trim().toUpperCase()
  // Match patterns like "CABINET 1", "G6", "H2", "CJ CABINET A"
  const match = upper.match(/^([A-Z]+(?:\s*\d+)?(?:\s+[A-Z]+)?)/i)
  return match ? match[1].trim() : upper.slice(0, 20)
}

// ─── Work Order Metrics ──────────────────────────────────────────────────────

export interface WOMetrics {
  total: number
  byStatus: Record<string, number>
  avgItemsPerWO: number
  totalLaborHours: number
  totalPartsUsed: number
  recentActivity: Array<{
    id: string; woNumber: string; status: string; description: string | null
    itemCount: number; openedAt: string
  }>
}

export async function getWOMetrics(): Promise<WOMetrics> {
  const [woRes, itemRes, laborRes, partsRes] = await Promise.all([
    supabase.from("bb_work_orders").select("id, wo_number, status, description, opened_at").range(0, 9999),
    supabase.from("bb_work_order_items").select("id, work_order_id").range(0, 9999),
    supabase.from("bb_work_order_item_labor").select("hours").range(0, 9999),
    supabase.from("bb_work_order_item_parts").select("qty").range(0, 9999),
  ])

  const wos = woRes.data ?? []
  const items = itemRes.data ?? []

  const total = wos.length
  const byStatus: Record<string, number> = {}
  for (const wo of wos) {
    byStatus[wo.status] = (byStatus[wo.status] ?? 0) + 1
  }

  // Items per WO
  const woItemCounts = new Map<string, number>()
  for (const item of items) {
    woItemCounts.set(item.work_order_id, (woItemCounts.get(item.work_order_id) ?? 0) + 1)
  }
  const avgItemsPerWO = total > 0 ? items.length / total : 0

  const totalLaborHours = (laborRes.data ?? []).reduce((s, r) => s + (r.hours ?? 0), 0)
  const totalPartsUsed = (partsRes.data ?? []).reduce((s, r) => s + (r.qty ?? 0), 0)

  // Recent WOs
  const recentActivity = wos
    .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
    .slice(0, 10)
    .map(wo => ({
      id: wo.id,
      woNumber: wo.wo_number,
      status: wo.status,
      description: wo.description,
      itemCount: woItemCounts.get(wo.id) ?? 0,
      openedAt: wo.opened_at,
    }))

  return { total, byStatus, avgItemsPerWO, totalLaborHours, totalPartsUsed, recentActivity }
}

// ─── Purchasing Summary ──────���───────────────────────────────────────────────

export interface PurchasingSummary {
  totalPOs: number
  byStatus: Record<string, number>
  totalSpend: number
  totalReceived: number
  vendorBreakdown: Array<{ vendorName: string; poCount: number; totalSpend: number }>
}

export async function getPurchasingSummary(): Promise<PurchasingSummary> {
  const { data: pos, error } = await supabase
    .from("bb_purchase_orders")
    .select("id, vendor_name, status, bb_purchase_order_lines(qty_ordered, qty_received, unit_cost)")
    .range(0, 9999)

  if (error) throw error
  const orders = pos ?? []

  const totalPOs = orders.length
  const byStatus: Record<string, number> = {}
  let totalSpend = 0
  let totalReceived = 0

  const vendorMap = new Map<string, { poCount: number; totalSpend: number }>()

  for (const po of orders) {
    byStatus[po.status] = (byStatus[po.status] ?? 0) + 1
    const lines = (po as any).bb_purchase_order_lines ?? []
    let poSpend = 0
    for (const line of lines) {
      poSpend += (line.qty_ordered ?? 0) * (line.unit_cost ?? 0)
      totalReceived += line.qty_received ?? 0
    }
    totalSpend += poSpend

    const vName = po.vendor_name ?? "Unknown"
    const prev = vendorMap.get(vName) ?? { poCount: 0, totalSpend: 0 }
    prev.poCount++
    prev.totalSpend += poSpend
    vendorMap.set(vName, prev)
  }

  const vendorBreakdown = Array.from(vendorMap.entries())
    .map(([vendorName, v]) => ({ vendorName, ...v }))
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 15)

  return { totalPOs, byStatus, totalSpend, totalReceived, vendorBreakdown }
}

// ─── Catalog Summary ───────��─────────────────────────���───────────────────────

export interface CatalogSummary {
  totalEntries: number
  byPartType: Record<string, number>
  serialized: number
  rotable: number
  shelfLife: number
}

export async function getCatalogSummary(): Promise<CatalogSummary> {
  const { data, error } = await supabase
    .from("parts_catalog")
    .select("id, part_type, is_serialized, is_rotable, is_shelf_life")
    .range(0, 9999)

  if (error) throw error
  const entries = data ?? []

  const totalEntries = entries.length
  const byPartType: Record<string, number> = {}
  let serialized = 0, rotable = 0, shelfLife = 0

  for (const e of entries) {
    const t = e.part_type ?? "unclassified"
    byPartType[t] = (byPartType[t] ?? 0) + 1
    if (e.is_serialized) serialized++
    if (e.is_rotable) rotable++
    if (e.is_shelf_life) shelfLife++
  }

  return { totalEntries, byPartType, serialized, rotable, shelfLife }
}
