// CheckHistoryDrawer — slide-out showing all past submissions for one aircraft.

import { useState } from "react"
import { X, ChevronRight, CheckCircle2, AlertTriangle, Archive, Clock } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import type { FourteenDayCheckSubmission } from "@/entities/supabase"
import { useCheckHistory } from "@/hooks/useFourteenDayChecks"
import { ReviewStatusBadge } from "./SubmissionReviewPanel"

type Props = {
  tokenId: string
  registration: string
  onClose: () => void
  onReview: (submissionId: string) => void
}

export function CheckHistoryDrawer({ tokenId, registration, onClose, onReview }: Props) {
  const { data: history = [], isLoading } = useCheckHistory(tokenId)

  return (
    <>
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col"
        style={{
          width: "min(480px, 100vw)",
          background: "#161616",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.2em] uppercase"
              style={{ color: "rgba(212,160,23,0.6)", fontFamily: "var(--font-heading)" }}
            >
              Check History
            </p>
            <p
              className="text-lg font-bold tracking-widest mt-0.5"
              style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
            >
              {registration}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md"
            style={{ color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "#d4a017", borderTopColor: "transparent" }}
              />
            </div>
          )}

          {!isLoading && history.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
              <Clock className="w-8 h-8" style={{ color: "rgba(255,255,255,0.15)" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                No checks submitted yet for {registration}.
              </p>
            </div>
          )}

          {!isLoading && history.length > 0 && (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {history.map((sub, idx) => (
                <HistoryRow
                  key={sub.id}
                  submission={sub}
                  isLatest={idx === 0}
                  onReview={() => onReview(sub.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer count */}
        {history.length > 0 && (
          <div
            className="flex-shrink-0 px-6 py-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              {history.length} submission{history.length !== 1 ? "s" : ""} total
            </p>
          </div>
        )}
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
    </>
  )
}

function HistoryRow({
  submission,
  isLatest,
  onReview,
}: {
  submission: FourteenDayCheckSubmission
  isLatest: boolean
  onReview: () => void
}) {
  const isArchived = submission.review_status === "archived" || submission.review_status === "cleared"
  const isPending = submission.review_status === "pending"

  return (
    <div
      className="flex items-start gap-3 px-5 py-4"
      style={{ opacity: isArchived ? 0.65 : 1 }}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {submission.review_status === "cleared"  && <CheckCircle2 className="w-4 h-4 text-green-400" />}
        {submission.review_status === "flagged"  && <AlertTriangle className="w-4 h-4 text-orange-400" />}
        {submission.review_status === "archived" && <Archive className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}
        {submission.review_status === "pending"  && <Clock className="w-4 h-4" style={{ color: "#d4a017" }} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: isPending ? "#fff" : "rgba(255,255,255,0.7)" }}>
            {submission.submitter_name}
          </span>
          {isLatest && (
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
            >
              Latest
            </span>
          )}
          <ReviewStatusBadge status={submission.review_status} />
        </div>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
          {format(new Date(submission.submitted_at), "MMM d, yyyy · h:mm a")}
          <span className="ml-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
            ({formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })})
          </span>
        </p>
        {submission.review_notes && (
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            "{submission.review_notes}"
          </p>
        )}
      </div>

      {/* View button */}
      <button
        type="button"
        onClick={onReview}
        className="flex-shrink-0 flex items-center gap-0.5 text-xs rounded px-2 py-1 transition-all"
        style={{
          background: isPending ? "rgba(212,160,23,0.12)" : "rgba(255,255,255,0.05)",
          border: isPending ? "1px solid rgba(212,160,23,0.25)" : "1px solid rgba(255,255,255,0.08)",
          color: isPending ? "#d4a017" : "rgba(255,255,255,0.35)",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = isPending ? "#d4a017" : "rgba(255,255,255,0.7)")}
        onMouseLeave={e => (e.currentTarget.style.color = isPending ? "#d4a017" : "rgba(255,255,255,0.35)")}
      >
        View <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  )
}
