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
      ...((payload as any).guestSerial !== undefined && { guest_serial: (payload as any).guestSerial }),
    })
    .eq("id", id)

  if (error) throw error
}

export async function updateSignatory(
  signatoryId: string,
  patch: { mechanicName?: string; certType?: CertType | null; certNumber?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from("bb_logbook_entry_signatories")
    .update({
      ...(patch.mechanicName !== undefined && { mechanic_name: patch.mechanicName }),
      ...(patch.certType     !== undefined && { cert_type: patch.certType }),
      ...(patch.certNumber   !== undefined && { cert_number: patch.certNumber }),
    })
    .eq("id", signatoryId)
  if (error) throw error
}

export async function deleteEntryLine(lineId: string): Promise<void> {
  const { error } = await supabase
    .from("bb_logbook_entry_lines")
    .delete()
    .eq("id", lineId)
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

// Times snapshot type — mirrors AircraftTimesSnapshot from WorkOrderCreate (without parseWarnings)
type TimesSnapshot = {
  airframeHrs?: number | null
  landings?: number | null
  eng1Tsn?: number | null
  eng1Csn?: number | null
  eng1Serial?: string | null
  eng2Tsn?: number | null
  eng2Csn?: number | null
  eng2Serial?: string | null
  propTsn?: number | null
  propCsn?: number | null
  propSerial?: string | null
  apuHrs?: number | null
  apuStarts?: number | null
  apuSerial?: string | null
  hobbs?: number | null
  [key: string]: number | string | null | undefined
}

function timesForSection(snapshot: TimesSnapshot | null | undefined, section: LogbookSection): {
  totalAircraftTime?: number
  totalAircraftTimeNew?: number  // pre-filled from snapshot; mechanic adjusts to actual closing time
  landings?: number
  landingsNew?: number
  hobbs?: number
  hobbsNew?: number
  guestSerial?: string   // repurposed as component serial for engine/prop/APU entries
} {
  if (!snapshot) return {}
  switch (section) {
    case "Airframe":
      return {
        ...(snapshot.airframeHrs != null && {
          totalAircraftTime:    snapshot.airframeHrs,
          totalAircraftTimeNew: snapshot.airframeHrs,
        }),
        ...(snapshot.landings != null && {
          landings:    snapshot.landings,
          landingsNew: snapshot.landings,
        }),
        ...(snapshot.hobbs != null && {
          hobbs:    snapshot.hobbs,
          hobbsNew: snapshot.hobbs,
        }),
      }
    case "Engine 1":
      return {
        ...(snapshot.eng1Tsn != null && {
          totalAircraftTime:    snapshot.eng1Tsn,
          totalAircraftTimeNew: snapshot.eng1Tsn,
        }),
        ...(snapshot.eng1Csn != null && {
          landings:    snapshot.eng1Csn,
          landingsNew: snapshot.eng1Csn,
        }),
        ...(snapshot.eng1Serial && { guestSerial: snapshot.eng1Serial }),
      }
    case "Engine 2":
      return {
        ...(snapshot.eng2Tsn != null && {
          totalAircraftTime:    snapshot.eng2Tsn,
          totalAircraftTimeNew: snapshot.eng2Tsn,
        }),
        ...(snapshot.eng2Csn != null && {
          landings:    snapshot.eng2Csn,
          landingsNew: snapshot.eng2Csn,
        }),
        ...(snapshot.eng2Serial && { guestSerial: snapshot.eng2Serial }),
      }
    case "Propeller":
      return {
        ...(snapshot.propTsn != null && {
          totalAircraftTime:    snapshot.propTsn,
          totalAircraftTimeNew: snapshot.propTsn,
        }),
        ...(snapshot.propCsn != null && {
          landings:    snapshot.propCsn,
          landingsNew: snapshot.propCsn,
        }),
        ...(snapshot.propSerial && { guestSerial: snapshot.propSerial }),
      }
    case "APU":
      return {
        ...(snapshot.apuHrs != null && {
          totalAircraftTime:    snapshot.apuHrs,
          totalAircraftTimeNew: snapshot.apuHrs,
        }),
        ...(snapshot.apuStarts != null && {
          landings:    snapshot.apuStarts,
          landingsNew: snapshot.apuStarts,
        }),
        ...(snapshot.apuSerial && { guestSerial: snapshot.apuSerial }),
      }
    default:
      return {}
  }
}

// Find the existing draft entry for a WO + logbook section, or create one.
// One draft entry is shared across all mechanics signing within that section.
export async function getOrCreateDraftLogbookEntry(
  wo: {
    id: string
    woNumber: string
    aircraftId: string | null
    guestRegistration: string | null
    guestSerial: string | null
    timesSnapshot?: TimesSnapshot | null
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

  // Pre-populate times from the WO's snapshot for this section
  const sectionTimes = timesForSection(wo.timesSnapshot, section)

  // Create a new draft — mechanic fields left empty; filled in via signatories.
  // guest_registration fallback satisfies the DB CHECK constraint when no aircraft is linked.
  return createLogbookEntry({
    workOrderId: wo.id,
    woNumber: wo.woNumber,
    aircraftId: wo.aircraftId ?? undefined,
    guestRegistration: wo.guestRegistration ?? (wo.aircraftId ? undefined : wo.woNumber),
    // For component sections, sectionTimes.guestSerial carries the engine/prop/APU serial.
    // For Airframe or when no component serial is known, fall back to the WO's guestSerial.
    guestSerial: sectionTimes.guestSerial ?? wo.guestSerial ?? undefined,
    logbookSection: section,
    sectionTitle: `${section} Entries`,
    mechanicName: "",
    certificateType: "A&P",
    certificateNumber: "",
    ...sectionTimes,
  })
}

// Create a fresh, standalone logbook entry for a component being installed.
// NEVER merges with an existing section draft — this is always a new entry
// representing the first page of the incoming component's logbook history.
export async function createComponentInstallEntry(
  wo: {
    id: string
    woNumber: string
    aircraftId: string | null
    guestRegistration: string | null
    guestSerial: string | null
  },
  section: LogbookSection,
  componentSerial: string
): Promise<LogbookEntry> {
  return createLogbookEntry({
    workOrderId: wo.id,
    woNumber: wo.woNumber,
    aircraftId: wo.aircraftId ?? undefined,
    guestRegistration: wo.guestRegistration ?? (wo.aircraftId ? undefined : wo.woNumber),
    guestSerial: wo.guestSerial ?? undefined,
    logbookSection: section,
    sectionTitle: `${section} — S/N ${componentSerial} (Installation)`,
    mechanicName: "",
    certificateType: "A&P",
    certificateNumber: "",
    // Times intentionally blank — this component starts fresh at installation.
    // The mechanic will enter TSN/CSN for the new component when completing the entry.
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

// Upsert a line for a specific WO item on an entry (delete existing first, then insert).
// This makes sign-off idempotent — repeated sign/undo/sign cycles don't stack lines.
export async function addSignatoryLine(
  entryId: string,
  text: string,
  signatoryId: string | null,
  woItemId: string | null,
  refCode: string = ""
): Promise<void> {
  // Remove any existing line for this WO item on this entry before inserting
  if (woItemId) {
    await supabase
      .from("bb_logbook_entry_lines")
      .delete()
      .eq("entry_id", entryId)
      .eq("wo_item_id", woItemId)
  }

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
      ref_code: refCode,
      signatory_id: signatoryId ?? null,
      wo_item_id: woItemId ?? null,
    })

  if (error) throw error
}

// Remove all logbook lines for a given WO item and clean up any signatories
// who no longer have any lines on that entry (called on sign-off undo).
export async function removeItemLogbookLines(woItemId: string): Promise<void> {
  // 1. Find the lines before deleting so we know which entry/signatory pairs to check
  const { data: lines } = await supabase
    .from("bb_logbook_entry_lines")
    .select("entry_id, signatory_id")
    .eq("wo_item_id", woItemId)

  // 2. Delete the lines
  const { error } = await supabase
    .from("bb_logbook_entry_lines")
    .delete()
    .eq("wo_item_id", woItemId)
  if (error) throw error

  // 3. For each affected (entry_id, signatory_id) pair, remove the signatory
  //    if they have no remaining lines on that entry
  const pairs = (lines ?? []).filter(l => l.signatory_id)
  const checked = new Set<string>()
  for (const { entry_id, signatory_id } of pairs) {
    const key = `${entry_id}:${signatory_id}`
    if (checked.has(key)) continue
    checked.add(key)
    const { count } = await supabase
      .from("bb_logbook_entry_lines")
      .select("id", { count: "exact", head: true })
      .eq("entry_id", entry_id)
      .eq("signatory_id", signatory_id)
    if ((count ?? 0) === 0) {
      await supabase
        .from("bb_logbook_entry_signatories")
        .delete()
        .eq("id", signatory_id)
    }
  }
}

async function fetchAircraftMaps(aircraftIds: string[]) {
  if (!aircraftIds.length) return { acMap: new Map(), regMap: new Map() }

  const [{ data: acRows }, { data: regRows }] = await Promise.all([
    supabase.from("aircraft").select("id, make, model_full, serial_number, engine_manufacturer, engine_model").in("id", aircraftIds),
    supabase.from("aircraft_registrations").select("aircraft_id, registration").in("aircraft_id", aircraftIds).eq("is_current", true),
  ])

  const acMap = new Map((acRows ?? []).map((r) => [r.id, { make: r.make, modelFull: r.model_full, serialNumber: r.serial_number, engineManufacturer: r.engine_manufacturer ?? null, engineModel: r.engine_model ?? null }]))
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
      refCode: l.ref_code ?? "",
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
