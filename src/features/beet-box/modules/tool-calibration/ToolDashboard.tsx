import { useNavigate } from "react-router-dom"
import { AlertTriangle, Clock, CheckCircle } from "lucide-react"
import { TOOLS } from "../../data/mockData"
import { ToolStatusBadge } from "../../shared/StatusBadge"

export default function ToolDashboard() {
  const navigate = useNavigate()

  const current  = TOOLS.filter(t => t.status === "active").length
  const dueSoon  = TOOLS.filter(t => t.status === "due_soon").length
  const overdue  = TOOLS.filter(t => t.status === "overdue").length
  const oos      = TOOLS.filter(t => t.status === "out_of_service").length

  const grouped = {
    overdue:  TOOLS.filter(t => t.status === "overdue"),
    due_soon: TOOLS.filter(t => t.status === "due_soon"),
    active:   TOOLS.filter(t => t.status === "active"),
    other:    TOOLS.filter(t => t.status === "out_of_service" || t.status === "retired"),
  }

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
          Tool Calibration
        </h1>
        <p className="text-white/45 text-sm">{TOOLS.length} calibrated tools tracked</p>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Current",   value: current, color: "text-emerald-400", icon: CheckCircle  },
            { label: "Due Soon",  value: dueSoon, color: "text-amber-400",   icon: Clock         },
            { label: "Overdue",   value: overdue, color: "text-red-400",     icon: AlertTriangle },
            { label: "Out of Svc",value: oos,     color: "text-red-500",     icon: AlertTriangle },
          ].map(s => (
            <div key={s.label} className="card-elevated rounded-lg p-4 flex items-center gap-4">
              <s.icon className={`w-8 h-8 flex-shrink-0 ${s.color} opacity-40`} />
              <div>
                <p className="text-white/40 text-xs tracking-wide uppercase" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
                <p className={`text-3xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Alert banner */}
        {overdue > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm font-medium">
              {overdue} tool{overdue > 1 ? "s" : ""} with overdue calibration — these tools must not be used for FAA-tracked work
            </span>
          </div>
        )}

        {/* Grouped tool lists */}
        {[
          { key: "overdue",  label: "Overdue",          headerColor: "text-red-400",     borderColor: "border-red-900/40" },
          { key: "due_soon", label: "Due Within 30 Days",headerColor: "text-amber-400",   borderColor: "border-amber-900/40" },
          { key: "active",   label: "Current",          headerColor: "text-emerald-400",  borderColor: "border-emerald-900/20" },
          { key: "other",    label: "Out of Service / Retired", headerColor: "text-zinc-500", borderColor: "border-zinc-700/40" },
        ].map(group => {
          const tools = grouped[group.key as keyof typeof grouped]
          if (tools.length === 0) return null
          return (
            <div key={group.key}>
              <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${group.headerColor}`} style={{ fontFamily: "var(--font-heading)" }}>
                {group.label} ({tools.length})
              </h3>
              <div className="card-elevated rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                      {["Tool #", "Description", "S/N", "Location", "Last Cal.", "Next Due", "Cal. Interval", "Status"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tools.map((tool, idx) => {
                      const nextDue = new Date(tool.nextCalibrationDue)
                      const today = new Date()
                      const daysUntil = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      return (
                        <tr
                          key={tool.id}
                          onClick={() => navigate(`/app/beet-box/tool-calibration/${tool.id}`)}
                          className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                          style={{ borderBottom: idx < tools.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                        >
                          <td className="px-4 py-3 font-mono text-white/70 text-xs font-semibold">{tool.toolNumber}</td>
                          <td className="px-4 py-3 text-white/80 text-sm max-w-[200px]"><span className="line-clamp-1">{tool.description}</span></td>
                          <td className="px-4 py-3 text-white/40 text-xs font-mono">{tool.serialNumber}</td>
                          <td className="px-4 py-3 text-white/50 text-xs">{tool.location}</td>
                          <td className="px-4 py-3 text-white/50 text-xs">
                            {new Date(tool.lastCalibratedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={
                              daysUntil < 0 ? "text-red-400 font-semibold" :
                              daysUntil <= 30 ? "text-amber-400 font-semibold" :
                              "text-white/60"
                            }>
                              {new Date(tool.nextCalibrationDue).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                              {daysUntil < 0 && <span className="ml-1 text-[10px]">({Math.abs(daysUntil)}d ago)</span>}
                              {daysUntil >= 0 && daysUntil <= 30 && <span className="ml-1 text-[10px]">({daysUntil}d)</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/40 text-xs">{tool.calibrationIntervalDays}d</td>
                          <td className="px-4 py-3"><ToolStatusBadge status={tool.status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
