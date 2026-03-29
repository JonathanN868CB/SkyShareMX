import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import type { TrainingRow as TrainingRowData } from "@/hooks/useTraining"

// ─── Due-date helpers ─────────────────────────────────────────────────────────

type Urgency = "overdue" | "soon" | "normal" | "far" | "none"

function getUrgency(dueDateStr: string): Urgency {
  if (!dueDateStr?.trim()) return "none"
  const due  = new Date(dueDateStr)
  if (isNaN(due.getTime())) return "none"
  const diff = Math.floor((due.getTime() - Date.now()) / 86_400_000)
  if (diff < 0)  return "overdue"
  if (diff <= 7) return "soon"
  if (diff <= 30) return "normal"
  return "far"
}

function getDueDiff(dueDateStr: string): number {
  if (!dueDateStr?.trim()) return Infinity
  const due = new Date(dueDateStr)
  if (isNaN(due.getTime())) return Infinity
  return Math.floor((due.getTime() - Date.now()) / 86_400_000)
}

function formatDate(str: string): string {
  if (!str?.trim()) return "—"
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function DueBadge({ dueDateStr }: { dueDateStr: string }) {
  const urgency = getUrgency(dueDateStr)
  const diff    = getDueDiff(dueDateStr)

  if (urgency === "none") return <span style={{ color: "hsl(var(--muted-foreground))" }}>—</span>

  if (urgency === "overdue") {
    const days = Math.abs(diff)
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
        style={{ background: "rgba(193,2,48,0.15)", color: "#e05070", border: "1px solid rgba(193,2,48,0.25)", fontFamily: "var(--font-heading)" }}
      >
        <AlertTriangle size={9} />
        {days === 1 ? "1 day overdue" : `${days}d overdue`}
      </span>
    )
  }

  if (urgency === "soon") {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
        style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", fontFamily: "var(--font-heading)" }}
      >
        {diff === 0 ? "Due today" : `${diff}d left`}
      </span>
    )
  }

  return (
    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
      {formatDate(dueDateStr)}
    </span>
  )
}

// ─── Generic pill ─────────────────────────────────────────────────────────────

function Pill({ label }: { label: string }) {
  if (!label?.trim()) return null
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tracking-wider"
      style={{
        background: "rgba(255,255,255,0.06)",
        color: "hsl(var(--muted-foreground))",
        border: "1px solid rgba(255,255,255,0.08)",
        fontFamily: "var(--font-heading)",
      }}
    >
      {label}
    </span>
  )
}

// ─── Expandable row ───────────────────────────────────────────────────────────

function TrainingRow({ row, sheetUrl }: { row: TrainingRowData; sheetUrl: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const hasNotes    = !!row.notes?.trim()
  const hasExpand   = hasNotes || !!row.assignedDate?.trim()

  return (
    <>
      <tr
        className="transition-colors"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Expand chevron */}
        <td className="pl-4 pr-1 py-3 w-6">
          {hasExpand ? (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : (
            <span className="w-[13px] block" />
          )}
        </td>

        {/* Training Item + Category */}
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1">
            <span
              className="text-sm font-medium"
              style={{ color: "hsl(var(--foreground))" }}
            >
              {row.trainingItem || "—"}
            </span>
            {row.category && <Pill label={row.category} />}
          </div>
        </td>

        {/* Due Date */}
        <td className="px-3 py-3 whitespace-nowrap">
          <DueBadge dueDateStr={row.dueDate} />
        </td>


        {/* Status */}
        <td className="px-3 py-3">
          {row.status?.trim()
            ? <Pill label={row.status} />
            : <span style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3 }}>—</span>
          }
        </td>

        {/* Submit Completion */}
        <td className="px-3 py-3 pr-4">
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <button
                className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-opacity hover:opacity-80"
                style={{
                  background: "var(--skyshare-gold)",
                  color: "#111",
                  fontFamily: "var(--font-heading)",
                }}
              >
                Submit via Sheet →
              </button>
            </a>
          ) : null}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && hasExpand && (
        <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <td />
          <td colSpan={5} className="px-3 py-3">
            <div className="flex flex-col gap-2">
              {row.assignedDate?.trim() && (
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase tracking-wider"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)", minWidth: 88 }}
                  >
                    Assigned
                  </span>
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {formatDate(row.assignedDate)}
                  </span>
                </div>
              )}
              {hasNotes && (
                <div className="flex items-start gap-2">
                  <span
                    className="text-[10px] uppercase tracking-wider mt-0.5"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)", minWidth: 88 }}
                  >
                    Notes
                  </span>
                  <span className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {row.notes}
                  </span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

interface Props {
  rows:          TrainingRowData[]
  loading:       boolean
  lastRefreshed: Date | null
  cooldownLabel: string | null
  canRefresh:    boolean
  authExpired:    boolean
  onRefresh:      () => void
  onRelink:       () => void
  relinkLabel?:   string
  sheetFileId:    string | null
}

export default function TrainingDashboard({
  rows, loading, lastRefreshed, cooldownLabel, canRefresh, authExpired, onRefresh, onRelink,
  relinkLabel = "Re-link →", sheetFileId,
}: Props) {

  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter,   setStatusFilter]   = useState("all")

  // Derive unique filter options from data
  const categories = useMemo(() => {
    const vals = [...new Set(rows.map(r => r.category).filter(Boolean))].sort()
    return vals
  }, [rows])

  const statuses = useMemo(() => {
    const vals = [...new Set(rows.map(r => r.status).filter(Boolean))].sort()
    return vals
  }, [rows])

  // Filter + sort: overdue first, then by due date ascending
  const filtered = useMemo(() => {
    return rows
      .filter(r => categoryFilter === "all" || r.category === categoryFilter)
      .filter(r => statusFilter   === "all" || r.status   === statusFilter)
      .sort((a, b) => {
        const ua = getUrgency(a.dueDate)
        const ub = getUrgency(b.dueDate)
        if (ua === "overdue" && ub !== "overdue") return -1
        if (ub === "overdue" && ua !== "overdue") return  1
        return getDueDiff(a.dueDate) - getDueDiff(b.dueDate)
      })
  }, [rows, categoryFilter, statusFilter])

  const lastSyncText = lastRefreshed
    ? lastRefreshed.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null

  return (
    <div className="flex flex-col gap-0">

      {/* Auth expired banner */}
      {authExpired && (
        <div
          className="flex items-center justify-between px-5 py-3 gap-4"
          style={{ background: "rgba(193,2,48,0.12)", borderBottom: "1px solid rgba(193,2,48,0.2)" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: "#e05070" }} />
            <span className="text-xs" style={{ color: "#e05070" }}>
              Google authorization has expired.
            </span>
          </div>
          <button
            onClick={onRelink}
            className="text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-70 shrink-0"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
          >
            {relinkLabel}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Left: loading indicator or last synced */}
        <div className="flex items-center gap-2 min-w-0">
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin shrink-0" style={{ color: "var(--skyshare-gold)" }} />
              <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                Refreshing training data...
              </span>
            </>
          ) : lastSyncText ? (
            <span className="text-xs truncate" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
              Last synced: {lastSyncText}
            </span>
          ) : null}
        </div>

        {/* Right: filters + refresh */}
        <div className="flex items-center gap-2 shrink-0">
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-7 text-xs w-36 border-white/10 bg-white/4">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {statuses.length > 0 && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 text-xs w-32 border-white/10 bg-white/4">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="ghost"
            size="sm"
            disabled={!canRefresh || loading}
            onClick={onRefresh}
            className="h-7 gap-1.5 text-xs"
            style={{ color: canRefresh ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            {cooldownLabel ? `${cooldownLabel}` : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
            {rows.length === 0
              ? "You're all caught up. No open assignments."
              : "No assignments match your current filters."}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th className="w-6 pl-4" />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}>
                  Assignment
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}>
                  Due Date
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}>
                  Status
                </th>
                <th className="px-3 py-2.5 pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <TrainingRow key={`${row.trainingItem}-${i}`} row={row} sheetUrl={sheetFileId ? `https://docs.google.com/spreadsheets/d/${sheetFileId}` : null} />
              ))}
            </tbody>
          </table>

          {/* Row count */}
          <div className="px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
              {filtered.length} assignment{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== rows.length ? ` (filtered from ${rows.length})` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
