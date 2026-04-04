import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"

const VENDORS = ["Aircraft Spruce", "Aviall", "Jetsco", "Wencor", "Hartzell Service Center", "Garmin Service", "Other"]

interface DraftLine {
  id: string
  partNumber: string
  description: string
  qty: string
  unitCost: string
}

export default function POCreate() {
  const navigate = useNavigate()
  const [vendor, setVendor] = useState("")
  const [expectedDelivery, setExpectedDelivery] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<DraftLine[]>([
    { id: "1", partNumber: "", description: "", qty: "1", unitCost: "" }
  ])
  const [submitting, setSubmitting] = useState(false)

  function addLine() {
    setLines(l => [...l, { id: String(Date.now()), partNumber: "", description: "", qty: "1", unitCost: "" }])
  }

  function removeLine(id: string) {
    setLines(l => l.filter(ln => ln.id !== id))
  }

  function updateLine(id: string, field: keyof DraftLine, value: string) {
    setLines(l => l.map(ln => ln.id === id ? { ...ln, [field]: value } : ln))
  }

  const total = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.unitCost) || 0), 0)
  const isValid = vendor && lines.some(l => l.partNumber && l.description)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => navigate("/app/beet-box/purchase-orders/po-004"), 800)
  }

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <button
          onClick={() => navigate("/app/beet-box/purchase-orders")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Purchase Orders
        </button>
        <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
          New Purchase Order
        </h1>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Vendor + delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-white/60 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Vendor *</label>
              <select
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30"
                required
              >
                <option value="">Select vendor…</option>
                {VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-white/60 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Expected Delivery</label>
              <Input
                type="date"
                value={expectedDelivery}
                onChange={e => setExpectedDelivery(e.target.value)}
                className="bg-white/[0.06] border-white/10 text-white/90 focus:border-white/30"
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-white/60 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Line Items *</label>
              <Button type="button" size="sm" variant="ghost" onClick={addLine} className="text-white/50 hover:text-white h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Add Line
              </Button>
            </div>
            <div className="card-elevated rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                    {["Part Number", "Description", "Qty", "Unit Cost", "Extended", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const ext = (parseFloat(line.qty) || 0) * (parseFloat(line.unitCost) || 0)
                    return (
                      <tr key={line.id} style={{ borderBottom: idx < lines.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                        <td className="px-3 py-2">
                          <input
                            className="w-28 px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white font-mono placeholder:text-white/20"
                            placeholder="P/N…"
                            value={line.partNumber}
                            onChange={e => updateLine(line.id, "partNumber", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full min-w-[160px] px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/20"
                            placeholder="Description…"
                            value={line.description}
                            onChange={e => updateLine(line.id, "description", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-16 px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white text-center"
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={e => updateLine(line.id, "qty", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-24 px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/20"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={line.unitCost}
                            onChange={e => updateLine(line.id, "unitCost", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 text-white/60 text-xs font-mono">
                          ${ext.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          {lines.length > 1 && (
                            <button type="button" onClick={() => removeLine(line.id)} className="text-white/20 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr style={{ borderTop: "1px solid hsl(0 0% 20%)" }}>
                    <td colSpan={4} className="px-3 py-2.5 text-right text-white/35 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>
                      PO Total
                    </td>
                    <td className="px-3 py-2.5 text-white font-bold text-sm">${total.toFixed(2)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Order notes, WO references, priority notes…"
              className="w-full bg-white/[0.06] border border-white/10 rounded px-3 py-2 text-white/80 text-sm resize-none focus:outline-none focus:border-white/25 placeholder:text-white/20"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!isValid || submitting} style={{ background: "var(--skyshare-gold)", color: "#000" }} className="font-semibold px-6">
              {submitting ? "Creating PO…" : "Create Purchase Order"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/app/beet-box/purchase-orders")} className="text-white/50">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
