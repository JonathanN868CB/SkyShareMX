import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronUp, Activity, BarChart2, Wrench, Clock, TrendingUp, CheckCircle2, Maximize2, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import type { FleetStats, AircraftStat, GroupRate, QuarterBucket } from "./useFleetStats"

// ─── Sort header helper (mirrors BeetBox InventoryDetail pattern) ─────────────
function SortTh({
  label, active, dir, onClick, className,
}: {
  label: string
  active: boolean
  dir: "asc" | "desc"
  onClick: () => void
  className?: string
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <th className={className ?? "text-left px-4 py-2.5 whitespace-nowrap"}>
      <button
        onClick={onClick}
        className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-medium transition-colors"
        style={{ color: active ? "var(--skyshare-gold)" : "rgba(255,255,255,0.35)" }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.60)" }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)" }}
      >
        {label}
        <Icon className="w-3 h-3" style={{ opacity: active ? 1 : 0.4 }} />
      </button>
    </th>
  )
}

// ─── Color helpers ────────────────────────────────────────────────────────────
function rateColor(rate: number) {
  if (rate <= 3.5) return "rgba(100,220,100,0.85)"
  if (rate <= 6.0) return "var(--skyshare-gold)"
  if (rate <= 8.0) return "rgba(255,140,60,0.9)"
  return "rgba(255,90,90,0.9)"
}

function daysColor(days: number) {
  if (days <= 3) return "rgba(100,220,100,0.85)"
  if (days <= 7) return "var(--skyshare-gold)"
  return "rgba(255,140,60,0.9)"
}

// ─── Pro-rated quarterly trend ────────────────────────────────────────────────
interface ProRatedBucket {
  label: string
  count: number
  rate: number        // dis / day (normalized)
  isCurrentQ: boolean
  daysBase: number    // elapsed days for current Q; total days for past Qs
}

function proRateQuarters(buckets: QuarterBucket[]): ProRatedBucket[] {
  const now = new Date()
  const currentQ = Math.floor(now.getMonth() / 3) + 1  // 1–4
  const currentY = now.getFullYear()

  return buckets.map(b => {
    const isCurrentQ = b.yr === currentY && b.q === currentQ
    let daysBase: number

    if (isCurrentQ) {
      const qStart = new Date(b.yr, (b.q - 1) * 3, 1)
      const msElapsed = now.getTime() - qStart.getTime()
      daysBase = Math.max(1, Math.floor(msElapsed / 86_400_000) + 1)
    } else {
      const qStart = new Date(b.yr, (b.q - 1) * 3, 1)
      const qEnd   = new Date(b.yr, b.q * 3, 1)
      daysBase = Math.floor((qEnd.getTime() - qStart.getTime()) / 86_400_000)
    }

    return { label: b.label, count: b.count, rate: b.count / daysBase, isCurrentQ, daysBase }
  })
}

// ─── Expand Modal ─────────────────────────────────────────────────────────────
function ExpandModal({
  title, icon: Icon, color, onClose, children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-2.5 px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}
        >
          <Icon className="w-4 h-4" style={{ color, opacity: 0.75 }} />
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
            {title}
          </span>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md transition-colors hover:brightness-150"
            style={{ color: "hsl(var(--muted-foreground))", background: "rgba(255,255,255,0.04)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────
function StatCell({
  icon: Icon, value, unit, label, detail, color, children, expandTitle, expandContent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  value?: string; unit?: string; label: string; detail?: string; color: string
  children?: React.ReactNode
  expandTitle?: string
  expandContent?: React.ReactNode
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const close = useCallback(() => setModalOpen(false), [])

  return (
    <>
      <div
        className="flex flex-col gap-2 rounded-lg px-4 py-3.5"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color, opacity: 0.7 }} />
          <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
            {label}
          </span>
          {expandContent && (
            <button
              onClick={() => setModalOpen(true)}
              className="ml-auto p-1 rounded transition-opacity opacity-30 hover:opacity-80"
              title="Expand"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          )}
        </div>
        {children ?? (
          <div>
            <div className="flex items-baseline gap-1">
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", letterSpacing: "0.04em", color, lineHeight: 1 }}>
                {value}
              </span>
              {unit && (
                <span className="text-[10px] uppercase tracking-wider" style={{ color, opacity: 0.6, fontFamily: "var(--font-heading)" }}>
                  {unit}
                </span>
              )}
            </div>
            {detail && (
              <p className="text-[10px] mt-1.5 leading-snug" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
                {detail}
              </p>
            )}
          </div>
        )}
      </div>

      {modalOpen && expandContent && (
        <ExpandModal title={expandTitle ?? label} icon={Icon} color={color} onClose={close}>
          {expandContent}
        </ExpandModal>
      )}
    </>
  )
}

// ─── Trend Bars (pro-rated) ───────────────────────────────────────────────────
function TrendBars({ data, tall }: { data: ProRatedBucket[]; tall?: boolean }) {
  const maxRate = Math.max(...data.map(d => d.rate), 0.001)
  return (
    <div className="flex items-end gap-3 mt-1" style={{ height: tall ? 140 : 56 }}>
      {data.map((d) => {
        const pct = (d.rate / maxRate) * 100
        const isLatest = d.isCurrentQ
        const barH = tall ? Math.max(pct * 1.1, 3) : Math.max(pct * 0.42, 2)
        const barColor = isLatest ? "var(--skyshare-gold)" : "rgba(255,255,255,0.12)"
        const rateLabel = d.rate.toFixed(2)

        return (
          <div
            key={d.label}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${d.label}: ${d.count} dis over ${d.daysBase} days${d.isCurrentQ ? " (so far)" : ""} = ${d.rate.toFixed(3)} dis/day`}
          >
            <span
              className="font-medium tabular-nums"
              style={{
                fontFamily: "var(--font-display)",
                letterSpacing: "0.02em",
                fontSize: tall ? "0.8rem" : "0.6rem",
                color: isLatest ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                opacity: isLatest ? 1 : 0.7,
              }}
            >
              {rateLabel}
            </span>
            <div
              className="w-full rounded-sm"
              style={{
                height: `${barH}px`,
                background: barColor,
                minHeight: 2,
                border: isLatest ? "none" : "none",
                outline: isLatest ? "1px dashed rgba(212,160,23,0.25)" : "none",
                outlineOffset: 1,
              }}
            />
            <div className="flex flex-col items-center gap-0" style={{ lineHeight: 1.3 }}>
              <span
                className="uppercase tracking-wider"
                style={{ fontSize: tall ? "0.68rem" : "0.5rem", color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)" }}
              >
                {d.label}
              </span>
              {isLatest && (
                <span style={{ fontSize: tall ? "0.6rem" : "0.45rem", color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
                  {d.daysBase}d in
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Trend Expanded ───────────────────────────────────────────────────────────
function TrendExpanded({ data }: { data: ProRatedBucket[] }) {
  return (
    <div className="flex flex-col gap-6">
      <TrendBars data={data} tall />
      <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
        <div
          className="grid items-center"
          style={{ gridTemplateColumns: "1fr auto auto auto auto", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(20,20,20,0.95)" }}
        >
          {["Quarter", "Dis / Day", "Total Dis", "Days", "Status"].map(h => (
            <div key={h} className="px-4 py-2.5 text-[10px] uppercase tracking-widest font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{h}</div>
          ))}
        </div>
        {data.map(b => (
          <div
            key={b.label}
            className="grid items-center"
            style={{ gridTemplateColumns: "1fr auto auto auto auto", borderBottom: "1px solid rgba(255,255,255,0.03)", background: b.isCurrentQ ? "rgba(212,160,23,0.03)" : undefined }}
          >
            <div className="px-4 py-3 text-[12px] font-medium" style={{ color: b.isCurrentQ ? "var(--skyshare-gold)" : "hsl(var(--foreground))" }}>
              {b.label}
            </div>
            <div className="px-4 py-3 text-right">
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.04em", color: b.isCurrentQ ? "var(--skyshare-gold)" : "hsl(var(--foreground))", lineHeight: 1 }}>
                {b.rate.toFixed(3)}
              </span>
              <span className="ml-1 text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}>/d</span>
            </div>
            <div className="px-4 py-3 text-right text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              {b.count}
            </div>
            <div className="px-4 py-3 text-right text-[11px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
              {b.daysBase}
            </div>
            <div className="px-4 py-3 text-right">
              {b.isCurrentQ
                ? <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "var(--skyshare-gold)", background: "rgba(212,160,23,0.1)" }}>in progress</span>
                : <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>complete</span>
              }
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
        Dis/day normalizes each quarter so you can compare an in-progress quarter against completed ones at equal footing.
        Current quarter uses elapsed days only; completed quarters use full quarter length.
      </p>
    </div>
  )
}

// ─── Group Rate List (compact) ────────────────────────────────────────────────
function GroupRateList({ groups }: { groups: GroupRate[] }) {
  const maxRate = Math.max(...groups.map(g => g.rate), 0.1)
  return (
    <div className="flex flex-col gap-2 mt-1">
      {groups.map(g => {
        const color = rateColor(g.rate)
        return (
          <div key={g.label} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] truncate max-w-[55%]" style={{ color: "hsl(var(--foreground))", opacity: 0.85 }}>{g.label}</span>
              <div className="flex items-baseline gap-1.5 flex-shrink-0">
                <span className="text-[11px] font-semibold" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em", color }}>{g.rate.toFixed(1)}</span>
                <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}>/100h</span>
                <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>({g.aircraftCount}ac)</span>
              </div>
            </div>
            <div className="h-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${(g.rate / maxRate) * 100}%`, background: color, opacity: 0.5 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Group Rate Expanded (sortable) ──────────────────────────────────────────
type GRSortKey = "label" | "rate" | "disCount" | "opsHours" | "aircraftCount"

function GroupRateExpanded({ groups }: { groups: GroupRate[] }) {
  const [sortKey, setSortKey] = useState<GRSortKey>("rate")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  function toggleSort(k: GRSortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir(k === "label" ? "asc" : "desc") }
  }

  const sorted = [...groups].sort((a, b) => {
    let cmp = 0
    if (sortKey === "label")        cmp = a.label.localeCompare(b.label)
    else if (sortKey === "rate")    cmp = a.rate - b.rate
    else if (sortKey === "disCount") cmp = a.disCount - b.disCount
    else if (sortKey === "opsHours") cmp = a.opsHours - b.opsHours
    else                             cmp = a.aircraftCount - b.aircraftCount
    return sortDir === "asc" ? cmp : -cmp
  })

  const maxRate = Math.max(...sorted.map(g => g.rate), 0.1)

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
      <table className="w-full">
        <thead style={{ background: "rgba(20,20,20,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <tr>
            <SortTh label="Name"          active={sortKey === "label"}        dir={sortDir} onClick={() => toggleSort("label")} />
            <SortTh label="Rate / 100h"   active={sortKey === "rate"}         dir={sortDir} onClick={() => toggleSort("rate")}  className="text-right px-4 py-2.5 whitespace-nowrap" />
            <SortTh label="Discrepancies" active={sortKey === "disCount"}     dir={sortDir} onClick={() => toggleSort("disCount")} className="text-right px-4 py-2.5 whitespace-nowrap" />
            <SortTh label="Ops Hours"     active={sortKey === "opsHours"}     dir={sortDir} onClick={() => toggleSort("opsHours")} className="text-right px-4 py-2.5 whitespace-nowrap" />
            <SortTh label="Aircraft"      active={sortKey === "aircraftCount"} dir={sortDir} onClick={() => toggleSort("aircraftCount")} className="text-right px-4 py-2.5 whitespace-nowrap" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(g => {
            const color = rateColor(g.rate)
            return (
              <tr key={g.label} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium" style={{ color: "hsl(var(--foreground))" }}>{g.label}</span>
                    <div className="h-[4px] rounded-full" style={{ background: "rgba(255,255,255,0.06)", maxWidth: 200 }}>
                      <div className="h-full rounded-full" style={{ width: `${(g.rate / maxRate) * 100}%`, background: color, opacity: 0.55 }} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", letterSpacing: "0.04em", color, lineHeight: 1 }}>{g.rate.toFixed(2)}</span>
                </td>
                <td className="px-4 py-3 text-right text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>{g.disCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>{g.opsHours.toLocaleString()}h</td>
                <td className="px-4 py-3 text-right text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>{g.aircraftCount}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Rate Rank Expanded (sortable) ────────────────────────────────────────────
type RRSortKey = "rate" | "tail" | "opsHours" | "disCount"

function RateRankExpanded({ aircraft }: { aircraft: AircraftStat[] }) {
  const [sortKey, setSortKey] = useState<RRSortKey>("rate")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  function toggleSort(k: RRSortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir(k === "tail" ? "asc" : k === "rate" ? "asc" : "desc") }
  }

  const rated = aircraft.filter(ac => ac.rate !== null)
  const unrated = aircraft.filter(ac => ac.rate === null)

  const sorted = [...rated].sort((a, b) => {
    let cmp = 0
    if (sortKey === "tail")         cmp = a.tail.localeCompare(b.tail)
    else if (sortKey === "rate")    cmp = (a.rate ?? 0) - (b.rate ?? 0)
    else if (sortKey === "opsHours") cmp = a.opsHours - b.opsHours
    else                             cmp = a.disCount - b.disCount
    return sortDir === "asc" ? cmp : -cmp
  })

  return (
    <div className="flex flex-col gap-4">
      <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
        <table className="w-full">
          <thead style={{ background: "rgba(20,20,20,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest font-medium w-8" style={{ color: "hsl(var(--muted-foreground))" }}>#</th>
              <SortTh label="Tail"       active={sortKey === "tail"}     dir={sortDir} onClick={() => toggleSort("tail")} />
              <SortTh label="Rate / 100h" active={sortKey === "rate"}    dir={sortDir} onClick={() => toggleSort("rate")}     className="text-right px-4 py-2.5 whitespace-nowrap" />
              <SortTh label="Ops Hrs"    active={sortKey === "opsHours"} dir={sortDir} onClick={() => toggleSort("opsHours")} className="text-right px-4 py-2.5 whitespace-nowrap" />
              <SortTh label="Dis"        active={sortKey === "disCount"} dir={sortDir} onClick={() => toggleSort("disCount")} className="text-right px-4 py-2.5 whitespace-nowrap" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((ac, i) => {
              const color = rateColor(ac.rate!)
              return (
                <tr key={ac.tail} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-medium" style={{ fontFamily: "'Courier Prime','Courier New',monospace", color: "var(--skyshare-gold)" }}>{ac.tail}</span>
                    {(ac.activeCatA > 0 || ac.activeCatB > 0) && (
                      <span className="ml-2 text-[9px] px-1 rounded" style={{ color: "rgba(255,90,90,0.9)", background: "rgba(255,90,90,0.12)" }}>Cat {ac.activeCatA > 0 ? "A" : "B"}</span>
                    )}
                    <span className="ml-2 text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>{ac.make}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.04em", color, lineHeight: 1 }}>{ac.rate!.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{ac.opsHours.toLocaleString()}h</td>
                  <td className="px-4 py-3 text-right text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{ac.disCount.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {unrated.length > 0 && (
        <div>
          <p className="text-[10px] mb-2" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }}>Insufficient data (&lt;200 ops hrs) — not ranked</p>
          <div className="flex flex-wrap gap-2">
            {unrated.map(ac => (
              <span key={ac.tail} className="text-[11px] px-2 py-1 rounded" style={{ fontFamily: "'Courier Prime','Courier New',monospace", color: "hsl(var(--muted-foreground))", background: "rgba(255,255,255,0.04)", opacity: 0.5 }}>
                {ac.tail} · {ac.opsHours > 0 ? `${ac.opsHours}h` : "no hours"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Resolution Expanded (sortable) ──────────────────────────────────────────
type ResSortKey = "avgResolutionDays" | "tail" | "disCount"

function ResolutionExpanded({ aircraft }: { aircraft: AircraftStat[] }) {
  const [sortKey, setSortKey] = useState<ResSortKey>("avgResolutionDays")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  function toggleSort(k: ResSortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir(k === "tail" ? "asc" : k === "avgResolutionDays" ? "asc" : "desc") }
  }

  const withData = aircraft.filter(ac => ac.avgResolutionDays !== null)
  const noData   = aircraft.filter(ac => ac.avgResolutionDays === null)

  const sorted = [...withData].sort((a, b) => {
    let cmp = 0
    if (sortKey === "tail")                cmp = a.tail.localeCompare(b.tail)
    else if (sortKey === "avgResolutionDays") cmp = (a.avgResolutionDays ?? 0) - (b.avgResolutionDays ?? 0)
    else                                   cmp = a.disCount - b.disCount
    return sortDir === "asc" ? cmp : -cmp
  })

  return (
    <div className="flex flex-col gap-4">
      <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
        <table className="w-full">
          <thead style={{ background: "rgba(20,20,20,0.95)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-widest font-medium w-8" style={{ color: "hsl(var(--muted-foreground))" }}>#</th>
              <SortTh label="Tail"           active={sortKey === "tail"}               dir={sortDir} onClick={() => toggleSort("tail")} />
              <SortTh label="Avg Fix (days)" active={sortKey === "avgResolutionDays"}  dir={sortDir} onClick={() => toggleSort("avgResolutionDays")} className="text-right px-4 py-2.5 whitespace-nowrap" />
              <SortTh label="Dis Count"      active={sortKey === "disCount"}           dir={sortDir} onClick={() => toggleSort("disCount")} className="text-right px-4 py-2.5 whitespace-nowrap" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((ac, i) => {
              const color = daysColor(ac.avgResolutionDays!)
              return (
                <tr key={ac.tail} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-medium" style={{ fontFamily: "'Courier Prime','Courier New',monospace", color: "var(--skyshare-gold)" }}>{ac.tail}</span>
                    <span className="ml-2 text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>{ac.make}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.04em", color, lineHeight: 1 }}>{ac.avgResolutionDays!.toFixed(1)}</span>
                    <span className="ml-1 text-[10px]" style={{ color, opacity: 0.5 }}>d</span>
                  </td>
                  <td className="px-4 py-3 text-right text-[11px]" style={{ color: "hsl(var(--muted-foreground))" }}>{ac.disCount.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {noData.length > 0 && (
        <p className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
          No resolution data: {noData.map(ac => ac.tail).join(", ")}
        </p>
      )}
    </div>
  )
}

// ─── Per-Aircraft Roster ──────────────────────────────────────────────────────
type RosterSortKey = "rate" | "tail" | "opsHours" | "avgFix"

function RosterTable({
  sorted, sortKey, sortDir, toggleSort,
}: {
  sorted: AircraftStat[]
  sortKey: RosterSortKey
  sortDir: "asc" | "desc"
  toggleSort: (k: RosterSortKey) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead style={{ background: "rgba(20,20,20,0.95)" }}>
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <SortTh label="Tail"       active={sortKey === "tail"}     dir={sortDir} onClick={() => toggleSort("tail")}     className="text-left px-3 py-2 whitespace-nowrap" />
          <SortTh label="Ops Hrs"    active={sortKey === "opsHours"} dir={sortDir} onClick={() => toggleSort("opsHours")} className="text-left px-3 py-2 whitespace-nowrap" />
          <SortTh label="Rate / 100h" active={sortKey === "rate"}    dir={sortDir} onClick={() => toggleSort("rate")}     className="text-left px-3 py-2 whitespace-nowrap" />
          <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-medium whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>Open</th>
          <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-medium whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>Def</th>
          <th className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-medium whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>MEL %</th>
          <SortTh label="Avg Fix"    active={sortKey === "avgFix"}   dir={sortDir} onClick={() => toggleSort("avgFix")}   className="text-left px-3 py-2 whitespace-nowrap" />
        </tr>
      </thead>
      <tbody>
        {sorted.map(ac => {
          const melPct = ac.disCount > 0 ? Math.round((ac.melCount / ac.disCount) * 100) : 0
          const hasUrgent = ac.activeCatA > 0 || ac.activeCatB > 0
          return (
            <tr key={ac.tail} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: hasUrgent ? "rgba(255,100,60,0.04)" : undefined }}>
              <td className="px-3 py-2 text-[11px] whitespace-nowrap font-medium" style={{ color: "var(--skyshare-gold)", fontFamily: "'Courier Prime','Courier New',monospace" }}>
                {ac.tail}
                {hasUrgent && <span className="ml-1.5 text-[8px] px-1 rounded" style={{ color: "rgba(255,90,90,0.9)", background: "rgba(255,90,90,0.12)" }}>Cat {ac.activeCatA > 0 ? "A" : "B"}</span>}
              </td>
              <td className="px-3 py-2 text-[11px] whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>
                {ac.opsHours > 0 ? ac.opsHours.toLocaleString() : <span style={{ opacity: 0.35 }}>—</span>}
                {ac.opsHours > 0 && ac.acqHours > 0 && (
                  <span className="ml-1 text-[9px]" style={{ opacity: 0.35 }}>(acq {Math.round(ac.acqHours).toLocaleString()}h)</span>
                )}
              </td>
              <td className="px-3 py-2 text-[12px] font-semibold whitespace-nowrap" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.03em" }}>
                {ac.rate !== null
                  ? <span style={{ color: rateColor(ac.rate) }}>{ac.rate.toFixed(1)}</span>
                  : <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35, fontSize: "0.75rem", fontFamily: "inherit" }}>insuff. data</span>
                }
              </td>
              <td className="px-3 py-2 text-[11px] whitespace-nowrap">
                {ac.openCount > 0
                  ? <span style={{ color: "rgba(255,90,90,0.85)", fontWeight: 600 }}>{ac.openCount}</span>
                  : <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.25 }}>—</span>
                }
              </td>
              <td className="px-3 py-2 text-[11px] whitespace-nowrap">
                {ac.deferredCount > 0
                  ? <span style={{ color: "rgba(255,165,0,0.85)", fontWeight: 600 }}>{ac.deferredCount}</span>
                  : <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.25 }}>—</span>
                }
              </td>
              <td className="px-3 py-2 text-[11px] whitespace-nowrap" style={{ color: melPct >= 40 ? "rgba(255,165,0,0.8)" : "hsl(var(--muted-foreground))" }}>
                {ac.disCount > 0 ? `${melPct}%` : <span style={{ opacity: 0.25 }}>—</span>}
              </td>
              <td className="px-3 py-2 text-[11px] whitespace-nowrap">
                {ac.avgResolutionDays !== null
                  ? <span style={{ color: daysColor(ac.avgResolutionDays) }}>{ac.avgResolutionDays.toFixed(1)}d</span>
                  : <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.25 }}>—</span>
                }
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function AircraftRoster({ aircraft }: { aircraft: AircraftStat[] }) {
  const [sortKey, setSortKey] = useState<RosterSortKey>("rate")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [modalOpen, setModalOpen] = useState(false)
  const close = useCallback(() => setModalOpen(false), [])

  function toggleSort(key: RosterSortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const sorted = [...aircraft].sort((a, b) => {
    let va: number, vb: number
    if (sortKey === "rate")           { va = a.rate ?? -1;              vb = b.rate ?? -1 }
    else if (sortKey === "opsHours")  { va = a.opsHours;                vb = b.opsHours }
    else if (sortKey === "avgFix")    { va = a.avgResolutionDays ?? -1; vb = b.avgResolutionDays ?? -1 }
    else { return sortDir === "asc" ? a.tail.localeCompare(b.tail) : b.tail.localeCompare(a.tail) }
    return sortDir === "asc" ? va - vb : vb - va
  })

  return (
    <>
      <div className="mt-4 rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
          <Activity className="w-3 h-3" style={{ color: "var(--skyshare-gold)", opacity: 0.6 }} />
          <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
            Per-Aircraft Health Roster
          </span>
          <span className="text-[9px] ml-2 hidden sm:inline" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
            Rate = dis / 100 ops hrs · ops hrs = hours under our care
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="ml-auto p-1 rounded transition-opacity opacity-30 hover:opacity-80"
            title="Expand roster"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <RosterTable sorted={sorted} sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
        </div>
        <div className="px-3 py-2 text-[10px]" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
          "Insuff. data" = fewer than 200 ops hours recorded
        </div>
      </div>

      {modalOpen && (
        <ExpandModal title="Per-Aircraft Health Roster" icon={Activity} color="var(--skyshare-gold)" onClose={close}>
          <div className="overflow-x-auto">
            <RosterTable sorted={sorted} sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort} />
          </div>
          <div className="mt-3 text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
            "Insuff. data" = fewer than 200 ops hours recorded — rate not meaningful at this sample size
          </div>
        </ExpandModal>
      )}
    </>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function FleetStatsPanel({ stats }: { stats: FleetStats }) {
  const [expanded, setExpanded] = useState(false)

  const fleetRateColor = rateColor(stats.fleetDisPer100h)
  const proRated = proRateQuarters(stats.quarterlyTrend)

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between rounded-lg px-4 py-2.5 transition-colors hover:brightness-110"
        style={{ background: "rgba(212,160,23,0.05)", border: "1px solid rgba(212,160,23,0.12)" }}
      >
        <div className="flex items-center gap-2.5">
          <Activity className="w-3.5 h-3.5" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }} />
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
            Fleet Analytics
          </span>
          <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>·</span>
          <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
            {stats.totalRecords.toLocaleString()} records · {stats.totalOpsHours.toLocaleString()} ops hrs
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!expanded && (
            <div className="hidden sm:flex items-center gap-4">
              <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: fleetRateColor, letterSpacing: "0.03em" }}>
                  {stats.fleetDisPer100h.toFixed(1)}
                </span>
                <span className="ml-1 opacity-50">dis/100h</span>
              </span>
              {stats.avgResolutionDays !== null && (
                <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", color: daysColor(stats.avgResolutionDays), letterSpacing: "0.03em" }}>
                    {stats.avgResolutionDays.toFixed(1)}d
                  </span>
                  <span className="ml-1 opacity-50">avg fix</span>
                </span>
              )}
            </div>
          )}
          {expanded
            ? <ChevronUp  className="w-4 h-4" style={{ color: "var(--skyshare-gold)", opacity: 0.5 }} />
            : <ChevronDown className="w-4 h-4" style={{ color: "var(--skyshare-gold)", opacity: 0.5 }} />
          }
        </div>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* 1 — Fleet Reliability Rate */}
            <StatCell
              icon={Activity}
              value={stats.fleetDisPer100h.toFixed(1)}
              unit="per 100 ops hrs"
              label="Fleet Reliability Rate"
              detail="Discrepancies per 100 hours we have operated these aircraft — acquisition baseline subtracted"
              color={fleetRateColor}
              expandTitle="Fleet Reliability Rate — Full Ranking"
              expandContent={<RateRankExpanded aircraft={stats.perAircraftStats} />}
            />

            {/* 2 — By Manufacturer */}
            <StatCell
              icon={BarChart2}
              label="By Manufacturer"
              color="var(--skyshare-gold)"
              expandTitle="By Manufacturer — Detail"
              expandContent={stats.byManufacturer.length > 0 ? <GroupRateExpanded groups={stats.byManufacturer} /> : undefined}
            >
              {stats.byManufacturer.length > 0
                ? <GroupRateList groups={stats.byManufacturer} />
                : <p className="text-[10px] mt-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>Insufficient data</p>
              }
            </StatCell>

            {/* 3 — Average Resolution Time */}
            <StatCell
              icon={Clock}
              value={stats.avgResolutionDays !== null ? stats.avgResolutionDays.toFixed(1) : "—"}
              unit={stats.avgResolutionDays !== null ? "days" : undefined}
              label="Avg Resolution Time"
              detail="Mean days from pilot report to corrective action signoff, fleet-wide"
              color={stats.avgResolutionDays !== null ? daysColor(stats.avgResolutionDays) : "hsl(var(--muted-foreground))"}
              expandTitle="Resolution Time — Per Aircraft"
              expandContent={<ResolutionExpanded aircraft={stats.perAircraftStats} />}
            />

            {/* 4 — Reliability Spread */}
            <StatCell
              icon={CheckCircle2}
              label="Reliability Spread"
              color="hsl(var(--foreground))"
              expandTitle="Reliability Spread — All Aircraft Ranked"
              expandContent={<RateRankExpanded aircraft={stats.perAircraftStats} />}
            >
              <div className="flex flex-col gap-2 mt-0.5">
                {stats.bestAircraft && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px]" style={{ color: "rgba(100,220,100,0.7)" }}>Best</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium" style={{ fontFamily: "'Courier Prime','Courier New',monospace", color: "rgba(100,220,100,0.85)" }}>{stats.bestAircraft.tail}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.03em", color: "rgba(100,220,100,0.85)", lineHeight: 1 }}>{stats.bestAircraft.rate.toFixed(1)}</span>
                      <span className="text-[9px] opacity-50" style={{ color: "hsl(var(--muted-foreground))" }}>/100h</span>
                    </div>
                  </div>
                )}
                {stats.worstAircraft && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px]" style={{ color: "rgba(255,140,60,0.7)" }}>Watch</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium" style={{ fontFamily: "'Courier Prime','Courier New',monospace", color: "rgba(255,140,60,0.9)" }}>{stats.worstAircraft.tail}</span>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", letterSpacing: "0.03em", color: "rgba(255,140,60,0.9)", lineHeight: 1 }}>{stats.worstAircraft.rate.toFixed(1)}</span>
                      <span className="text-[9px] opacity-50" style={{ color: "hsl(var(--muted-foreground))" }}>/100h</span>
                    </div>
                  </div>
                )}
                <p className="text-[9px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                  Min 200 ops hrs to qualify · based on our hours only
                </p>
              </div>
            </StatCell>

            {/* 5 — By Model Series */}
            <StatCell
              icon={Wrench}
              label="By Model Series"
              color="var(--skyshare-gold)"
              expandTitle="By Model Series — Detail"
              expandContent={stats.byModelFamily.length > 0 ? <GroupRateExpanded groups={stats.byModelFamily} /> : undefined}
            >
              {stats.byModelFamily.length > 0
                ? <GroupRateList groups={stats.byModelFamily} />
                : <p className="text-[10px] mt-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>Insufficient data</p>
              }
            </StatCell>

            {/* 6 — Quarterly Trend (pro-rated) */}
            <StatCell
              icon={TrendingUp}
              label="Quarterly Trend"
              color="var(--skyshare-gold)"
              expandTitle="Quarterly Trend — Dis / Day"
              expandContent={<TrendExpanded data={proRated} />}
            >
              <TrendBars data={proRated} />
            </StatCell>
          </div>

          <AircraftRoster aircraft={stats.perAircraftStats} />
        </div>
      )}
    </div>
  )
}
