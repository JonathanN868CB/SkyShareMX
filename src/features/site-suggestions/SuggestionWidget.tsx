import { useState, useEffect, useRef, useCallback } from "react"
import {
  MessageSquarePlus, X, ImageIcon, SendHorizonal, CheckCircle2,
} from "lucide-react"
import { useAuth } from "@/features/auth"
import { supabase } from "@/lib/supabase"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnreadReply {
  id: string
  admin_reply: string
  sent_at: string
  suggestion_id: string
  suggestionTitle: string
}

// ─── Widget ───────────────────────────────────────────────────────────────────

/**
 * variant="topbar"  — ghost icon button matching the Bell / Theme toggle style
 * variant="sidebar" — compact icon button matching the dark sidebar aesthetic
 */
export function SuggestionWidget({ variant = "topbar" }: { variant?: "topbar" | "sidebar" }) {
  const { profile } = useAuth()
  const [open, setOpen]               = useState(false)
  const [title, setTitle]             = useState("")
  const [body, setBody]               = useState("")
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(false)
  const [unreadReply, setUnreadReply] = useState<UnreadReply | null>(null)
  const [dismissing, setDismissing]   = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const [zoneHovered, setZoneHovered] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasUnread = unreadReply !== null

  // ── Fetch unread replies on mount ─────────────────────────────────────────
  const fetchUnread = useCallback(async () => {
    if (!profile) return
    const { data: suggestions } = await supabase
      .from("site_suggestions")
      .select("id, title")
      .eq("user_id", profile.id)

    if (!suggestions?.length) return

    const ids = suggestions.map(s => s.id)
    const { data: reply } = await supabase
      .from("suggestion_replies")
      .select("id, admin_reply, sent_at, suggestion_id")
      .is("read_at", null)
      .in("suggestion_id", ids)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (reply) {
      const suggestionTitle =
        suggestions.find(s => s.id === reply.suggestion_id)?.title ?? "your suggestion"
      setUnreadReply({ ...reply, suggestionTitle })
    } else {
      setUnreadReply(null)
    }
  }, [profile])

  useEffect(() => { fetchUnread() }, [fetchUnread])

  // ── Clipboard paste listener (active when dialog is open) ─────────────────
  useEffect(() => {
    if (!open) return
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
  }, [open])

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
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) loadImage(file)
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!profile || !title.trim() || submitting) return
    setSubmitting(true)

    let imageUrl: string | null = null

    if (imageFile) {
      const ext = imageFile.name.split(".").pop() ?? "png"
      const path = `${profile.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from("suggestion-screenshots")
        .upload(path, imageFile)
      if (!error) {
        const { data } = supabase.storage
          .from("suggestion-screenshots")
          .getPublicUrl(path)
        imageUrl = data.publicUrl
      }
    }

    await supabase.from("site_suggestions").insert({
      user_id:   profile.id,
      page_url:  window.location.href,
      title:     title.trim(),
      body:      body.trim() || null,
      image_url: imageUrl,
    })

    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => {
      setOpen(false)
      setSubmitted(false)
      setTitle("")
      setBody("")
      clearImage()
    }, 1800)
  }

  // ── Dismiss reply ─────────────────────────────────────────────────────────
  async function dismissReply() {
    if (!unreadReply || dismissing) return
    setDismissing(true)
    await supabase
      .from("suggestion_replies")
      .update({ read_at: new Date().toISOString() })
      .eq("id", unreadReply.id)
    setUnreadReply(null)
    setDismissing(false)
  }

  // ── Open dialog ───────────────────────────────────────────────────────────
  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) {
      setSubmitted(false)
      setTitle("")
      setBody("")
      clearImage()
    }
  }

  // ── Trigger button ────────────────────────────────────────────────────────
  const trigger =
    variant === "topbar" ? (
      <button
        onClick={() => setOpen(true)}
        title="Send a suggestion"
        className="relative h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <MessageSquarePlus className="h-4 w-4" />
        {hasUnread && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "var(--skyshare-gold)" }}
          />
        )}
      </button>
    ) : (
      /* sidebar variant */
      <button
        onClick={() => setOpen(true)}
        title="Send a suggestion"
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
        {hasUnread && (
          <span
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
            style={{ background: "var(--skyshare-gold)", border: "1.5px solid hsl(0 0% 9%)" }}
          />
        )}
      </button>
    )

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
              Send a Suggestion
            </DialogTitle>
          </DialogHeader>

          {/* ── Unread reply banner ── */}
          {unreadReply && (
            <div
              className="rounded-md p-3 flex items-start gap-3"
              style={{
                background: "rgba(212,160,23,0.08)",
                border: "1px solid rgba(212,160,23,0.25)",
              }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
                >
                  Reply from Jonathan
                </p>
                <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.75)" }}>
                  Re: <span className="font-medium">{unreadReply.suggestionTitle}</span>
                </p>
                <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
                  {unreadReply.admin_reply}
                </p>
              </div>
              <button
                onClick={dismissReply}
                disabled={dismissing}
                className="flex-shrink-0 p-1 rounded transition-colors hover:bg-white/10"
                title="Dismiss reply"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* ── Success state ── */}
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 size={36} style={{ color: "#059669" }} />
              <p className="text-sm font-medium">Suggestion sent — thanks!</p>
            </div>
          ) : (
            <div className="space-y-4 pt-1">

              {/* Title */}
              <div>
                <label
                  className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                >
                  Title <span style={{ color: "var(--skyshare-gold)" }}>*</span>
                </label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Brief description of your suggestion"
                  className="h-9 text-sm bg-white/5 border-white/10"
                  maxLength={120}
                />
              </div>

              {/* Body */}
              <div>
                <label
                  className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                >
                  Details <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span>
                </label>
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Any additional context or steps to reproduce..."
                  className="text-sm bg-white/5 border-white/10 resize-none"
                  rows={3}
                />
              </div>

              {/* Image drop zone */}
              <div>
                <label
                  className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                >
                  Screenshot <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>optional</span>
                </label>

                {imagePreview ? (
                  <div className="relative rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                    <img
                      src={imagePreview}
                      alt="Screenshot preview"
                      className="w-full max-h-48 object-contain"
                      style={{ background: "hsl(0 0% 7%)" }}
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1 rounded-full"
                      style={{ background: "rgba(0,0,0,0.7)" }}
                      title="Remove screenshot"
                    >
                      <X size={13} style={{ color: "#fff" }} />
                    </button>
                  </div>
                ) : (
                  /* Paste / drag target — does NOT open file picker on click so focus stays
                     in the dialog and the document paste listener keeps working */
                  <div
                    tabIndex={0}
                    onMouseEnter={() => setZoneHovered(true)}
                    onMouseLeave={() => setZoneHovered(false)}
                    onPaste={e => {
                      const items = e.clipboardData?.items
                      if (!items) return
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith("image/")) {
                          const file = item.getAsFile()
                          if (file) loadImage(file)
                          break
                        }
                      }
                    }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className="flex flex-col items-center justify-center gap-2 py-5 rounded-md focus:outline-none"
                    style={{
                      border: `2px dashed ${
                        dragOver
                          ? "rgba(212,160,23,0.6)"
                          : zoneHovered
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(255,255,255,0.1)"
                      }`,
                      background: dragOver
                        ? "rgba(212,160,23,0.06)"
                        : zoneHovered
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.02)",
                      transition: "border 0.15s ease, background 0.15s ease",
                      cursor: "default",
                    }}
                  >
                    <ImageIcon
                      size={22}
                      style={{
                        color: dragOver ? "var(--skyshare-gold)" : zoneHovered ? "rgba(255,255,255,0.6)" : "hsl(var(--muted-foreground))",
                        opacity: dragOver || zoneHovered ? 1 : 0.35,
                        transition: "color 0.15s ease, opacity 0.15s ease",
                      }}
                    />

                    {/* Primary instruction — swaps on hover */}
                    <span
                      className="text-xs font-medium"
                      style={{
                        color: zoneHovered || dragOver ? "rgba(255,255,255,0.75)" : "hsl(var(--muted-foreground))",
                        opacity: zoneHovered || dragOver ? 1 : 0.5,
                        transition: "color 0.15s ease, opacity 0.15s ease",
                      }}
                    >
                      {dragOver ? "Drop image here" : (
                        <>
                          Press{" "}
                          <kbd
                            className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                            style={{
                              background: zoneHovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              transition: "background 0.15s ease",
                            }}
                          >
                            Ctrl+V
                          </kbd>{" "}
                          to paste your screenshot
                        </>
                      )}
                    </span>

                    <span className="text-[11px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
                      or drag an image ·{" "}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="hover:opacity-100 transition-opacity"
                        style={{ textDecoration: "underline", textUnderlineOffset: 3, opacity: 0.7 }}
                      >
                        browse files
                      </button>
                    </span>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>

              {/* Page context (read-only info) */}
              <p
                className="text-[10px] truncate"
                style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
                title={window.location.pathname}
              >
                Page: {window.location.pathname}
              </p>

              {/* Submit row + Win+Shift+S hint */}
              <div className="flex items-center justify-between pt-1">

                {/* Snipping shortcut hint — bottom-left of dialog */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
                  >
                    Snip:
                  </span>
                  {["⊞ Win", "Shift", "S"].map((k, i) => (
                    <span key={k} className="flex items-center gap-1">
                      {i > 0 && (
                        <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>+</span>
                      )}
                      <kbd
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold"
                        style={{
                          background: "rgba(212,160,23,0.1)",
                          border: "1px solid rgba(212,160,23,0.3)",
                          color: "rgba(212,160,23,0.75)",
                        }}
                      >
                        {k}
                      </kbd>
                    </span>
                  ))}
                </div>

              {/* Submit */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={!title.trim() || submitting}
                  className="h-8 px-5 text-xs font-bold uppercase tracking-wider gap-2"
                  style={{
                    background: title.trim() ? "var(--skyshare-gold)" : "rgba(255,255,255,0.06)",
                    color: title.trim() ? "#111" : "hsl(var(--muted-foreground))",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  <SendHorizonal size={13} />
                  {submitting ? "Sending..." : "Send Suggestion"}
                </Button>
              </div>

              </div>{/* end justify-between row */}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
