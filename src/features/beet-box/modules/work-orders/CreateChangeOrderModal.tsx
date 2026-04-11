import { useState } from "react"
import { Loader2, AlertTriangle, GitBranch, Check } from "lucide-react"
import type { WOItem } from "../../types"
import { createChangeOrder } from "../../services/quoteApprovals"

interface Props {
  open:               boolean
  onClose:            () => void
  parentWoId:         string
  pendingItems:       WOItem[]   // items where parentItemId && customerApprovalStatus === 'pending'
  createdByProfileId: string
  onCreated:          (coId: string, coNumber: string) => void
}

export function CreateChangeOrderModal({
  open, onClose, parentWoId, pendingItems, createdByProfileId, onCreated,
}: Props) {
  const [selected,    setSelected]    = useState<Set<string>>(new Set(pendingItems.map(i => i.id)))
  const [description, setDescription] = useState("")
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  if (!open) return null

  const canSubmit = selected.size > 0 && !submitting

  async function handleCreate() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const { id, coNumber } = await createChangeOrder(
        parentWoId,
        Array.from(selected),
        description.trim(),
        createdByProfileId,
      )
      onCreated(id, coNumber)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create change order")
      setSubmitting(false)
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }}>
      <div
        className="rounded-2xl p-7 max-w-xl w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "hsl(0,0%,12%)", border: "1px solid rgba(251,191,36,0.25)" }}
      >
        {/* Header */}
        <div>
          <h3
            className="text-white text-xl font-bold mb-1 flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <GitBranch className="w-5 h-5 text-amber-400" />
            Create Change Order
          </h3>
          <p className="text-white/45 text-sm leading-relaxed">
            Select the discrepancy items to bundle. They'll be sent to the customer for approval.
          </p>
        </div>

        {/* Item checklist */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2">
            Discrepancy Items ({selected.size} of {pendingItems.length} selected)
          </label>
          {pendingItems.length === 0 ? (
            <p className="text-white/35 text-sm italic">No pending discrepancy items found.</p>
          ) : (
            <div className="space-y-2">
              {pendingItems.map(item => {
                const isSelected  = selected.has(item.id)
                const accentColor = item.discrepancyType === "airworthy" ? "#c10230" : "#d4a017"
                const estCost     = item.estimatedHours * item.laborRate
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                    style={{
                      background: isSelected ? "rgba(255,255,255,0.06)" : "hsl(0,0%,9%)",
                      border:     `1px solid ${isSelected ? "rgba(255,255,255,0.18)" : "hsl(0,0%,20%)"}`,
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center transition-all"
                      style={{
                        background: isSelected ? "rgba(212,160,23,0.25)" : "hsl(0,0%,18%)",
                        border:     `1px solid ${isSelected ? "rgba(212,160,23,0.6)" : "hsl(0,0%,28%)"}`,
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white/85 truncate">{item.category}</span>
                        {item.discrepancyType && (
                          <span
                            className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: `${accentColor}22`, color: accentColor }}
                          >
                            {item.discrepancyType === "airworthy" ? "AW" : "REC"}
                          </span>
                        )}
                      </div>
                      {item.discrepancy && (
                        <p className="text-xs text-white/50 leading-snug line-clamp-2">{item.discrepancy}</p>
                      )}
                      {item.estimatedHours > 0 && (
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {item.estimatedHours}h × ${item.laborRate}/hr
                          {" = "}
                          <span className="text-amber-400/60">
                            ${estCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
            Description{" "}
            <span className="normal-case tracking-normal text-white/25">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
            style={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,22%)" }}
          />
        </div>

        {error && (
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: canSubmit ? "rgba(251,191,36,0.15)" : "hsl(0,0%,14%)",
              border:     `1px solid ${canSubmit ? "rgba(251,191,36,0.5)" : "hsl(0,0%,20%)"}`,
              color:      canSubmit ? "#fbbf24" : "rgba(255,255,255,0.3)",
              cursor:     canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
              : <><GitBranch className="w-4 h-4" /> Create Change Order</>}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-sm text-white/45 hover:text-white/70 transition-colors"
            style={{ border: "1px solid hsl(0,0%,26%)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateChangeOrderModal
