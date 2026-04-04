import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { PURCHASE_ORDERS } from "../../data/mockData"
import { POStatusBadge } from "../../shared/StatusBadge"

export default function PODashboard() {
  const navigate = useNavigate()

  const draft    = PURCHASE_ORDERS.filter(p => p.status === "draft").length
  const open     = PURCHASE_ORDERS.filter(p => p.status === "sent" || p.status === "partial").length
  const received = PURCHASE_ORDERS.filter(p => p.status === "received").length

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              Purchase Orders
            </h1>
            <p className="text-white/45 text-sm">{PURCHASE_ORDERS.length} purchase orders</p>
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
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Draft",          value: draft,    color: "text-zinc-400"    },
            { label: "Open / Partial", value: open,     color: "text-blue-400"   },
            { label: "Received",       value: received, color: "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="card-elevated rounded-lg p-4">
              <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* PO table */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                {["PO #", "Vendor", "Lines", "Status", "Created By", "Created", "Expected"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PURCHASE_ORDERS.map((po, idx) => {
                const totalCost = po.lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
                return (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/app/beet-box/purchase-orders/${po.id}`)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                    style={{ borderBottom: idx < PURCHASE_ORDERS.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                  >
                    <td className="px-4 py-3 font-mono text-white/70 text-xs font-semibold">{po.poNumber}</td>
                    <td className="px-4 py-3 text-white/80 text-sm">{po.vendorName}</td>
                    <td className="px-4 py-3 text-white/60 text-sm">{po.lines.length}</td>
                    <td className="px-4 py-3"><POStatusBadge status={po.status} /></td>
                    <td className="px-4 py-3 text-white/50 text-xs">{po.createdBy}</td>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
