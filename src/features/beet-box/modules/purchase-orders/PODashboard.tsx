import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Search, ShoppingCart } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { getPurchaseOrders } from "../../services/purchaseOrders"
import type { PurchaseOrder } from "../../types"
import { POStatusBadge } from "../../shared/StatusBadge"

export default function PODashboard() {
  const navigate = useNavigate()
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getPurchaseOrders()
        setPos(data)
      } catch (err) {
        console.error("Failed to load purchase orders:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return pos
    const q = search.toLowerCase()
    return pos.filter(p =>
      p.poNumber.toLowerCase().includes(q) ||
      p.vendorName.toLowerCase().includes(q)
    )
  }, [pos, search])

  const draft    = pos.filter(p => p.status === "draft").length
  const open     = pos.filter(p => p.status === "sent" || p.status === "partial").length
  const received = pos.filter(p => p.status === "received").length
  const totalValue = pos.reduce((s, p) => s + p.lines.reduce((ls, l) => ls + l.qtyOrdered * l.unitCost, 0), 0)

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              Purchase Orders
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : `${pos.length} purchase orders`}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate("/app/beet-box/purchase-orders/new")}
            style={{ background: "var(--skyshare-gold)", color: "#000" }}
            className="font-semibold text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New PO
          </Button>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Draft",          value: draft,                                       color: "text-zinc-400"    },
            { label: "Open / Partial", value: open,                                        color: "text-blue-400"    },
            { label: "Received",       value: received,                                    color: "text-emerald-400" },
            { label: "Total Value",    value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-white" },
          ].map(s => (
            <div key={s.label} className="card-elevated rounded-lg p-4">
              <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by PO number or vendor..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white/85 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
          />
        </div>

        {/* PO table */}
        <div className="card-elevated rounded-lg overflow-hidden">
          {loading ? (
            <div className="px-4 py-16 text-center text-white/30 text-sm">Loading purchase orders...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                  {["PO #", "Vendor", "Lines", "Total", "Status", "Created", "Expected"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((po, idx) => {
                  const totalCost = po.lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
                  return (
                    <tr
                      key={po.id}
                      onClick={() => navigate(`/app/beet-box/purchase-orders/${po.id}`)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      style={{ borderBottom: idx < filtered.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                    >
                      <td className="px-4 py-3 font-mono text-white/70 text-xs font-semibold">{po.poNumber}</td>
                      <td className="px-4 py-3 text-white/80 text-sm">{po.vendorName}</td>
                      <td className="px-4 py-3 text-white/60 text-sm">{po.lines.length}</td>
                      <td className="px-4 py-3 text-white/65 text-sm">${totalCost.toFixed(2)}</td>
                      <td className="px-4 py-3"><POStatusBadge status={po.status} /></td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {new Date(po.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {po.expectedDelivery
                          ? new Date(po.expectedDelivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                          : <span className="text-white/20">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <ShoppingCart className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-white/25 text-sm">
                        {pos.length === 0 ? "No purchase orders yet." : "No POs match your search."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
