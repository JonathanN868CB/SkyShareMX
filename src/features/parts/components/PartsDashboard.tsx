import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, Package, Search, X, Filter, RotateCcw, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/shared/ui/select"
import { PartsStatusBadge } from "./PartsStatusBadge"
import { REQUEST_STATUSES, type RequestStatus } from "../constants"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartsRequestRow {
  id: string
  order_type: string
  aircraft_tail: string | null
  job_description: string
  work_order: string | null
  item_number: string | null
  stock_purpose: string | null
  date_needed: string
  ship_to: string
  aog: boolean
  delay_affects_rts: boolean
  status: RequestStatus
  requested_by: string
  created_at: string
  // joined
  requester_name: string
  line_count: number
  lines_ordered: number
  has_open_core_return: boolean
}

interface ProfileMap {
  [id: string]: string
}

type SortField = "date_needed" | "created_at" | "job_description" | "status"
type SortDir = "asc" | "desc"

// ─── Component ────────────────────────────────────────────────────────────────

export function PartsDashboard() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<PartsRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all")
  const [aircraftFilter, setAircraftFilter] = useState<string>("all")
  const [aogOnly, setAogOnly] = useState(false)
  const [coreReturnsOnly, setCoreReturnsOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Sort
  const [sortField, setSortField] = useState<SortField>("date_needed")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  // Load data
  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    setLoading(true)
    try {
      // Fetch requests
      const { data: reqData, error: reqErr } = await supabase
        .from("parts_requests")
        .select("*")
        .order("created_at", { ascending: false })

      if (reqErr) throw reqErr
      if (!reqData || reqData.length === 0) {
        setRequests([])
        return
      }

      // Fetch line counts per request
      const requestIds = reqData.map((r: { id: string }) => r.id)
      const { data: lineData } = await supabase
        .from("parts_request_lines")
        .select("request_id, line_status, is_exchange, core_status")
        .in("request_id", requestIds)

      // Count lines per request
      const lineCounts: Record<string, { total: number; ordered: number; hasOpenCore: boolean }> = {}
      lineData?.forEach((l: { request_id: string; line_status: string; is_exchange: boolean; core_status: string | null }) => {
        if (!lineCounts[l.request_id]) lineCounts[l.request_id] = { total: 0, ordered: 0, hasOpenCore: false }
        lineCounts[l.request_id].total++
        if (["ordered", "shipped", "received", "closed"].includes(l.line_status)) {
          lineCounts[l.request_id].ordered++
        }
        if (l.is_exchange && (!l.core_status || !["closed"].includes(l.core_status))) {
          lineCounts[l.request_id].hasOpenCore = true
        }
      })

      // Fetch requester profiles
      const requesterIds = [...new Set(reqData.map((r: { requested_by: string }) => r.requested_by))]
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, first_name, last_name")
        .in("id", requesterIds)

      const profileMap: ProfileMap = {}
      profiles?.forEach((p: { id: string; display_name: string | null; full_name: string | null; first_name: string | null; last_name: string | null }) => {
        profileMap[p.id] = p.display_name || p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown"
      })

      const rows: PartsRequestRow[] = reqData.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        order_type: r.order_type as string,
        aircraft_tail: r.aircraft_tail as string | null,
        job_description: r.job_description as string,
        work_order: r.work_order as string | null,
        item_number: r.item_number as string | null,
        stock_purpose: r.stock_purpose as string | null,
        date_needed: r.date_needed as string,
        ship_to: r.ship_to as string,
        aog: r.aog as boolean,
        delay_affects_rts: r.delay_affects_rts as boolean,
        status: r.status as RequestStatus,
        requested_by: r.requested_by as string,
        created_at: r.created_at as string,
        requester_name: profileMap[r.requested_by as string] ?? "Unknown",
        line_count: lineCounts[r.id as string]?.total ?? 0,
        lines_ordered: lineCounts[r.id as string]?.ordered ?? 0,
        has_open_core_return: lineCounts[r.id as string]?.hasOpenCore ?? false,
      }))

      setRequests(rows)
    } catch (err) {
      console.error("Failed to load parts requests:", err)
    } finally {
      setLoading(false)
    }
  }

  // Derived data
  const aircraftTails = useMemo(() => {
    const tails = new Set<string>()
    requests.forEach(r => { if (r.aircraft_tail) tails.add(r.aircraft_tail) })
    return [...tails].sort()
  }, [requests])

  const filtered = useMemo(() => {
    let result = requests

    // Filter by status (all = include everything; active/historical split handles display)
    if (statusFilter !== "all") {
      result = result.filter(r => r.status === statusFilter)
    }

    if (aircraftFilter !== "all") {
      result = result.filter(r =>
        aircraftFilter === "stock"
          ? r.order_type === "stock"
          : r.aircraft_tail === aircraftFilter
      )
    }

    if (aogOnly) {
      result = result.filter(r => r.aog)
    }

    if (coreReturnsOnly) {
      result = result.filter(r => r.has_open_core_return)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        r.job_description.toLowerCase().includes(q) ||
        (r.aircraft_tail?.toLowerCase().includes(q)) ||
        (r.work_order?.toLowerCase().includes(q)) ||
        r.requester_name.toLowerCase().includes(q)
      )
    }

    // Sort — AOG always pinned first
    result.sort((a, b) => {
      // AOG first
      if (a.aog !== b.aog) return a.aog ? -1 : 1

      const dir = sortDir === "asc" ? 1 : -1
      switch (sortField) {
        case "date_needed":
          return (a.date_needed > b.date_needed ? 1 : -1) * dir
        case "created_at":
          return (a.created_at > b.created_at ? 1 : -1) * dir
        case "job_description":
          return a.job_description.localeCompare(b.job_description) * dir
        case "status":
          return a.status.localeCompare(b.status) * dir
        default:
          return 0
      }
    })

    return result
  }, [requests, statusFilter, aircraftFilter, aogOnly, searchQuery, sortField, sortDir])

  // Split: active vs historical
  const activeRequests = filtered.filter(r => r.status !== "closed" && r.status !== "cancelled")
  const historicalRequests = filtered.filter(r => r.status === "closed" || r.status === "cancelled")

  const aogRequests = activeRequests.filter(r => r.aog)
  const nonAogRequests = activeRequests.filter(r => !r.aog)
  const hasActiveFilters = statusFilter !== "all" || aircraftFilter !== "all" || aogOnly || coreReturnsOnly || searchQuery.trim()

  // Group historical by year, newest first
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set())

  const yearGroups = useMemo(() => {
    const groups = new Map<string, PartsRequestRow[]>()
    for (const r of historicalRequests) {
      const year = new Date(r.created_at).getFullYear().toString()
      const list = groups.get(year) ?? []
      list.push(r)
      groups.set(year, list)
    }
    return [...groups.entries()].sort((a, b) => Number(b[0]) - Number(a[0]))
  }, [historicalRequests])

  function toggleYear(year: string) {
    setExpandedYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  // Sort handler
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function formatDate(iso: string) {
    const d = new Date(iso + "T00:00:00")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  function formatTimestamp(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  function jobLabel(r: PartsRequestRow) {
    if (r.order_type === "stock") {
      return `Stock — ${r.job_description}`
    }
    return `${r.aircraft_tail} — ${r.job_description}`
  }

  function lineProgress(r: PartsRequestRow) {
    if (r.line_count === 0) return ""
    if (r.lines_ordered === 0) return `${r.line_count} part${r.line_count > 1 ? "s" : ""}`
    return `${r.lines_ordered} of ${r.line_count}`
  }

  function renderRow(r: PartsRequestRow) {
    return (
      <tr
        key={r.id}
        onClick={() => navigate(`/app/beet-box/parts/${r.id}`)}
        className="transition-colors cursor-pointer"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {/* AOG */}
        <td className="px-3 py-3 w-10">
          {r.aog && (
            <AlertTriangle className="w-4 h-4" style={{ color: "rgba(255,80,80,0.9)" }} />
          )}
        </td>

        {/* Job */}
        <td className="px-3 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
              {jobLabel(r)}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Req: {r.requester_name} · {formatTimestamp(r.created_at)}
            </span>
          </div>
        </td>

        {/* WO */}
        <td className="px-3 py-3">
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {r.work_order ?? "—"}
          </span>
        </td>

        {/* Parts */}
        <td className="px-3 py-3">
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {lineProgress(r)}
          </span>
        </td>

        {/* Status */}
        <td className="px-3 py-3">
          <PartsStatusBadge status={r.status} />
        </td>

        {/* Need By */}
        <td className="px-3 py-3">
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {formatDate(r.date_needed)}
          </span>
        </td>

        {/* RTS flag */}
        <td className="px-3 py-3 w-10">
          {r.delay_affects_rts && (
            <span
              className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,165,80,0.12)", color: "rgba(255,165,80,0.9)" }}
              title="Delayed parts will change return-to-service"
            >
              RTS
            </span>
          )}
        </td>
      </tr>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading parts requests…</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "rgba(255,255,255,0.3)" }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search jobs, aircraft, people…"
            className="w-full rounded-md pl-9 pr-3 py-2 text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.9)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as RequestStatus | "all")}>
          <SelectTrigger
            className="rounded-md px-3 py-2 text-sm h-auto w-auto min-w-[140px]"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Active</SelectItem>
            {REQUEST_STATUSES.map(s => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Aircraft filter */}
        <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
          <SelectTrigger
            className="rounded-md px-3 py-2 text-sm h-auto w-auto min-w-[140px]"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Aircraft</SelectItem>
            <SelectItem value="stock">Stock Orders</SelectItem>
            {aircraftTails.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* AOG toggle */}
        <button
          onClick={() => setAogOnly(!aogOnly)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors"
          style={{
            background: aogOnly ? "rgba(255,60,60,0.12)" : "rgba(255,255,255,0.05)",
            border: aogOnly ? "1px solid rgba(255,60,60,0.3)" : "1px solid rgba(255,255,255,0.1)",
            color: aogOnly ? "rgba(255,100,100,0.9)" : "rgba(255,255,255,0.5)",
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          AOG
        </button>

        {/* Core Returns toggle */}
        <button
          onClick={() => setCoreReturnsOnly(!coreReturnsOnly)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors"
          style={{
            background: coreReturnsOnly ? "rgba(178,130,255,0.12)" : "rgba(255,255,255,0.05)",
            border: coreReturnsOnly ? "1px solid rgba(178,130,255,0.3)" : "1px solid rgba(255,255,255,0.1)",
            color: coreReturnsOnly ? "rgba(178,130,255,0.9)" : "rgba(255,255,255,0.5)",
          }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Cores Due
        </button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setStatusFilter("all")
              setAircraftFilter("all")
              setAogOnly(false)
              setCoreReturnsOnly(false)
              setSearchQuery("")
            }}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Clear filters
          </button>
        )}

        {/* Count */}
        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          {activeRequests.length} active{historicalRequests.length > 0 ? ` · ${historicalRequests.length} historical` : ""}
        </span>
      </div>

      {/* ── AOG Section ──────────────────────────────────────────────────── */}
      {aogRequests.length > 0 && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{
            borderColor: "rgba(255,60,60,0.2)",
            background: "rgba(255,60,60,0.03)",
          }}
        >
          <div
            className="px-4 py-2 flex items-center gap-2"
            style={{
              background: "rgba(255,60,60,0.08)",
              borderBottom: "1px solid rgba(255,60,60,0.15)",
            }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: "rgba(255,80,80,0.9)" }} />
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "rgba(255,100,100,0.9)", fontFamily: "var(--font-heading)" }}
            >
              AOG
            </span>
            <span className="text-xs" style={{ color: "rgba(255,100,100,0.5)" }}>
              {aogRequests.length}
            </span>
          </div>
          <table className="w-full">
            <tbody>
              {aogRequests.map(r => renderRow(r))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Active Orders ────────────────────────────────────────────────── */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {/* Table header */}
        <div
          className="px-4 py-2 flex items-center gap-2"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Filter className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.25)" }} />
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}
          >
            {aogRequests.length > 0 ? "Other Orders" : "Active Orders"}
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            {nonAogRequests.length}
          </span>
        </div>

        {nonAogRequests.length === 0 && aogRequests.length === 0 ? (
          <div className="px-4 py-12 flex flex-col items-center gap-3">
            <Package className="w-10 h-10" style={{ color: "rgba(255,255,255,0.1)" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              {hasActiveFilters ? "No requests match your filters" : "No active parts requests"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th className="w-10" />
                <th
                  className="px-3 py-2 text-left text-xs font-medium cursor-pointer select-none"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onClick={() => toggleSort("job_description")}
                >
                  Job{sortIndicator("job_description")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                  WO#
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Parts
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium cursor-pointer select-none"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onClick={() => toggleSort("status")}
                >
                  Status{sortIndicator("status")}
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-medium cursor-pointer select-none"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                  onClick={() => toggleSort("date_needed")}
                >
                  Need By{sortIndicator("date_needed")}
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {nonAogRequests.map(r => renderRow(r))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Historical Orders — collapsed by year ───────────────────── */}
      {yearGroups.length > 0 && (
        <div className="space-y-1">
          {yearGroups.map(([year, records]) => (
            <div
              key={year}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <button
                onClick={() => toggleYear(year)}
                className="w-full px-4 py-2.5 flex items-center gap-2 text-left transition-colors"
                style={{
                  background: expandedYears.has(year) ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = expandedYears.has(year) ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)")}
              >
                <ChevronRight
                  className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
                  style={{
                    color: "rgba(212,160,23,0.5)",
                    transform: expandedYears.has(year) ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                />
                <span
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}
                >
                  {year}
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {records.length} order{records.length !== 1 ? "s" : ""}
                </span>
              </button>

              {expandedYears.has(year) && (
                <table className="w-full">
                  <tbody>
                    {records.map(r => renderRow(r))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
