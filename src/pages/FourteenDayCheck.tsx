// 14-Day Check — MC Dashboard
// Fleet status grid + pending submissions review queue.

import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import {
  CalendarClock, ExternalLink, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, RefreshCw,
} from "lucide-react"
import {
  useFleetCheckSummaries,
  usePendingSubmissions,
  useInvalidateChecks,
  useCheckSubmission,
  type AircraftCheckSummary,
  type PendingSubmission,
} from "@/hooks/useFourteenDayChecks"
import { SubmissionReviewPanel } from "@/features/fourteen-day-check/SubmissionReviewPanel"

export default function FourteenDayCheck() {
  const { data: fleet = [], isLoading: fleetLoading, refetch } = useFleetCheckSummaries()
  const { data: pending = [], isLoading: pendingLoading } = usePendingSubmissions()
  const invalidate = useInvalidateChecks()
  const [reviewSubmissionId, setReviewSubmissionId] = useState<string | null>(null)
  const [reviewRegistration, setReviewRegistration] = useState("")

  const ok       = fleet.filter(a => a.status === "ok").length
  const dueSoon  = fleet.filter(a => a.status === "due_soon").length
  const overdue  = fleet.filter(a => a.status === "overdue" || a.status === "never").length
  const flagged  = pending.filter(s => s.review_status === "flagged").length

  function openReview(submissionId: string, registration: string) {
    setReviewSubmissionId(submissionId)
    setReviewRegistration(registration)
  }

  function closeReview() {
    setReviewSubmissionId(null)
    setReviewRegistration("")
    invalidate()
  }

  const isLoading = fleetLoading || pendingLoading

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl tracking-wider"
            style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
          >
            14-Day Check
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Maintenance Control · Fleet inspection status
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.5)",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      {!isLoading && fleet.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryTile value={ok}       label="OK"        color="#4ade80" />
          <SummaryTile value={dueSoon}  label="Due Soon"  color="#d4a017" />
          <SummaryTile value={overdue}  label="Overdue"   color="#f87171" />
          <SummaryTile value={flagged}  label="Flagged"   color="#fb923c" />
        </div>
      )}

      {/* Pending review queue */}
      {pending.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[10px] font-bold tracking-[0.2em] uppercase"
              style={{ fontFamily: "var(--font-heading)", color: "rgba(212,160,23,0.7)" }}
            >
              Needs Review
            </span>
            <span
              className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold"
              style={{ background: "rgba(212,160,23,0.2)", color: "#d4a017" }}
            >
              {pending.length}
            </span>
          </div>
          <div
            className="rounded-lg overflow-hidden divide-y"
            style={{
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.08)",
              divideColor: "rgba(255,255,255,0.06)",
            }}
          >
            {pending.map(sub => (
              <PendingRow
                key={sub.id}
                submission={sub}
                onReview={() => openReview(sub.id, sub.registration)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fleet grid */}
      <section>
        <p
          className="text-[10px] font-bold tracking-[0.2em] uppercase mb-3"
          style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.3)" }}
        >
          Fleet Status
        </p>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-lg animate-pulse"
                style={{ height: "140px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              />
            ))}
          </div>
        )}

        {!isLoading && fleet.length === 0 && (
          <div
            className="rounded-lg p-10 flex flex-col items-center gap-3 text-center"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
          >
            <CalendarClock className="w-8 h-8" style={{ color: "rgba(212,160,23,0.4)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              No aircraft enrolled yet. Apply the database migration to seed CJ2 aircraft.
            </p>
          </div>
        )}

        {!isLoading && fleet.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {fleet.map(aircraft => (
              <AircraftCheckCard
                key={aircraft.tokenId}
                aircraft={aircraft}
                pendingSubmission={pending.find(s => s.aircraft_id === aircraft.aircraftId) ?? null}
                onReview={(subId) => openReview(subId, aircraft.registration)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Review panel */}
      {reviewSubmissionId && (
        <ReviewPanelLoader
          submissionId={reviewSubmissionId}
          registration={reviewRegistration}
          onClose={closeReview}
        />
      )}
    </div>
  )
}

// ─── Loads submission + field schema then opens review panel ─────────────────

function ReviewPanelLoader({
  submissionId,
  registration,
  onClose,
}: {
  submissionId: string
  registration: string
  onClose: () => void
}) {
  const { data: submission, isLoading: subLoading } = useCheckSubmission(submissionId)
  const [fieldSchema, setFieldSchema] = useState<import("@/entities/supabase").FieldDef[]>([])

  // Load token's field_schema once we have the submission's token_id
  useEffect(() => {
    if (!submission?.token_id) return
    import("@/lib/supabase").then(({ supabase }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(supabase as any)
        .from("fourteen_day_check_tokens")
        .select("field_schema")
        .eq("id", submission.token_id)
        .single()
        .then(({ data }: { data: { field_schema: import("@/entities/supabase").FieldDef[] } | null }) => {
          if (data?.field_schema) setFieldSchema(data.field_schema)
        })
    })
  }, [submission?.token_id])

  if (subLoading || !submission) {
    return (
      <>
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
        <div
          className="fixed inset-y-0 right-0 z-50 flex items-center justify-center"
          style={{ width: "min(640px, 100vw)", background: "#161616", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#d4a017", borderTopColor: "transparent" }} />
        </div>
      </>
    )
  }

  return (
    <SubmissionReviewPanel
      submission={submission}
      registration={registration}
      fieldSchema={fieldSchema}
      onClose={onClose}
    />
  )
}

// ─── Aircraft check card ──────────────────────────────────────────────────────

function AircraftCheckCard({
  aircraft,
  pendingSubmission,
  onReview,
}: {
  aircraft: AircraftCheckSummary
  pendingSubmission: PendingSubmission | null
  onReview: (submissionId: string) => void
}) {
  const statusConfig = {
    ok:       { label: "OK",        color: "#4ade80", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)"  },
    due_soon: { label: "Due Soon",  color: "#d4a017", bg: "rgba(212,160,23,0.08)", border: "rgba(212,160,23,0.25)" },
    overdue:  { label: "Overdue",   color: "#f87171", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)"  },
    never:    { label: "No Checks", color: "#f87171", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)"  },
  }
  const s = statusConfig[aircraft.status]
  const hasPending = !!pendingSubmission

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3 relative"
      style={{
        background: "#1a1a1a",
        border: `1px solid ${hasPending ? "rgba(212,160,23,0.35)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {/* Pending badge */}
      {hasPending && (
        <span
          className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ background: "rgba(212,160,23,0.2)", color: "#d4a017" }}
        >
          New
        </span>
      )}

      {/* Registration */}
      <div>
        <p
          className="text-base font-bold tracking-widest"
          style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
        >
          {aircraft.registration}
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
        >
          {s.label}
        </span>
        {aircraft.status === "never" || aircraft.daysSince === null ? null : (
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            {aircraft.daysSince}d ago
          </span>
        )}
      </div>

      {/* Days detail */}
      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
        {aircraft.lastSubmittedAt
          ? formatDistanceToNow(new Date(aircraft.lastSubmittedAt), { addSuffix: true })
          : "Never checked"}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        {pendingSubmission ? (
          <button
            type="button"
            onClick={() => onReview(pendingSubmission.id)}
            className="flex items-center gap-1 text-xs font-medium rounded px-2 py-1 transition-all"
            style={{
              background: "rgba(212,160,23,0.15)",
              border: "1px solid rgba(212,160,23,0.3)",
              color: "#d4a017",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.25)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.15)")}
          >
            Review <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>No pending checks</span>
        )}

        {aircraft.traxxallUrl && (
          <a
            href={aircraft.traxxallUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto p-1 rounded transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.3)" }}
            title="View in Traxxall"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Pending submissions row ──────────────────────────────────────────────────

function PendingRow({
  submission,
  onReview,
}: {
  submission: PendingSubmission
  onReview: () => void
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Clock className="w-4 h-4 flex-shrink-0" style={{ color: "#d4a017" }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold tracking-widest"
            style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
          >
            {submission.registration}
          </span>
          {submission.review_status === "flagged" && (
            <AlertTriangle className="w-3 h-3 text-orange-400" />
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          {submission.submitter_name} ·{" "}
          {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
        </p>
      </div>
      <button
        type="button"
        onClick={onReview}
        className="flex items-center gap-1 text-xs font-medium rounded px-3 py-1.5 flex-shrink-0 transition-all"
        style={{
          background: "rgba(212,160,23,0.12)",
          border: "1px solid rgba(212,160,23,0.25)",
          color: "#d4a017",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.12)")}
      >
        Review <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Summary tile ─────────────────────────────────────────────────────────────

function SummaryTile({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col gap-0.5"
      style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <span className="text-2xl font-bold" style={{ color, fontFamily: "var(--font-heading)" }}>
        {value}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
        {label}
      </span>
    </div>
  )
}
