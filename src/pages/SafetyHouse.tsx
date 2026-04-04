import { useState, useEffect, useRef, useCallback } from "react"
import { Shield, X, ChevronRight, Trash2, Pencil, Check } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

// ─── Config ───────────────────────────────────────────────────────────────────

const MSG = "Ricky, what do you want?"

const PHASES = [
  "typewriter", "glitch", "neon", "shake", "stamp",
  "rainbow", "ghost", "marquee", "disco", "matrix",
] as const
type Phase = typeof PHASES[number]

const PHASE_MS = 4500
const GC = `!<>-_\\/[]{}—=+*^?#$%@ABCDE0123456789`

function scramble(text: string, intensity: number) {
  return text.split("").map(c =>
    " ,?".includes(c) ? c :
    Math.random() < intensity ? GC[Math.floor(Math.random() * GC.length)] : c
  ).join("")
}

const MATRIX_COLS = Array.from({ length: 28 }, (_, i) => ({
  left:     `${1.5 + i * 3.5}%`,
  delay:    `-${((i * 0.41) % 4).toFixed(2)}s`,
  duration: `${(2.4 + (i % 6) * 0.55).toFixed(2)}s`,
  chars: Array.from({ length: 22 }, () =>
    "アイウエオカキクケコタチツテト0123456789ABCDEF!@#$%"[Math.floor(Math.random() * 46)]
  ).join("\n"),
}))

// ─── Journal types + persistence ─────────────────────────────────────────────

type Idea = { id: string; title: string; text: string; savedAt: string; updatedAt?: string }

function loadIdeas(): Idea[] {
  try {
    const raw = JSON.parse(localStorage.getItem("ricky_ideas") ?? "[]")
    // backwards-compat: old entries may lack `title`
    return (raw as Idea[]).map(i => ({ title: "", ...i }))
  } catch { return [] }
}

function persistIdeas(ideas: Idea[]) {
  localStorage.setItem("ricky_ideas", JSON.stringify(ideas))
}

// ─── Auto-grow textarea helper ────────────────────────────────────────────────

function autoGrow(el: HTMLTextAreaElement, max = 300) {
  el.style.height = "auto"
  el.style.height = Math.min(el.scrollHeight, max) + "px"
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SafetyHouse() {
  // Animation
  const [idx, setIdx]               = useState(0)
  const [typedLen, setTypedLen]     = useState(0)
  const [glitchText, setGlitchText] = useState(MSG)
  const [gx1, setGx1]               = useState(0)
  const [gx2, setGx2]               = useState(0)

  // Journal — compose
  const [draftTitle, setDraftTitle] = useState("")
  const [draft, setDraft]           = useState("")
  const [draftFocused, setDraftFocused] = useState(false)

  // Journal — saved ideas
  const [ideas, setIdeas]           = useState<Idea[]>(loadIdeas)
  const [panelOpen, setPanelOpen]   = useState(false)

  // Journal — inline editing
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editTitle,    setEditTitle]    = useState("")
  const [editText,     setEditText]     = useState("")

  const panelRef       = useRef<HTMLDivElement>(null)
  const composeRef     = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  const phase: Phase = PHASES[idx % PHASES.length]
  const composing = draftFocused || draft.length > 0 || draftTitle.length > 0

  // ── Animation effects ──────────────────────────────────────────────────────

  useEffect(() => {
    const t = setInterval(() => setIdx(i => i + 1), PHASE_MS)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (phase !== "typewriter") { setTypedLen(MSG.length); return }
    setTypedLen(0); let i = 0
    const t = setInterval(() => { i++; setTypedLen(i); if (i >= MSG.length) clearInterval(t) }, 88)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase !== "glitch") { setGlitchText(MSG); return }
    const t = setInterval(() => {
      setGlitchText(scramble(MSG, Math.random() * 0.42))
      setGx1((Math.random() - 0.5) * 16)
      setGx2((Math.random() - 0.5) * 16)
    }, 105)
    return () => clearInterval(t)
  }, [phase])

  // ── Panel close-on-outside-click ──────────────────────────────────────────

  useEffect(() => {
    if (!panelOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
        setEditingId(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [panelOpen])

  // ── Journal actions ────────────────────────────────────────────────────────

  function commitIdea() {
    const text = draft.trim()
    if (!text) return
    const updated: Idea[] = [{
      id: crypto.randomUUID(),
      title: draftTitle.trim(),
      text,
      savedAt: new Date().toISOString(),
    }, ...ideas]
    setIdeas(updated)
    persistIdeas(updated)
    setDraft("")
    setDraftTitle("")
    if (composeRef.current) {
      composeRef.current.style.height = "auto"
      composeRef.current.focus()
    }
  }

  function startEdit(idea: Idea) {
    setEditingId(idea.id)
    setEditTitle(idea.title)
    setEditText(idea.text)
    // auto-grow the edit textarea after it mounts
    setTimeout(() => {
      if (editTextareaRef.current) autoGrow(editTextareaRef.current, 400)
    }, 30)
  }

  function saveEdit() {
    if (!editingId) return
    const updated = ideas.map(i =>
      i.id === editingId
        ? { ...i, title: editTitle.trim(), text: editText.trim(), updatedAt: new Date().toISOString() }
        : i
    )
    setIdeas(updated)
    persistIdeas(updated)
    setEditingId(null)
  }

  function deleteIdea(id: string) {
    const updated = ideas.filter(i => i.id !== id)
    setIdeas(updated)
    persistIdeas(updated)
    if (editingId === id) setEditingId(null)
  }

  const handleComposeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    autoGrow(e.target, 300)
  }, [])

  const big: React.CSSProperties = {
    fontSize: "clamp(2rem, 5.5vw, 5rem)", fontWeight: 900,
    fontFamily: "var(--font-heading, sans-serif)", letterSpacing: "-0.02em",
    lineHeight: 1.1, textAlign: "center", userSelect: "none", margin: 0,
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "calc(100vh - 56px)", display: "flex", flexDirection: "column", background: "#070707", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes ricky-blink  { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes ricky-neon   { 0%,100%{text-shadow:0 0 12px #10b981,0 0 35px #10b981,0 0 70px #10b981,0 0 130px #059669,0 0 220px #047857} 50%{text-shadow:0 0 4px #10b981,0 0 12px #10b981,0 0 24px #10b981,0 0 50px #059669} }
        @keyframes ricky-shake  { 0%,100%{transform:translate(0,0) rotate(0deg)} 8%{transform:translate(-9px,3px) rotate(-1.2deg)} 16%{transform:translate(9px,-5px) rotate(1.8deg)} 24%{transform:translate(-6px,7px) rotate(-0.6deg)} 32%{transform:translate(12px,-4px) rotate(2.2deg)} 40%{transform:translate(-10px,5px) rotate(-1.8deg)} 48%{transform:translate(7px,-7px) rotate(1.2deg)} 56%{transform:translate(-12px,4px) rotate(-2.4deg)} 64%{transform:translate(6px,6px) rotate(0.8deg)} 72%{transform:translate(-7px,-5px) rotate(-1.4deg)} 80%{transform:translate(10px,3px) rotate(1.6deg)} 90%{transform:translate(-5px,2px) rotate(-0.4deg)} }
        @keyframes ricky-stamp  { 0%{transform:scale(5.5) rotate(-4deg);opacity:0;filter:blur(12px)} 18%{transform:scale(0.90) rotate(1.5deg);opacity:1;filter:blur(0)} 28%{transform:scale(1.07) rotate(-0.8deg)} 36%{transform:scale(0.96) rotate(0.4deg)} 44%,100%{transform:scale(1) rotate(0deg)} }
        @keyframes ricky-hue    { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(360deg)} }
        @keyframes ricky-ghost  { 0%,100%{transform:translateY(0px) scale(1);opacity:0.055} 33%{transform:translateY(-22px) scale(1.01);opacity:0.22} 66%{transform:translateY(12px) scale(0.99);opacity:0.08} }
        @keyframes ricky-ticker { 0%{transform:translateX(115vw)} 100%{transform:translateX(-115%)} }
        @keyframes ricky-letter { 0%,100%{transform:translateY(0px) rotate(0deg) scale(1)} 20%{transform:translateY(-22px) rotate(-6deg) scale(1.1)} 70%{transform:translateY(12px) rotate(4deg) scale(0.95)} }
        @keyframes ricky-fall   { 0%{transform:translateY(-120%);opacity:1} 80%{opacity:0.55} 100%{transform:translateY(115vh);opacity:0} }
        @keyframes ricky-pulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes ricky-stamp-box { 0%{transform:scale(5.5);opacity:0} 18%{transform:scale(0.90);opacity:1} 28%{transform:scale(1.07)} 36%{transform:scale(0.96)} 44%,100%{transform:scale(1)} }
        @keyframes ricky-panel-in { 0%{opacity:0;transform:translateY(-6px) scale(0.98)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        .ricky-idea-row:hover { background: rgba(255,255,255,0.025) !important; }
        .ricky-idea-row:hover .ricky-row-actions { opacity: 1 !important; }
        .ricky-placeholder::placeholder { color: rgba(255,255,255,0.25); }
        .ricky-title-input::placeholder { color: rgba(255,255,255,0.2); }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      {/* ─── Top-left journal ──────────────────────────────────────────── */}
      <div style={{ position: "relative", flexShrink: 0, zIndex: 50, padding: "16px 20px 14px" }}>

        {/* Label + saved count */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
          <Shield style={{ width: 11, height: 11, color: "rgba(16,185,129,0.3)", flexShrink: 0 }} />
          <span style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.2)" }}>
            Ricky's Ideas
          </span>
          {ideas.length > 0 && (
            <button
              type="button"
              onClick={() => setPanelOpen(p => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 4, marginLeft: 4,
                background: panelOpen ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)",
                border: `1px solid ${panelOpen ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 4, padding: "2px 8px",
                color: panelOpen ? "#10b981" : "rgba(255,255,255,0.45)",
                fontSize: 10, cursor: "pointer", transition: "all 0.2s ease",
              }}
            >
              {ideas.length} {ideas.length === 1 ? "idea" : "ideas"}
              <ChevronRight style={{ width: 10, height: 10, transform: panelOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
            </button>
          )}
        </div>

        {/* Compose card */}
        <div style={{
          width: 340,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${composing ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.09)"}`,
          borderRadius: 10,
          overflow: "hidden",
          transition: "border-color 0.25s ease",
        }}>
          {/* Title field */}
          <input
            className="ricky-title-input"
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onFocus={() => setDraftFocused(true)}
            onBlur={() => setDraftFocused(false)}
            onKeyDown={e => { if (e.key === "Enter") composeRef.current?.focus() }}
            placeholder="Give it a title…"
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              background: "transparent", border: "none", outline: "none",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "10px 14px 9px",
              color: "rgba(255,255,255,0.75)",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
              fontFamily: "var(--font-heading, sans-serif)",
            }}
          />

          {/* Body textarea — auto-grows, handles large pastes */}
          <textarea
            ref={composeRef}
            className="ricky-placeholder"
            value={draft}
            rows={2}
            onChange={handleComposeChange}
            onFocus={() => setDraftFocused(true)}
            onBlur={() => setDraftFocused(false)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && draft.trim() && draft.length < 120) { e.preventDefault(); commitIdea() } }}
            placeholder="What do you want, Ricky?"
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              background: "transparent", border: "none", outline: "none",
              resize: "none", overflowY: "auto",
              padding: "10px 14px",
              color: "#fff", fontSize: 13, lineHeight: 1.65,
              fontFamily: "var(--font-body, system-ui, sans-serif)",
              caretColor: "#10b981",
              minHeight: 56, maxHeight: 300,
            }}
          />

          {/* Footer: hint + save button */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 10px 8px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}>
              {draft.length > 120 ? "Ctrl+Enter or ↵ button to save" : draft.trim() ? "Enter to save · Shift+Enter new line" : "Paste or type freely"}
            </span>
            <button
              type="button"
              onClick={commitIdea}
              disabled={!draft.trim()}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 5, border: "none",
                background: draft.trim() ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.04)",
                color: draft.trim() ? "#10b981" : "rgba(255,255,255,0.2)",
                fontSize: 10, fontWeight: 600, cursor: draft.trim() ? "pointer" : "default",
                transition: "all 0.2s ease", letterSpacing: "0.06em",
              }}
              onMouseEnter={e => { if (draft.trim()) e.currentTarget.style.background = "rgba(16,185,129,0.28)" }}
              onMouseLeave={e => { if (draft.trim()) e.currentTarget.style.background = "rgba(16,185,129,0.18)" }}
            >
              Save ↵
            </button>
          </div>
        </div>

        {/* ─── Ideas panel — floats right, never touches animation ─────── */}
        {panelOpen && (
          <div
            ref={panelRef}
            style={{
              position: "absolute",
              top: 0,
              left: 380,
              width: 400,
              maxHeight: "calc(100vh - 80px)",
              background: "#0c0c0c",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              zIndex: 200,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(16,185,129,0.07)",
              animation: "ricky-panel-in 0.18s ease forwards",
              overflow: "hidden",
            }}
          >
            {/* Panel header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "var(--font-heading)", color: "rgba(16,185,129,0.6)" }}>
                {ideas.length} {ideas.length === 1 ? "idea" : "ideas"} saved
              </span>
              <button
                type="button"
                onClick={() => { setPanelOpen(false); setEditingId(null) }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", display: "flex", padding: 2 }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* Scrollable list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
              {ideas.length === 0 ? (
                <p style={{ padding: "24px 18px", color: "rgba(255,255,255,0.18)", fontSize: 13, textAlign: "center" }}>
                  Nothing saved yet.
                </p>
              ) : ideas.map((idea, i) => (
                <div
                  key={idea.id}
                  className="ricky-idea-row"
                  style={{
                    borderBottom: i < ideas.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    transition: "background 0.12s ease",
                  }}
                >
                  {editingId === idea.id ? (
                    /* ── Edit mode ───────────────────────────────── */
                    <div style={{ padding: "14px 16px" }}>
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        placeholder="Title (optional)"
                        style={{
                          display: "block", width: "100%", boxSizing: "border-box",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6, padding: "7px 10px",
                          color: "rgba(255,255,255,0.8)",
                          fontSize: 12, fontWeight: 600,
                          fontFamily: "var(--font-heading, sans-serif)",
                          outline: "none", marginBottom: 8,
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                      />
                      <textarea
                        ref={editTextareaRef}
                        className="ricky-placeholder"
                        value={editText}
                        onChange={e => { setEditText(e.target.value); autoGrow(e.target, 400) }}
                        style={{
                          display: "block", width: "100%", boxSizing: "border-box",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6, padding: "8px 10px",
                          color: "#fff", fontSize: 13, lineHeight: 1.6,
                          fontFamily: "var(--font-body, system-ui, sans-serif)",
                          outline: "none", resize: "none",
                          overflowY: "auto", minHeight: 80, maxHeight: 400,
                          caretColor: "#10b981",
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={!editText.trim()}
                          style={{
                            flex: 1, padding: "6px 0", borderRadius: 6, border: "none",
                            background: editText.trim() ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.05)",
                            color: editText.trim() ? "#10b981" : "rgba(255,255,255,0.2)",
                            fontSize: 11, fontWeight: 600, cursor: editText.trim() ? "pointer" : "default",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          }}
                        >
                          <Check style={{ width: 11, height: 11 }} /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          style={{
                            flex: 1, padding: "6px 0", borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "transparent",
                            color: "rgba(255,255,255,0.35)", fontSize: 11, cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Read mode ───────────────────────────────── */
                    <div style={{ padding: "13px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 2, alignSelf: "stretch", background: "rgba(16,185,129,0.22)", borderRadius: 1, flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {idea.title && (
                          <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-heading, sans-serif)", marginBottom: 4, margin: "0 0 5px" }}>
                            {idea.title}
                          </p>
                        )}
                        <p style={{
                          fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.55,
                          margin: 0, wordBreak: "break-word",
                          display: "-webkit-box", WebkitLineClamp: 6,
                          WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {idea.text}
                        </p>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
                          {idea.updatedAt
                            ? `edited ${formatDistanceToNow(new Date(idea.updatedAt), { addSuffix: true })}`
                            : formatDistanceToNow(new Date(idea.savedAt), { addSuffix: true })}
                        </p>
                      </div>
                      {/* Row actions — fade in on hover */}
                      <div className="ricky-row-actions" style={{ display: "flex", flexDirection: "column", gap: 4, opacity: 0, transition: "opacity 0.15s ease", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => startEdit(idea)}
                          title="Edit"
                          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", padding: 3, display: "flex" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "rgba(16,185,129,0.8)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
                        >
                          <Pencil style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteIdea(idea.id)}
                          title="Delete"
                          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", padding: 3, display: "flex" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "rgba(239,68,68,0.7)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Animation stage — full, never shrinks ─────────────────────── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 40px 32px", position: "relative", overflow: "hidden" }}>

        {phase === "typewriter" && (
          <div style={{ position: "relative" }}>
            <div style={{ position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.012) 2px, rgba(0,255,65,0.012) 4px)", pointerEvents: "none", zIndex: 0 }} />
            <p style={{ ...big, color: "#00ff41", fontFamily: "'Courier New', monospace", letterSpacing: "0.04em", position: "relative", zIndex: 1 }}>
              {MSG.slice(0, typedLen)}<span style={{ borderRight: "4px solid #00ff41", marginLeft: 3, animation: "ricky-blink 0.75s step-end infinite" }} />
            </p>
          </div>
        )}

        {phase === "glitch" && (
          <div style={{ position: "relative", display: "inline-block" }}>
            <p style={{ ...big, color: "cyan", position: "absolute", inset: 0, transform: `translateX(${gx1}px)`, clipPath: "polygon(0 18%,100% 18%,100% 44%,0 44%)", mixBlendMode: "screen", pointerEvents: "none" }}>{glitchText}</p>
            <p style={{ ...big, color: "#ff2244", position: "absolute", inset: 0, transform: `translateX(${gx2}px)`, clipPath: "polygon(0 58%,100% 58%,100% 82%,0 82%)", mixBlendMode: "screen", pointerEvents: "none" }}>{glitchText}</p>
            <p style={{ ...big, color: "#fff" }}>{glitchText}</p>
          </div>
        )}

        {phase === "neon" && <p style={{ ...big, color: "#10b981", animation: "ricky-neon 1.7s ease-in-out infinite" }}>{MSG}</p>}

        {phase === "shake" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ ...big, color: "#ef4444", animation: "ricky-shake 0.38s linear infinite", textShadow: "0 0 24px rgba(239,68,68,0.6)" }}>{MSG}</p>
            <p style={{ color: "rgba(239,68,68,0.45)", fontSize: 10, letterSpacing: "0.32em", textTransform: "uppercase", marginTop: 20, fontFamily: "monospace" }}>DIRECTOR OF SAFETY IS WAITING</p>
          </div>
        )}

        {phase === "stamp" && (
          <div style={{ textAlign: "center", position: "relative", display: "inline-block" }}>
            <p style={{ ...big, fontSize: "clamp(2.5rem,7vw,6.5rem)", color: "#fff", animation: "ricky-stamp 0.65s cubic-bezier(0.36,0.07,0.19,0.97) forwards", textShadow: "0 6px 40px rgba(0,0,0,0.9)" }}>{MSG}</p>
            <div style={{ position: "absolute", inset: "-14px -28px", border: "5px solid rgba(239,68,68,0.65)", borderRadius: 3, animation: "ricky-stamp-box 0.65s cubic-bezier(0.36,0.07,0.19,0.97) forwards", pointerEvents: "none" }} />
          </div>
        )}

        {phase === "rainbow" && <p style={{ ...big, color: "#ff0044", animation: "ricky-hue 2s linear infinite", textShadow: "0 0 40px rgba(255,255,255,0.15)" }}>{MSG}</p>}

        {phase === "ghost" && <p style={{ fontSize: "clamp(3.5rem,12vw,13rem)", fontWeight: 900, fontFamily: "var(--font-heading,sans-serif)", color: "#fff", textAlign: "center", animation: "ricky-ghost 4s ease-in-out infinite", letterSpacing: "-0.03em", lineHeight: 1, userSelect: "none", margin: 0 }}>{MSG}</p>}

        {phase === "marquee" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, overflow: "hidden", pointerEvents: "none" }}>
            {([
              { size: "clamp(1.2rem,3.2vw,2.8rem)", color: "rgba(212,160,23,0.25)", dur: "12s", delay: "-4s" },
              { size: "clamp(2.2rem,6.5vw,6rem)",   color: "#d4a017",               dur: "8s",  delay: "0s"  },
              { size: "clamp(1.2rem,3.2vw,2.8rem)", color: "rgba(212,160,23,0.25)", dur: "15s", delay: "-7s" },
            ] as const).map((row, i) => (
              <div key={i} style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-block", fontSize: row.size, fontWeight: 900, fontFamily: "var(--font-heading,sans-serif)", color: row.color, letterSpacing: "-0.02em", animation: `ricky-ticker ${row.dur} linear infinite`, animationDelay: row.delay, whiteSpace: "nowrap" }}>
                  {Array(8).fill(`${MSG}  ·  `).join("")}
                </span>
              </div>
            ))}
          </div>
        )}

        {phase === "disco" && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end", maxWidth: "90vw" }}>
            {MSG.split("").map((ch, i) => {
              const hue = (i * 31 + 20) % 360
              return <span key={i} style={{ display: "inline-block", fontSize: "clamp(2rem,5.5vw,5rem)", fontWeight: 900, fontFamily: "var(--font-heading,sans-serif)", color: `hsl(${hue},90%,65%)`, textShadow: `0 0 22px hsl(${hue},90%,65%)`, animation: `ricky-letter ${1.1+(i%5)*0.22}s ease-in-out infinite`, animationDelay: `${i*0.065}s`, whiteSpace: "pre", userSelect: "none" }}>{ch}</span>
            })}
          </div>
        )}

        {phase === "matrix" && (
          <div style={{ position: "absolute", inset: 0 }}>
            {MATRIX_COLS.map((col, i) => (
              <div key={i} style={{ position: "absolute", left: col.left, top: 0, fontFamily: "'Courier New',monospace", fontSize: 12, color: "#10b981", opacity: 0.28, whiteSpace: "pre", lineHeight: 1.7, animation: `ricky-fall ${col.duration} linear infinite`, animationDelay: col.delay, pointerEvents: "none" }}>{col.chars}</div>
            ))}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ ...big, color: "#10b981", fontFamily: "'Courier New',monospace", textShadow: "0 0 10px #10b981,0 0 30px #10b981,0 0 70px #059669", animation: "ricky-pulse 2.2s ease-in-out infinite" }}>{MSG}</p>
            </div>
          </div>
        )}
      </div>

      {/* Phase dots */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 5, padding: "0 0 20px", flexShrink: 0 }}>
        {PHASES.map((p, i) => (
          <div key={p} style={{ width: i === idx % PHASES.length ? 16 : 4, height: 4, borderRadius: 2, background: i === idx % PHASES.length ? "rgba(16,185,129,0.65)" : "rgba(255,255,255,0.1)", transition: "width 0.3s ease, background 0.3s ease" }} />
        ))}
      </div>
    </div>
  )
}
