import { useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import * as XLSX from "xlsx"
import {
  ArrowLeft, Upload, FileSpreadsheet, X, AlertTriangle,
  CheckCircle2, ClipboardList, Clock, Calendar, GripVertical,
  Trash2, Pencil, TriangleAlert, ShieldAlert, PackageCheck,
  ChevronDown, ChevronRight,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import { Label } from "@/shared/ui/label"
import { cn } from "@/shared/lib/utils"
import { AIRCRAFT, MECHANICS, type WOItem, type LogbookSection } from "../../data/mockData"

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
  tasks:                ParsedTask[]
}

function col(headers: (string | null)[], name: string): number {
  return headers.findIndex(h => h && h.trim() === name)
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

  let aircraftReg   = ""
  let aircraftModel = ""
  let currentHrsAirframe = ""

  if (lastSheet) {
    const la = XLSX.utils.sheet_to_json<string[]>(lastSheet, { header: 1, defval: null })
    for (const laRow of la) {
      if (laRow[0] === "Hrs") currentHrsAirframe = String(laRow[1] ?? "")
    }
  }

  const tasks: ParsedTask[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as (string | number | null)[]
    if (!row || row.every(c => c === null)) continue

    const taskType = String(row[iType] ?? "").trim()
    if (taskType === "Part") continue

    if (!aircraftReg)   aircraftReg   = String(row[iAcReg]   ?? "").trim()
    if (!aircraftModel) aircraftModel = String(row[iAcModel]  ?? "").trim()

    const ma      = String(row[iMA]     ?? "").trim()
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
      importId: `import-${i}`, section, taskNumber,
      description: desc, nextDueDate: ndd, nextDueHours: ndh,
      remainingDisplay: remain, urgencyDays, selected: true,
    })
  }

  tasks.sort((a, b) => {
    const sd = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
    if (sd !== 0) return sd
    return a.urgencyDays - b.urgencyDays
  })

  return { aircraftReg, aircraftModel, currentHrsAirframe, tasks }
}

// ─── WO Types ─────────────────────────────────────────────────────────────────
const WO_TYPES = [
  "100-Hour Inspection", "Annual Inspection",
  "Unscheduled — Avionics", "Unscheduled — Hydraulic",
  "Unscheduled — Engine", "Unscheduled — Airframe",
  "Squawk — Pilot Report", "Engine Trend Monitoring",
  "Propeller Overhaul", "Brake Assembly R/R", "Landing Gear",
  "Compliance — AD", "Compliance — SB", "Phase Inspection",
  "Scheduled Maintenance — Traxxall Import", "Return to Service",
]

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

// ─── Sub-component: Urgency badge ─────────────────────────────────────────────
function UrgencyChip({ days, display }: { days: number; display: string }) {
  if (!display) return null
  const overdue   = days < 0
  const dueSoon   = days >= 0 && days < 14
  const moderate  = days >= 14 && days < 30
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: overdue  ? "rgba(239,68,68,0.15)"  :
                    dueSoon  ? "rgba(251,191,36,0.15)"  :
                    moderate ? "rgba(251,146,60,0.12)"  :
                               "rgba(255,255,255,0.07)",
        color: overdue  ? "#f87171"  :
               dueSoon  ? "#fbbf24"  :
               moderate ? "#fb923c"  :
                          "rgba(255,255,255,0.4)",
        border: `1px solid ${
          overdue  ? "rgba(239,68,68,0.3)"  :
          dueSoon  ? "rgba(251,191,36,0.3)" :
          moderate ? "rgba(251,146,60,0.2)" :
                     "rgba(255,255,255,0.1)"
        }`,
      }}
    >
      {display}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
type Mode = "choose" | "fresh" | "import-upload" | "import-review"

export default function WorkOrderCreate() {
  const navigate = useNavigate()
  const [mode, setMode]   = useState<Mode>("choose")

  // Fresh form
  const [form, setForm]     = useState({
    aircraftId: "", woType: "", priority: "routine" as "routine" | "urgent" | "aog",
    description: "", meterAtOpen: "", mechanic: "",
  })
  const [submitting, setSubmitting] = useState(false)

  // Upload state
  const [dropZoneActive, setDropZoneActive] = useState(false)
  const [parseError, setParseError]         = useState<string | null>(null)
  const [parsed, setParsed]                 = useState<ParsedImport | null>(null)

  // Review state
  const [draggedId, setDraggedId]           = useState<string | null>(null)
  const [dragOverId, setDragOverId]         = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<LogbookSection | null>(null)
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [editText, setEditText]             = useState("")
  const [collapsedSections, setCollapsedSections] = useState<Set<LogbookSection>>(new Set())
  const [deletedIds, setDeletedIds]         = useState<Set<string>>(new Set())  // for fade-out
  const editRef = useRef<HTMLInputElement>(null)

  // ── Fresh form ─────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => navigate("/app/beet-box/work-orders/wo-007"), 800)
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

  // ── Review: drag-and-drop ─────────────────────────────────────────────────
  function onTaskDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = "move"
    // Invisible drag ghost
    const ghost = document.createElement("div")
    ghost.style.position = "absolute"; ghost.style.top = "-9999px"
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  function onTaskDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (id !== draggedId) setDragOverId(id)
    setDragOverSection(null)
  }

  function onTaskDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (draggedId && draggedId !== targetId) {
      setParsed(p => p ? { ...p, tasks: reorderTasks(p.tasks, draggedId, targetId) } : p)
    }
    setDraggedId(null); setDragOverId(null)
  }

  function onSectionDragOver(e: React.DragEvent, section: LogbookSection) {
    e.preventDefault()
    if (draggedId) {
      const draggedTask = parsed?.tasks.find(t => t.importId === draggedId)
      if (draggedTask && draggedTask.section !== section) setDragOverSection(section)
    }
  }

  function onSectionDrop(e: React.DragEvent, section: LogbookSection) {
    e.preventDefault()
    if (draggedId) {
      setParsed(p => p ? { ...p, tasks: moveSectionTasks(p.tasks, draggedId, section) } : p)
    }
    setDraggedId(null); setDragOverId(null); setDragOverSection(null)
  }

  // ── Build WO ──────────────────────────────────────────────────────────────
  function createFromImport() {
    if (!parsed) return
    const selected = parsed.tasks.filter(t => t.selected)
    if (selected.length === 0) return

    const aircraft = AIRCRAFT.find(a =>
      a.registration.replace(/\s/g, "").toUpperCase() ===
      parsed.aircraftReg.replace(/\s/g, "").toUpperCase()
    )

    const woItems: WOItem[] = selected.map((t, idx) => ({
      id: `import-item-${idx + 1}`,
      itemNumber: idx + 1,
      category: t.description,
      logbookSection: t.section,
      taskNumber: t.taskNumber || undefined,
      discrepancy: `Perform ${t.description}.`,
      correctiveAction: "",
      hours: 0, laborRate: 125,
      parts: [], shippingCost: 0, outsideServicesCost: 0,
      signOffRequired: true, itemStatus: "pending", itemLaborEntries: [],
    }))

    const sections = [...new Set(selected.map(t => t.section))]
    navigate("/app/beet-box/work-orders/wo-traxxall-import", {
      state: {
        traxxallImport: true,
        aircraftId:     aircraft?.id ?? AIRCRAFT[0].id,
        aircraftReg:    parsed.aircraftReg,
        aircraftModel:  parsed.aircraftModel,
        woType:         "Scheduled Maintenance — Traxxall Import",
        description:    `Traxxall import — ${parsed.aircraftReg}. ${selected.length} tasks across ${sections.join(", ")}.`,
        items:          woItems,
        meterAtOpen:    parsed.currentHrsAirframe ? parseFloat(parsed.currentHrsAirframe) : undefined,
      },
    })
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const selectedCount = parsed?.tasks.filter(t => t.selected).length ?? 0
  const overdueCount  = parsed?.tasks.filter(t => t.selected && t.urgencyDays < 0).length ?? 0
  const dueSoonCount  = parsed?.tasks.filter(t => t.selected && t.urgencyDays >= 0 && t.urgencyDays < 14).length ?? 0
  const isValid       = form.aircraftId && form.woType && form.description

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      {mode !== "import-review" && (
        <>
          <div className="hero-area px-8 py-7">
            <button
              onClick={() => mode === "choose" ? navigate("/app/beet-box/work-orders") : setMode("choose")}
              className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {mode === "choose" ? "Work Orders" : "Back"}
            </button>
            <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              New Work Order
            </h1>
            <p className="text-white/40 text-sm mt-1">Open a new maintenance work order</p>
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

      {/* ── FRESH FORM ──────────────────────────────────────────────────────── */}
      {mode === "fresh" && (
        <div className="px-8 py-6 max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Aircraft *</Label>
              <select value={form.aircraftId} onChange={e => setForm(f => ({ ...f, aircraftId: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30" required>
                <option value="">Select aircraft…</option>
                {AIRCRAFT.map(ac => <option key={ac.id} value={ac.id}>{ac.registration} — {ac.make} {ac.model}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Work Order Type *</Label>
              <select value={form.woType} onChange={e => setForm(f => ({ ...f, woType: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30" required>
                <option value="">Select type…</option>
                {WO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Priority</Label>
              <div className="flex gap-3">
                {(["routine", "urgent", "aog"] as const).map(p => (
                  <button key={p} type="button" onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-widest transition-all"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background: form.priority === p ? p === "routine" ? "rgba(100,116,139,0.3)" : p === "urgent" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.04)",
                      border: form.priority === p ? p === "routine" ? "1px solid rgba(100,116,139,0.5)" : p === "urgent" ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      color: form.priority === p ? p === "routine" ? "#94a3b8" : p === "urgent" ? "#fbbf24" : "#f87171" : "rgba(255,255,255,0.35)",
                    }}>{p.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Description *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the work to be performed…" rows={4}
                className="bg-white/[0.06] border-white/10 text-white/90 placeholder:text-white/25 focus:border-white/30 resize-none" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Meter at Open</Label>
              <Input type="number" step="0.1" value={form.meterAtOpen} onChange={e => setForm(f => ({ ...f, meterAtOpen: e.target.value }))}
                placeholder="e.g. 4218.3" className="bg-white/[0.06] border-white/10 text-white/90 placeholder:text-white/25 focus:border-white/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Assign Mechanic</Label>
              <select value={form.mechanic} onChange={e => setForm(f => ({ ...f, mechanic: e.target.value }))}
                className="w-full px-3 py-2 rounded text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30">
                <option value="">Unassigned</option>
                {MECHANICS.map(m => <option key={m.id} value={m.id}>{m.name} — {m.certificate} · {m.role}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={!isValid || submitting} style={{ background: "var(--skyshare-gold)", color: "#000" }} className="font-semibold px-6">
                {submitting ? "Opening WO…" : "Open Work Order"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode("choose")} className="text-white/50 hover:text-white/80">Cancel</Button>
            </div>
          </form>
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
          onDragEnd={() => { setDraggedId(null); setDragOverId(null); setDragOverSection(null) }}
        >

          {/* ── Masthead ──────────────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 px-8 py-5 flex items-start justify-between"
            style={{
              background: "linear-gradient(to right, hsl(0,0%,11%), hsl(0,0%,9%))",
              borderBottom: "1px solid hsl(0,0%,18%)",
              borderTop: "3px solid var(--skyshare-gold)",
            }}
          >
            <div>
              <button
                onClick={() => { setParsed(null); setMode("import-upload") }}
                className="flex items-center gap-1.5 text-white/35 hover:text-white/65 text-xs mb-3 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Upload different file
              </button>
              <div className="flex items-center gap-3 mb-1">
                <h1
                  className="font-bold"
                  style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "0.08em", color: "var(--skyshare-gold)" }}
                >
                  {parsed.aircraftReg}
                </h1>
                <span className="text-white/50 text-base">{parsed.aircraftModel}</span>
                {parsed.currentHrsAirframe && (
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-mono"
                    style={{ background: "rgba(212,160,23,0.12)", color: "rgba(212,160,23,0.8)", border: "1px solid rgba(212,160,23,0.25)" }}
                  >
                    {parsed.currentHrsAirframe} hrs A/F
                  </span>
                )}
              </div>
              <p className="text-white/35 text-sm">
                Traxxall basket import · Review and organize before committing to a work order
              </p>
            </div>

            {/* Stat cards */}
            <div className="flex items-center gap-3 flex-shrink-0 ml-8">
              {[
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
                  hidden: dueSoonCount === 0,
                },
                {
                  icon: ShieldAlert,
                  value: overdueCount,
                  label: "Overdue",
                  color: "#f87171",
                  bg:    "rgba(239,68,68,0.1)",
                  border:"rgba(239,68,68,0.25)",
                  hidden: overdueCount === 0,
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
              })}
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
              const sectionTasks  = parsed.tasks.filter(t => t.section === s)
              const color         = SECTION_COLORS[section]
              const allSelected   = sectionTasks.every(t => t.selected)
              const someSelected  = sectionTasks.some(t => t.selected)
              const isCollapsed   = collapsedSections.has(section)
              const isDragTarget  = dragOverSection === section

              return (
                <div key={section}>
                  {/* Section header — drop target for cross-section moves */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all cursor-pointer select-none"
                    style={{
                      background: isDragTarget
                        ? `${color}22`
                        : `linear-gradient(to right, ${color}14, hsl(0,0%,11%))`,
                      border: isDragTarget
                        ? `2px dashed ${color}`
                        : `1px solid hsl(0,0%,20%)`,
                      borderLeft: isDragTarget ? `2px dashed ${color}` : `4px solid ${color}`,
                    }}
                    onDragOver={e => onSectionDragOver(e, section)}
                    onDragLeave={() => setDragOverSection(null)}
                    onDrop={e => onSectionDrop(e, section)}
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

                    <span className="text-sm font-bold uppercase tracking-widest flex-1" style={{ color }}>
                      {section}
                    </span>

                    <span className="text-white/30 text-xs font-mono">
                      {sectionTasks.filter(t => t.selected).length}/{sectionTasks.length}
                    </span>

                    {isDragTarget && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: `${color}33`, color }}>
                        Drop to move here
                      </span>
                    )}
                  </div>

                  {/* Task rows */}
                  {!isCollapsed && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,19%)" }}>
                      {sectionTasks.map((task, idx) => {
                        const isBeingDragged = draggedId === task.importId
                        const isDropTarget   = dragOverId === task.importId && draggedId !== task.importId
                        const isDeleting     = deletedIds.has(task.importId)
                        const isEditing      = editingId === task.importId

                        return (
                          <div
                            key={task.importId}
                            draggable
                            onDragStart={e => onTaskDragStart(e, task.importId)}
                            onDragOver={e => onTaskDragOver(e, task.importId)}
                            onDrop={e => onTaskDrop(e, task.importId)}
                            className={cn("flex items-center gap-3 px-3 py-3.5 transition-all group", idx > 0 && "border-t")}
                            style={{
                              borderColor: "hsl(0,0%,18%)",
                              background: isBeingDragged ? "hsl(0,0%,8%)" : isDropTarget ? `${color}0d` : "hsl(0,0%,11%)",
                              opacity: isBeingDragged ? 0.4 : isDeleting ? 0 : task.selected ? 1 : 0.4,
                              borderTop: isDropTarget ? `2px solid ${color}` : idx > 0 ? "1px solid hsl(0,0%,18%)" : undefined,
                              transform: isDeleting ? "translateX(12px)" : undefined,
                              transition: "opacity 0.28s ease, transform 0.28s ease, background 0.12s ease, border-color 0.12s ease",
                              cursor: isEditing ? "text" : "grab",
                            }}
                          >
                            {/* Drag handle */}
                            <div className="text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4" />
                            </div>

                            {/* Checkbox */}
                            <button
                              onClick={() => toggleTask(task.importId)}
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

                            {/* Due info */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {task.nextDueDate && (
                                <div className="flex items-center gap-1 text-xs text-white/35">
                                  <Calendar className="w-3 h-3 flex-shrink-0" />
                                  <span className="font-mono">{task.nextDueDate}</span>
                                </div>
                              )}
                              {task.nextDueHours && !task.nextDueDate && (
                                <div className="flex items-center gap-1 text-xs text-white/35">
                                  <Clock className="w-3 h-3 flex-shrink-0" />
                                  <span className="font-mono">{task.nextDueHours}</span>
                                </div>
                              )}
                              {task.remainingDisplay && (
                                <UrgencyChip days={task.urgencyDays} display={task.remainingDisplay} />
                              )}
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => deleteTask(task.importId)}
                              title="Remove this task"
                              className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all text-white/20 hover:text-red-400 hover:bg-red-900/20 flex-shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

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
              {selectedCount === 0 ? (
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
                onClick={() => { setParsed(null); setMode("import-upload") }}
                className="text-white/35 hover:text-white/65 border border-white/10 hover:border-white/20"
              >
                ← Upload Different File
              </Button>
              <Button
                size="sm"
                disabled={selectedCount === 0}
                onClick={createFromImport}
                className="h-11 px-8 text-sm font-bold tracking-wide"
                style={{
                  background: selectedCount > 0 ? "var(--skyshare-gold)" : "rgba(212,160,23,0.2)",
                  color: selectedCount > 0 ? "#000" : "rgba(212,160,23,0.4)",
                  boxShadow: selectedCount > 0 ? "0 0 24px rgba(212,160,23,0.3)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                Commit to Work Order →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
