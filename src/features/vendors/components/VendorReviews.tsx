import { useState } from "react"
import {
  ClipboardCheck, Plus, X, CheckCircle2, XCircle,
  AlertTriangle, Clock, CalendarCheck,
} from "lucide-react"
import { localToday } from "@/shared/lib/dates"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { GOLD } from "../constants"
import type { VendorReviewEvent, ReviewType, ReviewOutcome, VendorLane } from "../types"

const LANE_LABELS: Record<string, { label: string; color: string }> = {
  nine: { label: "9-or-Less",  color: "#2563eb" },
  ten:  { label: "10-or-More", color: "#7c3aed" },
}

const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  initial_eval:   "Initial Evaluation",
  annual_review:  "Annual Review",
  audit:          "Audit",
  spot_check:     "Spot Check",
  ad_hoc:         "Ad Hoc",
  surveillance:   "Surveillance",
}

const OUTCOME_CONFIG: Record<ReviewOutcome, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  passed:      { label: "Passed",      color: "#16a34a", icon: CheckCircle2 },
  failed:      { label: "Failed",      color: "#dc2626", icon: XCircle },
  conditional: { label: "Conditional", color: "#d97706", icon: AlertTriangle },
  deferred:    { label: "Deferred",    color: "#6b7280", icon: Clock },
}

const REVIEW_TYPES: ReviewType[] = ["initial_eval", "annual_review", "audit", "spot_check", "ad_hoc", "surveillance"]
const OUTCOMES: ReviewOutcome[] = ["passed", "failed", "conditional", "deferred"]

export function VendorReviews({ vendorId, reviews, canEditNine, canEditTen, onRefresh }: {
  vendorId: string
  reviews: VendorReviewEvent[]
  canEditNine: boolean
  canEditTen: boolean
  onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const canLogAny = canEditNine || canEditTen

  return (
    <div className="rounded-md overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Reviews & Audits</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
            {reviews.length}
          </span>
        </div>
        {canLogAny && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-sm"
            style={{ background: `${GOLD}18`, color: GOLD }}>
            <Plus className="w-3 h-3" /> Log Review
          </button>
        )}
      </div>

      {reviews.length === 0 && !showForm ? (
        <div className="px-4 py-8 text-center">
          <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-20" />
          <p className="text-xs text-muted-foreground opacity-50 italic">No reviews recorded yet.</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
          {reviews.map(r => {
            const laneCfg = LANE_LABELS[r.lane] ?? LANE_LABELS.nine
            const outcomeCfg = r.outcome ? OUTCOME_CONFIG[r.outcome] : null
            const OutcomeIcon = outcomeCfg?.icon

            return (
              <div key={r.id} className="px-4 py-2.5 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm"
                      style={{ background: `${laneCfg.color}15`, color: laneCfg.color }}>
                      {laneCfg.label}
                    </span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm"
                      style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
                      {REVIEW_TYPE_LABELS[r.review_type] ?? r.review_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <CalendarCheck className="w-3 h-3 text-muted-foreground opacity-50" />
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.review_date + "T00:00:00").toLocaleDateString()}
                    </span>
                    {r.next_due && (
                      <span className="text-[10px] text-muted-foreground opacity-60">
                        Next due: {new Date(r.next_due + "T00:00:00").toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {r.notes && <p className="text-[10px] text-muted-foreground mt-1 italic opacity-70">{r.notes}</p>}
                </div>

                {outcomeCfg && OutcomeIcon && (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0"
                    style={{ background: `${outcomeCfg.color}15`, color: outcomeCfg.color }}>
                    <OutcomeIcon className="w-3 h-3" />
                    {outcomeCfg.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <ReviewForm
          vendorId={vendorId}
          canEditNine={canEditNine}
          canEditTen={canEditTen}
          onDone={() => { setShowForm(false); onRefresh() }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

// ── Review form ────────────────────────────────────────────────────────────

function ReviewForm({ vendorId, canEditNine, canEditTen, onDone, onCancel }: {
  vendorId: string
  canEditNine: boolean
  canEditTen: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [lane, setLane] = useState<"nine" | "ten">(canEditNine ? "nine" : "ten")
  const [reviewType, setReviewType] = useState<ReviewType>("initial_eval")
  const [reviewDate, setReviewDate] = useState(localToday())
  const [outcome, setOutcome] = useState<ReviewOutcome | "">("")
  const [nextDue, setNextDue] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  async function handleSave() {
    if (!reviewDate) return
    setError("")
    setSaving(true)

    const { error: insertErr } = await supabase.from("vendor_review_events").insert({
      vendor_id: vendorId,
      lane,
      review_type: reviewType,
      review_date: reviewDate,
      conducted_by: profile?.user_id ?? null,
      outcome: outcome || null,
      notes: notes.trim() || null,
      next_due: nextDue || null,
    })

    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onDone()
  }

  return (
    <div className="px-4 py-3 space-y-2.5" style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--accent)/0.3)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>Log Review</p>
        <button onClick={onCancel}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
      </div>

      {/* Lane */}
      <div className="flex gap-1">
        {(["nine", "ten"] as const).map(l => {
          const cfg = LANE_LABELS[l]
          const active = lane === l
          const allowed = l === "nine" ? canEditNine : canEditTen
          return (
            <button key={l} onClick={() => allowed && setLane(l)}
              disabled={!allowed}
              className="text-[9px] font-bold px-2 py-1 rounded-sm border transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              style={{
                borderColor: active ? cfg.color : "hsl(var(--border))",
                color: active ? cfg.color : "hsl(var(--muted-foreground))",
                background: active ? `${cfg.color}15` : "transparent",
              }}>
              {cfg.label}{!allowed && " (Admin)"}
            </button>
          )
        })}
      </div>

      {/* Review type */}
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">Review Type</label>
        <select className="form-input" value={reviewType} onChange={e => setReviewType(e.target.value as ReviewType)}>
          {REVIEW_TYPES.map(t => (
            <option key={t} value={t}>{REVIEW_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">Review Date</label>
          <input className="form-input" type="date" value={reviewDate} onChange={e => setReviewDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">Next Due (optional)</label>
          <input className="form-input" type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} />
        </div>
      </div>

      {/* Outcome */}
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">Outcome</label>
        <div className="flex gap-1">
          {OUTCOMES.map(o => {
            const cfg = OUTCOME_CONFIG[o]
            const active = outcome === o
            return (
              <button key={o} onClick={() => setOutcome(active ? "" : o)}
                className="text-[9px] font-bold px-2 py-1 rounded-sm border transition-colors flex items-center gap-1"
                style={{
                  borderColor: active ? cfg.color : "hsl(var(--border))",
                  color: active ? cfg.color : "hsl(var(--muted-foreground))",
                  background: active ? `${cfg.color}15` : "transparent",
                }}>
                {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">Notes (optional)</label>
        <textarea className="form-input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Review findings, conditions, follow-up items…" />
      </div>

      {error && <p className="text-[10px] font-semibold" style={{ color: "#dc2626" }}>{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-1.5 text-xs rounded-sm text-muted-foreground"
          style={{ border: "1px solid hsl(var(--border))" }}>Cancel</button>
        <button onClick={handleSave}
          disabled={saving || !reviewDate}
          className="flex-1 py-1.5 text-xs rounded-sm text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
          style={{ background: GOLD }}>
          <ClipboardCheck className="w-3 h-3" />
          {saving ? "Saving…" : "Log Review"}
        </button>
      </div>
    </div>
  )
}
