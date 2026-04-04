// 14-Day Check — MC Dashboard
// Fleet status grid + pending submissions review queue.

import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import {
  CalendarClock, ExternalLink, Clock, AlertTriangle,
  ChevronRight, RefreshCw, QrCode, History, Plus, Mail,
  Plane,
} from "lucide-react"
import {
  useFleetCheckSummaries,
  usePendingSubmissions,
  useInvalidateChecks,
  useCheckSubmission,
  type AircraftCheckSummary,
  type PendingSubmission,
} from "@/hooks/useFourteenDayChecks"
import { useAuth } from "@/features/auth"
import { SubmissionReviewPanel } from "@/features/fourteen-day-check/SubmissionReviewPanel"
import { AircraftCheckQR } from "@/features/fourteen-day-check/AircraftCheckQR"
import { CheckHistoryDrawer } from "@/features/fourteen-day-check/CheckHistoryDrawer"
import { AddAircraftModal } from "@/features/fourteen-day-check/AddAircraftModal"
import { SendCheckEmailModal } from "@/features/fourteen-day-check/SendCheckEmailModal"

export default function FourteenDayCheck() {
  const { data: fleet = [], isLoading: fleetLoading, refetch } = useFleetCheckSummaries()
  const { data: pending = [], isLoading: pendingLoading } = usePendingSubmissions()
  const invalidate = useInvalidateChecks()
  const { profile } = useAuth()
  const isAdmin = profile?.role === "Super Admin" || profile?.role === "Admin"

  const [reviewSubmissionId, setReviewSubmissionId] = useState<string | null>(null)
  const [reviewRegistration, setReviewRegistration] = useState("")
  const [qrAircraft, setQrAircraft]         = useState<AircraftCheckSummary | null>(null)
  const [historyAircraft, setHistoryAircraft] = useState<AircraftCheckSummary | null>(null)
  const [emailAircraft, setEmailAircraft]   = useState<AircraftCheckSummary | null>(null)
  const [showAddModal, setShowAddModal]     = useState(false)

  const ok      = fleet.filter(a => a.status === "ok").length
  const dueSoon = fleet.filter(a => a.status === "due_soon").length
  const overdue = fleet.filter(a => a.status === "overdue" || a.status === "never").length
  const flagged = pending.filter(s => s.review_status === "flagged").length

  function openReview(submissionId: string, registration: string) {
    setReviewSubmissionId(submissionId)
    setReviewRegistration(registration)
  }

  function closeReview() {
    setReviewSubmissionId(null)
    setReviewRegistration("")
    invalidate()
  }

  const enrolledAircraftIds = new Set(fleet.map(a => a.aircraftId))
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
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: "rgba(212,160,23,0.12)",
                border: "1px solid rgba(212,160,23,0.3)",
                color: "#d4a017",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.12)")}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Aircraft
            </button>
          )}
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
      </div>

      {/* Summary bar */}
      {!isLoading && fleet.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryTile value={ok}      label="OK"        color="#4ade80" />
          <SummaryTile value={dueSoon} label="Due Soon"  color="#d4a017" />
          <SummaryTile value={overdue} label="Overdue"   color="#f87171" />
          <SummaryTile value={flagged} label="Flagged"   color="#fb923c" />
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

      {/* Keyframes for dispatch button */}
      <style>{`
        @keyframes fdcheck-ping {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0;   }
        }
        @keyframes fdcheck-signal {
          0%, 100% { opacity: 0.3; transform: scaleY(0.6); }
          50%       { opacity: 1;   transform: scaleY(1);   }
        }
      `}</style>

      {/* Fleet grid */}
      <section>
        <p
          className="text-[10px] font-bold tracking-[0.2em] uppercase mb-3"
          style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.3)" }}
        >
          Fleet Status
        </p>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-lg animate-pulse"
                style={{ height: "200px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
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
              No aircraft enrolled yet.
            </p>
          </div>
        )}

        {!isLoading && fleet.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fleet.map(aircraft => (
              <AircraftCheckCard
                key={aircraft.tokenId}
                aircraft={aircraft}
                pendingSubmission={pending.find(s => s.aircraft_id === aircraft.aircraftId) ?? null}
                onReview={(subId) => openReview(subId, aircraft.registration)}
                onQR={() => setQrAircraft(aircraft)}
                onHistory={() => setHistoryAircraft(aircraft)}
                onEmail={() => setEmailAircraft(aircraft)}
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

      {/* QR code modal */}
      {qrAircraft && (
        <AircraftCheckQR
          registration={qrAircraft.registration}
          encodedToken={qrAircraft.encodedToken}
          onClose={() => setQrAircraft(null)}
        />
      )}

      {/* History drawer */}
      {historyAircraft && (
        <CheckHistoryDrawer
          tokenId={historyAircraft.tokenId}
          registration={historyAircraft.registration}
          onClose={() => setHistoryAircraft(null)}
          onReview={(subId) => {
            setHistoryAircraft(null)
            openReview(subId, historyAircraft.registration)
          }}
        />
      )}

      {/* Send email modal */}
      {emailAircraft && (
        <SendCheckEmailModal
          registration={emailAircraft.registration}
          encodedToken={emailAircraft.encodedToken}
          onClose={() => setEmailAircraft(null)}
        />
      )}

      {/* Add aircraft modal */}
      {showAddModal && (
        <AddAircraftModal
          enrolledAircraftIds={enrolledAircraftIds}
          onClose={() => setShowAddModal(false)}
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
  onQR,
  onHistory,
  onEmail,
}: {
  aircraft: AircraftCheckSummary
  pendingSubmission: PendingSubmission | null
  onReview: (submissionId: string) => void
  onQR: () => void
  onHistory: () => void
  onEmail: () => void
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
      className="rounded-lg flex flex-col relative"
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

      {/* Top section */}
      <div className="p-4 flex flex-col gap-2.5">
        {/* Registration + model */}
        <div>
          <Link
            to="/app/aircraft"
            className="flex items-center gap-1.5 group w-fit"
            title="View in Aircraft Info"
          >
            <p
              className="text-lg font-bold tracking-widest group-hover:underline"
              style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
            >
              {aircraft.registration}
            </p>
            <Plane
              className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity"
              style={{ color: "#d4a017" }}
            />
          </Link>
          {aircraft.model && (
            <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>
              {aircraft.model}
            </p>
          )}
        </div>

        {/* Status + days */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
          >
            {s.label}
          </span>
          {aircraft.daysSince !== null && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {aircraft.daysSince}d ago
            </span>
          )}
        </div>

        {/* Last check detail */}
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          {aircraft.lastSubmittedAt
            ? formatDistanceToNow(new Date(aircraft.lastSubmittedAt), { addSuffix: true })
            : "Never checked"}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />

      {/* Action row */}
      <div className="p-3 flex flex-col gap-2">
        {/* Primary action — review if pending */}
        {pendingSubmission && (
          <button
            type="button"
            onClick={() => onReview(pendingSubmission.id)}
            className="flex items-center justify-center gap-1.5 w-full text-xs font-medium rounded-md px-3 py-2 transition-all"
            style={{
              background: "rgba(212,160,23,0.15)",
              border: "1px solid rgba(212,160,23,0.3)",
              color: "#d4a017",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.25)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.15)")}
          >
            Review Submission <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Secondary actions row */}
        <div className="flex items-center gap-2">
          {/* History — full labeled button */}
          <button
            type="button"
            onClick={onHistory}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)"
              e.currentTarget.style.color = "rgba(255,255,255,0.8)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)"
              e.currentTarget.style.color = "rgba(255,255,255,0.5)"
            }}
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>

          {/* QR */}
          <button
            type="button"
            onClick={onQR}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}
            title="QR code"
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>

          {/* Traxxall */}
          {aircraft.traxxallUrl && (
            <a
              href={aircraft.traxxallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.07)" }}
              title="View in Traxxall"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Dispatch button */}
        <DispatchButton onClick={onEmail} />
      </div>
    </div>
  )
}

// ─── Dispatch button ─────────────────────────────────────────────────────────
// Full-width styled send button with brand gradient, shimmer, and radar ping.

function DispatchButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "9px 12px",
        borderRadius: "6px",
        // 3px gold left accent, rest is a thin border
        borderLeft: "3px solid rgba(212,160,23,0.75)",
        borderTop: `1px solid ${hovered ? "rgba(212,160,23,0.4)" : "rgba(212,160,23,0.15)"}`,
        borderRight: `1px solid ${hovered ? "rgba(212,160,23,0.4)" : "rgba(212,160,23,0.15)"}`,
        borderBottom: `1px solid ${hovered ? "rgba(212,160,23,0.4)" : "rgba(212,160,23,0.15)"}`,
        // Brand gradient: SkyShare red → navy at very low opacity
        background: hovered
          ? "linear-gradient(105deg, rgba(193,2,48,0.14) 0%, rgba(1,46,69,0.22) 100%)"
          : "linear-gradient(105deg, rgba(193,2,48,0.06) 0%, rgba(1,46,69,0.12) 100%)",
        cursor: "pointer",
        transition: "border-color 0.2s ease, background 0.25s ease, box-shadow 0.2s ease",
        boxShadow: hovered ? "0 2px 18px rgba(193,2,48,0.1), 0 0 0 1px rgba(212,160,23,0.08)" : "none",
      }}
    >
      {/* Shimmer beam — sweeps left-to-right on hover */}
      <span
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "60%",
          background: "linear-gradient(90deg, transparent, rgba(212,160,23,0.1), transparent)",
          transform: hovered ? "translateX(250%)" : "translateX(-100%)",
          transition: hovered ? "transform 0.55s ease" : "none",
          pointerEvents: "none",
          skewX: "-12deg",
        }}
      />

      {/* Mail icon with radar ping ring */}
      <span style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {hovered && (
          <span
            style={{
              position: "absolute",
              inset: "-5px",
              borderRadius: "50%",
              border: "1px solid rgba(212,160,23,0.55)",
              animation: "fdcheck-ping 0.9s ease-out infinite",
              pointerEvents: "none",
            }}
          />
        )}
        <Mail
          style={{
            width: "13px",
            height: "13px",
            color: hovered ? "#d4a017" : "rgba(212,160,23,0.55)",
            transition: "color 0.2s ease",
            display: "block",
          }}
        />
      </span>

      {/* Label */}
      <span
        style={{
          flex: 1,
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: hovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
          transition: "color 0.2s ease",
          textAlign: "left",
          fontFamily: "var(--font-heading, inherit)",
        }}
      >
        Dispatch Check Link
      </span>

      {/* Signal bars — animated on hover */}
      <span style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "12px", flexShrink: 0 }}>
        {[4, 7, 10].map((h, i) => (
          <span
            key={i}
            style={{
              width: "2.5px",
              height: `${h}px`,
              borderRadius: "1px",
              background: hovered ? "#d4a017" : "rgba(255,255,255,0.15)",
              transition: `background 0.2s ease ${i * 0.06}s`,
              animation: hovered ? `fdcheck-signal 0.8s ease-in-out ${i * 0.15}s infinite` : "none",
            }}
          />
        ))}
      </span>
    </button>
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
