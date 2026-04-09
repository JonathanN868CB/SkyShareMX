import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Loader2, Check, Plus, X, Pencil, FileDown, AlertTriangle, BookOpen } from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { Button } from "@/shared/ui/button"
import { localToday } from "@/shared/lib/dates"
import {
  getLogbookEntryById, getOrCreateDraftLogbookEntry, createLogbookEntry,
  updateLogbookEntry, signLogbookEntry, upsertEntryLine, deleteEntryLine,
  updateSignatory, getWorkOrderById, getFleetAircraft,
} from "../../services"
import type { LogbookEntry, LogbookSection, CertType, FleetAircraft } from "../../types"

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RTS =
  "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 135.411(a)(1), Part 91.409(f)(3), and Part 43, and is approved for return to service in respect to that work performed."

const SECTIONS: LogbookSection[] = ["Airframe", "Engine 1", "Engine 2", "Propeller", "APU", "Other"]
const CERT_TYPES: CertType[]     = ["A&P", "IA", "A&P/IA", "Avionics", "Other"]

// ─── Types ────────────────────────────────────────────────────────────────────

type LineState = { id: string | null; lineNumber: number; text: string }

interface EditFields {
  entryDate:           string
  totalAircraftTime:   number | null
  totalAircraftTimeNew: number | null
  landings:            number | null
  landingsNew:         number | null
  hobbs:               number | null
  hobbsNew:            number | null
  sectionTitle:        string
  logbookSection:      LogbookSection
  returnToService:     string
  mechanicName:        string
  certificateType:     CertType
  certificateNumber:   string
}

function fieldsFromEntry(e: LogbookEntry): EditFields {
  return {
    entryDate:            e.entryDate,
    totalAircraftTime:    e.totalAircraftTime,
    totalAircraftTimeNew: e.totalAircraftTimeNew,
    landings:             e.landings,
    landingsNew:          e.landingsNew,
    hobbs:                e.hobbs,
    hobbsNew:             e.hobbsNew,
    sectionTitle:         e.sectionTitle,
    logbookSection:       e.logbookSection,
    returnToService:      e.returnToService || DEFAULT_RTS,
    mechanicName:         e.mechanicName,
    certificateType:      e.certificateType,
    certificateNumber:    e.certificateNumber,
  }
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

async function buildPdfBlob(el: HTMLElement): Promise<Blob> {
  const canvas  = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" })
  const imgData = canvas.toDataURL("image/png")
  const pdf     = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" })
  const pdfW    = pdf.internal.pageSize.getWidth()
  const pdfH    = pdf.internal.pageSize.getHeight()
  const imgH    = canvas.height * (pdfW / canvas.width)
  let pos = 0, remaining = imgH
  pdf.addImage(imgData, "PNG", 0, 0, pdfW, imgH)
  remaining -= pdfH
  while (remaining > 0) {
    pos += pdfH; pdf.addPage()
    pdf.addImage(imgData, "PNG", 0, -pos, pdfW, imgH)
    remaining -= pdfH
  }
  return pdf.output("blob")
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function LogbookDetail() {
  const { id }           = useParams<{ id: string }>()
  const navigate          = useNavigate()
  const [sp]             = useSearchParams()
  const woParam          = sp.get("wo")
  const fromWO           = sp.get("from")

  if (id === "new") {
    return (
      <NewEntryCreator
        woId={woParam}
        fromWO={fromWO}
        onCreated={newId =>
          navigate(
            `/app/beet-box/logbook/${newId}${fromWO ? `?from=${encodeURIComponent(fromWO)}` : ""}`,
            { replace: true }
          )
        }
        onBack={() => navigate(fromWO ?? "/app/beet-box/logbook")}
      />
    )
  }

  return <EntryDocument entryId={id!} fromWO={fromWO} />
}

// ─── New entry creator ────────────────────────────────────────────────────────

function NewEntryCreator({
  woId, fromWO, onCreated, onBack,
}: {
  woId: string | null
  fromWO: string | null
  onCreated: (id: string) => void
  onBack: () => void
}) {
  const today = localToday()
  const [fleet,         setFleet]         = useState<FleetAircraft[]>([])
  const [selectedAcId,  setSelectedAcId]  = useState("")
  const [isGuest,       setIsGuest]       = useState(false)
  const [guestReg,      setGuestReg]      = useState("")
  const [guestSerial,   setGuestSerial]   = useState("")
  const [section,       setSection]       = useState<LogbookSection>("Airframe")
  const [entryDate,     setEntryDate]     = useState(today)
  const [creating,      setCreating]      = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  // Auto-create when coming from a WO
  useEffect(() => {
    if (!woId) {
      getFleetAircraft().then(setFleet).catch(() => {})
      return
    }
    setCreating(true)
    getWorkOrderById(woId)
      .then(wo => {
        if (!wo) throw new Error("Work order not found.")
        return getOrCreateDraftLogbookEntry(
          {
            id: wo.id,
            woNumber: wo.woNumber,
            aircraftId: wo.aircraftId,
            guestRegistration: wo.guestRegistration,
            guestSerial: wo.guestSerial,
          },
          "Airframe"
        )
      })
      .then(e => onCreated(e.id))
      .catch(err => { setError(err.message ?? "Failed to create entry."); setCreating(false) })
  }, [woId])

  async function handleCreate() {
    if (!isGuest && !selectedAcId) return
    if (isGuest && !guestReg.trim()) return
    setCreating(true)
    try {
      const entry = await createLogbookEntry({
        aircraftId:        isGuest ? undefined : selectedAcId,
        guestRegistration: isGuest ? guestReg.trim() : undefined,
        guestSerial:       isGuest ? guestSerial.trim() || undefined : undefined,
        entryDate,
        logbookSection:    section,
        sectionTitle:      `${section} Entries`,
        mechanicName:      "",
        certificateType:   "A&P",
        certificateNumber: "",
      })
      onCreated(entry.id)
    } catch (err: any) {
      setError(err.message ?? "Failed to create entry.")
      setCreating(false)
    }
  }

  // Loading state (WO auto-create or standalone creating)
  if (creating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-white/40">
        {error ? (
          <>
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={onBack} className="text-xs text-white/40 hover:text-white/60 mt-2">← Back</button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">{woId ? "Creating logbook entry from work order…" : "Creating entry…"}</p>
          </>
        )}
      </div>
    )
  }

  // Standalone creation form
  const selectedAc = fleet.find(a => a.id === selectedAcId)

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 pt-6 pb-5">
        <button onClick={onBack} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Logbook
        </button>
        <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
          New Logbook Entry
        </h1>
      </div>
      <div className="stripe-divider" />

      <div className="px-8 py-8 max-w-xl">
        {error && (
          <div className="mb-6 px-4 py-3 rounded text-sm text-red-400" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {error}
          </div>
        )}

        <div className="space-y-5">
          {/* Aircraft */}
          <div>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)" }}>Aircraft</p>
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="radio" checked={!isGuest} onChange={() => setIsGuest(false)} className="accent-yellow-400" />
                Fleet Aircraft
              </label>
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="radio" checked={isGuest} onChange={() => setIsGuest(true)} className="accent-yellow-400" />
                Guest / Non-Fleet
              </label>
            </div>
            {!isGuest ? (
              <select
                value={selectedAcId}
                onChange={e => setSelectedAcId(e.target.value)}
                className="w-full border border-white/15 rounded px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-white/30"
                style={{ background: "hsl(0,0%,14%)", colorScheme: "dark" }}
              >
                <option value="">— Select aircraft —</option>
                {fleet.map(ac => (
                  <option key={ac.id} value={ac.id}>
                    {ac.registration ?? "Unknown Reg"} — {ac.make} {ac.modelFull}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Registration</label>
                  <input
                    className="w-full bg-white/[0.06] border border-white/15 rounded px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-white/30"
                    placeholder="N12345"
                    value={guestReg}
                    onChange={e => setGuestReg(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Serial Number</label>
                  <input
                    className="w-full bg-white/[0.06] border border-white/15 rounded px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-white/30"
                    placeholder="Optional"
                    value={guestSerial}
                    onChange={e => setGuestSerial(e.target.value)}
                  />
                </div>
              </div>
            )}
            {selectedAc && (
              <p className="text-white/35 text-xs mt-2">S/N: {selectedAc.serialNumber ?? "—"} · {selectedAc.make} {selectedAc.modelFull}</p>
            )}
          </div>

          {/* Section */}
          <div>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)" }}>Logbook Section</p>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style={s === section
                    ? { background: "var(--skyshare-gold)", color: "#000", fontFamily: "var(--font-heading)" }
                    : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)", fontFamily: "var(--font-heading)" }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)" }}>Entry Date</p>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className="bg-white/[0.06] border border-white/15 rounded px-3 py-2 text-white/80 text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={creating || (!isGuest && !selectedAcId) || (isGuest && !guestReg.trim())}
            style={{ background: "var(--skyshare-gold)", color: "#000" }}
            className="font-semibold text-sm"
          >
            Create Entry
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Entry document (main editor / viewer) ────────────────────────────────────

function EntryDocument({ entryId, fromWO }: { entryId: string; fromWO: string | null }) {
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)

  const [entry,        setEntry]        = useState<LogbookEntry | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [pdfPreview,   setPdfPreview]   = useState<{ url: string; filename: string } | null>(null)
  const [signing,      setSigning]      = useState(false)
  const [signConfirm,  setSignConfirm]  = useState(false)

  // Editable header fields (auto-saved on blur)
  const [fields, setFields] = useState<EditFields>({
    entryDate: localToday(),
    totalAircraftTime: null, totalAircraftTimeNew: null,
    landings: null, landingsNew: null,
    hobbs: null, hobbsNew: null,
    sectionTitle: "Airframe Entries",
    logbookSection: "Airframe",
    returnToService: DEFAULT_RTS,
    mechanicName: "", certificateType: "A&P", certificateNumber: "",
  })

  // Lines
  const [localLines,     setLocalLines]     = useState<LineState[]>([])
  const [deletedLineIds, setDeletedLineIds] = useState<Set<string>>(new Set())
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null)
  const [lineText,       setLineText]       = useState("")
  const [savingLine,     setSavingLine]     = useState(false)

  // Load entry
  useEffect(() => {
    setLoading(true)
    getLogbookEntryById(entryId)
      .then(e => {
        if (!e) { setError("Logbook entry not found."); return }
        setEntry(e)
        setFields(fieldsFromEntry(e))
        setLocalLines(e.lines.map(l => ({ id: l.id, lineNumber: l.lineNumber, text: l.text })))
      })
      .catch(err => setError(err.message ?? "Failed to load entry."))
      .finally(() => setLoading(false))
  }, [entryId])

  // Re-sync lines when entry reloads (e.g. after sign)
  function reloadEntry() {
    getLogbookEntryById(entryId).then(e => {
      if (!e) return
      setEntry(e)
      setLocalLines(e.lines.map(l => ({ id: l.id, lineNumber: l.lineNumber, text: l.text })))
    })
  }

  // Auto-save a single field on blur
  const saveField = useCallback(
    (patch: Partial<EditFields>) => {
      if (!entry || entry.status !== "draft") return
      updateLogbookEntry(entry.id, patch as any).catch(console.error)
    },
    [entry]
  )

  // Line management
  function startEditLine(idx: number) {
    setEditingLineIdx(idx)
    setLineText(localLines[idx].text)
  }

  async function saveEditLine(idx: number) {
    if (!entry) return
    const line = { ...localLines[idx], text: lineText }
    setSavingLine(true)
    try {
      if (line.id) {
        await upsertEntryLine(entry.id, { id: line.id, lineNumber: line.lineNumber, text: lineText })
      } else {
        const next = Math.max(0, ...localLines.map(l => l.lineNumber)) + 1
        line.lineNumber = next
        await upsertEntryLine(entry.id, { lineNumber: line.lineNumber, text: lineText })
        // reload to get real id
        const refreshed = await getLogbookEntryById(entry.id)
        if (refreshed) {
          setLocalLines(refreshed.lines.map(l => ({ id: l.id, lineNumber: l.lineNumber, text: l.text })))
          setEditingLineIdx(null)
          setSavingLine(false)
          return
        }
      }
      const updated = [...localLines]
      updated[idx] = line
      setLocalLines(updated)
    } catch (err: any) {
      console.error("Line save failed:", err.message)
    } finally {
      setSavingLine(false)
      setEditingLineIdx(null)
    }
  }

  function addLine() {
    const nextNum = localLines.length > 0 ? Math.max(...localLines.map(l => l.lineNumber)) + 1 : 1
    setLocalLines(prev => [...prev, { id: null, lineNumber: nextNum, text: "" }])
    setEditingLineIdx(localLines.length)
    setLineText("")
  }

  async function removeLine(idx: number) {
    const line = localLines[idx]
    if (line.id) {
      try {
        await deleteEntryLine(line.id)
        setDeletedLineIds(prev => { const s = new Set(prev); s.delete(line.id!); return s })
      } catch (err: any) {
        console.error("Delete line failed:", err.message)
        return
      }
    }
    setLocalLines(prev => prev.filter((_, i) => i !== idx))
    if (editingLineIdx === idx) setEditingLineIdx(null)
  }

  async function handleSign() {
    if (!entry) return
    setSigning(true)
    try {
      await signLogbookEntry(entry.id)
      reloadEntry()
      setSignConfirm(false)
    } catch (err: any) {
      setError(err.message ?? "Sign failed.")
    } finally {
      setSigning(false)
    }
  }

  async function handlePreviewPdf() {
    if (!printRef.current || !entry) return
    setPdfExporting(true)
    try {
      const filename = `${entry.entryNumber} — ${entry.aircraft?.registration ?? entry.guestRegistration ?? "logbook"}.pdf`
      const blob = await buildPdfBlob(printRef.current)
      const url  = URL.createObjectURL(blob)
      setPdfPreview({ url, filename })
    } finally {
      setPdfExporting(false)
    }
  }

  function closePreview() {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview.url)
    setPdfPreview(null)
  }

  // ── Render states ──

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/30">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        <span className="text-sm">Loading entry…</span>
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">{error ?? "Entry not found."}</p>
        <button onClick={() => navigate(fromWO ?? "/app/beet-box/logbook")} className="text-white/40 hover:text-white/70 text-sm transition-colors">
          ← Back
        </button>
      </div>
    )
  }

  const isLocked    = entry.status === "signed" || entry.status === "exported"
  const reg         = entry.aircraft?.registration ?? entry.guestRegistration ?? "—"
  const make        = entry.aircraft?.make ?? "—"
  const model       = entry.aircraft?.modelFull ?? "—"
  // For component sections (Engine, Prop, APU), guestSerial carries the component serial.
  // For Airframe, use the aircraft's own serial number.
  const isComponentSection = fields.logbookSection !== "Airframe" && fields.logbookSection !== "Other"
  const serial = isComponentSection
    ? (entry.guestSerial ?? entry.aircraft?.serialNumber ?? "—")
    : (entry.aircraft?.serialNumber ?? entry.guestSerial ?? "—")
  const hasSigs     = entry.signatories.length > 0
  const displaySigs = hasSigs ? entry.signatories : null

  const signedDisplay = entry.signedAt
    ? fmtDate(entry.signedAt)
    : fields.entryDate

  // ── Status badge ──
  const STATUS_STYLES = {
    draft:    { bg: "bg-zinc-800", text: "text-zinc-400", border: "border-zinc-700" },
    signed:   { bg: "bg-emerald-900/30", text: "text-emerald-400", border: "border-emerald-800/40" },
    exported: { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-800/40" },
  }
  const st = STATUS_STYLES[entry.status]

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Page header (dark) ──────────────────────────────────────────── */}
      <div className="hero-area px-8 pt-6 pb-5">
        <button
          onClick={() => navigate(fromWO ?? "/app/beet-box/logbook")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {fromWO ? "Back to Work Order" : "Logbook"}
        </button>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
              {entry.entryNumber}
            </h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border ${st.bg} ${st.text} ${st.border}`}>
              {entry.status}
            </span>
            {entry.aircraft?.registration && (
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
                {entry.aircraft.registration}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Preview / Export PDF */}
            <Button
              size="sm"
              variant="ghost"
              disabled={pdfExporting}
              onClick={handlePreviewPdf}
              className="flex items-center gap-2 text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 text-xs h-8 px-3"
            >
              <FileDown className="w-3.5 h-3.5" />
              {pdfExporting ? "Generating…" : "Preview PDF"}
            </Button>

            {/* Sign & Lock */}
            {!isLocked && !signConfirm && (
              <Button
                size="sm"
                onClick={() => setSignConfirm(true)}
                style={{ background: "var(--skyshare-gold)", color: "#000" }}
                className="font-semibold text-xs h-8 px-4"
              >
                Sign & Lock Entry
              </Button>
            )}

            {/* Sign confirmation */}
            {signConfirm && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.3)" }}>
                <span className="text-white/70 text-xs">Lock this entry permanently?</span>
                <button
                  disabled={signing}
                  onClick={handleSign}
                  className="text-xs font-bold px-2 py-0.5 rounded text-black"
                  style={{ background: "var(--skyshare-gold)" }}
                >
                  {signing ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes, Sign"}
                </button>
                <button onClick={() => setSignConfirm(false)} className="text-white/40 hover:text-white/70">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {entry.woNumber && (
          <p className="text-white/35 text-xs mt-1.5">
            Generated from <span className="text-white/60 font-mono">{entry.woNumber}</span>
            <span className="mx-2 text-white/20">·</span>
            {new Date(fields.entryDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>

      <div className="stripe-divider" />

      {/* ── Document body ───────────────────────────────────────────────── */}
      <div className="flex-1 px-8 py-8">

        {/* THE DOCUMENT — white card, captured for PDF */}
        <div
          ref={printRef}
          className="mx-auto rounded shadow-2xl overflow-hidden"
          style={{ maxWidth: "760px", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif" }}
        >

          {/* Top bar */}
          <div
            className="flex justify-between items-center px-5 py-2 text-xs"
            style={{ borderTop: "3px solid #444", borderBottom: "1px solid #ccc", color: "#555" }}
          >
            <span style={{ fontWeight: 600, color: "#111" }}>
              {entry.woNumber ?? entry.entryNumber}
              <span style={{ fontWeight: 400, color: "#666" }}> ({fields.entryDate})</span>
            </span>
            <span>Page 1 / 1</span>
          </div>

          {/* Three-column header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #ccc" }}>

            {/* Left: Aircraft info */}
            <div style={{ padding: "12px 16px", borderRight: "1px solid #ccc", fontSize: "12px" }}>
              {[
                { label: "MAKE",    value: make   },
                { label: "MODEL",   value: model  },
                { label: "S/N",     value: serial },
                { label: "REG. NO", value: reg    },
              ].map(row => (
                <div key={row.label} style={{ display: "flex", gap: "6px", lineHeight: "1.8" }}>
                  <span style={{ fontWeight: 700, minWidth: "52px", color: "#555", flexShrink: 0 }}>{row.label}:</span>
                  <span style={{ color: "#111" }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Center: Company */}
            <div style={{ padding: "12px 16px", borderRight: "1px solid #ccc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <p style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#aaa", textTransform: "uppercase", marginBottom: "2px" }}>SKYSHARE</p>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#111", lineHeight: "1.3" }}>CB Aviation, Inc.</p>
              <p style={{ fontSize: "12px", color: "#555" }}>dba SkyShare</p>
              <p style={{ fontSize: "11px", color: "#777", marginTop: "4px" }}>3715 Airport Rd.</p>
              <p style={{ fontSize: "11px", color: "#777" }}>Ogden, UT 84116</p>
            </div>

            {/* Right: W/O, date, time fields */}
            <div style={{ padding: "12px 16px", fontSize: "12px" }}>
              <div style={{ display: "flex", gap: "6px", lineHeight: "1.8" }}>
                <span style={{ fontWeight: 700, minWidth: "64px", color: "#555", flexShrink: 0 }}>W/O #:</span>
                <span style={{ color: "#111", fontFamily: "monospace" }}>{entry.woNumber ?? "—"}</span>
              </div>

              {/* Date */}
              <div style={{ display: "flex", gap: "6px", lineHeight: "1.8", alignItems: "center" }}>
                <span style={{ fontWeight: 700, minWidth: "64px", color: "#555", flexShrink: 0 }}>DATE:</span>
                {isLocked ? (
                  <span style={{ color: "#111" }}>{fmtDate(fields.entryDate)}</span>
                ) : (
                  <input
                    type="date"
                    value={fields.entryDate}
                    onChange={e => setFields(f => ({ ...f, entryDate: e.target.value }))}
                    onBlur={e => saveField({ entryDate: e.target.value })}
                    style={{ border: "none", borderBottom: "1px solid #aaa", background: "transparent", fontSize: "12px", outline: "none", color: "#111", padding: "0 2px", width: "110px" }}
                  />
                )}
              </div>

              {/* A/C / Engine / Prop Total Time */}
              <div style={{ display: "flex", gap: "6px", lineHeight: "1.8", alignItems: "center" }}>
                <span style={{ fontWeight: 700, minWidth: "64px", color: "#555", flexShrink: 0 }}>
                  {(fields.logbookSection === "Engine 1" || fields.logbookSection === "Engine 2") ? "ENG TT:" :
                   fields.logbookSection === "Propeller" ? "PROP TT:" :
                   fields.logbookSection === "APU" ? "APU HRS:" :
                   "A/C TT:"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {isLocked ? (
                    <span style={{ color: "#111" }}>{fields.totalAircraftTimeNew?.toFixed(1) ?? "—"}</span>
                  ) : (
                    <input
                      type="text" inputMode="decimal" placeholder="0.0"
                      value={fields.totalAircraftTimeNew ?? ""}
                      onChange={e => setFields(f => ({ ...f, totalAircraftTimeNew: e.target.value ? parseFloat(e.target.value) : null }))}
                      onBlur={e => saveField({ totalAircraftTimeNew: e.target.value ? parseFloat(e.target.value) : null })}
                      style={{ border: "none", borderBottom: "1px solid #aaa", background: "transparent", fontSize: "12px", outline: "none", color: "#111", padding: "0 2px", width: "70px" }}
                    />
                  )}
                </div>
              </div>

              {/* Landings / Cycles / Starts */}
              <div style={{ display: "flex", gap: "6px", lineHeight: "1.8", alignItems: "center" }}>
                <span style={{ fontWeight: 700, minWidth: "64px", color: "#555", flexShrink: 0 }}>
                  {(fields.logbookSection === "Engine 1" || fields.logbookSection === "Engine 2") ? "Cycles:" :
                   fields.logbookSection === "Propeller" ? "Cycles:" :
                   fields.logbookSection === "APU" ? "Starts:" :
                   "Landings:"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {isLocked ? (
                    <span style={{ color: "#111" }}>{fields.landingsNew ?? "—"}</span>
                  ) : (
                    <input
                      type="text" inputMode="numeric" placeholder="0"
                      value={fields.landingsNew ?? ""}
                      onChange={e => setFields(f => ({ ...f, landingsNew: e.target.value ? parseInt(e.target.value) : null }))}
                      onBlur={e => saveField({ landingsNew: e.target.value ? parseInt(e.target.value) : null })}
                      style={{ border: "none", borderBottom: "1px solid #aaa", background: "transparent", fontSize: "12px", outline: "none", color: "#111", padding: "0 2px", width: "70px" }}
                    />
                  )}
                </div>
              </div>

              {/* Hobbs */}
              <div style={{ display: "flex", gap: "6px", lineHeight: "1.8", alignItems: "center" }}>
                <span style={{ fontWeight: 700, minWidth: "64px", color: "#555", flexShrink: 0 }}>Hobbs:</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {isLocked ? (
                    <span style={{ color: "#111" }}>{fields.hobbsNew?.toFixed(1) ?? "—"}</span>
                  ) : (
                    <input
                      type="text" inputMode="decimal" placeholder="0.0"
                      value={fields.hobbsNew ?? ""}
                      onChange={e => setFields(f => ({ ...f, hobbsNew: e.target.value ? parseFloat(e.target.value) : null }))}
                      onBlur={e => saveField({ hobbsNew: e.target.value ? parseFloat(e.target.value) : null })}
                      style={{ border: "none", borderBottom: "1px solid #aaa", background: "transparent", fontSize: "12px", outline: "none", color: "#111", padding: "0 2px", width: "70px" }}
                    />
                  )}
                </div>
              </div>
            </div>

          </div>{/* end header grid */}

          {/* Section title */}
          <div style={{ padding: "12px 20px 6px", borderBottom: "1px solid #ddd" }}>
            {isLocked ? (
              <p style={{ fontSize: "13px", fontWeight: 700, textDecoration: "underline", color: "#111", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {fields.sectionTitle}
              </p>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  value={fields.sectionTitle}
                  onChange={e => setFields(f => ({ ...f, sectionTitle: e.target.value }))}
                  onBlur={e => saveField({ sectionTitle: e.target.value })}
                  style={{ fontSize: "13px", fontWeight: 700, textDecoration: "underline", color: "#111", textTransform: "uppercase", letterSpacing: "0.04em", border: "none", background: "transparent", outline: "none", flex: 1 }}
                />
                <select
                  value={fields.logbookSection}
                  onChange={e => {
                    const sec = e.target.value as LogbookSection
                    setFields(f => ({ ...f, logbookSection: sec, sectionTitle: `${sec} Entries` }))
                    saveField({ logbookSection: sec, sectionTitle: `${sec} Entries` })
                  }}
                  style={{ fontSize: "11px", color: "#888", border: "1px solid #ddd", borderRadius: "3px", padding: "1px 4px", background: "white", outline: "none" }}
                >
                  {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Numbered work entry lines */}
          <div style={{ padding: "12px 20px", borderBottom: "1px solid #ddd", minHeight: "80px" }}>
            {localLines.length === 0 && (
              <p style={{ fontSize: "12px", color: "#bbb", fontStyle: "italic" }}>
                No entries yet. Sign off work order items to populate, or add lines manually below.
              </p>
            )}

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <tbody>
                {localLines.map((line, idx) => (
                  <tr key={idx} style={{ verticalAlign: "top" }}>
                    <td style={{ paddingRight: "10px", paddingTop: "4px", width: "20px", textAlign: "right", color: "#888", whiteSpace: "nowrap", fontWeight: 700 }}>
                      {line.lineNumber}
                    </td>
                    <td style={{ paddingTop: "4px", lineHeight: "1.6", color: "#111" }}>
                      {editingLineIdx === idx ? (
                        <div>
                          <textarea
                            value={lineText}
                            onChange={e => setLineText(e.target.value)}
                            rows={3}
                            autoFocus
                            style={{ width: "100%", border: "1px solid #ccc", borderRadius: "3px", padding: "6px 8px", fontSize: "12px", lineHeight: "1.6", color: "#111", outline: "none", resize: "vertical", background: "#fafafa" }}
                          />
                          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                            <button
                              disabled={savingLine}
                              onClick={() => saveEditLine(idx)}
                              style={{ fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "3px", background: "#222", color: "#fff", border: "none", cursor: "pointer" }}
                            >
                              {savingLine ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                if (line.id === null) {
                                  setLocalLines(prev => prev.filter((_, i) => i !== idx))
                                }
                                setEditingLineIdx(null)
                              }}
                              style={{ fontSize: "11px", color: "#888", background: "none", border: "none", cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                          <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>
                            {line.text || <span style={{ color: "#ccc", fontStyle: "italic" }}>Empty — click to edit</span>}
                          </span>
                          {!isLocked && (
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0, opacity: 0.4 }}
                              className="group-hover:opacity-100"
                            >
                              <button
                                onClick={() => startEditLine(idx)}
                                title="Edit"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: "2px" }}
                              >
                                <Pencil style={{ width: "12px", height: "12px" }} />
                              </button>
                              <button
                                onClick={() => removeLine(idx)}
                                title="Delete"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#cc4444", padding: "2px" }}
                              >
                                <X style={{ width: "12px", height: "12px" }} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!isLocked && (
              <button
                onClick={addLine}
                style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#aaa", background: "none", border: "1px dashed #ddd", borderRadius: "3px", padding: "4px 10px", cursor: "pointer" }}
              >
                <Plus style={{ width: "12px", height: "12px" }} />
                Add entry
              </button>
            )}
          </div>

          {/* Return to service certification */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #ddd" }}>
            {isLocked ? (
              <p style={{ fontSize: "11px", color: "#444", lineHeight: "1.6", fontStyle: "italic" }}>
                {fields.returnToService}
              </p>
            ) : (
              <textarea
                value={fields.returnToService}
                onChange={e => setFields(f => ({ ...f, returnToService: e.target.value }))}
                onBlur={e => saveField({ returnToService: e.target.value })}
                rows={3}
                style={{ width: "100%", fontSize: "11px", color: "#444", lineHeight: "1.6", fontStyle: "italic", border: "none", background: "transparent", outline: "none", resize: "none" }}
              />
            )}
          </div>

          {/* Signature block(s) */}
          {displaySigs ? (
            // Multi-signatory (from WO sign-off flow)
            displaySigs.map((sig, si) => (
              <SignatureBlock
                key={sig.id}
                isFirst={si === 0}
                isLocked={isLocked}
                signedDate={signedDisplay}
                mechName={sig.mechanicName}
                certType={sig.certType ?? "A&P"}
                certNumber={sig.certNumber ?? ""}
                onBlurName={v  => !isLocked && updateSignatory(sig.id, { mechanicName: v }).catch(console.error)}
                onBlurCert={v  => !isLocked && updateSignatory(sig.id, { certType: v as CertType }).catch(console.error)}
                onBlurNum={v   => !isLocked && updateSignatory(sig.id, { certNumber: v }).catch(console.error)}
              />
            ))
          ) : (
            // Single mechanic (standalone entry)
            <SignatureBlock
              isFirst
              isLocked={isLocked}
              signedDate={signedDisplay}
              mechName={fields.mechanicName}
              certType={fields.certificateType}
              certNumber={fields.certificateNumber}
              onBlurName={v  => { setFields(f => ({ ...f, mechanicName: v }));      saveField({ mechanicName: v }) }}
              onBlurCert={v  => { setFields(f => ({ ...f, certificateType: v as CertType })); saveField({ certificateType: v as CertType }) }}
              onBlurNum={v   => { setFields(f => ({ ...f, certificateNumber: v })); saveField({ certificateNumber: v }) }}
            />
          )}

        </div>{/* end document card */}

        {/* Footer hint */}
        {!isLocked && (
          <p className="text-center text-white/25 text-xs mt-6">
            Fields auto-save as you edit · Sign & Lock to finalize · Preview PDF to review before downloading
          </p>
        )}

      </div>

      {/* ── PDF Preview Modal ──────────────────────────────────────────────── */}
      {pdfPreview && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "rgba(0,0,0,0.85)" }}
        >
          {/* Modal header */}
          <div
            className="flex items-center justify-between px-6 py-3 flex-shrink-0"
            style={{ background: "hsl(0 0% 10%)", borderBottom: "1px solid hsl(0 0% 20%)" }}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-white/40" />
              <span className="text-white/70 text-sm font-medium">{pdfPreview.filename}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => triggerDownload(pdfPreview.url, pdfPreview.filename)}
                style={{ background: "var(--skyshare-gold)", color: "#000" }}
                className="font-semibold text-xs h-8 px-4 flex items-center gap-2"
              >
                <FileDown className="w-3.5 h-3.5" />
                Download
              </Button>
              <button
                onClick={closePreview}
                className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PDF iframe */}
          <div className="flex-1 overflow-hidden p-6">
            <iframe
              src={pdfPreview.url}
              className="w-full h-full rounded"
              style={{ border: "none" }}
              title="Logbook Entry Preview"
            />
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Reusable signature block ─────────────────────────────────────────────────

function SignatureBlock({
  isFirst, isLocked, signedDate,
  mechName, certType, certNumber,
  onBlurName, onBlurCert, onBlurNum,
}: {
  isFirst:    boolean
  isLocked:   boolean
  signedDate: string
  mechName:   string
  certType:   CertType
  certNumber: string
  onBlurName: (v: string) => void
  onBlurCert: (v: string) => void
  onBlurNum:  (v: string) => void
}) {
  const [localName, setLocalName]   = useState(mechName)
  const [localCert, setLocalCert]   = useState(certType)
  const [localNum,  setLocalNum]    = useState(certNumber)

  // Sync if parent value changes (e.g. on reload)
  useEffect(() => { setLocalName(mechName) }, [mechName])
  useEffect(() => { setLocalCert(certType) }, [certType])
  useEffect(() => { setLocalNum(certNumber) }, [certNumber])

  const inputStyle: React.CSSProperties = {
    border: "none", borderBottom: "1px solid #aaa", background: "transparent",
    fontSize: "12px", outline: "none", color: "#111", padding: "0 2px",
  }

  return (
    <div style={{ padding: "12px 20px 16px", borderTop: isFirst ? "1px solid #ddd" : "1px dashed #ddd" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "24px", flexWrap: "wrap" }}>

        {/* Date */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Date</p>
          <p style={{ fontSize: "12px", color: "#111", borderBottom: "1px solid #aaa", minWidth: "90px", paddingBottom: "1px" }}>{signedDate}</p>
        </div>

        {/* Signature */}
        <div style={{ flex: 1, minWidth: "180px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Signed</p>
          {isLocked ? (
            <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "15px", color: "#1a6e2e", borderBottom: "1px solid #1a6e2e", paddingBottom: "1px" }}>
              {localName || "—"}
            </p>
          ) : (
            <div style={{ borderBottom: "1px dashed #ccc", paddingBottom: "1px", height: "22px", display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "#bbb", fontStyle: "italic" }}>Awaiting signature</span>
            </div>
          )}
        </div>

      </div>

      {/* Name + cert row */}
      <div style={{ display: "flex", gap: "24px", marginTop: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>

        {/* Printed name */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Name (Print)</p>
          {isLocked ? (
            <p style={{ fontSize: "12px", color: "#111" }}>{localName || "—"}</p>
          ) : (
            <input
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              onBlur={e => onBlurName(e.target.value)}
              placeholder="Mechanic name"
              style={{ ...inputStyle, minWidth: "160px" }}
            />
          )}
        </div>

        {/* Certificate type */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Certificate</p>
          {isLocked ? (
            <p style={{ fontSize: "12px", color: "#111" }}>{localCert}</p>
          ) : (
            <select
              value={localCert}
              onChange={e => setLocalCert(e.target.value as CertType)}
              onBlur={e => onBlurCert(e.target.value)}
              style={{ ...inputStyle, minWidth: "80px" }}
            >
              {CERT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* Certificate number */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>Certificate No.</p>
          {isLocked ? (
            <p style={{ fontSize: "12px", color: "#111", fontFamily: "monospace" }}>{localNum || "—"}</p>
          ) : (
            <input
              value={localNum}
              onChange={e => setLocalNum(e.target.value)}
              onBlur={e => onBlurNum(e.target.value)}
              placeholder="1234567"
              style={{ ...inputStyle, fontFamily: "monospace", minWidth: "120px" }}
            />
          )}
        </div>

      </div>
    </div>
  )
}
