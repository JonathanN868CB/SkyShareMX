import { useState, useCallback, useRef, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import * as XLSX from "xlsx"
import {
  ArrowLeft, Upload, FileSpreadsheet, X, AlertTriangle,
  CheckCircle2, ClipboardList, GripVertical, Check,
  Trash2, Pencil, TriangleAlert, ShieldAlert, PackageCheck,
  ChevronDown, ChevronRight, Plus, Zap, BookText, Clock, FileText,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { cn } from "@/shared/lib/utils"
import { getFleetAircraft, createWorkOrder, updateWorkOrder, upsertWOItem, deleteWorkOrder, deleteAllWOItems, getMyProfileId, getWorkOrderById, lookupFlatRate, lookupCorrectiveAction } from "../../services"
import type { FleetAircraft, WOItem, LogbookSection, AircraftTimesSnapshot } from "../../types"
import type { LibFlatRate, LibCorrectiveAction } from "../../services/library"
import { supabase } from "@/lib/supabase"
import { TimesEditModal } from "./TimesEditModal"

// ─── Traxxall parser ──────────────────────────────────────────────────────────

const MA_MAP: Record<string, LogbookSection> = {
  "A/F":   "Airframe",
  "ENG1":  "Engine 1",
  "ENG2":  "Engine 2",
  "PROP1": "Propeller",
  "PROP":  "Propeller",
  "APU":   "APU",
}

const SECTION_ORDER: LogbookSection[] = ["Airframe", "Engine 1", "Engine 2", "Propeller", "APU", "Other"]

const SECTION_COLORS: Record<LogbookSection, string> = {
  "Airframe":  "#d4a017",
  "Engine 1":  "#60a5fa",
  "Engine 2":  "#93c5fd",
  "Propeller": "#6ee7b7",
  "APU":       "#c4b5fd",
  "Other":     "#a1a1aa",
}

interface ParsedTask {
  importId:        string
  section:         LogbookSection
  taskNumber:      string
  refCode:         string
  description:     string
  nextDueDate:     string | null
  nextDueHours:    string | null
  remainingDisplay:string
  urgencyDays:     number
  selected:        boolean
}

interface ParsedImport {
  aircraftReg:          string
  aircraftModel:        string
  currentHrsAirframe:   string
  times:                AircraftTimesSnapshot | null
  tasks:                ParsedTask[]
  isFresh?:             boolean
}

function col(headers: (string | null)[], name: string): number {
  return headers.findIndex(h => h && h.trim() === name)
}

// Rows to ignore — calibrated/ATC adjustment values, not actual times
const LA_IGNORE = /^atc\s*\d+|^ach$/i

function numVal(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/,/g, ""))
  return isNaN(n) ? null : n
}

function parseLastActuals(lastSheet: XLSX.WorkSheet): AircraftTimesSnapshot {
  const la = XLSX.utils.sheet_to_json<(string | number | null)[]>(lastSheet, { header: 1, defval: null })
  if (la.length < 2) return emptySnapshot([])

  // ── Detect columnar format (row 0 = component headers) ──────────────────
  // Row 0 looks like: [tailNumber, "A/F", "ENG1", "ENG2", "APU1"]
  const headerRow = la[0] as (string | number | null)[]
  let colAF = -1, colE1 = -1, colE2 = -1, colAPU = -1

  for (let c = 1; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").trim().toUpperCase().replace(/\s+/g, "")
    if (h === "A/F" || h === "AIRFRAME" || h === "AF")    colAF  = c
    else if (/^ENG1?$|^E1$|^ENGINE1?$/.test(h))           colE1  = c
    else if (/^ENG2$|^E2$|^ENGINE2$/.test(h))             colE2  = c
    else if (/^APU\d*$/.test(h))                          colAPU = c
  }

  const isColumnar = colAF > 0 || colE1 > 0

  // ── Build label → full row map ──────────────────────────────────────────
  const rowMap = new Map<string, (string | number | null)[]>()
  for (let i = 1; i < la.length; i++) {
    const row = la[i]
    const label = String(row?.[0] ?? "").trim()
    if (!label || LA_IGNORE.test(label)) continue
    rowMap.set(label.toLowerCase(), row)
  }

  function getFromRow(labelVariants: string[], colIdx: number): number | null {
    for (const lbl of labelVariants) {
      const row = rowMap.get(lbl.toLowerCase())
      if (!row) continue
      const v = numVal(row[colIdx])
      if (v !== null) return v
    }
    return null
  }

  function getStringFromRow(labelVariants: string[], colIdx: number): string | null {
    for (const lbl of labelVariants) {
      const row = rowMap.get(lbl.toLowerCase())
      if (!row) continue
      const v = String(row[colIdx] ?? "").trim()
      if (v) return v
    }
    return null
  }

  // ── Columnar parsing ─────────────────────────────────────────────────────
  if (isColumnar) {
    const afC  = colAF  > 0 ? colAF  : 1
    const e1C  = colE1  > 0 ? colE1  : -1
    const e2C  = colE2  > 0 ? colE2  : -1
    const apuC = colAPU > 0 ? colAPU : -1

    const airframeHrs = getFromRow(["hrs", "ttaf"], afC)
    const landings    = getFromRow(["ldg", "landings", "landing"], afC)

    const eng1Tsn = e1C > 0 ? getFromRow(["hrs", "tsn"], e1C) : null
    const eng1Csn = e1C > 0 ? getFromRow(["enc", "starts", "cycles"], e1C) : null
    const eng1Serial = e1C > 0 ? getStringFromRow(["s/n", "serial", "sn", "serial no", "serial number"], e1C) : null

    const eng2Tsn = e2C > 0 ? getFromRow(["hrs", "tsn"], e2C) : null
    const eng2Csn = e2C > 0 ? getFromRow(["enc", "starts", "cycles"], e2C) : null
    const eng2Serial = e2C > 0 ? getStringFromRow(["s/n", "serial", "sn", "serial no", "serial number"], e2C) : null

    // APU: dedicated column first, then A/F column fallback rows
    const apuHrs    = apuC > 0
      ? getFromRow(["hrs"], apuC)
      : getFromRow(["hrs(apu)", "apu hrs", "apu hours"], afC)
    const apuStarts = apuC > 0
      ? getFromRow(["apus", "starts", "start(apu)"], apuC)
      : getFromRow(["start(apu)", "apu starts", "apus"], afC)
    const apuSerial = apuC > 0
      ? getStringFromRow(["s/n", "serial", "sn", "serial no", "serial number"], apuC)
      : null

    const parseWarnings: string[] = []
    if (airframeHrs === null) parseWarnings.push("Airframe hours not found — enter manually")
    if (landings    === null) parseWarnings.push("Landings not found — enter manually")

    return {
      airframeHrs, landings,
      eng1Tsn, eng1Csn, eng1Serial,
      eng2Tsn, eng2Csn, eng2Serial,
      propTsn: null, propCsn: null, propSerial: null,
      apuHrs, apuStarts, apuSerial,
      hobbs: null,
      parseWarnings,
    }
  }

  // ── Fallback: key-value format (col 0 = label, col 1 = value) ───────────
  const map = new Map<string, number>()
  for (const [lbl, row] of rowMap) {
    const v = numVal(row[1])
    if (v !== null) map.set(lbl, v)
  }
  const kv = (...keys: string[]) => keys.map(k => map.get(k.toLowerCase())).find(v => v != null) ?? null

  return {
    airframeHrs: kv("hrs", "ttaf", "total time"),
    landings:    kv("ldg", "landings", "landing"),
    eng1Tsn:     kv("eng hrs", "engine hrs", "e1 hrs", "tsn"),
    eng1Csn:     kv("enc", "eng cycles", "csn"),
    eng1Serial:  null,
    eng2Tsn:     kv("e2 hrs", "eng2 hrs"),
    eng2Csn:     kv("e2 cycles", "e2 csn"),
    eng2Serial:  null,
    propTsn:     kv("prop hrs", "prop tsn"),
    propCsn:     kv("prop cycles"),
    propSerial:  null,
    apuHrs:      kv("apu hrs", "apu hours", "hrs(apu)"),
    apuStarts:   kv("apu starts", "start(apu)", "apus"),
    apuSerial:   null,
    hobbs:       kv("hobbs"),
    parseWarnings: [],
  }
}

function emptySnapshot(warnings: string[]): AircraftTimesSnapshot {
  return {
    airframeHrs: null, landings: null,
    eng1Tsn: null, eng1Csn: null, eng1Serial: null,
    eng2Tsn: null, eng2Csn: null, eng2Serial: null,
    propTsn: null, propCsn: null, propSerial: null,
    apuHrs: null, apuStarts: null, apuSerial: null,
    hobbs: null,
    parseWarnings: warnings,
  }
}

function parseTraxxall(wb: XLSX.WorkBook): ParsedImport | null {
  const taskSheet = wb.Sheets["Task Export"]
  const lastSheet = wb.Sheets["Last Actuals"]
  if (!taskSheet) return null

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(taskSheet, { header: 1, defval: null })
  if (rows.length < 2) return null

  const headers = rows[0] as (string | null)[]
  const iAcReg   = col(headers, "A/C Reg.")
  const iAcModel = col(headers, "A/C Model")
  const iMA      = col(headers, "MA")
  const iATA     = col(headers, "ATA")
  const iTaskNo  = col(headers, "Task No")
  const iType    = col(headers, "Task Type")
  const iDesc    = col(headers, "Description")
  const iNDD     = col(headers, "Next Due Date")
  const iNDHrs   = col(headers, "Next Due")
  const iRemain  = col(headers, "Remaining Time")
  const iRTSDays = col(headers, "RTS Days Remaining")
  // Try to find an assembly serial number column (Traxxall may call it various things)
  const iSerial  = ["Assembly S/N", "Component S/N", "S/N", "Serial No", "Serial Number", "Serial"]
    .reduce((found, name) => found >= 0 ? found : col(headers, name), -1)

  let aircraftReg   = ""
  let aircraftModel = ""

  const times = lastSheet ? parseLastActuals(lastSheet) : null
  const currentHrsAirframe = times?.airframeHrs != null ? String(times.airframeHrs) : ""

  // Collect first serial seen per MA code from Task Export rows
  const maSerials: Record<string, string> = {}

  const tasks: ParsedTask[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as (string | number | null)[]
    if (!row || row.every(c => c === null)) continue

    const taskType = String(row[iType] ?? "").trim()
    if (taskType === "Part") continue

    if (!aircraftReg)   aircraftReg   = String(row[iAcReg]   ?? "").trim()
    if (!aircraftModel) aircraftModel = String(row[iAcModel]  ?? "").trim()

    const ma      = String(row[iMA]     ?? "").trim()

    // Capture assembly serial from Task Export if the column exists
    if (iSerial >= 0 && ma && !maSerials[ma]) {
      const s = String(row[iSerial] ?? "").trim()
      if (s) maSerials[ma] = s
    }
    const section = MA_MAP[ma] ?? "Other"
    const ata     = String(row[iATA]    ?? "").trim()
    const taskNo  = String(row[iTaskNo] ?? "").trim()
    const desc    = String(row[iDesc]   ?? "").trim()
    const ndd     = row[iNDD]   != null ? String(row[iNDD]).trim()   : null
    const ndh     = row[iNDHrs] != null ? String(row[iNDHrs]).trim() : null
    const remain  = row[iRemain] != null ? String(row[iRemain]).trim() : ""

    let urgencyDays = 99999
    if (iRTSDays >= 0 && row[iRTSDays] != null) {
      const raw = parseFloat(String(row[iRTSDays]))
      if (!isNaN(raw)) urgencyDays = raw
    } else if (remain) {
      const dayMatch = remain.match(/^(-?\d+)\s*Day/)
      if (dayMatch) urgencyDays = parseInt(dayMatch[1])
    }

    const taskNumber = [ata ? `ATA ${ata}` : null, taskNo || null].filter(Boolean).join(" — ")

    tasks.push({
      importId: `import-${i}`, section, taskNumber, refCode: taskNo,
      description: desc, nextDueDate: ndd, nextDueHours: ndh,
      remainingDisplay: remain, urgencyDays, selected: true,
    })
  }

  tasks.sort((a, b) => {
    const sd = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
    if (sd !== 0) return sd
    return a.urgencyDays - b.urgencyDays
  })

  // Merge Task Export serials into the times snapshot (Last Actuals serials take precedence)
  const patchedTimes = times ? {
    ...times,
    eng1Serial: times.eng1Serial ?? maSerials["ENG1"] ?? null,
    eng2Serial: times.eng2Serial ?? maSerials["ENG2"] ?? null,
    propSerial: times.propSerial ?? maSerials["PROP1"] ?? maSerials["PROP"] ?? null,
    apuSerial:  times.apuSerial  ?? maSerials["APU"]  ?? null,
  } : null

  return { aircraftReg, aircraftModel, currentHrsAirframe, times: patchedTimes, tasks }
}

// ─── Drag-and-drop helpers ────────────────────────────────────────────────────
function reorderTasks(tasks: ParsedTask[], dragId: string, targetId: string): ParsedTask[] {
  const list    = [...tasks]
  const fromIdx = list.findIndex(t => t.importId === dragId)
  const toIdx   = list.findIndex(t => t.importId === targetId)
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return list
  const [item] = list.splice(fromIdx, 1)
  // Recalculate toIdx after splice
  const newTo = list.findIndex(t => t.importId === targetId)
  list.splice(newTo, 0, item)
  return list
}

function moveSectionTasks(tasks: ParsedTask[], dragId: string, targetSection: LogbookSection): ParsedTask[] {
  return tasks.map(t => t.importId === dragId ? { ...t, section: targetSection } : t)
}


// ─── Library lookup state ─────────────────────────────────────────────────────
type LibStatus = "idle" | "found" | "not_found"

interface TaskLibState {
  caStatus:  LibStatus
  frStatus:  LibStatus
  applyCA:   boolean
  applyFR:   boolean
  caText:    string | null      // fetched corrective action text
  frHours:   number | null      // fetched flat rate hours
  frRate:    number | null      // fetched flat rate labor rate
}

// ─── Sub-component: Library status chip ───────────────────────────────────────
function LibChip({ status, label }: { status: LibStatus; label: string }) {
  if (status === "idle") return null
  const found = status === "found"
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{
        background: found ? "rgba(110,231,183,0.12)" : "rgba(239,68,68,0.1)",
        color:      found ? "#6ee7b7" : "#f87171",
        border:     `1px solid ${found ? "rgba(110,231,183,0.3)" : "rgba(239,68,68,0.25)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {found ? `✓ ${label}` : `✕ ${label}`}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
type Mode = "choose" | "fresh" | "import-upload" | "import-review"

export default function WorkOrderCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rebuildId = searchParams.get("rebuild")   // ?rebuild=<wo_id> → re-enter builder on existing draft
  const isQuoteMode = searchParams.get("type") === "quote"   // ?type=quote → build a customer quote

  const [mode, setMode]   = useState<Mode>("choose")

  // Auto-saved draft — created when entering import-review, deleted if user backs out
  const [draftWoId,     setDraftWoId]     = useState<string | null>(null)
  const [draftWoNumber, setDraftWoNumber] = useState<string | null>(null)
  // true = rebuild mode: editing an existing draft from WorkOrderDetail
  const [isRebuild, setIsRebuild] = useState(false)
  const rebuildDoneRef = useRef(false)   // prevent double-fire when fleet loads

  // Fleet data
  const [fleet, setFleet]         = useState<FleetAircraft[]>([])
  const [aircraftMode, setAircraftMode] = useState<"fleet" | "guest">("fleet")

  useEffect(() => {
    getFleetAircraft()
      .then(ac => setFleet(ac))
      .catch(() => {/* silently degrade — dropdown will be empty */})
  }, [])

  // ── Rebuild mode: load existing draft and jump straight to review ──────────
  useEffect(() => {
    if (!rebuildId) return
    if (rebuildDoneRef.current) return   // only run once even when fleet loads
    rebuildDoneRef.current = true
    ;(async () => {
      try {
        const wo = await getWorkOrderById(rebuildId)
        if (!wo || wo.status !== "draft") return
        // Match fleet aircraft
        const matchedAc = fleet.find(a => a.id === wo.aircraftId)
        const reg   = wo.aircraft?.registration ?? wo.guestRegistration ?? matchedAc?.registration ?? matchedAc?.serialNumber ?? ""
        const model = wo.aircraft ? `${wo.aircraft.make ?? ""} ${wo.aircraft.modelFull ?? ""}`.trim()
                    : matchedAc ? `${matchedAc.make} ${matchedAc.modelFull}`.trim() : ""

        // Restore times from the stored snapshot
        const snap = wo.timesSnapshot as Record<string, number | null> | null
        const restoredTimes: AircraftTimesSnapshot | null = snap ? {
          airframeHrs:   snap.airframeHrs   ?? null,
          landings:      snap.landings      ?? null,
          eng1Tsn:       snap.eng1Tsn       ?? null,
          eng1Csn:       snap.eng1Csn       ?? null,
          eng2Tsn:       snap.eng2Tsn       ?? null,
          eng2Csn:       snap.eng2Csn       ?? null,
          propTsn:       snap.propTsn       ?? null,
          propCsn:       snap.propCsn       ?? null,
          apuHrs:        snap.apuHrs        ?? null,
          apuStarts:     snap.apuStarts     ?? null,
          hobbs:         snap.hobbs         ?? null,
          parseWarnings: [],
        } : null

        // Restore tasks from existing WO items
        const restoredTasks: ParsedTask[] = wo.items.map(item => ({
          importId:         item.id,
          section:          item.logbookSection,
          description:      item.category,
          taskNumber:       item.taskNumber ?? "",
          nextDueDate:      null,
          nextDueHours:     null,
          remainingDisplay: "",
          urgencyDays:      0,
          selected:         true,
        }))

        setParsed({
          aircraftReg:        reg,
          aircraftModel:      model,
          currentHrsAirframe: wo.meterAtOpen != null ? String(wo.meterAtOpen) : "",
          times:              restoredTimes,
          tasks:              restoredTasks,
        })
        setDraftWoId(wo.id)
        setDraftWoNumber(wo.woNumber)
        setIsRebuild(true)
        setMode("import-review")
      } catch {/* silently ignore — bad ID */}
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildId, fleet.length])

  // ── Auto-save draft when entering import-review ────────────────────────────
  async function autoSaveDraftWO(reg: string, model: string, meterAtOpen: number | null | undefined): Promise<{ id: string; woNumber: string } | null> {
    try {
      const profileId = await getMyProfileId()
      if (!profileId) return null
      const wo = await createWorkOrder({
        description:       `Draft — ${reg}`,
        guestRegistration: reg || undefined,
        meterAtOpen:       meterAtOpen ?? undefined,
        openedBy:          profileId,
        woType:            isQuoteMode ? "quote" : "work_order",
      })
      setDraftWoId(wo.id)
      setDraftWoNumber(wo.woNumber)
      return { id: wo.id, woNumber: wo.woNumber }
    } catch {
      return null   // non-fatal — fall back to creating on commit
    }
  }

  // ── Discard auto-saved draft if user navigates back before committing ──────
  async function discardDraft() {
    if (draftWoId && !isRebuild) {
      try { await deleteWorkOrder(draftWoId) } catch {/* ignore */}
    }
    setDraftWoId(null)
    setDraftWoNumber(null)
    setIsRebuild(false)
  }

  // Fresh form
  const [form, setForm]     = useState({
    aircraftId: "", guestRegistration: "", guestSerial: "", meterAtOpen: "",
  })
  const [submitting, setSubmitting]   = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  // Upload state
  const [dropZoneActive, setDropZoneActive] = useState(false)
  const [parseError, setParseError]         = useState<string | null>(null)
  const [parsed, setParsed]                 = useState<ParsedImport | null>(null)
  // Hobbs differential — fetched from aircraft_details when aircraft is matched
  const [hobbsDiff, setHobbsDiff]           = useState<number | null>(null)

  // Review state
  const [draggedId, setDraggedId]           = useState<string | null>(null)
  const [ghostPos, setGhostPos]             = useState<{ x: number; y: number } | null>(null)
  const [gapBeforeId, setGapBeforeId]       = useState<string | null>(null)
  const [gapSection, setGapSection]         = useState<LogbookSection | null>(null)
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [editText, setEditText]             = useState("")
  const [collapsedSections, setCollapsedSections] = useState<Set<LogbookSection>>(new Set())
  const [deletedIds, setDeletedIds]         = useState<Set<string>>(new Set())  // for fade-out
  const editRef    = useRef<HTMLInputElement>(null)
  const rowEls     = useRef(new Map<string, HTMLDivElement>())
  const dragMeta   = useRef({ ox: 0, oy: 0, h: 52, w: 600, color: "#d4a017" })
  const gapRef     = useRef<{ beforeId: string; section: LogbookSection } | null>(null)
  const parsedRef  = useRef(parsed)
  parsedRef.current = parsed  // keep current every render (no effect needed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const computeGapRef = useRef<(clientY: number, excludeId: string) => { beforeId: string; section: LogbookSection } | null>(null as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commitDropRef = useRef<(dragId: string) => void>(null as any)
  const dragState  = useRef<{ id: string; startX: number; startY: number; active: boolean } | null>(null)

  // Aircraft times edit modal state
  const [timesEditOpen, setTimesEditOpen] = useState(false)

  // Add-item state (import review)
  const [addingToSection, setAddingToSection] = useState<LogbookSection | null>(null)
  const [newTaskDesc, setNewTaskDesc]         = useState("")
  const [newTaskNum, setNewTaskNum]           = useState("")

  // ── Library lookup state — keyed by task.importId ────────────────────────
  const [libCache, setLibCache] = useState<Record<string, TaskLibState>>({})
  // Progress counter: scoped to a specific section so other sections don't show it
  const [libProgress, setLibProgress] = useState<{ section: LogbookSection; done: number; total: number; type: "ca" | "fr" } | null>(null)
  // Per-section applied state: tracks whether "Add" has been run (so button shows "Remove")
  const [sectionApplied, setSectionApplied] = useState<Record<string, { ca: boolean; fr: boolean }>>({})
  // Per-section removing animation (brief flash when removing)
  const [sectionRemoving, setSectionRemoving] = useState<Record<string, { ca: boolean; fr: boolean }>>({})

  // Fetch Hobbs differential when a parsed aircraft is matched to the fleet
  useEffect(() => {
    const reg = parsed?.aircraftReg
    if (!reg) { setHobbsDiff(null); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from("aircraft_details")
      .select("hobbs_differential")
      .eq("tail_number", reg)
      .maybeSingle()
      .then(({ data }: { data: { hobbs_differential: number | null } | null }) => {
        setHobbsDiff(data?.hobbs_differential != null ? Number(data.hobbs_differential) : null)
      })
      .catch(() => setHobbsDiff(null))
  }, [parsed?.aircraftReg])

  // ── Fresh form ─────────────────────────────────────────────────────────────
  async function handleFreshContinue() {
    const ac = fleet.find(a => a.id === form.aircraftId)
    const aircraftReg = aircraftMode === "fleet"
      ? (ac?.registration ?? ac?.serialNumber ?? "")
      : form.guestRegistration
    const aircraftModel = aircraftMode === "fleet"
      ? `${ac?.make ?? ""} ${ac?.modelFull ?? ""}`.trim()
      : ""
    const meterAtOpen = form.meterAtOpen ? parseFloat(form.meterAtOpen) : null
    setParsed({
      aircraftReg,
      aircraftModel,
      currentHrsAirframe: form.meterAtOpen,
      times: null,
      tasks: [],
      isFresh: true,
    })
    setMode("import-review")
    // Auto-save draft in background — don't block navigation
    autoSaveDraftWO(aircraftReg, aircraftModel, meterAtOpen)
  }

  // (legacy — kept for error state reset)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const profileId = await getMyProfileId()
      if (!profileId) throw new Error("Not authenticated")
      const wo = await createWorkOrder({
        aircraftId: aircraftMode === "fleet" ? form.aircraftId || undefined : undefined,
        guestRegistration: aircraftMode === "guest" ? form.guestRegistration || undefined : undefined,
        guestSerial: aircraftMode === "guest" ? form.guestSerial || undefined : undefined,
        meterAtOpen: form.meterAtOpen ? parseFloat(form.meterAtOpen) : undefined,
        openedBy: profileId,
        woType: isQuoteMode ? "quote" : "work_order",
      })
      navigate(`/app/beet-box/work-orders/${wo.id}`)
    } catch (err) {
      console.error("Failed to create work order:", err)
      setSubmitting(false)
    }
  }

  // ── File handling ──────────────────────────────────────────────────────────
  function processFile(file: File) {
    setParseError(null)
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setParseError("Please upload an Excel file (.xlsx or .xls).")
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data   = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb     = XLSX.read(data, { type: "array", cellDates: true })
        const result = parseTraxxall(wb)
        if (!result || result.tasks.length === 0) {
          setParseError("No tasks found. Make sure this is a Traxxall basket export with a 'Task Export' sheet.")
          return
        }
        setParsed(result)
        setMode("import-review")
        // Auto-save draft in background — don't block navigation
        autoSaveDraftWO(result.aircraftReg, result.aircraftModel, result.times?.airframeHrs ?? null)
      } catch {
        setParseError("Could not read this file. Make sure it's a valid Traxxall Excel export.")
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDropZoneActive(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  // ── Review: task mutations ──────────────────────────────────────────────────
  function toggleTask(id: string) {
    setParsed(p => p ? { ...p, tasks: p.tasks.map(t => t.importId === id ? { ...t, selected: !t.selected } : t) } : p)
  }

  function deleteTask(id: string) {
    setDeletedIds(d => new Set([...d, id]))
    setTimeout(() => {
      setParsed(p => p ? { ...p, tasks: p.tasks.filter(t => t.importId !== id) } : p)
      setDeletedIds(d => { const n = new Set(d); n.delete(id); return n })
    }, 280)
  }

  function toggleSection(section: LogbookSection) {
    if (!parsed) return
    const sectionTasks = parsed.tasks.filter(t => t.section === section)
    const allSelected  = sectionTasks.every(t => t.selected)
    setParsed(p => p ? { ...p, tasks: p.tasks.map(t => t.section === section ? { ...t, selected: !allSelected } : t) } : p)
  }

  function collapseSection(section: LogbookSection) {
    setCollapsedSections(s => {
      const n = new Set(s)
      n.has(section) ? n.delete(section) : n.add(section)
      return n
    })
  }

  // ── Review: inline edit ───────────────────────────────────────────────────
  function startEdit(task: ParsedTask) {
    setEditingId(task.importId)
    setEditText(task.description)
    setTimeout(() => editRef.current?.select(), 30)
  }

  function commitEdit(id: string) {
    if (editText.trim()) {
      setParsed(p => p ? { ...p, tasks: p.tasks.map(t => t.importId === id ? { ...t, description: editText.trim() } : t) } : p)
    }
    setEditingId(null)
  }

  // ── Review: pointer drag-and-drop ────────────────────────────────────────

  // Always-current helpers — updated every render so effects always get latest state
  computeGapRef.current = (clientY, excludeId) => {
    const p = parsedRef.current
    if (!p) return null
    const visible = p.tasks.filter(t =>
      t.importId !== excludeId &&
      !deletedIds.has(t.importId) &&
      !collapsedSections.has(t.section)
    )
    for (const task of visible) {
      const el = rowEls.current.get(task.importId)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        return { beforeId: task.importId, section: task.section }
      }
    }
    const last = visible[visible.length - 1]
    return { beforeId: "__end__", section: last?.section ?? "Airframe" }
  }

  commitDropRef.current = (dragId) => {
    const gap = gapRef.current
    const p = parsedRef.current
    if (!gap || !p) return
    const dragged = p.tasks.find(t => t.importId === dragId)
    if (!dragged) return
    const updated = { ...dragged, section: gap.section }
    const next = p.tasks.filter(t => t.importId !== dragId)
    if (gap.beforeId === "__end__") {
      const lastIdx = next.reduce<number>((acc, t, i) => t.section === gap.section ? i : acc, -1)
      next.splice(lastIdx + 1, 0, updated)
    } else {
      const idx = next.findIndex(t => t.importId === gap.beforeId)
      next.splice(idx >= 0 ? idx : next.length, 0, updated)
    }
    setParsed(prev => prev ? { ...prev, tasks: next } : prev)
  }

  // Arm drag on any pointer-down on a row (threshold activates it)
  function startDrag(e: React.PointerEvent, importId: string) {
    if (e.button !== 0) return
    dragState.current = { id: importId, startX: e.clientX, startY: e.clientY, active: false }
    document.body.style.userSelect = "none"
  }

  // Global pointer tracking — mounted once, reads refs so no stale-closure issues
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const ds = dragState.current
      if (!ds) return

      if (!ds.active) {
        // Only activate after crossing a 5px threshold — preserves click interactions
        if (Math.hypot(e.clientX - ds.startX, e.clientY - ds.startY) < 5) return
        ds.active = true
        const el = rowEls.current.get(ds.id)
        const p  = parsedRef.current
        if (el && p) {
          const rect = el.getBoundingClientRect()
          dragMeta.current = {
            ox: ds.startX - rect.left,
            oy: ds.startY - rect.top,
            h: rect.height,
            w: rect.width,
            color: SECTION_COLORS[p.tasks.find(t => t.importId === ds.id)?.section ?? "Airframe"],
          }
        }
        document.body.style.cursor = "grabbing"
        setDraggedId(ds.id)
      }

      setGhostPos({ x: e.clientX, y: e.clientY })
      const gap = computeGapRef.current(e.clientY, ds.id)
      gapRef.current = gap
      setGapBeforeId(gap?.beforeId ?? null)
      setGapSection(gap?.section ?? null)
    }

    const onUp = () => {
      const ds = dragState.current
      if (ds?.active) {
        commitDropRef.current(ds.id)
        setDraggedId(null); setGhostPos(null); setGapBeforeId(null); setGapSection(null)
        gapRef.current = null
        document.body.style.cursor = ""
      }
      dragState.current = null
      document.body.style.userSelect = ""
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  // ── Library lookup helpers ────────────────────────────────────────────────
  const aircraftModel = parsed?.aircraftModel ?? ""

  function getLib(importId: string): TaskLibState {
    return libCache[importId] ?? {
      caStatus: "idle", frStatus: "idle",
      applyCA: false, applyFR: false,
      caText: null, frHours: null, frRate: null,
    }
  }

  async function lookupTaskCA(importId: string, refCode: string): Promise<TaskLibState> {
    const result: LibCorrectiveAction | null = await lookupCorrectiveAction(aircraftModel, refCode)
    const patch: Partial<TaskLibState> = result
      ? { caStatus: "found", applyCA: true, caText: result.correctiveActionText }
      : { caStatus: "not_found", applyCA: false, caText: null }
    const next = { ...getLib(importId), ...patch }
    setLibCache(c => ({ ...c, [importId]: next }))
    return next
  }

  async function lookupTaskFR(importId: string, refCode: string): Promise<TaskLibState> {
    const result: LibFlatRate | null = await lookupFlatRate(aircraftModel, refCode)
    const patch: Partial<TaskLibState> = result
      ? { frStatus: "found", applyFR: true, frHours: result.hours, frRate: result.laborRate }
      : { frStatus: "not_found", applyFR: false, frHours: null, frRate: null }
    const next = { ...getLib(importId), ...patch }
    setLibCache(c => ({ ...c, [importId]: next }))
    return next
  }

  function toggleApplyCA(importId: string) {
    const cur = getLib(importId)
    if (cur.caStatus === "idle") return // must lookup first
    setLibCache(c => ({ ...c, [importId]: { ...cur, applyCA: !cur.applyCA } }))
  }

  function toggleApplyFR(importId: string) {
    const cur = getLib(importId)
    if (cur.frStatus === "idle") return
    setLibCache(c => ({ ...c, [importId]: { ...cur, applyFR: !cur.applyFR } }))
  }

  async function applyLibraryToSection(section: LogbookSection, type: "ca" | "fr") {
    if (!parsed) return
    const key = type === "ca" ? "ca" : "fr"
    const cur = sectionApplied[section] ?? { ca: false, fr: false }

    if (cur[key]) {
      // ── Remove ── flash "removing" briefly, clear cache for this section
      setSectionRemoving(s => ({ ...s, [section]: { ...(s[section] ?? { ca: false, fr: false }), [key]: true } }))
      const tasks = parsed.tasks.filter(t => t.section === section)
      // Quick removal with brief per-item delay for visual effect
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i]
        setLibCache(c => {
          const cur2 = c[t.importId]
          if (!cur2) return c
          const cleared: Partial<TaskLibState> = type === "ca"
            ? { caStatus: "idle", applyCA: false, caText: null }
            : { frStatus: "idle", applyFR: false, frHours: null, frRate: null }
          return { ...c, [t.importId]: { ...cur2, ...cleared } }
        })
        setLibProgress({ section, done: i + 1, total: tasks.length, type })
        await new Promise(r => setTimeout(r, 30))  // brief stagger for visual
      }
      await new Promise(r => setTimeout(r, 400))
      setSectionRemoving(s => ({ ...s, [section]: { ...(s[section] ?? { ca: false, fr: false }), [key]: false } }))
      setSectionApplied(s => ({ ...s, [section]: { ...(s[section] ?? { ca: false, fr: false }), [key]: false } }))
      setLibProgress(null)
    } else {
      // ── Add ── batch lookup for all eligible tasks
      const tasks = parsed.tasks.filter(t => t.section === section && t.selected && t.taskNumber)
      if (tasks.length === 0) return
      setLibProgress({ section, done: 0, total: tasks.length, type })
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i]
        if (type === "ca") await lookupTaskCA(t.importId, t.taskNumber)
        else               await lookupTaskFR(t.importId, t.taskNumber)
        setLibProgress({ section, done: i + 1, total: tasks.length, type })
      }
      setSectionApplied(s => ({ ...s, [section]: { ...(s[section] ?? { ca: false, fr: false }), [key]: true } }))
      setTimeout(() => setLibProgress(p => p?.section === section && p.type === type ? null : p), 800)
    }
  }

  // ── Manual task addition (import review) ─────────────────────────────────
  function addTask(section: LogbookSection) {
    if (!newTaskDesc.trim()) return
    const task: ParsedTask = {
      importId:         `manual-${Date.now()}`,
      section,
      taskNumber:       newTaskNum.trim(),
      refCode:          newTaskNum.trim(),
      description:      newTaskDesc.trim(),
      nextDueDate:      null,
      nextDueHours:     null,
      remainingDisplay: "",
      urgencyDays:      9999,
      selected:         true,
    }
    setParsed(p => p ? { ...p, tasks: [...p.tasks, task] } : p)
    setNewTaskDesc(""); setNewTaskNum(""); setAddingToSection(null)
  }

  // ── Build WO ──────────────────────────────────────────────────────────────
  async function createFromImport() {
    if (!parsed || submitting) return
    const selected = parsed.tasks.filter(t => t.selected)
    if (selected.length === 0) return

    setSubmitting(true)
    setCommitError(null)
    try {
      const profileId = await getMyProfileId()
      if (!profileId) throw new Error("Not authenticated — could not resolve profile")

      const matchedAircraft = fleet.find(a =>
        (a.registration ?? "").replace(/\s/g, "").toUpperCase() ===
        parsed.aircraftReg.replace(/\s/g, "").toUpperCase()
      )
      const sections   = [...new Set(selected.map(t => t.section))]
      const desc = parsed.isFresh
        ? `${parsed.aircraftReg} — ${selected.length} item${selected.length !== 1 ? "s" : ""}: ${sections.join(", ")}`
        : `Traxxall import — ${parsed.aircraftReg}. ${selected.length} tasks across ${sections.join(", ")}.`
      const meterAtOpen = parsed.times?.airframeHrs ?? (parsed.currentHrsAirframe ? parseFloat(parsed.currentHrsAirframe) : undefined)
      // Strip parseWarnings before storing — store only numeric fields
      const timesSnapshot = parsed.times
        ? (({ parseWarnings, ...rest }) => rest)(parsed.times) as Record<string, number | null>
        : null

      let woId: string

      if (draftWoId) {
        // Use the auto-saved draft — update identity, description, meter, and times snapshot
        woId = draftWoId
        if (isRebuild) {
          // Clear existing items before re-committing
          await deleteAllWOItems(woId)
        }
        await updateWorkOrder(woId, {
          description:       desc,
          aircraftId:        matchedAircraft?.id ?? null,
          guestRegistration: matchedAircraft ? null : parsed.aircraftReg,
          meterAtOpen:       meterAtOpen ?? undefined,
          timesSnapshot,
        })
      } else {
        // Fallback: create fresh (auto-save may have failed)
        const wo = await createWorkOrder({
          description:       desc,
          aircraftId:        matchedAircraft?.id ?? undefined,
          guestRegistration: matchedAircraft ? undefined : parsed.aircraftReg,
          meterAtOpen,
          openedBy:          profileId,
          woType:            isQuoteMode ? "quote" : "work_order",
        })
        woId = wo.id
        // Patch the snapshot onto the freshly-created WO
        await updateWorkOrder(woId, { timesSnapshot })
      }

      // Save all items sequentially to avoid RLS race on mechanic_id check
      for (let idx = 0; idx < selected.length; idx++) {
        const t = selected[idx]
        const lib = libCache[t.importId]
        const correctiveAction = (lib?.applyCA && lib.caText) ? lib.caText : ""
        const estimatedHours   = (lib?.applyFR && lib.frHours != null) ? lib.frHours : 0
        const laborRate        = (lib?.applyFR && lib.frRate  != null) ? lib.frRate  : 125
        await upsertWOItem({
          workOrderId:         woId,
          itemNumber:          idx + 1,
          category:            t.description,
          logbookSection:      t.section,
          taskNumber:          t.taskNumber || null,
          refCode:             t.refCode || null,
          discrepancy:         `Perform ${t.description}.`,
          correctiveAction,
          estimatedHours,
          laborRate,
          shippingCost:        0,
          outsideServicesCost: 0,
          signOffRequired:     true,
          itemStatus:          "pending",
          noPartsRequired:     false,
        })
      }

      navigate(`/app/beet-box/work-orders/${woId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      console.error("Commit failed:", msg)
      setCommitError(msg)
      setSubmitting(false)
    }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const selectedCount = parsed?.tasks.filter(t => t.selected).length ?? 0
  const overdueCount  = parsed?.tasks.filter(t => t.selected && t.urgencyDays < 0).length ?? 0
  const dueSoonCount  = parsed?.tasks.filter(t => t.selected && t.urgencyDays >= 0 && t.urgencyDays < 14).length ?? 0
  const isValid       = aircraftMode === "fleet" ? !!form.aircraftId : !!form.guestRegistration

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      {mode !== "import-review" && (
        <>
          <div className="hero-area px-8 pt-14 pb-7">
            <button
              onClick={() => mode === "choose" ? navigate("/app/beet-box/work-orders") : setMode("choose")}
              className="flex items-center gap-1.5 text-white/65 hover:text-white text-xs font-semibold mb-5 px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "hsl(0,0%,17%)", border: "1px solid hsl(0,0%,26%)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {mode === "choose" ? "Work Orders" : "Back"}
            </button>
            <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              {isQuoteMode ? "New Work Order Quote" : "New Work Order"}
            </h1>
            <p className="text-white/40 text-sm mt-1">
              {isQuoteMode ? "Build a customer estimate before work begins" : "Open a new maintenance work order"}
            </p>
          </div>
          <div className="stripe-divider" />
        </>
      )}

      {/* ── CHOOSE ──────────────────────────────────────────────────────────── */}
      {mode === "choose" && (
        <div className="px-8 py-8 max-w-3xl">
          <p className="text-white/40 text-sm mb-6">How do you want to start?</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode("fresh")}
              className="text-left p-6 rounded-2xl transition-all"
              style={{ background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,22%)" }}
              onMouseEnter={e => (e.currentTarget.style.border = "1px solid hsl(0,0%,32%)")}
              onMouseLeave={e => (e.currentTarget.style.border = "1px solid hsl(0,0%,22%)")}
            >
              <ClipboardList className="w-8 h-8 mb-4 text-white/40" />
              <h3 className="text-white font-bold text-base mb-2">Start Fresh</h3>
              <p className="text-white/40 text-sm leading-relaxed">
                Manually enter aircraft, work type, and build items from scratch. For squawks and unscheduled work.
              </p>
            </button>
            <button
              onClick={() => setMode("import-upload")}
              className="text-left p-6 rounded-2xl transition-all relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.12), rgba(212,160,23,0.04))", border: "1px solid rgba(212,160,23,0.35)" }}
              onMouseEnter={e => (e.currentTarget.style.border = "1px solid rgba(212,160,23,0.6)")}
              onMouseLeave={e => (e.currentTarget.style.border = "1px solid rgba(212,160,23,0.35)")}
            >
              <FileSpreadsheet className="w-8 h-8 mb-4" style={{ color: "var(--skyshare-gold)" }} />
              <h3 className="text-white font-bold text-base mb-2">Import from Traxxall</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Upload a basket export and we'll organize the entire work order automatically — aircraft, sections, tasks.
              </p>
              <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                style={{ background: "rgba(212,160,23,0.2)", color: "var(--skyshare-gold)" }}>
                Recommended
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── FRESH FORM — aircraft picker only, then jumps to the board UI ─── */}
      {mode === "fresh" && (
        <div className="px-8 py-8 max-w-lg">
          <p className="text-white/40 text-sm mb-6">Which aircraft is this work order for?</p>
          <div className="space-y-4">
            {/* Fleet / Guest toggle */}
            <div className="flex rounded overflow-hidden w-fit" style={{ border: "1px solid hsl(0,0%,25%)" }}>
              {(["fleet", "guest"] as const).map(m => (
                <button key={m} type="button" onClick={() => setAircraftMode(m)}
                  className={cn("px-3 py-1.5 text-xs transition-colors", aircraftMode === m ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60")}>
                  {m === "fleet" ? "From Fleet" : "Guest / Manual"}
                </button>
              ))}
            </div>

            {aircraftMode === "fleet" ? (
              <select value={form.aircraftId} onChange={e => setForm(f => ({ ...f, aircraftId: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-white/10 text-white focus:outline-none focus:border-white/30"
                style={{ background: "hsl(0,0%,14%)", colorScheme: "dark" }}>
                <option value="">Select aircraft…</option>
                {fleet.map(ac => (
                  <option key={ac.id} value={ac.id}>
                    {ac.registration ?? ac.serialNumber} — {ac.make} {ac.modelFull} ({ac.year})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  placeholder="Tail number (e.g. N863CB)"
                  value={form.guestRegistration}
                  onChange={e => setForm(f => ({ ...f, guestRegistration: e.target.value }))}
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                />
                <input
                  placeholder="Serial (optional)"
                  value={form.guestSerial}
                  onChange={e => setForm(f => ({ ...f, guestSerial: e.target.value }))}
                  className="w-36 px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-white/50 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Current Meter (optional)</label>
              <Input type="number" step="0.1" value={form.meterAtOpen} onChange={e => setForm(f => ({ ...f, meterAtOpen: e.target.value }))}
                placeholder="e.g. 4218.3" className="bg-white/[0.06] border-white/10 text-white/90 placeholder:text-white/25 focus:border-white/30" />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                disabled={!isValid}
                onClick={handleFreshContinue}
                style={{ background: isValid ? "var(--skyshare-gold)" : "rgba(212,160,23,0.2)", color: isValid ? "#000" : "rgba(212,160,23,0.4)" }}
                className="font-semibold px-6"
              >
                Continue →
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode("choose")} className="text-white/50 hover:text-white/80">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT UPLOAD ───────────────────────────────────────────────────── */}
      {mode === "import-upload" && (
        <div className="px-8 py-8 max-w-xl">
          <p className="text-white/40 text-sm mb-6">Export your basket from Traxxall as an Excel file, then upload it here.</p>
          <label
            className="flex flex-col items-center justify-center gap-4 p-12 rounded-2xl cursor-pointer transition-all"
            style={{
              border: dropZoneActive ? "2px dashed rgba(212,160,23,0.8)" : "2px dashed rgba(212,160,23,0.3)",
              background: dropZoneActive ? "rgba(212,160,23,0.08)" : "rgba(212,160,23,0.03)",
            }}
            onDragOver={e => { e.preventDefault(); setDropZoneActive(true) }}
            onDragLeave={() => setDropZoneActive(false)}
            onDrop={onDrop}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.25)" }}>
              <Upload className="w-7 h-7" style={{ color: "var(--skyshare-gold)" }} />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-base">Drop your Traxxall export here</p>
              <p className="text-white/40 text-sm mt-1">or click to browse</p>
              <p className="text-white/25 text-xs mt-3">.xlsx or .xls</p>
            </div>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileInput} />
          </label>
          {parseError && (
            <div className="mt-4 flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{parseError}</p>
            </div>
          )}
          <Button variant="ghost" onClick={() => setMode("choose")} className="mt-6 text-white/40 hover:text-white/70">← Back</Button>
        </div>
      )}

      {/* ── IMPORT REVIEW ───────────────────────────────────────────────────── */}
      {mode === "import-review" && parsed && (
        <div
          className="flex-1 overflow-hidden flex flex-col"
          style={{ background: "hsl(0,0%,9%)" }}
        >

          {/* ── Masthead ──────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 px-8 py-5 flex items-start gap-6"
            style={{
              background: "linear-gradient(to right, hsl(0,0%,11%), hsl(0,0%,9%))",
              borderBottom: "1px solid hsl(0,0%,18%)",
              borderTop: "3px solid var(--skyshare-gold)",
            }}
          >
            {/* Left: aircraft identity */}
            <div className="flex-1 min-w-0">
              <button
                onClick={() => { discardDraft(); setParsed(null); setMode(parsed?.isFresh ? "fresh" : "import-upload") }}
                className="flex items-center gap-1.5 text-white/35 hover:text-white/65 text-xs mb-3 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {parsed?.isFresh ? "Back" : "Upload different file"}
              </button>
              <div className="flex items-center gap-3 mb-1">
                <h1
                  className="font-bold"
                  style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "0.08em", color: "var(--skyshare-gold)" }}
                >
                  {parsed.aircraftReg}
                </h1>
                <span className="text-white/50 text-base">{parsed.aircraftModel}</span>
                {draftWoNumber && (
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider"
                    style={{ background: "rgba(161,161,170,0.15)", border: "1px solid rgba(161,161,170,0.3)", color: "#a1a1aa", fontFamily: "var(--font-heading)" }}
                  >
                    DRAFT · WO# {draftWoNumber}
                  </span>
                )}
              </div>
              <p className="text-white/35 text-sm">
                {isRebuild
                  ? "Rebuilding draft · Re-upload or modify items below, then commit to replace existing items"
                  : parsed?.isFresh ? "New work order · Add work items to sections below, then commit"
                  : "Traxxall basket import · Review and organize before committing to a work order"}
              </p>
            </div>

            {/* Center: aircraft times chip strip (import only) */}
            {!parsed.isFresh && (
              <div className="flex-shrink-0" style={{ maxWidth: "420px", minWidth: "220px" }}>
                {(() => {
                  const t = parsed.times
                  if (t == null) return (
                    <button onClick={() => setTimesEditOpen(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/30 hover:text-white/60 text-xs transition-colors"
                      style={{ border: "1px dashed hsl(0,0%,28%)" }}>
                      <Pencil className="w-3.5 h-3.5" /> No Last Actuals tab — click to enter times manually
                    </button>
                  )

                  type Chip = { key: string; color: string; label: string; lines: { v: string; u: string }[] }
                  const chips: Chip[] = []

                  // Airframe
                  if (t.airframeHrs != null || t.landings != null) {
                    chips.push({ key: "af", color: "#d4a017", label: "A/F", lines: [
                      ...(t.airframeHrs != null ? [{ v: t.airframeHrs.toLocaleString(), u: "hrs" }] : []),
                      ...(t.landings    != null ? [{ v: t.landings.toLocaleString(),    u: "ldg" }] : []),
                    ]})
                  }
                  // Engine 1
                  if (t.eng1Tsn != null || t.eng1Csn != null) {
                    chips.push({ key: "e1", color: "#60a5fa", label: "ENG 1", lines: [
                      ...(t.eng1Tsn != null ? [{ v: t.eng1Tsn.toLocaleString(), u: "TSN" }] : []),
                      ...(t.eng1Csn != null ? [{ v: t.eng1Csn.toLocaleString(), u: "ENC" }] : []),
                    ]})
                  }
                  // Engine 2
                  if (t.eng2Tsn != null || t.eng2Csn != null) {
                    chips.push({ key: "e2", color: "#93c5fd", label: "ENG 2", lines: [
                      ...(t.eng2Tsn != null ? [{ v: t.eng2Tsn.toLocaleString(), u: "TSN" }] : []),
                      ...(t.eng2Csn != null ? [{ v: t.eng2Csn.toLocaleString(), u: "ENC" }] : []),
                    ]})
                  }
                  // Propeller
                  if (t.propTsn != null || t.propCsn != null) {
                    chips.push({ key: "prop", color: "#6ee7b7", label: "PROP", lines: [
                      ...(t.propTsn != null ? [{ v: t.propTsn.toLocaleString(), u: "TSN" }] : []),
                      ...(t.propCsn != null ? [{ v: t.propCsn.toLocaleString(), u: "CSN" }] : []),
                    ]})
                  }
                  // APU
                  if (t.apuHrs != null || t.apuStarts != null) {
                    chips.push({ key: "apu", color: "#c4b5fd", label: "APU", lines: [
                      ...(t.apuHrs    != null ? [{ v: t.apuHrs.toLocaleString(),    u: "hrs"    }] : []),
                      ...(t.apuStarts != null ? [{ v: t.apuStarts.toLocaleString(), u: "starts" }] : []),
                    ]})
                  }
                  // Hobbs
                  if (t.hobbs != null) {
                    const hobbsLines: { v: string; u: string }[] = [{ v: t.hobbs.toLocaleString(), u: "hrs" }]
                    if (hobbsDiff != null) {
                      const expected = Math.round((t.hobbs + hobbsDiff) * 10) / 10
                      const delta    = t.airframeHrs != null ? Math.round((t.airframeHrs - expected) * 10) / 10 : null
                      if (delta != null && Math.abs(delta) > 0.05) {
                        hobbsLines.push({ v: `Δ ${delta > 0 ? "+" : ""}${delta}`, u: "vs A/F" })
                      }
                    }
                    chips.push({ key: "hobbs", color: hobbsDiff != null && t.airframeHrs != null && Math.abs(Math.round((t.airframeHrs - (t.hobbs + hobbsDiff)) * 10) / 10) > 2 ? "#fbbf24" : "#34d399", label: "HOBBS", lines: hobbsLines })
                  }

                  return (
                    <div className="flex items-stretch gap-2 flex-wrap">
                      {chips.length === 0 ? (
                        <button onClick={() => setTimesEditOpen(true)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-amber-400/70 hover:text-amber-400 text-xs transition-colors"
                          style={{ border: "1px dashed rgba(251,191,36,0.35)" }}>
                          <AlertTriangle className="w-3.5 h-3.5" /> Times could not be parsed — click to enter manually
                        </button>
                      ) : chips.map(chip => (
                        <div
                          key={chip.key}
                          className="flex flex-col justify-between px-3 py-2 rounded-lg"
                          style={{
                            background: `${chip.color}0d`,
                            border: `1px solid ${chip.color}30`,
                            borderTop: `2px solid ${chip.color}`,
                          }}
                        >
                          <span
                            className="text-[9px] font-bold uppercase tracking-widest mb-1.5 leading-none"
                            style={{ color: chip.color, fontFamily: "var(--font-heading)", opacity: 0.8 }}
                          >
                            {chip.label}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            {chip.lines.map((ln, i) => (
                              <div key={i} className="flex items-baseline gap-1">
                                <span className="text-white/85 text-xs font-mono tabular-nums leading-none">{ln.v}</span>
                                <span className="text-white/30 text-[9px] leading-none">{ln.u}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setTimesEditOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg self-center text-white/40 hover:text-white/70 transition-colors text-xs flex-shrink-0 font-medium"
                        style={{ border: "1px solid hsl(0,0%,28%)", fontFamily: "var(--font-heading)" }}
                      >
                        <Pencil className="w-3 h-3" /> Edit Times
                      </button>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Right: stat cards */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {(() => {
                // Quote mode: show Est. Labor / Est. Parts / Est. Total instead of due/overdue
                if (isQuoteMode) {
                  const selectedTasks = parsed?.tasks.filter(t => t.selected) ?? []
                  let estLabor = 0
                  for (const t of selectedTasks) {
                    const lib = libCache[t.importId]
                    if (lib?.applyFR && lib.frHours != null && lib.frRate != null) {
                      estLabor += lib.frHours * lib.frRate
                    }
                  }
                  const estParts = 0 // parts not estimable pre-creation
                  const estTotal = estLabor + estParts
                  const fmt = (n: number) =>
                    "$" + Math.round(n).toLocaleString("en-US")
                  return [
                    { icon: PackageCheck, value: selectedCount,        label: "Tasks Selected", color: "rgba(212,160,23,0.9)", bg: "rgba(212,160,23,0.1)", border: "rgba(212,160,23,0.25)", large: false },
                    { icon: Clock,        value: fmt(estLabor) as any, label: "Est. Labor",     color: "#93c5fd",              bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.25)", large: false },
                    { icon: FileText,     value: fmt(estTotal) as any, label: "Est. Total",     color: "#c4b5fd",              bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.35)", large: true },
                  ].map(stat => {
                    const Icon = stat.icon
                    return (
                      <div
                        key={stat.label}
                        className="flex flex-col items-center px-4 py-3 rounded-xl min-w-[90px]"
                        style={{ background: stat.bg, border: `1px solid ${stat.border}` }}
                      >
                        <Icon className="w-4 h-4 mb-1.5" style={{ color: stat.color }} />
                        <span className={cn("font-bold leading-none tabular-nums", stat.large ? "text-xl" : "text-lg")} style={{ color: stat.color }}>{stat.value}</span>
                        <span className="text-white/35 text-[10px] mt-1 text-center leading-tight">{stat.label}</span>
                      </div>
                    )
                  })
                }
                // Work order mode: due/overdue as before
                return [
                  {
                    icon: PackageCheck,
                    value: selectedCount,
                    label: "Tasks Selected",
                    color: "rgba(212,160,23,0.9)",
                    bg:    "rgba(212,160,23,0.1)",
                    border:"rgba(212,160,23,0.25)",
                  },
                  {
                    icon: TriangleAlert,
                    value: dueSoonCount,
                    label: "Due < 14 Days",
                    color: "#fbbf24",
                    bg:    "rgba(251,191,36,0.08)",
                    border:"rgba(251,191,36,0.2)",
                    hidden: dueSoonCount === 0 || !!parsed?.isFresh,
                  },
                  {
                    icon: ShieldAlert,
                    value: overdueCount,
                    label: "Overdue",
                    color: "#f87171",
                    bg:    "rgba(239,68,68,0.1)",
                    border:"rgba(239,68,68,0.25)",
                    hidden: overdueCount === 0 || !!parsed?.isFresh,
                  },
                ].filter(s => !s.hidden).map(stat => {
                  const Icon = stat.icon
                  return (
                    <div
                      key={stat.label}
                      className="flex flex-col items-center px-4 py-3 rounded-xl min-w-[80px]"
                      style={{ background: stat.bg, border: `1px solid ${stat.border}` }}
                    >
                      <Icon className="w-4 h-4 mb-1.5" style={{ color: stat.color }} />
                      <span className="text-2xl font-bold leading-none" style={{ color: stat.color }}>{stat.value}</span>
                      <span className="text-white/35 text-[10px] mt-1 text-center leading-tight">{stat.label}</span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* ── Hint bar ─────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 px-8 py-2 flex items-center gap-6 text-xs text-white/25"
            style={{ background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,16%)" }}
          >
            <span className="flex items-center gap-1.5"><GripVertical className="w-3.5 h-3.5" /> Drag to reorder or move between sections</span>
            <span className="flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Click a task name to edit</span>
            <span className="flex items-center gap-1.5"><X className="w-3 h-3" /> Uncheck or delete to exclude</span>
          </div>

          {/* ── Task list ────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-8 py-5 space-y-4">

            {SECTION_ORDER.filter(s => parsed.tasks.some(t => t.section === s)).map(section => {
              const sectionTasks  = parsed.tasks.filter(t => t.section === section)
              const color         = SECTION_COLORS[section]
              const allSelected   = sectionTasks.every(t => t.selected)
              const someSelected  = sectionTasks.some(t => t.selected)
              const isCollapsed   = collapsedSections.has(section)
              const snap          = parsed.times as any
              const sectionSerial: string | null =
                section === "Airframe"  ? null :
                section === "Engine 1"  ? (snap?.eng1Serial ?? null) :
                section === "Engine 2"  ? (snap?.eng2Serial ?? null) :
                section === "Propeller" ? (snap?.propSerial ?? null) :
                section === "APU"       ? (snap?.apuSerial  ?? null) : null

              return (
                <div key={section}>
                  {/* Section header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all cursor-pointer select-none"
                    style={{
                      background: `linear-gradient(to right, ${color}14, hsl(0,0%,11%))`,
                      border: `1px solid hsl(0,0%,20%)`,
                      borderLeft: `4px solid ${color}`,
                    }}
                  >
                    {/* Collapse toggle */}
                    <button onClick={() => collapseSection(section)} className="text-white/30 hover:text-white/70 transition-colors">
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                      }
                    </button>

                    {/* Select-all checkbox */}
                    <button
                      onClick={() => toggleSection(section)}
                      className="w-4.5 h-4.5 w-[18px] h-[18px] rounded border flex items-center justify-center transition-all flex-shrink-0"
                      style={{
                        background: allSelected ? color : someSelected ? `${color}44` : "transparent",
                        border: allSelected ? `1px solid ${color}` : `1px solid rgba(255,255,255,0.2)`,
                      }}
                    >
                      {allSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                      {someSelected && !allSelected && <div className="w-1.5 h-1.5 rounded-sm" style={{ background: color }} />}
                    </button>

                    <span className="text-sm font-bold uppercase tracking-widest" style={{ color }}>
                      {section}
                    </span>

                    {sectionSerial && (
                      <span className="text-white/35 text-[10px] font-mono truncate" title={`S/N ${sectionSerial}`}>
                        S/N {sectionSerial}
                      </span>
                    )}

                    <span className="text-white/30 text-xs font-mono">
                      {sectionTasks.filter(t => t.selected).length}/{sectionTasks.length}
                    </span>

                    {/* Library apply buttons — right side of section header */}
                    {!parsed.isFresh && (() => {
                      const secApplied  = sectionApplied[section]  ?? { ca: false, fr: false }
                      const secRemoving = sectionRemoving[section]  ?? { ca: false, fr: false }
                      const frLoading   = libProgress?.section === section && libProgress.type === "fr"
                      const caLoading   = libProgress?.section === section && libProgress.type === "ca"
                      const frActive    = secApplied.fr || frLoading || secRemoving.fr
                      const caActive    = secApplied.ca || caLoading || secRemoving.ca

                      return (
                        <div className="flex items-center gap-2 ml-auto" onClick={e => e.stopPropagation()}>

                          {/* Progress bar — only shows for THIS section */}
                          {(frLoading || caLoading) && libProgress && (
                            <div className="flex items-center gap-2 mr-1">
                              <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                                <div
                                  className="h-full rounded-full transition-all duration-200"
                                  style={{
                                    width: `${libProgress.total > 0 ? (libProgress.done / libProgress.total) * 100 : 0}%`,
                                    background: caLoading ? "#6ee7b7" : "var(--skyshare-gold)",
                                  }}
                                />
                              </div>
                              <span className="text-[10px] font-mono tabular-nums" style={{ color: caLoading ? "rgba(110,231,183,0.6)" : "rgba(212,160,23,0.6)" }}>
                                {libProgress.done}/{libProgress.total}
                              </span>
                            </div>
                          )}

                          {/* Flat Rates button — Add / depressed / Remove */}
                          <button
                            onClick={() => applyLibraryToSection(section, "fr")}
                            disabled={frLoading || secRemoving.fr}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all disabled:cursor-wait"
                            style={frActive ? {
                              background: "rgba(212,160,23,0.22)",
                              border: "1px solid rgba(212,160,23,0.55)",
                              color: "var(--skyshare-gold)",
                              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
                            } : {
                              background: "rgba(212,160,23,0.08)",
                              border: "1px solid rgba(212,160,23,0.25)",
                              color: "rgba(212,160,23,0.7)",
                            }}
                            title={frActive ? "Remove flat rates from all items in this section" : "Apply flat rate labor to all selected items"}
                          >
                            <Zap className="w-3 h-3" />
                            {(frLoading || secRemoving.fr) ? "Working…" : frActive ? "Remove Flat Rates" : "Add Flat Rates"}
                          </button>

                          {/* Canned Actions button — Add / depressed / Remove */}
                          <button
                            onClick={() => applyLibraryToSection(section, "ca")}
                            disabled={caLoading || secRemoving.ca}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all disabled:cursor-wait"
                            style={caActive ? {
                              background: "rgba(110,231,183,0.18)",
                              border: "1px solid rgba(110,231,183,0.45)",
                              color: "#6ee7b7",
                              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4)",
                            } : {
                              background: "rgba(110,231,183,0.06)",
                              border: "1px solid rgba(110,231,183,0.2)",
                              color: "rgba(110,231,183,0.65)",
                            }}
                            title={caActive ? "Remove canned actions from all items in this section" : "Apply canned corrective actions to all selected items"}
                          >
                            <BookText className="w-3 h-3" />
                            {(caLoading || secRemoving.ca) ? "Working…" : caActive ? "Remove Canned Actions" : "Add Canned Actions"}
                          </button>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Task rows */}
                  {!isCollapsed && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,19%)" }}>
                      {sectionTasks.map((task, idx) => {
                        const isDragging = draggedId === task.importId
                        const isDeleting = deletedIds.has(task.importId)
                        const isEditing  = editingId === task.importId
                        const showGapBefore = draggedId && gapBeforeId === task.importId && gapSection === section

                        return (
                          <div key={task.importId}>
                            {/* Drop gap — opens up above this row */}
                            {showGapBefore && (
                              <div
                                style={{
                                  height: dragMeta.current.h,
                                  background: `${dragMeta.current.color}12`,
                                  border: `2px dashed ${dragMeta.current.color}55`,
                                  borderRadius: 8,
                                  margin: "3px 4px",
                                  transition: "height 0.12s ease",
                                }}
                              />
                            )}
                            <div
                              ref={el => { if (el) rowEls.current.set(task.importId, el); else rowEls.current.delete(task.importId) }}
                              className={cn("flex items-center gap-3 px-3 py-3.5 transition-all group select-none", idx > 0 && "border-t")}
                              style={{
                                borderColor: "hsl(0,0%,18%)",
                                background: "hsl(0,0%,11%)",
                                opacity: isDragging ? 0 : isDeleting ? 0 : task.selected ? 1 : 0.4,
                                transform: isDeleting ? "translateX(12px)" : undefined,
                                transition: "opacity 0.28s ease, transform 0.28s ease",
                                cursor: "grab",
                              }}
                              onPointerDown={e => startDrag(e, task.importId)}
                            >
                              {/* Drag handle — visual affordance */}
                              <div className="text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0">
                                <GripVertical className="w-4 h-4" />
                              </div>

                              {/* Checkbox */}
                              <button
                                onClick={() => toggleTask(task.importId)}
                                onPointerDown={e => e.stopPropagation()}
                                className="w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0"
                                style={{
                                  background: task.selected ? color : "transparent",
                                  border: task.selected ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.2)",
                                }}
                              >
                                {task.selected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                              </button>

                              {/* Section dot */}
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />

                              {/* Description — click to edit */}
                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  <input
                                    ref={editRef}
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    onBlur={() => commitEdit(task.importId)}
                                    onKeyDown={e => { if (e.key === "Enter") commitEdit(task.importId); if (e.key === "Escape") setEditingId(null) }}
                                    className="w-full bg-white/[0.08] border border-white/20 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-white/40"
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <div
                                    className="group/edit flex items-center gap-1.5 cursor-text"
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={() => startEdit(task)}
                                  >
                                    <span className={cn("text-sm leading-snug", task.selected ? "text-white/90" : "text-white/35")}>
                                      {task.description}
                                    </span>
                                    <Pencil className="w-3 h-3 text-white/0 group-hover/edit:text-white/30 transition-colors flex-shrink-0" />
                                  </div>
                                )}
                                {task.taskNumber && (
                                  <p className="text-white/25 text-xs font-mono mt-0.5">{task.taskNumber}</p>
                                )}
                              </div>

                              {/* Per-row library checkboxes — only visible once a lookup has run */}
                              {!parsed.isFresh && task.taskNumber && (() => {
                                const lib = getLib(task.importId)
                                if (lib.frStatus === "idle" && lib.caStatus === "idle") return null
                                return (
                                  <div
                                    className="flex items-center gap-3 flex-shrink-0"
                                    onPointerDown={e => e.stopPropagation()}
                                  >
                                    {/* Flat Rate checkbox */}
                                    {lib.frStatus !== "idle" && (
                                      lib.frStatus === "not_found" ? (
                                        <span className="flex items-center gap-1 text-[10px] text-white/25 select-none">
                                          <span className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)", background: "transparent" }}>
                                            <span className="text-[8px] text-white/20">—</span>
                                          </span>
                                          <Zap className="w-2.5 h-2.5" />
                                          <span className="font-mono">No FR</span>
                                        </span>
                                      ) : (
                                        <label
                                          className="flex items-center gap-1 text-[10px] cursor-pointer select-none group/cb"
                                          title={lib.applyFR ? "Flat rate will be applied — uncheck to skip" : "Check to apply flat rate"}
                                          onPointerDown={e => e.stopPropagation()}
                                          onClick={() => toggleApplyFR(task.importId)}
                                        >
                                          <span
                                            className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all"
                                            style={{
                                              borderColor: lib.applyFR ? "var(--skyshare-gold)" : "rgba(255,255,255,0.2)",
                                              background:  lib.applyFR ? "rgba(212,160,23,0.9)" : "transparent",
                                            }}
                                          >
                                            {lib.applyFR && <Check className="w-2 h-2 text-black" />}
                                          </span>
                                          <Zap className="w-2.5 h-2.5 transition-colors" style={{ color: lib.applyFR ? "var(--skyshare-gold)" : "rgba(255,255,255,0.25)" }} />
                                          <span className="font-mono transition-colors" style={{ color: lib.applyFR ? "rgba(212,160,23,0.9)" : "rgba(255,255,255,0.3)" }}>
                                            {lib.frHours != null ? `${lib.frHours}h` : "FR"}
                                          </span>
                                        </label>
                                      )
                                    )}

                                    {/* Canned Action checkbox */}
                                    {lib.caStatus !== "idle" && (
                                      lib.caStatus === "not_found" ? (
                                        <span className="flex items-center gap-1 text-[10px] text-white/25 select-none">
                                          <span className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.12)", background: "transparent" }}>
                                            <span className="text-[8px] text-white/20">—</span>
                                          </span>
                                          <BookText className="w-2.5 h-2.5" />
                                          <span>No CA</span>
                                        </span>
                                      ) : (
                                        <label
                                          className="flex items-center gap-1 text-[10px] cursor-pointer select-none"
                                          title={lib.applyCA ? "Canned action will be applied — uncheck to skip" : "Check to apply canned action"}
                                          onPointerDown={e => e.stopPropagation()}
                                          onClick={() => toggleApplyCA(task.importId)}
                                        >
                                          <span
                                            className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all"
                                            style={{
                                              borderColor: lib.applyCA ? "#6ee7b7" : "rgba(255,255,255,0.2)",
                                              background:  lib.applyCA ? "rgba(110,231,183,0.85)" : "transparent",
                                            }}
                                          >
                                            {lib.applyCA && <Check className="w-2 h-2 text-black" />}
                                          </span>
                                          <BookText className="w-2.5 h-2.5 transition-colors" style={{ color: lib.applyCA ? "#6ee7b7" : "rgba(255,255,255,0.25)" }} />
                                          <span className="transition-colors" style={{ color: lib.applyCA ? "rgba(110,231,183,0.9)" : "rgba(255,255,255,0.3)" }}>CA</span>
                                        </label>
                                      )
                                    )}
                                  </div>
                                )
                              })()}

                              {/* Delete */}
                              <button
                                onClick={() => deleteTask(task.importId)}
                                onPointerDown={e => e.stopPropagation()}
                                title="Remove this task"
                                className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all text-white/20 hover:text-red-400 hover:bg-red-900/20 flex-shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}

                      {/* Gap at end of this section */}
                      {draggedId && gapBeforeId === "__end__" && gapSection === section && (
                        <div
                          style={{
                            height: dragMeta.current.h,
                            background: `${dragMeta.current.color}12`,
                            border: `2px dashed ${dragMeta.current.color}55`,
                            borderRadius: 8,
                            margin: "3px 4px",
                          }}
                        />
                      )}

                      {/* ── Add item row / inline form ── */}
                      {addingToSection === section ? (
                        <div
                          className="px-3 py-3 flex flex-col gap-2"
                          style={{ borderTop: "1px solid hsl(0,0%,18%)", background: "hsl(0,0%,10%)" }}
                          onPointerDown={e => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={newTaskDesc}
                            onChange={e => setNewTaskDesc(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") addTask(section); if (e.key === "Escape") setAddingToSection(null) }}
                            placeholder="Task description…"
                            className="w-full px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                            style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,24%)" }}
                          />
                          <div className="flex items-center gap-2">
                            <input
                              value={newTaskNum}
                              onChange={e => setNewTaskNum(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") addTask(section); if (e.key === "Escape") setAddingToSection(null) }}
                              placeholder="Task # (optional)"
                              className="w-36 px-3 py-1.5 text-xs rounded-lg text-white/70 placeholder:text-white/20 focus:outline-none"
                              style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,22%)" }}
                            />
                            <button
                              onClick={() => addTask(section)}
                              disabled={!newTaskDesc.trim()}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={{
                                background: newTaskDesc.trim() ? color : "rgba(255,255,255,0.06)",
                                color: newTaskDesc.trim() ? "#000" : "rgba(255,255,255,0.25)",
                              }}
                            >
                              Add
                            </button>
                            <button
                              onClick={() => { setAddingToSection(null); setNewTaskDesc(""); setNewTaskNum("") }}
                              className="px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingToSection(section); setNewTaskDesc(""); setNewTaskNum("") }}
                          className="w-full flex items-center gap-1.5 px-4 py-2 text-xs transition-colors"
                          style={{ borderTop: sectionTasks.length > 0 ? "1px solid hsl(0,0%,16%)" : undefined, color: `${color}80` }}
                          onMouseEnter={e => (e.currentTarget.style.color = color)}
                          onMouseLeave={e => (e.currentTarget.style.color = `${color}80`)}
                        >
                          <Plus className="w-3 h-3" /> Add item to {section}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add to a section not yet in the import */}
            {SECTION_ORDER.filter(s => !parsed.tasks.some(t => t.section === s)).length > 0 && (
              <div className="mt-2 pt-3" style={{ borderTop: "1px solid hsl(0,0%,16%)" }}>
                <p className="text-white/20 text-xs mb-2 px-1">
                  {parsed?.isFresh && parsed.tasks.length === 0 ? "Select a section to start adding work items:" : "Add items to additional sections:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SECTION_ORDER.filter(s => !parsed.tasks.some(t => t.section === s)).map(s => (
                    <button
                      key={s}
                      onClick={() => { setAddingToSection(s); setParsed(p => p ? { ...p, tasks: [...p.tasks] } : p) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: `${SECTION_COLORS[s]}15`,
                        border: `1px solid ${SECTION_COLORS[s]}35`,
                        color: `${SECTION_COLORS[s]}cc`,
                      }}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
                {addingToSection && !parsed.tasks.some(t => t.section === addingToSection) && (
                  <div
                    className="mt-3 p-3 rounded-xl flex flex-col gap-2"
                    style={{ background: "hsl(0,0%,11%)", border: `1px solid ${SECTION_COLORS[addingToSection]}30` }}
                  >
                    <p className="text-xs font-semibold" style={{ color: SECTION_COLORS[addingToSection] }}>{addingToSection}</p>
                    <input
                      autoFocus
                      value={newTaskDesc}
                      onChange={e => setNewTaskDesc(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addTask(addingToSection); if (e.key === "Escape") setAddingToSection(null) }}
                      placeholder="Task description…"
                      className="w-full px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/25 focus:outline-none"
                      style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,24%)" }}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        value={newTaskNum}
                        onChange={e => setNewTaskNum(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") addTask(addingToSection); if (e.key === "Escape") setAddingToSection(null) }}
                        placeholder="Task # (optional)"
                        className="w-36 px-3 py-1.5 text-xs rounded-lg text-white/70 placeholder:text-white/20 focus:outline-none"
                        style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,22%)" }}
                      />
                      <button
                        onClick={() => addTask(addingToSection)}
                        disabled={!newTaskDesc.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: newTaskDesc.trim() ? SECTION_COLORS[addingToSection] : "rgba(255,255,255,0.06)",
                          color: newTaskDesc.trim() ? "#000" : "rgba(255,255,255,0.25)",
                        }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingToSection(null); setNewTaskDesc(""); setNewTaskNum("") }}
                        className="px-3 py-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="h-6" />
          </div>

          {/* ── Commit bar ───────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 px-8 py-4 flex items-center justify-between gap-6"
            style={{
              background: "linear-gradient(to top, hsl(0,0%,7%), hsl(0,0%,10%))",
              borderTop: "1px solid hsl(0,0%,22%)",
            }}
          >
            <div>
              {commitError ? (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 text-sm font-medium">Save failed</p>
                    <p className="text-red-400/70 text-xs mt-0.5 font-mono">{commitError}</p>
                  </div>
                </div>
              ) : selectedCount === 0 ? (
                <p className="text-white/30 text-sm">No tasks selected — check at least one task to continue</p>
              ) : (
                <div>
                  <p className="text-white/70 text-sm font-medium">
                    {selectedCount} task{selectedCount !== 1 ? "s" : ""} ready to commit
                  </p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {[...new Set(parsed.tasks.filter(t => t.selected).map(t => t.section))].join("  ·  ")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost" size="sm"
                onClick={() => { discardDraft(); setParsed(null); setMode(parsed?.isFresh ? "fresh" : "import-upload") }}
                className="text-white/35 hover:text-white/65 border border-white/10 hover:border-white/20"
              >
                {parsed?.isFresh ? "← Back" : "← Upload Different File"}
              </Button>
              <Button
                size="sm"
                disabled={selectedCount === 0 || submitting}
                onClick={createFromImport}
                className="h-11 px-8 text-sm font-bold tracking-wide"
                style={{
                  background: selectedCount > 0 && !submitting ? "var(--skyshare-gold)" : "rgba(212,160,23,0.2)",
                  color: selectedCount > 0 && !submitting ? "#000" : "rgba(212,160,23,0.4)",
                  boxShadow: selectedCount > 0 && !submitting ? "0 0 24px rgba(212,160,23,0.3)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {submitting ? "Saving…" : isRebuild ? "Rebuild Work Order →" : isQuoteMode ? "Create Quote →" : "Commit to Work Order →"}
              </Button>
            </div>
          </div>

          {/* ── Aircraft Times full modal ───────────────────────────────── */}
          <TimesEditModal
            open={timesEditOpen}
            onClose={() => setTimesEditOpen(false)}
            aircraftLabel={parsed ? `${parsed.aircraftReg}${parsed.aircraftModel ? ` — ${parsed.aircraftModel}` : ""}` : "verify all values before committing"}
            initialTimes={parsed?.times ?? null}
            hobbsDiff={hobbsDiff}
            onConfirm={newTimes => {
              const newHrs = newTimes.airframeHrs != null ? String(newTimes.airframeHrs) : (parsed?.currentHrsAirframe ?? "")
              setParsed(p => p ? { ...p, times: newTimes, currentHrsAirframe: newHrs } : p)
              setTimesEditOpen(false)
            }}
          />

          {/* ── Drag ghost — follows cursor ───────────────────────────────── */}
          {draggedId && ghostPos && (() => {
            const t = parsed.tasks.find(x => x.importId === draggedId)
            if (!t) return null
            const c = SECTION_COLORS[t.section]
            return (
              <div
                className="pointer-events-none fixed z-[9999] select-none"
                style={{
                  left: ghostPos.x - dragMeta.current.ox,
                  top:  ghostPos.y - dragMeta.current.oy,
                  width: dragMeta.current.w,
                  borderRadius: 10,
                  background: "hsl(0,0%,17%)",
                  border: `1px solid ${c}55`,
                  boxShadow: `0 28px 72px rgba(0,0,0,0.6), 0 6px 18px rgba(0,0,0,0.4), 0 0 0 1px ${c}22`,
                  transform: "rotate(1.2deg) scale(1.025)",
                  opacity: 0.97,
                }}
              >
                <div className="flex items-center gap-3 px-3 py-3.5">
                  <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: `${c}99` }} />
                  <div
                    className="w-5 h-5 rounded border flex items-center justify-center flex-shrink-0"
                    style={{
                      background: t.selected ? c : "transparent",
                      border: t.selected ? `1px solid ${c}` : "1px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    {t.selected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white/90 leading-snug truncate block">{t.description}</span>
                    {t.taskNumber && <p className="text-white/25 text-xs font-mono mt-0.5">{t.taskNumber}</p>}
                  </div>
                  {(() => {
                    const lib = libCache[t.importId]
                    if (!lib || (lib.caStatus === "idle" && lib.frStatus === "idle")) return null
                    return (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {lib.frStatus !== "idle" && <LibChip status={lib.applyFR ? lib.frStatus : "idle"} label="FR" />}
                        {lib.caStatus !== "idle" && <LibChip status={lib.applyCA ? lib.caStatus : "idle"} label="CA" />}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
