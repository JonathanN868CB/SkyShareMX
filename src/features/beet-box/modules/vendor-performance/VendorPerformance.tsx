import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Truck, Star, ShoppingCart, Search, MapPin,
  ArrowUpDown, Package, Clock, ExternalLink,
} from "lucide-react"
import {
  getVendorPerformance,
  getVendorSummaryStats,
} from "../../services/vendorPerformance"
import type { VendorMetric, VendorSummaryStats } from "../../services/vendorPerformance"

type SortKey = "name" | "totalPOs" | "totalSpend" | "fillRate" | "catalogPartsLinked"

export default function VendorPerformance() {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState<VendorMetric[]>([])
  const [stats, setStats] = useState<VendorSummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortKey>("name")
  const [sortAsc, setSortAsc] = useState(true)
  const [filterPreferred, setFilterPreferred] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [v, s] = await Promise.all([
          getVendorPerformance(),
          getVendorSummaryStats(),
        ])
        setVendors(v)
        setStats(s)
      } catch (err) {
        console.error("Failed to load vendor performance:", err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let result = vendors
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(v =>
        v.vendorName.toLowerCase().includes(q) ||
        (v.city ?? "").toLowerCase().includes(q) ||
        (v.state ?? "").toLowerCase().includes(q) ||
        (v.airportCode ?? "").toLowerCase().includes(q) ||
        v.specialties.some(s => s.toLowerCase().includes(q))
      )
    }
    if (filterPreferred) result = result.filter(v => v.preferred)

    result.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case "name": cmp = a.vendorName.localeCompare(b.vendorName); break
        case "totalPOs": cmp = (a.totalPOs - b.totalPOs); break
        case "totalSpend": cmp = (a.totalSpend - b.totalSpend); break
        case "fillRate": cmp = ((a.fillRate ?? -1) - (b.fillRate ?? -1)); break
        case "catalogPartsLinked": cmp = (a.catalogPartsLinked - b.catalogPartsLinked); break
      }
      return sortAsc ? cmp : -cmp
    })
    return result
  }, [vendors, search, sortBy, sortAsc, filterPreferred])

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(key === "name") }
  }

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
              Vendor Performance
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : `${vendors.length} vendors · purchasing metrics & catalog links`}
            </p>
          </div>
          <button
            onClick={() => navigate("/app/vendor-map")}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" /> Vendor Map <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-white/30 text-sm">Loading vendor data...</div>
        ) : (
          <>
            {/* Stat Cards */}
            {stats && (
              <div className="grid grid-cols-5 gap-4">
                <StatCard label="Total Vendors" value={stats.totalVendors} icon={Truck} color="text-white" />
                <StatCard label="Preferred" value={stats.preferredVendors} icon={Star} color="text-amber-400" />
                <StatCard label="With POs" value={stats.withPOs} icon={ShoppingCart} color="text-blue-400" />
                <StatCard
                  label="Total Spend"
                  value={`$${stats.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  icon={Package} color="text-emerald-400"
                />
                <StatCard
                  label="Avg Lead Time"
                  value={stats.avgLeadTime !== null ? `${stats.avgLeadTime}d` : "—"}
                  icon={Clock} color="text-purple-400"
                />
              </div>
            )}

            {/* Search + Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, city, state, airport, or specialty..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white/85 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
                />
              </div>
              <button
                onClick={() => setFilterPreferred(!filterPreferred)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: filterPreferred ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
                  border: filterPreferred ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  color: filterPreferred ? "#fbbf24" : "rgba(255,255,255,0.5)",
                }}
              >
                <Star className="w-3.5 h-3.5" />
                Preferred Only
              </button>
            </div>

            {/* Vendor Table */}
            <div className="card-elevated rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                    {([
                      { key: "name" as SortKey, label: "Vendor" },
                      { key: null, label: "Location" },
                      { key: null, label: "Specialties" },
                      { key: "totalPOs" as SortKey, label: "POs" },
                      { key: "totalSpend" as SortKey, label: "Spend" },
                      { key: "fillRate" as SortKey, label: "Fill Rate" },
                      { key: "catalogPartsLinked" as SortKey, label: "Catalog Links" },
                      { key: null, label: "Status" },
                    ] as const).map(col => (
                      <th
                        key={col.label}
                        onClick={col.key ? () => toggleSort(col.key!) : undefined}
                        className={`px-4 py-3 text-left text-white/30 text-xs uppercase tracking-widest ${col.key ? "cursor-pointer hover:text-white/50 select-none" : ""}`}
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.key && sortBy === col.key && <ArrowUpDown className="w-3 h-3" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, idx) => (
                    <tr
                      key={v.vendorId}
                      onClick={() => navigate(`/app/vendors/${v.vendorId}`)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      style={{ borderBottom: idx < filtered.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {v.preferred && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />}
                          <span className="text-white/80 text-sm font-medium">{v.vendorName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/45 text-xs">
                        {[v.city, v.state].filter(Boolean).join(", ") || "—"}
                        {v.airportCode && <span className="text-white/25 ml-1">({v.airportCode})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {v.specialties.slice(0, 3).map(s => (
                            <span key={s} className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-white/[0.06] text-white/40 truncate max-w-[80px]">
                              {s}
                            </span>
                          ))}
                          {v.specialties.length > 3 && (
                            <span className="text-white/20 text-[9px]">+{v.specialties.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white/55 text-xs text-center">
                        {v.totalPOs > 0 ? v.totalPOs : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3 text-white/55 text-xs">
                        {v.totalSpend > 0
                          ? `$${v.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : <span className="text-white/20">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {v.fillRate !== null ? (
                          <span className={`text-xs font-bold ${
                            v.fillRate >= 90 ? "text-emerald-400" :
                            v.fillRate >= 50 ? "text-amber-400" :
                            "text-red-400"
                          }`}>
                            {v.fillRate}%
                          </span>
                        ) : (
                          <span className="text-white/15 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {v.catalogPartsLinked > 0 ? (
                          <span className="text-blue-400/70 text-xs font-semibold">{v.catalogPartsLinked}</span>
                        ) : (
                          <span className="text-white/15 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {v.approvalStatus ? (
                          <ApprovalBadge status={v.approvalStatus} />
                        ) : (
                          <span className="text-white/15 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <Truck className="w-10 h-10 text-white/10 mx-auto mb-3" />
                        <p className="text-white/25 text-sm">
                          {vendors.length === 0 ? "No vendors found" : "No vendors match your search"}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Truck; color: string }) {
  return (
    <div className="card-elevated rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/40 text-xs tracking-wide uppercase" style={{ fontFamily: "var(--font-heading)" }}>{label}</p>
        <Icon className={`w-4 h-4 ${color} opacity-50`} />
      </div>
      <p className={`text-2xl font-bold ${color}`} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
    </div>
  )
}

function ApprovalBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    approved:    { bg: "bg-emerald-600/20", text: "text-emerald-300" },
    pending:     { bg: "bg-amber-600/20", text: "text-amber-300" },
    conditional: { bg: "bg-blue-600/20", text: "text-blue-300" },
    suspended:   { bg: "bg-red-600/20", text: "text-red-300" },
    revoked:     { bg: "bg-red-600/30", text: "text-red-300" },
  }
  const c = cfg[status] ?? { bg: "bg-zinc-600/20", text: "text-zinc-300" }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      {status}
    </span>
  )
}
