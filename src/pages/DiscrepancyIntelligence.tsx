import { useState, useEffect, useCallback, useMemo } from "react"
import { ChevronRight, ChevronDown, AlertCircle, ArrowLeft, MapPin, Clock, Wrench, Search, List, LayoutGrid, X } from "lucide-react"
import { useFleet } from "./aircraft/useFleet"
import { useDiscrepancyCounts } from "./aircraft/useDiscrepancyCounts"
import { useAircraftDiscrepancies, type DiscrepancyRow } from "./aircraft/useAircraftDiscrepancies"
import type { AircraftBase, ManufacturerGroup } from "./aircraft/fleetData"

// ─── Highlight Helper ─────────────────────────────────────────────────────────
function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(212,160,23,0.35)", color: "inherit", borderRadius: "2px", padding: "0 1px" }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}

// ─── Discrepancy Card ─────────────────────────────────────────────────────────
function DiscrepancyCard({ d, hoursSinceLast, onSelect, searchQuery = "" }: { d: DiscrepancyRow; hoursSinceLast: number | null; onSelect: (d: DiscrepancyRow) => void; searchQuery?: string }) {
  const date = d.found_at ? new Date(d.found_at) : null
  const signoff = d.signoff_date ? new Date(d.signoff_date) : null
  const daysOpen = date && signoff ? Math.round((signoff.getTime() - date.getTime()) / 86_400_000) : null

  return (
    <button
      onClick={() => onSelect(d)}
      className="w-full text-left rounded-lg px-4 py-3 transition-colors hover:brightness-110"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* ID + Title */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: "rgba(212,160,23,0.1)",
                color: "var(--skyshare-gold)",
                fontFamily: "'Courier Prime','Courier New',monospace",
              }}
            >
              <Hl text={d.jetinsight_discrepancy_id} q={searchQuery} />
            </span>
            {d.import_confidence === "medium" && (
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "rgba(255,165,0,0.15)", color: "rgba(255,165,0,0.8)" }}>
                review
              </span>
            )}
          </div>
          <p
            className="text-sm font-medium truncate"
            style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
          >
            <Hl text={d.title} q={searchQuery} />
          </p>
          {d.pilot_report && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
              <Hl text={d.pilot_report} q={searchQuery} />
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {date && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <Clock className="w-3 h-3" />
                {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
            {(d.location_icao || d.location_raw) && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <MapPin className="w-3 h-3" />
                <Hl text={d.location_icao || d.location_raw || ""} q={searchQuery} />
              </span>
            )}
            {d.technician_name && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <Wrench className="w-3 h-3" />
                <Hl text={d.technician_name + (d.company ? ` · ${d.company}` : "")} q={searchQuery} />
              </span>
            )}
            {d.airframe_hours != null && (
              <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                {Number(d.airframe_hours).toLocaleString()} hrs{d.airframe_cycles != null ? ` / ${d.airframe_cycles.toLocaleString()} cyc` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Right side — turnaround + hours since last */}
        <div className="flex-shrink-0 text-right flex flex-col gap-2">
          {daysOpen !== null && (
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: daysOpen <= 1 ? "rgba(100,220,100,0.8)" : daysOpen <= 7 ? "var(--skyshare-gold)" : "rgba(255,165,0,0.8)" }}
              >
                {daysOpen}d
              </div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                turnaround
              </div>
            </div>
          )}
          {hoursSinceLast !== null && (
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: hoursSinceLast >= 100 ? "rgba(100,220,100,0.8)" : hoursSinceLast >= 20 ? "var(--skyshare-gold)" : "rgba(255,165,0,0.8)" }}
              >
                {hoursSinceLast.toFixed(1)}h
              </div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                since last
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Compact Row ─────────────────────────────────────────────────────────────
function CompactRow({ d, onSelect, searchQuery = "" }: { d: DiscrepancyRow; onSelect: (d: DiscrepancyRow) => void; searchQuery?: string }) {
  const date = d.found_at ? new Date(d.found_at) : null
  return (
    <button
      onClick={() => onSelect(d)}
      className="w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors hover:brightness-110"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span
        className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
        style={{
          background: "rgba(212,160,23,0.1)",
          color: "var(--skyshare-gold)",
          fontFamily: "'Courier Prime','Courier New',monospace",
          minWidth: "4rem",
          textAlign: "center",
        }}
      >
        <Hl text={d.jetinsight_discrepancy_id} q={searchQuery} />
      </span>
      {date && (
        <span className="text-[11px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", minWidth: "5.5rem" }}>
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      )}
      <span
        className="text-xs truncate flex-1"
        style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
      >
        <Hl text={d.title} q={searchQuery} />
      </span>
      <span
        className="text-[9px] uppercase tracking-widest flex-shrink-0 px-1.5 py-0.5 rounded"
        style={{
          color: d.status === "open" ? "rgba(255,165,0,0.8)" : "rgba(100,220,100,0.7)",
          background: d.status === "open" ? "rgba(255,165,0,0.08)" : "rgba(100,220,100,0.06)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {d.status}
      </span>
    </button>
  )
}

// ─── Discrepancy Detail ───────────────────────────────────────────────────────
function DiscrepancyDetail({ d, onBack }: { d: DiscrepancyRow; onBack: () => void }) {
  const date = d.found_at ? new Date(d.found_at) : null
  const signoff = d.signoff_date ? new Date(d.signoff_date) : null
  const fmt = (dt: Date) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })

  return (
    <div className="flex flex-col gap-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity self-start" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}>
        <ArrowLeft className="w-4 h-4" /> Back to list
        <kbd className="text-[9px] px-1 py-0.5 rounded ml-1" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(212,160,23,0.5)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1, fontFamily: "var(--font-heading)" }}>esc</kbd>
      </button>

      {/* Header */}
      <div>
        <span
          className="text-[11px] px-2 py-0.5 rounded font-medium"
          style={{ background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)", fontFamily: "'Courier Prime','Courier New',monospace" }}
        >
          {d.jetinsight_discrepancy_id}
        </span>
        <h2
          className="mt-2"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", letterSpacing: "0.06em", color: "hsl(var(--foreground))", lineHeight: 1.2 }}
        >
          {d.title}
        </h2>
      </div>

      {/* Pilot Report */}
      {d.pilot_report && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Pilot Report
          </h3>
          <p className="text-sm" style={{ color: "hsl(var(--foreground))", lineHeight: 1.6 }}>{d.pilot_report}</p>
        </div>
      )}

      {/* Corrective Action */}
      {d.corrective_action && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Corrective Action
          </h3>
          <p className="text-sm" style={{ color: "hsl(var(--foreground))", lineHeight: 1.6 }}>{d.corrective_action}</p>
        </div>
      )}

      {/* AMM References */}
      {d.amm_references && d.amm_references.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            References
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {d.amm_references.map((ref, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.05)", color: "hsl(var(--muted-foreground))", fontFamily: "'Courier Prime','Courier New',monospace" }}
              >
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Details grid */}
      <div
        className="grid gap-x-8 gap-y-3 rounded-lg px-4 py-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <DetailField label="Found By" value={d.found_by_name} />
        <DetailField label="Found Date" value={date ? fmt(date) : null} />
        <DetailField label="Location" value={d.location_icao || d.location_raw} />
        <DetailField label="Technician" value={d.technician_name ? `${d.technician_name}${d.technician_credential_type ? ` (${d.technician_credential_type})` : ""}` : null} />
        <DetailField label="Company" value={d.company} />
        <DetailField label="Signoff Date" value={signoff ? fmt(signoff) : null} />
        <DetailField label="Airframe" value={d.airframe_hours != null ? `${d.airframe_hours} hrs / ${d.airframe_cycles} cyc` : null} />
        <DetailField label="Status" value={d.status} />
      </div>

      {/* Import notes */}
      {d.import_notes && (
        <p className="text-[11px] italic" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
          Import note: {d.import_notes}
        </p>
      )}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)" }}>
        {label}
      </div>
      <div className="text-xs mt-0.5" style={{ color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
        {value || "—"}
      </div>
    </div>
  )
}

// ─── Year Section ─────────────────────────────────────────────────────────────
function YearSection({
  year, records, expanded, onToggle, compact, hoursSinceLastMap, onSelect, searchQuery = "",
}: {
  year: string; records: DiscrepancyRow[]; expanded: boolean; onToggle: () => void
  compact: boolean; hoursSinceLastMap: Map<string, number | null>; onSelect: (d: DiscrepancyRow) => void; searchQuery?: string
}) {
  return (
    <div className="flex flex-col">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg group transition-all duration-200 ease-out hover:-translate-y-0.5"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)" }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.boxShadow = "none" }}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--skyshare-gold)" }} />
          : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--skyshare-gold)" }} />}
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.2rem",
            letterSpacing: "0.07em",
            color: "hsl(var(--foreground))",
            lineHeight: 1,
          }}
        >
          {year}
        </span>
        <span
          className="text-[10px] font-medium px-2.5 py-1 rounded"
          style={{
            background: "rgba(212,160,23,0.12)",
            color: "var(--skyshare-gold)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {records.length} {records.length === 1 ? "record" : "records"}
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "linear-gradient(to right, rgba(212,160,23,0.25), transparent)",
            marginLeft: "0.5rem",
          }}
        />
      </button>

      {expanded && (
        <div className={compact ? "flex flex-col rounded-md overflow-hidden ml-6 mt-1 mb-2" : "flex flex-col gap-2 ml-6 mt-1 mb-2"}
          style={compact ? { border: "1px solid rgba(255,255,255,0.06)" } : undefined}
        >
          {records.map(d =>
            compact
              ? <CompactRow key={d.id} d={d} onSelect={onSelect} searchQuery={searchQuery} />
              : <DiscrepancyCard key={d.id} d={d} hoursSinceLast={hoursSinceLastMap.get(d.id) ?? null} onSelect={onSelect} searchQuery={searchQuery} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Discrepancy List View ────────────────────────────────────────────────────
function DiscrepancyListView({ aircraft, onBack }: { aircraft: AircraftBase; onBack: () => void }) {
  const { data: discrepancies, isLoading } = useAircraftDiscrepancies(aircraft.tailNumber)
  const [selectedRecord, setSelectedRecord] = useState<DiscrepancyRow | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "review">("all")
  const [compact, setCompact] = useState(false)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  // ── Compute stats from full dataset ──
  const stats = useMemo(() => {
    if (!discrepancies || discrepancies.length === 0) return null

    // Total operated hours: max - min airframe hours across all records
    const hours = discrepancies
      .map(d => (d.airframe_hours != null ? Number(d.airframe_hours) : null))
      .filter((h): h is number => h !== null)
    const totalHours = hours.length >= 2 ? Math.max(...hours) - Math.min(...hours) : hours[0] ?? 0

    // Hours per discrepancy
    const hoursPerDiscrep = discrepancies.length > 0 && totalHours > 0
      ? totalHours / discrepancies.length
      : 0

    // Average turnaround time (days)
    const turnarounds: number[] = []
    for (const d of discrepancies) {
      if (d.found_at && d.signoff_date) {
        const days = (new Date(d.signoff_date).getTime() - new Date(d.found_at).getTime()) / 86_400_000
        if (days >= 0) turnarounds.push(days)
      }
    }
    const avgTurnaroundDays = turnarounds.length > 0
      ? turnarounds.reduce((s, v) => s + v, 0) / turnarounds.length
      : null

    // Suspected repeat discrepancies — normalize titles and find clusters
    const normalize = (s: string) =>
      s.toLowerCase()
        .replace(/\b(left|right|lh|rh|l\/h|r\/h|#\d+|no\.\s*\d+)\b/g, "")  // strip side/position refs
        .replace(/[^a-z0-9 ]/g, " ")   // strip punctuation
        .replace(/\s+/g, " ")
        .trim()

    const tokenize = (s: string) => {
      const words = normalize(s).split(" ").filter(w => w.length > 2)
      return new Set(words)
    }

    const jaccard = (a: Set<string>, b: Set<string>) => {
      if (a.size === 0 && b.size === 0) return 0
      let intersection = 0
      for (const w of a) if (b.has(w)) intersection++
      return intersection / (a.size + b.size - intersection)
    }

    const MAX_REPEAT_WINDOW_MS = 120 * 86_400_000 // 120 days (~4 months)
    const tokenSets = discrepancies.map(d => tokenize(d.title))
    const dates = discrepancies.map(d => d.found_at ? new Date(d.found_at).getTime() : null)
    const flagged = new Set<number>()
    for (let i = 0; i < discrepancies.length; i++) {
      for (let j = i + 1; j < discrepancies.length; j++) {
        // Both must have dates and be within the proximity window
        if (dates[i] == null || dates[j] == null) continue
        if (Math.abs(dates[i]! - dates[j]!) > MAX_REPEAT_WINDOW_MS) continue
        if (jaccard(tokenSets[i], tokenSets[j]) >= 0.5) {
          flagged.add(i)
          flagged.add(j)
        }
      }
    }
    const suspectedRepeatPct = discrepancies.length > 0
      ? (flagged.size / discrepancies.length) * 100
      : null

    return { totalHours, hoursPerDiscrep, avgTurnaroundDays, suspectedRepeatPct }
  }, [discrepancies])

  // Build hoursSinceLast from full sorted list (before filtering)
  const hoursSinceLastMap = useMemo(() => {
    const map = new Map<string, number | null>()
    if (!discrepancies) return map
    for (let i = 0; i < discrepancies.length; i++) {
      const d = discrepancies[i]
      const prev = discrepancies[i + 1]
      const val =
        d.airframe_hours != null && prev?.airframe_hours != null
          ? Number(d.airframe_hours) - Number(prev.airframe_hours)
          : null
      map.set(d.id, val)
    }
    return map
  }, [discrepancies])

  // Filter discrepancies by search + status
  const filtered = useMemo(() => {
    if (!discrepancies) return []
    const q = searchQuery.toLowerCase().trim()
    return discrepancies.filter(d => {
      // Status filter
      if (statusFilter === "open" && d.status !== "open") return false
      if (statusFilter === "closed" && d.status !== "closed") return false
      if (statusFilter === "review" && d.import_confidence !== "medium") return false
      // Keyword search
      if (q) {
        const haystack = [d.title, d.pilot_report, d.corrective_action, d.technician_name, d.company, d.jetinsight_discrepancy_id, d.location_icao, d.location_raw]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [discrepancies, searchQuery, statusFilter])

  // Group filtered results by year
  const yearGroups = useMemo(() => {
    const groups = new Map<string, DiscrepancyRow[]>()
    for (const d of filtered) {
      const year = d.found_at ? new Date(d.found_at).getFullYear().toString() : "Unknown"
      const list = groups.get(year) ?? []
      list.push(d)
      groups.set(year, list)
    }
    // Sort years descending
    return [...groups.entries()].sort((a, b) => (b[0] === "Unknown" ? -1 : a[0] === "Unknown" ? 1 : Number(b[0]) - Number(a[0])))
  }, [filtered])

  // Auto-expand most recent year on first load
  useEffect(() => {
    if (!initialized && yearGroups.length > 0) {
      setExpandedYears(new Set([yearGroups[0][0]]))
      setInitialized(true)
    }
  }, [yearGroups, initialized])

  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  // Status counts for chips
  const statusCounts = useMemo(() => {
    if (!discrepancies) return { all: 0, open: 0, closed: 0, review: 0 }
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch = (d: DiscrepancyRow) => {
      if (!q) return true
      const haystack = [d.title, d.pilot_report, d.corrective_action, d.technician_name, d.company, d.jetinsight_discrepancy_id, d.location_icao, d.location_raw]
        .filter(Boolean).join(" ").toLowerCase()
      return haystack.includes(q)
    }
    const searched = discrepancies.filter(matchesSearch)
    return {
      all: searched.length,
      open: searched.filter(d => d.status === "open").length,
      closed: searched.filter(d => d.status === "closed").length,
      review: searched.filter(d => d.import_confidence === "medium").length,
    }
  }, [discrepancies, searchQuery])

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (selectedRecord) setSelectedRecord(null)
      else if (searchQuery) setSearchQuery("")
      else onBack()
    }
  }, [selectedRecord, searchQuery, onBack])

  useEffect(() => {
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [handleEsc])

  if (selectedRecord) {
    return <DiscrepancyDetail d={selectedRecord} onBack={() => setSelectedRecord(null)} />
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Back + header */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity self-start" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}>
        <ArrowLeft className="w-4 h-4" /> Back to fleet
        <kbd className="text-[9px] px-1 py-0.5 rounded ml-1" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(212,160,23,0.5)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1, fontFamily: "var(--font-heading)" }}>esc</kbd>
      </button>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2
            style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", letterSpacing: "0.08em", color: "var(--skyshare-gold)", lineHeight: 1 }}
          >
            {aircraft.tailNumber}
          </h2>
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {aircraft.model} · S/N {aircraft.serialNumber}
          </span>
        </div>

        {/* Stats bar — right side */}
        {stats && (
          <div className="flex items-end gap-6">
            {stats.suspectedRepeatPct !== null && (
              <div className="text-right">
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.4rem",
                    letterSpacing: "0.04em",
                    color: stats.suspectedRepeatPct > 20 ? "rgba(255,165,0,0.85)" : stats.suspectedRepeatPct > 10 ? "var(--skyshare-gold)" : "rgba(100,220,100,0.8)",
                    lineHeight: 1,
                  }}
                >
                  {stats.suspectedRepeatPct.toFixed(0)}%
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <span className="text-[9px] uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
                    Suspected Repeats
                  </span>
                  <span
                    className="text-[8px] font-semibold uppercase px-1 py-0.5 rounded"
                    style={{
                      background: "rgba(138,43,226,0.15)",
                      color: "rgba(178,102,255,0.9)",
                      letterSpacing: "0.08em",
                      lineHeight: 1,
                    }}
                  >
                    beta
                  </span>
                </div>
              </div>
            )}
            {stats.avgTurnaroundDays !== null && (
              <div className="text-right">
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.4rem",
                    letterSpacing: "0.04em",
                    color: stats.avgTurnaroundDays <= 2 ? "rgba(100,220,100,0.8)" : stats.avgTurnaroundDays <= 7 ? "var(--skyshare-gold)" : "rgba(255,165,0,0.85)",
                    lineHeight: 1,
                  }}
                >
                  {stats.avgTurnaroundDays.toFixed(1)}d
                </div>
                <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
                  Avg Turnaround
                </div>
              </div>
            )}
            <div className="text-right">
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.4rem",
                  letterSpacing: "0.04em",
                  color: stats.hoursPerDiscrep >= 100 ? "rgba(100,220,100,0.8)" : stats.hoursPerDiscrep >= 30 ? "var(--skyshare-gold)" : "rgba(255,165,0,0.85)",
                  lineHeight: 1,
                }}
              >
                {stats.hoursPerDiscrep.toFixed(1)}h
              </div>
              <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
                Hrs / Discrep
              </div>
            </div>
            <div className="text-right">
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.4rem",
                  letterSpacing: "0.04em",
                  color: "hsl(var(--foreground))",
                  lineHeight: 1,
                  opacity: 0.85,
                }}
              >
                {stats.totalHours.toLocaleString()}
              </div>
              <div className="text-[9px] uppercase tracking-widest mt-1" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
                Operated Hours
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search bar + view toggle */}
      {discrepancies && discrepancies.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {/* Search input */}
            <div
              className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    setExpandedYears(new Set(yearGroups.map(([y]) => y)))
                  }
                }}
                placeholder="Search discrepancies..."
                className="bg-transparent border-none outline-none text-sm flex-1"
                style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="hover:opacity-80">
                  <X className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div
              className="flex items-center rounded-lg overflow-hidden flex-shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                onClick={() => setCompact(false)}
                className="px-2.5 py-2 transition-colors"
                style={{
                  background: !compact ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.02)",
                  color: !compact ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                }}
                title="Detailed view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCompact(true)}
                className="px-2.5 py-2 transition-colors"
                style={{
                  background: compact ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.02)",
                  color: compact ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                  borderLeft: "1px solid rgba(255,255,255,0.08)",
                }}
                title="Compact view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-2">
            {(["all", "open", "closed", "review"] as const).map(s => {
              const labels = { all: "All", open: "Open", closed: "Closed", review: "Needs Review" }
              const count = statusCounts[s]
              const active = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors"
                  style={{
                    background: active ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.03)",
                    color: active ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                    border: active ? "1px solid rgba(212,160,23,0.3)" : "1px solid rgba(255,255,255,0.06)",
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {labels[s]} · {count}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      )}

      {/* Year-grouped list */}
      {yearGroups.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {filtered.length === discrepancies!.length
              ? `${filtered.length} discrepancies · newest first`
              : `${filtered.length} of ${discrepancies!.length} discrepancies`}
          </p>
          {yearGroups.map(([year, records]) => (
            <YearSection
              key={year}
              year={year}
              records={records}
              expanded={expandedYears.has(year)}
              onToggle={() => toggleYear(year)}
              compact={compact}
              hoursSinceLastMap={hoursSinceLastMap}
              onSelect={setSelectedRecord}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}

      {/* No results after filtering */}
      {discrepancies && discrepancies.length > 0 && filtered.length === 0 && (
        <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          No discrepancies match your search.
        </p>
      )}

      {/* Empty — no data at all */}
      {discrepancies && discrepancies.length === 0 && (
        <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          No discrepancy records imported for this aircraft yet.
        </p>
      )}
    </div>
  )
}

// ─── Aircraft Row ──────────────────────────────────────────────────────────────
function AircraftRow({ ac, count, onOpen }: { ac: AircraftBase; count: number; onOpen: (ac: AircraftBase) => void }) {
  return (
    <button
      onClick={() => onOpen(ac)}
      className="w-full flex items-center justify-between px-4 py-2.5 rounded-md text-left transition-all duration-200 ease-out hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.025)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: count > 0 ? "pointer" : "default",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)" }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.boxShadow = "none" }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.9rem",
            color: "var(--skyshare-gold)",
            letterSpacing: "0.1em",
            fontWeight: 600,
            minWidth: "5.5rem",
          }}
        >
          {ac.tailNumber}
        </span>
        <span
          className="text-xs truncate"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}
        >
          {ac.model}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          className="text-xs"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}
        >
          {ac.year}
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-widest"
          style={{
            background: count > 0 ? "rgba(212,160,23,0.12)" : "rgba(255,255,255,0.04)",
            color: count > 0 ? "var(--skyshare-gold)" : "rgba(255,255,255,0.2)",
            fontFamily: "var(--font-heading)",
          }}
        >
          {count > 0 ? `${count} records` : "No records"}
        </span>
        {count > 0 && <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(212,160,23,0.4)" }} />}
      </div>
    </button>
  )
}

// ─── Family Block ──────────────────────────────────────────────────────────────
function FamilyBlock({ label, aircraft, counts, onOpen }: { label: string; aircraft: AircraftBase[]; counts: Map<string, number>; onOpen: (ac: AircraftBase) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-1 mb-1">
        <div
          style={{
            width: 3,
            height: 12,
            borderRadius: 2,
            background: "rgba(212,160,23,0.4)",
            flexShrink: 0,
          }}
        />
        <span
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.7 }}
        >
          {label}
        </span>
        <span
          className="text-[10px]"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
        >
          · {aircraft.length}
        </span>
      </div>
      <div className="flex flex-col rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {aircraft.map(ac => (
          <AircraftRow key={ac.tailNumber} ac={ac} count={counts.get(ac.tailNumber) ?? 0} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

// ─── Manufacturer Section ──────────────────────────────────────────────────────
function ManufacturerSection({ group, counts, onOpen }: { group: ManufacturerGroup; counts: Map<string, number>; onOpen: (ac: AircraftBase) => void }) {
  const [open, setOpen] = useState(true)
  const total = group.families.reduce((s, f) => s + f.aircraft.length, 0)

  return (
    <div className="flex flex-col gap-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-3 w-full text-left py-2 px-1 group"
      >
        <ChevronRight
          className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
          style={{
            color: "rgba(212,160,23,0.5)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            letterSpacing: "0.07em",
            color: "hsl(var(--foreground))",
            lineHeight: 1,
          }}
          className="group-hover:opacity-80 transition-opacity"
        >
          {group.manufacturer}
        </h2>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            background: "rgba(212,160,23,0.1)",
            color: "var(--skyshare-gold)",
            fontFamily: "var(--font-heading)",
            letterSpacing: "0.06em",
          }}
        >
          {total}
        </span>
        <div
          style={{
            flex: 1,
            height: "1px",
            background: "linear-gradient(to right, rgba(212,160,23,0.2), transparent)",
            marginLeft: "0.5rem",
          }}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-5 pl-7 pt-3 pb-1">
          {group.families.map(f => (
            <FamilyBlock key={f.family} label={f.family} aircraft={f.aircraft} counts={counts} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {[1, 2].map(i => (
        <div key={i} className="flex flex-col gap-4">
          <div className="h-6 w-56 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex flex-col gap-1 pl-7">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-10 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function DiscrepancyIntelligence() {
  const { data: fleet, isLoading, isError } = useFleet()
  const { data: counts } = useDiscrepancyCounts()
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftBase | null>(null)

  const countMap = counts ?? new Map<string, number>()
  const totalRecords = Array.from(countMap.values()).reduce((s, n) => s + n, 0)
  const aircraftWithRecords = countMap.size

  // ── Discrepancy list view ──
  if (selectedAircraft) {
    return (
      <div className="flex flex-col gap-8 p-6">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            Discrepancy Intelligence
          </p>
        </div>
        <DiscrepancyListView aircraft={selectedAircraft} onBack={() => setSelectedAircraft(null)} />
      </div>
    )
  }

  // ── Fleet directory view ──
  return (
    <div className="flex flex-col gap-8 p-6">

      {/* Hero */}
      <div className="hero-area flex items-end justify-between">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            Maintenance Intelligence
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              letterSpacing: "0.08em",
              color: "hsl(var(--foreground))",
              lineHeight: 1,
            }}
          >
            Discrepancy Intelligence
          </h1>
        </div>
        <div className="text-right flex gap-6">
          {totalRecords > 0 && (
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2rem",
                  letterSpacing: "0.06em",
                  color: "var(--skyshare-gold)",
                  lineHeight: 1,
                }}
              >
                {totalRecords}
              </div>
              <div
                className="text-xs uppercase tracking-widest"
                style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
              >
                Records
              </div>
            </div>
          )}
          {aircraftWithRecords > 0 && (
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "2rem",
                  letterSpacing: "0.06em",
                  color: "hsl(var(--foreground))",
                  lineHeight: 1,
                  opacity: 0.7,
                }}
              >
                {aircraftWithRecords}
              </div>
              <div
                className="text-xs uppercase tracking-widest"
                style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
              >
                Aircraft
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Import notice */}
      <div
        className="flex items-start gap-3 rounded-lg px-4 py-3"
        style={{
          background: "rgba(212,160,23,0.06)",
          border: "1px solid rgba(212,160,23,0.15)",
        }}
      >
        <AlertCircle
          className="w-4 h-4 flex-shrink-0 mt-0.5"
          style={{ color: "rgba(212,160,23,0.7)" }}
        />
        <div className="flex flex-col gap-0.5">
          <p
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            {totalRecords > 0 ? "Import In Progress" : "Import Pending"}
          </p>
          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {totalRecords > 0
              ? `${totalRecords} records imported across ${aircraftWithRecords} aircraft. Additional aircraft and historical records are pending.`
              : "Historical discrepancy records have not been imported yet. The fleet roster below reflects all aircraft."}
          </p>
        </div>
      </div>

      {/* Fleet */}
      {isLoading && <LoadingSkeleton />}
      {isError && (
        <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          Failed to load fleet data.
        </p>
      )}
      {fleet && (
        <div className="flex flex-col gap-6">
          {fleet.map(group => (
            <ManufacturerSection key={group.manufacturer} group={group} counts={countMap} onOpen={setSelectedAircraft} />
          ))}
        </div>
      )}

    </div>
  )
}
