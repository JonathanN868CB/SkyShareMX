import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  DollarSign, AlertTriangle, ShoppingCart, PackageCheck,
  ArrowRight, TrendingUp, BarChart3, Zap, Loader2, Package, Clock,
} from "lucide-react"
import {
  getPartsOverviewStats,
  getReorderAlerts,
  getRecentReceivingActivity,
  getTransactionSummary,
} from "../../services/partsOverview"
import { autoGenerateReorderPOs } from "../../services/automation"
import type {
  PartsOverviewStats,
  ReorderAlert,
  RecentReceiving,
} from "../../services/partsOverview"
import { useAuth } from "@/features/auth"
import { supabase } from "@/lib/supabase"

interface AwaitingPORequest {
  id: string
  requested_by: string
  aircraft_tail: string | null
  work_order: string | null
  job_description: string
  date_needed: string
  aog: boolean
  order_type: string
  line_count: number
  lines: Array<{
    id: string
    part_number: string
    description: string | null
    quantity: number
  }>
}

const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  overhauled: "OH",
  serviceable: "SVC",
  as_removed: "AR",
}

export default function PartsOverview() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [stats, setStats] = useState<PartsOverviewStats | null>(null)
  const [alerts, setAlerts] = useState<ReorderAlert[]>([])
  const [receiving, setReceiving] = useState<RecentReceiving[]>([])
  const [txnSummary, setTxnSummary] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [generatingPOs, setGeneratingPOs] = useState(false)
  const [poResults, setPOResults] = useState<Array<{ poNumber: string; vendorName: string; lineCount: number }> | null>(null)
  const [awaitingPO, setAwaitingPO] = useState<AwaitingPORequest[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [s, a, r, t] = await Promise.all([
          getPartsOverviewStats(),
          getReorderAlerts(),
          getRecentReceivingActivity(10),
          getTransactionSummary(30),
        ])
        setStats(s)
        setAlerts(a)
        setReceiving(r)
        setTxnSummary(t)
      } catch (err) {
        console.error("Failed to load parts overview:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    async function loadAwaitingPO() {
      const { data } = await supabase
        .from("parts_requests")
        .select("id, requested_by, aircraft_tail, work_order, job_description, date_needed, aog, order_type, parts_request_lines(id, part_number, description, quantity)")
        .in("status", ["approved", "sourcing"])
        .order("aog", { ascending: false })
        .order("date_needed", { ascending: true })

      if (!data) return

      setAwaitingPO(data.map((r: any) => ({
        id: r.id,
        requested_by: r.requested_by,
        aircraft_tail: r.aircraft_tail,
        work_order: r.work_order,
        job_description: r.job_description,
        date_needed: r.date_needed,
        aog: r.aog,
        order_type: r.order_type,
        line_count: (r.parts_request_lines ?? []).length,
        lines: (r.parts_request_lines ?? []).map((l: any) => ({
          id: l.id,
          part_number: l.part_number,
          description: l.description,
          quantity: l.quantity,
        })),
      })))
    }
    loadAwaitingPO()
  }, [])

  const totalTxns = Object.values(txnSummary).reduce((s, n) => s + n, 0)

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
              Parts Overview
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : "Inventory health, purchasing & receiving at a glance"}
            </p>
          </div>
          <BarChart3 className="w-8 h-8 text-white/15" />
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-white/30 text-sm">Loading parts overview...</div>
        ) : (
          <>
            {/* ── Awaiting PO Action Queue ─────────────────────────────── */}
            {awaitingPO.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-3.5 h-3.5" style={{ color: "rgba(212,160,23,0.8)" }} />
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "rgba(212,160,23,0.8)", fontFamily: "var(--font-heading)" }}
                  >
                    Awaiting Purchase Order
                  </span>
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: "rgba(212,160,23,0.15)", color: "rgba(212,160,23,0.8)" }}
                  >
                    {awaitingPO.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {awaitingPO.map(req => {
                    const label = req.order_type === "stock"
                      ? `Stock — ${req.job_description}`
                      : `${req.aircraft_tail} — ${req.job_description}`
                    const dateNeeded = new Date(req.date_needed + "T00:00:00")
                    const today = new Date()
                    const daysUntil = Math.ceil((dateNeeded.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                    const isUrgent = daysUntil <= 3

                    return (
                      <div
                        key={req.id}
                        className="flex items-center gap-4 px-4 py-3 rounded-lg"
                        style={{
                          background: req.aog ? "rgba(255,60,60,0.05)" : "rgba(255,255,255,0.03)",
                          border: req.aog ? "1px solid rgba(255,60,60,0.2)" : "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        {req.aog && (
                          <span
                            className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide"
                            style={{ background: "rgba(255,60,60,0.2)", color: "rgba(255,100,100,0.9)" }}
                          >
                            AOG
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
                            {label}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {req.work_order && (
                              <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>WO# {req.work_order}</span>
                            )}
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                              {req.line_count} part{req.line_count !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: isUrgent ? "rgba(255,150,50,0.8)" : "rgba(255,255,255,0.35)" }}>
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">
                            {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? "Today" : `${daysUntil}d`}
                          </span>
                        </div>
                        <button
                          onClick={() => navigate("/app/beet-box/purchase-orders/new", {
                            state: {
                              fromRequest: {
                                requestId: req.id,
                                requestedBy: req.requested_by,
                                woRef: req.work_order ?? "",
                                dateNeeded: req.date_needed,
                                jobDescription: req.job_description,
                                lines: req.lines.map(l => ({
                                  requestLineId: l.id,
                                  partNumber: l.part_number,
                                  description: l.description ?? "",
                                  qty: l.quantity,
                                  catalogId: null,
                                }))
                              }
                            }
                          })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold flex-shrink-0 transition-colors"
                          style={{
                            background: "rgba(212,160,23,0.12)",
                            border: "1px solid rgba(212,160,23,0.3)",
                            color: "rgba(212,160,23,0.9)",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,160,23,0.2)" }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(212,160,23,0.12)" }}
                        >
                          <Package className="w-3.5 h-3.5" />
                          Create PO
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Stat Cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Inventory Value",
                  value: `$${(stats?.totalValue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  icon: DollarSign,
                  color: "text-white",
                  iconColor: "text-emerald-400",
                },
                {
                  label: "Below Reorder",
                  value: stats?.belowReorder ?? 0,
                  icon: AlertTriangle,
                  color: (stats?.belowReorder ?? 0) > 0 ? "text-amber-400" : "text-emerald-400",
                  iconColor: (stats?.belowReorder ?? 0) > 0 ? "text-amber-400" : "text-emerald-400",
                },
                {
                  label: "Open POs",
                  value: stats?.openPOs ?? 0,
                  icon: ShoppingCart,
                  color: "text-blue-400",
                  iconColor: "text-blue-400",
                },
                {
                  label: "Receipts This Month",
                  value: stats?.receiptsThisMonth ?? 0,
                  icon: PackageCheck,
                  color: "text-emerald-400",
                  iconColor: "text-emerald-400",
                },
              ].map(s => (
                <div key={s.label} className="card-elevated rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p
                      className="text-white/40 text-xs tracking-wide uppercase"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {s.label}
                    </p>
                    <s.icon className={`w-4 h-4 ${s.iconColor} opacity-60`} />
                  </div>
                  <p
                    className={`text-3xl font-bold ${s.color}`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Two-column: Reorder Alerts + Transaction Volume ─────── */}
            <div className="grid grid-cols-3 gap-6">
              {/* Reorder Alerts — 2/3 width */}
              <div className="col-span-2 card-elevated rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}
                >
                  <h2
                    className="text-white/70 text-xs uppercase tracking-widest"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Reorder Alerts
                  </h2>
                  <div className="flex items-center gap-3">
                    {alerts.length > 0 && (
                      <span className="text-amber-400/70 text-xs font-medium">
                        {alerts.length} part{alerts.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {alerts.length > 0 && (
                      <button
                        onClick={async () => {
                          if (generatingPOs || !profile) return
                          setGeneratingPOs(true)
                          setPOResults(null)
                          try {
                            const results = await autoGenerateReorderPOs(profile.id)
                            setPOResults(results.map(r => ({ poNumber: r.poNumber, vendorName: r.vendorName, lineCount: r.lineCount })))
                          } catch (err) {
                            console.error("Auto-PO generation failed:", err)
                          } finally {
                            setGeneratingPOs(false)
                          }
                        }}
                        disabled={generatingPOs}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold uppercase tracking-wider transition-all"
                        style={{
                          background: "rgba(212,160,23,0.15)",
                          border: "1px solid rgba(212,160,23,0.3)",
                          color: "var(--skyshare-gold)",
                          opacity: generatingPOs ? 0.5 : 1,
                        }}
                      >
                        {generatingPOs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        Generate PO Drafts
                      </button>
                    )}
                  </div>
                </div>

                {poResults && poResults.length > 0 && (
                  <div className="px-4 py-3" style={{ background: "rgba(16,185,129,0.08)", borderBottom: "1px solid rgba(16,185,129,0.2)" }}>
                    <p className="text-emerald-400 text-xs font-semibold mb-1">Draft POs Generated</p>
                    {poResults.map(r => (
                      <p key={r.poNumber} className="text-emerald-300/70 text-xs">
                        {r.poNumber} — {r.vendorName} ({r.lineCount} line{r.lineCount !== 1 ? "s" : ""})
                      </p>
                    ))}
                    <button onClick={() => navigate("/app/beet-box/purchase-orders")} className="text-emerald-400/80 text-xs mt-1 hover:text-emerald-300 transition-colors">
                      View Purchase Orders →
                    </button>
                  </div>
                )}

                {alerts.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <PackageCheck className="w-8 h-8 text-emerald-400/20 mx-auto mb-2" />
                    <p className="text-white/25 text-sm">All parts above reorder point</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                        {["Part #", "Description", "On Hand", "Reorder Pt", "Deficit", "Last PO", ""].map(h => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-widest"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.slice(0, 15).map((a, idx) => (
                        <tr
                          key={a.id}
                          className="transition-colors hover:bg-white/[0.03]"
                          style={{ borderBottom: idx < Math.min(alerts.length, 15) - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                        >
                          <td className="px-4 py-2.5 font-mono text-white/70 text-xs font-semibold">{a.partNumber}</td>
                          <td className="px-4 py-2.5 text-white/55 text-xs max-w-[200px] truncate">{a.description}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-bold ${a.qtyOnHand === 0 ? "text-red-400" : "text-amber-400"}`}>
                              {a.qtyOnHand}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-white/40 text-xs text-center">{a.reorderPoint}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-red-400/80 text-xs font-medium">-{a.deficit}</span>
                          </td>
                          <td className="px-4 py-2.5 text-white/30 text-xs">
                            {a.lastPODate
                              ? new Date(a.lastPODate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : <span className="text-white/15">—</span>
                            }
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => navigate("/app/beet-box/purchase-orders/new")}
                              className="text-xs text-blue-400/70 hover:text-blue-400 transition-colors whitespace-nowrap"
                            >
                              Create PO
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Transaction Volume — 1/3 width */}
              <div className="card-elevated rounded-lg p-4 flex flex-col">
                <h2
                  className="text-white/70 text-xs uppercase tracking-widest mb-4"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Transactions (30 days)
                </h2>

                {totalTxns === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-white/20 text-sm">No transactions</p>
                  </div>
                ) : (
                  <div className="space-y-3 flex-1">
                    {[
                      { type: "receipt",    label: "Receipts",    color: "bg-emerald-500" },
                      { type: "issue",      label: "Issues",      color: "bg-blue-500" },
                      { type: "return",     label: "Returns",     color: "bg-amber-500" },
                      { type: "adjustment", label: "Adjustments", color: "bg-purple-500" },
                      { type: "scrap",      label: "Scrapped",    color: "bg-red-500" },
                    ]
                      .filter(t => (txnSummary[t.type] ?? 0) > 0)
                      .map(t => {
                        const count = txnSummary[t.type] ?? 0
                        const pct = totalTxns > 0 ? (count / totalTxns) * 100 : 0
                        return (
                          <div key={t.type}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-white/50">{t.label}</span>
                              <span className="text-white/70 font-semibold">{count}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.06]">
                              <div
                                className={`h-full rounded-full ${t.color} opacity-70`}
                                style={{ width: `${Math.max(pct, 3)}%`, transition: "width 0.5s ease" }}
                              />
                            </div>
                          </div>
                        )
                      })}

                    <div
                      className="pt-3 mt-auto"
                      style={{ borderTop: "1px solid hsl(0 0% 18%)" }}
                    >
                      <div className="flex justify-between text-xs">
                        <span className="text-white/35">Total</span>
                        <span className="text-white/60 font-bold">{totalTxns}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Open Purchase Orders ─────────────────────────────────── */}
            <div className="card-elevated rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}
              >
                <h2
                  className="text-white/70 text-xs uppercase tracking-widest"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Open Purchase Orders
                </h2>
                <button
                  onClick={() => navigate("/app/beet-box/purchase-orders")}
                  className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <OpenPOsTable navigate={navigate} />
            </div>

            {/* ── Recent Receiving Activity ────────────────────────────── */}
            <div className="card-elevated rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}
              >
                <h2
                  className="text-white/70 text-xs uppercase tracking-widest"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Recent Receiving
                </h2>
                <TrendingUp className="w-4 h-4 text-white/15" />
              </div>

              {receiving.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <PackageCheck className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-white/25 text-sm">No receiving activity yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                      {["Date", "PO #", "Part #", "Qty", "Condition", "Received By"].map(h => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-widest"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {receiving.map((r, idx) => (
                      <tr
                        key={r.id}
                        className="transition-colors hover:bg-white/[0.03]"
                        style={{ borderBottom: idx < receiving.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                      >
                        <td className="px-4 py-2.5 text-white/40 text-xs">
                          {new Date(r.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-white/65 text-xs font-semibold">{r.poNumber}</td>
                        <td className="px-4 py-2.5 font-mono text-white/70 text-xs">{r.partNumber}</td>
                        <td className="px-4 py-2.5 text-white/60 text-xs text-center">{r.qtyReceived}</td>
                        <td className="px-4 py-2.5 text-white/50 text-xs">
                          {CONDITION_LABELS[r.condition] ?? r.condition}
                        </td>
                        <td className="px-4 py-2.5 text-white/40 text-xs">{r.receivedByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Inline sub-component: Open POs table ────────────────────────────────────

function OpenPOsTable({ navigate }: { navigate: (path: string) => void }) {
  const [pos, setPos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { getPurchaseOrders } = await import("../../services/purchaseOrders")
        const all = await getPurchaseOrders({ status: ["draft", "sent", "partial"] })
        setPos(all)
      } catch (err) {
        console.error("Failed to load open POs:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="px-4 py-8 text-center text-white/25 text-sm">Loading...</div>

  if (pos.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <ShoppingCart className="w-8 h-8 text-white/10 mx-auto mb-2" />
        <p className="text-white/25 text-sm">No open purchase orders</p>
      </div>
    )
  }

  const STATUS_COLORS: Record<string, string> = {
    draft:   "bg-zinc-600 text-zinc-200",
    sent:    "bg-blue-600/30 text-blue-300",
    partial: "bg-amber-600/30 text-amber-300",
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
          {["PO #", "Vendor", "Lines", "Total", "Status", "Expected"].map(h => (
            <th
              key={h}
              className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-widest"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pos.slice(0, 10).map((po: any, idx: number) => {
          const total = po.lines.reduce((s: number, l: any) => s + l.qtyOrdered * l.unitCost, 0)
          return (
            <tr
              key={po.id}
              onClick={() => navigate(`/app/beet-box/purchase-orders/${po.id}`)}
              className="cursor-pointer transition-colors hover:bg-white/[0.04]"
              style={{ borderBottom: idx < Math.min(pos.length, 10) - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
            >
              <td className="px-4 py-2.5 font-mono text-white/70 text-xs font-semibold">{po.poNumber}</td>
              <td className="px-4 py-2.5 text-white/65 text-xs">{po.vendorName}</td>
              <td className="px-4 py-2.5 text-white/50 text-xs">{po.lines.length}</td>
              <td className="px-4 py-2.5 text-white/55 text-xs">${total.toFixed(2)}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[po.status] ?? "bg-zinc-700 text-zinc-300"}`}>
                  {po.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-white/35 text-xs">
                {po.expectedDelivery
                  ? new Date(po.expectedDelivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : <span className="text-white/15">—</span>
                }
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
