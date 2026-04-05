// ─── Beet Box Display Constants ───────────────────────────────────────────────
import type { WOStatus, POStatus, InvoiceStatus, ToolStatus, TrainingStatus } from "./types"

export const WO_STATUS_LABELS: Record<WOStatus, string> = {
  draft:            "Draft",
  open:             "Open",
  waiting_on_parts: "Waiting on Parts",
  in_review:        "In Review",
  billing:          "Billing",
  completed:        "Completed",
  void:             "Void",
}

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft:    "Draft",
  sent:     "Sent",
  partial:  "Partially Received",
  received: "Received",
  closed:   "Closed",
  voided:   "Voided",
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent:  "Sent",
  paid:  "Paid",
  void:  "Void",
}

export const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  active:          "Current",
  due_soon:        "Due Soon",
  overdue:         "Overdue",
  out_of_service:  "Out of Service",
  retired:         "Retired",
}

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  current:       "Current",
  expiring_soon: "Expiring Soon",
  expired:       "Expired",
  not_trained:   "Not Trained",
}

export const WO_TYPES = [
  "100-Hour Inspection",
  "Annual Inspection",
  "Phase Inspection",
  "Scheduled Maintenance — Traxxall Import",
  "Unscheduled — Squawk",
  "Unscheduled — Hydraulic",
  "Unscheduled — Avionics",
  "Unscheduled — Engine",
  "Unscheduled — Structural",
  "Landing Gear Inspection",
  "Engine Run-Up / Test",
  "Airworthiness Directive",
  "Service Bulletin",
  "Altimeter/Transponder Check",
  "Other",
]
