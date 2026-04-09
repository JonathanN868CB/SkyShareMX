// ─── Work Orders Mock Data ───────────────────────────────────────────────────────
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
export const MECHANICS: Mechanic[] = [
  { id: "mech-01", name: "Jonathan Schaedig", certificate: "A&P",  certNumber: "2744545", role: "Director of Maintenance" },
  { id: "mech-02", name: "Ben Huff",          certificate: "—",    certNumber: "—",       role: "Technician"              },
  { id: "mech-03", name: "Charles Hicks",     certificate: "—",    certNumber: "—",       role: "Technician"              },
  { id: "mech-04", name: "Emilio Santana",    certificate: "—",    certNumber: "—",       role: "Technician"              },
  { id: "mech-05", name: "Jessica Storey",    certificate: "—",    certNumber: "—",       role: "Technician"              },
]

// ─── SOP & Training types ────────────────────────────────────────────────────

export interface SOPStep {
  id: string
  number: number
  instruction: string
  note?: string
  warning?: string
}

export interface SOP {
  id: string
  sopNumber: string
  title: string
  category: SOPCategory
  revision: string
  effectiveDate: string
  reviewDate: string
  author: string
  approvedBy: string
  description: string
  tags: string[]
  relatedSOPs: string[]
  steps: SOPStep[]
}

export interface TrainingRecord {
  id: string
  mechanicId: string
  sopId: string
  status: TrainingStatus
  trainedBy: string
  trainedDate: string
  expiryDate: string
  notes: string
}

// ─── SOPs — Real procedures for SkyShareMX / Work Orders ────────────────────────

export const SOPS: SOP[] = [
  // ── Work Orders ────────────────────────────────────────────────────────────
  {
    id: "sop-01",
    sopNumber: "SOP-BB-001",
    title: "Creating a New Work Order",
    category: "Work Orders",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "Step-by-step procedure for creating a new work order in Work Orders, including aircraft selection, type designation, priority setting, and initial item entry.",
    tags: ["work order", "create", "new WO", "draft"],
    relatedSOPs: ["sop-02", "sop-04"],
    steps: [
      { id: "s01-1", number: 1, instruction: "Navigate to Work Orders → Work Orders from the sidebar, then click the '+ New Work Order' button in the top right." },
      { id: "s01-2", number: 2, instruction: "Select the aircraft. For fleet aircraft, choose from the dropdown — registration, make, model, and serial will auto-populate. For guest aircraft, toggle to 'Guest' and enter the registration and serial manually." },
      { id: "s01-3", number: 3, instruction: "Choose the WO Type from the dropdown (e.g. 100-Hour, Annual, Phase, Squawk, Airworthiness Directive, etc.). This categorizes the work order for billing and audit purposes." },
      { id: "s01-4", number: 4, instruction: "Enter the meter reading at open (Hobbs or tach time). This is recorded for compliance tracking and logbook reference." },
      { id: "s01-5", number: 5, instruction: "Optionally add a description and any general notes. The description appears on the WO card in the dashboard view." },
      { id: "s01-6", number: 6, instruction: "Click 'Create Work Order'. The system generates a WO number in YY-NNNN format (e.g. 26-0025) and opens the detail view in Draft status." },
      { id: "s01-8", number: 8, instruction: "From the detail view, add line items by clicking '+ Add item' under the appropriate logbook section (Airframe, Engine 1, Engine 2, Propeller, APU, or Other).", note: "Items are grouped by logbook section. This grouping carries through to logbook entry generation — each section becomes its own logbook page." },
    ],
  },
  {
    id: "sop-02",
    sopNumber: "SOP-BB-002",
    title: "Adding and Managing Work Order Items",
    category: "Work Orders",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to add line items to a work order, write discrepancy and corrective action text, log labor, attach parts, and track item-level status.",
    tags: ["line item", "discrepancy", "corrective action", "labor", "parts"],
    relatedSOPs: ["sop-01", "sop-03", "sop-06"],
    steps: [
      { id: "s02-1", number: 1, instruction: "In the Work Order detail view, click '+ Add item' under the logbook section where this task belongs (e.g. Airframe for structural work, Engine 1 for engine tasks)." },
      { id: "s02-2", number: 2, instruction: "Enter the Category (short task name), Task Number (ATA reference code like 24-30/482), and estimated hours. The category is what appears in the left rail item list." },
      { id: "s02-3", number: 3, instruction: "Write the Task / Discrepancy — this is what needs to be done or what was found during inspection. Use the formatting toolbar for bold, italic, or bullet points." },
      { id: "s02-4", number: 4, instruction: "After completing the work, write the Work Performed / Corrective Action. This text flows into the logbook entry upon sign-off.", note: "The corrective action becomes the official logbook record. Write it as you would for the aircraft logbook — include part numbers installed/removed, AD references, and compliance statements." },
      { id: "s02-5", number: 5, instruction: "Enter the Ref / Task Code (TRACSALL or CAMP reference). This is required before sign-off and populates the Code column in the logbook entry." },
      { id: "s02-6", number: 6, instruction: "Log labor by clicking 'Log Time' in the Labor section. Select the mechanic, enter hours worked, and set the date. Hours are tracked per mechanic per item." },
      { id: "s02-7", number: 7, instruction: "Add parts via 'Pull from Inventory' (searches existing stock) or 'Add Manually' for non-stock parts. Include part number, description, quantity, and unit price." },
      { id: "s02-8", number: 8, instruction: "Update the item status using the status buttons at the top: Pending → In Progress → Done (or Needs Review / Cut Short as needed). Status is tracked per item independently.", note: "The 'No parts required' checkbox in the Parts section suppresses parts-related warnings for tasks that genuinely don't require parts (inspections, lubrication, etc.)." },
    ],
  },
  {
    id: "sop-03",
    sopNumber: "SOP-BB-003",
    title: "Signing Off Work Order Items",
    category: "Work Orders",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "Procedure for signing off a completed work order item. Sign-off creates a draft logbook entry, registers the mechanic as a signatory, and appends the corrective action line.",
    tags: ["sign-off", "logbook", "signatory", "certification"],
    relatedSOPs: ["sop-02", "sop-10", "sop-11"],
    steps: [
      { id: "s03-1", number: 1, instruction: "Ensure the corrective action text is complete and accurate. This is the text that will appear in the aircraft logbook." },
      { id: "s03-2", number: 2, instruction: "Enter the Ref / Task Code in the green input field below the Work Performed header. This is required — the Sign Off button is disabled without it.", warning: "The Ref Code must match the TRACSALL or CAMP task code exactly. An incorrect code will create a mismatch between the logbook and the tracking system." },
      { id: "s03-3", number: 3, instruction: "Click 'Sign Off This Item'. The system will: (1) save any unsaved text, (2) resolve your profile and certificate info, (3) mark the item as signed, (4) create or find the draft logbook entry for this WO + section, (5) add you as a signatory, and (6) append the corrective action as a line item." },
      { id: "s03-4", number: 4, instruction: "Verify the sign-off completed successfully — the button changes to 'Signed Off' with a green checkmark, showing your name and the sign-off date." },
      { id: "s03-5", number: 5, instruction: "To undo a sign-off (if corrections are needed), click 'Undo sign-off'. This clears the signature but does not delete the logbook entry — the entry must be corrected separately.", note: "Multiple mechanics can sign off different items within the same logbook section. Each mechanic's lines are grouped under their signatory block in the logbook entry." },
      { id: "s03-6", number: 6, instruction: "If a sign-off error appears (red banner), read the error message. Common causes: profile not found (re-login), missing Ref Code, or network timeout. Dismiss the error with the X button and retry." },
    ],
  },
  {
    id: "sop-04",
    sopNumber: "SOP-BB-004",
    title: "Advancing Work Order Status",
    category: "Work Orders",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to progress a work order through the status pipeline from Draft to Completed, including the review and billing stages.",
    tags: ["status", "pipeline", "complete", "billing", "review"],
    relatedSOPs: ["sop-01", "sop-13"],
    steps: [
      { id: "s04-1", number: 1, instruction: "The status pipeline is: Draft → Open → In Review → Billing → Completed. 'Waiting on Parts' is a side-branch from Open that returns to Open when parts arrive." },
      { id: "s04-2", number: 2, instruction: "To advance status, use the action button in the bottom status bar. The button label tells you the next action (e.g. 'Open Work Order', 'Submit for Review')." },
      { id: "s04-3", number: 3, instruction: "To return to a previous status, click the left arrow button (e.g. '← Draft'). This is useful if items need rework after review submission." },
      { id: "s04-4", number: 4, instruction: "When advancing to Completed, a confirmation modal appears asking whether to generate logbook entries. Choose 'Complete & View Logbook' to auto-switch to the Logbook tab, or 'Complete Only' to close the WO without navigating.", warning: "Once a work order is Completed, it becomes locked — no further edits to items, labor, or parts are possible. Ensure all sign-offs and corrective actions are finalized before completing." },
      { id: "s04-5", number: 5, instruction: "Each status change is recorded in the Status History tab with a timestamp, the user who made the change, and any notes. This creates a full audit trail." },
    ],
  },
  {
    id: "sop-05",
    sopNumber: "SOP-BB-005",
    title: "Importing Tasks from Traxxall CSV",
    category: "Work Orders",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to import scheduled maintenance tasks from a Traxxall spreadsheet export into a new Work Orders work order.",
    tags: ["traxxall", "import", "CSV", "scheduled maintenance"],
    relatedSOPs: ["sop-01", "sop-02"],
    steps: [
      { id: "s05-1", number: 1, instruction: "On the Work Order creation page, select 'Scheduled Maintenance — Traxxall Import' as the WO Type. This reveals the CSV import interface." },
      { id: "s05-2", number: 2, instruction: "Export your task basket from Traxxall as a CSV/Excel file. The file should contain columns for Aircraft Reg, Description, Task Number, Next Due date/hours, and Urgency." },
      { id: "s05-3", number: 3, instruction: "Drag and drop the file into the upload zone, or click to browse. The parser reads the file and displays a preview of detected tasks." },
      { id: "s05-4", number: 4, instruction: "Review the parsed tasks. Each task is auto-assigned a logbook section based on its description (e.g. engine-related tasks go to Engine 1/2, prop tasks to Propeller). You can reassign sections before import." },
      { id: "s05-5", number: 5, instruction: "Select the tasks you want to import using the checkboxes. By default all tasks are selected." },
      { id: "s05-6", number: 6, instruction: "Click 'Import Selected Tasks'. The system creates a draft work order pre-populated with all selected tasks as line items, grouped by logbook section.", note: "The imported WO opens in a preview state. You can edit any item, add parts, adjust labor rates, and modify discrepancy text before saving to the database." },
    ],
  },

  // ── Parts & Inventory ──────────────────────────────────────────────────────
  {
    id: "sop-06",
    sopNumber: "SOP-BB-006",
    title: "Pulling Parts from Inventory for a Work Order",
    category: "Parts & Inventory",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to search the inventory system and attach parts to a work order item, including the cross-check warning for parts mentioned in corrective actions but not logged.",
    tags: ["inventory", "parts", "pull", "stock"],
    relatedSOPs: ["sop-02", "sop-07", "sop-08"],
    steps: [
      { id: "s06-1", number: 1, instruction: "Open the work order item detail panel by selecting an item from the left rail." },
      { id: "s06-2", number: 2, instruction: "In the Parts section (gold header), click 'Pull from Inventory'. This opens the inventory search picker." },
      { id: "s06-3", number: 3, instruction: "Type a part number or description in the search field. Results show part number, description, qty on hand, and unit cost." },
      { id: "s06-4", number: 4, instruction: "Click 'Add' next to the desired part. The part is immediately attached to the item with qty = 1 at the inventory unit cost.", note: "If a part shows 'Out of stock', you can still add it, but consider creating a Purchase Order (SOP-BB-008) to source it." },
      { id: "s06-5", number: 5, instruction: "If the system detects a part number mentioned in your corrective action text that hasn't been logged as a part on this item, a yellow warning banner appears. Click '+ Add to Parts' to quickly add it.", warning: "Always verify parts are logged before sign-off. The P/N cross-check catches common oversights, but it only matches against inventory part numbers — manually entered parts or non-stock items must be added separately." },
    ],
  },
  {
    id: "sop-07",
    sopNumber: "SOP-BB-007",
    title: "Adding Parts Manually",
    category: "Parts & Inventory",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to manually add a part to a work order item when the part is not in the inventory system (vendor-direct, owner-supplied, or ad-hoc).",
    tags: ["manual part", "non-stock", "vendor-direct"],
    relatedSOPs: ["sop-06", "sop-08"],
    steps: [
      { id: "s07-1", number: 1, instruction: "In the Parts section of an item, click 'Add Manually' (from the empty state buttons) or 'Add Part' (from the header when parts already exist)." },
      { id: "s07-2", number: 2, instruction: "Enter the Part Number (e.g. MS28775-228), Description, Quantity, and Unit Price." },
      { id: "s07-3", number: 3, instruction: "Click 'Add Part' to attach it. The part appears in the parts list with the entered details." },
      { id: "s07-4", number: 4, instruction: "To switch to inventory search instead, click 'Search inventory instead' at the top of the manual entry form.", note: "Manually added parts do not deduct from inventory stock. If the part was pulled from your shelf, add it via the inventory picker instead so stock counts stay accurate." },
    ],
  },
  {
    id: "sop-08",
    sopNumber: "SOP-BB-008",
    title: "Creating a Purchase Order",
    category: "Parts & Inventory",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to create a purchase order for parts needed for a work order, including vendor selection, line items, and expected delivery tracking.",
    tags: ["purchase order", "PO", "ordering", "vendor"],
    relatedSOPs: ["sop-06", "sop-09"],
    steps: [
      { id: "s08-1", number: 1, instruction: "Navigate to Work Orders → Purchase Orders, then click '+ New Purchase Order'." },
      { id: "s08-2", number: 2, instruction: "Enter the Vendor Name and contact information. If the vendor is in the Vendor Map, reference their details there." },
      { id: "s08-3", number: 3, instruction: "Add line items: Part Number, Description, Qty Ordered, Unit Cost, and optionally a WO Reference linking the part to a specific work order." },
      { id: "s08-4", number: 4, instruction: "Set the Expected Delivery Date if known. This helps track parts in the 'Waiting on Parts' WO status." },
      { id: "s08-5", number: 5, instruction: "Add any notes (special instructions, shipping requirements, core return info)." },
      { id: "s08-6", number: 6, instruction: "Save the PO. The system generates a PO number (PO-YYYY-NNNN) in Draft status." },
      { id: "s08-7", number: 7, instruction: "To send the PO to the vendor, advance the status to 'Sent'. The PO can then be tracked through partial receipt, full receipt, and closure.", note: "You can also access Purchase Orders directly from a work order item by clicking the 'Order Parts' button in the Parts section header." },
    ],
  },
  {
    id: "sop-09",
    sopNumber: "SOP-BB-009",
    title: "Receiving Parts Against a Purchase Order",
    category: "Parts & Inventory",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to record received parts against a purchase order, update inventory quantities, and close the PO.",
    tags: ["receiving", "PO", "inventory", "receipt"],
    relatedSOPs: ["sop-08", "sop-06"],
    steps: [
      { id: "s09-1", number: 1, instruction: "Open the Purchase Order detail page from Work Orders → Purchase Orders." },
      { id: "s09-2", number: 2, instruction: "For each line item received, update the 'Qty Received' field with the actual quantity delivered." },
      { id: "s09-3", number: 3, instruction: "If only some items have arrived, the PO status automatically changes to 'Partial'. When all lines are fully received, mark the PO as 'Received'." },
      { id: "s09-4", number: 4, instruction: "Receiving triggers an inventory transaction (receipt type) that automatically increments the qty_on_hand for each part in the inventory system." },
      { id: "s09-5", number: 5, instruction: "Once all parts are received and verified, close the PO. If the related work order was in 'Waiting on Parts' status, advance it back to 'Open' to resume work.", warning: "Always verify part condition and documentation (8130-3 tags, trace docs) before accepting receipt. Receiving a part in the system without physical verification creates a compliance gap." },
    ],
  },

  // ── Logbook ────────────────────────────────────────────────────────────────
  {
    id: "sop-10",
    sopNumber: "SOP-BB-010",
    title: "Understanding Draft Logbook Entries",
    category: "Logbook",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How draft logbook entries are created automatically during work order sign-offs and how they organize corrective actions by logbook section and signatory.",
    tags: ["logbook", "draft", "entry", "signatory"],
    relatedSOPs: ["sop-03", "sop-11"],
    steps: [
      { id: "s10-1", number: 1, instruction: "Draft logbook entries are created automatically when a mechanic signs off a work order item. You do not create them manually." },
      { id: "s10-2", number: 2, instruction: "Each draft entry corresponds to one logbook section (Airframe, Engine 1, Engine 2, Propeller, APU, or Other) for one work order. Multiple items in the same section share a single entry." },
      { id: "s10-3", number: 3, instruction: "Each entry contains signatory blocks — one per mechanic who signed off items in that section. Each signatory block lists the corrective action lines they signed, with ref codes." },
      { id: "s10-4", number: 4, instruction: "View draft entries in the 'Logbook' tab of the work order detail view. The tab badge shows the count of draft entries.", note: "The Logbook tab shows editable fields for Return to Service statement, Total Aircraft Time, Hobbs, and Landings. These must be filled in before the entry can be finalized." },
      { id: "s10-5", number: 5, instruction: "Draft entries remain editable until the work order is completed. After completion, entries can be exported as PDF but the text is locked." },
    ],
  },
  {
    id: "sop-11",
    sopNumber: "SOP-BB-011",
    title: "Exporting Logbook Entries as PDF",
    category: "Logbook",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to generate a professional PDF from logbook entries for printing and insertion into the aircraft logbook.",
    tags: ["logbook", "PDF", "export", "print"],
    relatedSOPs: ["sop-10", "sop-03"],
    steps: [
      { id: "s11-1", number: 1, instruction: "Navigate to the Logbook tab in the work order detail view." },
      { id: "s11-2", number: 2, instruction: "Verify all fields are complete: Return to Service statement, A/C Total Time, Hobbs, and Landings for each section entry." },
      { id: "s11-3", number: 3, instruction: "Click the 'Export PDF' button. The system renders each logbook section as its own page in the PDF." },
      { id: "s11-4", number: 4, instruction: "A PDF preview modal opens showing the generated document. Review it for accuracy.", note: "Each page includes: aircraft identification (reg, serial, make/model), section header, line items with ref codes, signatory blocks with mechanic name and certificate info, and the Return to Service statement." },
      { id: "s11-5", number: 5, instruction: "Click 'Download' to save the PDF locally, or close the preview to make edits and regenerate." },
    ],
  },

  // ── Invoicing ──────────────────────────────────────────────────────────────
  {
    id: "sop-12",
    sopNumber: "SOP-BB-012",
    title: "Generating an Invoice from a Work Order",
    category: "Invoicing",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to create an invoice from a completed work order, including labor, parts, shop supplies, and tax calculations.",
    tags: ["invoice", "billing", "create", "work order"],
    relatedSOPs: ["sop-04", "sop-13"],
    steps: [
      { id: "s12-1", number: 1, instruction: "Navigate to Work Orders → Invoicing, then click '+ New Invoice' or open the Invoice tab from within a completed work order." },
      { id: "s12-2", number: 2, instruction: "Select the work order to invoice from. The system pre-fills aircraft info, customer name, and pulls all labor hours and parts from the WO items." },
      { id: "s12-3", number: 3, instruction: "Review the auto-generated line items. Labor lines show each item's hours × labor rate. Parts lines list each part with qty × unit price." },
      { id: "s12-4", number: 4, instruction: "Shop supplies are calculated at 5% of total labor cost and added as a misc line." },
      { id: "s12-5", number: 5, instruction: "Add any additional lines (outside services, shipping, handling, etc.) using the '+ Add Line' button." },
      { id: "s12-6", number: 6, instruction: "Set the tax rate and mark lines as taxable/non-taxable. The system calculates subtotals by category and the grand total automatically." },
      { id: "s12-7", number: 7, instruction: "Set the due date and add any notes for the customer." },
      { id: "s12-8", number: 8, instruction: "Save the invoice in Draft status. When ready to send, advance to 'Sent'. Mark as 'Paid' when payment is received.", note: "Invoice numbers are auto-generated as INV-YYYY-NNNN. The Invoice tab on the work order shows totals broken down by labor, parts, shipping, outside services, and shop supplies." },
    ],
  },
  {
    id: "sop-13",
    sopNumber: "SOP-BB-013",
    title: "Exporting an Invoice as PDF",
    category: "Invoicing",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to generate and download a professional PDF invoice for delivery to the customer.",
    tags: ["invoice", "PDF", "export", "print"],
    relatedSOPs: ["sop-12"],
    steps: [
      { id: "s13-1", number: 1, instruction: "Open the Invoice tab in the work order detail view, or navigate to the invoice from Work Orders → Invoicing." },
      { id: "s13-2", number: 2, instruction: "Verify all line items, totals, and customer details are correct." },
      { id: "s13-3", number: 3, instruction: "Click 'Export PDF'. The system renders the invoice in a print-friendly format with company branding." },
      { id: "s13-4", number: 4, instruction: "Review the PDF preview, then click 'Download' to save locally." },
    ],
  },

  // ── Tool Calibration ───────────────────────────────────────────────────────
  {
    id: "sop-14",
    sopNumber: "SOP-BB-014",
    title: "Managing Tool Calibration Records",
    category: "Tool Calibration",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to add tools to the calibration tracking system, record calibration events, and monitor upcoming due dates.",
    tags: ["tools", "calibration", "compliance", "tracking"],
    relatedSOPs: [],
    steps: [
      { id: "s14-1", number: 1, instruction: "Navigate to Work Orders → Tool Calibration from the sidebar." },
      { id: "s14-2", number: 2, instruction: "To add a new tool, click '+ Add Tool'. Enter: Tool Number, Description, Serial Number, Manufacturer, Location, Calibration Interval (in days), Calibration Vendor, and the date of last calibration." },
      { id: "s14-3", number: 3, instruction: "The system automatically calculates the Next Calibration Due date and sets the tool status: Active (green), Due Soon (amber, within 30 days), or Overdue (red)." },
      { id: "s14-4", number: 4, instruction: "When a calibration is performed, open the tool detail page and click 'Record Calibration'. Enter the date, who performed it, the new certificate number, and any notes." },
      { id: "s14-5", number: 5, instruction: "To take a tool out of service (damaged, lost, etc.), change its status to 'Out of Service'. To permanently retire it, set status to 'Retired'.", warning: "Using an overdue tool on certificated work is a regulatory violation. The dashboard highlights overdue tools in red — address them immediately by sending for calibration or taking out of service." },
    ],
  },

  // ── Safety ─────────────────────────────────────────────────────────────────
  {
    id: "sop-15",
    sopNumber: "SOP-BB-015",
    title: "Handling an AOG Priority Work Order",
    category: "Safety",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "Procedures for creating and managing Aircraft on Ground (AOG) work orders, including expedited parts sourcing and status communication.",
    tags: ["AOG", "grounded", "expedite"],
    relatedSOPs: ["sop-01", "sop-08"],
    steps: [
      { id: "s15-1", number: 1, instruction: "Create the work order and clearly identify it as AOG in the WO Type and description so the team knows the aircraft is grounded." },
      { id: "s15-2", number: 2, instruction: "Document the grounding discrepancy immediately in the first line item. Be specific — this record may be reviewed by the FSDO." },
      { id: "s15-3", number: 3, instruction: "If parts are needed, create a Purchase Order and contact the vendor directly for AOG/expedite shipping. Note the AOG status in the PO notes." },
      { id: "s15-4", number: 4, instruction: "Keep the work order status current as work progresses. If waiting on parts, set to 'Waiting on Parts' so the team knows the aircraft isn't being worked." },
      { id: "s15-5", number: 5, instruction: "When the aircraft is airworthy and returning to service, ensure all sign-offs are complete, logbook entries are drafted, and the work order is advanced through Review → Billing → Completed.", warning: "Never rush sign-offs to clear an AOG. The same sign-off standards always apply. A premature return to service is a far worse outcome than a delayed departure." },
    ],
  },
  {
    id: "sop-16",
    sopNumber: "SOP-BB-016",
    title: "Reporting and Documenting a Safety Concern",
    category: "Safety",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to use the SkyShareMX Safety House module to document safety observations, incidents, and near-misses within the maintenance environment.",
    tags: ["safety", "reporting", "incident", "hazard"],
    relatedSOPs: ["sop-15"],
    steps: [
      { id: "s16-1", number: 1, instruction: "Navigate to Safety's House from the main SkyShareMX sidebar (not Work Orders). This is accessible to all authenticated users." },
      { id: "s16-2", number: 2, instruction: "Document the safety observation including: what happened, where, when, who was involved, and what corrective or preventive action was taken or is recommended." },
      { id: "s16-3", number: 3, instruction: "If the safety concern relates to a specific aircraft, reference the tail number and any related work order numbers." },
      { id: "s16-4", number: 4, instruction: "Submit the report. Safety reports are reviewed by management and tracked for trend analysis.", note: "Safety reporting is non-punitive. The goal is to identify hazards before they cause harm. Report everything — near-misses are the most valuable data points for prevention." },
    ],
  },

  // ── Portal Navigation ──────────────────────────────────────────────────────
  {
    id: "sop-17",
    sopNumber: "SOP-BB-017",
    title: "Navigating the Work Orders MX Suite",
    category: "Portal Navigation",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "Overview of the Work Orders sidebar navigation, module layout, and how to move between the MX suite and the main SkyShareMX portal.",
    tags: ["navigation", "sidebar", "portal", "orientation"],
    relatedSOPs: ["sop-18"],
    steps: [
      { id: "s17-1", number: 1, instruction: "Access Work Orders from the main SkyShareMX sidebar by clicking 'Work Orders'. This opens the full-screen MX suite with its own sidebar navigation." },
      { id: "s17-2", number: 2, instruction: "The Work Orders sidebar has two sections: Operations (Work Orders, Invoicing, Inventory, Parts, Purchase Orders, Tool Calibration, Settings) and Knowledge (SOP Library, Training)." },
      { id: "s17-3", number: 3, instruction: "Click any module name to navigate to its dashboard. The active module is highlighted with a gold left bar in the sidebar." },
      { id: "s17-4", number: 4, instruction: "When viewing a Work Order detail page, the sidebar automatically collapses to maximize the work area. Hover or click the menu icon to expand it." },
      { id: "s17-5", number: 5, instruction: "To return to the main SkyShareMX portal, click '← Back to Portal' at the bottom of the Work Orders sidebar." },
    ],
  },
  {
    id: "sop-18",
    sopNumber: "SOP-BB-018",
    title: "Using the SkyShareMX Dashboard",
    category: "Portal Navigation",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "Orientation guide for the main SkyShareMX dashboard, including the sidebar modules, aircraft info, Records Vault, training, compliance, and admin features.",
    tags: ["dashboard", "portal", "orientation", "modules"],
    relatedSOPs: ["sop-17", "sop-19"],
    steps: [
      { id: "s18-1", number: 1, instruction: "After logging in with your SkyShare Google account, you land on the Dashboard — the central hub showing portal updates, department directory, and core values." },
      { id: "s18-2", number: 2, instruction: "The left sidebar organizes all modules into sections: Overview (Dashboard, Aircraft Info, AI Assistant), Operations (Discrepancy Intelligence, Records Vault, Work Orders, Training, Vendors, 14-Day Check, Projects, Compliance, Safety), and Administration (Users, Alerts, Settings)." },
      { id: "s18-3", number: 3, instruction: "Modules marked 'BETA' are in active development. Modules with a lock icon require specific role permissions to access." },
      { id: "s18-4", number: 4, instruction: "Use Aircraft Info to view the full fleet with registration, make/model, serial, avionics configuration, and program subscriptions." },
      { id: "s18-5", number: 5, instruction: "The Records Vault provides full-text search, browsing, and timeline views of aircraft maintenance records. Select an aircraft from the vault sidebar to filter records." },
      { id: "s18-6", number: 6, instruction: "Use the Site Suggestions widget (available from the top bar) to submit feature requests, bug reports, or feedback. Include a screenshot for visual issues.", note: "The top bar also contains the dark/light mode toggle and your user profile. System administrators have additional modules visible in the Administration section." },
    ],
  },
  {
    id: "sop-19",
    sopNumber: "SOP-BB-019",
    title: "Managing Your Training Records",
    category: "Portal Navigation",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How mechanics can view their SOP training status, identify expired or upcoming training, and understand the training compliance matrix.",
    tags: ["training", "compliance", "mechanic", "certification"],
    relatedSOPs: ["sop-17"],
    steps: [
      { id: "s19-1", number: 1, instruction: "Navigate to Work Orders → Training from the Knowledge section of the sidebar. This opens the Training compliance matrix." },
      { id: "s19-2", number: 2, instruction: "The matrix shows all mechanics as rows and all SOPs as columns. Each cell is color-coded: green (current), amber (expiring within 90 days), red (expired), or gray (not trained)." },
      { id: "s19-3", number: 3, instruction: "Click on any mechanic row to view their detailed training record — showing each SOP, who trained them, when, and the expiration date." },
      { id: "s19-4", number: 4, instruction: "From the detail view, click any SOP title to jump to its full procedure in the SOP Library." },
      { id: "s19-5", number: 5, instruction: "The overall compliance percentage is displayed in the top right. This represents the proportion of all mechanic×SOP combinations that are 'current'.", note: "Expired training records appear in a red alert banner at the top of the dashboard. Address these immediately by scheduling recurrent training with your lead mechanic or supervisor." },
    ],
  },
  {
    id: "sop-20",
    sopNumber: "SOP-BB-020",
    title: "Using the 14-Day Check System",
    category: "Safety",
    revision: "1.0",
    effectiveDate: "2026-04-01",
    reviewDate: "2026-10-01",
    author: "Jonathan Schaedig",
    approvedBy: "Jonathan Schaedig",
    description: "How to complete a 14-Day standing inspection using the permanent QR code link, including photo upload and draft persistence.",
    tags: ["14-day check", "inspection", "standing", "QR code"],
    relatedSOPs: ["sop-16"],
    steps: [
      { id: "s20-1", number: 1, instruction: "Each aircraft has a permanent 14-Day Check URL (accessible via QR code). No login is required — the form is public-facing." },
      { id: "s20-2", number: 2, instruction: "Open the link on your phone or tablet. The form loads with fields specific to the aircraft's configuration." },
      { id: "s20-3", number: 3, instruction: "Fill out each inspection item. For visual items, take photos directly using your device camera and attach them to the relevant field." },
      { id: "s20-4", number: 4, instruction: "Enter your name as the submitter. This identifies who performed the inspection." },
      { id: "s20-5", number: 5, instruction: "If you're interrupted, your progress is auto-saved to the device for 1 hour. Return to the same link to resume.", note: "Draft persistence uses your browser's local storage. Clearing browser data or using a different device will lose the draft. Complete inspections in one session when possible." },
      { id: "s20-6", number: 6, instruction: "Submit the completed form. The submission is timestamped and appears in the admin 14-Day Check dashboard for review." },
    ],
  },
]

// ─── Training Records — Mechanic × SOP compliance data ───────────────────────
// Training not yet conducted — all records start empty.
// As SOPs are reviewed with each team member, records will be added here.

export const TRAINING_RECORDS: TrainingRecord[] = []

export const ROLES: { role: MXRole; permissions: Permission[] }[] = []
export const SYSTEM_USERS: SystemUser[] = []
export const ALL_PERMISSIONS: Permission[] = []

