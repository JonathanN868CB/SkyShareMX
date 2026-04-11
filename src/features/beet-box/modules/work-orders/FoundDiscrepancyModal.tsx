import { useState } from "react"
import { AlertTriangle, Loader2, Wrench } from "lucide-react"
import type { WOItem } from "../../types"

interface Props {
  open:        boolean
  onClose:     () => void
  /** The inspection item the discrepancy was found on. */
  parentItem:  WOItem
  laborRate:   number
  onSubmit: (payload: {
    discrepancyType:  "airworthy" | "recommendation"
    discrepancy:      string
    correctiveAction: string
    estimatedHours:   number
    partNumber:       string
  }) => Promise<void>
}

export function FoundDiscrepancyModal({ open, onClose, parentItem, laborRate, onSubmit }: Props) {
  const [discrepancyType, setDiscrepancyType] = useState<"airworthy" | "recommendation">("airworthy")
  const [discrepancy,      setDiscrepancy]     = useState("")
  const [correctiveAction, setCorrectiveAction] = useState("")
  const [estimatedHours,   setEstimatedHours]   = useState("1")
  const [partNumber,       setPartNumber]        = useState("")
  const [submitting,       setSubmitting]        = useState(false)
  const [error,            setError]             = useState<string | null>(null)

  if (!open) return null

  const canSubmit = discrepancy.trim().length > 3 && !submitting

  const accentColor = discrepancyType === "airworthy" ? "#c10230" : "#d4a017"

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        discrepancyType,
        discrepancy:      discrepancy.trim(),
        correctiveAction: correctiveAction.trim(),
        estimatedHours:   parseFloat(estimatedHours) || 0,
        partNumber:       partNumber.trim(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record discrepancy")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }}>
      <div
        className="rounded-2xl p-7 max-w-lg w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "hsl(0,0%,12%)", border: `1px solid ${accentColor}55` }}
      >
        {/* Header */}
        <div>
          <h3
            className="text-white text-xl font-bold mb-1 flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <Wrench className="w-5 h-5" style={{ color: accentColor }} />
            Found Discrepancy
          </h3>
          <p className="text-white/45 text-sm leading-relaxed">
            Record a finding discovered on item #{parentItem.itemNumber}.
          </p>
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/30 truncate">
            {parentItem.category}
          </div>
        </div>

        {/* Discrepancy type */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-2">
            Finding Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "airworthy",      label: "Airworthy",      color: "#c10230" },
              { v: "recommendation", label: "Recommendation",  color: "#d4a017" },
            ] as const).map(opt => {
              const active = discrepancyType === opt.v
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setDiscrepancyType(opt.v)}
                  className="py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
                  style={{
                    background: active ? `${opt.color}22` : "hsl(0,0%,9%)",
                    border:     `1px solid ${active ? opt.color + "77" : "hsl(0,0%,22%)"}`,
                    color:      active ? opt.color : "rgba(255,255,255,0.4)",
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-white/30 leading-relaxed">
            {discrepancyType === "airworthy"
              ? "Aircraft must be grounded until corrected. Will appear as a red AIRWORTHY badge on the change order."
              : "Maintenance recommended but not required for airworthiness. Appears as a gold RECOMMENDATION badge."}
          </p>
        </div>

        {/* Discrepancy description */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
            Discrepancy <span className="text-red-400">*</span>
          </label>
          <textarea
            value={discrepancy}
            onChange={e => setDiscrepancy(e.target.value)}
            placeholder=""
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
            style={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,22%)" }}
          />
        </div>

        {/* Corrective action */}
        <div>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
            Proposed Corrective Action
          </label>
          <textarea
            value={correctiveAction}
            onChange={e => setCorrectiveAction(e.target.value)}
            placeholder=""
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
            style={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,22%)" }}
          />
        </div>

        {/* Hours + Part # */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
              Est. Hours
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={estimatedHours}
              onChange={e => setEstimatedHours(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,22%)" }}
            />
            {parseFloat(estimatedHours) > 0 && (
              <p className="mt-1 text-[10px] text-white/30">
                ≈ ${(parseFloat(estimatedHours) * laborRate).toFixed(2)} labor
              </p>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
              Part # (optional)
            </label>
            <input
              type="text"
              value={partNumber}
              onChange={e => setPartNumber(e.target.value)}
            placeholder=""
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,22%)" }}
            />
          </div>
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
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: canSubmit ? `${accentColor}22` : "hsl(0,0%,14%)",
              border:     `1px solid ${canSubmit ? accentColor + "66" : "hsl(0,0%,20%)"}`,
              color:      canSubmit ? accentColor : "rgba(255,255,255,0.3)",
              cursor:     canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</>
              : <><Wrench className="w-4 h-4" /> Record Discrepancy</>}
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

export default FoundDiscrepancyModal
