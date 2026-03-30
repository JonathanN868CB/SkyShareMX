import { useState, Fragment } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  GraduationCap, AlertCircle, Clock, Target, CheckSquare,
  BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText, Users, CheckCircle2, Plus,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { supabase } from "@/lib/supabase"
import { mxlms } from "@/lib/supabase-mxlms"
import { useAuth } from "@/features/auth"
import type { Profile } from "@/entities/supabase"
import type {
  MxlmsTechnician, MxlmsPendingCompletion,
  MxlmsSession, MxlmsGoal, MxlmsActionItem, MxlmsJournalEntry,
} from "@/entities/mxlms"
import { RecordAdHocEventModal } from "@/components/training/RecordAdHocEventModal"

// ─── Lightweight training row (no join needed for aggregate stats) ─────────────

interface TrainingRow {
  id: number
  technician_id: number
  status: string
  due_date: string | null
  training_items?: { name: string } | null
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .not("status", "eq", "Pending")
    .order("full_name", { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

async function fetchTechnicians(): Promise<MxlmsTechnician[]> {
  const { data, error } = await mxlms
    .from("technicians")
    .select("id,name,tech_code,role,email")
    .order("name")
  if (error) throw error
  return (data ?? []) as MxlmsTechnician[]
}

async function fetchAllTraining(): Promise<TrainingRow[]> {
  const { data, error } = await mxlms
    .from("technician_training")
    .select("id,technician_id,status,due_date,training_items(name)")
    .order("due_date", { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as TrainingRow[]
}

async function fetchAllPending(): Promise<MxlmsPendingCompletion[]> {
  const { data, error } = await mxlms
    .from("pending_completions")
    .select("*")
    .eq("status", "pending")
    .order("detected_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsPendingCompletion[]
}

async function fetchAllSessions(): Promise<MxlmsSession[]> {
  const { data, error } = await mxlms
    .from("sessions")
    .select("id,technician_id,session_number,session_year,status,conducted_date,scheduled_date")
    .order("conducted_date", { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as MxlmsSession[]
}

async function fetchAllGoals(): Promise<Pick<MxlmsGoal, "id" | "technician_id" | "status">[]> {
  const { data, error } = await mxlms
    .from("technician_goals")
    .select("id,technician_id,status")
  if (error) throw error
  return (data ?? []) as Pick<MxlmsGoal, "id" | "technician_id" | "status">[]
}

async function fetchAllActions(): Promise<Pick<MxlmsActionItem, "id" | "technician_id" | "status" | "due_date">[]> {
  const { data, error } = await mxlms
    .from("action_items")
    .select("id,technician_id,status,due_date")
  if (error) throw error
  return (data ?? []) as Pick<MxlmsActionItem, "id" | "technician_id" | "status" | "due_date">[]
}

async function fetchSharedJournal(): Promise<MxlmsJournalEntry[]> {
  const { data, error } = await mxlms
    .from("technician_journal")
    .select("*")
    .eq("visible_to_manager", true)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as MxlmsJournalEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = new Date()

function isOverdue(row: TrainingRow): boolean {
  return (
    row.due_date != null &&
    new Date(row.due_date) < today &&
    !row.status.toLowerCase().includes("complete")
  )
}

function formatDate(str: string | null | undefined): string {
  if (!str?.trim()) return "—"
  const d = new Date(str)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateShort(str: string | null | undefined): string {
  if (!str?.trim()) return "—"
  const d = new Date(str)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function entryTypeStyle(type: string) {
  switch (type) {
    case "win":         return { bg: "rgba(16,185,129,0.1)",   color: "#10b981",                           border: "rgba(16,185,129,0.2)" }
    case "concern":     return { bg: "rgba(193,2,48,0.1)",     color: "#e05070",                           border: "rgba(193,2,48,0.2)" }
    case "reflection":  return { bg: "rgba(70,100,129,0.15)",  color: "var(--skyshare-blue-mid, #4e7fa0)", border: "rgba(70,100,129,0.25)" }
    case "goal-update": return { bg: "rgba(212,160,23,0.1)",   color: "var(--skyshare-gold)",              border: "rgba(212,160,23,0.2)" }
    default:            return { bg: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)",             border: "rgba(255,255,255,0.1)" }
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string
  value: number | string
  accent: string
  icon: React.ElementType
}) {
  return (
    <div className="card-elevated rounded-lg px-5 py-4 flex items-start gap-3"
      style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="h-8 w-8 rounded flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${accent}18` }}>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5" style={{ fontFamily: "var(--font-heading)" }}>
          {label}
        </p>
        <p className="text-3xl font-bold leading-none" style={{ fontFamily: "var(--font-display)", color: accent }}>
          {value}
        </p>
      </div>
    </div>
  )
}

// ─── Pending Completions Inbox ────────────────────────────────────────────────

function PendingInbox({
  pending,
  techMap,
}: {
  pending: MxlmsPendingCompletion[]
  techMap: Map<number, MxlmsTechnician>
}) {
  if (pending.length === 0) return null

  return (
    <div className="card-elevated rounded-lg overflow-hidden"
      style={{ borderLeft: "3px solid rgba(212,160,23,0.7)" }}>
      <div className="px-5 py-3.5 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(212,160,23,0.05)" }}>
        <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--skyshare-gold)" }} />
        <div className="flex-1">
          <p className="text-xs font-semibold text-white/70" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
            PENDING DOC REVIEWS
          </p>
          <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
            {pending.length} submission{pending.length !== 1 ? "s" : ""} awaiting review in MX-LMS
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Team Member", "File", "Submitted", ""].map(h => (
                <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.5 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pending.map(p => {
              const tech = techMap.get(p.technician_id)
              return (
                <tr key={p.id} className="transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-5 py-3">
                    <p className="text-sm text-white/75">{tech?.name ?? `Tech #${p.technician_id}`}</p>
                    {tech?.tech_code && (
                      <p className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>{tech.tech_code}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-white/60 truncate max-w-[220px]">{p.file_name ?? "—"}</p>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs text-white/40" style={{ fontFamily: "var(--font-heading)" }}>
                      {formatDate(p.detected_at)}
                    </p>
                  </td>
                  <td className="px-5 py-3 pr-6 text-right">
                    {p.storage_url && (
                      <a
                        href={p.storage_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider transition-opacity hover:opacity-70"
                        style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
                      >
                        <ExternalLink size={10} />
                        View
                      </a>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Per-tech stat badges ──────────────────────────────────────────────────────

function NumBadge({ n, accent, zero = "—" }: { n: number; accent: string; zero?: string }) {
  if (n === 0) return <span className="text-xs text-white/25">{zero}</span>
  return (
    <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded text-[10px] font-bold"
      style={{ background: `${accent}22`, color: accent, fontFamily: "var(--font-heading)" }}>
      {n}
    </span>
  )
}

// ─── Team Overview Table ──────────────────────────────────────────────────────

function TeamOverviewTable({
  profiles,
  techMap,
  training,
  pending,
  sessions,
  goals,
  actions,
}: {
  profiles: Profile[]
  techMap: Map<number, MxlmsTechnician>
  training: TrainingRow[]
  pending: MxlmsPendingCompletion[]
  sessions: MxlmsSession[]
  goals: Pick<MxlmsGoal, "id" | "technician_id" | "status">[]
  actions: Pick<MxlmsActionItem, "id" | "technician_id" | "status" | "due_date">[]
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Build per-tech maps
  const trainingByTech  = new Map<number, TrainingRow[]>()
  const pendingByTech   = new Map<number, number>()
  const sessionsByTech  = new Map<number, MxlmsSession[]>()
  const goalsByTech     = new Map<number, number>()
  const actionsByTech   = new Map<number, { open: number; overdue: number }>()

  for (const row of training) {
    const arr = trainingByTech.get(row.technician_id) ?? []
    arr.push(row)
    trainingByTech.set(row.technician_id, arr)
  }
  for (const p of pending) {
    pendingByTech.set(p.technician_id, (pendingByTech.get(p.technician_id) ?? 0) + 1)
  }
  for (const s of sessions) {
    const arr = sessionsByTech.get(s.technician_id) ?? []
    arr.push(s)
    sessionsByTech.set(s.technician_id, arr)
  }
  for (const g of goals) {
    if (g.status === "open") {
      goalsByTech.set(g.technician_id, (goalsByTech.get(g.technician_id) ?? 0) + 1)
    }
  }
  for (const a of actions) {
    if (a.status === "open") {
      const cur = actionsByTech.get(a.technician_id) ?? { open: 0, overdue: 0 }
      cur.open++
      if (a.due_date && new Date(a.due_date) < today) cur.overdue++
      actionsByTech.set(a.technician_id, cur)
    }
  }

  const linked   = profiles.filter(p => p.mxlms_technician_id != null)
  const unlinked = profiles.filter(p => p.mxlms_technician_id == null)
  const sorted   = [...linked, ...unlinked]

  return (
    <div className="card-elevated rounded-lg overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Users className="h-4 w-4 shrink-0 text-white/30" />
        <p className="text-xs font-semibold text-white/50" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
          TEAM OVERVIEW
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["Member", "Training", "Pending Docs", "Last 4-1-1", "Next 4-1-1", "Goals", "Actions"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.55 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(profile => {
              const techId   = profile.mxlms_technician_id
              const tech     = techId ? techMap.get(techId) : null
              const isLinked = techId != null

              if (!isLinked) {
                return (
                  <tr key={profile.id} className="transition-colors hover:bg-white/[0.01]"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: 0.4 }}>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-white/50">{profile.full_name ?? "—"}</p>
                      <p className="text-[10px] text-white/25" style={{ fontFamily: "var(--font-heading)" }}>{profile.role}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-white/20" colSpan={6} style={{ fontFamily: "var(--font-heading)" }}>
                      Not linked to MX-LMS
                    </td>
                  </tr>
                )
              }

              const techTraining = trainingByTech.get(techId) ?? []
              const overdueCount = techTraining.filter(isOverdue).length
              const totalCount   = techTraining.length
              const pendingCount = pendingByTech.get(techId) ?? 0
              const techSessions = sessionsByTech.get(techId) ?? []
              const lastSession  = techSessions.find(s => s.status === "completed")
              const nextSession  = techSessions.find(s => s.status === "scheduled" && s.scheduled_date)
              const openGoals    = goalsByTech.get(techId) ?? 0
              const actionStats  = actionsByTech.get(techId) ?? { open: 0, overdue: 0 }
              const isExpanded   = expandedId === profile.id

              return (
                <Fragment key={profile.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                    className="transition-colors hover:bg-white/[0.025] cursor-pointer"
                    style={{ borderBottom: isExpanded ? "none" : "1px solid rgba(255,255,255,0.04)" }}
                  >
                    {/* Member */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded flex items-center justify-center shrink-0 transition-colors"
                          style={{ background: isExpanded ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.06)" }}>
                          {isExpanded
                            ? <ChevronDown size={13} style={{ color: "var(--skyshare-gold)" }} />
                            : <ChevronRight size={13} style={{ color: "rgba(255,255,255,0.4)" }} />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white/80">{profile.full_name ?? tech?.name ?? "—"}</p>
                          <p className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                            {tech?.tech_code ?? profile.role}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Training */}
                    <td className="px-5 py-3.5">
                      {totalCount === 0 ? (
                        <span className="text-xs text-white/20">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {overdueCount > 0 && (
                            <NumBadge n={overdueCount} accent="#e05070" />
                          )}
                          <span className="text-xs text-white/35" style={{ fontFamily: "var(--font-heading)" }}>
                            {overdueCount > 0 ? `overdue` : `current`}
                            <span className="ml-1 text-white/20">/ {totalCount}</span>
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Pending docs */}
                    <td className="px-5 py-3.5">
                      <NumBadge n={pendingCount} accent="var(--skyshare-gold)" />
                    </td>

                    {/* Last 4-1-1 */}
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-white/40" style={{ fontFamily: "var(--font-heading)" }}>
                        {lastSession ? formatDateShort(lastSession.conducted_date) : "—"}
                      </span>
                    </td>

                    {/* Next 4-1-1 */}
                    <td className="px-5 py-3.5">
                      {nextSession ? (
                        <span className="text-xs font-medium" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
                          {formatDateShort(nextSession.scheduled_date)}
                        </span>
                      ) : (
                        <span className="text-xs text-white/20">—</span>
                      )}
                    </td>

                    {/* Goals */}
                    <td className="px-5 py-3.5">
                      <NumBadge n={openGoals} accent="var(--skyshare-success, #10b981)" />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      {actionStats.overdue > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={12} style={{ color: "#e05070" }} />
                          <NumBadge n={actionStats.overdue} accent="#e05070" />
                          {actionStats.open > actionStats.overdue && (
                            <span className="text-[10px] text-white/20">+{actionStats.open - actionStats.overdue}</span>
                          )}
                        </div>
                      ) : (
                        <NumBadge n={actionStats.open} accent="rgba(255,255,255,0.3)" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr key={`${profile.id}-detail`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td colSpan={7} className="px-8 pb-4 pt-2" style={{ background: "rgba(255,255,255,0.012)" }}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                          {/* Sessions */}
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                              Session History
                            </p>
                            {techSessions.filter(s => s.status === "completed").length === 0 ? (
                              <p className="text-xs text-white/20">No completed sessions</p>
                            ) : (
                              <div className="space-y-1">
                                {techSessions.filter(s => s.status === "completed").slice(0, 5).map(s => (
                                  <div key={s.id} className="flex items-center justify-between gap-4">
                                    <span className="text-xs text-white/45">
                                      Session {s.session_number}
                                      {s.session_year ? <span className="text-white/25"> · {s.session_year}</span> : null}
                                    </span>
                                    <span className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                                      {formatDateShort(s.conducted_date)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* All assigned training */}
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                              Assigned Training · {totalCount}
                            </p>
                            {totalCount === 0 ? (
                              <p className="text-xs text-white/20">No assignments</p>
                            ) : (
                              <div className="space-y-1.5">
                                {techTraining.map(t => {
                                  const complete = t.status.toLowerCase().includes("complete")
                                  const overdue  = isOverdue(t)
                                  return (
                                    <div key={t.id} className="flex items-start gap-2">
                                      {complete
                                        ? <CheckCircle2 size={10} style={{ color: "var(--skyshare-success, #10b981)", marginTop: 2, flexShrink: 0 }} />
                                        : overdue
                                        ? <AlertCircle size={10} style={{ color: "#e05070", marginTop: 2, flexShrink: 0 }} />
                                        : <Clock size={10} style={{ color: "rgba(255,255,255,0.2)", marginTop: 2, flexShrink: 0 }} />}
                                      <div className="min-w-0">
                                        <p className="text-xs leading-snug"
                                          style={{ color: complete ? "rgba(255,255,255,0.25)" : overdue ? "#e07090" : "rgba(255,255,255,0.55)" }}>
                                          {t.training_items?.name ?? `Item #${t.id}`}
                                        </p>
                                        {t.due_date && !complete && (
                                          <p className="text-[10px]" style={{ fontFamily: "var(--font-heading)", color: overdue ? "#e05070" : "rgba(255,255,255,0.2)" }}>
                                            Due {formatDateShort(t.due_date)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Goals + actions summary */}
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                              Development
                            </p>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Target size={11} style={{ color: "var(--skyshare-success, #10b981)" }} />
                                <span className="text-xs text-white/45">{openGoals} open goal{openGoals !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckSquare size={11} style={{ color: actionStats.overdue > 0 ? "#e05070" : "rgba(255,255,255,0.3)" }} />
                                <span className="text-xs text-white/45">
                                  {actionStats.open} open action{actionStats.open !== 1 ? "s" : ""}
                                  {actionStats.overdue > 0 && (
                                    <span style={{ color: "#e05070" }}> · {actionStats.overdue} overdue</span>
                                  )}
                                </span>
                              </div>
                              {pendingCount > 0 && (
                                <div className="flex items-center gap-2">
                                  <FileText size={11} style={{ color: "var(--skyshare-gold)" }} />
                                  <span className="text-xs" style={{ color: "var(--skyshare-gold)" }}>
                                    {pendingCount} doc{pendingCount !== 1 ? "s" : ""} pending review
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Shared Journal Feed ──────────────────────────────────────────────────────

function SharedJournalFeed({
  entries,
  techMap,
  loading,
}: {
  entries: MxlmsJournalEntry[]
  techMap: Map<number, MxlmsTechnician>
  loading: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card-elevated rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded flex items-center justify-center shrink-0"
            style={{ background: "rgba(212,160,23,0.08)" }}>
            <BookOpen className="h-4 w-4" style={{ color: "var(--skyshare-gold)" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/70" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
              SHARED JOURNAL
            </h2>
            <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
              Recent entries shared with manager · {entries.length} visible
            </p>
          </div>
        </div>
        <ChevronDown
          className="h-4 w-4 text-white/25 shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {open && (
        loading ? (
          <div className="py-10 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
            No shared journal entries yet.
          </div>
        ) : (
          <div>
            {entries.map(entry => {
              const tech      = techMap.get(entry.technician_id)
              const typeStyle = entryTypeStyle(entry.entry_type)
              const initials  = tech?.name
                ? tech.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
                : "?"

              return (
                <div key={entry.id} className="flex gap-4 px-5 py-4"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>

                  {/* Avatar */}
                  <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold"
                    style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}>
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-white/60">{tech?.name ?? `Tech #${entry.technician_id}`}</span>
                      {tech?.tech_code && (
                        <span className="text-[10px] text-white/25" style={{ fontFamily: "var(--font-heading)" }}>[{tech.tech_code}]</span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase"
                        style={{
                          fontFamily: "var(--font-heading)",
                          background: typeStyle.bg,
                          color: typeStyle.color,
                          border: `1px solid ${typeStyle.border}`,
                        }}>
                        {entry.entry_type}
                      </span>
                      <span className="text-[10px] text-white/20 ml-auto shrink-0" style={{ fontFamily: "var(--font-heading)" }}>
                        {new Date(entry.entry_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                  </div>
                </div>
              )
            })}
            <div className="px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3 }}>
                Showing last {entries.length} shared entries. Private entries are never visible here.
              </span>
            </div>
          </div>
        )
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTraining() {
  const { profile: me } = useAuth()
  const isSuperAdmin = me?.role === "Super Admin"
  const [adHocModalOpen, setAdHocModalOpen] = useState(false)

  const enabled = isSuperAdmin

  const qc = useQueryClient()

  const { data: profiles  = [], isLoading: lp } = useQuery({ queryKey: ["admin-training-profiles"],   queryFn: fetchProfiles,     enabled })
  const { data: techs     = []                 } = useQuery({ queryKey: ["mxlms-technicians"],         queryFn: fetchTechnicians,  enabled })
  const { data: training  = [], isLoading: lt  } = useQuery({ queryKey: ["admin-all-training"],        queryFn: fetchAllTraining,  enabled })
  const { data: pending   = []                 } = useQuery({ queryKey: ["admin-all-pending"],         queryFn: fetchAllPending,   enabled })
  const { data: sessions  = []                 } = useQuery({ queryKey: ["admin-all-sessions"],        queryFn: fetchAllSessions,  enabled })
  const { data: goals     = []                 } = useQuery({ queryKey: ["admin-all-goals"],           queryFn: fetchAllGoals,     enabled })
  const { data: actions   = []                 } = useQuery({ queryKey: ["admin-all-actions"],         queryFn: fetchAllActions,   enabled })
  const { data: journal   = [], isLoading: lj  } = useQuery({ queryKey: ["admin-shared-journal"],     queryFn: fetchSharedJournal, enabled })

  const techMap = new Map(techs.map(t => [t.id, t]))

  const linked        = profiles.filter(p => p.mxlms_technician_id != null)
  const overdueTotal  = training.filter(isOverdue).length
  const openGoalTotal = goals.filter(g => g.status === "open").length

  const loading = lp || lt

  if (!isSuperAdmin) {
    return (
      <div className="hero-area">
        <p className="text-sm text-red-400">Super Admin only.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="hero-area">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8" style={{ color: "var(--skyshare-gold)" }} />
            <div>
              <h1 className="text-[2.6rem] leading-none text-foreground"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
                TEAM TRAINING & JOURNEY
              </h1>
              <div className="mt-1.5" style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }} />
            </div>
          </div>
          <Button
            onClick={() => setAdHocModalOpen(true)}
            className="shrink-0 gap-2 mt-1"
            style={{
              background: "var(--skyshare-gold)",
              color: "hsl(0 0% 8%)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.08em",
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Record Ad Hoc Event
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground" style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          The manager view — what your team sees in My Training &amp; My Journey™
        </p>
      </div>

      <RecordAdHocEventModal
        open={adHocModalOpen}
        onClose={() => setAdHocModalOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["admin-all-pending"] })}
        techs={techs}
      />

      {/* Stats */}
      {loading ? (
        <div className="py-10 text-center text-sm text-white/25">Loading team data…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Linked Members"   value={linked.length}    accent="var(--skyshare-gold)"            icon={Users} />
            <StatCard label="Overdue Training" value={overdueTotal}     accent={overdueTotal  > 0 ? "#e05070" : "rgba(255,255,255,0.2)"} icon={AlertCircle} />
            <StatCard label="Pending Reviews"  value={pending.length}   accent={pending.length > 0 ? "rgba(212,160,23,0.8)" : "rgba(255,255,255,0.2)"} icon={Clock} />
            <StatCard label="Open Goals"       value={openGoalTotal}    accent="var(--skyshare-success, #10b981)" icon={Target} />
          </div>

          {/* Pending completions inbox */}
          <PendingInbox pending={pending} techMap={techMap} />

          {/* Team table */}
          <TeamOverviewTable
            profiles={profiles}
            techMap={techMap}
            training={training}
            pending={pending}
            sessions={sessions}
            goals={goals}
            actions={actions}
          />

          {/* Shared journal feed */}
          <SharedJournalFeed entries={journal} techMap={techMap} loading={lj} />
        </>
      )}

    </div>
  )
}
