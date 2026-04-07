// DiscrepancyImportPanel — Admin+ only
// Monthly JetInsight Excel sync: inserts new records, overwrites existing ones.
// Deduplication key: jetinsight_discrepancy_id
// Corrective action: strips JetInsight's "ID + pilot report" prefix before storing.

import { useState, useCallback, useRef } from "react"
import * as XLSX from "xlsx"
import { RefreshCw, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"

// ── Types ──────────────────────────────────────────────────────────────────────
interface ParsedRow {
  jetinsight_discrepancy_id: string | null
  _tail: string | null
  title: string | null
  pilot_report: string
  found_by_name: string | null
  found_at: string | null
  status: string
  has_mel: boolean
  mel_due_date: string | null
  mel_item: string | null
  mel_category: string | null
  location_icao: string | null
  company: string | null
  technician_name: string | null
  technician_credential_number: string | null
  signoff_date: string | null
  approved_by_name: string | null
  corrective_action: string | null
  airframe_hours: number | null
  airframe_cycles: number | null
  import_notes: string | null
}

interface PreviewUpdateRow {
  row: ParsedRow
  changedFields: string[]   // empty = identical to DB, nothing will be written
}

interface SyncPreview {
  newRows: ParsedRow[]
  updateRows: PreviewUpdateRow[]
  unchangedCount: number
  invalidCount: number
  aircraftIdMap: Record<string, string>
  missingTails: string[]
}

interface SyncResult {
  inserted: number
  updated: number
  failed: number
  firstError: string | null
}

// Snapshot of the fields we overwrite — used for rollback after a sync
interface RollbackRow {
  jetinsight_discrepancy_id: string
  title: string | null
  pilot_report: string | null
  found_by_name: string | null
  found_at: string | null
  status: string | null
  has_mel: boolean | null
  mel_due_date: string | null
  mel_item: string | null
  mel_category: string | null
  location_icao: string | null
  company: string | null
  technician_name: string | null
  technician_credential_number: string | null
  signoff_date: string | null
  approved_by_name: string | null
  corrective_action: string | null
  airframe_hours: number | null
  airframe_cycles: number | null
  import_notes: string | null
  import_confidence: string | null
}

interface RollbackSnapshot {
  insertedIds: string[]          // can be deleted (Super Admin only)
  updatedRows: RollbackRow[]     // can be restored (Admin+)
}

// ── Date Parser ────────────────────────────────────────────────────────────────
function parseDate(value: unknown): string | null {
  if (value == null || value === "") return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value)
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H ?? 0, d.M ?? 0)).toISOString()
    return null
  }
  if (typeof value === "string") {
    const s = value.trim()
    if (!s) return null
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/)
    if (m) {
      let [, mo, d, y, H = "0", M = "0"] = m
      if (y.length === 2) y = "20" + y
      const dt = new Date(Date.UTC(+y, +mo - 1, +d, +H, +M))
      return isNaN(dt.getTime()) ? null : dt.toISOString()
    }
    const dt = new Date(s)
    return isNaN(dt.getTime()) ? null : dt.toISOString()
  }
  return null
}

// ── Status Normalizer ──────────────────────────────────────────────────────────
// DB CHECK constraint: status IN ('cleared', 'open', 'deferred')
// JetInsight sends: "Cleared", "Open", "Deferred" — same vocabulary, just Title Case.
// Simple lowercase + allowlist; anything unrecognized defaults to "open".
function normalizeStatus(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase()
  if (s === "cleared" || s === "open" || s === "deferred") return s
  return "open"
}

// ── Corrective Action Cleaner ──────────────────────────────────────────────────
// JetInsight sometimes prefixes corrective_action with "{ID} {full pilot report text}".
// We strip the ID prefix; the pilot report narrative is already in pilot_report.
function cleanCorrectiveAction(text: string | null, id: string | null): string | null {
  if (!text || !id) return text
  const stripped = text.startsWith(id + " ") ? text.slice(id.length + 1).trim() : text
  return stripped || null
}

// ── Row Parser ─────────────────────────────────────────────────────────────────
function parseRow(raw: Record<string, unknown>): ParsedRow {
  const str = (key: string): string | null => {
    const v = raw[key]
    if (v == null) return null
    const s = String(v).trim()
    return s || null
  }
  const num = (key: string): number | null => {
    const v = raw[key]
    if (v == null || v === "") return null
    const n = Number(v)
    return isNaN(n) ? null : n
  }

  const id = str("Discrepancy ID")
  const company = str("Sign-off company") || str("MEL company")
  const melDueRaw = parseDate(raw["Deferral expiration date"])

  const unmapped: Record<string, unknown> = {}
  for (const k of [
    "Logged by", "Logged on", "Aircraft type", "Aircraft Serial", "Aircraft FAA part",
    "Deferred by", "Deferred on", "O Procedure", "M Procedure", "MEL M technician",
    "Sign-off by", "Sign-off location", "Sign-off approved on", "Work completed on",
  ]) {
    if (raw[k] != null && raw[k] !== "") unmapped[k] = raw[k]
  }

  const rawCa = str("Corrective action")

  return {
    jetinsight_discrepancy_id: id,
    _tail: str("Aircraft"),
    title: str("Issue"),
    pilot_report: str("Details") ?? "",
    found_by_name: str("Found by"),
    found_at: parseDate(raw["Found on"]),
    status: normalizeStatus(raw["Status"]),
    has_mel: String(raw["MEL"] ?? "").trim().toLowerCase() === "yes",
    mel_due_date: melDueRaw ? melDueRaw.split("T")[0] : null,
    mel_item: str("Item number"),
    mel_category: str("MEL category"),
    location_icao: str("MEL location"),
    company,
    technician_name: str("Sign-off technician"),
    technician_credential_number: str("Sign-off license"),
    signoff_date: parseDate(raw["Sign-off on"]),
    approved_by_name: str("Sign-off approved by"),
    corrective_action: cleanCorrectiveAction(rawCa, id),
    airframe_hours: num("Airframe hours"),
    airframe_cycles: (() => { const n = num("Airframe cycles"); return n != null ? Math.round(n) : null })(),
    import_notes: Object.keys(unmapped).length > 0 ? JSON.stringify(unmapped) : null,
  }
}

// ── Field-level Diff ──────────────────────────────────────────────────────────
// Compares an incoming Excel row against the current DB row and returns the list
// of field labels that actually differ. Empty array = nothing will change.
function fieldsDiffer(incoming: ParsedRow, current: RollbackRow): string[] {
  const changed: string[] = []

  const strEq = (a: unknown, b: unknown) => {
    const n = (v: unknown) => (v == null || String(v).trim() === "") ? null : String(v).trim()
    return n(a) === n(b)
  }
  const dateEq = (a: string | null, b: string | null) => {
    const n = (v: string | null) => {
      if (!v) return null
      try { return new Date(v).toISOString().substring(0, 16) } catch { return null }
    }
    return n(a) === n(b)
  }
  const numEq = (a: number | null, b: unknown) => {
    if (a == null && (b == null || b === "")) return true
    if (a == null || b == null || b === "") return false
    return Math.abs(Number(a) - Number(b)) < 0.01
  }

  if (!strEq(incoming.title, current.title)) changed.push("title")
  if (!strEq(incoming.pilot_report, current.pilot_report)) changed.push("pilot report")
  if (!strEq(incoming.found_by_name, current.found_by_name)) changed.push("found by")
  if (!dateEq(incoming.found_at, current.found_at)) changed.push("found on")
  if (!strEq(incoming.status, current.status)) changed.push("status")
  if (incoming.has_mel !== Boolean(current.has_mel)) changed.push("MEL")
  if (!dateEq(incoming.mel_due_date, current.mel_due_date)) changed.push("MEL due")
  if (!strEq(incoming.mel_item, current.mel_item)) changed.push("MEL item")
  if (!strEq(incoming.mel_category, current.mel_category)) changed.push("MEL category")
  if (!strEq(incoming.location_icao, current.location_icao)) changed.push("location")
  if (!strEq(incoming.company, current.company)) changed.push("company")
  if (!strEq(incoming.technician_name, current.technician_name)) changed.push("technician")
  if (!strEq(incoming.technician_credential_number, current.technician_credential_number)) changed.push("license")
  if (!dateEq(incoming.signoff_date, current.signoff_date)) changed.push("sign-off date")
  if (!strEq(incoming.approved_by_name, current.approved_by_name)) changed.push("approved by")
  if (!strEq(incoming.corrective_action, current.corrective_action)) changed.push("corrective action")
  if (!numEq(incoming.airframe_hours, current.airframe_hours)) changed.push("hours")
  if (!numEq(incoming.airframe_cycles, current.airframe_cycles)) changed.push("cycles")

  return changed
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function DiscrepancyImportPanel() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === "Super Admin"
  const isAdmin = profile?.role === "Admin" || isSuperAdmin

  const [expanded, setExpanded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<SyncPreview | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [rollback, setRollback] = useState<RollbackSnapshot | null>(null)
  const [rollingBack, setRollingBack] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!isAdmin) return null

  async function processFile(file: File) {
    setParsing(true)
    setError(null)
    setPreview(null)
    setSyncResult(null)
    setRollback(null)
    setFileName(file.name)

    try {
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab, { cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

      if (json.length === 0) {
        setError("No data rows found in this spreadsheet.")
        setParsing(false)
        return
      }

      const parsed = json.map(parseRow)
      const valid = parsed.filter(r => r.jetinsight_discrepancy_id && r._tail && r.title)
      const invalidCount = parsed.length - valid.length

      // Resolve aircraft IDs via aircraft_registrations.aircraft_id (FK to aircraft.id)
      const uniqueTails = [...new Set(valid.map(r => r._tail!))]
      const { data: aircraftRows } = await supabase
        .from("aircraft_registrations")
        .select("aircraft_id, registration")
        .in("registration", uniqueTails)
        .eq("is_current", true)

      const aircraftIdMap: Record<string, string> = {}
      for (const row of aircraftRows ?? []) aircraftIdMap[row.registration] = row.aircraft_id

      const missingTails = uniqueTails.filter(t => !aircraftIdMap[t])
      const withAircraft = valid.filter(r => aircraftIdMap[r._tail!])

      // Split into new vs existing
      const allIds = withAircraft.map(r => r.jetinsight_discrepancy_id!)
      const { data: existing } = await supabase
        .from("discrepancies")
        .select("jetinsight_discrepancy_id")
        .in("jetinsight_discrepancy_id", allIds)

      const existingSet = new Set((existing ?? []).map(r => r.jetinsight_discrepancy_id))
      const newRows = withAircraft.filter(r => !existingSet.has(r.jetinsight_discrepancy_id!))
      const updateCandidates = withAircraft.filter(r => existingSet.has(r.jetinsight_discrepancy_id!))

      // Fetch current DB values for every update candidate so we can diff field-by-field
      const dbCurrentMap: Record<string, RollbackRow> = {}
      if (updateCandidates.length > 0) {
        const { data: currentRows } = await supabase
          .from("discrepancies")
          .select("jetinsight_discrepancy_id, title, pilot_report, found_by_name, found_at, status, has_mel, mel_due_date, mel_item, mel_category, location_icao, company, technician_name, technician_credential_number, signoff_date, approved_by_name, corrective_action, airframe_hours, airframe_cycles, import_notes, import_confidence")
          .in("jetinsight_discrepancy_id", updateCandidates.map(r => r.jetinsight_discrepancy_id!))
        for (const row of (currentRows ?? []) as unknown as RollbackRow[]) dbCurrentMap[row.jetinsight_discrepancy_id] = row
      }

      const updateRows: PreviewUpdateRow[] = updateCandidates.map(r => ({
        row: r,
        changedFields: dbCurrentMap[r.jetinsight_discrepancy_id!]
          ? fieldsDiffer(r, dbCurrentMap[r.jetinsight_discrepancy_id!])
          : [],
      }))
      const unchangedCount = updateRows.filter(p => p.changedFields.length === 0).length

      setPreview({ newRows, updateRows, unchangedCount, invalidCount, aircraftIdMap, missingTails })
    } catch (e) {
      setError(`Failed to read file: ${e instanceof Error ? e.message : String(e)}`)
    }

    setParsing(false)
  }

  async function confirmSync() {
    if (!preview) return
    setSyncing(true)
    setError(null)

    let inserted = 0
    let updated = 0
    let failed = 0
    let firstError: string | null = null
    const BATCH = 50

    // Only write rows that actually differ from the current DB state
    const rowsToUpdate = preview.updateRows.filter(p => p.changedFields.length > 0)

    const totalOps = preview.newRows.length + rowsToUpdate.length
    setSyncProgress({ done: 0, total: totalOps })

    // ── Snapshot pre-update state for rollback ────────────────────────────────
    let preUpdateSnapshot: RollbackRow[] = []
    if (rowsToUpdate.length > 0) {
      const updateIds = rowsToUpdate.map(p => p.row.jetinsight_discrepancy_id!)
      const { data: snap } = await supabase
        .from("discrepancies")
        .select("jetinsight_discrepancy_id, title, pilot_report, found_by_name, found_at, status, has_mel, mel_due_date, mel_item, mel_category, location_icao, company, technician_name, technician_credential_number, signoff_date, approved_by_name, corrective_action, airframe_hours, airframe_cycles, import_notes, import_confidence")
        .in("jetinsight_discrepancy_id", updateIds)
      preUpdateSnapshot = (snap ?? []) as RollbackRow[]
    }

    // ── INSERT new records ────────────────────────────────────────────────────
    const insertRows = preview.newRows.map(r => ({
      aircraft_id: preview.aircraftIdMap[r._tail!],
      jetinsight_discrepancy_id: r.jetinsight_discrepancy_id,
      registration_at_event: r._tail,
      title: r.title!,
      pilot_report: r.pilot_report,
      found_by_name: r.found_by_name,
      found_at: r.found_at,
      status: r.status,
      has_mel: r.has_mel,
      mel_due_date: r.mel_due_date,
      mel_item: r.mel_item,
      mel_category: r.mel_category,
      location_icao: r.location_icao,
      company: r.company,
      technician_name: r.technician_name,
      technician_credential_number: r.technician_credential_number,
      signoff_date: r.signoff_date,
      approved_by_name: r.approved_by_name,
      corrective_action: r.corrective_action,
      airframe_hours: r.airframe_hours,
      airframe_cycles: r.airframe_cycles,
      import_notes: r.import_notes,
      import_status: "pending_review",   // must match CHECK: pending_review | approved | flagged
      import_confidence: "high",
    }))

    const insertedIds: string[] = []

    for (let i = 0; i < insertRows.length; i += BATCH) {
      const batch = insertRows.slice(i, i + BATCH)
      const { error: err, data } = await supabase
        .from("discrepancies")
        .insert(batch)
        .select("jetinsight_discrepancy_id")

      if (err) {
        console.error("[DiscrepancySync] insert error:", err)
        if (!firstError) firstError = err.message
        failed += batch.length
      } else {
        const count = data?.length ?? batch.length
        inserted += count
        for (const row of data ?? []) {
          if (row.jetinsight_discrepancy_id) insertedIds.push(row.jetinsight_discrepancy_id)
        }
      }

      setSyncProgress({ done: Math.min(i + BATCH, insertRows.length), total: totalOps })
    }

    // ── OVERWRITE existing records (changed rows only) ────────────────────────
    // import_status is intentionally preserved (keeps 'approved' for DW1GHT-reviewed records).
    for (let i = 0; i < rowsToUpdate.length; i++) {
      const r = rowsToUpdate[i].row
      const { error: err } = await supabase
        .from("discrepancies")
        .update({
          title: r.title!,
          pilot_report: r.pilot_report,
          found_by_name: r.found_by_name,
          found_at: r.found_at,
          status: r.status,
          has_mel: r.has_mel,
          mel_due_date: r.mel_due_date,
          mel_item: r.mel_item,
          mel_category: r.mel_category,
          location_icao: r.location_icao,
          company: r.company,
          technician_name: r.technician_name,
          technician_credential_number: r.technician_credential_number,
          signoff_date: r.signoff_date,
          approved_by_name: r.approved_by_name,
          corrective_action: r.corrective_action,
          airframe_hours: r.airframe_hours,
          airframe_cycles: r.airframe_cycles,
          import_notes: r.import_notes,
          import_confidence: "high",
        })
        .eq("jetinsight_discrepancy_id", r.jetinsight_discrepancy_id!)

      if (err) {
        console.error("[DiscrepancySync] update error:", r.jetinsight_discrepancy_id, err)
        if (!firstError) firstError = err.message
        failed++
      } else {
        updated++
      }

      setSyncProgress({ done: insertRows.length + i + 1, total: totalOps || 1 })
    }

    setSyncResult({ inserted, updated, failed, firstError })
    setRollback({ insertedIds, updatedRows: preUpdateSnapshot })

    // ── Write audit log entry ─────────────────────────────────────────────────
    const tails = Object.keys(preview.aircraftIdMap)
    const unchangedCount = preview.updateRows.filter(p => p.changedFields.length === 0).length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any).from("jetinsight_sync_log").insert({
      synced_by: profile?.user_id ?? null,
      synced_by_name: profile?.display_name ?? profile?.full_name ?? null,
      file_name: fileName,
      tails,
      inserted_count: inserted,
      updated_count: updated,
      failed_count: failed,
      unchanged_count: unchangedCount,
      first_error: firstError,
    }).then(({ error: logErr }) => {
      if (logErr) console.error("[DiscrepancySync] audit log write failed:", logErr.message)
    })

    setPreview(null)
    setSyncing(false)
    setSyncProgress(null)
  }

  async function undoSync() {
    if (!rollback) return
    setRollingBack(true)

    let rollbackFailed = 0
    let firstError: string | null = null

    // Restore updated rows to their pre-sync state
    for (const row of rollback.updatedRows) {
      const { error: err } = await supabase
        .from("discrepancies")
        .update({
          title: row.title,
          pilot_report: row.pilot_report,
          found_by_name: row.found_by_name,
          found_at: row.found_at,
          status: row.status,
          has_mel: row.has_mel,
          mel_due_date: row.mel_due_date,
          mel_item: row.mel_item,
          mel_category: row.mel_category,
          location_icao: row.location_icao,
          company: row.company,
          technician_name: row.technician_name,
          technician_credential_number: row.technician_credential_number,
          signoff_date: row.signoff_date,
          approved_by_name: row.approved_by_name,
          corrective_action: row.corrective_action,
          airframe_hours: row.airframe_hours,
          airframe_cycles: row.airframe_cycles,
          import_notes: row.import_notes,
          import_confidence: row.import_confidence,
        })
        .eq("jetinsight_discrepancy_id", row.jetinsight_discrepancy_id)

      if (err) {
        console.error("[DiscrepancySync] rollback update error:", row.jetinsight_discrepancy_id, err)
        if (!firstError) firstError = err.message
        rollbackFailed++
      }
    }

    // Delete newly inserted records (Super Admin only — RLS enforced)
    if (isSuperAdmin && rollback.insertedIds.length > 0) {
      const { error: err } = await supabase
        .from("discrepancies")
        .delete()
        .in("jetinsight_discrepancy_id", rollback.insertedIds)

      if (err) {
        console.error("[DiscrepancySync] rollback delete error:", err)
        if (!firstError) firstError = err.message
        rollbackFailed++
      }
    }

    setRollingBack(false)
    setRollback(null)
    setSyncResult(null)

    if (rollbackFailed > 0) {
      setError(`Rollback completed with ${rollbackFailed} error(s): ${firstError ?? "unknown"}`)
    }
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [])
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    e.target.value = ""
  }, [])

  const actualUpdateCount = preview ? preview.updateRows.filter(p => p.changedFields.length > 0).length : 0
  const totalSync = preview ? preview.newRows.length + actualUpdateCount : 0

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:brightness-110 transition-all"
        style={{ borderBottom: expanded ? "1px solid rgba(255,255,255,0.05)" : "none", background: "rgba(255,255,255,0.01)" }}
      >
        <RefreshCw className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }} />
        <span
          className="text-[9px] font-semibold uppercase tracking-widest flex-1 text-left"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.7 }}
        >
          JetInsight Sync
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 opacity-40" style={{ color: "hsl(var(--muted-foreground))" }} />
          : <ChevronDown className="w-3.5 h-3.5 opacity-40" style={{ color: "hsl(var(--muted-foreground))" }} />
        }
      </button>

      {expanded && <div className="p-4">
        {/* Success / result banner */}
        {syncResult && (
          <div className="flex flex-col gap-3">
            <div
              className="flex items-center justify-between rounded-lg px-4 py-3"
              style={{
                background: syncResult.failed > 0 ? "rgba(255,165,0,0.06)" : "rgba(100,220,100,0.06)",
                border: `1px solid ${syncResult.failed > 0 ? "rgba(255,165,0,0.2)" : "rgba(100,220,100,0.2)"}`,
              }}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: syncResult.failed > 0 ? "rgba(255,165,0,0.8)" : "rgba(100,220,100,0.8)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: syncResult.failed > 0 ? "rgba(255,165,0,0.9)" : "rgba(100,220,100,0.9)" }}>
                    Sync complete
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {[
                      syncResult.inserted > 0 && `${syncResult.inserted.toLocaleString()} added`,
                      syncResult.updated > 0 && `${syncResult.updated.toLocaleString()} updated`,
                      syncResult.failed > 0 && `${syncResult.failed} failed`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSyncResult(null); setRollback(null) }}
                className="text-sm px-3 py-1.5 rounded transition-colors hover:brightness-125 ml-4"
                style={{ color: "hsl(var(--muted-foreground))", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Sync another
              </button>
            </div>

            {/* Error detail */}
            {syncResult.firstError && (
              <div
                className="flex items-start gap-2 rounded px-3 py-2"
                style={{ background: "rgba(255,100,100,0.05)", border: "1px solid rgba(255,100,100,0.18)" }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(255,100,100,0.7)" }} />
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>Error detail (first failure)</p>
                  <p className="text-xs font-mono" style={{ color: "rgba(255,100,100,0.65)" }}>{syncResult.firstError}</p>
                </div>
              </div>
            )}

            {/* Rollback controls / confirm */}
            <div
              className="flex items-center justify-between rounded px-3 py-2 gap-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {rollback && (rollback.updatedRows.length > 0 || rollback.insertedIds.length > 0) ? (
                <div>
                  <p className="text-xs font-semibold" style={{ color: "hsl(var(--foreground))" }}>Undo this sync?</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {rollback.updatedRows.length > 0 && `Restore ${rollback.updatedRows.length} overwritten record${rollback.updatedRows.length !== 1 ? "s" : ""} to their previous values`}
                    {isSuperAdmin && rollback.insertedIds.length > 0 && rollback.updatedRows.length > 0 && " · "}
                    {isSuperAdmin && rollback.insertedIds.length > 0 && `Delete ${rollback.insertedIds.length} inserted record${rollback.insertedIds.length !== 1 ? "s" : ""}`}
                    {!isSuperAdmin && rollback.insertedIds.length > 0 && (rollback.updatedRows.length > 0 ? " · " : "") + `${rollback.insertedIds.length} new record${rollback.insertedIds.length !== 1 ? "s" : ""} require Super Admin to delete`}
                  </p>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Sync window will close when dismissed.</p>
              )}
              <div className="flex items-center gap-2 flex-shrink-0">
                {rollback && (rollback.updatedRows.length > 0 || (isSuperAdmin && rollback.insertedIds.length > 0)) && (
                  <button
                    onClick={undoSync}
                    disabled={rollingBack}
                    className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all hover:brightness-125 disabled:opacity-50"
                    style={{ color: "rgba(255,165,0,0.85)", background: "rgba(255,165,0,0.07)", border: "1px solid rgba(255,165,0,0.2)" }}
                  >
                    {rollingBack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {rollingBack ? "Rolling back…" : "Rollback"}
                  </button>
                )}
                <button
                  onClick={() => { setSyncResult(null); setRollback(null) }}
                  disabled={rollingBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                  style={{ color: "rgba(100,220,100,0.85)", background: "rgba(100,220,100,0.07)", border: "1px solid rgba(100,220,100,0.2)" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sync looks good
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drop zone */}
        {!preview && !syncResult && (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !parsing && inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-lg px-6 py-7 transition-all"
            style={{
              background: dragging ? "rgba(212,160,23,0.07)" : "transparent",
              border: `2px dashed ${dragging ? "rgba(212,160,23,0.45)" : "rgba(255,255,255,0.08)"}`,
              cursor: parsing ? "default" : "pointer",
            }}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
            {parsing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--skyshare-gold)" }} />
                <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>Reading spreadsheet…</p>
              </>
            ) : (
              <>
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ background: "rgba(212,160,23,0.07)" }}
                >
                  <FileSpreadsheet className="w-5 h-5" style={{ color: "var(--skyshare-gold)", opacity: 0.65 }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: "hsl(var(--foreground))" }}>
                    Drop a JetInsight Excel export here
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    or click to browse · .xlsx / .xls · new records added, existing records overwritten
                  </p>
                </div>
              </>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm mt-1" style={{ color: "rgba(255,100,100,0.8)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="flex flex-col gap-4">
            {/* Stats */}
            <div className="flex items-center gap-6">
              {preview.newRows.length > 0 && (
                <div>
                  <div className="text-2xl font-semibold leading-none" style={{ color: "rgba(100,220,100,0.85)", fontFamily: "var(--font-display)" }}>
                    {preview.newRows.length}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    new
                  </div>
                </div>
              )}
              {actualUpdateCount > 0 && (
                <div>
                  <div className="text-2xl font-semibold leading-none" style={{ color: "rgba(100,170,255,0.85)", fontFamily: "var(--font-display)" }}>
                    {actualUpdateCount}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    updating
                  </div>
                </div>
              )}
              {preview.unchangedCount > 0 && (
                <div>
                  <div className="text-2xl font-semibold leading-none" style={{ color: "rgba(120,120,120,0.5)", fontFamily: "var(--font-display)" }}>
                    {preview.unchangedCount}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                    no changes
                  </div>
                </div>
              )}
              {preview.invalidCount > 0 && (
                <div>
                  <div className="text-2xl font-semibold leading-none" style={{ color: "rgba(255,165,0,0.8)", fontFamily: "var(--font-display)" }}>
                    {preview.invalidCount}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                    skipped
                  </div>
                </div>
              )}
              <button onClick={() => setPreview(null)} className="ml-auto" style={{ color: "hsl(var(--muted-foreground))" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Unknown aircraft warning */}
            {preview.missingTails.length > 0 && (
              <div
                className="flex items-start gap-2 rounded px-3 py-2"
                style={{ background: "rgba(255,165,0,0.05)", border: "1px solid rgba(255,165,0,0.18)" }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(255,165,0,0.7)" }} />
                <p className="text-sm" style={{ color: "rgba(255,165,0,0.8)" }}>
                  Unknown aircraft: <strong>{preview.missingTails.join(", ")}</strong> — those rows will be skipped.
                </p>
              </div>
            )}

            {/* Preview table — shows new rows first, then updates */}
            {totalSync > 0 && (
              <div className="rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={{ background: "rgba(20,20,20,0.95)" }}>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["", "ID", "Issue", "Status", "Changes"].map((h, i) => (
                          <th
                            key={i}
                            className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-medium"
                            style={{ color: "hsl(var(--muted-foreground))" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...preview.newRows.map(r => ({ row: r, isNew: true, changedFields: null as string[] | null })),
                        // changed rows first, then unchanged at bottom
                        ...preview.updateRows.filter(p => p.changedFields.length > 0).map(p => ({ row: p.row, isNew: false, changedFields: p.changedFields })),
                        ...preview.updateRows.filter(p => p.changedFields.length === 0).map(p => ({ row: p.row, isNew: false, changedFields: p.changedFields })),
                      ].slice(0, 50).map(({ row: r, isNew, changedFields }, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", opacity: (!isNew && changedFields?.length === 0) ? 0.4 : 1 }}>
                          <td className="px-3 py-1.5">
                            {isNew ? (
                              <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: "rgba(100,220,100,0.8)", background: "rgba(100,220,100,0.08)" }}>
                                new
                              </span>
                            ) : changedFields!.length > 0 ? (
                              <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: "rgba(100,170,255,0.8)", background: "rgba(100,170,255,0.08)" }}>
                                update
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: "rgba(120,120,120,0.5)", background: "rgba(120,120,120,0.06)" }}>
                                current
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-[11px] whitespace-nowrap" style={{ color: "var(--skyshare-gold)", fontFamily: "'Courier Prime','Courier New',monospace" }}>
                            {r.jetinsight_discrepancy_id}
                          </td>
                          <td className="px-3 py-1.5 text-[12px] max-w-[240px] truncate" style={{ color: "hsl(var(--foreground))" }}>
                            {r.title}
                          </td>
                          <td className="px-3 py-1.5 text-[11px] whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>
                            {r.status}
                          </td>
                          <td className="px-3 py-1.5 text-[11px]" style={{ color: "hsl(var(--muted-foreground))", maxWidth: 200 }}>
                            {isNew ? (
                              <span style={{ opacity: 0.4 }}>—</span>
                            ) : changedFields!.length === 0 ? (
                              <span style={{ opacity: 0.35 }}>no changes</span>
                            ) : (
                              <span style={{ color: "rgba(100,170,255,0.7)" }}>
                                {changedFields!.slice(0, 3).join(", ")}{changedFields!.length > 3 ? ` +${changedFields!.length - 3} more` : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalSync > 50 && (
                  <div className="px-3 py-2 text-[11px]" style={{ color: "hsl(var(--muted-foreground))", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    +{totalSync - 50} more rows not shown
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              {totalSync > 0 ? (
                <button
                  onClick={confirmSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                  style={{ background: "rgba(100,170,255,0.1)", color: "rgba(100,170,255,0.9)", border: "1px solid rgba(100,170,255,0.22)" }}
                >
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {syncing
                    ? syncProgress
                      ? `Syncing… ${syncProgress.done} / ${syncProgress.total}`
                      : "Syncing…"
                    : `Sync ${totalSync.toLocaleString()} record${totalSync !== 1 ? "s" : ""}`}
                </button>
              ) : (
                <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Nothing to sync — file matches the database.
                </p>
              )}
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ color: "hsl(var(--muted-foreground))", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>}
    </div>
  )
}
