import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, Package, AlertTriangle, Send, Clock, User,
  ChevronDown, Pencil, Check, X,
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
  REQUEST_STATUSES, LINE_STATUSES, CONDITIONS,
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

  // Status change
  const [showStatusMenu, setShowStatusMenu] = useState(false)

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

        {/* Status + controls */}
        <div className="flex items-center gap-3">
          <PartsStatusBadge status={request.status} size="md" />
          {request.status !== "cancelled" && request.status !== "closed" && request.status !== "denied" && (
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
              style={{
                background: "rgba(212,160,23,0.12)",
                border: "1px solid rgba(212,160,23,0.3)",
                color: "rgba(212,160,23,0.9)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,160,23,0.2)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(212,160,23,0.12)" }}
            >
              <Package className="w-3.5 h-3.5" />
              Create PO
            </button>
          )}
          {canEdit && request.status === "cancelled" && (
            <button
              onClick={() => changeStatus("requested")}
              className="px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: "rgba(100,180,255,0.12)",
                border: "1px solid rgba(100,180,255,0.3)",
                color: "rgba(100,180,255,0.9)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(100,180,255,0.2)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(100,180,255,0.12)"
              }}
            >
              Reopen
            </button>
          )}
          {canEdit && request.status !== "closed" && request.status !== "cancelled" && (
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Update <ChevronDown className="w-3 h-3" />
              </button>
              {showStatusMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-md py-1 z-50 min-w-[160px]"
                  style={{
                    background: "hsl(0 0% 12%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  {REQUEST_STATUSES.filter(s => s !== request.status && s !== "cancelled").map(s => (
                    <button
                      key={s}
                      onClick={() => changeStatus(s)}
                      className="w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <PartsStatusBadge status={s} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {(canEdit || request.requested_by === profile?.id) && request.status !== "closed" && request.status !== "cancelled" && (
            confirmCancel ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Cancel order:</span>
                <button
                  onClick={() => { setConfirmCancel(false); handleCancelDelete() }}
                  className="px-2 py-1 rounded text-xs font-medium transition-colors"
                  style={{
                    background: "rgba(255,60,60,0.2)",
                    border: "1px solid rgba(255,60,60,0.4)",
                    color: "rgba(255,100,100,0.95)",
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => { setConfirmCancel(false); changeStatus("cancelled") }}
                  className="px-2 py-1 rounded text-xs font-medium transition-colors"
                  style={{
                    background: "rgba(255,165,80,0.15)",
                    border: "1px solid rgba(255,165,80,0.3)",
                    color: "rgba(255,165,80,0.9)",
                  }}
                >
                  Archive
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="px-2 py-1 rounded text-xs transition-colors"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Nevermind
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmCancel(true)}
                className="px-2 py-1 rounded text-xs transition-colors"
                style={{
                  background: "rgba(255,100,100,0.08)",
                  border: "1px solid rgba(255,100,100,0.2)",
                  color: "rgba(255,100,100,0.7)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,100,100,0.15)"
                  e.currentTarget.style.color = "rgba(255,100,100,0.9)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,100,100,0.08)"
                  e.currentTarget.style.color = "rgba(255,100,100,0.7)"
                }}
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
