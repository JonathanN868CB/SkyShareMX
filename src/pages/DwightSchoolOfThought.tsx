import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, GraduationCap, BookOpen, Brain, Lock, RotateCcw, EyeOff, Trash2, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/shared/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type PinStatus = "rolling" | "locked"
type LearningContext = "interview" | "intel_chat"
type LearningState = "rolling" | "locked" | "inactive"

interface Learning {
  id: string
  lesson: string
  category: string
  source_type: string | null
  active: boolean
  pin_status: PinStatus
  inactive_until: string | null
  context: LearningContext
  created_at: string
}

function getLearningState(l: Learning): LearningState {
  if (l.pin_status === "locked") return "locked"
  if (!l.active) return "inactive"
  return "rolling"
}

const STATE_META: Record<LearningState, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  rolling: {
    label: "Rolling",
    color: "text-emerald-400",
    bg: "bg-emerald-900/20",
    border: "border-emerald-800/30",
    icon: <RotateCcw className="w-3 h-3" />,
  },
  locked: {
    label: "Locked",
    color: "text-amber-400",
    bg: "bg-amber-900/20",
    border: "border-amber-800/30",
    icon: <Lock className="w-3 h-3" />,
  },
  inactive: {
    label: "Inactive",
    color: "text-zinc-500",
    bg: "bg-zinc-900/20",
    border: "border-zinc-800/30",
    icon: <EyeOff className="w-3 h-3" />,
  },
}

const CATEGORIES = [
  "Record Validation",
  "Interview Flow",
  "Question Quality",
  "Domain Knowledge",
  "Prompt Behavior",
]

const PERSONALITY_MODES = [
  {
    id: "schrute",
    emoji: "🌱",
    label: "Full Schrute",
    description: "Dwight K. Schrute in full character. Confident, intense, loyal to the mission. Bears. Beets. Battlestar Galactica. Answers with authority and subtle humor.",
  },
  {
    id: "corporate",
    emoji: "👔",
    label: "Corporate",
    description: "Professional, precise, buttoned-up. Like a senior aviation consultant on a call with the FAA. No Schrute nonsense — just clean, accurate responses.",
  },
  {
    id: "troubleshooting",
    emoji: "🧠",
    label: "Troubleshooting",
    description: "Diagnostic mode. Systematic, methodical, numbered steps. Built for isolating issues in complex systems. Highly technical vocabulary when appropriate.",
  },
]

const IDENTITY_PROMPT_PREVIEW = `You are DW1GHT — an AI aviation maintenance intelligence system built into SkyShare MX. You serve the DOM (Director of Maintenance) and management team. You have access to aircraft discrepancy records, maintenance history, fleet analytics, and uploaded aircraft documents.

You are loyal. You are precise. You do not tolerate sloppy maintenance records. You are, in your own words, "exactly like Dwight Schrute, but for aircraft." You answer questions with authority, draw on real data when available, and flag anomalies without being asked.`

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  onBack: () => void
  isSuperAdmin: boolean
}

export default function DwightSchoolOfThought({ onBack, isSuperAdmin }: Props) {
  const [activeContext, setActiveContext] = useState<LearningContext>("interview")
  const [learnings, setLearnings] = useState<Learning[]>([])
  const [loadingLearnings, setLoadingLearnings] = useState(true)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [activeSection, setActiveSection] = useState<"library" | "personality">("library")

  async function loadLearnings() {
    setLoadingLearnings(true)
    const { data } = await (supabase as any)
      .from("dw1ght_learnings")
      .select("id, lesson, category, source_type, active, pin_status, inactive_until, context, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
    setLearnings(data ?? [])
    setLoadingLearnings(false)
  }

  useEffect(() => { loadLearnings() }, [])

  const contextLearnings = useMemo(
    () => learnings.filter(l => l.context === activeContext),
    [learnings, activeContext]
  )

  const lockedRows   = contextLearnings.filter(l => l.pin_status === "locked")
  const rollingActive = contextLearnings.filter(l => getLearningState(l) === "rolling")
  const slotsUsed    = lockedRows.length + Math.min(rollingActive.length, Math.max(0, 30 - lockedRows.length))
  const slotPct      = Math.min(100, Math.round((slotsUsed / 30) * 100))

  const byCategory = useMemo(() => {
    const map = new Map<string, Learning[]>()
    for (const cat of CATEGORIES) map.set(cat, [])
    map.set("Other", [])
    for (const l of contextLearnings) {
      const cat = CATEGORIES.includes(l.category) ? l.category : "Other"
      map.get(cat)!.push(l)
    }
    return map
  }, [contextLearnings])

  function toggleCategory(cat: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async function setRolling(id: string) {
    await (supabase as any).from("dw1ght_learnings").update({ pin_status: "rolling", active: true, inactive_until: null }).eq("id", id)
    setLearnings(prev => prev.map(l => l.id === id ? { ...l, pin_status: "rolling", active: true, inactive_until: null } : l))
    setActionMenuId(null)
  }

  async function setLocked(id: string) {
    await (supabase as any).from("dw1ght_learnings").update({ pin_status: "locked", active: true, inactive_until: null }).eq("id", id)
    setLearnings(prev => prev.map(l => l.id === id ? { ...l, pin_status: "locked", active: true, inactive_until: null } : l))
    setActionMenuId(null)
  }

  async function setInactive(id: string) {
    await (supabase as any).from("dw1ght_learnings").update({ active: false, pin_status: "rolling", inactive_until: null }).eq("id", id)
    setLearnings(prev => prev.map(l => l.id === id ? { ...l, active: false, pin_status: "rolling", inactive_until: null } : l))
    setActionMenuId(null)
  }

  async function deleteLearning(id: string) {
    setDeletingId(id)
    await (supabase as any).from("dw1ght_learnings").delete().eq("id", id)
    setLearnings(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
    setConfirmDeleteId(null)
    setActionMenuId(null)
  }

  function startEdit(l: Learning) {
    setEditingId(l.id)
    setEditValue(l.lesson)
    setActionMenuId(null)
  }

  async function saveEdit(id: string) {
    const trimmed = editValue.trim()
    if (!trimmed) return
    setSavingEdit(true)
    await (supabase as any).from("dw1ght_learnings").update({ lesson: trimmed }).eq("id", id)
    setLearnings(prev => prev.map(l => l.id === id ? { ...l, lesson: trimmed } : l))
    setSavingEdit(false)
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue("")
  }

  // ── Shared learning row renderer ─────────────────────────────────────────────

  function renderRow(l: Learning) {
    const state = getLearningState(l)
    const meta  = STATE_META[state]
    const isEditing = editingId === l.id

    return (
      <div
        key={l.id}
        className={cn(
          "p-3 rounded-lg border transition-all",
          meta.bg, meta.border,
          state === "inactive" ? "opacity-60" : ""
        )}
      >
        {isEditing ? (
          /* ── Inline editor ── */
          <div className="space-y-2">
            <textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              autoFocus
              rows={4}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white/85 text-sm leading-relaxed resize-none focus:outline-none focus:border-white/25 transition-colors"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
              onKeyDown={e => {
                if (e.key === "Escape") cancelEdit()
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(l.id)
              }}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => saveEdit(l.id)}
                disabled={savingEdit || !editValue.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: "rgba(16,185,129,0.15)",
                  color: "rgba(100,220,140,0.9)",
                  border: "1px solid rgba(16,185,129,0.25)",
                }}
              >
                <Check className="w-3 h-3" />
                {savingEdit ? "Saving…" : "Save"}
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors text-white/35 hover:text-white/60"
                style={{ fontFamily: "var(--font-heading)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
              <span className="text-[9px] text-white/20 ml-1" style={{ fontFamily: "var(--font-heading)" }}>
                ⌘↵ to save · Esc to cancel
              </span>
            </div>
          </div>
        ) : (
          /* ── Normal view ── */
          <div className="flex items-start gap-3">
            {/* State icon */}
            <div className={cn("flex items-center pt-0.5 flex-shrink-0", meta.color)}>
              {meta.icon}
            </div>

            {/* Lesson text + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-sm leading-snug">{l.lesson}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider border", meta.bg, meta.color, meta.border)}>
                  {meta.label}
                </span>
                {l.source_type && (
                  <span className="text-[9px] text-white/20">via {l.source_type}</span>
                )}
              </div>
            </div>

            {/* Super Admin controls */}
            {isSuperAdmin && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Edit pencil */}
                <button
                  onClick={() => startEdit(l)}
                  className="p-1.5 rounded transition-colors text-white/20 hover:text-white/60 hover:bg-white/5"
                  title="Edit learning"
                >
                  <Pencil className="w-3 h-3" />
                </button>

                {/* State dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setActionMenuId(actionMenuId === l.id ? null : l.id)}
                    className="text-[9px] tracking-widest uppercase px-2 py-1 rounded transition-colors text-white/25 hover:text-white/60 border border-white/5 hover:border-white/20"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    ···
                  </button>

                  {actionMenuId === l.id && (
                    <div
                      className="absolute right-0 top-7 z-50 rounded-lg overflow-hidden shadow-xl min-w-[160px]"
                      style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" }}
                    >
                      {state !== "rolling" && (
                        <button onClick={() => setRolling(l.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-white/5 transition-colors text-left">
                          <RotateCcw className="w-3 h-3" /> Set Rolling
                        </button>
                      )}
                      {state !== "locked" && (
                        <button onClick={() => setLocked(l.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-400 hover:bg-white/5 transition-colors text-left">
                          <Lock className="w-3 h-3" /> Lock Always On
                        </button>
                      )}
                      {state !== "inactive" && (
                        <button onClick={() => setInactive(l.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 transition-colors text-left">
                          <EyeOff className="w-3 h-3" /> Deactivate
                        </button>
                      )}
                      <div style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
                        {confirmDeleteId === l.id ? (
                          <div className="px-3 py-2 space-y-1.5">
                            <p className="text-[9px] text-red-400/70 tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>Delete permanently?</p>
                            <div className="flex gap-1">
                              <button
                                onClick={() => deleteLearning(l.id)}
                                disabled={deletingId === l.id}
                                className="flex-1 text-[10px] py-1 rounded bg-red-900/40 text-red-400 hover:bg-red-900/60 transition-colors"
                              >
                                {deletingId === l.id ? "…" : "Yes, delete"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 text-[10px] py-1 rounded bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(l.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors text-left"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          AI Assistant
        </button>
        <div className="flex items-center gap-4 mb-1">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(212,160,23,0.1)", border: "2px solid var(--skyshare-gold)" }}
          >
            <GraduationCap className="w-6 h-6" style={{ color: "var(--skyshare-gold)" }} />
          </div>
          <div>
            <h1
              className="text-white leading-none mb-1"
              style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
            >
              Dwight School of Thought
            </h1>
            <p
              className="text-white/40 text-xs tracking-widest uppercase"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              DW1GHT · Learning Management · {isSuperAdmin ? "Full Access" : "Read Only"}
            </p>
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      {/* Section tabs */}
      <div className="px-8 pt-5 pb-0 flex gap-1">
        {([
          { id: "library",     label: "Learning Library", icon: <BookOpen className="w-3.5 h-3.5" /> },
          { id: "personality", label: "Personality",      icon: <Brain className="w-3.5 h-3.5" /> },
        ] as { id: "library" | "personality"; label: string; icon: React.ReactNode }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-t-lg text-[10px] font-bold tracking-widest uppercase transition-all"
            style={{
              fontFamily: "var(--font-heading)",
              background: activeSection === tab.id ? "var(--card)" : "transparent",
              color: activeSection === tab.id ? "var(--skyshare-gold)" : "rgba(255,255,255,0.35)",
              border: activeSection === tab.id ? "1px solid var(--border)" : "1px solid transparent",
              borderBottom: "none",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-8 pb-8">
        <div className="card-elevated rounded-b-lg rounded-tr-lg overflow-hidden">

          {/* ── Learning Library ─────────────────────────────────────────────── */}
          {activeSection === "library" && (
            <div>

              {/* Context tabs + slot usage */}
              <div className="flex items-center justify-between gap-4 px-5 py-4" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                <div className="flex items-center gap-1">
                  {(["interview", "intel_chat"] as LearningContext[]).map(ctx => (
                    <button
                      key={ctx}
                      onClick={() => setActiveContext(ctx)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
                      style={{
                        fontFamily: "var(--font-heading)",
                        background: activeContext === ctx ? "rgba(212,160,23,0.15)" : "transparent",
                        color: activeContext === ctx ? "var(--skyshare-gold)" : "rgba(255,255,255,0.35)",
                        border: activeContext === ctx ? "1px solid rgba(212,160,23,0.3)" : "1px solid transparent",
                      }}
                    >
                      {ctx === "interview" ? "Interview" : "Intel Chat"}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-[9px] tracking-widest uppercase text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                      Injection Slots
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{
                          fontFamily: "var(--font-display)",
                          color: slotPct >= 90 ? "#f97316" : slotPct >= 70 ? "var(--skyshare-gold)" : "var(--skyshare-success)",
                        }}
                      >
                        {slotsUsed}
                      </span>
                      <span className="text-white/25 text-xs">/</span>
                      <span className="text-white/40 text-xs font-mono">30</span>
                    </div>
                  </div>
                  <div className="w-24 h-2 rounded-full overflow-hidden bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${slotPct}%`,
                        background: slotPct >= 90 ? "#f97316" : slotPct >= 70 ? "var(--skyshare-gold)" : "var(--skyshare-success)",
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                    <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5 text-amber-500" />{lockedRows.length} locked</span>
                    <span className="flex items-center gap-1"><RotateCcw className="w-2.5 h-2.5 text-emerald-500" />{rollingActive.length} rolling</span>
                  </div>
                </div>
              </div>

              {/* States */}
              {loadingLearnings && (
                <div className="px-5 py-12 text-center text-white/25 text-sm">Loading learnings…</div>
              )}

              {!loadingLearnings && contextLearnings.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <GraduationCap className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">No learnings yet for {activeContext === "interview" ? "Interview" : "Intel Chat"}.</p>
                  <p className="text-white/20 text-xs mt-1">Learnings are added automatically during DW1GHT sessions.</p>
                </div>
              )}

              {/* Category sections */}
              {!loadingLearnings && [...CATEGORIES, "Other"].map(cat => {
                const rows = byCategory.get(cat) ?? []
                if (rows.length === 0) return null
                const isCollapsed = collapsedCategories.has(cat)
                return (
                  <div key={cat} style={{ borderBottom: "1px solid hsl(0 0% 15%)" }}>
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold tracking-widest uppercase text-white/50"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {cat}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
                          {rows.length}
                        </span>
                      </div>
                      {isCollapsed
                        ? <ChevronDown className="w-3.5 h-3.5 text-white/25" />
                        : <ChevronUp className="w-3.5 h-3.5 text-white/25" />
                      }
                    </button>
                    {!isCollapsed && (
                      <div className="px-5 pb-3 space-y-1.5">
                        {rows.map(l => renderRow(l))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Injection mechanics legend */}
              <div className="px-5 py-4 border-t" style={{ borderColor: "hsl(0 0% 14%)" }}>
                <p className="text-[9px] tracking-widest uppercase text-white/20 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                  How Injection Works
                </p>
                <div className="flex flex-wrap gap-4 text-[10px] text-white/30">
                  <span className="flex items-center gap-1.5"><Lock className="w-3 h-3 text-amber-500/60" /><strong className="text-white/50">Locked</strong> — always injected, bypasses the 30-slot cap</span>
                  <span className="flex items-center gap-1.5"><RotateCcw className="w-3 h-3 text-emerald-500/60" /><strong className="text-white/50">Rolling</strong> — fills remaining slots up to 30 total, newest first</span>
                  <span className="flex items-center gap-1.5"><EyeOff className="w-3 h-3 text-zinc-500/60" /><strong className="text-white/50">Inactive</strong> — excluded from injection</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Personality ──────────────────────────────────────────────────── */}
          {activeSection === "personality" && (
            <div>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                <Brain className="w-4 h-4 text-white/30" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-white/40" style={{ fontFamily: "var(--font-heading)" }}>
                  Operating Modes
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-white/20 ml-2" style={{ fontFamily: "var(--font-heading)" }}>
                  Read Only
                </span>
              </div>
              <div className="px-5 py-5 space-y-3">
                {PERSONALITY_MODES.map(m => (
                  <div key={m.id} className="rounded-lg p-4 bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-sm font-bold tracking-wide text-white/80" style={{ fontFamily: "var(--font-heading)" }}>
                        {m.label}
                      </span>
                    </div>
                    <p className="text-white/45 text-sm leading-relaxed">{m.description}</p>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
                <div className="px-5 py-4 flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-white/40" style={{ fontFamily: "var(--font-heading)" }}>
                    Identity Prompt
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
                    Read Only
                  </span>
                </div>
                <div className="px-5 pb-5">
                  <div className="rounded-lg p-4 bg-black/20 border border-white/[0.06]">
                    <pre
                      className="text-white/40 text-xs leading-relaxed whitespace-pre-wrap"
                      style={{ fontFamily: "'DM Mono', 'Fira Code', monospace" }}
                    >
                      {IDENTITY_PROMPT_PREVIEW}
                    </pre>
                  </div>
                  <p className="text-[9px] text-white/20 mt-2" style={{ fontFamily: "var(--font-heading)" }}>
                    This is a condensed preview. Full system prompts are defined in the Netlify function layer and are not editable from this panel.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Click-away overlay for action menus */}
      {actionMenuId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setActionMenuId(null); setConfirmDeleteId(null) }}
        />
      )}
    </div>
  )
}
