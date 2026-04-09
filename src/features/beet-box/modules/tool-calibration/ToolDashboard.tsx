import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle, Clock, CheckCircle, Search, Download, Plus, Filter,
  Wrench, ShieldCheck, ChevronDown, ChevronRight, Bell, X, Settings2,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { useAuth } from "@/features/auth"
import { TOOL_INVENTORY } from "../../data/toolInventory"
import { ToolStatusBadge } from "../../shared/StatusBadge"
import { exportToolCalibrationPDF } from "./exportToolsPDF"
import type { Tool, ToolStatus, ToolType } from "../../types"

const MANAGER_ROLES = ["Super Admin", "Admin", "Manager", "Director of Maintenance"]

function getDaysUntilDue(tool: Tool): number | null {
  if (!tool.nextCalibrationDue) return null
  return Math.ceil((new Date(tool.nextCalibrationDue).getTime() - Date.now()) / 86400000)
}

function computeStatus(tool: Tool): ToolStatus {
  if (tool.inactive) return "retired"
  const days = getDaysUntilDue(tool)
  if (days === null) return tool.toolType === "Ref" ? "active" : "out_of_service"
  if (days < 0) return "overdue"
  if (days <= 30) return "due_soon"
  return "active"
}

function fmtDate(d: string | null, style: "short" | "long" = "short") {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US",
    style === "short"
      ? { month: "short", day: "numeric", year: "2-digit" }
      : { month: "long", day: "numeric", year: "numeric" }
  )
}

type SortKey = "toolNumber" | "description" | "make" | "location" | "lastCalibratedAt" | "nextCalibrationDue" | "status"
type FilterMode = "all" | "cert" | "ref" | "overdue" | "due_soon" | "active"

export default function ToolDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isManager = MANAGER_ROLES.includes(profile?.role ?? "")

  const [search, setSearch] = useState("")
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [sortKey, setSortKey] = useState<SortKey>("toolNumber")
  const [sortAsc, setSortAsc] = useState(true)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [showAlertBanner, setShowAlertBanner] = useState(true)
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  // Enrich tools with computed status
  const tools = useMemo(() =>
    TOOL_INVENTORY.map(t => ({ ...t, status: computeStatus(t) })),
    []
  )

  // Stats
  const stats = useMemo(() => {
    const cert = tools.filter(t => t.toolType === "Cert")
    return {
      total: tools.length,
      certified: cert.length,
      reference: tools.length - cert.length,
      current: cert.filter(t => t.status === "active").length,
      dueSoon: cert.filter(t => t.status === "due_soon").length,
      overdue: cert.filter(t => t.status === "overdue").length,
      oos: cert.filter(t => t.status === "out_of_service").length,
    }
  }, [tools])

  // Filter
  const filtered = useMemo(() => {
    let result = tools
    if (filterMode === "cert") result = result.filter(t => t.toolType === "Cert")
    if (filterMode === "ref") result = result.filter(t => t.toolType === "Ref")
    if (filterMode === "overdue") result = result.filter(t => t.status === "overdue")
    if (filterMode === "due_soon") result = result.filter(t => t.status === "due_soon")
    if (filterMode === "active") result = result.filter(t => t.status === "active")
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        (t.toolNumber ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.make ?? "").toLowerCase().includes(q) ||
        (t.model ?? "").toLowerCase().includes(q) ||
        (t.serialNumber ?? "").toLowerCase().includes(q) ||
        (t.location ?? "").toLowerCase().includes(q) ||
        (t.vendor ?? "").toLowerCase().includes(q)
      )
    }
    return result
  }, [tools, filterMode, search])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      const va = a[sortKey] ?? ""
      const vb = b[sortKey] ?? ""
      if (sortKey === "nextCalibrationDue" || sortKey === "lastCalibratedAt") {
        cmp = (va ? new Date(va as string).getTime() : 0) - (vb ? new Date(vb as string).getTime() : 0)
      } else {
        cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      }
      return sortAsc ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortAsc])

  // Grouped view
  const grouped = useMemo(() => ({
    overdue:  sorted.filter(t => t.status === "overdue"),
    due_soon: sorted.filter(t => t.status === "due_soon"),
    active:   sorted.filter(t => t.status === "active"),
    oos:      sorted.filter(t => t.status === "out_of_service" || t.status === "retired"),
  }), [sorted])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Overdue alert toast on mount
  useEffect(() => {
    if (stats.overdue > 0) setShowAlertBanner(true)
  }, [stats.overdue])

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest cursor-pointer hover:text-white/60 transition-colors select-none"
      style={{ fontFamily: "var(--font-heading)" }}
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortKey === field && <span className="ml-1 text-[10px]">{sortAsc ? "▲" : "▼"}</span>}
    </th>
  )

  const filterBtns: { key: FilterMode; label: string; count?: number }[] = [
    { key: "all", label: "All Tools", count: tools.length },
    { key: "cert", label: "Certified", count: stats.certified },
    { key: "ref", label: "Reference", count: stats.reference },
    { key: "overdue", label: "Overdue", count: stats.overdue },
    { key: "due_soon", label: "Due Soon", count: stats.dueSoon },
    { key: "active", label: "Current", count: stats.current },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              TOOL CALIBRATION
            </h1>
            <div style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }} className="mb-2" />
            <p className="text-white/45 text-sm" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
              {tools.length} tools tracked · {stats.certified} calibrated · Ogden Tool Room
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/50 hover:text-white/80 border border-white/10 hover:border-white/25 text-xs gap-1.5"
              onClick={() => exportToolCalibrationPDF(tools)}
            >
              <Download className="w-3.5 h-3.5" /> Export PDF
            </Button>
            {isManager && (
              <Button
                size="sm"
                className="text-xs gap-1.5"
                style={{ background: "var(--skyshare-gold)", color: "#1e1e1e" }}
                onClick={() => navigate("/app/beet-box/tool-calibration/new")}
              >
                <Plus className="w-3.5 h-3.5" /> Add Tool
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-5">

        {/* Overdue Alert Banner */}
        {stats.overdue > 0 && showAlertBanner && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40 animate-in fade-in duration-300">
            <Bell className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <p className="text-red-300 text-sm font-semibold">
                {stats.overdue} tool{stats.overdue > 1 ? "s" : ""} with OVERDUE calibration
              </p>
              <p className="text-red-400/70 text-xs mt-0.5">
                These tools must be removed from service immediately. Per 14 CFR §145.109, calibrated tools must not be used on certificated aircraft when calibration has lapsed.
              </p>
            </div>
            <button onClick={() => setShowAlertBanner(false)} className="text-red-400/50 hover:text-red-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {stats.dueSoon > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-800/40">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm">
              {stats.dueSoon} tool{stats.dueSoon > 1 ? "s" : ""} due for calibration within the next 30 days — schedule service soon
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {[
            { label: "Total Tools",  value: stats.total,     color: "text-white/70",     icon: Wrench,       borderColor: "rgba(255,255,255,0.1)" },
            { label: "Certified",    value: stats.certified,  color: "text-[#D4A017]",   icon: ShieldCheck,  borderColor: "rgba(212,160,23,0.3)" },
            { label: "Reference",    value: stats.reference,  color: "text-zinc-400",     icon: Settings2,    borderColor: "rgba(100,100,100,0.3)" },
            { label: "Current",      value: stats.current,    color: "text-emerald-400",  icon: CheckCircle,  borderColor: "rgba(16,185,129,0.3)" },
            { label: "Due Soon",     value: stats.dueSoon,    color: "text-amber-400",    icon: Clock,        borderColor: "rgba(245,158,11,0.3)" },
            { label: "Overdue",      value: stats.overdue,    color: "text-red-400",      icon: AlertTriangle,borderColor: "rgba(220,38,38,0.3)" },
          ].map(s => (
            <div
              key={s.label}
              className="card-elevated rounded-lg p-3 flex items-center gap-3"
              style={{ borderLeft: `3px solid ${s.borderColor}` }}
            >
              <s.icon className={`w-6 h-6 flex-shrink-0 ${s.color} opacity-50`} />
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search + Filter Row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
            <Input
              className="search-underline pl-9 text-sm"
              placeholder="Search tools by number, description, make, serial, location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {filterBtns.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterMode(f.key)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  filterMode === f.key
                    ? "bg-[#D4A017]/20 text-[#D4A017] border border-[#D4A017]/30"
                    : "text-white/40 hover:text-white/60 border border-transparent"
                }`}
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}
              >
                {f.label}
                {f.count !== undefined && (
                  <span className="ml-1 text-[10px] opacity-60">({f.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-white/25 text-xs">
          Showing {sorted.length} of {tools.length} tools
          {search && ` matching "${search}"`}
        </p>

        {/* Grouped tool tables */}
        {[
          { key: "overdue",  label: "Overdue Calibration",      headerColor: "text-red-400",     borderColor: "border-red-900/40",     tools: grouped.overdue },
          { key: "due_soon", label: "Due Within 30 Days",       headerColor: "text-amber-400",   borderColor: "border-amber-900/40",   tools: grouped.due_soon },
          { key: "active",   label: "Current / In Compliance",  headerColor: "text-emerald-400", borderColor: "border-emerald-900/20", tools: grouped.active },
          { key: "oos",      label: "Out of Service / Retired", headerColor: "text-zinc-500",    borderColor: "border-zinc-700/40",    tools: grouped.oos },
        ].map(group => {
          if (group.tools.length === 0) return null
          const isCollapsed = collapsedGroups.has(group.key)
          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className="flex items-center gap-2 mb-3 group"
              >
                {isCollapsed ? (
                  <ChevronRight className={`w-4 h-4 ${group.headerColor} opacity-60`} />
                ) : (
                  <ChevronDown className={`w-4 h-4 ${group.headerColor} opacity-60`} />
                )}
                <h3
                  className={`text-xs font-bold uppercase tracking-widest ${group.headerColor}`}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {group.label} ({group.tools.length})
                </h3>
              </button>

              {!isCollapsed && (
                <div className="card-elevated rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                        <SortHeader label="Tool #" field="toolNumber" />
                        <SortHeader label="Description" field="description" />
                        <th className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Type</th>
                        <SortHeader label="Make / Model" field="make" />
                        <th className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>S/N</th>
                        <SortHeader label="Location" field="location" />
                        <SortHeader label="Last Cal." field="lastCalibratedAt" />
                        <SortHeader label="Next Due" field="nextCalibrationDue" />
                        <th className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Interval</th>
                        <th className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tools.map((tool, idx) => {
                        const days = getDaysUntilDue(tool)
                        return (
                          <tr
                            key={tool.id}
                            onClick={() => navigate(`/app/beet-box/tool-calibration/${tool.id}`)}
                            className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                            style={{ borderBottom: idx < group.tools.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                          >
                            <td className="px-3 py-2.5 font-mono text-white/70 text-xs font-semibold whitespace-nowrap">{tool.toolNumber}</td>
                            <td className="px-3 py-2.5 text-white/80 text-sm max-w-[200px]"><span className="line-clamp-1">{tool.description}</span></td>
                            <td className="px-3 py-2.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                                tool.toolType === "Cert"
                                  ? "bg-[#D4A017]/15 text-[#D4A017]"
                                  : "bg-zinc-700/50 text-zinc-400"
                              }`}>
                                {tool.toolType}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-white/50 text-xs max-w-[140px]">
                              <span className="line-clamp-1">{[tool.make, tool.model].filter(Boolean).join(" · ") || "—"}</span>
                            </td>
                            <td className="px-3 py-2.5 text-white/40 text-xs font-mono">{tool.serialNumber || "—"}</td>
                            <td className="px-3 py-2.5 text-white/50 text-xs max-w-[120px]"><span className="line-clamp-1">{tool.location || "—"}</span></td>
                            <td className="px-3 py-2.5 text-white/50 text-xs whitespace-nowrap">{fmtDate(tool.lastCalibratedAt)}</td>
                            <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                              {tool.nextCalibrationDue ? (
                                <span className={
                                  days !== null && days < 0 ? "text-red-400 font-semibold" :
                                  days !== null && days <= 30 ? "text-amber-400 font-semibold" :
                                  "text-white/60"
                                }>
                                  {fmtDate(tool.nextCalibrationDue)}
                                  {days !== null && days < 0 && <span className="ml-1 text-[10px]">({Math.abs(days)}d ago)</span>}
                                  {days !== null && days >= 0 && days <= 30 && <span className="ml-1 text-[10px]">({days}d)</span>}
                                </span>
                              ) : (
                                <span className="text-white/25">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-white/40 text-xs">{tool.calibrationIntervalDays ? `${tool.calibrationIntervalDays}d` : "—"}</td>
                            <td className="px-3 py-2.5"><ToolStatusBadge status={tool.status} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
