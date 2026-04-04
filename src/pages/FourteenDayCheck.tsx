// 14-Day Check — MC Dashboard
// Fleet status grid + pending submissions review queue.

import { useState } from "react"
import { Link } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import {
  CalendarClock, ExternalLink, Clock, AlertTriangle,
  ChevronRight, ChevronDown, RefreshCw, QrCode, History, Plus, Mail,
  Plane, X, LayoutGrid, LayoutList,
} from "lucide-react"
import {
  useFleetCheckSummaries,
  usePendingSubmissions,
  useCheckSubmission,
  useTokenFieldSchema,
  useInvalidateChecks,
  deleteDispatch,
  type AircraftCheckSummary,
  type PendingSubmission,
} from "@/hooks/useFourteenDayChecks"
import { FLEET } from "@/pages/aircraft/fleetData"
import { useAuth } from "@/features/auth"
import { SubmissionReviewPanel } from "@/features/fourteen-day-check/SubmissionReviewPanel"
import { AircraftCheckQR } from "@/features/fourteen-day-check/AircraftCheckQR"
import { CheckHistoryDrawer } from "@/features/fourteen-day-check/CheckHistoryDrawer"
import { AddAircraftModal } from "@/features/fourteen-day-check/AddAircraftModal"
import { SendCheckEmailModal } from "@/features/fourteen-day-check/SendCheckEmailModal"

export default function FourteenDayCheck() {
  const { data: fleet = [], isLoading: fleetLoading, refetch } = useFleetCheckSummaries()
  const { data: pending = [], isLoading: pendingLoading } = usePendingSubmissions()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === "Super Admin"
  const isManagerOrAbove = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"
  const invalidate = useInvalidateChecks()

  async function handleClearDispatch(dispatchId: string) {
    await deleteDispatch(dispatchId)
    invalidate()
  }

  const [reviewSubmissionId, setReviewSubmissionId] = useState<string | null>(null)
  const [reviewRegistration, setReviewRegistration] = useState("")
  const [qrAircraft, setQrAircraft]         = useState<AircraftCheckSummary | null>(null)
  const [historyAircraft, setHistoryAircraft] = useState<AircraftCheckSummary | null>(null)
  const [emailAircraft, setEmailAircraft]   = useState<AircraftCheckSummary | null>(null)
  const [showAddModal, setShowAddModal]     = useState(false)

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("fdcheck_view") as "grid" | "list") ?? "grid"
  })
  function setView(mode: "grid" | "list") {
    setViewMode(mode)
    localStorage.setItem("fdcheck_view", mode)
  }

  const [collapsedMfrs, setCollapsedMfrs] = useState<Set<string>>(new Set())
  function toggleMfr(name: string) {
    setCollapsedMfrs(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const ok      = fleet.filter(a => a.status === "ok").length
  const dueSoon = fleet.filter(a => a.status === "due_soon").length
  const overdue = fleet.filter(a => a.status === "overdue" || a.status === "never").length
  const flagged = fleet.filter(a => a.hasFlaggedSubmission).length

  function openReview(submissionId: string, registration: string) {
    setReviewSubmissionId(submissionId)
    setReviewRegistration(registration)
  }

  function closeReview() {
    setReviewSubmissionId(null)
    setReviewRegistration("")
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
          {isSuperAdmin && (
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
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.3)" }}
          >
            Fleet Status
          </p>
          {!isLoading && fleet.length > 0 && (
            <div
              className="flex items-center overflow-hidden rounded-lg"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <button
                type="button"
                onClick={() => setView("grid")}
                title="Grid view"
                className="px-2.5 py-2 transition-colors"
                style={{
                  background: viewMode === "grid" ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.04)",
                  color:      viewMode === "grid" ? "#d4a017"               : "rgba(255,255,255,0.35)",
                  borderRight: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                title="List view"
                className="px-2.5 py-2 transition-colors"
                style={{
                  background: viewMode === "list" ? "rgba(212,160,23,0.15)" : "rgba(255,255,255,0.04)",
                  color:      viewMode === "list" ? "#d4a017"               : "rgba(255,255,255,0.35)",
                }}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

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

        {!isLoading && fleet.length > 0 && (() => {
          const grouped = groupFleet(fleet)
          const sharedProps = {
            pending,
            canDispatch: isManagerOrAbove,
            onQR: setQrAircraft,
            onHistory: setHistoryAircraft,
            onEmail: setEmailAircraft,
            onClearDispatch: handleClearDispatch,
          }
          return viewMode === "grid" ? (
            <div className="space-y-6">
              {grouped.map(mfr => {
                const collapsed = collapsedMfrs.has(mfr.manufacturer)
                const stats = getMfrStats(mfr.families)
                return (
                  <div key={mfr.manufacturer}>
                    <button
                      type="button"
                      onClick={() => toggleMfr(mfr.manufacturer)}
                      className="w-full flex items-center gap-3 group mb-4"
                      style={{
                        borderBottom: "1px solid rgba(212,160,23,0.12)",
                        paddingBottom: "6px",
                      }}
                    >
                      <span
                        className="text-[10px] font-bold tracking-[0.2em] uppercase"
                        style={{ fontFamily: "var(--font-heading)", color: "rgba(212,160,23,0.55)" }}
                      >
                        {mfr.manufacturer}
                      </span>
                      <MfrStats stats={stats} dim={!collapsed} />
                      <ChevronDown
                        className="w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ml-auto"
                        style={{
                          color: "rgba(212,160,23,0.4)",
                          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        }}
                      />
                    </button>
                    {!collapsed && (
                      <div className="space-y-5">
                        {mfr.families.map(fam => (
                          <div key={fam.family}>
                            <p
                              className="text-[9px] font-bold tracking-[0.18em] uppercase mb-3"
                              style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.22)" }}
                            >
                              {fam.family}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {fam.aircraft.map(aircraft => (
                                <AircraftCheckCard
                                  key={aircraft.tokenId}
                                  aircraft={aircraft}
                                  pendingSubmission={pending.find(s => s.aircraft_id === aircraft.aircraftId) ?? null}
                                  canDispatch={isManagerOrAbove}
                                  onQR={() => setQrAircraft(aircraft)}
                                  onHistory={() => setHistoryAircraft(aircraft)}
                                  onEmail={() => setEmailAircraft(aircraft)}
                                  onClearDispatch={handleClearDispatch}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <FleetListView grouped={grouped} collapsedMfrs={collapsedMfrs} toggleMfr={toggleMfr} {...sharedProps} />
          )
        })()}
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
  const { data: fieldSchema = [], isLoading: schemaLoading } = useTokenFieldSchema(submission?.token_id)

  if (subLoading || schemaLoading || !submission) {
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

// ─── Fleet grouping helper ────────────────────────────────────────────────────

// ─── Manufacturer header stats strip ─────────────────────────────────────────
// Shown inline in collapsed (and expanded) manufacturer headers.

type MfrStatsData = ReturnType<typeof getMfrStats>

function MfrStats({ stats, dim }: { stats: MfrStatsData; dim: boolean }) {
  const opacity = dim ? 0.45 : 1
  return (
    <div className="flex items-center gap-2" style={{ opacity, transition: "opacity 0.15s ease" }}>
      {/* Aircraft count */}
      <span
        className="text-[9px] tabular-nums"
        style={{ color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums" }}
      >
        {stats.total} ac
      </span>
      {/* Separator */}
      <span style={{ width: "1px", height: "10px", background: "rgba(255,255,255,0.1)", display: "inline-block" }} />
      {/* Status dots */}
      {stats.ok > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4ade80" }} />
          <span className="text-[9px] tabular-nums" style={{ color: "#4ade80" }}>{stats.ok}</span>
        </span>
      )}
      {stats.dueSoon > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#d4a017" }} />
          <span className="text-[9px] tabular-nums" style={{ color: "#d4a017" }}>{stats.dueSoon}</span>
        </span>
      )}
      {stats.overdue > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#f87171" }} />
          <span className="text-[9px] tabular-nums" style={{ color: "#f87171" }}>{stats.overdue}</span>
        </span>
      )}
      {/* Pending badge */}
      {stats.pending > 0 && (
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: "rgba(212,160,23,0.18)", color: "#d4a017" }}
        >
          {stats.pending} new
        </span>
      )}
      {/* Flagged badge */}
      {stats.flagged > 0 && (
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}
        >
          {stats.flagged} flagged
        </span>
      )}
    </div>
  )
}

function getMfrStats(families: Array<{ aircraft: AircraftCheckSummary[] }>) {
  const all = families.flatMap(f => f.aircraft)
  return {
    total:   all.length,
    ok:      all.filter(a => a.status === "ok").length,
    dueSoon: all.filter(a => a.status === "due_soon").length,
    overdue: all.filter(a => a.status === "overdue" || a.status === "never").length,
    pending: all.filter(a => a.hasPendingSubmission).length,
    flagged: all.filter(a => a.hasFlaggedSubmission).length,
  }
}

function groupFleet(fleet: AircraftCheckSummary[]) {
  const byReg = new Map(fleet.map(a => [a.registration, a]))
  return FLEET
    .map(mfr => ({
      manufacturer: mfr.manufacturer,
      families: mfr.families
        .map(fam => ({
          family: fam.family,
          aircraft: fam.aircraft.map(ac => byReg.get(ac.tailNumber)).filter(Boolean) as AircraftCheckSummary[],
        }))
        .filter(fam => fam.aircraft.length > 0),
    }))
    .filter(mfr => mfr.families.length > 0)
}

// ─── Fleet list view ──────────────────────────────────────────────────────────

type FleetViewProps = {
  pending: PendingSubmission[]
  canDispatch: boolean
  onQR: (a: AircraftCheckSummary) => void
  onHistory: (a: AircraftCheckSummary) => void
  onEmail: (a: AircraftCheckSummary) => void
  onClearDispatch: (id: string) => void
}

function FleetListView({
  grouped,
  collapsedMfrs,
  toggleMfr,
  pending,
  canDispatch,
  onQR,
  onHistory,
  onEmail,
  onClearDispatch,
}: { grouped: ReturnType<typeof groupFleet>; collapsedMfrs: Set<string>; toggleMfr: (name: string) => void } & FleetViewProps) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {grouped.map((mfr, mfrIdx) => {
        const collapsed = collapsedMfrs.has(mfr.manufacturer)
        const stats = getMfrStats(mfr.families)
        return (
          <div key={mfr.manufacturer}>
            {/* Manufacturer header row — clickable */}
            <button
              type="button"
              onClick={() => toggleMfr(mfr.manufacturer)}
              className="w-full flex items-center gap-3 px-4 py-2.5 group transition-colors"
              style={{
                background: collapsed ? "rgba(212,160,23,0.03)" : "rgba(212,160,23,0.05)",
                borderTop: mfrIdx > 0 ? "1px solid rgba(212,160,23,0.15)" : undefined,
                borderBottom: collapsed ? undefined : "1px solid rgba(212,160,23,0.12)",
              }}
            >
              <p
                className="text-[9px] font-bold tracking-[0.22em] uppercase"
                style={{ fontFamily: "var(--font-heading)", color: "rgba(212,160,23,0.6)" }}
              >
                {mfr.manufacturer}
              </p>
              <MfrStats stats={stats} dim={!collapsed} />
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ml-auto"
                style={{
                  color: "rgba(212,160,23,0.4)",
                  transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {!collapsed && mfr.families.map((fam, famIdx) => (
              <div key={fam.family}>
                {/* Family row */}
                <div
                  className="px-4 py-1.5"
                  style={{
                    borderTop: famIdx > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: "rgba(255,255,255,0.015)",
                  }}
                >
                  <p
                    className="text-[8px] font-bold tracking-[0.2em] uppercase"
                    style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.2)" }}
                  >
                    {fam.family}
                  </p>
                </div>

                {/* Aircraft rows */}
                {fam.aircraft.map((aircraft, idx) => (
                  <div
                    key={aircraft.tokenId}
                    style={{ borderTop: idx === 0 ? undefined : "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <AircraftCheckRow
                      aircraft={aircraft}
                      pendingSubmission={pending.find(s => s.aircraft_id === aircraft.aircraftId) ?? null}
                      canDispatch={canDispatch}
                      onQR={() => onQR(aircraft)}
                      onHistory={() => onHistory(aircraft)}
                      onEmail={() => onEmail(aircraft)}
                      onClearDispatch={onClearDispatch}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Aircraft check row (list view) ──────────────────────────────────────────

function AircraftCheckRow({
  aircraft,
  pendingSubmission,
  canDispatch,
  onQR,
  onHistory,
  onEmail,
  onClearDispatch,
}: {
  aircraft: AircraftCheckSummary
  pendingSubmission: PendingSubmission | null
  canDispatch: boolean
  onQR: () => void
  onHistory: () => void
  onEmail: () => void
  onClearDispatch: (dispatchId: string) => void
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
      className="flex items-center min-h-[54px] gap-3 pr-3 transition-colors"
      style={{
        borderLeft: `3px solid ${s.color}`,
        paddingLeft: "14px",
        background: hasPending ? "rgba(212,160,23,0.025)" : "transparent",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
      onMouseLeave={e => (e.currentTarget.style.background = hasPending ? "rgba(212,160,23,0.025)" : "transparent")}
    >
      {/* Registration + model */}
      <div className="w-28 flex-shrink-0">
        <Link
          to="/app/aircraft"
          className="group flex items-center gap-1 w-fit"
          title="View in Aircraft Info"
        >
          <p
            className="text-sm font-bold tracking-widest leading-none group-hover:underline"
            style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
          >
            {aircraft.registration}
          </p>
          <Plane
            className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity"
            style={{ color: "#d4a017" }}
          />
        </Link>
        {aircraft.model && (
          <p className="text-[10px] mt-0.5 leading-tight truncate" style={{ color: "rgba(255,255,255,0.25)" }}>
            {aircraft.model}
          </p>
        )}
      </div>

      {/* Status badge + days */}
      <div className="flex items-center gap-2 w-32 flex-shrink-0">
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
        >
          {s.label}
        </span>
        {aircraft.daysSince !== null && (
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            {aircraft.daysSince}d
          </span>
        )}
      </div>

      {/* Last check */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.25)" }}>
          {aircraft.lastSubmittedAt
            ? formatDistanceToNow(new Date(aircraft.lastSubmittedAt), { addSuffix: true })
            : "Never checked"}
        </p>
      </div>

      {/* Right: inline badges + action icons */}
      <div className="flex items-center gap-1 flex-shrink-0">

        {/* New badge */}
        {hasPending && (
          <span
            className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mr-1"
            style={{ background: "rgba(212,160,23,0.2)", color: "#d4a017" }}
          >
            New
          </span>
        )}

        {/* Dispatch badge */}
        {aircraft.lastDispatch && (
          <div
            className="group flex items-center gap-1 rounded px-1.5 py-0.5 mr-1"
            style={{ background: "rgba(212,160,23,0.1)", border: "1px solid rgba(212,160,23,0.25)" }}
          >
            <Mail className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "rgba(212,160,23,0.7)" }} />
            <span
              className="text-[9px] font-medium max-w-[56px] truncate"
              style={{ color: "rgba(212,160,23,0.85)" }}
            >
              {aircraft.lastDispatch.sentToName.split(" ")[0]}
            </span>
            {canDispatch && (
              <button
                type="button"
                onClick={() => onClearDispatch(aircraft.lastDispatch!.id)}
                title="Clear dispatch notification"
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "rgba(212,160,23,0.5)" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(212,160,23,0.9)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(212,160,23,0.5)")}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}

        {/* Separator */}
        <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.07)", margin: "0 3px" }} />

        {/* History */}
        <button
          type="button"
          onClick={onHistory}
          title="History"
          className="p-2 rounded transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          <History className="w-4 h-4" />
        </button>

        {/* QR */}
        <button
          type="button"
          onClick={onQR}
          title="QR code"
          className="p-2 rounded transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >
          <QrCode className="w-4 h-4" />
        </button>

        {/* Traxxall */}
        {aircraft.traxxallUrl && (
          <a
            href={aircraft.traxxallUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View in Traxxall"
            className="p-2 rounded transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}

        {/* Dispatch — compact icon button */}
        {canDispatch && (
          <>
            <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.07)", margin: "0 3px" }} />
            <button
              type="button"
              onClick={onEmail}
              title="Dispatch check link"
              className="p-2 rounded transition-all"
              style={{
                color: "rgba(212,160,23,0.55)",
                border: "1px solid rgba(212,160,23,0.2)",
                background: "rgba(212,160,23,0.04)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = "#d4a017"
                e.currentTarget.style.background = "rgba(212,160,23,0.12)"
                e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = "rgba(212,160,23,0.55)"
                e.currentTarget.style.background = "rgba(212,160,23,0.04)"
                e.currentTarget.style.borderColor = "rgba(212,160,23,0.2)"
              }}
            >
              <Mail className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Aircraft check card ──────────────────────────────────────────────────────

function AircraftCheckCard({
  aircraft,
  pendingSubmission,
  canDispatch,
  onQR,
  onHistory,
  onEmail,
  onClearDispatch,
}: {
  aircraft: AircraftCheckSummary
  pendingSubmission: PendingSubmission | null
  canDispatch: boolean
  onQR: () => void
  onHistory: () => void
  onEmail: () => void
  onClearDispatch: (dispatchId: string) => void
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
      {/* Corner badges — New + dispatch stacked top-right */}
      {(hasPending || aircraft.lastDispatch) && (
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 z-10">
          {hasPending && (
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ background: "rgba(212,160,23,0.2)", color: "#d4a017" }}
            >
              New
            </span>
          )}
          {aircraft.lastDispatch && (
            <div
              className="group flex items-center gap-1 rounded px-1.5 py-0.5"
              style={{
                background: "rgba(212,160,23,0.1)",
                border: "1px solid rgba(212,160,23,0.25)",
              }}
            >
              <Mail className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "rgba(212,160,23,0.7)" }} />
              <span
                className="text-[9px] font-medium max-w-[72px] truncate"
                style={{ color: "rgba(212,160,23,0.85)" }}
              >
                {aircraft.lastDispatch.sentToName.split(" ")[0]}
              </span>
              {canDispatch && (
                <button
                  type="button"
                  onClick={() => onClearDispatch(aircraft.lastDispatch!.id)}
                  title="Clear dispatch notification"
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "rgba(212,160,23,0.5)", marginLeft: "1px" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(212,160,23,0.9)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(212,160,23,0.5)")}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}
        </div>
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
        {/* Actions row */}
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

        {/* Dispatch button — Manager+ only */}
        {canDispatch && <DispatchButton onClick={onEmail} />}
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
