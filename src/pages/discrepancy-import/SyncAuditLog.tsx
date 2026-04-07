// SyncAuditLog — shows the history of every JetInsight Excel sync
// Admin+ only (mirrors the RLS policy on jetinsight_sync_log)

import { useEffect, useState } from "react"
import { History, RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"

interface SyncLogRow {
  id: string
  synced_at: string
  synced_by_name: string | null
  file_name: string | null
  tails: string[]
  inserted_count: number
  updated_count: number
  failed_count: number
  unchanged_count: number
  first_error: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

export default function SyncAuditLog() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === "Admin" || profile?.role === "Super Admin"
  const [rows, setRows] = useState<SyncLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin])

  async function load() {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("jetinsight_sync_log")
      .select("id, synced_at, synced_by_name, file_name, tails, inserted_count, updated_count, failed_count, unchanged_count, first_error")
      .order("synced_at", { ascending: false })
      .limit(50)
    setRows((data ?? []) as unknown as SyncLogRow[])
    setLoading(false)
  }

  if (!isAdmin) return null

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:brightness-110 transition-all"
        style={{ borderBottom: expanded ? "1px solid rgba(255,255,255,0.05)" : "none", background: "rgba(255,255,255,0.01)" }}
      >
        <History className="w-3.5 h-3.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }} />
        <span
          className="text-[9px] font-semibold uppercase tracking-widest flex-1 text-left"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.7 }}
        >
          Sync History
        </span>
        <button
          onClick={e => { e.stopPropagation(); load() }}
          className="mr-2 opacity-40 hover:opacity-70 transition-opacity"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" style={{ color: "hsl(var(--muted-foreground))" }} />
        </button>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 opacity-40" style={{ color: "hsl(var(--muted-foreground))" }} />
          : <ChevronDown className="w-3.5 h-3.5 opacity-40" style={{ color: "hsl(var(--muted-foreground))" }} />
        }
      </button>

      {expanded && (
        <div className="p-4">
          {loading ? (
            <p className="text-xs text-center py-4" style={{ color: "hsl(var(--muted-foreground))" }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
              No syncs recorded yet. Run your first sync above.
            </p>
          ) : (
            <div className="rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: "rgba(20,20,20,0.97)" }}>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["When", "By", "File", "Tails", "Added", "Updated", "Unchanged", "Failed"].map((h, i) => (
                        <th
                          key={i}
                          className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-medium whitespace-nowrap"
                          style={{ color: "hsl(var(--muted-foreground))" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td className="px-3 py-2 text-[11px] whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {formatDate(row.synced_at)}
                        </td>
                        <td className="px-3 py-2 text-[11px] whitespace-nowrap" style={{ color: "hsl(var(--foreground))" }}>
                          {row.synced_by_name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-[11px] max-w-[180px] truncate" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.7 }} title={row.file_name ?? undefined}>
                          {row.file_name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-[11px] whitespace-nowrap" style={{ color: "var(--skyshare-gold)", fontFamily: "'Courier Prime','Courier New',monospace" }}>
                          {row.tails.length > 0 ? row.tails.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-2 text-[12px] font-semibold whitespace-nowrap" style={{ color: row.inserted_count > 0 ? "rgba(100,220,100,0.85)" : "hsl(var(--muted-foreground))" }}>
                          {row.inserted_count > 0 ? `+${row.inserted_count}` : "—"}
                        </td>
                        <td className="px-3 py-2 text-[12px] font-semibold whitespace-nowrap" style={{ color: row.updated_count > 0 ? "rgba(100,170,255,0.85)" : "hsl(var(--muted-foreground))" }}>
                          {row.updated_count > 0 ? row.updated_count : "—"}
                        </td>
                        <td className="px-3 py-2 text-[11px] whitespace-nowrap" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
                          {row.unchanged_count > 0 ? row.unchanged_count : "—"}
                        </td>
                        <td className="px-3 py-2 text-[11px] whitespace-nowrap">
                          {row.failed_count > 0 ? (
                            <span
                              className="flex items-center gap-1"
                              style={{ color: "rgba(255,100,100,0.8)" }}
                              title={row.first_error ?? undefined}
                            >
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              {row.failed_count}
                            </span>
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "rgba(100,220,100,0.4)" }} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length >= 50 && (
                <div className="px-3 py-2 text-[11px]" style={{ color: "hsl(var(--muted-foreground))", borderTop: "1px solid rgba(255,255,255,0.04)", opacity: 0.5 }}>
                  Showing last 50 syncs
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
