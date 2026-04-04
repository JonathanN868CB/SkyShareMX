import { useParams, useNavigate, Link } from "react-router-dom"
import { ArrowLeft, ChevronRight, CheckCircle, Clock, XCircle, AlertTriangle, GraduationCap, Calendar, User } from "lucide-react"
import { TRAINING_RECORDS, MECHANICS, SOPS, type TrainingStatus } from "../../data/mockData"

const STATUS_CONFIG: Record<TrainingStatus, {
  label: string; color: string; bg: string; border: string; icon: typeof CheckCircle
}> = {
  current:       { label: "Current",       color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/40", icon: CheckCircle  },
  expiring_soon: { label: "Expiring Soon", color: "text-amber-400",   bg: "bg-amber-900/20",   border: "border-amber-700/40",   icon: Clock        },
  expired:       { label: "Expired",       color: "text-red-400",     bg: "bg-red-900/20",     border: "border-red-700/40",     icon: XCircle      },
  not_trained:   { label: "Not Trained",   color: "text-white/30",    bg: "bg-white/3",        border: "border-white/8",        icon: AlertTriangle },
}

export default function TrainingDetail() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const mechanic = MECHANICS.find(m => m.id === id)
  if (!mechanic) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-white/40">Mechanic not found</p>
    </div>
  )

  const records = TRAINING_RECORDS.filter(r => r.mechanicId === id)

  // Build full SOP coverage — include "not_trained" gaps
  const fullCoverage = SOPS.map(sop => {
    const rec = records.find(r => r.sopId === sop.id)
    return { sop, record: rec ?? null, status: (rec?.status ?? "not_trained") as TrainingStatus }
  })

  const counts = {
    current:       fullCoverage.filter(r => r.status === "current").length,
    expiring_soon: fullCoverage.filter(r => r.status === "expiring_soon").length,
    expired:       fullCoverage.filter(r => r.status === "expired").length,
    not_trained:   fullCoverage.filter(r => r.status === "not_trained").length,
  }

  const pctCompliant = Math.round((counts.current / SOPS.length) * 100)

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-white/35 text-xs" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
          <button onClick={() => navigate("/app/beet-box/training")} className="hover:text-white/70 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            Training
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/55">{mechanic.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.25)" }}>
            <GraduationCap className="w-7 h-7" style={{ color: "var(--skyshare-gold)" }} />
          </div>
          <div className="flex-1">
            <h1 className="text-white mb-0.5" style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "0.04em" }}>
              {mechanic.name}
            </h1>
            <div className="flex items-center gap-4 text-sm text-white/45">
              <span>{mechanic.role}</span>
              <span className="text-white/20">·</span>
              <span className="font-mono text-xs">{mechanic.certNumber}</span>
              <span className="text-white/20">·</span>
              <span>{mechanic.certificate}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/30 text-xs mb-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>COMPLIANCE</p>
            <p className="font-bold" style={{
              fontFamily: "var(--font-display)",
              fontSize: "32px",
              color: pctCompliant >= 90 ? "#34d399" : pctCompliant >= 70 ? "#fbbf24" : "#f87171"
            }}>
              {pctCompliant}%
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 mt-4 pt-4" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
          {[
            { label: "Current",       value: counts.current,       color: "text-emerald-400" },
            { label: "Expiring Soon", value: counts.expiring_soon, color: "text-amber-400"   },
            { label: "Expired",       value: counts.expired,       color: "text-red-400"     },
            { label: "Not Trained",   value: counts.not_trained,   color: "text-white/35"    },
            { label: "Total SOPs",    value: SOPS.length,          color: "text-white/55"    },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`text-lg font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</span>
              <span className="text-white/30 text-xs uppercase tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-4">
        {/* Alerts */}
        {counts.expired > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">
              {counts.expired} expired SOP training record{counts.expired > 1 ? "s" : ""} — schedule recurrent training immediately
            </p>
          </div>
        )}
        {counts.expiring_soon > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-800/40">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-300 text-sm">
              {counts.expiring_soon} SOP training record{counts.expiring_soon > 1 ? "s" : ""} expiring within 90 days
            </p>
          </div>
        )}

        {/* Training records table */}
        <div className="card-elevated rounded-lg overflow-hidden" style={{ border: "1px solid hsl(0 0% 16%)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 16%)" }}>
            <p className="text-white/55 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
              Training Records — All SOPs
            </p>
          </div>

          {/* Group by status */}
          {(["expired", "expiring_soon", "current", "not_trained"] as TrainingStatus[]).map(statusKey => {
            const group = fullCoverage.filter(r => r.status === statusKey)
            if (group.length === 0) return null
            const cfg = STATUS_CONFIG[statusKey]
            const StatusIcon = cfg.icon

            return (
              <div key={statusKey}>
                <div className="px-4 py-2 flex items-center gap-2" style={{ background: "hsl(0 0% 11%)", borderTop: "1px solid hsl(0 0% 14%)" }}>
                  <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  <p className={`text-[10px] uppercase tracking-widest ${cfg.color}`} style={{ fontFamily: "var(--font-heading)" }}>
                    {cfg.label} ({group.length})
                  </p>
                </div>
                {group.map(({ sop, record, status }) => (
                  <div key={sop.id} className="flex items-center gap-4 px-4 py-3 border-t"
                       style={{ borderColor: "hsl(0 0% 13%)" }}>
                    {/* SOP number + title */}
                    <div className="w-28 flex-shrink-0">
                      <p className="text-white/30 text-[10px] font-mono">{sop.sopNumber}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/app/beet-box/sop-library/${sop.id}`}
                        className="text-white/75 text-sm hover:text-white/95 transition-colors truncate block"
                      >
                        {sop.title}
                      </Link>
                    </div>

                    {/* Trained info */}
                    {record ? (
                      <>
                        <div className="flex items-center gap-1.5 text-white/30 text-xs flex-shrink-0">
                          <User className="w-3 h-3" />
                          <span>{record.trainedBy}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-white/30 text-xs flex-shrink-0">
                          <Calendar className="w-3 h-3" />
                          <span>Trained {record.trainedDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                          <Calendar className="w-3 h-3 text-white/25" />
                          <span className={status === "expired" ? "text-red-400" : status === "expiring_soon" ? "text-amber-400" : "text-white/30"}>
                            Exp {record.expiryDate}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-white/20 text-xs italic flex-shrink-0">No training record on file</p>
                    )}

                    {/* Status badge */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] flex-shrink-0 ${cfg.bg} ${cfg.border} border ${cfg.color}`}
                         style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </div>

                    {/* Notes */}
                    {record?.notes && (
                      <p className="text-white/30 text-xs italic max-w-[180px] truncate flex-shrink-0" title={record.notes}>
                        {record.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
