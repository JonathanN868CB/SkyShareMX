import { supabase } from "@/lib/supabase"
import type { Invoice, InvoiceLine, InvoiceStatus, InvoiceLineType } from "../types"
import { buildAircraftRef } from "./aircraft"

export async function getInvoices(filters?: {
  status?: InvoiceStatus | InvoiceStatus[]
  aircraftId?: string
}): Promise<Invoice[]> {
  let query = supabase
    .from("bb_invoices")
    .select("*, bb_invoice_lines(*)")
    .order("issued_date", { ascending: false })

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

  return (data ?? []).map((row) => mapInvoiceRow(row, acMap, regMap))
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from("bb_invoices")
    .select("*, bb_invoice_lines(*)")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const fleetIds = data.aircraft_id ? [data.aircraft_id] : []
  const { acMap, regMap } = await fetchAircraftMaps(fleetIds)

  return mapInvoiceRow(data, acMap, regMap)
}

export async function createInvoice(payload: {
  workOrderId?: string
  woNumber?: string
  aircraftId?: string
  guestRegistration?: string
  customerName: string
  issuedDate?: string
  dueDate?: string
  taxRate?: number
  notes?: string
  createdBy: string
  lines: Array<{
    description: string
    type: InvoiceLineType
    qty: number
    unitPrice: number
    taxable?: boolean
  }>
}): Promise<Invoice> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from("bb_invoices")
    .select("id", { count: "exact", head: true })

  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const invoiceNumber = `INV-${year}-${seq}`

  // Compute subtotals
  let subtotalLabor = 0
  let subtotalParts = 0
  let subtotalMisc = 0

  for (const l of payload.lines) {
    const ext = l.qty * l.unitPrice
    if (l.type === "labor" || l.type === "outside_labor") subtotalLabor += ext
    else if (l.type === "part") subtotalParts += ext
    else subtotalMisc += ext
  }

  const taxRate = payload.taxRate ?? 0
  const taxableAmount = payload.lines
    .filter((l) => l.taxable)
    .reduce((sum, l) => sum + l.qty * l.unitPrice, 0)
  const taxAmount = taxableAmount * taxRate
  const grandTotal = subtotalLabor + subtotalParts + subtotalMisc + taxAmount

  const { data: inv, error: invErr } = await supabase
    .from("bb_invoices")
    .insert({
      invoice_number: invoiceNumber,
      work_order_id: payload.workOrderId ?? null,
      wo_number: payload.woNumber ?? null,
      aircraft_id: payload.aircraftId ?? null,
      guest_registration: payload.guestRegistration ?? null,
      customer_name: payload.customerName,
      status: "draft",
      issued_date: payload.issuedDate ?? new Date().toISOString().split("T")[0],
      due_date: payload.dueDate ?? null,
      subtotal_labor: subtotalLabor,
      subtotal_parts: subtotalParts,
      subtotal_misc: subtotalMisc,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      grand_total: grandTotal,
      notes: payload.notes ?? null,
      created_by: payload.createdBy,
    })
    .select("id")
    .single()

  if (invErr) throw invErr

  if (payload.lines.length > 0) {
    const { error: lineErr } = await supabase
      .from("bb_invoice_lines")
      .insert(
        payload.lines.map((l, i) => ({
          invoice_id: inv.id,
          line_number: i + 1,
          description: l.description,
          type: l.type,
          qty: l.qty,
          unit_price: l.unitPrice,
          taxable: l.taxable ?? false,
        }))
      )

    if (lineErr) throw lineErr
  }

  return (await getInvoiceById(inv.id))!
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const updates: Record<string, unknown> = { status }
  if (status === "paid") updates.paid_at = new Date().toISOString()

  const { error } = await supabase.from("bb_invoices").update(updates).eq("id", id)
  if (error) throw error
}

async function fetchAircraftMaps(aircraftIds: string[]) {
  if (!aircraftIds.length) return { acMap: new Map(), regMap: new Map() }

  const [{ data: acRows }, { data: regRows }] = await Promise.all([
    supabase.from("aircraft").select("id, make, model_full, serial_number").in("id", aircraftIds),
    supabase.from("aircraft_registrations").select("aircraft_id, registration").in("aircraft_id", aircraftIds).eq("is_current", true),
  ])

  const acMap = new Map((acRows ?? []).map((r) => [r.id, { make: r.make, modelFull: r.model_full, serialNumber: r.serial_number }]))
  const regMap = new Map((regRows ?? []).map((r) => [r.aircraft_id, r.registration]))
  return { acMap, regMap }
}

function mapInvoiceRow(row: any, acMap: Map<string, any>, regMap: Map<string, string>): Invoice {
  const lines: InvoiceLine[] = ((row.bb_invoice_lines ?? []) as any[])
    .sort((a, b) => a.line_number - b.line_number)
    .map((l) => ({
      id: l.id,
      invoiceId: l.invoice_id,
      lineNumber: l.line_number,
      description: l.description,
      type: l.type as InvoiceLineType,
      qty: l.qty,
      unitPrice: l.unit_price,
      extended: l.extended,
      taxable: l.taxable,
    }))

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    workOrderId: row.work_order_id,
    woNumber: row.wo_number,
    aircraftId: row.aircraft_id,
    guestRegistration: row.guest_registration,
    aircraft: buildAircraftRef(row.aircraft_id, row.guest_registration, null, acMap, regMap),
    customerName: row.customer_name,
    status: row.status as InvoiceStatus,
    issuedDate: row.issued_date,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    subtotalLabor: row.subtotal_labor,
    subtotalParts: row.subtotal_parts,
    subtotalMisc: row.subtotal_misc,
    taxRate: row.tax_rate,
    taxAmount: row.tax_amount,
    grandTotal: row.grand_total,
    notes: row.notes,
    createdBy: row.created_by,
    lines,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
