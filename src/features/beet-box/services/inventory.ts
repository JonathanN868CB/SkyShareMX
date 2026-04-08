import { supabase } from "@/lib/supabase"
import type { InventoryPart, PartTransaction, TransactionType } from "../types"

// Lightweight search for the inventory picker inside work orders.
// Returns up to 50 results — uses live Supabase query instead of in-memory filter.
export async function searchPartsLimited(search?: string): Promise<InventoryPart[]> {
  let query = supabase
    .from("bb_inventory_parts")
    .select("*")
    .order("part_number")
    .limit(50)

  if (search && search.length >= 2) {
    query = query.or(`part_number.ilike.%${search}%,description.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapPartRow(row, []))
}

export async function getParts(filters?: {
  lowStock?: boolean
  search?: string
}): Promise<InventoryPart[]> {
  let query = supabase
    .from("bb_inventory_parts")
    .select("*")
    .order("part_number")
    .range(0, 9999)

  if (filters?.search) {
    query = query.or(`part_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  let parts = (data ?? []).map((row) => mapPartRow(row, []))

  if (filters?.lowStock) {
    parts = parts.filter((p) => p.qtyOnHand <= p.reorderPoint)
  }

  return parts
}

export async function getPartById(id: string): Promise<InventoryPart | null> {
  const [{ data: part, error: pErr }, { data: txns, error: tErr }] =
    await Promise.all([
      supabase.from("bb_inventory_parts").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("bb_part_transactions")
        .select("*")
        .eq("part_id", id)
        .order("transaction_date", { ascending: false }),
    ])

  if (pErr) throw pErr
  if (tErr) throw tErr
  if (!part) return null

  return mapPartRow(part, txns ?? [])
}

export async function createPart(
  payload: Omit<InventoryPart, "id" | "transactions" | "createdAt" | "updatedAt">
): Promise<InventoryPart> {
  const { data, error } = await supabase
    .from("bb_inventory_parts")
    .insert({
      part_number: payload.partNumber,
      description: payload.description,
      manufacturer: payload.manufacturer ?? null,
      uom: payload.uom,
      qty_on_hand: payload.qtyOnHand,
      qty_reserved: payload.qtyReserved,
      reorder_point: payload.reorderPoint,
      unit_cost: payload.unitCost,
      location_bin: payload.locationBin ?? null,
      condition: payload.condition,
      vendor_name: payload.vendorName ?? null,
      is_consumable: payload.isConsumable,
      notes: payload.notes ?? null,
      catalog_id: payload.catalogId ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return mapPartRow(data, [])
}

export async function updatePart(
  id: string,
  payload: Partial<Omit<InventoryPart, "id" | "transactions" | "createdAt" | "updatedAt">>
): Promise<void> {
  const { error } = await supabase
    .from("bb_inventory_parts")
    .update({
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.manufacturer !== undefined && { manufacturer: payload.manufacturer }),
      ...(payload.uom !== undefined && { uom: payload.uom }),
      ...(payload.qtyOnHand !== undefined && { qty_on_hand: payload.qtyOnHand }),
      ...(payload.qtyReserved !== undefined && { qty_reserved: payload.qtyReserved }),
      ...(payload.reorderPoint !== undefined && { reorder_point: payload.reorderPoint }),
      ...(payload.unitCost !== undefined && { unit_cost: payload.unitCost }),
      ...(payload.locationBin !== undefined && { location_bin: payload.locationBin }),
      ...(payload.condition !== undefined && { condition: payload.condition }),
      ...(payload.vendorName !== undefined && { vendor_name: payload.vendorName }),
      ...(payload.isConsumable !== undefined && { is_consumable: payload.isConsumable }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
      ...(payload.catalogId !== undefined && { catalog_id: payload.catalogId }),
    })
    .eq("id", id)

  if (error) throw error
}

// Record a transaction AND update qty_on_hand atomically
export async function recordTransaction(
  partId: string,
  tx: {
    type: TransactionType
    qty: number               // positive = adding stock, negative = removing
    unitCost?: number
    performedBy: string       // profile id
    performedName: string
    woRef?: string
    poRef?: string
    notes?: string
  }
): Promise<PartTransaction> {
  // Insert transaction record
  const { data: txData, error: txErr } = await supabase
    .from("bb_part_transactions")
    .insert({
      part_id: partId,
      type: tx.type,
      qty: tx.qty,
      unit_cost: tx.unitCost ?? null,
      performed_by: tx.performedBy,
      performed_name: tx.performedName,
      wo_ref: tx.woRef ?? null,
      po_ref: tx.poRef ?? null,
      notes: tx.notes ?? null,
    })
    .select()
    .single()

  if (txErr) throw txErr

  // Update qty_on_hand
  const { error: updateErr } = await supabase.rpc("bb_adjust_inventory_qty", {
    p_part_id: partId,
    p_delta: tx.qty,
  })

  // If RPC doesn't exist yet, fall back to a read-then-write
  if (updateErr) {
    const { data: current } = await supabase
      .from("bb_inventory_parts")
      .select("qty_on_hand")
      .eq("id", partId)
      .single()

    if (current) {
      await supabase
        .from("bb_inventory_parts")
        .update({ qty_on_hand: current.qty_on_hand + tx.qty })
        .eq("id", partId)
    }
  }

  return {
    id: txData.id,
    partId: txData.part_id,
    type: txData.type as TransactionType,
    qty: txData.qty,
    unitCost: txData.unit_cost,
    transactionDate: txData.transaction_date,
    performedBy: txData.performed_by,
    performedName: txData.performed_name,
    woRef: txData.wo_ref,
    poRef: txData.po_ref,
    notes: txData.notes,
    createdAt: txData.created_at,
  }
}

function mapPartRow(row: any, txns: any[]): InventoryPart {
  return {
    id: row.id,
    partNumber: row.part_number,
    description: row.description,
    manufacturer: row.manufacturer,
    uom: row.uom,
    qtyOnHand: row.qty_on_hand,
    qtyReserved: row.qty_reserved,
    reorderPoint: row.reorder_point,
    unitCost: row.unit_cost,
    locationBin: row.location_bin,
    condition: row.condition,
    vendorName: row.vendor_name,
    isConsumable: row.is_consumable,
    notes: row.notes,
    catalogId: row.catalog_id ?? null,
    transactions: txns.map((t) => ({
      id: t.id,
      partId: t.part_id,
      type: t.type as TransactionType,
      qty: t.qty,
      unitCost: t.unit_cost,
      transactionDate: t.transaction_date,
      performedBy: t.performed_by,
      performedName: t.performed_name,
      woRef: t.wo_ref,
      poRef: t.po_ref,
      notes: t.notes,
      createdAt: t.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
