import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, AlertTriangle, Check, Package } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { PURCHASE_ORDERS, type POLine } from "../../data/mockData"
import { POStatusBadge } from "../../shared/StatusBadge"
import { cn } from "@/shared/lib/utils"

export default function PODetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const original = PURCHASE_ORDERS.find(p => p.id === id)

  const [lines, setLines] = useState<POLine[]>(original?.lines ?? [])
  const [receiving, setReceiving] = useState(false)
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({})
  const [status, setStatus] = useState(original?.status ?? "draft")

  if (!original) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">Purchase order not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/beet-box/purchase-orders")} className="text-white/50">
          ← Back to Purchase Orders
        </Button>
      </div>
    )
  }

  const totalOrdered  = lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
  const totalReceived = lines.reduce((s, l) => s + l.qtyReceived * l.unitCost, 0)
  const allReceived   = lines.every(l => l.qtyReceived >= l.qtyOrdered)

  function confirmReceive() {
    const updated = lines.map(l => {
      const qty = parseFloat(receiveQtys[l.id] ?? "0") || 0
      return { ...l, qtyReceived: Math.min(l.qtyReceived + qty, l.qtyOrdered) }
    })
    setLines(updated)
    const allDone = updated.every(l => l.qtyReceived >= l.qtyOrdered)
    const anyReceived = updated.some(l => l.qtyReceived > 0)
    setStatus(allDone ? "received" : anyReceived ? "partial" : "sent")
    setReceiving(false)
    setReceiveQtys({})
  }

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <button
          onClick={() => navigate("/app/beet-box/purchase-orders")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Purchase Orders
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-mono" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
                {original.poNumber}
              </h1>
              <POStatusBadge status={status} />
            </div>
            <p className="text-white/60 text-base">{original.vendorName}</p>
            <p className="text-white/35 text-xs mt-1">Created by {original.createdBy} · {new Date(original.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
          {(status === "sent" || status === "partial") && (
            <Button
              size="sm"
              onClick={() => setReceiving(true)}
              style={{ background: "var(--skyshare-gold)", color: "#000" }}
              className="font-semibold text-xs gap-1.5"
            >
              <Package className="w-3.5 h-3.5" /> Receive Items
            </Button>
          )}
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Financial summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Total Ordered</p>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>${totalOrdered.toFixed(2)}</p>
          </div>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Received to Date</p>
            <p className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>${totalReceived.toFixed(2)}</p>
          </div>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Expected Delivery</p>
            <p className="text-2xl font-bold text-white/70" style={{ fontFamily: "var(--font-display)" }}>
              {original.expectedDelivery
                ? new Date(original.expectedDelivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—"
              }
            </p>
          </div>
        </div>

        {/* Line items */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
            <span className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Line Items</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                {["Part Number", "Description", "WO Ref", "Qty Ordered", "Qty Received", "Unit Cost", "Extended", receiving ? "Receive Qty" : "Status"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const pct = line.qtyOrdered > 0 ? line.qtyReceived / line.qtyOrdered : 0
                const isComplete = line.qtyReceived >= line.qtyOrdered
                return (
                  <tr key={line.id} style={{ borderBottom: idx < lines.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                    <td className="px-4 py-3 font-mono text-white/70 text-xs">{line.partNumber}</td>
                    <td className="px-4 py-3 text-white/80 text-sm max-w-[180px]">
                      <span className="line-clamp-2">{line.description}</span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs font-mono">{line.woRef ?? "—"}</td>
                    <td className="px-4 py-3 text-white/70 font-mono text-sm text-center">{line.qtyOrdered}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono text-sm font-bold", isComplete ? "text-emerald-400" : line.qtyReceived > 0 ? "text-amber-400" : "text-white/35")}>
                          {line.qtyReceived}
                        </span>
                        {isComplete && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-sm">${line.unitCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-white/70 font-semibold text-sm">${(line.qtyOrdered * line.unitCost).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {receiving ? (
                        <input
                          type="number"
                          min="0"
                          max={line.qtyOrdered - line.qtyReceived}
                          className="w-16 px-2 py-1 rounded text-xs bg-white/[0.06] border border-white/15 text-white text-center"
                          placeholder="0"
                          value={receiveQtys[line.id] ?? ""}
                          onChange={e => setReceiveQtys(r => ({ ...r, [line.id]: e.target.value }))}
                        />
                      ) : (
                        <div className="w-20 bg-white/10 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct * 100}%`,
                              background: isComplete ? "#10b981" : pct > 0 ? "#f59e0b" : "rgba(255,255,255,0.2)",
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {original.notes && (
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)" }}>Notes</p>
            <p className="text-white/65 text-sm">{original.notes}</p>
          </div>
        )}

        {/* Receive confirm */}
        {receiving && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-white/[0.04] border border-white/10">
            <p className="flex-1 text-white/60 text-sm">Enter quantities received for each line item, then confirm.</p>
            <Button size="sm" onClick={confirmReceive} style={{ background: "var(--skyshare-gold)", color: "#000" }} className="font-semibold text-xs">
              Confirm Receipt
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setReceiving(false); setReceiveQtys({}) }} className="text-white/40 text-xs">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
