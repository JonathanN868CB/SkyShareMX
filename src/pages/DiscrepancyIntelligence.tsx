import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { ChevronRight, ChevronDown, AlertCircle, ArrowLeft, MapPin, Clock, Wrench, Search, List, LayoutGrid, X, Send, Award, Database, MessageSquare, CheckCircle, Trash2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Sparkles, Users, Check } from "lucide-react"
import { useFleet } from "./aircraft/useFleet"
import { useDiscrepancyCounts } from "./aircraft/useDiscrepancyCounts"
import { useFleetStats } from "./aircraft/useFleetStats"
import FleetStatsPanel from "./aircraft/FleetStatsPanel"
import { useAircraftDiscrepancies, type DiscrepancyRow } from "./aircraft/useAircraftDiscrepancies"
import type { AircraftBase, ManufacturerGroup } from "./aircraft/fleetData"
import { useAuth } from "@/features/auth"
import { supabase } from "@/lib/supabase"
import DiscrepancyImportPanel from "./discrepancy-import/DiscrepancyImportPanel"
import SyncAuditLog from "./discrepancy-import/SyncAuditLog"

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
type InterviewStatus = "none" | "assigned" | "in_progress" | "completed" | "reviewed" | "approved" | "rejected"

function InterviewBadge({ status }: { status: InterviewStatus }) {
  const colors: Record<string, { bg: string; fg: string; label: string }> = {
    none:        { bg: "rgba(255,255,255,0.04)", fg: "rgba(255,255,255,0.2)",  label: "no interview" },
    assigned:    { bg: "rgba(212,160,23,0.1)",   fg: "rgba(212,160,23,0.7)",   label: "assigned" },
    in_progress: { bg: "rgba(100,180,255,0.1)",  fg: "rgba(100,180,255,0.8)",  label: "interviewing" },
    completed:   { bg: "rgba(255,165,0,0.1)",    fg: "rgba(255,165,0,0.8)",    label: "needs review" },
    reviewed:    { bg: "rgba(138,43,226,0.1)",   fg: "rgba(178,130,255,0.85)", label: "reviewed" },
    approved:    { bg: "rgba(100,220,100,0.1)",  fg: "rgba(100,220,100,0.8)",  label: "archived" },
    rejected:    { bg: "rgba(255,100,100,0.08)", fg: "rgba(255,100,100,0.7)",  label: "rejected" },
  }
  const c = colors[status] || colors.none

  return (
    <span
      className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold"
      style={{ background: c.bg, color: c.fg }}
      title={`Interview: ${c.label}`}
    >
      <MessageSquare className="w-2.5 h-2.5" />
      {c.label}
    </span>
  )
}

function DiscrepancyCard({ d, hoursSinceLast, onSelect, searchQuery = "", interviewStatus = "none", selected = false, onToggleSelect }: { d: DiscrepancyRow; hoursSinceLast: number | null; onSelect: (d: DiscrepancyRow) => void; searchQuery?: string; interviewStatus?: InterviewStatus; selected?: boolean; onToggleSelect?: (id: string) => void }) {
  const date = d.found_at ? new Date(d.found_at) : null
  const signoff = d.signoff_date ? new Date(d.signoff_date) : null
  const daysOpen = date && signoff ? Math.round((signoff.getTime() - date.getTime()) / 86_400_000) : null

  return (
    <div
      className="flex items-stretch rounded-lg overflow-hidden transition-colors"
      style={{
        background: selected ? "rgba(212,160,23,0.06)" : "rgba(255,255,255,0.03)",
        border: selected ? "1px solid rgba(212,160,23,0.3)" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {onToggleSelect && (
        <button
          onClick={() => onToggleSelect(d.id)}
          className="flex items-center justify-center px-3 flex-shrink-0 transition-colors hover:brightness-125"
          style={{ background: selected ? "rgba(212,160,23,0.12)" : "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.06)" }}
          title={selected ? "Deselect" : "Select for bulk assign"}
        >
          <div
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
            style={{
              background: selected ? "var(--skyshare-gold)" : "transparent",
              border: selected ? "1px solid var(--skyshare-gold)" : "1px solid rgba(255,255,255,0.25)",
            }}
          >
            {selected && <Check className="w-2.5 h-2.5" style={{ color: "#000" }} />}
          </div>
        </button>
      )}
      <button
        onClick={() => onSelect(d)}
        className="flex-1 text-left px-4 py-3 transition-colors hover:brightness-110 min-w-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* ID + Title */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[11px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: "rgba(212,160,23,0.1)",
                color: "var(--skyshare-gold)",
                fontFamily: "'Courier Prime','Courier New',monospace",
              }}
            >
              <Hl text={d.jetinsight_discrepancy_id} q={searchQuery} />
            </span>
            {d.import_confidence === "medium" && (
              <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: "rgba(255,165,0,0.15)", color: "rgba(255,165,0,0.8)" }}>
                review
              </span>
            )}
            <InterviewBadge status={interviewStatus} />
          </div>
          <p
            className="text-base font-medium truncate"
            style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
          >
            <Hl text={d.title} q={searchQuery} />
          </p>
          {d.pilot_report && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
              <Hl text={d.pilot_report} q={searchQuery} />
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            {date && (
              <span className="flex items-center gap-1 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <Clock className="w-3 h-3" />
                {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
            {(d.location_icao || d.location_raw) && (
              <span className="flex items-center gap-1 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <MapPin className="w-3 h-3" />
                <Hl text={d.location_icao || d.location_raw || ""} q={searchQuery} />
              </span>
            )}
            {d.technician_name && (
              <span className="flex items-center gap-1 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <Wrench className="w-3 h-3" />
                <Hl text={d.technician_name + (d.company ? ` · ${d.company}` : "")} q={searchQuery} />
              </span>
            )}
            {d.airframe_hours != null && (
              <span className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
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
                className="text-base font-semibold"
                style={{ color: daysOpen <= 1 ? "rgba(100,220,100,0.8)" : daysOpen <= 7 ? "var(--skyshare-gold)" : "rgba(255,165,0,0.8)" }}
              >
                {daysOpen}d
              </div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                turnaround
              </div>
            </div>
          )}
          {hoursSinceLast !== null && (
            <div>
              <div
                className="text-base font-semibold"
                style={{ color: hoursSinceLast >= 100 ? "rgba(100,220,100,0.8)" : hoursSinceLast >= 20 ? "var(--skyshare-gold)" : "rgba(255,165,0,0.8)" }}
              >
                {hoursSinceLast.toFixed(1)}h
              </div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                since last
              </div>
            </div>
          )}
        </div>
      </div>
      </button>
    </div>
  )
}

// ─── Compact Row ─────────────────────────────────────────────────────────────
function CompactRow({ d, onSelect, searchQuery = "", interviewStatus = "none", selected = false, onToggleSelect }: { d: DiscrepancyRow; onSelect: (d: DiscrepancyRow) => void; searchQuery?: string; interviewStatus?: InterviewStatus; selected?: boolean; onToggleSelect?: (id: string) => void }) {
  const date = d.found_at ? new Date(d.found_at) : null
  return (
    <div
      className="flex items-center transition-colors"
      style={{
        background: selected ? "rgba(212,160,23,0.06)" : "rgba(255,255,255,0.02)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {onToggleSelect && (
        <button
          onClick={() => onToggleSelect(d.id)}
          className="flex items-center justify-center px-3 py-2 flex-shrink-0 self-stretch transition-colors hover:brightness-125"
          style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
          title={selected ? "Deselect" : "Select for bulk assign"}
        >
          <div
            className="w-3.5 h-3.5 rounded flex items-center justify-center"
            style={{
              background: selected ? "var(--skyshare-gold)" : "transparent",
              border: selected ? "1px solid var(--skyshare-gold)" : "1px solid rgba(255,255,255,0.25)",
            }}
          >
            {selected && <Check className="w-2 h-2" style={{ color: "#000" }} />}
          </div>
        </button>
      )}
      <button
        onClick={() => onSelect(d)}
        className="flex-1 flex items-center gap-3 px-3 py-1.5 text-left transition-colors hover:brightness-110 min-w-0"
      >
      <span
        className="text-[11px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
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
        <span className="text-[12px] flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))", minWidth: "5.5rem" }}>
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      )}
      <span
        className="text-sm truncate flex-1"
        style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
      >
        <Hl text={d.title} q={searchQuery} />
      </span>
      <InterviewBadge status={interviewStatus} />
      <span
        className="text-[10px] uppercase tracking-widest flex-shrink-0 px-1.5 py-0.5 rounded"
        style={{
          color: d.status === "open" ? "rgba(255,165,0,0.8)" : "rgba(100,220,100,0.7)",
          background: d.status === "open" ? "rgba(255,165,0,0.08)" : "rgba(100,220,100,0.06)",
          fontFamily: "var(--font-heading)",
        }}
      >
        {d.status}
      </span>
      </button>
    </div>
  )
}



// ─── Interview This Event Button (dropdown) ─────────────────────────────────
function InterviewThisEventButton({
  discrepancyId,
  discrepancyTitle,
  tailNumber,
  profileId,
  assignerName,
  assignments,
  onAssigned,
  onStartInterview,
}: {
  discrepancyId: string
  discrepancyTitle: string
  tailNumber: string
  profileId?: string
  assignerName: string
  assignments: Array<{ id: string; status: string; assigned_to: string }>
  onAssigned: () => void
  onStartInterview: (assignmentId: string, discrepancyId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [technicians, setTechnicians] = useState<Array<{ id: string; full_name: string; email: string }>>([])
  const [domNote, setDomNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  // Fetch technicians when opened
  useEffect(() => {
    if (!open || technicians.length > 0) return
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("status", "Active")
      .in("role", ["Technician", "Manager", "Admin", "Super Admin"])
      .order("full_name")
      .then(({ data }) => {
        if (data) setTechnicians(data.filter((t) => t.full_name) as Array<{ id: string; full_name: string; email: string }>)
      })
  }, [open])

  async function handleSelect(techId: string) {
    if (!profileId || submitting) return
    setSubmitting(true)

    // Check if there's already an active assignment for this person
    const existing = assignments.find(
      (a) => a.assigned_to === techId && (a.status === "assigned" || a.status === "in_progress"),
    )

    if (existing) {
      // If it's me, jump straight into the interview
      if (techId === profileId) {
        onStartInterview(existing.id, discrepancyId)
      }
      setOpen(false)
      setSubmitting(false)
      return
    }

    // Create assignment
    const { data: newAssignment, error } = await supabase
      .from("interview_assignments")
      .insert({
        discrepancy_id: discrepancyId,
        assigned_to: techId,
        assigned_by: profileId,
        dom_note: domNote.trim() || null,
      })
      .select("id")
      .single()

    if (!error && newAssignment) {
      onAssigned()

      // Send interview notification email
      const tech = technicians.find((t) => t.id === techId)
      if (tech?.email) {
        fetch("/.netlify/functions/send-interview-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianEmail: tech.email,
            technicianName: tech.full_name,
            assignerName,
            discrepancyTitle,
            tailNumber,
            domNote: domNote.trim() || null,
          }),
        }).catch(() => {}) // fire-and-forget
      }

      // If I selected myself, start immediately
      if (techId === profileId) {
        onStartInterview(newAssignment.id, discrepancyId)
      }
    }

    setOpen(false)
    setDomNote("")
    setSubmitting(false)
  }

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md transition-all hover:brightness-125"
        style={{
          background: "rgba(212,160,23,0.12)",
          color: "var(--skyshare-gold)",
          border: "1px solid rgba(212,160,23,0.3)",
        }}
      >
        <MessageSquare size={13} />
        Interview This Event
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-72 rounded-lg border shadow-2xl z-50 overflow-hidden"
          style={{ background: "#161616", borderColor: "rgba(255,255,255,0.1)" }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--skyshare-gold)" }}>
              Assign to
            </p>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {technicians.length === 0 ? (
              <p className="text-sm text-white/30 px-3 py-3">Loading...</p>
            ) : (
              technicians.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  disabled={submitting}
                  className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 transition-colors flex items-center justify-between disabled:opacity-40"
                >
                  <span>{t.full_name}</span>
                  {t.id === profileId && (
                    <span className="text-[9px] uppercase tracking-widest px-1 py-0.5 rounded" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.1)" }}>
                      me
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <input
              type="text"
              value={domNote}
              onChange={(e) => setDomNote(e.target.value)}
              placeholder="Note for technician (optional)"
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-[#d4a017]/50"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Discrepancy Detail ───────────────────────────────────────────────────────
function DiscrepancyDetail({ d, tailNumber, onBack, onStartInterview, onReviewInterview }: { d: DiscrepancyRow; tailNumber: string; onBack: () => void; onStartInterview?: (assignmentId: string, discrepancyId: string) => void; onReviewInterview?: (assignmentId: string, discrepancyId: string) => void }) {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === "Super Admin"
  const date = d.found_at ? new Date(d.found_at) : null
  const signoff = d.signoff_date ? new Date(d.signoff_date) : null
  const fmt = (dt: Date) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })

  const [assignments, setAssignments] = useState<Array<{ id: string; status: string; assigned_to: string; profiles: { full_name: string } | null }>>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Load existing assignments for this discrepancy
  useEffect(() => {
    supabase
      .from("interview_assignments")
      .select("id, status, assigned_to, profiles:assigned_to(full_name)")
      .eq("discrepancy_id", d.id)
      .then(({ data }) => {
        if (data) setAssignments(data as typeof assignments)
      })
  }, [d.id])

  function refreshAssignments() {
    supabase
      .from("interview_assignments")
      .select("id, status, assigned_to, profiles:assigned_to(full_name)")
      .eq("discrepancy_id", d.id)
      .then(({ data }) => {
        if (data) setAssignments(data as typeof assignments)
      })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-base font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity self-start" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}>
        <ArrowLeft className="w-4 h-4" /> Back to list
        <kbd className="text-[10px] px-1 py-0.5 rounded ml-1" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(212,160,23,0.5)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1, fontFamily: "var(--font-heading)" }}>esc</kbd>
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span
            className="text-[12px] px-2 py-0.5 rounded font-medium"
            style={{ background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)", fontFamily: "'Courier Prime','Courier New',monospace" }}
          >
            {d.jetinsight_discrepancy_id}
          </span>
          <h2
            className="mt-2"
            style={{ fontFamily: "var(--font-display)", fontSize: "1.55rem", letterSpacing: "0.06em", color: "hsl(var(--foreground))", lineHeight: 1.2 }}
          >
            {d.title}
          </h2>
        </div>
        {/* Interview This Event — dropdown to pick assignee (Super Admin only) */}
        {isSuperAdmin && onStartInterview && (
          <InterviewThisEventButton
            discrepancyId={d.id}
            discrepancyTitle={d.title}
            tailNumber={tailNumber}
            profileId={profile?.id}
            assignerName={profile?.full_name || "SkyShare MX"}
            assignments={assignments}
            onAssigned={refreshAssignments}
            onStartInterview={onStartInterview}
          />
        )}
      </div>

      {/* Pilot Report */}
      {d.pilot_report && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Pilot Report
          </h3>
          <p className="text-base" style={{ color: "hsl(var(--foreground))", lineHeight: 1.6 }}>{d.pilot_report}</p>
        </div>
      )}

      {/* Corrective Action */}
      {d.corrective_action && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Corrective Action
          </h3>
          <p className="text-base" style={{ color: "hsl(var(--foreground))", lineHeight: 1.6 }}>{d.corrective_action}</p>
        </div>
      )}

      {/* AMM References */}
      {d.amm_references && d.amm_references.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            References
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {d.amm_references.map((ref, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded"
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
        <p className="text-[12px] italic" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
          Import note: {d.import_notes}
        </p>
      )}

      {/* Interview section */}
      <div
        className="rounded-lg px-4 py-3"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="mb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Mechanic Interviews
          </h3>
        </div>

        {assignments.length === 0 ? (
          <p className="text-sm text-white/30">No interviews assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {assignments.map((a) => {
              const isMyAssignment = profile && a.assigned_to === profile.id
              const canStart = (isMyAssignment || isSuperAdmin) && (a.status === "assigned" || a.status === "in_progress")
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between px-3 py-2 rounded"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <span className="text-sm text-white/70">
                    {a.profiles?.full_name || "Unknown"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        color:
                          a.status === "completed" || a.status === "reviewed"
                            ? "rgba(100,220,100,0.8)"
                            : a.status === "in_progress"
                              ? "rgba(100,180,255,0.8)"
                              : "var(--skyshare-gold)",
                        background:
                          a.status === "completed" || a.status === "reviewed"
                            ? "rgba(100,220,100,0.08)"
                            : a.status === "in_progress"
                              ? "rgba(100,180,255,0.08)"
                              : "rgba(212,160,23,0.08)",
                      }}
                    >
                      {a.status}
                    </span>
                    {canStart && onStartInterview && (
                      <button
                        onClick={() => onStartInterview(a.id, d.id)}
                        className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold transition-all hover:brightness-125"
                        style={{
                          color: "var(--skyshare-gold)",
                          background: "rgba(212,160,23,0.12)",
                          border: "1px solid rgba(212,160,23,0.25)",
                        }}
                      >
                        {a.status === "in_progress" ? "Resume" : "Start"}
                      </button>
                    )}
                    {isSuperAdmin && a.status === "completed" && onReviewInterview && (
                      <button
                        onClick={() => onReviewInterview(a.id, d.id)}
                        className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold transition-all hover:brightness-125"
                        style={{
                          color: "rgba(100,180,255,0.9)",
                          background: "rgba(100,180,255,0.1)",
                          border: "1px solid rgba(100,180,255,0.2)",
                        }}
                      >
                        Review
                      </button>
                    )}
                    {isSuperAdmin && (a.status === "assigned" || a.status === "in_progress") && (
                      confirmDeleteId === a.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={async () => {
                              const { error } = await supabase.from("interview_assignments").delete().eq("id", a.id)
                              if (!error) refreshAssignments()
                              setConfirmDeleteId(null)
                            }}
                            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold transition-all hover:brightness-125"
                            style={{
                              color: "rgba(255,100,100,0.9)",
                              background: "rgba(255,100,100,0.12)",
                              border: "1px solid rgba(255,100,100,0.3)",
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold text-white/40 hover:text-white/70 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(a.id)}
                          className="flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold transition-all hover:brightness-125"
                          style={{
                            color: "rgba(255,100,100,0.7)",
                            background: "rgba(255,100,100,0.08)",
                            border: "1px solid rgba(255,100,100,0.15)",
                          }}
                          title="Remove assignment"
                        >
                          <Trash2 size={11} />
                          Delete
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)" }}>
        {label}
      </div>
      <div className="text-sm mt-0.5" style={{ color: value ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
        {value || "—"}
      </div>
    </div>
  )
}

// ─── Year Section ─────────────────────────────────────────────────────────────
function YearSection({
  year, records, expanded, onToggle, compact, hoursSinceLastMap, onSelect, searchQuery = "", interviewStatusMap, selectedIds, onToggleSelect,
}: {
  year: string; records: DiscrepancyRow[]; expanded: boolean; onToggle: () => void
  compact: boolean; hoursSinceLastMap: Map<string, number | null>; onSelect: (d: DiscrepancyRow) => void; searchQuery?: string; interviewStatusMap: Map<string, InterviewStatus>
  selectedIds?: Set<string>; onToggleSelect?: (id: string) => void
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
            fontSize: "1.35rem",
            letterSpacing: "0.07em",
            color: "hsl(var(--foreground))",
            lineHeight: 1,
          }}
        >
          {year}
        </span>
        <span
          className="text-[11px] font-medium px-2.5 py-1 rounded"
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
              ? <CompactRow key={d.id} d={d} onSelect={onSelect} searchQuery={searchQuery} interviewStatus={interviewStatusMap.get(d.id) || "none"} selected={selectedIds?.has(d.id)} onToggleSelect={onToggleSelect} />
              : <DiscrepancyCard key={d.id} d={d} hoursSinceLast={hoursSinceLastMap.get(d.id) ?? null} onSelect={onSelect} searchQuery={searchQuery} interviewStatus={interviewStatusMap.get(d.id) || "none"} selected={selectedIds?.has(d.id)} onToggleSelect={onToggleSelect} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Discrepancy List View ────────────────────────────────────────────────────
function DiscrepancyListView({ aircraft, onBack, onStartInterview, onReviewInterview }: { aircraft: AircraftBase; onBack: () => void; onStartInterview?: (assignmentId: string, discrepancyId: string) => void; onReviewInterview?: (assignmentId: string, discrepancyId: string) => void }) {
  const { data: discrepancies, isLoading } = useAircraftDiscrepancies(aircraft.tailNumber)
  const { profile } = useAuth()
  const [selectedRecord, setSelectedRecord] = useState<DiscrepancyRow | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed" | "review">("all")
  const [compact, setCompact] = useState(false)
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const [interviewStatusMap, setInterviewStatusMap] = useState<Map<string, InterviewStatus>>(new Map())

  // ── Bulk selection ────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkTechId, setBulkTechId] = useState("")
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [bulkTechnicians, setBulkTechnicians] = useState<Array<{ id: string; full_name: string; email: string }>>([])

  // Load technicians once when bulk selection first opens
  useEffect(() => {
    if (selectedIds.size === 0 || bulkTechnicians.length > 0) return
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("status", "Active")
      .in("role", ["Technician", "Manager", "Admin", "Super Admin"])
      .order("full_name")
      .then(({ data }) => {
        if (data) setBulkTechnicians(data.filter(t => t.full_name) as typeof bulkTechnicians)
      })
  }, [selectedIds.size, bulkTechnicians.length])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filtered.map(d => d.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setBulkTechId("")
  }

  async function handleBulkAssign() {
    if (!bulkTechId || selectedIds.size === 0 || !profile?.id || bulkAssigning) return
    setBulkAssigning(true)
    const tech = bulkTechnicians.find(t => t.id === bulkTechId)
    const rows = [...selectedIds].map(discrepancyId => ({
      discrepancy_id: discrepancyId,
      assigned_to: bulkTechId,
      assigned_by: profile.id,
      dom_note: null,
    }))
    await supabase.from("interview_assignments").insert(rows)
    // Fire notification emails (best-effort)
    if (tech?.email) {
      for (const discrepancyId of selectedIds) {
        const d = discrepancies?.find(r => r.id === discrepancyId)
        if (!d) continue
        fetch("/.netlify/functions/send-interview-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technicianEmail: tech.email,
            technicianName: tech.full_name,
            assignerName: profile.full_name || "SkyShare MX",
            discrepancyTitle: d.title,
            tailNumber: aircraft.tailNumber,
            domNote: null,
          }),
        }).catch(() => {})
      }
    }
    clearSelection()
    // Refresh badge statuses
    if (discrepancies && discrepancies.length > 0) {
      const ids = discrepancies.map(d => d.id)
      Promise.all([
        supabase.from("interview_assignments").select("discrepancy_id, status").in("discrepancy_id", ids),
        supabase.from("discrepancy_enrichments").select("discrepancy_id, status").in("discrepancy_id", ids),
      ]).then(([assignRes, enrichRes]) => {
        const priority: Record<string, number> = { assigned: 1, in_progress: 2, completed: 3, reviewed: 4, approved: 5, rejected: 5 }
        const map = new Map<string, InterviewStatus>()
        for (const row of (assignRes.data || [])) {
          const current = map.get(row.discrepancy_id)
          const currentPri = current ? (priority[current] || 0) : 0
          const newPri = priority[row.status] || 0
          if (newPri > currentPri) map.set(row.discrepancy_id, row.status as InterviewStatus)
        }
        for (const row of (enrichRes.data || [])) {
          if (row.status === "approved" || row.status === "rejected") {
            map.set(row.discrepancy_id, row.status as InterviewStatus)
          }
        }
        setInterviewStatusMap(map)
      })
    }
    setBulkAssigning(false)
  }

  // ── Fetch interview statuses for all discrepancies ──
  useEffect(() => {
    if (!discrepancies || discrepancies.length === 0) return
    const ids = discrepancies.map(d => d.id)

    // Fetch both assignment statuses and enrichment statuses
    Promise.all([
      supabase.from("interview_assignments").select("discrepancy_id, status").in("discrepancy_id", ids),
      supabase.from("discrepancy_enrichments").select("discrepancy_id, status").in("discrepancy_id", ids),
    ]).then(([assignRes, enrichRes]) => {
      const priority: Record<string, number> = { assigned: 1, in_progress: 2, completed: 3, reviewed: 4, approved: 5, rejected: 5 }
      const map = new Map<string, InterviewStatus>()

      // Process assignment statuses
      for (const row of (assignRes.data || [])) {
        const current = map.get(row.discrepancy_id)
        const currentPri = current ? (priority[current] || 0) : 0
        const newPri = priority[row.status] || 0
        if (newPri > currentPri) map.set(row.discrepancy_id, row.status as InterviewStatus)
      }

      // Enrichment statuses can override (approved/rejected are final states)
      for (const row of (enrichRes.data || [])) {
        if (row.status === "approved" || row.status === "rejected") {
          map.set(row.discrepancy_id, row.status as InterviewStatus)
        }
      }

      setInterviewStatusMap(map)
    })
  }, [discrepancies])

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
    return <DiscrepancyDetail d={selectedRecord} tailNumber={aircraft.tailNumber} onBack={() => setSelectedRecord(null)} onStartInterview={onStartInterview} onReviewInterview={onReviewInterview} />
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Back + header */}
      <button onClick={onBack} className="flex items-center gap-2 text-base font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity self-start" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}>
        <ArrowLeft className="w-4 h-4" /> Back to fleet
        <kbd className="text-[10px] px-1 py-0.5 rounded ml-1" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(212,160,23,0.5)", border: "1px solid rgba(255,255,255,0.08)", lineHeight: 1, fontFamily: "var(--font-heading)" }}>esc</kbd>
      </button>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2
            style={{ fontFamily: "var(--font-display)", fontSize: "1.65rem", letterSpacing: "0.08em", color: "var(--skyshare-gold)", lineHeight: 1 }}
          >
            {aircraft.tailNumber}
          </h2>
          <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
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
                    fontSize: "1.55rem",
                    letterSpacing: "0.04em",
                    color: stats.suspectedRepeatPct > 20 ? "rgba(255,165,0,0.85)" : stats.suspectedRepeatPct > 10 ? "var(--skyshare-gold)" : "rgba(100,220,100,0.8)",
                    lineHeight: 1,
                  }}
                >
                  {stats.suspectedRepeatPct.toFixed(0)}%
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
                    Suspected Repeats
                  </span>
                  <span
                    className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded"
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
                    fontSize: "1.55rem",
                    letterSpacing: "0.04em",
                    color: stats.avgTurnaroundDays <= 2 ? "rgba(100,220,100,0.8)" : stats.avgTurnaroundDays <= 7 ? "var(--skyshare-gold)" : "rgba(255,165,0,0.85)",
                    lineHeight: 1,
                  }}
                >
                  {stats.avgTurnaroundDays.toFixed(1)}d
                </div>
                <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
                  Avg Turnaround
                </div>
              </div>
            )}
            <div className="text-right">
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.55rem",
                  letterSpacing: "0.04em",
                  color: stats.hoursPerDiscrep >= 100 ? "rgba(100,220,100,0.8)" : stats.hoursPerDiscrep >= 30 ? "var(--skyshare-gold)" : "rgba(255,165,0,0.85)",
                  lineHeight: 1,
                }}
              >
                {stats.hoursPerDiscrep.toFixed(1)}h
              </div>
              <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
                Hrs / Discrep
              </div>
            </div>
            <div className="text-right">
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.55rem",
                  letterSpacing: "0.04em",
                  color: "hsl(var(--foreground))",
                  lineHeight: 1,
                  opacity: 0.85,
                }}
              >
                {stats.totalHours.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
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
                className="bg-transparent border-none outline-none text-base flex-1"
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
                  className="text-[12px] px-2.5 py-1 rounded-full font-medium transition-colors"
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

      {/* Bulk assign bar */}
      {selectedIds.size > 0 && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg flex-wrap"
          style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.28)" }}
        >
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 flex-shrink-0" style={{ color: "var(--skyshare-gold)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
              {selectedIds.size} selected
            </span>
            {selectedIds.size < filtered.length && (
              <button
                onClick={selectAllVisible}
                className="text-[11px] px-2 py-0.5 rounded transition-colors hover:brightness-125"
                style={{ color: "rgba(212,160,23,0.7)", background: "rgba(212,160,23,0.1)", fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
              >
                Select all {filtered.length}
              </button>
            )}
            <button
              onClick={clearSelection}
              className="text-[11px] px-2 py-0.5 rounded transition-colors hover:brightness-125"
              style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)", fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={bulkTechId}
              onChange={e => setBulkTechId(e.target.value)}
              className="text-[12px] px-2 py-1.5 rounded outline-none"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: bulkTechId ? "hsl(var(--foreground))" : "rgba(255,255,255,0.35)",
                fontFamily: "var(--font-heading)",
                minWidth: "10rem",
              }}
            >
              <option value="">Assign to…</option>
              {bulkTechnicians.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name}{t.id === profile?.id ? " (me)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkTechId || bulkAssigning}
              className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest px-3 py-2 rounded-md transition-all hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "rgba(212,160,23,0.18)", color: "var(--skyshare-gold)", border: "1px solid rgba(212,160,23,0.35)", fontFamily: "var(--font-heading)" }}
            >
              <MessageSquare size={12} />
              {bulkAssigning ? "Assigning…" : `Assign ${selectedIds.size}`}
            </button>
          </div>
        </div>
      )}

      {/* Year-grouped list */}
      {yearGroups.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
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
              interviewStatusMap={interviewStatusMap}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* No results after filtering */}
      {discrepancies && discrepancies.length > 0 && filtered.length === 0 && (
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          No discrepancies match your search.
        </p>
      )}

      {/* Empty — no data at all */}
      {discrepancies && discrepancies.length === 0 && (
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
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
            fontSize: "1rem",
            color: "var(--skyshare-gold)",
            letterSpacing: "0.1em",
            fontWeight: 600,
            minWidth: "5.5rem",
          }}
        >
          {ac.tailNumber}
        </span>
        <span
          className="text-sm truncate"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}
        >
          {ac.model}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span
          className="text-sm"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}
        >
          {ac.year}
        </span>
        <span
          className="text-[11px] px-2 py-0.5 rounded font-medium uppercase tracking-widest"
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
          className="text-[12px] font-semibold uppercase tracking-widest"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.7 }}
        >
          {label}
        </span>
        <span
          className="text-[11px]"
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
            fontSize: "1.4rem",
            letterSpacing: "0.07em",
            color: "hsl(var(--foreground))",
            lineHeight: 1,
          }}
          className="group-hover:opacity-80 transition-opacity"
        >
          {group.manufacturer}
        </h2>
        <span
          className="text-sm font-medium px-2 py-0.5 rounded"
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

// ─── DW1GHT Intel Chat Panel ─────────────────────────────────────────────────
type IntelMessage = { role: "user" | "assistant"; content: string; fromData?: boolean; resultCount?: number }

function Dw1ghtIntelPanel({ open, onClose, mode, onModeChange }: { open: boolean; onClose: () => void; mode: "schrute" | "corporate" | "troubleshooting"; onModeChange: (m: "schrute" | "corporate" | "troubleshooting") => void }) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<IntelMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 })
  const setMode = onModeChange
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sessionCost = (sessionTokens.input * 0.0000008) + (sessionTokens.output * 0.000004)
  const costDisplay = sessionCost < 0.0001 ? "<$0.0001" : `$${sessionCost.toFixed(4)}`

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: IntelMessage[] = [...messages, { role: "user", content: text }]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/.netlify/functions/dw1ght-intel-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode,
          history: newMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setMessages([...newMessages, {
        role: "assistant",
        content: data.reply ?? "...",
        fromData: data.sqlGenerated === true,
        resultCount: data.resultCount,
      }])
      if (data.usage) {
        setSessionTokens(prev => ({
          input: prev.input + (data.usage.input_tokens ?? 0),
          output: prev.output + (data.usage.output_tokens ?? 0),
        }))
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Intelligence retrieval failed. I am filing an incident report with Jonathan. This is unacceptable." },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
    <div
      className="flex flex-col shadow-2xl rounded-xl overflow-hidden"
      style={{
        width: "80%",
        height: "70%",
        minHeight: "60vh",
        maxHeight: "85vh",
        background: "hsl(var(--card))",
        border: "1px solid rgba(212,160,23,0.2)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.2)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(212,160,23,0.12)", border: "1.5px solid rgba(212,160,23,0.3)" }}
          >
            <Award className="w-4 h-4" style={{ color: "var(--skyshare-gold)" }} />
          </div>
          <span
            className="text-sm font-bold tracking-widest uppercase"
            style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)" }}
          >
            DW1GHT Intelligence
          </span>
        </div>
        <div className="flex items-center gap-3">
          {sessionTokens.input + sessionTokens.output > 0 && (
            <span
              className="text-[11px] tabular-nums"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", opacity: 0.6 }}
            >
              {costDisplay}
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setSessionTokens({ input: 0, output: 0 }) }}
              className="text-[10px] tracking-widest uppercase hover:opacity-80 transition-opacity"
              style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="hover:opacity-70 transition-opacity"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <span className="text-2xl select-none">🌱</span>
            <p
              className="text-base leading-relaxed"
              style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-display)", fontStyle: "italic", maxWidth: "420px" }}
            >
              "I have analyzed every discrepancy in this fleet. Personally. Ask me anything."
            </p>
            <p
              className="text-[10px] tracking-widest uppercase"
              style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.4 }}
            >
              — DW1GHT, Intelligence Division
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
              {[
                "How many discrepancies this year?",
                "Top 3 repeat issues on N863CB",
                "Which tech has the most signoffs?",
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="text-[11px] px-2 py-1 rounded-md transition-colors hover:brightness-125"
                  style={{
                    background: "rgba(212,160,23,0.08)",
                    color: "var(--skyshare-gold)",
                    border: "1px solid rgba(212,160,23,0.15)",
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className="flex-shrink-0 mt-1">
              {m.role === "assistant" ? (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(212,160,23,0.15)", border: "1px solid rgba(212,160,23,0.3)" }}
                >
                  <Award className="w-2.5 h-2.5" style={{ color: "var(--skyshare-gold)" }} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-muted border border-border">
                  <span className="text-[8px] text-muted-foreground font-medium">you</span>
                </div>
              )}
            </div>
            <div className={`max-w-[70%] flex flex-col gap-0.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
              {m.role === "assistant" && (
                <div className="flex items-center gap-1.5 px-0.5">
                  <span
                    className="text-[9px] font-bold tracking-widest uppercase"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", opacity: 0.8 }}
                  >
                    DW1GHT
                  </span>
                  {m.fromData && (
                    <span
                      className="flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded-full"
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        color: "rgba(100,170,255,0.9)",
                        fontFamily: "var(--font-heading)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      <Database className="w-2 h-2" />
                      {m.resultCount != null ? `${m.resultCount} rec` : "queried"}
                    </span>
                  )}
                </div>
              )}
              <div
                className="rounded-lg px-3 py-2 text-[14px] leading-relaxed"
                style={{
                  ...(m.role === "user"
                    ? {
                        background: "rgba(212,160,23,0.12)",
                        border: "1px solid rgba(212,160,23,0.25)",
                        borderBottomRightRadius: "4px",
                        color: "hsl(var(--foreground))",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderBottomLeftRadius: "4px",
                        color: "hsl(var(--foreground))",
                      }),
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
              style={{ background: "rgba(212,160,23,0.15)", border: "1px solid rgba(212,160,23,0.3)" }}
            >
              <Award className="w-2.5 h-2.5" style={{ color: "var(--skyshare-gold)" }} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className="text-[9px] font-bold tracking-widest uppercase px-0.5"
                style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", opacity: 0.8 }}
              >
                DW1GHT
              </span>
              <div
                className="rounded-lg px-3 py-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderBottomLeftRadius: "4px" }}
              >
                <div className="flex gap-1.5 items-center h-4">
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(212,160,23,0.4)", animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(212,160,23,0.4)", animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(212,160,23,0.4)", animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 flex gap-2 items-center flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask DW1GHT about your fleet data..."
          className="flex-1 bg-transparent border rounded-lg px-3 py-2.5 text-base focus:outline-none transition-colors"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            color: "hsl(var(--foreground))",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="flex items-center justify-center w-9 h-9 rounded-lg transition-all disabled:opacity-25"
          style={{
            background: input.trim() && !loading ? "rgba(212,160,23,0.12)" : "transparent",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--skyshare-gold)",
          }}
        >
          <Send size={14} />
        </button>
      </div>

      {/* Mode indicator */}
      <div
        className="flex items-center justify-center px-4 py-1.5 flex-shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.1)" }}
      >
        <span
          className="text-[9px] font-bold tracking-[0.15em] uppercase"
          style={{
            fontFamily: "var(--font-heading)",
            color: mode === "schrute" ? "var(--skyshare-gold)" : mode === "corporate" ? "rgba(100,170,255,0.7)" : "rgba(100,220,100,0.7)",
            opacity: 0.6,
          }}
        >
          {mode === "schrute" ? "Full Schrute Mode" : mode === "corporate" ? "Corporate Mode" : "Troubleshooting Mode"}
        </span>
      </div>
    </div>
    </div>
  )
}

// ─── DOM Review View ─────────────────────────────────────────────────────────
type SuggestedCorrection = {
  field: string
  original: string
  suggested: string
  reason: string
}

function DomReviewView({
  assignmentId,
  discrepancyId,
  onBack,
  readOnly = false,
}: {
  assignmentId: string
  discrepancyId: string
  onBack: () => void
  readOnly?: boolean
}) {
  const { profile } = useAuth()
  const [enrichment, setEnrichment] = useState<{
    id: string
    narrative_summary: string | null
    golden_nuggets: string | null
    suggested_corrections: SuggestedCorrection[]
    raw_transcript: Array<{ role: string; content: string; timestamp?: string }>
    structured_data: Record<string, unknown> | null
    interviewee_name: string | null
    session_started_at: string | null
    session_completed_at: string | null
    status: string
  } | null>(null)
  const [discrepancy, setDiscrepancy] = useState<{ title: string; registration_at_event: string | null; jetinsight_discrepancy_id: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [correctionStates, setCorrectionStates] = useState<Map<number, "pending" | "accepted" | "rejected" | "editing">>(new Map())
  const [editValues, setEditValues] = useState<Map<number, string>>(new Map())
  const [reviewNotes, setReviewNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [critiqueSuggestions, setCritiqueSuggestions] = useState<Array<{
    id: string
    section_key: string
    change_type: string
    suggested_text: string
    reasoning: string | null
    created_at: string
  }>>([])
  const [refiring, setRefiring] = useState(false)
  const [refireMessage, setRefireMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [pushingToInbox, setPushingToInbox] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // Get enrichment for this assignment's discrepancy
      const { data: enrichments } = await supabase
        .from("discrepancy_enrichments")
        .select("id, narrative_summary, golden_nuggets, suggested_corrections, raw_transcript, structured_data, interviewee_name, session_started_at, session_completed_at, status")
        .eq("discrepancy_id", discrepancyId)
        .in("status", ["completed", "reviewed", "approved", "rejected"])
        .order("session_completed_at", { ascending: false })
        .limit(1)

      if (enrichments && enrichments.length > 0) {
        const e = enrichments[0]
        setEnrichment({
          ...e,
          suggested_corrections: Array.isArray(e.suggested_corrections) ? e.suggested_corrections as SuggestedCorrection[] : [],
          raw_transcript: Array.isArray(e.raw_transcript) ? e.raw_transcript as Array<{ role: string; content: string; timestamp?: string }> : [],
          structured_data: e.structured_data as Record<string, unknown> | null,
        })
      }

      const { data: disc } = await supabase
        .from("discrepancies")
        .select("title, registration_at_event, jetinsight_discrepancy_id")
        .eq("id", discrepancyId)
        .single()
      if (disc) setDiscrepancy(disc)

      setLoading(false)
    }
    load()
  }, [discrepancyId])

  async function loadCritiqueSuggestions(enrichmentId: string) {
    const { data } = await supabase
      .from("dw1ght_playbook_suggestions")
      .select("id, section_key, change_type, suggested_text, reasoning, created_at")
      .eq("source_id", enrichmentId)
      .eq("review_status", "holding")
      .order("created_at", { ascending: false })
    if (data) setCritiqueSuggestions(data)
  }

  async function pushToInbox(id: string) {
    setPushingToInbox(id)
    await supabase
      .from("dw1ght_playbook_suggestions")
      .update({ review_status: "inbox" })
      .eq("id", id)
    setCritiqueSuggestions(prev => prev.filter(s => s.id !== id))
    setPushingToInbox(null)
  }

  async function dismissHolding(id: string) {
    setDismissingId(id)
    await supabase
      .from("dw1ght_playbook_suggestions")
      .update({ review_status: "rejected" })
      .eq("id", id)
    setCritiqueSuggestions(prev => prev.filter(s => s.id !== id))
    setDismissingId(null)
  }

  useEffect(() => {
    if (enrichment?.id) loadCritiqueSuggestions(enrichment.id)
  }, [enrichment?.id])

  async function refireCritique() {
    if (!enrichment) return
    setRefiring(true)
    setRefireMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Not authenticated")
      const res = await fetch("/.netlify/functions/dw1ght-refire-critique", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ enrichment_id: enrichment.id }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Re-fire failed")
      await loadCritiqueSuggestions(enrichment.id)
      const count = body.suggestions_count ?? 0
      const gradeStr = body.grade ? ` — Grade: ${body.grade}` : ""
      setRefireMessage({ type: "success", text: `Review complete${gradeStr}. ${count} new suggestion${count !== 1 ? "s" : ""} added.` })
    } catch (err) {
      setRefireMessage({ type: "error", text: err instanceof Error ? err.message : "Re-fire failed" })
    } finally {
      setRefiring(false)
    }
  }

  function setCorrectionState(idx: number, state: "pending" | "accepted" | "rejected" | "editing") {
    setCorrectionStates(prev => new Map(prev).set(idx, state))
  }

  async function saveReview(decision: "approved" | "rejected") {
    if (!enrichment || !profile) return
    setSaving(true)

    // Apply accepted corrections to the discrepancy
    const updates: Record<string, unknown> = {}
    enrichment.suggested_corrections.forEach((c, i) => {
      const state = correctionStates.get(i)
      if (state === "accepted") {
        const editedValue = editValues.get(i)
        updates[c.field] = editedValue !== undefined ? editedValue : c.suggested
      }
    })

    // Update discrepancy with accepted corrections
    if (Object.keys(updates).length > 0) {
      await supabase
        .from("discrepancies")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", discrepancyId)
    }

    // Update enrichment with review info
    await supabase
      .from("discrepancy_enrichments")
      .update({
        status: decision,
        dom_review_notes: reviewNotes.trim() || null,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", enrichment.id)

    // Update assignment status
    await supabase
      .from("interview_assignments")
      .update({ status: decision, updated_at: new Date().toISOString() })
      .eq("id", assignmentId)

    // Generate learnings from DOM review (fire-and-forget)
    const rejectedCorrections = enrichment.suggested_corrections.filter((_, i) => correctionStates.get(i) === "rejected")
    const acceptedCorrections = enrichment.suggested_corrections.filter((_, i) => correctionStates.get(i) === "accepted")
    fetch("/.netlify/functions/dw1ght-generate-learnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrichment_id: enrichment.id,
        decision,
        review_notes: reviewNotes.trim() || null,
        rejected_corrections: rejectedCorrections,
        accepted_corrections: acceptedCorrections,
      }),
    }).catch(() => {})

    setSaving(false)
    setSaved(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <button onClick={onBack} className="flex items-center gap-2 text-base font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity self-start" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="h-40 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    )
  }

  if (!enrichment) {
    return (
      <div className="flex flex-col gap-5">
        <button onClick={onBack} className="flex items-center gap-2 text-base font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity self-start" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-sm text-white/40">No completed interview found for this assignment.</p>
      </div>
    )
  }

  const structuredData = enrichment.structured_data as Record<string, unknown> | null

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-base font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <span className="text-sm font-bold tracking-widest text-[#d4a017] uppercase" style={{ fontFamily: "var(--font-heading)" }}>
              DOM Review
            </span>
            {discrepancy && (
              <p className="text-[12px] text-white/40 mt-0.5">
                {discrepancy.registration_at_event && <span className="text-white/50">{discrepancy.registration_at_event} — </span>}
                {discrepancy.title}
              </p>
            )}
          </div>
        </div>
        {enrichment.status !== "approved" && enrichment.status !== "rejected" && (
          <span
            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold"
            style={{ color: "rgba(255,165,0,0.8)", background: "rgba(255,165,0,0.08)" }}
          >
            Pending Review
          </span>
        )}
        {(enrichment.status === "approved" || enrichment.status === "rejected") && (
          <span
            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold"
            style={{
              color: enrichment.status === "approved" ? "rgba(100,220,100,0.8)" : "rgba(255,100,100,0.8)",
              background: enrichment.status === "approved" ? "rgba(100,220,100,0.08)" : "rgba(255,100,100,0.08)",
            }}
          >
            {enrichment.status}
          </span>
        )}
      </div>

      {/* Interview metadata */}
      <div
        className="rounded-lg px-4 py-3 flex items-center gap-6 flex-wrap"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Interviewee</div>
          <div className="text-sm text-white/70 mt-0.5">{enrichment.interviewee_name || "Unknown"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Exchanges</div>
          <div className="text-sm text-white/70 mt-0.5">{enrichment.raw_transcript.length}</div>
        </div>
        {enrichment.session_completed_at && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Completed</div>
            <div className="text-sm text-white/70 mt-0.5">{new Date(enrichment.session_completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
        )}
        {discrepancy?.jetinsight_discrepancy_id && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold" style={{ fontFamily: "var(--font-heading)" }}>Discrepancy ID</div>
            <div className="text-sm text-white/70 mt-0.5" style={{ fontFamily: "'Courier Prime','Courier New',monospace" }}>{discrepancy.jetinsight_discrepancy_id}</div>
          </div>
        )}
      </div>

      {/* Narrative Summary */}
      {enrichment.narrative_summary && (
        <div
          className="rounded-lg px-4 py-3"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Narrative Summary
          </h3>
          <p className="text-base text-white/80 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {enrichment.narrative_summary}
          </p>
        </div>
      )}

      {/* Golden Nuggets */}
      {enrichment.golden_nuggets && (
        <div
          className="rounded-lg px-4 py-3"
          style={{ background: "rgba(212,160,23,0.04)", border: "1px solid rgba(212,160,23,0.15)" }}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Golden Nuggets
          </h3>
          <p className="text-base text-white/80 leading-relaxed" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {enrichment.golden_nuggets}
          </p>
        </div>
      )}

      {/* Structured Data */}
      {structuredData && Object.keys(structuredData).length > 0 && (() => {
        const sd = structuredData
        const steps = Array.isArray(sd.diagnostic_steps) ? sd.diagnostic_steps as string[] : []
        const parts = Array.isArray(sd.parts_used) ? sd.parts_used as string[] : []
        const tools = Array.isArray(sd.tools_used) ? sd.tools_used as string[] : []
        const timeSpent = typeof sd.time_spent_description === "string" ? sd.time_spent_description : null
        const rootCause = typeof sd.root_cause_assessment === "string" ? sd.root_cause_assessment : null
        const pastEvents = typeof sd.similar_past_events === "string" ? sd.similar_past_events : null
        const difficulty = typeof sd.difficulty_rating === "string" ? sd.difficulty_rating : null
        const isRepeat = sd.is_repeat_discrepancy === true
        const repeatNotes = typeof sd.repeat_notes === "string" ? sd.repeat_notes : null
        const difficultyColor = difficulty === "critical" ? "rgba(255,100,100,0.8)" : difficulty === "complex" ? "rgba(255,165,0,0.8)" : difficulty === "moderate" ? "rgba(100,180,255,0.8)" : "rgba(100,220,100,0.8)"

        return (
          <div
            className="rounded-lg px-4 py-3 flex flex-col gap-4"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
              Interview Findings
            </h3>

            {/* Top row: difficulty + time + repeat flag */}
            <div className="flex items-center gap-4 flex-wrap">
              {difficulty && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Difficulty</span>
                  <span
                    className="text-[11px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                    style={{ color: difficultyColor, background: difficultyColor.replace(/[\d.]+\)$/, "0.1)") }}
                  >
                    {difficulty}
                  </span>
                </div>
              )}
              {timeSpent && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Time</span>
                  <span className="text-sm text-white/70">{timeSpent}</span>
                </div>
              )}
              {isRepeat && (
                <span
                  className="text-[11px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                  style={{ color: "rgba(255,100,100,0.9)", background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.2)" }}
                >
                  Repeat Discrepancy
                </span>
              )}
            </div>

            {/* Diagnostic steps */}
            {steps.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1.5" style={{ fontFamily: "var(--font-heading)" }}>
                  Diagnostic Steps
                </div>
                <ol className="list-decimal list-inside flex flex-col gap-1">
                  {steps.map((step, i) => (
                    <li key={i} className="text-sm text-white/70 leading-relaxed">{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Parts & Tools side by side */}
            {(parts.length > 0 || tools.length > 0) && (
              <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                {parts.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1.5" style={{ fontFamily: "var(--font-heading)" }}>
                      Parts Used
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {parts.map((p, i) => (
                        <span key={i} className="text-sm px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}>{p}</span>
                      ))}
                    </div>
                  </div>
                )}
                {tools.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1.5" style={{ fontFamily: "var(--font-heading)" }}>
                      Tools Used
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tools.map((t, i) => (
                        <span key={i} className="text-sm px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Root cause */}
            {rootCause && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1" style={{ fontFamily: "var(--font-heading)" }}>
                  Root Cause Assessment
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{rootCause}</p>
              </div>
            )}

            {/* Similar past events */}
            {pastEvents && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1" style={{ fontFamily: "var(--font-heading)" }}>
                  Similar Past Events
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{pastEvents}</p>
              </div>
            )}

            {/* Repeat notes */}
            {repeatNotes && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1" style={{ fontFamily: "var(--font-heading)" }}>
                  Repeat Discrepancy Notes
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{repeatNotes}</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* Suggested Corrections */}
      {enrichment.suggested_corrections.length > 0 && (!saved || readOnly) && (
        <div
          className="rounded-lg px-4 py-3"
          style={{ background: "rgba(100,180,255,0.03)", border: "1px solid rgba(100,180,255,0.12)" }}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(100,180,255,0.9)", fontFamily: "var(--font-heading)" }}>
            Suggested Corrections ({enrichment.suggested_corrections.length})
          </h3>
          <div className="flex flex-col gap-3">
            {enrichment.suggested_corrections.map((c, i) => {
              const state = correctionStates.get(i) || "pending"
              return (
                <div
                  key={i}
                  className="rounded-lg px-3 py-3"
                  style={{
                    background: state === "accepted" ? "rgba(100,220,100,0.04)" : state === "rejected" ? "rgba(255,100,100,0.04)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${state === "accepted" ? "rgba(100,220,100,0.15)" : state === "rejected" ? "rgba(255,100,100,0.15)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(100,180,255,0.1)", color: "rgba(100,180,255,0.9)" }}>
                        {c.field.replace(/_/g, " ")}
                      </span>
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] uppercase tracking-widest text-white/30 w-16 flex-shrink-0 pt-0.5">Current</span>
                          <span className="text-sm text-white/50">{c.original || "—"}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] uppercase tracking-widest text-white/30 w-16 flex-shrink-0 pt-0.5">Suggested</span>
                          {state === "editing" ? (
                            <input
                              type="text"
                              value={editValues.get(i) ?? c.suggested}
                              onChange={(e) => setEditValues(prev => new Map(prev).set(i, e.target.value))}
                              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#d4a017]/50"
                            />
                          ) : (
                            <span className="text-sm text-white/80 font-medium">{editValues.get(i) ?? c.suggested}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[12px] text-white/40 mt-1.5 italic">{c.reason}</p>
                    </div>
                    {!readOnly && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      {state === "editing" ? (
                        <button
                          onClick={() => setCorrectionState(i, "accepted")}
                          className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold"
                          style={{ color: "rgba(100,220,100,0.8)", background: "rgba(100,220,100,0.1)", border: "1px solid rgba(100,220,100,0.2)" }}
                        >
                          Save
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setCorrectionState(i, "accepted")}
                            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold transition-all"
                            style={{
                              color: state === "accepted" ? "rgba(100,220,100,0.9)" : "rgba(100,220,100,0.6)",
                              background: state === "accepted" ? "rgba(100,220,100,0.12)" : "rgba(100,220,100,0.05)",
                              border: `1px solid ${state === "accepted" ? "rgba(100,220,100,0.3)" : "rgba(100,220,100,0.1)"}`,
                            }}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => setCorrectionState(i, "editing")}
                            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold"
                            style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.05)", border: "1px solid rgba(212,160,23,0.1)" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setCorrectionState(i, "rejected")}
                            className="text-[10px] uppercase tracking-widest px-2 py-1 rounded font-semibold transition-all"
                            style={{
                              color: state === "rejected" ? "rgba(255,100,100,0.9)" : "rgba(255,100,100,0.6)",
                              background: state === "rejected" ? "rgba(255,100,100,0.12)" : "rgba(255,100,100,0.05)",
                              border: `1px solid ${state === "rejected" ? "rgba(255,100,100,0.3)" : "rgba(255,100,100,0.1)"}`,
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transcript toggle */}
      <div>
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
        >
          {showTranscript ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Full Transcript ({enrichment.raw_transcript.length} messages)
        </button>
        {showTranscript && (
          <div className="mt-2 flex flex-col gap-2 ml-5">
            {enrichment.raw_transcript.map((msg, i) => (
              <div
                key={i}
                className="rounded-lg px-3 py-2"
                style={{
                  background: msg.role === "user" ? "rgba(212,160,23,0.06)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${msg.role === "user" ? "rgba(212,160,23,0.12)" : "rgba(255,255,255,0.05)"}`,
                }}
              >
                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: msg.role === "assistant" ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))" }}>
                  {msg.role === "assistant" ? "DW1GHT" : "Technician"}
                </span>
                <p className="text-sm text-white/70 mt-0.5 leading-relaxed">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sonnet Review — suggestions + re-fire */}
      {(["Admin", "Super Admin"].includes(profile?.role || "")) && (
        <div
          className="rounded-lg px-4 py-3 flex flex-col gap-3"
          style={{ background: "rgba(148,103,189,0.04)", border: "1px solid rgba(148,103,189,0.15)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" style={{ color: "rgba(148,103,189,0.9)" }} />
              <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "rgba(148,103,189,0.9)", fontFamily: "var(--font-heading)" }}>
                Sonnet Review
              </h3>
              {critiqueSuggestions.length > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(193,2,48,0.15)", color: "rgba(193,2,48,0.9)" }}
                >
                  {critiqueSuggestions.length}
                </span>
              )}
            </div>
            <button
              onClick={refireCritique}
              disabled={refiring}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-widest transition-all hover:brightness-110 disabled:opacity-50"
              style={{ color: "rgba(148,103,189,0.9)", background: "rgba(148,103,189,0.08)", border: "1px solid rgba(148,103,189,0.2)" }}
            >
              <RefreshCw className={`w-3 h-3 ${refiring ? "animate-spin" : ""}`} />
              {refiring ? "Running…" : "Re-run Sonnet Review"}
            </button>
          </div>

          {refireMessage && (
            <div
              className="rounded px-3 py-2 text-sm"
              style={{
                background: refireMessage.type === "success" ? "rgba(100,220,100,0.06)" : "rgba(255,100,100,0.06)",
                border: `1px solid ${refireMessage.type === "success" ? "rgba(100,220,100,0.15)" : "rgba(255,100,100,0.15)"}`,
                color: refireMessage.type === "success" ? "rgba(100,220,100,0.9)" : "rgba(255,100,100,0.9)",
              }}
            >
              {refireMessage.text}
            </div>
          )}

          {critiqueSuggestions.length === 0 && !refireMessage && (
            <p className="text-[12px] text-white/30">
              No observations in holding. Run a review to generate playbook improvement ideas.
            </p>
          )}

          {critiqueSuggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              {critiqueSuggestions.map((s) => {
                const sectionLabel = s.section_key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                const ctMeta = s.change_type === "append"
                  ? { label: "Append", bg: "rgba(100,220,100,0.08)", color: "rgba(100,220,100,0.8)" }
                  : s.change_type === "replace_text"
                    ? { label: "Rewrite", bg: "rgba(56,189,248,0.08)", color: "rgba(56,189,248,0.8)" }
                    : { label: "Replace", bg: "rgba(255,165,0,0.08)", color: "rgba(255,165,0,0.8)" }
                const isPushing = pushingToInbox === s.id
                const isDismissing = dismissingId === s.id
                return (
                  <div
                    key={s.id}
                    className="rounded-lg px-3 py-3 flex flex-col gap-2"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(148,103,189,0.1)" }}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(212,160,23,0.12)", color: "var(--skyshare-gold)" }}
                      >
                        {sectionLabel}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: ctMeta.bg, color: ctMeta.color }}
                      >
                        {ctMeta.label}
                      </span>
                      <span className="text-[10px] text-white/25 ml-auto">
                        {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {s.reasoning && (
                      <p className="text-[12px] text-white/50 italic leading-relaxed">{s.reasoning}</p>
                    )}
                    <pre
                      className="text-[12px] text-white/70 whitespace-pre-wrap leading-relaxed rounded px-2 py-1.5"
                      style={{ fontFamily: "'Courier Prime','Courier New',monospace", background: "rgba(255,255,255,0.03)" }}
                    >
                      {s.suggested_text}
                    </pre>
                    {/* Push / Dismiss actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => pushToInbox(s.id)}
                        disabled={isPushing || isDismissing}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
                        style={{ fontFamily: "var(--font-heading)", background: "rgba(139,92,246,0.12)", color: "rgba(196,160,255,0.9)", border: "1px solid rgba(139,92,246,0.25)" }}
                      >
                        {isPushing ? "Sending…" : "→ Push to Inbox"}
                      </button>
                      <button
                        onClick={() => dismissHolding(s.id)}
                        disabled={isPushing || isDismissing}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
                        style={{ fontFamily: "var(--font-heading)", background: "rgba(220,80,80,0.08)", color: "rgba(220,80,80,0.7)", border: "1px solid rgba(220,80,80,0.15)" }}
                      >
                        {isDismissing ? "Dismissing…" : "Dismiss"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Review actions */}
      {!readOnly && !saved && enrichment.status === "completed" && (
        <div
          className="rounded-lg px-4 py-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            DOM Review Notes
          </h3>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Optional notes about this interview..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-base text-white placeholder-white/20 focus:outline-none focus:border-[#d4a017]/50 resize-none mb-3"
          />
          <div className="flex gap-3">
            <button
              onClick={() => saveReview("approved")}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-base font-semibold transition-all hover:brightness-110"
              style={{ background: "rgba(100,220,100,0.12)", color: "rgba(100,220,100,0.9)", border: "1px solid rgba(100,220,100,0.25)" }}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Approve Interview"}
            </button>
            <button
              onClick={() => saveReview("rejected")}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-base font-semibold transition-all hover:brightness-110"
              style={{ background: "rgba(255,100,100,0.08)", color: "rgba(255,100,100,0.8)", border: "1px solid rgba(255,100,100,0.2)" }}
            >
              {saving ? "Saving..." : "Reject"}
            </button>
          </div>
        </div>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div
          className="rounded-lg px-4 py-3 text-center"
          style={{ background: "rgba(100,220,100,0.06)", border: "1px solid rgba(100,220,100,0.15)" }}
        >
          <p className="text-base text-white/70">Review saved successfully.</p>
          <button
            onClick={onBack}
            className="mt-2 text-sm px-4 py-2 rounded-md"
            style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}
          >
            Return to Discrepancy Detail
          </button>
        </div>
      )}

    </div>
  )
}

// ─── Interview Chat View ─────────────────────────────────────────────────────
function InterviewChatView({
  assignmentId,
  discrepancyId,
  onBack,
}: {
  assignmentId: string
  discrepancyId: string
  onBack: () => void
}) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [enrichmentId, setEnrichmentId] = useState<string | null>(null)
  const [phase, setPhase] = useState<"opening" | "deep_dive" | "closing">("opening")
  const [started, setStarted] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingHover, setRatingHover] = useState(0)
  const [ratingComment, setRatingComment] = useState("")
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [discrepancyTitle, setDiscrepancyTitle] = useState("")
  const [discrepancyTail, setDiscrepancyTail] = useState("")
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load discrepancy info
  useEffect(() => {
    supabase
      .from("discrepancies")
      .select("title, registration_at_event")
      .eq("id", discrepancyId)
      .single()
      .then(({ data }) => {
        if (data) {
          setDiscrepancyTitle(data.title)
          setDiscrepancyTail(data.registration_at_event || "")
        }
      })
  }, [discrepancyId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function startInterview() {
    if (started) return
    setLoading(true)
    try {
      const res = await fetch("/.netlify/functions/dw1ght-interview-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", assignment_id: assignmentId, discrepancy_id: discrepancyId }),
      })
      const data = await res.json()
      if (data.enrichment_id) {
        setEnrichmentId(data.enrichment_id)
        setStarted(true)
        setMessages([{ role: "assistant", content: data.reply }])
        setPhase(data.phase || "opening")
        if (data.usage) setSessionTokens(prev => ({ input: prev.input + data.usage.input_tokens, output: prev.output + data.usage.output_tokens }))
      }
    } catch {
      setMessages([{ role: "assistant", content: "Failed to start interview. Please try again." }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading || !enrichmentId) return
    const newMsgs = [...messages, { role: "user" as const, content: text }]
    setMessages(newMsgs)
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/.netlify/functions/dw1ght-interview-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          enrichment_id: enrichmentId,
          discrepancy_id: discrepancyId,
          message: text,
          history: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const reply = data.reply || "..."
      setMessages([...newMsgs, { role: "assistant", content: reply }])
      setPhase(data.phase || "deep_dive")
      if (data.usage) setSessionTokens(prev => ({ input: prev.input + data.usage.input_tokens, output: prev.output + data.usage.output_tokens }))
    } catch {
      setMessages([...newMsgs, { role: "assistant", content: "Connection failure. Your transcript has been saved." }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function completeInterview() {
    if (!enrichmentId || completing) return
    setCompleting(true)
    try {
      const res = await fetch("/.netlify/functions/dw1ght-interview-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", enrichment_id: enrichmentId, discrepancy_id: discrepancyId, assignment_id: assignmentId }),
      })
      const data = await res.json()
      if (data.status === "completed") {
        setCompleted(true)
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Failed to complete interview. Your transcript is saved — the DOM can still review it." }])
    } finally {
      setCompleting(false)
    }
  }

  const sessionCost = (sessionTokens.input * 0.0000008) + (sessionTokens.output * 0.000004)
  const costDisplay = sessionCost < 0.0001 ? "<$0.0001" : `$${sessionCost.toFixed(4)}`

  return (
    <div className="flex flex-col gap-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-base font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity"
            style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-widest text-[#d4a017] uppercase" style={{ fontFamily: "var(--font-heading)" }}>
                DW1GHT Interview
              </span>
              <span
                className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded font-semibold"
                style={{
                  color: phase === "closing" ? "rgba(100,220,100,0.8)" : phase === "deep_dive" ? "rgba(100,180,255,0.8)" : "var(--skyshare-gold)",
                  background: phase === "closing" ? "rgba(100,220,100,0.08)" : phase === "deep_dive" ? "rgba(100,180,255,0.08)" : "rgba(212,160,23,0.08)",
                }}
              >
                {phase.replace("_", " ")}
              </span>
            </div>
            {discrepancyTitle && (
              <p className="text-[12px] text-white/40 mt-0.5">
                {discrepancyTail && <span className="text-white/50">{discrepancyTail} — </span>}
                {discrepancyTitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-white/20 font-mono">{costDisplay}</span>
          {started && !completed && messages.length >= 6 && (
            <button
              onClick={completeInterview}
              disabled={completing}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-md transition-all hover:brightness-125"
              style={{ background: "rgba(100,220,100,0.1)", color: "rgba(100,220,100,0.8)", border: "1px solid rgba(100,220,100,0.2)" }}
            >
              <CheckCircle className="w-3 h-3" />
              {completing ? "Finishing..." : "Complete Interview"}
            </button>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", height: "calc(100vh - 14rem)" }}
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!started && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <img
                src="/beat-knowledge.png"
                alt="Beat Knowledge — The Emblametic Source"
                className="w-40 h-auto opacity-80"
                style={{ filter: "drop-shadow(0 4px 12px rgba(212,160,23,0.15))" }}
              />
              <div className="text-center">
                <span className="text-sm font-bold tracking-widest text-[#d4a017] uppercase block mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                  DW1GHT — Interview Mode
                </span>
                <p className="text-white/30 text-sm leading-relaxed max-w-md">
                  DW1GHT will guide you through a structured interview about this discrepancy.
                  Your responses will be recorded and reviewed by the DOM.
                </p>
                {discrepancyTitle && (
                  <p className="text-white/50 text-base mt-3 font-medium">
                    {discrepancyTail && <span className="text-[#d4a017]">{discrepancyTail}</span>}
                    {discrepancyTail && " — "}
                    {discrepancyTitle}
                  </p>
                )}
              </div>
              <button
                onClick={startInterview}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-semibold transition-all hover:brightness-110"
                style={{ background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)", border: "1px solid rgba(212,160,23,0.3)" }}
              >
                {loading ? "Starting..." : "Begin Interview"}
              </button>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-2.5 max-w-[75%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "assistant" ? (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: "rgba(212,160,23,0.15)", border: "1px solid rgba(212,160,23,0.3)" }}
                  >
                    <Award className="w-3 h-3" style={{ color: "var(--skyshare-gold)" }} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-muted border border-border flex-shrink-0 mt-1">
                    <span className="text-[9px] text-muted-foreground font-medium">you</span>
                  </div>
                )}
                <div className={`flex flex-col gap-0.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  {m.role === "assistant" && (
                    <span
                      className="text-[9px] font-bold tracking-widest uppercase px-0.5"
                      style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", opacity: 0.8 }}
                    >
                      DW1GHT
                    </span>
                  )}
                  <div
                    className="rounded-lg px-3 py-2 text-[14px] leading-relaxed"
                    style={{
                      ...(m.role === "user"
                        ? { background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.25)", borderBottomRightRadius: "4px", color: "hsl(var(--foreground))" }
                        : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderBottomLeftRadius: "4px", color: "hsl(var(--foreground))" }),
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {loading && started && (
            <div className="flex gap-2.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={{ background: "rgba(212,160,23,0.15)", border: "1px solid rgba(212,160,23,0.3)" }}
              >
                <Award className="w-3 h-3" style={{ color: "var(--skyshare-gold)" }} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-[9px] font-bold tracking-widest uppercase px-0.5"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", opacity: 0.8 }}
                >
                  DW1GHT
                </span>
                <div
                  className="rounded-lg px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderBottomLeftRadius: "4px" }}
                >
                  <div className="flex gap-1.5 items-center h-4">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(212,160,23,0.4)", animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(212,160,23,0.4)", animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(212,160,23,0.4)", animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Complete button at bottom */}
        {started && !completed && messages.length >= 6 && (
          <div className="px-4 py-2 flex justify-center flex-shrink-0" style={{ borderTop: "1px solid rgba(100,220,100,0.1)", background: "rgba(100,220,100,0.02)" }}>
            <button
              onClick={completeInterview}
              disabled={completing}
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest px-5 py-2 rounded-md transition-all hover:brightness-125"
              style={{ background: "rgba(100,220,100,0.1)", color: "rgba(100,220,100,0.8)", border: "1px solid rgba(100,220,100,0.2)" }}
            >
              <CheckCircle className="w-4 h-4" />
              {completing ? "Finishing..." : "Complete Interview"}
            </button>
          </div>
        )}

        {/* Input */}
        {started && !completed && (
          <div className="px-4 py-3 flex gap-2 items-center flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Describe what happened..."
              className="flex-1 bg-transparent border rounded-lg px-3 py-2 text-base focus:outline-none transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.08)", color: "hsl(var(--foreground))", fontFamily: "'DM Sans', system-ui, sans-serif" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all disabled:opacity-25"
              style={{ background: input.trim() && !loading ? "rgba(212,160,23,0.12)" : "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "var(--skyshare-gold)" }}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Completed banner */}
        {completed && (
          <div
            className="px-5 py-5 flex flex-col items-center gap-4"
            style={{ borderTop: "2px solid rgba(100,220,100,0.3)", background: "rgba(100,220,100,0.04)" }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" style={{ color: "rgba(100,220,100,0.8)" }} />
              <span className="text-base font-bold uppercase tracking-widest" style={{ color: "rgba(100,220,100,0.8)", fontFamily: "var(--font-heading)" }}>
                Interview Complete
              </span>
            </div>
            <p className="text-sm text-white/50 text-center">
              Your session has been submitted for DOM review. Thank you for your time.
            </p>

            {/* Rating */}
            {!ratingSubmitted ? (
              <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                <p className="text-sm text-white/40 uppercase tracking-widest font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  How was this interview?
                </p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setRatingHover(star)}
                      onMouseLeave={() => setRatingHover(0)}
                      className="text-2xl transition-transform hover:scale-110"
                      style={{ color: star <= (ratingHover || rating) ? "var(--skyshare-gold)" : "rgba(255,255,255,0.12)" }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Any feedback on the interview? (optional)"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#d4a017]/50 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (enrichmentId && (rating > 0 || ratingComment.trim())) {
                        await supabase.from("discrepancy_enrichments").update({
                          interview_rating: rating || null,
                          interview_feedback: ratingComment.trim() || null,
                        }).eq("id", enrichmentId)
                      }
                      setRatingSubmitted(true)
                    }}
                    className="text-sm font-semibold px-4 py-1.5 rounded-md transition-all hover:brightness-125"
                    style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.25)" }}
                  >
                    {rating > 0 || ratingComment.trim() ? "Submit" : "Skip"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {rating > 0 && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className="text-lg" style={{ color: star <= rating ? "var(--skyshare-gold)" : "rgba(255,255,255,0.08)" }}>★</span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-white/30">Thanks for the feedback.</p>
              </div>
            )}

            <button
              onClick={onBack}
              className="text-sm font-semibold px-5 py-2 rounded-md transition-all hover:brightness-125"
              style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.25)" }}
            >
              Return to Discrepancy
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Archive Sort Header ──────────────────────────────────────────────────────
function ArchiveSortTh({ label, active, dir, onClick, className }: {
  label: string; active: boolean; dir: "asc" | "desc"
  onClick: () => void; className?: string
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <th className={className ?? "px-4 py-2.5 text-left whitespace-nowrap"}>
      <button
        onClick={onClick}
        className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-medium transition-colors"
        style={{ color: active ? "var(--skyshare-gold)" : "rgba(255,255,255,0.35)" }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.60)" }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)" }}
      >
        {label}
        <Icon className="w-3 h-3" style={{ opacity: active ? 1 : 0.4 }} />
      </button>
    </th>
  )
}

// ─── Interview Archive View ───────────────────────────────────────────────────
type ArchiveRow = {
  assignment_id: string
  discrepancy_id: string
  tail: string
  title: string
  technician: string
  completed_at: string
  status: "approved" | "rejected"
  rating: number | null
}
type ArchiveSortCol = "tail" | "title" | "technician" | "completed_at" | "status"

function InterviewArchiveView({
  onBack,
  onViewInterview,
}: {
  onBack: () => void
  onViewInterview: (assignmentId: string, discrepancyId: string) => void
}) {
  const db = supabase as any
  const [rows, setRows] = useState<ArchiveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected">("all")
  const [sortCol, setSortCol] = useState<ArchiveSortCol>("completed_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    async function fetchArchive() {
      setLoading(true)
      const { data: assignments } = await db
        .from("interview_assignments")
        .select("id, discrepancy_id, completed_at, updated_at, status, profiles:assigned_to(full_name)")
        .in("status", ["approved", "rejected"])
        .order("updated_at", { ascending: false })

      if (!assignments || assignments.length === 0) { setRows([]); setLoading(false); return }

      const discIds = [...new Set<string>(assignments.map((a: any) => a.discrepancy_id))]
      const { data: discs } = await db
        .from("discrepancies")
        .select("id, title, registration_at_event")
        .in("id", discIds)

      const assignIds = assignments.map((a: any) => a.id)
      const { data: enrichments } = await db
        .from("discrepancy_enrichments")
        .select("interview_assignment_id, interview_rating")
        .in("interview_assignment_id", assignIds)

      const discMap = new Map((discs ?? []).map((d: any) => [d.id, d]))
      const enrichMap = new Map((enrichments ?? []).map((e: any) => [e.interview_assignment_id, e.interview_rating as number | null]))

      setRows(assignments.map((a: any) => {
        const disc = discMap.get(a.discrepancy_id)
        return {
          assignment_id: a.id,
          discrepancy_id: a.discrepancy_id,
          tail:       disc?.registration_at_event || "—",
          title:      disc?.title || "Unknown",
          technician: (a.profiles as any)?.full_name || "Unknown",
          completed_at: a.completed_at || a.updated_at || "",
          status:     a.status as "approved" | "rejected",
          rating:     enrichMap.get(a.id) ?? null,
        }
      }))
      setLoading(false)
    }
    fetchArchive()
  }, [])

  function handleSort(col: ArchiveSortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("asc") }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (statusFilter !== "all") r = r.filter(row => row.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(row =>
        row.tail.toLowerCase().includes(q) ||
        row.title.toLowerCase().includes(q) ||
        row.technician.toLowerCase().includes(q)
      )
    }
    return [...r].sort((a, b) => {
      const av = a[sortCol] ?? ""
      const bv = b[sortCol] ?? ""
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [rows, statusFilter, search, sortCol, sortDir])

  const approvedCount = rows.filter(r => r.status === "approved").length
  const rejectedCount = rows.filter(r => r.status === "rejected").length

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-base font-medium px-3 py-1.5 rounded-md hover:opacity-80 transition-opacity"
          style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Discrepancy Intelligence
          </p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", letterSpacing: "0.07em", color: "hsl(var(--foreground))", lineHeight: 1 }}>
            Interview Archive
          </h2>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] text-white/30 uppercase tracking-widest">
            {approvedCount} archived · {rejectedCount} rejected
          </span>
        </div>
      </div>

      {/* Search + filter row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tail, discrepancy, or technician..."
            className="w-full bg-white/5 border border-white/10 rounded-md pl-8 pr-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none"
            style={{ outlineColor: "rgba(212,160,23,0.4)" }}
          />
        </div>
        <div className="flex gap-1">
          {(["all", "approved", "rejected"] as const).map(f => {
            const label = f === "all" ? `All (${rows.length})` : f === "approved" ? `Archived (${approvedCount})` : `Rejected (${rejectedCount})`
            const activeColor = f === "rejected" ? "rgba(255,100,100,0.9)" : f === "approved" ? "rgba(100,220,100,0.9)" : "var(--skyshare-gold)"
            const activeBg = f === "rejected" ? "rgba(255,100,100,0.12)" : f === "approved" ? "rgba(100,220,100,0.12)" : "rgba(212,160,23,0.12)"
            const activeBorder = f === "rejected" ? "rgba(255,100,100,0.3)" : f === "approved" ? "rgba(100,220,100,0.3)" : "rgba(212,160,23,0.3)"
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-widest transition-all"
                style={statusFilter === f
                  ? { color: activeColor, background: activeBg, border: `1px solid ${activeBorder}` }
                  : { color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", border: "1px solid transparent" }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {loading ? (
          <div className="px-6 py-12 text-center text-white/30 text-sm">Loading archive...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-white/25 text-sm">
            {rows.length === 0 ? "No archived interviews yet." : "No results match your search."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <ArchiveSortTh label="Tail"        active={sortCol === "tail"}         dir={sortDir} onClick={() => handleSort("tail")} />
                <ArchiveSortTh label="Discrepancy" active={sortCol === "title"}        dir={sortDir} onClick={() => handleSort("title")} />
                <ArchiveSortTh label="Technician"  active={sortCol === "technician"}   dir={sortDir} onClick={() => handleSort("technician")} />
                <ArchiveSortTh label="Completed"   active={sortCol === "completed_at"} dir={sortDir} onClick={() => handleSort("completed_at")} />
                <ArchiveSortTh label="Status"      active={sortCol === "status"}       dir={sortDir} onClick={() => handleSort("status")} />
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-medium whitespace-nowrap" style={{ color: "rgba(255,255,255,0.35)" }}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr
                  key={row.assignment_id}
                  onClick={() => onViewInterview(row.assignment_id, row.discrepancy_id)}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: idx < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
                >
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--skyshare-gold)" }}>{row.tail}</span>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs" style={{ maxWidth: "280px" }}>
                    <span className="block truncate">{row.title}</span>
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">{row.technician}</td>
                  <td className="px-4 py-3 text-white/40 text-xs font-mono">
                    {row.completed_at
                      ? new Date(row.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
                      style={row.status === "approved"
                        ? { background: "rgba(100,220,100,0.1)", color: "rgba(100,220,100,0.8)" }
                        : { background: "rgba(255,100,100,0.08)", color: "rgba(255,100,100,0.7)" }}
                    >
                      {row.status === "approved" ? "Archived" : "Rejected"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.rating != null ? (
                      <span className="text-xs" style={{ color: "var(--skyshare-gold)" }}>
                        {"★".repeat(row.rating)}{"☆".repeat(5 - row.rating)}
                      </span>
                    ) : (
                      <span className="text-white/20 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function DiscrepancyIntelligence() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === "Super Admin"
  const isAdmin = profile?.role === "Admin" || isSuperAdmin
  const isManager = profile?.role === "Manager" || isAdmin
  const { data: fleet, isLoading, isError } = useFleet()
  const { data: counts } = useDiscrepancyCounts()
  const { data: fleetStats } = useFleetStats()
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftBase | null>(null)
  const [dw1ghtOpen, setDw1ghtOpen] = useState(false)
  const [dw1ghtMode, setDw1ghtMode] = useState<"schrute" | "corporate" | "troubleshooting">("schrute")
  const [activeInterview, setActiveInterview] = useState<{ assignmentId: string; discrepancyId: string } | null>(null)
  const [activeReview, setActiveReview] = useState<{ assignmentId: string; discrepancyId: string; readOnly?: boolean } | null>(null)
  const [myAssignments, setMyAssignments] = useState<Array<{ id: string; discrepancy_id: string; status: string; dom_note: string | null; tail: string; title: string; created_at: string }>>([])
  const [myAssignmentsRefresh, setMyAssignmentsRefresh] = useState(0)
  type InterviewItem = {
    assignment_id: string
    discrepancy_id: string
    tail: string
    title: string
    technician: string
    completed_at: string
    status: string
  }
  const [interviewPipeline, setInterviewPipeline] = useState<Record<string, InterviewItem[]>>({})
  const [expandedPipelineStatus, setExpandedPipelineStatus] = useState<string | null>(null)
  const [pipelineDeleteId, setPipelineDeleteId] = useState<string | null>(null)
  const [pipelineRefresh, setPipelineRefresh] = useState(0)
  const [activeArchive, setActiveArchive] = useState(false)

  async function deletePipelineItem(assignmentId: string, discrepancyId: string) {
    // Delete enrichment(s) for this discrepancy
    await supabase.from("discrepancy_enrichments").delete().eq("discrepancy_id", discrepancyId)
    // Delete the assignment
    await supabase.from("interview_assignments").delete().eq("id", assignmentId)
    setPipelineDeleteId(null)
    setPipelineRefresh(prev => prev + 1)
  }

  // Fetch my interview assignments (all users)
  useEffect(() => {
    if (!profile?.id) return
    async function fetchMyAssignments() {
      const { data: assignments } = await supabase
        .from("interview_assignments")
        .select("id, discrepancy_id, status, dom_note, created_at")
        .eq("assigned_to", profile!.id)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false })

      if (!assignments || assignments.length === 0) { setMyAssignments([]); return }

      const discIds = [...new Set(assignments.map(a => a.discrepancy_id))]
      const { data: discs } = await supabase
        .from("discrepancies")
        .select("id, title, registration_at_event")
        .in("id", discIds)

      const discMap = new Map((discs || []).map(d => [d.id, d]))
      setMyAssignments(assignments.map(a => {
        const disc = discMap.get(a.discrepancy_id)
        return {
          id: a.id,
          discrepancy_id: a.discrepancy_id,
          status: a.status,
          dom_note: a.dom_note,
          tail: disc?.registration_at_event || "—",
          title: disc?.title || "Unknown",
          created_at: a.created_at,
        }
      }))
    }
    fetchMyAssignments()
  }, [profile?.id, activeInterview, myAssignmentsRefresh])

  // Fetch all interview assignments (Super Admin only)
  useEffect(() => {
    if (!isSuperAdmin) return
    async function fetchPipeline() {
      const { data: assignments } = await supabase
        .from("interview_assignments")
        .select("id, discrepancy_id, completed_at, status, updated_at, profiles:assigned_to(full_name)")
        .order("updated_at", { ascending: false })

      if (!assignments || assignments.length === 0) { setInterviewPipeline({}); return }

      const discIds = [...new Set(assignments.map(a => a.discrepancy_id))]
      const { data: discs } = await supabase
        .from("discrepancies")
        .select("id, title, registration_at_event")
        .in("id", discIds)

      const discMap = new Map((discs || []).map(d => [d.id, d]))

      const grouped: Record<string, InterviewItem[]> = {}
      for (const a of assignments) {
        const disc = discMap.get(a.discrepancy_id)
        const item: InterviewItem = {
          assignment_id: a.id,
          discrepancy_id: a.discrepancy_id,
          tail: disc?.registration_at_event || "—",
          title: disc?.title || "Unknown",
          technician: (a.profiles as { full_name: string } | null)?.full_name || "Unknown",
          completed_at: a.completed_at || "",
          status: a.status,
        }
        if (!grouped[a.status]) grouped[a.status] = []
        grouped[a.status].push(item)
      }
      setInterviewPipeline(grouped)
    }
    fetchPipeline()
  }, [isSuperAdmin, activeReview, activeInterview, pipelineRefresh])

  const countMap = counts ?? new Map<string, number>()
  // Total records: sum from accurate server-side RPC
  const totalRecords = countMap.size > 0
    ? Array.from(countMap.values()).reduce((s, n) => s + n, 0)
    : (fleetStats?.totalRecords ?? 0)
  // Aircraft count: total fleet size (including aircraft with no records yet)
  const aircraftWithRecords = fleet
    ? fleet.reduce((sum, mfr) => sum + mfr.families.reduce((s2, fam) => s2 + fam.aircraft.length, 0), 0)
    : (fleetStats?.aircraftCount ?? 0)

  // ── Interview chat view ──
  if (activeInterview) {
    return (
      <div className="flex flex-col gap-8 p-6">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            Discrepancy Intelligence
          </p>
        </div>
        <InterviewChatView
          assignmentId={activeInterview.assignmentId}
          discrepancyId={activeInterview.discrepancyId}
          onBack={() => setActiveInterview(null)}
        />
      </div>
    )
  }

  // ── Interview archive view ──
  if (activeArchive) {
    return (
      <div className="flex flex-col gap-8 p-6">
        <InterviewArchiveView
          onBack={() => setActiveArchive(false)}
          onViewInterview={(assignmentId, discrepancyId) => {
            setActiveArchive(false)
            setActiveReview({ assignmentId, discrepancyId, readOnly: !isSuperAdmin })
          }}
        />
      </div>
    )
  }

  // ── DOM review view ──
  if (activeReview) {
    return (
      <div className="flex flex-col gap-8 p-6">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            Discrepancy Intelligence
          </p>
        </div>
        <DomReviewView
          assignmentId={activeReview.assignmentId}
          discrepancyId={activeReview.discrepancyId}
          onBack={() => setActiveReview(null)}
          readOnly={activeReview.readOnly ?? false}
        />
      </div>
    )
  }

  // ── Discrepancy list view ──
  if (selectedAircraft) {
    return (
      <div className="flex flex-col gap-8 p-6">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            Discrepancy Intelligence
          </p>
        </div>
        <DiscrepancyListView
          aircraft={selectedAircraft}
          onBack={() => setSelectedAircraft(null)}
          onStartInterview={(assignmentId, discrepancyId) => setActiveInterview({ assignmentId, discrepancyId })}
          onReviewInterview={(assignmentId, discrepancyId) => setActiveReview({ assignmentId, discrepancyId })}
        />
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
            className="text-sm font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            Maintenance Intelligence
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.25rem",
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
                  fontSize: "2.25rem",
                  letterSpacing: "0.06em",
                  color: "var(--skyshare-gold)",
                  lineHeight: 1,
                }}
              >
                {totalRecords}
              </div>
              <div
                className="text-sm uppercase tracking-widest"
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
                  fontSize: "2.25rem",
                  letterSpacing: "0.06em",
                  color: "hsl(var(--foreground))",
                  lineHeight: 1,
                  opacity: 0.7,
                }}
              >
                {aircraftWithRecords}
              </div>
              <div
                className="text-sm uppercase tracking-widest"
                style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
              >
                Aircraft
              </div>
            </div>
          )}
        </div>
      </div>

      {/* My Interview Assignments */}
      {myAssignments.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "rgba(212,160,23,0.04)", border: "1px solid rgba(212,160,23,0.15)" }}
        >
          <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(212,160,23,0.1)" }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--skyshare-gold)" }} />
              <span
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
              >
                Your Interview Assignments
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)" }}
              >
                {myAssignments.length}
              </span>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {myAssignments.map((a) => (
              <div
                key={a.id}
                className="px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold" style={{ color: "var(--skyshare-gold)" }}>{a.tail}</span>
                    <span className="text-sm text-white/70 truncate">{a.title}</span>
                  </div>
                  {a.dom_note && (
                    <p className="text-[11px] text-white/40 italic truncate">
                      DOM note: "{a.dom_note}"
                    </p>
                  )}
                  <span className="text-[10px] text-white/25">
                    Assigned {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <button
                  onClick={() => setActiveInterview({ assignmentId: a.id, discrepancyId: a.discrepancy_id })}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest px-4 py-2 rounded-md transition-all hover:brightness-125 flex-shrink-0"
                  style={{
                    background: a.status === "in_progress" ? "rgba(100,180,255,0.12)" : "rgba(212,160,23,0.12)",
                    color: a.status === "in_progress" ? "rgba(100,180,255,0.9)" : "var(--skyshare-gold)",
                    border: `1px solid ${a.status === "in_progress" ? "rgba(100,180,255,0.25)" : "rgba(212,160,23,0.3)"}`,
                  }}
                >
                  <MessageSquare size={13} />
                  {a.status === "in_progress" ? "Resume" : "Start Interview"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ask DW1GHT Bar */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-2"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDw1ghtOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:brightness-125"
            style={{
              background: "rgba(212,160,23,0.1)",
              border: "1px solid rgba(212,160,23,0.25)",
              color: "var(--skyshare-gold)",
            }}
          >
            <Award className="w-3.5 h-3.5" />
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Ask DW1GHT
            </span>
          </button>
          <div
            className="flex items-center rounded-md overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <button
              onClick={() => setDw1ghtMode("schrute")}
              className="px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
              style={{
                fontFamily: "var(--font-heading)",
                background: dw1ghtMode === "schrute" ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.02)",
                color: dw1ghtMode === "schrute" ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
              }}
            >
              <span className="text-sm leading-none">🌱</span>
            </button>
            <button
              onClick={() => setDw1ghtMode("corporate")}
              className="px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-colors"
              style={{
                fontFamily: "var(--font-heading)",
                background: dw1ghtMode === "corporate" ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.02)",
                color: dw1ghtMode === "corporate" ? "rgba(100,170,255,0.9)" : "hsl(var(--muted-foreground))",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="text-sm leading-none">👔</span>
            </button>
            <button
              onClick={() => setDw1ghtMode("troubleshooting")}
              className="flex items-center gap-0.5 px-2.5 py-1.5 transition-colors"
              style={{
                background: dw1ghtMode === "troubleshooting" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.02)",
                color: dw1ghtMode === "troubleshooting" ? "rgba(100,220,100,0.9)" : "hsl(var(--muted-foreground))",
                borderLeft: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="text-sm leading-none">🧠</span>
              <Wrench className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isManager && (
            <button
              onClick={() => setActiveArchive(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:brightness-125"
              style={{ background: "rgba(100,220,100,0.07)", border: "1px solid rgba(100,220,100,0.18)", color: "rgba(100,220,100,0.75)" }}
            >
              <MessageSquare className="w-3 h-3" />
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>
                Interview Archive
              </span>
            </button>
          )}
          <span
            className="text-[9px] font-bold tracking-widest uppercase"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.5 }}
          >
            {dw1ghtMode === "schrute" ? "Full Schrute" : dw1ghtMode === "corporate" ? "Corporate" : "Troubleshooting"}
          </span>
        </div>
      </div>

      {/* Import Records — Admin+ only */}
      {isAdmin && <DiscrepancyImportPanel />}
      {isAdmin && <SyncAuditLog />}

      {/* Fleet Analytics */}
      {fleetStats && fleetStats.totalRecords > 0 ? (
        <FleetStatsPanel stats={fleetStats} />
      ) : (
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
              className="text-sm font-semibold uppercase tracking-widest"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
            >
              Import Pending
            </p>
            <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              Historical discrepancy records have not been imported yet. The fleet roster below reflects all aircraft.
            </p>
          </div>
        </div>
      )}

      {/* Interview Pipeline — Super Admin only */}
      {isSuperAdmin && (() => {
        const statusOrder = [
          { key: "completed", label: "Needs Review", color: "rgba(255,165,0,0.8)", bg: "rgba(255,165,0,0.1)", actionLabel: "Review", actionable: true },
          { key: "in_progress", label: "In Progress", color: "rgba(100,180,255,0.8)", bg: "rgba(100,180,255,0.08)", actionLabel: null, actionable: false },
          { key: "assigned", label: "Assigned", color: "var(--skyshare-gold)", bg: "rgba(212,160,23,0.08)", actionLabel: null, actionable: false },
          { key: "reviewed", label: "Reviewed", color: "rgba(178,130,255,0.85)", bg: "rgba(138,43,226,0.08)", actionLabel: "View", actionable: true },
        ]
        const activeCount = statusOrder.reduce((s, st) => s + (interviewPipeline[st.key]?.length || 0), 0)


        return (
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: "1px solid rgba(212,160,23,0.15)", background: "rgba(255,255,255,0.015)" }}
          >
            {/* Header with counts */}
            <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(212,160,23,0.03)" }}>
              <MessageSquare className="w-3.5 h-3.5" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }} />
              <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
                Interview Pipeline
              </span>
              <span className="text-[9px] text-white/30 ml-auto">{activeCount} active</span>
            </div>

            {/* Status pills row — active statuses only */}
            {activeCount > 0 ? (
            <div className="px-4 py-2.5 flex flex-wrap gap-1.5">
              {statusOrder.map(({ key, label, color, bg }) => {
                const count = interviewPipeline[key]?.length || 0
                if (count === 0) return null
                const isExpanded = expandedPipelineStatus === key
                return (
                  <button
                    key={key}
                    onClick={() => setExpandedPipelineStatus(isExpanded ? null : key)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold uppercase tracking-widest transition-all hover:brightness-125"
                    style={{
                      color,
                      background: isExpanded ? bg.replace(/[\d.]+\)$/, "0.2)") : bg,
                      border: `1px solid ${isExpanded ? color : "transparent"}`,
                    }}
                  >
                    {label}
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded-full"
                      style={{ background: color.replace(/[\d.]+\)$/, "0.15)"), color }}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
            ) : (
              <div className="px-4 py-3">
                <span className="text-[10px] text-white/25">No active assignments.</span>
              </div>
            )}

            {/* Expanded list */}
            {expandedPipelineStatus && interviewPipeline[expandedPipelineStatus] && (() => {
              const items = interviewPipeline[expandedPipelineStatus]
              const statusConfig = statusOrder.find(s => s.key === expandedPipelineStatus)
              return (
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  {items.map((r) => (
                    <div
                      key={r.assignment_id}
                      className="w-full px-3 py-1.5 flex items-center justify-between"
                    >
                      <div
                        className={`flex-1 min-w-0 ${statusConfig?.actionable ? "cursor-pointer hover:opacity-80" : ""}`}
                        onClick={() => {
                          if (statusConfig?.actionable) {
                            setActiveReview({ assignmentId: r.assignment_id, discrepancyId: r.discrepancy_id })
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-medium" style={{ color: statusConfig?.color }}>{r.tail}</span>
                          <span className="text-[9px] text-white/70 truncate">{r.title}</span>
                        </div>
                        <span className="text-[9px] text-white/40">{r.technician}</span>
                        {r.completed_at && (
                          <span className="text-[9px] text-white/25 ml-1.5">
                            {new Date(r.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {statusConfig?.actionLabel && (
                          <button
                            onClick={() => setActiveReview({ assignmentId: r.assignment_id, discrepancyId: r.discrepancy_id })}
                            className="text-[8px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded transition-all hover:brightness-125"
                            style={{ color: statusConfig.color, background: statusConfig.bg, border: `1px solid ${statusConfig.color.replace(/[\d.]+\)$/, "0.25)")}` }}
                          >
                            {statusConfig.actionLabel}
                          </button>
                        )}
                        {pipelineDeleteId === r.assignment_id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deletePipelineItem(r.assignment_id, r.discrepancy_id)}
                              className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded font-semibold transition-all hover:brightness-125"
                              style={{ color: "rgba(255,100,100,0.9)", background: "rgba(255,100,100,0.12)", border: "1px solid rgba(255,100,100,0.3)" }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setPipelineDeleteId(null)}
                              className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded font-semibold text-white/40 hover:text-white/70 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPipelineDeleteId(r.assignment_id)}
                            className="flex items-center gap-1 text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded font-semibold transition-all hover:brightness-125"
                            style={{ color: "rgba(255,100,100,0.5)", background: "rgba(255,100,100,0.05)", border: "1px solid rgba(255,100,100,0.1)" }}
                          >
                            <Trash2 size={9} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* Fleet */}
      {isLoading && <LoadingSkeleton />}
      {isError && (
        <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
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

      {/* DW1GHT Intel Panel */}
      <Dw1ghtIntelPanel open={dw1ghtOpen} onClose={() => setDw1ghtOpen(false)} mode={dw1ghtMode} onModeChange={setDw1ghtMode} />

    </div>
  )
}
