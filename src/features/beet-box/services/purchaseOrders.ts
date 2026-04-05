import { supabase } from "@/lib/supabase"
import type { PurchaseOrder, POLine, POStatus } from "../types"

export async function getPurchaseOrders(filters?: {
  status?: POStatus | POStatus[]
  vendorName?: string
}): Promise<PurchaseOrder[]> {
  let query = supabase
    .from("bb_purchase_orders")
    .select("*, bb_purchase_order_lines(*)")
    .order("created_at", { ascending: false })

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in("status", statuses)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(mapPORow)
}

export async function getPurchaseOrderById(id: string): Promise<PurchaseOrder | null> {
  const { data, error } = await supabase
    .from("bb_purchase_orders")
    .select("*, bb_purchase_order_lines(*)")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapPORow(data)
}

export async function createPurchaseOrder(payload: {
  vendorName: string
  vendorContact?: string
  expectedDelivery?: string
  notes?: string
  createdBy: string
  lines: Array<{
    partNumber: string
    description: string
    qtyOrdered: number
    unitCost: number
    woRef?: string
  }>
}): Promise<PurchaseOrder> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from("bb_purchase_orders")
    .select("id", { count: "exact", head: true })

  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const poNumber = `PO-${year}-${seq}`

  const { data: po, error: poErr } = await supabase
    .from("bb_purchase_orders")
    .insert({
      po_number: poNumber,
      vendor_name: payload.vendorName,
      vendor_contact: payload.vendorContact ?? null,
      expected_delivery: payload.expectedDelivery ?? null,
      notes: payload.notes ?? null,
      created_by: payload.createdBy,
      status: "draft",
    })
    .select("id")
    .single()

  if (poErr) throw poErr

  if (payload.lines.length > 0) {
    const { error: lineErr } = await supabase
      .from("bb_purchase_order_lines")
      .insert(
        payload.lines.map((l, i) => ({
          purchase_order_id: po.id,
          line_number: i + 1,
          part_number: l.partNumber,
          description: l.description,
          qty_ordered: l.qtyOrdered,
          qty_received: 0,
          unit_cost: l.unitCost,
          wo_ref: l.woRef ?? null,
        }))
      )

    if (lineErr) throw lineErr
  }

  return (await getPurchaseOrderById(po.id))!
}

export async function updatePOStatus(id: string, status: POStatus): Promise<void> {
  const updates: Record<string, unknown> = { status }
  if (status === "received") updates.received_at = new Date().toISOString()

  const { error } = await supabase.from("bb_purchase_orders").update(updates).eq("id", id)
  if (error) throw error
}

// Receiving workflow: update qty_received on a PO line
export async function receivePOLine(
  lineId: string,
  qtyReceived: number
): Promise<void> {
  const { error } = await supabase
    .from("bb_purchase_order_lines")
    .update({ qty_received: qtyReceived })
    .eq("id", lineId)
  if (error) throw error
}

function mapPORow(row: any): PurchaseOrder {
  const lines: POLine[] = ((row.bb_purchase_order_lines ?? []) as any[])
    .sort((a, b) => a.line_number - b.line_number)
    .map((l) => ({
      id: l.id,
      purchaseOrderId: l.purchase_order_id,
      lineNumber: l.line_number,
      partNumber: l.part_number,
      description: l.description,
      qtyOrdered: l.qty_ordered,
      qtyReceived: l.qty_received,
      unitCost: l.unit_cost,
      woRef: l.wo_ref,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    }))

  return {
    id: row.id,
    poNumber: row.po_number,
    vendorName: row.vendor_name,
    vendorContact: row.vendor_contact,
    status: row.status as POStatus,
    createdBy: row.created_by,
    expectedDelivery: row.expected_delivery,
    receivedAt: row.received_at,
    notes: row.notes,
    lines,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
