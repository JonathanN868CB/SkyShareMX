import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { GitBranch, ChevronRight, Loader2, CheckCircle2, XCircle, Clock, Send } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { QuoteStatus } from "../../types"

interface COSummary {
  id:            string
  woNumber:      string
  description:   string | null
  quoteStatus:   QuoteStatus | null
  createdAt:     string
  itemCount:     number
  estTotal:      number
  approvedCount: number
  declinedCount: number
}

interface Props {
  parentWoId:  string
  refreshKey?: number
}

const STATUS_META: Record<string, { color: string; Icon: React.ElementType; label: string }> = {
  draft:     { color: "#a1a1aa", Icon: Clock,        label: "Draft"     },
  sent:      { color: "#93c5fd", Icon: Send,         label: "Sent"      },
  approved:  { color: "#6ee7b7", Icon: CheckCircle2, label: "Approved"  },
  declined:  { color: "#fca5a5", Icon: XCircle,      label: "Declined"  },
  expired:   { color: "#fcd34d", Icon: Clock,        label: "Expired"   },
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ChangeOrdersPanel({ parentWoId, refreshKey = 0 }: Props) {
  const navigate = useNavigate()
  const [cos,     setCos]     = useState<COSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from("bb_work_orders")
      .select("id, wo_number, description, quote_status, created_at, bb_work_order_items(estimated_hours, labor_rate, customer_approval_status)")
      .eq("parent_wo_id", parentWoId)
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) { setError(err.message); return }

        const result: COSummary[] = (data ?? []).map((row: any) => {
          const items: any[]    = row.bb_work_order_items ?? []
          const estTotal        = items.reduce((s: number, i: any) => s + (i.estimated_hours ?? 0) * (i.labor_rate ?? 0), 0)
          const approvedCount   = items.filter((i: any) => i.customer_approval_status === "approved").length
          const declinedCount   = items.filter((i: any) => i.customer_approval_status === "declined").length
          return {
            id:            row.id,
            woNumber:      row.wo_number,
            description:   row.description ?? null,
            quoteStatus:   row.quote_status ?? null,
            createdAt:     row.created_at,
            itemCount:     items.length,
            estTotal,
            approvedCount,
            declinedCount,
          }
        })
        setCos(result)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load") })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [parentWoId, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderTop: "1px solid hsl(0,0%,17%)" }}>
        <Loader2 className="w-3 h-3 text-amber-400/50 animate-spin" />
        <span className="text-[10px] text-white/25">Loading change orders…</span>
      </div>
    )
  }

  if (error) return (
    <div className="px-5 py-3" style={{ borderTop: "1px solid hsl(0,0%,17%)" }}>
      <p className="text-red-400 text-xs">{error}</p>
    </div>
  )

  if (cos.length === 0) return null

  return (
    <div style={{ borderTop: "1px solid hsl(0,0%,17%)" }}>
      {/* Section header */}
      <div
        className="px-4 py-2 flex items-center gap-2"
        style={{ background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,16%)" }}
      >
        <GitBranch className="w-3.5 h-3.5 text-amber-400/60" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
          Change Orders ({cos.length})
        </span>
      </div>

      {/* CO rows */}
      <div className="py-1.5 px-1.5 space-y-0.5">
        {cos.map(co => {
          const meta = STATUS_META[co.quoteStatus ?? "draft"] ?? STATUS_META.draft
          const { color, Icon } = meta
          const hasDecisions = co.approvedCount > 0 || co.declinedCount > 0

          return (
            <button
              key={co.id}
              type="button"
              onClick={() => navigate(`/app/beet-box/work-orders/${co.id}`)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all hover:bg-white/[0.04] group"
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span
                    className="text-xs font-bold leading-none"
                    style={{ color, fontFamily: "var(--font-heading)" }}
                  >
                    {co.woNumber}
                  </span>
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ background: `${color}18`, color: `${color}bb` }}
                  >
                    {meta.label}
                  </span>
                  {co.description && (
                    <span className="text-[10px] text-white/35 truncate">{co.description}</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-white/30">
                    {co.itemCount} item{co.itemCount !== 1 ? "s" : ""}
                  </span>
                  {co.estTotal > 0 && (
                    <span className="text-[10px] text-white/30">${fmt(co.estTotal)}</span>
                  )}
                  {hasDecisions && (
                    <span className="text-[10px] flex items-center gap-1.5">
                      <span className="text-emerald-400/70">{co.approvedCount}✓</span>
                      {co.declinedCount > 0 && (
                        <span className="text-red-400/70">{co.declinedCount}✗</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="w-3.5 h-3.5 text-white/15 flex-shrink-0 group-hover:text-white/35 transition-colors" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ChangeOrdersPanel
