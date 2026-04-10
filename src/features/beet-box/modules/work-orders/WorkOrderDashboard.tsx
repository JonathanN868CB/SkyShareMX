import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, LayoutGrid, List, AlertTriangle, Loader2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import { getWorkOrders, updateWorkOrder } from "../../services"
import { WO_STATUS_LABELS, QUOTE_STATUS_LABELS } from "../../constants"
import type { WorkOrder, WOStatus, QuoteStatus, WOType } from "../../types"
import { WOStatusBadge, QuoteStatusBadge } from "../../shared/StatusBadge"

// ─── Work Order column/color maps ────────────────────────────────────────────
const WO_KANBAN_COLS: WOStatus[] = ["draft", "open", "waiting_on_parts", "in_review", "billing", "completed"]

const WO_COL_COLORS: Record<WOStatus, string> = {
  draft:            "border-zinc-700",
  open:             "border-blue-800/60",
  waiting_on_parts: "border-amber-800/60",
  in_review:        "border-purple-800/60",
  billing:          "border-orange-800/60",
  completed:        "border-emerald-800/60",
  void:             "border-red-900/40",
}

const WO_COL_HEADER_COLORS: Record<WOStatus, string> = {
  draft:            "text-zinc-400",
  open:             "text-blue-400",
  waiting_on_parts: "text-amber-400",
  in_review:        "text-purple-400",
  billing:          "text-orange-400",
  completed:        "text-emerald-400",
  void:             "text-red-400",
}

// ─── Quote column/color maps ─────────────────────────────────────────────────
const QUOTE_KANBAN_COLS: QuoteStatus[] = ["draft", "sent", "approved", "declined", "expired", "converted"]

const QUOTE_COL_COLORS: Record<QuoteStatus, string> = {
  draft:     "border-zinc-700",
  sent:      "border-blue-800/60",
  approved:  "border-emerald-800/60",
  declined:  "border-red-900/60",
  expired:   "border-amber-800/60",
  converted: "border-purple-800/60",
}

const QUOTE_COL_HEADER_COLORS: Record<QuoteStatus, string> = {
  draft:     "text-zinc-400",
  sent:      "text-blue-400",
  approved:  "text-emerald-400",
  declined:  "text-red-400",
  expired:   "text-amber-400",
  converted: "text-purple-400",
}

// ─── Dashboard wrapper ───────────────────────────────────────────────────────

export default function WorkOrderDashboard() {
  return (
    <div className="min-h-screen">
      <WorkOrderSection
        type="work_order"
        title="Work Orders"
        countNoun="work orders"
        createLabel="New Work Order"
        createPath="/app/beet-box/work-orders/new"
      />
      <div className="stripe-divider" />
      <WorkOrderSection
        type="quote"
        title="Customer Quotes"
        countNoun="quotes"
        createLabel="New Work Order Quote"
        createPath="/app/beet-box/work-orders/new?type=quote"
      />
    </div>
  )
}

// ─── Reusable section (renders once for WOs, once for Quotes) ────────────────

interface WorkOrderSectionProps {
  type: WOType
  title: string
  countNoun: string
  createLabel: string
  createPath: string
}

function WorkOrderSection({ type, title, countNoun, createLabel, createPath }: WorkOrderSectionProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<"kanban" | "list">("list")
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDesc, setEditingDesc] = useState("")

  const isQuote = type === "quote"

  function startEdit(wo: WorkOrder, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(wo.id)
    setEditingDesc(wo.description ?? "")
  }

  async function saveDesc(woId: string) {
    try {
      await updateWorkOrder(woId, { description: editingDesc })
      setRows(prev => prev.map(w => w.id === woId ? { ...w, description: editingDesc || null } : w))
    } catch { /* ignore */ }
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingDesc("")
  }

  useEffect(() => {
    getWorkOrders({ type })
      .then(setRows)
      .catch((err) => setError(err.message ?? `Failed to load ${countNoun}`))
      .finally(() => setLoading(false))
  }, [type, countNoun])

  // Stats — type-specific groupings
  const stats = isQuote
    ? [
        { label: "Draft",     value: rows.filter(r => r.quoteStatus === "draft").length,     color: "text-zinc-400" },
        { label: "Sent",      value: rows.filter(r => r.quoteStatus === "sent").length,      color: "text-blue-400" },
        { label: "Approved",  value: rows.filter(r => r.quoteStatus === "approved").length,  color: "text-emerald-400" },
        { label: "Declined",  value: rows.filter(r => r.quoteStatus === "declined").length,  color: "text-red-400" },
        { label: "Converted", value: rows.filter(r => r.quoteStatus === "converted").length, color: "text-purple-400" },
      ]
    : [
        { label: "Open",             value: rows.filter(w => w.status === "open").length,             color: "text-blue-400" },
        { label: "Waiting on Parts", value: rows.filter(w => w.status === "waiting_on_parts").length, color: "text-amber-400" },
        { label: "In Review",        value: rows.filter(w => w.status === "in_review").length,        color: "text-purple-400" },
        { label: "Billing",          value: rows.filter(w => w.status === "billing").length,          color: "text-orange-400" },
        { label: "Completed (MTD)",  value: rows.filter(w => w.status === "completed").length,        color: "text-emerald-400" },
      ]

  const activeCount = isQuote
    ? rows.filter(r => r.quoteStatus === "draft" || r.quoteStatus === "sent").length
    : rows.filter(w => w.status === "open" || w.status === "waiting_on_parts" || w.status === "in_review" || w.status === "billing").length

  return (
    <>
      {/* Hero */}
      <div
        className="hero-area flex items-center justify-between px-10"
        style={{ minHeight: "104px", margin: 0 }}
      >
        <div>
          <h1
            className="text-white mb-1.5"
            style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
          >
            {title}
          </h1>
          <p
            className="text-white/45 text-sm"
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
          >
            {loading ? "Loading…" : `${rows.length} total · ${activeCount} active`}
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
            onClick={() => navigate(createPath)}
            style={{ background: "var(--skyshare-gold)", color: "#000" }}
            className="font-semibold text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {createLabel}
          </Button>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-10 py-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-4">
          {stats.map(stat => (
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

        {/* Loading skeleton */}
        {loading && (
          <div className="card-elevated rounded-lg p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            <span className="text-white/30 text-sm">Loading {countNoun}…</span>
          </div>
        )}

        {/* KANBAN VIEW */}
        {!loading && view === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {isQuote
              ? QUOTE_KANBAN_COLS.map(col => {
                  const colRows = rows.filter(r => r.quoteStatus === col)
                  return (
                    <div key={col} className="flex-shrink-0 w-64">
                      <div className={cn("rounded-t border-t-2 px-3 py-2 bg-white/[0.03] flex items-center justify-between", QUOTE_COL_COLORS[col])}>
                        <span className={cn("text-xs font-bold tracking-widest uppercase", QUOTE_COL_HEADER_COLORS[col])} style={{ fontFamily: "var(--font-heading)" }}>
                          {QUOTE_STATUS_LABELS[col]}
                        </span>
                        <span className="text-xs text-white/30 font-mono">{colRows.length}</span>
                      </div>
                      <div className="space-y-2 mt-2 min-h-[80px]">
                        {colRows.map(wo => (
                          <KanbanCard
                            key={wo.id}
                            wo={wo}
                            editingId={editingId}
                            editingDesc={editingDesc}
                            setEditingDesc={setEditingDesc}
                            startEdit={startEdit}
                            saveDesc={saveDesc}
                            cancelEdit={cancelEdit}
                            navigate={navigate}
                          />
                        ))}
                        {colRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-white/10 h-16 flex items-center justify-center">
                            <span className="text-white/20 text-xs">Empty</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              : WO_KANBAN_COLS.map(col => {
                  const colRows = rows.filter(w => w.status === col)
                  return (
                    <div key={col} className="flex-shrink-0 w-64">
                      <div className={cn("rounded-t border-t-2 px-3 py-2 bg-white/[0.03] flex items-center justify-between", WO_COL_COLORS[col])}>
                        <span className={cn("text-xs font-bold tracking-widest uppercase", WO_COL_HEADER_COLORS[col])} style={{ fontFamily: "var(--font-heading)" }}>
                          {WO_STATUS_LABELS[col]}
                        </span>
                        <span className="text-xs text-white/30 font-mono">{colRows.length}</span>
                      </div>
                      <div className="space-y-2 mt-2 min-h-[80px]">
                        {colRows.map(wo => (
                          <KanbanCard
                            key={wo.id}
                            wo={wo}
                            editingId={editingId}
                            editingDesc={editingDesc}
                            setEditingDesc={setEditingDesc}
                            startEdit={startEdit}
                            saveDesc={saveDesc}
                            cancelEdit={cancelEdit}
                            navigate={navigate}
                          />
                        ))}
                        {colRows.length === 0 && (
                          <div className="rounded-lg border border-dashed border-white/10 h-16 flex items-center justify-center">
                            <span className="text-white/20 text-xs">Empty</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* LIST VIEW */}
        {!loading && view === "list" && (
          <div className="card-elevated rounded-lg overflow-hidden">
            {rows.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-white/30 text-sm">No {countNoun} yet.</p>
                <Button
                  size="sm"
                  onClick={() => navigate(createPath)}
                  className="mt-4 text-xs"
                  style={{ background: "var(--skyshare-gold)", color: "#000" }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> {isQuote ? "Create your first quote" : "Create your first work order"}
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                    {[isQuote ? "Quote #" : "WO #", "Aircraft", "Description", "Status", "Opened"].map(h => (
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
                  {rows.map((wo, idx) => (
                    <tr
                      key={wo.id}
                      onClick={() => navigate(`/app/beet-box/work-orders/${wo.id}`)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      style={{ borderBottom: idx < rows.length - 1 ? "1px solid hsl(0 0% 18%)" : "none" }}
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
                      <td className="px-4 py-3 text-white/80 text-sm" style={{ maxWidth: 360 }}>
                        {editingId === wo.id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              className="flex-1 bg-white/[0.07] text-white text-sm rounded-md px-3 py-2 border border-white/15 outline-none focus:border-[var(--skyshare-gold)]/50 transition-colors"
                              placeholder="e.g. Scheduled maintenance, 14-day check…"
                              value={editingDesc}
                              onChange={e => setEditingDesc(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveDesc(wo.id); if (e.key === "Escape") cancelEdit() }}
                            />
                            <button
                              onClick={() => saveDesc(wo.id)}
                              className="p-2 rounded-md transition-colors hover:bg-emerald-500/20"
                              title="Save"
                            >
                              <Check className="w-4 h-4 text-emerald-400" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 rounded-md transition-colors hover:bg-red-500/20"
                              title="Cancel"
                            >
                              <X className="w-4 h-4 text-white/40" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="line-clamp-1 flex-1">{wo.description ?? <span className="text-white/25 italic">No description</span>}</span>
                            <button
                              onClick={e => startEdit(wo, e)}
                              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                                         bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white/80
                                         border border-white/10 hover:border-white/20"
                              title="Edit description"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isQuote && wo.quoteStatus
                          ? <QuoteStatusBadge status={wo.quoteStatus} />
                          : <WOStatusBadge status={wo.status} />
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
    </>
  )
}

// ─── Kanban card (shared between WO and Quote kanbans) ──────────────────────

interface KanbanCardProps {
  wo: WorkOrder
  editingId: string | null
  editingDesc: string
  setEditingDesc: (v: string) => void
  startEdit: (wo: WorkOrder, e: React.MouseEvent) => void
  saveDesc: (woId: string) => void
  cancelEdit: () => void
  navigate: (path: string) => void
}

function KanbanCard({ wo, editingId, editingDesc, setEditingDesc, startEdit, saveDesc, cancelEdit, navigate }: KanbanCardProps) {
  return (
    <button
      onClick={() => navigate(`/app/beet-box/work-orders/${wo.id}`)}
      className="w-full text-left card-elevated card-hoverable rounded-lg p-3 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-white/70 text-xs font-mono">{wo.woNumber}</span>
      </div>
      {editingId === wo.id ? (
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <input
            autoFocus
            className="flex-1 bg-white/[0.07] text-white text-xs rounded px-2 py-1.5 border border-white/15 outline-none focus:border-[var(--skyshare-gold)]/50"
            placeholder="Description…"
            value={editingDesc}
            onChange={e => setEditingDesc(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveDesc(wo.id); if (e.key === "Escape") cancelEdit() }}
          />
          <button onClick={() => saveDesc(wo.id)} className="p-1 rounded hover:bg-emerald-500/20"><Check className="w-3 h-3 text-emerald-400" /></button>
          <button onClick={cancelEdit} className="p-1 rounded hover:bg-red-500/20"><X className="w-3 h-3 text-white/40" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <p className="text-white/85 text-xs leading-snug line-clamp-2 flex-1">{wo.description ?? <span className="text-white/25 italic">No description</span>}</p>
          <button
            onClick={e => startEdit(wo, e)}
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
            title="Edit description"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}
      <p className="text-white/35 text-xs">{wo.aircraft?.registration ?? wo.guestRegistration ?? "—"}</p>
    </button>
  )
}
