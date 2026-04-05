import { useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, AlertTriangle, Check, Plus, X, Pencil } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import {
  LOGBOOK_ENTRIES, WORK_ORDERS, AIRCRAFT, MECHANICS,
  type LogbookEntry, type LogbookEntryLine,
} from "../../data/mockData"

const RTS = "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 135.411(a)(1), Part 91.409(f)(3), and Part 43, and is approved for return to service in respect to that work performed."

const STATUS_STYLES = {
  draft:    "bg-zinc-800 text-zinc-400 border border-zinc-700",
  signed:   "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40",
  exported: "bg-blue-900/30 text-blue-400 border border-blue-800/40",
}

// ─── Build a new entry (from WO or blank) ────────────────────────────────────
function buildNewEntry(woId: string | null): LogbookEntry {
  const wo   = woId ? WORK_ORDERS.find(w => w.id === woId) : undefined
  const ac   = wo ? AIRCRAFT.find(a => a.id === wo.aircraftId) : AIRCRAFT[0]
  const mech = MECHANICS[1] // default to R. Thompson (IA)

  const entries: LogbookEntryLine[] = wo
    ? wo.items.map(i => ({
        number: i.itemNumber,
        text:   i.correctiveAction || `${i.category}${i.taskNumber ? ` (${i.taskNumber})` : ""} — corrective action pending.`,
      }))
    : [{ number: 1, text: "" }]

  return {
    id:                    "lb-new",
    entryNumber:           "LB-NEW",
    aircraftId:            ac?.id ?? "ac-001",
    aircraftReg:           ac?.registration ?? "",
    make:                  ac?.make ?? "",
    model:                 ac?.model ?? "",
    serial:                ac?.serial ?? "",
    woId:                  wo?.id,
    woNumber:              wo?.woNumber,
    entryDate:             new Date().toISOString().split("T")[0],
    totalAircraftTime:     ac?.totalTime ?? 0,
    totalAircraftTimeNew:  ac?.totalTime ?? 0,
    landings:              undefined,
    landingsNew:           undefined,
    hobbs:                 ac?.totalTime ?? 0,
    hobbsNew:              ac?.totalTime ?? 0,
    sectionTitle:          "Airframe Entries",
    entries,
    complianceRef:         "",
    returnToService:       RTS,
    mechanicId:            mech.id,
    mechanicName:          mech.name,
    certificateType:       "A&P/IA",
    certificateNumber:     mech.certNumber,
    isRIA:                 false,
    status:                "draft",
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LogbookDetail() {
  const { id }         = useParams<{ id: string }>()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const woParam        = searchParams.get("wo")
  const fromWO         = searchParams.get("from")

  const isNew    = id === "new"
  const original = isNew ? buildNewEntry(woParam) : LOGBOOK_ENTRIES.find(e => e.id === id)

  const [entry, setEntry] = useState<LogbookEntry | null>(original ?? null)

  // Entry line editing
  const [editingLine, setEditingLine] = useState<number | null>(null)
  const [lineText, setLineText]       = useState("")

  if (!entry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">Logbook entry not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(fromWO ?? "/app/beet-box/logbook")} className="text-white/50">
          {fromWO ? "← Back to Work Order" : "← Back to Logbook"}
        </Button>
      </div>
    )
  }

  const isLocked = entry.status === "signed" || entry.status === "exported"

  function update(patch: Partial<LogbookEntry>) {
    setEntry(prev => prev ? { ...prev, ...patch } : prev)
  }

  function startEditLine(line: LogbookEntryLine) {
    setEditingLine(line.number)
    setLineText(line.text)
  }

  function saveEditLine(number: number) {
    setEntry(prev => {
      if (!prev) return prev
      return {
        ...prev,
        entries: prev.entries.map(l => l.number === number ? { ...l, text: lineText } : l),
      }
    })
    setEditingLine(null)
  }

  function addEntry() {
    const nextNum = entry.entries.length > 0
      ? Math.max(...entry.entries.map(l => l.number)) + 1
      : 1
    setEntry(prev => prev ? { ...prev, entries: [...prev.entries, { number: nextNum, text: "" }] } : prev)
    setEditingLine(nextNum)
    setLineText("")
  }

  function removeEntry(number: number) {
    setEntry(prev => prev ? { ...prev, entries: prev.entries.filter(l => l.number !== number) } : prev)
  }

  function signEntry() {
    setEntry(prev => prev ? { ...prev, status: "signed", signedAt: new Date().toISOString() } : prev)
  }

  const signedDate = entry.signedAt
    ? new Date(entry.signedAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    : entry.entryDate

  return (
    <div className="min-h-screen flex flex-col">

      {/* Page header */}
      <div className="hero-area px-8 pt-6 pb-5">
        <button
          onClick={() => navigate(fromWO ?? "/app/beet-box/logbook")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {fromWO ? "Back to Work Order" : "Logbook"}
        </button>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1
              className="text-white"
              style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}
            >
              {isNew ? "New Logbook Entry" : entry.entryNumber}
            </h1>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide", STATUS_STYLES[entry.status])}>
              {entry.status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!isLocked && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/50 hover:text-white/80 text-xs border border-white/10"
                  onClick={() => alert("Save — demo only")}
                >
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={signEntry}
                  style={{ background: "var(--skyshare-gold)", color: "#000" }}
                  className="font-semibold text-xs"
                >
                  Sign & Lock Entry
                </Button>
              </>
            )}
            {isLocked && (
              <Button
                size="sm"
                variant="ghost"
                className="text-white/50 hover:text-white/80 text-xs border border-white/10"
                onClick={() => alert("Export PDF — demo only")}
              >
                Export PDF
              </Button>
            )}
          </div>
        </div>
        {entry.woNumber && (
          <p className="text-white/35 text-xs mt-1.5">
            Generated from <span className="text-white/60 font-mono">{entry.woNumber}</span>
            {entry.entryDate && <span className="ml-3">· {new Date(entry.entryDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>}
          </p>
        )}
      </div>

      <div className="stripe-divider" />

      <div className="flex-1 px-8 py-6">
        {/* ── Logbook Document ──────────────────────────────────────────────── */}
        <div
          className="rounded-lg overflow-hidden max-w-4xl"
          style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" }}
        >

          {/* Document top bar — WO# (date) / Page */}
          <div
            className="flex items-center justify-between px-5 py-2 text-xs font-mono"
            style={{ borderBottom: "1px solid hsl(0 0% 20%)", background: "hsl(0 0% 10%)" }}
          >
            <span className="text-white/50">
              {entry.woNumber ?? entry.entryNumber} ({entry.entryDate})
            </span>
            <span className="text-white/35">Page 1 / 1</span>
          </div>

          {/* ── Header block: Aircraft info | Shop | WO/Times ─────────────── */}
          <div
            className="grid grid-cols-3 gap-0 px-5 py-4 text-xs"
            style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}
          >
            {/* Left: Aircraft */}
            <div className="space-y-1.5">
              {[
                { label: "MAKE",    field: "make"     as const },
                { label: "MODEL",   field: "model"    as const },
                { label: "S/N",     field: "serial"   as const },
                { label: "REG. NO", field: "aircraftReg" as const },
              ].map(row => (
                <div key={row.label} className="flex items-baseline gap-2">
                  <span className="text-white/35 w-14 flex-shrink-0 font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                    {row.label}:
                  </span>
                  {isLocked ? (
                    <span className="text-white/80">{entry[row.field]}</span>
                  ) : (
                    <input
                      className="flex-1 bg-transparent border-b border-white/15 text-white/80 focus:outline-none focus:border-white/40 pb-0.5"
                      value={String(entry[row.field] ?? "")}
                      onChange={e => update({ [row.field]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Center: Shop */}
            <div className="flex flex-col items-center justify-center text-center gap-1">
              <div
                className="text-white/25 text-[9px] tracking-[0.25em] uppercase mb-0.5"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                SKYSHARE
              </div>
              <p className="text-white/80 font-semibold text-sm">CB Aviation, Inc.</p>
              <p className="text-white/50">dba SkyShare</p>
              <p className="text-white/40">3715 Airport Rd.</p>
              <p className="text-white/40">Ogden, UT 84116</p>
            </div>

            {/* Right: W/O / Date / Times */}
            <div className="space-y-1.5 text-right">
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-white/35 font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>W/O #:</span>
                <span className="text-white/80 font-mono">{entry.woNumber ?? "—"}</span>
              </div>
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-white/35 font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>DATE:</span>
                {isLocked ? (
                  <span className="text-white/80">{entry.entryDate}</span>
                ) : (
                  <input
                    type="date"
                    className="bg-transparent border-b border-white/15 text-white/80 focus:outline-none focus:border-white/40 text-right"
                    value={entry.entryDate}
                    onChange={e => update({ entryDate: e.target.value })}
                  />
                )}
              </div>

              {/* A/C TT — shows old → new */}
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-white/35 font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>A/C TT:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/35 line-through text-[10px] font-mono">{entry.totalAircraftTime.toFixed(1)}</span>
                  {isLocked ? (
                    <span className="text-white/80 font-mono">{(entry.totalAircraftTimeNew ?? entry.totalAircraftTime).toFixed(1)}</span>
                  ) : (
                    <input
                      type="number"
                      step="0.1"
                      className="w-20 bg-transparent border-b border-white/15 text-white/80 focus:outline-none focus:border-white/40 text-right font-mono"
                      value={entry.totalAircraftTimeNew ?? entry.totalAircraftTime}
                      onChange={e => update({ totalAircraftTimeNew: parseFloat(e.target.value) || entry.totalAircraftTime })}
                    />
                  )}
                </div>
              </div>

              {/* Landings */}
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-white/35 font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>Landings:</span>
                <div className="flex items-center gap-1.5">
                  {entry.landings !== undefined && (
                    <span className="text-white/35 line-through text-[10px] font-mono">{entry.landings}</span>
                  )}
                  {isLocked ? (
                    <span className="text-white/80 font-mono">{entry.landingsNew ?? "—"}</span>
                  ) : (
                    <input
                      type="number"
                      className="w-20 bg-transparent border-b border-white/15 text-white/80 focus:outline-none focus:border-white/40 text-right font-mono"
                      placeholder="—"
                      value={entry.landingsNew ?? ""}
                      onChange={e => update({ landingsNew: e.target.value ? parseInt(e.target.value) : undefined })}
                    />
                  )}
                </div>
              </div>

              {/* Hobbs */}
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-white/35 font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>Hobbs:</span>
                <div className="flex items-center gap-1.5">
                  {entry.hobbs !== undefined && (
                    <span className="text-white/35 line-through text-[10px] font-mono">{entry.hobbs?.toFixed(1)}</span>
                  )}
                  {isLocked ? (
                    <span className="text-white/80 font-mono">{entry.hobbsNew?.toFixed(1) ?? "—"}</span>
                  ) : (
                    <input
                      type="number"
                      step="0.1"
                      className="w-20 bg-transparent border-b border-white/15 text-white/80 focus:outline-none focus:border-white/40 text-right font-mono"
                      placeholder="—"
                      value={entry.hobbsNew ?? ""}
                      onChange={e => update({ hobbsNew: e.target.value ? parseFloat(e.target.value) : undefined })}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section title ─────────────────────────────────────────────── */}
          <div
            className="px-5 pt-4 pb-2"
            style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}
          >
            {isLocked ? (
              <p className="text-white font-bold text-sm" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                {entry.sectionTitle}
              </p>
            ) : (
              <input
                className="text-white font-bold text-sm bg-transparent border-b border-white/15 focus:outline-none focus:border-white/40 w-64"
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}
                value={entry.sectionTitle}
                onChange={e => update({ sectionTitle: e.target.value })}
              />
            )}
          </div>

          {/* ── Numbered entries ──────────────────────────────────────────── */}
          <div className="px-5 py-4 space-y-3" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>

            {entry.entries.map(line => (
              <div key={line.number} className="flex gap-4 items-start">

                {/* Number */}
                <span
                  className="text-white/60 text-sm font-semibold w-5 flex-shrink-0 mt-0.5 text-right"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {line.number}
                </span>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  {editingLine === line.number ? (
                    <div className="space-y-2">
                      <textarea
                        value={lineText}
                        onChange={e => setLineText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full bg-white/[0.06] border border-white/20 rounded px-3 py-2 text-white/90 text-sm leading-relaxed resize-y focus:outline-none focus:border-white/35"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEditLine(line.number)} style={{ background: "var(--skyshare-gold)", color: "#000" }} className="text-xs font-semibold h-7">
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingLine(null)} className="text-white/40 text-xs h-7">
                          <X className="w-3 h-3" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 group">
                      <p className="text-white/85 text-sm leading-relaxed flex-1">{line.text || <span className="text-white/25 italic">Empty entry — click to edit</span>}</p>
                      {!isLocked && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => startEditLine(line)} className="text-white/30 hover:text-white/70 transition-colors p-0.5">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => removeEntry(line.number)} className="text-white/20 hover:text-red-400 transition-colors p-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            ))}

            {/* Add entry row */}
            {!isLocked && (
              <button
                onClick={addEntry}
                className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors mt-2 ml-9"
              >
                <Plus className="w-3.5 h-3.5" />
                Add entry
              </button>
            )}

          </div>

          {/* ── Return to Service certification ───────────────────────────── */}
          <div className="px-5 py-4" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
            <p className="text-white/65 text-xs leading-relaxed italic">{entry.returnToService}</p>
          </div>

          {/* ── Signature block ───────────────────────────────────────────── */}
          <div className="px-5 py-4">
            <div className="flex items-end justify-between gap-4">

              {/* Left: Date / Signed / Name / A&P# */}
              <div className="space-y-3 flex-1">

                <div className="flex items-end gap-8">
                  {/* Date */}
                  <div className="space-y-1">
                    <p className="text-white/35 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Date</p>
                    {isLocked ? (
                      <p className="text-white/80 text-sm font-mono">{signedDate}</p>
                    ) : (
                      <input
                        type="date"
                        className="bg-transparent border-b border-white/20 text-white/80 text-sm focus:outline-none focus:border-white/40 font-mono"
                        value={entry.entryDate}
                        onChange={e => update({ entryDate: e.target.value })}
                      />
                    )}
                  </div>

                  {/* Signature area */}
                  <div className="flex-1 space-y-1">
                    <p className="text-white/35 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Signed</p>
                    {isLocked ? (
                      <div className="flex items-center gap-2 border-b border-white/20 pb-1">
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-emerald-400 text-sm font-medium italic" style={{ fontFamily: "Georgia, serif" }}>
                          {entry.mechanicName}
                        </span>
                        {entry.signedAt && (
                          <span className="text-white/30 text-xs ml-2">
                            {new Date(entry.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="border-b border-dashed border-white/20 pb-1 h-7 flex items-center">
                        <span className="text-white/20 text-xs italic">Awaiting signature</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Name + A&P number */}
                <div className="flex items-center gap-8">
                  <div className="space-y-0.5">
                    {isLocked ? (
                      <p className="text-white/70 text-xs">{entry.mechanicName}</p>
                    ) : (
                      <input
                        className="bg-transparent border-b border-white/15 text-white/70 text-xs focus:outline-none focus:border-white/35"
                        placeholder="Mechanic name"
                        value={entry.mechanicName}
                        onChange={e => update({ mechanicName: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-white/35 text-[10px] mr-1" style={{ fontFamily: "var(--font-heading)" }}>A&P Number:</span>
                    {isLocked ? (
                      <span className="text-white/70 text-xs font-mono">{entry.certificateNumber}</span>
                    ) : (
                      <input
                        className="bg-transparent border-b border-white/15 text-white/70 text-xs focus:outline-none focus:border-white/35 font-mono"
                        placeholder="A&P-0000000"
                        value={entry.certificateNumber}
                        onChange={e => update({ certificateNumber: e.target.value })}
                      />
                    )}
                  </div>
                </div>

              </div>

              {/* Right: Work Order reference */}
              <div className="text-right flex-shrink-0 space-y-1">
                <p className="text-white/50 text-xs font-semibold">WORK ORDER: {entry.woNumber ?? "—"}</p>
                <p className="text-white/25 text-[10px]">Beet Box · CB Aviation, Inc.</p>
              </div>

            </div>
          </div>

        </div>

        {/* Compliance ref — below document */}
        {!isLocked && (
          <div className="max-w-4xl mt-4">
            <div className="flex items-center gap-3">
              <span className="text-white/35 text-xs flex-shrink-0" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                COMPLIANCE REF:
              </span>
              <input
                className="flex-1 bg-transparent border-b border-white/15 text-white/60 text-xs focus:outline-none focus:border-white/35"
                placeholder="AD number, SB reference, or regulatory citation (optional)"
                value={entry.complianceRef ?? ""}
                onChange={e => update({ complianceRef: e.target.value })}
              />
            </div>
          </div>
        )}
        {isLocked && entry.complianceRef && (
          <div className="max-w-4xl mt-3">
            <p className="text-white/35 text-xs">
              <span style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>COMPLIANCE REF:</span>{" "}
              <span className="text-white/55">{entry.complianceRef}</span>
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
