import { useState, useRef, useMemo, useEffect, useCallback, Fragment } from "react"
import { createPortal } from "react-dom"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import {
  ArrowLeft, AlertTriangle, StickyNote, Check, ChevronRight, ChevronLeft,
  Plus, X, Clock, Package, Loader2,
  CheckCircle2, Circle, AlertCircle, Scissors, Eye,
  BookOpen, ShoppingCart, FileText, Receipt, Search, Warehouse, Download, ChevronsDown,
  ShieldCheck, Wrench, ChevronDown, Pencil, ArrowLeftRight,
  Library, Zap, BookText, Mail, GitBranch, Trash2,
} from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import { localToday } from "@/shared/lib/dates"
import {
  getWorkOrderById, updateWorkOrderStatus, updateWorkOrder,
  upsertWOItem, updateItemStatus, updateWOItemFields, signOffItem, clearSignOff,
  addItemPart, removeItemPart, issuePartFromInventory, clockLabor, deleteLabor,
  getParts, getTechnicians, getMyProfileId, getMyProfile, searchPartsLimited,
  getLogbookEntries, getOrCreateDraftLogbookEntry, createComponentInstallEntry, upsertEntrySignatory, addSignatoryLine, removeItemLogbookLines, updateLogbookEntry,
  addAuditEntry, deleteWorkOrder, deleteWOItem,
  upsertFlatRate, upsertCorrectiveAction,
  updateQuoteStatus, convertQuoteToWorkOrder,
  findDiscrepancy,
} from "../../services"
import { autoGenerateInvoice } from "../../services/automation"
import { WO_STATUS_LABELS, INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS } from "../../constants"
import type {
  WorkOrder, WOStatus, WOItem, WOItemPart,
  WOItemLabor, WOItemStatus, LogbookSection,
  InventoryPart, Mechanic, LogbookEntry, AuditEntry, AuditEntryType,
  AircraftTimesSnapshot, QuoteStatus,
} from "../../types"
import { TimesEditModal } from "./TimesEditModal"
import { SendForApprovalModal } from "./SendForApprovalModal"
import { ApprovalStatusStrip } from "./ApprovalStatusStrip"
import { FoundDiscrepancyModal } from "./FoundDiscrepancyModal"
import { CreateChangeOrderModal } from "./CreateChangeOrderModal"
import { ChangeOrdersPanel } from "./ChangeOrdersPanel"
import { PartsRequestForm } from "@/features/parts/components/PartsRequestForm"
import { STATUS_CONFIG, LINE_STATUS_CONFIG } from "@/features/parts/constants"
import { supabase } from "@/lib/supabase"
import { WOStatusBadge, QuoteStatusBadge } from "../../shared/StatusBadge"
import { useAuth } from "@/features/auth"
import { useBeetBoxTabs } from "../../BeetBoxTabsContext"

// ─── Status pipeline ──────────────────────────────────────────────────────────
const NEXT_STATUS: Partial<Record<WOStatus, WOStatus>> = {
  draft: "open", open: "in_review", waiting_on_parts: "open", in_review: "billing", billing: "completed",
}
const NEXT_STATUS_LABEL: Partial<Record<WOStatus, string>> = {
  draft: "Open Work Order", open: "Submit for Review",
  waiting_on_parts: "Parts Received — Resume", in_review: "Approve → Billing", billing: "Complete Work Order",
}
const PREV_STATUS: Partial<Record<WOStatus, WOStatus>> = {
  open: "draft", in_review: "open", billing: "in_review", completed: "billing",
}
const STATUS_GLOW_COLOR: Record<WOStatus, string> = {
  draft:            "rgba(161,161,170,0.55)",
  open:             "rgba(147,197,253,0.55)",
  waiting_on_parts: "rgba(252,211,77,0.55)",
  in_review:        "rgba(216,180,254,0.55)",
  billing:          "rgba(253,186,116,0.55)",
  completed:        "rgba(110,231,183,0.55)",
  void:             "rgba(252,165,165,0.55)",
}

// ─── Quote status pipeline ────────────────────────────────────────────────────
const QUOTE_NEXT_STATUS: Partial<Record<QuoteStatus, QuoteStatus>> = {
  draft: "sent", sent: "approved",
}
const QUOTE_NEXT_STATUS_LABEL: Partial<Record<QuoteStatus, string>> = {
  draft: "Mark as Sent", sent: "Mark Approved",
}
const QUOTE_PREV_STATUS: Partial<Record<QuoteStatus, QuoteStatus>> = {
  sent: "draft", approved: "sent", declined: "sent", expired: "sent",
}
const QUOTE_STATUS_GLOW_COLOR: Record<QuoteStatus, string> = {
  draft:     "rgba(161,161,170,0.55)",
  sent:      "rgba(147,197,253,0.55)",
  approved:  "rgba(110,231,183,0.55)",
  declined:  "rgba(252,165,165,0.55)",
  expired:   "rgba(252,211,77,0.55)",
  converted: "rgba(216,180,254,0.55)",
}
const QUOTE_STATUS_CONFIG: Record<QuoteStatus, { text: string; bg: string; border: string; glow: string }> = {
  draft:     { text: "#a1a1aa", bg: "rgba(113,113,122,0.18)", border: "rgba(161,161,170,0.55)", glow: "rgba(161,161,170,0.2)" },
  sent:      { text: "#93c5fd", bg: "rgba(96,165,250,0.14)",  border: "rgba(147,197,253,0.55)", glow: "rgba(147,197,253,0.2)" },
  approved:  { text: "#6ee7b7", bg: "rgba(110,231,183,0.13)", border: "rgba(110,231,183,0.55)", glow: "rgba(110,231,183,0.2)" },
  declined:  { text: "#fca5a5", bg: "rgba(252,165,165,0.13)", border: "rgba(252,165,165,0.55)", glow: "rgba(252,165,165,0.2)" },
  expired:   { text: "#fcd34d", bg: "rgba(252,211,77,0.13)",  border: "rgba(252,211,77,0.55)",  glow: "rgba(252,211,77,0.2)"  },
  converted: { text: "#d8b4fe", bg: "rgba(216,180,254,0.13)", border: "rgba(216,180,254,0.55)", glow: "rgba(216,180,254,0.2)" },
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

// ─── Return-to-service statement templates ────────────────────────────────────
export const RTS_TEMPLATES: { key: string; label: string; text: string }[] = [
  {
    key:   "pt91",
    label: "Part 91",
    text:  "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 91.409(f)(3), and Part 43, and is approved for return to service in respect to that work performed.",
  },
  {
    key:   "pt135",
    label: "Part 135",
    text:  "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 135.411(a)(1), Part 91.409(f)(3), and Part 43, and is approved for return to service in respect to that work performed.",
  },
  {
    key:   "pc12_pt91",
    label: "PC-12 Pt 91",
    text:  "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 91.409(a)(1), and Part 43, and is approved for return to service in respect to that work performed.",
  },
  {
    key:   "pc12_pt135",
    label: "PC-12 Pt 135",
    text:  "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 135.411(a)(1), Part 91.409(a) and (b), and Part 43, and is approved for return to service in respect to that work performed.",
  },
  {
    key:   "pc12_pt135_aaip",
    label: "PC-12 Pt 135 AAIP",
    text:  "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 135.411(a)(1) and SkyShare LLC's AAIP, and is approved for return to service in respect to that work performed.",
  },
  {
    key:   "pt135_10plus",
    label: "Part 135 (10 or More Aircraft)",
    text:  "Returned to Service per SkyShare CAMP KNIA462K",
  },
]

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

async function buildPdfBlob(el: HTMLElement): Promise<Blob> {
  const canvas  = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" })
  const imgData = canvas.toDataURL("image/png")
  const pdf     = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" })
  const pdfW    = pdf.internal.pageSize.getWidth()
  const pdfH    = pdf.internal.pageSize.getHeight()
  const imgH    = canvas.height * (pdfW / canvas.width)
  let position = 0, remaining = imgH
  pdf.addImage(imgData, "PNG", 0, 0, pdfW, imgH)
  remaining -= pdfH
  while (remaining > 0) {
    position += pdfH; pdf.addPage()
    pdf.addImage(imgData, "PNG", 0, -position, pdfW, imgH)
    remaining -= pdfH
  }
  return pdf.output("blob")
}

// Captures each element as its own PDF page (one page per major assembly section)
async function buildPdfFromPages(els: HTMLElement[]): Promise<Blob> {
  const pdf  = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" })
  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = pdf.internal.pageSize.getHeight()

  for (let i = 0; i < els.length; i++) {
    const canvas  = await html2canvas(els[i], { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" })
    const imgData = canvas.toDataURL("image/png")
    const imgH    = canvas.height * (pdfW / canvas.width)

    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, imgH)

    // Handle entries taller than one page
    let pos = pdfH, remaining = imgH - pdfH
    while (remaining > 0) {
      pdf.addPage()
      pdf.addImage(imgData, "PNG", 0, -pos, pdfW, imgH)
      pos += pdfH; remaining -= pdfH
    }
  }

  return pdf.output("blob")
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

function Toolbar({ textareaRef, onUpdate, noBorder }: {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  onUpdate: (v: string) => void
  noBorder?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-1 px-4 py-2", !noBorder && "border-b border-white/[0.07]")}>
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

// ─── Audit Trail Panel ────────────────────────────────────────────────────────

const AUDIT_ENTRY_STYLE: Record<string, { dot: string; icon: React.ElementType; iconColor: string }> = {
  status_change:    { dot: "#d4a017", icon: ChevronRight,  iconColor: "#d4a017" },
  sign_off:         { dot: "#34d399", icon: CheckCircle2,  iconColor: "#34d399" },
  sign_off_cleared: { dot: "#fb923c", icon: AlertCircle,   iconColor: "#fb923c" },
  labor_added:      { dot: "#60a5fa", icon: Clock,         iconColor: "#60a5fa" },
  labor_removed:    { dot: "#6b7280", icon: Clock,         iconColor: "#6b7280" },
  part_added:       { dot: "#2dd4bf", icon: Package,       iconColor: "#2dd4bf" },
  part_removed:     { dot: "#6b7280", icon: Package,       iconColor: "#6b7280" },
  item_status_change:{ dot: "#c084fc", icon: Circle,       iconColor: "#c084fc" },
  text_edit:        { dot: "#6b7280", icon: FileText,      iconColor: "#6b7280" },
  item_created:     { dot: "#93c5fd", icon: Plus,          iconColor: "#93c5fd" },
  item_deleted:     { dot: "#f87171", icon: X,             iconColor: "#f87171" },
  wo_created:       { dot: "#d4a017", icon: FileText,      iconColor: "#d4a017" },
}

function fmtAuditTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function AuditTrailPanel({ entries }: { entries: AuditEntry[] }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Group consecutive text_edit entries by itemId into collapsible blocks
  type DisplayItem =
    | { type: "entry"; entry: AuditEntry }
    | { type: "text_group"; key: string; itemNumber: number | null; itemId: string | null; entries: AuditEntry[] }

  const display: DisplayItem[] = []
  let i = 0
  while (i < entries.length) {
    const e = entries[i]
    if (e.entryType === "text_edit") {
      // Collect consecutive text_edits for the same item
      const groupEntries: AuditEntry[] = [e]
      let j = i + 1
      while (j < entries.length && entries[j].entryType === "text_edit" && entries[j].itemId === e.itemId) {
        groupEntries.push(entries[j])
        j++
      }
      if (groupEntries.length === 1) {
        display.push({ type: "entry", entry: e })
      } else {
        const key = `tg-${e.itemId}-${e.createdAt}`
        display.push({ type: "text_group", key, itemNumber: e.itemNumber, itemId: e.itemId, entries: groupEntries })
      }
      i = j
    } else {
      display.push({ type: "entry", entry: e })
      i++
    }
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/25 text-sm">No audit entries yet.</p>
          <p className="text-white/15 text-xs mt-1">Actions on this work order will be recorded here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="w-4 h-4" style={{ color: "var(--skyshare-gold)" }} />
        <span className="text-white/40 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
          Audit Trail — {entries.length} event{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="relative pl-7">
        <div className="absolute left-2.5 top-1 bottom-1 w-px bg-white/8" />
        <div className="space-y-5">
          {display.map((item, idx) => {
            if (item.type === "text_group") {
              const expanded = expandedGroups.has(item.key)
              const newest = item.entries[0]
              return (
                <div key={item.key} className="relative">
                  <div className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full border border-white/20 bg-zinc-800" />
                  <button
                    className="w-full text-left flex items-center gap-2 group"
                    onClick={() => setExpandedGroups(prev => {
                      const next = new Set(prev)
                      expanded ? next.delete(item.key) : next.add(item.key)
                      return next
                    })}
                  >
                    <FileText className="w-3 h-3 flex-shrink-0 text-white/25" />
                    <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
                      {item.entries.length} field change{item.entries.length !== 1 ? "s" : ""} on Item #{item.itemNumber ?? "?"}
                    </span>
                    <ChevronDown className={cn("w-3 h-3 text-white/25 transition-transform ml-auto flex-shrink-0", expanded && "rotate-180")} />
                    <span className="text-white/20 text-xs flex-shrink-0">{fmtAuditTime(newest.createdAt)}</span>
                  </button>
                  {expanded && (
                    <div className="mt-2 ml-5 space-y-2 border-l border-white/[0.07] pl-3">
                      {item.entries.map(e => (
                        <div key={e.id} className="text-xs">
                          <span className="text-white/40 font-medium">{e.fieldName?.replace(/_/g, " ") ?? "field"}</span>
                          {e.oldValue !== null && (
                            <span className="ml-2">
                              <span className="text-white/25 line-through">{e.oldValue.slice(0, 60)}{e.oldValue.length > 60 ? "…" : ""}</span>
                              <span className="text-white/25 mx-1">→</span>
                              <span className="text-white/50">{(e.newValue ?? "").slice(0, 60)}{(e.newValue?.length ?? 0) > 60 ? "…" : ""}</span>
                            </span>
                          )}
                          <span className="text-white/20 ml-2">{fmtAuditTime(e.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            const e = item.entry
            const style = AUDIT_ENTRY_STYLE[e.entryType] ?? AUDIT_ENTRY_STYLE.text_edit
            const Icon = style.icon
            const isFirst = idx === 0
            return (
              <div key={e.id} className="relative">
                <div
                  className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full"
                  style={{ background: isFirst ? style.dot : "hsl(0,0%,28%)", boxShadow: isFirst ? `0 0 6px ${style.dot}` : "none" }}
                />
                <div className="flex items-start gap-3">
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: style.iconColor, opacity: isFirst ? 1 : 0.55 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/75 text-sm leading-snug">{e.summary}</p>
                    {e.detail && <p className="text-white/35 text-xs mt-0.5 truncate">{e.detail}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {e.actorName && <p className="text-white/45 text-xs font-medium">{e.actorName}</p>}
                    <p className="text-white/25 text-xs">{fmtAuditTime(e.createdAt)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Mechanic Select ─────────────────────────────────────────────────────────
function MechanicSelect({ mechanics, value, onChange }: { mechanics: Mechanic[]; value: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(t) &&
        triggerRef.current  && !triggerRef.current.contains(t)
      ) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleToggle() {
    if (!open && triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  const selected = mechanics.find(m => m.name === value)

  const dropdown = open && rect ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        background: "hsl(0,0%,12%)",
        border: "1px solid hsl(0,0%,26%)",
        borderRadius: "10px",
        overflow: "hidden",
        boxShadow: "0 12px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {mechanics.length === 0 ? (
        <div className="px-3 py-3 text-white/30 text-xs text-center">No mechanics on file</div>
      ) : mechanics.map(m => (
        <button
          key={m.id}
          type="button"
          onClick={() => { onChange(m.name); setOpen(false) }}
          className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors"
          style={{
            background: value === m.name ? "rgba(255,255,255,0.08)" : "transparent",
            color: value === m.name ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
            borderBottom: "1px solid hsl(0,0%,18%)",
          }}
          onMouseEnter={e => { if (value !== m.name) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
          onMouseLeave={e => { if (value !== m.name) (e.currentTarget as HTMLElement).style.background = "transparent" }}
        >
          {m.certType && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: "rgba(212,160,23,0.18)", color: "var(--skyshare-gold)" }}>
              {m.certType}
            </span>
          )}
          <span className="text-sm">{m.name}</span>
          {value === m.name && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-emerald-400" />}
        </button>
      ))}
    </div>,
    document.body
  ) : null

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors"
        style={{
          background: "hsl(0,0%,11%)",
          border: `1px solid ${open ? "hsl(0,0%,32%)" : "hsl(0,0%,22%)"}`,
          color: value ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)",
        }}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected?.certType && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: "rgba(212,160,23,0.18)", color: "var(--skyshare-gold)" }}>
              {selected.certType}
            </span>
          )}
          <span className="truncate">{selected?.name ?? "Select mechanic…"}</span>
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 flex-shrink-0 text-white/25 transition-transform duration-150", !open && "rotate-180")} />
      </button>
      {dropdown}
    </div>
  )
}

// ─── Item Detail Panel ────────────────────────────────────────────────────────
interface ItemDetailPanelProps {
  item: WOItem
  isLocked: boolean
  isQuote: boolean
  sectionColor: string
  aircraftModel: string        // for library "Add to Library"
  mechanicName: string         // for library created_by_name
  onPatch: (patch: Partial<WOItem>) => void
  onPersist: (fields: Partial<WOItem>, oldFields?: Partial<WOItem>) => void
  onSignOff: (opts: { noLogbook: boolean; digitalSig: boolean }) => Promise<void>
  signOffError: string | null
  onClearSignOffError: () => void
  onDeleteLabor: (id: string) => void
  onDeletePart: (id: string) => void
  mechanics: Mechanic[]
  inventoryParts: InventoryPart[]
  onNavigatePO: () => void
  onShowPartsOverview: () => void
  allItems: WOItem[]
  itemPartsOnOrder: { requestId: string; status: string; partNumber: string; description: string | null; quantity: number; lineStatus: string }[]
  pullPartNumber?: string
  onPullHandled?: () => void
  addingPartToItem: string | null
  setAddingPartToItem: (id: string | null) => void
  newPart: { partNumber: string; description: string; qty: string; unitPrice: string }
  setNewPart: React.Dispatch<React.SetStateAction<{ partNumber: string; description: string; qty: string; unitPrice: string }>>
  onAddPart: () => void
  onAddFromInventory: (inv: InventoryPart, qty: number) => void
  addingLaborToItem: string | null
  setAddingLaborToItem: (id: string | null) => void
  newLabor: { mechName: string; hours: string; date: string }
  setNewLabor: React.Dispatch<React.SetStateAction<{ mechName: string; hours: string; date: string }>>
  onAddLabor: () => void
  onFoundDiscrepancy?: () => void
  onChangeOrders?: () => void
  onDeleteItem?: () => void
}

function ItemDetailPanel({
  item, isLocked, isQuote, sectionColor, aircraftModel, mechanicName, onPatch, onPersist, onSignOff, signOffError, onClearSignOffError, onDeleteLabor, onDeletePart,
  mechanics, inventoryParts, onNavigatePO, onShowPartsOverview, allItems, itemPartsOnOrder,
  pullPartNumber, onPullHandled,
  addingPartToItem, setAddingPartToItem, newPart, setNewPart, onAddPart, onAddFromInventory,
  addingLaborToItem, setAddingLaborToItem, newLabor, setNewLabor, onAddLabor, onFoundDiscrepancy, onChangeOrders, onDeleteItem,
}: ItemDetailPanelProps) {
  const discRef = useRef<HTMLTextAreaElement>(null)
  const corrRef = useRef<HTMLTextAreaElement>(null)
  const savedOnFocus = useRef<Partial<WOItem>>({})
  const [showInventoryPicker, setShowInventoryPicker] = useState(false)
  const [invSearch, setInvSearch] = useState("")
  const [invResults, setInvResults] = useState<InventoryPart[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const invDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const [noLogbook, setNoLogbook] = useState(false)
  const [digitalSig, setDigitalSig] = useState(false)
  const [signingOff, setSigningOff] = useState(false)
  const [unsigning, setUnsigning] = useState(false)
  // Add to Library modal
  const [showLibModal, setShowLibModal] = useState(false)
  const [libSaveType, setLibSaveType] = useState<"ca" | "fr" | "both">("both")
  const [libSaving, setLibSaving] = useState(false)
  const [libSaved, setLibSaved] = useState(false)
  const [libSaveError, setLibSaveError] = useState<string | null>(null)
  const [invQtyMap, setInvQtyMap] = useState<Record<string, string>>({})
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  // ── P/N cross-check: inventory parts mentioned in corrective action but not logged ──
  const unloggedMentionedParts = useMemo(() => {
    if (!item.correctiveAction) return []
    const text = item.correctiveAction.toLowerCase()
    return inventoryParts.filter(inv =>
      text.includes(inv.partNumber.toLowerCase()) &&
      !item.parts.some(p => p.partNumber.toLowerCase() === inv.partNumber.toLowerCase())
    )
  }, [item.correctiveAction, item.parts, inventoryParts])

  // ── Pull to WO: when a received part is being pulled, open picker pre-seeded ─
  useEffect(() => {
    if (!pullPartNumber) return
    setInvSearch(pullPartNumber)
    setShowInventoryPicker(true)
    onPullHandled?.()
  }, [pullPartNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live inventory search for picker ─────────────────────────────────────────
  useEffect(() => {
    if (!showInventoryPicker) return
    if (invDebounceRef.current) clearTimeout(invDebounceRef.current)
    const delay = invSearch.trim().length >= 2 ? 250 : 0
    invDebounceRef.current = setTimeout(() => {
      setInvLoading(true)
      searchPartsLimited(invSearch.trim() || undefined)
        .then(setInvResults)
        .catch(() => {})
        .finally(() => setInvLoading(false))
    }, delay)
    return () => { if (invDebounceRef.current) clearTimeout(invDebounceRef.current) }
  }, [invSearch, showInventoryPicker])

  function addFromInventory(inv: InventoryPart) {
    const qty = Math.max(1, parseInt(invQtyMap[inv.id] ?? "1", 10) || 1)
    onAddFromInventory(inv, qty)
    setShowInventoryPicker(false)
    setInvSearch("")
    setInvResults([])
    setInvQtyMap({})
  }

  const itemStatus    = item.itemStatus ?? "pending"
  const laborEntries  = item.labor ?? []
  const clockedTotal  = laborEntries.reduce((s, e) => s + e.hours, 0)
  const noPartsRequired = item.noPartsRequired ?? false

  const clockedNames  = new Set(laborEntries.map(e => e.mechanicName))

  return (
    <div className="flex flex-col h-full">

      {/* ── Status selector + sign-off — WORK ORDER ONLY ─────────────── */}
      {!isQuote && (
      <div
        className="px-4 py-2.5 flex items-center justify-start gap-1.5 flex-shrink-0"
        style={{ background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,17%)" }}
      >
        {(Object.entries(ITEM_STATUS_CONFIG) as [WOItemStatus, typeof ITEM_STATUS_CONFIG[WOItemStatus]][]).map(([key, cfg]) => {
          const Icon = cfg.icon
          const active = itemStatus === key
          return (
            <button
              key={key}
              disabled={isLocked}
              onClick={() => { const prev = item.itemStatus; onPatch({ itemStatus: key }); onPersist({ itemStatus: key }, { itemStatus: prev }) }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                active
                  ? cn(cfg.activeBg, cfg.color, cfg.border)
                  : "bg-transparent text-white/30 border-white/[0.07] hover:border-white/20 hover:text-white/55",
                isLocked && "opacity-50 cursor-default"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}
            </button>
          )
        })}

        {/* ── Separator + Add to Library (manager) ── */}
        {item.refCode?.trim() && item.correctiveAction?.trim() && (
          <>
            <div className="w-px h-5 mx-1 self-center" style={{ background: "hsl(0,0%,26%)" }} />
            <button
              onClick={() => { setShowLibModal(true); setLibSaved(false); setLibSaveError(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
              style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.25)", color: "rgba(212,160,23,0.7)" }}
              title="Save corrective action or flat rate to library (managers only)"
            >
              <Library className="w-3.5 h-3.5" />
              Add to Library
            </button>
          </>
        )}

        {/* ── Parts Overview ── */}
        {(() => {
          const totalWOParts = allItems.reduce((s, i) => s + i.parts.length, 0)
          return (
            <>
              <div className="w-px h-5 mx-1 self-center" style={{ background: "hsl(0,0%,26%)" }} />
              <button
                onClick={onShowPartsOverview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
                style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.25)", color: "rgba(212,160,23,0.7)" }}
                title="View all parts across this work order"
              >
                <Package className="w-3.5 h-3.5" />
                Parts Overview
                {totalWOParts > 0 && (
                  <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(212,160,23,0.15)", color: "rgba(212,160,23,0.8)" }}>
                    {totalWOParts}
                  </span>
                )}
              </button>
            </>
          )
        })()}

        {/* ── Change Orders ── */}
        {onChangeOrders && (
          <>
            <div className="w-px h-5 mx-1 self-center" style={{ background: "hsl(0,0%,26%)" }} />
            <button
              type="button"
              onClick={onChangeOrders}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)", color: "rgba(251,191,36,0.75)" }}
              title="Create a change order from pending discrepancies"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Change Orders
            </button>
          </>
        )}

        {/* ── Sign-off — right side ── */}
        {item.signOffRequired && (
          <div className="ml-auto flex items-center gap-3">
            {item.signedOffBy ? (
              <>
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "rgba(52,211,153,0.85)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {item.signedOffBy}
                </span>
                {!isLocked && (
                  <button
                    disabled={unsigning}
                    onClick={async () => {
                      setUnsigning(true)
                      try { await onSignOff({ noLogbook, digitalSig }) } finally { setUnsigning(false) }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.07)", color: "rgba(239,68,68,0.8)" }}
                  >
                    {unsigning
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <X className="w-3.5 h-3.5" />
                    }
                    Unsign
                  </button>
                )}
              </>
            ) : !isLocked ? (() => {
              const missingCode = !item.refCode?.trim()
              const notDone = item.itemStatus !== "done"
              const isBlocked = missingCode || notDone
              const blockReason = notDone
                ? "Set status to Done first"
                : "Ref / Task Code required"
              return (
                <div className="flex items-center gap-3">
                  {/* Options */}
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={noLogbook}
                        onChange={e => setNoLogbook(e.target.checked)}
                        className="w-3 h-3 accent-white/60 cursor-pointer"
                      />
                      <span className="text-[10px] text-white/45 whitespace-nowrap">Non-logbook</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={digitalSig}
                        onChange={e => setDigitalSig(e.target.checked)}
                        className="w-3 h-3 accent-white/60 cursor-pointer"
                      />
                      <span className="text-[10px] text-white/45 whitespace-nowrap">Digital Sig</span>
                    </label>
                    {digitalSig && (
                      <span className="text-[9px] leading-tight" style={{ color: "rgba(251,146,60,0.75)", fontFamily: "var(--font-heading)", maxWidth: "80px" }}>
                        Not currently approved
                      </span>
                    )}
                  </div>
                  {/* Sign Off button + loading bar */}
                  <div className="flex flex-col items-end gap-0.5">
                    <button
                      onClick={isBlocked || signingOff ? undefined : async () => {
                        setSigningOff(true)
                        try { await onSignOff({ noLogbook, digitalSig }) } finally { setSigningOff(false) }
                      }}
                      disabled={isBlocked || signingOff}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all disabled:cursor-not-allowed"
                      style={isBlocked ? {
                        border: "1px solid rgba(251,146,60,0.3)",
                        background: "rgba(251,146,60,0.05)",
                        color: "rgba(251,146,60,0.4)",
                      } : {
                        border: "1px solid rgba(52,211,153,0.35)",
                        background: signingOff ? "rgba(52,211,153,0.12)" : "rgba(52,211,153,0.07)",
                        color: signingOff ? "rgba(52,211,153,0.6)" : "rgba(52,211,153,0.85)",
                      }}
                    >
                      {signingOff
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCircle2 className="w-3.5 h-3.5" />
                      }
                      {signingOff ? "Signing…" : "Sign Off"}
                    </button>
                    {signingOff && (
                      <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(52,211,153,0.15)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            background: "rgba(52,211,153,0.6)",
                            animation: "sign-off-progress 2.5s ease-in-out infinite",
                            width: "40%",
                          }}
                        />
                      </div>
                    )}
                    {!signingOff && isBlocked && (
                      <span className="text-[10px]" style={{ color: "rgba(251,146,60,0.7)", fontFamily: "var(--font-heading)" }}>
                        {blockReason}
                      </span>
                    )}
                  </div>
                </div>
              )
            })() : null}
          </div>
        )}
      </div>
      )}

      {/* ── Quote toolbar (estimate-only) ────────────────────────────── */}
      {isQuote && (
        <div
          className="px-4 py-2.5 flex items-center gap-2 flex-shrink-0"
          style={{ background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,17%)" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300/70">Quote Line Item</span>
          <span className="text-white/25 text-xs">·</span>
          <span className="text-white/40 text-xs">Estimate labor hours and parts — nothing here is clocked, issued, or ordered</span>
          {/* Add to Library still useful on quotes (flat rates + canned actions) */}
          {item.refCode?.trim() && item.correctiveAction?.trim() && (
            <>
              <div className="w-px h-5 mx-1 self-center" style={{ background: "hsl(0,0%,26%)" }} />
              <button
                onClick={() => { setShowLibModal(true); setLibSaved(false); setLibSaveError(null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all"
                style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.25)", color: "rgba(212,160,23,0.7)" }}
                title="Save corrective action or flat rate to library"
              >
                <Library className="w-3.5 h-3.5" />
                Add to Library
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Sign-off error strip ─────────────────────────────────────── */}
      {signOffError && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-xs flex-shrink-0" style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.85)" }}>
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span className="flex-1">{signOffError}</span>
          <button onClick={onClearSignOffError} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Task / Discrepancy + Work Performed + Labor — side by side */}
        <div className="px-5 pt-5 pb-5 flex items-start gap-4" style={{ borderBottom: "1px solid hsl(0,0%,17%)" }}>

          {/* Left column (75%): Discrepancy + Work Performed */}
          <div className="space-y-4" style={{ width: "75%", minWidth: 0 }}>

          {/* Task / Discrepancy box — with section + task metadata in header */}
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
              <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(251,146,60,0.9)" }} />
              <span className="text-sm font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "rgba(251,146,60,0.9)" }}>Item / Discrepancy</span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded flex-shrink-0"
                style={{ background: sectionColor + "22", color: sectionColor }}
              >
                {item.logbookSection}
              </span>
              {/* Editable task name */}
              <input
                type="text"
                value={item.category}
                onChange={e => onPatch({ category: e.target.value })}
                onFocus={() => { savedOnFocus.current.category = item.category }}
                onBlur={e => {
                  const trimmed = e.target.value.trim()
                  if (trimmed) onPersist({ category: trimmed }, { category: savedOnFocus.current.category })
                }}
                disabled={isLocked}
                className="flex-1 min-w-0 text-sm font-medium text-white bg-transparent rounded px-2 py-0.5 focus:outline-none focus:bg-white/[0.06] truncate disabled:opacity-60"
                placeholder="Task name…"
              />
              {/* Task number + P/N — right side */}
              {item.taskNumber && (
                <span className="text-white/30 text-xs font-mono flex-shrink-0">#{item.taskNumber}</span>
              )}
              {item.partNumber && (
                <span className="text-white/20 text-xs font-mono flex-shrink-0">
                  P/N {item.partNumber}{item.serialNumber ? ` · S/N ${item.serialNumber}` : ""}
                </span>
              )}
              {/* ── Delete discrepancy (Manager+, double-confirm) ── */}
              {onDeleteItem && !deleting && (
                deleteConfirm ? (
                  <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-red-300/80 uppercase tracking-wider font-semibold">Permanently delete this item?</span>
                    <button
                      type="button"
                      onClick={async () => {
                        setDeleting(true)
                        await onDeleteItem()
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                      style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.5)", color: "#fca5a5" }}
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="text-[10px] text-white/35 hover:text-white/60 transition-colors px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="ml-auto flex-shrink-0 p-1.5 rounded transition-all hover:bg-red-900/30 text-white/20 hover:text-red-400"
                    title="Delete this discrepancy item (Manager+)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )
              )}
              {deleting && (
                <Loader2 className="ml-auto w-3.5 h-3.5 text-red-400/60 animate-spin flex-shrink-0" />
              )}
            </div>
            {!isLocked && (
              <div className="flex items-center border-b border-white/[0.07]">
                <div className="flex items-center gap-3 px-4 py-2.5 border-r border-white/[0.07]">
                  <div className="flex flex-col gap-0.5">
                    <label
                      htmlFor={`ref-code-disc-${item.id}`}
                      className="text-[9px] font-bold uppercase tracking-[0.2em] whitespace-nowrap"
                      style={{ color: item.refCode?.trim() ? "rgba(251,146,60,0.45)" : "rgba(251,146,60,0.75)", fontFamily: "var(--font-heading)" }}
                    >
                      Ref / Task Code
                    </label>
                    {!item.refCode?.trim() && (
                      <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: "rgba(251,146,60,0.9)" }}>
                        ← required to sign off
                      </span>
                    )}
                  </div>
                  <input
                    id={`ref-code-disc-${item.id}`}
                    type="text"
                    value={item.refCode}
                    onChange={e => onPatch({ refCode: e.target.value })}
                    onFocus={() => { savedOnFocus.current.refCode = item.refCode }}
                    onBlur={e => onPersist({ refCode: e.target.value }, { refCode: savedOnFocus.current.refCode })}
                    className="text-sm font-mono font-semibold rounded-md px-3 py-1.5 focus:outline-none transition-all"
                    style={{
                      width: "148px",
                      background: item.refCode?.trim() ? "rgba(251,146,60,0.05)" : "rgba(251,146,60,0.1)",
                      color: item.refCode?.trim() ? "rgba(251,146,60,0.95)" : "rgba(255,255,255,0.75)",
                      border: item.refCode?.trim() ? "1px solid transparent" : "1px solid rgba(251,146,60,0.45)",
                    }}
                  />
                </div>
                <Toolbar textareaRef={discRef} onUpdate={v => onPatch({ discrepancy: v })} noBorder />
                {onFoundDiscrepancy && (
                  <button
                    type="button"
                    onClick={onFoundDiscrepancy}
                    className="ml-auto mr-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex-shrink-0"
                    style={{ background: "rgba(193,2,48,0.08)", border: "1px solid rgba(193,2,48,0.3)", color: "#ff6b81" }}
                    title="Record a discrepancy found on this inspection item"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Found Discrepancy
                  </button>
                )}
              </div>
            )}
            <textarea
              ref={discRef}
              value={item.discrepancy}
              onChange={e => onPatch({ discrepancy: e.target.value })}
              onFocus={() => { savedOnFocus.current.discrepancy = item.discrepancy }}
              onBlur={e => onPersist({ discrepancy: e.target.value }, { discrepancy: savedOnFocus.current.discrepancy })}
              disabled={isLocked}
              rows={3}
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
              {item.signedOffBy && (
                <span className="text-emerald-400 text-sm font-medium">✓ Signed by {item.signedOffBy}</span>
              )}
              {item.correctiveAction && item.signOffRequired && !item.signedOffBy && !isLocked && (
                <span className="text-white/25 text-sm">Awaiting sign-off</span>
              )}
            </div>
            {!isLocked && (
              <div className="flex items-center border-b border-white/[0.07]">
                {/* TRACSALL / CAMP code — required before sign-off; populates Code column in logbook */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-r border-white/[0.07]">
                  <div className="flex flex-col gap-0.5">
                    <label
                      htmlFor={`ref-code-${item.id}`}
                      className="text-[9px] font-bold uppercase tracking-[0.2em] whitespace-nowrap"
                      style={{ color: item.refCode?.trim() ? "rgba(110,231,183,0.45)" : "rgba(110,231,183,0.75)", fontFamily: "var(--font-heading)" }}
                    >
                      Ref / Task Code
                    </label>
                    {!item.refCode?.trim() && (
                      <span className="text-[8px] whitespace-nowrap" style={{ color: "rgba(52,211,153,0.4)" }}>
                        Required to sign off
                      </span>
                    )}
                  </div>
                  <input
                    id={`ref-code-${item.id}`}
                    type="text"
                    value={item.refCode}
                    onChange={e => onPatch({ refCode: e.target.value })}
                    onFocus={() => { savedOnFocus.current.refCode = item.refCode }}
                    onBlur={e => onPersist({ refCode: e.target.value }, { refCode: savedOnFocus.current.refCode })}
                    className={cn(
                      "text-sm font-mono font-semibold rounded-md px-3 py-1.5 focus:outline-none transition-all",
                      item.refCode?.trim() ? "ref-code-input-filled" : "ref-code-input-empty"
                    )}
                    style={{
                      width: "148px",
                      background: item.refCode?.trim() ? "rgba(52,211,153,0.05)" : "rgba(52,211,153,0.1)",
                      color: item.refCode?.trim() ? "rgba(110,231,183,0.95)" : "rgba(255,255,255,0.75)",
                      border: item.refCode?.trim() ? "1px solid transparent" : "1px solid rgba(52,211,153,0.45)",
                    }}
                  />
                </div>
                <Toolbar textareaRef={corrRef} onUpdate={v => onPatch({ correctiveAction: v })} noBorder />
              </div>
            )}
            <textarea
              ref={corrRef}
              value={item.correctiveAction}
              onChange={e => onPatch({ correctiveAction: e.target.value })}
              onFocus={() => { savedOnFocus.current.correctiveAction = item.correctiveAction }}
              onBlur={e => onPersist({ correctiveAction: e.target.value }, { correctiveAction: savedOnFocus.current.correctiveAction })}
              disabled={isLocked}
              rows={6}
              placeholder={isLocked ? "No corrective action recorded." : "What was done to correct the discrepancy…"}
              className="w-full px-5 py-4 text-white text-base leading-relaxed resize-none focus:outline-none placeholder:text-white/20 disabled:opacity-60"
              style={{ background: "hsl(0,0%,11%)" }}
            />
          </div>

            {/* ── P/N cross-check warning ─────────────────────────────────── */}
            {unloggedMentionedParts.length > 0 && (
              <div
                className="rounded-xl overflow-hidden"
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

          </div>{/* end left column */}

          {/* Right column (25%): Labor (WO) or Estimated Labor (Quote) */}
          <div style={{ width: "25%", minWidth: 0 }}>
            {isQuote ? (
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: "1px solid rgba(96,165,250,0.25)", borderLeft: "3px solid rgba(96,165,250,0.6)" }}
              >
                <div
                  className="px-3 py-2.5 flex items-center gap-2"
                  style={{
                    background: "linear-gradient(to right, rgba(96,165,250,0.08), rgba(96,165,250,0.02))",
                    borderBottom: "1px solid rgba(96,165,250,0.15)",
                  }}
                >
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#93c5fd" }}>
                    Estimated Labor
                  </span>
                </div>
                <div className="px-3 py-3 space-y-2.5">
                  <div>
                    <label className="text-white/45 text-[10px] uppercase tracking-wider block mb-1">Hours</label>
                    <input
                      type="number" step="0.25" min="0" placeholder="0.0"
                      disabled={isLocked}
                      className="w-full px-2.5 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 tabular-nums"
                      value={item.estimatedHours || ""}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        onPatch({ estimatedHours: v })
                      }}
                      onBlur={() => onPersist({ estimatedHours: item.estimatedHours })}
                    />
                  </div>
                  <div>
                    <label className="text-white/45 text-[10px] uppercase tracking-wider block mb-1">Rate ($/hr)</label>
                    <input
                      type="number" step="5" min="0" placeholder="125"
                      disabled={isLocked}
                      className="w-full px-2.5 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 tabular-nums"
                      value={item.laborRate || ""}
                      onChange={e => {
                        const v = parseFloat(e.target.value) || 0
                        onPatch({ laborRate: v })
                      }}
                      onBlur={() => onPersist({ laborRate: item.laborRate })}
                    />
                  </div>
                  <div className="pt-2 mt-1 flex items-baseline justify-between" style={{ borderTop: "1px dashed rgba(96,165,250,0.2)" }}>
                    <span className="text-white/45 text-[10px] uppercase tracking-wider">Est. Labor</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: "#93c5fd" }}>
                      ${(item.estimatedHours * item.laborRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(96,165,250,0.2)", borderLeft: "3px solid rgba(96,165,250,0.5)" }}
            >
              {/* Labor header */}
              <div
                className="px-3 py-2.5 flex items-center justify-between"
                style={{
                  background: "linear-gradient(to right, rgba(96,165,250,0.07), rgba(96,165,250,0.02))",
                  borderBottom: "1px solid rgba(96,165,250,0.15)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#93c5fd" }}>Labor</span>
                  {clockedTotal > 0 && (
                    <span className="text-white/40 text-xs">{clockedTotal.toFixed(1)}h</span>
                  )}
                </div>
                {!isLocked && addingLaborToItem !== item.id && (
                  <button
                    onClick={() => {
                      setAddingLaborToItem(item.id)
                      setNewLabor({ mechName: "", hours: "", date: localToday() })
                    }}
                    className="text-white/40 hover:text-white text-[10px] font-semibold px-2 py-1 rounded border border-white/10 hover:border-white/25 transition-all"
                  >
                    <Plus className="w-3 h-3 inline mr-0.5" />Log
                  </button>
                )}
              </div>
              <div className="px-3 py-2.5">

              {/* Labor entries */}
              {laborEntries.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {laborEntries.map(e => (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs"
                      style={{ background: "hsl(220,15%,11%)", borderLeft: "2px solid rgba(96,165,250,0.5)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-white block truncate">{e.mechanicName}</span>
                        <span className="text-white/40">{new Date(e.clockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                      <span className="text-white/70 font-mono flex-shrink-0">{e.hours.toFixed(1)}h</span>
                      {!isLocked && (
                        <button
                          onClick={() => onDeleteLabor(e.id)}
                          className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {laborEntries.length === 0 && (
                <p className="text-white/25 text-xs italic mb-2">No time logged.</p>
              )}

              {/* Log time form */}
              {addingLaborToItem === item.id && (
                <div className="p-3 rounded-xl space-y-2.5" style={{ background: "hsl(0,0%,13%)", border: "1px solid hsl(0,0%,22%)" }}>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1">Mechanic</label>
                      <MechanicSelect
                        mechanics={mechanics}
                        value={newLabor.mechName}
                        onChange={name => setNewLabor(n => ({ ...n, mechName: name }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1">Hours</label>
                        <input
                          type="number" step="0.5" min="0.5" placeholder="0.0"
                          className="w-full px-2.5 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                          value={newLabor.hours}
                          onChange={e => setNewLabor(n => ({ ...n, hours: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1">Date</label>
                        <input
                          type="date"
                          className="w-full px-2.5 py-2 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30"
                          value={newLabor.date}
                          onChange={e => setNewLabor(n => ({ ...n, date: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm" onClick={onAddLabor}
                      disabled={!newLabor.mechName || !newLabor.hours}
                      style={{ background: "var(--skyshare-gold)", color: "#000" }}
                      className="font-bold h-8 px-4 text-xs"
                    >
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingLaborToItem(null)} className="text-white/40 h-8 px-3 text-xs">Cancel</Button>
                  </div>
                </div>
              )}
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Parts */}
        <div className="px-5 pt-3 pb-1" style={{ borderBottom: "1px solid hsl(0,0%,17%)" }}>

        {/* ── Elevated Inventory Picker Panel ───────────────────────────────── */}
        {showInventoryPicker && (
          <div
            className="mb-4 rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(212,160,23,0.4)",
              background: "hsl(0,0%,9%)",
              boxShadow: "0 8px 40px rgba(212,160,23,0.08), 0 0 0 1px rgba(212,160,23,0.12), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Picker header */}
            <div
              className="px-5 py-3.5 flex items-center gap-3"
              style={{
                background: "linear-gradient(135deg, rgba(212,160,23,0.12), rgba(212,160,23,0.04))",
                borderBottom: "1px solid rgba(212,160,23,0.25)",
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(212,160,23,0.15)", border: "1px solid rgba(212,160,23,0.3)" }}>
                <Warehouse className="w-4 h-4" style={{ color: "var(--skyshare-gold)" }} />
              </div>
              <div>
                <span className="text-sm font-bold uppercase tracking-wider block" style={{ color: "rgba(212,160,23,0.95)" }}>
                  Pull from Inventory
                </span>
                <span className="text-[10px] text-white/30">Search and add parts from stock</span>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => { setShowInventoryPicker(false); setInvSearch(""); setInvResults([]) }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Search input */}
            <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid hsl(0,0%,16%)" }}>
              <Search className="w-4.5 h-4.5 text-white/25 flex-shrink-0" />
              <input
                autoFocus
                placeholder="Search by part number or description…"
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none"
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
              />
              {invLoading && <Loader2 className="w-4 h-4 text-amber-400/50 animate-spin flex-shrink-0" />}
            </div>
            {/* Results */}
            <div className="max-h-64 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,160,23,0.25) transparent" }}>
              {invLoading ? (
                <p className="px-5 py-6 text-white/25 text-sm italic text-center">Searching inventory…</p>
              ) : invResults.length === 0 ? (
                <p className="px-5 py-6 text-white/25 text-sm italic text-center">No matching parts</p>
              ) : (
                invResults.map(inv => {
                  const alreadyAdded = item.parts.some(p => p.partNumber.toLowerCase() === inv.partNumber.toLowerCase())
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.03]"
                      style={{ borderBottom: "1px solid hsl(0,0%,14%)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-white/90">{inv.partNumber}</span>
                          {inv.qtyOnHand <= 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>Out of stock</span>
                          )}
                          {inv.qtyOnHand > 0 && (
                            <span className="text-[10px] text-emerald-400/70">{inv.qtyOnHand} on hand</span>
                          )}
                        </div>
                        <p className="text-white/40 text-xs truncate mt-0.5">{inv.description}</p>
                      </div>
                      <span className="text-white/30 text-xs font-mono flex-shrink-0">${inv.unitCost.toFixed(2)}</span>
                      {alreadyAdded ? (
                        <span className="text-emerald-400/60 text-xs flex-shrink-0 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Added</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <label className="text-white/30 text-[10px] uppercase tracking-wider">Qty</label>
                            <input
                              type="number"
                              min="1"
                              max={inv.qtyOnHand > 0 ? inv.qtyOnHand : undefined}
                              value={invQtyMap[inv.id] ?? "1"}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setInvQtyMap(m => ({ ...m, [inv.id]: e.target.value }))}
                              className="w-14 bg-transparent text-white text-xs text-center focus:outline-none rounded px-1 py-1"
                              style={{ border: "1px solid rgba(212,160,23,0.3)" }}
                            />
                          </div>
                          <button
                            onClick={() => addFromInventory(inv)}
                            className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:scale-[1.03]"
                            style={{ background: "rgba(212,160,23,0.2)", color: "rgba(212,160,23,0.95)", border: "1px solid rgba(212,160,23,0.35)" }}
                          >
                            + Add
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            {/* Footer */}
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: "1px solid hsl(0,0%,16%)", background: "hsl(0,0%,8%)" }}
            >
              <span className="text-white/20 text-xs">{invResults.length} result{invResults.length !== 1 ? "s" : ""}</span>
              <button
                onClick={() => { setShowInventoryPicker(false); setAddingPartToItem(item.id); setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" }) }}
                className="text-xs font-medium transition-colors flex items-center gap-1"
                style={{ color: "rgba(212,160,23,0.7)" }}
              >
                Enter manually instead <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* ── Elevated Manual Add Part Panel ─────────────────────────────────── */}
        {addingPartToItem === item.id && !showInventoryPicker && (
          <div
            className="mb-4 rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(212,160,23,0.3)",
              background: "hsl(0,0%,9%)",
              boxShadow: "0 8px 40px rgba(212,160,23,0.06), 0 0 0 1px rgba(212,160,23,0.1), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <div
              className="px-5 py-3.5 flex items-center gap-3"
              style={{
                background: "linear-gradient(135deg, rgba(212,160,23,0.1), rgba(212,160,23,0.03))",
                borderBottom: "1px solid rgba(212,160,23,0.2)",
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.25)" }}>
                <Plus className="w-4 h-4" style={{ color: "var(--skyshare-gold)" }} />
              </div>
              <div>
                <span className="text-sm font-bold uppercase tracking-wider block" style={{ color: "rgba(212,160,23,0.95)" }}>
                  Add Part Manually
                </span>
                <span className="text-[10px] text-white/30">Enter part details by hand</span>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowInventoryPicker(true)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                style={{ background: "rgba(212,160,23,0.1)", color: "rgba(212,160,23,0.8)", border: "1px solid rgba(212,160,23,0.2)" }}
              >
                <Warehouse className="w-3 h-3" /> Search inventory
              </button>
              <button
                onClick={() => setAddingPartToItem(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1.5">Part Number</label>
                  <input
                    autoFocus
                    placeholder="e.g. MS28775-228"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                    value={newPart.partNumber}
                    onChange={e => setNewPart(n => ({ ...n, partNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1.5">Description</label>
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
                  <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1.5">Qty</label>
                  <input
                    type="number" min="1"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/30"
                    value={newPart.qty}
                    onChange={e => setNewPart(n => ({ ...n, qty: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-white/50 text-[10px] uppercase tracking-wider block mb-1.5">Unit Price</label>
                  <input
                    type="number" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                    value={newPart.unitPrice}
                    onChange={e => setNewPart(n => ({ ...n, unitPrice: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
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
          </div>
        )}

        {/* ── Parts card (list + header) ─────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(212,160,23,0.18)", borderLeft: "3px solid rgba(212,160,23,0.5)" }}
        >
          {/* Parts header */}
          <div
            className="px-4 py-2.5 flex items-center justify-between"
            style={{
              background: "linear-gradient(to right, rgba(212,160,23,0.07), rgba(212,160,23,0.02))",
              borderBottom: "1px solid rgba(212,160,23,0.14)",
            }}
          >
            <div className="flex items-center gap-2">
              <Package className="w-3.5 h-3.5" style={{ color: "rgba(212,160,23,0.9)" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(212,160,23,0.85)" }}>Parts</span>
              {item.parts.length > 0 && (
                <span className="text-white/40 text-xs">{item.parts.length} {item.parts.length === 1 ? "part" : "parts"}</span>
              )}
            </div>
            {!isLocked && (
              <div className="flex items-center gap-2">
                {!noPartsRequired && !showInventoryPicker && addingPartToItem !== item.id && (
                  <>
                    {!isQuote && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setShowInventoryPicker(true)}
                        className="text-white/40 hover:text-white border border-white/10 hover:border-white/25 h-7 px-3 text-xs"
                      >
                        <Warehouse className="w-3 h-3 mr-1" /> From Inventory
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { setAddingPartToItem(item.id); setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" }) }}
                      className="text-white/40 hover:text-white border border-white/10 hover:border-white/25 h-7 px-3 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" /> {isQuote ? "Add Estimated Part" : "Add Part"}
                    </Button>
                  </>
                )}
                {!isQuote && (
                  <Button
                    size="sm"
                    onClick={onNavigatePO}
                    className="h-7 px-3 text-xs font-semibold"
                    style={{ background: "rgba(212,160,23,0.12)", color: "var(--skyshare-gold)", border: "1px solid rgba(212,160,23,0.25)" }}
                  >
                    <ShoppingCart className="w-3 h-3 mr-1" /> Order Parts
                  </Button>
                )}
              </div>
            )}
          </div>{/* end parts header */}
          <div className="px-4 py-3">

          {/* No-parts toggle */}
          {!isLocked && (
            <label className="flex items-center gap-2.5 cursor-pointer mb-3 group">
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
                  {isQuote && (
                    <>
                      <span className="text-white/50 text-xs flex-shrink-0 tabular-nums">
                        @ ${(p.unitPrice ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-white font-semibold flex-shrink-0 tabular-nums w-24 text-right">
                        ${((p.unitPrice ?? 0) * (p.qty ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </>
                  )}
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
            <div className="text-center py-4 mb-4">
              <p className="text-white/25 text-sm italic mb-3">
                {isQuote ? "No estimated parts yet" : "No parts logged yet"}
              </p>
              <div className="flex items-center justify-center gap-3">
                {!isQuote && (
                  <button
                    onClick={() => setShowInventoryPicker(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02]"
                    style={{ background: "rgba(212,160,23,0.12)", border: "1px solid rgba(212,160,23,0.3)", color: "rgba(212,160,23,0.9)" }}
                  >
                    <Warehouse className="w-3.5 h-3.5" /> Pull from Inventory
                  </button>
                )}
                <button
                  onClick={() => { setAddingPartToItem(item.id); setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" }) }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={isQuote
                    ? { background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "rgba(196,181,253,0.9)" }
                    : { background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,24%)", color: "rgba(255,255,255,0.5)" }
                  }
                >
                  <Plus className="w-3.5 h-3.5" /> {isQuote ? "Add Estimated Part" : "Add Manually"}
                </button>
              </div>
            </div>
          ) : isLocked ? (
            <div className="flex items-center gap-2 text-sm text-amber-500/60 mb-4">
              <AlertCircle className="w-4 h-4" /> No parts logged
            </div>
          ) : null}

          </div>{/* end parts body */}
        </div>{/* end parts card */}

        {/* Per-item parts on order */}
        {itemPartsOnOrder.length > 0 && (
          <div
            className="mt-3 rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(251,191,36,0.15)", borderLeft: "3px solid rgba(251,191,36,0.4)" }}
          >
            <div
              className="px-4 py-2 flex items-center gap-2"
              style={{ background: "rgba(251,191,36,0.05)", borderBottom: "1px solid rgba(251,191,36,0.1)" }}
            >
              <ShoppingCart className="w-3.5 h-3.5" style={{ color: "rgba(251,191,36,0.7)" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(251,191,36,0.8)" }}>
                Parts on Order for This Task
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.12)", color: "rgba(251,191,36,0.8)" }}>
                {itemPartsOnOrder.length}
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {itemPartsOnOrder.map((po, idx) => {
                const sc = LINE_STATUS_CONFIG[po.lineStatus as keyof typeof LINE_STATUS_CONFIG]
                return (
                  <div
                    key={`${po.requestId}-${idx}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                    style={{ background: "hsl(0,0%,10%)" }}
                  >
                    <span className="text-white font-mono flex-shrink-0 w-32 truncate">{po.partNumber}</span>
                    <span className="text-white/50 flex-1 truncate">{po.description || "—"}</span>
                    <span className="text-white/40 flex-shrink-0">×{po.quantity}</span>
                    {sc && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                        style={{ background: sc.bg, color: sc.color }}
                      >
                        {sc.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        </div>{/* end parts outer wrapper */}


        <div className="h-8" />
      </div>

      {/* ── Add to Library modal ─────────────────────────────────────────── */}
      {showLibModal && createPortal(
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => { if (!libSaving) setShowLibModal(false) }}
        >
          <div
            className="w-[420px] rounded-2xl flex flex-col gap-0 overflow-hidden"
            style={{ background: "hsl(0,0%,13%)", border: "1px solid hsl(0,0%,22%)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid hsl(0,0%,19%)" }}>
              <Library className="w-5 h-5 flex-shrink-0" style={{ color: "var(--skyshare-gold)", opacity: 0.8 }} />
              <div className="flex-1">
                <p className="text-white/90 text-sm font-semibold">Add to Library</p>
                <p className="text-white/35 text-xs mt-0.5 font-mono">{aircraftModel || "Unknown model"} · {item.refCode || item.taskNumber || "no ref"}</p>
              </div>
              <button onClick={() => setShowLibModal(false)} className="text-white/25 hover:text-white/70 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* What to save */}
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">What to save</p>
              {((() => {
                // Use estimated hours if set, otherwise fall back to total clocked hours
                const libHours = item.estimatedHours > 0 ? item.estimatedHours : clockedTotal
                const frAvailable = libHours > 0
                return [
                  { id: "ca",   icon: BookText, label: "Canned Corrective Action", desc: "Save the corrective action text",                     available: !!item.correctiveAction?.trim() },
                  { id: "fr",   icon: Zap,      label: "Flat Rate Labor",          desc: `${libHours.toFixed(1)}h @ $${item.laborRate}/hr`,     available: frAvailable },
                  { id: "both", icon: Library,  label: "Both",                     desc: "Save corrective action + flat rate",                   available: !!item.correctiveAction?.trim() && frAvailable },
                ] as const
              })()).map(opt => (
                <button
                  key={opt.id}
                  disabled={!opt.available}
                  onClick={() => setLibSaveType(opt.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                    !opt.available && "opacity-30 cursor-not-allowed",
                    libSaveType === opt.id && opt.available
                      ? "border-[rgba(212,160,23,0.5)] bg-[rgba(212,160,23,0.09)]"
                      : "border-[hsl(0,0%,21%)] bg-[hsl(0,0%,11%)] hover:border-[hsl(0,0%,30%)]"
                  )}
                >
                  <opt.icon className="w-4 h-4 flex-shrink-0" style={{ color: libSaveType === opt.id ? "var(--skyshare-gold)" : "rgba(255,255,255,0.3)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: libSaveType === opt.id ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)" }}>{opt.label}</p>
                    <p className="text-xs text-white/30 truncate mt-0.5">{opt.available ? opt.desc : "Not available for this item"}</p>
                  </div>
                  <div
                    className="w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all"
                    style={{
                      borderColor: libSaveType === opt.id ? "var(--skyshare-gold)" : "rgba(255,255,255,0.2)",
                      background: libSaveType === opt.id ? "var(--skyshare-gold)" : "transparent",
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Status / error */}
            {libSaved && (
              <div className="mx-5 mb-2 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: "rgba(110,231,183,0.1)", border: "1px solid rgba(110,231,183,0.25)" }}>
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-300">Saved to library successfully</span>
              </div>
            )}
            {libSaveError && (
              <div className="mx-5 mb-2 px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-300">{libSaveError}</span>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-4 flex items-center justify-end gap-2" style={{ borderTop: "1px solid hsl(0,0%,19%)" }}>
              <button
                onClick={() => setShowLibModal(false)}
                disabled={libSaving}
                className="px-4 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 transition-colors"
                style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,24%)" }}
              >
                {libSaved ? "Close" : "Cancel"}
              </button>
              {!libSaved && (
                <button
                  onClick={async () => {
                    const refKey = item.refCode?.trim() || item.taskNumber?.trim() || ""
                    if (!refKey || !aircraftModel) { setLibSaveError("Aircraft model or ref code missing"); return }
                    setLibSaving(true); setLibSaveError(null)
                    try {
                      if (libSaveType === "ca" || libSaveType === "both") {
                        await upsertCorrectiveAction({ aircraftModel, refCode: refKey, correctiveActionText: item.correctiveAction ?? "", createdByName: mechanicName || "Manager" })
                      }
                      if (libSaveType === "fr" || libSaveType === "both") {
                        const libHours = item.estimatedHours > 0 ? item.estimatedHours : clockedTotal
                        await upsertFlatRate({ aircraftModel, refCode: refKey, hours: libHours, laborRate: item.laborRate, description: item.category || null, createdByName: mechanicName || "Manager" })
                      }
                      setLibSaved(true)
                    } catch (e) {
                      setLibSaveError(e instanceof Error ? e.message : "Save failed")
                    } finally {
                      setLibSaving(false)
                    }
                  }}
                  disabled={libSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: "rgba(212,160,23,0.85)", color: "#000" }}
                >
                  {libSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Library className="w-3.5 h-3.5" />}
                  Save to Library
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === "Super Admin"
  const { setHeaderLabel } = useBeetBoxTabs()

  // Handle Traxxall import: build a synthetic WO from navigate state
  const importState = location.state as {
    traxxallImport?: boolean
    aircraftId?: string | null
    guestRegistration?: string | null
    aircraftReg?: string
    aircraftModel?: string
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
      description:       importState?.description ?? null,
      openedBy:          null,
      openedByName:      "Traxxall Import",
      openedAt:          new Date().toISOString(),
      closedAt:          null,
      meterAtOpen:       importState?.meterAtOpen ?? null,
      meterAtClose:      null,
      discrepancyRef:    null,
      notes:             null,
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
  const [showCompleteModal, setShowCompleteModal]       = useState(false)
  const [showOpenModal, setShowOpenModal]               = useState(false)
  const [showDeleteDraftModal, setShowDeleteDraftModal] = useState(false)
  const [showConvertModal, setShowConvertModal]         = useState(false)
  const [showSendApprovalModal, setShowSendApprovalModal] = useState(false)
  const [approvalRefreshKey, setApprovalRefreshKey]       = useState(0)
  const [resendPrefill, setResendPrefill]                 = useState<{ name: string; email: string } | null>(null)
  const [discrepancyForItem, setDiscrepancyForItem]       = useState<WOItem | null>(null)
  const [showCreateCOModal,  setShowCreateCOModal]        = useState(false)
  const [coRefreshKey,       setCoRefreshKey]             = useState(0)
  const [converting, setConverting]                     = useState(false)
  const [deletingDraft, setDeletingDraft]               = useState(false)
  const [timesEditOpen, setTimesEditOpen]               = useState(false)
  const [hobbsDiff, setHobbsDiff]                       = useState<number | null>(null)
  const [billingClient, setBillingClient] = useState<{
    name: string
    address: string | null
    address2: string | null
    city: string | null
    state: string | null
    zip: string | null
    taxable: boolean
  } | null>(null)
  const [notes, setNotes] = useState("")
  const [woDesc, setWoDesc] = useState("")
  const [editingDesc, setEditingDesc] = useState(false)
  const [activeTab, setActiveTab] = useState<"items" | "notes" | "logbook" | "invoice" | "audit_trail">("items")
  const [myProfile, setMyProfile] = useState<{ id: string; name: string } | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [visibleSections, setVisibleSections] = useState<LogbookSection[]>(
    importedSections ?? ["Airframe", "Engine 1"]
  )
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [draftLogbookEntries, setDraftLogbookEntries] = useState<LogbookEntry[]>([])
  const [logbookDraftError, setLogbookDraftError] = useState<string | null>(null)
  const [logbookCreating,   setLogbookCreating]   = useState(false)
  const logbookInitRef = useRef(false)
  const [signOffError, setSignOffError]           = useState<string | null>(null)
  // Editable fields for each draft logbook entry (keyed by entry id)
  const [lbEdits, setLbEdits] = useState<Record<string, { returnToService: string; rtsKey: string; aircraftTime: string; hobbs: string; landings: string }>>({})
  const logbookPrintRef = useRef<HTMLDivElement>(null)
  const invoicePrintRef = useRef<HTMLDivElement>(null)
  const [pdfExporting, setPdfExporting] = useState<"logbook" | "invoice" | null>(null)
  const [pdfPreview,   setPdfPreview]   = useState<{ url: string; filename: string } | null>(null)
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null)
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionColor, setTransitionColor] = useState<string>("rgba(255,255,255,0.3)")
  const [orderPartsOpen, setOrderPartsOpen] = useState(false)
  const [orderPartsForItem, setOrderPartsForItem] = useState<{ id: string; itemNumber: number } | null>(null)
  const [partsRequests, setPartsRequests] = useState<{
    id: string
    status: string
    createdAt: string
    lines: { id: string; partNumber: string; description: string | null; quantity: number; lineStatus: string; woItemId: string | null }[]
  }[]>([])
  const [partsRequestsKey, setPartsRequestsKey] = useState(0)
  const [pullPartNumber, setPullPartNumber] = useState<string | null>(null)
  const [partsOverviewOpen, setPartsOverviewOpen] = useState(false)

  async function handlePreviewPdf(type: "logbook" | "invoice", woNumber: string) {
    if (type === "logbook" && !logbookPrintRef.current) return
    if (type === "invoice" && !invoicePrintRef.current) return
    setPdfExporting(type)
    try {
      const docLabel = type === "invoice" && wo?.woType === "quote" ? "quote" : type
      const filename = `${woNumber}-${docLabel}.pdf`
      let blob: Blob
      if (type === "logbook") {
        const pages = Array.from(
          logbookPrintRef.current!.querySelectorAll("[data-lb-page]")
        ) as HTMLElement[]
        blob = pages.length > 0
          ? await buildPdfFromPages(pages)
          : await buildPdfBlob(logbookPrintRef.current!)
      } else {
        blob = await buildPdfBlob(invoicePrintRef.current!)
      }
      const url = URL.createObjectURL(blob)
      setPdfPreview({ url, filename })
    } finally {
      setPdfExporting(null)
    }
  }

  function closePdfPreview() {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview.url)
    setPdfPreview(null)
  }

  const DEFAULT_RTS_KEY  = "pt135"
  const DEFAULT_RTS_TEXT = RTS_TEMPLATES.find(t => t.key === DEFAULT_RTS_KEY)!.text

  function lbEdit(entryId: string) {
    return lbEdits[entryId] ?? { returnToService: DEFAULT_RTS_TEXT, rtsKey: DEFAULT_RTS_KEY, aircraftTime: "", hobbs: "", landings: "" }
  }
  function setLbField(entryId: string, field: "returnToService" | "rtsKey" | "aircraftTime" | "hobbs" | "landings", value: string) {
    setLbEdits(prev => ({ ...prev, [entryId]: { ...lbEdit(entryId), [field]: value } }))
  }

  async function selectRtsTemplate(entryId: string, _aircraftId: string | null, templateKey: string) {
    const template = RTS_TEMPLATES.find(t => t.key === templateKey)
    if (!template) return
    setLbEdits(prev => ({ ...prev, [entryId]: { ...lbEdit(entryId), rtsKey: templateKey, returnToService: template.text } }))
    await updateLogbookEntry(entryId, { returnToService: template.text }).catch(console.error)
  }

  const loadWO = useCallback(async () => {
    if (!id || id === "wo-traxxall-import") return
    try {
      const data = await getWorkOrderById(id)
      setWO(data)
      setNotes(data?.notes ?? "")
      setWoDesc(data?.description ?? "")
      setSelectedItemId(s => s ?? data?.items[0]?.id ?? null)
      // Ensure every section that has items is visible, in canonical order
      if (data?.items?.length) {
        const sectionsInData = new Set(data.items.map(i => i.logbookSection))
        setVisibleSections(prev => {
          const merged = new Set(prev)
          sectionsInData.forEach(s => merged.add(s))
          return ALL_SECTIONS.filter(s => merged.has(s))
        })
      }
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
          const matchedKey = RTS_TEMPLATES.find(t => t.text === e.returnToService)?.key ?? DEFAULT_RTS_KEY
          next[e.id] = {
            returnToService: e.returnToService || DEFAULT_RTS_TEXT,
            rtsKey: matchedKey,
            aircraftTime: e.totalAircraftTime?.toString() ?? "",
            hobbs: e.hobbs?.toString() ?? "",
            landings: e.landings?.toString() ?? "",
          }
        }
      })
      return next
    })
  }, [id])

  // Auto-create draft logbook entries when the logbook tab is first opened
  useEffect(() => {
    if (activeTab !== "logbook") return
    if (!wo || wo.woType !== "work_order") return
    if (draftLogbookEntries.length > 0 || logbookInitRef.current) return
    const sectionsWithItems = [...new Set(wo.items.map(i => i.logbookSection))] as LogbookSection[]
    if (sectionsWithItems.length === 0) return
    logbookInitRef.current = true
    setLogbookCreating(true)
    setLogbookDraftError(null)
    ;(async () => {
      try {
        for (const section of sectionsWithItems) {
          await getOrCreateDraftLogbookEntry(
            { id: wo.id, woNumber: wo.woNumber, aircraftId: wo.aircraftId, guestRegistration: wo.guestRegistration, guestSerial: wo.guestSerial, timesSnapshot: wo.timesSnapshot as any },
            section
          )
        }
        await loadDraftLogbookEntries()
      } catch (err: any) {
        setLogbookDraftError(err.message ?? "Failed to create draft logbook entries")
        logbookInitRef.current = false
      } finally {
        setLogbookCreating(false)
      }
    })()
  }, [activeTab, wo, draftLogbookEntries.length, visibleSections, loadDraftLogbookEntries])

  useEffect(() => {
    loadWO()
    loadDraftLogbookEntries()
    // Load supporting data in parallel
    Promise.all([getParts(), getTechnicians()])
      .then(([parts, techs]) => { setInventoryParts(parts); setMechanics(techs) })
      .catch(() => {})
    getMyProfile().then(p => { if (p) setMyProfile({ id: p.id, name: p.name }) }).catch(() => {})
  }, [loadWO, loadDraftLogbookEntries])

  // Push WO# into the top tab bar
  useEffect(() => {
    if (!wo?.woNumber || wo.woNumber === "WO-IMPORT") return
    const prefix = wo.woType === "quote" ? "Quote" : wo.woType === "change_order" ? "CO" : "WO#"
    setHeaderLabel(`${prefix} ${wo.woNumber}`)
  }, [wo?.woNumber, wo?.woType, setHeaderLabel])

  // Fetch parts requests linked to this WO by WO number
  useEffect(() => {
    if (!wo?.woNumber || wo.woNumber === "WO-IMPORT") return
    supabase
      .from("parts_requests")
      .select("id, status, created_at, parts_request_lines(id, part_number, description, quantity, line_status, wo_item_id)")
      .eq("work_order", wo.woNumber)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return
        setPartsRequests(data.map(r => ({
          id: r.id,
          status: r.status,
          createdAt: r.created_at,
          lines: ((r as any).parts_request_lines ?? []).map((l: any) => ({
            id: l.id,
            partNumber: l.part_number,
            description: l.description,
            quantity: l.quantity,
            lineStatus: l.line_status,
            woItemId: l.wo_item_id ?? null,
          })),
        })))
      })
      .catch(() => {})
  }, [wo?.woNumber, partsRequestsKey])

  // Fetch Hobbs differential for the WO's aircraft (for times edit modal)
  useEffect(() => {
    if (!wo) return
    const reg = wo.aircraft?.registration ?? wo.guestRegistration
    if (!reg) { setHobbsDiff(null); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from("aircraft_details")
      .select("hobbs_differential")
      .eq("tail_number", reg)
      .maybeSingle()
      .then(({ data }: { data: { hobbs_differential: number | null } | null }) => {
        setHobbsDiff(data?.hobbs_differential != null ? Number(data.hobbs_differential) : null)
      })
      .catch(() => setHobbsDiff(null))
  }, [wo?.id])

  // Fetch billing client for the WO's aircraft (for invoice Bill To section)
  useEffect(() => {
    if (!wo?.aircraftId) { setBillingClient(null); return }
    let cancelled = false
    ;(async () => {
      const { data: ac } = await supabase
        .from("aircraft")
        .select("client_id")
        .eq("id", wo.aircraftId!)
        .maybeSingle()
      if (cancelled) return
      if (!ac?.client_id) { setBillingClient(null); return }
      const { data: c } = await supabase
        .from("clients")
        .select("name, address, address2, city, state, zip, taxable")
        .eq("id", ac.client_id)
        .maybeSingle()
      if (cancelled) return
      setBillingClient(c as typeof billingClient)
    })()
    return () => { cancelled = true }
  }, [wo?.aircraftId])

  const [editingItemId, setEditingItemId]     = useState<string | null>(null)
  const [editingCategoryVal, setEditingCategoryVal] = useState("")
  const [addingToSection, setAddingToSection] = useState<LogbookSection | null>(null)
  const [exchangeSection, setExchangeSection] = useState<LogbookSection | null>(null)
  const [exchangeRemovedSn, setExchangeRemovedSn] = useState("")
  const [exchangeInstalledSn, setExchangeInstalledSn] = useState("")
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false)
  const [newItem, setNewItem] = useState({
    category: "", taskNumber: "", discrepancy: "", correctiveAction: "",
    hours: "", laborRate: "125", shippingCost: "0", outsideServicesCost: "0",
  })
  const [addingPartToItem, setAddingPartToItem] = useState<string | null>(null)
  const [newPart, setNewPart] = useState({ partNumber: "", description: "", qty: "1", unitPrice: "" })
  const [addingLaborToItem, setAddingLaborToItem] = useState<string | null>(null)
  const [newLabor, setNewLabor] = useState({ mechName: "", hours: "", date: localToday() })

  if (loading) {
    const GOLD     = "#d4a017"
    const GOLD_DIM = "rgba(212,160,23,0.18)"
    return (
      <div style={{ position: "fixed", inset: 0, background: "#1a1a1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
        <style>{`
          @keyframes wo-fill {
            from { width: 0%; }
            to   { width: 100%; }
          }
          @keyframes wo-s1 {
            0%        { opacity: 1; }
            28%       { opacity: 1; }
            35%, 100% { opacity: 0; }
          }
          @keyframes wo-s2 {
            0%, 31%   { opacity: 0; }
            38%       { opacity: 1; }
            61%       { opacity: 1; }
            68%, 100% { opacity: 0; }
          }
          @keyframes wo-s3 {
            0%, 64%   { opacity: 0; }
            72%, 100% { opacity: 1; }
          }
          @keyframes wo-dot {
            from { background: ${GOLD_DIM}; box-shadow: none; }
            to   { background: ${GOLD};     box-shadow: 0 0 6px rgba(212,160,23,0.55); }
          }
          @keyframes wo-reveal {
            from { opacity: 0; transform: translateY(5px); }
            to   { opacity: 0.88; transform: translateY(0); }
          }
        `}</style>

        {/* WO number / identifier */}
        <div style={{ marginBottom: "44px", animation: "wo-reveal 0.7s ease forwards", opacity: 0 }}>
          <span style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: GOLD }}>
            Work Order
          </span>
        </div>

        {/* Status labels */}
        <div style={{ position: "relative", width: "240px", height: "13px", marginBottom: "12px", textAlign: "center" }}>
          {(
            [
              { text: "OPENING WORK ORDER", anim: "wo-s1" },
              { text: "LOADING ITEMS",      anim: "wo-s2" },
              { text: "READY",              anim: "wo-s3" },
            ] as const
          ).map(({ text, anim }) => (
            <span
              key={text}
              style={{
                position: "absolute", left: 0, right: 0,
                fontFamily: "'Montserrat', Arial, sans-serif",
                fontSize: "9px", fontWeight: 600,
                letterSpacing: "0.22em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.32)",
                opacity: 0,
                animationName: anim,
                animationDuration: "2.55s",
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
                animationIterationCount: 1,
              }}
            >
              {text}
            </span>
          ))}
        </div>

        {/* Gold progress track */}
        <div style={{ position: "relative", width: "240px", height: "2px", background: "rgba(255,255,255,0.07)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: "0%",
            background: `linear-gradient(90deg, rgba(212,160,23,0.65) 0%, ${GOLD} 100%)`,
            borderRadius: "2px",
            animationName: "wo-fill",
            animationDuration: "2.55s",
            animationTimingFunction: "ease-in-out",
            animationFillMode: "forwards",
            animationIterationCount: 1,
          }} />
        </div>

        {/* Checkpoint dots */}
        <div style={{ position: "relative", width: "240px", height: "14px", marginTop: "2px" }}>
          {([25, 50, 75] as const).map(pct => (
            <div key={pct} style={{
              position: "absolute", top: "4px",
              left: `${pct}%`, transform: "translateX(-50%)",
              width: "4px", height: "4px", borderRadius: "50%",
              background: GOLD_DIM,
              animationName: "wo-dot",
              animationDuration: "0.25s",
              animationTimingFunction: "ease-out",
              animationFillMode: "forwards",
              animationIterationCount: 1,
              animationDelay: `${(pct / 100) * 2.55}s`,
            }} />
          ))}
        </div>
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
  const isLocked      = wo.woType === "quote"
    ? wo.quoteStatus === "converted" || wo.quoteStatus === "declined" || wo.quoteStatus === "expired"
    : wo.woType === "change_order"
      ? wo.quoteStatus === "approved" || wo.quoteStatus === "declined"
      : wo.status === "completed" || wo.status === "void"

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

  // ── Audit trail helper ────────────────────────────────────────────────────────
  function auditLog(params: {
    entryType: string; summary: string; detail?: string | null
    fieldName?: string | null; oldValue?: string | null; newValue?: string | null
    itemId?: string | null; itemNumber?: number | null
  }) {
    if (!wo) return
    // Optimistic: show entry immediately in local state
    const optimistic: AuditEntry = {
      id:          `opt-${Date.now()}-${Math.random()}`,
      workOrderId: wo.id,
      entryType:   params.entryType as AuditEntryType,
      actorId:     myProfile?.id   ?? null,
      actorName:   myProfile?.name ?? null,
      summary:     params.summary,
      detail:      params.detail    ?? null,
      fieldName:   params.fieldName ?? null,
      oldValue:    params.oldValue  ?? null,
      newValue:    params.newValue  ?? null,
      itemId:      params.itemId    ?? null,
      itemNumber:  params.itemNumber ?? null,
      createdAt:   new Date().toISOString(),
    }
    setWO(prev => prev ? { ...prev, auditTrail: [optimistic, ...prev.auditTrail] } : prev)
    // Persist to DB in background (loadWO will later replace the optimistic entry with the real one)
    void addAuditEntry(wo.id, {
      ...params,
      actorId:   myProfile?.id   ?? null,
      actorName: myProfile?.name ?? null,
    })
  }

  // Persist specific fields to DB without a full refetch (no loadWO → no data wipe)
  async function persistItemFields(itemId: string, fields: Partial<WOItem>, oldFields?: Partial<WOItem>) {
    if (isLocked) return
    try {
      await updateWOItemFields(itemId, {
        ...(fields.category            !== undefined && { category: fields.category }),
        ...(fields.discrepancy         !== undefined && { discrepancy: fields.discrepancy }),
        ...(fields.correctiveAction    !== undefined && { correctiveAction: fields.correctiveAction }),
        ...(fields.refCode             !== undefined && { refCode: fields.refCode }),
        ...(fields.estimatedHours      !== undefined && { estimatedHours: fields.estimatedHours }),
        ...(fields.laborRate           !== undefined && { laborRate: fields.laborRate }),
        ...(fields.shippingCost        !== undefined && { shippingCost: fields.shippingCost }),
        ...(fields.outsideServicesCost !== undefined && { outsideServicesCost: fields.outsideServicesCost }),
        ...(fields.itemStatus          !== undefined && { itemStatus: fields.itemStatus }),
        ...(fields.noPartsRequired     !== undefined && { noPartsRequired: fields.noPartsRequired }),
        ...(fields.signOffRequired     !== undefined && { signOffRequired: fields.signOffRequired }),
      })

      if (oldFields) {
        const item = wo?.items.find(i => i.id === itemId)
        // Item status change
        if (fields.itemStatus !== undefined && oldFields.itemStatus !== undefined && fields.itemStatus !== oldFields.itemStatus) {
          auditLog({
            entryType: "item_status_change",
            summary: `Item #${item?.itemNumber ?? "?"} status: ${ITEM_STATUS_CONFIG[oldFields.itemStatus!].label} → ${ITEM_STATUS_CONFIG[fields.itemStatus].label}`,
            oldValue: oldFields.itemStatus, newValue: fields.itemStatus,
            itemId, itemNumber: item?.itemNumber ?? null,
          })
        }
        // Text field changes
        const TEXT_FIELDS: { key: keyof WOItem; label: string; dbName: string }[] = [
          { key: "refCode",          label: "Ref Code",          dbName: "ref_code"          },
          { key: "discrepancy",      label: "Discrepancy",       dbName: "discrepancy"       },
          { key: "correctiveAction", label: "Corrective Action", dbName: "corrective_action" },
        ]
        for (const f of TEXT_FIELDS) {
          const nv = fields[f.key] as string | undefined
          const ov = oldFields[f.key] as string | undefined
          if (nv !== undefined && ov !== undefined && nv !== ov) {
            auditLog({
              entryType: "text_edit",
              summary: `${f.label} edited on Item #${item?.itemNumber ?? "?"}`,
              fieldName: f.dbName, oldValue: ov, newValue: nv,
              itemId, itemNumber: item?.itemNumber ?? null,
            })
          }
        }
      }
    } catch (err) {
      console.error("Failed to save item fields:", err)
    }
  }

  async function handleDeleteItem(item: WOItem) {
    await deleteWOItem(item.id)
    auditLog({
      entryType:  "item_deleted",
      summary:    `Discrepancy item #${item.itemNumber} deleted (${item.discrepancyType ?? "unknown"})`,
      detail:     item.discrepancy || item.category,
      itemId:     item.id,
      itemNumber: item.itemNumber,
    })
    setWO(prev => {
      if (!prev) return prev
      const remaining = prev.items.filter(i => i.id !== item.id)
      return { ...prev, items: remaining }
    })
    setSelectedItemId(prev => {
      if (prev !== item.id) return prev
      const remaining = wo?.items.filter(i => i.id !== item.id) ?? []
      return remaining[0]?.id ?? null
    })
  }

  async function removeLaborEntry(itemId: string, laborId: string) {
    if (isLocked) return
    const item = wo?.items.find(i => i.id === itemId)
    const entry = item?.labor.find(e => e.id === laborId)
    patchItem(itemId, { labor: (item?.labor ?? []).filter(e => e.id !== laborId) })
    await deleteLabor(laborId)
    if (entry) auditLog({
      entryType: "labor_removed",
      summary: `${entry.hours}h labor removed from Item #${item?.itemNumber ?? "?"}`,
      detail: `${entry.mechanicName}`,
      itemId, itemNumber: item?.itemNumber ?? null,
    })
  }

  async function removePartEntry(itemId: string, partId: string) {
    if (isLocked) return
    const item = wo?.items.find(i => i.id === itemId)
    const part = item?.parts.find(p => p.id === partId)
    patchItem(itemId, { parts: (item?.parts ?? []).filter(p => p.id !== partId) })
    await removeItemPart(partId)
    if (part) auditLog({
      entryType: "part_removed",
      summary: `Part ${part.partNumber} removed from Item #${item?.itemNumber ?? "?"}`,
      itemId, itemNumber: item?.itemNumber ?? null,
    })
  }

  async function toggleSignOff(itemId: string, opts: { noLogbook: boolean; digitalSig: boolean } = { noLogbook: false, digitalSig: false }) {
    if (isLocked || !wo) return
    const item = wo.items.find(i => i.id === itemId)
    if (!item) return
    setSignOffError(null)

    if (item.signedOffBy) {
      // Unsign — also remove this item's logbook line so re-signing doesn't stack
      patchItem(itemId, { signedOffBy: null, signedOffAt: null, itemStatus: "done" })
      await clearSignOff(itemId)
      await removeItemLogbookLines(itemId).catch(() => {}) // best-effort
      await loadDraftLogbookEntries()
      auditLog({ entryType: "sign_off_cleared", summary: `Sign-off cleared on Item #${item.itemNumber}`, detail: `Previously signed by ${item.signedOffBy}`, itemId, itemNumber: item.itemNumber })
      return
    }

    try {
      // Flush unsaved text before signing so loadWO() doesn't wipe it
      await updateWOItemFields(itemId, {
        discrepancy: item.discrepancy,
        correctiveAction: item.correctiveAction,
        refCode: item.refCode,
      })

      // Get profile — try full profile first (has cert data), fall back to ID-only
      let profile: Awaited<ReturnType<typeof getMyProfile>> = null
      let profileId: string | null = null
      try {
        profile   = await getMyProfile()
        profileId = profile?.id ?? null
      } catch {
        profileId = await getMyProfileId()
      }

      if (!profileId) {
        setSignOffError("Could not resolve your profile. Make sure you're logged in.")
        return
      }

      await signOffItem(itemId, profileId)
      await loadWO()

      // Build logbook draft entry (skipped when non-logbook)
      if (!opts.noLogbook && id && id !== "wo-traxxall-import") {
        const tech = mechanics.find(m => m.id === profileId)
        // Component install items (category "X — Installation" + serialNumber set)
        // get their own fresh logbook entry — never merged with the section's shared draft.
        const isComponentInstall =
          item.category.endsWith("— Installation") && !!item.serialNumber?.trim()
        const woRef = { id: wo.id, woNumber: wo.woNumber, aircraftId: wo.aircraftId, guestRegistration: wo.guestRegistration, guestSerial: wo.guestSerial, timesSnapshot: wo.timesSnapshot as any }
        const entry = isComponentInstall
          ? await createComponentInstallEntry(woRef, item.logbookSection, item.serialNumber!.trim())
          : await getOrCreateDraftLogbookEntry(woRef, item.logbookSection)
        // When digitalSig = false, leave name blank — signature block is printed and signed by hand.
        // certType/certNumber still stored so the certificate line appears on the printed form.
        const signatory = await upsertEntrySignatory(entry.id, {
          profileId,
          mechanicName: opts.digitalSig ? (profile?.name ?? tech?.name ?? "Unknown") : "",
          certType:     profile?.certType  ?? tech?.certType  ?? null,
          certNumber:   profile?.certNumber ?? tech?.certNumber ?? null,
        })
        const lineText = item.correctiveAction?.trim() || item.category || item.taskNumber || "—"
        await addSignatoryLine(entry.id, lineText, signatory.id, item.id, item.refCode?.trim() ?? "")
        await loadDraftLogbookEntries()
      }
      auditLog({
        entryType: "sign_off",
        summary: `Item #${item.itemNumber} signed off${opts.noLogbook ? " (non-logbook)" : ""}`,
        detail: `Ref: ${item.refCode || "—"} · ${item.category}`,
        itemId, itemNumber: item.itemNumber,
      })
    } catch (err: any) {
      console.error("Sign-off failed:", err)
      setSignOffError(err?.message ?? "Sign-off failed — check console for details")
    }
  }

  // ── Component exchange: create removal + installation items ─────────────────
  async function createExchangeItems(section: LogbookSection) {
    if (!wo) return
    setExchangeSubmitting(true)
    try {
      const baseNumber = wo.items.length
      const removal = await upsertWOItem({
        workOrderId: wo.id, itemNumber: baseNumber + 1,
        category: `${section} — Removal`,
        logbookSection: section,
        taskNumber: null,
        discrepancy: exchangeRemovedSn ? `Remove ${section} S/N ${exchangeRemovedSn}` : `Remove ${section}`,
        correctiveAction: "",
        estimatedHours: 0, laborRate: 125, shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true, itemStatus: "pending",
        serialNumber: exchangeRemovedSn.trim() || null,
      })
      const install = await upsertWOItem({
        workOrderId: wo.id, itemNumber: baseNumber + 2,
        category: `${section} — Installation`,
        logbookSection: section,
        taskNumber: null,
        discrepancy: exchangeInstalledSn ? `Install ${section} S/N ${exchangeInstalledSn}` : `Install ${section}`,
        correctiveAction: "",
        estimatedHours: 0, laborRate: 125, shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true, itemStatus: "pending",
        serialNumber: exchangeInstalledSn.trim() || null,
      })
      // Update snapshot S/N for the section with the incoming serial
      if (exchangeInstalledSn.trim() && wo.timesSnapshot) {
        const snap = { ...(wo.timesSnapshot as any) }
        if (section === "Engine 1")  snap.eng1Serial  = exchangeInstalledSn.trim()
        if (section === "Engine 2")  snap.eng2Serial  = exchangeInstalledSn.trim()
        if (section === "Propeller") snap.propSerial  = exchangeInstalledSn.trim()
        if (section === "APU")       snap.apuSerial   = exchangeInstalledSn.trim()
        await updateWorkOrder(wo.id, { timesSnapshot: snap })
      }
      setWO(prev => prev ? { ...prev, items: [...prev.items, removal, install] } : prev)
      setSelectedItemId(removal.id)
      setExchangeSection(null)
      setExchangeRemovedSn("")
      setExchangeInstalledSn("")
      auditLog({ entryType: "item_created", summary: `Component exchange added for ${section}`, detail: `Removed: ${exchangeRemovedSn || "—"} · Installed: ${exchangeInstalledSn || "—"}` })
    } finally {
      setExchangeSubmitting(false)
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
    auditLog({ entryType: "item_created", summary: `Item #${savedItem.itemNumber} created`, detail: savedItem.category, itemId: savedItem.id, itemNumber: savedItem.itemNumber })
  }

  async function addPart(itemId: string) {
    if (!newPart.partNumber || !newPart.unitPrice) return
    const saved = await addItemPart(itemId, {
      partNumber: newPart.partNumber,
      description: newPart.description,
      qty: parseFloat(newPart.qty) || 1,
      unitPrice: parseFloat(newPart.unitPrice) || 0,
    })
    const item = wo.items.find(i => i.id === itemId)
    patchItem(itemId, { parts: [...(item?.parts ?? []), saved] })
    setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" })
    setAddingPartToItem(null)
    auditLog({
      entryType: "part_added",
      summary: `Part ${saved.partNumber} added to Item #${item?.itemNumber ?? "?"}`,
      detail: `${saved.qty}× ${saved.description || saved.partNumber} @ $${saved.unitPrice.toFixed(2)}`,
      itemId, itemNumber: item?.itemNumber ?? null,
    })
  }

  async function addPartFromInventory(itemId: string, inv: InventoryPart, qty: number = 1) {
    if (!wo) return
    try {
      const saved = await issuePartFromInventory(
        itemId,
        { id: inv.id, partNumber: inv.partNumber, description: inv.description, unitCost: inv.unitCost, catalogId: inv.catalogId, condition: inv.condition },
        qty,
        wo.woNumber,
        { id: myProfile?.id ?? "", name: myProfile?.name ?? "Unknown" }
      )
      const item = wo.items.find(i => i.id === itemId)
      patchItem(itemId, { parts: [...(item?.parts ?? []), saved] })
      auditLog({
        entryType: "part_added",
        summary: `Part ${saved.partNumber} issued from inventory to Item #${item?.itemNumber ?? "?"}`,
        detail: `${saved.qty}× ${saved.description || saved.partNumber} @ $${saved.unitPrice.toFixed(2)}`,
        itemId, itemNumber: item?.itemNumber ?? null,
      })
    } catch (err) {
      console.error("Failed to issue part from inventory:", err)
    }
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
    setNewLabor({ mechName: "", hours: "", date: localToday() })
    setAddingLaborToItem(null)
    auditLog({
      entryType: "labor_added",
      summary: `${saved.hours}h labor logged on Item #${item?.itemNumber ?? "?"}`,
      detail: saved.mechanicName,
      itemId, itemNumber: item?.itemNumber ?? null,
    })
  }

  function triggerSlide(dir: "left" | "right") {
    if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
    setSlideDir(dir)
    slideTimerRef.current = setTimeout(() => setSlideDir(null), 280)
  }

  async function advanceStatus() {
    if (!wo || isTransitioning) return

    // ── Quote branch ───────────────────────────────────────────────────────
    if (wo.woType === "quote") {
      const currentQuote = wo.quoteStatus ?? "draft"
      const next = QUOTE_NEXT_STATUS[currentQuote]
      if (!next) return
      triggerSlide("right")
      setTransitionColor(QUOTE_STATUS_GLOW_COLOR[next])
      setIsTransitioning(true)
      setWO(prev => prev ? { ...prev, quoteStatus: next } : prev)   // optimistic
      try {
        const profileId = await getMyProfileId()
        await updateQuoteStatus(wo.id, next, profileId ?? "", `Advanced to ${QUOTE_STATUS_LABELS[next]}`)
        auditLog({ entryType: "status_change", summary: `Quote status: ${QUOTE_STATUS_LABELS[currentQuote]} → ${QUOTE_STATUS_LABELS[next]}`, oldValue: currentQuote, newValue: next })
      } finally {
        setIsTransitioning(false)
      }
      loadWO()
      return
    }

    const next = NEXT_STATUS[wo.status]
    if (!next) return
    if (wo.status === "draft") { setShowOpenModal(true); return }
    if (next === "completed") { setShowCompleteModal(true); return }
    triggerSlide("right")
    setTransitionColor(STATUS_GLOW_COLOR[next])
    setIsTransitioning(true)
    setWO(prev => prev ? { ...prev, status: next } : prev)   // optimistic
    const fromStatus = wo.status
    try {
      const profileId = await getMyProfileId()
      await updateWorkOrderStatus(wo.id, next, profileId ?? "", `Advanced to ${WO_STATUS_LABELS[next]}`)
      auditLog({ entryType: "status_change", summary: `Status: ${WO_STATUS_LABELS[fromStatus]} → ${WO_STATUS_LABELS[next]}`, oldValue: fromStatus, newValue: next })

      // Auto-generate draft invoice when entering "billing" (work orders only)
      if (next === "billing" && wo.woType === "work_order") {
        try {
          const fullWO = await getWorkOrderById(wo.id)
          if (fullWO) {
            const result = await autoGenerateInvoice(fullWO, profileId ?? "")
            auditLog({ entryType: "wo_created", summary: `Auto-generated invoice ${result.invoiceNumber} ($${result.grandTotal.toFixed(2)}, ${result.lineCount} lines)` })
          }
        } catch (invErr) {
          console.error("Auto-invoice generation failed:", invErr)
        }
      }
    } finally {
      setIsTransitioning(false)
    }
    loadWO()  // background sync — no await, UI already updated
  }

  async function regressStatus() {
    if (!wo || isTransitioning) return

    // ── Quote branch ───────────────────────────────────────────────────────
    if (wo.woType === "quote") {
      const currentQuote = wo.quoteStatus ?? "draft"
      const prev = QUOTE_PREV_STATUS[currentQuote]
      if (!prev) return
      triggerSlide("left")
      setTransitionColor(QUOTE_STATUS_GLOW_COLOR[prev])
      setIsTransitioning(true)
      setWO(w => w ? { ...w, quoteStatus: prev } : w)   // optimistic
      try {
        const profileId = await getMyProfileId()
        await updateQuoteStatus(wo.id, prev, profileId ?? "", `Returned to ${QUOTE_STATUS_LABELS[prev]}`)
        auditLog({ entryType: "status_change", summary: `Quote status: ${QUOTE_STATUS_LABELS[currentQuote]} → ${QUOTE_STATUS_LABELS[prev]}`, oldValue: currentQuote, newValue: prev })
      } finally {
        setIsTransitioning(false)
      }
      loadWO()
      return
    }

    if (wo.status === "completed" && !isSuperAdmin) return
    const prev = PREV_STATUS[wo.status]
    if (!prev) return
    triggerSlide("left")
    setTransitionColor(STATUS_GLOW_COLOR[prev])
    setIsTransitioning(true)
    const fromStatus = wo.status
    setWO(w => w ? { ...w, status: prev } : w)               // optimistic
    try {
      const profileId = await getMyProfileId()
      await updateWorkOrderStatus(wo.id, prev, profileId ?? "", `Returned to ${WO_STATUS_LABELS[prev]}`)
      auditLog({ entryType: "status_change", summary: `Status: ${WO_STATUS_LABELS[fromStatus]} → ${WO_STATUS_LABELS[prev]}`, oldValue: fromStatus, newValue: prev })
    } finally {
      setIsTransitioning(false)
    }
    loadWO()  // background sync — no await, UI already updated
  }

  async function confirmOpen() {
    if (!wo) return
    setShowOpenModal(false)
    triggerSlide("right")
    setTransitionColor(STATUS_GLOW_COLOR["open"])
    setIsTransitioning(true)
    const fromStatus = wo.status
    setWO(w => w ? { ...w, status: "open" } : w)
    try {
      const profileId = await getMyProfileId()
      await updateWorkOrderStatus(wo.id, "open", profileId ?? "", "Work order opened.")
      auditLog({ entryType: "status_change", summary: `Status: Draft → Open`, oldValue: fromStatus, newValue: "open" })
    } finally {
      setIsTransitioning(false)
    }
    loadWO()
  }

  async function handleDeleteDraft() {
    if (!wo) return
    setDeletingDraft(true)
    try {
      await deleteWorkOrder(wo.id)
      navigate("/app/beet-box/work-orders")
    } finally {
      setDeletingDraft(false)
      setShowDeleteDraftModal(false)
    }
  }

  async function handleConvertQuote() {
    if (!wo || wo.woType !== "quote") return
    setConverting(true)
    try {
      const profileId = await getMyProfileId()
      const newWoId = await convertQuoteToWorkOrder(wo.id, profileId ?? "")
      setShowConvertModal(false)
      navigate(`/app/beet-box/work-orders/${newWoId}`)
    } catch (err) {
      console.error("Quote conversion failed:", err)
    } finally {
      setConverting(false)
    }
  }

  async function completeAndGenerate() {
    if (!wo) return
    setShowCompleteModal(false)
    const fromStatus = wo.status
    const profileId = await getMyProfileId()
    await updateWorkOrderStatus(wo.id, "completed", profileId ?? "", "Work order completed and closed.")
    auditLog({ entryType: "status_change", summary: `Status: ${WO_STATUS_LABELS[fromStatus]} → Completed`, oldValue: fromStatus, newValue: "completed" })
    await loadWO()
    setActiveTab("logbook")
  }

  async function completeOnly() {
    if (!wo) return
    setShowCompleteModal(false)
    const fromStatus = wo.status
    const profileId = await getMyProfileId()
    await updateWorkOrderStatus(wo.id, "completed", profileId ?? "", "Work order completed and closed.")
    auditLog({ entryType: "status_change", summary: `Status: ${WO_STATUS_LABELS[fromStatus]} → Completed`, oldValue: fromStatus, newValue: "completed" })
    await loadWO()
  }

  function showSection(s: LogbookSection) {
    if (!visibleSections.includes(s)) setVisibleSections(v => ALL_SECTIONS.filter(x => [...v, s].includes(x)))
  }

  function hideSection(s: LogbookSection) {
    setVisibleSections(v => v.filter(x => x !== s))
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* ── UNIFIED HEADER ────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{
          background: "hsl(0,0%,10%)",
          borderBottom: "1px solid hsl(0,0%,18%)",
        }}
      >
        <div className="flex items-stretch">

          {/* ── Left section — mirrors left rail width ── */}
          <div className="w-72 flex-shrink-0 flex items-center gap-3 px-3 py-4" style={{ borderRight: "1px solid hsl(0,0%,18%)" }}>
            <button
              onClick={() => navigate("/app/beet-box/work-orders")}
              className="text-white/70 hover:text-white transition-colors p-2 rounded-lg flex-shrink-0"
              style={{ border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.05)" }}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col gap-1 min-w-0">
              {(wo.woType === "quote" || wo.woType === "change_order") && wo.quoteStatus && (
                <QuoteStatusBadge status={wo.quoteStatus} className="self-start" />
              )}
              {wo.woType === "change_order" && wo.parentWoId && (
                <button
                  onClick={() => navigate(`/app/beet-box/work-orders/${wo.parentWoId}`)}
                  className="text-[10px] text-amber-300/70 hover:text-amber-300 underline underline-offset-2 text-left"
                >
                  ↩ Back to parent WO
                </button>
              )}
              {wo.woType === "quote" && wo.convertedToWoId && (
                <button
                  onClick={() => navigate(`/app/beet-box/work-orders/${wo.convertedToWoId}`)}
                  className="text-[10px] text-purple-300 hover:text-purple-200 underline underline-offset-2 text-left"
                >
                  Converted → open WO
                </button>
              )}
              {wo.woType === "work_order" && wo.sourceQuoteId && (
                <button
                  onClick={() => navigate(`/app/beet-box/work-orders/${wo.sourceQuoteId}`)}
                  className="text-[10px] text-purple-300 hover:text-purple-200 underline underline-offset-2 text-left"
                >
                  From quote ↗
                </button>
              )}
              {editingDesc ? (
                <input
                  autoFocus
                  className="bg-transparent text-white/60 text-xs border-b border-white/20 outline-none px-1 py-0.5 w-full"
                  placeholder="e.g. Scheduled maintenance, 14-day check…"
                  value={woDesc}
                  onChange={e => setWoDesc(e.target.value)}
                  onBlur={() => {
                    setEditingDesc(false)
                    if (woDesc !== (wo.description ?? "")) {
                      updateWorkOrder(wo.id, { description: woDesc }).then(loadWO).catch(console.error)
                    }
                  }}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setWoDesc(wo.description ?? ""); setEditingDesc(false) } }}
                />
              ) : (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="text-white/40 text-xs hover:text-white/60 transition-colors flex items-start gap-1 text-left group"
                >
                  <span className="whitespace-normal break-words">{woDesc || "Add description…"}</span>
                  <Pencil className="w-2.5 h-2.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100" />
                </button>
              )}
            </div>
          </div>

          {/* ── Right section — triple widget + tabs ── */}
          <div className="flex-1 flex items-center gap-5 px-5 py-4">

            {/* ── Triple status widget ── */}
            {(() => {
              const SC: Record<WOStatus, { text: string; bg: string; border: string; glow: string }> = {
                draft:            { text: "#a1a1aa", bg: "rgba(113,113,122,0.18)", border: "rgba(161,161,170,0.55)", glow: "rgba(161,161,170,0.2)"  },
                open:             { text: "#93c5fd", bg: "rgba(96,165,250,0.14)",  border: "rgba(147,197,253,0.55)", glow: "rgba(147,197,253,0.2)"  },
                waiting_on_parts: { text: "#fcd34d", bg: "rgba(252,211,77,0.13)",  border: "rgba(252,211,77,0.55)",  glow: "rgba(252,211,77,0.2)"   },
                in_review:        { text: "#d8b4fe", bg: "rgba(216,180,254,0.13)", border: "rgba(216,180,254,0.55)", glow: "rgba(216,180,254,0.2)"  },
                billing:          { text: "#fdba74", bg: "rgba(253,186,116,0.13)", border: "rgba(253,186,116,0.55)", glow: "rgba(253,186,116,0.2)"  },
                completed:        { text: "#6ee7b7", bg: "rgba(110,231,183,0.13)", border: "rgba(110,231,183,0.55)", glow: "rgba(110,231,183,0.2)"  },
                void:             { text: "#fca5a5", bg: "rgba(252,165,165,0.13)", border: "rgba(252,165,165,0.55)", glow: "rgba(252,165,165,0.2)"  },
              }

              // Pick the right pipeline based on record type
              const isQuoteMode   = wo.woType === "quote"
              const isCoMode      = wo.woType === "change_order"
              const isApprovalDoc = isQuoteMode || isCoMode
              const currentQuoteStatus: QuoteStatus = wo.quoteStatus ?? "draft"

              const c            = isApprovalDoc ? QUOTE_STATUS_CONFIG[currentQuoteStatus] : SC[wo.status]
              const currentLabel = isApprovalDoc ? QUOTE_STATUS_LABELS[currentQuoteStatus] : WO_STATUS_LABELS[wo.status]

              // COs have no manual status transitions — they move via the approval portal
              const prevKey = isCoMode ? undefined : isQuoteMode ? QUOTE_PREV_STATUS[currentQuoteStatus] : PREV_STATUS[wo.status]
              const nextKey = isCoMode ? undefined : isQuoteMode ? QUOTE_NEXT_STATUS[currentQuoteStatus] : NEXT_STATUS[wo.status]

              const hasPrev = !!prevKey && (!isLocked || isSuperAdmin)
              const hasNext = !!nextKey

              const cp = hasPrev
                ? (isQuoteMode ? QUOTE_STATUS_CONFIG[prevKey as QuoteStatus] : SC[prevKey as WOStatus])
                : null
              const cn2 = hasNext
                ? (isQuoteMode ? QUOTE_STATUS_CONFIG[nextKey as QuoteStatus] : SC[nextKey as WOStatus])
                : null

              const prevLabel = hasPrev
                ? (isQuoteMode ? QUOTE_STATUS_LABELS[prevKey as QuoteStatus] : WO_STATUS_LABELS[prevKey as WOStatus])
                : "—"
              const nextLabel = hasNext
                ? (isQuoteMode ? QUOTE_STATUS_LABELS[nextKey as QuoteStatus] : WO_STATUS_LABELS[nextKey as WOStatus])
                : "—"
              const nextTitle = hasNext
                ? (isQuoteMode ? (QUOTE_NEXT_STATUS_LABEL[currentQuoteStatus] ?? nextLabel) : NEXT_STATUS_LABEL[wo.status])
                : undefined
              const dimBorder = "rgba(255,255,255,0.1)"
              return (
                <div className="flex flex-col items-stretch flex-shrink-0 gap-0">
                  {/* Loading bar — sits above the widget, invisible when idle */}
                  <div style={{ height: "2px", position: "relative", overflow: "hidden", borderRadius: "1px" }}>
                    {isTransitioning && (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: transitionColor,
                        transformOrigin: "left center",
                        animation: "status-bar-fill 1.8s ease-in-out forwards",
                      }} />
                    )}
                  </div>

                  <div className="flex items-center">

                  {/* ← Regress — C-shape opening right, prev status color */}
                  <button
                    onClick={hasPrev && !isTransitioning ? regressStatus : undefined}
                    disabled={!hasPrev || isTransitioning}
                    className="flex flex-col items-center justify-center gap-0.5 transition-all duration-150 hover:brightness-125 active:brightness-90"
                    style={{
                      width: "70px",
                      height: "31px",
                      background: cp ? cp.bg : "rgba(255,255,255,0.02)",
                      borderTop:    `2px solid ${cp ? cp.border : dimBorder}`,
                      borderBottom: `2px solid ${cp ? cp.border : dimBorder}`,
                      borderLeft:   `2px solid ${cp ? cp.border : dimBorder}`,
                      borderRight:  "none",
                      borderTopLeftRadius: "8px",
                      borderBottomLeftRadius: "8px",
                      opacity: hasPrev ? 1 : 0.28,
                    }}
                    title={hasPrev ? `Back to ${prevLabel}` : undefined}
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: cp ? cp.text : "rgba(255,255,255,0.25)" }} />
                    <span className="text-[8px] font-medium uppercase tracking-wider leading-none" style={{ color: cp ? cp.text : "rgba(255,255,255,0.18)" }}>
                      {prevLabel}
                    </span>
                  </button>

                  {/* ● Current status — full rounded rect, taller, z-index raises it over side caps */}
                  <div
                    className="flex items-center gap-2 px-5 hover:brightness-110 relative"
                    style={{
                      width: "139px",
                      height: "43px",
                      background: c.bg,
                      border: `2px solid ${c.border}`,
                      borderRadius: "8px",
                      boxShadow: `inset 0 0 22px ${c.glow}, 0 0 11px ${c.glow}`,
                      zIndex: 1,
                      marginLeft: "-2px",
                      marginRight: "-2px",
                      overflow: "hidden",
                      animation: slideDir === "right"
                        ? "status-slide-right 0.22s ease-out forwards"
                        : slideDir === "left"
                          ? "status-slide-left 0.22s ease-out forwards"
                          : undefined,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: c.text, boxShadow: `0 0 6px ${c.text}, 0 0 11px ${c.glow}` }}
                    />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-50" style={{ color: c.text }}>Status</span>
                      <span className="text-xs font-bold uppercase tracking-widest leading-tight" style={{ color: c.text, fontFamily: "var(--font-heading)" }}>
                        {currentLabel}
                      </span>
                    </div>
                  </div>

                  {/* → Advance — C-shape opening left, next status color */}
                  <button
                    onClick={hasNext && !isTransitioning ? advanceStatus : undefined}
                    disabled={!hasNext || isTransitioning}
                    className="flex flex-col items-center justify-center gap-0.5 transition-all duration-150 hover:brightness-125 active:brightness-90"
                    style={{
                      width: "70px",
                      height: "31px",
                      background: cn2 ? cn2.bg : "rgba(255,255,255,0.02)",
                      borderTop:    `2px solid ${cn2 ? cn2.border : dimBorder}`,
                      borderBottom: `2px solid ${cn2 ? cn2.border : dimBorder}`,
                      borderRight:  `2px solid ${cn2 ? cn2.border : dimBorder}`,
                      borderLeft:   "none",
                      borderTopRightRadius: "8px",
                      borderBottomRightRadius: "8px",
                      opacity: hasNext && !isTransitioning ? 1 : 0.28,
                    }}
                    title={nextTitle}
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: cn2 ? cn2.text : "rgba(255,255,255,0.25)" }} />
                    <span className="text-[8px] font-medium uppercase tracking-wider leading-none" style={{ color: cn2 ? cn2.text : "rgba(255,255,255,0.18)" }}>
                      {nextLabel}
                    </span>
                  </button>

                  </div>{/* end inner flex row */}
                </div>
              )
            })()}

            {/* Waiting on parts — PO shortcut */}
            {wo.status === "waiting_on_parts" && wo.woType === "work_order" && (
              <Button
                variant="ghost" size="sm"
                onClick={() => navigate("/app/beet-box/purchase-orders")}
                className="text-amber-400/80 hover:text-amber-300 border border-amber-900/30 h-8 px-3 text-xs flex-shrink-0"
              >
                Purchase Orders
              </Button>
            )}

            {/* Send CO for Approval — CO mode */}
            {wo.woType === "change_order" && (wo.quoteStatus === "draft" || wo.quoteStatus === "expired") && wo.items.length > 0 && (
              <button
                onClick={() => setShowSendApprovalModal(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
                style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(251,191,36,0.22)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(251,191,36,0.12)")}
              >
                <Mail className="w-3.5 h-3.5" /> Send for Approval
              </button>
            )}

            {/* Convert quote → work order */}
            {wo.woType === "quote" && wo.quoteStatus === "approved" && (
              <button
                onClick={() => setShowConvertModal(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
                style={{ background: "rgba(110,231,183,0.12)", border: "1px solid rgba(110,231,183,0.45)", color: "#6ee7b7" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(110,231,183,0.22)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(110,231,183,0.12)")}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" /> Convert to Work Order
              </button>
            )}

            {/* Status-dependent actions */}
            {wo.woType === "quote" ? (
              <>
                {(wo.quoteStatus === "draft" || wo.quoteStatus === "expired") && wo.items.length > 0 && (
                  <button
                    onClick={() => setShowSendApprovalModal(true)}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
                    style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.45)", color: "#a78bfa" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.22)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.12)")}
                  >
                    <Mail className="w-3.5 h-3.5" /> Send for Approval
                  </button>
                )}
                {wo.quoteStatus === "draft" && (
                  <button
                    onClick={() => setShowDeleteDraftModal(true)}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "rgba(252,165,165,0.8)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.16)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                  >
                    Delete Draft
                  </button>
                )}
              </>
            ) : wo.status === "draft" ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate(`/app/beet-box/work-orders/new?rebuild=${wo.id}`)}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-medium transition-all"
                  style={{ background: "rgba(161,161,170,0.1)", border: "1px solid rgba(161,161,170,0.3)", color: "rgba(212,212,216,0.85)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(161,161,170,0.18)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(161,161,170,0.1)")}
                >
                  <ArrowLeft className="w-3 h-3" /> Return to Builder
                </button>
                <button
                  onClick={() => setShowDeleteDraftModal(true)}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-medium transition-all"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "rgba(252,165,165,0.8)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.16)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                >
                  Delete Draft
                </button>
              </div>
            ) : (
              <button
                onClick={() => setTimesEditOpen(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.3)", color: "rgba(212,160,23,0.85)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}
              >
                <Pencil className="w-3 h-3" /> Edit Times
              </button>
            )}

            {/* ── Tabs ── */}
            <div className="flex-1 flex items-center justify-center gap-1">
              {[
                { id: "items"       as const, label: "Work Items",                                      icon: FileText    },
                { id: "notes"       as const, label: "Notes",                                           icon: StickyNote  },
                ...(wo.woType === "quote" || wo.woType === "change_order"
                  ? []
                  : [{ id: "logbook" as const, label: "Logbook", icon: BookOpen }]),
                { id: "invoice" as const, label: wo.woType === "quote" ? "Quote" : wo.woType === "change_order" ? "Change Order" : "Invoice", icon: Receipt },
                { id: "audit_trail" as const, label: "Audit Trail",                                     icon: ShieldCheck },
              ].map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-all rounded-md",
                      isActive ? "text-white" : "text-white/35 hover:text-white/65 hover:bg-white/[0.04]"
                    )}
                    style={isActive ? { background: "rgba(212,160,23,0.1)", boxShadow: "inset 0 -2px 0 var(--skyshare-gold)" } : {}}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isActive && "text-[var(--skyshare-gold)]")} />
                    {tab.label}
                    {tab.id === "logbook" && draftLogbookEntries.length > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none" style={{ background: "rgba(52,211,153,0.2)", color: "#34d399" }}>
                        {draftLogbookEntries.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

          </div>
        </div>
      </div>

      {/* ── APPROVAL STATUS STRIP (quote/CO after send) ─────────────────────── */}
      {((wo.woType === "quote" && wo.quoteStatus && ["sent","approved","declined","converted"].includes(wo.quoteStatus)) ||
        (wo.woType === "change_order" && wo.quoteStatus && ["sent","approved","declined"].includes(wo.quoteStatus))) && (
        <ApprovalStatusStrip
          workOrderId={wo.id}
          refreshKey={approvalRefreshKey}
          onResend={(name, email) => {
            setResendPrefill({ name, email })
            setShowSendApprovalModal(true)
          }}
        />
      )}

      {/* ── QUOTE / CO TOTALS STRIP ─────────────────────────────────────────── */}
      {(wo.woType === "quote" || wo.woType === "change_order") && (() => {
        const estLabor = wo.items.reduce(
          (s, i) => s + (i.estimatedHours ?? 0) * (i.laborRate ?? 0),
          0,
        )
        const estParts = wo.items.reduce(
          (s, i) => s + i.parts.reduce((ps, p) => ps + (p.unitPrice ?? 0) * (p.qty ?? 0), 0),
          0,
        )
        const estTotal = estLabor + estParts
        const fmt = (n: number) =>
          n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        return (
          <div
            className="flex-shrink-0 flex items-stretch"
            style={{
              background: "linear-gradient(to right, hsl(263,25%,10%), hsl(263,20%,9%))",
              borderBottom: "1px solid rgba(167,139,250,0.2)",
            }}
          >
            <div className="px-5 py-2.5 flex items-center gap-2 flex-shrink-0" style={{ borderRight: "1px solid rgba(167,139,250,0.15)" }}>
              <FileText className="w-3.5 h-3.5 text-purple-300/70" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300/80">Quote Estimate</span>
            </div>
            <div className="flex-1 flex items-center gap-6 px-6 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Est. Labor</span>
                <span className="text-sm font-bold tabular-nums text-blue-300">${fmt(estLabor)}</span>
              </div>
              <div className="w-px h-6 self-center" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Est. Parts</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: "rgba(212,160,23,0.95)" }}>${fmt(estParts)}</span>
              </div>
              <div className="flex-1" />
              <div className="flex items-baseline gap-2 px-4 py-1 rounded-lg" style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)" }}>
                <span className="text-[10px] uppercase tracking-wider text-purple-300/80">Grand Total</span>
                <span className="text-base font-black tabular-nums text-white">${fmt(estTotal)}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">

        {/* ── ITEMS TAB: SPLIT PANEL ──────────────────────────────────────── */}
        {activeTab === "items" && (
          <>
            {/* ── Left rail: always visible ── */}
            <div
              className="w-72 flex-shrink-0 flex flex-col"
              style={{ background: "hsl(0,0%,10.5%)", borderRight: "1px solid hsl(0,0%,18%)" }}
            >

              {/* ── Registration anchor block ── */}
              <style>{`
                @keyframes status-slide-right {
                  from { transform: translateX(36px); opacity: 0; }
                  to   { transform: translateX(0);    opacity: 1; }
                }
                @keyframes status-slide-left {
                  from { transform: translateX(-36px); opacity: 0; }
                  to   { transform: translateX(0);     opacity: 1; }
                }
                @keyframes sign-off-progress {
                  0%   { transform: translateX(-100%); }
                  50%  { transform: translateX(150%); }
                  100% { transform: translateX(-100%); }
                }
                @keyframes status-bar-fill {
                  from { transform: scaleX(0); opacity: 0.55; }
                  to   { transform: scaleX(1); opacity: 0.25; }
                }
                @keyframes reg-glint {
                  0%    { transform: translateX(-220%) skewX(-18deg); opacity: 0; }
                  8%    { opacity: 1; }
                  92%   { opacity: 0.85; }
                  25%   { transform: translateX(280%) skewX(-18deg); opacity: 0; }
                  100%  { transform: translateX(-220%) skewX(-18deg); opacity: 0; }
                }
              `}</style>
              <div
                className="flex-shrink-0 flex items-center justify-center select-none overflow-hidden relative"
                style={{
                  height: "63px",
                  borderBottom: "1px solid hsl(0,0%,17%)",
                  background: "linear-gradient(175deg, hsl(0,0%,14%) 0%, hsl(0,0%,10%) 50%, hsl(0,0%,12%) 100%)",
                }}
              >
                {/* Glint sweep — same mechanic as AircraftInfo cards */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0, bottom: 0, left: 0,
                    width: "38%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), rgba(255,255,255,0.13), rgba(255,255,255,0.07), transparent)",
                    animation: "reg-glint 5.5s linear infinite",
                    pointerEvents: "none",
                  }}
                />
                <span
                  className="font-black leading-none relative"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "3.335rem",
                    letterSpacing: "0.08em",
                    background: "linear-gradient(175deg, #e8f2f8 0%, #c0d2de 18%, #8fa4b2 40%, #7090a0 55%, #90a8b8 72%, #c8dae4 88%, #e0edf4 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    textShadow: "0 1px 0 rgba(255,255,255,0.35), 0 -1px 0 rgba(0,0,0,0.55), 0 3px 6px rgba(0,0,0,0.7), 0 6px 14px rgba(0,0,0,0.35)",
                  }}
                >
                  {aircraft?.registration ?? wo.guestRegistration ?? "—"}
                </span>
              </div>

              {/* ── Scrollable sections list ── */}
              <div className="flex-1 overflow-y-auto pt-3">
              {(() => {
                // Build virtual section list: each real section, immediately followed by
                // any install sub-sections derived from component exchange items.
                type SectionEntry =
                  | { kind: "real";    section: LogbookSection }
                  | { kind: "install"; section: LogbookSection; serial: string }
                const entries: SectionEntry[] = []
                for (const s of visibleSections) {
                  entries.push({ kind: "real", section: s })
                  const serials = [...new Set(
                    wo.items
                      .filter(i => i.logbookSection === s && i.category.endsWith("— Installation") && i.serialNumber?.trim())
                      .map(i => i.serialNumber!)
                  )]
                  for (const serial of serials) entries.push({ kind: "install", section: s, serial })
                }
                return entries.map((entry, entryIdx) => {
                const section = entry.section
                // Real sections exclude installation items; install sections include only theirs
                const sectionItems = entry.kind === "real"
                  ? wo.items.filter(i => i.logbookSection === section && !(i.category.endsWith("— Installation") && i.serialNumber?.trim()))
                  : wo.items.filter(i => i.logbookSection === section && i.category.endsWith("— Installation") && i.serialNumber?.trim() === (entry as any).serial)
                const isInstallSection = entry.kind === "install"
                const installSerial   = isInstallSection ? (entry as any).serial as string : null
                const color = isInstallSection ? "#10b981" : SECTION_COLORS[section]
                // S/N for this section from snapshot, logbook entry, or aircraft record
                const snap = wo.timesSnapshot as any
                const lbEntryForSection = draftLogbookEntries.find(e => e.logbookSection === section)
                const sectionSerial: string | null = isInstallSection ? installSerial :
                  section === "Airframe"  ? (wo.aircraft?.serialNumber ?? null) :
                  section === "Engine 1"  ? (snap?.eng1Serial ?? lbEntryForSection?.guestSerial ?? null) :
                  section === "Engine 2"  ? (snap?.eng2Serial ?? lbEntryForSection?.guestSerial ?? null) :
                  section === "Propeller" ? (snap?.propSerial ?? lbEntryForSection?.guestSerial ?? null) :
                  section === "APU"       ? (snap?.apuSerial  ?? lbEntryForSection?.guestSerial ?? null) : null
                const canExchange = !isLocked && !isInstallSection && ["Engine 1", "Engine 2", "Propeller", "APU"].includes(section)
                const isExchanging = !isInstallSection && exchangeSection === section
                const entryKey = isInstallSection ? `${section}__install__${installSerial}` : section

                const isCollapsed = collapsedSections.has(entryKey)
                const toggleCollapse = () => setCollapsedSections(prev => {
                  const next = new Set(prev)
                  next.has(entryKey) ? next.delete(entryKey) : next.add(entryKey)
                  return next
                })

                return (
                  <div key={entryKey} className={entryIdx > 0 ? "mt-2" : ""}>
                    <div
                      className="px-3 py-2 flex items-center gap-2 sticky top-0 z-10 cursor-pointer select-none"
                      onClick={toggleCollapse}
                      style={{
                        background: isInstallSection
                          ? `linear-gradient(to right, rgba(16,185,129,0.14), hsl(0,0%,11%))`
                          : `linear-gradient(to right, ${color}18, hsl(0,0%,11%))`,
                        borderBottom: "1px solid hsl(0,0%,18%)",
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      {/* Collapse chevron */}
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4 flex-shrink-0 text-white/40" />
                        : <ChevronDown  className="w-4 h-4 flex-shrink-0 text-white/40" />
                      }

                      {isInstallSection ? (
                        <>
                          <ArrowLeftRight className="w-3 h-3 flex-shrink-0" style={{ color: "#10b981" }} />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] leading-none mb-0.5" style={{ color: "rgba(16,185,129,0.55)" }}>
                              {section} — Incoming
                            </span>
                            <span className="text-xs font-mono font-bold truncate" style={{ color: "#10b981" }}>
                              S/N {installSerial}
                            </span>
                          </div>
                          <span
                            className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: "rgba(16,185,129,0.12)", color: "rgba(16,185,129,0.6)", border: "1px solid rgba(16,185,129,0.22)" }}
                          >
                            New Logbook
                          </span>
                          <span className="text-white/40 text-xs font-mono ml-1 flex-shrink-0">{sectionItems.length}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-bold uppercase tracking-widest flex-shrink-0" style={{ color }}>{section}</span>
                          {sectionSerial && (
                            <span className="text-white/30 text-[10px] font-mono truncate" title={`S/N ${sectionSerial}`}>
                              S/N {sectionSerial}
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            {canExchange && (
                              <button
                                onClick={() => {
                                  if (isExchanging) { setExchangeSection(null) }
                                  else { setExchangeSection(section); setExchangeRemovedSn(sectionSerial ?? ""); setExchangeInstalledSn("") }
                                }}
                                title="Component Exchange"
                                className={`transition-colors rounded p-0.5 ${isExchanging ? "text-sky-400" : "text-white/20 hover:text-white/50"}`}
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                              </button>
                            )}
                            <span className="text-white/40 text-xs font-mono">{sectionItems.length}</span>
                            {!isLocked && sectionItems.length === 0 && (
                              <button
                                onClick={() => hideSection(section)}
                                title={`Remove ${section} section`}
                                className="text-white/15 hover:text-red-400/70 transition-colors rounded p-0.5 ml-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* ── Collapsible body ── */}
                    {!isCollapsed && <>

                    {/* ── Component Exchange panel ── */}
                    {isExchanging && (
                      <div className="mx-3 my-2 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.05)" }}>
                        <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(96,165,250,0.15)", background: "rgba(96,165,250,0.08)" }}>
                          <ArrowLeftRight className="w-3 h-3 text-sky-400" />
                          <span className="text-sky-300 text-xs font-bold uppercase tracking-wider">Component Exchange</span>
                        </div>
                        <div className="px-4 py-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white/40 text-[10px] w-16 flex-shrink-0">Removing</span>
                            <input
                              type="text"
                              value={exchangeRemovedSn}
                              onChange={e => setExchangeRemovedSn(e.target.value)}
                              placeholder="S/N going off"
                              className="flex-1 text-xs font-mono text-white bg-black/20 rounded px-2 py-1.5 focus:outline-none border border-white/10 focus:border-white/25 placeholder:text-white/20"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/40 text-[10px] w-16 flex-shrink-0">Installing</span>
                            <input
                              type="text"
                              value={exchangeInstalledSn}
                              onChange={e => setExchangeInstalledSn(e.target.value)}
                              placeholder="S/N coming on"
                              className="flex-1 text-xs font-mono text-white bg-black/20 rounded px-2 py-1.5 focus:outline-none border border-white/10 focus:border-white/25 placeholder:text-white/20"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => createExchangeItems(section)}
                              disabled={exchangeSubmitting}
                              className="flex-1 text-xs font-bold py-1.5 rounded-lg transition-all disabled:opacity-50"
                              style={{ background: "rgba(96,165,250,0.2)", border: "1px solid rgba(96,165,250,0.4)", color: "#93c5fd" }}
                            >
                              {exchangeSubmitting ? "Creating…" : "Create Exchange Items"}
                            </button>
                            <button
                              onClick={() => setExchangeSection(null)}
                              className="text-white/30 hover:text-white/60 text-xs px-2 py-1.5 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {(() => {
                      const renderItem = (item: WOItem) => {
                        const cfg = ITEM_STATUS_CONFIG[item.itemStatus ?? "pending"]
                        const Icon = cfg.icon
                        const isSelected = selectedItemId === item.id
                        const isEditingThis = editingItemId === item.id
                        const pencilColor = item.signedOffBy
                          ? "text-emerald-500"
                          : (!item.refCode?.trim() || item.itemStatus !== "done")
                            ? "text-amber-400/70"
                            : "text-white/25"
                        const pencilTitle = item.signedOffBy
                          ? "Signed off — click to rename"
                          : item.itemStatus !== "done"
                            ? "Set status to Done to sign off — click to rename"
                            : !item.refCode?.trim()
                              ? "Needs Ref / Task Code to sign off — click to rename"
                              : "Click to rename"
                        return (
                          <div
                            key={item.id}
                            onClick={() => { if (!isEditingThis) { setSelectedItemId(item.id); setAddingToSection(null) } }}
                            style={isSelected ? {
                              background: "linear-gradient(to right, rgba(212,160,23,0.12), rgba(212,160,23,0.03))",
                              borderLeft: "3px solid var(--skyshare-gold)",
                            } : {}}
                            className={cn(
                              "w-full text-left px-4 py-3 flex items-center gap-2.5 transition-all border-l-[3px] cursor-pointer",
                              isSelected ? "border-l-transparent" : "border-l-transparent hover:bg-white/[0.04]"
                            )}
                          >
                            <Icon className={cn("w-4 h-4 flex-shrink-0", cfg.color)} />
                            <span className="text-white/30 text-xs font-mono flex-shrink-0 w-4 text-right">
                              {item.itemNumber}
                            </span>
                            {isEditingThis ? (
                              <input
                                autoFocus
                                value={editingCategoryVal}
                                onChange={e => setEditingCategoryVal(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur() }}
                                onBlur={() => {
                                  const trimmed = editingCategoryVal.trim()
                                  if (trimmed && trimmed !== item.category) {
                                    patchItem(item.id, { category: trimmed })
                                    persistItemFields(item.id, { category: trimmed }, { category: item.category })
                                  }
                                  setEditingItemId(null)
                                }}
                                onClick={e => e.stopPropagation()}
                                className="flex-1 min-w-0 text-sm font-medium text-white bg-white/[0.08] rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-white/20"
                              />
                            ) : (
                              <span
                                className={cn(
                                  "text-sm flex-1 truncate leading-snug",
                                  isSelected ? "text-white font-medium" : "text-white/65",
                                  wo.woType === "quote" && item.customerApprovalStatus === "declined" && "line-through opacity-50",
                                )}
                              >
                                {item.category}
                              </span>
                            )}
                            {wo.woType === "quote" && item.customerApprovalStatus === "approved" && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-label="Customer approved" />
                            )}
                            {wo.woType === "quote" && item.customerApprovalStatus === "declined" && (
                              <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" aria-label="Customer declined" />
                            )}
                            {item.discrepancyType === "airworthy" && (
                              <span
                                className="flex-shrink-0 text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded"
                                style={{ background: "rgba(193,2,48,0.15)", color: "#ff6b81" }}
                              >
                                AW
                              </span>
                            )}
                            {item.discrepancyType === "recommendation" && (
                              <span
                                className="flex-shrink-0 text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded"
                                style={{ background: "rgba(212,160,23,0.15)", color: "#d4a017" }}
                              >
                                REC
                              </span>
                            )}
                            {!isLocked && (
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setSelectedItemId(item.id)
                                  setAddingToSection(null)
                                  setEditingItemId(item.id)
                                  setEditingCategoryVal(item.category)
                                }}
                                title={pencilTitle}
                                className={cn("flex-shrink-0 transition-colors hover:text-white/70", pencilColor)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      }

                      return (
                        <>
                          {sectionItems.map(renderItem)}

                          {sectionItems.length === 0 && (
                            <p className="px-4 py-2 text-white/20 text-xs italic">No items</p>
                          )}

                          {/* Install sections are populated only via Component Exchange — no manual Add item */}
                          {!isLocked && !isInstallSection && (
                            <button
                              onClick={() => { setAddingToSection(addingToSection === section ? null : section); setSelectedItemId(null) }}
                              className="w-full text-left px-4 py-2 flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add item
                            </button>
                          )}
                        </>
                      )
                    })()}

                    </>}{/* end !isCollapsed */}
                  </div>
                )
              })
              })()}

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
              {/* ── Change Orders (WO mode only) ── */}
              {wo.woType === "work_order" && (
                <ChangeOrdersPanel parentWoId={wo.id} refreshKey={coRefreshKey} />
              )}

              </div>{/* end scrollable sections */}
            </div>{/* end left rail */}

            {/* Right panel: item detail / add form / empty state */}
            <div className="flex-1 min-w-0 overflow-y-auto pt-3">
              {selectedItem && !addingToSection ? (
                <>
                  <ItemDetailPanel
                    item={selectedItem}
                    isLocked={isLocked}
                    isQuote={wo.woType !== "work_order"}
                    sectionColor={SECTION_COLORS[selectedItem.logbookSection]}
                    aircraftModel={[aircraft?.make, aircraft?.modelFull].filter(Boolean).join(" ")}
                    mechanicName={myProfile?.name ?? ""}
                    onPatch={patch => patchItem(selectedItem.id, patch)}
                    onPersist={fields => persistItemFields(selectedItem.id, fields)}
                    onSignOff={opts => toggleSignOff(selectedItem.id, opts)}
                    signOffError={signOffError}
                    onClearSignOffError={() => setSignOffError(null)}
                    onDeleteLabor={id => removeLaborEntry(selectedItem.id, id)}
                    onDeletePart={id => removePartEntry(selectedItem.id, id)}
                    mechanics={mechanics}
                    inventoryParts={inventoryParts}
                    onNavigatePO={() => { setOrderPartsForItem({ id: selectedItem.id, itemNumber: selectedItem.itemNumber }); setOrderPartsOpen(true) }}
                    onShowPartsOverview={() => setPartsOverviewOpen(true)}
                    allItems={wo.items}
                    itemPartsOnOrder={partsRequests.flatMap(req =>
                      req.lines
                        .filter(l => l.woItemId === selectedItem.id)
                        .map(l => ({ requestId: req.id, status: req.status, partNumber: l.partNumber, description: l.description, quantity: l.quantity, lineStatus: l.lineStatus }))
                    )}
                    pullPartNumber={pullPartNumber ?? undefined}
                    onPullHandled={() => setPullPartNumber(null)}
                    addingPartToItem={addingPartToItem}
                    setAddingPartToItem={setAddingPartToItem}
                    newPart={newPart}
                    setNewPart={setNewPart}
                    onAddPart={() => addPart(selectedItem.id)}
                    onAddFromInventory={(inv, qty) => addPartFromInventory(selectedItem.id, inv, qty)}
                    addingLaborToItem={addingLaborToItem}
                    setAddingLaborToItem={setAddingLaborToItem}
                    newLabor={newLabor}
                    setNewLabor={setNewLabor}
                    onAddLabor={() => addLaborEntry(selectedItem.id)}
                    onFoundDiscrepancy={
                      wo.woType === "work_order" && !selectedItem.parentItemId && profile?.role !== "Viewer"
                        ? () => setDiscrepancyForItem(selectedItem)
                        : undefined
                    }
                    onChangeOrders={
                      wo.woType === "work_order" && wo.items.some(i => i.parentItemId && i.customerApprovalStatus === "pending")
                        ? () => setShowCreateCOModal(true)
                        : undefined
                    }
                    onDeleteItem={
                      wo.woType === "work_order" &&
                      selectedItem.parentItemId &&
                      !isLocked &&
                      (profile?.role === "Manager" || profile?.role === "Admin" || profile?.role === "Super Admin")
                        ? () => handleDeleteItem(selectedItem)
                        : undefined
                    }
                  />
                </>
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
                /* ── Default view: hint ── */
                <div className="flex items-center gap-3 px-6 py-4 text-white/20 select-none">
                  <FileText className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">Select a work item · or click "Add item" under any section</p>
                </div>
              )}

            </div>
          </>
        )}

        {/* ── Temp: WO stats below items panel ─────────────────────────────── */}
        {activeTab === "items" && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 px-6 py-2.5 text-sm flex-shrink-0"
            style={{ background: "hsl(0,0%,9%)", borderTop: "1px solid hsl(0,0%,18%)" }}
          >
            <span style={{ color: "var(--skyshare-gold)" }} className="font-bold">{aircraft?.registration ?? wo.guestRegistration ?? "—"}</span>
            <span className="text-white/50">{wo.items.length} items · {totalHours.toFixed(1)} hrs</span>
            <span className="text-white font-semibold">${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            {(itemsDone > 0 || itemsInProgress > 0 || itemsReview > 0) && (
              <div className="flex items-center gap-2">
                {itemsDone > 0       && <span className="text-emerald-400">✓{itemsDone}</span>}
                {itemsInProgress > 0 && <span className="text-blue-400">●{itemsInProgress}</span>}
                {itemsReview > 0     && <span className="text-amber-400">⚠{itemsReview}</span>}
              </div>
            )}
          </div>
        )}

        {/* ── AUDIT TRAIL TAB ─────────────────────────────────────────────────── */}
        {activeTab === "audit_trail" && (
          <AuditTrailPanel entries={wo.auditTrail} />
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
                {/* RTS label — stacked two rows */}
                <div className="flex flex-col leading-none select-none font-bold" style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
                  <span>RTS</span>
                  <span className="mt-0.5">Statement</span>
                </div>
                {logbookDraftError && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(239,68,68,0.9)" }}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{logbookDraftError}</span>
                    <button onClick={() => setLogbookDraftError(null)} className="opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>
                  </div>
                )}
                {draftLogbookEntries.length > 0 && (
                  <select
                    value={lbEdit(draftLogbookEntries[0].id).rtsKey}
                    onChange={e => {
                      const key = e.target.value
                      draftLogbookEntries.forEach(entry => selectRtsTemplate(entry.id, wo.aircraftId, key))
                    }}
                    className="h-6 rounded text-[11px] text-white/75 focus:outline-none cursor-pointer"
                    style={{ background: "hsl(0 0% 16%)", border: "1px solid hsl(0 0% 28%)", colorScheme: "dark", padding: "0 22px 0 8px", fontFamily: "var(--font-heading)", letterSpacing: "0.02em" }}
                  >
                    {RTS_TEMPLATES.map(t => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                )}
              </div>
              {draftLogbookEntries.length > 0 && (
                <Button
                  size="sm" variant="ghost"
                  disabled={pdfExporting === "logbook"}
                  onClick={() => handlePreviewPdf("logbook", wo.woNumber)}
                  className="flex items-center gap-2 text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 h-8 px-3 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  {pdfExporting === "logbook" ? "Generating…" : "Preview PDF"}
                </Button>
              )}
            </div>

            {draftLogbookEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/25">
                {logbookCreating ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Preparing draft logbook…</p>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-12 h-12" />
                    <p className="text-lg">No logbook entries</p>
                  </>
                )}
              </div>
            ) : (
              /* Page wrapper — dark bg; each entry card is white, captured individually by html2canvas */
              <div ref={logbookPrintRef} className="px-14 py-8 space-y-0" style={{ background: "hsl(0,0%,14%)" }}>
                {(() => {
                  const sectionsWithItems = new Set(wo?.items.map(i => i.logbookSection) ?? [])
                  const ORDER = ["Airframe", "Engine 1", "Engine 2", "Propeller", "APU", "Other"]
                  return [...draftLogbookEntries]
                    .filter(e => sectionsWithItems.has(e.logbookSection))
                    .sort((a, b) => (ORDER.indexOf(a.logbookSection) + 1 || 999) - (ORDER.indexOf(b.logbookSection) + 1 || 999))
                })().map((entry, idx) => {
                  const edits  = lbEdit(entry.id)
                  const reg    = wo.aircraft?.registration ?? wo.guestRegistration ?? ""
                  const rts    = edits.returnToService || DEFAULT_RTS_TEXT
                  const sigs   = entry.signatories.length > 0 ? entry.signatories : [null]

                  // Section-aware left-column fields
                  const isEngine = entry.logbookSection === "Engine 1" || entry.logbookSection === "Engine 2"
                  const isProp   = entry.logbookSection === "Propeller"
                  const isAPU    = entry.logbookSection === "APU"
                  const leftFields: { label: string; value: string }[] = isEngine ? [
                    { label: "ENG MFR:",   value: wo.aircraft?.engineManufacturer || "—" },
                    { label: "ENG MDL:",   value: wo.aircraft?.engineModel        || "—" },
                    { label: "ENG S/N:",   value: entry.guestSerial               || "—" },
                  ] : isProp ? [
                    { label: "PROP MFR:",  value: "—" },
                    { label: "PROP MDL:",  value: "—" },
                    { label: "PROP S/N:",  value: entry.guestSerial               || "—" },
                  ] : isAPU ? [
                    { label: "APU MFR:",   value: "—" },
                    { label: "APU MDL:",   value: "—" },
                    { label: "APU S/N:",   value: entry.guestSerial               || "—" },
                  ] : [
                    { label: "MAKE:",      value: wo.aircraft?.make        || "—" },
                    { label: "MODEL:",     value: wo.aircraft?.modelFull   || "—" },
                    { label: "S/N:",       value: wo.aircraft?.serialNumber ?? wo.guestSerial ?? "—" },
                  ]

                  return (
                    <Fragment key={entry.id}>
                      {idx > 0 && (
                        <div className="flex items-center gap-2.5 py-5 px-2 select-none" aria-hidden>
                          <div className="flex-1" style={{ borderTop: "1px dashed rgba(255,255,255,0.10)" }} />
                          <ChevronsDown className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.18)" }} />
                          <span style={{ fontFamily: "var(--font-heading)", fontSize: "9px", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>
                            page break · {entry.logbookSection}
                          </span>
                          <ChevronsDown className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.18)" }} />
                          <div className="flex-1" style={{ borderTop: "1px dashed rgba(255,255,255,0.10)" }} />
                        </div>
                      )}

                    <div
                      data-lb-page
                      className="bg-white border-t-4 border-b-4 border-black text-[12px]"
                      style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#111" }}
                    >
                      {/* ── Top strip: WO# + date left, page right ── */}
                      <div className="flex justify-between items-baseline px-5 py-1.5 text-[10px]" style={{ borderBottom: "2px solid #9ca3af", marginLeft: "22px", marginRight: "22px" }}>
                        <span className="font-semibold">{wo.woNumber} ({entry.entryDate})</span>
                        <span className="text-gray-500">Page 1 / 1</span>
                      </div>

                      {/* ── Three-column header ── */}
                      <div className="flex items-stretch p-[18px] gap-4 border-b-4 border-black" style={{ borderLeftWidth: 0, borderRightWidth: 0, marginLeft: "22px", marginRight: "22px" }}>

                        {/* Left: section-aware aircraft/component fields */}
                        <div className="flex-1 text-[11px] space-y-0.5">
                          {leftFields.map(r => (
                            <div key={r.label} className="flex gap-1.5 leading-[1.6]">
                              <span className="font-semibold w-20 flex-shrink-0">{r.label}</span>
                              <span className="text-gray-800">{r.value}</span>
                            </div>
                          ))}
                        </div>

                        {/* Center: company top, registration pinned to bottom near the dividing line */}
                        <div className="flex-1 flex flex-col items-center text-center justify-between">
                          <div>
                            <div className="font-bold text-[14px] leading-tight">CB Aviation, Inc.</div>
                            <div className="text-[10px] text-gray-600 leading-tight">dba SkyShare</div>
                            <div className="text-[10px] text-gray-600 leading-tight mt-0.5">3715 Airport Rd. · Ogden, UT 84116</div>
                          </div>
                          <div className="font-black uppercase pb-0.5" style={{ fontSize: "22px", letterSpacing: "0.18em", color: "#111" }}>{reg || "—"}</div>
                        </div>

                        {/* Right: stacked WO fields + editable times */}
                        <div className="flex-1 text-[11px] space-y-0.5 text-right">
                          <div className="flex justify-end gap-1.5 leading-[1.6]">
                            <span className="font-semibold">W/O #:</span>
                            <span>{wo.woNumber}</span>
                          </div>
                          <div className="flex justify-end gap-1.5 leading-[1.6]">
                            <span className="font-semibold">DATE:</span>
                            <span>{entry.entryDate}</span>
                          </div>
                          {([
                            {
                              label: isEngine ? "ENG TT:" : isProp ? "PROP TT:" : isAPU ? "APU HRS:" : "A/C TT:",
                              field: "aircraftTime" as const,
                              dbField: "totalAircraftTime" as const,
                              inputMode: "decimal" as const,
                            },
                            {
                              label: isEngine || isProp ? "Cycles:" : isAPU ? "Starts:" : "Landings:",
                              field: "landings" as const,
                              dbField: "landings" as const,
                              inputMode: "numeric" as const,
                            },
                            {
                              label: "Hobbs:",
                              field: "hobbs" as const,
                              dbField: "hobbs" as const,
                              inputMode: "decimal" as const,
                            },
                          ]).map(f => (
                            <div key={f.field} className="flex items-center justify-end gap-1.5 leading-[1.6]">
                              <span className="font-semibold">{f.label}</span>
                              <input
                                type="text" inputMode={f.inputMode} placeholder="—"
                                value={edits[f.field]}
                                onChange={e => setLbField(entry.id, f.field, e.target.value)}
                                onBlur={e => {
                                  const v = e.target.value === "" ? undefined : parseFloat(e.target.value)
                                  updateLogbookEntry(entry.id, { [f.dbField]: v }).catch(console.error)
                                }}
                                style={{ width: "56px", border: "none", borderBottom: "1px solid #999", background: "transparent", fontSize: "11px", outline: "none", color: "#111", padding: "0 2px", textAlign: "right" }}
                              />
                            </div>
                          ))}
                        </div>

                      </div>

                      {/* ── Section title + entries ── */}
                      <div className="p-[18px]">
                        <h2 className="font-bold text-[13px] uppercase tracking-wide mb-2">
                          {entry.sectionTitle || `${entry.logbookSection} Entries`}
                        </h2>

                        {entry.lines.length === 0 ? (
                          <p className="text-[12px] italic text-gray-400 py-2">
                            Sign off work order items to populate this logbook page.
                          </p>
                        ) : (
                          <div>
                            {/* Column headers */}
                            <div className="grid text-[9px] uppercase tracking-widest text-gray-400 font-semibold mb-1"
                              style={{ gridTemplateColumns: "32px 99px 1fr" }}>
                              <div className="text-center">Item</div>
                              <div className="text-center">Code</div>
                              <div />
                            </div>
                            {/* Rows — no row separators */}
                            {entry.lines.map(line => (
                              <div
                                key={line.id}
                                className="grid py-1"
                                style={{ gridTemplateColumns: "32px 99px 1fr" }}
                              >
                                <div className="text-[12px] text-center">{line.lineNumber}</div>
                                <div className="text-[12px] font-bold font-mono text-gray-700 text-center break-all leading-snug pt-px">{line.refCode}</div>
                                <div className="text-[12px] leading-relaxed pl-2">{line.text}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ── Certification block ── */}
                      <div className="p-[18px] bg-gray-50" style={{ borderTop: "4px solid #111", marginLeft: "22px", marginRight: "22px" }}>
                        <div className="bg-white border-2 border-gray-300 p-3 mb-2">
                          <p className="text-[10px] leading-snug italic text-gray-700">{rts}</p>
                        </div>

                        {/* Signature rows */}
                        {sigs.map((sig, si) => (
                          <div
                            key={sig?.id ?? "blank"}
                            style={{ borderTop: si > 0 ? "1px dashed #ccc" : "none", paddingTop: si > 0 ? "10px" : 0, marginTop: si > 0 ? "10px" : 0 }}
                          >
                            {/* Four-column horizontal signature bar */}
                            <div className="grid gap-3 text-[10px]" style={{ gridTemplateColumns: "90px 1fr 1.6fr 144px" }}>

                              {/* 1 — Date */}
                              <div className="flex flex-col justify-end">
                                <div className="font-semibold text-[8px] uppercase tracking-widest text-gray-400 mb-1">Date</div>
                                <div style={{ borderBottom: "1.5px solid #444", paddingBottom: "2px" }} className="font-semibold text-[11px]">
                                  {entry.entryDate}
                                </div>
                              </div>

                              {/* 2 — Name (printed) */}
                              <div className="flex flex-col justify-end">
                                <div className="font-semibold text-[8px] uppercase tracking-widest text-gray-400 mb-1">Name (print)</div>
                                <div style={{ borderBottom: "1.5px solid #444", paddingBottom: "2px" }} className="font-semibold text-[11px]">
                                  {sig?.mechanicName || ""}
                                </div>
                              </div>

                              {/* 3 — Digital Signature */}
                              <div className="flex flex-col justify-end">
                                <div className="font-semibold text-[8px] uppercase tracking-widest text-gray-400 mb-1 flex items-center gap-1.5">
                                  Signature
                                  {sig?.mechanicName && (
                                    <span className="text-[7px] font-normal normal-case tracking-normal px-1.5 py-px rounded-full" style={{ background: "rgba(52,211,153,0.15)", color: "rgba(52,211,153,0.85)" }}>
                                      digitally signed
                                    </span>
                                  )}
                                </div>
                                <div style={{ borderBottom: "1.5px solid #444", paddingBottom: "2px", minHeight: "25px", display: "flex", alignItems: "flex-end" }}>
                                  {sig?.mechanicName && (
                                    <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: "23px", lineHeight: 1, color: "#1a2e4a", letterSpacing: "0.02em" }}>
                                      {sig.mechanicName}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* 4 — Certificate */}
                              <div className="flex flex-col justify-end">
                                <div className="font-semibold text-[8px] uppercase tracking-widest text-gray-400 mb-1">Certificate</div>
                                <div style={{ borderBottom: "1.5px solid #444", paddingBottom: "2px" }} className="font-semibold text-[11px]">
                                  {sig?.certType && sig.certNumber
                                    ? `${sig.certType} ${sig.certNumber}`
                                    : sig?.certType ?? "A&P"}
                                </div>
                              </div>

                            </div>

                            {/* W/O + page — flush right, below sig bar */}
                            <div className="flex justify-end items-center gap-3 mt-1.5 text-[9px] text-gray-500">
                              <span className="font-semibold text-[10px] text-gray-700">W/O {wo.woNumber}</span>
                              <span>Page 1 / 1</span>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                    </Fragment>
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
              <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid hsl(0,0%,20%)" }}>
                <span className="text-white/45 text-xs uppercase tracking-wider font-semibold">
                  {wo.woType === "quote" ? "Customer Quote Preview" : "Customer Invoice Preview"}
                </span>
                <Button
                  size="sm" variant="ghost"
                  disabled={pdfExporting === "invoice"}
                  onClick={() => handlePreviewPdf("invoice", wo.woNumber)}
                  className="flex items-center gap-2 text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 h-8 px-3 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  {pdfExporting === "invoice" ? "Generating…" : "Preview PDF"}
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
                      <span style={{ fontWeight: 700, fontSize: "13px" }}>
                        {wo.woType === "quote" ? "Customer Quote:" : "Customer Invoice:"} {wo.woNumber}
                      </span>
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
                        <div style={{ marginTop: "8px" }}>
                          {billingClient ? (
                            <>
                              <p style={{ fontWeight: 700 }}>
                                Bill to: {billingClient.name}
                                {billingClient.taxable && (
                                  <span style={{ marginLeft: 6, fontSize: "9px", fontWeight: 700, padding: "1px 5px", border: "1px solid #b8860b", color: "#b8860b", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    Taxable
                                  </span>
                                )}
                              </p>
                              {[billingClient.address, billingClient.address2].filter(Boolean).length > 0 && (
                                <p style={{ color: "#444" }}>{[billingClient.address, billingClient.address2].filter(Boolean).join(", ")}</p>
                              )}
                              {[billingClient.city, billingClient.state, billingClient.zip].filter(Boolean).length > 0 && (
                                <p style={{ color: "#444" }}>{[billingClient.city, billingClient.state, billingClient.zip].filter(Boolean).join(", ")}</p>
                              )}
                            </>
                          ) : (
                            <p>Bill to: — no client assigned —</p>
                          )}
                        </div>
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
                      <span style={{ fontWeight: 700, fontSize: "13px" }}>
                        {wo.woType === "quote" ? "Customer Quote:" : "Customer Invoice:"} {wo.woNumber}
                      </span>
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
                        {(wo.woType === "quote"
                          ? [
                              { label: "Estimated Labor:",    val: $f(laborTotal),    bold: false },
                              { label: "Estimated Parts:",    val: $f(partsTotal),    bold: false },
                              { label: "Estimated Shipping:", val: $f(shippingTotal), bold: false },
                              { label: "Additional Charges:", val: $f(shopSupplies),  bold: false },
                              { label: "Tax:",                val: $f(taxTotal),      bold: false },
                              { label: "Estimated Total:",    val: $f(amountCharged), bold: true  },
                            ]
                          : [
                              { label: "Total Shop Labor:",   val: $f(laborTotal),    bold: false },
                              { label: "Total Parts:",        val: $f(partsTotal),    bold: false },
                              { label: "Total Shipping:",     val: $f(shippingTotal), bold: false },
                              { label: "Additional Charges:", val: $f(shopSupplies),  bold: false },
                              { label: "Tax:",                val: $f(taxTotal),      bold: false },
                              { label: "Amount Charged:",     val: $f(amountCharged), bold: false },
                              { label: "Amount Paid:",        val: "$0.00",           bold: false },
                              { label: "Amount Due:",         val: $f(amountCharged), bold: true  },
                            ]
                        ).map(r => (
                          <div key={r.label} style={{ display: "flex", justifyContent: "flex-end", gap: "8px", fontWeight: r.bold ? 700 : 400 }}>
                            <span>{r.label}</span>
                            <span style={{ minWidth: "72px", textAlign: "right" }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Important Information */}
                    {wo.woType === "quote" ? (
                      <div style={{ textAlign: "center", marginBottom: "16px" }}>
                        <p style={{ fontWeight: 700, marginBottom: "4px" }}>Quote Terms</p>
                        <p>This quote is an estimate of anticipated charges and is valid for 30 days from the printed date.</p>
                        <p>Actual costs may vary based on conditions discovered during the course of work.</p>
                        <p>Core fees may apply and are the responsibility of the customer.</p>
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", marginBottom: "16px" }}>
                        <p style={{ fontWeight: 700, marginBottom: "4px" }}>Important Information</p>
                        <p>Core fees may apply and the responsibility of the customer.</p>
                        <p>Credit card convenience fee of 3.5% applies to all invoices $1000.00 or more.</p>
                      </div>
                    )}

                    <div style={{ borderTop: "1px solid #555", marginBottom: "10px" }} />

                    {/* Signature & Date */}
                    <p style={{ fontWeight: 700, paddingBottom: "24px" }}>
                      {wo.woType === "quote" ? "Customer Approval Signature & Date" : "Signature & Date"}
                    </p>
                  </div>

                </div>
              </div>
            </div>
          )
        })()}

      </div>


      {isLocked && (
        <div
          className="flex-shrink-0 px-6 py-3 flex items-center gap-3"
          style={{ borderTop: "1px solid hsl(0,0%,18%)" }}
        >
          {wo.woType === "quote" && wo.quoteStatus ? (
            <QuoteStatusBadge status={wo.quoteStatus} />
          ) : (
            <WOStatusBadge status={wo.status} />
          )}
          <span className="text-white/35 text-sm">
            {wo.woType === "quote"
              ? (wo.quoteStatus === "converted"
                  ? "Quote converted to work order"
                  : wo.quoteStatus === "declined"
                    ? "Quote declined"
                    : wo.quoteStatus === "expired"
                      ? "Quote expired"
                      : "")
              : wo.status === "completed"
                ? `Closed ${wo.closedAt ? fmtDate(wo.closedAt) : ""}`
                : "Work order is void"}
          </span>
          {wo.woType === "work_order" && wo.status === "completed" && (
            <Button
              variant="ghost"
              onClick={() => setActiveTab("logbook")}
              className="text-white/50 hover:text-white/80 text-sm ml-2"
            >
              View Logbook →
            </Button>
          )}
        </div>
      )}

      {/* ── TIMES EDIT MODAL ────────────────────────────────────────────────── */}
      {wo && (
        <TimesEditModal
          open={timesEditOpen}
          onClose={() => setTimesEditOpen(false)}
          aircraftLabel={[
            wo.aircraft?.registration ?? wo.guestRegistration ?? "",
            [wo.aircraft?.make, wo.aircraft?.modelFull].filter(Boolean).join(" "),
          ].filter(Boolean).join(" — ")}
          initialTimes={wo.timesSnapshot as AircraftTimesSnapshot | null}
          hobbsDiff={hobbsDiff}
          onConfirm={async (newTimes) => {
            const { parseWarnings: _pw, ...snap } = newTimes
            await updateWorkOrder(wo.id, { timesSnapshot: snap as Record<string, unknown> })
            // Update any existing draft logbook entries with section-appropriate times
            for (const entry of draftLogbookEntries) {
              const s = entry.logbookSection
              const patch: Parameters<typeof updateLogbookEntry>[1] = {}
              // Update the "New" (post-work) fields so corrected times appear in
            // the editable position, not in a strikethrough reference position.
              if (s === "Airframe") {
                if (newTimes.airframeHrs != null) patch.totalAircraftTimeNew = newTimes.airframeHrs
                if (newTimes.landings    != null) patch.landingsNew           = newTimes.landings
                if (newTimes.hobbs       != null) patch.hobbsNew              = newTimes.hobbs
              } else if (s === "Engine 1") {
                if (newTimes.eng1Tsn    != null) patch.totalAircraftTimeNew = newTimes.eng1Tsn
                if (newTimes.eng1Csn    != null) patch.landingsNew           = newTimes.eng1Csn
                if (newTimes.eng1Serial)         (patch as any).guestSerial  = newTimes.eng1Serial
              } else if (s === "Engine 2") {
                if (newTimes.eng2Tsn    != null) patch.totalAircraftTimeNew = newTimes.eng2Tsn
                if (newTimes.eng2Csn    != null) patch.landingsNew           = newTimes.eng2Csn
                if (newTimes.eng2Serial)         (patch as any).guestSerial  = newTimes.eng2Serial
              } else if (s === "Propeller") {
                if (newTimes.propTsn    != null) patch.totalAircraftTimeNew = newTimes.propTsn
                if (newTimes.propCsn    != null) patch.landingsNew           = newTimes.propCsn
                if (newTimes.propSerial)         (patch as any).guestSerial  = newTimes.propSerial
              } else if (s === "APU") {
                if (newTimes.apuHrs    != null) patch.totalAircraftTimeNew = newTimes.apuHrs
                if (newTimes.apuStarts != null) patch.landingsNew           = newTimes.apuStarts
                if (newTimes.apuSerial)         (patch as any).guestSerial  = newTimes.apuSerial
              }
              if (Object.keys(patch).length > 0) {
                await updateLogbookEntry(entry.id, patch)
              }
            }
            auditLog({
              entryType: "times_change",
              summary: "Aircraft times updated",
              detail: [
                newTimes.airframeHrs != null  ? `A/F TT: ${newTimes.airframeHrs}` : null,
                newTimes.landings    != null  ? `Ldg: ${newTimes.landings}`        : null,
                newTimes.eng1Tsn     != null  ? `ENG1 TSN: ${newTimes.eng1Tsn}`   : null,
                newTimes.eng1Csn     != null  ? `ENG1 ENC: ${newTimes.eng1Csn}`   : null,
                newTimes.eng2Tsn     != null  ? `ENG2 TSN: ${newTimes.eng2Tsn}`   : null,
                newTimes.eng2Csn     != null  ? `ENG2 ENC: ${newTimes.eng2Csn}`   : null,
                newTimes.propTsn     != null  ? `PROP TSN: ${newTimes.propTsn}`   : null,
                newTimes.apuHrs      != null  ? `APU HRS: ${newTimes.apuHrs}`     : null,
              ].filter(Boolean).join(" · ") || null,
            })
            await Promise.all([loadWO(), loadDraftLogbookEntries()])
            setTimesEditOpen(false)
          }}
        />
      )}

      {/* ── OPEN CONFIRMATION MODAL ──────────────────────────────────────────── */}
      {showOpenModal && wo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }}>
          <div className="rounded-2xl p-7 max-w-sm w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,24%)" }}>
            <div>
              <h3 className="text-white text-xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Open Work Order?
              </h3>
              <p className="text-white/45 text-sm leading-relaxed">
                <span className="text-white/70 font-medium">WO# {wo.woNumber}</span> will move to active status.
              </p>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle className="w-4 h-4 text-red-400/80 flex-shrink-0 mt-0.5" />
              <p className="text-red-300/70 text-sm leading-relaxed">
                Once opened, this work order <span className="text-red-300 font-semibold">can no longer be permanently deleted.</span> It will exist in the system record.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={confirmOpen}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: "rgba(147,197,253,0.15)", border: "1px solid rgba(147,197,253,0.4)", color: "#93c5fd" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(147,197,253,0.25)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(147,197,253,0.15)")}
              >
                Open Work Order →
              </button>
              <button
                onClick={() => setShowOpenModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm text-white/45 hover:text-white/70 transition-colors"
                style={{ border: "1px solid hsl(0,0%,26%)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE DRAFT MODAL ────────────────────────────────────────────────── */}
      {showDeleteDraftModal && wo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }}>
          <div className="rounded-2xl p-7 max-w-sm w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: "hsl(0,0%,12%)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <div>
              <h3 className="text-white text-xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Delete Draft?
              </h3>
              <p className="text-white/45 text-sm leading-relaxed">
                <span className="text-white/70 font-medium">WO# {wo.woNumber}</span> and all its items will be permanently removed. The work order number will be freed.
              </p>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle className="w-4 h-4 text-red-400/80 flex-shrink-0 mt-0.5" />
              <p className="text-red-300/70 text-sm leading-relaxed">This action <span className="text-red-300 font-semibold">cannot be undone.</span> Only draft work orders may be deleted.</p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleDeleteDraft}
                disabled={deletingDraft}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", opacity: deletingDraft ? 0.6 : 1 }}
                onMouseEnter={e => { if (!deletingDraft) e.currentTarget.style.background = "rgba(239,68,68,0.28)" }}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
              >
                {deletingDraft ? "Deleting…" : "Delete Permanently"}
              </button>
              <button
                onClick={() => setShowDeleteDraftModal(false)}
                disabled={deletingDraft}
                className="px-5 py-2.5 rounded-xl text-sm text-white/45 hover:text-white/70 transition-colors"
                style={{ border: "1px solid hsl(0,0%,26%)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONVERT QUOTE → WORK ORDER MODAL ─────────────────────────────────── */}
      {showConvertModal && wo && wo.woType === "quote" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }}>
          <div className="rounded-2xl p-7 max-w-sm w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto" style={{ background: "hsl(0,0%,12%)", border: "1px solid rgba(110,231,183,0.3)" }}>
            <div>
              <h3 className="text-white text-xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Convert to Work Order?
              </h3>
              <p className="text-white/45 text-sm leading-relaxed">
                <span className="text-white/70 font-medium">Quote {wo.woNumber}</span> will be marked as converted and a new draft work order will be created with all items, parts, and labor estimates copied over.
              </p>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(110,231,183,0.06)", border: "1px solid rgba(110,231,183,0.2)" }}>
              <ArrowLeftRight className="w-4 h-4 text-emerald-400/80 flex-shrink-0 mt-0.5" />
              <p className="text-emerald-300/70 text-sm leading-relaxed">
                The quote will remain in the Quotes list marked <span className="text-emerald-300 font-semibold">converted</span> and linked bidirectionally to the new work order.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleConvertQuote}
                disabled={converting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: "rgba(110,231,183,0.15)", border: "1px solid rgba(110,231,183,0.4)", color: "#6ee7b7", opacity: converting ? 0.6 : 1 }}
                onMouseEnter={e => { if (!converting) e.currentTarget.style.background = "rgba(110,231,183,0.28)" }}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(110,231,183,0.15)")}
              >
                {converting ? "Converting…" : "Convert →"}
              </button>
              <button
                onClick={() => setShowConvertModal(false)}
                disabled={converting}
                className="px-5 py-2.5 rounded-xl text-sm text-white/45 hover:text-white/70 transition-colors"
                style={{ border: "1px solid hsl(0,0%,26%)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND FOR APPROVAL MODAL ──────────────────────────────────────────── */}
      {wo && (wo.woType === "quote" || wo.woType === "change_order") && (
        <SendForApprovalModal
          key={`send-approval-${resendPrefill?.email ?? "fresh"}`}
          open={showSendApprovalModal}
          onClose={() => { setShowSendApprovalModal(false); setResendPrefill(null) }}
          onSent={() => {
            setApprovalRefreshKey(k => k + 1)
            setResendPrefill(null)
            loadWO()
          }}
          workOrderId={wo.id}
          workOrderNumber={wo.woNumber}
          kind={wo.woType === "change_order" ? "change_order" : "quote"}
          defaultRecipientName={resendPrefill?.name}
          defaultRecipientEmail={resendPrefill?.email}
        />
      )}

      {/* ── FOUND DISCREPANCY MODAL ─────────────────────────────────────────── */}
      {wo && discrepancyForItem && (
        <FoundDiscrepancyModal
          open={true}
          onClose={() => setDiscrepancyForItem(null)}
          parentItem={discrepancyForItem}
          laborRate={discrepancyForItem.laborRate ?? 125}
          onSubmit={async ({ discrepancyType, discrepancy, correctiveAction, estimatedHours, partNumber }) => {
            const saved = await findDiscrepancy({
              workOrderId:      wo.id,
              parentItemId:     discrepancyForItem.id,
              logbookSection:   discrepancyForItem.logbookSection,
              discrepancyType,
              discrepancy,
              correctiveAction,
              estimatedHours,
              laborRate:        discrepancyForItem.laborRate ?? 125,
              partNumber:       partNumber || undefined,
              itemNumber:       wo.items.length + 1,
              reportedById:     myProfile?.id ?? null,
            })
            setWO(prev => prev ? { ...prev, items: [...prev.items, saved] } : prev)
            setSelectedItemId(saved.id)
            setDiscrepancyForItem(null)
            auditLog({
              entryType:  "item_created",
              summary:    `Discrepancy recorded on item #${discrepancyForItem.itemNumber} (${discrepancyType})`,
              detail:     discrepancy,
              itemId:     saved.id,
              itemNumber: saved.itemNumber,
            })
          }}
        />
      )}

      {/* ── CREATE CHANGE ORDER MODAL ───────────────────────────────────────── */}
      {wo && showCreateCOModal && myProfile && (
        <CreateChangeOrderModal
          open={true}
          onClose={() => setShowCreateCOModal(false)}
          parentWoId={wo.id}
          pendingItems={wo.items.filter(i => i.parentItemId && i.customerApprovalStatus === "pending")}
          createdByProfileId={myProfile.id}
          onCreated={(coId) => {
            setShowCreateCOModal(false)
            navigate(`/app/beet-box/work-orders/${coId}`)
          }}
        />
      )}

      {/* ── COMPLETE MODAL ───────────────────────────────────────────────────── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div
            className="rounded-2xl p-7 max-w-md w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto"
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

      {/* ── PDF Preview Modal ─────────────────────────────────────────────── */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div
            className="flex items-center justify-between px-6 py-3 flex-shrink-0"
            style={{ background: "hsl(0 0% 10%)", borderBottom: "1px solid hsl(0 0% 20%)" }}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-white/40" />
              <span className="text-white/70 text-sm font-medium">{pdfPreview.filename}</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => {
                  const a = document.createElement("a")
                  a.href = pdfPreview.url
                  a.download = pdfPreview.filename
                  a.click()
                }}
                style={{ background: "var(--skyshare-gold)", color: "#000" }}
                className="font-semibold text-xs h-8 px-4 flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
              <button
                onClick={closePdfPreview}
                className="text-white/40 hover:text-white/80 transition-colors p-1.5 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-6">
            <iframe
              src={pdfPreview.url}
              className="w-full h-full rounded"
              style={{ border: "none" }}
              title="PDF Preview"
            />
          </div>
        </div>
      )}

      {/* ── Parts Overview Modal ──────────────────────────────────────────── */}
      {partsOverviewOpen && wo && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setPartsOverviewOpen(false)}
          />
          <div
            className="relative rounded-2xl overflow-hidden flex flex-col"
            style={{ background: "hsl(0,0%,11%)", border: "1px solid rgba(212,160,23,0.25)", width: 720, maxHeight: "80vh", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-center gap-3 flex-shrink-0"
              style={{ background: "linear-gradient(to right, rgba(212,160,23,0.1), rgba(212,160,23,0.03))", borderBottom: "1px solid rgba(212,160,23,0.2)" }}
            >
              <Package className="w-5 h-5" style={{ color: "var(--skyshare-gold)" }} />
              <span className="text-base font-bold" style={{ color: "rgba(212,160,23,0.95)", fontFamily: "var(--font-heading)" }}>
                Parts Overview — {wo.woNumber}
              </span>
              <div className="flex-1" />
              <button onClick={() => setPartsOverviewOpen(false)} className="text-white/30 hover:text-white/70 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(212,160,23,0.3) transparent" }}>
              {(() => {
                const itemsWithParts = wo.items.filter(i => i.parts.length > 0)
                const allParts = wo.items.flatMap(i => i.parts.map(p => ({ ...p, itemNumber: i.itemNumber, itemCategory: i.category })))
                const totalQty = allParts.reduce((s, p) => s + p.qty, 0)
                const totalCost = allParts.reduce((s, p) => s + p.qty * p.unitPrice, 0)
                const $f = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

                if (allParts.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <Package className="w-8 h-8 mx-auto mb-3 text-white/15" />
                      <p className="text-white/30 text-sm">No parts have been added to this work order yet.</p>
                    </div>
                  )
                }

                return (
                  <>
                    {/* Summary bar */}
                    <div
                      className="flex items-center gap-6 px-4 py-3 rounded-xl"
                      style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.15)" }}
                    >
                      <div>
                        <span className="text-white/40 text-[10px] uppercase tracking-wider block">Total Parts</span>
                        <span className="text-white font-bold text-lg">{totalQty}</span>
                      </div>
                      <div>
                        <span className="text-white/40 text-[10px] uppercase tracking-wider block">Unique P/Ns</span>
                        <span className="text-white font-bold text-lg">{new Set(allParts.map(p => p.partNumber)).size}</span>
                      </div>
                      <div>
                        <span className="text-white/40 text-[10px] uppercase tracking-wider block">Items w/ Parts</span>
                        <span className="text-white font-bold text-lg">{itemsWithParts.length} / {wo.items.length}</span>
                      </div>
                      <div className="ml-auto text-right">
                        <span className="text-white/40 text-[10px] uppercase tracking-wider block">Total Cost</span>
                        <span className="font-bold text-lg" style={{ color: "var(--skyshare-gold)" }}>{$f(totalCost)}</span>
                      </div>
                    </div>

                    {/* Parts grouped by item */}
                    {wo.items.map(item => {
                      if (item.parts.length === 0) return null
                      const sectionColor = SECTION_COLORS[item.logbookSection]
                      return (
                        <div key={item.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,20%)" }}>
                          <div
                            className="px-4 py-2.5 flex items-center gap-2"
                            style={{ background: "hsl(0,0%,13%)", borderBottom: "1px solid hsl(0,0%,20%)", borderLeft: `3px solid ${sectionColor}` }}
                          >
                            <span className="text-white/40 text-xs font-mono">#{item.itemNumber}</span>
                            <span className="text-white/80 text-sm font-medium">{item.category}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${sectionColor}20`, color: sectionColor }}>
                              {item.logbookSection}
                            </span>
                            <span className="ml-auto text-white/40 text-xs">{item.parts.length} part{item.parts.length !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="divide-y" style={{ borderColor: "hsl(0,0%,17%)" }}>
                            {item.parts.map(p => (
                              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm" style={{ background: "hsl(0,0%,11%)" }}>
                                <span className="text-white font-mono flex-shrink-0 w-36 truncate">{p.partNumber}</span>
                                <span className="text-white/60 flex-1 truncate">{p.description}</span>
                                <span className="text-white/50 flex-shrink-0">×{p.qty}</span>
                                <span className="text-white/50 flex-shrink-0 w-20 text-right font-mono">{$f(p.unitPrice)}</span>
                                <span className="font-medium flex-shrink-0 w-24 text-right font-mono" style={{ color: "var(--skyshare-gold)" }}>
                                  {$f(p.qty * p.unitPrice)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {/* Parts on Order section */}
                    {partsRequests.length > 0 && (
                      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(251,191,36,0.18)" }}>
                        <div
                          className="px-4 py-2.5 flex items-center gap-2"
                          style={{ background: "rgba(251,191,36,0.06)", borderBottom: "1px solid rgba(251,191,36,0.12)" }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" style={{ color: "rgba(251,191,36,0.7)" }} />
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(251,191,36,0.8)" }}>Parts on Order</span>
                          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.12)", color: "rgba(251,191,36,0.8)" }}>
                            {partsRequests.reduce((s, r) => s + r.lines.length, 0)}
                          </span>
                        </div>
                        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                          {partsRequests.flatMap(req =>
                            req.lines.map(line => {
                              const sc = LINE_STATUS_CONFIG[line.lineStatus as keyof typeof LINE_STATUS_CONFIG]
                              const linkedItem = line.woItemId ? wo.items.find(i => i.id === line.woItemId) : null
                              return (
                                <button
                                  key={`${req.id}-${line.id}`}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.04] text-left"
                                  style={{ background: "hsl(0,0%,10%)" }}
                                  onClick={() => { setPartsOverviewOpen(false); navigate(`/app/beet-box/parts/${req.id}`) }}
                                >
                                  <span className="text-white font-mono flex-shrink-0 w-32 truncate">{line.partNumber}</span>
                                  <span className="text-white/50 flex-1 truncate">{line.description || "—"}</span>
                                  <span className="text-white/40 flex-shrink-0">×{line.quantity}</span>
                                  {linkedItem ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: `${SECTION_COLORS[linkedItem.logbookSection]}20`, color: SECTION_COLORS[linkedItem.logbookSection] }}>
                                      #{linkedItem.itemNumber}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 text-white/20" style={{ background: "rgba(255,255,255,0.04)" }}>
                                      WO-wide
                                    </span>
                                  )}
                                  {sc && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>
                                      {sc.label}
                                    </span>
                                  )}
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Order Parts Slide-Over ────────────────────────────────────────── */}
      {orderPartsOpen && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => setOrderPartsOpen(false)}
          />
          {/* Panel */}
          <div
            className="relative flex flex-col h-full overflow-hidden"
            style={{
              width: "min(680px, 95vw)",
              background: "hsl(0 0% 9%)",
              borderLeft: "1px solid hsl(0 0% 18%)",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid hsl(0 0% 16%)" }}
            >
              <div>
                <h2
                  className="text-white font-semibold"
                  style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
                >
                  New Parts Request
                </h2>
                {wo && (
                  <p className="text-xs mt-0.5" style={{ color: "rgba(212,160,23,0.7)" }}>
                    WO# {wo.woNumber}{wo.aircraft?.registration ? ` · ${wo.aircraft.registration}` : wo.guestRegistration ? ` · ${wo.guestRegistration}` : ""}
                  </p>
                )}
              </div>
              <button
                onClick={() => setOrderPartsOpen(false)}
                className="text-white/30 hover:text-white/70 transition-colors p-1.5 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {wo && (
                <PartsRequestForm
                  prefill={{
                    aircraftId:     wo.aircraftId ?? undefined,
                    aircraftTail:   wo.aircraft?.registration ?? wo.guestRegistration ?? undefined,
                    woNumber:       wo.woNumber,
                    woItemId:       orderPartsForItem?.id ?? undefined,
                    woItemNumber:   orderPartsForItem?.itemNumber ?? undefined,
                    jobDescription: wo.description ?? undefined,
                  }}
                  onClose={() => { setOrderPartsOpen(false); setOrderPartsForItem(null); setPartsRequestsKey(k => k + 1) }}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}
