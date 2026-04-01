// ============================================================================
// Vendor Reports Page
// ============================================================================

import { useState, useEffect } from "react"
import {
  FileText, Download, Loader2, Calendar, Filter,
  FileSpreadsheet, ShieldCheck, ClipboardList, Trash2,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import {
  REPORT_TYPE_CONFIG,
  generateReport,
  type ReportType,
  type LaneFilter,
  type ReportRecord,
} from "@/features/vendors/reports"

const GOLD = "#d4a017"

const LANE_OPTIONS: { value: LaneFilter; label: string }[] = [
  { value: "all",  label: "All Lanes" },
  { value: "nine", label: "9-or-Less Only" },
  { value: "ten",  label: "10-or-More Only" },
]

const STATUS_OPTIONS = [
  { value: "",           label: "All Statuses" },
  { value: "approved",   label: "Approved" },
  { value: "pending",    label: "Pending" },
  { value: "discovered", label: "Discovered" },
  { value: "restricted", label: "Restricted" },
  { value: "inactive",   label: "Inactive" },
]

const REPORT_ICONS: Record<ReportType, React.ElementType> = {
  vendor_roster: FileSpreadsheet,
  vendor_audit: ClipboardList,
  compliance_summary: ShieldCheck,
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function VendorReports() {
  const { profile } = useAuth()
  const isManager = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"
  const isAdmin = profile?.role === "Super Admin" || profile?.role === "Admin"

  // Generation form
  const [reportType, setReportType] = useState<ReportType>("vendor_roster")
  const [laneFilter, setLaneFilter] = useState<LaneFilter>("all")
  const [statusFilter, setStatusFilter] = useState("")
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Report history
  const [reports, setReports] = useState<ReportRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoadingHistory(true)
    const { data } = await supabase
      .from("vendor_reports")
      .select("*")
      .order("generated_at", { ascending: false })
      .limit(50)

    const records = (data ?? []) as ReportRecord[]
    setReports(records)

    // Resolve user names
    const uids = [...new Set(records.map(r => r.generated_by).filter(Boolean))] as string[]
    if (uids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", uids)
      const names = new Map<string, string>()
      ;(profiles ?? []).forEach((p: any) => names.set(p.user_id, p.full_name ?? "Unknown"))
      setUserNames(names)
    }
    setLoadingHistory(false)
  }

  async function handleGenerate() {
    if (!profile) return
    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      const record = await generateReport({
        reportType,
        laneFilter,
        statusFilter: statusFilter || null,
        dateStart: dateStart || null,
        dateEnd: dateEnd || null,
        generatedBy: profile.full_name ?? "Unknown User",
        generatedByUid: profile.user_id,
      })
      setSuccess(`${record.title} generated successfully.`)
      await loadHistory()
    } catch (err: any) {
      setError(err.message || "Failed to generate report.")
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(report: ReportRecord) {
    if (!report.file_path) return

    const { data, error } = await supabase.storage
      .from("vendor-reports")
      .createSignedUrl(report.file_path, 300) // 5 min URL

    if (error || !data?.signedUrl) {
      setError("Failed to get download link.")
      return
    }
    window.open(data.signedUrl, "_blank")
  }

  async function handleDelete(report: ReportRecord) {
    if (!report.file_path) return

    // Delete from storage + database
    await supabase.storage.from("vendor-reports").remove([report.file_path])
    await supabase.from("vendor_reports").delete().eq("id", report.id)
    setReports(prev => prev.filter(r => r.id !== report.id))
  }

  const cfg = REPORT_TYPE_CONFIG[reportType]
  const showDateRange = reportType === "compliance_summary"

  return (
    <div className="flex flex-col h-full" style={{ background: "hsl(var(--background))", overflow: "hidden" }}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

          {/* ── Generate Report ──────────────────────────────────── */}
          {isManager && (
            <div className="rounded-md p-5" style={{ border: "1px solid hsl(var(--border))" }}>
              <p className="text-[9px] uppercase tracking-widest font-bold mb-4" style={{ color: GOLD }}>
                Generate New Report
              </p>

              {/* Report type cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
                {(Object.keys(REPORT_TYPE_CONFIG) as ReportType[]).map(type => {
                  const c = REPORT_TYPE_CONFIG[type]
                  const Icon = REPORT_ICONS[type]
                  const active = reportType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setReportType(type)}
                      className="flex flex-col items-start gap-2 p-4 rounded-md text-left transition-all"
                      style={{
                        border: `1px solid ${active ? GOLD : "hsl(var(--border))"}`,
                        background: active ? `${GOLD}08` : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" style={{ color: active ? GOLD : "hsl(var(--muted-foreground))" }} />
                        <span className="text-xs font-bold" style={{ color: active ? GOLD : "hsl(var(--foreground))" }}>
                          {c.label}
                        </span>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm ml-auto"
                          style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
                          {c.format.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{c.description}</p>
                    </button>
                  )
                })}
              </div>

              {/* Filters row */}
              <div className="flex flex-wrap items-end gap-4 mb-4">
                {/* Lane filter */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Lane
                  </label>
                  <select
                    value={laneFilter}
                    onChange={e => setLaneFilter(e.target.value as LaneFilter)}
                    className="text-xs px-2.5 py-1.5 rounded-sm"
                    style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", minWidth: 140 }}
                  >
                    {LANE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Status filter */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-sm"
                    style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", minWidth: 140 }}
                  >
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                {/* Date range (compliance only) */}
                {showDateRange && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> From
                      </label>
                      <input
                        type="date"
                        value={dateStart}
                        onChange={e => setDateStart(e.target.value)}
                        className="text-xs px-2.5 py-1.5 rounded-sm"
                        style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> To
                      </label>
                      <input
                        type="date"
                        value={dateEnd}
                        onChange={e => setDateEnd(e.target.value)}
                        className="text-xs px-2.5 py-1.5 rounded-sm"
                        style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
                      />
                    </div>
                  </>
                )}

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-sm text-xs font-bold transition-colors ml-auto"
                  style={{
                    background: generating ? `${GOLD}60` : GOLD,
                    color: "white",
                    cursor: generating ? "wait" : "pointer",
                  }}
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {generating ? "Generating…" : "Generate Report"}
                </button>
              </div>

              {/* Status messages */}
              {error && (
                <div className="text-xs px-3 py-2 rounded-sm mb-2" style={{ background: "#dc262612", color: "#dc2626", border: "1px solid #dc262630" }}>
                  {error}
                </div>
              )}
              {success && (
                <div className="text-xs px-3 py-2 rounded-sm" style={{ background: "#16a34a12", color: "#16a34a", border: "1px solid #16a34a30" }}>
                  {success}
                </div>
              )}
            </div>
          )}

          {/* ── Report History ───────────────────────────────────── */}
          <div className="rounded-md" style={{ border: "1px solid hsl(var(--border))" }}>
            <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              <FileText className="w-4 h-4 text-muted-foreground" />
              <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>
                Report History
              </p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
                {reports.length}
              </span>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground opacity-50">No reports generated yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--muted)/0.3)" }}>
                      <th className="text-left px-4 py-2"><span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Report</span></th>
                      <th className="text-left px-4 py-2"><span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Type</span></th>
                      <th className="text-left px-4 py-2"><span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Generated</span></th>
                      <th className="text-left px-4 py-2"><span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">By</span></th>
                      <th className="text-left px-4 py-2"><span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Size</span></th>
                      <th className="text-right px-4 py-2"><span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => {
                      const Icon = REPORT_ICONS[r.report_type] ?? FileText
                      const typeCfg = REPORT_TYPE_CONFIG[r.report_type]
                      const userName = r.generated_by ? (userNames.get(r.generated_by) ?? "—") : "—"

                      return (
                        <tr key={r.id}
                          className="transition-colors"
                          style={{ borderBottom: "1px solid hsl(var(--border)/0.5)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--accent))")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{r.title}</p>
                                {r.description && (
                                  <p className="text-[10px] text-muted-foreground truncate">{r.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase"
                              style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
                              {r.file_format}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] text-muted-foreground">{formatDate(r.generated_at)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] text-muted-foreground">{userName}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] text-muted-foreground font-mono">{formatBytes(r.file_size)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => handleDownload(r)}
                                className="flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-bold transition-colors"
                                style={{ color: GOLD, border: `1px solid ${GOLD}40` }}
                                onMouseEnter={e => (e.currentTarget.style.background = `${GOLD}12`)}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >
                                <Download className="w-3 h-3" /> Download
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(r)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-bold transition-colors text-muted-foreground hover:text-red-500"
                                  style={{ border: "1px solid hsl(var(--border))" }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
