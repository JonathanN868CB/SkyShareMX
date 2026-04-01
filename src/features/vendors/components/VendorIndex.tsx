import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, ChevronDown, ExternalLink, ArrowUpDown } from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  GOLD, STATUS_DISPLAY, TYPE_CONFIG,
  type Vendor, type VendorType, type VendorOperationalStatus,
} from "../constants"
import type { VendorLaneNine, VendorLaneTen } from "../types"

type SortKey = "name" | "status" | "type" | "state" | "lane9" | "lane10"
type SortDir = "asc" | "desc"

const NINE_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  not_evaluated:  { label: "Not Evaluated", color: "#6b7280" },
  usable:         { label: "Usable",        color: "#16a34a" },
  pending_review: { label: "Pending",       color: "#d97706" },
  restricted:     { label: "Restricted",    color: "#dc2626" },
  not_applicable: { label: "N/A",           color: "#9ca3af" },
}

const TEN_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  not_evaluated:     { label: "Not Evaluated", color: "#6b7280" },
  recurring_approved:{ label: "Recurring",     color: "#16a34a" },
  ad_hoc_only:       { label: "Ad Hoc Only",   color: "#0ea5e9" },
  pending_review:    { label: "Pending",        color: "#d97706" },
  expired:           { label: "Expired",        color: "#dc2626" },
  restricted:        { label: "Restricted",     color: "#dc2626" },
  inactive:          { label: "Inactive",       color: "#9ca3af" },
}

type VendorRow = Vendor & {
  lane_nine_status: string | null
  lane_ten_status: string | null
  doc_count: number
}

export function VendorIndex({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<VendorOperationalStatus | "all">("all")
  const [showFilterDrop, setShowFilterDrop] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  useEffect(() => { loadIndex() }, [])

  async function loadIndex() {
    setLoading(true)
    const [vendorRes, nineRes, tenRes, docRes] = await Promise.all([
      supabase.from("vendors").select("*").eq("active", true).order("name"),
      supabase.from("vendor_lane_nine").select("vendor_id, status"),
      supabase.from("vendor_lane_ten").select("vendor_id, status"),
      supabase.from("vendor_documents").select("vendor_id"),
    ])
    const nineMap = new Map<string, string>()
    ;(nineRes.data ?? []).forEach((r: any) => nineMap.set(r.vendor_id, r.status))
    const tenMap = new Map<string, string>()
    ;(tenRes.data ?? []).forEach((r: any) => tenMap.set(r.vendor_id, r.status))
    const docCounts = new Map<string, number>()
    ;(docRes.data ?? []).forEach((r: any) => docCounts.set(r.vendor_id, (docCounts.get(r.vendor_id) ?? 0) + 1))

    const rows: VendorRow[] = ((vendorRes.data ?? []) as Vendor[]).map(v => ({
      ...v,
      lane_nine_status: nineMap.get(v.id) ?? null,
      lane_ten_status: tenMap.get(v.id) ?? null,
      doc_count: docCounts.get(v.id) ?? 0,
    }))
    setVendors(rows)
    setLoading(false)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

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

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1
    switch (sortKey) {
      case "name":   return dir * a.name.localeCompare(b.name)
      case "status": return dir * (a.operational_status ?? "").localeCompare(b.operational_status ?? "")
      case "type":   return dir * (a.vendor_type ?? "").localeCompare(b.vendor_type ?? "")
      case "state":  return dir * (a.state ?? "").localeCompare(b.state ?? "")
      case "lane9":  return dir * (a.lane_nine_status ?? "zzz").localeCompare(b.lane_nine_status ?? "zzz")
      case "lane10": return dir * (a.lane_ten_status ?? "zzz").localeCompare(b.lane_ten_status ?? "zzz")
      default: return 0
    }
  })

  // Stats
  const approved  = vendors.filter(v => v.operational_status === "approved").length
  const pending   = vendors.filter(v => v.operational_status === "pending").length
  const restricted = vendors.filter(v => v.operational_status === "restricted").length

  const STATUS_FILTERS: { value: VendorOperationalStatus | "all"; label: string }[] = [
    { value: "all",        label: "All Statuses" },
    { value: "approved",   label: "Approved" },
    { value: "pending",    label: "Pending" },
    { value: "discovered", label: "Discovered" },
    { value: "restricted", label: "Restricted" },
    { value: "inactive",   label: "Inactive" },
  ]

  function SortHeader({ label, k, width }: { label: string; k: SortKey; width?: string }) {
    const active = sortKey === k
    return (
      <th
        className="text-left cursor-pointer select-none group"
        style={{ width, padding: "8px 12px" }}
        onClick={() => toggleSort(k)}
      >
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold"
          style={{ color: active ? GOLD : "hsl(var(--muted-foreground))" }}>
          {label}
          <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-80 transition-opacity" />
        </span>
      </th>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "hsl(var(--background))" }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div>
          <h2 className="text-lg font-bold tracking-wide" style={{ fontFamily: "var(--font-heading)", color: GOLD }}>
            Vendor Control Index
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {vendors.length} total vendors
            <span className="mx-2">·</span>
            <span style={{ color: "#16a34a" }}>{approved} approved</span>
            <span className="mx-1.5">·</span>
            <span style={{ color: "#d97706" }}>{pending} pending</span>
            {restricted > 0 && <>
              <span className="mx-1.5">·</span>
              <span style={{ color: "#dc2626" }}>{restricted} restricted</span>
            </>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm"
            style={{ background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border))", width: 220 }}>
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, city, airport…"
              className="bg-transparent outline-none text-xs w-full placeholder:text-muted-foreground/50"
            />
          </div>
          {/* Status filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDrop(p => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs"
              style={{ border: "1px solid hsl(var(--border))", minWidth: 130 }}
            >
              {statusFilter !== "all" && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DISPLAY[statusFilter].color }} />
              )}
              <span style={{ color: statusFilter !== "all" ? STATUS_DISPLAY[statusFilter].color : "hsl(var(--muted-foreground))" }}>
                {STATUS_FILTERS.find(f => f.value === statusFilter)?.label}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
            </button>
            {showFilterDrop && (
              <div className="absolute top-full right-0 mt-1 rounded-sm shadow-xl z-50 overflow-hidden min-w-[150px]"
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
          {/* Back to map */}
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-sm font-semibold transition-colors"
            style={{ border: `1px solid ${GOLD}50`, color: GOLD }}
            onMouseEnter={e => { e.currentTarget.style.background = `${GOLD}15` }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
          >
            Back to Map
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground">Loading vendor index…</p>
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--muted)/0.3)" }}>
                <SortHeader label="Vendor" k="name" />
                <SortHeader label="Type" k="type" width="100px" />
                <SortHeader label="Location" k="state" width="140px" />
                <SortHeader label="Status" k="status" width="110px" />
                <SortHeader label="9-or-Less" k="lane9" width="120px" />
                <SortHeader label="10-or-More" k="lane10" width="120px" />
                <th className="text-left" style={{ padding: "8px 12px", width: "60px" }}>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Docs</span>
                </th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                    No vendors match your filters.
                  </td>
                </tr>
              )}
              {sorted.map(v => {
                const typeCfg = TYPE_CONFIG[v.vendor_type as VendorType]
                const opStatus = STATUS_DISPLAY[v.operational_status] ?? STATUS_DISPLAY.discovered
                const nineCfg = v.lane_nine_status ? NINE_STATUS_LABEL[v.lane_nine_status] : null
                const tenCfg = v.lane_ten_status ? TEN_STATUS_LABEL[v.lane_ten_status] : null

                return (
                  <tr
                    key={v.id}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: "1px solid hsl(var(--border)/0.5)" }}
                    onClick={() => navigate(`/app/vendors/${v.id}`)}
                    onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--accent))")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{v.name}</span>
                        {v.preferred && <span className="text-[8px] font-bold px-1 py-0.5 rounded-sm" style={{ background: `${GOLD}20`, color: GOLD }}>PREF</span>}
                        {v.is_mrt && <span className="text-[8px] font-bold px-1 py-0.5 rounded-sm" style={{ background: `${GOLD}15`, color: GOLD }}>MRT</span>}
                      </div>
                      {v.airport_code && (
                        <span className="text-[10px] text-muted-foreground font-mono">{v.airport_code}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {typeCfg && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                          style={{ background: `${typeCfg.color}18`, color: typeCfg.color }}>
                          {typeCfg.sym} {typeCfg.label}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className="text-xs text-muted-foreground">
                        {v.city}{v.state ? `, ${v.state}` : ""}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className="text-[9px] font-bold px-2 py-1 rounded-sm inline-flex items-center gap-1.5"
                        style={{ background: opStatus.bg, color: opStatus.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: opStatus.color }} />
                        {opStatus.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {nineCfg ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                          style={{ color: nineCfg.color, background: `${nineCfg.color}12` }}>
                          {nineCfg.label}
                        </span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground opacity-40">—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {tenCfg ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                          style={{ color: tenCfg.color, background: `${tenCfg.color}12` }}>
                          {tenCfg.label}
                        </span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground opacity-40">—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {v.doc_count > 0 ? (
                        <span className="text-[10px] font-bold text-muted-foreground">{v.doc_count}</span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground opacity-40">—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-40" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
