import { supabase } from "@/lib/supabase"
import type {
  LogbookEntry, LogbookEntryLine, LogbookEntrySignatory,
  LogbookEntryStatus, LogbookSection, CertType,
} from "../types"
import { buildAircraftRef } from "./aircraft"

export async function getLogbookEntries(filters?: {
  aircraftId?: string
  workOrderId?: string
  status?: LogbookEntryStatus | LogbookEntryStatus[]
}): Promise<LogbookEntry[]> {
  let query = supabase
    .from("bb_logbook_entries")
    .select("*, bb_logbook_entry_lines(*), bb_logbook_entry_signatories(*)")
    .order("entry_date", { ascending: false })

  if (filters?.aircraftId) query = query.eq("aircraft_id", filters.aircraftId)
  if (filters?.workOrderId) query = query.eq("work_order_id", filters.workOrderId)
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in("status", statuses)
  }

  const { data, error } = await query
  if (error) throw error

  const fleetIds = [...new Set((data ?? []).map((r) => r.aircraft_id).filter(Boolean) as string[])]
  const { acMap, regMap } = await fetchAircraftMaps(fleetIds)

  return (data ?? []).map((row) => mapEntryRow(row, acMap, regMap))
}

export async function getLogbookEntryById(id: string): Promise<LogbookEntry | null> {
  const { data, error } = await supabase
    .from("bb_logbook_entries")
    .select("*, bb_logbook_entry_lines(*), bb_logbook_entry_signatories(*)")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const fleetIds = data.aircraft_id ? [data.aircraft_id] : []
  const { acMap, regMap } = await fetchAircraftMaps(fleetIds)

  return mapEntryRow(data, acMap, regMap)
}

export async function createLogbookEntry(payload: {
  aircraftId?: string
  guestRegistration?: string
  guestSerial?: string
  workOrderId?: string
  woNumber?: string
  entryDate?: string
  totalAircraftTime?: number
  totalAircraftTimeNew?: number
  landings?: number
  landingsNew?: number
  hobbs?: number
  hobbsNew?: number
  sectionTitle?: string
  logbookSection?: LogbookEntry["logbookSection"]
  returnToService?: string
  mechanicId?: string
  mechanicName: string
  certificateType: CertType
  certificateNumber: string
  isRia?: boolean
  inspectorId?: string
  inspectorName?: string
  inspectorCert?: string
  lines?: Array<{ lineNumber: number; text: string }>
}): Promise<LogbookEntry> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from("bb_logbook_entries")
    .select("id", { count: "exact", head: true })

  const seq = String((count ?? 0) + 1).padStart(3, "0")
  const entryNumber = `E-${year}-${seq}`

  const { data: entry, error: eErr } = await supabase
    .from("bb_logbook_entries")
    .insert({
      entry_number: entryNumber,
      aircraft_id: payload.aircraftId ?? null,
      guest_registration: payload.guestRegistration ?? null,
      guest_serial: payload.guestSerial ?? null,
      work_order_id: payload.workOrderId ?? null,
      wo_number: payload.woNumber ?? null,
      entry_date: payload.entryDate ?? new Date().toISOString().split("T")[0],
      total_aircraft_time: payload.totalAircraftTime ?? null,
      total_aircraft_time_new: payload.totalAircraftTimeNew ?? null,
      landings: payload.landings ?? null,
      landings_new: payload.landingsNew ?? null,
      hobbs: payload.hobbs ?? null,
      hobbs_new: payload.hobbsNew ?? null,
      section_title: payload.sectionTitle ?? "Airframe Entries",
      logbook_section: payload.logbookSection ?? "Airframe",
      return_to_service: payload.returnToService ?? "",
      mechanic_id: payload.mechanicId ?? null,
      mechanic_name: payload.mechanicName,
      certificate_type: payload.certificateType,
      certificate_number: payload.certificateNumber,
      is_ria: payload.isRia ?? false,
      inspector_id: payload.inspectorId ?? null,
      inspector_name: payload.inspectorName ?? null,
      inspector_cert: payload.inspectorCert ?? null,
      status: "draft",
    })
    .select("id")
    .single()

  if (eErr) throw eErr

  if (payload.lines && payload.lines.length > 0) {
    const { error: lineErr } = await supabase
      .from("bb_logbook_entry_lines")
      .insert(payload.lines.map((l) => ({ entry_id: entry.id, line_number: l.lineNumber, text: l.text })))

    if (lineErr) throw lineErr
  }

  return (await getLogbookEntryById(entry.id))!
}

export async function updateLogbookEntry(
  id: string,
  payload: Partial<Omit<LogbookEntry, "id" | "entryNumber" | "lines" | "aircraft" | "createdAt" | "updatedAt">>
): Promise<void> {
  const { error } = await supabase
    .from("bb_logbook_entries")
    .update({
      ...(payload.entryDate !== undefined && { entry_date: payload.entryDate }),
      ...(payload.returnToService !== undefined && { return_to_service: payload.returnToService }),
      ...(payload.totalAircraftTime !== undefined && { total_aircraft_time: payload.totalAircraftTime }),
      ...(payload.totalAircraftTimeNew !== undefined && { total_aircraft_time_new: payload.totalAircraftTimeNew }),
      ...(payload.landings !== undefined && { landings: payload.landings }),
      ...(payload.landingsNew !== undefined && { landings_new: payload.landingsNew }),
      ...(payload.hobbs !== undefined && { hobbs: payload.hobbs }),
      ...(payload.hobbsNew !== undefined && { hobbs_new: payload.hobbsNew }),
      ...(payload.sectionTitle !== undefined && { section_title: payload.sectionTitle }),
      ...(payload.logbookSection !== undefined && { logbook_section: payload.logbookSection }),
      ...(payload.mechanicName !== undefined && { mechanic_name: payload.mechanicName }),
      ...(payload.certificateType !== undefined && { certificate_type: payload.certificateType }),
      ...(payload.certificateNumber !== undefined && { certificate_number: payload.certificateNumber }),
      ...(payload.isRia !== undefined && { is_ria: payload.isRia }),
      ...(payload.inspectorName !== undefined && { inspector_name: payload.inspectorName }),
      ...(payload.inspectorCert !== undefined && { inspector_cert: payload.inspectorCert }),
    })
    .eq("id", id)

  if (error) throw error
}

export async function signLogbookEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("bb_logbook_entries")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft") // Safety: only sign drafts

  if (error) throw error
}

export async function upsertEntryLine(
  entryId: string,
  line: { lineNumber: number; text: string; id?: string }
): Promise<void> {
  if (line.id) {
    const { error } = await supabase
      .from("bb_logbook_entry_lines")
      .update({ text: line.text })
      .eq("id", line.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from("bb_logbook_entry_lines")
      .insert({ entry_id: entryId, line_number: line.lineNumber, text: line.text })
    if (error) throw error
  }
}

// ─── Group / multi-signatory helpers ─────────────────────────────────────────

// Find the existing draft entry for a WO + logbook section, or create one.
// One draft entry is shared across all mechanics signing within that section.
export async function getOrCreateDraftLogbookEntry(
  wo: {
    id: string
    woNumber: string
    aircraftId: string | null
    guestRegistration: string | null
    guestSerial: string | null
  },
  section: LogbookSection
): Promise<LogbookEntry> {
  // Look for an existing draft for this WO + section
  const { data: existing } = await supabase
    .from("bb_logbook_entries")
    .select("id")
    .eq("work_order_id", wo.id)
    .eq("logbook_section", section)
    .eq("status", "draft")
    .maybeSingle()

  if (existing) {
    return (await getLogbookEntryById(existing.id))!
  }

  // Create a new draft — mechanic fields left empty; filled in via signatories.
  // guest_registration fallback satisfies the DB CHECK constraint when no aircraft is linked.
  return createLogbookEntry({
    workOrderId: wo.id,
    woNumber: wo.woNumber,
    aircraftId: wo.aircraftId ?? undefined,
    guestRegistration: wo.guestRegistration ?? (wo.aircraftId ? undefined : wo.woNumber),
    guestSerial: wo.guestSerial ?? undefined,
    logbookSection: section,
    sectionTitle: `${section} Entries`,
    mechanicName: "",
    certificateType: "A&P",
    certificateNumber: "",
  })
}

// Upsert a mechanic as a signatory on a draft entry.
// Returns the signatory id + sort_order (for ordering lines).
export async function upsertEntrySignatory(
  entryId: string,
  signatory: {
    profileId: string | null
    mechanicName: string
    certType?: CertType | null
    certNumber?: string | null
  }
): Promise<LogbookEntrySignatory> {
  // Check if already a signatory on this entry
  const { data: existing } = await supabase
    .from("bb_logbook_entry_signatories")
    .select("*")
    .eq("entry_id", entryId)
    .eq("profile_id", signatory.profileId ?? "")
    .maybeSingle()

  if (existing) {
    return mapSignatoryRow(existing)
  }

  // Get current max sort_order so new signatory goes at end
  const { count } = await supabase
    .from("bb_logbook_entry_signatories")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId)

  const { data, error } = await supabase
    .from("bb_logbook_entry_signatories")
    .insert({
      entry_id: entryId,
      profile_id: signatory.profileId ?? null,
      mechanic_name: signatory.mechanicName,
      cert_type: signatory.certType ?? null,
      cert_number: signatory.certNumber ?? null,
      sort_order: count ?? 0,
    })
    .select("*")
    .single()

  if (error) throw error
  return mapSignatoryRow(data)
}

// Append a line to an entry linked to a specific signatory + WO item.
export async function addSignatoryLine(
  entryId: string,
  text: string,
  signatoryId: string | null,
  woItemId: string | null
): Promise<void> {
  // Get next line number for this entry
  const { count } = await supabase
    .from("bb_logbook_entry_lines")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId)

  const { error } = await supabase
    .from("bb_logbook_entry_lines")
    .insert({
      entry_id: entryId,
      line_number: (count ?? 0) + 1,
      text,
      signatory_id: signatoryId ?? null,
      wo_item_id: woItemId ?? null,
    })

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

function mapSignatoryRow(row: any): LogbookEntrySignatory {
  return {
    id: row.id,
    entryId: row.entry_id,
    profileId: row.profile_id,
    mechanicName: row.mechanic_name,
    certType: row.cert_type as CertType | null,
    certNumber: row.cert_number,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

function mapEntryRow(row: any, acMap: Map<string, any>, regMap: Map<string, string>): LogbookEntry {
  const lines: LogbookEntryLine[] = ((row.bb_logbook_entry_lines ?? []) as any[])
    .sort((a, b) => a.line_number - b.line_number)
    .map((l) => ({
      id: l.id,
      entryId: l.entry_id,
      lineNumber: l.line_number,
      text: l.text,
      signatoryId: l.signatory_id ?? null,
      woItemId: l.wo_item_id ?? null,
    }))

  const signatories: LogbookEntrySignatory[] = ((row.bb_logbook_entry_signatories ?? []) as any[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapSignatoryRow)

  return {
    id: row.id,
    entryNumber: row.entry_number,
    aircraftId: row.aircraft_id,
    guestRegistration: row.guest_registration,
    guestSerial: row.guest_serial,
    aircraft: buildAircraftRef(row.aircraft_id, row.guest_registration, row.guest_serial, acMap, regMap),
    workOrderId: row.work_order_id,
    woNumber: row.wo_number,
    entryDate: row.entry_date,
    totalAircraftTime: row.total_aircraft_time,
    totalAircraftTimeNew: row.total_aircraft_time_new,
    landings: row.landings,
    landingsNew: row.landings_new,
    hobbs: row.hobbs,
    hobbsNew: row.hobbs_new,
    sectionTitle: row.section_title,
    logbookSection: row.logbook_section,
    returnToService: row.return_to_service,
    mechanicId: row.mechanic_id,
    mechanicName: row.mechanic_name,
    certificateType: row.certificate_type as CertType,
    certificateNumber: row.certificate_number,
    isRia: row.is_ria,
    inspectorId: row.inspector_id,
    inspectorName: row.inspector_name,
    inspectorCert: row.inspector_cert,
    status: row.status as LogbookEntryStatus,
    signedAt: row.signed_at,
    lines,
    signatories,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
