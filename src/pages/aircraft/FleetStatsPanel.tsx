import { useState } from "react"
import { ChevronDown, ChevronUp, Activity, Shield, Wrench, Clock, TrendingUp, Plane } from "lucide-react"
import type { FleetStats } from "./useFleetStats"

// ─── Stat Cell ───────────────────────────────────────────────────────────────
function StatCell({
  icon: Icon,
  value,
  unit,
  label,
  detail,
  color,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  value: string
  unit?: string
  label: string
  detail?: string
  color: string
  children?: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-lg px-4 py-3.5"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" style={{ color, opacity: 0.7 }} />
        <span
          className="text-[9px] font-semibold uppercase tracking-widest"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
        >
          {label}
        </span>
      </div>
      {children ?? (
        <div>
          <div className="flex items-baseline gap-1">
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.6rem",
                letterSpacing: "0.04em",
                color,
                lineHeight: 1,
              }}
            >
              {value}
            </span>
            {unit && (
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color, opacity: 0.6, fontFamily: "var(--font-heading)" }}
              >
                {unit}
              </span>
            )}
          </div>
          {detail && (
            <p
              className="text-[10px] mt-1.5 leading-snug"
              style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}
            >
              {detail}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Trend Bars ──────────────────────────────────────────────────────────────
function TrendBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-2 mt-1" style={{ height: 48 }}>
      {data.map((d, i) => {
        const pct = (d.count / max) * 100
        const isLatest = i === data.length - 1
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <span
              className="text-[10px] font-medium"
              style={{
                fontFamily: "var(--font-display)",
                letterSpacing: "0.03em",
                color: isLatest ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                opacity: isLatest ? 1 : 0.7,
              }}
            >
              {d.count}
            </span>
            <div
              className="w-full rounded-sm transition-all"
              style={{
                height: `${Math.max(pct * 0.32, 2)}px`,
                background: isLatest
                  ? "var(--skyshare-gold)"
                  : "rgba(255,255,255,0.12)",
                minHeight: 2,
              }}
            />
            <span
              className="text-[8px] uppercase tracking-wider"
              style={{
                color: "hsl(var(--muted-foreground))",
                opacity: 0.5,
                fontFamily: "var(--font-heading)",
              }}
            >
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── System Breakdown Mini List ──────────────────────────────────────────────
function SystemBreakdown({ systems }: { systems: { name: string; count: number }[] }) {
  const top = systems.slice(0, 5)
  const maxCount = top[0]?.count ?? 1
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      {top.map(s => (
        <div key={s.name} className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span
                className="text-[10px] truncate"
                style={{ color: "hsl(var(--foreground))", opacity: 0.8 }}
              >
                {s.name}
              </span>
              <span
                className="text-[10px] font-medium ml-2 flex-shrink-0"
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.03em",
                  color: "var(--skyshare-gold)",
                }}
              >
                {s.count}
              </span>
            </div>
            <div
              className="h-[3px] rounded-full"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(s.count / maxCount) * 100}%`,
                  background: "var(--skyshare-gold)",
                  opacity: 0.5,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Reliability color helper ────────────────────────────────────────────────
function rateColor(rate: number) {
  if (rate <= 8) return "rgba(100,220,100,0.85)"
  if (rate <= 15) return "var(--skyshare-gold)"
  return "rgba(255,140,60,0.9)"
}

function daysColor(days: number) {
  if (days <= 3) return "rgba(100,220,100,0.85)"
  if (days <= 10) return "var(--skyshare-gold)"
  return "rgba(255,140,60,0.9)"
}

// ─── Main Panel ──────────────────────────────────────────────────────────────
export default function FleetStatsPanel({ stats }: { stats: FleetStats }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between rounded-lg px-4 py-2.5 transition-colors hover:brightness-110"
        style={{
          background: "rgba(212,160,23,0.05)",
          border: "1px solid rgba(212,160,23,0.12)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <Activity className="w-3.5 h-3.5" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            Fleet Analytics
          </span>
          <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
            ·
          </span>
          <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
            {stats.totalRecords} discrepancies · {stats.aircraftCount} aircraft · {stats.totalFleetHours.toLocaleString()} fleet hours
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Inline preview stats when collapsed */}
          {!expanded && (
            <div className="hidden sm:flex items-center gap-4">
              <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: rateColor(stats.fleetDisPerKHours), letterSpacing: "0.03em" }}>
                  {stats.fleetDisPerKHours.toFixed(1)}
                </span>
                <span className="ml-1 opacity-50">dis/1Kh</span>
              </span>
              {stats.avgResolutionDays !== null && (
                <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: daysColor(stats.avgResolutionDays), letterSpacing: "0.03em" }}>
                    {stats.avgResolutionDays.toFixed(1)}d
                  </span>
                  <span className="ml-1 opacity-50">avg fix</span>
                </span>
              )}
              <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: stats.criticalMelCount > 20 ? "rgba(255,140,60,0.9)" : "var(--skyshare-gold)", letterSpacing: "0.03em" }}>
                  {stats.criticalMelCount}
                </span>
                <span className="ml-1 opacity-50">critical MEL</span>
              </span>
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: "var(--skyshare-gold)", opacity: 0.5 }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: "var(--skyshare-gold)", opacity: 0.5 }} />
          )}
        </div>
      </button>

      {/* Expanded stats grid */}
      {expanded && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3"
        >
          {/* 1 — Fleet Reliability Rate */}
          <StatCell
            icon={Activity}
            value={stats.fleetDisPerKHours.toFixed(1)}
            unit="per 1K hrs"
            label="Fleet Reliability Rate"
            detail="Discrepancies per 1,000 flight hours across the entire fleet"
            color={rateColor(stats.fleetDisPerKHours)}
          />

          {/* 2 — Critical Deferrals */}
          <StatCell
            icon={Shield}
            value={String(stats.criticalMelCount)}
            label="Critical Deferrals"
            detail="MEL Category A & B — non-deferrable or time-limited items"
            color={
              stats.criticalMelCount === 0
                ? "rgba(100,220,100,0.85)"
                : stats.criticalMelCount <= 15
                  ? "var(--skyshare-gold)"
                  : "rgba(255,140,60,0.9)"
            }
          />

          {/* 3 — Average Resolution Time */}
          <StatCell
            icon={Clock}
            value={stats.avgResolutionDays !== null ? stats.avgResolutionDays.toFixed(1) : "—"}
            unit={stats.avgResolutionDays !== null ? "days" : undefined}
            label="Avg Resolution Time"
            detail="Mean time from discrepancy report to corrective action signoff"
            color={stats.avgResolutionDays !== null ? daysColor(stats.avgResolutionDays) : "hsl(var(--muted-foreground))"}
          />

          {/* 4 — Fleet Spread (Best / Worst) */}
          <StatCell
            icon={Plane}
            value=""
            label="Reliability Spread"
            color="hsl(var(--foreground))"
          >
            <div className="flex flex-col gap-2 mt-0.5">
              {stats.bestAircraft && (
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px]" style={{ color: "rgba(100,220,100,0.7)" }}>
                    Best
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-xs font-medium"
                      style={{
                        fontFamily: "'Courier Prime','Courier New',monospace",
                        color: "rgba(100,220,100,0.85)",
                      }}
                    >
                      {stats.bestAircraft.tail}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.1rem",
                        letterSpacing: "0.03em",
                        color: "rgba(100,220,100,0.85)",
                        lineHeight: 1,
                      }}
                    >
                      {stats.bestAircraft.rate.toFixed(1)}
                    </span>
                    <span className="text-[9px] opacity-50" style={{ color: "hsl(var(--muted-foreground))" }}>/1Kh</span>
                  </div>
                </div>
              )}
              {stats.worstAircraft && (
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px]" style={{ color: "rgba(255,140,60,0.7)" }}>
                    Worst
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-xs font-medium"
                      style={{
                        fontFamily: "'Courier Prime','Courier New',monospace",
                        color: "rgba(255,140,60,0.9)",
                      }}
                    >
                      {stats.worstAircraft.tail}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.1rem",
                        letterSpacing: "0.03em",
                        color: "rgba(255,140,60,0.9)",
                        lineHeight: 1,
                      }}
                    >
                      {stats.worstAircraft.rate.toFixed(1)}
                    </span>
                    <span className="text-[9px] opacity-50" style={{ color: "hsl(var(--muted-foreground))" }}>/1Kh</span>
                  </div>
                </div>
              )}
              <p className="text-[9px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                Discrepancies per 1,000 flight hours by tail
              </p>
            </div>
          </StatCell>

          {/* 5 — Top System Issues */}
          <StatCell
            icon={Wrench}
            value=""
            label="System Hot Spots"
            color="var(--skyshare-gold)"
          >
            <SystemBreakdown systems={stats.systemBreakdown} />
          </StatCell>

          {/* 6 — Quarterly Trend */}
          <StatCell
            icon={TrendingUp}
            value=""
            label="Quarterly Trend"
            color="var(--skyshare-gold)"
          >
            <TrendBars data={stats.quarterlyTrend} />
          </StatCell>
        </div>
      )}
    </div>
  )
}
