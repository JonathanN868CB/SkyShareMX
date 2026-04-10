import { useState, useEffect, useCallback } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, AlertTriangle, Check, Package, Send, XCircle, ClipboardCheck,
  Copy, Printer, Truck, Phone, Mail, ExternalLink, MessageSquare,
  ChevronDown, ChevronRight, Edit3, Save, X, Ban, Scissors, FileText, Clock,
  DollarSign, Wrench, User, Building2, Link2, CheckCircle2,
  Receipt, RefreshCw,
} from "lucide-react"
import {
  Dialog, DialogContent,
} from "@/shared/ui/dialog"
import { POStatusBadge, WOStatusBadge } from "../../shared/StatusBadge"
import { cn } from "@/shared/lib/utils"
import { supabase } from "@/lib/supabase"
import type {
  PurchaseOrder, POStatus, POLine, WOStatus,
  ReceivingRecord, POActivity, POInvoice, PartsSupplier, PartCondition, CertificateType,
} from "../../types"
import {
  getPurchaseOrderById, getReceivingRecords, getPOActivity, addPOActivity,
  getPOInvoices, addPOInvoice, getLinkedWorkOrders, updatePOStatus, updatePOLine,
  receiveItems,
} from "../../services/purchaseOrders"
import { getSupplierById } from "../../services/suppliers"
import { getMyProfile } from "../../services/workOrders"
import ReceiveWorkflow from "./ReceiveWorkflow"
import type { ReceivableLine, ReceiveLineForm } from "./ReceiveWorkflow"

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const CONDITION_COLORS: Record<string, string> = {
  new: "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40",
  overhauled: "bg-blue-900/30 text-blue-400 border border-blue-800/40",
  serviceable: "bg-amber-900/30 text-amber-400 border border-amber-800/40",
  as_removed: "bg-red-900/30 text-red-400 border border-red-800/40",
}

const LINE_STATUS_STYLES: Record<string, string> = {
  pending: "bg-zinc-800 text-zinc-400 border border-zinc-700",
  shipped: "bg-blue-900/40 text-blue-300 border border-blue-800/60",
  backordered: "bg-amber-900/40 text-amber-300 border border-amber-800/60",
  received: "bg-emerald-900/40 text-emerald-300 border border-emerald-800/60",
  cancelled: "bg-red-900/20 text-red-400/70 border border-red-900/40",
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  note: <MessageSquare className="w-3.5 h-3.5" />,
  status_change: <Clock className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  phone: <Phone className="w-3.5 h-3.5" />,
  system: <Package className="w-3.5 h-3.5" />,
  receive: <CheckCircle2 className="w-3.5 h-3.5" />,
  invoice: <Receipt className="w-3.5 h-3.5" />,
}

const ACTIVITY_COLORS: Record<string, string> = {
  note: "text-white/50", status_change: "text-blue-400/70",
  email: "text-purple-400/70", phone: "text-emerald-400/70",
  system: "text-white/30", receive: "text-emerald-400",
  invoice: "text-amber-400/70",
}

const MATCH_STATUS_STYLES: Record<string, string> = {
  matched: "bg-emerald-900/30 text-emerald-400 border-emerald-800/40",
  over: "bg-red-900/30 text-red-400 border-red-800/40",
  under: "bg-amber-900/30 text-amber-400 border-amber-800/40",
  pending: "bg-zinc-800 text-zinc-400 border-zinc-700",
}

function formatDate(iso: string, style: "short" | "long" | "time" = "short") {
  const d = new Date(iso)
  if (style === "time") return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  if (style === "long") return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ─── Collapsible section header ──────────────────────────────────────────────

function SectionHeader({
  icon, label, count, open, onToggle, badge, actions,
}: {
  icon: React.ReactNode; label: string; count?: number; open: boolean
  onToggle: () => void; badge?: React.ReactNode; actions?: React.ReactNode
}) {
  return (
    <div
      className="px-4 py-3 flex items-center justify-between cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
      style={{ borderBottom: open ? "1px solid hsl(0 0% 20%)" : "none" }}
      onClick={onToggle}
    >
      <div className="flex items-center gap-2">
        {open ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
        <span className="text-white/30">{icon}</span>
        <span className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{label}</span>
        {count !== undefined && <span className="text-white/25 text-[10px] font-mono">({count})</span>}
        {badge}
      </div>
      {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
    </div>
  )
}

// ─── Styled action button ────────────────────────────────────────────────────

function ActionBtn({
  children, onClick, variant = "default", className = "", title, disabled,
}: {
  children: React.ReactNode; onClick?: () => void
  variant?: "default" | "gold" | "danger" | "ghost"; className?: string
  title?: string; disabled?: boolean
}) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
  const styles = {
    default: "border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white hover:border-white/25",
    gold: "border-[rgba(212,160,23,0.4)] text-[#000] font-bold hover:brightness-110",
    danger: "border-red-800/40 bg-red-900/20 text-red-400/80 hover:bg-red-900/40 hover:text-red-300 hover:border-red-700/60",
    ghost: "border-transparent bg-transparent text-white/40 hover:bg-white/[0.06] hover:text-white/70 hover:border-white/10",
  }
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={cn(base, styles[variant], className)}
      style={variant === "gold" ? { background: "var(--skyshare-gold)" } : undefined}
    >{children}</button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PODetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  // ─── Real data state ─────────────────────────────────────────────────
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [records, setRecords] = useState<ReceivingRecord[]>([])
  const [activity, setActivity] = useState<POActivity[]>([])
  const [invoices, setInvoices] = useState<POInvoice[]>([])
  const [linkedWOs, setLinkedWOs] = useState<{ id: string; woNumber: string; description: string | null; status: string; aircraft: string | null }[]>([])
  const [supplier, setSupplier] = useState<PartsSupplier | null>(null)
  const [createdByName, setCreatedByName] = useState<string | null>(null)
  const [catalogCosts, setCatalogCosts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── Line editing state ───────────────────────────────────────────────
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<POLine>>({})

  // ─── Section collapse ─────────────────────────────────────────────────
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [shippingOpen, setShippingOpen] = useState(true)
  const [contextOpen, setContextOpen] = useState(true)
  const [linesOpen, setLinesOpen] = useState(true)
  const [receivingOpen, setReceivingOpen] = useState(true)
  const [activityOpen, setActivityOpen] = useState(true)
  const [invoicesOpen, setInvoicesOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)

  // ─── Activity note ───────────────────────────────────────────────────
  const [newNote, setNewNote] = useState("")
  const [addingNote, setAddingNote] = useState(false)

  // ─── Receive workflow ─────────────────────────────────────────────────
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [submittingReceive, setSubmittingReceive] = useState(false)

  // ─── Invoice modal ────────────────────────────────────────────────────
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceDraft, setInvoiceDraft] = useState({ invoiceNumber: "", invoiceDate: "", amount: "", notes: "" })
  const [savingInvoice, setSavingInvoice] = useState(false)

  // ─── Void confirmation ────────────────────────────────────────────────
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false)
  const [voidingPO, setVoidingPO] = useState(false)

  // ─── Load all data ────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [poData, recData, actData, invData, woData] = await Promise.all([
        getPurchaseOrderById(id),
        getReceivingRecords(id),
        getPOActivity(id),
        getPOInvoices(id),
        getLinkedWorkOrders(id),
      ])

      if (!poData) { setError("Purchase order not found."); setLoading(false); return }

      setPo(poData)
      setRecords(recData)
      setActivity(actData)
      setInvoices(invData)
      setLinkedWOs(woData)

      // Fetch vendor contact if vendorId is set
      if (poData.vendorId) {
        getSupplierById(poData.vendorId).then(s => setSupplier(s)).catch(() => {})
      }

      // Fetch creator name
      if (poData.createdBy) {
        supabase.from("profiles").select("full_name").eq("id", poData.createdBy).single()
          .then(({ data }) => setCreatedByName(data?.full_name ?? null))
          .catch(() => {})
      }

      // Fetch catalog costs for lines that have catalogId
      const catalogIds = [...new Set(poData.lines.filter(l => l.catalogId).map(l => l.catalogId as string))]
      if (catalogIds.length > 0) {
        supabase
          .from("parts_catalog_vendors")
          .select("catalog_id, last_unit_cost")
          .in("catalog_id", catalogIds)
          .eq("is_preferred", true)
          .then(({ data }) => {
            if (data) {
              const costMap: Record<string, number> = {}
              data.forEach((r: any) => {
                if (r.last_unit_cost != null && !(r.catalog_id in costMap)) {
                  costMap[r.catalog_id] = Number(r.last_unit_cost)
                }
              })
              setCatalogCosts(costMap)
            }
          })
          .catch(() => {})
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load purchase order.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  // ─── Computed totals ──────────────────────────────────────────────────
  const lines = po?.lines ?? []
  const totalOrdered = lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
  const totalReceived = lines.reduce((s, l) => s + l.qtyReceived * l.unitCost, 0)
  const totalOutstanding = totalOrdered - totalReceived

  const linesWithCatalog = lines.filter(l => l.catalogId && catalogCosts[l.catalogId] !== undefined)
  const totalCatalog = linesWithCatalog.reduce((s, l) => s + l.qtyOrdered * (catalogCosts[l.catalogId!] ?? 0), 0)
  const totalActualCat = linesWithCatalog.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
  const totalVariance = totalActualCat - totalCatalog
  const linesNoCatalog = lines.filter(l => !l.catalogId || catalogCosts[l.catalogId] === undefined)

  // ─── Three-way match summary ───────────────────────────────────────────
  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
  const receivedPct = lines.length > 0
    ? lines.filter(l => l.qtyReceived >= l.qtyOrdered).length / lines.length
    : 0
  const invoiceMatchStatus = invoices.length === 0 ? "none"
    : invoices.every(i => i.matchStatus === "matched") ? "matched"
    : invoices.some(i => i.matchStatus === "over") ? "over"
    : "pending"

  // ─── Editing helpers ──────────────────────────────────────────────────
  function startEditing(line: POLine) { setEditingLineId(line.id); setEditDraft({ ...line }) }
  function cancelEditing() { setEditingLineId(null); setEditDraft({}) }
  async function saveEditing() {
    if (!editingLineId) return
    try {
      await updatePOLine(editingLineId, {
        partNumber: editDraft.partNumber,
        description: editDraft.description,
        qtyOrdered: editDraft.qtyOrdered,
        unitCost: editDraft.unitCost,
      })
      cancelEditing()
      await loadAll()
    } catch {
      toast.error("Failed to save line changes.")
    }
  }

  // ─── Receive completion handler ───────────────────────────────────────
  async function handleReceiveComplete(results: ReceiveLineForm[]) {
    if (!po) return
    setSubmittingReceive(true)
    try {
      const profile = await getMyProfile()
      if (!profile) throw new Error("Not authenticated")

      const items = results
        .filter(r => parseInt(r.qtyReceiving) > 0)
        .map(r => ({
          lineId: r.lineId,
          partNumber: r.partNumber,
          description: r.description,
          catalogId: lines.find(l => l.id === r.lineId)?.catalogId ?? undefined,
          qty: parseInt(r.qtyReceiving),
          condition: r.condition,
          serialNumber: r.serialNumber || undefined,
          batchLot: r.lotBatch || undefined,
          inspectionStatus: (r.receiptStatus === "serviceable" ? "accepted"
            : r.receiptStatus === "rejected" ? "rejected"
            : "quarantine") as "accepted" | "quarantine" | "rejected",
          locationBin: r.binLocation || undefined,
          notes: r.damageNotes || r.inspectionNotes || undefined,
        }))

      await receiveItems(po.id, items, { id: profile.id, name: profile.name })
      setReceiveOpen(false)
      toast.success("Items received and inventory updated.")
      await loadAll()
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record receipt.")
    } finally {
      setSubmittingReceive(false)
    }
  }

  // ─── Build receivable lines for workflow ─────────────────────────────
  const receivableLines: ReceivableLine[] = lines
    .filter(l => l.qtyReceived < l.qtyOrdered && l.lineStatus !== "cancelled")
    .map(l => ({
      lineId: l.id, partNumber: l.partNumber, description: l.description,
      woRef: l.woRef ?? "", qtyOrdered: l.qtyOrdered, qtyPreviouslyReceived: l.qtyReceived,
      catalogId: l.catalogId,
      requiresSerial: false,
      requiresShelfLife: false,
      isCoreExchange: false,
      requiredDocs: ["packing_slip" as const],
    }))

  // ─── Mark Sent ────────────────────────────────────────────────────────
  async function handleMarkSent() {
    if (!po) return
    try {
      await updatePOStatus(po.id, "sent", { fromStatus: po.status })
      toast.success("PO marked as Sent.")
      await loadAll()
    } catch {
      toast.error("Failed to update status.")
    }
  }

  // ─── Void ─────────────────────────────────────────────────────────────
  async function handleVoid() {
    if (!po) return
    setVoidingPO(true)
    try {
      await updatePOStatus(po.id, "voided", { fromStatus: po.status })
      setVoidConfirmOpen(false)
      toast.success("PO voided.")
      await loadAll()
    } catch {
      toast.error("Failed to void PO.")
    } finally {
      setVoidingPO(false)
    }
  }

  // ─── Add note ─────────────────────────────────────────────────────────
  async function handleAddNote() {
    if (!newNote.trim() || !po) return
    setAddingNote(true)
    try {
      await addPOActivity(po.id, { type: "note", message: newNote.trim() })
      setNewNote("")
      const fresh = await getPOActivity(po.id)
      setActivity(fresh)
    } catch {
      toast.error("Failed to add note.")
    } finally {
      setAddingNote(false)
    }
  }

  // ─── Save invoice ─────────────────────────────────────────────────────
  async function handleSaveInvoice() {
    if (!po || !invoiceDraft.invoiceNumber.trim() || !invoiceDraft.amount) return
    setSavingInvoice(true)
    try {
      await addPOInvoice(po.id, {
        invoiceNumber: invoiceDraft.invoiceNumber.trim(),
        invoiceDate: invoiceDraft.invoiceDate || undefined,
        amount: parseFloat(invoiceDraft.amount),
        notes: invoiceDraft.notes || undefined,
      }, totalOrdered)
      setInvoiceModalOpen(false)
      setInvoiceDraft({ invoiceNumber: "", invoiceDate: "", amount: "", notes: "" })
      toast.success("Invoice recorded.")
      const [freshInv, freshAct] = await Promise.all([getPOInvoices(po.id), getPOActivity(po.id)])
      setInvoices(freshInv)
      setActivity(freshAct)
    } catch {
      toast.error("Failed to save invoice.")
    } finally {
      setSavingInvoice(false)
    }
  }

  // ─── Loading / error states ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/30 text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading purchase order…
        </div>
      </div>
    )
  }

  if (error || !po) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-400/60 mx-auto mb-2" />
          <p className="text-white/50 text-sm">{error ?? "Purchase order not found."}</p>
          <button onClick={() => navigate("/app/beet-box/purchase-orders")} className="mt-4 text-white/40 hover:text-white/70 text-xs underline">
            ← Back to Purchase Orders
          </button>
        </div>
      </div>
    )
  }

  // ═════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <div className="hero-area px-8 py-7">
        <button onClick={() => navigate("/app/beet-box/purchase-orders")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Purchase Orders
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-mono" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
                {po.poNumber}
              </h1>
              <POStatusBadge status={po.status} />
            </div>
            <p className="text-white/60 text-base">{po.vendorName}</p>
            <p className="text-white/35 text-xs mt-1">
              Created {formatDate(po.createdAt, "long")}{createdByName ? ` by ${createdByName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionBtn variant="ghost" disabled title="PDF export coming soon"><Printer className="w-3.5 h-3.5" /> Export PDF</ActionBtn>
            <ActionBtn variant="ghost" disabled title="Duplicate coming soon"><Copy className="w-3.5 h-3.5" /> Duplicate</ActionBtn>
            {po.status === "draft" && (
              <ActionBtn variant="gold" onClick={handleMarkSent}><Send className="w-3.5 h-3.5" /> Mark as Sent</ActionBtn>
            )}
            {(po.status === "sent" || po.status === "partial") && (
              <ActionBtn variant="gold" onClick={() => setReceiveOpen(true)}>
                <Package className="w-3.5 h-3.5" /> Receive Items
              </ActionBtn>
            )}
            {po.status !== "voided" && po.status !== "received" && po.status !== "closed" && (
              <ActionBtn variant="danger" onClick={() => setVoidConfirmOpen(true)}>
                <XCircle className="w-3.5 h-3.5" /> Void
              </ActionBtn>
            )}
          </div>
        </div>

        {/* Three-way match status bar */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-white/30 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>3-Way Match:</span>
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border bg-emerald-900/20 text-emerald-400 border-emerald-800/30">
            <Check className="w-3 h-3" /> PO Created
          </span>
          <span className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border",
            receivedPct >= 1 ? "bg-emerald-900/20 text-emerald-400 border-emerald-800/30"
            : receivedPct > 0 ? "bg-amber-900/20 text-amber-400 border-amber-800/30"
            : "bg-zinc-800 text-zinc-400 border-zinc-700"
          )}>
            {receivedPct >= 1 ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            Received: {lines.filter(l => l.qtyReceived >= l.qtyOrdered).length}/{lines.length} lines
          </span>
          <span className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border",
            invoiceMatchStatus === "matched" ? "bg-emerald-900/20 text-emerald-400 border-emerald-800/30"
            : invoiceMatchStatus === "over" ? "bg-red-900/20 text-red-400 border-red-800/30"
            : invoiceMatchStatus === "pending" ? "bg-amber-900/20 text-amber-400 border-amber-800/30"
            : "bg-zinc-800 text-zinc-400 border-zinc-700"
          )}>
            {invoiceMatchStatus === "matched" ? <Check className="w-3 h-3" /> : <Receipt className="w-3 h-3" />}
            {invoices.length === 0 ? "No Invoice" : `${invoices.length} Invoice${invoices.length > 1 ? "s" : ""} — ${invoiceMatchStatus}`}
          </span>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-4 max-w-full">

        {/* ─── Financial Summary ───────────────────────────────────────── */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <SectionHeader icon={<DollarSign className="w-4 h-4" />} label="Financial Summary" open={summaryOpen} onToggle={() => setSummaryOpen(!summaryOpen)} />
          {summaryOpen && (
            <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Total Ordered</p>
                <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>${totalOrdered.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Received to Date</p>
                <p className="text-2xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>${totalReceived.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Outstanding</p>
                <p className="text-2xl font-bold text-amber-400" style={{ fontFamily: "var(--font-display)" }}>${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>Expected Delivery</p>
                <p className="text-2xl font-bold text-white/70" style={{ fontFamily: "var(--font-display)" }}>
                  {po.expectedDelivery ? formatDate(po.expectedDelivery) : "—"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Shipping / Tracking ─────────────────────────────────────── */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <SectionHeader icon={<Truck className="w-4 h-4" />} label="Shipping & Tracking" open={shippingOpen} onToggle={() => setShippingOpen(!shippingOpen)}
            badge={po.trackingStatus
              ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ml-2 bg-blue-900/40 text-blue-300 border border-blue-800/60">{po.trackingStatus}</span>
              : undefined
            } />
          {shippingOpen && (
            po.carrier || po.trackingNumber ? (
              <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-white/35 text-xs mb-0.5">Carrier</p>
                  <p className="text-white/80 text-sm font-medium">{po.carrier ?? "—"}</p>
                </div>
                <div>
                  <p className="text-white/35 text-xs mb-0.5">Tracking Number</p>
                  {po.trackingNumber ? (
                    <button className="text-blue-400 text-sm font-mono hover:underline flex items-center gap-1">
                      {po.trackingNumber} <ExternalLink className="w-3 h-3" />
                    </button>
                  ) : <p className="text-white/40 text-sm">—</p>}
                </div>
                <div>
                  <p className="text-white/35 text-xs mb-0.5">Last Updated</p>
                  <p className="text-white/60 text-sm">
                    {po.trackingUpdatedAt ? formatDate(po.trackingUpdatedAt, "time") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-white/35 text-xs mb-0.5">Status</p>
                  <p className="text-white/80 text-sm font-semibold">{po.trackingStatus ?? "—"}</p>
                </div>
              </div>
            ) : (
              <p className="px-4 py-4 text-white/25 text-sm">No tracking information on file.</p>
            )
          )}
        </div>

        {/* ─── Context Row: Vendor + Linked WOs + Cost Analysis + Quick Actions ── */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <SectionHeader icon={<Building2 className="w-4 h-4" />} label="Vendor, Work Orders & Actions"
            open={contextOpen} onToggle={() => setContextOpen(!contextOpen)} />
          {contextOpen && (
            <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">

              {/* Vendor contact */}
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Vendor Contact</p>
                <p className="text-white/80 text-sm font-semibold">{supplier?.name ?? po.vendorName}</p>
                {supplier?.contactName && (
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-white/30" />
                    <span className="text-white/60 text-xs">{supplier.contactName}</span>
                  </div>
                )}
                {(supplier?.phone ?? po.vendorContact) && (
                  <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1">
                    <Phone className="w-3 h-3" /> {supplier?.phone ?? po.vendorContact}
                  </ActionBtn>
                )}
                {supplier?.email && (
                  <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1">
                    <Mail className="w-3 h-3" /> {supplier.email}
                  </ActionBtn>
                )}
                {supplier?.accountNumber && (
                  <div className="pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-white/25 text-[10px]">Acct: <span className="font-mono">{supplier.accountNumber}</span></p>
                  </div>
                )}
                {!supplier && !po.vendorContact && (
                  <p className="text-white/20 text-xs">Link this PO to a supplier record to see contact details.</p>
                )}
              </div>

              {/* Linked work orders */}
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Linked Work Orders</p>
                </div>
                {linkedWOs.length === 0 ? (
                  <p className="text-white/20 text-xs">No work orders linked via line items.</p>
                ) : (
                  linkedWOs.map(wo => (
                    <button key={wo.id}
                      onClick={() => navigate(`/app/beet-box/work-orders/${wo.id}`)}
                      className="w-full text-left rounded-md p-2 hover:bg-white/[0.04] transition-colors border border-white/[0.06] hover:border-white/[0.12]">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-white/80 text-xs font-mono font-semibold">{wo.woNumber}</span>
                        <WOStatusBadge status={wo.status as WOStatus} />
                      </div>
                      <p className="text-white/45 text-[11px] truncate">{wo.description ?? "—"}</p>
                      {wo.status === "waiting_on_parts" && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400/80">
                          <AlertTriangle className="w-2.5 h-2.5" /> Waiting on parts
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Cost analysis */}
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Cost Analysis</p>
                {linesWithCatalog.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">Catalog Total</span>
                      <span className="text-white/50 text-xs font-mono">${totalCatalog.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">PO Total (cataloged)</span>
                      <span className="text-white/70 text-xs font-mono">${totalActualCat.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-white/50 text-xs font-semibold">Variance</span>
                      <span className={cn("text-sm font-bold font-mono",
                        totalVariance > 0 ? "text-red-400" : totalVariance < 0 ? "text-emerald-400" : "text-white/40"
                      )}>
                        {totalVariance > 0 ? "+" : ""}{totalVariance === 0 ? "—" : `$${totalVariance.toFixed(2)}`}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-white/20 text-xs">No catalog pricing available for these line items.</p>
                )}
                {linesNoCatalog.length > 0 && (
                  <p className="text-white/20 text-[10px]">{linesNoCatalog.length} line{linesNoCatalog.length > 1 ? "s" : ""} not in catalog</p>
                )}
              </div>

              {/* Quick actions */}
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: "var(--font-heading)" }}>Quick Actions</p>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1" disabled><Printer className="w-3 h-3" /> Print PO for vendor</ActionBtn>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1" disabled><Mail className="w-3 h-3" /> Email PO to vendor</ActionBtn>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1" disabled><Copy className="w-3 h-3" /> Duplicate as new PO</ActionBtn>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1"
                  onClick={() => setInvoiceModalOpen(true)}>
                  <Receipt className="w-3 h-3" /> Record Invoice
                </ActionBtn>
                {(po.status === "sent" || po.status === "partial") && (
                  <ActionBtn variant="gold" className="w-full justify-start text-[11px] py-1 mt-1" onClick={() => setReceiveOpen(true)}>
                    <Package className="w-3 h-3" /> Receive Items
                  </ActionBtn>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Line Items ──────────────────────────────────────────────── */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <SectionHeader icon={<Package className="w-4 h-4" />} label="Line Items" count={lines.length}
            open={linesOpen} onToggle={() => setLinesOpen(!linesOpen)} />
          {linesOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                    <th className="w-8" />
                    {["Part Number", "Description", "WO", "Qty", "Rcvd", "Unit Cost", "Extended", "Status", ""].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest whitespace-nowrap" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const isEditing = editingLineId === line.id
                    const isExpanded = expandedLineId === line.id
                    const catalogCost = line.catalogId ? (catalogCosts[line.catalogId] ?? null) : null
                    const hasCostVariance = catalogCost !== null && line.unitCost !== catalogCost
                    const costDelta = catalogCost !== null ? line.unitCost - catalogCost : 0
                    const pct = line.qtyOrdered > 0 ? line.qtyReceived / line.qtyOrdered : 0
                    const extended = line.qtyOrdered * line.unitCost

                    return (
                      <tbody key={line.id}>
                        <tr className="group" style={{ borderBottom: isExpanded ? "none" : idx < lines.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                          <td className="pl-3 pr-0 py-3">
                            <button onClick={() => setExpandedLineId(isExpanded ? null : line.id)}
                              className="text-white/25 hover:text-white/60 transition-colors p-0.5 rounded hover:bg-white/[0.06]">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            {isEditing
                              ? <input className="w-full px-2 py-1 rounded text-xs bg-white/[0.08] border border-white/20 text-white font-mono" value={editDraft.partNumber ?? ""} onChange={e => setEditDraft(d => ({ ...d, partNumber: e.target.value }))} />
                              : <span className="font-mono text-white/70 text-xs">{line.partNumber}</span>
                            }
                          </td>
                          <td className="px-3 py-3" style={{ maxWidth: 220 }}>
                            {isEditing
                              ? <input className="w-full px-2 py-1 rounded text-xs bg-white/[0.08] border border-white/20 text-white" value={editDraft.description ?? ""} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} />
                              : <span className="text-white/80 text-sm line-clamp-1">{line.description}</span>
                            }
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-blue-400/70 text-xs font-mono whitespace-nowrap">{line.woRef || "—"}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {isEditing
                              ? <input className="w-14 px-2 py-1 rounded text-xs bg-white/[0.08] border border-white/20 text-white text-center" type="number" value={editDraft.qtyOrdered ?? 0} onChange={e => setEditDraft(d => ({ ...d, qtyOrdered: parseInt(e.target.value) || 0 }))} />
                              : <span className="text-white/70 font-mono text-sm">{line.qtyOrdered}</span>
                            }
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <span className={cn("font-mono text-sm font-bold",
                                line.qtyReceived >= line.qtyOrdered ? "text-emerald-400" : line.qtyReceived > 0 ? "text-amber-400" : "text-white/35"
                              )}>{line.qtyReceived}</span>
                              {line.qtyReceived >= line.qtyOrdered && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {isEditing
                              ? <input className="w-20 px-2 py-1 rounded text-xs bg-white/[0.08] border border-white/20 text-white" type="number" step="0.01" value={editDraft.unitCost ?? 0} onChange={e => setEditDraft(d => ({ ...d, unitCost: parseFloat(e.target.value) || 0 }))} />
                              : <div>
                                  <span className="text-white/60 text-sm">${line.unitCost.toFixed(2)}</span>
                                  {hasCostVariance && (
                                    <span className={cn("ml-1 text-[10px] font-semibold", costDelta > 0 ? "text-red-400" : "text-emerald-400")}>
                                      {costDelta > 0 ? "+" : ""}{costDelta.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                            }
                          </td>
                          <td className="px-3 py-3 text-white/70 font-semibold text-sm whitespace-nowrap">
                            ${extended.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap", LINE_STATUS_STYLES[line.lineStatus])}>
                              {line.lineStatus}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isEditing ? (
                                <>
                                  <button onClick={saveEditing} className="text-emerald-400/70 hover:text-emerald-400 p-1 rounded hover:bg-emerald-400/10 border border-transparent hover:border-emerald-400/20" title="Save"><Save className="w-3.5 h-3.5" /></button>
                                  <button onClick={cancelEditing} className="text-white/30 hover:text-white/60 p-1 rounded hover:bg-white/[0.06] border border-transparent hover:border-white/10" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEditing(line)} className="text-white/30 hover:text-white/70 p-1 rounded hover:bg-white/[0.08] border border-transparent hover:border-white/15" title="Edit"><Edit3 className="w-3 h-3" /></button>
                                  <button className="text-white/30 hover:text-amber-400 p-1 rounded hover:bg-amber-400/10 border border-transparent hover:border-amber-400/20" title="Backordered"><Clock className="w-3 h-3" /></button>
                                  <button className="text-white/30 hover:text-blue-400 p-1 rounded hover:bg-blue-400/10 border border-transparent hover:border-blue-400/20" title="Split"><Scissors className="w-3 h-3" /></button>
                                  <button className="text-white/30 hover:text-red-400 p-1 rounded hover:bg-red-400/10 border border-transparent hover:border-red-400/20" title="Cancel line"><Ban className="w-3 h-3" /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ borderBottom: idx < lines.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                            <td colSpan={10} className="px-4 pb-4 pt-0">
                              <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1">Vendor Part #</p>
                                    <p className="text-white/70 text-sm font-mono">{line.vendorPartNumber || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1">Line Delivery Date</p>
                                    <p className="text-white/70 text-sm">{line.lineExpectedDelivery ? formatDate(line.lineExpectedDelivery) : "Same as PO"}</p>
                                  </div>
                                  <div>
                                    <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1">Catalog Price</p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/50 text-sm">
                                        {catalogCost !== null ? `$${catalogCost.toFixed(2)}` : "Not in catalog"}
                                      </span>
                                      {hasCostVariance && (
                                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", costDelta > 0 ? "bg-red-900/30 text-red-400" : "bg-emerald-900/30 text-emerald-400")}>
                                          {costDelta > 0 ? `+$${costDelta.toFixed(2)}` : `-$${Math.abs(costDelta).toFixed(2)}`} vs catalog
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1">Fulfillment</p>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${pct * 100}%`, background: pct >= 1 ? "#10b981" : pct > 0 ? "#f59e0b" : "rgba(255,255,255,0.2)" }} />
                                      </div>
                                      <span className="text-white/40 text-xs font-mono">{Math.round(pct * 100)}%</span>
                                    </div>
                                  </div>
                                </div>
                                {line.lineNotes && (
                                  <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                    <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1">Line Notes</p>
                                    <p className="text-white/60 text-sm">{line.lineNotes}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid hsl(0 0% 20%)" }}>
                    <td colSpan={7} className="px-3 py-3 text-right text-white/35 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>PO Total</td>
                    <td className="px-3 py-3 text-white font-bold text-sm">${totalOrdered.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ─── Receiving History ────────────────────────────────────────── */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <SectionHeader icon={<ClipboardCheck className="w-4 h-4" />} label="Receiving History" count={records.length}
            open={receivingOpen} onToggle={() => setReceivingOpen(!receivingOpen)} />
          {receivingOpen && (
            records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 800 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                      {["Date", "Part #", "Qty", "Condition", "S/N", "Batch/Lot", "Tag #", "Cert", "By"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest whitespace-nowrap" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, idx) => (
                      <tr key={r.id} style={{ borderBottom: idx < records.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                        <td className="px-3 py-3 text-white/50 text-xs font-mono whitespace-nowrap">{formatDate(r.receivedAt, "time")}</td>
                        <td className="px-3 py-3 font-mono text-white/70 text-xs">{r.partNumber}</td>
                        <td className="px-3 py-3"><span className="font-bold font-mono text-sm text-emerald-400">+{r.qtyReceived}</span></td>
                        <td className="px-3 py-3">
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide whitespace-nowrap", CONDITION_COLORS[r.condition])}>
                            {r.condition.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-white/50 text-xs font-mono">{r.serialNumber ?? "—"}</td>
                        <td className="px-3 py-3 text-white/50 text-xs font-mono">{r.batchLot ?? "—"}</td>
                        <td className="px-3 py-3 text-white/50 text-xs font-mono">{r.tagNumber ?? "—"}</td>
                        <td className="px-3 py-3 text-white/50 text-xs whitespace-nowrap">
                          {r.certificateType === "none" ? "—" : (r.certificateType as string).replace(/_/g, " ").replace("faa ", "FAA ").replace("easa ", "EASA ")}
                        </td>
                        <td className="px-3 py-3 text-white/60 text-xs whitespace-nowrap">{r.receivedByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-white/25 text-sm">No items received yet.</p>
            )
          )}
        </div>

        {/* ─── Vendor Invoices ──────────────────────────────────────────── */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <SectionHeader
            icon={<Receipt className="w-4 h-4" />}
            label="Vendor Invoices" count={invoices.length}
            open={invoicesOpen} onToggle={() => setInvoicesOpen(!invoicesOpen)}
            actions={
              <ActionBtn variant="default" className="text-[11px] px-2 py-1" onClick={() => setInvoiceModalOpen(true)}>
                + Record Invoice
              </ActionBtn>
            }
          />
          {invoicesOpen && (
            invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: 600 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                      {["Invoice #", "Date", "Amount", "vs PO", "Match Status", "Recorded"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest whitespace-nowrap" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, idx) => {
                      const diff = inv.amount - totalOrdered
                      return (
                        <tr key={inv.id} style={{ borderBottom: idx < invoices.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                          <td className="px-3 py-3 font-mono text-white/80 text-xs">{inv.invoiceNumber}</td>
                          <td className="px-3 py-3 text-white/50 text-xs">{inv.invoiceDate ? formatDate(inv.invoiceDate) : "—"}</td>
                          <td className="px-3 py-3 font-mono text-white/80 text-sm font-semibold">${inv.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-3 font-mono text-xs">
                            <span className={cn(Math.abs(diff) < 0.01 ? "text-emerald-400" : diff > 0 ? "text-red-400" : "text-amber-400")}>
                              {Math.abs(diff) < 0.01 ? "=" : diff > 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide border whitespace-nowrap", MATCH_STATUS_STYLES[inv.matchStatus])}>
                              {inv.matchStatus}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-white/40 text-xs">{formatDate(inv.receivedAt, "time")}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {invoices.length > 1 && (
                    <tfoot>
                      <tr style={{ borderTop: "1px solid hsl(0 0% 20%)" }}>
                        <td colSpan={2} className="px-3 py-2 text-right text-white/30 text-xs uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>Total Invoiced</td>
                        <td className="px-3 py-2 font-mono text-white/70 font-semibold text-sm">${totalInvoiced.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-white/25 text-sm">No invoices recorded. Click "+ Record Invoice" to add one.</p>
            )
          )}
        </div>

        {/* ─── Bottom row: Activity + Notes ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Activity Log */}
          <div className="card-elevated rounded-lg overflow-hidden">
            <SectionHeader icon={<MessageSquare className="w-4 h-4" />} label="Activity Log" count={activity.length}
              open={activityOpen} onToggle={() => setActivityOpen(!activityOpen)} />
            {activityOpen && (
              <div>
                <div className="px-4 py-3 flex gap-2" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                  <input type="text" placeholder="Add a note..."
                    value={newNote} onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newNote.trim()) handleAddNote() }}
                    className="flex-1 px-3 py-2 rounded-md text-sm bg-white/[0.05] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 min-w-0"
                  />
                  <ActionBtn variant={newNote.trim() ? "gold" : "default"} disabled={!newNote.trim() || addingNote}
                    onClick={handleAddNote}>
                    {addingNote ? "…" : "Add"}
                  </ActionBtn>
                </div>
                <div className="px-4 py-2 max-h-[400px] overflow-y-auto">
                  {activity.length === 0 && (
                    <p className="py-6 text-center text-white/20 text-sm">No activity yet.</p>
                  )}
                  {activity.map((entry, idx) => (
                    <div key={entry.id} className="flex gap-3 py-3" style={{ borderBottom: idx < activity.length - 1 ? "1px solid hsl(0 0% 14%)" : "none" }}>
                      <div className={cn("mt-0.5 flex-shrink-0", ACTIVITY_COLORS[entry.type])}>{ACTIVITY_ICONS[entry.type]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                          <span className="text-white/70 text-xs font-semibold">{entry.authorName}</span>
                          <span className="text-white/25 text-[10px]">{formatDate(entry.createdAt, "time")}</span>
                        </div>
                        <p className="text-white/55 text-sm leading-relaxed">{entry.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PO Notes */}
          {po.notes && (
            <div className="card-elevated rounded-lg overflow-hidden">
              <SectionHeader icon={<FileText className="w-4 h-4" />} label="PO Notes" open={notesOpen} onToggle={() => setNotesOpen(!notesOpen)} />
              {notesOpen && <div className="p-4"><p className="text-white/65 text-sm leading-relaxed">{po.notes}</p></div>}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Receive Workflow Modal ═══════════════════════════════════════ */}
      <Dialog open={receiveOpen} onOpenChange={open => { if (!open && !submittingReceive) setReceiveOpen(false) }}>
        <DialogContent
          className="max-w-6xl p-0 overflow-hidden"
          style={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", height: "92vh" }}
        >
          <ReceiveWorkflow
            poNumber={po.poNumber}
            vendorName={po.vendorName}
            lines={receivableLines}
            onComplete={handleReceiveComplete}
            onCancel={() => setReceiveOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ═══ Invoice Modal ════════════════════════════════════════════════ */}
      <Dialog open={invoiceModalOpen} onOpenChange={open => { if (!open && !savingInvoice) setInvoiceModalOpen(false) }}>
        <DialogContent className="max-w-md p-0 overflow-hidden" style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" }}>
          <div className="px-6 py-5" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
            <h3 className="text-white text-base font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              <Receipt className="w-4 h-4" style={{ color: "var(--skyshare-gold)" }} /> Record Vendor Invoice
            </h3>
            <p className="text-white/40 text-xs mt-1">Matches against PO total of <strong className="text-white/60">${totalOrdered.toFixed(2)}</strong></p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] mb-1.5 text-white/50 uppercase tracking-wider">Invoice Number *</label>
              <input type="text" value={invoiceDraft.invoiceNumber} onChange={e => setInvoiceDraft(d => ({ ...d, invoiceNumber: e.target.value }))}
                placeholder="INV-XXXX"
                className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] mb-1.5 text-white/50 uppercase tracking-wider">Invoice Date</label>
                <input type="date" value={invoiceDraft.invoiceDate} onChange={e => setInvoiceDraft(d => ({ ...d, invoiceDate: e.target.value }))}
                  className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white focus:outline-none focus:border-white/30"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div>
                <label className="block text-[10px] mb-1.5 text-white/50 uppercase tracking-wider">Amount *</label>
                <input type="number" step="0.01" value={invoiceDraft.amount} onChange={e => setInvoiceDraft(d => ({ ...d, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] mb-1.5 text-white/50 uppercase tracking-wider">Notes</label>
              <textarea value={invoiceDraft.notes} onChange={e => setInvoiceDraft(d => ({ ...d, notes: e.target.value }))}
                rows={2} placeholder="Any notes about this invoice..."
                className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
          <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
            <ActionBtn variant="ghost" onClick={() => setInvoiceModalOpen(false)}>Cancel</ActionBtn>
            <ActionBtn variant="gold"
              disabled={!invoiceDraft.invoiceNumber.trim() || !invoiceDraft.amount || savingInvoice}
              onClick={handleSaveInvoice}>
              {savingInvoice ? "Saving…" : "Save Invoice"}
            </ActionBtn>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Void Confirmation ═══════════════════════════════════════════ */}
      <Dialog open={voidConfirmOpen} onOpenChange={open => { if (!open && !voidingPO) setVoidConfirmOpen(false) }}>
        <DialogContent className="max-w-sm p-0" style={{ background: "hsl(0 0% 12%)", border: "1px solid hsl(0 0% 22%)" }}>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Void {po.poNumber}?</h3>
                <p className="text-white/40 text-xs mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-white/50 text-sm">
              The PO will be marked as voided. All line items and receiving records will be preserved for audit purposes.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <ActionBtn variant="ghost" onClick={() => setVoidConfirmOpen(false)}>Cancel</ActionBtn>
              <ActionBtn variant="danger" disabled={voidingPO} onClick={handleVoid}>
                {voidingPO ? "Voiding…" : "Void PO"}
              </ActionBtn>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
