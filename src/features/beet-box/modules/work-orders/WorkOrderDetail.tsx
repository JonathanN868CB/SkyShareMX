import { useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft, AlertTriangle, StickyNote, Check, ChevronRight,
  Plus, X, Clock, UserCheck, UserX, Package, PackageX,
  CheckCircle2, Circle, AlertCircle, Scissors, Eye,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { cn } from "@/shared/lib/utils"
import {
  WORK_ORDERS, AIRCRAFT, MECHANICS, WO_STATUS_LABELS,
  type WorkOrder, type WOStatus, type WOItem, type WOItemPart,
  type WOItemLaborEntry, type WOItemStatus, type LogbookSection,
} from "../../data/mockData"
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
  "Airframe":  "rgba(212,160,23,0.7)",
  "Engine 1":  "rgba(96,165,250,0.7)",
  "Engine 2":  "rgba(147,197,253,0.7)",
  "Propeller": "rgba(167,243,208,0.7)",
  "APU":       "rgba(196,181,253,0.7)",
  "Other":     "rgba(161,161,170,0.7)",
}

// ─── Item status config ───────────────────────────────────────────────────────
const ITEM_STATUS_CONFIG: Record<WOItemStatus, {
  label: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
}> = {
  pending:      { label: "Pending",      icon: Circle,        color: "text-white/40",    bg: "bg-white/[0.05]",       border: "border-white/15"     },
  in_progress:  { label: "In Progress",  icon: Clock,         color: "text-blue-400",    bg: "bg-blue-900/20",        border: "border-blue-700/40"  },
  done:         { label: "Done",         icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-900/20",     border: "border-emerald-700/40"},
  needs_review: { label: "Needs Review", icon: Eye,           color: "text-amber-400",   bg: "bg-amber-900/20",       border: "border-amber-700/40" },
  cut_short:    { label: "Cut Short",    icon: Scissors,      color: "text-red-400",     bg: "bg-red-900/20",         border: "border-red-700/40"   },
}

// ─── Financial helpers ────────────────────────────────────────────────────────
function itemLaborTotal(item: WOItem)   { return item.hours * item.laborRate }
function itemPartsTotal(item: WOItem)   { return item.parts.reduce((s, p) => s + p.qty * p.unitPrice, 0) }
function itemSubtotal(item: WOItem)     { return itemLaborTotal(item) + itemPartsTotal(item) + item.shippingCost + item.outsideServicesCost }

const SHOP_SUPPLIES_RATE = 0.05

// ─── Formatting toolbar helper ────────────────────────────────────────────────
function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement>,
  before: string,
  after = "",
  onUpdate: (val: string) => void,
) {
  const el = ref.current
  if (!el) return
  const start = el.selectionStart
  const end   = el.selectionEnd
  const selected = el.value.slice(start, end)
  const newVal = el.value.slice(0, start) + before + selected + after + el.value.slice(end)
  onUpdate(newVal)
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

function Toolbar({ textareaRef, onUpdate }: { textareaRef: React.RefObject<HTMLTextAreaElement>; onUpdate: (v: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
      {[
        { label: "B",  title: "Bold",          before: "**", after: "**" },
        { label: "I",  title: "Italic",         before: "_",  after: "_"  },
        { label: "•",  title: "Bullet point",   before: "\n• ", after: ""  },
        { label: "1.", title: "Numbered item",  before: "\n1. ", after: "" },
        { label: "—",  title: "Separator line", before: "\n——————\n", after: "" },
      ].map(btn => (
        <button
          key={btn.label}
          title={btn.title}
          onMouseDown={e => {
            e.preventDefault()
            insertAtCursor(textareaRef, btn.before, btn.after, onUpdate)
          }}
          className="w-6 h-6 flex items-center justify-center rounded text-[11px] font-semibold text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all"
          style={btn.label === "B" ? { fontFamily: "serif" } : btn.label === "I" ? { fontFamily: "serif", fontStyle: "italic" } : {}}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

// ─── Item card (proper component so useRef calls are legal) ──────────────────
interface ItemCardProps {
  item: WOItem
  isLocked: boolean
  isOpen: boolean
  onToggle: () => void
  onPatch: (patch: Partial<WOItem>) => void
  onSignOff: () => void
  assignedMechanics: string[]
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

function ItemCard({
  item, isLocked, isOpen, onToggle, onPatch, onSignOff,
  assignedMechanics,
  addingPartToItem, setAddingPartToItem, newPart, setNewPart, onAddPart,
  addingLaborToItem, setAddingLaborToItem, newLabor, setNewLabor, onAddLabor,
}: ItemCardProps) {
  const discrepancyRef = useRef<HTMLTextAreaElement>(null)
  const correctiveRef  = useRef<HTMLTextAreaElement>(null)

  const laborSub = itemLaborTotal(item)
  const partsSub = itemPartsTotal(item)
  const total    = itemSubtotal(item)

  const laborEntries  = item.itemLaborEntries ?? []
  const clockedTotal  = laborEntries.reduce((s, e) => s + e.hours, 0)
  const itemStatus    = item.itemStatus ?? "pending"
  const statusCfg     = ITEM_STATUS_CONFIG[itemStatus]
  const StatusIcon    = statusCfg.icon

  // Mechanics assigned to WO who haven't logged time on this item
  const clockedNames  = new Set(laborEntries.map(e => e.mechName))
  const allMechanics  = MECHANICS.filter(m => assignedMechanics.includes(m.id))
  const notClocked    = allMechanics.filter(m => !clockedNames.has(m.name))

  const noPartsRequired = item.noPartsRequired ?? false
  const hasPartsOrExempt = item.parts.length > 0 || noPartsRequired

  return (
    <div>
      {/* Item header — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none group hover:bg-white/[0.03] transition-colors"
        onClick={onToggle}
      >
        <span className="text-white/35 text-xs font-mono w-5 text-right flex-shrink-0">{item.itemNumber}</span>
        <ChevronRight
          className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150 text-white/25"
          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
        />
        {/* Item status dot */}
        <StatusIcon className={cn("w-3.5 h-3.5 flex-shrink-0", statusCfg.color)} />
        <span className="text-white/80 text-sm flex-1 truncate">{item.category}</span>
        {item.taskNumber && (
          <span className="text-white/30 text-xs font-mono flex-shrink-0">{item.taskNumber}</span>
        )}
        {clockedTotal > 0 && (
          <span className="text-white/40 text-xs flex-shrink-0 flex items-center gap-1">
            <Clock className="w-3 h-3" />{clockedTotal.toFixed(1)} hrs
          </span>
        )}
        {total > 0 && (
          <span className="text-white/40 text-xs font-mono flex-shrink-0">${total.toFixed(2)}</span>
        )}
        {/* Parts indicator */}
        {!hasPartsOrExempt && !isLocked && (
          <span title="No parts logged" className="text-amber-500/60 flex-shrink-0"><PackageX className="w-3.5 h-3.5" /></span>
        )}
        {item.signOffRequired && (
          <div
            className={cn(
              "flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0",
              item.signedOffBy ? "bg-emerald-900/30 text-emerald-400" : "bg-white/[0.06] text-white/30"
            )}
            onClick={e => { e.stopPropagation(); if (!isLocked) onSignOff() }}
          >
            {item.signedOffBy && <Check className="w-2.5 h-2.5" />}
            {item.signedOffBy ? "Signed" : "Sign off"}
          </div>
        )}
      </div>

      {/* ── Expanded body ── */}
      {isOpen && (
        <div className="border-t border-white/[0.07] bg-white/[0.015]">

          {/* ── 1. Discrepancy | Corrective Action ─────────────────────────── */}
          <div className="grid grid-cols-2 divide-x divide-white/[0.07]">

            {/* Discrepancy */}
            <div className="flex flex-col">
              <div className="px-4 py-1.5 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                <span className="text-white text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Discrepancy</span>
                {item.taskNumber && <span className="text-white/30 text-[10px] font-mono">{item.taskNumber}</span>}
              </div>
              {!isLocked && <Toolbar textareaRef={discrepancyRef} onUpdate={v => onPatch({ discrepancy: v })} />}
              <textarea
                ref={discrepancyRef}
                value={item.discrepancy}
                onChange={e => onPatch({ discrepancy: e.target.value })}
                disabled={isLocked}
                rows={12}
                placeholder="Describe the discrepancy or task…"
                className="flex-1 bg-transparent px-4 py-3 text-white/85 text-sm leading-relaxed resize-y focus:outline-none placeholder:text-white/20 disabled:opacity-60"
                style={{ minHeight: "220px" }}
              />
              {item.partNumber && (
                <div className="px-4 py-1.5 text-xs text-white/35 font-mono border-t border-white/[0.07]">
                  P/N: {item.partNumber}{item.serialNumber ? ` · S/N: ${item.serialNumber}` : ""}
                </div>
              )}
            </div>

            {/* Corrective Action */}
            <div className="flex flex-col">
              <div className="px-4 py-1.5 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                <span className="text-white text-[10px] font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Corrective Action</span>
                {item.correctiveAction && item.signOffRequired && (
                  <span className={cn("text-[10px]", item.signedOffBy ? "text-emerald-400" : "text-white/25")}>
                    {item.signedOffBy ? `Signed — ${item.signedOffBy}` : "Awaiting sign-off"}
                  </span>
                )}
              </div>
              {!isLocked && <Toolbar textareaRef={correctiveRef} onUpdate={v => onPatch({ correctiveAction: v })} />}
              <textarea
                ref={correctiveRef}
                value={item.correctiveAction}
                onChange={e => onPatch({ correctiveAction: e.target.value })}
                disabled={isLocked}
                rows={12}
                placeholder={isLocked ? "No corrective action recorded." : "Describe what was done to correct the discrepancy…"}
                className="flex-1 bg-transparent px-4 py-3 text-white/85 text-sm leading-relaxed resize-y focus:outline-none placeholder:text-white/20 disabled:opacity-60"
                style={{ minHeight: "220px" }}
              />
            </div>
          </div>

          {/* ── 2. Item Status ──────────────────────────────────────────────── */}
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
            <span className="text-white/30 text-[10px] uppercase tracking-widest mr-1" style={{ fontFamily: "var(--font-heading)" }}>Status</span>
            {(Object.entries(ITEM_STATUS_CONFIG) as [WOItemStatus, typeof ITEM_STATUS_CONFIG[WOItemStatus]][]).map(([key, cfg]) => {
              const Icon = cfg.icon
              const active = itemStatus === key
              return (
                <button
                  key={key}
                  disabled={isLocked}
                  onClick={() => onPatch({ itemStatus: key })}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all",
                    active ? cn(cfg.bg, cfg.color, cfg.border) : "bg-transparent text-white/30 border-white/10 hover:border-white/25 hover:text-white/55",
                    isLocked && "opacity-50 cursor-default"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </button>
              )
            })}
          </div>

          {/* ── 3. Labor & Parts ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 divide-x divide-white/[0.07]" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>

            {/* Labor panel */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-white/35" />
                  <span className="text-white/50 text-[10px] uppercase tracking-widest font-bold" style={{ fontFamily: "var(--font-heading)" }}>Labor</span>
                  {clockedTotal > 0 && (
                    <span className="text-white/35 text-xs font-mono">{clockedTotal.toFixed(1)} hrs · ${laborSub.toFixed(2)}</span>
                  )}
                </div>
                {!isLocked && addingLaborToItem !== item.id && (
                  <button
                    onClick={() => { setAddingLaborToItem(item.id); setNewLabor({ mechName: "", hours: "", date: new Date().toISOString().slice(0, 10) }) }}
                    className="flex items-center gap-1 text-white/30 hover:text-white/60 text-xs transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Clock In
                  </button>
                )}
              </div>

              {/* Clocked in list */}
              {laborEntries.length > 0 && (
                <div className="space-y-1">
                  <p className="text-white/25 text-[10px] uppercase tracking-wider flex items-center gap-1" style={{ fontFamily: "var(--font-heading)" }}>
                    <UserCheck className="w-3 h-3" /> Clocked In
                  </p>
                  {laborEntries.map(e => (
                    <div key={e.id} className="flex items-center gap-2 pl-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 flex-shrink-0" />
                      <span className="text-white/70 text-xs flex-1">{e.mechName}</span>
                      <span className="text-white/50 text-xs font-mono">{e.hours.toFixed(1)} hrs</span>
                      <span className="text-white/25 text-[10px]">{e.clockedAt}</span>
                      {!isLocked && (
                        <button
                          onClick={() => onPatch({ itemLaborEntries: laborEntries.filter(x => x.id !== e.id) })}
                          className="text-white/20 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add labor form */}
              {addingLaborToItem === item.id && (
                <div className="space-y-2 p-2.5 rounded" style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 22%)" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>Mechanic</p>
                      <select
                        className="w-full px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/25"
                        value={newLabor.mechName}
                        onChange={e => setNewLabor(n => ({ ...n, mechName: e.target.value }))}
                      >
                        <option value="">Select…</option>
                        {MECHANICS.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>Hours</p>
                      <input
                        type="number" step="0.5" min="0.5"
                        placeholder="0.0"
                        className="w-full px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
                        value={newLabor.hours}
                        onChange={e => setNewLabor(n => ({ ...n, hours: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>Date</p>
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/25"
                      value={newLabor.date}
                      onChange={e => setNewLabor(n => ({ ...n, date: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onAddLabor} disabled={!newLabor.mechName || !newLabor.hours} style={{ background: "var(--skyshare-gold)", color: "#000" }} className="text-xs font-semibold h-7">Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingLaborToItem(null)} className="text-white/40 text-xs h-7">Cancel</Button>
                  </div>
                </div>
              )}

              {/* Not clocked in */}
              {notClocked.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <p className="text-white/25 text-[10px] uppercase tracking-wider flex items-center gap-1" style={{ fontFamily: "var(--font-heading)" }}>
                    <UserX className="w-3 h-3" /> Not Clocked In
                  </p>
                  {notClocked.map(m => (
                    <div key={m.id} className="flex items-center gap-2 pl-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/15 flex-shrink-0" />
                      <span className="text-white/35 text-xs">{m.name}</span>
                      <span className="text-white/20 text-[10px]">{m.role}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* No mechanics assigned */}
              {allMechanics.length === 0 && laborEntries.length === 0 && (
                <p className="text-white/20 text-xs italic">No mechanics assigned to this WO.</p>
              )}
            </div>

            {/* Parts panel */}
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-white/35" />
                  <span className="text-white/50 text-[10px] uppercase tracking-widest font-bold" style={{ fontFamily: "var(--font-heading)" }}>Parts</span>
                  {partsSub > 0 && <span className="text-white/35 text-xs font-mono">${partsSub.toFixed(2)}</span>}
                </div>
                {!isLocked && !noPartsRequired && addingPartToItem !== item.id && (
                  <button
                    onClick={() => { setAddingPartToItem(item.id); setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" }) }}
                    className="flex items-center gap-1 text-white/30 hover:text-white/60 text-xs transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Part
                  </button>
                )}
              </div>

              {/* No-parts-required toggle */}
              {!isLocked && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-all",
                      noPartsRequired ? "bg-emerald-700/40 border-emerald-600/50" : "bg-transparent border-white/20 group-hover:border-white/35"
                    )}
                    onClick={() => onPatch({ noPartsRequired: !noPartsRequired })}
                  >
                    {noPartsRequired && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                  </div>
                  <span className="text-white/45 text-xs select-none">No parts required for this task</span>
                </label>
              )}

              {/* Parts list */}
              {item.parts.length > 0 ? (
                <div className="space-y-1.5">
                  {item.parts.map(p => (
                    <div key={p.id} className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs" style={{ background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 22%)" }}>
                      <span className="text-white/40 font-mono flex-shrink-0">{p.partNumber}</span>
                      <span className="text-white/65 flex-1 truncate">{p.description}</span>
                      <span className="text-white/40 flex-shrink-0">×{p.qty}</span>
                      <span className="text-white/60 font-mono flex-shrink-0">${(p.qty * p.unitPrice).toFixed(2)}</span>
                      {!isLocked && (
                        <button onClick={() => onPatch({ parts: item.parts.filter(x => x.id !== p.id) })} className="text-white/20 hover:text-red-400 ml-1 transition-colors flex-shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : noPartsRequired ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400/70 pl-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> No parts required — confirmed
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-500/60 pl-1">
                  <AlertCircle className="w-3.5 h-3.5" /> No parts logged yet
                </div>
              )}

              {/* Add part form */}
              {addingPartToItem === item.id && (
                <div className="space-y-2 p-2.5 rounded" style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 22%)" }}>
                  {[
                    { key: "partNumber" as const,  label: "Part Number",  placeholder: "e.g. MS28775-228" },
                    { key: "description" as const, label: "Description",  placeholder: "Part description" },
                  ].map(f => (
                    <div key={f.key}>
                      <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>{f.label}</p>
                      <input
                        className="w-full px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25"
                        placeholder={f.placeholder}
                        value={newPart[f.key]}
                        onChange={e => setNewPart(n => ({ ...n, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>Qty</p>
                      <input type="number" min="1" className="w-full px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white focus:outline-none focus:border-white/25" value={newPart.qty} onChange={e => setNewPart(n => ({ ...n, qty: e.target.value }))} />
                    </div>
                    <div>
                      <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>Unit Price</p>
                      <input type="number" step="0.01" placeholder="0.00" className="w-full px-2 py-1.5 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25" value={newPart.unitPrice} onChange={e => setNewPart(n => ({ ...n, unitPrice: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onAddPart} disabled={!newPart.partNumber || !newPart.unitPrice} style={{ background: "var(--skyshare-gold)", color: "#000" }} className="text-xs font-semibold h-7">Add Part</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAddingPartToItem(null)} className="text-white/40 text-xs h-7">Cancel</Button>
                  </div>
                </div>
              )}

              {/* Shipping & outside services */}
              {(item.shippingCost > 0 || item.outsideServicesCost > 0 || !isLocked) && (
                <div className="pt-1 space-y-1.5" style={{ borderTop: "1px solid hsl(0 0% 20%)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-white/35 text-xs w-28" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>Shipping $</span>
                    {isLocked ? (
                      <span className="text-white/60 text-xs font-mono">{item.shippingCost.toFixed(2)}</span>
                    ) : (
                      <input type="number" step="0.01" className="w-20 px-2 py-1 rounded text-xs bg-white/[0.06] border border-white/10 text-white font-mono focus:outline-none focus:border-white/25" value={item.shippingCost} onChange={e => onPatch({ shippingCost: parseFloat(e.target.value) || 0 })} />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/35 text-xs w-28" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>Outside Svcs $</span>
                    {isLocked ? (
                      <span className="text-white/60 text-xs font-mono">{item.outsideServicesCost.toFixed(2)}</span>
                    ) : (
                      <input type="number" step="0.01" className="w-20 px-2 py-1 rounded text-xs bg-white/[0.06] border border-white/10 text-white font-mono focus:outline-none focus:border-white/25" value={item.outsideServicesCost} onChange={e => onPatch({ outsideServicesCost: parseFloat(e.target.value) || 0 })} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 4. Sign-off ─────────────────────────────────────────────────── */}
          {item.signOffRequired && (
            <div
              className="px-4 py-3 flex items-center justify-between gap-4"
              style={{ borderTop: "1px solid hsl(0 0% 18%)" }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className={cn("w-4 h-4", item.signedOffBy ? "text-emerald-400" : "text-white/25")} />
                <span className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Sign-off Required</span>
                {item.signedOffBy && (
                  <span className="text-emerald-400 text-xs">
                    Signed by <span className="font-semibold">{item.signedOffBy}</span>
                    {item.signedOffAt && (
                      <span className="text-emerald-400/60 ml-1">
                        — {new Date(item.signedOffAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </span>
                )}
              </div>
              {!isLocked && (
                item.signedOffBy ? (
                  <button onClick={onSignOff} className="text-white/25 hover:text-white/50 text-xs transition-colors">
                    Undo sign-off
                  </button>
                ) : (
                  <button
                    onClick={onSignOff}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-white/15 text-white/50 hover:border-emerald-600/50 hover:text-emerald-400 hover:bg-emerald-900/10 transition-all"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sign Off This Item
                  </button>
                )
              )}
            </div>
          )}

          {/* ── 5. Labor hours editor (HRS × RATE) + Item totals ───────────── */}
          <div
            className="px-4 py-2.5 flex items-center gap-4 flex-wrap text-xs"
            style={{ borderTop: "1px solid hsl(0 0% 18%)", background: "hsl(0 0% 12%)" }}
          >
            <span className="text-white/40 font-semibold uppercase mr-1" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>Charges</span>
            <div className="flex items-center gap-1.5">
              <span className="text-white/35">HRS</span>
              {isLocked ? (
                <span className="text-white/70 font-mono">{item.hours.toFixed(2)}</span>
              ) : (
                <input
                  type="number" step="0.5"
                  className="w-16 px-2 py-1 rounded bg-white/[0.06] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/25"
                  value={item.hours}
                  onChange={e => onPatch({ hours: parseFloat(e.target.value) || 0 })}
                />
              )}
            </div>
            <span className="text-white/20">@</span>
            <div className="flex items-center gap-1.5">
              <span className="text-white/35">$</span>
              {isLocked ? (
                <span className="text-white/70 font-mono">{item.laborRate}/hr</span>
              ) : (
                <input
                  type="number"
                  className="w-16 px-2 py-1 rounded bg-white/[0.06] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/25"
                  value={item.laborRate}
                  onChange={e => onPatch({ laborRate: parseFloat(e.target.value) || 125 })}
                />
              )}
              <span className="text-white/30">/hr</span>
            </div>
            <span className="text-white/20 mx-1">|</span>
            <span className="text-white/35 mr-1">Labor:</span><span className="text-white/65 mr-3 font-mono">${laborSub.toFixed(2)}</span>
            <span className="text-white/35 mr-1">Parts:</span><span className="text-white/65 mr-3 font-mono">${partsSub.toFixed(2)}</span>
            {item.shippingCost > 0 && <><span className="text-white/35 mr-1">Ship:</span><span className="text-white/65 mr-3 font-mono">${item.shippingCost.toFixed(2)}</span></>}
            {item.outsideServicesCost > 0 && <><span className="text-white/35 mr-1">Outside:</span><span className="text-white/65 mr-3 font-mono">${item.outsideServicesCost.toFixed(2)}</span></>}
            <span className="ml-auto font-bold font-mono" style={{ color: "var(--skyshare-gold)" }}>Item Total: ${total.toFixed(2)}</span>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const original = WORK_ORDERS.find(w => w.id === id)
  const [wo, setWO] = useState<WorkOrder | null>(original ?? null)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [notes, setNotes] = useState(original?.notes ?? "")

  // Section accordion state — all sections open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_SECTIONS.map(s => [s, true]))
  )
  // Item expand state — all collapsed by default
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  // Visible sections (user can show/hide)
  const [visibleSections, setVisibleSections] = useState<LogbookSection[]>(["Airframe", "Engine 1", "Propeller"])

  // Add item form
  const [addingToSection, setAddingToSection] = useState<LogbookSection | null>(null)
  const [newItem, setNewItem] = useState({ category: "", taskNumber: "", discrepancy: "", correctiveAction: "", hours: "", laborRate: "125", shippingCost: "0", outsideServicesCost: "0" })

  // Add part mini-form
  const [addingPartToItem, setAddingPartToItem] = useState<string | null>(null)
  const [newPart, setNewPart] = useState({ partNumber: "", description: "", qty: "1", unitPrice: "" })

  // Add labor mini-form
  const [addingLaborToItem, setAddingLaborToItem] = useState<string | null>(null)
  const [newLabor, setNewLabor] = useState({ mechName: "", hours: "", date: new Date().toISOString().slice(0, 10) })

  if (!wo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">Work order not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/beet-box/work-orders")} className="text-white/50">← Back to Work Orders</Button>
      </div>
    )
  }

  const aircraft = AIRCRAFT.find(a => a.id === wo.aircraftId)
  const isLocked = wo.status === "completed" || wo.status === "void"

  const totalLabor    = wo.items.reduce((s, i) => s + itemLaborTotal(i), 0)
  const totalParts    = wo.items.reduce((s, i) => s + itemPartsTotal(i), 0)
  const totalShipping = wo.items.reduce((s, i) => s + i.shippingCost, 0)
  const totalOutside  = wo.items.reduce((s, i) => s + i.outsideServicesCost, 0)
  const shopSupplies  = totalLabor * SHOP_SUPPLIES_RATE
  const grandTotal    = totalLabor + totalParts + totalShipping + totalOutside + shopSupplies
  const totalHours    = wo.items.reduce((s, i) => s + i.hours, 0)

  // Item status summary for hero
  const itemsDone       = wo.items.filter(i => i.itemStatus === "done").length
  const itemsInProgress = wo.items.filter(i => i.itemStatus === "in_progress").length
  const itemsReview     = wo.items.filter(i => i.itemStatus === "needs_review").length

  // ── Helpers ──────────────────────────────────────────────────────────────
  function patchItem(itemId: string, patch: Partial<WOItem>) {
    if (isLocked) return
    setWO(prev => prev ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, ...patch } : i) } : prev)
  }

  function toggleSignOff(itemId: string) {
    setWO(prev => {
      if (!prev) return prev
      return { ...prev, items: prev.items.map(i => i.id === itemId
        ? i.signedOffBy
          ? { ...i, signedOffBy: undefined, signedOffAt: undefined }
          : { ...i, signedOffBy: "You (Demo)", signedOffAt: new Date().toISOString() }
        : i
      )}
    })
  }

  function addItem(section: LogbookSection) {
    if (!newItem.category) return
    const item: WOItem = {
      id: `i-demo-${Date.now()}`,
      itemNumber: wo!.items.length + 1,
      category: newItem.category,
      logbookSection: section,
      taskNumber: newItem.taskNumber || undefined,
      discrepancy: newItem.discrepancy,
      correctiveAction: newItem.correctiveAction,
      hours: parseFloat(newItem.hours) || 0,
      laborRate: parseFloat(newItem.laborRate) || 125,
      parts: [],
      shippingCost: parseFloat(newItem.shippingCost) || 0,
      outsideServicesCost: parseFloat(newItem.outsideServicesCost) || 0,
      signOffRequired: true,
      itemStatus: "pending",
      itemLaborEntries: [],
    }
    setWO(prev => prev ? { ...prev, items: [...prev.items, item] } : prev)
    setOpenItems(prev => ({ ...prev, [item.id]: true }))
    setNewItem({ category: "", taskNumber: "", discrepancy: "", correctiveAction: "", hours: "", laborRate: "125", shippingCost: "0", outsideServicesCost: "0" })
    setAddingToSection(null)
  }

  function addPart(itemId: string) {
    if (!newPart.partNumber || !newPart.unitPrice) return
    const part: WOItemPart = {
      id: `p-demo-${Date.now()}`,
      partNumber: newPart.partNumber,
      description: newPart.description,
      qty: parseFloat(newPart.qty) || 1,
      unitPrice: parseFloat(newPart.unitPrice) || 0,
    }
    patchItem(itemId, { parts: [...(wo.items.find(i => i.id === itemId)?.parts ?? []), part] })
    setNewPart({ partNumber: "", description: "", qty: "1", unitPrice: "" })
    setAddingPartToItem(null)
  }

  function addLaborEntry(itemId: string) {
    if (!newLabor.mechName || !newLabor.hours) return
    const entry: WOItemLaborEntry = {
      id: `ile-demo-${Date.now()}`,
      mechName: newLabor.mechName,
      hours: parseFloat(newLabor.hours) || 0,
      clockedAt: newLabor.date,
    }
    const existing = wo.items.find(i => i.id === itemId)?.itemLaborEntries ?? []
    const totalHrs = existing.reduce((s, e) => s + e.hours, 0) + entry.hours
    patchItem(itemId, { itemLaborEntries: [...existing, entry], hours: totalHrs })
    setNewLabor({ mechName: "", hours: "", date: new Date().toISOString().slice(0, 10) })
    setAddingLaborToItem(null)
  }

  function advanceStatus() {
    const next = NEXT_STATUS[wo!.status]
    if (!next) return
    if (next === "completed") { setShowCompleteModal(true); return }
    setWO(prev => prev ? { ...prev, status: next, statusHistory: [...prev.statusHistory, { id: `sh-demo-${Date.now()}`, fromStatus: prev.status, toStatus: next, changedBy: "You (Demo)", changedAt: new Date().toISOString(), notes: `Advanced to ${WO_STATUS_LABELS[next]}` }] } : prev)
  }

  function regressStatus() {
    const prev = PREV_STATUS[wo!.status]
    if (!prev) return
    setWO(current => current ? { ...current, status: prev, statusHistory: [...current.statusHistory, { id: `sh-demo-${Date.now()}`, fromStatus: current.status, toStatus: prev, changedBy: "You (Demo)", changedAt: new Date().toISOString(), notes: `Returned to ${WO_STATUS_LABELS[prev]}` }] } : current)
  }

  function completeAndGenerate() { setShowCompleteModal(false); navigate("/app/beet-box/logbook/new?wo=" + wo!.id) }
  function completeOnly() {
    setShowCompleteModal(false)
    setWO(prev => prev ? { ...prev, status: "completed", closedAt: new Date().toISOString(), statusHistory: [...prev.statusHistory, { id: `sh-demo-${Date.now()}`, fromStatus: "billing", toStatus: "completed", changedBy: "You (Demo)", changedAt: new Date().toISOString(), notes: "Work order completed and closed." }] } : prev)
  }

  function showSection(s: LogbookSection) { if (!visibleSections.includes(s)) setVisibleSections(v => [...v, s]) }

  // ── Items tab section renderer ────────────────────────────────────────────
  function renderSection(section: LogbookSection) {
    const sectionItems = wo!.items.filter(i => i.logbookSection === section)
    const sectionTotal = sectionItems.reduce((s, i) => s + itemSubtotal(i), 0)
    const sectionHours = sectionItems.reduce((s, i) => s + i.hours, 0)
    const isOpen = !!openSections[section]
    const color = SECTION_COLORS[section]

    return (
      <div key={section} className="rounded-lg overflow-hidden" style={{ border: "1px solid hsl(0 0% 20%)" }}>

        {/* Section header */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none"
          style={{ background: "hsl(0 0% 14%)" }}
          onClick={() => setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))}
        >
          <ChevronRight
            className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
            style={{ color, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          <span className="text-sm font-bold uppercase tracking-widest flex-1" style={{ fontFamily: "var(--font-heading)", color, letterSpacing: "0.12em" }}>
            {section}
          </span>
          <span className="text-white/30 text-xs">{sectionItems.length} {sectionItems.length === 1 ? "item" : "items"}</span>
          {sectionHours > 0 && <span className="text-white/30 text-xs">{sectionHours.toFixed(1)} hrs</span>}
          {sectionTotal > 0 && <span className="text-white/50 text-xs font-mono">${sectionTotal.toFixed(2)}</span>}
          {!isLocked && (
            <button
              onClick={e => { e.stopPropagation(); setAddingToSection(section); setOpenSections(p => ({ ...p, [section]: true })) }}
              className="flex items-center gap-1 text-xs text-white/35 hover:text-white/70 transition-colors ml-2 px-2 py-1 rounded hover:bg-white/[0.07]"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>

        {/* Section body */}
        {isOpen && (
          <div className="divide-y divide-white/[0.07]">
            {sectionItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                isLocked={isLocked}
                isOpen={!!openItems[item.id]}
                onToggle={() => setOpenItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                onPatch={patch => patchItem(item.id, patch)}
                onSignOff={() => toggleSignOff(item.id)}
                assignedMechanics={wo!.assignedMechanics}
                addingPartToItem={addingPartToItem}
                setAddingPartToItem={setAddingPartToItem}
                newPart={newPart}
                setNewPart={setNewPart}
                onAddPart={() => addPart(item.id)}
                addingLaborToItem={addingLaborToItem}
                setAddingLaborToItem={setAddingLaborToItem}
                newLabor={newLabor}
                setNewLabor={setNewLabor}
                onAddLabor={() => addLaborEntry(item.id)}
              />
            ))}

            {sectionItems.length === 0 && addingToSection !== section && (
              <div className="px-6 py-4 text-white/20 text-xs italic">No items in this section.</div>
            )}

            {/* Add item form */}
            {addingToSection === section && (
              <div className="px-5 py-4 space-y-3 bg-white/[0.02]">
                <p className="text-white/50 text-[10px] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>New {section} Item</p>
                <div className="grid grid-cols-2 gap-3">
                  <input className="px-3 py-2 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25" placeholder="Task name (e.g. 14-Day Service Check)" value={newItem.category} onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))} autoFocus />
                  <input className="px-3 py-2 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25" placeholder="Task # / ATA Code (optional)" value={newItem.taskNumber} onChange={e => setNewItem(n => ({ ...n, taskNumber: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>Discrepancy</p>
                    <textarea className="w-full px-3 py-2 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-white/25" rows={3} placeholder="What was found or needs to be done…" value={newItem.discrepancy} onChange={e => setNewItem(n => ({ ...n, discrepancy: e.target.value }))} />
                  </div>
                  <div>
                    <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>Corrective Action</p>
                    <textarea className="w-full px-3 py-2 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-white/25" rows={3} placeholder="What was done to correct it (can fill in later)…" value={newItem.correctiveAction} onChange={e => setNewItem(n => ({ ...n, correctiveAction: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Hours", key: "hours" as const, placeholder: "0.0" },
                    { label: "Labor Rate", key: "laborRate" as const, placeholder: "125" },
                    { label: "Shipping", key: "shippingCost" as const, placeholder: "0.00" },
                    { label: "Outside Svcs", key: "outsideServicesCost" as const, placeholder: "0.00" },
                  ].map(f => (
                    <div key={f.key}>
                      <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)" }}>{f.label}</p>
                      <input type="number" step="0.5" className="w-full px-3 py-2 rounded text-xs bg-white/[0.06] border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-white/25" placeholder={f.placeholder} value={(newItem as any)[f.key]} onChange={e => setNewItem(n => ({ ...n, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => addItem(section)} disabled={!newItem.category} style={{ background: "var(--skyshare-gold)", color: "#000" }} className="text-xs font-semibold">Add Item</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingToSection(null)} className="text-white/40 text-xs">Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">

      {/* Hero */}
      <div className="hero-area px-8 pt-6 pb-0">
        <button onClick={() => navigate("/app/beet-box/work-orders")} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Work Orders
        </button>
        <div className="flex items-start justify-between gap-6 pb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "26px", letterSpacing: "0.05em" }}>{wo.woNumber}</h1>
              <WOStatusBadge status={wo.status} />
              <PriorityBadge priority={wo.priority} />
            </div>
            <p className="text-white/60 text-sm">{wo.woType}</p>
            <p className="text-white/40 text-xs">{wo.description.slice(0, 120)}{wo.description.length > 120 ? "…" : ""}</p>
          </div>
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            <button onClick={() => navigate("/app/beet-box/inventory")} className="text-xs font-bold px-3 py-1.5 rounded hover:opacity-80" style={{ background: "rgba(212,160,23,0.12)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
              {aircraft?.registration ?? "—"}
            </button>
            <span className="text-white/30 text-xs">Opened {new Date(wo.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            {wo.meterAtOpen && <span className="text-white/30 text-xs">{wo.meterAtOpen.toFixed(1)} hrs at open</span>}
          </div>
        </div>
        <div className="flex gap-6 border-t border-white/[0.07] pt-3 pb-3 text-xs text-white/40 flex-wrap">
          <span>Items: <span className="text-white/70 font-semibold">{wo.items.length}</span></span>
          <span>Labor: <span className="text-white/70 font-semibold">{totalHours.toFixed(1)} hrs</span></span>
          <span>Est. Total: <span className="text-white/70 font-semibold">${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></span>
          {itemsDone > 0 && <span className="text-emerald-400/70">✓ {itemsDone} done</span>}
          {itemsInProgress > 0 && <span className="text-blue-400/70">● {itemsInProgress} in progress</span>}
          {itemsReview > 0 && <span className="text-amber-400/70">⚠ {itemsReview} needs review</span>}
          {wo.discrepancyRef && <span>Discrepancy Ref: <span className="text-white/70">{wo.discrepancyRef}</span></span>}
        </div>
      </div>

      <div className="stripe-divider" />

      {/* Tabs */}
      <div className="flex-1 px-8 py-4">
        <Tabs defaultValue="items">
          <TabsList className="bg-white/[0.04] border border-white/10 mb-5">
            <TabsTrigger value="items"   className="data-[state=active]:bg-white/10 text-white/60 data-[state=active]:text-white flex items-center gap-1.5"><ChevronRight className="w-3.5 h-3.5" />Items</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-white/10 text-white/60 data-[state=active]:text-white flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Status History</TabsTrigger>
            <TabsTrigger value="notes"   className="data-[state=active]:bg-white/10 text-white/60 data-[state=active]:text-white flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" />Notes</TabsTrigger>
          </TabsList>

          {/* ── ITEMS TAB ──────────────────────────────────────────────────── */}
          <TabsContent value="items" className="space-y-3">

            {visibleSections.map(s => renderSection(s))}

            {/* Add section buttons for hidden sections */}
            {ALL_SECTIONS.filter(s => !visibleSections.includes(s)).length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <span className="text-white/25 text-xs">Add section:</span>
                {ALL_SECTIONS.filter(s => !visibleSections.includes(s)).map(s => (
                  <button
                    key={s}
                    onClick={() => showSection(s)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-dashed border-white/15 text-white/35 hover:text-white/60 hover:border-white/30 transition-all"
                  >
                    <Plus className="w-3 h-3" /> {s}
                  </button>
                ))}
              </div>
            )}

          </TabsContent>

          {/* ── STATUS HISTORY ─────────────────────────────────────────────── */}
          <TabsContent value="history">
            <div className="card-elevated rounded-lg p-5">
              <div className="relative pl-6">
                <div className="absolute left-2 top-1 bottom-1 w-px bg-white/10" />
                <div className="space-y-5">
                  {[...wo.statusHistory].reverse().map((sh, idx) => (
                    <div key={sh.id} className="relative">
                      <div className="absolute -left-4 top-1 w-2 h-2 rounded-full" style={{ background: idx === 0 ? "var(--skyshare-gold)" : "hsl(0 0% 30%)", border: `2px solid ${idx === 0 ? "var(--skyshare-gold)" : "hsl(0 0% 30%)"}` }} />
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {sh.fromStatus && <><WOStatusBadge status={sh.fromStatus} /><ChevronRight className="w-3 h-3 text-white/30 flex-shrink-0" /></>}
                            <WOStatusBadge status={sh.toStatus} />
                          </div>
                          <p className="text-white/60 text-xs mt-1.5">{sh.notes}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-white/50 text-xs font-medium">{sh.changedBy}</p>
                          <p className="text-white/30 text-xs">{new Date(sh.changedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── NOTES ─────────────────────────────────────────────────────── */}
          <TabsContent value="notes">
            <div className="card-elevated rounded-lg p-4 space-y-3">
              <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Work Order Notes</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={8} disabled={isLocked} placeholder="Add notes about this work order…" className="w-full bg-white/[0.04] border border-white/10 rounded px-3 py-2.5 text-white/80 text-sm resize-none focus:outline-none focus:border-white/25 placeholder:text-white/20 disabled:opacity-50" />
              {!isLocked && <Button size="sm" style={{ background: "var(--skyshare-gold)", color: "#000" }} className="font-semibold text-xs">Save Notes</Button>}
            </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* ── STATUS BAR ─────────────────────────────────────────────────────── */}
      {!isLocked && (NEXT_STATUS[wo.status] || PREV_STATUS[wo.status]) && (
        <div className="sticky bottom-0 px-8 py-4 flex items-center justify-between gap-4" style={{ background: "hsl(0 0% 10%)", borderTop: "1px solid hsl(0 0% 18%)" }}>
          <div className="flex items-center gap-2 text-xs text-white/35">
            <span>Status:</span><WOStatusBadge status={wo.status} />
            {NEXT_STATUS[wo.status] && <><ChevronRight className="w-3 h-3" /><WOStatusBadge status={NEXT_STATUS[wo.status]!} /></>}
          </div>
          <div className="flex items-center gap-3">
            {PREV_STATUS[wo.status] && <Button variant="ghost" size="sm" onClick={regressStatus} className="text-white/40 hover:text-white/70 text-xs border border-white/10">← Return to {WO_STATUS_LABELS[PREV_STATUS[wo.status]!]}</Button>}
            {wo.status === "waiting_on_parts" && <Button variant="ghost" size="sm" onClick={() => navigate("/app/beet-box/purchase-orders")} className="text-amber-400/70 hover:text-amber-300 text-xs border border-amber-900/30">View Purchase Orders</Button>}
            {NEXT_STATUS[wo.status] && (
              <Button size="sm" onClick={advanceStatus} style={wo.status === "billing" ? { background: "var(--skyshare-gold)", color: "#000" } : {}} className={cn("font-semibold text-xs px-5", wo.status !== "billing" && "bg-blue-700/40 hover:bg-blue-700/60 text-blue-200 border border-blue-800/40")}>
                {NEXT_STATUS_LABEL[wo.status]}
              </Button>
            )}
          </div>
        </div>
      )}

      {isLocked && (
        <div className="px-8 py-4 flex items-center gap-3" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
          <WOStatusBadge status={wo.status} />
          <span className="text-white/35 text-xs">{wo.status === "completed" ? `Closed ${wo.closedAt ? new Date(wo.closedAt).toLocaleDateString() : ""}` : "Work order is void"}</span>
          {wo.status === "completed" && <Button size="sm" variant="ghost" onClick={() => navigate("/app/beet-box/logbook")} className="text-white/50 hover:text-white/80 text-xs ml-2">View Logbook →</Button>}
        </div>
      )}

      {/* ── COMPLETE MODAL ─────────────────────────────────────────────────── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="card-elevated rounded-xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-white text-lg" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>Complete Work Order</h3>
            <div className="stripe-divider" />
            <p className="text-white/65 text-sm leading-relaxed">Work order <span className="text-white font-semibold">{wo.woNumber}</span> will be marked complete. Generate a logbook entry from this work order?</p>
            <div className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.08] text-xs space-y-1">
              <p className="text-white/40 uppercase tracking-widest text-[10px]" style={{ fontFamily: "var(--font-heading)" }}>Logbook Entry Preview</p>
              <p className="text-white/70"><span className="text-white/40">Aircraft:</span> {aircraft?.registration} — {aircraft?.make} {aircraft?.model}</p>
              <p className="text-white/70"><span className="text-white/40">Sections:</span> {[...new Set(wo.items.map(i => i.logbookSection))].join(", ")}</p>
              <p className="text-white/70"><span className="text-white/40">Items:</span> {wo.items.length} task items · {totalHours.toFixed(1)} hrs total</p>
            </div>
            <Button onClick={completeAndGenerate} style={{ background: "var(--skyshare-gold)", color: "#000" }} className="w-full font-semibold text-sm">Complete + Generate Logbook Entry</Button>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={completeOnly} className="flex-1 text-white/50 hover:text-white/80 text-sm border border-white/10">Complete Without Logbook Entry</Button>
              <Button variant="ghost" onClick={() => setShowCompleteModal(false)} className="text-white/35 hover:text-white/60 text-sm">Cancel</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
