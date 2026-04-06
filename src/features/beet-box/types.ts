// ─── Beet Box — Shared Types ──────────────────────────────────────────────────
// Single source of truth for all Beet Box TypeScript types.
// Replaces the type exports previously in data/mockData.ts.

// ─── Enums (mirror PostgreSQL enums) ─────────────────────────────────────────

export type WOStatus =
  | "draft" | "open" | "waiting_on_parts" | "in_review"
  | "billing" | "completed" | "void"

export type WOItemStatus =
  | "pending" | "in_progress" | "done" | "needs_review" | "cut_short"

export type LogbookSection =
  | "Airframe" | "Engine 1" | "Engine 2" | "Propeller" | "APU" | "Other"

export type Priority = "routine" | "urgent" | "aog"
export type PartCondition = "new" | "overhauled" | "serviceable" | "as_removed"
export type TransactionType = "receipt" | "issue" | "return" | "adjustment" | "scrap"
export type POStatus = "draft" | "sent" | "partial" | "received" | "closed" | "voided"
export type ToolStatus = "active" | "due_soon" | "overdue" | "out_of_service" | "retired"
export type InvoiceStatus = "draft" | "sent" | "paid" | "void"
export type InvoiceLineType = "part" | "labor" | "misc" | "outside_labor"
export type LogbookEntryStatus = "draft" | "signed" | "exported"
export type CertType = "A&P" | "IA" | "A&P/IA" | "Avionics" | "Other"
export type TrainingStatus = "current" | "expiring_soon" | "expired" | "not_trained"
export type SOPCategory =
  | "Work Orders" | "Parts & Inventory" | "Logbook" | "Invoicing"
  | "Tool Calibration" | "Safety" | "Portal Navigation"

// ─── Aircraft ─────────────────────────────────────────────────────────────────

export interface FleetAircraft {
  id: string
  make: string
  modelFamily: string
  modelFull: string
  serialNumber: string
  year: number
  isTwin: boolean
  hasProp: boolean
  hasApu: boolean
  engineManufacturer: string | null
  engineModel: string | null
  // Current registration pulled from aircraft_registrations
  registration: string | null
}

// Represents the aircraft reference on a WO / invoice / logbook entry.
// Either a fleet aircraft (id populated) or a one-off guest entry.
export interface AircraftRef {
  aircraftId: string | null
  registration: string | null   // fleet: from aircraft_registrations; guest: guest_registration
  serialNumber: string | null   // fleet: aircraft.serial_number; guest: guest_serial
  make: string | null
  modelFull: string | null
  engineManufacturer: string | null
  engineModel: string | null
}

// ─── Mechanic / Technician ────────────────────────────────────────────────────

export interface Mechanic {
  id: string           // profiles.id
  name: string         // full_name or display_name
  email: string
  // From bb_mechanic_certs (primary cert)
  certType: CertType | null
  certNumber: string | null
}

// ─── Work Orders ─────────────────────────────────────────────────────────────

export interface WorkOrder {
  id: string
  woNumber: string
  // Aircraft (fleet or guest)
  aircraftId: string | null
  guestRegistration: string | null
  guestSerial: string | null
  // Resolved display ref (populated by join in service)
  aircraft: AircraftRef | null
  status: WOStatus
  priority: Priority
  woType: string
  description: string | null
  openedBy: string | null       // profile id
  openedByName: string | null   // denormalized display
  openedAt: string
  closedAt: string | null
  meterAtOpen: number | null
  meterAtClose: number | null
  discrepancyRef: string | null
  notes: string | null
  // Loaded relations
  mechanics: Mechanic[]
  items: WOItem[]
  statusHistory: WOStatusChange[]
  createdAt: string
  updatedAt: string
}

export interface WOItem {
  id: string
  workOrderId: string
  itemNumber: number
  category: string
  logbookSection: LogbookSection
  taskNumber: string | null
  partNumber: string | null
  serialNumber: string | null
  discrepancy: string
  correctiveAction: string
  refCode: string
  mechanicId: string | null
  mechanicName: string | null
  estimatedHours: number
  laborRate: number
  shippingCost: number
  outsideServicesCost: number
  signOffRequired: boolean
  signedOffBy: string | null
  signedOffAt: string | null
  itemStatus: WOItemStatus
  noPartsRequired: boolean
  parts: WOItemPart[]
  labor: WOItemLabor[]
  createdAt: string
  updatedAt: string
}

export interface WOItemPart {
  id: string
  itemId: string
  partNumber: string
  description: string
  qty: number
  unitPrice: number
}

export interface WOItemLabor {
  id: string
  itemId: string
  workOrderId: string
  mechanicId: string | null
  mechanicName: string
  hours: number
  clockedAt: string
  description: string | null
  billable: boolean
}

export interface WOStatusChange {
  id: string
  workOrderId: string
  fromStatus: WOStatus | null
  toStatus: WOStatus
  changedBy: string | null
  changedAt: string
  notes: string | null
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryPart {
  id: string
  partNumber: string
  description: string
  manufacturer: string | null
  uom: string
  qtyOnHand: number
  qtyReserved: number
  reorderPoint: number
  unitCost: number
  locationBin: string | null
  condition: PartCondition
  vendorName: string | null
  isConsumable: boolean
  notes: string | null
  transactions: PartTransaction[]
  createdAt: string
  updatedAt: string
}

export interface PartTransaction {
  id: string
  partId: string
  type: TransactionType
  qty: number
  unitCost: number | null
  transactionDate: string
  performedBy: string | null
  performedName: string
  woRef: string | null
  poRef: string | null
  notes: string | null
  createdAt: string
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export interface PurchaseOrder {
  id: string
  poNumber: string
  vendorName: string
  vendorContact: string | null
  status: POStatus
  createdBy: string | null
  expectedDelivery: string | null
  receivedAt: string | null
  notes: string | null
  lines: POLine[]
  createdAt: string
  updatedAt: string
}

export interface POLine {
  id: string
  purchaseOrderId: string
  lineNumber: number
  partNumber: string
  description: string
  qtyOrdered: number
  qtyReceived: number
  unitCost: number
  woRef: string | null
  createdAt: string
  updatedAt: string
}

// ─── Tool Calibration ─────────────────────────────────────────────────────────

export interface Tool {
  id: string
  toolNumber: string
  description: string
  serialNumber: string | null
  manufacturer: string | null
  location: string | null
  status: ToolStatus
  calibrationIntervalDays: number
  lastCalibratedAt: string | null
  nextCalibrationDue: string | null
  calibrationVendor: string | null
  notes: string | null
  history: CalibrationRecord[]
  createdAt: string
  updatedAt: string
}

export interface CalibrationRecord {
  id: string
  toolId: string
  calibratedBy: string | null
  calibratedByName: string
  calibratedAt: string
  nextDue: string
  certificateNumber: string | null
  notes: string | null
  createdAt: string
}

// ─── Invoicing ────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string
  invoiceNumber: string
  workOrderId: string | null
  woNumber: string | null
  aircraftId: string | null
  guestRegistration: string | null
  aircraft: AircraftRef | null
  customerName: string
  status: InvoiceStatus
  issuedDate: string
  dueDate: string | null
  paidAt: string | null
  subtotalLabor: number
  subtotalParts: number
  subtotalMisc: number
  taxRate: number
  taxAmount: number
  grandTotal: number
  notes: string | null
  createdBy: string | null
  lines: InvoiceLine[]
  createdAt: string
  updatedAt: string
}

export interface InvoiceLine {
  id: string
  invoiceId: string
  lineNumber: number
  description: string
  type: InvoiceLineType
  qty: number
  unitPrice: number
  extended: number
  taxable: boolean
}

// ─── Logbook ──────────────────────────────────────────────────────────────────

export interface LogbookEntrySignatory {
  id: string
  entryId: string
  profileId: string | null
  mechanicName: string
  certType: CertType | null
  certNumber: string | null
  sortOrder: number
  createdAt: string
}

export interface LogbookEntry {
  id: string
  entryNumber: string
  aircraftId: string | null
  guestRegistration: string | null
  guestSerial: string | null
  aircraft: AircraftRef | null
  workOrderId: string | null
  woNumber: string | null
  entryDate: string
  totalAircraftTime: number | null
  totalAircraftTimeNew: number | null
  landings: number | null
  landingsNew: number | null
  hobbs: number | null
  hobbsNew: number | null
  sectionTitle: string
  logbookSection: LogbookSection
  returnToService: string
  mechanicId: string | null
  mechanicName: string
  certificateType: CertType
  certificateNumber: string
  isRia: boolean
  inspectorId: string | null
  inspectorName: string | null
  inspectorCert: string | null
  status: LogbookEntryStatus
  signedAt: string | null
  lines: LogbookEntryLine[]
  signatories: LogbookEntrySignatory[]
  createdAt: string
  updatedAt: string
}

export interface LogbookEntryLine {
  id: string
  entryId: string
  lineNumber: number
  text: string
  refCode: string
  signatoryId: string | null
  woItemId: string | null
}

// ─── SOPs ─────────────────────────────────────────────────────────────────────

export interface SOP {
  id: string
  sopNumber: string
  title: string
  category: SOPCategory
  revision: string
  effectiveDate: string | null
  reviewDate: string | null
  author: string | null
  approvedBy: string | null
  description: string
  tags: string[]
  steps: SOPStep[]
  relatedSopIds: string[]
  createdAt: string
  updatedAt: string
}

export interface SOPStep {
  id: string
  sopId: string
  stepNumber: number
  instruction: string
  note: string | null
  warning: string | null
}

// ─── Training ─────────────────────────────────────────────────────────────────

export interface TrainingRecord {
  id: string
  mechanicId: string
  trainingType: string
  issuedDate: string
  expiryDate: string | null
  issuer: string
  certificateNumber: string | null
  status: TrainingStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ─── Mechanic Certs ───────────────────────────────────────────────────────────

export interface MechanicCert {
  id: string
  profileId: string
  certType: CertType
  certNumber: string
  issuedDate: string | null
  isPrimary: boolean
  notes: string | null
}
