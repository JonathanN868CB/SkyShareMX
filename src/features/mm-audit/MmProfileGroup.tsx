import { useState } from "react"
import { ChevronRight } from "lucide-react"
import type { AuditProfileGroup, AuditStatus } from "./types"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

const statusStyle: Record<AuditStatus, { bg: string; color: string; label: string }> = {
  current:       { bg: "rgba(16,185,129,0.1)",  color: "#10b981", label: "Current" },
  due_soon:      { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", label: "Due Soon" },
  overdue:       { bg: "rgba(239,68,68,0.1)",   color: "#f87171", label: "Overdue" },
  never_audited: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", label: "Never Audited" },
}

function AuditStatusChip({ status }: { status: AuditStatus }) {
  const s = statusStyle[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
      style={{ background: s.bg, color: s.color, fontFamily: "var(--font-heading)" }}
    >
      {s.label}
    </span>
  )
}

export default function MmProfileGroup({ group }: { group: AuditProfileGroup }) {
  const [expanded, setExpanded] = useState(false)

  // Determine worst status in group
  const worstStatus = group.aircraft.reduce<AuditStatus>((worst, a) => {
    const order: AuditStatus[] = ["current", "due_soon", "never_audited", "overdue"]
    return order.indexOf(a.status) > order.indexOf(worst) ? a.status : worst
  }, "current")

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${rgba(0.1)}` }}
    >
      {/* Group Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: rgba(0.03) }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => (e.currentTarget.style.background = rgba(0.06))}
        onMouseLeave={e => (e.currentTarget.style.background = rgba(0.03))}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
            style={{ color: C, transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          <span
            className="text-xs font-semibold truncate"
            style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.85)" }}
          >
            {group.display_name}
          </span>
          <span className="text-[11px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
            {group.aircraft.length} aircraft · {group.documents.length} docs
          </span>
        </div>
        <AuditStatusChip status={worstStatus} />
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-3">
          {/* Aircraft list */}
          <div className="flex flex-wrap gap-1.5">
            {group.aircraft.map(a => (
              <span
                key={a.aircraft_id}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px]"
                style={{ background: rgba(0.06), color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-heading)" }}
              >
                {a.registration}
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: statusStyle[a.status].color }}
                />
              </span>
            ))}
          </div>

          {/* Document table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${rgba(0.1)}` }}>
                  {["Assembly", "Req Type", "Source Document", "Section", "Current Rev"].map(h => (
                    <th
                      key={h}
                      className="text-left py-1.5 pr-3"
                      style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.documents.map(d => (
                  <tr key={d.id} style={{ borderBottom: `1px solid ${rgba(0.05)}` }}>
                    <td className="py-1.5 pr-3 capitalize">{d.assembly_type}</td>
                    <td className="py-1.5 pr-3">{d.requirement_type === "awl" ? "AWL" : "Sched Mx"}</td>
                    <td className="py-1.5 pr-3">
                      <span style={{ color: "rgba(255,255,255,0.85)" }}>{d.source_document.document_name}</span>
                    </td>
                    <td className="py-1.5 pr-3">{d.section ?? "—"}</td>
                    <td className="py-1.5 pr-3">
                      <span style={{ color: C }}>{d.source_document.current_revision}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
