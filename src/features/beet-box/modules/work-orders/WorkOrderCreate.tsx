import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Textarea } from "@/shared/ui/textarea"
import { Label } from "@/shared/ui/label"
import { AIRCRAFT, MECHANICS } from "../../data/mockData"

const WO_TYPES = [
  "100-Hour Inspection",
  "Annual Inspection",
  "Unscheduled — Avionics",
  "Unscheduled — Hydraulic",
  "Unscheduled — Engine",
  "Unscheduled — Airframe",
  "Squawk — Pilot Report",
  "Engine Trend Monitoring",
  "Propeller Overhaul",
  "Brake Assembly R/R",
  "Landing Gear",
  "Compliance — AD",
  "Compliance — SB",
  "Phase Inspection",
  "Return to Service",
]

export default function WorkOrderCreate() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    aircraftId: "",
    woType: "",
    priority: "routine" as "routine" | "urgent" | "aog",
    description: "",
    meterAtOpen: "",
    mechanic: "",
  })
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => {
      // Demo: navigate to WO-007 (the draft WO that corresponds to a newly created one)
      navigate("/app/beet-box/work-orders/wo-007")
    }, 800)
  }

  const isValid = form.aircraftId && form.woType && form.description

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <button
          onClick={() => navigate("/app/beet-box/work-orders")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Work Orders
        </button>
        <h1
          className="text-white"
          style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
        >
          New Work Order
        </h1>
        <p className="text-white/40 text-sm mt-1">Open a new maintenance work order</p>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Aircraft */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>
              Aircraft *
            </Label>
            <select
              value={form.aircraftId}
              onChange={e => setForm(f => ({ ...f, aircraftId: e.target.value }))}
              className="w-full px-3 py-2 rounded text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors"
              required
            >
              <option value="">Select aircraft…</option>
              {AIRCRAFT.map(ac => (
                <option key={ac.id} value={ac.id}>
                  {ac.registration} — {ac.make} {ac.model}
                </option>
              ))}
            </select>
          </div>

          {/* WO Type */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>
              Work Order Type *
            </Label>
            <select
              value={form.woType}
              onChange={e => setForm(f => ({ ...f, woType: e.target.value }))}
              className="w-full px-3 py-2 rounded text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors"
              required
            >
              <option value="">Select type…</option>
              {WO_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>
              Priority
            </Label>
            <div className="flex gap-3">
              {(["routine", "urgent", "aog"] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, priority: p }))}
                  className="flex-1 py-2 rounded text-xs font-semibold uppercase tracking-widest transition-all"
                  style={{
                    fontFamily: "var(--font-heading)",
                    background: form.priority === p
                      ? p === "routine" ? "rgba(100,116,139,0.3)" : p === "urgent" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.3)"
                      : "rgba(255,255,255,0.04)",
                    border: form.priority === p
                      ? p === "routine" ? "1px solid rgba(100,116,139,0.5)" : p === "urgent" ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(239,68,68,0.5)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: form.priority === p
                      ? p === "routine" ? "#94a3b8" : p === "urgent" ? "#fbbf24" : "#f87171"
                      : "rgba(255,255,255,0.35)",
                  }}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>
              Description *
            </Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe the work to be performed…"
              rows={4}
              className="bg-white/[0.06] border-white/10 text-white/90 placeholder:text-white/25 focus:border-white/30 resize-none"
              required
            />
          </div>

          {/* Meter at Open */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>
              Meter at Open (Hobbs / Tach)
            </Label>
            <Input
              type="number"
              step="0.1"
              value={form.meterAtOpen}
              onChange={e => setForm(f => ({ ...f, meterAtOpen: e.target.value }))}
              placeholder="e.g. 4218.3"
              className="bg-white/[0.06] border-white/10 text-white/90 placeholder:text-white/25 focus:border-white/30"
            />
          </div>

          {/* Assign Mechanic */}
          <div className="space-y-1.5">
            <Label className="text-white/70 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>
              Assign Mechanic
            </Label>
            <select
              value={form.mechanic}
              onChange={e => setForm(f => ({ ...f, mechanic: e.target.value }))}
              className="w-full px-3 py-2 rounded text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30 transition-colors"
            >
              <option value="">Unassigned</option>
              {MECHANICS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.certificate} · {m.role}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={!isValid || submitting}
              style={{ background: "var(--skyshare-gold)", color: "#000" }}
              className="font-semibold px-6"
            >
              {submitting ? "Opening WO…" : "Open Work Order"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/app/beet-box/work-orders")}
              className="text-white/50 hover:text-white/80"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
