import { useState, useEffect, useCallback } from "react"
import { Loader2, AlertTriangle, Pencil, Check, X, Clock, RefreshCw } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { localToday } from "@/shared/lib/dates"
import { getFleetAircraft } from "../../services"
import type { FleetAircraft } from "../../types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComponentBlock {
  totalTime:   number   // hours
  cycles:      number
  tso:         number | null   // Time Since Overhaul (null if N/A)
  cso:         number | null   // Cycles Since Overhaul
  asOf:        string          // ISO date string
}

interface HobbsBlock {
  current:  number
  asOf:     string
}

interface AircraftTimeRecord {
  aircraftId:  string
  airframe:    ComponentBlock
  engine1:     ComponentBlock
  engine2:     ComponentBlock | null   // null if single-engine
  propeller:   ComponentBlock | null   // null if no prop (jet)
  apu:         ComponentBlock | null   // null if no APU
  hobbs:       HobbsBlock
}

interface HistoryEntry {
  id:        string
  ts:        string
  component: string
  field:     string
  oldVal:    number
  newVal:    number
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

const storageKey = (id: string) => `bb-aircraft-times-${id}`
const historyKey = (id: string) => `bb-aircraft-times-history-${id}`

function loadRecord(aircraft: FleetAircraft): AircraftTimeRecord {
  const raw = localStorage.getItem(storageKey(aircraft.id))
  if (raw) {
    try { return JSON.parse(raw) } catch { /* fall through */ }
  }
  const today = localToday()
  return {
    aircraftId: aircraft.id,
    airframe:  { totalTime: 0, cycles: 0, tso: null, cso: null, asOf: today },
    engine1:   { totalTime: 0, cycles: 0, tso: 0, cso: 0, asOf: today },
    engine2:   aircraft.isTwin  ? { totalTime: 0, cycles: 0, tso: 0, cso: 0, asOf: today } : null,
    propeller: aircraft.hasProp ? { totalTime: 0, cycles: 0, tso: 0, cso: 0, asOf: today } : null,
    apu:       aircraft.hasApu  ? { totalTime: 0, cycles: 0, tso: null, cso: null, asOf: today } : null,
    hobbs:     { current: 0, asOf: today },
  }
}

function saveRecord(record: AircraftTimeRecord) {
  localStorage.setItem(storageKey(record.aircraftId), JSON.stringify(record))
}

function loadHistory(id: string): HistoryEntry[] {
  const raw = localStorage.getItem(historyKey(id))
  if (raw) try { return JSON.parse(raw) } catch { /* fall through */ }
  return []
}

function appendHistory(id: string, entry: Omit<HistoryEntry, "id" | "ts">) {
  const history = loadHistory(id)
  const newEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    ...entry,
  }
  const trimmed = [newEntry, ...history].slice(0, 60)
  localStorage.setItem(historyKey(id), JSON.stringify(trimmed))
  return trimmed
}

// ─── Component card config ────────────────────────────────────────────────────

interface CardConfig {
  key:         string
  label:       string
  borderColor: string
  textColor:   string
  bgColor:     string
  fields:      FieldDef[]
  showTso:     boolean
  showCso:     boolean
  isHobbs?:    true
}

interface FieldDef {
  key:    string
  label:  string
  unit:   string
  decimal?: boolean
}

const AIRFRAME_FIELDS: FieldDef[] = [
  { key: "totalTime", label: "Total Time",      unit: "hrs",  decimal: true },
  { key: "cycles",    label: "Total Landings",  unit: "ldg"                  },
]

const ENGINE_FIELDS: FieldDef[] = [
  { key: "totalTime", label: "Time Since New",       unit: "hrs", decimal: true },
  { key: "cycles",    label: "Cycles Since New",      unit: "cyc"               },
  { key: "tso",       label: "Time Since Overhaul",   unit: "hrs", decimal: true },
  { key: "cso",       label: "Cycles Since Overhaul", unit: "cyc"               },
]

const PROP_FIELDS: FieldDef[] = [
  { key: "totalTime", label: "Time Since New",      unit: "hrs", decimal: true },
  { key: "cycles",    label: "Cycles Since New",    unit: "cyc"                },
  { key: "tso",       label: "Time Since Overhaul", unit: "hrs", decimal: true },
  { key: "cso",       label: "Cycles S/O",          unit: "cyc"                },
]

const APU_FIELDS: FieldDef[] = [
  { key: "totalTime", label: "APU Hours",     unit: "hrs", decimal: true },
  { key: "cycles",    label: "APU Starts",    unit: "cyc"                },
]

// ─── Inline edit field ────────────────────────────────────────────────────────

function EditableMetric({
  label, value, unit, decimal = false,
  onSave,
}: {
  label:    string
  value:    number | null
  unit:     string
  decimal?: boolean
  onSave:   (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  function startEdit() {
    setDraft(value != null ? String(value) : "0")
    setEditing(true)
  }

  function commit() {
    const n = decimal ? parseFloat(draft) : parseInt(draft, 10)
    if (!isNaN(n) && n >= 0) {
      onSave(n)
    }
    setEditing(false)
  }

  function cancel() { setEditing(false) }

  const displayed = value != null
    ? (decimal ? value.toFixed(1) : String(value))
    : "—"

  return (
    <div className="flex items-center justify-between py-2.5 group"
      style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}
    >
      <span className="text-white/45 text-xs" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
        {label}
      </span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            type="number"
            min="0"
            step={decimal ? "0.1" : "1"}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel() }}
            className="w-24 rounded px-2 py-0.5 text-right text-white text-sm font-mono focus:outline-none"
            style={{ background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 32%)", colorScheme: "dark" }}
          />
          <span className="text-white/30 text-xs">{unit}</span>
          <button onClick={commit}  className="text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={cancel}  className="text-white/30 hover:text-white/60 transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-white/85 text-sm font-mono tabular-nums">{displayed}</span>
          <span className="text-white/30 text-xs">{unit}</span>
          {value != null && (
            <button
              onClick={startEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-white/70"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Component card ───────────────────────────────────────────────────────────

function TimeCard({
  label, borderColor, textColor, bgColor,
  fields, block, hobbsBlock,
  onFieldSave, onDateSave,
}: {
  label:        string
  borderColor:  string
  textColor:    string
  bgColor:      string
  fields:       FieldDef[]
  block:        ComponentBlock | HobbsBlock | null
  hobbsBlock?:  true
  onFieldSave:  (fieldKey: string, value: number) => void
  onDateSave:   (date: string) => void
}) {
  const [editDate, setEditDate] = useState(false)
  const [dateDraft, setDateDraft] = useState("")

  if (!block) return null

  const asOf = block.asOf

  function startDateEdit() { setDateDraft(asOf); setEditDate(true) }
  function commitDate() { onDateSave(dateDraft); setEditDate(false) }

  const cb = block as ComponentBlock
  const hb = block as HobbsBlock

  return (
    <div className={cn("card-elevated rounded-lg overflow-hidden border-t-2", borderColor)}>
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-center justify-between", bgColor)}>
        <span
          className={cn("text-xs font-bold tracking-widest uppercase", textColor)}
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {label}
        </span>
        {/* As-of date */}
        {editDate ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus type="date" value={dateDraft}
              onChange={e => setDateDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitDate(); if (e.key === "Escape") setEditDate(false) }}
              className="text-xs rounded px-2 py-0.5 text-white focus:outline-none"
              style={{ background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 32%)", colorScheme: "dark" }}
            />
            <button onClick={commitDate}       className="text-emerald-400 hover:text-emerald-300"><Check className="w-3 h-3" /></button>
            <button onClick={() => setEditDate(false)} className="text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button
            onClick={startDateEdit}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors group"
          >
            <Clock className="w-3 h-3" />
            <span className="text-[10px]" style={{ fontFamily: "var(--font-heading)" }}>
              as of {new Date(asOf + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      {/* Metrics */}
      <div className="px-4">
        {hobbsBlock ? (
          <EditableMetric
            label="Hobbs Reading" value={hb.current} unit="hrs" decimal
            onSave={v => onFieldSave("current", v)}
          />
        ) : (
          fields.map(f => (
            <EditableMetric
              key={f.key}
              label={f.label}
              value={f.key in cb ? (cb[f.key as keyof ComponentBlock] as number | null) : null}
              unit={f.unit}
              decimal={f.decimal}
              onSave={v => onFieldSave(f.key, v)}
            />
          ))
        )}
      </div>

      <div className="h-3" />
    </div>
  )
}

// ─── History feed ─────────────────────────────────────────────────────────────

function HistoryFeed({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return (
    <div className="card-elevated rounded-lg px-5 py-8 text-center">
      <p className="text-white/20 text-sm">No updates recorded yet.</p>
      <p className="text-white/15 text-xs mt-1">Edits will appear here as you update times and cycles.</p>
    </div>
  )

  return (
    <div className="card-elevated rounded-lg overflow-hidden">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
        <span className="text-xs font-bold tracking-widest uppercase text-white/40" style={{ fontFamily: "var(--font-heading)" }}>
          Recent Updates
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: "hsl(0 0% 16%)" }}>
        {entries.slice(0, 20).map(e => (
          <div key={e.id} className="flex items-start gap-3 px-4 py-2.5">
            <RefreshCw className="w-3 h-3 text-white/20 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs">
                <span className="text-white/45">{e.component}</span>
                {" · "}
                <span>{e.field}</span>
                {" changed from "}
                <span className="font-mono text-white/50">{e.oldVal}</span>
                {" → "}
                <span className="font-mono text-white">{e.newVal}</span>
              </p>
            </div>
            <span className="text-white/25 text-[10px] flex-shrink-0 tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
              {new Date(e.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" "}
              {new Date(e.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AircraftTimes() {
  const [fleet,        setFleet]        = useState<FleetAircraft[]>([])
  const [loadingFleet, setLoadingFleet] = useState(true)
  const [fleetError,   setFleetError]   = useState<string | null>(null)
  const [selectedId,   setSelectedId]   = useState<string>("")
  const [record,       setRecord]       = useState<AircraftTimeRecord | null>(null)
  const [history,      setHistory]      = useState<HistoryEntry[]>([])

  useEffect(() => {
    getFleetAircraft()
      .then(ac => {
        setFleet(ac)
        if (ac.length > 0) setSelectedId(ac[0].id)
      })
      .catch(err => setFleetError(err.message ?? "Failed to load fleet"))
      .finally(() => setLoadingFleet(false))
  }, [])

  useEffect(() => {
    if (!selectedId) { setRecord(null); setHistory([]); return }
    const ac = fleet.find(a => a.id === selectedId)
    if (!ac) return
    const r = loadRecord(ac)
    setRecord(r)
    setHistory(loadHistory(selectedId))
  }, [selectedId, fleet])

  const selectedAircraft = fleet.find(a => a.id === selectedId) ?? null

  const updateField = useCallback((
    component: keyof Omit<AircraftTimeRecord, "aircraftId">,
    fieldKey:  string,
    newVal:    number,
  ) => {
    if (!record) return
    const oldBlock = record[component] as ComponentBlock | HobbsBlock | null
    if (!oldBlock) return
    const oldVal = (oldBlock as Record<string, number>)[fieldKey] ?? 0

    const updated: AircraftTimeRecord = {
      ...record,
      [component]: {
        ...oldBlock,
        [fieldKey]: newVal,
      },
    }
    saveRecord(updated)
    setRecord(updated)

    const newHistory = appendHistory(record.aircraftId, {
      component: component === "engine1" ? "Engine 1"
               : component === "engine2" ? "Engine 2"
               : component === "propeller" ? "Propeller"
               : component === "apu" ? "APU"
               : component === "hobbs" ? "Hobbs"
               : "Airframe",
      field: fieldKey === "totalTime" ? "Total Time"
           : fieldKey === "cycles"    ? "Cycles"
           : fieldKey === "tso"       ? "TSO"
           : fieldKey === "cso"       ? "CSO"
           : fieldKey === "current"   ? "Hobbs Reading"
           : fieldKey,
      oldVal, newVal,
    })
    setHistory(newHistory)
  }, [record])

  const updateDate = useCallback((
    component: keyof Omit<AircraftTimeRecord, "aircraftId">,
    date: string,
  ) => {
    if (!record) return
    const block = record[component] as ComponentBlock | HobbsBlock | null
    if (!block) return
    const updated: AircraftTimeRecord = {
      ...record,
      [component]: { ...block, asOf: date },
    }
    saveRecord(updated)
    setRecord(updated)
  }, [record])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-white mb-1"
              style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
            >
              Aircraft Times &amp; Cycles
            </h1>
            <p className="text-white/45 text-sm">
              {loadingFleet ? "Loading fleet…" : `${fleet.length} aircraft in fleet`}
            </p>
          </div>

          {/* Aircraft selector */}
          {!loadingFleet && fleet.length > 0 && (
            <div className="flex items-center gap-3">
              <span
                className="text-white/40 text-xs uppercase tracking-widest"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Aircraft
              </span>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                style={{
                  background:    "hsl(0 0% 14%)",
                  border:        "1px solid hsl(0 0% 28%)",
                  colorScheme:   "dark",
                  minWidth:      "220px",
                  fontFamily:    "var(--font-heading)",
                  letterSpacing: "0.04em",
                }}
              >
                {fleet.map(ac => (
                  <option key={ac.id} value={ac.id}>
                    {ac.registration ?? ac.serialNumber ?? ac.id} — {ac.make} {ac.modelFull}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Error */}
        {fleetError && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{fleetError}</span>
          </div>
        )}

        {/* Loading */}
        {loadingFleet && (
          <div className="card-elevated rounded-lg p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            <span className="text-white/30 text-sm">Loading fleet…</span>
          </div>
        )}

        {/* No aircraft */}
        {!loadingFleet && fleet.length === 0 && !fleetError && (
          <div className="card-elevated rounded-lg p-12 text-center">
            <p className="text-white/30 text-sm">No fleet aircraft found.</p>
          </div>
        )}

        {/* Aircraft summary bar */}
        {selectedAircraft && record && (
          <div
            className="rounded-lg px-5 py-3 flex items-center gap-6"
            style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 20%)" }}
          >
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Registration</p>
              <p className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
                {selectedAircraft.registration ?? "—"}
              </p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Make / Model</p>
              <p className="text-white/80 text-sm">{selectedAircraft.make} {selectedAircraft.modelFull}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Serial</p>
              <p className="text-white/80 text-sm font-mono">{selectedAircraft.serialNumber}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Engine</p>
              <p className="text-white/80 text-sm">
                {selectedAircraft.engineManufacturer ?? "—"} {selectedAircraft.engineModel ?? ""}
                {selectedAircraft.isTwin && <span className="ml-1.5 text-white/35 text-xs">(Twin)</span>}
              </p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Year</p>
              <p className="text-white/80 text-sm">{selectedAircraft.year}</p>
            </div>
          </div>
        )}

        {/* Component cards grid */}
        {record && (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">

            {/* Airframe */}
            <TimeCard
              label="Airframe"
              borderColor="border-blue-800/60"
              textColor="text-blue-400"
              bgColor="bg-blue-900/10"
              fields={AIRFRAME_FIELDS}
              block={record.airframe}
              onFieldSave={(k, v) => updateField("airframe", k, v)}
              onDateSave={d => updateDate("airframe", d)}
            />

            {/* Engine 1 */}
            <TimeCard
              label={record.engine2 ? "Engine 1" : "Engine"}
              borderColor="border-amber-800/60"
              textColor="text-amber-400"
              bgColor="bg-amber-900/10"
              fields={ENGINE_FIELDS}
              block={record.engine1}
              onFieldSave={(k, v) => updateField("engine1", k, v)}
              onDateSave={d => updateDate("engine1", d)}
            />

            {/* Engine 2 (twin only) */}
            {record.engine2 && (
              <TimeCard
                label="Engine 2"
                borderColor="border-orange-800/60"
                textColor="text-orange-400"
                bgColor="bg-orange-900/10"
                fields={ENGINE_FIELDS}
                block={record.engine2}
                onFieldSave={(k, v) => updateField("engine2", k, v)}
                onDateSave={d => updateDate("engine2", d)}
              />
            )}

            {/* Propeller */}
            {record.propeller && (
              <TimeCard
                label="Propeller"
                borderColor="border-purple-800/60"
                textColor="text-purple-400"
                bgColor="bg-purple-900/10"
                fields={PROP_FIELDS}
                block={record.propeller}
                onFieldSave={(k, v) => updateField("propeller", k, v)}
                onDateSave={d => updateDate("propeller", d)}
              />
            )}

            {/* APU */}
            {record.apu && (
              <TimeCard
                label="APU"
                borderColor="border-cyan-800/60"
                textColor="text-cyan-400"
                bgColor="bg-cyan-900/10"
                fields={APU_FIELDS}
                block={record.apu}
                onFieldSave={(k, v) => updateField("apu", k, v)}
                onDateSave={d => updateDate("apu", d)}
              />
            )}

            {/* Hobbs */}
            <div className="card-elevated rounded-lg overflow-hidden border-t-2 border-emerald-800/60">
              <div className="px-4 py-3 flex items-center justify-between bg-emerald-900/10">
                <span
                  className="text-xs font-bold tracking-widest uppercase text-emerald-400"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Hobbs Meter
                </span>
                <span className="text-white/25 text-[10px]" style={{ fontFamily: "var(--font-heading)" }}>
                  as of{" "}
                  {new Date(record.hobbs.asOf + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>
              <div className="px-4">
                <EditableMetric
                  label="Hobbs Reading"
                  value={record.hobbs.current}
                  unit="hrs"
                  decimal
                  onSave={v => updateField("hobbs", "current", v)}
                />
                <div className="py-3 flex items-center gap-2">
                  <span className="text-white/30 text-[10px]" style={{ fontFamily: "var(--font-heading)" }}>
                    DELTA FROM AIRFRAME TT
                  </span>
                  <span className="text-white/50 text-xs font-mono tabular-nums ml-auto">
                    {record.hobbs.current > 0 || record.airframe.totalTime > 0
                      ? (record.hobbs.current - record.airframe.totalTime).toFixed(1)
                      : "—"
                    }
                    {" hrs"}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* History */}
        {record && <HistoryFeed entries={history} />}

      </div>
    </div>
  )
}
