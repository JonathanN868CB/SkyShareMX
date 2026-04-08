import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  BarChart3, Package, ClipboardList, ShoppingCart, BookOpen,
  MapPin, AlertTriangle, Archive, Layers,
} from "lucide-react"
import {
  getInventoryAnalytics,
  getWOMetrics,
  getPurchasingSummary,
  getCatalogSummary,
} from "../../services/reports"
import type {
  InventoryAnalytics,
  WOMetrics,
  PurchasingSummary,
  CatalogSummary,
} from "../../services/reports"

type TabId = "inventory" | "work-orders" | "purchasing" | "catalog"

const TABS: { id: TabId; label: string; icon: typeof Package }[] = [
  { id: "inventory",   label: "Inventory",       icon: Package },
  { id: "work-orders", label: "Work Orders",     icon: ClipboardList },
  { id: "purchasing",  label: "Purchasing",       icon: ShoppingCart },
  { id: "catalog",     label: "Parts Catalog",    icon: BookOpen },
]

export default function ReportsDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>("inventory")
  const [loading, setLoading] = useState(true)

  const [inv, setInv] = useState<InventoryAnalytics | null>(null)
  const [wo, setWO] = useState<WOMetrics | null>(null)
  const [po, setPO] = useState<PurchasingSummary | null>(null)
  const [cat, setCat] = useState<CatalogSummary | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [i, w, p, c] = await Promise.all([
          getInventoryAnalytics(),
          getWOMetrics(),
          getPurchasingSummary(),
          getCatalogSummary(),
        ])
        setInv(i)
        setWO(w)
        setPO(p)
        setCat(c)
      } catch (err) {
        console.error("Failed to load reports:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
              Reports & Analytics
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : "Inventory, work orders, purchasing & catalog metrics"}
            </p>
          </div>
          <BarChart3 className="w-8 h-8 text-white/15" />
        </div>
      </div>

      <div className="stripe-divider" />

      {/* Tab bar */}
      <div className="px-8 pt-5 pb-0">
        <div className="flex gap-1" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm transition-all -mb-px"
              style={{
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.03em",
                borderBottom: tab === t.id ? "2px solid var(--skyshare-gold)" : "2px solid transparent",
                color: tab === t.id ? "white" : "rgba(255,255,255,0.35)",
              }}
            >
              <t.icon className="w-4 h-4" style={tab === t.id ? { color: "var(--skyshare-gold)" } : {}} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6">
        {loading ? (
          <div className="py-20 text-center text-white/30 text-sm">Loading reports...</div>
        ) : (
          <>
            {tab === "inventory" && inv && <InventoryTab data={inv} navigate={navigate} />}
            {tab === "work-orders" && wo && <WorkOrdersTab data={wo} navigate={navigate} />}
            {tab === "purchasing" && po && <PurchasingTab data={po} navigate={navigate} />}
            {tab === "catalog" && cat && <CatalogTab data={cat} navigate={navigate} />}
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Inventory Tab
// ═══════════════════════════════════════════════════════════════════════════════

function InventoryTab({ data, navigate }: { data: InventoryAnalytics; navigate: (p: string) => void }) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Parts" value={data.totalParts.toLocaleString()} icon={Package} color="text-white" />
        <StatCard label="Total Quantity" value={data.totalQuantity.toLocaleString()} icon={Layers} color="text-blue-400" />
        <StatCard label="Zero Stock" value={data.zeroStock} icon={AlertTriangle} color={data.zeroStock > 0 ? "text-red-400" : "text-emerald-400"} />
        <StatCard
          label="Inventory Value"
          value={`$${data.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Archive}
          color="text-emerald-400"
        />
      </div>

      {/* Stock Distribution + Location Coverage side by side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Stock Distribution */}
        <div className="card-elevated rounded-lg p-5">
          <SectionHeader title="Stock Distribution" />
          <div className="space-y-3 mt-4">
            {[
              { label: "Out of Stock (0)",  count: data.zeroStock,   color: "bg-red-500",    pct: data.zeroStock / data.totalParts * 100 },
              { label: "Low (1–5)",         count: data.lowStock,    color: "bg-amber-500",  pct: data.lowStock / data.totalParts * 100 },
              { label: "Medium (6–50)",     count: data.mediumStock, color: "bg-blue-500",   pct: data.mediumStock / data.totalParts * 100 },
              { label: "High (51+)",        count: data.highStock,   color: "bg-emerald-500", pct: data.highStock / data.totalParts * 100 },
            ].map(row => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">{row.label}</span>
                  <span className="text-white/70 font-semibold">{row.count} ({row.pct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${row.color} opacity-70`}
                    style={{ width: `${Math.max(row.pct, 1)}%`, transition: "width 0.5s ease" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Location Coverage */}
        <div className="card-elevated rounded-lg p-5">
          <SectionHeader title="Location Coverage" />
          <div className="mt-4 space-y-4">
            {/* Ring visual */}
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(0,0%,18%)" strokeWidth="12" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="var(--skyshare-gold)"
                    strokeWidth="12"
                    strokeDasharray={`${(data.withLocation / data.totalParts) * 264} 264`}
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    {((data.withLocation / data.totalParts) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "var(--skyshare-gold)", opacity: 0.8 }} />
                  <span className="text-white/60 text-xs">Located: {data.withLocation.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-white/10" />
                  <span className="text-white/40 text-xs">No Location: {data.withoutLocation.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Top locations */}
            {data.locationSummary.length > 0 && (
              <div className="pt-3" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)" }}>
                  Top Storage Areas
                </p>
                <div className="space-y-1">
                  {data.locationSummary.slice(0, 8).map(loc => (
                    <div key={loc.location} className="flex justify-between text-xs">
                      <span className="text-white/50 font-mono truncate max-w-[150px]">{loc.location}</span>
                      <span className="text-white/60">{loc.partCount} parts · {loc.totalQty.toLocaleString()} qty</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Parts by Quantity */}
      <div className="card-elevated rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
          <SectionHeader title="Top 20 Parts by Quantity" inline />
          <button
            onClick={() => navigate("/app/beet-box/inventory")}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            View Inventory →
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
              {["#", "Part Number", "Description", "Qty", "Location"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.topByQuantity.map((p, i) => (
              <tr
                key={p.partNumber}
                className="transition-colors hover:bg-white/[0.03]"
                style={{ borderBottom: i < data.topByQuantity.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
              >
                <td className="px-4 py-2 text-white/25 text-xs">{i + 1}</td>
                <td className="px-4 py-2 font-mono text-white/70 text-xs font-semibold">{p.partNumber}</td>
                <td className="px-4 py-2 text-white/50 text-xs max-w-[250px] truncate">{p.description}</td>
                <td className="px-4 py-2 text-blue-400 text-xs font-bold">{p.qtyOnHand.toLocaleString()}</td>
                <td className="px-4 py-2 text-white/30 text-xs font-mono">{p.locationBin ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Work Orders Tab
// ═══════════════════════════════════════════════════════════════════════════════

const WO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-600", open: "bg-blue-600", waiting_on_parts: "bg-amber-600",
  in_review: "bg-purple-600", billing: "bg-cyan-600", completed: "bg-emerald-600", void: "bg-red-600/50",
}

function WorkOrdersTab({ data, navigate }: { data: WOMetrics; navigate: (p: string) => void }) {
  if (data.total === 0) {
    return <EmptyState icon={ClipboardList} message="No work orders yet" sub="Work order metrics will appear here once WOs are created" />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total WOs" value={data.total} icon={ClipboardList} color="text-white" />
        <StatCard label="Avg Items/WO" value={data.avgItemsPerWO.toFixed(1)} icon={Layers} color="text-blue-400" />
        <StatCard label="Labor Hours" value={data.totalLaborHours.toFixed(1)} icon={ClipboardList} color="text-amber-400" />
        <StatCard label="Parts Used" value={data.totalPartsUsed} icon={Package} color="text-emerald-400" />
      </div>

      {/* Status breakdown */}
      <div className="card-elevated rounded-lg p-5">
        <SectionHeader title="Status Distribution" />
        <div className="flex gap-3 mt-4">
          {Object.entries(data.byStatus).map(([status, count]) => (
            <div key={status} className="flex-1 text-center">
              <div className={`inline-block w-3 h-3 rounded-full ${WO_STATUS_COLORS[status] ?? "bg-zinc-500"} mb-2`} />
              <p className="text-white/70 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{count}</p>
              <p className="text-white/35 text-[10px] uppercase tracking-wider">{status.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <div className="card-elevated rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
            <SectionHeader title="Recent Work Orders" inline />
            <button onClick={() => navigate("/app/beet-box/work-orders")} className="text-xs text-white/30 hover:text-white/60 transition-colors">
              View All →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                {["WO #", "Description", "Items", "Status", "Opened"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentActivity.map((wo, i) => (
                <tr
                  key={wo.id}
                  onClick={() => navigate(`/app/beet-box/work-orders/${wo.id}`)}
                  className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                  style={{ borderBottom: i < data.recentActivity.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                >
                  <td className="px-4 py-2.5 font-mono text-white/70 text-xs font-semibold">{wo.woNumber}</td>
                  <td className="px-4 py-2.5 text-white/50 text-xs max-w-[250px] truncate">{wo.description ?? "—"}</td>
                  <td className="px-4 py-2.5 text-white/50 text-xs">{wo.itemCount}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider text-white/80 ${WO_STATUS_COLORS[wo.status] ?? "bg-zinc-600"}`}>
                      {wo.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/35 text-xs">
                    {new Date(wo.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Purchasing Tab
// ═══════════════════════════════════════════════════════════════════════════════

function PurchasingTab({ data, navigate }: { data: PurchasingSummary; navigate: (p: string) => void }) {
  if (data.totalPOs === 0) {
    return <EmptyState icon={ShoppingCart} message="No purchase orders yet" sub="Purchasing metrics will appear here once POs are created" />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total POs" value={data.totalPOs} icon={ShoppingCart} color="text-white" />
        <StatCard
          label="Total Spend"
          value={`$${data.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={ShoppingCart}
          color="text-blue-400"
        />
        <StatCard label="Items Received" value={data.totalReceived} icon={Package} color="text-emerald-400" />
        <StatCard label="Vendors" value={data.vendorBreakdown.length} icon={MapPin} color="text-amber-400" />
      </div>

      {/* Status breakdown */}
      <div className="card-elevated rounded-lg p-5">
        <SectionHeader title="PO Status Breakdown" />
        <div className="flex gap-3 mt-4">
          {Object.entries(data.byStatus).map(([status, count]) => (
            <div key={status} className="flex-1 text-center">
              <p className="text-white/70 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{count}</p>
              <p className="text-white/35 text-[10px] uppercase tracking-wider">{status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Vendor breakdown */}
      {data.vendorBreakdown.length > 0 && (
        <div className="card-elevated rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
            <SectionHeader title="Spend by Vendor" inline />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                {["Vendor", "POs", "Total Spend"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-white/30 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.vendorBreakdown.map((v, i) => (
                <tr
                  key={v.vendorName}
                  className="transition-colors hover:bg-white/[0.03]"
                  style={{ borderBottom: i < data.vendorBreakdown.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                >
                  <td className="px-4 py-2.5 text-white/70 text-xs">{v.vendorName}</td>
                  <td className="px-4 py-2.5 text-white/50 text-xs">{v.poCount}</td>
                  <td className="px-4 py-2.5 text-white/65 text-xs font-semibold">${v.totalSpend.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Catalog Tab
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_LABELS: Record<string, string> = {
  oem: "OEM", pma: "PMA", tso: "TSO",
  standard_hardware: "Std Hardware", consumable: "Consumable",
  raw_material: "Raw Material", unclassified: "Unclassified",
}

function CatalogTab({ data, navigate }: { data: CatalogSummary; navigate: (p: string) => void }) {
  if (data.totalEntries === 0) {
    return <EmptyState icon={BookOpen} message="No catalog entries yet" sub="Catalog metrics will appear here once parts are cataloged" />
  }

  const sortedTypes = Object.entries(data.byPartType).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Catalog Entries" value={data.totalEntries.toLocaleString()} icon={BookOpen} color="text-white" />
        <StatCard label="Serialized" value={data.serialized} icon={Package} color="text-blue-400" />
        <StatCard label="Rotable" value={data.rotable} icon={Layers} color="text-amber-400" />
        <StatCard label="Shelf Life" value={data.shelfLife} icon={AlertTriangle} color="text-purple-400" />
      </div>

      {/* Part type breakdown */}
      <div className="card-elevated rounded-lg p-5">
        <SectionHeader title="Classification Breakdown" />
        <div className="space-y-3 mt-4">
          {sortedTypes.map(([type, count]) => {
            const pct = (count / data.totalEntries) * 100
            return (
              <div key={type}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">{TYPE_LABELS[type] ?? type}</span>
                  <span className="text-white/70 font-semibold">{count.toLocaleString()} ({pct.toFixed(1)}%)</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full opacity-70"
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      background: "var(--skyshare-gold)",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-center pt-2">
        <button
          onClick={() => navigate("/app/beet-box/catalog")}
          className="text-sm text-white/30 hover:text-white/60 transition-colors"
        >
          Browse Full Catalog →
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared components
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Package; color: string }) {
  return (
    <div className="card-elevated rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/40 text-xs tracking-wide uppercase" style={{ fontFamily: "var(--font-heading)" }}>{label}</p>
        <Icon className={`w-4 h-4 ${color} opacity-50`} />
      </div>
      <p className={`text-3xl font-bold ${color}`} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
    </div>
  )
}

function SectionHeader({ title, inline }: { title: string; inline?: boolean }) {
  return (
    <h3
      className={`text-white/70 text-xs uppercase tracking-widest ${inline ? "" : ""}`}
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {title}
    </h3>
  )
}

function EmptyState({ icon: Icon, message, sub }: { icon: typeof Package; message: string; sub: string }) {
  return (
    <div className="py-20 text-center">
      <Icon className="w-12 h-12 text-white/10 mx-auto mb-3" />
      <p className="text-white/30 text-sm mb-1">{message}</p>
      <p className="text-white/20 text-xs">{sub}</p>
    </div>
  )
}
