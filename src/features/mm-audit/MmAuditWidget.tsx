import { Shield } from "lucide-react"
import { useMmFleetOverview } from "./useMmAuditData"
import type { AuditStatus } from "./types"

const statusStyle: Record<AuditStatus, { color: string; label: string }> = {
  current:       { color: "#10b981", label: "Current" },
  due_soon:      { color: "#f59e0b", label: "Due Soon" },
  overdue:       { color: "#f87171", label: "Overdue" },
  never_audited: { color: "rgba(255,255,255,0.4)", label: "Never Audited" },
}

export default function MmAuditWidget({ aircraftId }: { aircraftId: string }) {
  const { data, isLoading } = useMmFleetOverview()

  if (isLoading || !data) return null

  const summary = data.summaries.find(s => s.aircraft_id === aircraftId)
  if (!summary) return null

  const s = statusStyle[summary.status]

  // Find next due date from the aircraft's rows
  const aircraftRows = data.rows.filter(r => r.aircraft_id === aircraftId)
  const nextDue = aircraftRows
    .filter(r => r.latest_audit?.next_due_date)
    .map(r => r.latest_audit!.next_due_date)
    .sort()[0]

  return (
    <div
      className="mx-5 mb-3 rounded-lg px-3 py-2.5"
      style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.1)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Shield className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ fontFamily: "var(--font-heading)", color: "rgba(167,139,250,0.7)" }}
        >
          MM Audit Status
        </span>
        <span
          className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
          style={{ background: `${s.color}1a`, color: s.color, fontFamily: "var(--font-heading)" }}
        >
          {s.label}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[12px]" style={{ color: "rgba(255,255,255,0.6)" }}>
        <span>
          <strong style={{ color: "rgba(255,255,255,0.85)" }}>{summary.audited_docs}</strong>/{summary.total_docs} audited
        </span>
        {summary.overdue_docs > 0 && (
          <span style={{ color: "#f87171" }}>{summary.overdue_docs} overdue</span>
        )}
        {nextDue && (
          <span>Next due: <strong style={{ color: "rgba(255,255,255,0.85)" }}>{nextDue}</strong></span>
        )}
      </div>
    </div>
  )
}
