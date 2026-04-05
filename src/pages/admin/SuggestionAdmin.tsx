import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  MessageSquarePlus, ExternalLink, Archive, Trash2,
  Send, X, ImageIcon, Clock, ChevronDown, ChevronUp,
  Inbox,
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

interface SuggestionProfile {
  full_name: string | null
  display_name: string | null
  avatar_initials: string | null
  avatar_color: string | null
  avatar_url: string | null
}

interface SuggestionReply {
  id: string
  admin_reply: string
  sent_at: string
  read_at: string | null
}

interface Suggestion {
  id: string
  user_id: string
  page_url: string
  title: string
  body: string | null
  image_url: string | null
  status: "open" | "archived" | "deleted"
  created_at: string
  profiles: SuggestionProfile | null
  suggestion_replies: SuggestionReply[]
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchSuggestions(): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from("site_suggestions")
    .select(`
      *,
      profiles:user_id (
        full_name,
        display_name,
        avatar_initials,
        avatar_color,
        avatar_url
      ),
      suggestion_replies (
        id,
        admin_reply,
        sent_at,
        read_at
      )
    `)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Suggestion[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(profile: SuggestionProfile | null): string {
  if (profile?.avatar_initials) return profile.avatar_initials
  const name = profile?.display_name ?? profile?.full_name ?? ""
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return "??"
}

function displayName(profile: SuggestionProfile | null): string {
  return profile?.display_name ?? profile?.full_name ?? "Unknown User"
}

function formatUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + (u.search || "")
  } catch {
    return url
  }
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function SuggestionRow({
  suggestion,
  onArchive,
  onDelete,
  onReplySent,
}: {
  suggestion: Suggestion
  onArchive: (id: string) => void
  onDelete:  (id: string) => void
  onReplySent: () => void
}) {
  const [expanded, setExpanded]     = useState(false)
  const [replyText, setReplyText]   = useState("")
  const [replying, setReplying]     = useState(false)
  const [imageOpen, setImageOpen]   = useState(false)

  const hasReplied = suggestion.suggestion_replies.length > 0
  const latestReply = hasReplied
    ? suggestion.suggestion_replies[suggestion.suggestion_replies.length - 1]
    : null

  async function sendReply() {
    if (!replyText.trim() || replying) return
    setReplying(true)
    const { error } = await supabase
      .from("suggestion_replies")
      .insert({ suggestion_id: suggestion.id, admin_reply: replyText.trim() })

    if (error) {
      toast.error("Failed to send reply")
    } else {
      toast.success("Reply sent")
      setReplyText("")
      onReplySent()
    }
    setReplying(false)
  }

  return (
    <>
      {/* ── Main row ── */}
      <div
        className="rounded-md transition-colors"
        style={{
          background: expanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          marginBottom: 6,
        }}
      >
        {/* ── Summary line ── */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          {/* Avatar */}
          <Avatar className="h-7 w-7 flex-shrink-0">
            {suggestion.profiles?.avatar_url ? (
              <img
                src={suggestion.profiles.avatar_url}
                alt=""
                className="h-full w-full object-cover rounded-full"
              />
            ) : (
              <AvatarFallback
                className="text-[10px] font-bold"
                style={{
                  background: suggestion.profiles?.avatar_color ?? "#d4a017",
                  color: "#111",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {getInitials(suggestion.profiles)}
              </AvatarFallback>
            )}
          </Avatar>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                {suggestion.title}
              </span>
              {hasReplied && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                  style={{ background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
                >
                  Replied
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                {displayName(suggestion.profiles)}
              </span>
              <span
                className="text-[10px] truncate max-w-[240px]"
                style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
              >
                {formatUrl(suggestion.page_url)}
              </span>
            </div>
          </div>

          {/* Thumbnail */}
          {suggestion.image_url && (
            <div
              className="flex-shrink-0 w-10 h-10 rounded overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.1)", background: "hsl(0 0% 7%)" }}
            >
              <img src={suggestion.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Timestamp */}
          <span
            className="flex-shrink-0 text-[10px] flex items-center gap-1"
            style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}
          >
            <Clock size={10} />
            {formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true })}
          </span>

          {/* Expand chevron */}
          <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {/* ── Expanded detail ── */}
        {expanded && (
          <div
            className="px-4 pb-4 space-y-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            {/* Body */}
            {suggestion.body && (
              <div className="pt-3">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                >
                  Details
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {suggestion.body}
                </p>
              </div>
            )}

            {/* Screenshot */}
            {suggestion.image_url && (
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                >
                  Screenshot
                </p>
                <button
                  onClick={() => setImageOpen(true)}
                  className="block rounded-md overflow-hidden transition-opacity hover:opacity-80"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", maxWidth: 320 }}
                >
                  <img
                    src={suggestion.image_url}
                    alt="Suggestion screenshot"
                    className="w-full object-cover"
                    style={{ maxHeight: 200 }}
                  />
                </button>
              </div>
            )}

            {/* Page URL */}
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
              >
                Page
              </p>
              <a
                href={suggestion.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs flex items-center gap-1.5 hover:underline break-all"
                style={{ color: "rgba(212,160,23,0.8)" }}
              >
                {suggestion.page_url}
                <ExternalLink size={11} className="flex-shrink-0" />
              </a>
            </div>

            {/* Prior replies */}
            {hasReplied && (
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                >
                  {suggestion.suggestion_replies.length > 1
                    ? `Replies (${suggestion.suggestion_replies.length})`
                    : "Reply"}
                </p>
                <div className="space-y-2">
                  {suggestion.suggestion_replies.map(r => (
                    <div
                      key={r.id}
                      className="rounded-md px-3 py-2.5"
                      style={{
                        background: "rgba(212,160,23,0.07)",
                        border: "1px solid rgba(212,160,23,0.18)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
                        >
                          Jonathan
                        </span>
                        <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
                          {formatDistanceToNow(new Date(r.sent_at), { addSuffix: true })}
                          {r.read_at && " · seen"}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
                        {r.admin_reply}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reply box */}
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
              >
                {hasReplied ? "Send Another Reply" : "Reply"}
              </p>
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Type your reply to the submitter..."
                className="text-sm bg-white/5 border-white/10 resize-none"
                rows={3}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={!replyText.trim() || replying}
                    onClick={sendReply}
                    className="h-7 px-3 text-xs gap-1.5"
                    style={{
                      background: replyText.trim() ? "var(--skyshare-gold)" : "rgba(255,255,255,0.06)",
                      color: replyText.trim() ? "#111" : "hsl(var(--muted-foreground))",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    <Send size={11} />
                    {replying ? "Sending..." : "Send Reply"}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {suggestion.status === "open" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onArchive(suggestion.id)}
                      className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Archive size={11} />
                      Archive
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(suggestion.id)}
                    className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 size={11} />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Full image dialog */}
      {suggestion.image_url && (
        <Dialog open={imageOpen} onOpenChange={setImageOpen}>
          <DialogContent
            className="max-w-3xl"
            style={{ background: "hsl(0 0% 7%)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "var(--font-heading)", fontSize: 13 }}>
                Screenshot — {suggestion.title}
              </DialogTitle>
            </DialogHeader>
            <img
              src={suggestion.image_url}
              alt="Full screenshot"
              className="w-full rounded-md"
              style={{ maxHeight: "75vh", objectFit: "contain" }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
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
    mutationFn: async ({ id, status }: { id: string; status: "archived" | "deleted" }) => {
      const { error } = await supabase
        .from("site_suggestions")
        .update({ status })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["site-suggestions"] })
      toast.success(status === "archived" ? "Suggestion archived" : "Suggestion deleted")
    },
    onError: () => toast.error("Action failed"),
  })

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["site-suggestions"] })
  }

  const open     = suggestions.filter(s => s.status === "open")
  const archived = suggestions.filter(s => s.status === "archived")

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: "hsl(0 0% 6%)" }}
    >
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <MessageSquarePlus
            className="h-5 w-5"
            style={{ color: "var(--skyshare-gold)" }}
          />
          <h1
            className="text-lg font-bold uppercase tracking-widest"
            style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))" }}
          >
            Site Suggestions
          </h1>
        </div>
        <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
          Feedback submitted by authenticated users from within the portal.
        </p>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="open">
        <TabsList
          className="mb-4 h-8"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <TabsTrigger value="open" className="text-xs gap-1.5">
            Open
            {open.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background: "rgba(193,2,48,0.2)", color: "#e05070", fontFamily: "var(--font-heading)" }}
              >
                {open.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived" className="text-xs gap-1.5">
            Archived
            {archived.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background: "rgba(255,255,255,0.08)", color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
              >
                {archived.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Open ── */}
        <TabsContent value="open">
          {isLoading ? (
            <EmptyState message="Loading..." />
          ) : open.length === 0 ? (
            <EmptyState message="No open suggestions" />
          ) : (
            open.map(s => (
              <SuggestionRow
                key={s.id}
                suggestion={s}
                onArchive={id => updateStatus.mutate({ id, status: "archived" })}
                onDelete={id => updateStatus.mutate({ id, status: "deleted" })}
                onReplySent={refetch}
              />
            ))
          )}
        </TabsContent>

        {/* ── Archived ── */}
        <TabsContent value="archived">
          {isLoading ? (
            <EmptyState message="Loading..." />
          ) : archived.length === 0 ? (
            <EmptyState message="No archived suggestions" />
          ) : (
            archived.map(s => (
              <SuggestionRow
                key={s.id}
                suggestion={s}
                onArchive={id => updateStatus.mutate({ id, status: "archived" })}
                onDelete={id => updateStatus.mutate({ id, status: "deleted" })}
                onReplySent={refetch}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Inbox size={28} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.25 }} />
      <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
        {message}
      </p>
    </div>
  )
}
