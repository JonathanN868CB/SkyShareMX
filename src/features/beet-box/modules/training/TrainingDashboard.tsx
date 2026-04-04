import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, CheckCircle, Clock, XCircle, ChevronRight, GraduationCap } from "lucide-react"
import { SOPS, TRAINING_RECORDS, MECHANICS, type TrainingStatus } from "../../data/mockData"

const STATUS_CONFIG: Record<TrainingStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  current:       { label: "Current",       color: "text-emerald-400", bg: "bg-emerald-900/30", border: "border-emerald-700/50", dot: "bg-emerald-400"  },
  expiring_soon: { label: "Expiring Soon", color: "text-amber-400",   bg: "bg-amber-900/30",   border: "border-amber-700/50",   dot: "bg-amber-400"    },
  expired:       { label: "Expired",       color: "text-red-400",     bg: "bg-red-900/30",     border: "border-red-700/50",     dot: "bg-red-400"      },
  not_trained:   { label: "Not Trained",   color: "text-white/25",    bg: "bg-white/3",        border: "border-white/8",        dot: "bg-white/20"     },
}

function CellStatus({ status }: { status: TrainingStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <div className={`w-full h-7 rounded flex items-center justify-center border ${cfg.bg} ${cfg.border}`}
         title={cfg.label}>
      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
    </div>
  )
}

export default function TrainingDashboard() {
  const navigate = useNavigate()
  const [hoveredMechanic, setHoveredMechanic] = useState<string | null>(null)

  // Build a lookup map: mechanicId → sopId → TrainingStatus
  const trainingMap = useMemo(() => {
    const map: Record<string, Record<string, TrainingStatus>> = {}
    TRAINING_RECORDS.forEach(r => {
      if (!map[r.mechanicId]) map[r.mechanicId] = {}
      map[r.mechanicId][r.sopId] = r.status
    })
    return map
  }, [])

  // Summary stats
  const stats = useMemo(() => {
    const counts = { current: 0, expiring_soon: 0, expired: 0, not_trained: 0 }
    MECHANICS.forEach(m => {
      SOPS.forEach(s => {
        const status = trainingMap[m.id]?.[s.id] ?? "not_trained"
        counts[status]++
      })
    })
    return counts
  }, [trainingMap])

  const totalCells   = MECHANICS.length * SOPS.length
  const pctCompliant = Math.round((stats.current / totalCells) * 100)

  // Per-mechanic summary
  const mechanicSummary = useMemo(() => {
    return MECHANICS.map(m => {
      const counts = { current: 0, expiring_soon: 0, expired: 0, not_trained: 0 }
      SOPS.forEach(s => {
        const status = trainingMap[m.id]?.[s.id] ?? "not_trained"
        counts[status]++
      })
      const hasIssue = counts.expired > 0
      const hasWarning = counts.expiring_soon > 0
      return { ...m, counts, hasIssue, hasWarning }
    })
  }, [trainingMap])

  const expiredMechanics = mechanicSummary.filter(m => m.hasIssue)

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              Training
            </h1>
            <p className="text-white/45 text-sm">{MECHANICS.length} mechanics · {SOPS.length} SOPs · {totalCells} training records tracked</p>
          </div>
          <div className="text-right">
            <p className="text-white/30 text-xs mb-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>OVERALL COMPLIANCE</p>
            <p className="font-bold" style={{
              fontFamily: "var(--font-display)",
              fontSize: "36px",
              color: pctCompliant >= 90 ? "#34d399" : pctCompliant >= 70 ? "#fbbf24" : "#f87171"
            }}>
              {pctCompliant}%
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4 mt-5">
          {[
            { label: "Current",       value: stats.current,       icon: CheckCircle,  color: "text-emerald-400" },
            { label: "Expiring Soon", value: stats.expiring_soon, icon: Clock,        color: "text-amber-400"   },
            { label: "Expired",       value: stats.expired,       icon: XCircle,      color: "text-red-400"     },
            { label: "Not Trained",   value: stats.not_trained,   icon: AlertTriangle, color: "text-white/35"   },
          ].map(s => (
            <div key={s.label} className="card-elevated rounded-lg p-4 flex items-center gap-4">
              <s.icon className={`w-7 h-7 flex-shrink-0 ${s.color} opacity-45`} />
              <div>
                <p className="text-white/35 text-[10px] uppercase tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-5">
        {/* Alert banner */}
        {expiredMechanics.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm font-medium mb-0.5">Expired training records require immediate attention</p>
              <p className="text-red-400/60 text-xs">
                {expiredMechanics.map(m => m.name).join(", ")} — schedule recurrent training to restore compliance
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-5">
          <p className="text-white/30 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Legend:</p>
          {(Object.entries(STATUS_CONFIG) as [TrainingStatus, typeof STATUS_CONFIG[TrainingStatus]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-xs ${cfg.color}`} style={{ fontFamily: "var(--font-heading)" }}>{cfg.label}</span>
            </div>
          ))}
        </div>

        {/* Matrix */}
        <div className="card-elevated rounded-lg overflow-hidden" style={{ border: "1px solid hsl(0 0% 16%)" }}>
          {/* Header row — SOP numbers */}
          <div className="flex" style={{ borderBottom: "1px solid hsl(0 0% 16%)" }}>
            {/* Mechanic label column */}
            <div className="w-44 flex-shrink-0 px-4 py-2.5 flex items-end">
              <p className="text-white/30 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Mechanic</p>
            </div>
            {/* SOP columns */}
            {SOPS.map(sop => (
              <div key={sop.id} className="flex-1 min-w-0 px-1 py-2 text-center" style={{ minWidth: "52px" }}>
                <p className="text-white/35 text-[9px] font-mono truncate" title={sop.title}>
                  {sop.sopNumber.replace("SOP-BB-", "")}
                </p>
              </div>
            ))}
            {/* Summary column */}
            <div className="w-28 flex-shrink-0 px-3 py-2.5 flex items-end justify-center">
              <p className="text-white/30 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Summary</p>
            </div>
          </div>

          {/* Mechanic rows */}
          {mechanicSummary.map(mech => (
            <div
              key={mech.id}
              className={`flex cursor-pointer transition-colors ${hoveredMechanic === mech.id ? "bg-white/4" : ""}`}
              style={{ borderBottom: "1px solid hsl(0 0% 13%)" }}
              onMouseEnter={() => setHoveredMechanic(mech.id)}
              onMouseLeave={() => setHoveredMechanic(null)}
              onClick={() => navigate(`/app/beet-box/training/${mech.id}`)}
            >
              {/* Mechanic info */}
              <div className="w-44 flex-shrink-0 px-4 py-3 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mech.hasIssue ? "bg-red-400" : mech.hasWarning ? "bg-amber-400" : "bg-emerald-400"}`} />
                <div className="min-w-0">
                  <p className="text-white/80 text-xs font-medium truncate">{mech.name}</p>
                  <p className="text-white/30 text-[10px] truncate">{mech.role}</p>
                </div>
              </div>

              {/* Status cells */}
              {SOPS.map(sop => {
                const status = trainingMap[mech.id]?.[sop.id] ?? "not_trained"
                return (
                  <div key={sop.id} className="flex-1 min-w-0 px-1 py-2" style={{ minWidth: "52px" }}>
                    <CellStatus status={status} />
                  </div>
                )
              })}

              {/* Summary column */}
              <div className="w-28 flex-shrink-0 px-3 py-3 flex items-center justify-center gap-2">
                {mech.counts.expired > 0 && (
                  <span className="text-[10px] text-red-400 font-mono">{mech.counts.expired}✗</span>
                )}
                {mech.counts.expiring_soon > 0 && (
                  <span className="text-[10px] text-amber-400 font-mono">{mech.counts.expiring_soon}!</span>
                )}
                <span className="text-[10px] text-emerald-400 font-mono">{mech.counts.current}✓</span>
                <ChevronRight className="w-3 h-3 text-white/20 ml-1" />
              </div>
            </div>
          ))}
        </div>

        {/* SOP legend strip */}
        <div className="card-elevated rounded-lg p-4" style={{ border: "1px solid hsl(0 0% 16%)" }}>
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3" style={{ fontFamily: "var(--font-heading)" }}>SOP Reference</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            {SOPS.map(sop => (
              <button
                key={sop.id}
                onClick={() => navigate(`/app/beet-box/sop-library/${sop.id}`)}
                className="flex items-center gap-2 text-left group"
              >
                <span className="text-white/25 text-[10px] font-mono w-14 flex-shrink-0">{sop.sopNumber.replace("SOP-BB-", "SOP ")}</span>
                <span className="text-white/50 text-xs truncate group-hover:text-white/75 transition-colors">{sop.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
