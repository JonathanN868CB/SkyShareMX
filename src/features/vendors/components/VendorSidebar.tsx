import { useState } from "react"
import { Star, Truck, Search, ChevronDown } from "lucide-react"
import { GOLD, STATUS_DISPLAY, TYPE_CONFIG, type Vendor, type VendorOperationalStatus } from "../constants"

const STATUS_FILTERS: { value: VendorOperationalStatus | "all"; label: string }[] = [
  { value: "all",        label: "All Statuses" },
  { value: "approved",   label: "Approved" },
  { value: "pending",    label: "Pending" },
  { value: "discovered", label: "Discovered" },
  { value: "restricted", label: "Restricted" },
  { value: "inactive",   label: "Inactive" },
]

export function VendorSidebar({
  sidebarTab, setSidebarTab,
  sidebarList, mrtVendors, mapBounds,
  onSelectVendor,
}: {
  sidebarTab: "vendors" | "mrt"
  setSidebarTab: (tab: "vendors" | "mrt") => void
  sidebarList: Vendor[]
  mrtVendors: Vendor[]
  mapBounds: boolean
  onSelectVendor: (v: Vendor) => void
}) {
  return (
    <>
      {/* Tab bar */}
      <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <button
          onClick={() => setSidebarTab("vendors")}
          className="flex-1 text-xs py-2.5 font-semibold tracking-wide transition-colors"
          style={{
            color: sidebarTab === "vendors" ? GOLD : "hsl(var(--muted-foreground))",
            borderBottom: sidebarTab === "vendors" ? `2px solid ${GOLD}` : "2px solid transparent",
          }}
        >Vendor List</button>
        <button
          onClick={() => setSidebarTab("mrt")}
          className="flex-1 text-xs py-2.5 font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5"
          style={{
            color: sidebarTab === "mrt" ? GOLD : "hsl(var(--muted-foreground))",
            borderBottom: sidebarTab === "mrt" ? `2px solid ${GOLD}` : "2px solid transparent",
          }}
        >
          <Truck className="w-3 h-3" /> MRT Teams
          {mrtVendors.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: `${GOLD}25`, color: GOLD }}>{mrtVendors.length}</span>
          )}
        </button>
      </div>

      {sidebarTab === "vendors" ? (
        <VendorList vendors={sidebarList} hasMapBounds={mapBounds} onSelect={onSelectVendor} />
      ) : (
        <MrtList vendors={mrtVendors} onSelect={onSelectVendor} />
      )}
    </>
  )
}

function VendorList({ vendors, hasMapBounds, onSelect }: {
  vendors: Vendor[]; hasMapBounds: boolean; onSelect: (v: Vendor) => void
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<VendorOperationalStatus | "all">("all")
  const [showFilterDrop, setShowFilterDrop] = useState(false)

  const filtered = vendors.filter(v => {
    if (statusFilter !== "all" && v.operational_status !== statusFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      return (
        v.name.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q) ||
        v.airport_code?.toLowerCase().includes(q) ||
        v.state?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const activeStatusLabel = STATUS_FILTERS.find(f => f.value === statusFilter)?.label ?? "All"

  return (
    <>
      {/* Search + filter bar */}
      <div className="px-2 pt-2 pb-1 flex-shrink-0 space-y-1.5">
        {/* Search */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm"
          style={{ background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border))" }}>
          <Search className="w-3 h-3 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search vendors…"
            className="bg-transparent outline-none text-xs w-full placeholder:text-muted-foreground/50"
          />
        </div>
        {/* Status filter */}
        <div className="relative">
          <button
            onClick={() => setShowFilterDrop(p => !p)}
            className="flex items-center justify-between w-full px-2 py-1 rounded-sm text-xs"
            style={{ border: "1px solid hsl(var(--border))", background: statusFilter !== "all" ? STATUS_DISPLAY[statusFilter as VendorOperationalStatus].bg : "transparent" }}
          >
            <span className="flex items-center gap-1.5">
              {statusFilter !== "all" && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DISPLAY[statusFilter as VendorOperationalStatus].color }} />
              )}
              <span style={{ color: statusFilter !== "all" ? STATUS_DISPLAY[statusFilter as VendorOperationalStatus].color : "hsl(var(--muted-foreground))" }}>
                {activeStatusLabel}
              </span>
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
          {showFilterDrop && (
            <div className="absolute top-full left-0 right-0 mt-0.5 rounded-sm shadow-xl z-50 overflow-hidden"
              style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
              {STATUS_FILTERS.map(sf => (
                <button key={sf.value}
                  onClick={() => { setStatusFilter(sf.value); setShowFilterDrop(false) }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors"
                  style={{ color: sf.value !== "all" ? STATUS_DISPLAY[sf.value as VendorOperationalStatus].color : "hsl(var(--foreground))" }}
                >
                  {sf.value !== "all" && (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_DISPLAY[sf.value as VendorOperationalStatus].color }} />
                  )}
                  {sf.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-1 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {hasMapBounds ? "In current view" : "All vendors"} · {filtered.length}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10 px-4">
            {query.trim() || statusFilter !== "all"
              ? "No vendors match your filters."
              : "No vendors in this area. Pan or zoom out to find more."}
          </p>
        )}
        {filtered.map(v => <VendorRow key={v.id} vendor={v} onSelect={onSelect} />)}
      </div>
    </>
  )
}

function MrtList({ vendors, onSelect }: {
  vendors: Vendor[]; onSelect: (v: Vendor) => void
}) {
  return (
    <>
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Mobile Response Teams · {vendors.length}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {vendors.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-10 px-4">
            No MRT vendors yet. Add a vendor and check "Mobile Response Team."
          </p>
        )}
        {vendors.map(v => {
          const cfg = TYPE_CONFIG[v.vendor_type]
          const opStatus = STATUS_DISPLAY[v.operational_status] ?? STATUS_DISPLAY.discovered
          return (
            <button key={v.id} onClick={() => onSelect(v)}
              className="w-full text-left px-3 py-2.5 rounded-sm transition-colors"
              style={{ border: "1px solid hsl(var(--border))" }}
              onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--accent))")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                <span className="text-sm font-semibold truncate flex-1">{v.name}</span>
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0"
                  style={{ background: opStatus.bg, color: opStatus.color }}>
                  {opStatus.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 ml-5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                  style={{ background: `${cfg.color}18`, color: cfg.color }}>
                  {cfg.sym} {cfg.label}
                </span>
                {v.city && (
                  <span className="text-[10px] text-muted-foreground truncate">
                    {v.city}{v.state ? `, ${v.state}` : ""}
                  </span>
                )}
              </div>
              {v.phone && <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">{v.phone}</p>}
              {v.notes && (
                <p className="text-[10px] text-muted-foreground mt-1 ml-5 italic opacity-60 line-clamp-2">
                  {v.notes}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

function VendorRow({ vendor: v, onSelect }: { vendor: Vendor; onSelect: (v: Vendor) => void }) {
  const cfg = TYPE_CONFIG[v.vendor_type]
  const opStatus = STATUS_DISPLAY[v.operational_status] ?? STATUS_DISPLAY.discovered
  return (
    <button onClick={() => onSelect(v)}
      className="w-full text-left px-3 py-2.5 rounded-sm transition-colors"
      style={{ border: "1px solid hsl(var(--border))" }}
      onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--accent))")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
        <span className="text-sm font-semibold truncate flex-1">{v.name}</span>
        {v.preferred && <Star className="w-3 h-3 flex-shrink-0" style={{ color: GOLD }} fill={GOLD} />}
        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm flex-shrink-0"
          style={{ background: opStatus.bg, color: opStatus.color }}>
          {opStatus.label}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 ml-3.5">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
          style={{ background: `${cfg.color}18`, color: cfg.color }}>
          {cfg.sym} {cfg.label}
        </span>
        {v.city && (
          <span className="text-[10px] text-muted-foreground truncate">
            {v.city}{v.state ? `, ${v.state}` : ""}
          </span>
        )}
      </div>
      {v.phone && <p className="text-[11px] text-muted-foreground mt-0.5 ml-3.5">{v.phone}</p>}
      {v.notes && (
        <p className="text-[10px] text-muted-foreground mt-1 ml-3.5 italic opacity-60 line-clamp-2">
          {v.notes}
        </p>
      )}
    </button>
  )
}
