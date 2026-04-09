import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, AlertTriangle, Check, Package, Send, XCircle, ClipboardCheck,
  Copy, Printer, Truck, Phone, Mail, ExternalLink, MessageSquare, Paperclip,
  ChevronDown, ChevronRight, Edit3, Save, X, Ban, Scissors, FileText, Clock,
  DollarSign, Wrench, User, Building2, Upload, Link2, CheckCircle2, ArrowRight,
} from "lucide-react"
import {
  Dialog, DialogContent,
} from "@/shared/ui/dialog"
import { POStatusBadge, WOStatusBadge } from "../../shared/StatusBadge"
import { cn } from "@/shared/lib/utils"
import type { POStatus, WOStatus, PartCondition, CertificateType } from "../../types"
import ReceiveWorkflow from "./ReceiveWorkflow"
import type { ReceivableLine } from "./ReceiveWorkflow"

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_PO = {
  id: "mock-po-001",
  poNumber: "PO-2026-0042",
  status: "sent" as POStatus,
  vendorName: "JSSI Parts & Leasing",
  vendorId: "vendor-jssi",
  createdAt: "2026-04-02T14:30:00Z",
  expectedDelivery: "2026-04-15",
  notes: "Priority order for N789CB 600hr inspection. Mike at JSSI confirmed stock on all items except the oil filter — backordered, ETA April 12.",
  createdByName: "Jonathan B.",
}

interface MockLine {
  id: string
  partNumber: string
  description: string
  vendorPartNumber: string
  woRef: string
  qtyOrdered: number
  qtyReceived: number
  unitCost: number
  catalogCost: number | null
  expectedDelivery: string | null
  lineNotes: string
  lineStatus: "pending" | "shipped" | "backordered" | "received" | "cancelled"
  catalogId: string | null
}

const MOCK_LINES: MockLine[] = [
  {
    id: "line-1", partNumber: "CH48108-1",
    description: "Oil Filter Element — Pratt & Whitney PT6A",
    vendorPartNumber: "JSSI-CH48108-1R", woRef: "26-0089",
    qtyOrdered: 2, qtyReceived: 0, unitCost: 84.50, catalogCost: 79.00,
    expectedDelivery: "2026-04-12",
    lineNotes: "Backordered per Mike — expected to ship April 10",
    lineStatus: "backordered", catalogId: "cat-001",
  },
  {
    id: "line-2", partNumber: "MS20426AD4-6",
    description: "Solid Rivet, Universal Head, 1/8\" dia",
    vendorPartNumber: "", woRef: "26-0089",
    qtyOrdered: 100, qtyReceived: 100, unitCost: 0.12, catalogCost: 0.12,
    expectedDelivery: null, lineNotes: "", lineStatus: "received", catalogId: "cat-002",
  },
  {
    id: "line-3", partNumber: "SVO10068",
    description: "Fuel Nozzle Assembly — PT6A-42",
    vendorPartNumber: "JSSI-SVO10068-OH", woRef: "26-0089",
    qtyOrdered: 1, qtyReceived: 0, unitCost: 1450.00, catalogCost: 1380.00,
    expectedDelivery: "2026-04-09",
    lineNotes: "Overhauled unit. Ask for 8130-3 tag on delivery.",
    lineStatus: "shipped", catalogId: "cat-003",
  },
  {
    id: "line-4", partNumber: "AN3-12A",
    description: "Bolt, Hex Head, 10-32 x 3/4\"",
    vendorPartNumber: "", woRef: "26-0091",
    qtyOrdered: 24, qtyReceived: 0, unitCost: 0.85, catalogCost: 0.85,
    expectedDelivery: "2026-04-09", lineNotes: "", lineStatus: "shipped", catalogId: null,
  },
  {
    id: "line-5", partNumber: "3041T15",
    description: "Gasket, Exhaust Collector — P&W PT6A",
    vendorPartNumber: "JSSI-3041T15-N", woRef: "26-0089",
    qtyOrdered: 4, qtyReceived: 0, unitCost: 38.75, catalogCost: null,
    expectedDelivery: "2026-04-09", lineNotes: "", lineStatus: "shipped", catalogId: null,
  },
]

interface MockReceivingRecord {
  id: string; receivedAt: string; partNumber: string; description: string
  qtyReceived: number; condition: PartCondition; serialNumber: string | null
  batchLot: string | null; tagNumber: string | null; certificateType: CertificateType
  receivedByName: string; woRef: string
}

const INITIAL_RECORDS: MockReceivingRecord[] = [
  {
    id: "rec-1", receivedAt: "2026-04-07T10:15:00Z",
    partNumber: "MS20426AD4-6", description: "Solid Rivet, Universal Head, 1/8\" dia",
    qtyReceived: 100, condition: "new",
    serialNumber: null, batchLot: "LOT-2026-A442", tagNumber: null,
    certificateType: "manufacturer_cert", receivedByName: "Alex R.", woRef: "26-0089",
  },
]

interface ActivityEntry {
  id: string; timestamp: string; author: string
  type: "note" | "status_change" | "email" | "phone" | "system" | "receive"
  message: string
}

const INITIAL_ACTIVITY: ActivityEntry[] = [
  { id: "act-1", timestamp: "2026-04-02T14:30:00Z", author: "System", type: "system", message: "Purchase order PO-2026-0042 created by Jonathan B." },
  { id: "act-2", timestamp: "2026-04-02T14:35:00Z", author: "Jonathan B.", type: "email", message: "Emailed PO to Mike Johnson at JSSI (mike.j@jssi.com)" },
  { id: "act-3", timestamp: "2026-04-02T16:10:00Z", author: "System", type: "status_change", message: "Status changed from Draft → Sent" },
  { id: "act-4", timestamp: "2026-04-03T09:22:00Z", author: "Jonathan B.", type: "phone", message: "Called Mike at JSSI — confirmed all items in stock except CH48108-1 oil filter (backordered, vendor expects restock April 10). Fuel nozzle is overhauled unit with 8130-3." },
  { id: "act-5", timestamp: "2026-04-05T11:00:00Z", author: "Mike J. (JSSI)", type: "email", message: "Shipping confirmation received — 4 of 5 line items shipped via FedEx. Tracking: 7961 0249 4000. Oil filter to follow." },
  { id: "act-6", timestamp: "2026-04-07T10:15:00Z", author: "Alex R.", type: "receive", message: "Received 100x MS20426AD4-6 (rivets) — condition: New, Manufacturer Cert" },
  { id: "act-7", timestamp: "2026-04-08T08:45:00Z", author: "Jonathan B.", type: "note", message: "Remaining items (fuel nozzle, bolts, gaskets) showing 'In Transit' on FedEx. Should arrive today or tomorrow." },
]

interface Attachment {
  id: string; name: string; type: string; size: string; uploadedBy: string; uploadedAt: string
}

const MOCK_ATTACHMENTS: Attachment[] = [
  { id: "att-1", name: "JSSI_Quote_Q-2026-1187.pdf", type: "pdf", size: "142 KB", uploadedBy: "Jonathan B.", uploadedAt: "2026-04-02T14:28:00Z" },
  { id: "att-2", name: "PO-2026-0042_sent.pdf", type: "pdf", size: "89 KB", uploadedBy: "System", uploadedAt: "2026-04-02T16:10:00Z" },
  { id: "att-3", name: "FedEx_Shipping_Confirmation.pdf", type: "pdf", size: "204 KB", uploadedBy: "Jonathan B.", uploadedAt: "2026-04-05T11:05:00Z" },
  { id: "att-4", name: "8130-3_MS20426AD4-6_rivets.jpg", type: "image", size: "1.2 MB", uploadedBy: "Alex R.", uploadedAt: "2026-04-07T10:20:00Z" },
]

const MOCK_TRACKING = {
  carrier: "FedEx", trackingNumber: "7961 0249 4000", status: "In Transit",
  lastUpdate: "2026-04-08T06:30:00Z", estimatedDelivery: "2026-04-09",
}

const MOCK_VENDOR = {
  name: "JSSI Parts & Leasing", phone: "(312) 644-8810", email: "parts@jssi.com",
  accountRep: "Mike Johnson", repPhone: "(312) 644-8815", repEmail: "mike.j@jssi.com",
  accountNumber: "CBAV-0042", address: "1 N. Wacker Dr., Suite 2000, Chicago, IL 60606",
}

interface LinkedWO {
  id: string; woNumber: string; description: string; aircraft: string; status: WOStatus; partsNeededCount: number
}

const MOCK_LINKED_WOS: LinkedWO[] = [
  { id: "wo-1", woNumber: "26-0089", description: "600hr Inspection — PT6A-42", aircraft: "N789CB", status: "waiting_on_parts", partsNeededCount: 4 },
  { id: "wo-2", woNumber: "26-0091", description: "Landing Gear Annual Service", aircraft: "N789CB", status: "open", partsNeededCount: 1 },
]

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const CONDITIONS: { value: PartCondition; label: string }[] = [
  { value: "new", label: "New" }, { value: "overhauled", label: "Overhauled" },
  { value: "serviceable", label: "Serviceable" }, { value: "as_removed", label: "As Removed" },
]


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
}

const ACTIVITY_COLORS: Record<string, string> = {
  note: "text-white/50", status_change: "text-blue-400/70",
  email: "text-purple-400/70", phone: "text-emerald-400/70",
  system: "text-white/30", receive: "text-emerald-400",
}

function formatDate(iso: string, style: "short" | "long" | "time" = "short") {
  const d = new Date(iso)
  if (style === "time") return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
  if (style === "long") return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
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

  // ─── Data state ─────────────────────────────────────────────────────
  const [lines, setLines] = useState<MockLine[]>(MOCK_LINES)
  const [records, setRecords] = useState<MockReceivingRecord[]>(INITIAL_RECORDS)
  const [activity, setActivity] = useState<ActivityEntry[]>(INITIAL_ACTIVITY)
  const [poStatus, setPoStatus] = useState<POStatus>(MOCK_PO.status)

  // ─── Section collapse ───────────────────────────────────────────────
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [shippingOpen, setShippingOpen] = useState(true)
  const [contextOpen, setContextOpen] = useState(true)
  const [linesOpen, setLinesOpen] = useState(true)
  const [receivingOpen, setReceivingOpen] = useState(true)
  const [activityOpen, setActivityOpen] = useState(true)
  const [attachmentsOpen, setAttachmentsOpen] = useState(true)
  const [notesOpen, setNotesOpen] = useState(true)

  // ─── UI state ───────────────────────────────────────────────────────
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null)
  const [newNote, setNewNote] = useState("")
  const [editDraft, setEditDraft] = useState<Partial<MockLine>>({})

  // ─── Receive workflow ───────────────────────────────────────────────
  const [receiveOpen, setReceiveOpen] = useState(false)

  const po = MOCK_PO
  const totalOrdered = lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
  const totalReceived = lines.reduce((s, l) => s + l.qtyReceived * l.unitCost, 0)
  const totalOutstanding = totalOrdered - totalReceived

  // ─── Editing helpers ────────────────────────────────────────────────
  function startEditing(line: MockLine) { setEditingLineId(line.id); setEditDraft({ ...line }) }
  function cancelEditing() { setEditingLineId(null); setEditDraft({}) }
  function saveEditing() {
    if (!editingLineId) return
    setLines(prev => prev.map(l => l.id === editingLineId ? { ...l, ...editDraft } as MockLine : l))
    cancelEditing()
  }

  // ─── Receive completion handler ─────────────────────────────────────
  function handleReceiveComplete(results: { lineId: string; partNumber: string; description: string; qtyReceiving: string; condition: PartCondition; serialNumber: string; lotBatch: string; receiptStatus: string }[]) {
    const now = new Date().toISOString()
    // Update line quantities and statuses
    setLines(prev => prev.map(line => {
      const result = results.find(r => r.lineId === line.id)
      if (!result) return line
      const qty = parseInt(result.qtyReceiving) || 0
      const newQty = line.qtyReceived + qty
      return { ...line, qtyReceived: newQty, lineStatus: newQty >= line.qtyOrdered ? "received" as const : "shipped" as const }
    }))
    // Add receiving records
    const newRecords: MockReceivingRecord[] = results.map((r, i) => ({
      id: `rec-new-${Date.now()}-${i}`, receivedAt: now, partNumber: r.partNumber,
      description: r.description, qtyReceived: parseInt(r.qtyReceiving) || 0,
      condition: r.condition, serialNumber: r.serialNumber || null,
      batchLot: r.lotBatch || null, tagNumber: null,
      certificateType: "none" as CertificateType, receivedByName: "Jonathan B.",
      woRef: lines.find(l => l.id === r.lineId)?.woRef || "",
    }))
    setRecords(prev => [...prev, ...newRecords])
    // Add activity entries
    const newActs: ActivityEntry[] = results.map((r, i) => ({
      id: `act-rcv-${Date.now()}-${i}`, timestamp: now, author: "Jonathan B.", type: "receive" as const,
      message: `Received ${r.qtyReceiving}x ${r.partNumber} (${r.description}) — ${r.condition}${r.serialNumber ? `, S/N: ${r.serialNumber}` : ""}, status: ${r.receiptStatus}`,
    }))
    setActivity(prev => [...prev, ...newActs])
    // Check PO status
    const updatedLines = lines.map(line => {
      const result = results.find(r => r.lineId === line.id)
      if (!result) return line
      return { ...line, qtyReceived: line.qtyReceived + (parseInt(result.qtyReceiving) || 0) }
    })
    const allDone = updatedLines.every(l => l.qtyReceived >= l.qtyOrdered || l.lineStatus === "cancelled")
    if (allDone) {
      setPoStatus("received")
      setActivity(prev => [...prev, { id: `act-status-${Date.now()}`, timestamp: now, author: "System", type: "status_change", message: "All items received — PO status changed to Received." }])
    } else { setPoStatus("partial") }
  }

  // ─── Build receivable lines for the workflow component ──────────────
  const receivableLines: ReceivableLine[] = lines
    .filter(l => l.qtyReceived < l.qtyOrdered && l.lineStatus !== "cancelled")
    .map(l => ({
      lineId: l.id, partNumber: l.partNumber, description: l.description,
      woRef: l.woRef, qtyOrdered: l.qtyOrdered, qtyPreviouslyReceived: l.qtyReceived,
      catalogId: l.catalogId,
      requiresSerial: l.partNumber === "SVO10068",
      requiresShelfLife: l.partNumber === "CH48108-1",
      isCoreExchange: l.partNumber === "SVO10068",
      requiredDocs: l.partNumber === "SVO10068"
        ? ["8130-3" as const, "packing_slip" as const]
        : ["packing_slip" as const],
    }))

  // ─── Cost analysis ──────────────────────────────────────────────────
  const linesWithCatalog = lines.filter(l => l.catalogCost !== null)
  const totalCatalog = linesWithCatalog.reduce((s, l) => s + l.qtyOrdered * (l.catalogCost ?? 0), 0)
  const totalActualCat = linesWithCatalog.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
  const totalVariance = totalActualCat - totalCatalog
  const linesNoCatalog = lines.filter(l => l.catalogCost === null)

  // ═════════════════════════════════════════════════════════════════════
  // RENDER — single-column, no horizontal scroll
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
              <POStatusBadge status={poStatus} />
            </div>
            <p className="text-white/60 text-base">{po.vendorName}</p>
            <p className="text-white/35 text-xs mt-1">Created {formatDate(po.createdAt, "long")} by {po.createdByName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionBtn variant="ghost"><Printer className="w-3.5 h-3.5" /> Export PDF</ActionBtn>
            <ActionBtn variant="ghost"><Copy className="w-3.5 h-3.5" /> Duplicate</ActionBtn>
            {poStatus === "draft" && <ActionBtn variant="gold"><Send className="w-3.5 h-3.5" /> Mark as Sent</ActionBtn>}
            {(poStatus === "sent" || poStatus === "partial") && (
              <ActionBtn variant="gold" onClick={() => setReceiveOpen(true)}><Package className="w-3.5 h-3.5" /> Receive Items</ActionBtn>
            )}
            {poStatus !== "voided" && poStatus !== "received" && poStatus !== "closed" && (
              <ActionBtn variant="danger"><XCircle className="w-3.5 h-3.5" /> Void</ActionBtn>
            )}
          </div>
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
                <p className="text-2xl font-bold text-white/70" style={{ fontFamily: "var(--font-display)" }}>{po.expectedDelivery ? formatDate(po.expectedDelivery) : "—"}</p>
              </div>
            </div>
          )}
        </div>

        {/* ─── Shipping / Tracking ─────────────────────────────────────── */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <SectionHeader icon={<Truck className="w-4 h-4" />} label="Shipping & Tracking" open={shippingOpen} onToggle={() => setShippingOpen(!shippingOpen)}
            badge={<span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ml-2 bg-blue-900/40 text-blue-300 border border-blue-800/60">{MOCK_TRACKING.status}</span>} />
          {shippingOpen && (
            <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-white/35 text-xs mb-0.5">Carrier</p>
                <p className="text-white/80 text-sm font-medium">{MOCK_TRACKING.carrier}</p>
              </div>
              <div>
                <p className="text-white/35 text-xs mb-0.5">Tracking Number</p>
                <button className="text-blue-400 text-sm font-mono hover:underline flex items-center gap-1">
                  {MOCK_TRACKING.trackingNumber} <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div>
                <p className="text-white/35 text-xs mb-0.5">Last Update</p>
                <p className="text-white/60 text-sm">{formatDate(MOCK_TRACKING.lastUpdate, "time")}</p>
              </div>
              <div>
                <p className="text-white/35 text-xs mb-0.5">Est. Delivery</p>
                <p className="text-white/80 text-sm font-semibold">{formatDate(MOCK_TRACKING.estimatedDelivery)}</p>
              </div>
            </div>
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
                <p className="text-white/80 text-sm font-semibold">{MOCK_VENDOR.name}</p>
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-white/30" />
                  <span className="text-white/60 text-xs">{MOCK_VENDOR.accountRep}</span>
                </div>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1"><Phone className="w-3 h-3" /> {MOCK_VENDOR.repPhone}</ActionBtn>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1"><Mail className="w-3 h-3" /> {MOCK_VENDOR.repEmail}</ActionBtn>
                <div className="pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-white/25 text-[10px]">Acct: <span className="font-mono">{MOCK_VENDOR.accountNumber}</span></p>
                </div>
              </div>

              {/* Linked work orders */}
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Linked Work Orders</p>
                  <ActionBtn variant="default" className="text-[10px] px-1.5 py-0.5"><Link2 className="w-2.5 h-2.5" /> Link</ActionBtn>
                </div>
                {MOCK_LINKED_WOS.map(wo => (
                  <button key={wo.id} className="w-full text-left rounded-md p-2 hover:bg-white/[0.04] transition-colors border border-white/[0.06] hover:border-white/[0.12]">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-white/80 text-xs font-mono font-semibold">{wo.woNumber}</span>
                      <WOStatusBadge status={wo.status} />
                    </div>
                    <p className="text-white/45 text-[11px] truncate">{wo.description}</p>
                    {wo.status === "waiting_on_parts" && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400/80">
                        <AlertTriangle className="w-2.5 h-2.5" /> Waiting on parts
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Cost analysis */}
              <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Cost Analysis</p>
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
                {linesNoCatalog.length > 0 && (
                  <p className="text-white/20 text-[10px]">{linesNoCatalog.length} line{linesNoCatalog.length > 1 ? "s" : ""} not in catalog</p>
                )}
              </div>

              {/* Quick actions */}
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: "var(--font-heading)" }}>Quick Actions</p>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1"><Printer className="w-3 h-3" /> Print PO for vendor</ActionBtn>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1"><Mail className="w-3 h-3" /> Email PO to vendor</ActionBtn>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1"><Copy className="w-3 h-3" /> Duplicate as new PO</ActionBtn>
                <ActionBtn variant="default" className="w-full justify-start text-[11px] py-1"><Link2 className="w-3 h-3" /> Link work order</ActionBtn>
                {(poStatus === "sent" || poStatus === "partial") && (
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
            open={linesOpen} onToggle={() => setLinesOpen(!linesOpen)}
            actions={<ActionBtn variant="default" className="text-[11px] px-2 py-1"><Edit3 className="w-3 h-3" /> Add Line</ActionBtn>} />
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
                    const hasCostVariance = line.catalogCost !== null && line.unitCost !== line.catalogCost
                    const costDelta = line.catalogCost !== null ? line.unitCost - line.catalogCost : 0
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
                            <button className="text-blue-400/70 hover:text-blue-400 text-xs font-mono hover:underline whitespace-nowrap">{line.woRef || "—"}</button>
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
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap", LINE_STATUS_STYLES[line.lineStatus])}>{line.lineStatus}</span>
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
                                  <button className="text-white/30 hover:text-red-400 p-1 rounded hover:bg-red-400/10 border border-transparent hover:border-red-400/20" title="Cancel"><Ban className="w-3 h-3" /></button>
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
                                    <p className="text-white/70 text-sm">{line.expectedDelivery ? formatDate(line.expectedDelivery) : "Same as PO"}</p>
                                  </div>
                                  <div>
                                    <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1">Catalog Price</p>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white/50 text-sm">{line.catalogCost !== null ? `$${line.catalogCost.toFixed(2)}` : "Not in catalog"}</span>
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
                      {["Date", "Part #", "Qty", "Condition", "S/N", "Batch/Lot", "Tag #", "Cert", "WO", "By"].map(h => (
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
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide whitespace-nowrap", CONDITION_COLORS[r.condition])}>{r.condition.replace("_", " ")}</span>
                        </td>
                        <td className="px-3 py-3 text-white/50 text-xs font-mono">{r.serialNumber ?? "—"}</td>
                        <td className="px-3 py-3 text-white/50 text-xs font-mono">{r.batchLot ?? "—"}</td>
                        <td className="px-3 py-3 text-white/50 text-xs font-mono">{r.tagNumber ?? "—"}</td>
                        <td className="px-3 py-3 text-white/50 text-xs whitespace-nowrap">
                          {r.certificateType === "none" ? "—" : r.certificateType.replace(/_/g, " ").replace("faa ", "FAA ").replace("easa ", "EASA ")}
                        </td>
                        <td className="px-3 py-3"><button className="text-blue-400/70 hover:text-blue-400 text-xs font-mono hover:underline">{r.woRef}</button></td>
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

        {/* ─── Bottom row: Activity + Attachments side by side ──────────── */}
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
                    className="flex-1 px-3 py-2 rounded-md text-sm bg-white/[0.05] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 min-w-0"
                  />
                  <ActionBtn variant={newNote.trim() ? "gold" : "default"} disabled={!newNote.trim()}
                    onClick={() => {
                      if (!newNote.trim()) return
                      setActivity(prev => [...prev, { id: `act-manual-${Date.now()}`, timestamp: new Date().toISOString(), author: "Jonathan B.", type: "note", message: newNote.trim() }])
                      setNewNote("")
                    }}>
                    Add
                  </ActionBtn>
                </div>
                <div className="px-4 py-2 max-h-[400px] overflow-y-auto">
                  {[...activity].reverse().map((entry, idx) => (
                    <div key={entry.id} className="flex gap-3 py-3" style={{ borderBottom: idx < activity.length - 1 ? "1px solid hsl(0 0% 14%)" : "none" }}>
                      <div className={cn("mt-0.5 flex-shrink-0", ACTIVITY_COLORS[entry.type])}>{ACTIVITY_ICONS[entry.type]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                          <span className="text-white/70 text-xs font-semibold">{entry.author}</span>
                          <span className="text-white/25 text-[10px]">{formatDate(entry.timestamp, "time")}</span>
                        </div>
                        <p className="text-white/55 text-sm leading-relaxed">{entry.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Attachments + Notes stacked */}
          <div className="space-y-4">
            <div className="card-elevated rounded-lg overflow-hidden">
              <SectionHeader icon={<Paperclip className="w-4 h-4" />} label="Attachments" count={MOCK_ATTACHMENTS.length}
                open={attachmentsOpen} onToggle={() => setAttachmentsOpen(!attachmentsOpen)}
                actions={<ActionBtn variant="default" className="text-[11px] px-2 py-1"><Upload className="w-3 h-3" /> Upload</ActionBtn>} />
              {attachmentsOpen && (
                <div className="p-4 space-y-2">
                  <div className="rounded-lg border-2 border-dashed border-white/10 hover:border-white/25 transition-colors p-3 text-center cursor-pointer hover:bg-white/[0.02]">
                    <Upload className="w-4 h-4 text-white/20 mx-auto mb-1" />
                    <p className="text-white/30 text-xs">Drop files or click to upload</p>
                  </div>
                  <div className="space-y-1 pt-1">
                    {MOCK_ATTACHMENTS.map(att => (
                      <div key={att.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/[0.03] transition-colors group">
                        <FileText className={cn("w-4 h-4 flex-shrink-0", att.type === "pdf" ? "text-red-400/60" : "text-blue-400/60")} />
                        <div className="flex-1 min-w-0">
                          <button className="text-white/70 text-sm hover:text-white hover:underline truncate block">{att.name}</button>
                          <p className="text-white/25 text-[10px]">{att.size} — {att.uploadedBy}</p>
                        </div>
                        <button className="text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all p-1 rounded hover:bg-white/[0.06]" title="Download">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {po.notes && (
              <div className="card-elevated rounded-lg overflow-hidden">
                <SectionHeader icon={<FileText className="w-4 h-4" />} label="PO Notes" open={notesOpen} onToggle={() => setNotesOpen(!notesOpen)}
                  actions={<ActionBtn variant="default" className="text-[11px] px-2 py-1"><Edit3 className="w-3 h-3" /> Edit</ActionBtn>} />
                {notesOpen && <div className="p-4"><p className="text-white/65 text-sm leading-relaxed">{po.notes}</p></div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Receive Workflow Modal ═══════════════════════════════════════ */}
      <Dialog open={receiveOpen} onOpenChange={open => { if (!open) setReceiveOpen(false) }}>
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
    </div>
  )
}
