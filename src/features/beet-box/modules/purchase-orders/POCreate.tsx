import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, Package } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { useAuth } from "@/features/auth"
import { createPurchaseOrder, getVendorsForPO } from "../../services/purchaseOrders"
import { PartNumberCombobox } from "@/features/parts/components/PartNumberCombobox"
import { supabase } from "@/lib/supabase"
import { notifyProfileIds } from "@/features/parts/helpers"

interface DraftLine {
  id: string
  partNumber: string
  description: string
  catalogId: string | null
  requestLineId: string | null
  qty: string
  unitCost: string
  woRef: string
}

function emptyLine(): DraftLine {
  return { id: String(Date.now()), partNumber: "", description: "", catalogId: null, requestLineId: null, qty: "1", unitCost: "", woRef: "" }
}

interface FromRequestState {
  requestId: string
  requestedBy: string
  currentStatus?: string
  woRef: string
  jobDescription: string
  dateNeeded?: string
  lines: Array<{
    requestLineId: string
    partNumber: string
    description: string
    qty: number
    catalogId: string | null
  }>
}

export default function POCreate() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([])
  const [vendorId, setVendorId] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [expectedDelivery, setExpectedDelivery] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const fromRequest: FromRequestState | null = (location.state as any)?.fromRequest ?? null

  useEffect(() => {
    getVendorsForPO().then(setVendors).catch(console.error)
  }, [])

  // Pre-fill from parts request if navigated here via "Create PO" button
  useEffect(() => {
    if (!fromRequest) return
    setLines(
      fromRequest.lines.map(l => ({
        id: String(Date.now()) + l.requestLineId,
        partNumber: l.partNumber,
        description: l.description,
        catalogId: l.catalogId,
        requestLineId: l.requestLineId,
        qty: String(l.qty),
        unitCost: "",
        woRef: fromRequest.woRef,
      }))
    )
    if (fromRequest.dateNeeded) setExpectedDelivery(fromRequest.dateNeeded)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function addLine() {
    setLines(l => [...l, emptyLine()])
  }

  function removeLine(id: string) {
    setLines(l => l.filter(ln => ln.id !== id))
  }

  function updateLine(id: string, field: keyof DraftLine, value: string | null) {
    setLines(l => l.map(ln => ln.id === id ? { ...ln, [field]: value } : ln))
  }

  const total = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.unitCost) || 0), 0)
  const isValid = vendorName && lines.some(l => l.partNumber.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || submitting) return

    setSubmitting(true)
    setError("")

    try {
      const po = await createPurchaseOrder({
        vendorId: vendorId || undefined,
        vendorName,
        expectedDelivery: expectedDelivery || undefined,
        notes: notes || undefined,
        createdBy: profile?.id ?? "",
        lines: lines
          .filter(l => l.partNumber.trim())
          .map(l => ({
            partNumber: l.partNumber.trim(),
            description: l.description.trim(),
            qtyOrdered: Math.max(1, parseInt(l.qty) || 1),
            unitCost: parseFloat(l.unitCost) || 0,
            woRef: l.woRef.trim() || undefined,
            catalogId: l.catalogId || undefined,
            partsRequestLineId: l.requestLineId ?? undefined,
          })),
      })

      // Navigate immediately — PO is created, that's the critical part
      navigate(`/app/beet-box/purchase-orders/${po.id}`)

      // Sync parts request status in the background (non-blocking)
      if (fromRequest) {
        try {
          const linkedLineIds = lines.filter(l => l.requestLineId).map(l => l.requestLineId!)

          if (linkedLineIds.length > 0) {
            await supabase
              .from("parts_request_lines")
              .update({ line_status: "ordered" })
              .in("id", linkedLineIds)
          }

          // Check if all lines on the request are now ordered
          const { data: allLines } = await supabase
            .from("parts_request_lines")
            .select("line_status")
            .eq("request_id", fromRequest.requestId)

          const allOrdered = allLines?.every(l => l.line_status === "ordered") ?? false
          if (allOrdered) {
            await supabase
              .from("parts_requests")
              .update({ status: "ordered" })
              .eq("id", fromRequest.requestId)

            await supabase.from("parts_status_history").insert({
              request_id: fromRequest.requestId,
              old_status: fromRequest.currentStatus ?? "approved",
              new_status: "ordered",
              changed_by: profile?.id,
              note: `PO ${po.poNumber} created`,
            })
          }

          const approverName = profile?.display_name || profile?.full_name || "Purchasing"
          await notifyProfileIds(
            [fromRequest.requestedBy],
            "parts_ordered",
            "Parts have been ordered",
            `${approverName} created PO ${po.poNumber} for your parts request${fromRequest.woRef ? ` — WO# ${fromRequest.woRef}` : ""}`,
            { link: `/app/beet-box/parts/${fromRequest.requestId}` }
          )
        } catch (syncErr) {
          console.warn("Parts request sync after PO create failed:", syncErr)
        }
      }
    } catch (err: any) {
      console.error("Failed to create PO:", err)
      const msg = err?.message || err?.details || err?.hint || JSON.stringify(err)
      setError(`Error: ${msg}`)
      setSubmitting(false)
    }
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

      <div className="px-8 py-6 max-w-4xl">
        {fromRequest && (
          <div
            className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg"
            style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.2)" }}
          >
            <Package className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(212,160,23,0.8)" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "rgba(212,160,23,0.9)" }}>
                Creating PO from parts request{fromRequest.woRef ? ` — WO# ${fromRequest.woRef}` : ""}
              </p>
              {fromRequest.jobDescription && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{fromRequest.jobDescription}</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Vendor + delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-white/60 text-xs tracking-widest uppercase" style={{ fontFamily: "var(--font-heading)" }}>Vendor *</label>
              <select
                value={vendorId}
                onChange={e => {
                  const v = vendors.find(v => v.id === e.target.value)
                  setVendorId(e.target.value)
                  setVendorName(v?.name ?? "")
                }}
                className="w-full px-3 py-2 rounded text-sm border border-white/10 text-white focus:outline-none focus:border-white/30"
                style={{ background: "hsl(0,0%,14%)", colorScheme: "dark" }}
                required
              >
                <option value="">Select vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                    {["Part Number", "Description", "WO Ref", "Qty", "Unit Cost", "Extended", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const ext = (parseFloat(line.qty) || 0) * (parseFloat(line.unitCost) || 0)
                    return (
                      <tr key={line.id} style={{ borderBottom: idx < lines.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                        <td className="px-3 py-2" style={{ minWidth: 180 }}>
                          <PartNumberCombobox
                            value={line.partNumber}
                            onChange={(pn, catalogId, desc) => {
                              setLines(l => l.map(ln => ln.id === line.id ? {
                                ...ln,
                                partNumber: pn,
                                catalogId,
                                description: desc && !ln.description ? desc : ln.description,
                              } : ln))
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full min-w-[140px] px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/20"
                            placeholder="Description…"
                            value={line.description}
                            onChange={e => updateLine(line.id, "description", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-20 px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white font-mono placeholder:text-white/20"
                            placeholder="WO #"
                            value={line.woRef}
                            onChange={e => updateLine(line.id, "woRef", e.target.value)}
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
                    <td colSpan={5} className="px-3 py-2.5 text-right text-white/35 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>
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

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

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
