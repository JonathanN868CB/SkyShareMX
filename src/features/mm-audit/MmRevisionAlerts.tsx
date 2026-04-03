import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { useRevisionAlerts, useCreateAuditRecordBatch, type RevisionAlert } from "./useMmAuditData"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

export default function MmRevisionAlerts({ campaignId, onOpenWorkspace }: { campaignId: string | null; onOpenWorkspace: () => void }) {
  const { data: alerts, isLoading, refetch } = useRevisionAlerts()
  const batchMut = useCreateAuditRecordBatch()

  if (isLoading || !alerts?.length) return null

  const handleDismiss = (alert: RevisionAlert) => {
    const today = new Date().toISOString().slice(0, 10)
    batchMut.mutate(
      {
        records: alert.affected_aircraft.map(a => ({
          aircraft_document_id: a.aircraft_document_id,
          audited_revision: alert.current_revision,
          audit_date: today,
          campaign_id: campaignId,
          notes: `Rev change ${alert.previous_revision} → ${alert.current_revision} — no program impact`,
        })),
      },
      { onSuccess: () => refetch() }
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "rgba(245,158,11,0.8)", fontFamily: "var(--font-heading)" }}
        >
          Revision Alerts ({alerts.length})
        </span>
      </div>

      {alerts.map(alert => (
        <div
          key={alert.source_document_id}
          className="rounded-lg px-4 py-3 space-y-2"
          style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                {alert.document_name}
              </span>
              <span className="ml-2 text-[11px]" style={{ color: "#f59e0b" }}>
                Rev {alert.previous_revision} → {alert.current_revision}
              </span>
            </div>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              {alert.affected_aircraft.length} aircraft affected
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {alert.affected_aircraft.map(a => (
              <span
                key={a.aircraft_document_id}
                className="px-1.5 py-0.5 rounded text-[11px]"
                style={{ background: rgba(0.06), color: "rgba(255,255,255,0.6)" }}
              >
                {a.registration}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onOpenWorkspace}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
              style={{ background: rgba(0.1), color: C, border: `1px solid ${rgba(0.2)}`, fontFamily: "var(--font-heading)" }}
            >
              Review Now
            </button>
            <button
              onClick={() => handleDismiss(alert)}
              disabled={batchMut.isPending}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-heading)" }}
            >
              {batchMut.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin inline" />
              ) : (
                "Dismiss — No Program Impact"
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
