import { useState, useRef, useMemo, useEffect, useCallback } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import {
  ArrowLeft, AlertTriangle, StickyNote, Check, ChevronRight,
  Plus, X, Clock, UserX, Package,
  CheckCircle2, Circle, AlertCircle, Scissors, Eye,
  BookOpen, ShoppingCart, FileText, Receipt, Search, Warehouse, Download,
} from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import {
  getWorkOrderById, updateWorkOrderStatus, updateWorkOrder,
  upsertWOItem, updateItemStatus, updateWOItemFields, signOffItem, clearSignOff,
  addItemPart, removeItemPart, clockLabor, deleteLabor,
  getParts, getTechnicians, getMyProfileId,
  getLogbookEntries, getOrCreateDraftLogbookEntry, upsertEntrySignatory, addSignatoryLine, updateLogbookEntry,
} from "../../services"
import { WO_STATUS_LABELS, INVOICE_STATUS_LABELS } from "../../constants"
import type {
  WorkOrder, WOStatus, WOItem, WOItemPart,
  WOItemLabor, WOItemStatus, LogbookSection,
  InventoryPart, Mechanic, LogbookEntry,
} from "../../types"
import { supabase } from "@/lib/supabase"
import { WOStatusBadge, PriorityBadge } from "../../shared/StatusBadge"

// ─── Status pipeline ──────────────────────────────────────────────────────────
const NEXT_STATUS: Partial<Record<WOStatus, WOStatus>> = {
  draft: "open", open: "in_review", waiting_on_parts: "open", in_review: "billing", billing: "completed",
}
const NEXT_STATUS_LABEL: Partial<Record<WOStatus, string>> = {
  draft: "Open Work Order", open: "Submit for Review",
  waiting_on_parts: "Parts Received — Resume", in_review: "Approve → Billing", billing: "Complete Work Order",
}
const PREV_STATUS: Partial<Record<WOStatus, WOStatus>> = {
  open: "draft", in_review: "open", billing: "in_review",
}

// ─── Section config ───────────────────────────────────────────────────────────
const ALL_SECTIONS: LogbookSection[] = ["Airframe", "Engine 1", "Engine 2", "Propeller", "APU", "Other"]
const SECTION_COLORS: Record<LogbookSection, string> = {
  "Airframe":  "#d4a017",
  "Engine 1":  "#60a5fa",
  "Engine 2":  "#93c5fd",
  "Propeller": "#6ee7b7",
  "APU":       "#c4b5fd",
  "Other":     "#a1a1aa",
}

// ─── Item status config ───────────────────────────────────────────────────────
const ITEM_STATUS_CONFIG: Record<WOItemStatus, {
  label: string; icon: React.ElementType; color: string; bg: string; border: string; activeBg: string
}> = {
  pending:      { label: "Pending",      icon: Circle,       color: "text-white/50",    bg: "bg-white/[0.06]",       border: "border-white/20",      activeBg: "bg-white/[0.12]"    },
  in_progress:  { label: "In Progress",  icon: Clock,        color: "text-blue-300",    bg: "bg-blue-900/20",        border: "border-blue-700/40",   activeBg: "bg-blue-800/40"     },
  done:         { label: "Done",         icon: CheckCircle2, color: "text-emerald-300", bg: "bg-emerald-900/20",     border: "border-emerald-700/40",activeBg: "bg-emerald-800/40"  },
  needs_review: { label: "Needs Review", icon: Eye,          color: "text-amber-300",   bg: "bg-amber-900/20",       border: "border-amber-700/40",  activeBg: "bg-amber-800/40"    },
  cut_short:    { label: "Cut Short",    icon: Scissors,     color: "text-red-300",     bg: "bg-red-900/20",         border: "border-red-700/40",    activeBg: "bg-red-800/40"      },
}

// ─── Financial helpers ────────────────────────────────────────────────────────
function itemLaborTotal(item: WOItem)  { return item.estimatedHours * item.laborRate }
function itemPartsTotal(item: WOItem)  { return item.parts.reduce((s, p) => s + p.qty * p.unitPrice, 0) }
function itemSubtotal(item: WOItem)    { return itemLaborTotal(item) + itemPartsTotal(item) + item.shippingCost + item.outsideServicesCost }

const SHOP_SUPPLIES_RATE = 0.05

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

async function downloadPdf(el: HTMLElement, filename: string) {
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: "#1a1a1a" })
  const imgData = canvas.toDataURL("image/png")
  const pdf = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" })
  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = pdf.internal.pageSize.getHeight()
  const imgH = canvas.height * (pdfW / canvas.width)
  let position = 0
  let remaining = imgH
  pdf.addImage(imgData, "PNG", 0, 0, pdfW, imgH)
  remaining -= pdfH
  while (remaining > 0) {
    position += pdfH
    pdf.addPage()
    pdf.addImage(imgData, "PNG", 0, -position, pdfW, imgH)
    remaining -= pdfH
  }
  pdf.save(filename)
}

// ─── Formatting toolbar ───────────────────────────────────────────────────────
function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement>,
  before: string, after = "",
  onUpdate: (val: string) => void,
) {
  const el = ref.current
  if (!el) return
  const start = el.selectionStart, end = el.selectionEnd
  const selected = el.value.slice(start, end)
  const newVal = el.value.slice(0, start) + before + selected + after + el.value.slice(end)
  onUpdate(newVal)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

function Toolbar({ textareaRef, onUpdate }: {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  onUpdate: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.07]">
      {[
        { label: "B",  title: "Bold",          before: "**", after: "**" },
        { label: "I",  title: "Italic",         before: "_",  after: "_"  },
        { label: "•",  title: "Bullet point",   before: "\n• ", after: "" },
        { label: "1.", title: "Numbered item",  before: "\n1. ", after: "" },
        { label: "—",  title: "Separator line", before: "\n——————\n", after: "" },
      ].map(btn => (
        <button
          key={btn.label}
          title={btn.title}
          onMouseDown={e => { e.preventDefault(); insertAtCursor(textareaRef, btn.before, btn.after, onUpdate) }}
          className="h-8 w-9 flex items-center justify-center rounded text-sm font-semibold text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
          style={btn.label === "B" ? { fontFamily: "serif" } : btn.label === "I" ? { fontFamily: "serif", fontStyle: "italic" } : {}}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

// ─── Item Detail Panel ────────────────────────────────────────────────────────
interface ItemDetailPanelProps {
  item: WOItem
  isLocked: boolean
  sectionColor: string
  onPatch: (patch: Partial<WOItem>) => void
  onPersist: (fields: Partial<WOItem>) => void
  onSignOff: () => void
  onDeleteLabor: (id: string) => void
  onDeletePart: (id: string) => void
  mechanics: Mechanic[]
  inventoryParts: InventoryPart[]
  onNavigatePO: () => void
  addingPartToItem: string | null
  setAddingPartToItem: (id: string | null) => void
  newPart: { partNumber: string; description: string; qty: string; unitPrice: string }
  setNewPart: React.Dispatch<React.SetStateAction<{ partNumber: string; description: string; qty: string; unitPrice: string }>>
  onAddPart: () => void
  addingLaborToItem: string | null
  setAddingLaborToItem: (id: string | null) => void
  newLabor: { mechName: string; hours: string; date: string }
  setNewLabor: React.Dispatch<React.SetStateAction<{ mechName: string; hours: string; date: string }>>
  onAddLabor: () => void
}

function ItemDetailPanel({
  item, isLocked, sectionColor, onPatch, onPersist, onSignOff, onDeleteLabor, onDeletePart,
  mechanics, inventoryParts, onNavigatePO,
  addingPartToItem, setAddingPartToItem, newPart, setNewPart, onAddPart,
  addingLaborToItem, setAddingLaborToItem, newLabor, setNewLabor, onAddLabor,
}: ItemDetailPanelProps) {
  const discRef = useRef<HTMLTextAreaElement>(null)
  const corrRef = useRef<HTMLTextAreaElement>(null)
  const [showInventoryPicker, setShowInventoryPicker] = useState(false)
  const [invSearch, setInvSearch] = useState("")

  // ── P/N cross-check: inventory parts mentioned in corrective action but not logged ──
  const unloggedMentionedParts = useMemo(() => {
    if (!item.correctiveAction) return []
    const text = item.correctiveAction.toLowerCase()
    return inventoryParts.filter(inv =>
      text.includes(inv.partNumber.toLowerCase()) &&
      !item.parts.some(p => p.partNumber.toLowerCase() === inv.partNumber.toLowerCase())
    )
  }, [item.correctiveAction, item.parts, inventoryParts])

  // ── Filtered inventory for picker ─────────────────────────────────────────────
  const filteredInventory = useMemo(() => {
    const q = invSearch.toLowerCase().trim()
    if (!q) return inventoryParts
    return inventoryParts.filter(p =>
      p.partNumber.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    )
  }, [invSearch, inventoryParts])

  function addFromInventory(inv: InventoryPart) {
    const part: WOItemPart = {
      id: `p-inv-${Date.now()}`,
      partNumber: inv.partNumber,
      description: inv.description,
      qty: 1,
      unitPrice: inv.unitCost,
    }
    onPatch({ parts: [...item.parts, part] })
    setShowInventoryPicker(false)
    setInvSearch("")
  }

  const itemStatus    = item.itemStatus ?? "pending"
  const laborEntries  = item.labor ?? []
  const clockedTotal  = laborEntries.reduce((s, e) => s + e.hours, 0)
  const noPartsRequired = item.noPartsRequired ?? false

  const clockedNames  = new Set(laborEntries.map(e => e.mechanicName))
  const allMechanics  = mechanics
  const notClocked    = allMechanics.filter(m => !clockedNames.has(m.name))

  return (
    <div className="flex flex-col h-full">

      {/* ── Item header ───────────────────────────────────────────────────── */}
      <div
        className="px-6 py-4 flex items-start justify-between flex-shrink-0"
        style={{
          background: "hsl(0,0%,11%)",
          borderBottom: "1px solid hsl(0,0%,18%)",
          borderLeft: `4px solid ${sectionColor}`,
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded"
              style={{ background: sectionColor + "22", color: sectionColor }}
            >
              {item.logbookSection}
            </span>
            {item.taskNumber && (
              <span className="text-white/35 text-xs font-mono">#{item.taskNumber}</span>
            )}
          </div>
          <h2 className="text-white text-xl font-semibold leading-tight">{item.category}</h2>
          {item.partNumber && (
            <p className="text-white/35 text-xs mt-1.5 font-mono">
              P/N: {item.partNumber}{item.serialNumber ? ` · S/N: ${item.serialNumber}` : ""}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0 ml-6">
          <div className="text-white/30 text-xs mb-1">Item {item.itemNumber}</div>
          {clockedTotal > 0 && (
            <div className="text-white/50 text-sm">{clockedTotal.toFixed(1)} hrs logged</div>
          )}
        </div>
      </div>

      {/* ── Status selector ───────────────────────────────────────────────── */}
      <div
        className="px-6 py-3 flex items-center gap-2 flex-wrap flex-shrink-0"
        style={{ background: "hsl(0,0%,10.5%)", borderBottom: "1px solid hsl(0,0%,17%)" }}
      >
        <span className="text-white/40 text-sm mr-1">Status:</span>
        {(Object.entries(ITEM_STATUS_CONFIG) as [WOItemStatus, typeof ITEM_STATUS_CONFIG[WOItemStatus]][]).map(([key, cfg]) => {
          const Icon = cfg.icon
          const active = itemStatus === key
          return (
            <button
              key={key}
              disabled={isLocked}
              onClick={() => { onPatch({ itemStatus: key }); onPersist({ itemStatus: key }) }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                active
                  ? cn(cfg.activeBg, cfg.color, cfg.border)
                  : "bg-transparent text-white/40 border-white/10 hover:border-white/25 hover:text-white/70",
                isLocked && "opacity-50 cursor-default"
              )}
            >
              <Icon className="w-4 h-4" />
              {cfg.label}
            </button>
          )
        })}
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Task / Discrepancy + Work Performed — boxed cards */}
        <div className="px-5 pt-5 pb-5 space-y-4" style={{ borderBottom: "1px solid hsl(0,0%,17%)" }}>

          {/* Task / Discrepancy box */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(251,146,60,0.35)", borderLeft: "4px solid rgba(251,146,60,0.7)" }}
          >
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{
                background: "linear-gradient(to right, rgba(251,146,60,0.1), rgba(251,146,60,0.04))",
                borderBottom: "1px solid rgba(251,146,60,0.2)",
              }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(251,146,60,0.9)" }} />
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(251,146,60,0.9)" }}>Task / Discrepancy</span>
              <span className="text-white/30 text-xs">— what needs to be done, or what was found</span>
            </div>
            {!isLocked && <Toolbar textareaRef={discRef} onUpdate={v => onPatch({ discrepancy: v })} />}
            <textarea
              ref={discRef}
              value={item.discrepancy}
              onChange={e => onPatch({ discrepancy: e.target.value })}
              onBlur={e => onPersist({ discrepancy: e.target.value })}
              disabled={isLocked}
              rows={6}
              placeholder="Describe the discrepancy or task…"
              className="w-full px-5 py-4 text-white text-base leading-relaxed resize-none focus:outline-none placeholder:text-white/20 disabled:opacity-60"
              style={{ background: "hsl(0,0%,11%)" }}
            />
          </div>

          {/* Work Performed box */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(52,211,153,0.3)", borderLeft: "4px solid rgba(52,211,153,0.65)" }}
          >
            <div
              className="px-4 py-3 flex items-center gap-3 flex-wrap"
              style={{
                background: "linear-gradient(to right, rgba(52,211,153,0.09), rgba(52,211,153,0.03))",
                borderBottom: "1px solid rgba(52,211,153,0.18)",
              }}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(52,211,153,0.9)" }} />
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "rgba(52,211,153,0.9)" }}>Work Performed</span>
              <div
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded font-medium"
                style={{ background: "rgba(110,231,183,0.1)", color: "#6ee7b7" }}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Logbook entry
              </div>
              {item.signedOffBy && (
                <span className="text-emerald-400 text-sm font-medium">✓ Signed by {item.signedOffBy}</span>
              )}
              {item.correctiveAction && item.signOffRequired && !item.signedOffBy && !isLocked && (
                <span className="text-white/25 text-sm">Awaiting sign-off</span>
              )}
            </div>
            {!isLocked && <Toolbar textareaRef={corrRef} onUpdate={v => onPatch({ correctiveAction: v })} />}
            <textarea
              ref={corrRef}
              value={item.correctiveAction}
              onChange={e => onPatch({ correctiveAction: e.target.value })}
              onBlur={e => onPersist({ correctiveAction: e.target.value })}
              disabled={isLocked}
              rows={6}
              placeholder={isLocked ? "No corrective action recorded." : "What was done to correct the discrepancy…"}
              className="w-full px-5 py-4 text-white text-base leading-relaxed resize-none focus:outline-none placeholder:text-white/20 disabled:opacity-60"
              style={{ background: "hsl(0,0%,11%)" }}
            />
          </div>

        </div>

        {/* ── P/N cross-check warning ───────────────────────────────────────── */}
        {unloggedMentionedParts.length > 0 && (
          <div
            className="mx-5 mt-1 mb-0 rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.06)" }}
          >
            <div className="px-4 py-2.5 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(251,191,36,0.9)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "rgba(251,191,36,0.9)" }}>
                  Part{unloggedMentionedParts.length > 1 ? "s" : ""} mentioned in corrective action but not logged
                </p>
                <div className="mt-2 space-y-1.5">
                  {unloggedMentionedParts.map(inv => (
                    <div key={inv.id} className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm text-white/80">{inv.partNumber}</span>
                      <span className="text-white/45 text-sm truncate">{inv.description}</span>
                      {inv.qtyOnHand > 0 && (
                        <span className="text-emerald-400/70 text-xs">{inv.qtyOnHand} on hand</span>
                      )}
                      {!isLocked && (
                        <button
                          onClick={() => addFromInventory(inv)}
                          className="text-xs font-semibold px-2.5 py-1 rounded transition-all"
                          style={{
                            background: "rgba(251,191,36,0.15)",
                            color: "rgba(251,191,36,0.9)",
                            border: "1px solid rgba(251,191,36,0.3)",
                          }}
                        >
                          + Add to Parts
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Labor */}
        <div
          className="px-6 py-5"
          style={{ borderBottom: "1px solid hsl(0,0%,17%)", borderLeft: "3px solid rgba(96,165,250,0.4)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-bold uppercase tracking-wider" style={{ color: "#93c5fd" }}>Labor</span>
              {clockedTotal > 0 && (
                <span className="text-white/50 text-sm">{clockedTotal.toFixed(1)} hrs total</span>
              )}
            </div>
            {!isLocked && addingLaborToItem !== item.id && (
              <Button
                size="sm" variant="ghost"
                onClick={() => {
                  setAddingLaborToItem(item.id)
                  setNewLabor({ mechName: "", hours: "", date: new Date().toISOString().slice(0, 10) })
                }}
                className="text-white/50 hover:text-white border border-white/15 h-9 px-4 text-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Log Time
              </Button>
            )}
          </div>

          {/* Labor entries */}
          {laborEntries.length > 0 && (
            <div className="space-y-2 mb-4">
              {laborEntries.map(e => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ background: "hsl(220,15%,11%)", borderLeft: "3px solid rgba(96,165,250,0.5)" }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-white text-sm flex-1">{e.mechanicName}</span>
                  <span className="text-white/70 text-sm font-mono">{e.hours.toFixed(1)} hrs</span>
                  <span className="text-white/40 text-sm">{new Date(e.clockedAt).toLocaleDateString()}</span>
                  {!isLocked && (
                    <button
                      onClick={() => onDeleteLabor(e.id)}
                      className="text-white/20 hover:text-red-400 transition-colors ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Not clocked in */}
          {notClocked.length > 0 && (
            <div className="mb-4">
              <p className="text-white/30 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5" /> Not clocked in
              </p>
              <div className="flex flex-wrap gap-2">
                {notClocked.map(m => (
                  <span
                    key={m.id}
                    className="text-white/40 text-sm px-3 py-1.5 rounded"
                    style={{ background: "hsl(0,0%,13%)" }}
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {allMechanics.length === 0 && laborEntries.length === 0 && (
            <p className="text-white/25 text-sm italic mb-2">No mechanics assigned to this work order.</p>
          )}

          {/* Log time form */}
          {addingLaborToItem === item.id && (
            <div className="p-4 rounded-xl space-y-3" style={{ background: "hsl(0,0%,13%)", border: "1px solid hsl(0,0%,22%)" }}>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Mechanic</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30"
                    value={newLabor.mechName}
                    onChange={e => setNewLabor(n => ({ ...n, mechName: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {mechanics.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Hours</label>
                  <input
                    type="number" step="0.5" min="0.5" placeholder="0.0"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                    value={newLabor.hours}
                    onChange={e => setNewLabor(n => ({ ...n, hours: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30"
                    value={newLabor.date}
                    onChange={e => setNewLabor(n => ({ ...n, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm" onClick={onAddLabor}
                  disabled={!newLabor.mechName || !newLabor.hours}
                  style={{ background: "var(--skyshare-gold)", color: "#000" }}
                  className="font-bold h-10 px-6 text-sm"
                >
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingLaborToItem(null)} className="text-white/40 h-10 px-4 text-sm">Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Parts */}
        <div
          className="px-6 py-5"
          style={{ borderBottom: "1px solid hsl(0,0%,17%)", borderLeft: "3px solid rgba(212,160,23,0.45)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5" style={{ color: "var(--skyshare-gold)" }} />
              <span className="text-sm font-bold uppercase tracking-wider" style={{ color: "rgba(212,160,23,0.85)" }}>Parts</span>
              {item.parts.length > 0 && (
                <span className="text-white/50 text-sm">{item.parts.length} {item.parts.length === 1 ? "part" : "parts"}</span>
              )}
            </div>
            {!isLocked && (
              <div className="flex items-center gap-2">
                {/* Only show these header buttons when parts already exist — empty state handles the zero-parts case */}
                {!noPartsRequired && item.parts.length > 0 && addingPartToItem !== item.id && !showInventoryPicker && (
                  <>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => setShowInventoryPicker(true)}
                      className="text-white/50 hover:text-white border border-white/15 h-9 px-4 text-sm"
                    >
                      <Warehouse className="w-4 h-4 mr-1.5" /> From Inventory
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { setAddingPartToItem(item.id); setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" }) }}
                      className="text-white/50 hover:text-white border border-white/15 h-9 px-4 text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Add Part
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  onClick={onNavigatePO}
                  className="h-9 px-4 text-sm font-semibold"
                  style={{ background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)", border: "1px solid rgba(212,160,23,0.3)" }}
                >
                  <ShoppingCart className="w-4 h-4 mr-1.5" /> Order Parts
                </Button>
              </div>
            )}
          </div>

          {/* No-parts toggle */}
          {!isLocked && (
            <label className="flex items-center gap-2.5 cursor-pointer mb-4 group">
              <div
                className={cn(
                  "w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0",
                  noPartsRequired
                    ? "bg-emerald-700/40 border-emerald-600/50"
                    : "bg-transparent border-white/20 group-hover:border-white/40"
                )}
                onClick={() => { onPatch({ noPartsRequired: !noPartsRequired }); onPersist({ noPartsRequired: !noPartsRequired }) }}
              >
                {noPartsRequired && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <span className="text-white/50 text-sm select-none">No parts required for this task</span>
            </label>
          )}

          {/* Parts list */}
          {item.parts.length > 0 ? (
            <div className="space-y-2 mb-4">
              {item.parts.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
                  style={{ background: "hsl(35,8%,10%)", borderLeft: "3px solid rgba(212,160,23,0.45)" }}
                >
                  <span className="text-white font-mono flex-shrink-0 w-32 truncate">{p.partNumber}</span>
                  <span className="text-white/70 flex-1 truncate">{p.description}</span>
                  <span className="text-white/60 flex-shrink-0 font-medium">Qty: {p.qty}</span>
                  {!isLocked && (
                    <button
                      onClick={() => onDeletePart(p.id)}
                      className="text-white/20 hover:text-red-400 transition-colors ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : noPartsRequired ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400/80 mb-4">
              <CheckCircle2 className="w-4 h-4" /> No parts required — confirmed
            </div>
          ) : !isLocked && addingPartToItem !== item.id && !showInventoryPicker ? (
            /* ── Collapsed empty state with action buttons ── */
            <div
              className="flex items-center justify-between px-4 py-3 rounded-xl mb-4"
              style={{ background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,20%)" }}
            >
              <span className="text-white/35 text-sm italic">No parts logged yet</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAddingPartToItem(item.id); setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" }) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-white/60 hover:text-white"
                  style={{ background: "hsl(0,0%,17%)", border: "1px solid hsl(0,0%,26%)" }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Manually
                </button>
                <button
                  onClick={() => setShowInventoryPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.3)", color: "rgba(212,160,23,0.9)" }}
                >
                  <Warehouse className="w-3.5 h-3.5" /> Pull from Inventory
                </button>
              </div>
            </div>
          ) : isLocked ? (
            <div className="flex items-center gap-2 text-sm text-amber-500/60 mb-4">
              <AlertCircle className="w-4 h-4" /> No parts logged
            </div>
          ) : null}

          {/* ── Inventory picker ─────────────────────────────────────────────── */}
          {showInventoryPicker && (
            <div
              className="rounded-xl overflow-hidden mb-4"
              style={{ border: "1px solid rgba(212,160,23,0.3)", background: "hsl(0,0%,11%)" }}
            >
              {/* Picker header */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ background: "rgba(212,160,23,0.08)", borderBottom: "1px solid rgba(212,160,23,0.2)" }}
              >
                <Warehouse className="w-4 h-4 flex-shrink-0" style={{ color: "var(--skyshare-gold)" }} />
                <span className="text-sm font-bold uppercase tracking-wider" style={{ color: "rgba(212,160,23,0.9)" }}>
                  Pull from Inventory
                </span>
                <div className="flex-1" />
                <button onClick={() => { setShowInventoryPicker(false); setInvSearch("") }} className="text-white/30 hover:text-white/70 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Search input */}
              <div className="px-4 py-3 flex items-center gap-2.5" style={{ borderBottom: "1px solid hsl(0,0%,18%)" }}>
                <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
                <input
                  autoFocus
                  placeholder="Search by part number or description…"
                  className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none"
                  value={invSearch}
                  onChange={e => setInvSearch(e.target.value)}
                />
              </div>
              {/* Results */}
              <div className="max-h-56 overflow-y-auto">
                {filteredInventory.length === 0 ? (
                  <p className="px-5 py-4 text-white/30 text-sm italic">No matching parts</p>
                ) : (
                  filteredInventory.map(inv => {
                    const alreadyAdded = item.parts.some(p => p.partNumber.toLowerCase() === inv.partNumber.toLowerCase())
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 px-4 py-3 border-t transition-colors"
                        style={{ borderColor: "hsl(0,0%,17%)", background: "hsl(0,0%,11%)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-white/90">{inv.partNumber}</span>
                            {inv.qtyOnHand <= 0 && (
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>Out of stock</span>
                            )}
                            {inv.qtyOnHand > 0 && (
                              <span className="text-xs text-emerald-400/70">{inv.qtyOnHand} on hand</span>
                            )}
                          </div>
                          <p className="text-white/45 text-xs truncate mt-0.5">{inv.description}</p>
                        </div>
                        <span className="text-white/35 text-xs font-mono flex-shrink-0">${inv.unitCost.toFixed(2)}</span>
                        {alreadyAdded ? (
                          <span className="text-emerald-400/70 text-xs flex-shrink-0">✓ Added</span>
                        ) : (
                          <button
                            onClick={() => addFromInventory(inv)}
                            className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: "rgba(212,160,23,0.15)", color: "rgba(212,160,23,0.9)", border: "1px solid rgba(212,160,23,0.3)" }}
                          >
                            Add
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              {/* Footer */}
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderTop: "1px solid hsl(0,0%,17%)", background: "hsl(0,0%,10%)" }}
              >
                <span className="text-white/25 text-xs">{filteredInventory.length} part{filteredInventory.length !== 1 ? "s" : ""} in inventory</span>
                <button
                  onClick={() => { setShowInventoryPicker(false); setAddingPartToItem(item.id); setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" }) }}
                  className="text-white/40 hover:text-white/70 text-xs transition-colors"
                >
                  Enter manually instead →
                </button>
              </div>
            </div>
          )}

          {/* Add part form (manual) */}
          {addingPartToItem === item.id && (
            <div className="p-4 rounded-xl space-y-3 mb-4" style={{ background: "hsl(0,0%,13%)", border: "1px solid hsl(0,0%,22%)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Add Part Manually</span>
                <button onClick={() => setShowInventoryPicker(true)} className="text-xs text-amber-400/70 hover:text-amber-300 transition-colors flex items-center gap-1">
                  <Warehouse className="w-3 h-3" /> Search inventory instead
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Part Number</label>
                  <input
                    placeholder="e.g. MS28775-228"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                    value={newPart.partNumber}
                    onChange={e => setNewPart(n => ({ ...n, partNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Description</label>
                  <input
                    placeholder="Part description"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                    value={newPart.description}
                    onChange={e => setNewPart(n => ({ ...n, description: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Qty</label>
                  <input
                    type="number" min="1"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30"
                    value={newPart.qty}
                    onChange={e => setNewPart(n => ({ ...n, qty: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider block mb-1.5">Unit Price</label>
                  <input
                    type="number" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                    value={newPart.unitPrice}
                    onChange={e => setNewPart(n => ({ ...n, unitPrice: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm" onClick={onAddPart}
                  disabled={!newPart.partNumber || !newPart.unitPrice}
                  style={{ background: "var(--skyshare-gold)", color: "#000" }}
                  className="font-bold h-10 px-6 text-sm"
                >
                  Add Part
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingPartToItem(null)} className="text-white/40 h-10 px-4 text-sm">Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Sign-off */}
        {item.signOffRequired && (
          <div className="px-6 py-5">
            {item.signedOffBy ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="text-emerald-400 font-semibold text-base">Signed Off</p>
                    <p className="text-white/50 text-sm">
                      {item.signedOffBy}{item.signedOffAt ? ` — ${fmtDate(item.signedOffAt)}` : ""}
                    </p>
                  </div>
                </div>
                {!isLocked && (
                  <button
                    onClick={onSignOff}
                    className="text-white/30 hover:text-white/60 text-sm transition-colors"
                  >
                    Undo sign-off
                  </button>
                )}
              </div>
            ) : (
              !isLocked && (
                <button
                  onClick={onSignOff}
                  className="w-full flex items-center justify-center gap-3 py-5 rounded-xl text-base font-bold transition-all"
                  style={{
                    border: "2px solid rgba(52,211,153,0.4)",
                    background: "rgba(52,211,153,0.06)",
                    color: "rgba(52,211,153,0.85)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.border = "2px solid rgba(52,211,153,0.7)"
                    ;(e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.12)"
                    ;(e.currentTarget as HTMLButtonElement).style.color = "#6ee7b7"
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.border = "2px solid rgba(52,211,153,0.4)"
                    ;(e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.06)"
                    ;(e.currentTarget as HTMLButtonElement).style.color = "rgba(52,211,153,0.85)"
                  }}
                >
                  <CheckCircle2 className="w-6 h-6" />
                  Sign Off This Item
                </button>
              )
            )}
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Handle Traxxall import: build a synthetic WO from navigate state
  const importState = location.state as {
    traxxallImport?: boolean
    aircraftId?: string | null
    guestRegistration?: string | null
    aircraftReg?: string
    aircraftModel?: string
    woType?: string
    description?: string
    items?: WOItem[]
    meterAtOpen?: number
  } | null

  const buildImportedWO = (): WorkOrder => {
    const items = importState?.items ?? []
    return {
      id:                "wo-traxxall-import",
      woNumber:          "WO-IMPORT",
      aircraftId:        importState?.aircraftId ?? null,
      guestRegistration: importState?.guestRegistration ?? importState?.aircraftReg ?? null,
      guestSerial:       null,
      aircraft:          null,
      status:            "draft",
      woType:            importState?.woType ?? "Scheduled Maintenance — Traxxall Import",
      description:       importState?.description ?? null,
      priority:          "routine",
      openedBy:          null,
      openedByName:      "Traxxall Import",
      openedAt:          new Date().toISOString(),
      closedAt:          null,
      meterAtOpen:       importState?.meterAtOpen ?? null,
      meterAtClose:      null,
      discrepancyRef:    null,
      notes:             null,
      mechanics:         [],
      items,
      statusHistory:     [{
        id: "sh-import-0", workOrderId: "wo-traxxall-import",
        fromStatus: null, toStatus: "draft",
        changedBy: null, changedAt: new Date().toISOString(),
        notes: `Auto-created from Traxxall basket export — ${items.length} tasks imported`,
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  const importedSections = importState?.items
    ? [...new Set(importState.items.map(i => i.logbookSection))] as LogbookSection[]
    : null

  const [wo, setWO] = useState<WorkOrder | null>(
    id === "wo-traxxall-import" ? buildImportedWO() : null
  )
  const [loading, setLoading] = useState(id !== "wo-traxxall-import")
  const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([])
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [notes, setNotes] = useState("")
  const [activeTab, setActiveTab] = useState<"items" | "history" | "notes" | "logbook" | "invoice">("items")
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [visibleSections, setVisibleSections] = useState<LogbookSection[]>(
    importedSections ?? ["Airframe", "Engine 1", "Propeller"]
  )
  const [draftLogbookEntries, setDraftLogbookEntries] = useState<LogbookEntry[]>([])
  const [logbookDraftError, setLogbookDraftError] = useState<string | null>(null)
  // Editable fields for each draft logbook entry (keyed by entry id)
  const [lbEdits, setLbEdits] = useState<Record<string, { returnToService: string; aircraftTime: string; hobbs: string; landings: string }>>({})
  const logbookPrintRef = useRef<HTMLDivElement>(null)
  const invoicePrintRef = useRef<HTMLDivElement>(null)
  const [pdfExporting, setPdfExporting] = useState<"logbook" | "invoice" | null>(null)

  async function handleDownloadPdf(type: "logbook" | "invoice", woNumber: string) {
    const ref = type === "logbook" ? logbookPrintRef : invoicePrintRef
    if (!ref.current) return
    setPdfExporting(type)
    try {
      await downloadPdf(ref.current, `${woNumber}-${type}.pdf`)
    } finally {
      setPdfExporting(null)
    }
  }

  const RTS_BOILERPLATE = "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 135.411(a)(1), Part 91.409(f)(3), and Part 43, and is approved for return to service in respect to that work performed."

  function lbEdit(entryId: string) {
    return lbEdits[entryId] ?? { returnToService: RTS_BOILERPLATE, aircraftTime: "", hobbs: "", landings: "" }
  }
  function setLbField(entryId: string, field: "returnToService" | "aircraftTime" | "hobbs" | "landings", value: string) {
    setLbEdits(prev => ({ ...prev, [entryId]: { ...lbEdit(entryId), [field]: value } }))
  }

  const loadWO = useCallback(async () => {
    if (!id || id === "wo-traxxall-import") return
    try {
      const data = await getWorkOrderById(id)
      setWO(data)
      setNotes(data?.notes ?? "")
      setSelectedItemId(s => s ?? data?.items[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadDraftLogbookEntries = useCallback(async () => {
    if (!id || id === "wo-traxxall-import") return
    const entries = await getLogbookEntries({ workOrderId: id, status: "draft" })
    setDraftLogbookEntries(entries)
    // Seed editable fields from DB values (don't overwrite if user is mid-edit)
    setLbEdits(prev => {
      const next = { ...prev }
      entries.forEach(e => {
        if (!next[e.id]) {
          next[e.id] = {
            returnToService: e.returnToService || RTS_BOILERPLATE,
            aircraftTime: e.totalAircraftTime?.toString() ?? "",
            hobbs: e.hobbs?.toString() ?? "",
            landings: e.landings?.toString() ?? "",
          }
        }
      })
      return next
    })
  }, [id])

  useEffect(() => {
    loadWO()
    loadDraftLogbookEntries()
    // Load supporting data in parallel
    Promise.all([getParts(), getTechnicians()])
      .then(([parts, techs]) => { setInventoryParts(parts); setMechanics(techs) })
      .catch(() => {})
  }, [loadWO, loadDraftLogbookEntries])

  const [addingToSection, setAddingToSection] = useState<LogbookSection | null>(null)
  const [newItem, setNewItem] = useState({
    category: "", taskNumber: "", discrepancy: "", correctiveAction: "",
    hours: "", laborRate: "125", shippingCost: "0", outsideServicesCost: "0",
  })
  const [addingPartToItem, setAddingPartToItem] = useState<string | null>(null)
  const [newPart, setNewPart] = useState({ partNumber: "", description: "", qty: "1", unitPrice: "" })
  const [addingLaborToItem, setAddingLaborToItem] = useState<string | null>(null)
  const [newLabor, setNewLabor] = useState({ mechName: "", hours: "", date: new Date().toISOString().slice(0, 10) })

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        <span className="text-white/40 text-sm">Loading work order…</span>
      </div>
    )
  }

  if (!wo) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40">Work order not found.</p>
        <Button variant="ghost" onClick={() => navigate("/app/beet-box/work-orders")} className="text-white/50">
          ← Back to Work Orders
        </Button>
      </div>
    )
  }

  const aircraft      = wo.aircraft
  const isLocked      = wo.status === "completed" || wo.status === "void"

  const totalLabor    = wo.items.reduce((s, i) => s + itemLaborTotal(i), 0)
  const totalParts    = wo.items.reduce((s, i) => s + itemPartsTotal(i), 0)
  const totalShipping = wo.items.reduce((s, i) => s + i.shippingCost, 0)
  const totalOutside  = wo.items.reduce((s, i) => s + i.outsideServicesCost, 0)
  const shopSupplies  = totalLabor * SHOP_SUPPLIES_RATE
  const grandTotal    = totalLabor + totalParts + totalShipping + totalOutside + shopSupplies
  const totalHours    = wo.items.reduce((s, i) => s + i.estimatedHours, 0)

  const itemsDone       = wo.items.filter(i => i.itemStatus === "done").length
  const itemsInProgress = wo.items.filter(i => i.itemStatus === "in_progress").length
  const itemsReview     = wo.items.filter(i => i.itemStatus === "needs_review").length

  const selectedItem = wo.items.find(i => i.id === selectedItemId) ?? null

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Optimistic local patch (for UI responsiveness) — followed by a db call + reload
  function patchItem(itemId: string, patch: Partial<WOItem>) {
    if (isLocked) return
    setWO(prev => prev ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, ...patch } : i) } : prev)
  }

  // Persist specific fields to DB without a full refetch (no loadWO → no data wipe)
  async function persistItemFields(itemId: string, fields: Partial<WOItem>) {
    if (isLocked) return
    try {
      await updateWOItemFields(itemId, {
        ...(fields.discrepancy         !== undefined && { discrepancy: fields.discrepancy }),
        ...(fields.correctiveAction    !== undefined && { correctiveAction: fields.correctiveAction }),
        ...(fields.estimatedHours      !== undefined && { estimatedHours: fields.estimatedHours }),
        ...(fields.laborRate           !== undefined && { laborRate: fields.laborRate }),
        ...(fields.shippingCost        !== undefined && { shippingCost: fields.shippingCost }),
        ...(fields.outsideServicesCost !== undefined && { outsideServicesCost: fields.outsideServicesCost }),
        ...(fields.itemStatus          !== undefined && { itemStatus: fields.itemStatus }),
        ...(fields.noPartsRequired     !== undefined && { noPartsRequired: fields.noPartsRequired }),
        ...(fields.signOffRequired     !== undefined && { signOffRequired: fields.signOffRequired }),
      })
    } catch (err) {
      console.error("Failed to save item fields:", err)
    }
  }

  async function removeLaborEntry(itemId: string, laborId: string) {
    if (isLocked) return
    patchItem(itemId, { labor: (wo?.items.find(i => i.id === itemId)?.labor ?? []).filter(e => e.id !== laborId) })
    await deleteLabor(laborId)
  }

  async function removePartEntry(itemId: string, partId: string) {
    if (isLocked) return
    patchItem(itemId, { parts: (wo?.items.find(i => i.id === itemId)?.parts ?? []).filter(p => p.id !== partId) })
    await removeItemPart(partId)
  }

  async function toggleSignOff(itemId: string) {
    if (isLocked || !wo) return
    const item = wo.items.find(i => i.id === itemId)
    if (!item) return
    if (item.signedOffBy) {
      // Unsign — only touch sign-off fields, never overwrite other item data
      patchItem(itemId, { signedOffBy: null, signedOffAt: null, itemStatus: "done" })
      await clearSignOff(itemId)
    } else {
      // Flush any unsaved text to DB before sign-off so loadWO() doesn't wipe it
      await updateWOItemFields(itemId, {
        discrepancy: item.discrepancy,
        correctiveAction: item.correctiveAction,
      })
      const profileId = await getMyProfileId()
      await signOffItem(itemId, profileId ?? "")
      await loadWO()

      // Auto-draft logbook entry for this section (one per section per WO)
      if (profileId && id && id !== "wo-traxxall-import") {
        try {
          const tech = mechanics.find(m => m.id === profileId)
          const entry = await getOrCreateDraftLogbookEntry(
            { id: wo.id, woNumber: wo.woNumber, aircraftId: wo.aircraftId, guestRegistration: wo.guestRegistration, guestSerial: wo.guestSerial },
            item.logbookSection
          )
          const signatory = await upsertEntrySignatory(entry.id, {
            profileId,
            mechanicName: tech?.name ?? "Unknown",
            certType: tech?.certType ?? null,
            certNumber: tech?.certNumber ?? null,
          })
          const lineText = [
            item.taskNumber?.trim(),
            item.correctiveAction?.trim() || item.category,
          ].filter(Boolean).join(" ")
          await addSignatoryLine(entry.id, lineText, signatory.id, item.id)
          await loadDraftLogbookEntries()
        } catch (err: any) {
          console.error("Logbook draft creation failed:", err)
          // Non-fatal — sign-off succeeded, logbook draft is best-effort
          // Surface the error in the logbook tab so it's visible
          setLogbookDraftError(err?.message ?? "Failed to create logbook draft")
        }
      }
    }
  }

  async function addItem(section: LogbookSection) {
    if (!newItem.category || !wo) return
    const savedItem = await upsertWOItem({
      workOrderId: wo.id,
      itemNumber: wo.items.length + 1,
      category: newItem.category,
      logbookSection: section,
      taskNumber: newItem.taskNumber || null,
      discrepancy: newItem.discrepancy,
      correctiveAction: newItem.correctiveAction,
      estimatedHours: parseFloat(newItem.hours) || 0,
      laborRate: parseFloat(newItem.laborRate) || 125,
      shippingCost: parseFloat(newItem.shippingCost) || 0,
      outsideServicesCost: parseFloat(newItem.outsideServicesCost) || 0,
      signOffRequired: true,
      itemStatus: "pending",
    })
    setWO(prev => prev ? { ...prev, items: [...prev.items, savedItem] } : prev)
    setSelectedItemId(savedItem.id)
    setNewItem({ category: "", taskNumber: "", discrepancy: "", correctiveAction: "", hours: "", laborRate: "125", shippingCost: "0", outsideServicesCost: "0" })
    setAddingToSection(null)
  }

  async function addPart(itemId: string) {
    if (!newPart.partNumber || !newPart.unitPrice) return
    const saved = await addItemPart(itemId, {
      partNumber: newPart.partNumber,
      description: newPart.description,
      qty: parseFloat(newPart.qty) || 1,
      unitPrice: parseFloat(newPart.unitPrice) || 0,
    })
    patchItem(itemId, { parts: [...(wo.items.find(i => i.id === itemId)?.parts ?? []), saved] })
    setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" })
    setAddingPartToItem(null)
  }

  async function addLaborEntry(itemId: string) {
    if (!newLabor.mechName || !newLabor.hours || !wo) return
    const profileId = await getMyProfileId()
    const saved = await clockLabor({
      itemId,
      workOrderId: wo.id,
      mechanicId: profileId ?? null,
      mechanicName: newLabor.mechName,
      hours: parseFloat(newLabor.hours) || 0,
      clockedAt: new Date(newLabor.date).toISOString(),
      description: null,
      billable: true,
    })
    const item = wo.items.find(i => i.id === itemId)
    if (item) {
      const newTotal = (item.labor ?? []).reduce((s, e) => s + e.hours, 0) + saved.hours
      patchItem(itemId, { labor: [...(item.labor ?? []), saved], estimatedHours: newTotal })
    }
    setNewLabor({ mechName: "", hours: "", date: new Date().toISOString().slice(0, 10) })
    setAddingLaborToItem(null)
  }

  async function advanceStatus() {
    if (!wo) return
    const next = NEXT_STATUS[wo.status]
    if (!next) return
    if (next === "completed") { setShowCompleteModal(true); return }
    const profileId = await getMyProfileId()
    await updateWorkOrderStatus(wo.id, next, profileId ?? "", `Advanced to ${WO_STATUS_LABELS[next]}`)
    await loadWO()
  }

  async function regressStatus() {
    if (!wo) return
    const prev = PREV_STATUS[wo.status]
    if (!prev) return
    const profileId = await getMyProfileId()
    await updateWorkOrderStatus(wo.id, prev, profileId ?? "", `Returned to ${WO_STATUS_LABELS[prev]}`)
    await loadWO()
  }

  function completeAndGenerate() { setShowCompleteModal(false); navigate("/app/beet-box/logbook/new?wo=" + wo!.id) }

  async function completeOnly() {
    if (!wo) return
    setShowCompleteModal(false)
    const profileId = await getMyProfileId()
    await updateWorkOrderStatus(wo.id, "completed", profileId ?? "", "Work order completed and closed.")
    await loadWO()
  }

  function showSection(s: LogbookSection) {
    if (!visibleSections.includes(s)) setVisibleSections(v => [...v, s])
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* ── COMPACT HEADER ───────────────────────────────────────────────────── */}
      <div
        className="px-6 py-3 flex items-center justify-between flex-shrink-0"
        style={{
          background: "linear-gradient(to right, hsl(0,0%,11%), hsl(0,0%,10%))",
          borderBottom: "1px solid hsl(0,0%,18%)",
          borderTop: "3px solid var(--skyshare-gold)",
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/beet-box/work-orders")}
            className="text-white/40 hover:text-white/80 transition-colors p-1 rounded"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span
                className="text-white text-xl font-bold tracking-wide"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {wo.woNumber}
              </span>
              <WOStatusBadge status={wo.status} />
              <PriorityBadge priority={wo.priority} />
            </div>
            <p className="text-white/45 text-sm">{wo.woType}</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-center">
            <div className="text-white/35 text-xs uppercase tracking-wider">Aircraft</div>
            <div className="font-bold text-sm" style={{ color: "var(--skyshare-gold)" }}>{aircraft?.registration ?? wo.guestRegistration ?? "—"}</div>
          </div>
          <div className="text-center">
            <div className="text-white/35 text-xs uppercase tracking-wider">Opened</div>
            <div className="text-white/70 text-sm">{fmtDate(wo.openedAt)}</div>
          </div>
          <div className="text-center">
            <div className="text-white/35 text-xs uppercase tracking-wider">Items</div>
            <div className="text-white font-semibold text-sm">
              {wo.items.length} <span className="text-white/40 font-normal">({totalHours.toFixed(1)} hrs)</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-white/35 text-xs uppercase tracking-wider">Est. Total</div>
            <div className="text-white font-bold">${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
          {(itemsDone > 0 || itemsInProgress > 0 || itemsReview > 0) && (
            <div className="flex items-center gap-3 text-sm">
              {itemsDone > 0       && <span className="text-emerald-400">✓ {itemsDone}</span>}
              {itemsInProgress > 0 && <span className="text-blue-400">● {itemsInProgress}</span>}
              {itemsReview > 0     && <span className="text-amber-400">⚠ {itemsReview}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── TAB BAR ──────────────────────────────────────────────────────────── */}
      <div
        className="px-4 flex items-center flex-shrink-0 gap-1"
        style={{ background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,18%)" }}
      >
        {[
          { id: "items"   as const, label: "Work Items",     icon: FileText   },
          { id: "history" as const, label: "Status History", icon: Clock      },
          { id: "notes"   as const, label: "Notes",          icon: StickyNote },
          { id: "logbook" as const, label: "Logbook Entry",  icon: BookOpen   },
          { id: "invoice" as const, label: "Invoice",        icon: Receipt    },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all rounded-t-md border-b-2 -mb-px",
                isActive
                  ? "text-white border-[var(--skyshare-gold)]"
                  : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.04]"
              )}
              style={isActive ? {
                background: "linear-gradient(to bottom, rgba(212,160,23,0.08), transparent)",
              } : {}}
            >
              <Icon className={cn("w-4 h-4", isActive && "text-[var(--skyshare-gold)]")} />
              {tab.label}
              {tab.id === "logbook" && draftLogbookEntries.length > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold leading-none"
                  style={{ background: "rgba(52,211,153,0.2)", color: "#34d399" }}
                >
                  {draftLogbookEntries.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* ── ITEMS TAB: SPLIT PANEL ──────────────────────────────────────── */}
        {activeTab === "items" && (
          <>
            {/* ── Left rail: always visible ── */}
            <div
              className="w-72 flex-shrink-0 overflow-y-auto"
              style={{ background: "hsl(0,0%,10.5%)", borderRight: "1px solid hsl(0,0%,18%)" }}
            >
              {visibleSections.map(section => {
                const sectionItems = wo.items.filter(i => i.logbookSection === section)
                const color = SECTION_COLORS[section]
                return (
                  <div key={section}>
                    <div
                      className="px-4 py-2.5 flex items-center justify-between sticky top-0 z-10"
                      style={{
                        background: `linear-gradient(to right, ${color}18, hsl(0,0%,11%))`,
                        borderBottom: "1px solid hsl(0,0%,18%)",
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <span className="text-sm font-bold uppercase tracking-widest" style={{ color }}>{section}</span>
                      <span className="text-white/40 text-xs font-mono">{sectionItems.length}</span>
                    </div>

                    {sectionItems.map(item => {
                      const cfg = ITEM_STATUS_CONFIG[item.itemStatus ?? "pending"]
                      const Icon = cfg.icon
                      const isSelected = selectedItemId === item.id
                      return (
                        <button
                          key={item.id}
                          onClick={() => { setSelectedItemId(item.id); setAddingToSection(null) }}
                          style={isSelected ? {
                            background: "linear-gradient(to right, rgba(212,160,23,0.12), rgba(212,160,23,0.03))",
                            borderLeft: "3px solid var(--skyshare-gold)",
                          } : {}}
                          className={cn(
                            "w-full text-left px-4 py-3 flex items-center gap-3 transition-all border-l-[3px]",
                            isSelected
                              ? "border-l-transparent"
                              : "border-l-transparent hover:bg-white/[0.04]"
                          )}
                        >
                          <Icon className={cn("w-4 h-4 flex-shrink-0", cfg.color)} />
                          <span className={cn(
                            "text-sm flex-1 truncate leading-snug",
                            isSelected ? "text-white font-medium" : "text-white/65"
                          )}>
                            {item.category}
                          </span>
                          {item.signOffRequired && (
                            <div
                              className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", item.signedOffBy ? "bg-emerald-500" : "bg-white/15")}
                              title={item.signedOffBy ? "Signed off" : "Sign-off required"}
                            />
                          )}
                        </button>
                      )
                    })}

                    {sectionItems.length === 0 && (
                      <p className="px-4 py-2 text-white/20 text-xs italic">No items</p>
                    )}

                    {!isLocked && (
                      <button
                        onClick={() => { setAddingToSection(addingToSection === section ? null : section); setSelectedItemId(null) }}
                        className="w-full text-left px-4 py-2 flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add item
                      </button>
                    )}
                  </div>
                )
              })}

              {ALL_SECTIONS.filter(s => !visibleSections.includes(s)).length > 0 && (
                <div className="px-4 pt-3 pb-4 mt-1" style={{ borderTop: "1px solid hsl(0,0%,16%)" }}>
                  <p className="text-white/25 text-xs mb-2">Add section:</p>
                  {ALL_SECTIONS.filter(s => !visibleSections.includes(s)).map(s => (
                    <button
                      key={s}
                      onClick={() => showSection(s)}
                      className="block w-full text-left text-sm text-white/35 hover:text-white/70 py-1.5 px-2 rounded hover:bg-white/[0.05] transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right panel: item detail / add form / empty state */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {selectedItem && !addingToSection ? (
                <ItemDetailPanel
                  item={selectedItem}
                  isLocked={isLocked}
                  sectionColor={SECTION_COLORS[selectedItem.logbookSection]}
                  onPatch={patch => patchItem(selectedItem.id, patch)}
                  onPersist={fields => persistItemFields(selectedItem.id, fields)}
                  onSignOff={() => toggleSignOff(selectedItem.id)}
                  onDeleteLabor={id => removeLaborEntry(selectedItem.id, id)}
                  onDeletePart={id => removePartEntry(selectedItem.id, id)}
                  mechanics={mechanics}
                  inventoryParts={inventoryParts}
                  onNavigatePO={() => navigate("/app/beet-box/purchase-orders")}
                  addingPartToItem={addingPartToItem}
                  setAddingPartToItem={setAddingPartToItem}
                  newPart={newPart}
                  setNewPart={setNewPart}
                  onAddPart={() => addPart(selectedItem.id)}
                  addingLaborToItem={addingLaborToItem}
                  setAddingLaborToItem={setAddingLaborToItem}
                  newLabor={newLabor}
                  setNewLabor={setNewLabor}
                  onAddLabor={() => addLaborEntry(selectedItem.id)}
                />
              ) : addingToSection ? (
                /* ── Add item form ── */
                <div className="p-8 max-w-2xl">
                  <h3 className="text-white text-xl font-bold mb-6">
                    Add Item — <span style={{ color: SECTION_COLORS[addingToSection] }}>{addingToSection}</span>
                  </h3>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-white/50 text-sm block mb-1.5">Task Name *</label>
                        <input
                          className="w-full px-4 py-3 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                          placeholder="e.g. 14-Day Service Check"
                          value={newItem.category}
                          onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-white/50 text-sm block mb-1.5">Task # / ATA Code <span className="text-white/30">(optional)</span></label>
                        <input
                          className="w-full px-4 py-3 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                          placeholder="e.g. 05-20-00"
                          value={newItem.taskNumber}
                          onChange={e => setNewItem(n => ({ ...n, taskNumber: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-white/50 text-sm block mb-1.5">Task / Discrepancy</label>
                      <textarea
                        className="w-full px-4 py-3 rounded-lg text-base bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-white/30 leading-relaxed"
                        rows={3} placeholder="What was found or needs to be done…"
                        value={newItem.discrepancy}
                        onChange={e => setNewItem(n => ({ ...n, discrepancy: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-white/50 text-sm block mb-1.5">
                        Work Performed <span className="text-white/30">(can fill in later)</span>
                      </label>
                      <textarea
                        className="w-full px-4 py-3 rounded-lg text-base bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-white/30 leading-relaxed"
                        rows={3} placeholder="What was done to correct it…"
                        value={newItem.correctiveAction}
                        onChange={e => setNewItem(n => ({ ...n, correctiveAction: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Hours",        key: "hours" as const,              placeholder: "0.0"  },
                        { label: "Labor Rate $", key: "laborRate" as const,          placeholder: "125"  },
                        { label: "Shipping $",   key: "shippingCost" as const,       placeholder: "0.00" },
                        { label: "Outside Svcs $",key: "outsideServicesCost" as const,placeholder: "0.00"},
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-white/50 text-xs block mb-1.5">{f.label}</label>
                          <input
                            type="number" step="0.5"
                            className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                            placeholder={f.placeholder}
                            value={(newItem as any)[f.key]}
                            onChange={e => setNewItem(n => ({ ...n, [f.key]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={() => addItem(addingToSection!)}
                        disabled={!newItem.category}
                        style={{ background: "var(--skyshare-gold)", color: "#000" }}
                        className="font-bold h-11 px-6 text-sm"
                      >
                        Add Item
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setAddingToSection(null)}
                        className="text-white/40 h-11 px-5 text-sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Empty state ── */
                <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20 select-none">
                  <FileText className="w-14 h-14" />
                  <p className="text-lg">Select a work item from the list</p>
                  <p className="text-sm">or click "Add item" under any section</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── HISTORY TAB ────────────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
            <div className="relative pl-7">
              <div className="absolute left-2.5 top-1 bottom-1 w-px bg-white/10" />
              <div className="space-y-7">
                {[...wo.statusHistory].reverse().map((sh, idx) => (
                  <div key={sh.id} className="relative">
                    <div
                      className="absolute -left-5 top-1.5 w-3 h-3 rounded-full"
                      style={{ background: idx === 0 ? "var(--skyshare-gold)" : "hsl(0,0%,30%)" }}
                    />
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {sh.fromStatus && (
                            <><WOStatusBadge status={sh.fromStatus} /><ChevronRight className="w-4 h-4 text-white/30" /></>
                          )}
                          <WOStatusBadge status={sh.toStatus} />
                        </div>
                        <p className="text-white/60 text-sm mt-2">{sh.notes}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white/60 text-sm font-medium">{sh.changedBy}</p>
                        <p className="text-white/35 text-sm">
                          {new Date(sh.changedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── NOTES TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "notes" && (
          <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
            <p className="text-white/50 text-sm font-bold uppercase tracking-widest mb-3">Work Order Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={12}
              disabled={isLocked}
              placeholder="Add notes about this work order…"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white text-base leading-relaxed resize-none focus:outline-none focus:border-white/25 placeholder:text-white/20 disabled:opacity-50"
            />
            {!isLocked && (
              <Button
                className="mt-3 h-10 px-5 font-semibold text-sm"
                style={{ background: "var(--skyshare-gold)", color: "#000" }}
              >
                Save Notes
              </Button>
            )}
          </div>
        )}

        {/* ── LOGBOOK ENTRY TAB ──────────────────────────────────────────────── */}
        {activeTab === "logbook" && (
          <div className="flex-1 overflow-y-auto" style={{ background: "hsl(0,0%,14%)" }}>
            {/* Toolbar above paper */}
            <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid hsl(0,0%,20%)" }}>
              <div className="flex items-center gap-3">
                {logbookDraftError && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(239,68,68,0.9)" }}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{logbookDraftError}</span>
                    <button onClick={() => setLogbookDraftError(null)} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
              {draftLogbookEntries.length > 0 && (
                <Button
                  size="sm" variant="ghost"
                  disabled={pdfExporting === "logbook"}
                  onClick={() => handleDownloadPdf("logbook", wo.woNumber)}
                  className="flex items-center gap-2 text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 h-8 px-3 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  {pdfExporting === "logbook" ? "Exporting…" : "Download PDF"}
                </Button>
              )}
            </div>

            {draftLogbookEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/25">
                <BookOpen className="w-12 h-12" />
                <p className="text-lg">No logbook entries yet</p>
                <p className="text-sm text-center max-w-xs">Draft entries appear automatically as items are signed off.</p>
              </div>
            ) : (
              <div ref={logbookPrintRef} className="py-8 px-6 space-y-8" style={{ background: "hsl(0,0%,14%)" }}>
                {draftLogbookEntries.map(entry => {
                  const edits  = lbEdit(entry.id)
                  const reg    = wo.aircraft?.registration ?? wo.guestRegistration ?? ""
                  const make   = wo.aircraft?.make ?? ""
                  const model  = wo.aircraft?.modelFull ?? ""
                  const serial = wo.aircraft?.serialNumber ?? wo.guestSerial ?? ""
                  const rts    = edits.returnToService || "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 135.411(a)(1), Part 91.409(f)(3), and Part 43, and is approved for return to service in respect to that work performed."

                  return (
                    <div
                      key={entry.id}
                      className="mx-auto rounded shadow-2xl overflow-hidden"
                      style={{ maxWidth: "720px", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif" }}
                    >
                      {/* ── Top bar ── */}
                      <div className="flex justify-between items-center px-4 py-1.5 text-xs border-b border-gray-300" style={{ borderTop: "2px solid #555" }}>
                        <span style={{ fontWeight: 600 }}>{wo.woNumber} ({entry.entryDate})</span>
                        <span>Page 1 / 1</span>
                      </div>

                      {/* ── Three-column header ── */}
                      <div className="grid grid-cols-3 border-b border-gray-300" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                        {/* Left: aircraft */}
                        <div className="px-4 py-3 text-xs border-r border-gray-300">
                          {[
                            { label: "MAKE",    value: make   || "—" },
                            { label: "MODEL",   value: model  || "—" },
                            { label: "S/N",     value: serial || "—" },
                            { label: "REG. NO", value: reg    || "—" },
                          ].map(r => (
                            <div key={r.label} className="flex gap-1 leading-5">
                              <span style={{ fontWeight: 700, minWidth: "52px" }}>{r.label}:</span>
                              <span>{r.value}</span>
                            </div>
                          ))}
                        </div>
                        {/* Center: company */}
                        <div className="px-4 py-3 flex flex-col items-center justify-center text-center border-r border-gray-300">
                          <p className="text-sm font-bold leading-tight" style={{ color: "#111" }}>CB Aviation, Inc.</p>
                          <p className="text-xs" style={{ color: "#555" }}>dba SkyShare</p>
                          <p className="text-xs mt-1" style={{ color: "#555" }}>3715 Airport Rd.</p>
                          <p className="text-xs" style={{ color: "#555" }}>Ogden, UT 84116</p>
                        </div>
                        {/* Right: WO info + editable times */}
                        <div className="px-4 py-3 text-xs">
                          {[
                            { label: "W/O #",    value: wo.woNumber },
                            { label: "DATE",     value: entry.entryDate },
                          ].map(r => (
                            <div key={r.label} className="flex gap-1 leading-5">
                              <span style={{ fontWeight: 700, minWidth: "60px" }}>{r.label}:</span>
                              <span>{r.value}</span>
                            </div>
                          ))}
                          {/* Editable A/C TT, Landings, Hobbs — inline inputs styled to look like document fields */}
                          {([
                            { label: "A/C TT",   field: "aircraftTime" as const, dbField: "totalAircraftTime" as const, step: "0.1" },
                            { label: "Landings", field: "landings"     as const, dbField: "landings"          as const, step: "1"   },
                            { label: "Hobbs",    field: "hobbs"        as const, dbField: "hobbs"             as const, step: "0.1" },
                          ]).map(f => (
                            <div key={f.field} className="flex gap-1 items-center leading-5">
                              <span style={{ fontWeight: 700, minWidth: "60px" }}>{f.label}:</span>
                              <input
                                type="number" step={f.step} placeholder="___"
                                value={edits[f.field]}
                                onChange={e => setLbField(entry.id, f.field, e.target.value)}
                                onBlur={e => {
                                  const v = e.target.value === "" ? undefined : parseFloat(e.target.value)
                                  updateLogbookEntry(entry.id, { [f.dbField]: v }).catch(console.error)
                                }}
                                style={{
                                  width: "72px", border: "none", borderBottom: "1px solid #aaa",
                                  background: "transparent", fontSize: "12px", outline: "none",
                                  color: "#111", padding: "0 2px",
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Section header ── */}
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-sm font-bold underline" style={{ color: "#111" }}>
                          {entry.sectionTitle || `${entry.logbookSection} Entries`}
                        </p>
                      </div>

                      {/* ── Numbered entry lines ── */}
                      <div className="px-4 pb-3">
                        {entry.lines.length === 0 ? (
                          <p className="text-xs italic mt-2" style={{ color: "#999" }}>
                            No entries yet — sign off work order items to populate this logbook page.
                          </p>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <tbody>
                              {entry.lines.map(line => (
                                <tr key={line.id} style={{ verticalAlign: "top" }}>
                                  <td style={{ paddingRight: "10px", paddingTop: "3px", width: "20px", textAlign: "right", color: "#555", whiteSpace: "nowrap", fontWeight: 600 }}>
                                    {line.lineNumber}
                                  </td>
                                  <td style={{ paddingTop: "3px", lineHeight: "1.5", color: "#111" }}>
                                    {line.text}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* ── Return to service cert ── */}
                      <div className="px-4 pb-3 pt-2">
                        <p className="text-xs leading-relaxed" style={{ color: "#111" }}>{rts}</p>
                      </div>

                      {/* ── Signature blocks ── */}
                      {(entry.signatories.length > 0 ? entry.signatories : [null]).map((sig, si) => (
                        <div
                          key={sig?.id ?? "blank"}
                          className="px-4 pb-4 pt-1"
                          style={{ borderTop: si > 0 ? "1px dashed #ccc" : "none" }}
                        >
                          <div className="flex items-end justify-between">
                            <div className="flex items-end gap-6 text-xs">
                              <div>
                                <span style={{ fontWeight: 700 }}>DATE: </span>
                                <span style={{ borderBottom: "1px solid #555", paddingBottom: "1px", minWidth: "90px", display: "inline-block" }}>
                                  {entry.entryDate}
                                </span>
                              </div>
                              <div>
                                <span style={{ fontWeight: 700 }}>SIGNED: </span>
                                <span style={{ borderBottom: "1px solid #555", minWidth: "160px", display: "inline-block", paddingBottom: "1px" }}>&nbsp;</span>
                              </div>
                            </div>
                            <div className="text-xs text-right" style={{ color: "#555" }}>
                              <p>WORK ORDER: {wo.woNumber}</p>
                              <p>Printed by SkyShare MX</p>
                            </div>
                          </div>
                          {sig && (
                            <div className="mt-1 text-xs" style={{ marginLeft: "100px", color: "#111" }}>
                              <p style={{ fontWeight: 600 }}>{sig.mechanicName}</p>
                              {sig.certType && (
                                <p>{sig.certType} Number: {sig.certNumber ?? ""}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── INVOICE TAB ────────────────────────────────────────────────────── */}
        {activeTab === "invoice" && (() => {
          const laborTotal    = wo.items.reduce((s, i) => s + itemLaborTotal(i), 0)
          const partsTotal    = wo.items.reduce((s, i) => s + itemPartsTotal(i), 0)
          const shippingTotal = wo.items.reduce((s, i) => s + i.shippingCost, 0)
          const outsideTotal  = wo.items.reduce((s, i) => s + i.outsideServicesCost, 0)
          const shopSupplies  = Math.round(laborTotal * SHOP_SUPPLIES_RATE * 100) / 100
          const taxOnLabor    = Math.round(laborTotal * 0.0725 * 100) / 100
          const taxOnSupplies = Math.round(shopSupplies * 0.0725 * 100) / 100
          const taxTotal      = taxOnLabor + taxOnSupplies
          const amountCharged = laborTotal + partsTotal + shippingTotal + outsideTotal + shopSupplies + taxTotal
          const reg    = wo.aircraft?.registration ?? wo.guestRegistration ?? "—"
          const make   = wo.aircraft?.make ?? ""
          const model  = wo.aircraft?.modelFull ?? ""
          const serial = wo.aircraft?.serialNumber ?? wo.guestSerial ?? "—"
          const fe     = draftLogbookEntries[0]
          const acTT   = fe ? (lbEdit(fe.id).aircraftTime || "") : ""
          const lngs   = fe ? (lbEdit(fe.id).landings    || "") : ""
          const hobbs  = fe ? (lbEdit(fe.id).hobbs       || "") : ""
          const $f     = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

          return (
            <div className="flex-1 overflow-y-auto" style={{ background: "hsl(0,0%,14%)" }}>

              {/* Toolbar */}
              <div className="flex items-center justify-end px-6 py-3" style={{ borderBottom: "1px solid hsl(0,0%,20%)" }}>
                <Button
                  size="sm" variant="ghost"
                  disabled={pdfExporting === "invoice"}
                  onClick={() => handleDownloadPdf("invoice", wo.woNumber)}
                  className="flex items-center gap-2 text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 h-8 px-3 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  {pdfExporting === "invoice" ? "Exporting…" : "Download PDF"}
                </Button>
              </div>

              {/* Paper */}
              <div className="py-8 px-6">
                <div
                  ref={invoicePrintRef}
                  className="mx-auto shadow-2xl"
                  style={{ maxWidth: "740px", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", lineHeight: "1.4" }}
                >

                  {/* ═══ PAGE 1 ═══ */}
                  <div style={{ padding: "20px 24px 0" }}>

                    {/* Top bar */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #111", paddingBottom: "4px", marginBottom: "12px" }}>
                      <span style={{ fontWeight: 700, fontSize: "13px" }}>Customer Invoice: {wo.woNumber}</span>
                      <span style={{ fontSize: "11px", color: "#666" }}>Printed by SkyShare MX (Pg. 1 / 2)</span>
                    </div>

                    {/* Logo + company left | aircraft + bill-to right */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "32px", marginBottom: "12px" }}>
                      {/* Left: logo + company */}
                      <div>
                        <div style={{ width: "44px", height: "44px", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                          <span style={{ color: "#fff", fontWeight: 900, fontSize: "24px", fontStyle: "italic" }}>S</span>
                        </div>
                        <p style={{ fontWeight: 700, fontSize: "13px", marginBottom: "2px" }}>CB Aviation, Inc.</p>
                        <p style={{ color: "#444" }}>dba SkyShare</p>
                        <p style={{ color: "#444" }}>3715 Airport Rd.</p>
                        <p style={{ color: "#444" }}>Ogden, UT 84116</p>
                        <p style={{ color: "#444" }}>Email: jstorey@skyshare.com</p>
                        <p style={{ color: "#444" }}>Phone: 801-621-0326</p>
                        <p style={{ color: "#444" }}>skyshare.com</p>
                      </div>
                      {/* Right: aircraft info + bill to */}
                      <div style={{ minWidth: "240px" }}>
                        <p>Date: {fmtDate(wo.openedAt)}</p>
                        <p>Reg. No.: {reg}{(make || model) ? ` (${[make, model].filter(Boolean).join(" ")})` : ""}</p>
                        <p>A/C Serial: {serial}</p>
                        <p>A/C TT: {acTT}</p>
                        <p>Landings: {lngs}</p>
                        <p>Hobbs: {hobbs}</p>
                        <p style={{ marginTop: "8px" }}>Bill to: — customer on file —</p>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #bbb", marginBottom: "0" }} />
                  </div>

                  {/* ── Per-item blocks ── */}
                  <div style={{ padding: "0 24px 16px" }}>
                    {wo.items.map((item) => {
                      const labor  = itemLaborTotal(item)
                      const parts  = itemPartsTotal(item)
                      const ship   = item.shippingCost
                      const out    = item.outsideServicesCost
                      const sub    = itemSubtotal(item)
                      const secLabel = item.logbookSection ? `-${item.logbookSection}` : ""
                      return (
                        <div key={item.id} style={{ marginTop: "10px" }}>
                          {/* Item header bar */}
                          <div style={{ background: "#e0e0e0", textAlign: "center", padding: "3px 8px", fontWeight: 700, borderTop: "1px solid #bbb", borderBottom: "1px solid #bbb" }}>
                            Item: {item.itemNumber}{secLabel}
                          </div>

                          {/* Discrepancy */}
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", marginTop: "4px" }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontWeight: 700 }}>Discrepancy</p>
                              <p>{item.discrepancy || item.category}</p>
                              {item.taskNumber   && <p>Task #: {item.taskNumber}</p>}
                              {item.partNumber   && <p>Part Number: {item.partNumber}</p>}
                              {item.serialNumber && <p>Serial Number: {item.serialNumber}</p>}
                            </div>
                            <div style={{ textAlign: "right", minWidth: "110px" }}>
                              <div style={{ display: "flex", gap: "20px", justifyContent: "flex-end", fontWeight: 700 }}>
                                <span>Hours</span><span>Subtotal</span>
                              </div>
                              <div style={{ display: "flex", gap: "20px", justifyContent: "flex-end" }}>
                                <span>{item.estimatedHours.toFixed(2)}</span>
                                <span>{$f(labor)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Corrective Action */}
                          <div style={{ marginTop: "4px" }}>
                            <p style={{ fontWeight: 700 }}>Corrective Action</p>
                            <p style={{ lineHeight: "1.5" }}>{item.correctiveAction || "—"}</p>
                          </div>

                          {/* Item Summary row */}
                          <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "#f0f0f0", padding: "3px 8px", marginTop: "6px", borderTop: "1px solid #ccc", borderBottom: "1px solid #ccc", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700 }}>Item Summary</span>
                            <span>Labor:&nbsp; {$f(labor)}</span>
                            <span>Parts:&nbsp; {$f(parts)}</span>
                            <span>Shipping:&nbsp; {$f(ship)}</span>
                            {out > 0 && <span>Outside Svcs:&nbsp; {$f(out)}</span>}
                            <span style={{ marginLeft: "auto", fontWeight: 700 }}>Item Subtotal:&nbsp; {$f(sub)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ═══ PAGE 2 (visual separator) ═══ */}
                  <div style={{ borderTop: "3px double #bbb", margin: "0 24px 0", paddingTop: "0" }} />
                  <div style={{ padding: "16px 24px 0" }}>

                    {/* Top bar pg 2 */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #111", paddingBottom: "4px", marginBottom: "14px" }}>
                      <span style={{ fontWeight: 700, fontSize: "13px" }}>Customer Invoice: {wo.woNumber}</span>
                      <span style={{ fontSize: "11px", color: "#666" }}>Printed by SkyShare MX (Pg. 2 / 2)</span>
                    </div>

                    {/* Totals: left notes | right column */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "32px", marginBottom: "20px" }}>
                      {/* Left */}
                      <div>
                        <p><strong>Shop Supplies:</strong> {$f(shopSupplies)}</p>
                        {taxTotal > 0 && (
                          <p style={{ marginTop: "4px" }}>
                            <strong>Tax Breakdown:</strong> Shop Labor = {taxOnLabor.toFixed(2)}, Shop Supplies = {taxOnSupplies.toFixed(2)}
                          </p>
                        )}
                      </div>
                      {/* Right: right-aligned totals column */}
                      <div style={{ textAlign: "right", minWidth: "260px" }}>
                        {[
                          { label: "Total Shop Labor:",  val: $f(laborTotal),    bold: false },
                          { label: "Total Parts:",        val: $f(partsTotal),    bold: false },
                          { label: "Total Shipping:",     val: $f(shippingTotal), bold: false },
                          { label: "Additional Charges:", val: $f(shopSupplies),  bold: false },
                          { label: "Tax:",                val: $f(taxTotal),      bold: false },
                          { label: "Amount Charged:",     val: $f(amountCharged), bold: false },
                          { label: "Amount Paid:",        val: "$0.00",           bold: false },
                          { label: "Amount Due:",         val: $f(amountCharged), bold: true  },
                        ].map(r => (
                          <div key={r.label} style={{ display: "flex", justifyContent: "flex-end", gap: "8px", fontWeight: r.bold ? 700 : 400 }}>
                            <span>{r.label}</span>
                            <span style={{ minWidth: "72px", textAlign: "right" }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Important Information */}
                    <div style={{ textAlign: "center", marginBottom: "16px" }}>
                      <p style={{ fontWeight: 700, marginBottom: "4px" }}>Important Information</p>
                      <p>Core fees may apply and the responsibility of the customer.</p>
                      <p>Credit card convenience fee of 3.5% applies to all invoices $1000.00 or more.</p>
                    </div>

                    <div style={{ borderTop: "1px solid #555", marginBottom: "10px" }} />

                    {/* Signature & Date */}
                    <p style={{ fontWeight: 700, paddingBottom: "24px" }}>Signature &amp; Date</p>
                  </div>

                </div>
              </div>
            </div>
          )
        })()}

      </div>

      {/* ── STATUS BAR ───────────────────────────────────────────────────────── */}
      {!isLocked && (NEXT_STATUS[wo.status] || PREV_STATUS[wo.status]) && (
        <div
          className="flex-shrink-0 px-6 py-3 flex items-center justify-between gap-4"
          style={{
            background: "linear-gradient(to top, hsl(0,0%,8%), hsl(0,0%,11%))",
            borderTop: "1px solid hsl(0,0%,22%)",
          }}
        >
          <div className="flex items-center gap-2 text-sm text-white/40">
            <span>Status:</span>
            <WOStatusBadge status={wo.status} />
            {NEXT_STATUS[wo.status] && (
              <><ChevronRight className="w-4 h-4" /><WOStatusBadge status={NEXT_STATUS[wo.status]!} /></>
            )}
          </div>
          <div className="flex items-center gap-3">
            {PREV_STATUS[wo.status] && (
              <Button
                variant="ghost" size="sm" onClick={regressStatus}
                className="text-white/40 hover:text-white/70 border border-white/10 h-9 px-4 text-sm"
              >
                ← Return to {WO_STATUS_LABELS[PREV_STATUS[wo.status]!]}
              </Button>
            )}
            {wo.status === "waiting_on_parts" && (
              <Button
                variant="ghost" size="sm"
                onClick={() => navigate("/app/beet-box/purchase-orders")}
                className="text-amber-400/80 hover:text-amber-300 border border-amber-900/30 h-9 px-4 text-sm"
              >
                View Purchase Orders
              </Button>
            )}
            {NEXT_STATUS[wo.status] && (
              <Button
                size="sm" onClick={advanceStatus}
                style={wo.status === "billing" ? { background: "var(--skyshare-gold)", color: "#000" } : {}}
                className={cn(
                  "font-bold h-10 px-6 text-sm",
                  wo.status !== "billing" && "bg-blue-700/40 hover:bg-blue-700/60 text-blue-100 border border-blue-800/40"
                )}
              >
                {NEXT_STATUS_LABEL[wo.status]}
              </Button>
            )}
          </div>
        </div>
      )}

      {isLocked && (
        <div
          className="flex-shrink-0 px-6 py-3 flex items-center gap-3"
          style={{ borderTop: "1px solid hsl(0,0%,18%)" }}
        >
          <WOStatusBadge status={wo.status} />
          <span className="text-white/35 text-sm">
            {wo.status === "completed"
              ? `Closed ${wo.closedAt ? fmtDate(wo.closedAt) : ""}`
              : "Work order is void"}
          </span>
          {wo.status === "completed" && (
            <Button
              variant="ghost"
              onClick={() => navigate("/app/beet-box/logbook")}
              className="text-white/50 hover:text-white/80 text-sm ml-2"
            >
              View Logbook →
            </Button>
          )}
        </div>
      )}

      {/* ── COMPLETE MODAL ───────────────────────────────────────────────────── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div
            className="rounded-2xl p-7 max-w-md w-full mx-4 space-y-5"
            style={{ background: "hsl(0,0%,13%)", border: "1px solid hsl(0,0%,22%)" }}
          >
            <h3
              className="text-white text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Complete Work Order
            </h3>
            <div className="stripe-divider" />
            <p className="text-white/70 leading-relaxed">
              Work order <span className="text-white font-bold">{wo.woNumber}</span> will be marked complete.
              Generate a logbook entry from this work order?
            </p>
            <div
              className="rounded-xl p-4 border border-white/[0.08] space-y-2"
              style={{ background: "hsl(0,0%,11%)" }}
            >
              <p className="text-white/40 uppercase tracking-widest text-xs mb-2">Logbook Entry Preview</p>
              <p className="text-white/75 text-sm"><span className="text-white/40">Aircraft:</span> {aircraft?.registration ?? wo.guestRegistration ?? "—"}{aircraft?.make ? ` — ${aircraft.make} ${aircraft.modelFull}` : ""}</p>
              <p className="text-white/75 text-sm"><span className="text-white/40">Sections:</span> {[...new Set(wo.items.map(i => i.logbookSection))].join(", ")}</p>
              <p className="text-white/75 text-sm"><span className="text-white/40">Items:</span> {wo.items.length} tasks · {totalHours.toFixed(1)} hrs total</p>
            </div>
            <Button
              onClick={completeAndGenerate}
              style={{ background: "var(--skyshare-gold)", color: "#000" }}
              className="w-full font-bold text-sm h-12"
            >
              Complete + Generate Logbook Entry
            </Button>
            <div className="flex gap-3">
              <Button
                variant="ghost" onClick={completeOnly}
                className="flex-1 text-white/60 hover:text-white border border-white/10 text-sm h-10"
              >
                Complete Without Logbook Entry
              </Button>
              <Button
                variant="ghost" onClick={() => setShowCompleteModal(false)}
                className="text-white/40 text-sm h-10"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
