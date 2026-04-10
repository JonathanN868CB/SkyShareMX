import { useState, useRef } from "react"
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight,
  Upload, FileText, Camera, AlertTriangle, ShieldCheck, Package, Wrench,
  X, Eye, Search, MapPin, Clock, RotateCcw, Ban, Clipboard, Zap,
  FileWarning, Image,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { PartCondition, CertificateType } from "../../types"

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReceivableLine {
  lineId: string
  partNumber: string
  description: string
  woRef: string
  qtyOrdered: number
  qtyPreviouslyReceived: number
  catalogId: string | null
  requiresSerial: boolean
  requiresShelfLife: boolean
  isCoreExchange: boolean
  requiredDocs: RequiredDocType[]
}

type RequiredDocType = "8130-3" | "CoC" | "manufacturer_cert" | "packing_slip" | "invoice"
type ReceiptStatus = "serviceable" | "quarantine" | "rejected" | "repairable"

export interface ReceiveLineForm {
  lineId: string
  partNumber: string
  partNumberVerified: boolean
  description: string
  woRef: string
  qtyOrdered: number
  qtyPreviouslyReceived: number
  qtyReceiving: string
  qtyBackordered: string
  serialNumber: string
  lotBatch: string
  condition: PartCondition
  receiptStatus: ReceiptStatus
  damageNotes: string
  hasDamage: boolean
  hasShortage: boolean
  hasDiscrepancy: boolean
  binLocation: string
  shelfLife: string
  expirationDate: string
  coreTrackingNumber: string
  isCoreExchange: boolean
  requiredDocs: RequiredDocType[]
  uploadedDocs: { type: RequiredDocType; fileName: string; verified: boolean }[]
  packingSlipRef: string
  invoiceRef: string
  inspectionNotes: string
  inspectionPassed: boolean | null
}

export interface ScannedField {
  label: string
  value: string
  confidence: number
  top: number     // % position for highlight overlay
  left: number
  width: number
  height: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// OCR INTEGRATION POINT
// When DW1GHT analyzes an uploaded document, it should call:
//   onScanComplete(fields: ScannedField[])
// where each field has { label, value, confidence, top, left, width, height }.
// The form will pre-populate from scannedFields; tech reviews and confirms.
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const CONDITIONS: { value: PartCondition; label: string }[] = [
  { value: "new", label: "New" }, { value: "overhauled", label: "Overhauled" },
  { value: "serviceable", label: "Serviceable" }, { value: "as_removed", label: "As Removed" },
]

const RECEIPT_STATUSES: { value: ReceiptStatus; label: string; color: string }[] = [
  { value: "serviceable", label: "Serviceable", color: "bg-emerald-900/30 text-emerald-400 border-emerald-800/40" },
  { value: "quarantine",  label: "Quarantine",  color: "bg-amber-900/30 text-amber-400 border-amber-800/40" },
  { value: "rejected",    label: "Rejected",    color: "bg-red-900/30 text-red-400 border-red-800/40" },
  { value: "repairable",  label: "Repairable",  color: "bg-blue-900/30 text-blue-400 border-blue-800/40" },
]

const CERT_TYPES: { value: CertificateType; label: string }[] = [
  { value: "faa_8130-3", label: "FAA 8130-3" }, { value: "easa_form1", label: "EASA Form 1" },
  { value: "manufacturer_cert", label: "Manufacturer Cert" }, { value: "none", label: "None" },
]

const DOC_LABELS: Record<RequiredDocType, string> = {
  "8130-3": "FAA 8130-3 Tag",
  "CoC": "Certificate of Conformance",
  "manufacturer_cert": "Manufacturer Certificate",
  "packing_slip": "Packing Slip",
  "invoice": "Invoice",
}

function ActionBtn({
  children, onClick, variant = "default", className = "", disabled,
}: {
  children: React.ReactNode; onClick?: () => void
  variant?: "default" | "gold" | "danger" | "ghost"; className?: string
  disabled?: boolean
}) {
  const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
  const styles = {
    default: "border-white/15 bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white hover:border-white/25",
    gold: "border-[rgba(212,160,23,0.4)] text-[#000] font-bold hover:brightness-110",
    danger: "border-red-800/40 bg-red-900/20 text-red-400/80 hover:bg-red-900/40 hover:text-red-300",
    ghost: "border-transparent bg-transparent text-white/40 hover:bg-white/[0.06] hover:text-white/70",
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={cn(base, styles[variant], className)}
      style={variant === "gold" ? { background: "var(--skyshare-gold)" } : undefined}
    >{children}</button>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReceiveWorkflowProps {
  poNumber: string
  vendorName: string
  lines: ReceivableLine[]
  onComplete: (results: ReceiveLineForm[]) => void
  onCancel: () => void
  // OCR INTEGRATION: called by DW1GHT when it finishes analyzing a scanned document.
  // Pass the extracted fields here to pre-populate the receiving form.
  onScanComplete?: (fields: ScannedField[]) => void
}

export default function ReceiveWorkflow({ poNumber, vendorName, lines, onComplete, onCancel, onScanComplete }: ReceiveWorkflowProps) {
  // Steps: upload → receive → inspect → confirm → done
  const [step, setStep] = useState<"upload" | "receive" | "inspect" | "confirm" | "done">("upload")
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; type: string }[]>([])
  const [ocrComplete, setOcrComplete] = useState(false)
  // scannedFields: populated by DW1GHT OCR when it analyzes an uploaded document.
  // Empty until DW1GHT calls handleScanComplete with real extracted fields.
  const [scannedFields, setScannedFields] = useState<ScannedField[]>([])
  // DW1GHT calls this when it finishes analyzing a document.
  const handleScanComplete = (fields: ScannedField[]) => {
    setScannedFields(fields)
    setOcrComplete(true)
    onScanComplete?.(fields)
  }

  // File upload — hidden input triggered by the upload zone and doc-type buttons
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingDocType = useRef<string>("packing_slip")

  function openFilePicker(docType: string) {
    pendingDocType.current = docType
    fileInputRef.current?.click()
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const type = pendingDocType.current
    const newEntries = Array.from(files).map(f => ({ name: f.name, type }))
    setUploadedFiles(prev => {
      const existingNames = new Set(prev.map(x => x.name))
      return [...prev, ...newEntries.filter(f => !existingNames.has(f.name))]
    })
    // Reset so the same file can be re-selected if needed
    e.target.value = ""
  }

  function handleDropZoneDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    const newEntries = Array.from(files).map(f => ({ name: f.name, type: "packing_slip" }))
    setUploadedFiles(prev => {
      const existingNames = new Set(prev.map(x => x.name))
      return [...prev, ...newEntries.filter(f => !existingNames.has(f.name))]
    })
  }
  const [activeLineIdx, setActiveLineIdx] = useState(0)
  const [highlightField, setHighlightField] = useState<string | null>(null)
  const [inspectorName] = useState("Jonathan B.")
  const [receivingLocation] = useState("Hangar A — Main Receiving")

  // Build form state from receivable lines
  const [formLines, setFormLines] = useState<ReceiveLineForm[]>(() =>
    lines.map(l => ({
      lineId: l.lineId,
      partNumber: l.partNumber,
      partNumberVerified: false,
      description: l.description,
      woRef: l.woRef,
      qtyOrdered: l.qtyOrdered,
      qtyPreviouslyReceived: l.qtyPreviouslyReceived,
      qtyReceiving: "",
      qtyBackordered: "",
      serialNumber: "",
      lotBatch: "",
      condition: "new",
      receiptStatus: "serviceable",
      damageNotes: "",
      hasDamage: false,
      hasShortage: false,
      hasDiscrepancy: false,
      binLocation: "",
      shelfLife: "",
      expirationDate: "",
      coreTrackingNumber: "",
      isCoreExchange: l.isCoreExchange,
      requiredDocs: l.requiredDocs,
      uploadedDocs: [],
      packingSlipRef: "",
      invoiceRef: "",
      inspectionNotes: "",
      inspectionPassed: null,
    }))
  )

  function updateLine(idx: number, updates: Partial<ReceiveLineForm>) {
    setFormLines(prev => prev.map((l, i) => i === idx ? { ...l, ...updates } : l))
  }

  const filledCount = formLines.filter(l => parseInt(l.qtyReceiving) > 0).length
  const activeLine = formLines[activeLineIdx]
  const allInspected = formLines.filter(l => parseInt(l.qtyReceiving) > 0).every(l => l.inspectionPassed !== null)

  // Auto-quarantine logic
  function checkAutoQuarantine(line: ReceiveLineForm): string[] {
    const reasons: string[] = []
    if (line.hasDamage) reasons.push("Damage reported at receipt")
    if (line.hasDiscrepancy) reasons.push("Discrepancy noted")
    const missingDocs = line.requiredDocs.filter(d => !line.uploadedDocs.some(u => u.type === d && u.verified))
    if (missingDocs.length > 0) reasons.push(`Missing: ${missingDocs.map(d => DOC_LABELS[d]).join(", ")}`)
    return reasons
  }

  // ═════════════════════════════════════════════════════════════════════
  // STEP INDICATORS
  // ═════════════════════════════════════════════════════════════════════

  const steps = [
    { key: "upload", label: "1. Scan & Upload" },
    { key: "receive", label: "2. Receive & Verify" },
    { key: "inspect", label: "3. Inspect" },
    { key: "confirm", label: "4. Confirm" },
    { key: "done", label: "5. Complete" },
  ] as const

  return (
    <div className="flex flex-col h-full max-h-[92vh]">

      {/* ─── Header ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-4" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5" style={{ color: "var(--skyshare-gold)" }} />
            <h2 className="text-white text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              Receiving — {poNumber}
            </h2>
            <span className="text-white/40 text-sm">{vendorName}</span>
          </div>
          <button onClick={onCancel} className="text-white/30 hover:text-white/60 p-1 rounded hover:bg-white/[0.06]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step bar */}
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              {i > 0 && <div className="w-4 h-px bg-white/10" />}
              <span className={cn("px-2.5 py-1 rounded text-[11px] font-medium transition-colors",
                step === s.key ? "bg-white/10 text-white" :
                steps.findIndex(x => x.key === step) > i ? "text-emerald-400/70" : "text-white/25"
              )}>
                {steps.findIndex(x => x.key === step) > i && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Receiving metadata bar */}
        <div className="flex items-center gap-6 mt-3 text-xs text-white/40">
          <span className="flex items-center gap-1.5">
            <Clipboard className="w-3 h-3" /> Received by: <strong className="text-white/70">{inspectorName}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Date: <strong className="text-white/70">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Location: <strong className="text-white/70">{receivingLocation}</strong>
          </span>
        </div>
      </div>

      {/* ─── Body ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ═══ STEP 1: Upload & Scan ═══════════════════════════════════ */}
        {step === "upload" && (
          <div className="p-6 space-y-6">

            {/* Hidden file input — triggered by upload zone and doc-type buttons */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileInputChange}
            />

            <div>
              <h3 className="text-white text-sm font-semibold mb-1">Upload Receiving Documents</h3>
              <p className="text-white/40 text-xs">
                Upload packing slips, 8130-3 tags, Certificates of Conformance, or invoices.
                Once DW1GHT integration is live, fields will be extracted automatically and pre-populated into the receiving form.
              </p>
            </div>

            {/* Main drop zone */}
            <div
              className="rounded-lg border-2 border-dashed border-white/15 hover:border-[rgba(212,160,23,0.4)] transition-colors p-8 text-center cursor-pointer hover:bg-white/[0.02] group"
              onClick={() => openFilePicker("packing_slip")}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropZoneDrop}
            >
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-white/[0.04] group-hover:bg-[rgba(212,160,23,0.08)] transition-colors">
                <Upload className="w-6 h-6 text-white/25 group-hover:text-[rgba(212,160,23,0.7)] transition-colors" />
              </div>
              <p className="text-white/50 text-sm font-medium mb-1">Drop files here or click to browse</p>
              <p className="text-white/25 text-xs">Packing slips, 8130-3 tags, CoC, invoices — PDF, JPG, or PNG</p>
              <p className="text-white/15 text-[10px] mt-2">Multiple files accepted — drop a whole stack at once</p>
            </div>

            {/* Doc-type upload shortcuts */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Packing Slip",               icon: <FileText className="w-4 h-4" />,   type: "packing_slip" },
                { label: "8130-3 Tag",                  icon: <ShieldCheck className="w-4 h-4" />, type: "8130-3" },
                { label: "Certificate of Conformance",  icon: <Clipboard className="w-4 h-4" />,   type: "CoC" },
                { label: "Invoice",                     icon: <FileText className="w-4 h-4" />,    type: "invoice" },
              ].map(doc => (
                <button key={doc.type}
                  onClick={() => openFilePicker(doc.type)}
                  className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/[0.03] transition-all text-left"
                >
                  <div className="text-white/30">{doc.icon}</div>
                  <div>
                    <p className="text-white/70 text-xs font-medium">{doc.label}</p>
                    <p className="text-white/25 text-[10px]">Upload {doc.label.toLowerCase()}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Uploaded Documents</p>
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <FileText className="w-4 h-4 text-white/40" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm truncate">{f.name}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">
                        {DOC_LABELS[f.type as RequiredDocType] ?? f.type} — awaiting OCR analysis
                      </p>
                    </div>
                    <button
                      onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-white/20 hover:text-red-400 p-1 rounded hover:bg-red-400/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* OCR results — only shown when DW1GHT has processed a document */}
            {ocrComplete && scannedFields.length > 0 && (
              <div className="rounded-lg p-4" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <p className="text-emerald-400/90 text-sm font-semibold flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4" /> DW1GHT — OCR Extraction Complete
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {scannedFields.slice(0, 8).map((f, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-white/40">{f.label}:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-white/80 font-mono">{f.value}</span>
                        <span className={cn("text-[9px] px-1 rounded",
                          f.confidence > 0.95 ? "bg-emerald-900/30 text-emerald-400" :
                          f.confidence > 0.90 ? "bg-amber-900/30 text-amber-400" :
                          "bg-red-900/30 text-red-400"
                        )}>{Math.round(f.confidence * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {scannedFields.length > 8 && (
                  <p className="text-white/25 text-[10px] mt-2">+{scannedFields.length - 8} more fields extracted</p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
              <ActionBtn variant="ghost" onClick={onCancel}>Cancel</ActionBtn>
              <div className="flex items-center gap-2">
                <ActionBtn variant="default" onClick={() => setStep("receive")}>
                  {uploadedFiles.length > 0 ? "Continue — Enter Manually" : "Skip — Enter Manually"} <ArrowRight className="w-3.5 h-3.5" />
                </ActionBtn>
                {ocrComplete && (
                  <ActionBtn variant="gold" onClick={() => setStep("receive")}>
                    Continue with Scanned Data <ArrowRight className="w-3.5 h-3.5" />
                  </ActionBtn>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Receive & Verify — split screen ═════════════════ */}
        {step === "receive" && (
          <div className="flex flex-col lg:flex-row h-full">

            {/* LEFT: Receiving form */}
            <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4" style={{ borderRight: "1px solid hsl(0 0% 18%)" }}>

              {/* Line tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {formLines.map((l, i) => {
                  const filled = parseInt(l.qtyReceiving) > 0
                  const quarantine = checkAutoQuarantine(l).length > 0 && filled
                  return (
                    <button key={l.lineId} onClick={() => setActiveLineIdx(i)}
                      className={cn("flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                        activeLineIdx === i
                          ? "bg-white/10 text-white border-white/20"
                          : filled
                            ? quarantine
                              ? "bg-amber-900/15 text-amber-400/70 border-amber-800/30 hover:border-amber-700/50"
                              : "bg-emerald-900/15 text-emerald-400/70 border-emerald-800/30 hover:border-emerald-700/50"
                            : "bg-white/[0.03] text-white/40 border-white/8 hover:border-white/15"
                      )}>
                      {filled && !quarantine && <Check className="w-3 h-3 inline mr-1 -mt-0.5" />}
                      {quarantine && <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />}
                      {l.partNumber}
                    </button>
                  )
                })}
              </div>

              {activeLine && (
                <div className="space-y-4">
                  {/* Line header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white text-sm font-bold">{activeLine.partNumber}</span>
                        {activeLine.partNumberVerified
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 flex items-center gap-1"><Check className="w-2.5 h-2.5" /> Verified</span>
                          : <ActionBtn variant="default" className="text-[10px] px-1.5 py-0.5" onClick={() => updateLine(activeLineIdx, { partNumberVerified: true })}><Search className="w-2.5 h-2.5" /> Verify P/N</ActionBtn>
                        }
                        {activeLine.woRef && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/10">WO {activeLine.woRef}</span>}
                      </div>
                      <p className="text-white/50 text-xs mt-0.5">{activeLine.description}</p>
                    </div>
                  </div>

                  {/* Qty section */}
                  <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Quantities</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] mb-1 text-white/35 uppercase tracking-wider">Ordered</label>
                        <p className="text-white/60 text-sm font-mono px-3 py-2 rounded bg-white/[0.03] border border-white/6">{activeLine.qtyOrdered}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1 text-white/35 uppercase tracking-wider">Previously Rcvd</label>
                        <p className="text-white/60 text-sm font-mono px-3 py-2 rounded bg-white/[0.03] border border-white/6">{activeLine.qtyPreviouslyReceived}</p>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Receiving Now *</label>
                        <input type="number" min="0" value={activeLine.qtyReceiving}
                          onFocus={() => setHighlightField("Qty Shipped")}
                          onBlur={() => setHighlightField(null)}
                          onChange={e => {
                            const qty = parseInt(e.target.value) || 0
                            const remaining = activeLine.qtyOrdered - activeLine.qtyPreviouslyReceived
                            const bo = Math.max(0, remaining - qty)
                            updateLine(activeLineIdx, { qtyReceiving: e.target.value, qtyBackordered: bo > 0 ? String(bo) : "", hasShortage: qty < remaining && qty > 0 })
                          }}
                          className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white font-mono focus:outline-none focus:border-white/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1 text-white/35 uppercase tracking-wider">Backordered</label>
                        <p className={cn("text-sm font-mono px-3 py-2 rounded border",
                          activeLine.qtyBackordered && parseInt(activeLine.qtyBackordered) > 0
                            ? "bg-amber-900/10 border-amber-800/20 text-amber-400"
                            : "bg-white/[0.03] border-white/6 text-white/40"
                        )}>{activeLine.qtyBackordered || "0"}</p>
                      </div>
                    </div>
                    {activeLine.hasShortage && (
                      <div className="flex items-center gap-2 text-xs text-amber-400/80 mt-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Shortage: receiving less than remaining on order
                      </div>
                    )}
                  </div>

                  {/* Identity & Traceability */}
                  <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Identity & Traceability</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Serial Number {lines[activeLineIdx]?.requiresSerial && "*"}</label>
                        <input type="text" value={activeLine.serialNumber}
                          onFocus={() => setHighlightField("Serial Number")}
                          onBlur={() => setHighlightField(null)}
                          onChange={e => updateLine(activeLineIdx, { serialNumber: e.target.value })}
                          placeholder="S/N"
                          className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white font-mono placeholder:text-white/15 focus:outline-none focus:border-white/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Lot / Batch</label>
                        <input type="text" value={activeLine.lotBatch}
                          onChange={e => updateLine(activeLineIdx, { lotBatch: e.target.value })}
                          placeholder="Lot #"
                          className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white font-mono placeholder:text-white/15 focus:outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Condition at Receipt *</label>
                        <select value={activeLine.condition}
                          onFocus={() => setHighlightField("Condition")}
                          onBlur={() => setHighlightField(null)}
                          onChange={e => updateLine(activeLineIdx, { condition: e.target.value as PartCondition })}
                          className="w-full rounded-md px-3 py-2 text-sm border border-white/15 text-white" style={{ background: "hsl(0,0%,14%)", colorScheme: "dark" }}>
                          {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Bin / Stock Location</label>
                        <input type="text" value={activeLine.binLocation}
                          onChange={e => updateLine(activeLineIdx, { binLocation: e.target.value })}
                          placeholder="e.g. A-03-12"
                          className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white font-mono placeholder:text-white/15 focus:outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                    {lines[activeLineIdx]?.requiresShelfLife && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Shelf Life</label>
                          <input type="text" value={activeLine.shelfLife}
                            onChange={e => updateLine(activeLineIdx, { shelfLife: e.target.value })}
                            placeholder="e.g. 24 months"
                            className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white placeholder:text-white/15 focus:outline-none focus:border-white/30"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Expiration Date</label>
                          <input type="date" value={activeLine.expirationDate}
                            onChange={e => updateLine(activeLineIdx, { expirationDate: e.target.value })}
                            className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white focus:outline-none focus:border-white/30"
                            style={{ colorScheme: "dark" }}
                          />
                        </div>
                      </div>
                    )}
                    {activeLine.isCoreExchange && (
                      <div>
                        <label className="block text-[10px] mb-1 text-amber-400/70 uppercase tracking-wider flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Core / Exchange Tracking
                        </label>
                        <input type="text" value={activeLine.coreTrackingNumber}
                          onChange={e => updateLine(activeLineIdx, { coreTrackingNumber: e.target.value })}
                          placeholder="Core return tracking # or exchange reference"
                          className="w-full rounded-md px-3 py-2 text-sm bg-amber-900/10 border border-amber-800/20 text-white placeholder:text-white/20 focus:outline-none focus:border-amber-700/40"
                        />
                      </div>
                    )}
                  </div>

                  {/* Required Documents */}
                  <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Required Documents</p>
                    <div className="space-y-2">
                      {activeLine.requiredDocs.map(docType => {
                        const uploaded = activeLine.uploadedDocs.find(d => d.type === docType)
                        return (
                          <div key={docType} className={cn("flex items-center justify-between px-3 py-2.5 rounded-md border transition-all",
                            uploaded?.verified
                              ? "bg-emerald-900/10 border-emerald-800/20"
                              : "bg-white/[0.02] border-white/8 hover:border-white/15"
                          )}>
                            <div className="flex items-center gap-2">
                              {uploaded?.verified
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                : <FileWarning className="w-4 h-4 text-white/25" />
                              }
                              <div>
                                <p className={cn("text-xs font-medium", uploaded?.verified ? "text-emerald-400/80" : "text-white/60")}>{DOC_LABELS[docType]}</p>
                                {uploaded && <p className="text-[10px] text-white/30">{uploaded.fileName}</p>}
                              </div>
                            </div>
                            {uploaded?.verified ? (
                              <ActionBtn variant="ghost" className="text-[10px] py-0.5 px-2"><Eye className="w-3 h-3" /> View</ActionBtn>
                            ) : (
                              <ActionBtn variant="default" className="text-[10px] py-0.5 px-2"
                                onClick={() => updateLine(activeLineIdx, {
                                  uploadedDocs: [...activeLine.uploadedDocs, { type: docType, fileName: `${docType}_${activeLine.partNumber}.pdf`, verified: true }]
                                })}>
                                <Upload className="w-3 h-3" /> Upload
                              </ActionBtn>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Packing Slip Ref</label>
                        <input type="text" value={activeLine.packingSlipRef}
                          onChange={e => updateLine(activeLineIdx, { packingSlipRef: e.target.value })}
                          placeholder="PS-XXXX"
                          className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white font-mono placeholder:text-white/15 focus:outline-none focus:border-white/30"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Invoice Ref</label>
                        <input type="text" value={activeLine.invoiceRef}
                          onChange={e => updateLine(activeLineIdx, { invoiceRef: e.target.value })}
                          placeholder="INV-XXXX"
                          className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white font-mono placeholder:text-white/15 focus:outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Damage / Discrepancy / Status */}
                  <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Condition & Status Assignment</p>

                    <div className="flex flex-wrap gap-2">
                      <label className={cn("flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all text-xs",
                        activeLine.hasDamage ? "bg-red-900/20 border-red-800/30 text-red-400" : "bg-white/[0.03] border-white/8 text-white/50 hover:border-white/15"
                      )}>
                        <input type="checkbox" checked={activeLine.hasDamage} onChange={e => {
                          const hasDamage = e.target.checked
                          updateLine(activeLineIdx, { hasDamage, receiptStatus: hasDamage ? "quarantine" : activeLine.receiptStatus })
                        }} className="sr-only" />
                        <AlertTriangle className="w-3.5 h-3.5" /> Damage Found
                      </label>
                      <label className={cn("flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all text-xs",
                        activeLine.hasDiscrepancy ? "bg-amber-900/20 border-amber-800/30 text-amber-400" : "bg-white/[0.03] border-white/8 text-white/50 hover:border-white/15"
                      )}>
                        <input type="checkbox" checked={activeLine.hasDiscrepancy} onChange={e => {
                          const hasDiscrepancy = e.target.checked
                          updateLine(activeLineIdx, { hasDiscrepancy, receiptStatus: hasDiscrepancy ? "quarantine" : activeLine.receiptStatus })
                        }} className="sr-only" />
                        <FileWarning className="w-3.5 h-3.5" /> Discrepancy
                      </label>
                    </div>

                    {(activeLine.hasDamage || activeLine.hasDiscrepancy) && (
                      <div>
                        <label className="block text-[10px] mb-1 text-red-400/60 uppercase tracking-wider">Damage / Discrepancy Details *</label>
                        <textarea value={activeLine.damageNotes} onChange={e => updateLine(activeLineIdx, { damageNotes: e.target.value })}
                          rows={2} placeholder="Describe the damage, shortage, or discrepancy..."
                          className="w-full rounded-md px-3 py-2 text-sm bg-red-900/10 border border-red-800/20 text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-red-700/40"
                        />
                      </div>
                    )}

                    {/* Auto-quarantine warning */}
                    {(() => {
                      const reasons = checkAutoQuarantine(activeLine)
                      if (reasons.length === 0 || parseInt(activeLine.qtyReceiving) <= 0) return null
                      return (
                        <div className="rounded-md p-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                          <p className="text-amber-400/90 text-xs font-semibold flex items-center gap-1.5 mb-1">
                            <Ban className="w-3.5 h-3.5" /> Auto-Quarantine Triggered
                          </p>
                          <ul className="text-amber-400/60 text-[11px] space-y-0.5 ml-5 list-disc">
                            {reasons.map((r, i) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>
                      )
                    })()}

                    {/* Status assignment */}
                    <div>
                      <label className="block text-[10px] mb-2 text-white/50 uppercase tracking-wider">Receipt Status *</label>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {RECEIPT_STATUSES.map(s => (
                          <button key={s.value} onClick={() => updateLine(activeLineIdx, { receiptStatus: s.value })}
                            className={cn("px-3 py-2 rounded-md border text-xs font-semibold transition-all text-center",
                              activeLine.receiptStatus === s.value
                                ? s.color
                                : "bg-white/[0.03] border-white/8 text-white/35 hover:border-white/15"
                            )}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Nav between lines */}
                  <div className="flex items-center justify-between pt-2">
                    <ActionBtn variant="ghost" disabled={activeLineIdx === 0} onClick={() => setActiveLineIdx(i => i - 1)}>
                      <ArrowLeft className="w-3.5 h-3.5" /> Previous
                    </ActionBtn>
                    {activeLineIdx < formLines.length - 1 ? (
                      <ActionBtn variant="default" onClick={() => setActiveLineIdx(i => i + 1)}>
                        Next Line <ArrowRight className="w-3.5 h-3.5" />
                      </ActionBtn>
                    ) : (
                      <ActionBtn variant="gold" onClick={() => setStep("inspect")} disabled={filledCount === 0}>
                        Proceed to Inspection <ArrowRight className="w-3.5 h-3.5" />
                      </ActionBtn>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Scanned document viewer */}
            <div className="w-full lg:w-[420px] flex-shrink-0 overflow-y-auto p-5 space-y-3" style={{ background: "hsl(0 0% 8%)" }}>
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Document Viewer</p>
                <div className="flex items-center gap-1">
                  <ActionBtn variant="ghost" className="text-[10px] py-0.5 px-1.5"><Eye className="w-3 h-3" /></ActionBtn>
                  <ActionBtn variant="ghost" className="text-[10px] py-0.5 px-1.5"><Upload className="w-3 h-3" /></ActionBtn>
                </div>
              </div>

              {/* Tabs for uploaded docs */}
              {uploadedFiles.length > 0 && (
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {uploadedFiles.map((f, i) => (
                    <button key={i} className={cn("flex-shrink-0 px-2 py-1 rounded text-[10px] border transition-all",
                      i === 0 ? "bg-white/10 text-white/80 border-white/15" : "bg-white/[0.03] text-white/35 border-white/8"
                    )}>{f.name.split("_").slice(0, 2).join(" ")}</button>
                  ))}
                </div>
              )}

              {/* Mock scanned document */}
              <div className="relative rounded-lg overflow-hidden" style={{ background: "#f4f0e8", aspectRatio: "8.5/11" }}>
                {/* Simulated document content */}
                <div className="absolute inset-0 p-4 text-[9px] leading-relaxed" style={{ color: "#222", fontFamily: "Courier New, monospace" }}>
                  <div className="text-center mb-4">
                    <p className="font-bold text-[11px]">JSSI PARTS & LEASING</p>
                    <p>1 N. Wacker Dr., Suite 2000, Chicago, IL 60606</p>
                    <p className="mt-1 font-bold text-[10px]">PACKING SLIP</p>
                  </div>
                  <div className="flex justify-between mb-3">
                    <div><p className="font-bold">Ship To:</p><p>CB Aviation Inc.</p><p>Hangar A, Main Receiving</p></div>
                    <div className="text-right"><p><span className="font-bold">PO:</span> PO-2026-0042</p><p><span className="font-bold">Date:</span> 04/05/2026</p><p><span className="font-bold">PS#:</span> PS-JSSI-20260405</p></div>
                  </div>
                  <div className="border-t border-b py-1 mb-2 font-bold flex" style={{ borderColor: "#999" }}>
                    <span className="w-[22%]">Part #</span>
                    <span className="w-[33%]">Description</span>
                    <span className="w-[8%] text-center">Qty</span>
                    <span className="w-[20%]">Serial #</span>
                    <span className="w-[17%]">Condition</span>
                  </div>
                  <div className="flex mb-1"><span className="w-[22%]">SVO10068</span><span className="w-[33%]">Fuel Nozzle Assy PT6A-42</span><span className="w-[8%] text-center">1</span><span className="w-[20%]">FN-2026-08841</span><span className="w-[17%]">Overhauled</span></div>
                  <div className="flex mb-1"><span className="w-[22%]">AN3-12A</span><span className="w-[33%]">Bolt Hex Hd 10-32x3/4</span><span className="w-[8%] text-center">24</span><span className="w-[20%]">—</span><span className="w-[17%]">New</span></div>
                  <div className="flex mb-1"><span className="w-[22%]">3041T15</span><span className="w-[33%]">Gasket Exhaust Collector</span><span className="w-[8%] text-center">4</span><span className="w-[20%]">—</span><span className="w-[17%]">New</span></div>
                  <div className="mt-4 pt-2" style={{ borderTop: "1px solid #999" }}>
                    <p><span className="font-bold">Carrier:</span> FedEx &nbsp; <span className="font-bold">Tracking:</span> 7961 0249 4000</p>
                  </div>
                  <div className="mt-4 pt-2" style={{ borderTop: "1px solid #999" }}>
                    <p className="font-bold">Certification: FAA 8130-3</p>
                    <p>Tag #: 8130-42918 &nbsp; Condition: Overhauled</p>
                    <p>Applies to: SVO10068 / FN-2026-08841</p>
                  </div>
                </div>

                {/* OCR highlight overlays */}
                {scannedFields.map((field, i) => {
                  const isActive = highlightField === field.label
                  return (
                    <div key={i} className={cn("absolute rounded transition-all pointer-events-none",
                      isActive ? "ring-2 ring-[rgba(212,160,23,0.8)] bg-[rgba(212,160,23,0.15)]" : "bg-transparent"
                    )} style={{
                      top: `${field.top}%`, left: `${field.left}%`,
                      width: `${field.width}%`, height: `${field.height}%`,
                    }} />
                  )
                })}
              </div>

              {/* OCR field legend */}
              <div className="space-y-1">
                <p className="text-white/30 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Extracted Fields</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {scannedFields.filter((f, i, arr) => arr.findIndex(x => x.label === f.label) === i).slice(0, 10).map((f, i) => (
                    <div key={i} className={cn("flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-all",
                      highlightField === f.label ? "bg-[rgba(212,160,23,0.1)]" : "hover:bg-white/[0.03]"
                    )}
                      onMouseEnter={() => setHighlightField(f.label)}
                      onMouseLeave={() => setHighlightField(null)}
                    >
                      <span className="text-white/35">{f.label}</span>
                      <span className={cn("font-mono",
                        f.confidence > 0.95 ? "text-white/60" : "text-amber-400/60"
                      )}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: Receiving Inspection ═════════════════════════════ */}
        {step === "inspect" && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-white text-sm font-semibold mb-1 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" style={{ color: "var(--skyshare-gold)" }} /> Receiving Inspection
              </h3>
              <p className="text-white/40 text-xs">Review each received item. Verify documentation, physical condition, and part identity. This is a distinct inspection step — parts cannot be released until inspected.</p>
            </div>

            {formLines.filter(l => parseInt(l.qtyReceiving) > 0).map((line, idx) => {
              const quarantineReasons = checkAutoQuarantine(line)
              return (
                <div key={line.lineId} className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-white/80">{line.partNumber}</span>
                      <span className="text-white/40 text-xs">{line.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-emerald-400 font-bold">+{line.qtyReceiving}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold border",
                        RECEIPT_STATUSES.find(s => s.value === line.receiptStatus)?.color
                      )}>{line.receiptStatus}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Inspection summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                      <div><span className="text-white/30">S/N:</span> <span className="text-white/70 font-mono">{line.serialNumber || "—"}</span></div>
                      <div><span className="text-white/30">Lot:</span> <span className="text-white/70 font-mono">{line.lotBatch || "—"}</span></div>
                      <div><span className="text-white/30">Condition:</span> <span className="text-white/70">{line.condition}</span></div>
                      <div><span className="text-white/30">Bin:</span> <span className="text-white/70 font-mono">{line.binLocation || "—"}</span></div>
                      <div><span className="text-white/30">Docs:</span> <span className={cn("font-medium", line.uploadedDocs.length === line.requiredDocs.length ? "text-emerald-400" : "text-amber-400")}>{line.uploadedDocs.length}/{line.requiredDocs.length} verified</span></div>
                    </div>

                    {quarantineReasons.length > 0 && (
                      <div className="rounded-md p-2.5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                        <p className="text-amber-400/80 text-[11px] font-semibold flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="w-3 h-3" /> Quarantine flags
                        </p>
                        <ul className="text-amber-400/60 text-[10px] space-y-0.5 ml-5 list-disc">
                          {quarantineReasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}

                    {line.hasDamage && line.damageNotes && (
                      <div className="rounded-md p-2.5" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                        <p className="text-red-400/80 text-[11px] font-semibold">Damage Notes:</p>
                        <p className="text-red-400/60 text-xs mt-0.5">{line.damageNotes}</p>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] mb-1 text-white/50 uppercase tracking-wider">Inspector Notes</label>
                      <input type="text" value={line.inspectionNotes}
                        onChange={e => {
                          const updated = [...formLines]
                          const realIdx = formLines.indexOf(line)
                          updated[realIdx] = { ...line, inspectionNotes: e.target.value }
                          setFormLines(updated)
                        }}
                        placeholder="Inspection observations..."
                        className="w-full rounded-md px-3 py-2 text-sm bg-white/[0.06] border border-white/15 text-white placeholder:text-white/15 focus:outline-none focus:border-white/30"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <ActionBtn
                        variant={line.inspectionPassed === true ? "gold" : "default"}
                        className={line.inspectionPassed === true ? "" : ""}
                        onClick={() => {
                          const realIdx = formLines.indexOf(line)
                          const updated = [...formLines]
                          updated[realIdx] = { ...line, inspectionPassed: true }
                          setFormLines(updated)
                        }}>
                        <Check className="w-3.5 h-3.5" /> Pass Inspection
                      </ActionBtn>
                      <ActionBtn
                        variant={line.inspectionPassed === false ? "danger" : "default"}
                        onClick={() => {
                          const realIdx = formLines.indexOf(line)
                          const updated = [...formLines]
                          updated[realIdx] = { ...line, inspectionPassed: false, receiptStatus: "quarantine" }
                          setFormLines(updated)
                        }}>
                        <Ban className="w-3.5 h-3.5" /> Fail — Quarantine
                      </ActionBtn>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
              <ActionBtn variant="ghost" onClick={() => setStep("receive")}><ArrowLeft className="w-3.5 h-3.5" /> Back to Receiving</ActionBtn>
              <ActionBtn variant="gold" onClick={() => setStep("confirm")} disabled={!allInspected}>
                Review & Confirm <ArrowRight className="w-3.5 h-3.5" />
              </ActionBtn>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Confirmation ════════════════════════════════════ */}
        {step === "confirm" && (
          <div className="p-6 space-y-5">
            <div className="rounded-lg p-3" style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.2)" }}>
              <p className="text-sm font-medium" style={{ color: "rgba(212,160,23,0.9)" }}>Final Review</p>
              <p className="text-xs mt-0.5 text-white/40">Confirm receipt to update inventory, PO status, and notify linked work orders. A full audit trail will be created.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                    {["Part #", "Qty", "S/N", "Condition", "Status", "Bin", "Docs", "Inspection"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-white/35 uppercase tracking-widest whitespace-nowrap" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formLines.filter(l => parseInt(l.qtyReceiving) > 0).map(line => (
                    <tr key={line.lineId} style={{ borderBottom: "1px solid hsl(0 0% 16%)" }}>
                      <td className="px-3 py-2.5 font-mono text-white/80">{line.partNumber}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-emerald-400">+{line.qtyReceiving}</td>
                      <td className="px-3 py-2.5 font-mono text-white/50">{line.serialNumber || "—"}</td>
                      <td className="px-3 py-2.5 text-white/60 capitalize">{line.condition.replace("_", " ")}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold border",
                          RECEIPT_STATUSES.find(s => s.value === line.receiptStatus)?.color
                        )}>{line.receiptStatus}</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-white/50">{line.binLocation || "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[10px] font-medium",
                          line.uploadedDocs.length === line.requiredDocs.length ? "text-emerald-400" : "text-amber-400"
                        )}>{line.uploadedDocs.length}/{line.requiredDocs.length}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {line.inspectionPassed === true
                          ? <span className="text-emerald-400 text-[10px] font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Passed</span>
                          : <span className="text-red-400 text-[10px] font-semibold flex items-center gap-1"><Ban className="w-3 h-3" /> Failed</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Audit trail preview */}
            <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-heading)" }}>Audit Trail (will be created)</p>
              <div className="space-y-1.5 text-xs">
                <p className="text-white/50"><span className="text-white/30 font-mono mr-2">{new Date().toLocaleString()}</span>Receiving event created by {inspectorName}</p>
                <p className="text-white/50"><span className="text-white/30 font-mono mr-2">{new Date().toLocaleString()}</span>Location: {receivingLocation}</p>
                {formLines.filter(l => parseInt(l.qtyReceiving) > 0).map(l => (
                  <p key={l.lineId} className="text-white/50 ml-4">
                    — {l.partNumber}: +{l.qtyReceiving}, {l.condition}, status={l.receiptStatus}
                    {l.serialNumber && `, S/N=${l.serialNumber}`}
                    {l.binLocation && `, bin=${l.binLocation}`}
                    , inspection={l.inspectionPassed ? "passed" : "failed"}
                    , docs={l.uploadedDocs.length}/{l.requiredDocs.length}
                  </p>
                ))}
                <p className="text-white/50"><span className="text-white/30 font-mono mr-2">{new Date().toLocaleString()}</span>PO / Inventory / WO statuses will be auto-updated</p>
                <p className="text-white/25 text-[10px] mt-2 italic">Note: Serviceable release is a separate step — parts marked serviceable still require installer/IA release before use on aircraft.</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
              <ActionBtn variant="ghost" onClick={() => setStep("inspect")}><ArrowLeft className="w-3.5 h-3.5" /> Back</ActionBtn>
              <ActionBtn variant="gold" onClick={() => { setStep("done"); onComplete(formLines.filter(l => parseInt(l.qtyReceiving) > 0)) }}>
                <Check className="w-3.5 h-3.5" /> Confirm Receipt
              </ActionBtn>
            </div>
          </div>
        )}

        {/* ═══ STEP 5: Done ════════════════════════════════════════════ */}
        {step === "done" && (
          <div className="p-6 space-y-5">
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.3)" }}>
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-white text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>Receiving Complete</h3>
              <p className="text-white/40 text-sm mt-1">{filledCount} line item{filledCount !== 1 ? "s" : ""} received, inspected, and logged</p>
            </div>

            <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <p className="text-blue-300/90 text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4" /> Auto-Updates Applied</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /><span className="text-white/60">Receiving records created with full traceability (who, when, where, condition, documents)</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /><span className="text-white/60">All uploaded documents attached to PO and receiving event records</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /><span className="text-white/60">Inventory updated — parts assigned to bin locations</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /><span className="text-white/60">PO line statuses and quantities updated automatically</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /><span className="text-white/60">Linked work orders notified that parts are available</span></div>
                <div className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" /><span className="text-white/60">Parts request statuses updated to reflect receipt</span></div>
              </div>
              <div className="pt-2 mt-2" style={{ borderTop: "1px solid rgba(59,130,246,0.1)" }}>
                <p className="text-white/30 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <strong className="text-white/50">Next step:</strong> Serviceable parts require installer/IA release before being issued to a work order. Quarantined items remain held pending resolution.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end pt-4" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
              <ActionBtn variant="default" onClick={onCancel}><Wrench className="w-3.5 h-3.5" /> Go to Work Order</ActionBtn>
              <ActionBtn variant="gold" onClick={onCancel}>Done — Return to PO <ArrowRight className="w-3.5 h-3.5" /></ActionBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
