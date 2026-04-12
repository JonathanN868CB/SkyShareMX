import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, Package, AlertTriangle, Send, Clock, User,
  Pencil, Check, X, Ban, RotateCcw, Search,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/shared/ui/select"
import { PartsStatusBadge } from "./PartsStatusBadge"
import { PartsApprovalPanel } from "./PartsApprovalPanel"
import { TrackingTimeline } from "./TrackingTimeline"
import { notifyProfileIds, notifyByRoles } from "../helpers"
import {
  LINE_STATUSES, CONDITIONS,
  STATUS_CONFIG,
  type RequestStatus, type LineStatus,
} from "../constants"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestDetail {
  id: string
  order_type: string
  aircraft_tail: string | null
  job_description: string
  work_order: string | null
  item_number: string | null
  stock_purpose: string | null
  date_needed: string
  ship_to: string
  ship_to_address: string | null
  all_at_once: boolean
  delay_affects_rts: boolean
  aog: boolean
  aog_removed_pn: string | null
  aog_removed_sn: string | null
  aog_squawk: string | null
  notes: string | null
  front_link: string | null
  status: RequestStatus
  requested_by: string
  created_at: string
}

interface LineDetail {
  id: string
  request_id: string
  line_number: number
  part_number: string
  alternate_pn: string | null
  description: string | null
  quantity: number
  condition: string
  vendor: string | null
  po_number: string | null
  unit_cost: number | null
  tracking_number: string | null
  tracking_status: string | null
  tracking_eta: string | null
  tracking_events: Array<{ timestamp: string; location: string; status: string; description: string }> | null
  tracking_last_checked: string | null
  is_exchange: boolean
  core_due_by: string | null
  core_tracking: string | null
  core_status: string | null
  line_status: LineStatus
}

interface ActivityEntry {
  id: string
  type: "status" | "note"
  author_name: string
  body: string
  created_at: string
}

interface ProfileCache {
  [id: string]: string
}

// ─── Send for Approval modal ──────────────────────────────────────────────────

const APPROVAL_RECIPIENTS = [
  { email: "jonathan@skyshare.com", name: "Jonathan Schaedig" },
  { email: "rpaden@skyshare.com",   name: "R. Paden" },
  { email: "charles@skyshare.com",  name: "Charles" },
  { email: "esantana@skyshare.com", name: "E. Santana" },
]

interface SendApprovalModalProps {
  request: RequestDetail
  linesCount: number
  onClose: () => void
  onSent: () => void
}

function SendApprovalModal({ request, linesCount, onClose, onSent }: SendApprovalModalProps) {
  const [selected, setSelected] = useState<string[]>(["jonathan@skyshare.com"])
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const jobTitle = request.order_type === "stock"
    ? `Stock — ${request.job_description}`
    : `${request.aircraft_tail} — ${request.job_description}`

  function toggleRecipient(email: string) {
    setSelected(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email])
  }

  async function handleSend() {
    if (selected.length === 0) return
    setSending(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("Not authenticated")

      const res = await fetch("/.netlify/functions/parts-approval-send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          requestId: request.id,
          recipients: selected,
          message: message.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Send failed")

      toast.success(`Sent for approval to ${selected.length} recipient${selected.length !== 1 ? "s" : ""}`)
      onSent()
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send approval request")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-xl w-full max-w-md space-y-5 p-6" style={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 22%)" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "12px", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.9)" }}>
              Send for Approval
            </h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{jobTitle}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Request summary */}
        <div className="rounded-lg px-4 py-3" style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.15)" }}>
          {request.work_order && (
            <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>WO {request.work_order}</p>
          )}
          <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
            {linesCount} part line{linesCount !== 1 ? "s" : ""}
          </p>
          {request.date_needed && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Need by {new Date(request.date_needed + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Recipients */}
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.35)" }}>
            Send to
          </p>
          <div className="space-y-1.5">
            {APPROVAL_RECIPIENTS.map(r => {
              const checked = selected.includes(r.email)
              return (
                <button
                  key={r.email}
                  onClick={() => toggleRecipient(r.email)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left cursor-pointer"
                  style={{
                    background: checked ? "rgba(212,160,23,0.08)" : "rgba(255,255,255,0.025)",
                    borderColor: checked ? "rgba(212,160,23,0.3)" : "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: checked ? "var(--skyshare-gold)" : "transparent",
                      border: `1px solid ${checked ? "var(--skyshare-gold)" : "rgba(255,255,255,0.25)"}`,
                    }}
                  >
                    {checked && <Check className="w-2.5 h-2.5" style={{ color: "#000" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none" style={{ color: "rgba(255,255,255,0.85)" }}>{r.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{r.email}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Optional message */}
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-1.5" style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.35)" }}>
            Message (optional)
          </p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Add context for the approver…"
            rows={3}
            className="w-full rounded-lg px-3 py-2.5 text-sm resize-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.8)",
              outline: "none",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            className="inline-flex items-center h-8 px-3 rounded-md border text-xs font-medium transition-all cursor-pointer"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={selected.length === 0 || sending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
            style={{ background: "var(--skyshare-gold)", borderColor: "rgba(212,160,23,0.5)", color: "#000" }}
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending…" : `Send to ${selected.length} Recipient${selected.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  requestId: string
}

export function PartsDetailView({ requestId }: Props) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"

  const [request, setRequest] = useState<RequestDetail | null>(null)
  const [lines, setLines] = useState<LineDetail[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [requesterName, setRequesterName] = useState("")
  const [loading, setLoading] = useState(true)

  const isSingleLine = lines.length === 1

  // Note input
  const [noteText, setNoteText] = useState("")
  const [sendingNote, setSendingNote] = useState(false)
  const [editingFrontLink, setEditingFrontLink] = useState(false)
  const [frontLinkDraft, setFrontLinkDraft] = useState("")

  // Cancel confirmation
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ lineId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState("")

  // Send for Approval modal
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)

  // ─── Load ─────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      // Fetch request
      const { data: reqData, error: reqErr } = await supabase
        .from("parts_requests")
        .select("*")
        .eq("id", requestId)
        .single()

      if (reqErr) throw reqErr
      setRequest(reqData as RequestDetail)

      // Fetch lines
      const { data: lineData } = await supabase
        .from("parts_request_lines")
        .select("*")
        .eq("request_id", requestId)
        .order("line_number")

      setLines((lineData ?? []) as LineDetail[])

      // Build profile cache for activity
      const profileIds = new Set<string>()
      profileIds.add(reqData.requested_by)

      // Fetch notes
      const { data: noteData } = await supabase
        .from("parts_notes")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at")

      noteData?.forEach((n: { author_id: string }) => profileIds.add(n.author_id))

      // Fetch status history
      const { data: histData } = await supabase
        .from("parts_status_history")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at")

      histData?.forEach((h: { changed_by: string }) => profileIds.add(h.changed_by))

      // Resolve profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, full_name, first_name, last_name")
        .in("id", [...profileIds])

      const cache: ProfileCache = {}
      profiles?.forEach((p: { id: string; display_name: string | null; full_name: string | null; first_name: string | null; last_name: string | null }) => {
        cache[p.id] = p.display_name || p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown"
      })

      setRequesterName(cache[reqData.requested_by] ?? "Unknown")

      // Build activity feed
      const entries: ActivityEntry[] = []

      histData?.forEach((h: { id: string; changed_by: string; new_status: string; old_status: string | null; note: string | null; created_at: string }) => {
        const statusLabel = STATUS_CONFIG[h.new_status as RequestStatus]?.label ?? h.new_status
        let body = `Status → ${statusLabel}`
        if (h.old_status) {
          const oldLabel = STATUS_CONFIG[h.old_status as RequestStatus]?.label ?? h.old_status
          body = `${oldLabel} → ${statusLabel}`
        }
        if (h.note) body += ` — "${h.note}"`

        entries.push({
          id: h.id,
          type: "status",
          author_name: cache[h.changed_by] ?? "System",
          body,
          created_at: h.created_at,
        })
      })

      noteData?.forEach((n: { id: string; author_id: string; body: string; created_at: string }) => {
        entries.push({
          id: n.id,
          type: "note",
          author_name: cache[n.author_id] ?? "Unknown",
          body: n.body,
          created_at: n.created_at,
        })
      })

      entries.sort((a, b) => a.created_at.localeCompare(b.created_at))
      setActivity(entries)
    } catch (err) {
      console.error("Failed to load request:", err)
      toast.error("Failed to load request")
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => { loadData() }, [loadData])

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function changeStatus(newStatus: RequestStatus) {
    if (!request || !profile?.id) return
    setShowStatusMenu(false)

    const { error } = await supabase
      .from("parts_requests")
      .update({ status: newStatus })
      .eq("id", request.id)

    if (error) { toast.error(`Failed to update status: ${error.message}`); return }

    await supabase.from("parts_status_history").insert({
      request_id: request.id,
      old_status: request.status,
      new_status: newStatus,
      changed_by: profile.id,
    })

    // Notifications on key status changes
    const jobLabel = request.order_type === "stock"
      ? `Stock — ${request.job_description}`
      : `${request.aircraft_tail} — ${request.job_description}`
    const aogPrefix = request.aog ? "🔴 AOG: " : ""
    const actorName = profile.display_name || profile.full_name || "Parts team"
    const meta = { request_id: request.id, link: `/app/beet-box/parts/${request.id}` }

    if (newStatus === "ordered") {
      // Notify requester that their part was ordered
      await notifyProfileIds(
        [request.requested_by],
        "parts_ordered",
        `${aogPrefix}Parts ordered`,
        `${actorName} placed the order for ${jobLabel}`,
        meta
      )
    } else if (newStatus === "shipped") {
      // Notify requester + managers
      await notifyProfileIds(
        [request.requested_by],
        "parts_shipped",
        `${aogPrefix}Parts shipped`,
        `${jobLabel} — parts have shipped`,
        meta
      )
      await notifyByRoles(
        ["Manager", "Admin", "Super Admin"],
        "parts_shipped",
        `${aogPrefix}Parts shipped`,
        `${jobLabel} — parts have shipped`,
        meta,
        profile.id
      )
    } else if (newStatus === "received") {
      await notifyProfileIds(
        [request.requested_by],
        "parts_received",
        `Parts received`,
        `${jobLabel} — parts have been received`,
        meta
      )
    }

    // Single-part order: keep the line in sync with request status
    if (isSingleLine && lines[0]) {
      const lineStatusMap: Record<string, string> = {
        requested: "requested",
        ordered: "ordered",
        shipped: "shipped",
        received: "received",
        closed: "closed",
      }
      const mapped = lineStatusMap[newStatus]
      if (mapped && mapped !== lines[0].line_status) {
        await supabase
          .from("parts_request_lines")
          .update({ line_status: mapped })
          .eq("id", lines[0].id)
      }
    }

    toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`)
    loadData()
  }

  async function handleCancelDelete() {
    if (!request) return
    // ON DELETE CASCADE handles all child rows
    const { error } = await supabase.from("parts_requests").delete().eq("id", request.id)

    if (error) { toast.error(`Failed to delete: ${error.message}`); return }
    toast.success("Parts request deleted")
    navigate("/app/beet-box/parts")
  }

  async function saveLineField(lineId: string, field: string, value: string) {
    const updateData: Record<string, unknown> = {}

    if (field === "unit_cost") {
      updateData[field] = value ? parseFloat(value) : null
    } else if (field === "is_exchange") {
      updateData[field] = value === "true"
    } else {
      updateData[field] = value || null
    }

    const { error } = await supabase
      .from("parts_request_lines")
      .update(updateData)
      .eq("id", lineId)

    if (error) { toast.error("Failed to save"); return }

    // Notify on tracking added
    if (field === "tracking_number" && value && request && profile) {
      const jobLabel = request.order_type === "stock"
        ? `Stock — ${request.job_description}`
        : `${request.aircraft_tail} — ${request.job_description}`
      const meta = { request_id: request.id, link: `/app/beet-box/parts/${request.id}` }

      await notifyProfileIds(
        [request.requested_by],
        "parts_tracking",
        `Tracking added`,
        `${jobLabel} — tracking number added: ${value}`,
        meta
      )
      await notifyByRoles(
        ["Manager", "Admin", "Super Admin"],
        "parts_tracking",
        `Tracking added`,
        `${jobLabel} — tracking: ${value}`,
        meta,
        profile.id
      )
    }

    setEditingCell(null)
    loadData()
  }

  async function changeLineStatus(lineId: string, newStatus: LineStatus) {
    const { error } = await supabase
      .from("parts_request_lines")
      .update({ line_status: newStatus })
      .eq("id", lineId)

    if (error) { toast.error("Failed to update line status"); return }

    if (profile?.id) {
      await supabase.from("parts_status_history").insert({
        request_id: requestId,
        line_id: lineId,
        old_status: lines.find(l => l.id === lineId)?.line_status,
        new_status: newStatus,
        changed_by: profile.id,
      })
    }

    loadData()
  }

  async function addNote() {
    if (!noteText.trim() || !profile?.id) return
    setSendingNote(true)

    const { error } = await supabase.from("parts_notes").insert({
      request_id: requestId,
      author_id: profile.id,
      body: noteText.trim(),
    })

    if (error) { toast.error("Failed to add note"); setSendingNote(false); return }
    setNoteText("")
    setSendingNote(false)
    loadData()
  }

  // ─── Inline edit helpers ──────────────────────────────────────────────────

  function startEdit(lineId: string, field: string, currentValue: string) {
    if (!canEdit) return
    setEditingCell({ lineId, field })
    setEditValue(currentValue)
  }

  function renderEditable(lineId: string, field: string, value: string | null, placeholder: string) {
    const isEditing = editingCell?.lineId === lineId && editingCell?.field === field
    const display = value || ""

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            type={field === "unit_cost" ? "number" : field === "tracking_eta" || field === "core_due_by" ? "date" : "text"}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") saveLineField(lineId, field, editValue)
              if (e.key === "Escape") setEditingCell(null)
            }}
            autoFocus
            className="rounded px-2 py-1 text-sm w-full"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(212,160,23,0.4)",
              color: "rgba(255,255,255,0.9)",
            }}
            step={field === "unit_cost" ? "0.01" : undefined}
          />
          <button onClick={() => saveLineField(lineId, field, editValue)}>
            <Check className="w-3.5 h-3.5" style={{ color: "rgba(100,220,100,0.8)" }} />
          </button>
          <button onClick={() => setEditingCell(null)}>
            <X className="w-3.5 h-3.5" style={{ color: "rgba(255,100,100,0.6)" }} />
          </button>
        </div>
      )
    }

    if (!canEdit) {
      return (
        <span className="text-sm" style={{ color: display ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }}>
          {display || "—"}
        </span>
      )
    }

    return (
      <button
        onClick={() => startEdit(lineId, field, display)}
        className="flex items-center gap-1 group text-left w-full"
      >
        <span
          className="text-sm"
          style={{ color: display ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}
        >
          {display || placeholder}
        </span>
        <Pencil
          className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          style={{ color: "rgba(212,160,23,0.6)" }}
        />
      </button>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="p-6 text-center">
        <p style={{ color: "rgba(255,255,255,0.5)" }}>Request not found</p>
      </div>
    )
  }

  const conditionLabel = (c: string) => CONDITIONS.find(x => x.value === c)?.label ?? c

  function formatDate(iso: string) {
    const d = new Date(iso + "T00:00:00")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  function formatTimestamp(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  const jobTitle = request.order_type === "stock"
    ? `Stock — ${request.job_description}`
    : `${request.aircraft_tail} — ${request.job_description}`

  return (
    <div className="space-y-6">

      {/* ── Send for Approval modal ──────────────────────────────────── */}
      {approvalModalOpen && (
        <SendApprovalModal
          request={request}
          linesCount={lines.length}
          onClose={() => setApprovalModalOpen(false)}
          onSent={() => { setApprovalModalOpen(false); loadData() }}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1
            className="text-xl font-bold tracking-wide"
            style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.95)" }}
          >
            {jobTitle}
          </h1>
          <div className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            {request.work_order && <span>WO {request.work_order}{request.item_number ? ` / ${request.item_number}` : ""}</span>}
            <span>·</span>
            <span>Requested by {requesterName}</span>
            <span>·</span>
            <span>{formatTimestamp(request.created_at)}</span>
          </div>
        </div>

        {/* ── Status & action bar ──────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <PartsStatusBadge status={request.status} size="md" />

          {!["closed"].includes(request.status) && (
            <div className="w-px h-4 flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />
          )}

          {/* Mark Sourcing — only when still at requested */}
          {canEdit && request.status === "requested" && (
            <button
              onClick={() => changeStatus("sourcing")}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer"
              style={{ background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)", color: "rgba(245,158,11,0.9)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.18)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.1)" }}
            >
              <Search className="w-3 h-3" /> Sourcing
            </button>
          )}

          {/* Send for Approval — when requested or sourcing */}
          {canEdit && (request.status === "requested" || request.status === "sourcing") && (
            <button
              onClick={() => setApprovalModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer"
              style={{ background: "rgba(96,165,250,0.1)", borderColor: "rgba(96,165,250,0.3)", color: "rgba(96,165,250,0.9)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(96,165,250,0.18)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(96,165,250,0.1)" }}
            >
              <Send className="w-3 h-3" /> Send for Approval
            </button>
          )}

          {/* Create PO — gold primary, shown until parts are ordered/beyond */}
          {!["ordered", "shipped", "received", "closed", "cancelled", "denied"].includes(request.status) && (
            <button
              onClick={() => navigate("/app/beet-box/purchase-orders/new", {
                state: {
                  fromRequest: {
                    requestId: request.id,
                    requestedBy: request.requested_by,
                    currentStatus: request.status,
                    woRef: request.work_order ?? "",
                    jobDescription: request.job_description,
                    dateNeeded: request.date_needed,
                    lines: lines.map(l => ({
                      requestLineId: l.id,
                      partNumber: l.part_number,
                      description: l.description ?? "",
                      qty: l.quantity,
                      catalogId: null,
                    }))
                  }
                }
              })}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer"
              style={{ background: "var(--skyshare-gold)", borderColor: "rgba(212,160,23,0.5)", color: "#000" }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)" }}
              onMouseLeave={e => { e.currentTarget.style.filter = "" }}
            >
              <Package className="w-3 h-3" /> Create PO
            </button>
          )}

          {/* Deny — visible while request is actionable */}
          {canEdit && ["requested", "sourcing", "pending_approval"].includes(request.status) && (
            <button
              onClick={() => changeStatus("denied")}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer"
              style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "rgba(239,68,68,0.7)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.color = "rgba(239,68,68,0.9)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "rgba(239,68,68,0.7)" }}
            >
              <Ban className="w-3 h-3" /> Deny
            </button>
          )}

          {/* Reopen — for denied or cancelled */}
          {canEdit && (request.status === "denied" || request.status === "cancelled") && (
            <button
              onClick={() => changeStatus("requested")}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer"
              style={{ background: "rgba(96,165,250,0.1)", borderColor: "rgba(96,165,250,0.3)", color: "rgba(96,165,250,0.9)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(96,165,250,0.18)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(96,165,250,0.1)" }}
            >
              <RotateCcw className="w-3 h-3" /> Reopen
            </button>
          )}

          {/* Cancel */}
          {(canEdit || request.requested_by === profile?.id) && !["closed", "cancelled", "denied"].includes(request.status) && (
            confirmCancel ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Cancel request:</span>
                <button
                  onClick={() => { setConfirmCancel(false); handleCancelDelete() }}
                  className="inline-flex items-center h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer"
                  style={{ background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.4)", color: "rgba(239,68,68,0.95)" }}
                >
                  Delete
                </button>
                <button
                  onClick={() => { setConfirmCancel(false); changeStatus("cancelled") }}
                  className="inline-flex items-center h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer"
                  style={{ background: "rgba(251,146,60,0.12)", borderColor: "rgba(251,146,60,0.3)", color: "rgba(251,146,60,0.85)" }}
                >
                  Archive
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="inline-flex items-center h-7 px-2 rounded text-[11px] transition-all cursor-pointer"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Nevermind
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="inline-flex items-center h-7 px-2.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer"
                style={{ background: "rgba(239,68,68,0.07)", borderColor: "rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.65)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.13)"; e.currentTarget.style.color = "rgba(239,68,68,0.85)" }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.07)"; e.currentTarget.style.color = "rgba(239,68,68,0.65)" }}
              >
                Cancel
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Banners ────────────────────────────────────────────────────── */}
      {request.aog && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{
            background: "rgba(255,60,60,0.08)",
            border: "1px solid rgba(255,60,60,0.2)",
          }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "rgba(255,80,80,0.9)" }} />
          <div>
            <p className="text-sm font-medium" style={{ color: "rgba(255,100,100,0.9)" }}>
              Aircraft on Ground
            </p>
            {request.aog_squawk && (
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.6)" }}>
                {request.aog_squawk}
              </p>
            )}
            {(request.aog_removed_pn || request.aog_removed_sn) && (
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.5)" }}>
                Removed: {request.aog_removed_pn} {request.aog_removed_sn ? `S/N ${request.aog_removed_sn}` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {request.delay_affects_rts && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
          style={{
            background: "rgba(255,165,80,0.06)",
            border: "1px solid rgba(255,165,80,0.15)",
          }}
        >
          <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,165,80,0.8)" }} />
          <p className="text-sm" style={{ color: "rgba(255,165,80,0.85)" }}>
            Delayed parts will change expected return to service
          </p>
        </div>
      )}

      {/* ── Request Info ───────────────────────────────────────────────── */}
      <div
        className="rounded-lg border p-4 grid grid-cols-4 gap-4"
        style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div>
          <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Need By</p>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
            {formatDate(request.date_needed)}
          </p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Ship To</p>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
            {request.ship_to}
            {request.ship_to_address && (
              <span className="text-xs block" style={{ color: "rgba(255,255,255,0.4)" }}>
                {request.ship_to_address}
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>All at once?</p>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
            {request.all_at_once ? "Yes" : "No"}
          </p>
        </div>
        {request.notes && (
          <div className="col-span-1">
            <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Notes</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              {request.notes}
            </p>
          </div>
        )}
      </div>

      {/* ── Front Conversation Link + Approval Panel ────────────────── */}
      <div className="space-y-4">
        {/* Front link */}
        <div
          className="rounded-lg border px-4 py-3 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}
        >
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: "rgba(255,255,255,0.4)" }}>
            Front Thread
          </span>
          {editingFrontLink ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="url"
                value={frontLinkDraft}
                onChange={e => setFrontLinkDraft(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === "Enter") {
                    await supabase.from("parts_requests").update({ front_link: frontLinkDraft.trim() || null }).eq("id", request.id)
                    setEditingFrontLink(false)
                    loadData()
                  }
                  if (e.key === "Escape") setEditingFrontLink(false)
                }}
                placeholder="https://app.frontapp.com/open/cnv_..."
                autoFocus
                className="flex-1 rounded px-2 py-1 text-sm"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(212,160,23,0.4)",
                  color: "rgba(255,255,255,0.9)",
                }}
              />
              <button
                onClick={async () => {
                  await supabase.from("parts_requests").update({ front_link: frontLinkDraft.trim() || null }).eq("id", request.id)
                  setEditingFrontLink(false)
                  loadData()
                }}
              >
                <Check className="w-3.5 h-3.5" style={{ color: "rgba(100,220,100,0.8)" }} />
              </button>
              <button onClick={() => setEditingFrontLink(false)}>
                <X className="w-3.5 h-3.5" style={{ color: "rgba(255,100,100,0.6)" }} />
              </button>
            </div>
          ) : request.front_link ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <a
                href={request.front_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm truncate hover:underline"
                style={{ color: "rgba(100,180,255,0.85)" }}
              >
                Open in Front
              </a>
              <button
                onClick={() => { setFrontLinkDraft(request.front_link ?? ""); setEditingFrontLink(true) }}
                className="flex-shrink-0"
              >
                <Pencil className="w-3 h-3" style={{ color: "rgba(212,160,23,0.5)" }} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setFrontLinkDraft(""); setEditingFrontLink(true) }}
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              + Add Front conversation link
            </button>
          )}
        </div>

        {/* Approval */}
        <PartsApprovalPanel
          requestId={request.id}
          requestStatus={request.status}
          requestedBy={request.requested_by}
          jobLabel={jobTitle}
          onStatusChange={loadData}
        />
      </div>

      {/* ── Parts Lines ────────────────────────────────────────────────── */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="px-4 py-2.5 flex items-center gap-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Package className="w-3.5 h-3.5" style={{ color: "var(--skyshare-gold)", opacity: 0.6 }} />
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
          >
            Parts Lines
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            {lines.length}
          </span>
        </div>

        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          {lines.map(line => (
            <div
              key={line.id}
              className="p-4 space-y-3"
              style={{ background: "rgba(255,255,255,0.01)" }}
            >
              {/* Line header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-semibold tracking-wider"
                    style={{ color: "var(--skyshare-gold)", opacity: 0.6 }}
                  >
                    #{line.line_number}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                    {line.part_number}
                  </span>
                  {line.alternate_pn && (
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Alt: {line.alternate_pn}
                    </span>
                  )}
                  {line.description && (
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                      — {line.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {line.is_exchange && (
                    <span
                      className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(178,130,255,0.1)", color: "rgba(178,130,255,0.85)" }}
                    >
                      Exchange
                    </span>
                  )}
                  {canEdit && !isSingleLine ? (
                    <Select value={line.line_status} onValueChange={v => changeLineStatus(line.id, v as LineStatus)}>
                      <SelectTrigger
                        className="rounded px-2 py-1 text-xs font-medium h-auto w-auto min-w-[110px]"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LINE_STATUSES.map(s => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <PartsStatusBadge status={line.line_status} variant="line" />
                  )}
                </div>
              </div>

              {/* Line detail grid */}
              <div className="grid grid-cols-6 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Qty</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{line.quantity}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Condition</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{conditionLabel(line.condition)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Vendor</p>
                  {renderEditable(line.id, "vendor", line.vendor, "Add vendor")}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>PO #</p>
                  {renderEditable(line.id, "po_number", line.po_number, "Add PO")}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Cost</p>
                  {renderEditable(line.id, "unit_cost", line.unit_cost?.toString() ?? "", "$ —")}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Tracking</p>
                  {renderEditable(line.id, "tracking_number", line.tracking_number, "Add tracking")}
                </div>
              </div>

              {/* ETA + Exchange row */}
              <div className="grid grid-cols-6 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>ETA</p>
                  {renderEditable(line.id, "tracking_eta", line.tracking_eta, "Add ETA")}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Exchange</p>
                  {canEdit ? (
                    <button
                      onClick={() => saveLineField(line.id, "is_exchange", (!line.is_exchange).toString())}
                      className="text-sm"
                      style={{ color: line.is_exchange ? "rgba(178,130,255,0.85)" : "rgba(255,255,255,0.3)" }}
                    >
                      {line.is_exchange ? "Yes" : "No"}
                    </button>
                  ) : (
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {line.is_exchange ? "Yes" : "No"}
                    </span>
                  )}
                </div>
                {line.is_exchange && (
                  <>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Core Status</p>
                      {canEdit ? (
                        <Select value={line.core_status ?? "pending"} onValueChange={v => saveLineField(line.id, "core_status", v)}>
                          <SelectTrigger
                            className="rounded px-2 py-1 text-xs h-auto w-auto min-w-[130px]"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "rgba(178,130,255,0.85)",
                            }}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paperwork_complete">Paperwork Complete</SelectItem>
                            <SelectItem value="shipped">Core Shipped</SelectItem>
                            <SelectItem value="vendor_received">Vendor Received</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs" style={{ color: "rgba(178,130,255,0.7)" }}>
                          {(line.core_status ?? "pending").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Core Due</p>
                      {renderEditable(line.id, "core_due_by", line.core_due_by, "Set date")}
                      {line.core_due_by && (() => {
                        const daysLeft = Math.ceil((new Date(line.core_due_by + "T00:00:00").getTime() - Date.now()) / 86_400_000)
                        if (daysLeft <= 0) return <span className="text-[10px] font-bold" style={{ color: "rgba(255,60,60,0.9)" }}>OVERDUE</span>
                        if (daysLeft <= 7) return <span className="text-[10px]" style={{ color: "rgba(255,165,80,0.8)" }}>{daysLeft}d left</span>
                        return null
                      })()}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Core Tracking</p>
                      {renderEditable(line.id, "core_tracking", line.core_tracking, "Add tracking")}
                    </div>
                  </>
                )}
              </div>

              {/* Tracking timeline — shows when tracking number exists */}
              {line.tracking_number && (
                <TrackingTimeline
                  trackingNumber={line.tracking_number}
                  trackingStatus={line.tracking_status}
                  trackingEta={line.tracking_eta}
                  trackingEvents={line.tracking_events}
                  trackingLastChecked={line.tracking_last_checked}
                  canRefresh={canEdit}
                  onRefresh={loadData}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Activity / Notes ───────────────────────────────────────────── */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="px-4 py-2.5"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
          >
            Activity
          </span>
        </div>

        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {activity.length === 0 && (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No activity yet</p>
          )}
          {activity.map(entry => (
            <div key={entry.id} className="flex gap-3">
              <div className="pt-0.5">
                {entry.type === "status" ? (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(212,160,23,0.1)" }}
                  >
                    <Clock className="w-3 h-3" style={{ color: "rgba(212,160,23,0.7)" }} />
                  </div>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(100,180,255,0.1)" }}
                  >
                    <User className="w-3 h-3" style={{ color: "rgba(100,180,255,0.7)" }} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {entry.author_name}
                  </span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {formatTimestamp(entry.created_at)}
                  </span>
                </div>
                <p className="text-sm mt-0.5" style={{ color: entry.type === "status" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.7)" }}>
                  {entry.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Add note */}
        <div
          className="px-4 py-3 flex gap-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <input
            type="text"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && noteText.trim()) addNote() }}
            placeholder="Add a note…"
            className="flex-1 rounded-md px-3 py-2 text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.9)",
            }}
          />
          <button
            onClick={addNote}
            disabled={!noteText.trim() || sendingNote}
            className="px-3 py-2 rounded-md transition-colors disabled:opacity-30"
            style={{
              background: "rgba(212,160,23,0.15)",
              color: "var(--skyshare-gold)",
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
