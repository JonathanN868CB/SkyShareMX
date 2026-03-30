import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Compass, Unlink, CalendarDays, Target, CheckSquare, BookOpen,
  ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle,
  Plus, Send, Lock, Briefcase,
} from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/shared/ui/card"
import { Button } from "@/shared/ui/button"
import { Textarea } from "@/shared/ui/textarea"
import { useAuth } from "@/features/auth"
import { mxlms } from "@/lib/supabase-mxlms"
import type {
  MxlmsSession,
  MxlmsGoal,
  MxlmsActionItem,
  MxlmsCareerInterests,
  MxlmsJournalEntry,
  MxlmsJournalInsert,
} from "@/entities/mxlms"

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchSessions(): Promise<MxlmsSession[]> {
  const { data, error } = await mxlms
    .from("sessions")
    .select("id,technician_id,session_number,session_year,status,conducted_date,scheduled_date,wins,concerns,next_quarter_focus,end_summary,drive_url,created_at")
    .order("session_year", { ascending: false })
    .order("session_number", { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as MxlmsSession[]
}

async function fetchGoals(): Promise<MxlmsGoal[]> {
  const { data, error } = await mxlms
    .from("technician_goals")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsGoal[]
}

async function fetchActionItems(): Promise<MxlmsActionItem[]> {
  const { data, error } = await mxlms
    .from("action_items")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsActionItem[]
}

async function fetchCareerInterests(): Promise<MxlmsCareerInterests | null> {
  const { data, error } = await mxlms
    .from("career_interests")
    .select("*")
    .maybeSingle()
  if (error) throw error
  return data as MxlmsCareerInterests | null
}

async function fetchJournal(): Promise<MxlmsJournalEntry[]> {
  const { data, error } = await mxlms
    .from("technician_journal")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as MxlmsJournalEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Date-only strings (YYYY-MM-DD) must be parsed as local noon, not UTC midnight,
// otherwise UTC→local conversion shifts the display date back one day.
function parseDate(str: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(str)
    ? new Date(str + "T12:00:00")
    : new Date(str)
}

function formatDate(str: string | null): string {
  if (!str?.trim()) return "—"
  const d = parseDate(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateRelative(str: string | null): string {
  if (!str?.trim()) return "—"
  const d = parseDate(str)
  if (isNaN(d.getTime())) return str
  const diff = Math.floor((d.getTime() - Date.now()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  if (diff > 0 && diff <= 14) return `In ${diff} days`
  if (diff < 0 && diff >= -14) return `${Math.abs(diff)} days ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── Not Linked ───────────────────────────────────────────────────────────────

function NotLinked() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="h-14 w-14 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Unlink className="h-6 w-6" style={{ color: "rgba(255,255,255,0.2)" }} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-white/60">Journey profile not connected</p>
        <p className="text-xs text-white/30 max-w-xs leading-relaxed" style={{ fontFamily: "var(--font-heading)" }}>
          Your manager links your account to MX-LMS from User Administration.
          Once connected, your review history, goals, and journal will appear here.
        </p>
      </div>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  sub,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType
  title: string
  sub?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="card-elevated border-0 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded flex items-center justify-center shrink-0"
            style={{ background: "rgba(212,160,23,0.1)" }}>
            <Icon className="h-4 w-4" style={{ color: "var(--skyshare-gold)" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/80" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
              {title}
            </h2>
            {sub && (
              <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>{sub}</p>
            )}
          </div>
        </div>
        <ChevronDown
          className="h-4 w-4 text-white/25 shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {open && children}
    </Card>
  )
}

// ─── Next Review Card ─────────────────────────────────────────────────────────

function NextReviewCard({ sessions, loading }: { sessions: MxlmsSession[]; loading: boolean }) {
  const next = sessions.find(s => (s.status === "scheduled" || s.status === "pending") && s.scheduled_date)
  const last = sessions.find(s => s.status === "completed")

  if (loading) {
    return (
      <div className="px-5 py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
        Loading…
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
      {/* Next session */}
      <div className="rounded-lg p-4 space-y-1"
        style={{
          background: next ? "rgba(212,160,23,0.07)" : "rgba(255,255,255,0.03)",
          border: next ? "1px solid rgba(212,160,23,0.18)" : "1px solid rgba(255,255,255,0.07)",
        }}>
        <p className="text-[10px] uppercase tracking-wider text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
          Next Review
        </p>
        {next ? (
          <>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--skyshare-gold)" }}>
              {formatDateRelative(next.scheduled_date)}
            </p>
            <p className="text-xs text-white/45">
              Session {next.session_number}
              {next.session_year ? ` · ${next.session_year}` : ""}
              <span className="ml-2 text-white/25">{formatDate(next.scheduled_date)}</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-white/25">Not yet scheduled</p>
        )}
      </div>

      {/* Last session */}
      <div className="rounded-lg p-4 space-y-1"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[10px] uppercase tracking-wider text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
          Last Review
        </p>
        {last ? (
          <>
            <p className="text-2xl font-bold text-white/70" style={{ fontFamily: "var(--font-display)" }}>
              {formatDate(last.conducted_date)}
            </p>
            <p className="text-xs text-white/35">
              Session {last.session_number}
              {last.session_year ? ` · ${last.session_year}` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-white/25">No completed sessions</p>
        )}
      </div>
    </div>
  )
}

// ─── Session History ──────────────────────────────────────────────────────────

function SessionHistory({ sessions }: { sessions: MxlmsSession[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const completed = sessions.filter(s => s.status === "completed")

  if (completed.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
        No completed sessions yet.
      </div>
    )
  }

  return (
    <div>
      {completed.map(s => {
        const isOpen = expandedId === s.id
        const hasDetail = !!(s.wins || s.concerns || s.next_quarter_focus || s.end_summary)
        return (
          <div key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <button
              onClick={() => hasDetail && setExpandedId(isOpen ? null : s.id)}
              className="w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
            >
              {hasDetail ? (
                isOpen ? <ChevronDown size={13} className="text-white/30 shrink-0" /> : <ChevronRight size={13} className="text-white/30 shrink-0" />
              ) : (
                <span className="w-[13px] shrink-0" />
              )}
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <span className="text-sm text-white/70">
                  Session {s.session_number}
                  {s.session_year ? <span className="text-white/30 ml-1">· {s.session_year}</span> : null}
                </span>
              </div>
              {s.drive_url && (
                <a
                  href={s.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-[10px] uppercase tracking-wider transition-opacity hover:opacity-70 shrink-0"
                  style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
                >
                  View Report →
                </a>
              )}
              <span className="text-xs text-white/35 shrink-0">{formatDate(s.conducted_date)}</span>
            </button>

            {isOpen && hasDetail && (
              <div className="px-12 pb-4 space-y-3" style={{ background: "rgba(255,255,255,0.015)" }}>
                {s.wins && (
                  <DetailField label="Wins" value={s.wins} />
                )}
                {s.concerns && (
                  <DetailField label="Concerns" value={s.concerns} />
                )}
                {s.next_quarter_focus && (
                  <DetailField label="Next Quarter Focus" value={s.next_quarter_focus} />
                )}
                {s.end_summary && (
                  <DetailField label="Summary" value={s.end_summary} />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] uppercase tracking-wider text-white/25 mt-0.5 shrink-0"
        style={{ fontFamily: "var(--font-heading)", minWidth: 110 }}>
        {label}
      </span>
      <p className="text-xs text-white/55 leading-relaxed">{value}</p>
    </div>
  )
}

// ─── Goals ────────────────────────────────────────────────────────────────────

function GoalStatusIcon({ status }: { status: string }) {
  if (status === "closed" || status === "completed") {
    return <CheckCircle2 size={14} style={{ color: "var(--skyshare-success, #10b981)", flexShrink: 0 }} />
  }
  return <Circle size={14} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
}

function GoalsPanel({ goals, loading }: { goals: MxlmsGoal[]; loading: boolean }) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const open   = goals.filter(g => g.status === "open")
  const closed = goals.filter(g => g.status !== "open")

  if (loading) return <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>Loading…</div>
  if (goals.length === 0) return <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>No goals on record yet.</div>

  function GoalRow({ goal }: { goal: MxlmsGoal }) {
    const isOpen = expandedId === goal.id
    const hasDetail = !!(goal.why_it_matters || goal.success_criteria || goal.target_timing || goal.close_note)

    return (
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <button
          onClick={() => hasDetail && setExpandedId(isOpen ? null : goal.id)}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        >
          <GoalStatusIcon status={goal.status} />
          <span className="flex-1 text-sm min-w-0 truncate"
            style={{ color: goal.status === "open" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)" }}>
            {goal.title}
          </span>
          {goal.target_timing && (
            <span className="text-[11px] text-white/25 shrink-0 mr-1" style={{ fontFamily: "var(--font-heading)" }}>
              {goal.target_timing}
            </span>
          )}
          {hasDetail && (
            isOpen ? <ChevronDown size={12} className="text-white/20 shrink-0" /> : <ChevronRight size={12} className="text-white/20 shrink-0" />
          )}
        </button>

        {isOpen && hasDetail && (
          <div className="px-12 pb-4 space-y-2.5" style={{ background: "rgba(255,255,255,0.015)" }}>
            {goal.why_it_matters && <DetailField label="Why It Matters" value={goal.why_it_matters} />}
            {goal.success_criteria && <DetailField label="Success Criteria" value={goal.success_criteria} />}
            {goal.close_note && <DetailField label="Outcome" value={goal.close_note} />}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {open.length > 0 && (
        <div>
          <div className="px-5 pt-3 pb-1">
            <span className="text-[10px] uppercase tracking-wider text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
              Active · {open.length}
            </span>
          </div>
          {open.map(g => <GoalRow key={g.id} goal={g} />)}
        </div>
      )}
      {closed.length > 0 && (
        <div>
          <div className="px-5 pt-4 pb-1">
            <span className="text-[10px] uppercase tracking-wider text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
              Completed · {closed.length}
            </span>
          </div>
          {closed.map(g => <GoalRow key={g.id} goal={g} />)}
        </div>
      )}
      <div className="px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
          {goals.length} goal{goals.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}

// ─── Action Items ─────────────────────────────────────────────────────────────

function ActionItemsPanel({ items, loading }: { items: MxlmsActionItem[]; loading: boolean }) {
  if (loading) return <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>Loading…</div>
  if (items.length === 0) return <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>No action items on record.</div>

  const open   = items.filter(i => i.status === "open")
  const closed = items.filter(i => i.status !== "open")

  function ActionRow({ item }: { item: MxlmsActionItem }) {
    const isOverdue = item.status === "open" && item.due_date && new Date(item.due_date) < new Date()
    return (
      <div className="flex items-start gap-3 px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {item.status === "open" ? (
          isOverdue
            ? <AlertCircle size={14} style={{ color: "#e05070", flexShrink: 0, marginTop: 2 }} />
            : <Circle size={14} style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0, marginTop: 2 }} />
        ) : (
          <CheckCircle2 size={14} style={{ color: "var(--skyshare-success, #10b981)", flexShrink: 0, marginTop: 2 }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug"
            style={{ color: item.status === "open" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.30)" }}>
            {item.description}
          </p>
          <div className="flex items-center gap-3 mt-1">
            {item.owner && (
              <span className="text-[10px] text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
                Owner: {item.owner}
              </span>
            )}
            {item.due_date && (
              <span className="text-[10px]" style={{
                fontFamily: "var(--font-heading)",
                color: isOverdue ? "#e05070" : "rgba(255,255,255,0.25)",
              }}>
                Due: {formatDate(item.due_date)}
              </span>
            )}
            {item.related_topic && (
              <span className="text-[10px] text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
                · {item.related_topic}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {open.length > 0 && (
        <div>
          <div className="px-5 pt-3 pb-1">
            <span className="text-[10px] uppercase tracking-wider text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
              Open · {open.length}
            </span>
          </div>
          {open.map(i => <ActionRow key={i.id} item={i} />)}
        </div>
      )}
      {closed.length > 0 && (
        <div>
          <div className="px-5 pt-4 pb-1">
            <span className="text-[10px] uppercase tracking-wider text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
              Closed · {closed.length}
            </span>
          </div>
          {closed.map(i => <ActionRow key={i.id} item={i} />)}
        </div>
      )}
    </div>
  )
}

// ─── Career Interests ─────────────────────────────────────────────────────────

function CareerPanel({ interests, loading }: { interests: MxlmsCareerInterests | null; loading: boolean }) {
  if (loading) return <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>Loading…</div>
  if (!interests || (!interests.specialty_interests && !interests.leadership_interests && !interests.role_progression)) {
    return <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>No career interests on record yet — discuss with your manager at your next review.</div>
  }

  return (
    <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
      {interests.specialty_interests && (
        <div className="rounded-lg p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] uppercase tracking-wider text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
            Specialty Interests
          </p>
          <p className="text-sm text-white/65 leading-relaxed">{interests.specialty_interests}</p>
        </div>
      )}
      {interests.leadership_interests && (
        <div className="rounded-lg p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] uppercase tracking-wider text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
            Leadership Interests
          </p>
          <p className="text-sm text-white/65 leading-relaxed">{interests.leadership_interests}</p>
        </div>
      )}
      {interests.role_progression && (
        <div className="rounded-lg p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[10px] uppercase tracking-wider text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
            Role Progression
          </p>
          <p className="text-sm text-white/65 leading-relaxed">{interests.role_progression}</p>
        </div>
      )}
    </div>
  )
}

// ─── Journal ──────────────────────────────────────────────────────────────────

const ENTRY_TYPES = [
  { value: "note",        label: "Note" },
  { value: "win",         label: "Win" },
  { value: "concern",     label: "Concern" },
  { value: "reflection",  label: "Reflection" },
  { value: "goal-update", label: "Goal Update" },
]

function entryTypeStyle(type: string) {
  switch (type) {
    case "win":         return { bg: "rgba(16,185,129,0.1)",  color: "#10b981", border: "rgba(16,185,129,0.2)" }
    case "concern":     return { bg: "rgba(193,2,48,0.1)",    color: "#e05070", border: "rgba(193,2,48,0.2)" }
    case "reflection":  return { bg: "rgba(70,100,129,0.15)", color: "var(--skyshare-blue-mid, #4e7fa0)", border: "rgba(70,100,129,0.25)" }
    case "goal-update": return { bg: "rgba(212,160,23,0.1)",  color: "var(--skyshare-gold)", border: "rgba(212,160,23,0.2)" }
    default:            return { bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.1)" }
  }
}

function JournalPanel({
  entries,
  loading,
  techId,
  userId,
  onSuccess,
}: {
  entries: MxlmsJournalEntry[]
  loading: boolean
  techId: number
  userId: string
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [text, setText] = useState("")
  const [entryType, setEntryType] = useState("note")
  const [visibleToManager, setVisibleToManager] = useState(true)

  const addEntry = useMutation({
    mutationFn: async () => {
      const payload: MxlmsJournalInsert = {
        technician_id: techId,
        author_user_id: userId,
        entry_date: new Date().toISOString().split("T")[0],
        entry_type: entryType,
        content: text.trim(),
        visible_to_manager: visibleToManager,
      }
      const { error } = await mxlms.from("technician_journal").insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      setText("")
      setEntryType("note")
      toast.success("Journal entry saved")
      qc.invalidateQueries({ queryKey: ["my-journey-journal"] })
      onSuccess()
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save entry"),
  })

  const canSubmit = text.trim().length > 0 && !addEntry.isPending

  return (
    <div>
      {/* New entry composer */}
      <div className="p-5 space-y-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Textarea
          placeholder="Write a journal entry… wins, reflections, concerns, anything you want to remember."
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          className="resize-none text-sm text-white/80 placeholder:text-white/20"
          style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "var(--font-body)" }}
        />

        <div className="flex items-center justify-between gap-3">
          {/* Type selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {ENTRY_TYPES.map(t => {
              const style = entryTypeStyle(t.value)
              const active = entryType === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => setEntryType(t.value)}
                  className="px-2.5 py-1 rounded text-[10px] font-semibold tracking-wider uppercase transition-all"
                  style={{
                    fontFamily: "var(--font-heading)",
                    background: active ? style.bg : "transparent",
                    color: active ? style.color : "rgba(255,255,255,0.25)",
                    border: `1px solid ${active ? style.border : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Visibility toggle */}
            <button
              onClick={() => setVisibleToManager(v => !v)}
              className="flex items-center gap-1.5 text-[10px] transition-colors"
              style={{
                fontFamily: "var(--font-heading)",
                color: visibleToManager ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
              }}
              title={visibleToManager ? "Visible to manager — click to make private" : "Private — click to share with manager"}
            >
              <Lock size={10} />
              {visibleToManager ? "Shared" : "Private"}
            </button>

            {/* Submit */}
            <Button
              size="sm"
              disabled={!canSubmit}
              onClick={() => addEntry.mutate()}
              className="gap-1.5 h-7 text-xs"
              style={{
                background: canSubmit ? "var(--skyshare-gold)" : "rgba(212,160,23,0.25)",
                color: canSubmit ? "hsl(0 0% 8%)" : "rgba(0,0,0,0.3)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.08em",
                border: "none",
              }}
            >
              <Send size={11} />
              {addEntry.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Entry list */}
      {loading ? (
        <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
          No journal entries yet. Write your first one above.
        </div>
      ) : (
        <div>
          {entries.map(entry => {
            const typeStyle = entryTypeStyle(entry.entry_type)
            return (
              <div key={entry.id} className="flex gap-4 px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {/* Date */}
                <div className="shrink-0 text-right" style={{ minWidth: 60 }}>
                  <p className="text-[10px] text-white/25 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
                    {new Date(entry.entry_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-[9px] text-white/15" style={{ fontFamily: "var(--font-heading)" }}>
                    {new Date(entry.entry_date).getFullYear()}
                  </p>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase"
                      style={{
                        fontFamily: "var(--font-heading)",
                        background: typeStyle.bg,
                        color: typeStyle.color,
                        border: `1px solid ${typeStyle.border}`,
                      }}>
                      {entry.entry_type}
                    </span>
                    {!entry.visible_to_manager && (
                      <span className="flex items-center gap-0.5 text-[9px] text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
                        <Lock size={8} /> Private
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                </div>
              </div>
            )
          })}
          <div className="px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
              {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyJourney() {
  const { profile } = useAuth()
  const techId = profile?.mxlms_technician_id ?? null
  const userId = profile?.user_id ?? ""

  const { data: sessions = [],  isLoading: ls } = useQuery({ queryKey: ["my-journey-sessions",  techId], queryFn: fetchSessions,       enabled: !!techId })
  const { data: goals = [],     isLoading: lg } = useQuery({ queryKey: ["my-journey-goals",     techId], queryFn: fetchGoals,          enabled: !!techId })
  const { data: items = [],     isLoading: li } = useQuery({ queryKey: ["my-journey-items",     techId], queryFn: fetchActionItems,    enabled: !!techId })
  const { data: interests,      isLoading: lc } = useQuery({ queryKey: ["my-journey-career",    techId], queryFn: fetchCareerInterests, enabled: !!techId })
  const { data: journal = [],   isLoading: lj, refetch: refetchJournal } = useQuery({ queryKey: ["my-journey-journal",  techId], queryFn: fetchJournal,        enabled: !!techId })

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="hero-area">
        <div className="flex items-center gap-3">
          <Compass className="h-8 w-8" style={{ color: "var(--skyshare-gold)" }} />
          <div>
            <h1 className="text-[2.6rem] leading-none text-foreground"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
              MY JOURNEY™
            </h1>
            <div className="mt-1.5" style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }} />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground"
          style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          Your professional growth — reviews, goals, and your story
        </p>
      </div>

      {!techId ? (
        <Card className="card-elevated border-0">
          <NotLinked />
        </Card>
      ) : (
        <>
          {/* Disclaimer */}
          <div className="rounded-lg px-5 py-4"
            style={{ background: "rgba(70,100,129,0.10)", border: "1px solid rgba(70,100,129,0.18)" }}>
            <p className="text-xs leading-relaxed text-white/45" style={{ fontFamily: "var(--font-heading)" }}>
              Your 4-1-1 review sessions are where most of this is built — goals, action items, and session notes
              are added by your manager during each review. Journal entries you write and mark
              as <strong className="text-white/65">Shared</strong> will be visible to your manager
              and become part of your professional record.
            </p>
          </div>

          {/* Journal — moved to top */}
          <Section icon={BookOpen} title="My Journal" sub="Notes, wins, and reflections">
            <JournalPanel
              entries={journal}
              loading={lj}
              techId={techId}
              userId={userId}
              onSuccess={() => refetchJournal()}
            />
          </Section>

          {/* Review Schedule */}
          <Section icon={CalendarDays} title="Review Schedule" sub="Upcoming and past 4-1-1 sessions">
            <NextReviewCard sessions={sessions} loading={ls} />
            {sessions.filter(s => s.status === "completed").length > 0 && (
              <>
                <div className="px-5 pt-1 pb-1">
                  <span className="text-[10px] uppercase tracking-wider text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
                    Session History
                  </span>
                </div>
                <SessionHistory sessions={sessions} />
              </>
            )}
          </Section>

          {/* Goals */}
          <Section icon={Target} title="Goals" sub={`${goals.filter(g => g.status === "open").length} active`}>
            <GoalsPanel goals={goals} loading={lg} />
          </Section>

          {/* Action Items */}
          <Section icon={CheckSquare} title="Action Items" sub={`${items.filter(i => i.status === "open").length} open`}>
            <ActionItemsPanel items={items} loading={li} />
          </Section>

          {/* Career Interests */}
          <Section icon={Briefcase} title="Career Interests" sub="Captured from your 4-1-1 reviews" defaultOpen={false}>
            <CareerPanel interests={interests ?? null} loading={lc} />
          </Section>
        </>
      )}
    </div>
  )
}
