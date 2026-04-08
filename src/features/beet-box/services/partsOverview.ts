import { supabase } from "@/lib/supabase"

// ─── Parts Overview Stats ────────────────────────────────────────────────────

export interface PartsOverviewStats {
  totalValue: number
  belowReorder: number
  openPOs: number
  receiptsThisMonth: number
}

export async function getPartsOverviewStats(): Promise<PartsOverviewStats> {
  // Run all four queries in parallel
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [invRes, reorderRes, poRes, recRes] = await Promise.all([
    // Total inventory value
    supabase
      .from("bb_inventory_parts")
      .select("qty_on_hand, unit_cost")
      .range(0, 9999),

    // Below reorder point
    supabase
      .from("bb_inventory_parts")
      .select("id", { count: "exact", head: true })
      .gt("reorder_point", 0)
      .filter("qty_on_hand", "lte", "reorder_point"),

    // Open POs
    supabase
      .from("bb_purchase_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["draft", "sent", "partial"]),

    // Receipts this month
    supabase
      .from("bb_receiving_records")
      .select("id", { count: "exact", head: true })
      .gte("received_at", startOfMonth.toISOString()),
  ])

  const totalValue = (invRes.data ?? []).reduce(
    (sum, r) => sum + (r.qty_on_hand ?? 0) * (r.unit_cost ?? 0),
    0
  )

  return {
    totalValue,
    belowReorder: reorderRes.count ?? 0,
    openPOs: poRes.count ?? 0,
    receiptsThisMonth: recRes.count ?? 0,
  }
}

// ─── Reorder Alerts ──────────────────────────────────────────────────────────

export interface ReorderAlert {
  id: string
  partNumber: string
  description: string
  qtyOnHand: number
  reorderPoint: number
  deficit: number
  lastPODate: string | null
}

export async function getReorderAlerts(): Promise<ReorderAlert[]> {
  // Parts at or below reorder point (where reorder_point > 0)
  const { data, error } = await supabase
    .from("bb_inventory_parts")
    .select("id, part_number, description, qty_on_hand, reorder_point")
    .gt("reorder_point", 0)
    .filter("qty_on_hand", "lte", "reorder_point")
    .order("qty_on_hand", { ascending: true })
    .range(0, 9999)

  if (error) throw error
  if (!data || data.length === 0) return []

  // For each part, try to find the most recent PO line date
  const partNumbers = data.map(r => r.part_number)
  const { data: poLines } = await supabase
    .from("bb_purchase_order_lines")
    .select("part_number, created_at")
    .in("part_number", partNumbers)
    .range(0, 9999)
    .order("created_at", { ascending: false })

  // Build a map: partNumber → most recent PO date
  const lastPOMap = new Map<string, string>()
  for (const line of poLines ?? []) {
    if (!lastPOMap.has(line.part_number)) {
      lastPOMap.set(line.part_number, line.created_at)
    }
  }

  return data.map(r => ({
    id: r.id,
    partNumber: r.part_number,
    description: r.description ?? "",
    qtyOnHand: r.qty_on_hand,
    reorderPoint: r.reorder_point,
    deficit: r.reorder_point - r.qty_on_hand,
    lastPODate: lastPOMap.get(r.part_number) ?? null,
  }))
}

// ─── Recent Receiving Activity ───────────────────────────────────────────────

export interface RecentReceiving {
  id: string
  receivedAt: string
  poNumber: string
  partNumber: string
  qtyReceived: number
  condition: string
  receivedByName: string
}

export async function getRecentReceivingActivity(
  limit = 10
): Promise<RecentReceiving[]> {
  // Get recent receiving records with their PO line → PO join
  const { data, error } = await supabase
    .from("bb_receiving_records")
    .select(`
      id, received_at, part_number, qty_received, condition, received_by_name,
      bb_purchase_order_lines!inner( purchase_order_id, bb_purchase_orders!inner( po_number ) )
    `)
    .order("received_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((r: any) => ({
    id: r.id,
    receivedAt: r.received_at,
    poNumber: r.bb_purchase_order_lines?.bb_purchase_orders?.po_number ?? "—",
    partNumber: r.part_number,
    qtyReceived: r.qty_received,
    condition: r.condition,
    receivedByName: r.received_by_name,
  }))
}

// ─── Transaction Volume Summary ──────────────────────────────────────────────

export async function getTransactionSummary(
  days = 30
): Promise<Record<string, number>> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data, error } = await supabase
    .from("bb_part_transactions")
    .select("type")
    .gte("transaction_date", since.toISOString())
    .range(0, 9999)

  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.type] = (counts[row.type] ?? 0) + 1
  }
  return counts
}
