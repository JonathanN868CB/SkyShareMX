import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { diffLines } from "diff"
import {
  ArrowLeft, BookOpen, Check, ChevronDown, ChevronUp, ClipboardCopy,
  GraduationCap, Hash, Info, RotateCcw, Save,
  Sparkles, Undo2, Upload, X, History, Zap,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { supabase } from "@/lib/supabase"
import { cn } from "@/shared/lib/utils"
import { PLAYBOOK_META, type PlaybookMeta, type PlaybookSlug } from "@/shared/dw1ght-playbooks-meta"
import { useAuth } from "@/features/auth"

// ─── Types ────────────────────────────────────────────────────────────────────

type EditableSectionKey = "allowed_context" | "instructions" | "decision_logic" | "output_definition" | "post_processing" | "tone_calibration"

interface PlaybookOverride {
  allowed_context: string | null
  instructions: string | null
  decision_logic: string | null
  output_definition: string | null
  post_processing: string | null
  tone_calibration: string | null
  version: number
  updated_at: string
  updated_by_name?: string | null
}

interface Suggestion {
  id: string
  section_key: EditableSectionKey
  change_type: "append" | "replace_text" | "replace_section"
  source_text: string | null
  suggested_text: string
  reasoning: string | null
  source_type: "self_critique" | "dom_review" | "ai_assist" | "import"
  review_status: string
  created_at: string
}

const SECTION_LABELS: Record<string, string> = {
  allowed_context:   "Allowed Context",
  instructions:      "Operating Instructions",
  decision_logic:    "Decision / Escalation Rules",
  output_definition: "Output Definition",
  post_processing:   "Post-Processing / Actions",
  tone_calibration:  "Persona & Tone",
}

const SUGGESTION_SOURCE_META: Record<string, { label: string; color: string }> = {
  self_critique: { label: "Self-Critique",  color: "text-blue-400" },
  dom_review:    { label: "DOM Review",     color: "text-amber-400" },
  ai_assist:     { label: "AI Assist",      color: "text-purple-400" },
  import:        { label: "Imported",       color: "text-teal-400" },
}

// ─── Constants ────────────────────────────────────────────────────────────────


// ─── Props ────────────────────────────────────────────────────────────────────

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DwightPlaybookWorkbench() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isSuperAdmin = profile?.role === "Super Admin"
  const onBack = () => navigate("/app/ai-assistant")

  const [selectedSlug, setSelectedSlug] = useState<PlaybookSlug | null>(null)
  const [overrides, setOverrides] = useState<Record<string, PlaybookOverride>>({})
  const [loadingOverrides, setLoadingOverrides] = useState(false)

  // Load all override rows on mount so index cards show "last edited"
  useEffect(() => {
    async function load() {
      setLoadingOverrides(true)
      const { data } = await (supabase as any)
        .from("dw1ght_playbook_overrides")
        .select("playbook_slug, allowed_context, instructions, decision_logic, output_definition, post_processing, tone_calibration, version, updated_at, updated_by")
      if (data) {
        const map: Record<string, PlaybookOverride> = {}
        for (const row of data) {
          map[row.playbook_slug] = {
            allowed_context:   row.allowed_context,
            instructions:      row.instructions,
            decision_logic:    row.decision_logic,
            output_definition: row.output_definition,
            post_processing:   row.post_processing,
            tone_calibration:  row.tone_calibration,
            version: row.version,
            updated_at: row.updated_at,
          }
        }
        setOverrides(map)
      }
      setLoadingOverrides(false)
    }
    load()
  }, [])

  const selectedPlaybook = selectedSlug ? PLAYBOOK_META.find(p => p.slug === selectedSlug) ?? null : null

  if (selectedPlaybook) {
    return (
      <PlaybookEditor
        playbook={selectedPlaybook}
        override={overrides[selectedPlaybook.slug] ?? null}
        isSuperAdmin={isSuperAdmin}
        onBack={() => setSelectedSlug(null)}
        onOverrideSaved={(slug, updated) => setOverrides(prev => ({ ...prev, [slug]: updated }))}
        onOverrideReverted={(slug) => setOverrides(prev => { const next = { ...prev }; delete next[slug]; return next })}
      />
    )
  }

  return (
    <div className="min-h-screen">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="hero-area px-8 py-7">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/65 hover:text-white/90 text-sm font-medium mb-5 transition-colors"
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
              DW1GHT Playbook Workbench
            </h1>
            <p
              className="text-white/65 text-xs font-semibold tracking-widest uppercase"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Governance · Behavior Tuning · Learning Management
            </p>
          </div>
        </div>
      </div>

      {/* ── Playbook Cards ─────────────────────────────────────────── */}
      <div className="px-8 pb-10 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl">
        {PLAYBOOK_META.map(p => {
          const override = overrides[p.slug]
          const isComingSoon = p.status === "coming_soon"
          return (
            <div
              key={p.slug}
              onClick={() => !isComingSoon && setSelectedSlug(p.slug)}
              className={cn(
                "card-elevated rounded-xl p-5 flex flex-col gap-3 border-0 transition-all",
                isComingSoon
                  ? "opacity-50 cursor-default"
                  : "card-hoverable cursor-pointer"
              )}
              style={{ borderTop: `2px solid ${isComingSoon ? "rgba(255,255,255,0.1)" : "var(--skyshare-gold)"}` }}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{p.emoji}</span>
                  <h3
                    className="text-foreground text-sm font-semibold tracking-wide uppercase"
                    style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}
                  >
                    {p.name}
                  </h3>
                </div>
                {isComingSoon ? (
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.3)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    Coming Soon
                  </span>
                ) : (
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background: "rgba(16,185,129,0.12)",
                      color: "var(--skyshare-success)",
                      border: "1px solid rgba(16,185,129,0.2)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>

              <p className="text-foreground/75 text-sm leading-relaxed">{p.description}</p>

              {/* Trigger label */}
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3" style={{ color: "var(--skyshare-gold)", opacity: 0.85 }} />
                <span
                  className="text-xs font-semibold text-foreground/70"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}
                >
                  {p.triggerLabel}
                </span>
              </div>

              {/* Last edited */}
              {override && !isComingSoon && (
                <p className="text-xs text-foreground/60 font-medium mt-auto">
                  v{override.version} · last edited {new Date(override.updated_at).toLocaleDateString()}
                </p>
              )}
              {!override && !isComingSoon && !loadingOverrides && (
                <p className="text-xs text-foreground/55 font-medium mt-auto">Using code defaults</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Playbook Editor ──────────────────────────────────────────────────────────

interface EditorProps {
  playbook: PlaybookMeta
  override: PlaybookOverride | null
  isSuperAdmin: boolean
  onBack: () => void
  onOverrideSaved: (slug: PlaybookSlug, updated: PlaybookOverride) => void
  onOverrideReverted: (slug: PlaybookSlug) => void
}

function PlaybookEditor({
  playbook, override, isSuperAdmin,
  onBack, onOverrideSaved, onOverrideReverted,
}: EditorProps) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const onBackToRoot = () => navigate("/app/ai-assistant")
  // isAdmin = read-only access; isSuperAdmin = full write access
  const isAdmin = isSuperAdmin || profile?.role === "Admin"

  // ── Playbook tab state ───────────────────────────────────────────
  const [identityOpen, setIdentityOpen] = useState(true)
  const [dataContractOpen, setDataContractOpen] = useState(true)
  const [editValues, setEditValues] = useState<Record<string, string>>({
    allowed_context:   override?.allowed_context   ?? "",
    instructions:      override?.instructions      ?? "",
    decision_logic:    override?.decision_logic    ?? "",
    output_definition: override?.output_definition ?? "",
    post_processing:   override?.post_processing   ?? "",
    tone_calibration:  override?.tone_calibration  ?? "",
  })
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [revertingSection, setRevertingSection] = useState<string | null>(null)

  // ── Suggestions tab state ────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(true)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [rejectingSugId, setRejectingSugId] = useState<string | null>(null)
  const [applyToast, setApplyToast] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const applyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [aiAssistLoading, setAiAssistLoading] = useState(false)
  const [aiAssistStage, setAiAssistStage] = useState<string | null>(null)
  const [aiAssistError, setAiAssistError] = useState<string | null>(null)
  const [aiAssistAnalysis, setAiAssistAnalysis] = useState<string | null>(null)
  const [aiAssistConfirm, setAiAssistConfirm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState("")
  const [importMode, setImportMode] = useState<"file" | "paste">("file")
  const [importError, setImportError] = useState<string | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importDragOver, setImportDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [copyToast, setCopyToast] = useState(false)
  const [activeTab, setActiveTab] = useState("playbook")
  const copyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load suggestions ─────────────────────────────────────────────
  async function loadSuggestions() {
    setLoadingSuggestions(true)
    const { data } = await (supabase as any)
      .from("dw1ght_playbook_suggestions")
      .select("id, section_key, change_type, source_text, suggested_text, reasoning, source_type, review_status, created_at")
      .eq("playbook_slug", playbook.slug)
      .eq("review_status", "pending")
      .order("created_at", { ascending: false })
    setSuggestions(data ?? [])
    setLoadingSuggestions(false)
  }

  useEffect(() => { loadSuggestions() }, [playbook.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Token estimate ────────────────────────────────────────────────
  const { tokenEstimate, hasCodeDefaults } = useMemo(() => {
    const sections = Object.values(editValues)
    const overrideChars = sections.reduce((n, s) => n + s.length, 0)
    return {
      tokenEstimate: Math.ceil(overrideChars / 4),
      hasCodeDefaults: sections.some(s => !s.trim()),
    }
  }, [editValues])

  // ── Suggestion mutations ─────────────────────────────────────────
  async function applySuggestion(s: Suggestion) {
    setApplyingId(s.id)
    setApplyError(null)
    try {
      // Compute new value upfront (before any state updates so the value is reliable)
      const current = editValues[s.section_key] ?? ""
      let newVal: string
      if (s.change_type === "append") {
        newVal = current.trim() ? current + "\n\n" + s.suggested_text : s.suggested_text
      } else if (s.change_type === "replace_text" && s.source_text) {
        const updated = current.replace(s.source_text, s.suggested_text)
        if (updated === current) {
          // source_text not found in section — fall back to append with a warning note
          newVal = current.trim() ? current + "\n\n" + s.suggested_text : s.suggested_text
          console.warn("[Workbench] replace_text: source_text not found in section, fell back to append", s.section_key)
        } else {
          newVal = updated
        }
      } else {
        newVal = s.suggested_text
      }

      // 1. Persist to dw1ght_playbook_overrides (auto-save — no separate Save step needed)
      const upsertData: Record<string, unknown> = {
        playbook_slug: playbook.slug,
        [s.section_key]: newVal || null,
        updated_at: new Date().toISOString(),
        version: (override?.version ?? 0) + 1,
      }
      if (profile?.id) upsertData.updated_by = profile.id

      const { data: savedOverride, error: saveErr } = await (supabase as any)
        .from("dw1ght_playbook_overrides")
        .upsert(upsertData, { onConflict: "playbook_slug" })
        .select("allowed_context, instructions, decision_logic, output_definition, post_processing, tone_calibration, version, updated_at")
        .single()
      if (saveErr) throw new Error(saveErr.message)

      // 2. Mark suggestion accepted
      const { error: sugErr } = await (supabase as any).from("dw1ght_playbook_suggestions")
        .update({ review_status: "accepted", reviewed_at: new Date().toISOString(), reviewed_by: profile?.id ?? null })
        .eq("id", s.id)
      if (sugErr) throw new Error(sugErr.message)

      // 3. Update UI — both DB writes confirmed
      setEditValues(prev => ({ ...prev, [s.section_key]: newVal }))
      if (savedOverride) onOverrideSaved(playbook.slug, savedOverride)
      setSuggestions(prev => prev.filter(x => x.id !== s.id))

      const label = SECTION_LABELS[s.section_key] ?? s.section_key
      setApplyToast(`Applied & saved to ${label}`)
      if (applyToastTimer.current) clearTimeout(applyToastTimer.current)
      applyToastTimer.current = setTimeout(() => setApplyToast(null), 5000)
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : "Failed to apply suggestion — please try again")
    } finally {
      setApplyingId(null)
    }
  }

  async function rejectSuggestion(id: string) {
    setRejectingSugId(id)
    try {
      const { error } = await (supabase as any).from("dw1ght_playbook_suggestions")
        .update({ review_status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: profile?.id ?? null })
        .eq("id", id)
      if (error) throw new Error(error.message)
      setSuggestions(prev => prev.filter(x => x.id !== id))
    } catch (e: unknown) {
      console.error("[rejectSuggestion]", e)
    } finally {
      setRejectingSugId(null)
    }
  }

  // ── Copy for AI ──────────────────────────────────────────────────
  function copyForAI() {
    const sectionBlock = Object.entries(SECTION_LABELS).map(([key, label]) => {
      const text = editValues[key]?.trim() || ""
      return `[${label.toUpperCase()}]\n${text || "(using code default — not overridden)"}`
    }).join("\n\n")

    const prompt = `You are helping improve the DW1GHT ${playbook.name} playbook for an aviation maintenance management system.

${playbook.description}

Review the current section contents below, then suggest specific targeted improvements. Be surgical — only suggest changes where there is a clear gap or systemic problem. If the sections look solid, return an empty suggestions array.

=== CURRENT PLAYBOOK SECTIONS ===

${sectionBlock}

---
Respond with ONLY valid JSON (no markdown fences, no prose outside the JSON):
{
  "analysis": "1-2 sentence overall assessment",
  "suggestions": [
    {
      "section_key": "allowed_context | instructions | decision_logic | output_definition | post_processing | tone_calibration",
      "change_type": "append | replace_section",
      "suggested_text": "exact text to add (append) or full new section content (replace_section)",
      "reasoning": "what specific problem this solves and which learnings motivated it"
    }
  ]
}`

    const doToast = () => {
      setCopyToast(true)
      if (copyToastTimer.current) clearTimeout(copyToastTimer.current)
      copyToastTimer.current = setTimeout(() => setCopyToast(false), 3000)
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(prompt).then(doToast).catch(() => {
        // Fallback for blocked clipboard API
        const el = document.createElement("textarea")
        el.value = prompt
        el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0"
        document.body.appendChild(el)
        el.select()
        document.execCommand("copy")
        document.body.removeChild(el)
        doToast()
      })
    } else {
      const el = document.createElement("textarea")
      el.value = prompt
      el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0"
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      doToast()
    }
  }

  // ── AI Assist (inline) ───────────────────────────────────────────
  async function runAiAssist() {
    setAiAssistLoading(true)
    setAiAssistStage("Building prompt…")
    setAiAssistAnalysis(null)
    setAiAssistError(null)
    try {
      const { data: { session } } = await (supabase as any).auth.getSession()
      setAiAssistStage("Sending to Claude…")
      const res = await fetch("/.netlify/functions/dw1ght-playbook-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({
          action: "assist",
          playbook_slug: playbook.slug,
          sections: editValues,
          inbox_learnings: inboxLearnings.map(l => ({ lesson: l.lesson, category: l.category, source_type: l.source_type ?? "" })),
        }),
      })
      setAiAssistStage("Analyzing response…")
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "AI assist failed")
      if (body.analysis) setAiAssistAnalysis(body.analysis)
      setAiAssistStage(`Saving ${body.count} suggestion${body.count !== 1 ? "s" : ""}…`)
      await loadSuggestions()
      if (body.count > 0) setActiveTab("suggestions")
    } catch (e: unknown) {
      setAiAssistError(e instanceof Error ? e.message : "AI Assist failed — please try again")
    } finally {
      setAiAssistLoading(false)
      setAiAssistStage(null)
    }
  }

  // ── Import AI response ───────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""                // reset so same file can be re-selected
    setImportError(null)
    try {
      const text = await file.text()
      await importFromRaw(text)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to read file")
    }
  }

  async function importFromRaw(raw: string) {
    setImportError(null)
    setImportLoading(true)
    try {
      const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
      const parsed = JSON.parse(cleaned)
      const sugs = parsed.suggestions ?? (Array.isArray(parsed) ? parsed : null)
      if (!Array.isArray(sugs) || sugs.length === 0) throw new Error("No suggestions array found in the JSON")
      const { data: { session } } = await (supabase as any).auth.getSession()
      const res = await fetch("/.netlify/functions/dw1ght-playbook-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ action: "import", playbook_slug: playbook.slug, suggestions: sugs }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? "Import failed")
      await loadSuggestions()
      setShowImportModal(false)
      setImportText("")
      setActiveTab("suggestions")
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Invalid JSON or unexpected format")
    } finally {
      setImportLoading(false)
    }
  }

  async function importResponse() {
    await importFromRaw(importText)
  }

  // ── Playbook section save ────────────────────────────────────────
  async function saveSection(key: EditableSectionKey) {
    setSavingSection(key)
    const newValue = editValues[key] || null

    // Upsert the override row for this playbook
    const upsertData: Record<string, unknown> = {
      playbook_slug: playbook.slug,
      [key]: newValue,
      updated_at: new Date().toISOString(),
      version: (override?.version ?? 0) + 1,
    }
    if (profile?.id) upsertData.updated_by = profile.id

    const { data, error } = await (supabase as any)
      .from("dw1ght_playbook_overrides")
      .upsert(upsertData, { onConflict: "playbook_slug" })
      .select("allowed_context, instructions, decision_logic, output_definition, post_processing, tone_calibration, version, updated_at")
      .single()

    if (!error && data) {
      onOverrideSaved(playbook.slug, data)
    }
    setSavingSection(null)
  }

  async function revertSection(key: EditableSectionKey) {
    if (!isSuperAdmin) return
    setRevertingSection(key)
    setEditValues(prev => ({ ...prev, [key]: "" }))
    // Null out just this field in the override
    const { data } = await (supabase as any)
      .from("dw1ght_playbook_overrides")
      .update({ [key]: null, updated_at: new Date().toISOString() })
      .eq("playbook_slug", playbook.slug)
      .select("allowed_context, instructions, decision_logic, output_definition, post_processing, tone_calibration, version, updated_at")
      .single()
    if (data) onOverrideSaved(playbook.slug, data)
    setRevertingSection(null)
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="hero-area px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-white/55 text-xs mb-4 font-medium" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <button onClick={onBackToRoot} className="hover:text-white/85 transition-colors">AI Assistant</button>
          <span className="text-white/35">/</span>
          <button onClick={onBack} className="hover:text-white/85 transition-colors">Playbook Workbench</button>
          <span className="text-white/35">/</span>
          <span className="text-white/80">{playbook.name}</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-3xl leading-none">{playbook.emoji}</span>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1
                className="text-white leading-none"
                style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "0.05em" }}
              >
                {playbook.name.toUpperCase()}
              </h1>
              <span
                className="text-[9px] px-2 py-0.5 rounded-full"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: "rgba(16,185,129,0.12)",
                  color: "var(--skyshare-success)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Active
              </span>
            </div>
            <p className="text-white/60 text-xs font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Trigger: {playbook.triggerLabel} · Powered by Claude Haiku
            </p>
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="px-8 py-6 max-w-5xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab bar + token counter */}
          <div className="flex items-end justify-between mb-6 border-b border-white/[0.12]">
            <TabsList
              className="h-auto p-0 bg-transparent rounded-none border-0"
              style={{ gap: 0 }}
            >
              {[
                { value: "playbook",     label: "Playbook",         icon: <BookOpen className="w-3.5 h-3.5" /> },
                { value: "history",      label: "History",          icon: <History className="w-3.5 h-3.5" /> },
                { value: "suggestions",  label: "Suggestions",      icon: <Sparkles className="w-3.5 h-3.5" />,     badge: suggestions.length, badgeColor: "rgba(139,92,246,0.85)" },
              ].map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "flex items-center gap-1.5 px-5 py-3 text-[10px] font-bold uppercase tracking-widest rounded-none border-b-2 transition-colors",
                    "data-[state=active]:border-[var(--skyshare-gold)] data-[state=active]:text-[var(--skyshare-gold)]",
                    "data-[state=inactive]:border-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground/70",
                  )}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span
                      className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{ background: (tab as any).badgeColor ?? "rgba(193,2,48,0.85)", color: "white" }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Token counter only */}
            <div className="flex items-center gap-2 pb-3">
              {/* Token estimate */}
              <div
                className="flex items-center gap-1.5 pl-2"
                title={hasCodeDefaults ? "Override content + active learnings. Code-default sections add ~1,200–2,000 tokens each." : "Override content + active learnings"}
              >
                <Hash className="w-3 h-3 opacity-70" style={{ color: "var(--skyshare-gold)" }} />
                <span className="text-[10px] font-bold tabular-nums" style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)" }}>
                  ~{tokenEstimate.toLocaleString()}
                </span>
                <span className="text-[9px] text-foreground/45 font-medium" style={{ fontFamily: "var(--font-heading)" }}>
                  {hasCodeDefaults ? "tokens (overrides + learnings)" : "tokens"}
                </span>
              </div>
            </div>
          </div>

          {/* ── PLAYBOOK TAB ──────────────────────────────────────── */}
          <TabsContent value="playbook" className="space-y-6">

            {/* ── Read-only notice for Admin (non-Super Admin) ────── */}
            {isAdmin && !isSuperAdmin && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: "rgba(193,2,48,0.08)", border: "1px solid rgba(193,2,48,0.2)" }}
              >
                <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "var(--skyshare-red)", opacity: 0.7 }} />
                <p className="text-xs text-foreground/60" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
                  Read-only — Super Admin access is required to edit and save playbook sections.
                </p>
              </div>
            )}

            {/* ── Identity & Trigger — read-only ─────────────────── */}
            <ReadOnlySection
              title="Identity & Trigger"
              icon={<GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />}
              open={identityOpen}
              onToggle={() => setIdentityOpen(v => !v)}
            >
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <ReadOnlyField label="Name" value={playbook.name} />
                <ReadOnlyField label="Status" value={
                  <span style={{ color: playbook.status === "active" ? "var(--skyshare-success)" : "rgba(255,255,255,0.4)" }}>
                    {playbook.status === "active" ? "Active" : "Coming Soon"}
                  </span>
                } />
                <ReadOnlyField label="Trigger" value={playbook.triggerLabel} />
                <ReadOnlyField label="Trigger Type" value={playbook.triggerType.replace(/_/g, " ")} />
                <div className="col-span-2">
                  <ReadOnlyField label="Description" value={playbook.description} />
                </div>
              </div>
            </ReadOnlySection>

            {/* ── Data Contract — read-only ───────────────────────── */}
            <ReadOnlySection
              title="Data Contract"
              icon={<Info className="w-3.5 h-3.5 text-muted-foreground" />}
              open={dataContractOpen}
              onToggle={() => setDataContractOpen(v => !v)}
            >
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/60 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                    Inputs
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(playbook.inputSchema).map(([k, v]) => (
                      <div key={k} className="flex gap-3 text-xs">
                        <code className="text-[var(--skyshare-gold)] flex-shrink-0 font-semibold min-w-[120px]">{k}</code>
                        <span className="text-foreground/70">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/60 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
                    Output Format
                  </p>
                  <p className="text-xs text-foreground/70">{playbook.outputFormat}</p>
                </div>
              </div>
            </ReadOnlySection>

            {/* Editable sections */}
            {playbook.editableSections.map(section => {
              const currentOverride = override?.[section.key] ?? null
              const hasOverride = !!currentOverride?.trim()
              const value = editValues[section.key]
              const isDirty = value !== (currentOverride ?? "")
              const isSaving = savingSection === section.key
              const isReverting = revertingSection === section.key

              return (
                <div
                  key={section.key}
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: hasOverride ? "rgba(212,160,23,0.35)" : "rgba(255,255,255,0.14)" }}
                >
                  {/* Section header */}
                  <div
                    className="flex items-start justify-between px-5 py-4 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.10)" }}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-[12px] font-bold uppercase tracking-widest"
                          style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.15em", color: "var(--skyshare-gold)" }}
                        >
                          {section.label}
                        </span>
                        {hasOverride && (
                          <span
                            className="text-[8px] px-1.5 py-0.5 rounded"
                            style={{
                              fontFamily: "var(--font-heading)",
                              background: "rgba(212,160,23,0.12)",
                              color: "var(--skyshare-gold)",
                              border: "1px solid rgba(212,160,23,0.2)",
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                            }}
                          >
                            Modified
                          </span>
                        )}
                        {!hasOverride && (
                          <span
                            className="text-[8px] px-1.5 py-0.5 rounded"
                            style={{
                              fontFamily: "var(--font-heading)",
                              background: "rgba(255,255,255,0.04)",
                              color: "rgba(255,255,255,0.25)",
                              border: "1px solid rgba(255,255,255,0.07)",
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                            }}
                          >
                            Code Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/65">{section.description}</p>
                    </div>
                  </div>

                  {/* Textarea */}
                  <div className="p-5 space-y-3">
                    <textarea
                      value={value}
                      onChange={e => setEditValues(prev => ({ ...prev, [section.key]: e.target.value }))}
                      disabled={!isSuperAdmin}
                      rows={10}
                      className="w-full rounded-lg px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none transition-all"
                      style={{
                        fontFamily: "'DM Mono', 'Fira Code', monospace",
                        fontSize: "12px",
                        lineHeight: "1.6",
                        background: "rgba(0,0,0,0.30)",
                        border: "1px solid rgba(255,255,255,0.16)",
                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
                        color: "rgba(255,255,255,0.92)",
                        minHeight: "180px",
                        maxHeight: "480px",
                        outline: "none",
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(212,160,23,0.12), inset 0 1px 3px rgba(0,0,0,0.3)" }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; e.currentTarget.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.3)" }}
                    />

                    {/* Save / Revert controls */}
                    {isSuperAdmin && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => saveSection(section.key as EditableSectionKey)}
                          disabled={isSaving || !isDirty}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-35"
                          style={{
                            fontFamily: "var(--font-heading)",
                            background: isDirty ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.04)",
                            color: isDirty ? "var(--skyshare-gold)" : "rgba(255,255,255,0.25)",
                            border: `1px solid ${isDirty ? "rgba(212,160,23,0.25)" : "rgba(255,255,255,0.07)"}`,
                          }}
                        >
                          <Save className="w-3 h-3" />
                          {isSaving ? "Saving…" : "Save Override"}
                        </button>

                        {hasOverride && isSuperAdmin && (
                          <button
                            onClick={() => revertSection(section.key as EditableSectionKey)}
                            disabled={!!isReverting}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors text-white/50 hover:text-white/80 border border-white/[0.12] disabled:opacity-40"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            <Undo2 className="w-3 h-3" />
                            {isReverting ? "Reverting…" : "Revert to Default"}
                          </button>
                        )}

                        {override && (
                          <span className="text-[9px] text-foreground/60 font-medium ml-auto">
                            v{override.version} · {new Date(override.updated_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </TabsContent>

          {/* ── HISTORY TAB ───────────────────────────────────────── */}
          <TabsContent value="history">
            <div
              className="rounded-xl p-8 text-center"
              style={{ border: "1px dashed rgba(255,255,255,0.07)" }}
            >
              <History className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-foreground/60 font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Version History
              </p>
              {override ? (
                <div className="mt-4 text-xs text-foreground/65 space-y-1">
                  <p>Current version: v{override.version}</p>
                  <p>Last modified: {new Date(override.updated_at).toLocaleString()}</p>
                  <p className="mt-3 text-foreground/50">Full audit log coming in V2.</p>
                </div>
              ) : (
                <p className="text-xs text-foreground/50 mt-1">
                  No overrides saved yet — using code defaults.
                </p>
              )}
            </div>
          </TabsContent>

          {/* ── SUGGESTIONS TAB ───────────────────────────────────── */}
          <TabsContent value="suggestions" className="space-y-4">

            {/* ── Action toolbar ─────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Copy for AI — available to all who can read */}
              <div className="relative">
                <button
                  onClick={copyForAI}
                  title="Copy playbook sections as a structured prompt for Claude or ChatGPT"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors text-foreground/55 hover:text-foreground/85 border border-white/[0.10] hover:border-white/[0.20]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  <ClipboardCopy className="w-3 h-3" />
                  Copy for AI
                </button>
                {copyToast && (
                  <div
                    className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-bold"
                    style={{ background: "rgba(16,185,129,0.15)", color: "var(--skyshare-success)", border: "1px solid rgba(16,185,129,0.25)", fontFamily: "var(--font-heading)" }}
                  >
                    Copied to clipboard
                  </div>
                )}
              </div>

              {/* Import + AI Assist — Super Admin only */}
              {isSuperAdmin && (
                <>
                  <button
                    onClick={() => { setShowImportModal(true); setImportError(null) }}
                    title="Paste a JSON response from Claude or ChatGPT to import suggestions"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors text-foreground/55 hover:text-foreground/85 border border-white/[0.10] hover:border-white/[0.20]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    <Upload className="w-3 h-3" />
                    Import
                  </button>

                  <button
                    onClick={() => setAiAssistConfirm(true)}
                    disabled={aiAssistLoading}
                    title="Ask Claude to analyze this playbook and suggest improvements based on current learnings"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background: "rgba(139,92,246,0.12)",
                      color: "rgba(196,160,255,0.9)",
                      border: "1px solid rgba(139,92,246,0.25)",
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {aiAssistLoading ? "Thinking…" : "AI Assist"}
                  </button>
                </>
              )}
            </div>

            {/* AI Assist confirmation dialog */}
            {aiAssistConfirm && (
              <div
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(196,160,255,0.9)" }} />
                  <div>
                    <p className="text-sm text-foreground/85 font-medium mb-1">Send playbook to Claude for analysis?</p>
                    <p className="text-xs text-foreground/55 leading-relaxed">
                      This will send all 6 current section values plus any <strong className="text-foreground/75">Inbox learnings</strong> to <strong className="text-foreground/75">claude-sonnet-4-6</strong>. Claude will return targeted edit suggestions that land here as pending cards.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setAiAssistConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors text-foreground/50 hover:text-foreground/80 border border-white/[0.10] hover:border-white/[0.20]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setAiAssistConfirm(false); runAiAssist() }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background: "rgba(139,92,246,0.2)",
                      color: "rgba(196,160,255,0.95)",
                      border: "1px solid rgba(139,92,246,0.35)",
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    Confirm — Run Analysis
                  </button>
                </div>
              </div>
            )}

            {/* AI Assist loading indicator */}
            {aiAssistLoading && (
              <div
                className="rounded-xl p-5 flex flex-col gap-3"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-2 flex-shrink-0 animate-spin" style={{ borderColor: "rgba(196,160,255,0.6)", borderTopColor: "rgba(196,160,255,0.05)" }} />
                  <p className="text-sm font-semibold" style={{ color: "rgba(196,160,255,0.9)", fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
                    {aiAssistStage ?? "Working…"}
                  </p>
                </div>
                {/* Scanning bar */}
                <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.15)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(196,160,255,0.7), transparent)",
                      width: "40%",
                      animation: "scan-bar 1.4s ease-in-out infinite",
                    }}
                  />
                </div>
                <style>{`@keyframes scan-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>
              </div>
            )}

            {/* AI Assist error */}
            {aiAssistError && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "rgba(193,2,48,0.08)", border: "1px solid rgba(193,2,48,0.25)" }}>
                <X className="w-4 h-4 flex-shrink-0" style={{ color: "var(--skyshare-red)" }} />
                <p className="text-xs leading-relaxed text-foreground/70">{aiAssistError}</p>
                <button onClick={() => setAiAssistError(null)} className="ml-auto flex-shrink-0 text-foreground/35 hover:text-foreground/60 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Apply success toast */}
            {applyToast && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--skyshare-success)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--skyshare-success)", fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>{applyToast}</p>
                <button onClick={() => setApplyToast(null)} className="ml-auto flex-shrink-0 text-foreground/35 hover:text-foreground/60 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Apply error */}
            {applyError && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "rgba(193,2,48,0.08)", border: "1px solid rgba(193,2,48,0.25)" }}>
                <X className="w-4 h-4 flex-shrink-0" style={{ color: "var(--skyshare-red)" }} />
                <p className="text-xs leading-relaxed text-foreground/70">{applyError}</p>
                <button onClick={() => setApplyError(null)} className="ml-auto flex-shrink-0 text-foreground/35 hover:text-foreground/60 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* AI Assist analysis banner */}
            {aiAssistAnalysis && (
              <div
                className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
              >
                <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(196,160,255,0.9)" }} />
                <p className="text-sm text-foreground/75 leading-relaxed">{aiAssistAnalysis}</p>
                <button onClick={() => setAiAssistAnalysis(null)} className="ml-auto flex-shrink-0 text-foreground/35 hover:text-foreground/60 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Header */}
            <div>
              <h3 className="text-foreground text-sm font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.15em" }}>
                Playbook Suggestions
              </h3>
              <p className="text-xs text-foreground/65 mt-0.5">
                AI-generated section edits from interview analysis and DOM feedback. Apply to auto-save the suggestion directly to the playbook — no separate Save step needed.
              </p>
            </div>

            {loadingSuggestions ? (
              <div className="flex items-center gap-2 text-foreground/60 text-sm py-8">
                <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Loading suggestions…
              </div>
            ) : suggestions.length === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ border: "1px dashed rgba(255,255,255,0.07)" }}>
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-foreground/60 font-semibold" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  No pending suggestions
                </p>
                <p className="text-xs text-foreground/50 mt-1">
                  Run an interview, use AI Assist, or import a response to generate suggestions
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map(s => {
                  const sourceMeta = SUGGESTION_SOURCE_META[s.source_type] ?? { label: s.source_type, color: "text-white/40" }
                  const sectionLabel = SECTION_LABELS[s.section_key] ?? s.section_key
                  const changeTypeMeta = s.change_type === "append"
                    ? { label: "Append", textColor: "text-emerald-400", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.2)" }
                    : s.change_type === "replace_text"
                      ? { label: "Rewrite", textColor: "text-sky-400", bg: "rgba(56,189,248,0.10)", border: "rgba(56,189,248,0.2)" }
                      : { label: "Replace Section", textColor: "text-amber-400", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.2)" }
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border overflow-hidden"
                      style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.04)" }}
                    >
                      {/* Card header */}
                      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 flex-wrap">
                        {/* Section target — gold, prominent */}
                        <span
                          className="text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-widest"
                          style={{ fontFamily: "var(--font-heading)", background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)", border: "1px solid rgba(212,160,23,0.35)", letterSpacing: "0.12em" }}
                        >
                          → {sectionLabel}
                        </span>
                        <span
                          className={cn("text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-widest", changeTypeMeta.textColor)}
                          style={{ fontFamily: "var(--font-heading)", background: changeTypeMeta.bg, border: `1px solid ${changeTypeMeta.border}` }}
                        >
                          {changeTypeMeta.label}
                        </span>
                        <span className={cn("text-[9px] font-medium", sourceMeta.color)} style={{ fontFamily: "var(--font-heading)" }}>
                          via {sourceMeta.label}
                        </span>
                        <span className="text-[9px] text-foreground/40 ml-auto">
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Reasoning */}
                      {s.reasoning && (
                        <p className="px-4 pb-2 text-xs text-foreground/65 leading-relaxed">{s.reasoning}</p>
                      )}

                      {/* Suggested text — diff view */}
                      <div className="mx-4 mb-3">
                        <SuggestionDiff
                          currentText={editValues[s.section_key] ?? ""}
                          suggestedText={s.suggested_text}
                          changeType={s.change_type}
                          sourceText={s.source_text}
                        />
                      </div>

                      {/* Actions */}
                      {isSuperAdmin && (
                        <div className="flex items-center gap-2 px-4 pb-3.5">
                          <button
                            onClick={() => applySuggestion(s)}
                            disabled={applyingId === s.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
                            style={{ fontFamily: "var(--font-heading)", background: "rgba(16,185,129,0.12)", color: "var(--skyshare-success)", border: "1px solid rgba(16,185,129,0.2)" }}
                          >
                            <Check className="w-3 h-3" />
                            {applyingId === s.id ? "Applying…" : "Apply"}
                          </button>
                          <button
                            onClick={() => rejectSuggestion(s.id)}
                            disabled={rejectingSugId === s.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
                            style={{ fontFamily: "var(--font-heading)", background: "rgba(193,2,48,0.10)", color: "rgba(220,100,100,0.9)", border: "1px solid rgba(193,2,48,0.2)" }}
                          >
                            <X className="w-3 h-3" />
                            {rejectingSugId === s.id ? "Rejecting…" : "Reject"}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Import AI Response Modal ─────────────────────────────── */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={e => { if (e.target === e.currentTarget) { setShowImportModal(false); setImportMode("file"); setImportText(""); setImportError(null) } }}
        >
          <div
            className="w-full max-w-xl rounded-2xl p-6 space-y-4"
            style={{ background: "hsl(0 0% 14%)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-foreground font-bold uppercase tracking-widest text-sm" style={{ fontFamily: "var(--font-heading)" }}>
                  Import Suggestions
                </h3>
                <p className="text-xs text-foreground/55 mt-0.5">
                  Upload a JSON file or paste the response from Claude / ChatGPT.
                </p>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportMode("file"); setImportText(""); setImportError(null) }} className="text-foreground/40 hover:text-foreground/70 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: "rgba(0,0,0,0.25)" }}>
              {(["file", "paste"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setImportMode(mode); setImportError(null) }}
                  className="flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    fontFamily: "var(--font-heading)",
                    background: importMode === mode ? "rgba(139,92,246,0.18)" : "transparent",
                    color: importMode === mode ? "rgba(196,160,255,0.9)" : "rgba(255,255,255,0.35)",
                    border: importMode === mode ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
                  }}
                >
                  {mode === "file" ? "Upload File" : "Paste JSON"}
                </button>
              ))}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* File upload zone */}
            {importMode === "file" && (
              <div
                onClick={() => { if (!importLoading) fileInputRef.current?.click() }}
                onDragOver={e => { e.preventDefault(); if (!importLoading) setImportDragOver(true) }}
                onDragEnter={e => { e.preventDefault(); if (!importLoading) setImportDragOver(true) }}
                onDragLeave={e => { e.preventDefault(); setImportDragOver(false) }}
                onDrop={e => {
                  e.preventDefault()
                  setImportDragOver(false)
                  if (importLoading) return
                  const file = e.dataTransfer.files?.[0]
                  if (!file) return
                  file.text().then(text => importFromRaw(text)).catch(err => setImportError(err instanceof Error ? err.message : "Failed to read file"))
                }}
                className="w-full rounded-xl py-10 flex flex-col items-center gap-3 transition-all select-none"
                style={{
                  cursor: importLoading ? "default" : "pointer",
                  opacity: importLoading ? 0.6 : 1,
                  background: importDragOver ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.05)",
                  border: `2px dashed ${importError ? "rgba(220,80,80,0.4)" : importDragOver ? "rgba(139,92,246,0.6)" : "rgba(139,92,246,0.25)"}`,
                  transform: importDragOver ? "scale(1.01)" : "scale(1)",
                  boxShadow: importDragOver ? "0 0 0 4px rgba(139,92,246,0.08)" : "none",
                }}
              >
                {importLoading ? (
                  <>
                    <div className="w-6 h-6 rounded-full border-2 border-purple-400/30 border-t-purple-400/80 animate-spin" />
                    <span className="text-xs text-white/50">Importing…</span>
                  </>
                ) : importDragOver ? (
                  <>
                    <Upload className="w-8 h-8" style={{ color: "rgba(196,160,255,0.9)" }} />
                    <p className="text-sm font-semibold" style={{ color: "rgba(196,160,255,0.95)" }}>Drop it</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-7 h-7" style={{ color: "rgba(196,160,255,0.6)" }} />
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: "rgba(196,160,255,0.85)" }}>Drop a .json file here, or click to browse</p>
                      <p className="text-xs text-white/30 mt-0.5">Accepts the full AI response or a bare suggestions array</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Paste textarea */}
            {importMode === "paste" && (
              <textarea
                value={importText}
                onChange={e => { setImportText(e.target.value); setImportError(null) }}
                rows={10}
                placeholder='{ "suggestions": [ { "section_key": "instructions", "change_type": "append", "suggested_text": "...", "reasoning": "..." } ] }'
                className="w-full rounded-lg px-4 py-3 text-xs leading-relaxed resize-none focus:outline-none"
                style={{
                  fontFamily: "'DM Mono', 'Fira Code', monospace",
                  background: "rgba(0,0,0,0.30)",
                  border: `1px solid ${importError ? "rgba(220,80,80,0.4)" : "rgba(255,255,255,0.14)"}`,
                  color: "rgba(255,255,255,0.88)",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(212,160,23,0.1)" }}
                onBlur={e => { e.currentTarget.style.borderColor = importError ? "rgba(220,80,80,0.4)" : "rgba(255,255,255,0.14)"; e.currentTarget.style.boxShadow = "none" }}
              />
            )}

            {importError && (
              <p className="text-xs text-red-400/80 font-medium">{importError}</p>
            )}

            {importMode === "paste" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={importResponse}
                  disabled={importLoading || !importText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-40"
                  style={{ fontFamily: "var(--font-heading)", background: "rgba(139,92,246,0.15)", color: "rgba(196,160,255,0.9)", border: "1px solid rgba(139,92,246,0.3)" }}
                >
                  <Upload className="w-3 h-3" />
                  {importLoading ? "Importing…" : "Import Suggestions"}
                </button>
                <button
                  onClick={() => { setShowImportModal(false); setImportMode("file"); setImportText(""); setImportError(null) }}
                  className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/45 hover:text-white/70 border border-white/[0.10] transition-colors"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Cancel
                </button>
              </div>
            )}

            {importMode === "file" && (
              <button
                onClick={() => { setShowImportModal(false); setImportMode("file"); setImportText(""); setImportError(null) }}
                className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/45 hover:text-white/70 border border-white/[0.10] transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )

}

// ─── Suggestion Diff View ─────────────────────────────────────────────────────
// Renders a git-style diff between the current section text and the proposed
// suggestion. append = context + new green lines. replace_section = full diff.

const CONTEXT_LINES = 4 // lines of surrounding context shown for append

function SuggestionDiff({
  currentText,
  suggestedText,
  changeType,
  sourceText,
}: {
  currentText: string
  suggestedText: string
  changeType: "append" | "replace_text" | "replace_section"
  sourceText?: string | null
}) {
  const isEmpty = !currentText.trim()

  // ── APPEND ──────────────────────────────────────────────────────────
  if (changeType === "append") {
    const currentLines = currentText.split("\n")
    const newLines = suggestedText.split("\n")
    const contextStart = Math.max(0, currentLines.length - CONTEXT_LINES)
    const contextLines = currentLines.slice(contextStart)
    const hasMore = contextStart > 0

    return (
      <div
        className="rounded-lg overflow-hidden text-[11.5px] leading-relaxed"
        style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(139,92,246,0.18)", fontFamily: "'DM Mono', 'Fira Code', monospace", maxHeight: "360px", overflowY: "auto" }}
      >
        {isEmpty ? (
          <div className="px-3 py-1.5 text-white/30 italic border-b border-white/[0.06]">
            — section is unset (using code default) —
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="px-3 py-1 text-white/25 border-b border-white/[0.06]">
                ···
              </div>
            )}
            {contextLines.map((line, i) => (
              <div key={i} className="flex" style={{ background: "transparent" }}>
                <span className="w-5 flex-shrink-0 text-center text-white/20 select-none border-r border-white/[0.06] mr-2"> </span>
                <span className="text-white/40 py-0.5 pr-3 whitespace-pre-wrap break-all">{line || " "}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-1 border-y border-white/[0.08]" style={{ background: "rgba(139,92,246,0.06)" }}>
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(196,160,255,0.7)", fontFamily: "var(--font-heading)" }}>appending below</span>
              <div className="flex-1 border-t border-purple-500/20" />
            </div>
          </>
        )}
        {newLines.map((line, i) => (
          <div key={i} className="flex" style={{ background: "rgba(16,185,129,0.07)" }}>
            <span className="w-5 flex-shrink-0 text-center font-bold select-none border-r border-emerald-800/30 mr-2 text-emerald-500">+</span>
            <span className="text-emerald-300 py-0.5 pr-3 whitespace-pre-wrap break-all">{line || " "}</span>
          </div>
        ))}
      </div>
    )
  }

  // ── REPLACE TEXT ─────────────────────────────────────────────────────
  if (changeType === "replace_text") {
    // Show a surgical diff: source_text (red, being removed) vs suggested_text (green, replacement)
    const from = sourceText?.trim() || ""
    const parts = diffLines(from, suggestedText)
    return (
      <div
        className="rounded-lg overflow-hidden text-[11.5px] leading-relaxed"
        style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(56,189,248,0.18)", fontFamily: "'DM Mono', 'Fira Code', monospace", maxHeight: "360px", overflowY: "auto" }}
      >
        <div className="flex items-center gap-2 px-3 py-1 border-b border-white/[0.06]" style={{ background: "rgba(56,189,248,0.05)" }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(125,211,252,0.7)", fontFamily: "var(--font-heading)" }}>surgical rewrite — passage replacement</span>
        </div>
        {!from && (
          <div className="px-3 py-1.5 text-white/30 italic border-b border-white/[0.06]">
            — source passage not found — will append if applied —
          </div>
        )}
        {parts.map((part, i) => {
          const lines = part.value.split("\n")
          if (lines[lines.length - 1] === "") lines.pop()
          if (part.added) {
            return lines.map((line, j) => (
              <div key={`${i}-${j}`} className="flex" style={{ background: "rgba(16,185,129,0.09)" }}>
                <span className="w-5 flex-shrink-0 text-center font-bold select-none border-r border-emerald-800/30 mr-2 text-emerald-500">+</span>
                <span className="text-emerald-300 py-0.5 pr-3 whitespace-pre-wrap break-all">{line || " "}</span>
              </div>
            ))
          }
          if (part.removed) {
            return lines.map((line, j) => (
              <div key={`${i}-${j}`} className="flex" style={{ background: "rgba(239,68,68,0.08)" }}>
                <span className="w-5 flex-shrink-0 text-center font-bold select-none border-r border-red-800/30 mr-2 text-red-500">−</span>
                <span className="text-red-400 py-0.5 pr-3 whitespace-pre-wrap break-all line-through opacity-70">{line || " "}</span>
              </div>
            ))
          }
          return lines.map((line, j) => (
            <div key={`${i}-${j}`} className="flex" style={{ background: "transparent" }}>
              <span className="w-5 flex-shrink-0 text-center text-white/20 select-none border-r border-white/[0.06] mr-2"> </span>
              <span className="text-white/40 py-0.5 pr-3 whitespace-pre-wrap break-all">{line || " "}</span>
            </div>
          ))
        })}
      </div>
    )
  }

  // ── REPLACE SECTION ──────────────────────────────────────────────────
  const parts = diffLines(currentText || "", suggestedText)

  return (
    <div
      className="rounded-lg overflow-hidden text-[11.5px] leading-relaxed"
      style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(139,92,246,0.18)", fontFamily: "'DM Mono', 'Fira Code', monospace" }}
    >
      {isEmpty && (
        <div className="px-3 py-1.5 text-white/30 italic border-b border-white/[0.06]">
          — section is unset (using code default) — full replacement shown below —
        </div>
      )}
      {parts.map((part, i) => {
        const lines = part.value.split("\n")
        // diffLines includes a trailing empty string from the final newline — drop it
        if (lines[lines.length - 1] === "") lines.pop()

        if (part.added) {
          return lines.map((line, j) => (
            <div key={`${i}-${j}`} className="flex" style={{ background: "rgba(16,185,129,0.09)" }}>
              <span className="w-5 flex-shrink-0 text-center font-bold select-none border-r border-emerald-800/30 mr-2 text-emerald-500">+</span>
              <span className="text-emerald-300 py-0.5 pr-3 whitespace-pre-wrap break-all">{line || " "}</span>
            </div>
          ))
        }
        if (part.removed) {
          return lines.map((line, j) => (
            <div key={`${i}-${j}`} className="flex" style={{ background: "rgba(239,68,68,0.08)" }}>
              <span className="w-5 flex-shrink-0 text-center font-bold select-none border-r border-red-800/30 mr-2 text-red-500">−</span>
              <span className="text-red-400 py-0.5 pr-3 whitespace-pre-wrap break-all line-through opacity-70">{line || " "}</span>
            </div>
          ))
        }
        // Unchanged context — collapse if long
        const MAX_CTX = 3
        if (lines.length > MAX_CTX * 2 + 1) {
          return [
            ...lines.slice(0, MAX_CTX).map((line, j) => (
              <div key={`${i}-top-${j}`} className="flex">
                <span className="w-5 flex-shrink-0 text-center text-white/20 select-none border-r border-white/[0.06] mr-2"> </span>
                <span className="text-white/35 py-0.5 pr-3 whitespace-pre-wrap break-all">{line || " "}</span>
              </div>
            )),
            <div key={`${i}-fold`} className="px-3 py-0.5 text-white/20 border-y border-white/[0.04]">
              ··· {lines.length - MAX_CTX * 2} unchanged lines ···
            </div>,
            ...lines.slice(lines.length - MAX_CTX).map((line, j) => (
              <div key={`${i}-bot-${j}`} className="flex">
                <span className="w-5 flex-shrink-0 text-center text-white/20 select-none border-r border-white/[0.06] mr-2"> </span>
                <span className="text-white/35 py-0.5 pr-3 whitespace-pre-wrap break-all">{line || " "}</span>
              </div>
            )),
          ]
        }
        return lines.map((line, j) => (
          <div key={`${i}-${j}`} className="flex">
            <span className="w-5 flex-shrink-0 text-center text-white/20 select-none border-r border-white/[0.06] mr-2"> </span>
            <span className="text-white/35 py-0.5 pr-3 whitespace-pre-wrap break-all">{line || " "}</span>
          </div>
        ))
      })}
    </div>
  )
}

// ─── Read-Only Section Shell ───────────────────────────────────────────────────

function ReadOnlySection({
  title, icon, open, onToggle, children,
}: {
  title: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.02)" }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span
            className="text-[10px] font-bold uppercase tracking-widest text-foreground/70"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {title}
          </span>
          <span
            className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase"
            style={{
              fontFamily: "var(--font-heading)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.35)",
              border: "1px solid rgba(255,255,255,0.08)",
              letterSpacing: "0.12em",
            }}
          >
            Read Only
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground opacity-70" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground opacity-70" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Read-Only Field ──────────────────────────────────────────────────────────

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-foreground/55 mb-0.5" style={{ fontFamily: "var(--font-heading)" }}>
        {label}
      </p>
      <div className="text-xs text-foreground/75 leading-relaxed">{value}</div>
    </div>
  )
}
