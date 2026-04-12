import { supabase } from "@/lib/supabase"
import type {
  PurchaseOrder, POLine, POStatus, POLineStatus,
  PartCondition, CertificateType, InspectionStatus, ReceivingRecord,
  POInvoice, POActivity,
} from "../types"
import { recordTransaction } from "./inventory"
import { notifyProfileIds } from "@/features/parts/helpers"
import { getMyProfile } from "./workOrders"

export async function getPurchaseOrders(filters?: {
  status?: POStatus | POStatus[]
  vendorName?: string
  showArchived?: boolean
}): Promise<PurchaseOrder[]> {
  let query = supabase
    .from("bb_purchase_orders")
    .select("*, bb_purchase_order_lines(*)")
    .order("created_at", { ascending: false })
    .range(0, 9999)

  if (filters?.showArchived) {
    query = query.not("archived_at", "is", null)
  } else {
    query = query.is("archived_at", null)
  }

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
  // Pull from bb_parts_suppliers (approved parts suppliers, NOT maintenance vendors)
  const { getApprovedSuppliers } = await import("./suppliers")
  return getApprovedSuppliers()
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
    partsRequestLineId?: string | null
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
      vendor_id: null,
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
          parts_request_line_id: l.partsRequestLineId ?? null,
        }))
      )

    if (lineErr) throw lineErr
  }

  // Auto-advance linked parts requests to "ordered"
  const requestLineIds = payload.lines
    .filter(l => l.partsRequestLineId)
    .map(l => l.partsRequestLineId as string)

  if (requestLineIds.length > 0) {
    const { data: reqLines } = await supabase
      .from("parts_request_lines")
      .select("request_id")
      .in("id", requestLineIds)

    const requestIds = [...new Set((reqLines ?? []).map((l: any) => l.request_id))]

    for (const rid of requestIds) {
      const { data: req } = await supabase
        .from("parts_requests")
        .select("status")
        .eq("id", rid)
        .single()

      if (req && !["ordered", "shipped", "received", "closed", "cancelled", "denied"].includes(req.status)) {
        await supabase.from("parts_requests").update({ status: "ordered" }).eq("id", rid)
        try {
          await supabase.from("parts_status_history").insert({
            request_id: rid,
            old_status: req.status,
            new_status: "ordered",
            changed_by: payload.createdBy,
            note: `PO ${poNumber} created`,
          })
        } catch { /* non-critical */ }
      }
    }
  }

  const result = (await getPurchaseOrderById(po.id))!

  // Log creation activity
  try {
    await addPOActivity(result.id, {
      type: "system",
      message: `Purchase order ${poNumber} created`,
    })
  } catch { /* non-critical */ }

  return result
}

export async function updatePOStatus(
  id: string,
  status: POStatus,
  opts?: { skipActivity?: boolean; fromStatus?: POStatus }
): Promise<void> {
  const updates: Record<string, unknown> = { status }
  if (status === "received") updates.received_at = new Date().toISOString()

  const { error } = await supabase.from("bb_purchase_orders").update(updates).eq("id", id)
  if (error) throw error

  if (!opts?.skipActivity) {
    const from = opts?.fromStatus ? `${opts.fromStatus} → ` : ""
    // Fire-and-forget — don't block on activity write failure
    try {
      await addPOActivity(id, {
        type: "status_change",
        message: `Status changed: ${from}${status}`,
      })
    } catch { /* non-critical */ }
  }
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
      purchase_order_id: poId,
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
      .select("qty_received, parts_request_line_id")
      .eq("id", item.lineId)
      .single()

    const newTotal = (line?.qty_received ?? 0) + item.qty
    // Determine new line_status based on receipt qty
    const qtyOrdered = await supabase
      .from("bb_purchase_order_lines")
      .select("qty_ordered")
      .eq("id", item.lineId)
      .single()
    const newLineStatus = newTotal >= (qtyOrdered.data?.qty_ordered ?? 0) ? "received" : "shipped"
    await supabase
      .from("bb_purchase_order_lines")
      .update({ qty_received: newTotal, line_status: newLineStatus })
      .eq("id", item.lineId)

    // 2b. If this PO line links to a parts request line, mark it received
    if (line?.parts_request_line_id) {
      await supabase
        .from("parts_request_lines")
        .update({ line_status: "received", po_number: poNumber })
        .eq("id", line.parts_request_line_id)
    }

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
    if (allDone) await updatePOStatus(poId, "received", { skipActivity: true })
    else if (anyReceived && updated.status === "sent") await updatePOStatus(poId, "partial", { skipActivity: true })
  }

  // 5. Write receive activity entry
  const partList = items.filter(i => i.qty > 0).map(i => `${i.qty}× ${i.partNumber}`).join(", ")
  try {
    await addPOActivity(poId, {
      type: "receive",
      message: `Received by ${receivedBy.name}: ${partList}`,
    })
  } catch { /* non-critical */ }

  // 5. Check if any parts requests are now fully received via this PO
  // Collect distinct request IDs linked through PO lines
  const { data: linkedLines } = await supabase
    .from("bb_purchase_order_lines")
    .select("parts_request_line_id")
    .eq("purchase_order_id", poId)
    .not("parts_request_line_id", "is", null)

  if (linkedLines && linkedLines.length > 0) {
    const requestLineIds = linkedLines.map((l: any) => l.parts_request_line_id)

    // Find which requests these lines belong to
    const { data: reqLines } = await supabase
      .from("parts_request_lines")
      .select("request_id")
      .in("id", requestLineIds)

    const requestIds = [...new Set((reqLines ?? []).map((l: any) => l.request_id))]

    for (const requestId of requestIds) {
      // Check if all lines on this request are received
      const { data: allReqLines } = await supabase
        .from("parts_request_lines")
        .select("line_status")
        .eq("request_id", requestId)

      const allReceived = allReqLines?.every(l => l.line_status === "received") ?? false
      if (!allReceived) continue

      // Update request header
      const { data: reqHeader } = await supabase
        .from("parts_requests")
        .select("status, requested_by, work_order, job_description, aircraft_tail, order_type")
        .eq("id", requestId)
        .single()

      if (!reqHeader || reqHeader.status === "received" || reqHeader.status === "closed") continue

      await supabase
        .from("parts_requests")
        .update({ status: "received" })
        .eq("id", requestId)

      await supabase.from("parts_status_history").insert({
        request_id: requestId,
        old_status: reqHeader.status,
        new_status: "received",
        changed_by: receivedBy.id,
        note: `Received via PO ${poNumber}`,
      })

      // Notify the mechanic
      const jobLabel = reqHeader.order_type === "stock"
        ? `Stock — ${reqHeader.job_description}`
        : `${reqHeader.aircraft_tail} — ${reqHeader.job_description}`

      await notifyProfileIds(
        [reqHeader.requested_by],
        "parts_received",
        "Parts have arrived",
        `Your parts for ${jobLabel} have been received${reqHeader.work_order ? ` — WO# ${reqHeader.work_order}` : ""}`,
        { link: `/app/beet-box/parts/${requestId}` }
      )
    }
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

// ─── Update PO line fields ──────────────────────────────────────────────────

export async function updatePOLine(lineId: string, updates: {
  lineStatus?: string
  vendorPartNumber?: string
  lineNotes?: string
  lineExpectedDelivery?: string | null
  qtyOrdered?: number
  unitCost?: number
  partNumber?: string
  description?: string
}): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (updates.lineStatus !== undefined) patch.line_status = updates.lineStatus
  if (updates.vendorPartNumber !== undefined) patch.vendor_part_number = updates.vendorPartNumber
  if (updates.lineNotes !== undefined) patch.line_notes = updates.lineNotes
  if ("lineExpectedDelivery" in updates) patch.line_expected_delivery = updates.lineExpectedDelivery ?? null
  if (updates.qtyOrdered !== undefined) patch.qty_ordered = updates.qtyOrdered
  if (updates.unitCost !== undefined) patch.unit_cost = updates.unitCost
  if (updates.partNumber !== undefined) patch.part_number = updates.partNumber
  if (updates.description !== undefined) patch.description = updates.description
  const { error } = await supabase.from("bb_purchase_order_lines").update(patch).eq("id", lineId)
  if (error) throw error
}

// ─── Update PO shipping/tracking ───────────────────────────────────────────

export async function updatePOTracking(poId: string, updates: {
  carrier?: string
  trackingNumber?: string
  trackingStatus?: string
}): Promise<void> {
  const { error } = await supabase
    .from("bb_purchase_orders")
    .update({
      carrier: updates.carrier,
      tracking_number: updates.trackingNumber,
      tracking_status: updates.trackingStatus,
      tracking_updated_at: new Date().toISOString(),
    })
    .eq("id", poId)
  if (error) throw error
}

// ─── Linked work orders ─────────────────────────────────────────────────────

export async function getLinkedWorkOrders(poId: string): Promise<{
  id: string; woNumber: string; description: string | null; status: string
  aircraft: string | null
}[]> {
  const { data: lines } = await supabase
    .from("bb_purchase_order_lines")
    .select("wo_ref")
    .eq("purchase_order_id", poId)
    .not("wo_ref", "is", null)

  if (!lines || lines.length === 0) return []

  const woRefs = [...new Set(lines.map((l: any) => l.wo_ref).filter(Boolean))]
  if (woRefs.length === 0) return []

  const { data, error } = await supabase
    .from("bb_work_orders")
    .select("id, wo_number, description, status, guest_registration")
    .in("wo_number", woRefs)

  if (error) throw error
  return (data ?? []).map((w: any) => ({
    id: w.id,
    woNumber: w.wo_number,
    description: w.description,
    status: w.status,
    aircraft: w.guest_registration ?? null,
  }))
}

// ─── Activity log ───────────────────────────────────────────────────────────

export async function getPOActivity(poId: string): Promise<POActivity[]> {
  const { data, error } = await supabase
    .from("bb_po_activity")
    .select("*")
    .eq("purchase_order_id", poId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    purchaseOrderId: r.purchase_order_id,
    type: r.type,
    authorId: r.author_id,
    authorName: r.author_name,
    message: r.message,
    createdAt: r.created_at,
  }))
}

export async function addPOActivity(poId: string, entry: {
  type: POActivity["type"]
  message: string
}): Promise<void> {
  const profile = await getMyProfile()
  if (!profile) throw new Error("Not authenticated")
  const { error } = await supabase.from("bb_po_activity").insert({
    purchase_order_id: poId,
    type: entry.type,
    author_id: profile.id,
    author_name: profile.name,
    message: entry.message,
  })
  if (error) throw error
}

// ─── Vendor invoices ────────────────────────────────────────────────────────

export async function getPOInvoices(poId: string): Promise<POInvoice[]> {
  const { data, error } = await supabase
    .from("bb_po_invoices")
    .select("*")
    .eq("purchase_order_id", poId)
    .order("received_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    purchaseOrderId: r.purchase_order_id,
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date ?? null,
    amount: Number(r.amount),
    matchStatus: r.match_status,
    notes: r.notes ?? null,
    recordedBy: r.recorded_by ?? null,
    receivedAt: r.received_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export async function addPOInvoice(poId: string, data: {
  invoiceNumber: string
  invoiceDate?: string
  amount: number
  notes?: string
}, poTotal: number): Promise<void> {
  const profile = await getMyProfile()
  if (!profile) throw new Error("Not authenticated")

  // Compute match status against PO total
  const diff = data.amount - poTotal
  const matchStatus =
    Math.abs(diff) < 0.01 ? "matched" :
    diff > 0 ? "over" : "under"

  const { error } = await supabase.from("bb_po_invoices").insert({
    purchase_order_id: poId,
    invoice_number: data.invoiceNumber,
    invoice_date: data.invoiceDate ?? null,
    amount: data.amount,
    match_status: matchStatus,
    notes: data.notes ?? null,
    recorded_by: profile.id,
  })
  if (error) throw error

  await addPOActivity(poId, {
    type: "invoice",
    message: `Invoice ${data.invoiceNumber} recorded — $${data.amount.toFixed(2)} (${matchStatus})`,
  })
}

// ─── Archive / Restore / Delete ────────────────────────────────────────────

export async function archivePO(id: string): Promise<void> {
  const { error } = await supabase
    .from("bb_purchase_orders")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function restorePO(id: string): Promise<void> {
  const { error } = await supabase
    .from("bb_purchase_orders")
    .update({ archived_at: null })
    .eq("id", id)
  if (error) throw error
}

export async function deletePO(id: string): Promise<void> {
  const { error } = await supabase
    .from("bb_purchase_orders")
    .delete()
    .eq("id", id)
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
      catalogId: l.catalog_id ?? null,
      partsRequestLineId: l.parts_request_line_id ?? null,
      lineStatus: (l.line_status ?? "pending") as POLineStatus,
      vendorPartNumber: l.vendor_part_number ?? null,
      lineNotes: l.line_notes ?? null,
      lineExpectedDelivery: l.line_expected_delivery ?? null,
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
    carrier: row.carrier ?? null,
    trackingNumber: row.tracking_number ?? null,
    trackingStatus: row.tracking_status ?? null,
    trackingUpdatedAt: row.tracking_updated_at ?? null,
    archivedAt: row.archived_at ?? null,
    lines,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
