import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, LayoutGrid, List, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import { getWorkOrders } from "../../services"
import { WO_STATUS_LABELS } from "../../constants"
import type { WorkOrder, WOStatus } from "../../types"
import { WOStatusBadge, PriorityBadge } from "../../shared/StatusBadge"

const KANBAN_COLS: WOStatus[] = ["draft", "open", "waiting_on_parts", "in_review", "billing", "completed"]

const COL_COLORS: Record<WOStatus, string> = {
  draft:            "border-zinc-700",
  open:             "border-blue-800/60",
  waiting_on_parts: "border-amber-800/60",
  in_review:        "border-purple-800/60",
  billing:          "border-orange-800/60",
  completed:        "border-emerald-800/60",
  void:             "border-red-900/40",
}

const COL_HEADER_COLORS: Record<WOStatus, string> = {
  draft:            "text-zinc-400",
  open:             "text-blue-400",
  waiting_on_parts: "text-amber-400",
  in_review:        "text-purple-400",
  billing:          "text-orange-400",
  completed:        "text-emerald-400",
  void:             "text-red-400",
}

export default function WorkOrderDashboard() {
  const navigate = useNavigate()
  const [view, setView] = useState<"kanban" | "list">("list")
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWorkOrders()
      .then(setWorkOrders)
      .catch((err) => setError(err.message ?? "Failed to load work orders"))
      .finally(() => setLoading(false))
  }, [])

  const open    = workOrders.filter(w => w.status === "open").length
  const waiting = workOrders.filter(w => w.status === "waiting_on_parts").length
  const review  = workOrders.filter(w => w.status === "in_review").length
  const billing = workOrders.filter(w => w.status === "billing").length
  const done    = workOrders.filter(w => w.status === "completed").length
  const aog     = workOrders.filter(w => w.priority === "aog").length

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-white mb-1"
              style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
            >
              Work Orders
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading…" : `${workOrders.length} total · ${open + waiting + review + billing} active`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div
              className="flex rounded overflow-hidden"
              style={{ border: "1px solid hsl(0 0% 22%)" }}
            >
              <button
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                  view === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                  view === "kanban" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Kanban
              </button>
            </div>
            <Button
              size="sm"
              onClick={() => navigate("/app/beet-box/work-orders/new")}
              style={{ background: "var(--skyshare-gold)", color: "#000" }}
              className="font-semibold text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Work Order
            </Button>
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Open",             value: open,    color: "text-blue-400"    },
            { label: "Waiting on Parts", value: waiting, color: "text-amber-400"   },
            { label: "In Review",        value: review,  color: "text-purple-400"  },
            { label: "Billing",          value: billing, color: "text-orange-400"  },
            { label: "Completed (MTD)",  value: done,    color: "text-emerald-400" },
          ].map(stat => (
            <div key={stat.label} className="card-elevated rounded-lg p-4">
              <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>
                {stat.label}
              </p>
              <p className={cn("text-3xl font-bold", stat.color)} style={{ fontFamily: "var(--font-display)" }}>
                {loading ? <Loader2 className="w-6 h-6 animate-spin opacity-40" /> : stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* AOG alert */}
        {!loading && aog > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm font-medium">{aog} aircraft on ground (AOG) — immediate attention required</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="card-elevated rounded-lg p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            <span className="text-white/30 text-sm">Loading work orders…</span>
          </div>
        )}

        {/* KANBAN VIEW */}
        {!loading && view === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {KANBAN_COLS.map(col => {
              const wos = workOrders.filter(w => w.status === col)
              return (
                <div key={col} className="flex-shrink-0 w-64">
                  <div className={cn("rounded-t border-t-2 px-3 py-2 bg-white/[0.03] flex items-center justify-between", COL_COLORS[col])}>
                    <span className={cn("text-xs font-bold tracking-widest uppercase", COL_HEADER_COLORS[col])} style={{ fontFamily: "var(--font-heading)" }}>
                      {WO_STATUS_LABELS[col]}
                    </span>
                    <span className="text-xs text-white/30 font-mono">{wos.length}</span>
                  </div>
                  <div className="space-y-2 mt-2 min-h-[80px]">
                    {wos.map(wo => (
                      <button
                        key={wo.id}
                        onClick={() => navigate(`/app/beet-box/work-orders/${wo.id}`)}
                        className="w-full text-left card-elevated card-hoverable rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-white/70 text-xs font-mono">{wo.woNumber}</span>
                          <PriorityBadge priority={wo.priority} />
                        </div>
                        <p className="text-white/85 text-xs leading-snug line-clamp-2">{wo.woType}</p>
                        <p className="text-white/35 text-xs">{wo.aircraft?.registration ?? wo.guestRegistration ?? "—"}</p>
                      </button>
                    ))}
                    {wos.length === 0 && (
                      <div className="rounded-lg border border-dashed border-white/10 h-16 flex items-center justify-center">
                        <span className="text-white/20 text-xs">Empty</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {!loading && view === "list" && (
          <div className="card-elevated rounded-lg overflow-hidden">
            {workOrders.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-white/30 text-sm">No work orders yet.</p>
                <Button
                  size="sm"
                  onClick={() => navigate("/app/beet-box/work-orders/new")}
                  className="mt-4 text-xs"
                  style={{ background: "var(--skyshare-gold)", color: "#000" }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Create your first work order
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                    {["WO #", "Aircraft", "Type", "Priority", "Status", "Assigned", "Opened"].map(h => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-white/40 text-xs uppercase tracking-widest"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((wo, idx) => (
                    <tr
                      key={wo.id}
                      onClick={() => navigate(`/app/beet-box/work-orders/${wo.id}`)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      style={{ borderBottom: idx < workOrders.length - 1 ? "1px solid hsl(0 0% 18%)" : "none" }}
                    >
                      <td className="px-4 py-3 font-mono text-white/70 text-xs">{wo.woNumber}</td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
                        >
                          {wo.aircraft?.registration ?? wo.guestRegistration ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/80 text-sm max-w-[220px]">
                        <span className="line-clamp-1">{wo.woType}</span>
                      </td>
                      <td className="px-4 py-3"><PriorityBadge priority={wo.priority} /></td>
                      <td className="px-4 py-3"><WOStatusBadge status={wo.status} /></td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        {wo.mechanics.length > 0
                          ? wo.mechanics.length === 1
                            ? wo.mechanics[0].name
                            : `${wo.mechanics[0].name} +${wo.mechanics.length - 1}`
                          : <span className="text-white/25">Unassigned</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {new Date(wo.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
