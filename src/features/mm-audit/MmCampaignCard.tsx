import { useState } from "react"
import { ClipboardList, CheckCircle2, XCircle, Shield, Loader2, Trash2 } from "lucide-react"
import { useAuth } from "@/features/auth"
import { useApproveCampaign, useFinalizeCampaign, useCancelCampaign, useDeleteCampaign } from "./useMmAuditData"
import type { CampaignSummary } from "./types"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: rgba(0.1) }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: pct === 100 ? "#10b981" : C,
        }}
      />
    </div>
  )
}

interface Props {
  campaign: CampaignSummary
  onOpenWorkspace?: () => void
}

export default function MmCampaignCard({ campaign, onOpenWorkspace }: Props) {
  const { profile } = useAuth()
  const role = profile?.role ?? ""
  const isManager = role === "Manager" || role === "Admin"
  const isSuperAdmin = role === "Super Admin"

  const isComplete = campaign.status === "closed"
  const isCancelled = campaign.status === "cancelled"
  const isActive = campaign.status === "open"

  const hasAdminApproval = !!campaign.approved_by_admin
  const hasSuperAdminApproval = !!campaign.approved_by_super_admin
  const fullyApproved = hasAdminApproval && hasSuperAdminApproval

  const approveMut = useApproveCampaign()
  const finalizeMut = useFinalizeCampaign()
  const cancelMut = useCancelCampaign()
  const deleteMut = useDeleteCampaign()

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleApprove = () => {
    const approveRole = isSuperAdmin ? "Super Admin" : "Admin"
    approveMut.mutate({ campaign_id: campaign.id, role: approveRole })
  }

  const handleFinalize = () => {
    finalizeMut.mutate({ campaign_id: campaign.id })
  }

  const handleCancel = () => {
    cancelMut.mutate({ campaign_id: campaign.id }, {
      onSuccess: () => setShowCancelConfirm(false),
    })
  }

  // Manager/Admin fills the "admin" approval slot; Super Admin fills the "super admin" slot
  const canApprove = isActive && (
    (isSuperAdmin && !hasSuperAdminApproval) ||
    (isManager && !isSuperAdmin && !hasAdminApproval)
  )

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ background: rgba(0.04), border: `1px solid ${rgba(0.12)}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.9)" }}
          >
            {campaign.name}
          </span>
          <span
            className="ml-3 text-xs"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            {campaign.period_start} — {campaign.period_end}
          </span>
        </div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
          style={{
            fontFamily: "var(--font-heading)",
            background: isComplete ? "rgba(16,185,129,0.1)" : isCancelled ? "rgba(239,68,68,0.1)" : rgba(0.1),
            color: isComplete ? "#10b981" : isCancelled ? "#f87171" : C,
          }}
        >
          {isComplete ? "Complete" : isCancelled ? "Cancelled" : "Open"}
        </span>
      </div>

      <ProgressBar pct={campaign.progress_pct} />

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
        <span>
          {campaign.audited_items} of {campaign.total_items} reviewed — {campaign.progress_pct}%
          {campaign.staged_revision_count > 0 && (
            <span style={{ color: "#f59e0b" }}> · {campaign.staged_revision_count} revision change{campaign.staged_revision_count > 1 ? "s" : ""} staged</span>
          )}
        </span>
        {isActive && campaign.days_remaining > 0 && (
          <span>{campaign.days_remaining} days remaining</span>
        )}
      </div>

      {/* Approval status */}
      {isActive && (hasAdminApproval || hasSuperAdminApproval) && (
        <div
          className="rounded-lg px-3 py-2 flex items-center gap-3 text-xs"
          style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
        >
          <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#10b981" }} />
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: hasAdminApproval ? "#10b981" : "rgba(255,255,255,0.2)" }}
              />
              <span style={{ color: hasAdminApproval ? "#10b981" : "rgba(255,255,255,0.35)" }}>
                Manager {hasAdminApproval ? "Approved" : "Pending"}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: hasSuperAdminApproval ? "#10b981" : "rgba(255,255,255,0.2)" }}
              />
              <span style={{ color: hasSuperAdminApproval ? "#10b981" : "rgba(255,255,255,0.35)" }}>
                Super Admin {hasSuperAdminApproval ? "Approved" : "Pending"}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Open Workspace */}
          {onOpenWorkspace && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenWorkspace() }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${rgba(0.12)}, ${rgba(0.06)})`,
                border: `1px solid ${rgba(0.2)}`,
                color: C,
                fontFamily: "var(--font-heading)",
              }}
            >
              <ClipboardList className="h-4 w-4" />
              Open Audit Workspace
            </button>
          )}

          {/* Approve */}
          {canApprove && (
            <button
              onClick={(e) => { e.stopPropagation(); handleApprove() }}
              disabled={approveMut.isPending}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all hover:opacity-90 disabled:opacity-40"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#10b981",
                fontFamily: "var(--font-heading)",
              }}
            >
              {approveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Approve Campaign
            </button>
          )}

          {/* Finalize — only when both approvals are in, and user is Super Admin */}
          {fullyApproved && isSuperAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); handleFinalize() }}
              disabled={finalizeMut.isPending}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all hover:opacity-90 disabled:opacity-40"
              style={{
                background: "#10b981",
                color: "#fff",
                fontFamily: "var(--font-heading)",
              }}
            >
              {finalizeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Finalize &amp; Push to Database
            </button>
          )}

          {/* Cancel — Super Admin only */}
          {isSuperAdmin && !showCancelConfirm && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowCancelConfirm(true) }}
              className="flex items-center gap-1 px-2 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
              style={{
                color: "rgba(255,255,255,0.3)",
                fontFamily: "var(--font-heading)",
              }}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div
          className="rounded-lg px-4 py-3 space-y-2"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <div className="text-xs font-bold" style={{ color: "#f87171" }}>
            Cancel this campaign?
          </div>
          <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            All staged revision changes and audit records from this campaign will be discarded. This cannot be undone.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleCancel() }}
              disabled={cancelMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#f87171", color: "#fff", fontFamily: "var(--font-heading)" }}
            >
              {cancelMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Yes, Cancel Campaign
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCancelConfirm(false) }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}
            >
              Keep Open
            </button>
          </div>
        </div>
      )}

      {/* Delete cancelled campaign — Super Admin only */}
      {isCancelled && isSuperAdmin && !showDeleteConfirm && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
          style={{ color: "rgba(255,255,255,0.25)", fontFamily: "var(--font-heading)" }}
        >
          <Trash2 className="h-3 w-3" />
          Delete Campaign
        </button>
      )}

      {showDeleteConfirm && (
        <div
          className="rounded-lg px-4 py-3 space-y-2"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <div className="text-xs font-bold" style={{ color: "#f87171" }}>
            Permanently delete this campaign?
          </div>
          <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            This will remove "{campaign.name}" from the database entirely. This cannot be undone.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); deleteMut.mutate({ campaign_id: campaign.id }) }}
              disabled={deleteMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "#f87171", color: "#fff", fontFamily: "var(--font-heading)" }}
            >
              {deleteMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Yes, Delete Permanently
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false) }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}
            >
              Keep
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
