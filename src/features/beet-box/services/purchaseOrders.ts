import { supabase } from "@/lib/supabase"
import type {
  PurchaseOrder, POLine, POStatus,
  PartCondition, CertificateType, InspectionStatus, ReceivingRecord,
} from "../types"
import { recordTransaction } from "./inventory"

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

// ─── Vendor lookup for PO creation ─────────────────────────────────────────

export async function getVendorsForPO(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("active", true)
    .order("preferred", { ascending: false })
    .order("name")

  if (error) throw error
  return (data ?? []).map(v => ({ id: v.id, name: v.name }))
}

// ─── Create ────────────────────────────────────────────────────────────────

export async function createPurchaseOrder(payload: {
  vendorId?: string
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
    catalogId?: string
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
      vendor_id: payload.vendorId ?? null,
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
          catalog_id: l.catalogId ?? null,
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

// ─── Receiving workflow with full traceability ─────────────────────────────

export interface ReceiveItemInput {
  lineId: string
  partNumber: string
  description: string
  catalogId?: string
  qty: number
  condition: PartCondition
  serialNumber?: string
  batchLot?: string
  tagNumber?: string
  tagDate?: string
  certifyingAgency?: string
  certificateType?: CertificateType
  inspectionStatus?: InspectionStatus
  locationBin?: string
  notes?: string
}

export async function receiveItems(
  poId: string,
  items: ReceiveItemInput[],
  receivedBy: { id: string; name: string }
): Promise<void> {
  // Get PO number for transaction references
  const { data: poRow } = await supabase
    .from("bb_purchase_orders")
    .select("po_number")
    .eq("id", poId)
    .single()
  const poNumber = poRow?.po_number ?? ""

  for (const item of items) {
    if (item.qty <= 0) continue

    // 1. Insert receiving record
    await supabase.from("bb_receiving_records").insert({
      po_line_id: item.lineId,
      part_number: item.partNumber,
      catalog_id: item.catalogId ?? null,
      qty_received: item.qty,
      condition: item.condition,
      serial_number: item.serialNumber ?? null,
      batch_lot: item.batchLot ?? null,
      tag_number: item.tagNumber ?? null,
      tag_date: item.tagDate ?? null,
      certifying_agency: item.certifyingAgency ?? null,
      certificate_type: item.certificateType ?? "none",
      inspection_status: item.inspectionStatus ?? "accepted",
      location_bin: item.locationBin ?? null,
      received_by: receivedBy.id,
      received_by_name: receivedBy.name,
      notes: item.notes ?? null,
    })

    // 2. Update PO line qty_received
    const { data: line } = await supabase
      .from("bb_purchase_order_lines")
      .select("qty_received")
      .eq("id", item.lineId)
      .single()

    const newTotal = (line?.qty_received ?? 0) + item.qty
    await supabase
      .from("bb_purchase_order_lines")
      .update({ qty_received: newTotal })
      .eq("id", item.lineId)

    // 3. Find or create inventory part, then record transaction
    const { data: inv } = await supabase
      .from("bb_inventory_parts")
      .select("id")
      .eq("part_number", item.partNumber)
      .maybeSingle()

    let partId: string
    if (inv) {
      partId = inv.id
    } else {
      const { data: newInv, error: insErr } = await supabase
        .from("bb_inventory_parts")
        .insert({
          part_number: item.partNumber,
          description: item.description || "",
          qty_on_hand: 0,
          qty_reserved: 0,
          reorder_point: 0,
          unit_cost: 0,
          condition: item.condition,
          uom: "EA",
          is_consumable: false,
          catalog_id: item.catalogId ?? null,
          location_bin: item.locationBin ?? null,
        })
        .select("id")
        .single()
      if (insErr) throw insErr
      partId = newInv.id
    }

    await recordTransaction(partId, {
      type: "receipt",
      qty: item.qty,
      performedBy: receivedBy.id,
      performedName: receivedBy.name,
      poRef: poNumber,
      notes: [
        item.condition !== "new" ? `Condition: ${item.condition}` : "",
        item.serialNumber ? `S/N: ${item.serialNumber}` : "",
        item.tagNumber ? `Tag: ${item.tagNumber}` : "",
        item.notes ?? "",
      ].filter(Boolean).join(" | ") || undefined,
    })
  }

  // 4. Auto-update PO status
  const updated = await getPurchaseOrderById(poId)
  if (updated) {
    const allDone = updated.lines.every(l => l.qtyReceived >= l.qtyOrdered)
    const anyReceived = updated.lines.some(l => l.qtyReceived > 0)
    if (allDone) await updatePOStatus(poId, "received")
    else if (anyReceived && updated.status === "sent") await updatePOStatus(poId, "partial")
  }
}

// ─── Receiving history ─────────────────────────────────────────────────────

export async function getReceivingRecords(poId: string): Promise<ReceivingRecord[]> {
  // Get all line IDs for this PO
  const { data: lines } = await supabase
    .from("bb_purchase_order_lines")
    .select("id")
    .eq("purchase_order_id", poId)

  if (!lines || lines.length === 0) return []

  const lineIds = lines.map(l => l.id)
  const { data, error } = await supabase
    .from("bb_receiving_records")
    .select("*")
    .in("po_line_id", lineIds)
    .order("received_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((r: any) => ({
    id: r.id,
    poLineId: r.po_line_id,
    partNumber: r.part_number,
    catalogId: r.catalog_id,
    qtyReceived: r.qty_received,
    condition: r.condition,
    serialNumber: r.serial_number,
    batchLot: r.batch_lot,
    tagNumber: r.tag_number,
    tagDate: r.tag_date,
    certifyingAgency: r.certifying_agency,
    certificateType: r.certificate_type,
    inspectionStatus: r.inspection_status,
    locationBin: r.location_bin,
    receivedBy: r.received_by,
    receivedByName: r.received_by_name,
    receivedAt: r.received_at,
    notes: r.notes,
    createdAt: r.created_at,
  }))
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
      catalogId: l.catalog_id ?? null,
      createdAt: l.created_at,
      updatedAt: l.updated_at,
    }))

  return {
    id: row.id,
    poNumber: row.po_number,
    vendorId: row.vendor_id ?? null,
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
