import { useState, useEffect, useRef, useCallback } from "react"
import {
  MessageSquarePlus, X, ImageIcon, SendHorizonal, CheckCircle2,
  ChevronRight, ArrowLeft, CornerDownRight, AlertCircle,
} from "lucide-react"
import { useAuth } from "@/features/auth"
import { supabase } from "@/lib/supabase"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import { formatDistanceToNow } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type SubmissionType = "suggestion" | "ticket" | "compliment"
type SubmissionStatus = "open" | "needs_info" | "completed" | "archived"
type ReplyType = "reply" | "needs_info" | "completed"
type ReplyeSender = "admin" | "user"

interface MyReply {
  id: string
  admin_reply: string
  reply_type: ReplyType
  sender: ReplyeSender
  sent_at: string
  read_at: string | null
}

interface MyItem {
  id: string
  title: string
  type: SubmissionType
  status: SubmissionStatus
  created_at: string
  suggestion_replies: MyReply[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<SubmissionType, {
  label: string
  shortLabel: string
  color: string
  bg: string
  border: string
  activeBg: string
  placeholder: string
}> = {
  suggestion: {
    label: "Suggestion",
    shortLabel: "Suggestion",
    color: "#818cf8",
    bg: "rgba(99,102,241,0.10)",
    border: "rgba(99,102,241,0.25)",
    activeBg: "rgba(99,102,241,0.18)",
    placeholder: "Brief description of your suggestion",
  },
  ticket: {
    label: "Support Ticket",
    shortLabel: "Ticket",
    color: "#fbbf24",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
    activeBg: "rgba(245,158,11,0.18)",
    placeholder: "What's the issue you're running into?",
  },
  compliment: {
    label: "Compliment",
    shortLabel: "Compliment",
    color: "#34d399",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.25)",
    activeBg: "rgba(16,185,129,0.18)",
    placeholder: "What did you enjoy or appreciate?",
  },
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  open: "Open",
  needs_info: "Needs Info",
  completed: "Completed",
  archived: "Archived",
}

const STATUS_COLOR: Record<SubmissionStatus, string> = {
  open: "#818cf8",
  needs_info: "#fbbf24",
  completed: "#34d399",
  archived: "rgba(255,255,255,0.3)",
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function SuggestionWidget({ variant = "topbar" }: { variant?: "topbar" | "sidebar" }) {
  const { profile } = useAuth()
  const [open, setOpen]                   = useState(false)
  const [activeTab, setActiveTab]         = useState<"submit" | "mine">("submit")
  const [type, setType]                   = useState<SubmissionType>("suggestion")
  const [title, setTitle]                 = useState("")
  const [body, setBody]                   = useState("")
  const [imageFile, setImageFile]         = useState<File | null>(null)
  const [imagePreview, setImagePreview]   = useState<string | null>(null)
  const [submitting, setSubmitting]       = useState(false)
  const [submitted, setSubmitted]         = useState(false)
  const [dragOver, setDragOver]           = useState(false)
  const [zoneHovered, setZoneHovered]     = useState(false)
  const [myItems, setMyItems]             = useState<MyItem[]>([])
  const [loadingItems, setLoadingItems]   = useState(false)
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [moreInfo, setMoreInfo]           = useState("")
  const [sendingInfo, setSendingInfo]     = useState(false)
  const [unreadCount, setUnreadCount]     = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch user's items + unread count ─────────────────────────────────────
  const fetchMyItems = useCallback(async () => {
    if (!profile) return
    setLoadingItems(true)
    const { data } = await supabase
      .from("site_suggestions")
      .select(`
        id, title, type, status, created_at,
        suggestion_replies (id, admin_reply, reply_type, sender, sent_at, read_at)
      `)
      .eq("user_id", profile.id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })

    const items = (data ?? []) as MyItem[]
    setMyItems(items)

    const count = items
      .flatMap(i => i.suggestion_replies)
      .filter(r => r.sender === "admin" && !r.read_at)
      .length
    setUnreadCount(count)
    setLoadingItems(false)
  }, [profile])

  useEffect(() => { fetchMyItems() }, [fetchMyItems])

  // ── Mark admin replies on an item as read ─────────────────────────────────
  async function markRead(itemId: string) {
    const item = myItems.find(i => i.id === itemId)
    if (!item) return
    const unreadIds = item.suggestion_replies
      .filter(r => r.sender === "admin" && !r.read_at)
      .map(r => r.id)
    if (!unreadIds.length) return
    await supabase
      .from("suggestion_replies")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
    await fetchMyItems()
  }

  // ── Expand item + mark read ────────────────────────────────────────────────
  async function toggleExpand(itemId: string) {
    if (expandedId === itemId) {
      setExpandedId(null)
    } else {
      setExpandedId(itemId)
      await markRead(itemId)
    }
  }

  // ── Clipboard paste ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || activeTab !== "submit") return
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) loadImage(file)
          break
        }
      }
    }
    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [open, activeTab])

  // ── Image helpers ─────────────────────────────────────────────────────────
  function loadImage(file: File) {
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = e => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/")) loadImage(file)
    e.target.value = ""
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) loadImage(file)
  }
  function clearImage() { setImageFile(null); setImagePreview(null) }

  // ── Submit new ────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!profile || !title.trim() || submitting) return
    setSubmitting(true)
    let imageUrl: string | null = null
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() ?? "png"
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("suggestion-screenshots").upload(path, imageFile)
      if (!error) {
        const { data } = supabase.storage.from("suggestion-screenshots").getPublicUrl(path)
        imageUrl = data.publicUrl
      }
    }
    await supabase.from("site_suggestions").insert({
      user_id:  profile.id,
      page_url: window.location.href,
      title:    title.trim(),
      body:     body.trim() || null,
      image_url: imageUrl,
      type,
    })
    setSubmitting(false)
    setSubmitted(true)
    fetchMyItems()
    setTimeout(() => {
      setSubmitted(false)
      setTitle("")
      setBody("")
      clearImage()
      setType("suggestion")
    }, 1800)
  }

  // ── Send more info (user reply on needs_info item) ────────────────────────
  async function handleSendMoreInfo(itemId: string) {
    if (!moreInfo.trim() || sendingInfo) return
    setSendingInfo(true)
    await supabase.from("suggestion_replies").insert({
      suggestion_id: itemId,
      admin_reply:   moreInfo.trim(),
      sender:        "user",
      reply_type:    "reply",
    })
    await supabase
      .from("site_suggestions")
      .update({ status: "open" })
      .eq("id", itemId)
    setMoreInfo("")
    setSendingInfo(false)
    await fetchMyItems()
  }

  // ── Dialog open/close ─────────────────────────────────────────────────────
  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) {
      setSubmitted(false); setTitle(""); setBody(""); clearImage()
      setType("suggestion"); setExpandedId(null); setMoreInfo("")
    }
    if (v) fetchMyItems()
  }

  function switchTab(tab: "submit" | "mine") {
    setActiveTab(tab)
    setExpandedId(null)
    if (tab === "mine") fetchMyItems()
  }

  const cfg = TYPE_CONFIG[type]
  const itemsNeedingAttention = myItems.filter(i => i.status === "needs_info").length

  // ── Trigger button ────────────────────────────────────────────────────────
  const badge = unreadCount > 0 ? (
    <span
      className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-bold"
      style={{
        background: "#ef4444",
        color: "#fff",
        fontSize: 9,
        minWidth: unreadCount > 9 ? 16 : 14,
        height: 14,
        padding: "0 3px",
        fontFamily: "var(--font-heading)",
        border: "1.5px solid hsl(0 0% 9%)",
        lineHeight: 1,
      }}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  ) : null

  const trigger = variant === "topbar" ? (
    <button
      onClick={() => setOpen(true)}
      title="Suggestions & support"
      className="relative h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <MessageSquarePlus className="h-4 w-4" />
      {badge}
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      title="Suggestions & support"
      className="relative flex items-center justify-center w-7 h-7 rounded-sm transition-colors"
      style={{
        border: "1px solid rgba(212,160,23,0.2)",
        background: "transparent",
        color: "rgba(212,160,23,0.6)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(212,160,23,0.5)"
        e.currentTarget.style.color = "rgba(212,160,23,0.9)"
        e.currentTarget.style.background = "rgba(212,160,23,0.07)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(212,160,23,0.2)"
        e.currentTarget.style.color = "rgba(212,160,23,0.6)"
        e.currentTarget.style.background = "transparent"
      }}
    >
      <MessageSquarePlus style={{ width: 13, height: 13 }} />
      {badge}
    </button>
  )

  // ── My Items tab content ──────────────────────────────────────────────────
  function renderMyItems() {
    if (loadingItems) {
      return (
        <div className="flex items-center justify-center py-10">
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>Loading…</span>
        </div>
      )
    }
    if (!myItems.length) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <MessageSquarePlus size={24} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.2 }} />
          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
            Nothing submitted yet
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
        {myItems.map(item => {
          const tcfg = TYPE_CONFIG[item.type]
          const isExpanded = expandedId === item.id
          const unread = item.suggestion_replies.filter(r => r.sender === "admin" && !r.read_at).length
          const adminReplies = item.suggestion_replies.filter(r => r.sender === "admin")
          const userReplies = item.suggestion_replies.filter(r => r.sender === "user")

          return (
            <div
              key={item.id}
              className="rounded-md overflow-hidden transition-colors"
              style={{
                background: isExpanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderLeft: `3px solid ${tcfg.color}`,
              }}
            >
              {/* Row */}
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              >
                {/* Type label */}
                <span
                  className="text-[9px] font-bold uppercase tracking-wider flex-shrink-0 px-1.5 py-0.5 rounded"
                  style={{ background: tcfg.bg, color: tcfg.color, border: `1px solid ${tcfg.border}`, fontFamily: "var(--font-heading)" }}
                >
                  {tcfg.shortLabel}
                </span>

                {/* Title */}
                <span className="flex-1 min-w-0 text-xs font-medium truncate" style={{ color: "hsl(var(--foreground))" }}>
                  {item.title}
                </span>

                {/* Status */}
                <span
                  className="text-[9px] font-bold uppercase tracking-wider flex-shrink-0 px-1.5 py-0.5 rounded"
                  style={{ color: STATUS_COLOR[item.status], fontFamily: "var(--font-heading)" }}
                >
                  {STATUS_LABEL[item.status]}
                </span>

                {/* Unread badge */}
                {unread > 0 && (
                  <span
                    className="flex-shrink-0 flex items-center justify-center rounded-full font-bold"
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 9,
                      minWidth: 14,
                      height: 14,
                      padding: "0 3px",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {unread}
                  </span>
                )}

                <ChevronRight
                  size={13}
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    opacity: 0.4,
                    transform: isExpanded ? "rotate(90deg)" : undefined,
                    transition: "transform 0.15s",
                  }}
                />
              </button>

              {/* Expanded thread */}
              {isExpanded && (
                <div
                  className="px-3 pb-3 space-y-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  {/* Timestamp */}
                  <p className="text-[10px] pt-2" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
                    Submitted {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>

                  {/* Thread */}
                  {item.suggestion_replies.length > 0 && (
                    <div className="space-y-2">
                      {item.suggestion_replies.map(r => {
                        const isAdminMsg = r.sender === "admin"
                        const isNeedsInfo = r.reply_type === "needs_info"
                        const isCompleted = r.reply_type === "completed"

                        let borderColor = isAdminMsg
                          ? (isNeedsInfo ? "rgba(251,191,36,0.3)" : isCompleted ? "rgba(52,211,153,0.3)" : "rgba(212,160,23,0.2)")
                          : "rgba(255,255,255,0.1)"
                        let bgColor = isAdminMsg
                          ? (isNeedsInfo ? "rgba(245,158,11,0.08)" : isCompleted ? "rgba(16,185,129,0.08)" : "rgba(212,160,23,0.06)")
                          : "rgba(255,255,255,0.03)"
                        let labelColor = isAdminMsg
                          ? (isNeedsInfo ? "#fbbf24" : isCompleted ? "#34d399" : "var(--skyshare-gold)")
                          : "rgba(255,255,255,0.4)"
                        let label = isAdminMsg
                          ? (isNeedsInfo ? "Jonathan needs more info" : isCompleted ? "Jonathan marked complete" : "Jonathan")
                          : "You"

                        return (
                          <div
                            key={r.id}
                            className="rounded-md px-2.5 py-2"
                            style={{ background: bgColor, border: `1px solid ${borderColor}` }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className="text-[9px] font-bold uppercase tracking-wider"
                                style={{ color: labelColor, fontFamily: "var(--font-heading)" }}
                              >
                                {label}
                              </span>
                              <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
                                {formatDistanceToNow(new Date(r.sent_at), { addSuffix: true })}
                                {r.sender === "admin" && r.read_at ? " · seen" : ""}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
                              {r.admin_reply}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Needs info — provide more info form */}
                  {item.status === "needs_info" && (
                    <div
                      className="rounded-md p-2.5 space-y-2"
                      style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <AlertCircle size={11} style={{ color: "#fbbf24", flexShrink: 0 }} />
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: "#fbbf24", fontFamily: "var(--font-heading)" }}
                        >
                          Jonathan needs more information
                        </span>
                      </div>
                      <Textarea
                        value={moreInfo}
                        onChange={e => setMoreInfo(e.target.value)}
                        placeholder=""
                        className="text-xs bg-white/5 border-white/10 resize-none"
                        rows={2}
                      />
                      <Button
                        size="sm"
                        disabled={!moreInfo.trim() || sendingInfo}
                        onClick={() => handleSendMoreInfo(item.id)}
                        className="h-7 px-3 text-xs gap-1.5"
                        style={{
                          background: moreInfo.trim() ? "#fbbf24" : "rgba(255,255,255,0.06)",
                          color: moreInfo.trim() ? "#111" : "hsl(var(--muted-foreground))",
                          fontFamily: "var(--font-heading)",
                        }}
                      >
                        <CornerDownRight size={11} />
                        {sendingInfo ? "Sending…" : "Send Reply"}
                      </Button>
                    </div>
                  )}

                  {/* Empty thread */}
                  {item.suggestion_replies.length === 0 && item.status !== "needs_info" && (
                    <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
                      No replies yet — Jonathan will respond when reviewed.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // ── Submit form ───────────────────────────────────────────────────────────
  function renderSubmitForm() {
    if (submitted) {
      return (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle2 size={36} style={{ color: "#34d399" }} />
          <p className="text-sm font-medium" style={{ color: cfg.color }}>
            {type === "compliment" ? "Thank you — that means a lot!" :
             type === "ticket" ? "Ticket submitted — we'll look into it!" :
             "Suggestion sent — thanks!"}
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-4 pt-1">

        {/* Type selector */}
        <div className="grid grid-cols-3 gap-1.5">
          {(["suggestion", "ticket", "compliment"] as SubmissionType[]).map(t => {
            const c = TYPE_CONFIG[t]
            const active = type === t
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className="py-2 px-1 rounded-md text-center transition-all"
                style={{
                  background: active ? c.activeBg : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? c.color : "rgba(255,255,255,0.08)"}`,
                  color: active ? c.color : "hsl(var(--muted-foreground))",
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {c.shortLabel}
                </span>
              </button>
            )
          })}
        </div>

        {/* Title */}
        <div>
          <label
            className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
          >
            {type === "compliment" ? "The site is amazing, right?" :
             type === "ticket" ? "What's the issue?" : "Title"}{" "}
            <span style={{ color: cfg.color }}>*</span>
          </label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder=""
            className="h-9 text-sm bg-white/5 border-white/10"
            maxLength={120}
            style={{ borderColor: title ? cfg.border : undefined }}
          />
        </div>

        {/* Body */}
        <div>
          <label
            className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
            style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
          >
            Details{" "}
            <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span>
          </label>
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder=""
            className="text-sm bg-white/5 border-white/10 resize-none"
            rows={3}
          />
        </div>

        {/* Screenshot (hidden for compliments) */}
        {type !== "compliment" && (
          <div>
            <label
              className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
            >
              Screenshot{" "}
              <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span>
            </label>

            {imagePreview ? (
              <div className="relative rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                <img src={imagePreview} alt="Preview" className="w-full max-h-36 object-contain" style={{ background: "hsl(0 0% 7%)" }} />
                <button onClick={clearImage} className="absolute top-2 right-2 p-1 rounded-full" style={{ background: "rgba(0,0,0,0.7)" }} title="Remove">
                  <X size={13} style={{ color: "#fff" }} />
                </button>
              </div>
            ) : (
              <div
                tabIndex={0}
                onMouseEnter={() => setZoneHovered(true)}
                onMouseLeave={() => setZoneHovered(false)}
                onPaste={e => {
                  const items = e.clipboardData?.items
                  if (!items) return
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith("image/")) { const f = item.getAsFile(); if (f) loadImage(f); break }
                  }
                }}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className="flex flex-col items-center justify-center gap-2 py-4 rounded-md focus:outline-none"
                style={{
                  border: `2px dashed ${dragOver ? cfg.color : zoneHovered ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)"}`,
                  background: dragOver ? cfg.bg : zoneHovered ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                  transition: "border 0.15s ease, background 0.15s ease",
                  cursor: "default",
                }}
              >
                <ImageIcon size={20} style={{ color: dragOver ? cfg.color : "hsl(var(--muted-foreground))", opacity: dragOver ? 1 : 0.3, transition: "all 0.15s" }} />
                <span className="text-xs font-medium" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                  {dragOver ? "Drop here" : (
                    <>Press <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)" }}>Ctrl+V</kbd> to paste</>
                  )}
                </span>
                <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
                  or drag · <button onClick={() => fileInputRef.current?.click()} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>browse</button>
                </span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          </div>
        )}

        {/* Page context */}
        <p className="text-[10px] truncate" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }} title={window.location.pathname}>
          Page: {window.location.pathname}
        </p>

        {/* Submit row */}
        <div className="flex items-center justify-between pt-1">
          {type !== "compliment" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>Snip:</span>
              {["⊞ Win", "Shift", "S"].map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>+</span>}
                  <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold" style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.3)", color: "rgba(212,160,23,0.75)" }}>{k}</kbd>
                </span>
              ))}
            </div>
          ) : <div />}

          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="h-8 px-5 text-xs font-bold uppercase tracking-wider gap-2"
            style={{
              background: title.trim() ? cfg.color : "rgba(255,255,255,0.06)",
              color: title.trim() ? "#111" : "hsl(var(--muted-foreground))",
              fontFamily: "var(--font-heading)",
            }}
          >
            <SendHorizonal size={13} />
            {submitting ? "Sending…" : type === "compliment" ? "Send Compliment" : type === "ticket" ? "Submit Ticket" : "Send Suggestion"}
          </Button>
        </div>

      </div>
    )
  }

  // ── Dialog ────────────────────────────────────────────────────────────────
  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-md"
          style={{ background: "hsl(0 0% 9%)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <MessageSquarePlus size={16} style={{ color: "var(--skyshare-gold)" }} />
              Feedback & Support
            </DialogTitle>
          </DialogHeader>

          {/* ── Tabs ── */}
          <div
            className="flex rounded-md p-0.5 gap-0.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {([
              { key: "submit", label: "New Submission" },
              { key: "mine", label: `My Items${myItems.length ? ` (${myItems.length})` : ""}` },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: activeTab === tab.key ? "rgba(255,255,255,0.08)" : "transparent",
                  color: activeTab === tab.key ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                }}
              >
                {tab.label}
                {tab.key === "mine" && unreadCount > 0 && (
                  <span
                    className="flex items-center justify-center rounded-full font-bold"
                    style={{
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 9,
                      minWidth: 14,
                      height: 14,
                      padding: "0 3px",
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
                {tab.key === "mine" && itemsNeedingAttention > 0 && unreadCount === 0 && (
                  <span
                    className="flex items-center justify-center rounded-full font-bold"
                    style={{
                      background: "#fbbf24",
                      color: "#111",
                      fontSize: 9,
                      minWidth: 14,
                      height: 14,
                      padding: "0 3px",
                    }}
                  >
                    {itemsNeedingAttention}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          {activeTab === "submit" ? renderSubmitForm() : renderMyItems()}

        </DialogContent>
      </Dialog>
    </>
  )
}
