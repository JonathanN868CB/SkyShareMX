import { useState, useEffect } from "react"
import { CheckCircle, XCircle, Shield, Clock } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { notifyProfileIds } from "../helpers"

interface Approval {
  id: string
  approver_name: string
  decision: "approved" | "denied"
  comment: string | null
  created_at: string
}

interface Props {
  requestId: string
  requestStatus: string
  requestedBy: string
  jobLabel: string
  onStatusChange: () => void
}

export function PartsApprovalPanel({ requestId, requestStatus, requestedBy, jobLabel, onStatusChange }: Props) {
  const { profile } = useAuth()
  const canApprove = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"

  const [approvals, setApprovals] = useState<Approval[]>([])
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadApprovals()
  }, [requestId])

  async function loadApprovals() {
    const { data } = await supabase
      .from("parts_approvals")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at")

    if (!data || data.length === 0) { setApprovals([]); return }

    const approverIds = [...new Set(data.map((a: { approver_id: string }) => a.approver_id))]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, first_name, last_name")
      .in("id", approverIds)

    const nameMap: Record<string, string> = {}
    profiles?.forEach((p: { id: string; display_name: string | null; full_name: string | null; first_name: string | null; last_name: string | null }) => {
      nameMap[p.id] = p.display_name || p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown"
    })

    setApprovals(
      data.map((a: { id: string; approver_id: string; decision: "approved" | "denied"; comment: string | null; created_at: string }) => ({
        id: a.id,
        approver_name: nameMap[a.approver_id] ?? "Unknown",
        decision: a.decision,
        comment: a.comment,
        created_at: a.created_at,
      }))
    )
  }

  async function handleDecision(decision: "approved" | "denied") {
    if (!profile?.id) return
    setSubmitting(true)

    try {
      // Insert approval record
      const { error: appErr } = await supabase.from("parts_approvals").insert({
        request_id: requestId,
        approver_id: profile.id,
        decision,
        comment: comment.trim() || null,
      })
      if (appErr) throw appErr

      // Update request status
      const newStatus = decision === "approved" ? "approved" : "denied"
      const { error: reqErr } = await supabase
        .from("parts_requests")
        .update({ status: newStatus })
        .eq("id", requestId)
      if (reqErr) throw reqErr

      // Status history
      await supabase.from("parts_status_history").insert({
        request_id: requestId,
        old_status: "pending_approval",
        new_status: newStatus,
        changed_by: profile.id,
        note: comment.trim() || null,
      })

      // Notify requester
      const approverName = profile.display_name || profile.full_name || "An approver"
      await notifyProfileIds(
        [requestedBy],
        decision === "approved" ? "parts_approved" : "parts_denied",
        decision === "approved" ? `Parts request approved` : `Parts request denied`,
        `${approverName} ${decision} your parts request for ${jobLabel}${comment.trim() ? ` — "${comment.trim()}"` : ""}`,
        { request_id: requestId, path: `/app/parts/${requestId}` }
      )

      toast.success(decision === "approved" ? "Request approved" : "Request denied")
      setComment("")
      onStatusChange()
      loadApprovals()
    } catch (err) {
      toast.error("Failed to process approval")
    } finally {
      setSubmitting(false)
    }
  }

  function formatTimestamp(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  // Always show approval history if any exist
  const showPanel = requestStatus === "pending_approval" || approvals.length > 0

  if (!showPanel) return null

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: requestStatus === "pending_approval" ? "rgba(245,180,60,0.2)" : "rgba(255,255,255,0.06)",
        background: requestStatus === "pending_approval" ? "rgba(245,180,60,0.03)" : "rgba(255,255,255,0.02)",
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{
          background: requestStatus === "pending_approval" ? "rgba(245,180,60,0.06)" : "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Shield className="w-3.5 h-3.5" style={{ color: "rgba(245,180,60,0.8)" }} />
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "rgba(245,180,60,0.8)", fontFamily: "var(--font-heading)" }}
        >
          Approval
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* History */}
        {approvals.map(a => (
          <div key={a.id} className="flex items-start gap-3">
            {a.decision === "approved" ? (
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "rgba(100,220,100,0.8)" }} />
            ) : (
              <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "rgba(255,100,100,0.8)" }} />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                  {a.approver_name}
                </span>
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{
                    color: a.decision === "approved" ? "rgba(100,220,100,0.8)" : "rgba(255,100,100,0.8)",
                  }}
                >
                  {a.decision}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {formatTimestamp(a.created_at)}
                </span>
              </div>
              {a.comment && (
                <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                  "{a.comment}"
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Action buttons — only when pending */}
        {requestStatus === "pending_approval" && canApprove && (
          <div className="space-y-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment (optional)"
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.9)",
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleDecision("approved")}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  background: "rgba(100,220,100,0.12)",
                  color: "rgba(100,220,100,0.9)",
                  border: "1px solid rgba(100,220,100,0.25)",
                }}
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => handleDecision("denied")}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  background: "rgba(255,100,100,0.08)",
                  color: "rgba(255,100,100,0.8)",
                  border: "1px solid rgba(255,100,100,0.2)",
                }}
              >
                <XCircle className="w-4 h-4" />
                Deny
              </button>
            </div>
          </div>
        )}

        {/* Waiting message for non-approvers */}
        {requestStatus === "pending_approval" && !canApprove && (
          <div className="flex items-center gap-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Clock className="w-4 h-4" style={{ color: "rgba(245,180,60,0.6)" }} />
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Waiting for manager approval
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
