import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, AlertTriangle, Check, Package, Send, XCircle, ClipboardCheck } from "lucide-react"
import { Button } from "@/shared/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/shared/ui/dialog"
import { useAuth } from "@/features/auth"
import {
  getPurchaseOrderById, receiveItems, updatePOStatus, getReceivingRecords,
  type ReceiveItemInput,
} from "../../services/purchaseOrders"
import type { PurchaseOrder, ReceivingRecord, PartCondition, CertificateType } from "../../types"
import { POStatusBadge } from "../../shared/StatusBadge"
import { cn } from "@/shared/lib/utils"

const CONDITIONS: { value: PartCondition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "overhauled", label: "Overhauled" },
  { value: "serviceable", label: "Serviceable" },
  { value: "as_removed", label: "As Removed" },
]

const CERT_TYPES: { value: CertificateType; label: string }[] = [
  { value: "faa_8130-3", label: "FAA 8130-3" },
  { value: "easa_form1", label: "EASA Form 1" },
  { value: "manufacturer_cert", label: "Manufacturer Cert" },
  { value: "none", label: "None" },
]

const CONDITION_COLORS: Record<string, string> = {
  new:          "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40",
  overhauled:   "bg-blue-900/30 text-blue-400 border border-blue-800/40",
  serviceable:  "bg-amber-900/30 text-amber-400 border border-amber-800/40",
  as_removed:   "bg-red-900/30 text-red-400 border border-red-800/40",
}

interface ReceiveLineState {
  lineId: string
  partNumber: string
  description: string
  catalogId: string | null
  qtyRemaining: number
  qty: string
  condition: PartCondition
  serialNumber: string
  batchLot: string
  tagNumber: string
  certificateType: CertificateType
  notes: string
}

export default function PODetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [receiving, setReceiving] = useState(false)
  const [receiveLines, setReceiveLines] = useState<ReceiveLineState[]>([])
  const [saving, setSaving] = useState(false)
  const [records, setRecords] = useState<ReceivingRecord[]>([])

  async function loadPO() {
    if (!id) return
    setLoading(true)
    try {
      const [data, recs] = await Promise.all([
        getPurchaseOrderById(id),
        getReceivingRecords(id),
      ])
      setPo(data)
      setRecords(recs)
    } catch (err) {
      console.error("Failed to load PO:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPO() }, [id])

  function openReceiveModal() {
    if (!po) return
    setReceiveLines(
      po.lines
        .filter(l => l.qtyReceived < l.qtyOrdered)
        .map(l => ({
          lineId: l.id,
          partNumber: l.partNumber,
          description: l.description,
          catalogId: l.catalogId,
          qtyRemaining: l.qtyOrdered - l.qtyReceived,
          qty: "",
          condition: "new",
          serialNumber: "",
          batchLot: "",
          tagNumber: "",
          certificateType: "none",
          notes: "",
        }))
    )
    setReceiving(true)
  }

  function updateReceiveLine(idx: number, field: keyof ReceiveLineState, value: string) {
    setReceiveLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  async function confirmReceive() {
    if (!po || !profile) return
    setSaving(true)
    try {
      const items: ReceiveItemInput[] = receiveLines
        .filter(l => parseInt(l.qty) > 0)
        .map(l => ({
          lineId: l.lineId,
          partNumber: l.partNumber,
          description: l.description,
          catalogId: l.catalogId || undefined,
          qty: Math.min(parseInt(l.qty) || 0, l.qtyRemaining),
          condition: l.condition,
          serialNumber: l.serialNumber || undefined,
          batchLot: l.batchLot || undefined,
          tagNumber: l.tagNumber || undefined,
          certificateType: l.certificateType,
          notes: l.notes || undefined,
        }))

      if (items.length > 0) {
        await receiveItems(po.id, items, {
          id: profile.id,
          name: profile.full_name || "Unknown",
        })
      }

      setReceiving(false)
      setReceiveLines([])
      await loadPO()
    } catch (err) {
      console.error("Failed to receive:", err)
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkSent() {
    if (!po) return
    setSaving(true)
    try {
      await updatePOStatus(po.id, "sent")
      await loadPO()
    } catch (err) {
      console.error("Failed to update status:", err)
    } finally {
      setSaving(false)
    }
  }

  async function handleVoid() {
    if (!po || !confirm("Void this purchase order? This cannot be undone.")) return
    setSaving(true)
    try {
      await updatePOStatus(po.id, "voided")
      await loadPO()
    } catch (err) {
      console.error("Failed to void PO:", err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    )
  }

  if (!po) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">Purchase order not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/beet-box/purchase-orders")} className="text-white/50">
          Back to Purchase Orders
        </Button>
      </div>
    )
  }

  const totalOrdered  = po.lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
  const totalReceived = po.lines.reduce((s, l) => s + l.qtyReceived * l.unitCost, 0)

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <button
          onClick={() => navigate("/app/beet-box/purchase-orders")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Purchase Orders
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-mono" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
                {po.poNumber}
              </h1>
              <POStatusBadge status={po.status} />
            </div>
            <p className="text-white/60 text-base">{po.vendorName}</p>
            <p className="text-white/35 text-xs mt-1">
              Created {new Date(po.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {po.status === "draft" && (
              <Button size="sm" onClick={handleMarkSent} disabled={saving}
                style={{ background: "var(--skyshare-gold)", color: "#000" }}
                className="font-semibold text-xs gap-1.5">
                <Send className="w-3.5 h-3.5" /> Mark as Sent
              </Button>
            )}
            {(po.status === "sent" || po.status === "partial") && (
              <Button size="sm" onClick={openReceiveModal} disabled={saving}
                style={{ background: "var(--skyshare-gold)", color: "#000" }}
                className="font-semibold text-xs gap-1.5">
                <Package className="w-3.5 h-3.5" /> Receive Items
              </Button>
            )}
            {po.status !== "voided" && po.status !== "received" && po.status !== "closed" && (
              <Button size="sm" variant="ghost" onClick={handleVoid} disabled={saving}
                className="text-red-400/60 hover:text-red-400 text-xs gap-1">
                <XCircle className="w-3.5 h-3.5" /> Void
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Financial summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Total Ordered</p>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>${totalOrdered.toFixed(2)}</p>
          </div>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Received to Date</p>
            <p className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>${totalReceived.toFixed(2)}</p>
          </div>
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Expected Delivery</p>
            <p className="text-2xl font-bold text-white/70" style={{ fontFamily: "var(--font-display)" }}>
              {po.expectedDelivery
                ? new Date(po.expectedDelivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—"
              }
            </p>
          </div>
        </div>

        {/* Line items */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
            <span className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Line Items</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                {["Part Number", "Description", "WO Ref", "Qty Ordered", "Qty Received", "Unit Cost", "Extended", "Status"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line, idx) => {
                const pct = line.qtyOrdered > 0 ? line.qtyReceived / line.qtyOrdered : 0
                const isComplete = line.qtyReceived >= line.qtyOrdered
                return (
                  <tr key={line.id} style={{ borderBottom: idx < po.lines.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                    <td className="px-4 py-3 font-mono text-white/70 text-xs">{line.partNumber}</td>
                    <td className="px-4 py-3 text-white/80 text-sm max-w-[180px]">
                      <span className="line-clamp-2">{line.description}</span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs font-mono">{line.woRef ?? "—"}</td>
                    <td className="px-4 py-3 text-white/70 font-mono text-sm text-center">{line.qtyOrdered}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono text-sm font-bold", isComplete ? "text-emerald-400" : line.qtyReceived > 0 ? "text-amber-400" : "text-white/35")}>
                          {line.qtyReceived}
                        </span>
                        {isComplete && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/60 text-sm">${line.unitCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-white/70 font-semibold text-sm">${(line.qtyOrdered * line.unitCost).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="w-20 bg-white/10 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct * 100}%`,
                            background: isComplete ? "#10b981" : pct > 0 ? "#f59e0b" : "rgba(255,255,255,0.2)",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Receiving history */}
        {records.length > 0 && (
          <div className="card-elevated rounded-lg overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
              <ClipboardCheck className="w-4 h-4 text-white/30" />
              <span className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                Receiving History
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                  {["Date", "Part #", "Qty", "Condition", "S/N", "Tag #", "Cert Type", "Received By"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: idx < records.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">
                      {new Date(r.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-mono text-white/70 text-xs">{r.partNumber}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold font-mono text-sm text-emerald-400">+{r.qtyReceived}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide", CONDITION_COLORS[r.condition] ?? "bg-white/5 text-white/40")}>
                        {r.condition.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">{r.serialNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">{r.tagNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      {r.certificateType === "none" ? "—" : r.certificateType.replace(/_/g, " ").replace("faa ", "FAA ").replace("easa ", "EASA ")}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">{r.receivedByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {po.notes && (
          <div className="card-elevated rounded-lg p-4">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)" }}>Notes</p>
            <p className="text-white/65 text-sm">{po.notes}</p>
          </div>
        )}
      </div>

      {/* ─── Receive Items Modal ──────────────────────────────────────────── */}
      <Dialog open={receiving} onOpenChange={open => { if (!open && !saving) { setReceiving(false); setReceiveLines([]) } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" style={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)" }}>
          <DialogHeader>
            <DialogTitle className="text-white" style={{ fontFamily: "var(--font-display)" }}>
              Receive Items — {po.poNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {receiveLines.map((line, idx) => (
              <div
                key={line.lineId}
                className="rounded-lg border p-4 space-y-3"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                {/* Line header */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-white/80">{line.partNumber}</span>
                  <span className="text-xs text-white/35">{line.qtyRemaining} remaining</span>
                </div>
                {line.description && (
                  <p className="text-white/50 text-xs -mt-1">{line.description}</p>
                )}

                {/* Row 1: Qty + Condition */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs mb-1 text-white/50">Qty to Receive *</label>
                    <input
                      type="number"
                      min="0"
                      max={line.qtyRemaining}
                      value={line.qty}
                      onChange={e => updateReceiveLine(idx, "qty", e.target.value)}
                      className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.05] border border-white/10 text-white"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs mb-1 text-white/50">Condition *</label>
                    <select
                      value={line.condition}
                      onChange={e => updateReceiveLine(idx, "condition", e.target.value)}
                      className="w-full rounded-md px-3 py-2 text-sm border border-white/10 text-white"
                      style={{ background: "hsl(0,0%,14%)", colorScheme: "dark" }}
                    >
                      {CONDITIONS.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs mb-1 text-white/50">Serial Number</label>
                    <input
                      type="text"
                      value={line.serialNumber}
                      onChange={e => updateReceiveLine(idx, "serialNumber", e.target.value)}
                      placeholder="S/N"
                      className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.05] border border-white/10 text-white font-mono placeholder:text-white/20"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs mb-1 text-white/50">Batch / Lot</label>
                    <input
                      type="text"
                      value={line.batchLot}
                      onChange={e => updateReceiveLine(idx, "batchLot", e.target.value)}
                      placeholder="Lot #"
                      className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.05] border border-white/10 text-white font-mono placeholder:text-white/20"
                    />
                  </div>
                </div>

                {/* Row 2: Tag / Certificate */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs mb-1 text-white/50">Tag Number</label>
                    <input
                      type="text"
                      value={line.tagNumber}
                      onChange={e => updateReceiveLine(idx, "tagNumber", e.target.value)}
                      placeholder="8130 tag #"
                      className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.05] border border-white/10 text-white font-mono placeholder:text-white/20"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs mb-1 text-white/50">Certificate Type</label>
                    <select
                      value={line.certificateType}
                      onChange={e => updateReceiveLine(idx, "certificateType", e.target.value)}
                      className="w-full rounded-md px-3 py-2 text-sm border border-white/10 text-white"
                      style={{ background: "hsl(0,0%,14%)", colorScheme: "dark" }}
                    >
                      {CERT_TYPES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-6">
                    <label className="block text-xs mb-1 text-white/50">Notes</label>
                    <input
                      type="text"
                      value={line.notes}
                      onChange={e => updateReceiveLine(idx, "notes", e.target.value)}
                      placeholder="Receiving notes..."
                      className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.05] border border-white/10 text-white placeholder:text-white/20"
                    />
                  </div>
                </div>
              </div>
            ))}

            {receiveLines.length === 0 && (
              <p className="text-center text-white/30 text-sm py-6">All line items have been fully received.</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setReceiving(false); setReceiveLines([]) }}
              disabled={saving}
              className="text-white/50"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReceive}
              disabled={saving || receiveLines.every(l => !parseInt(l.qty))}
              style={{ background: "var(--skyshare-gold)", color: "#000" }}
              className="font-semibold"
            >
              {saving ? "Saving…" : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
