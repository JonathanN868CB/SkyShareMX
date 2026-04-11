import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, LayoutGrid, List, AlertTriangle, Loader2, Pencil, Check, X, Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import { getWorkOrders, updateWorkOrder, deleteWorkOrder } from "../../services"
import { useAuth } from "@/features/auth"
import { WO_STATUS_LABELS, QUOTE_STATUS_LABELS } from "../../constants"
import type { WorkOrder, WOStatus, QuoteStatus, WOType } from "../../types"
import { WOStatusBadge, QuoteStatusBadge } from "../../shared/StatusBadge"

// ─── Micro stat configs per tab type ─────────────────────────────────────────

const TAB_MICRO_STATS: Record<WOType, (rows: WorkOrder[]) => { label: string; count: number; color: string }[]> = {
  work_order:   rows => [
    { label: "Open",   count: rows.filter(r => r.status === "open").length,              color: "#60a5fa" },
    { label: "Parts",  count: rows.filter(r => r.status === "waiting_on_parts").length,  color: "#fbbf24" },
    { label: "Rev",    count: rows.filter(r => r.status === "in_review").length,         color: "#c084fc" },
    { label: "Bill",   count: rows.filter(r => r.status === "billing").length,           color: "#fb923c" },
  ],
  quote:        rows => [
    { label: "Draft",  count: rows.filter(r => r.quoteStatus === "draft").length,        color: "#a1a1aa" },
    { label: "Sent",   count: rows.filter(r => r.quoteStatus === "sent").length,         color: "#60a5fa" },
    { label: "Appr",   count: rows.filter(r => r.quoteStatus === "approved").length,     color: "#34d399" },
    { label: "Decl",   count: rows.filter(r => r.quoteStatus === "declined").length,     color: "#f87171" },
  ],
  change_order: rows => [
    { label: "Draft",  count: rows.filter(r => r.quoteStatus === "draft").length,        color: "#a1a1aa" },
    { label: "Sent",   count: rows.filter(r => r.quoteStatus === "sent").length,         color: "#60a5fa" },
    { label: "Appr",   count: rows.filter(r => r.quoteStatus === "approved").length,     color: "#34d399" },
    { label: "Decl",   count: rows.filter(r => r.quoteStatus === "declined").length,     color: "#f87171" },
  ],
}

// ─── Status column/color maps ─────────────────────────────────────────────────

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

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: {
  type:        WOType
  label:       string
  countNoun:   string
  createLabel?: string
  createPath?:  string
}[] = [
  { type: "work_order",   label: "Work Orders",    countNoun: "work orders", createLabel: "New Work Order",  createPath: "/app/beet-box/work-orders/new"           },
  { type: "quote",        label: "Customer Quotes", countNoun: "quotes",      createLabel: "New Quote",       createPath: "/app/beet-box/work-orders/new?type=quote" },
  { type: "change_order", label: "Change Orders",  countNoun: "change orders"                                                                                      },
]

// ─── Dashboard wrapper ────────────────────────────────────────────────────────

export default function WorkOrderDashboard() {
  const navigate = useNavigate()
  const [activeType,   setActiveType]   = useState<WOType>("work_order")
  const [tabRows,      setTabRows]      = useState<Record<WOType, WorkOrder[]>>({ work_order: [], quote: [], change_order: [] })
  const [countsLoaded, setCountsLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      getWorkOrders({ type: "work_order" }),
      getWorkOrders({ type: "quote" }),
      getWorkOrders({ type: "change_order" }),
    ]).then(([wos, quotes, cos]) => {
      setTabRows({ work_order: wos, quote: quotes, change_order: cos })
      setCountsLoaded(true)
    }).catch(() => setCountsLoaded(true))
  }, [])

  const tab = TABS.find(t => t.type === activeType)!

  return (
    <div className="min-h-screen">

      {/* ── Shared hero + tab bar ── */}
      <div
        className="hero-area flex items-end justify-between px-10 pb-0"
        style={{ minHeight: "100px", margin: 0 }}
      >
        {/* Left: title + tabs */}
        <div className="flex flex-col gap-3">
          <h1
            className="text-white"
            style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "0.05em", lineHeight: 1 }}
          >
            {tab.label.toUpperCase()}
          </h1>

          {/* Tab switcher */}
          <div className="flex items-end gap-1">
            {TABS.map(t => {
              const isActive    = t.type === activeType
              const microStats  = TAB_MICRO_STATS[t.type](tabRows[t.type])
              return (
                <button
                  key={t.type}
                  onClick={() => setActiveType(t.type)}
                  className={cn(
                    "flex flex-col items-center gap-2 px-5 pb-2.5 pt-3 rounded-t-md transition-all",
                    isActive ? "text-white" : "text-white/40 hover:text-white/65 hover:bg-white/[0.04]"
                  )}
                  style={{
                    minWidth: "195px",
                    ...(isActive ? {
                      background: "rgba(212,160,23,0.08)",
                      boxShadow:  "inset 0 -2px 0 var(--skyshare-gold)",
                    } : {}),
                  }}
                >
                  {/* Label */}
                  <span
                    className="text-xs font-semibold uppercase tracking-widest leading-none"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {t.label}
                  </span>

                  {/* Micro stat strip */}
                  <div className={cn("flex items-center gap-0.5 transition-opacity", isActive ? "opacity-100" : "opacity-40")}>
                    {!countsLoaded ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin opacity-40" />
                    ) : (
                      microStats.map((s, i) => (
                        <span key={s.label} className="flex items-center">
                          {i > 0 && (
                            <span className="mx-1.5 text-white/20" style={{ fontSize: "9px" }}>·</span>
                          )}
                          <span className="flex items-center gap-[3px]">
                            <span style={{ color: s.color, fontSize: "8px", lineHeight: 1 }}>●</span>
                            <span
                              className="font-mono leading-none"
                              style={{ fontSize: "12px", color: s.color }}
                            >
                              {s.count}
                            </span>
                            <span
                              className="leading-none ml-[2px]"
                              style={{
                                fontSize: "10px",
                                color: "rgba(255,255,255,0.38)",
                                fontFamily: "var(--font-heading)",
                                letterSpacing: "0.04em",
                              }}
                            >
                              {s.label}
                            </span>
                          </span>
                        </span>
                      ))
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: create button */}
        {tab.createLabel && tab.createPath && (
          <div className="pb-3">
            <Button
              size="sm"
              onClick={() => navigate(tab.createPath!)}
              style={{ background: "var(--skyshare-gold)", color: "#000" }}
              className="font-semibold text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {tab.createLabel}
            </Button>
          </div>
        )}
      </div>

      <div className="stripe-divider" />

      {/* Active section — key forces remount on tab switch */}
      <WorkOrderSection
        key={activeType}
        type={activeType}
        countNoun={tab.countNoun}
        createLabel={tab.createLabel}
        createPath={tab.createPath}
      />

    </div>
  )
}

// ─── Section (stats + list/kanban) ───────────────────────────────────────────

interface WorkOrderSectionProps {
  type:         WOType
  countNoun:    string
  createLabel?: string
  createPath?:  string
}

function WorkOrderSection({ type, countNoun, createLabel, createPath }: WorkOrderSectionProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [view,          setView]          = useState<"kanban" | "list">("list")
  const [rows,          setRows]          = useState<WorkOrder[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [editingDesc,   setEditingDesc]   = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)

  const isQuote = type === "quote"
  const isCO    = type === "change_order"

  const canDelete = isQuote && ["Manager", "Admin", "Super Admin"].includes(profile?.role ?? "")

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

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await deleteWorkOrder(id)
      setRows(prev => prev.filter(r => r.id !== id))
    } catch {
      setError("Failed to delete quote. Try again.")
    } finally {
      setDeleting(null)
      setDeleteConfirm(null)
    }
  }

  useEffect(() => {
    getWorkOrders({ type })
      .then(setRows)
      .catch(err => setError(err.message ?? `Failed to load ${countNoun}`))
      .finally(() => setLoading(false))
  }, [type, countNoun])

  // Stats
  const stats = isQuote || isCO
    ? [
        { label: "Draft",     value: rows.filter(r => r.quoteStatus === "draft").length,     color: "text-zinc-400"    },
        { label: "Sent",      value: rows.filter(r => r.quoteStatus === "sent").length,      color: "text-blue-400"    },
        { label: "Approved",  value: rows.filter(r => r.quoteStatus === "approved").length,  color: "text-emerald-400" },
        { label: "Declined",  value: rows.filter(r => r.quoteStatus === "declined").length,  color: "text-red-400"     },
        ...(!isCO ? [{ label: "Converted", value: rows.filter(r => r.quoteStatus === "converted").length, color: "text-purple-400" }] : []),
      ]
    : [
        { label: "Open",             value: rows.filter(w => w.status === "open").length,             color: "text-blue-400"    },
        { label: "Waiting on Parts", value: rows.filter(w => w.status === "waiting_on_parts").length, color: "text-amber-400"   },
        { label: "In Review",        value: rows.filter(w => w.status === "in_review").length,        color: "text-purple-400"  },
        { label: "Billing",          value: rows.filter(w => w.status === "billing").length,          color: "text-orange-400"  },
        { label: "Completed (MTD)",  value: rows.filter(w => w.status === "completed").length,        color: "text-emerald-400" },
      ]

  const activeCount = isQuote || isCO
    ? rows.filter(r => r.quoteStatus === "draft" || r.quoteStatus === "sent").length
    : rows.filter(w => ["open", "waiting_on_parts", "in_review", "billing"].includes(w.status)).length

  return (
    <div className="px-10 py-6 space-y-6">

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {/* Count + view toggle row */}
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-xs" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
          {loading ? "Loading…" : `${rows.length} total · ${activeCount} active`}
        </p>
        <div className="flex rounded overflow-hidden" style={{ border: "1px solid hsl(0 0% 22%)" }}>
          <button
            onClick={() => setView("list")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors", view === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70")}
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setView("kanban")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors", view === "kanban" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70")}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className={cn("grid gap-4", stats.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
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
          {(isQuote || isCO ? QUOTE_KANBAN_COLS : WO_KANBAN_COLS).map(col => {
            const colRows = isQuote || isCO
              ? rows.filter(r => r.quoteStatus === col)
              : rows.filter(w => w.status === col)
            const colColor  = isQuote || isCO ? QUOTE_COL_COLORS[col as QuoteStatus]        : WO_COL_COLORS[col as WOStatus]
            const colHeader = isQuote || isCO ? QUOTE_COL_HEADER_COLORS[col as QuoteStatus]  : WO_COL_HEADER_COLORS[col as WOStatus]
            const colLabel  = isQuote || isCO ? QUOTE_STATUS_LABELS[col as QuoteStatus]      : WO_STATUS_LABELS[col as WOStatus]
            return (
              <div key={col} className="flex-shrink-0 w-64">
                <div className={cn("rounded-t border-t-2 px-3 py-2 bg-white/[0.03] flex items-center justify-between", colColor)}>
                  <span className={cn("text-xs font-bold tracking-widest uppercase", colHeader)} style={{ fontFamily: "var(--font-heading)" }}>
                    {colLabel}
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
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {!loading && view === "list" && (
        <div className="card-elevated rounded-lg overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-white/30 text-sm">No {countNoun} yet.</p>
              {isCO && (
                <p className="text-white/20 text-xs">Change orders are created from inside a work order when discrepancies are found.</p>
              )}
              {createLabel && createPath && (
                <Button
                  size="sm"
                  onClick={() => navigate(createPath)}
                  className="text-xs"
                  style={{ background: "var(--skyshare-gold)", color: "#000" }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> {createLabel}
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                  {[isCO ? "CO #" : isQuote ? "Quote #" : "WO #", "Aircraft", "Description", "Status", "Opened"].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-white/40 text-xs uppercase tracking-widest"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {h}
                    </th>
                  ))}
                  {canDelete && <th className="px-4 py-3 w-10" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((wo, idx) => {
                  const isConverted   = wo.quoteStatus === "converted"
                  const isConfirming  = deleteConfirm === wo.id
                  const isDeletingRow = deleting === wo.id
                  return (
                    <tr
                      key={wo.id}
                      onClick={() => !isConfirming && navigate(`/app/beet-box/work-orders/${wo.id}`)}
                      className={cn("transition-colors", isConfirming ? "bg-red-950/20 cursor-default" : "cursor-pointer hover:bg-white/[0.04]")}
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
                              placeholder="e.g. Scheduled maintenance…"
                              value={editingDesc}
                              onChange={e => setEditingDesc(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveDesc(wo.id); if (e.key === "Escape") cancelEdit() }}
                            />
                            <button onClick={() => saveDesc(wo.id)} className="p-2 rounded-md transition-colors hover:bg-emerald-500/20" title="Save">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </button>
                            <button onClick={cancelEdit} className="p-2 rounded-md transition-colors hover:bg-red-500/20" title="Cancel">
                              <X className="w-4 h-4 text-white/40" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="line-clamp-1 flex-1">{wo.description ?? <span className="text-white/25 italic">No description</span>}</span>
                            {!isCO && (
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
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(isQuote || isCO) && wo.quoteStatus
                          ? <QuoteStatusBadge status={wo.quoteStatus} />
                          : <WOStatusBadge status={wo.status} />
                        }
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {new Date(wo.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>

                      {/* Delete action cell — quotes only, Manager+ */}
                      {canDelete && (
                        <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                          {isConverted ? (
                            <span className="text-white/15 text-[10px]" title="Converted quotes cannot be deleted">—</span>
                          ) : isConfirming ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[10px] text-red-300/80 uppercase tracking-wider font-semibold whitespace-nowrap">
                                Delete forever?
                              </span>
                              <button
                                disabled={isDeletingRow}
                                onClick={() => handleDelete(wo.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide
                                           bg-red-600/80 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                              >
                                {isDeletingRow ? <Loader2 className="w-3 h-3 animate-spin" /> : "Yes, Delete"}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 rounded text-[10px] text-white/50 hover:text-white/80 transition-colors bg-white/[0.05] hover:bg-white/[0.1]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(wo.id)}
                              className="p-1.5 rounded transition-colors text-white/20 hover:text-red-400 hover:bg-red-500/10"
                              title="Delete quote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

interface KanbanCardProps {
  wo:             WorkOrder
  editingId:      string | null
  editingDesc:    string
  setEditingDesc: (v: string) => void
  startEdit:      (wo: WorkOrder, e: React.MouseEvent) => void
  saveDesc:       (woId: string) => void
  cancelEdit:     () => void
  navigate:       (path: string) => void
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
          <p className="text-white/85 text-xs leading-snug line-clamp-2 flex-1">
            {wo.description ?? <span className="text-white/25 italic">No description</span>}
          </p>
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
