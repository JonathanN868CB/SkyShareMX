import { supabase } from "@/lib/supabase"
import type {
  WorkOrder, WOItem, WOItemPart, WOItemLabor,
  WOStatusChange, WOStatus, WOType, QuoteStatus, WOItemStatus, Mechanic, CertType, AuditEntry,
} from "../types"
import { buildAircraftRef } from "./aircraft"

// ─── Auth helper ─────────────────────────────────────────────────────────────
// opened_by / changed_by / signed_off_by are all FKs to profiles.id,
// NOT auth.users.id. Always use this to get the right UUID.

export async function getMyProfileId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()
  return data?.id ?? null
}

export async function getMyProfile(): Promise<{ id: string; name: string; certType: CertType | null; certNumber: string | null } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email")
    .eq("user_id", user.id)
    .maybeSingle()
  if (!profile) return null
  const { data: certRows } = await supabase
    .from("bb_mechanic_certs")
    .select("cert_type, cert_number")
    .eq("profile_id", profile.id)
    .eq("is_primary", true)
    .limit(1)
  const cert = certRows?.[0] ?? null
  return {
    id: profile.id,
    name: profile.full_name ?? profile.display_name ?? profile.email ?? "Unknown",
    certType: (cert?.cert_type as CertType) ?? null,
    certNumber: cert?.cert_number ?? null,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAircraftMaps(aircraftIds: string[]) {
  if (!aircraftIds.length) return { acMap: new Map(), regMap: new Map() }

  const [{ data: acRows }, { data: regRows }] = await Promise.all([
    supabase
      .from("aircraft")
      .select("id, make, model_full, serial_number, engine_manufacturer, engine_model")
      .in("id", aircraftIds),
    supabase
      .from("aircraft_registrations")
      .select("aircraft_id, registration")
      .in("aircraft_id", aircraftIds)
      .eq("is_current", true),
  ])

  const acMap = new Map(
    (acRows ?? []).map((r) => [r.id, { make: r.make, modelFull: r.model_full, serialNumber: r.serial_number, engineManufacturer: r.engine_manufacturer ?? null, engineModel: r.engine_model ?? null }])
  )
  const regMap = new Map(
    (regRows ?? []).map((r) => [r.aircraft_id, r.registration])
  )
  return { acMap, regMap }
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function getWorkOrders(filters?: {
  type?: WOType
  status?: WOStatus | WOStatus[]
  aircraftId?: string
}): Promise<WorkOrder[]> {
  let query = supabase
    .from("bb_work_orders")
    .select("*")
    .order("opened_at", { ascending: false })
    .range(0, 9999)

  if (filters?.type) {
    query = query.eq("wo_type", filters.type)
  }
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in("status", statuses)
  }
  if (filters?.aircraftId) {
    query = query.eq("aircraft_id", filters.aircraftId)
  }

  const { data, error } = await query
  if (error) throw error

  const fleetIds = [...new Set((data ?? []).map((r) => r.aircraft_id).filter(Boolean) as string[])]
  const { acMap, regMap } = await fetchAircraftMaps(fleetIds)

  return (data ?? []).map((row) => mapWorkOrderRow(row, acMap, regMap))
}

// ─── Single ───────────────────────────────────────────────────────────────────

export async function getWorkOrderById(id: string): Promise<WorkOrder | null> {
  const { data: row, error } = await supabase
    .from("bb_work_orders")
    .select(`
      *,
      bb_work_order_status_history ( * ),
      bb_work_order_audit_trail ( * )
    `)
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!row) return null

  // Fetch items with nested parts + labor + signer name
  const { data: itemRows, error: iErr } = await supabase
    .from("bb_work_order_items")
    .select(`
      *,
      bb_work_order_item_parts ( * ),
      bb_work_order_item_labor ( * ),
      signer:profiles!bb_work_order_items_signed_off_by_fkey ( full_name, display_name )
    `)
    .eq("work_order_id", id)
    .order("item_number")

  if (iErr) throw iErr

  const fleetIds = row.aircraft_id ? [row.aircraft_id] : []
  const { acMap, regMap } = await fetchAircraftMaps(fleetIds)

  const wo = mapWorkOrderRow(row, acMap, regMap)
  wo.items = (itemRows ?? []).map(mapItemRow)
  wo.statusHistory = ((row.bb_work_order_status_history ?? []) as any[])
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
    .map(mapStatusHistoryRow)
  wo.auditTrail = ((row.bb_work_order_audit_trail ?? []) as any[])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(mapAuditEntryRow)

  return wo
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createWorkOrder(payload: {
  description?: string
  aircraftId?: string
  guestRegistration?: string
  guestSerial?: string
  meterAtOpen?: number
  discrepancyRef?: string
  notes?: string
  openedBy: string
  woType?: WOType   // defaults to 'work_order'
}): Promise<WorkOrder> {
  const woType: WOType = payload.woType ?? "work_order"
  const isQuote = woType === "quote"

  // Generate number scoped by type. WOs: YY-NNNN. Quotes: Q-YY-NNNN.
  const yy = String(new Date().getFullYear()).slice(-2)
  const { count } = await supabase
    .from("bb_work_orders")
    .select("id", { count: "exact", head: true })
    .eq("wo_type", woType)

  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const woNumber = isQuote ? `Q-${yy}-${seq}` : `${yy}-${seq}`

  const { data, error } = await supabase
    .from("bb_work_orders")
    .insert({
      wo_number: woNumber,
      description: payload.description ?? null,
      aircraft_id: payload.aircraftId ?? null,
      wo_type: woType,
      guest_registration: payload.guestRegistration ?? null,
      guest_serial: payload.guestSerial ?? null,
      meter_at_open: payload.meterAtOpen ?? null,
      discrepancy_ref: payload.discrepancyRef ?? null,
      notes: payload.notes ?? null,
      opened_by: payload.openedBy,
      status: "draft",
      // Quotes always start as 'draft' quote_status; CHECK constraint requires
      // quote_status IS NOT NULL when wo_type='quote'.
      quote_status: isQuote ? "draft" : null,
    })
    .select("id")
    .single()

  if (error) throw error

  if (isQuote) {
    // Quote lifecycle is tracked via audit trail, not status_history
    // (status_history columns are typed bb_wo_status enum)
    await supabase.from("bb_work_order_audit_trail").insert({
      work_order_id: data.id,
      entry_type: "wo_created",
      actor_id: payload.openedBy,
      summary: "Quote created",
      new_value: "draft",
      field_name: "quote_status",
    })
  } else {
    // Stamp initial status history
    await supabase.from("bb_work_order_status_history").insert({
      work_order_id: data.id,
      from_status: null,
      to_status: "draft",
      changed_by: payload.openedBy,
      notes: "Work order created",
    })
  }

  return (await getWorkOrderById(data.id))!
}

// ─── Quote Status Transitions ────────────────────────────────────────────────
// Quotes track their status in bb_work_orders.quote_status (separate from the
// bb_wo_status enum) and log transitions in the audit trail.

export async function updateQuoteStatus(
  id: string,
  toQuoteStatus: QuoteStatus,
  changedBy: string,
  notes?: string,
): Promise<void> {
  const { data: current, error: fetchErr } = await supabase
    .from("bb_work_orders")
    .select("quote_status")
    .eq("id", id)
    .single()
  if (fetchErr) throw fetchErr

  const updates: Record<string, unknown> = { quote_status: toQuoteStatus }
  if (toQuoteStatus === "sent") updates.quote_sent_at = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from("bb_work_orders")
    .update(updates)
    .eq("id", id)
  if (updateErr) throw updateErr

  await supabase.from("bb_work_order_audit_trail").insert({
    work_order_id: id,
    entry_type: "status_change",
    actor_id: changedBy,
    summary: `Quote status: ${current.quote_status ?? "—"} → ${toQuoteStatus}`,
    field_name: "quote_status",
    old_value: current.quote_status ?? null,
    new_value: toQuoteStatus,
    detail: notes ?? null,
  })
}

// ─── Convert Quote → Work Order ──────────────────────────────────────────────
// Creates a new bb_work_orders row (wo_type='work_order'), deep-copies all
// items / parts / labor, sets bidirectional links, marks the quote converted.

export async function convertQuoteToWorkOrder(
  quoteId: string,
  createdBy: string,
): Promise<string> {
  // 1. Load full quote with items
  const quote = await getWorkOrderById(quoteId)
  if (!quote) throw new Error("Quote not found")
  if (quote.woType !== "quote") throw new Error("Record is not a quote")

  // 2. Generate new WO number
  const yy = String(new Date().getFullYear()).slice(-2)
  const { count } = await supabase
    .from("bb_work_orders")
    .select("id", { count: "exact", head: true })
    .eq("wo_type", "work_order")
  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const newWoNumber = `${yy}-${seq}`

  // 3. Insert new work order
  const { data: newWo, error: insErr } = await supabase
    .from("bb_work_orders")
    .insert({
      wo_number: newWoNumber,
      wo_type: "work_order",
      description: quote.description,
      aircraft_id: quote.aircraftId,
      guest_registration: quote.guestRegistration,
      guest_serial: quote.guestSerial,
      meter_at_open: quote.meterAtOpen,
      discrepancy_ref: quote.discrepancyRef,
      notes: quote.notes,
      opened_by: createdBy,
      status: "draft",
      source_quote_id: quoteId,
    })
    .select("id")
    .single()
  if (insErr) throw insErr
  const newWoId = newWo.id as string

  // 4. Deep-copy items + their parts and labor
  for (const item of quote.items) {
    const { data: newItem, error: itemErr } = await supabase
      .from("bb_work_order_items")
      .insert({
        work_order_id: newWoId,
        item_number: item.itemNumber,
        category: item.category,
        logbook_section: item.logbookSection,
        task_number: item.taskNumber,
        part_number: item.partNumber,
        serial_number: item.serialNumber,
        discrepancy: item.discrepancy,
        corrective_action: item.correctiveAction,
        ref_code: item.refCode,
        mechanic_id: null,          // reset assignee on the new WO
        estimated_hours: item.estimatedHours,
        labor_rate: item.laborRate,
        shipping_cost: item.shippingCost,
        outside_services_cost: item.outsideServicesCost,
        sign_off_required: item.signOffRequired,
        item_status: "pending",     // reset from whatever the quote was at
        no_parts_required: item.noPartsRequired,
      })
      .select("id")
      .single()
    if (itemErr) throw itemErr
    const newItemId = newItem.id as string

    // Copy parts for this item
    if (item.parts.length) {
      const partsPayload = item.parts.map((p) => ({
        item_id: newItemId,
        part_number: p.partNumber,
        description: p.description,
        qty: p.qty,
        unit_price: p.unitPrice,
        catalog_id: p.catalogId,
        inventory_part_id: p.inventoryPartId,
        serial_number: p.serialNumber,
        condition: p.condition,
      }))
      const { error: partsErr } = await supabase
        .from("bb_work_order_item_parts")
        .insert(partsPayload)
      if (partsErr) throw partsErr
    }

    // Copy labor entries (treated as estimates on the new WO)
    if (item.labor.length) {
      const laborPayload = item.labor.map((l) => ({
        item_id: newItemId,
        work_order_id: newWoId,
        mechanic_id: l.mechanicId,
        mechanic_name: l.mechanicName,
        hours: l.hours,
        clocked_at: l.clockedAt,
        description: l.description,
        billable: l.billable,
      }))
      const { error: laborErr } = await supabase
        .from("bb_work_order_item_labor")
        .insert(laborPayload)
      if (laborErr) throw laborErr
    }
  }

  // 5. Initial status history for the new WO
  await supabase.from("bb_work_order_status_history").insert({
    work_order_id: newWoId,
    from_status: null,
    to_status: "draft",
    changed_by: createdBy,
    notes: `Created from quote ${quote.woNumber}`,
  })

  // 6. Mark quote as converted + record back-reference
  const { error: quoteErr } = await supabase
    .from("bb_work_orders")
    .update({
      quote_status: "converted",
      converted_to_wo_id: newWoId,
    })
    .eq("id", quoteId)
  if (quoteErr) throw quoteErr

  // 7. Audit trail on both sides
  await supabase.from("bb_work_order_audit_trail").insert([
    {
      work_order_id: quoteId,
      entry_type: "status_change",
      actor_id: createdBy,
      summary: `Quote converted → WO ${newWoNumber}`,
      field_name: "quote_status",
      old_value: quote.quoteStatus,
      new_value: "converted",
    },
    {
      work_order_id: newWoId,
      entry_type: "wo_created",
      actor_id: createdBy,
      summary: `Created from quote ${quote.woNumber}`,
      field_name: "source_quote_id",
      new_value: quoteId,
    },
  ])

  return newWoId
}

// ─── Update Status ────────────────────────────────────────────────────────────

export async function updateWorkOrderStatus(
  id: string,
  toStatus: WOStatus,
  changedBy: string,
  notes?: string
): Promise<void> {
  const { data: current, error: fetchErr } = await supabase
    .from("bb_work_orders")
    .select("status")
    .eq("id", id)
    .single()

  if (fetchErr) throw fetchErr

  const updates: Record<string, unknown> = { status: toStatus }
  if (toStatus === "completed") updates.closed_at = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from("bb_work_orders")
    .update(updates)
    .eq("id", id)

  if (updateErr) throw updateErr

  await supabase.from("bb_work_order_status_history").insert({
    work_order_id: id,
    from_status: current.status,
    to_status: toStatus,
    changed_by: changedBy,
    notes: notes ?? null,
  })
}

// ─── Update WO Header ─────────────────────────────────────────────────────────

export async function updateWorkOrder(
  id: string,
  payload: Partial<{
    description: string
    aircraftId: string | null
    guestRegistration: string | null
    guestSerial: string | null
    meterAtOpen: number
    meterAtClose: number
    timesSnapshot: Record<string, unknown> | null
    discrepancyRef: string
    notes: string
  }>
): Promise<void> {
  const { error } = await supabase
    .from("bb_work_orders")
    .update({
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.aircraftId !== undefined && { aircraft_id: payload.aircraftId }),
      ...(payload.guestRegistration !== undefined && { guest_registration: payload.guestRegistration }),
      ...(payload.guestSerial !== undefined && { guest_serial: payload.guestSerial }),
      ...(payload.meterAtOpen !== undefined && { meter_at_open: payload.meterAtOpen }),
      ...(payload.meterAtClose !== undefined && { meter_at_close: payload.meterAtClose }),
      ...(payload.timesSnapshot !== undefined && { times_snapshot: payload.timesSnapshot }),
      ...(payload.discrepancyRef !== undefined && { discrepancy_ref: payload.discrepancyRef }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
    })
    .eq("id", id)

  if (error) throw error
}

// ─── Items ────────────────────────────────────────────────────────────────────

export async function upsertWOItem(
  item: Partial<WOItem> & { workOrderId: string; category: string; itemNumber: number }
): Promise<WOItem> {
  const payload = {
    work_order_id: item.workOrderId,
    item_number: item.itemNumber,
    category: item.category,
    logbook_section: item.logbookSection ?? "Airframe",
    task_number: item.taskNumber ?? null,
    part_number: item.partNumber ?? null,
    serial_number: item.serialNumber ?? null,
    discrepancy: item.discrepancy ?? "",
    corrective_action: item.correctiveAction ?? "",
    ref_code: item.refCode ?? "",
    mechanic_id: item.mechanicId ?? null,
    estimated_hours: item.estimatedHours ?? 0,
    labor_rate: item.laborRate ?? 125,
    shipping_cost: item.shippingCost ?? 0,
    outside_services_cost: item.outsideServicesCost ?? 0,
    sign_off_required: item.signOffRequired ?? true,
    item_status: item.itemStatus ?? "pending",
    no_parts_required: item.noPartsRequired ?? false,
  }

  const { data, error } = item.id
    ? await supabase.from("bb_work_order_items").update(payload).eq("id", item.id).select("*").single()
    : await supabase.from("bb_work_order_items").insert(payload).select("*").single()

  if (error) throw error
  return mapItemRow({ ...data, bb_work_order_item_parts: [], bb_work_order_item_labor: [] })
}

export async function updateItemStatus(itemId: string, status: WOItemStatus): Promise<void> {
  const { error } = await supabase
    .from("bb_work_order_items")
    .update({ item_status: status })
    .eq("id", itemId)
  if (error) throw error
}

// Targeted partial UPDATE — only touches the columns you pass.
// Use this for onBlur/discrete-action saves to avoid clobbering other fields.
export async function updateWOItemFields(
  itemId: string,
  fields: Partial<{
    category: string
    discrepancy: string
    correctiveAction: string
    refCode: string
    estimatedHours: number
    laborRate: number
    shippingCost: number
    outsideServicesCost: number
    itemStatus: WOItemStatus
    noPartsRequired: boolean
    signOffRequired: boolean
  }>
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (fields.category           !== undefined) payload.category              = fields.category
  if (fields.discrepancy        !== undefined) payload.discrepancy           = fields.discrepancy
  if (fields.correctiveAction   !== undefined) payload.corrective_action     = fields.correctiveAction
  if (fields.refCode            !== undefined) payload.ref_code              = fields.refCode
  if (fields.estimatedHours     !== undefined) payload.estimated_hours       = fields.estimatedHours
  if (fields.laborRate          !== undefined) payload.labor_rate            = fields.laborRate
  if (fields.shippingCost       !== undefined) payload.shipping_cost         = fields.shippingCost
  if (fields.outsideServicesCost!== undefined) payload.outside_services_cost = fields.outsideServicesCost
  if (fields.itemStatus         !== undefined) payload.item_status           = fields.itemStatus
  if (fields.noPartsRequired    !== undefined) payload.no_parts_required     = fields.noPartsRequired
  if (fields.signOffRequired    !== undefined) payload.sign_off_required     = fields.signOffRequired
  if (Object.keys(payload).length === 0) return
  const { error } = await supabase
    .from("bb_work_order_items")
    .update(payload)
    .eq("id", itemId)
  if (error) throw error
}

export async function clearSignOff(itemId: string): Promise<void> {
  const { error } = await supabase
    .from("bb_work_order_items")
    .update({ signed_off_by: null, signed_off_at: null, item_status: "done" })
    .eq("id", itemId)
  if (error) throw error
}

export async function signOffItem(
  itemId: string,
  signedOffBy: string
): Promise<void> {
  const { error } = await supabase
    .from("bb_work_order_items")
    .update({
      signed_off_by: signedOffBy,
      signed_off_at: new Date().toISOString(),
      item_status: "done",
    })
    .eq("id", itemId)
  if (error) throw error
}

// ─── Item Parts ───────────────────────────────────────────────────────────────

export async function addItemPart(
  itemId: string,
  part: Omit<WOItemPart, "id" | "itemId">
): Promise<WOItemPart> {
  const { data, error } = await supabase
    .from("bb_work_order_item_parts")
    .insert({
      item_id: itemId,
      part_number: part.partNumber,
      description: part.description,
      qty: part.qty,
      unit_price: part.unitPrice,
      catalog_id: part.catalogId ?? null,
      inventory_part_id: part.inventoryPartId ?? null,
      serial_number: part.serialNumber ?? null,
      condition: part.condition ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return {
    id: data.id, itemId: data.item_id, partNumber: data.part_number,
    description: data.description, qty: data.qty, unitPrice: data.unit_price,
    catalogId: data.catalog_id ?? null, inventoryPartId: data.inventory_part_id ?? null,
    serialNumber: data.serial_number ?? null, condition: data.condition ?? null,
  }
}

export async function issuePartFromInventory(
  itemId: string,
  inv: { id: string; partNumber: string; description: string; unitCost: number; catalogId: string | null; condition: string },
  qty: number,
  woNumber: string,
  performedBy: { id: string; name: string }
): Promise<WOItemPart> {
  // 1. Add part to WO item
  const saved = await addItemPart(itemId, {
    partNumber: inv.partNumber,
    description: inv.description,
    qty,
    unitPrice: inv.unitCost,
    catalogId: inv.catalogId,
    inventoryPartId: inv.id,
    serialNumber: null,
    condition: inv.condition,
  })

  // 2. Create "issue" transaction (negative qty = removing from stock)
  const { recordTransaction } = await import("./inventory")
  await recordTransaction(inv.id, {
    type: "issue",
    qty: -qty,
    unitCost: inv.unitCost,
    performedBy: performedBy.id,
    performedName: performedBy.name,
    woRef: woNumber,
    notes: `Issued to WO ${woNumber}`,
  })

  return saved
}

export async function removeItemPart(partId: string): Promise<void> {
  const { error } = await supabase.from("bb_work_order_item_parts").delete().eq("id", partId)
  if (error) throw error
}

export async function deleteWOItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("bb_work_order_items").delete().eq("id", itemId)
  if (error) throw error
}

// ─── Labor ────────────────────────────────────────────────────────────────────

export async function clockLabor(entry: Omit<WOItemLabor, "id">): Promise<WOItemLabor> {
  const { data, error } = await supabase
    .from("bb_work_order_item_labor")
    .insert({
      item_id: entry.itemId,
      work_order_id: entry.workOrderId,
      mechanic_id: entry.mechanicId ?? null,
      mechanic_name: entry.mechanicName,
      hours: entry.hours,
      clocked_at: entry.clockedAt,
      description: entry.description ?? null,
      billable: entry.billable,
    })
    .select()
    .single()

  if (error) throw error
  return mapLaborRow(data)
}

export async function updateLabor(
  id: string,
  payload: Partial<Pick<WOItemLabor, "hours" | "description" | "billable">>
): Promise<void> {
  const { error } = await supabase
    .from("bb_work_order_item_labor")
    .update({
      ...(payload.hours !== undefined && { hours: payload.hours }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.billable !== undefined && { billable: payload.billable }),
    })
    .eq("id", id)
  if (error) throw error
}

export async function deleteLabor(id: string): Promise<void> {
  const { error } = await supabase.from("bb_work_order_item_labor").delete().eq("id", id)
  if (error) throw error
}

// ─── Delete Work Order (Manager+) ────────────────────────────────────────────

export async function deleteWorkOrder(id: string): Promise<void> {
  const { error } = await supabase.from("bb_work_orders").delete().eq("id", id)
  if (error) throw error
}

// ─── Delete all items on a WO (used by rebuild flow) ─────────────────────────

export async function deleteAllWOItems(workOrderId: string): Promise<void> {
  const { error } = await supabase
    .from("bb_work_order_items")
    .delete()
    .eq("work_order_id", workOrderId)
  if (error) throw error
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export async function addAuditEntry(
  workOrderId: string,
  entry: {
    entryType: string
    actorId?: string | null
    actorName?: string | null
    summary: string
    detail?: string | null
    fieldName?: string | null
    oldValue?: string | null
    newValue?: string | null
    itemId?: string | null
    itemNumber?: number | null
  }
): Promise<void> {
  const { error } = await supabase
    .from("bb_work_order_audit_trail")
    .insert({
      work_order_id: workOrderId,
      entry_type:    entry.entryType,
      actor_id:      entry.actorId   ?? null,
      actor_name:    entry.actorName ?? null,
      summary:       entry.summary,
      detail:        entry.detail    ?? null,
      field_name:    entry.fieldName ?? null,
      old_value:     entry.oldValue  ?? null,
      new_value:     entry.newValue  ?? null,
      item_id:       entry.itemId    ?? null,
      item_number:   entry.itemNumber ?? null,
    })
  if (error) throw error
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function mapWorkOrderRow(
  row: any,
  acMap: Map<string, any>,
  regMap: Map<string, string>
): WorkOrder {
  return {
    id: row.id,
    woNumber: row.wo_number,
    woType: (row.wo_type ?? "work_order") as WOType,
    aircraftId: row.aircraft_id,
    guestRegistration: row.guest_registration,
    guestSerial: row.guest_serial,
    aircraft: buildAircraftRef(row.aircraft_id, row.guest_registration, row.guest_serial, acMap, regMap),
    status: row.status as WOStatus,
    description: row.description,
    openedBy: row.opened_by,
    openedByName: null,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    meterAtOpen: row.meter_at_open,
    meterAtClose: row.meter_at_close,
    timesSnapshot: row.times_snapshot ?? null,
    discrepancyRef: row.discrepancy_ref,
    notes: row.notes,
    quoteStatus: (row.quote_status ?? null) as QuoteStatus | null,
    quoteSentAt: row.quote_sent_at ?? null,
    quoteExpiresAt: row.quote_expires_at ?? null,
    sourceQuoteId: row.source_quote_id ?? null,
    convertedToWoId: row.converted_to_wo_id ?? null,
    items: [],
    statusHistory: [],
    auditTrail: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapItemRow(row: any): WOItem {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    itemNumber: row.item_number,
    category: row.category,
    logbookSection: row.logbook_section,
    taskNumber: row.task_number,
    partNumber: row.part_number,
    serialNumber: row.serial_number,
    discrepancy: row.discrepancy,
    correctiveAction: row.corrective_action,
    refCode: row.ref_code ?? "",
    mechanicId: row.mechanic_id,
    mechanicName: null,
    estimatedHours: row.estimated_hours,
    laborRate: row.labor_rate,
    shippingCost: row.shipping_cost,
    outsideServicesCost: row.outside_services_cost,
    signOffRequired: row.sign_off_required,
    signedOffBy: row.signer?.full_name ?? row.signer?.display_name ?? row.signed_off_by ?? null,
    signedOffAt: row.signed_off_at,
    itemStatus: row.item_status,
    noPartsRequired: row.no_parts_required,
    parts: (row.bb_work_order_item_parts ?? []).map((p: any): WOItemPart => ({
      id: p.id,
      itemId: p.item_id,
      partNumber: p.part_number,
      description: p.description,
      qty: p.qty,
      unitPrice: p.unit_price,
      catalogId: p.catalog_id ?? null,
      inventoryPartId: p.inventory_part_id ?? null,
      serialNumber: p.serial_number ?? null,
      condition: p.condition ?? null,
    })),
    labor: (row.bb_work_order_item_labor ?? []).map(mapLaborRow),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapLaborRow(row: any): WOItemLabor {
  return {
    id: row.id,
    itemId: row.item_id,
    workOrderId: row.work_order_id,
    mechanicId: row.mechanic_id,
    mechanicName: row.mechanic_name,
    hours: row.hours,
    clockedAt: row.clocked_at,
    description: row.description,
    billable: row.billable,
  }
}

function mapStatusHistoryRow(row: any): WOStatusChange {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    notes: row.notes,
  }
}

function mapAuditEntryRow(row: any): AuditEntry {
  return {
    id:          row.id,
    workOrderId: row.work_order_id,
    entryType:   row.entry_type,
    actorId:     row.actor_id,
    actorName:   row.actor_name,
    summary:     row.summary,
    detail:      row.detail,
    fieldName:   row.field_name,
    oldValue:    row.old_value,
    newValue:    row.new_value,
    itemId:      row.item_id,
    itemNumber:  row.item_number,
    createdAt:   row.created_at,
  }
}

// ─── SOP ↔ WO Item Linking ──────────────────────────────────────────────────

export interface WOItemSOP {
  id: string
  itemId: string
  sopId: string
  sopNumber: string
  sopTitle: string
  linkedBy: string | null
  linkedAt: string
  notes: string | null
}

export async function getItemSOPs(itemId: string): Promise<WOItemSOP[]> {
  const { data, error } = await supabase
    .from("bb_wo_item_sops")
    .select("id, item_id, sop_id, linked_by, linked_at, notes, bb_sops!inner(sop_number, title)")
    .eq("item_id", itemId)
    .order("linked_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    itemId: row.item_id,
    sopId: row.sop_id,
    sopNumber: row.bb_sops?.sop_number ?? "",
    sopTitle: row.bb_sops?.title ?? "",
    linkedBy: row.linked_by,
    linkedAt: row.linked_at,
    notes: row.notes,
  }))
}

export async function linkSOPToItem(
  itemId: string,
  sopId: string,
  linkedBy: string,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from("bb_wo_item_sops")
    .insert({
      item_id: itemId,
      sop_id: sopId,
      linked_by: linkedBy,
      notes: notes ?? null,
    })

  if (error) throw error
}

export async function unlinkSOPFromItem(linkId: string): Promise<void> {
  const { error } = await supabase
    .from("bb_wo_item_sops")
    .delete()
    .eq("id", linkId)

  if (error) throw error
}
