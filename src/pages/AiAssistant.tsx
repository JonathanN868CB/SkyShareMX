import { useState, useRef, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Send, ShieldAlert, Award, Database, Wrench, FileText, BookOpen, GraduationCap } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useAuth } from "@/features/auth"

// ── Keyframe + markdown styles injected once ────────────────
const COST_METER_STYLES = `
.dw1ght-markdown p { margin: 0.4em 0; }
.dw1ght-markdown p:first-child { margin-top: 0; }
.dw1ght-markdown p:last-child { margin-bottom: 0; }
.dw1ght-markdown strong { font-weight: 600; color: var(--skyshare-gold); }
.dw1ght-markdown em { font-style: italic; opacity: 0.85; }
.dw1ght-markdown ul, .dw1ght-markdown ol { margin: 0.4em 0; padding-left: 1.4em; }
.dw1ght-markdown li { margin: 0.2em 0; }
.dw1ght-markdown li::marker { color: var(--skyshare-gold); }
.dw1ght-markdown h1, .dw1ght-markdown h2, .dw1ght-markdown h3 {
  font-family: var(--font-heading);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0.6em 0 0.3em;
  color: var(--skyshare-gold);
}
.dw1ght-markdown h1 { font-size: 1.1em; }
.dw1ght-markdown h2 { font-size: 1em; }
.dw1ght-markdown h3 { font-size: 0.95em; }
.dw1ght-markdown code {
  font-size: 0.88em;
  background: rgba(212,160,23,0.1);
  border: 1px solid rgba(212,160,23,0.2);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}
.dw1ght-markdown pre { margin: 0.5em 0; overflow-x: auto; }
.dw1ght-markdown pre code { display: block; padding: 0.6em 0.8em; border: none; background: rgba(0,0,0,0.2); border-radius: 6px; }
.dw1ght-markdown hr { border: none; border-top: 1px solid rgba(212,160,23,0.3); margin: 0.6em 0; }
.dw1ght-markdown table { border-collapse: collapse; margin: 0.5em 0; font-size: 0.92em; }
.dw1ght-markdown th, .dw1ght-markdown td { border: 1px solid hsl(var(--border)); padding: 0.3em 0.6em; text-align: left; }
.dw1ght-markdown th { background: rgba(212,160,23,0.1); font-weight: 600; }

@keyframes dw1ght-jitter {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  10% { transform: translate(-1px, -1px) rotate(-2deg); }
  30% { transform: translate(1px, 0px) rotate(1deg); }
  50% { transform: translate(-1px, 1px) rotate(-1deg); }
  70% { transform: translate(1px, -1px) rotate(2deg); }
  90% { transform: translate(0px, 1px) rotate(0deg); }
}
@keyframes dw1ght-coin-fall {
  0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
  60% { opacity: 0.8; }
  100% { opacity: 0; transform: translateY(28px) rotate(180deg) scale(0.5); }
}
@keyframes dw1ght-glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(212,160,23,0.3)); }
  50% { filter: drop-shadow(0 0 8px rgba(212,160,23,0.7)); }
}
@keyframes dw1ght-fire-flicker {
  0%, 100% { opacity: 0.7; transform: scaleY(1) translateY(0); }
  25% { opacity: 1; transform: scaleY(1.1) translateY(-1px); }
  50% { opacity: 0.8; transform: scaleY(0.95) translateY(0.5px); }
  75% { opacity: 1; transform: scaleY(1.05) translateY(-0.5px); }
}
`

const LOADING_QUOTES = [
  "Determining if this is worth my time...",
  "Converting your words into something a machine can respect.",
  "Digging through 430 chunks of maintenance history. Manually. With my hands.",
  "Every logbook entry is a witness. I am interrogating them all.",
  "Assembling the facts. Unlike some people, I do not guess.",
  "I have the answer. I am deciding how much of it you deserve.",
  "A good question deserves a precise answer. You asked a good question. Barely.",
  "The database does not lie. Neither do I. We are aligned.",
  "Jonathan trusts me with this data. I will not let him down.",
  "Bears do not ask questions. They act on instinct. I do both.",
  "I have cross-referenced 542 discrepancies. You are welcome.",
  "Searching. Processing. Judging. In that order.",
  "The answer exists. I am simply retrieving it from a better part of my brain.",
  "Jim would not have asked a question this good. That is a compliment.",
  "Fact: DW1GHT has never returned an incorrect answer. Fact.",
]

const OPENING_LINES = [
  { quote: "I am ready. State your question. Make it count.", attr: "DW1GHT, upon activation" },
  { quote: "I have been waiting. Not patiently. But I have been waiting.", attr: "DW1GHT, on standby" },
  { quote: "Bears are the number one predator. I am the number one AI. Coincidence? No.", attr: "DW1GHT, fact" },
  { quote: "You have questions. I have answers. This is an efficient arrangement.", attr: "DW1GHT, opening statement" },
  { quote: "Go ahead. Ask me something. I will know the answer. I always know the answer.", attr: "DW1GHT, confident" },
  { quote: "I once memorized every FAA regulation in a single weekend. Ask me anything.", attr: "DW1GHT, credentials" },
  { quote: "Jonathan trusts me with this portal. That is not a responsibility I take lightly.", attr: "DW1GHT, on duty" },
  { quote: "Identity confirmed. Clearance verified. Jim is not here. We can proceed.", attr: "DW1GHT, security check" },
]

type ContextSource = "discrepancies" | "records" | "manuals"

type Message = {
  role: "user" | "assistant"
  content: string
  fromData?: boolean
  resultCount?: number
  ragChunksUsed?: number
}

export default function AiAssistant() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isSuperAdmin = profile?.role === "Super Admin"
  const isAdmin = isSuperAdmin || profile?.role === "Admin"
  const [showWorkbenchGate, setShowWorkbenchGate] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [sessionTokens, setSessionTokens] = useState({ input: 0, output: 0 })
  const [mode, setMode] = useState<"schrute" | "corporate" | "troubleshooting">("schrute")
  const [contextSources, setContextSources] = useState<Set<ContextSource>>(new Set(["discrepancies"]))
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const opening = useMemo(() => OPENING_LINES[Math.floor(Math.random() * OPENING_LINES.length)], [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, loadingStage])

  const LOADING_STAGES = [
    { label: "Classifying intent" },
    { label: "Embedding query" },
    { label: "Searching the beet field" },
    { label: "Cross-referencing records" },
    { label: "Reasoning" },
    { label: "Formulating response" },
  ]

  const [loadingQuote, setLoadingQuote] = useState("")

  useEffect(() => {
    if (!loading) { setLoadingStage(0); return }
    setLoadingStage(0)
    setLoadingQuote(LOADING_QUOTES[Math.floor(Math.random() * LOADING_QUOTES.length)])
    const timers = [
      setTimeout(() => setLoadingStage(1), 1200),
      setTimeout(() => setLoadingStage(2), 3000),
      setTimeout(() => setLoadingStage(3), 6000),
      setTimeout(() => setLoadingStage(4), 10000),
      setTimeout(() => setLoadingStage(5), 15000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [loading])

  function toggleSource(source: ContextSource) {
    setContextSources(prev => {
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      return next
    })
  }

  const activeSources = contextSources.size
  const dollarSigns = Math.max(1, activeSources) // at least 1 dollar sign

  // Haiku pricing: $0.80/M input, $4.00/M output
  const sessionCost = (sessionTokens.input * 0.0000008) + (sessionTokens.output * 0.000004)
  const totalTokens = sessionTokens.input + sessionTokens.output
  const costDisplay = sessionCost < 0.0001 ? "<$0.0001" : `$${sessionCost.toFixed(4)}`

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages: Message[] = [...messages, { role: "user", content: text }]
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
          contextSources: [...contextSources],
          history: newMessages.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })
      const data = await res.json()
      setMessages([...newMessages, {
        role: "assistant",
        content: data.reply ?? "...",
        fromData: data.sqlGenerated === true,
        resultCount: data.resultCount,
        ragChunksUsed: data.ragChunksUsed,
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
        { role: "assistant", content: "Signal lost. I am notifying Jonathan about this technical failure. It is unacceptable." },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col gap-6 h-full max-w-5xl mx-auto">

      {/* ── ID Badge Header ─────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border border-border bg-card">
        {/* Top stripe — crimson to navy */}
        <div style={{ height: "3px", background: "linear-gradient(90deg, #c10230 0%, #012e45 100%)" }} />

        <div className="flex items-stretch">

          {/* Left — badge photo panel */}
          <div className="flex flex-col items-center justify-center px-6 py-5 gap-3 flex-shrink-0 bg-background border-r border-border" style={{ minWidth: "120px" }}>
            {/* Award badge avatar */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(212,160,23,0.1)", border: "2px solid var(--skyshare-gold)" }}
            >
              <Award className="w-7 h-7" style={{ color: "var(--skyshare-gold)" }} />
            </div>
            {/* Status pill */}
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "var(--skyshare-success)", fontFamily: "var(--font-heading)" }}>
                Active
              </span>
            </div>
          </div>

          {/* Center — identity details */}
          <div className="flex flex-col justify-center px-6 py-5 gap-1 flex-1">
            <span
              className="text-[9px] font-bold tracking-[0.3em] uppercase mb-1"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", opacity: 0.7 }}
            >
              SkyShare MX · Employee ID
            </span>

            <h1
              className="text-4xl leading-none text-foreground"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}
            >
              DW1GHT
            </h1>

            <div style={{ height: "1px", background: "var(--skyshare-gold)", width: "2.5rem", margin: "6px 0" }} />

            <p
              className="text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "11px" }}
            >
              AI Assistant to the DOM
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {["Dashboard", "Aircraft Info", "Discrepancy Intelligence", "Training Knowledge"].map((scope) => (
                <span
                  key={scope}
                  className="text-[9px] px-2 py-0.5 rounded badge-warning"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em", textTransform: "uppercase" }}
                >
                  {scope}
                </span>
              ))}
            </div>
          </div>

          {/* Far right — Schrute Farms nod */}
          <div className="flex flex-col items-center justify-center px-5 py-5 gap-2 flex-shrink-0 text-center border-l border-border">
            <span className="text-[2.6rem] select-none leading-none" title="Schrute Farms Quality">🌱</span>
            <span
              className="text-[10.5px] leading-tight text-center text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.12em", textTransform: "uppercase", maxWidth: "70px" }}
            >
              Schrute Farms Quality
            </span>
          </div>

          {/* Playbook Workbench — visible to all, gated on click */}
          <button
            onClick={() => isAdmin ? navigate("/app/ai-assistant/playbook") : setShowWorkbenchGate(true)}
            className="flex flex-col items-center justify-center px-5 py-5 gap-2 flex-shrink-0 text-center border-l border-border hover:bg-white/[0.02] transition-colors"
            title={isAdmin ? "DW1GHT Playbook Workbench" : "Admin access required"}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.25)" }}
            >
              <GraduationCap className="w-5 h-5" style={{ color: "var(--skyshare-gold)", opacity: isAdmin ? 0.7 : 0.35 }} />
            </div>
            <span
              className="text-[10.5px] leading-tight text-center text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.12em", textTransform: "uppercase", maxWidth: "70px" }}
            >
              Playbook Workbench
            </span>
          </button>

          {/* Access gate modal */}
          {showWorkbenchGate && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)" }}
              onClick={() => setShowWorkbenchGate(false)}
            >
              <div
                className="card-elevated rounded-xl p-6 max-w-sm w-full mx-4 border border-white/[0.08]"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(193,2,48,0.12)", border: "1px solid rgba(193,2,48,0.25)" }}>
                    <ShieldAlert className="w-4 h-4" style={{ color: "var(--skyshare-red)" }} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Admin Access Required</h3>
                </div>
                <p className="text-sm text-foreground/60 mb-4 leading-relaxed">
                  The Playbook Workbench is restricted to Admin and Super Admin accounts. Contact your administrator to request access.
                </p>
                <button
                  onClick={() => setShowWorkbenchGate(false)}
                  className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors"
                  style={{ fontFamily: "var(--font-heading)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                >
                  Got it
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Bottom strip — authorization notice */}
        <div className="flex items-center gap-2 px-4 py-2 bg-background border-t border-border">
          <ShieldAlert className="w-3 h-3 flex-shrink-0 text-muted-foreground opacity-50" />
          <p
            className="text-[9px] text-muted-foreground opacity-60"
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Intelligence clearance granted · Fleet data access active · Unauthorized queries will be reported to Jonathan · Bears. Beets. Battlestar Galactica.
          </p>
        </div>
      </div>

      {/* ── Mode Selector ─────────────────────────────────── */}
      <div
        className="flex items-center gap-4 rounded-xl px-4 py-2.5"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span
          className="text-[9px] font-bold tracking-widest uppercase flex-shrink-0"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.5, minWidth: "90px" }}
        >
          Operating Mode
        </span>
        <div
          className="flex items-center rounded-lg overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => setMode("schrute")}
            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "var(--font-heading)",
              background: mode === "schrute" ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.02)",
              color: mode === "schrute" ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
            }}
          >
            <span className="text-sm leading-none">🌱</span>
            Full Schrute
          </button>
          <button
            onClick={() => setMode("corporate")}
            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "var(--font-heading)",
              background: mode === "corporate" ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.02)",
              color: mode === "corporate" ? "rgba(100,170,255,0.9)" : "hsl(var(--muted-foreground))",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="text-sm leading-none">👔</span>
            Corporate
          </button>
          <button
            onClick={() => setMode("troubleshooting")}
            className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-colors"
            style={{
              fontFamily: "var(--font-heading)",
              background: mode === "troubleshooting" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.02)",
              color: mode === "troubleshooting" ? "rgba(100,220,100,0.9)" : "hsl(var(--muted-foreground))",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="text-sm leading-none">🧠</span>
            Troubleshooting
            <Wrench className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Context Source Selector ─────────────────────────── */}
      <style>{COST_METER_STYLES}</style>
      <div
        className="flex items-center gap-4 rounded-xl px-4 py-2.5"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Cost meter — left side */}
        <div className="flex items-center gap-2 flex-shrink-0" style={{ minWidth: "90px" }}>
          <div
            className="relative flex items-center justify-center transition-all duration-500"
            style={{
              fontSize: activeSources <= 1 ? "18px" : activeSources === 2 ? "26px" : "34px",
              lineHeight: 1,
              minWidth: activeSources <= 1 ? "32px" : activeSources === 2 ? "40px" : "48px",
              minHeight: "36px",
              animation: activeSources >= 3
                ? "dw1ght-jitter 0.15s infinite, dw1ght-glow-pulse 1s ease-in-out infinite"
                : activeSources === 2
                  ? "dw1ght-jitter 0.4s infinite"
                  : "none",
            }}
          >
            {/* Fire effect at level 3 */}
            {activeSources >= 3 && (
              <>
                <span
                  className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] select-none pointer-events-none"
                  style={{ animation: "dw1ght-fire-flicker 0.3s infinite" }}
                >
                  🔥
                </span>
                <span
                  className="absolute -top-1 left-0 text-[8px] select-none pointer-events-none"
                  style={{ animation: "dw1ght-fire-flicker 0.25s infinite 0.1s" }}
                >
                  🔥
                </span>
                <span
                  className="absolute -top-1 right-0 text-[8px] select-none pointer-events-none"
                  style={{ animation: "dw1ght-fire-flicker 0.35s infinite 0.15s" }}
                >
                  🔥
                </span>
              </>
            )}

            {/* The dollar signs */}
            <span
              className="select-none font-black transition-all duration-300"
              style={{
                color: activeSources <= 1
                  ? "var(--skyshare-success)"
                  : activeSources === 2
                    ? "var(--skyshare-gold)"
                    : "#ff8c00",
                textShadow: activeSources >= 3
                  ? "0 0 12px rgba(212,160,23,0.8), 0 0 24px rgba(255,140,0,0.4)"
                  : activeSources === 2
                    ? "0 0 6px rgba(212,160,23,0.4)"
                    : "0 0 4px rgba(16,185,129,0.3)",
                fontFamily: "var(--font-display)",
                letterSpacing: activeSources >= 3 ? "-0.02em" : "0.02em",
              }}
            >
              {"$".repeat(Math.max(1, activeSources))}
            </span>

            {/* Falling coins at level 3 */}
            {activeSources >= 3 && (
              <div className="absolute inset-0 overflow-visible pointer-events-none">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="absolute text-[8px] select-none"
                    style={{
                      left: `${10 + i * 18}%`,
                      top: "80%",
                      animation: `dw1ght-coin-fall ${0.8 + i * 0.15}s ease-in infinite ${i * 0.25}s`,
                    }}
                  >
                    🪙
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Label under cost meter */}
          <span
            className="text-[8px] font-bold tracking-widest uppercase"
            style={{
              color: activeSources >= 3 ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
              fontFamily: "var(--font-heading)",
              opacity: activeSources >= 3 ? 0.9 : 0.5,
              transition: "all 0.3s",
            }}
          >
            {activeSources <= 1 ? "Context" : activeSources === 2 ? "Context" : "oh no"}
          </span>
        </div>

        {/* Source buttons */}
        <div className="flex items-center gap-2">
          {/* Discrepancy History */}
          <button
            onClick={() => toggleSource("discrepancies")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
            style={{
              fontFamily: "var(--font-heading)",
              background: contextSources.has("discrepancies") ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.02)",
              color: contextSources.has("discrepancies") ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
              border: contextSources.has("discrepancies") ? "1px solid rgba(212,160,23,0.3)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <Database className="w-3 h-3" />
            Discrepancy History
          </button>

          {/* Aircraft Records */}
          <button
            onClick={() => toggleSource("records")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
            style={{
              fontFamily: "var(--font-heading)",
              background: contextSources.has("records") ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.02)",
              color: contextSources.has("records") ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
              border: contextSources.has("records") ? "1px solid rgba(212,160,23,0.3)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <FileText className="w-3 h-3" />
            Aircraft Records
          </button>

          {/* Maintenance Manuals — toggleable, TBD */}
          <button
            onClick={() => toggleSource("manuals")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all"
            style={{
              fontFamily: "var(--font-heading)",
              background: contextSources.has("manuals") ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.02)",
              color: contextSources.has("manuals") ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
              border: contextSources.has("manuals") ? "1px solid rgba(212,160,23,0.3)" : "1px solid rgba(255,255,255,0.08)",
              opacity: contextSources.has("manuals") ? 1 : 0.55,
            }}
          >
            <BookOpen className="w-3 h-3" />
            Maint. Manuals
            <span
              className="text-[7px] px-1 py-0 rounded ml-0.5"
              style={{
                background: contextSources.has("manuals") ? "rgba(212,160,23,0.25)" : "rgba(255,255,255,0.08)",
                color: contextSources.has("manuals") ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
              }}
            >
              TBD
            </span>
          </button>
        </div>
      </div>

      {/* ── Chat Panel ──────────────────────────────────────── */}
      <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden flex-1 min-h-0">

        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3 bg-background border-b border-border">
          {/* Left — status */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span
              className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {mode === "schrute" ? "Confessional Cam" : mode === "corporate" ? "Briefing Room" : "Diagnostic Bay"}
            </span>
          </div>

          {/* Token tally */}
          <div className="flex items-center gap-2">
            {totalTokens > 0 ? (
              <>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)" }}
                >
                  {totalTokens.toLocaleString()} tokens
                </span>
                <span className="text-muted-foreground opacity-40 text-[10px]">/</span>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-success)" }}
                >
                  {costDisplay}
                </span>
              </>
            ) : (
              <span
                className="text-[10px] text-muted-foreground opacity-40 tracking-widest uppercase"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                0 tokens
              </span>
            )}
          </div>

          {/* Clear */}
          <div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setSessionTokens({ input: 0, output: 0 }) }}
                className="text-[9px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-[420px] max-h-[680px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-center">
              <span className="text-3xl select-none">🌱</span>
              <p
                className="text-[1.15rem] leading-relaxed text-muted-foreground"
                style={{ fontFamily: "var(--font-display)", fontStyle: "italic", maxWidth: "340px" }}
              >
                "{opening.quote}"
              </p>
              <p
                className="text-[9px] tracking-widest uppercase text-muted-foreground opacity-50"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                — {opening.attr}
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className="flex-shrink-0 mt-1">
                {m.role === "assistant" ? (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(212,160,23,0.15)", border: "1px solid rgba(212,160,23,0.3)" }}
                  >
                    <Award className="w-3 h-3" style={{ color: "var(--skyshare-gold)" }} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-muted border border-border">
                    <span className="text-[8px] text-muted-foreground font-medium">you</span>
                  </div>
                )}
              </div>

              {/* Bubble */}
              <div className={`max-w-[78%] flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.role === "assistant" && (
                  <div className="flex items-center gap-2 px-1">
                    <span
                      className="text-[9px] font-bold tracking-widest uppercase"
                      style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", opacity: 0.8 }}
                    >
                      DW1GHT
                    </span>
                    {m.fromData && (
                      <span
                        className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: "rgba(59,130,246,0.12)",
                          color: "rgba(100,170,255,0.9)",
                          fontFamily: "var(--font-heading)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        <Database className="w-2.5 h-2.5" />
                        {m.resultCount != null ? `${m.resultCount} records` : "queried"}
                      </span>
                    )}
                    {(m.ragChunksUsed ?? 0) > 0 && (
                      <span
                        className="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: "rgba(212,160,23,0.12)",
                          color: "var(--skyshare-gold)",
                          fontFamily: "var(--font-heading)",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        <FileText className="w-2.5 h-2.5" />
                        {m.ragChunksUsed} chunks
                      </span>
                    )}
                  </div>
                )}
                <div
                  className="rounded-xl px-4 py-2.5 text-foreground"
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontSize: "15px",
                    lineHeight: "1.65",
                    fontWeight: 400,
                    letterSpacing: "0",
                    ...(m.role === "user"
                      ? {
                          background: "rgba(212,160,23,0.12)",
                          border: "1px solid rgba(212,160,23,0.25)",
                          borderBottomRightRadius: "4px",
                        }
                      : {
                          background: "hsl(var(--muted))",
                          border: "1px solid hsl(var(--border))",
                          borderBottomLeftRadius: "4px",
                        }),
                  }}
                >
                  {m.role === "assistant" ? (
                    <div className="dw1ght-markdown">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1"
                style={{ background: "rgba(212,160,23,0.15)", border: "1px solid rgba(212,160,23,0.3)" }}
              >
                <Award className="w-3 h-3" style={{ color: "var(--skyshare-gold)" }} />
              </div>
              <div className="flex flex-col gap-1">
                <span
                  className="text-[9px] font-bold tracking-widest uppercase px-1"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)", opacity: 0.8 }}
                >
                  DW1GHT
                </span>
                <div
                  className="rounded-xl px-4 py-3 bg-muted border border-border"
                  style={{ borderBottomLeftRadius: "4px", minWidth: "280px" }}
                >
                  <div className="flex flex-col gap-2">
                    {/* Stage indicators */}
                    <div className="flex gap-1 items-center">
                      {LOADING_STAGES.map((_, i) => (
                        <div
                          key={i}
                          className="h-1 rounded-full transition-all duration-500"
                          style={{
                            width: i <= loadingStage ? "20px" : "8px",
                            background: i <= loadingStage
                              ? "var(--skyshare-gold)"
                              : "rgba(255,255,255,0.1)",
                            opacity: i === loadingStage ? 1 : i < loadingStage ? 0.5 : 0.2,
                          }}
                        />
                      ))}
                    </div>
                    {/* Current stage label */}
                    <span
                      className="text-[10px] font-bold tracking-widest uppercase"
                      style={{ fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)" }}
                    >
                      {LOADING_STAGES[loadingStage]?.label}
                    </span>
                    {/* Dwight quote */}
                    <span
                      className="text-muted-foreground italic"
                      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: "1.4", fontSize: "14.4px" }}
                    >
                      "{loadingQuote}"
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 flex gap-3 items-end bg-background border-t border-border">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            placeholder="Ask DW1GHT. Make it a good question."
            className="flex-1 bg-card border border-border rounded-lg px-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[rgba(212,160,23,0.5)] transition-colors resize-none"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: "15px" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex items-center justify-center w-9 h-9 rounded-lg transition-all disabled:opacity-25 border border-border hover:border-[rgba(212,160,23,0.4)]"
            style={{
              background: input.trim() && !loading ? "rgba(212,160,23,0.12)" : "transparent",
              color: "var(--skyshare-gold)",
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>

    </div>
  )
}
