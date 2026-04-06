import { cn } from "@/shared/lib/utils"
import type { WOStatus, POStatus, ToolStatus, InvoiceStatus } from "../types"
import {
  WO_STATUS_LABELS,
  PO_STATUS_LABELS,
  TOOL_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
} from "../constants"

// ─── Work Order Status ────────────────────────────────────────────────────────

const WO_BADGE_STYLES: Record<WOStatus, string> = {
  draft:            "bg-zinc-800 text-zinc-300 border border-zinc-700",
  open:             "bg-blue-900/40 text-blue-300 border border-blue-800/60",
  waiting_on_parts: "bg-amber-900/40 text-amber-300 border border-amber-800/60",
  in_review:        "bg-purple-900/40 text-purple-300 border border-purple-800/60",
  billing:          "bg-orange-900/40 text-orange-300 border border-orange-800/60",
  completed:        "bg-emerald-900/40 text-emerald-300 border border-emerald-800/60",
  void:             "bg-red-900/20 text-red-400/70 border border-red-900/40",
}

const PO_BADGE_STYLES: Record<POStatus, string> = {
  draft:    "bg-zinc-800 text-zinc-300 border border-zinc-700",
  sent:     "bg-blue-900/40 text-blue-300 border border-blue-800/60",
  partial:  "bg-amber-900/40 text-amber-300 border border-amber-800/60",
  received: "bg-emerald-900/40 text-emerald-300 border border-emerald-800/60",
  closed:   "bg-zinc-700/60 text-zinc-400 border border-zinc-600",
  voided:   "bg-red-900/20 text-red-400/70 border border-red-900/40",
}

const TOOL_BADGE_STYLES: Record<ToolStatus, string> = {
  active:         "bg-emerald-900/40 text-emerald-300 border border-emerald-800/60",
  due_soon:       "bg-amber-900/40 text-amber-300 border border-amber-800/60",
  overdue:        "bg-red-900/40 text-red-300 border border-red-800/60",
  out_of_service: "bg-red-900/60 text-red-200 border border-red-700",
  retired:        "bg-zinc-700/60 text-zinc-400 border border-zinc-600",
}

const INVOICE_BADGE_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-zinc-800 text-zinc-300 border border-zinc-700",
  sent:  "bg-blue-900/40 text-blue-300 border border-blue-800/60",
  paid:  "bg-emerald-900/40 text-emerald-300 border border-emerald-800/60",
  void:  "bg-red-900/20 text-red-400/70 border border-red-900/40",
}

const BASE = "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase"

export function WOStatusBadge({ status, className }: { status: WOStatus; className?: string }) {
  return (
    <span className={cn(BASE, WO_BADGE_STYLES[status], className)}>
      {WO_STATUS_LABELS[status]}
    </span>
  )
}

export function POStatusBadge({ status, className }: { status: POStatus; className?: string }) {
  return (
    <span className={cn(BASE, PO_BADGE_STYLES[status], className)}>
      {PO_STATUS_LABELS[status]}
    </span>
  )
}

export function ToolStatusBadge({ status, className }: { status: ToolStatus; className?: string }) {
  return (
    <span className={cn(BASE, TOOL_BADGE_STYLES[status], className)}>
      {TOOL_STATUS_LABELS[status]}
    </span>
  )
}

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <span className={cn(BASE, INVOICE_BADGE_STYLES[status], className)}>
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}
