import { useState } from "react"
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react"
import { useCreateAuditRecordBatch, type WorkspaceDocGroup } from "./useMmAuditData"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

interface Props {
  groups: WorkspaceDocGroup[]
  campaignId: string | null
  onClose: () => void
  onSuccess: () => void
}

export default function MmBatchReviewDialog({ groups, campaignId, onClose, onSuccess }: Props) {
  const [notes, setNotes] = useState("")
  const batchMut = useCreateAuditRecordBatch()

  // Collect all unreviewed items across all selected groups
  const pendingItems = groups.flatMap(g =>
    g.items.filter(item => item.status !== "current").map(item => ({
      aircraft_document_id: item.aircraft_document_id,
      audited_revision: g.current_revision,
      registration: item.registration,
      document_name: g.document_name,
      previous_revision: item.latest_audit?.audited_revision ?? null,
    }))
  )

  const totalRecords = pendingItems.length
  const revisionChanges = groups.filter(g => g.has_revision_change)

  const handleConfirm = () => {
    const today = new Date().toISOString().slice(0, 10)
    batchMut.mutate(
      {
        records: pendingItems.map(item => ({
          aircraft_document_id: item.aircraft_document_id,
          audited_revision: item.audited_revision,
          audit_date: today,
          campaign_id: campaignId,
          notes: notes.trim() || null,
        })),
      },
      { onSuccess }
    )
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 space-y-4 w-full max-w-lg shadow-2xl"
        style={{ background: "#1a1a2e", border: `1px solid ${rgba(0.2)}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" style={{ color: "#10b981" }} />
          <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.9)" }}>
            Confirm Batch Review
          </span>
        </div>

        {/* Prominent revision stamp */}
        {groups.map(g => (
          <div
            key={g.source_document_id}
            className="rounded-lg px-4 py-3"
            style={{ background: rgba(0.06), border: `1px solid ${rgba(0.12)}` }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
              {g.document_name}
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}
              >
                Stamping at
              </span>
              <span className="text-sm font-bold" style={{ color: C }}>
                Rev {g.current_revision}
              </span>
              {g.current_rev_date && (
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                  ({g.current_rev_date})
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Revision change warning */}
        {revisionChanges.length > 0 && (
          <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
            <div className="text-xs" style={{ color: "#f59e0b" }}>
              <div className="font-bold mb-1">Revision has changed since last audit</div>
              {revisionChanges.map(g => (
                <div key={g.source_document_id}>
                  {g.document_number}: {g.previous_revision} → {g.current_revision}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aircraft list */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
            {totalRecords} aircraft will be marked reviewed
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {pendingItems.map(item => (
              <span
                key={item.aircraft_document_id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                style={{ background: rgba(0.06), color: "rgba(255,255,255,0.7)" }}
              >
                <span className="font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{item.registration}</span>
                {item.previous_revision && item.previous_revision !== item.audited_revision && (
                  <span className="text-[10px]" style={{ color: "#f59e0b" }}>
                    Rev {item.previous_revision} → {item.audited_revision}
                  </span>
                )}
                {!item.previous_revision && (
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>first audit</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label
            className="block mb-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: rgba(0.6), fontFamily: "var(--font-heading)" }}
          >
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g., Quarterly review — no program impact from revision changes"
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-xs resize-none outline-none"
            style={{
              background: rgba(0.06),
              border: `1px solid ${rgba(0.15)}`,
              color: "rgba(255,255,255,0.8)",
            }}
          />
        </div>

        {/* Error */}
        {batchMut.isError && (
          <div className="text-xs" style={{ color: "#f87171" }}>
            Failed to create records. Please try again.
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={batchMut.isPending}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={batchMut.isPending || totalRecords === 0}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "#10b981", color: "#fff" }}
          >
            {batchMut.isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </span>
            ) : (
              `Confirm ${totalRecords} at Rev ${groups[0]?.current_revision ?? ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
