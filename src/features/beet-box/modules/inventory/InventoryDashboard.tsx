import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Package, AlertTriangle } from "lucide-react"
import { getParts } from "../../services/inventory"
import type { InventoryPart } from "../../types"
import { cn } from "@/shared/lib/utils"

const CONDITION_COLORS: Record<string, string> = {
  new:          "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40",
  overhauled:   "bg-blue-900/30 text-blue-400 border border-blue-800/40",
  serviceable:  "bg-amber-900/30 text-amber-400 border border-amber-800/40",
  as_removed:   "bg-red-900/30 text-red-400 border border-red-800/40",
}

export default function InventoryDashboard() {
  const navigate = useNavigate()
  const [parts, setParts] = useState<InventoryPart[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await getParts()
        setParts(data)
      } catch (err) {
        console.error("Failed to load inventory:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return parts
    const q = search.toLowerCase()
    return parts.filter(p =>
      p.partNumber.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.manufacturer ?? "").toLowerCase().includes(q)
    )
  }, [parts, search])

  const lowStock = parts.filter(p => p.qtyOnHand <= p.reorderPoint).length
  const outOfStock = parts.filter(p => p.qtyOnHand === 0).length
  const totalValue = parts.reduce((s, p) => s + p.qtyOnHand * p.unitCost, 0)

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              Inventory
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : `${parts.length} part numbers tracked`}
            </p>
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Total Inventory Value</p>
            <p className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
              ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>At or Below Reorder Point</p>
            <p className="text-3xl font-bold text-amber-400" style={{ fontFamily: "var(--font-display)" }}>{lowStock}</p>
          </div>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Out of Stock</p>
            <p className="text-3xl font-bold text-red-400" style={{ fontFamily: "var(--font-display)" }}>{outOfStock}</p>
          </div>
        </div>

        {/* Alerts */}
        {outOfStock > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-sm">{outOfStock} part(s) out of stock — review purchase orders</span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by part number, description, or manufacturer..."
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white/85 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
          />
        </div>

        {/* Parts table */}
        <div className="card-elevated rounded-lg overflow-hidden">
          {loading ? (
            <div className="px-4 py-16 text-center text-white/30 text-sm">Loading inventory...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                  {["Part Number", "Description", "Manufacturer", "Condition", "On Hand", "Reserved", "Reorder Pt.", "Unit Cost", "Location"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((part, idx) => {
                  const isLow = part.qtyOnHand <= part.reorderPoint
                  const isOut = part.qtyOnHand === 0
                  return (
                    <tr
                      key={part.id}
                      onClick={() => navigate(`/app/beet-box/inventory/${part.id}`)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      style={{ borderBottom: idx < filtered.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                    >
                      <td className="px-4 py-3 font-mono text-white/80 text-xs font-semibold">{part.partNumber}</td>
                      <td className="px-4 py-3 text-white/75 text-sm max-w-[200px]">
                        <span className="line-clamp-1">{part.description}</span>
                      </td>
                      <td className="px-4 py-3 text-white/50 text-xs">{part.manufacturer ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide", CONDITION_COLORS[part.condition] ?? "bg-white/5 text-white/40 border border-white/10")}>
                          {part.condition.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("font-bold font-mono text-sm", isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-white/80")}>
                          {part.qtyOnHand}
                        </span>
                        {isLow && !isOut && <span className="ml-1.5 text-amber-400/60 text-[10px]">↓</span>}
                        {isOut && <span className="ml-1.5 text-red-400/60 text-[10px]">OOS</span>}
                      </td>
                      <td className="px-4 py-3 text-white/40 font-mono text-sm">{part.qtyReserved}</td>
                      <td className="px-4 py-3 text-white/40 font-mono text-sm">{part.reorderPoint}</td>
                      <td className="px-4 py-3 text-white/65 text-sm">${part.unitCost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-white/40 text-xs font-mono">{part.locationBin ?? "—"}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <Package className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-white/25 text-sm">
                        {parts.length === 0 ? "No inventory parts yet." : "No parts match your search."}
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
