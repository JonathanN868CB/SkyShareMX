import { supabase } from "@/lib/supabase"
import type { WorkOrder, InvoiceLineType } from "../types"

// ─── Auto-Generate Invoice from Work Order ───────────────────────────────────
// Called when a WO transitions to "billing". Reads all items, labor, and parts
// from the WO, then creates a draft invoice with computed line items.

export interface AutoInvoiceResult {
  invoiceId: string
  invoiceNumber: string
  lineCount: number
  grandTotal: number
}

export async function autoGenerateInvoice(
  wo: WorkOrder,
  createdBy: string
): Promise<AutoInvoiceResult> {
  const lines: Array<{
    description: string
    type: InvoiceLineType
    qty: number
    unitPrice: number
    taxable: boolean
  }> = []

  // 1. Labor lines — one per item with labor entries
  for (const item of wo.items) {
    const totalHours = item.labor.reduce((s, l) => s + l.hours, 0)
    if (totalHours > 0) {
      lines.push({
        description: `Labor: Item #${item.itemNumber} — ${item.discrepancy.slice(0, 80) || item.category}`,
        type: "labor",
        qty: totalHours,
        unitPrice: item.laborRate,
        taxable: false,
      })
    }

    // Outside services
    if (item.outsideServicesCost > 0) {
      lines.push({
        description: `Outside Services: Item #${item.itemNumber}`,
        type: "outside_labor",
        qty: 1,
        unitPrice: item.outsideServicesCost,
        taxable: false,
      })
    }

    // 2. Parts lines — one per part on each item
    for (const part of item.parts) {
      lines.push({
        description: `Part: ${part.partNumber} — ${part.description.slice(0, 60)}`,
        type: "part",
        qty: part.qty,
        unitPrice: part.unitPrice,
        taxable: true,
      })
    }

    // 3. Shipping as misc
    if (item.shippingCost > 0) {
      lines.push({
        description: `Shipping: Item #${item.itemNumber}`,
        type: "misc",
        qty: 1,
        unitPrice: item.shippingCost,
        taxable: false,
      })
    }
  }

  // Use dynamic import to avoid circular dependency
  const { createInvoice } = await import("./invoices")

  const customerName = wo.aircraft?.registration
    ? `Owner — ${wo.aircraft.registration}`
    : wo.guestRegistration
      ? `Owner — ${wo.guestRegistration}`
      : "Customer"

  const invoice = await createInvoice({
    workOrderId: wo.id,
    woNumber: wo.woNumber,
    aircraftId: wo.aircraftId ?? undefined,
    guestRegistration: wo.guestRegistration ?? undefined,
    customerName,
    createdBy,
    lines,
  })

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    lineCount: lines.length,
    grandTotal: invoice.grandTotal,
  }
}

// ─── Auto-Generate PO Drafts from Reorder Alerts ────────────────────────────
// Groups parts below reorder point by their preferred vendor (from catalog),
// then creates one draft PO per vendor.

export interface AutoPOResult {
  poId: string
  poNumber: string
  vendorName: string
  lineCount: number
}

export async function autoGenerateReorderPOs(
  createdBy: string
): Promise<AutoPOResult[]> {
  // 1. Get parts below reorder point
  const { data: alerts, error: alertErr } = await supabase
    .from("bb_inventory_parts")
    .select("id, part_number, description, qty_on_hand, reorder_point, catalog_id, unit_cost")
    .gt("reorder_point", 0)
    .filter("qty_on_hand", "lte", "reorder_point")
    .range(0, 9999)

  if (alertErr) throw alertErr
  if (!alerts || alerts.length === 0) return []

  // 2. Look up preferred vendors from catalog
  const catalogIds = alerts.map(a => a.catalog_id).filter(Boolean) as string[]
  let vendorMap = new Map<string, { vendorId: string; vendorName: string }>()

  if (catalogIds.length > 0) {
    const { data: vendorLinks } = await supabase
      .from("parts_catalog_vendors")
      .select("catalog_id, vendor_id, vendor_name, is_preferred")
      .in("catalog_id", catalogIds)
      .order("is_preferred", { ascending: false })
      .range(0, 9999)

    for (const vl of vendorLinks ?? []) {
      if (!vendorMap.has(vl.catalog_id)) {
        vendorMap.set(vl.catalog_id, { vendorId: vl.vendor_id, vendorName: vl.vendor_name })
      }
    }
  }

  // 3. Group parts by vendor
  const groups = new Map<string, {
    vendorId: string | undefined
    vendorName: string
    lines: Array<{
      partNumber: string
      description: string
      qtyOrdered: number
      unitCost: number
      catalogId: string | undefined
    }>
  }>()

  for (const part of alerts) {
    const deficit = part.reorder_point - part.qty_on_hand
    if (deficit <= 0) continue

    const vendor = part.catalog_id ? vendorMap.get(part.catalog_id) : undefined
    const vendorKey = vendor?.vendorName ?? "Unassigned Vendor"

    if (!groups.has(vendorKey)) {
      groups.set(vendorKey, {
        vendorId: vendor?.vendorId,
        vendorName: vendorKey,
        lines: [],
      })
    }

    groups.get(vendorKey)!.lines.push({
      partNumber: part.part_number,
      description: part.description ?? "",
      qtyOrdered: deficit,
      unitCost: part.unit_cost ?? 0,
      catalogId: part.catalog_id ?? undefined,
    })
  }

  // 4. Create a draft PO for each vendor group
  const { createPurchaseOrder } = await import("./purchaseOrders")
  const results: AutoPOResult[] = []

  for (const [, group] of groups) {
    const po = await createPurchaseOrder({
      vendorId: group.vendorId,
      vendorName: group.vendorName,
      notes: `Auto-generated from reorder alerts on ${new Date().toLocaleDateString("en-US")}`,
      createdBy,
      lines: group.lines,
    })

    results.push({
      poId: po.id,
      poNumber: po.poNumber,
      vendorName: group.vendorName,
      lineCount: group.lines.length,
    })
  }

  return results
}

// ─── WO Completion Check ────────────────────────────────────────────────────
// Returns true if all items on a WO are "done" and the WO can advance.

export async function checkWOReadyForReview(workOrderId: string): Promise<{
  ready: boolean
  totalItems: number
  doneItems: number
  pendingItems: string[]
}> {
  const { data: items, error } = await supabase
    .from("bb_work_order_items")
    .select("id, item_number, item_status")
    .eq("work_order_id", workOrderId)

  if (error) throw error
  const all = items ?? []

  const doneItems = all.filter(i => i.item_status === "done").length
  const pendingItems = all
    .filter(i => i.item_status !== "done")
    .map(i => `Item #${i.item_number} (${i.item_status})`)

  return {
    ready: all.length > 0 && doneItems === all.length,
    totalItems: all.length,
    doneItems,
    pendingItems,
  }
}
