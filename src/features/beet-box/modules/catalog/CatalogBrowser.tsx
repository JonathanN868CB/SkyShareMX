import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Search, BookOpen, Plus } from "lucide-react"
import { getCatalogEntries } from "../../services/catalog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select"
import type { CatalogEntry, PartClassification } from "../../types"
import { CatalogCreateModal } from "./CatalogCreateModal"
import { cn } from "@/shared/lib/utils"

const TYPE_LABELS: Record<string, string> = {
  oem: "OEM",
  pma: "PMA",
  tso: "TSO",
  standard_hardware: "Std Hardware",
  consumable: "Consumable",
  raw_material: "Raw Material",
}

const TYPE_COLORS: Record<string, string> = {
  oem: "bg-blue-900/30 text-blue-400 border border-blue-800/40",
  pma: "bg-purple-900/30 text-purple-400 border border-purple-800/40",
  tso: "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40",
  standard_hardware: "bg-amber-900/30 text-amber-400 border border-amber-800/40",
  consumable: "bg-slate-800/30 text-slate-400 border border-slate-700/40",
  raw_material: "bg-orange-900/30 text-orange-400 border border-orange-800/40",
}

export default function CatalogBrowser() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<CatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getCatalogEntries()
      setEntries(data)
    } catch (err) {
      console.error("Failed to load catalog:", err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let result = entries

    if (typeFilter !== "all") {
      result = result.filter(e => e.partType === typeFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.partNumber.toLowerCase().includes(q) ||
        (e.description?.toLowerCase().includes(q)) ||
        (e.manufacturer?.toLowerCase().includes(q)) ||
        (e.ataChapter?.toLowerCase().includes(q))
      )
    }

    return result
  }, [entries, search, typeFilter])

  const withInventory = entries.filter(e => (e.inventoryOnHand ?? 0) > 0).length
  const noInventory = entries.length - withInventory

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-white mb-1"
              style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
            >
              Parts Catalog
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : `${entries.length} part numbers cataloged`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
            style={{ background: "var(--skyshare-gold)", color: "#111" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <Plus className="w-4 h-4" />
            Add to Catalog
          </button>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card-elevated rounded-lg p-4">
            <p
              className="text-white/40 text-xs tracking-wide uppercase mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Total Catalog Entries
            </p>
            <p className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
              {entries.length}
            </p>
          </div>
          <div className="card-elevated rounded-lg p-4">
            <p
              className="text-white/40 text-xs tracking-wide uppercase mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              With Inventory
            </p>
            <p className="text-3xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>
              {withInventory}
            </p>
          </div>
          <div className="card-elevated rounded-lg p-4">
            <p
              className="text-white/40 text-xs tracking-wide uppercase mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No Inventory
            </p>
            <p className="text-3xl font-bold text-white/50" style={{ fontFamily: "var(--font-display)" }}>
              {noInventory}
            </p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by part number, description, manufacturer, or ATA..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white/85 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              className="rounded-md px-3 py-2.5 text-sm h-auto w-auto min-w-[160px]"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-white/30 ml-auto">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="card-elevated rounded-lg overflow-hidden">
          {loading ? (
            <div className="px-4 py-16 text-center text-white/30 text-sm">Loading catalog...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                  {["Part Number", "Description", "Type", "ATA", "Manufacturer", "On Hand"].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-white/35 text-xs uppercase tracking-widest"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    onClick={() => navigate(`/app/beet-box/catalog/${entry.id}`)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                    style={{
                      borderBottom: idx < filtered.length - 1 ? "1px solid hsl(0 0% 16%)" : "none",
                    }}
                  >
                    <td className="px-4 py-3 font-mono text-white/80 text-xs font-semibold">
                      {entry.partNumber}
                    </td>
                    <td className="px-4 py-3 text-white/75 text-sm max-w-[280px]">
                      <span className="line-clamp-1">{entry.description || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.partType ? (
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide",
                            TYPE_COLORS[entry.partType] ?? "bg-white/5 text-white/40 border border-white/10"
                          )}
                        >
                          {TYPE_LABELS[entry.partType] ?? entry.partType}
                        </span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">
                      {entry.ataChapter || "—"}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {entry.manufacturer || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(entry.inventoryOnHand ?? 0) > 0 ? (
                        <span className="font-bold font-mono text-sm text-emerald-400">
                          {entry.inventoryOnHand}
                        </span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <BookOpen className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">
                        {search || typeFilter !== "all" ? "No parts match your filters." : "Catalog is empty."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showCreate && (
        <CatalogCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}
