import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  MessageSquarePlus, ExternalLink, Archive, Trash2,
  Send, X, ImageIcon, Clock, ChevronDown, ChevronUp,
  Inbox, HelpCircle, CheckCircle2, BarChart2, Users,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback } from "@/shared/ui/avatar"
import { Button } from "@/shared/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { Textarea } from "@/shared/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"

// ─── Types ────────────────────────────────────────────────────────────────────

type SubmissionType   = "suggestion" | "ticket" | "compliment"
type SubmissionStatus = "open" | "needs_info" | "completed" | "archived" | "deleted"
type ReplyType        = "reply" | "needs_info" | "completed"

interface SuggestionProfile {
  full_name:       string | null
  display_name:    string | null
  avatar_initials: string | null
  avatar_color:    string | null
  avatar_url:      string | null
}

interface SuggestionReply {
  id:          string
  admin_reply: string
  reply_type:  ReplyType
  sender:      "admin" | "user"
  sent_at:     string
  read_at:     string | null
}

interface Suggestion {
  id:               string
  user_id:          string
  page_url:         string
  title:            string
  body:             string | null
  image_url:        string | null
  type:             SubmissionType
  status:           SubmissionStatus
  created_at:       string
  profiles:         SuggestionProfile | null
  suggestion_replies: SuggestionReply[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<SubmissionType, { label: string; color: string; bg: string; border: string }> = {
  suggestion: { label: "Suggestion", color: "#818cf8", bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.3)" },
  ticket:     { label: "Ticket",     color: "#fbbf24", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)" },
  compliment: { label: "Compliment", color: "#34d399", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)" },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:       { label: "Open",       color: "#818cf8", bg: "rgba(99,102,241,0.15)"  },
  needs_info: { label: "Needs Info", color: "#fbbf24", bg: "rgba(245,158,11,0.15)"  },
  completed:  { label: "Completed",  color: "#34d399", bg: "rgba(16,185,129,0.15)"  },
  archived:   { label: "Archived",   color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" },
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchSuggestions(): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from("site_suggestions")
    .select(`
      *,
      profiles:user_id (full_name, display_name, avatar_initials, avatar_color, avatar_url),
      suggestion_replies (id, admin_reply, reply_type, sender, sent_at, read_at)
    `)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Suggestion[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(p: SuggestionProfile | null) {
  if (p?.avatar_initials) return p.avatar_initials
  const name = p?.display_name ?? p?.full_name ?? ""
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return "??"
}

function displayName(p: SuggestionProfile | null) {
  return p?.display_name ?? p?.full_name ?? "Unknown User"
}

function formatUrl(url: string) {
  try { const u = new URL(url); return u.pathname + (u.search || "") } catch { return url }
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel({ suggestions }: { suggestions: Suggestion[] }) {
  const total = suggestions.length

  const bySuggestionType = {
    suggestion: suggestions.filter(s => s.type === "suggestion").length,
    ticket:     suggestions.filter(s => s.type === "ticket").length,
    compliment: suggestions.filter(s => s.type === "compliment").length,
  }

  const byStatus = {
    open:       suggestions.filter(s => s.status === "open").length,
    needs_info: suggestions.filter(s => s.status === "needs_info").length,
    completed:  suggestions.filter(s => s.status === "completed").length,
    archived:   suggestions.filter(s => s.status === "archived").length,
  }

  // Top submitters
  const submitterMap = new Map<string, { name: string; count: number; color: string }>()
  for (const s of suggestions) {
    const id = s.user_id
    if (!submitterMap.has(id)) {
      submitterMap.set(id, {
        name: displayName(s.profiles),
        count: 0,
        color: s.profiles?.avatar_color ?? "#d4a017",
      })
    }
    submitterMap.get(id)!.count++
  }
  const topSubmitters = Array.from(submitterMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  if (total === 0) return null

  return (
    <div
      className="rounded-lg p-4 mb-6 space-y-4"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 size={13} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }} />
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.7 }}
        >
          Statistics
        </span>
        <span
          className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: "rgba(255,255,255,0.06)", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
        >
          {total} total
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* By type */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)" }}>By Type</p>
          <div className="space-y-1.5">
            {(["suggestion", "ticket", "compliment"] as SubmissionType[]).map(t => {
              const cfg = TYPE_CONFIG[t]
              const count = bySuggestionType[t]
              const pct = total ? Math.round((count / total) * 100) : 0
              return (
                <div key={t} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider w-16 flex-shrink-0"
                    style={{ color: cfg.color, fontFamily: "var(--font-heading)" }}>
                    {cfg.label}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color, opacity: 0.7 }} />
                  </div>
                  <span className="text-[10px] w-6 text-right flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* By status */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)" }}>By Status</p>
          <div className="space-y-1.5">
            {(["open", "needs_info", "completed", "archived"] as const).map(st => {
              const cfg = STATUS_CONFIG[st]
              const count = byStatus[st]
              const pct = total ? Math.round((count / total) * 100) : 0
              return (
                <div key={st} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider w-16 flex-shrink-0"
                    style={{ color: cfg.color, fontFamily: "var(--font-heading)" }}>
                    {cfg.label}
                  </span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color, opacity: 0.7 }} />
                  </div>
                  <span className="text-[10px] w-6 text-right flex-shrink-0" style={{ color: "hsl(var(--muted-foreground))" }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top submitters */}
      {topSubmitters.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Users size={11} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }} />
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)" }}>Top Submitters</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {topSubmitters.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded px-2 py-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                  style={{ background: s.color, color: "#111", fontFamily: "var(--font-heading)" }}
                >
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.7)" }}>{s.name}</span>
                <span
                  className="text-[9px] font-bold px-1 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.08)", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                >
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

type AdminAction = "reply" | "needs_info" | "complete" | null

function SuggestionRow({
  suggestion,
  onStatusChange,
  onReplySent,
}: {
  suggestion: Suggestion
  onStatusChange: (id: string, status: SubmissionStatus) => void
  onReplySent: () => void
}) {
  const [expanded, setExpanded]       = useState(false)
  const [action, setAction]           = useState<AdminAction>(null)
  const [actionText, setActionText]   = useState("")
  const [submitting, setSubmitting]   = useState(false)
  const [imageOpen, setImageOpen]     = useState(false)

  const tcfg = TYPE_CONFIG[suggestion.type]
  const scfg = STATUS_CONFIG[suggestion.status]
  const hasReplied = suggestion.suggestion_replies.some(r => r.sender === "admin")
  const unreadUser = suggestion.suggestion_replies.filter(r => r.sender === "user" && !r.read_at).length

  async function submitAction() {
    if (!actionText.trim() && action !== "complete") return
    if (submitting) return
    setSubmitting(true)

    const replyType: ReplyType = action === "needs_info" ? "needs_info" : action === "complete" ? "completed" : "reply"
    const newStatus: SubmissionStatus = action === "needs_info" ? "needs_info" : action === "complete" ? "completed" : suggestion.status

    const { error: replyError } = await supabase
      .from("suggestion_replies")
      .insert({
        suggestion_id: suggestion.id,
        admin_reply: actionText.trim() || (action === "complete" ? "Marked as complete." : ""),
        reply_type: replyType,
        sender: "admin",
      })

    if (replyError) { toast.error("Failed to send"); setSubmitting(false); return }

    if (newStatus !== suggestion.status) {
      await supabase.from("site_suggestions").update({ status: newStatus }).eq("id", suggestion.id)
    }

    // Notify the submitter
    const notifTitle =
      action === "complete"   ? "Your submission has been resolved" :
      action === "needs_info" ? "More info needed on your submission" :
                                "New reply on your submission"
    const preview = actionText.trim()
    await supabase.from("notifications").insert({
      recipient_profile_id: suggestion.user_id,
      type: "suggestion_replied",
      title: notifTitle,
      message: `Re: "${suggestion.title}"${preview ? ` — ${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}` : ""}`,
      metadata: {
        suggestion_id: suggestion.id,
        suggestion_type: suggestion.type,
        link: `/app/dashboard?widget=suggestion&id=${suggestion.id}`,
      },
    })

    toast.success(
      action === "needs_info" ? "Pushed back — user notified" :
      action === "complete"   ? "Marked complete" : "Reply sent"
    )
    setActionText("")
    setAction(null)
    setSubmitting(false)
    onReplySent()
  }

  // Mark user replies as read when expanded
  async function handleExpand() {
    const next = !expanded
    setExpanded(next)
    if (next && unreadUser > 0) {
      const ids = suggestion.suggestion_replies
        .filter(r => r.sender === "user" && !r.read_at)
        .map(r => r.id)
      if (ids.length) {
        await supabase.from("suggestion_replies").update({ read_at: new Date().toISOString() }).in("id", ids)
      }
    }
  }

  return (
    <>
      <div
        className="rounded-md transition-colors"
        style={{
          background: expanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderLeft: `3px solid ${tcfg.color}`,
          marginBottom: 6,
        }}
      >
        {/* ── Summary ── */}
        <button onClick={handleExpand} className="w-full flex items-center gap-3 px-4 py-3 text-left">

          {/* Avatar */}
          <Avatar className="h-[30px] w-[30px] flex-shrink-0">
            {suggestion.profiles?.avatar_url ? (
              <img src={suggestion.profiles.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
            ) : (
              <AvatarFallback
                className="text-[10px] font-bold"
                style={{ background: suggestion.profiles?.avatar_color ?? "#d4a017", color: "#111", fontFamily: "var(--font-heading)" }}
              >
                {getInitials(suggestion.profiles)}
              </AvatarFallback>
            )}
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type badge */}
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                style={{ background: tcfg.bg, color: tcfg.color, border: `1px solid ${tcfg.border}`, fontFamily: "var(--font-heading)" }}
              >
                {tcfg.label}
              </span>
              <span className="text-xs font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                {suggestion.title}
              </span>
              {hasReplied && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                  style={{ background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
                  Replied
                </span>
              )}
              {unreadUser > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                  style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", fontFamily: "var(--font-heading)" }}>
                  User replied
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                {displayName(suggestion.profiles)}
              </span>
              <span className="text-[10px] truncate max-w-[240px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                {formatUrl(suggestion.page_url)}
              </span>
            </div>
          </div>

          {/* Thumbnail */}
          {suggestion.image_url && (
            <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "hsl(0 0% 7%)" }}>
              <img src={suggestion.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Status */}
          <span
            className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: scfg.bg, color: scfg.color, fontFamily: "var(--font-heading)" }}
          >
            {scfg.label}
          </span>

          {/* Timestamp */}
          <span className="flex-shrink-0 text-[10px] flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}>
            <Clock size={10} />
            {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
          </span>

          <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {/* ── Expanded ── */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>

            {/* Body */}
            {suggestion.body && (
              <div className="pt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>Details</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.75)" }}>{suggestion.body}</p>
              </div>
            )}

            {/* Screenshot */}
            {suggestion.image_url && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>Screenshot</p>
                <button onClick={() => setImageOpen(true)} className="block rounded-md overflow-hidden hover:opacity-80 transition-opacity" style={{ border: "1px solid rgba(255,255,255,0.1)", maxWidth: 320 }}>
                  <img src={suggestion.image_url} alt="Screenshot" className="w-full object-cover" style={{ maxHeight: 200 }} />
                </button>
              </div>
            )}

            {/* Page URL */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>Page</p>
              <a href={suggestion.page_url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1.5 hover:underline break-all" style={{ color: "rgba(212,160,23,0.8)" }}>
                {suggestion.page_url}<ExternalLink size={11} className="flex-shrink-0" />
              </a>
            </div>

            {/* Thread */}
            {suggestion.suggestion_replies.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>Thread</p>
                <div className="space-y-2">
                  {suggestion.suggestion_replies.map(r => {
                    const isUser = r.sender === "user"
                    const isNeedsInfo = r.reply_type === "needs_info"
                    const isCompleted = r.reply_type === "completed"
                    const borderColor = isUser
                      ? "rgba(255,255,255,0.1)"
                      : isNeedsInfo ? "rgba(251,191,36,0.3)"
                      : isCompleted ? "rgba(52,211,153,0.3)"
                      : "rgba(212,160,23,0.2)"
                    const bgColor = isUser
                      ? "rgba(255,255,255,0.04)"
                      : isNeedsInfo ? "rgba(245,158,11,0.08)"
                      : isCompleted ? "rgba(16,185,129,0.08)"
                      : "rgba(212,160,23,0.06)"
                    const labelColor = isUser
                      ? "rgba(255,255,255,0.5)"
                      : isNeedsInfo ? "#fbbf24"
                      : isCompleted ? "#34d399"
                      : "var(--skyshare-gold)"
                    const label = isUser
                      ? displayName(suggestion.profiles)
                      : isNeedsInfo ? "Jonathan — Needs More Info"
                      : isCompleted ? "Jonathan — Completed"
                      : "Jonathan"
                    return (
                      <div key={r.id} className="rounded-md px-3 py-2.5" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: labelColor, fontFamily: "var(--font-heading)" }}>{label}</span>
                          <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
                            {formatDistanceToNow(new Date(r.sent_at), { addSuffix: true })}
                            {!isUser && r.read_at ? " · seen" : ""}
                            {isUser && !r.read_at ? " · unread" : ""}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>{r.admin_reply}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Action bar ── */}
            {suggestion.status !== "archived" && (
              <div className="space-y-3">
                {/* Action selector */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6, fontFamily: "var(--font-heading)" }}>Action:</span>
                  {[
                    { key: "reply" as AdminAction,      icon: <Send size={11} />,         label: "Reply",          color: "var(--skyshare-gold)" },
                    { key: "needs_info" as AdminAction, icon: <HelpCircle size={11} />,   label: "Ask for Info",   color: "#fbbf24" },
                    { key: "complete" as AdminAction,   icon: <CheckCircle2 size={11} />, label: "Mark Complete",  color: "#34d399" },
                  ].map(btn => (
                    <button
                      key={btn.key}
                      onClick={() => setAction(action === btn.key ? null : btn.key)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all"
                      style={{
                        fontFamily: "var(--font-heading)",
                        background: action === btn.key ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${action === btn.key ? btn.color : "rgba(255,255,255,0.1)"}`,
                        color: action === btn.key ? btn.color : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {btn.icon}{btn.label}
                    </button>
                  ))}
                </div>

                {/* Action composer */}
                {action && (
                  <div
                    className="rounded-md p-3 space-y-2.5"
                    style={{
                      background: action === "needs_info" ? "rgba(245,158,11,0.06)" : action === "complete" ? "rgba(16,185,129,0.06)" : "rgba(212,160,23,0.06)",
                      border: `1px solid ${action === "needs_info" ? "rgba(245,158,11,0.2)" : action === "complete" ? "rgba(16,185,129,0.2)" : "rgba(212,160,23,0.2)"}`,
                    }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{
                      color: action === "needs_info" ? "#fbbf24" : action === "complete" ? "#34d399" : "var(--skyshare-gold)",
                      fontFamily: "var(--font-heading)",
                    }}>
                      {action === "needs_info" ? "What do you need from them?" :
                       action === "complete"   ? "Completion notes (optional)" :
                       "Reply to submitter"}
                    </p>
                    <Textarea
                      value={actionText}
                      onChange={e => setActionText(e.target.value)}
                      placeholder={
                        action === "needs_info" ? "Ask a specific question or describe what information you need…" :
                        action === "complete"   ? "Optional notes about how this was resolved or implemented…" :
                        "Type your reply…"
                      }
                      className="text-sm bg-white/5 border-white/10 resize-none"
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <button onClick={() => { setAction(null); setActionText("") }} className="text-xs flex items-center gap-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                        <X size={11} /> Cancel
                      </button>
                      <Button
                        size="sm"
                        disabled={(!actionText.trim() && action !== "complete") || submitting}
                        onClick={submitAction}
                        className="h-7 px-4 text-xs gap-1.5"
                        style={{
                          background: action === "needs_info" ? "#fbbf24" : action === "complete" ? "#34d399" : "var(--skyshare-gold)",
                          color: "#111",
                          fontFamily: "var(--font-heading)",
                          opacity: (!actionText.trim() && action !== "complete") ? 0.4 : 1,
                        }}
                      >
                        {action === "needs_info" ? <HelpCircle size={11} /> : action === "complete" ? <CheckCircle2 size={11} /> : <Send size={11} />}
                        {submitting ? "Sending…" :
                         action === "needs_info" ? "Send & Ask" :
                         action === "complete"   ? "Mark Complete" : "Send Reply"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Archive / Delete */}
                <div className="flex items-center gap-2 pt-1">
                  {suggestion.status !== "archived" && (
                    <Button variant="ghost" size="sm" onClick={() => onStatusChange(suggestion.id, "archived")} className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                      <Archive size={11} />Archive
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onStatusChange(suggestion.id, "deleted")} className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-red-400">
                    <Trash2 size={11} />Delete
                  </Button>
                </div>
              </div>
            )}

            {/* Archived actions */}
            {suggestion.status === "archived" && (
              <div className="flex items-center gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => onStatusChange(suggestion.id, "open")} className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                  Reopen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onStatusChange(suggestion.id, "deleted")} className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-red-400">
                  <Trash2 size={11} />Delete
                </Button>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Full image dialog */}
      {suggestion.image_url && (
        <Dialog open={imageOpen} onOpenChange={setImageOpen}>
          <DialogContent className="max-w-3xl" style={{ background: "hsl(0 0% 7%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "var(--font-heading)", fontSize: 13 }}>Screenshot — {suggestion.title}</DialogTitle>
            </DialogHeader>
            <img src={suggestion.image_url} alt="Full screenshot" className="w-full rounded-md" style={{ maxHeight: "75vh", objectFit: "contain" }} />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// ─── Tab label helper ─────────────────────────────────────────────────────────

function TabLabel({ label, count, color }: { label: string; count: number; color?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {label}
      {count > 0 && (
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{
            background: color ? `${color}22` : "rgba(255,255,255,0.08)",
            color: color ?? "hsl(var(--muted-foreground))",
            fontFamily: "var(--font-heading)",
          }}
        >
          {count}
        </span>
      )}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuggestionAdmin() {
  const queryClient = useQueryClient()
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["site-suggestions"],
    queryFn: fetchSuggestions,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SubmissionStatus }) => {
      const { error } = await supabase.from("site_suggestions").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["site-suggestions"] })
      const label = status === "archived" ? "Archived" : status === "deleted" ? "Deleted" : status === "open" ? "Reopened" : status
      toast.success(label)
    },
    onError: () => toast.error("Action failed"),
  })

  function refetch() { queryClient.invalidateQueries({ queryKey: ["site-suggestions"] }) }

  const open      = suggestions.filter(s => s.status === "open")
  const needsInfo = suggestions.filter(s => s.status === "needs_info")
  const completed = suggestions.filter(s => s.status === "completed")
  const archived  = suggestions.filter(s => s.status === "archived")

  function renderList(items: Suggestion[]) {
    if (isLoading) return <EmptyState message="Loading…" />
    if (!items.length) return <EmptyState message="Nothing here" />
    return items.map(s => (
      <SuggestionRow
        key={s.id}
        suggestion={s}
        onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
        onReplySent={refetch}
      />
    ))
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(0 0% 6%)" }}>

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <MessageSquarePlus className="h-5 w-5" style={{ color: "var(--skyshare-gold)" }} />
          <h1 className="text-lg font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))" }}>
            Suggestions & Support
          </h1>
        </div>
        <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
          Suggestions, support tickets, and compliments submitted by portal users.
        </p>
      </div>

      {/* ── Stats ── */}
      {!isLoading && <StatsPanel suggestions={suggestions.filter(s => s.status !== "deleted")} />}

      {/* ── Tabs ── */}
      <Tabs defaultValue="open">
        <TabsList className="mb-4 h-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <TabsTrigger value="open" className="text-xs">
            <TabLabel label="Open" count={open.length} color="#818cf8" />
          </TabsTrigger>
          <TabsTrigger value="needs_info" className="text-xs">
            <TabLabel label="Needs Info" count={needsInfo.length} color="#fbbf24" />
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">
            <TabLabel label="Completed" count={completed.length} color="#34d399" />
          </TabsTrigger>
          <TabsTrigger value="archived" className="text-xs">
            <TabLabel label="Archived" count={archived.length} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open">{renderList(open)}</TabsContent>
        <TabsContent value="needs_info">{renderList(needsInfo)}</TabsContent>
        <TabsContent value="completed">{renderList(completed)}</TabsContent>
        <TabsContent value="archived">{renderList(archived)}</TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Inbox size={28} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.25 }} />
      <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>{message}</p>
    </div>
  )
}
