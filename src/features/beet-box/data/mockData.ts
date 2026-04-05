// ─── Beet Box Mock Data ───────────────────────────────────────────────────────
// All data is static/hardcoded for demo purposes. No Supabase connections.

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogbookSection = "Airframe" | "Engine 1" | "Engine 2" | "Propeller" | "APU" | "Other"

export type WOStatus =
  | "draft"
  | "open"
  | "waiting_on_parts"
  | "in_review"
  | "billing"
  | "completed"
  | "void"

export type POStatus = "draft" | "sent" | "partial" | "received" | "closed" | "voided"
export type ToolStatus = "active" | "due_soon" | "overdue" | "out_of_service" | "retired"
export type InvoiceStatus = "draft" | "sent" | "paid" | "void"
export type PartCondition = "new" | "overhauled" | "serviceable" | "as_removed"
export type TransactionType = "receipt" | "issue" | "return" | "adjustment" | "scrap"
export type ItemType = "part" | "labor" | "misc" | "outside_labor"
export type WOItemStatus = "pending" | "in_progress" | "done" | "needs_review" | "cut_short"

export interface Aircraft {
  id: string
  registration: string
  make: string
  model: string
  serial: string
  year: number
  totalTime: number
}

export interface Mechanic {
  id: string
  name: string
  certificate: string
  certNumber: string
  role: string
}

export interface WOItemPart {
  id: string
  partNumber: string
  description: string
  qty: number
  unitPrice: number
}

export interface WOItemLaborEntry {
  id: string
  mechName: string
  hours: number
  clockedAt: string   // ISO date string
}

export interface WOItem {
  id: string
  itemNumber: number
  category: string          // Short task name shown in the item header
  logbookSection: LogbookSection  // Which logbook this entry belongs to
  taskNumber?: string       // ATA code or task ref, e.g. "05-CUS-14"
  partNumber?: string       // Primary P/N for this task (AD compliance, etc.)
  serialNumber?: string
  discrepancy: string       // What was found / task description
  correctiveAction: string  // What was done (empty while WO is open)
  mechanicName?: string
  hours: number
  laborRate: number         // $/hr
  parts: WOItemPart[]
  shippingCost: number
  outsideServicesCost: number
  signOffRequired: boolean
  signedOffBy?: string
  signedOffAt?: string
  // Per-item work tracking
  itemStatus?: WOItemStatus
  itemLaborEntries?: WOItemLaborEntry[]
  noPartsRequired?: boolean
}

export interface LaborEntry {
  id: string
  mechanicId: string
  mechanicName: string
  workDate: string
  hours: number
  description: string
  billable: boolean
}

export interface StatusChange {
  id: string
  fromStatus: WOStatus | null
  toStatus: WOStatus
  changedBy: string
  changedAt: string
  notes: string
}

export interface WorkOrder {
  id: string
  woNumber: string
  aircraftId: string
  status: WOStatus
  woType: string
  description: string
  priority: "routine" | "urgent" | "aog"
  openedBy: string
  openedAt: string
  closedAt?: string
  meterAtOpen: number
  meterAtClose?: number
  assignedMechanics: string[]
  items: WOItem[]
  laborEntries: LaborEntry[]
  statusHistory: StatusChange[]
  notes: string
  discrepancyRef?: string
}

export interface InventoryPart {
  id: string
  partNumber: string
  description: string
  manufacturer: string
  uom: string
  qtyOnHand: number
  qtyReserved: number
  reorderPoint: number
  unitCost: number
  locationBin: string
  condition: PartCondition
  vendorId: string
  vendorName: string
  isConsumable: boolean
  transactions: PartTransaction[]
}

export interface PartTransaction {
  id: string
  type: TransactionType
  qty: number
  unitCost: number
  date: string
  performedBy: string
  woRef?: string
  poRef?: string
  notes: string
}

export interface POLine {
  id: string
  partNumber: string
  description: string
  qtyOrdered: number
  qtyReceived: number
  unitCost: number
  woRef?: string
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  vendorId: string
  vendorName: string
  status: POStatus
  createdBy: string
  createdAt: string
  expectedDelivery?: string
  lines: POLine[]
  notes: string
}

export interface Tool {
  id: string
  toolNumber: string
  description: string
  serialNumber: string
  manufacturer: string
  location: string
  status: ToolStatus
  calibrationIntervalDays: number
  lastCalibratedAt: string
  nextCalibrationDue: string
  calibrationVendor: string
  history: CalibrationRecord[]
}

export interface CalibrationRecord {
  id: string
  calibratedBy: string
  calibratedAt: string
  nextDue: string
  certificateNumber: string
  notes: string
}

export interface InvoiceLine {
  id: string
  description: string
  type: ItemType
  qty: number
  unitPrice: number
  extended: number
  taxable: boolean
}

export interface Invoice {
  id: string
  invoiceNumber: string
  woId?: string
  woNumber?: string
  aircraftId: string
  aircraftReg: string
  customerName: string
  status: InvoiceStatus
  issuedDate: string
  dueDate?: string
  lines: InvoiceLine[]
  subtotalLabor: number
  subtotalParts: number
  subtotalMisc: number
  taxAmount: number
  grandTotal: number
  notes: string
}

export interface LogbookEntryLine {
  number: number
  text: string
}

export interface LogbookEntry {
  id: string
  entryNumber: string
  aircraftId: string
  aircraftReg: string
  make: string
  model: string
  serial: string
  woId?: string
  woNumber?: string
  entryDate: string
  totalAircraftTime: number      // A/C TT at time of entry
  totalAircraftTimeNew?: number  // Updated TT after work (if changed)
  landings?: number
  landingsNew?: number
  hobbs?: number
  hobbsNew?: number
  sectionTitle: string           // "Airframe Entries", "Engine Entries", "Entries", etc.
  entries: LogbookEntryLine[]    // Numbered corrective action items
  complianceRef?: string
  returnToService: string
  mechanicId: string
  mechanicName: string
  certificateType: "A&P" | "IA" | "A&P/IA"
  certificateNumber: string
  isRIA: boolean
  inspectorName?: string
  inspectorCert?: string
  status: "draft" | "signed" | "exported"
  signedAt?: string
}

// ─── Settings types (demo-only, not yet wired to Supabase) ───────────────────

export type TrainingStatus = "current" | "expiring_soon" | "expired" | "not_trained"
export type SOPCategory =
  | "Work Orders" | "Parts & Inventory" | "Logbook" | "Invoicing"
  | "Tool Calibration" | "Safety" | "Portal Navigation"

export type Permission =
  | "wo.view" | "wo.create" | "wo.edit_items" | "wo.advance_status"
  | "wo.assign_mechanics" | "wo.delete" | "wo.void"
  | "labor.log_own" | "labor.log_others" | "labor.delete"
  | "parts.add" | "parts.remove" | "parts.order"
  | "signoff.perform" | "signoff.undo"
  | "logbook.view" | "logbook.create" | "logbook.sign_lock" | "logbook.edit_locked"
  | "invoicing.view" | "invoicing.create" | "invoicing.edit" | "invoicing.void"
  | "inventory.view" | "inventory.adjust_qty" | "inventory.add_items"
  | "po.view" | "po.create" | "po.receive"
  | "tools.view" | "tools.edit"
  | "settings.view" | "settings.edit"

export type MXRole = "Admin" | "Manager" | "IA Mechanic" | "A&P Mechanic" | "Apprentice" | "Read-Only"

export interface SystemUser {
  id: string
  name: string
  email: string
  role: MXRole
  certType?: string
  certNumber?: string
  active: boolean
}

// ─── Label constants (re-exported from constants.ts for backwards-compat) ─────

export {
  WO_STATUS_LABELS,
  PO_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  TOOL_STATUS_LABELS,
  TRAINING_STATUS_LABELS,
} from "../constants"

// ─── Stub data arrays (modules not yet wired to Supabase return empty) ────────

export const AIRCRAFT: Aircraft[] = []
export const WORK_ORDERS: WorkOrder[] = []
export const INVENTORY_PARTS: InventoryPart[] = []
export const PURCHASE_ORDERS: PurchaseOrder[] = []
export const TOOLS: Tool[] = []
export const INVOICES: Invoice[] = []
export const LOGBOOK_ENTRIES: LogbookEntry[] = []
export const MECHANICS: Mechanic[] = []

export interface SOPStep { id: string; stepNumber: number; instruction: string }
export interface SOP {
  id: string; sopNumber: string; title: string; category: SOPCategory
  revision: string; effectiveDate: string; steps: SOPStep[]
}
export interface TrainingRecord {
  id: string; mechanicId: string; sopId: string; completedAt: string
  expiresAt?: string; status: TrainingStatus; notes: string
}

export const SOPS: SOP[] = []
export const TRAINING_RECORDS: TrainingRecord[] = []

export const ROLES: { role: MXRole; permissions: Permission[] }[] = []
export const SYSTEM_USERS: SystemUser[] = []
export const ALL_PERMISSIONS: Permission[] = []

