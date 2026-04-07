import { useState, Fragment } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  GraduationCap, AlertCircle, Clock, Target, CheckSquare,
  BookOpen, ChevronDown, ChevronRight, ExternalLink, FileText, Users, CheckCircle2, Plus,
  Bell, ShieldAlert, Network, StickyNote, Trash2,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { supabase } from "@/lib/supabase"
import { mxlms } from "@/lib/supabase-mxlms"
import { useAuth } from "@/features/auth"
import { toast } from "sonner"
import type { Profile } from "@/entities/supabase"
import {
  getAllAssignments,
  getAssignmentsForManager,
  getPeopleManagerProfiles,
  addAssignment,
  removeAssignment,
  type Assignment,
} from "@/features/my-journey/services/managerAssignments"
import {
  getAllNotesAdmin,
  deleteManagerNote,
} from "@/features/my-journey/services/managerNotes"
import type {
  MxlmsTechnician, MxlmsPendingCompletion,
  MxlmsSession, MxlmsGoal, MxlmsActionItem, MxlmsJournalEntry,
  MxlmsAdHocCompletion,
} from "@/entities/mxlms"
import { RecordAdHocEventModal } from "@/components/training/RecordAdHocEventModal"
import { ProposeTrainingItemModal } from "@/components/training/ProposeTrainingItemModal"

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
  const [open, setOpen] = useState(true)

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
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none" }}
      >
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 shrink-0 text-white/30" />
          <p className="text-xs font-semibold text-white/50" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
            TEAM OVERVIEW
          </p>
          <span className="text-[10px] text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
            {sorted.length} member{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown
          className="h-4 w-4 text-white/25 shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {open && <div className="overflow-x-auto">
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
      </div>}
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

// ─── Active Ad Hoc Tracker ────────────────────────────────────────────────────

async function fetchActiveAdHoc(): Promise<MxlmsAdHocCompletion[]> {
  const { data, error } = await mxlms
    .from("ad_hoc_completions")
    .select("*")
    .in("status", ["pending_tech_ack", "pending_witness_ack", "complete"])
    .order("completed_date", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsAdHocCompletion[]
}

const EVENT_TYPE_SHORT: Record<string, string> = {
  "safety-observation":  "Safety",
  "procedure-refresher": "Procedure",
  "tooling-equipment":   "Tooling",
  "regulatory-briefing": "Regulatory",
  "ojt-mentorship":      "OJT",
  "general":             "General",
}

const STATUS_CONFIG = {
  pending_tech_ack:    { label: "Awaiting Tech",    color: "var(--skyshare-gold)",        bg: "rgba(212,160,23,0.1)",    border: "rgba(212,160,23,0.25)" },
  pending_witness_ack: { label: "Awaiting Witness",  color: "#10b981",                    bg: "rgba(16,185,129,0.08)",   border: "rgba(16,185,129,0.2)"  },
  complete:            { label: "Ready to Archive",  color: "var(--skyshare-blue-mid, #4e7fa0)", bg: "rgba(70,100,129,0.12)", border: "rgba(70,100,129,0.25)" },
} as const

function AdHocPipelineDot({ active }: { active: boolean }) {
  return (
    <div style={{
      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
      background: active ? "currentColor" : "rgba(255,255,255,0.1)",
      border: active ? "none" : "1px solid rgba(255,255,255,0.15)",
    }} />
  )
}

function ActiveAdHocTracker({
  records,
  techMap,
  isSuperAdmin,
}: {
  records:      MxlmsAdHocCompletion[]
  techMap:      Map<number, MxlmsTechnician>
  isSuperAdmin: boolean
}) {
  const [open,         setOpen]         = useState(true)
  const [overridingId, setOverridingId] = useState<number | null>(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const qc = useQueryClient()

  async function handleForceComplete(record: MxlmsAdHocCompletion) {
    if (!overrideNote.trim()) return
    setSubmitting(true)
    try {
      const { error } = await mxlms
        .from("ad_hoc_completions")
        .update({ status: "complete", override_note: overrideNote.trim() })
        .eq("id", record.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ["admin-active-adhoc"] })
      setOverridingId(null)
      setOverrideNote("")
    } catch (err) {
      console.error("Force complete failed:", err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSoftCancel(record: MxlmsAdHocCompletion) {
    if (!window.confirm(`Cancel "${record.name}"? It will be removed from the active pipeline.`)) return
    try {
      const { error } = await mxlms
        .from("ad_hoc_completions")
        .update({ status: "cancelled" })
        .eq("id", record.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ["admin-active-adhoc"] })
      toast.success("Event cancelled")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to cancel event")
    }
  }

  async function handleHardDelete(record: MxlmsAdHocCompletion) {
    if (!window.confirm(`Permanently delete "${record.name}"? This cannot be undone.`)) return
    try {
      const { error } = await mxlms
        .from("ad_hoc_completions")
        .delete()
        .eq("id", record.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ["admin-active-adhoc"] })
      toast.success("Event deleted")
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete event")
    }
  }

  if (records.length === 0) return null

  return (
    <div className="card-elevated rounded-lg overflow-hidden"
      style={{ borderLeft: "3px solid rgba(212,160,23,0.6)" }}>

      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none", background: "rgba(212,160,23,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <Bell className="h-4 w-4 shrink-0" style={{ color: "var(--skyshare-gold)" }} />
          <div>
            <p className="text-xs font-semibold text-white/70" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
              ACTIVE AD HOC EVENTS
            </p>
            <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
              {records.length} event{records.length !== 1 ? "s" : ""} in progress — tracking through final archival
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini status counts */}
          {(["pending_tech_ack", "pending_witness_ack", "complete"] as const).map(s => {
            const n = records.filter(r => r.status === s).length
            if (n === 0) return null
            const cfg = STATUS_CONFIG[s]
            return (
              <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: "var(--font-heading)" }}>
                {n} {cfg.label}
              </span>
            )
          })}
          <ChevronDown
            className="h-4 w-4 text-white/25 shrink-0 transition-transform duration-200"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
        </div>
      </button>

      {/* Table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Event", "Team Member", "Date", "Status", "Next Action"].map(h => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const tech = techMap.get(r.technician_id)
                const cfg  = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG]
                const sevStyle = r.severity === "high"   ? { color: "#e05070" }
                               : r.severity === "medium" ? { color: "#f59e0b" }
                               : null

                const nextAction =
                  r.status === "pending_tech_ack"
                    ? `${tech?.name ?? "Tech"} to sign`
                    : r.status === "pending_witness_ack"
                    ? `${r.witness_name ?? "Witness"} to sign`
                    : "MX-LMS archival pending"

                return (
                  <tr key={r.id} className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>

                    {/* Event name + type */}
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-white/80">{r.name}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase"
                            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-heading)" }}>
                            {EVENT_TYPE_SHORT[r.event_type] ?? r.event_type}
                          </span>
                          {sevStyle && r.severity && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase"
                              style={{ ...sevStyle, fontFamily: "var(--font-heading)" }}>
                              <ShieldAlert className="h-2.5 w-2.5" />
                              {r.severity}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Tech */}
                    <td className="px-5 py-3">
                      <p className="text-sm text-white/65">{tech?.name ?? `Tech #${r.technician_id}`}</p>
                      {tech?.tech_code && (
                        <p className="text-[10px] text-white/25" style={{ fontFamily: "var(--font-heading)" }}>{tech.tech_code}</p>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3">
                      <span className="text-xs text-white/35" style={{ fontFamily: "var(--font-heading)" }}>
                        {formatDate(r.completed_date)}
                      </span>
                    </td>

                    {/* Status badge + pipeline dots */}
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tracking-wider self-start"
                          style={{ background: cfg?.bg, color: cfg?.color, border: `1px solid ${cfg?.border}`, fontFamily: "var(--font-heading)" }}>
                          {cfg?.label ?? r.status}
                        </span>
                        {/* Pipeline: Manager → Tech → Witness → Drive */}
                        <div className="flex items-center gap-1" style={{ color: cfg?.color }}>
                          <AdHocPipelineDot active={!!r.manager_signed_at} />
                          <div style={{ width: 8, height: 1, background: "rgba(255,255,255,0.1)" }} />
                          {r.requires_acknowledgment && (
                            <>
                              <AdHocPipelineDot active={!!r.acknowledged_at} />
                              <div style={{ width: 8, height: 1, background: "rgba(255,255,255,0.1)" }} />
                            </>
                          )}
                          {r.witness_name && (
                            <>
                              <AdHocPipelineDot active={!!r.witness_signed_at} />
                              <div style={{ width: 8, height: 1, background: "rgba(255,255,255,0.1)" }} />
                            </>
                          )}
                          <AdHocPipelineDot active={r.status === "complete"} />
                        </div>
                      </div>
                    </td>

                    {/* Next action */}
                    <td className="px-5 py-3 pr-6">
                      {overridingId === r.id ? (
                        <div className="flex flex-col gap-2" style={{ minWidth: 220 }}>
                          <textarea
                            autoFocus
                            value={overrideNote}
                            onChange={e => setOverrideNote(e.target.value)}
                            placeholder="Reason for override (required)"
                            rows={2}
                            className="w-full text-xs rounded px-2 py-1.5 resize-none"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", outline: "none", fontFamily: "inherit" }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleForceComplete(r)}
                              disabled={submitting || !overrideNote.trim()}
                              style={{ fontSize: 10, padding: "3px 10px", borderRadius: 4, background: "rgba(212,160,23,0.2)", color: "#d4a017", border: "1px solid rgba(212,160,23,0.35)", cursor: submitting || !overrideNote.trim() ? "not-allowed" : "pointer", opacity: !overrideNote.trim() ? 0.5 : 1 }}
                            >
                              {submitting ? "Saving…" : "Confirm"}
                            </button>
                            <button
                              onClick={() => { setOverridingId(null); setOverrideNote("") }}
                              disabled={submitting}
                              style={{ fontSize: 10, padding: "3px 10px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs"
                            style={{ color: r.status === "complete" ? "rgba(70,100,129,0.9)" : "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}>
                            {nextAction}
                          </span>
                          {(r.status === "pending_tech_ack" || r.status === "pending_witness_ack") && (
                            <button
                              onClick={() => { setOverridingId(r.id); setOverrideNote("") }}
                              style={{ alignSelf: "flex-start", fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(212,160,23,0.07)", color: "rgba(212,160,23,0.55)", border: "1px solid rgba(212,160,23,0.18)", cursor: "pointer", fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
                            >
                              Force Complete ↗
                            </button>
                          )}
                          {/* Retract actions — always available to managers */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <button
                              onClick={() => handleSoftCancel(r)}
                              style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", fontFamily: "var(--font-heading)" }}
                            >
                              Cancel
                            </button>
                            {isSuperAdmin && (
                              <button
                                onClick={() => handleHardDelete(r)}
                                style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(193,2,48,0.07)", color: "rgba(193,2,48,0.55)", border: "1px solid rgba(193,2,48,0.18)", cursor: "pointer", fontFamily: "var(--font-heading)" }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Manager Assignments Panel ────────────────────────────────────────────────

function ManagerAssignmentsPanel({ profiles, myProfileId }: { profiles: Profile[]; myProfileId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [managerSelect, setManagerSelect] = useState("")
  const [subjectSelect, setSubjectSelect] = useState("")
  const [viewAsId, setViewAsId] = useState<string | null>(null)
  const [addErr, setAddErr] = useState<string | null>(null)

  const { data: assignments = [], isLoading: la } = useQuery({
    queryKey: ["admin-all-assignments"],
    queryFn: getAllAssignments,
    enabled: open,
  })

  const { data: managerProfiles = [] } = useQuery({
    queryKey: ["admin-people-manager-profiles"],
    queryFn: getPeopleManagerProfiles,
    enabled: open,
  })

  const { data: viewAsReports = [], isLoading: lvr } = useQuery({
    queryKey: ["admin-view-as-manager", viewAsId],
    queryFn: () => getAssignmentsForManager(viewAsId!),
    enabled: !!viewAsId && open,
  })

  // Profile maps
  const profileById = new Map<string, Profile>(profiles.map(p => [p.id, p]))
  const profileName = (id: string) => {
    const p = profileById.get(id)
    return p?.full_name ?? p?.display_name ?? id.slice(0, 8)
  }

  const doAdd = useMutation({
    mutationFn: () => {
      if (managerSelect === subjectSelect) throw new Error("Manager and subject cannot be the same person")
      return addAssignment(managerSelect, subjectSelect, myProfileId)
    },
    onSuccess: () => {
      setManagerSelect("")
      setSubjectSelect("")
      setAddErr(null)
      qc.invalidateQueries({ queryKey: ["admin-all-assignments"] })
      qc.invalidateQueries({ queryKey: ["admin-people-manager-profiles"] })
      toast.success("Assignment added")
    },
    onError: (e: any) => setAddErr(e.message ?? "Failed to add assignment"),
  })

  const doRemove = useMutation({
    mutationFn: (id: string) => removeAssignment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-assignments"] })
      qc.invalidateQueries({ queryKey: ["admin-people-manager-profiles"] })
      qc.invalidateQueries({ queryKey: ["admin-view-as-manager", viewAsId] })
      toast.success("Assignment removed")
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to remove assignment"),
  })

  const selectStyle = {
    background: "hsl(0 0% 10%)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.7)",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 12,
    outline: "none",
    fontFamily: "var(--font-body)",
  }

  return (
    <div className="card-elevated rounded-lg overflow-hidden"
      style={{ borderLeft: "3px solid rgba(130,80,200,0.5)" }}>

      {/* Header toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none", background: "rgba(130,80,200,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded flex items-center justify-center shrink-0"
            style={{ background: "rgba(130,80,200,0.12)" }}>
            <Network className="h-4 w-4" style={{ color: "rgba(160,120,220,0.9)" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/70" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
              MANAGER ASSIGNMENTS
            </h2>
            <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
              Who manages whom · {assignments.length} assignment{assignments.length !== 1 ? "s" : ""} · {managerProfiles.length} manager{managerProfiles.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <ChevronDown
          className="h-4 w-4 text-white/25 shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {open && (
        <div className="space-y-0">

          {/* ── Add assignment form ── */}
          <div className="px-5 py-4 space-y-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
            <p className="text-[10px] uppercase tracking-wider text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
              Add Assignment — Supervisor manages Direct Report
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>Supervisor</label>
                <select value={managerSelect} onChange={e => setManagerSelect(e.target.value)} style={selectStyle}>
                  <option value="">Select supervisor…</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name ?? p.display_name ?? p.id}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>Direct Report</label>
                <select value={subjectSelect} onChange={e => setSubjectSelect(e.target.value)} style={selectStyle}>
                  <option value="">Select direct report…</option>
                  {profiles
                    .filter(p => p.id !== managerSelect)
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.full_name ?? p.display_name ?? p.id}</option>
                    ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/30 invisible">Add</label>
                <Button
                  size="sm"
                  disabled={!managerSelect || !subjectSelect || doAdd.isPending}
                  onClick={() => doAdd.mutate()}
                  className="h-8 gap-1.5 text-xs"
                  style={{
                    background: managerSelect && subjectSelect ? "rgba(130,80,200,0.3)" : "rgba(255,255,255,0.04)",
                    color: managerSelect && subjectSelect ? "rgba(180,140,240,1)" : "rgba(255,255,255,0.2)",
                    border: `1px solid ${managerSelect && subjectSelect ? "rgba(130,80,200,0.4)" : "rgba(255,255,255,0.08)"}`,
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "0.06em",
                  }}
                >
                  <Plus size={11} />
                  {doAdd.isPending ? "Adding…" : "Add"}
                </Button>
              </div>
            </div>
            {addErr && <p className="text-xs text-red-400">{addErr}</p>}
          </div>

          {/* ── Assignment table ── */}
          {la ? (
            <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>Loading…</div>
          ) : assignments.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>No assignments yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["Manager", "Direct Report", "Since", ""].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.5 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => {
                    const mgr = a.manager ?? (profileById.get(a.manager_profile_id) ? { display_name: null, full_name: profileById.get(a.manager_profile_id)!.full_name, avatar_color: null, avatar_initials: null } : null)
                    const sub = a.subject ?? (profileById.get(a.subject_profile_id) ? { display_name: null, full_name: profileById.get(a.subject_profile_id)!.full_name, avatar_color: null, avatar_initials: null } : null)
                    return (
                      <tr key={a.id} className="transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-5 py-3 text-sm text-white/65">
                          {mgr?.full_name ?? mgr?.display_name ?? profileName(a.manager_profile_id)}
                        </td>
                        <td className="px-5 py-3 text-sm text-white/65">
                          {sub?.full_name ?? sub?.display_name ?? profileName(a.subject_profile_id)}
                        </td>
                        <td className="px-5 py-3 text-xs text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                          {formatDate(a.created_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => doRemove.mutate(a.id)}
                            disabled={doRemove.isPending}
                            className="text-[10px] px-2.5 py-1 rounded transition-colors"
                            style={{ background: "rgba(193,2,48,0.07)", color: "rgba(220,80,80,0.6)", border: "1px solid rgba(193,2,48,0.18)", fontFamily: "var(--font-heading)", cursor: "pointer" }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── View as Manager dropdown ── */}
          <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[10px] uppercase tracking-wider text-white/30 shrink-0" style={{ fontFamily: "var(--font-heading)" }}>
                View as Manager
              </p>
              <select
                value={viewAsId ?? ""}
                onChange={e => setViewAsId(e.target.value || null)}
                style={{ ...selectStyle, minWidth: 200 }}
              >
                <option value="">Select a people-manager…</option>
                {managerProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.display_name ?? p.id}</option>
                ))}
              </select>
            </div>

            {viewAsId && (
              lvr ? (
                <div className="text-xs text-white/25 py-2" style={{ fontFamily: "var(--font-heading)" }}>Loading…</div>
              ) : viewAsReports.length === 0 ? (
                <div className="text-xs text-white/25 py-2" style={{ fontFamily: "var(--font-heading)" }}>No reports assigned to this manager.</div>
              ) : (
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[10px] uppercase tracking-wider text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                      {managerProfiles.find(p => p.id === viewAsId)?.full_name ?? "This Manager"}'s Team · {viewAsReports.length} report{viewAsReports.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div>
                    {viewAsReports.map(a => {
                      const person = a.subject
                      const name = person?.full_name ?? person?.display_name ?? profileName(a.subject_profile_id)
                      const initials = person?.avatar_initials ?? name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
                      return (
                        <div key={a.id} className="flex items-center gap-3 px-4 py-2.5"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{
                              background: person?.avatar_color ? `${person.avatar_color}22` : "rgba(255,255,255,0.06)",
                              border: `1px solid ${person?.avatar_color ?? "rgba(255,255,255,0.12)"}`,
                              color: person?.avatar_color ?? "rgba(255,255,255,0.4)",
                              fontFamily: "var(--font-display)",
                            }}
                          >
                            {initials}
                          </div>
                          <span className="text-sm text-white/65">{name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Manager Notes Admin Feed ─────────────────────────────────────────────────

function ManagerNotesAdminFeed({ profiles }: { profiles: Profile[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [filterManagerId, setFilterManagerId] = useState<string | null>(null)
  const [filterSubjectId, setFilterSubjectId] = useState<string | null>(null)

  const profileById = new Map<string, Profile>(profiles.map(p => [p.id, p]))
  const profileName = (id: string) => {
    const p = profileById.get(id)
    return p?.full_name ?? p?.display_name ?? id.slice(0, 8)
  }

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["admin-all-manager-notes"],
    queryFn: getAllNotesAdmin,
    enabled: open,
  })

  const deleteNote = useMutation({
    mutationFn: (id: string) => deleteManagerNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-manager-notes"] })
      toast.success("Note deleted")
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  })

  // Distinct managers and subjects for filter dropdowns
  const managerIds = [...new Set(notes.map(n => n.author_profile_id))]
  const subjectIds = [...new Set(notes.map(n => n.subject_profile_id))]

  const filtered = notes.filter(n =>
    (!filterManagerId || n.author_profile_id === filterManagerId) &&
    (!filterSubjectId || n.subject_profile_id === filterSubjectId)
  )

  const selectStyle = {
    background: "hsl(0 0% 10%)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.6)",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 11,
    outline: "none",
    fontFamily: "var(--font-body)",
  }

  return (
    <div className="card-elevated rounded-lg overflow-hidden"
      style={{ borderLeft: "3px solid rgba(70,100,129,0.5)" }}>

      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none", background: "rgba(70,100,129,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded flex items-center justify-center shrink-0"
            style={{ background: "rgba(70,100,129,0.12)" }}>
            <StickyNote className="h-4 w-4" style={{ color: "var(--skyshare-blue-mid, #4e7fa0)" }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/70" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
              MANAGER NOTES
            </h2>
            <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
              Private observations written by people-managers — never visible to employees
            </p>
          </div>
        </div>
        <ChevronDown
          className="h-4 w-4 text-white/25 shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>

      {open && (
        <>
          {/* Filter bar */}
          {notes.length > 0 && (
            <div className="px-5 py-3 flex flex-wrap items-center gap-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
              <span className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>Filter:</span>
              <select value={filterManagerId ?? ""} onChange={e => setFilterManagerId(e.target.value || null)} style={selectStyle}>
                <option value="">All managers</option>
                {managerIds.map(id => (
                  <option key={id} value={id}>{profileName(id)}</option>
                ))}
              </select>
              <select value={filterSubjectId ?? ""} onChange={e => setFilterSubjectId(e.target.value || null)} style={selectStyle}>
                <option value="">All subjects</option>
                {subjectIds.map(id => (
                  <option key={id} value={id}>{profileName(id)}</option>
                ))}
              </select>
              {(filterManagerId || filterSubjectId) && (
                <button
                  onClick={() => { setFilterManagerId(null); setFilterSubjectId(null) }}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Clear ×
                </button>
              )}
              <span className="ml-auto text-[10px] text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
                {filtered.length} of {notes.length}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="py-10 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>Loading…</div>
          ) : notes.length === 0 ? (
            <div className="py-10 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>No manager notes yet.</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>No notes match the filter.</div>
          ) : (
            <div>
              {filtered.map(note => {
                const authorName = note.author?.full_name ?? note.author?.display_name ?? profileName(note.author_profile_id)
                const subjectName = note.subject?.full_name ?? note.subject?.display_name ?? profileName(note.subject_profile_id)
                return (
                  <div key={note.id} className="group flex gap-4 px-5 py-4"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {/* Meta */}
                    <div className="shrink-0 space-y-0.5" style={{ minWidth: 160 }}>
                      <p className="text-[10px] text-white/25 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
                        {new Date(note.note_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <p className="text-xs text-white/55">{authorName}</p>
                      <p className="text-[10px] text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
                        → {subjectName}
                      </p>
                    </div>
                    {/* Content */}
                    <p className="flex-1 text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{note.note_text}</p>
                    {/* Delete */}
                    <button
                      onClick={() => deleteNote.mutate(note.id)}
                      disabled={deleteNote.isPending}
                      className="shrink-0 self-start mt-0.5 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5"
                      style={{ color: "rgba(220,80,80,0.5)" }}
                      title="Delete note"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
              <div className="px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3 }}>
                  {filtered.length} note{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTraining() {
  const { profile: me } = useAuth()
  const isSuperAdmin = me?.role === "Super Admin"
  const canProposeTraining = me?.role === "Super Admin" || me?.role === "Admin" || me?.role === "Manager"
  const [adHocModalOpen,     setAdHocModalOpen]     = useState(false)
  const [proposeModalOpen,   setProposeModalOpen]   = useState(false)

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
  const { data: activeAdHoc = []               } = useQuery({ queryKey: ["admin-active-adhoc"],        queryFn: fetchActiveAdHoc,   enabled })

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
          <div className="flex gap-2 mt-1 shrink-0">
            {canProposeTraining && (
              <Button
                onClick={() => setProposeModalOpen(true)}
                variant="outline"
                className="gap-2"
                style={{
                  borderColor: "rgba(212,160,23,0.4)",
                  color: "rgba(212,160,23,0.85)",
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "0.08em",
                  background: "transparent",
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Propose Training
              </Button>
            )}
            <Button
              onClick={() => setAdHocModalOpen(true)}
              className="gap-2"
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
        </div>
        <p className="mt-3 text-sm text-muted-foreground" style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          The manager view — what your team sees in My Training &amp; My Journey™
        </p>
      </div>

      <RecordAdHocEventModal
        open={adHocModalOpen}
        onClose={() => setAdHocModalOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["admin-all-pending"] })
          qc.invalidateQueries({ queryKey: ["admin-active-adhoc"] })
        }}
        techs={techs}
        profiles={profiles}
      />

      <ProposeTrainingItemModal
        open={proposeModalOpen}
        onClose={() => setProposeModalOpen(false)}
        onSuccess={() => {}}
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

          {/* Active ad hoc tracker */}
          <ActiveAdHocTracker records={activeAdHoc} techMap={techMap} isSuperAdmin={isSuperAdmin} />

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

          {/* Manager Assignments — Super Admin CRUD */}
          <ManagerAssignmentsPanel profiles={profiles} myProfileId={me?.id ?? ""} />

          {/* Manager Notes org-wide feed */}
          <ManagerNotesAdminFeed profiles={profiles} />
        </>
      )}

    </div>
  )
}
