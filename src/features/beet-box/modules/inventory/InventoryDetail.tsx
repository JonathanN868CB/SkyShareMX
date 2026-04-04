import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { INVENTORY_PARTS } from "../../data/mockData"
import { cn } from "@/shared/lib/utils"

const TRANSACTION_COLORS = {
  receipt:    "text-emerald-400",
  issue:      "text-amber-400",
  return:     "text-blue-400",
  adjustment: "text-purple-400",
  scrap:      "text-red-400",
}

const CONDITION_COLORS = {
  new:          "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40",
  overhauled:   "bg-blue-900/30 text-blue-400 border border-blue-800/40",
  serviceable:  "bg-amber-900/30 text-amber-400 border border-amber-800/40",
  as_removed:   "bg-red-900/30 text-red-400 border border-red-800/40",
}

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const part = INVENTORY_PARTS.find(p => p.id === id)

  if (!part) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">Part not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/beet-box/inventory")} className="text-white/50">
          ← Back to Inventory
        </Button>
      </div>
    )
  }

  const isLow = part.qtyOnHand <= part.reorderPoint
  const isOut = part.qtyOnHand === 0

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <button
          onClick={() => navigate("/app/beet-box/inventory")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Inventory
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-mono" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
                {part.partNumber}
              </h1>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide", CONDITION_COLORS[part.condition])}>
                {part.condition.replace("_", " ")}
              </span>
              {part.isConsumable && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Consumable
                </span>
              )}
            </div>
            <p className="text-white/70 text-base">{part.description}</p>
            <p className="text-white/40 text-sm mt-1">{part.manufacturer} · {part.vendorName}</p>
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Qty cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "On Hand",        value: part.qtyOnHand,    color: isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-white", suffix: part.uom },
            { label: "Reserved",       value: part.qtyReserved,  color: "text-white/60",  suffix: part.uom },
            { label: "Available",      value: part.qtyOnHand - part.qtyReserved, color: "text-emerald-400", suffix: part.uom },
            { label: "Unit Cost",      value: `$${part.unitCost.toFixed(2)}`, color: "text-white/80", suffix: "" },
          ].map(s => (
            <div key={s.label} className="card-elevated rounded-lg p-4">
              <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
              <p className={cn("text-3xl font-bold", s.color)} style={{ fontFamily: "var(--font-display)" }}>
                {s.value}{s.suffix && <span className="text-base ml-1 opacity-60">{s.suffix}</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Part details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card-elevated rounded-lg p-5 space-y-3">
            <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Part Details</p>
            {[
              ["Part Number",    part.partNumber],
              ["Description",    part.description],
              ["Manufacturer",   part.manufacturer],
              ["Unit of Measure",part.uom],
              ["Location / Bin", part.locationBin],
              ["Preferred Vendor", part.vendorName],
              ["Reorder Point",  String(part.reorderPoint) + " " + part.uom],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-white/35 text-xs flex-shrink-0">{label}</span>
                <span className="text-white/75 text-xs text-right font-mono">{value}</span>
              </div>
            ))}
          </div>

          {/* Stock alert */}
          <div className="space-y-4">
            {isOut && (
              <div className="card-elevated rounded-lg p-4 border border-red-900/40 bg-red-900/10">
                <p className="text-red-300 text-sm font-semibold mb-1">Out of Stock</p>
                <p className="text-red-400/70 text-xs">This part has zero on-hand quantity. Review open purchase orders or create a new PO.</p>
                <Button size="sm" variant="ghost" onClick={() => navigate("/app/beet-box/purchase-orders/new")} className="mt-3 text-red-400 border border-red-900/40 hover:border-red-800/60 text-xs">
                  Create Purchase Order →
                </Button>
              </div>
            )}
            {isLow && !isOut && (
              <div className="card-elevated rounded-lg p-4 border border-amber-900/40 bg-amber-900/10">
                <p className="text-amber-300 text-sm font-semibold mb-1">At Reorder Point</p>
                <p className="text-amber-400/70 text-xs">Stock is at or below the reorder point ({part.reorderPoint} {part.uom}). Consider placing a purchase order.</p>
              </div>
            )}
          </div>
        </div>

        {/* Transaction history */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
            <span className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
              Transaction History
            </span>
          </div>
          {part.transactions.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/25 text-sm">No transactions recorded yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                  {["Date", "Type", "Qty", "Unit Cost", "Reference", "Performed By", "Notes"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {part.transactions.map((tx, idx) => (
                  <tr key={tx.id} style={{ borderBottom: idx < part.transactions.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">{tx.date}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-semibold capitalize", TRANSACTION_COLORS[tx.type])}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("font-bold font-mono text-sm", tx.qty > 0 ? "text-emerald-400" : "text-amber-400")}>
                        {tx.qty > 0 ? "+" : ""}{tx.qty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-sm">${tx.unitCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">
                      {tx.woRef ?? tx.poRef ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">{tx.performedBy}</td>
                    <td className="px-4 py-3 text-white/40 text-xs">{tx.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
