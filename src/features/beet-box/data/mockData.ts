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

// ─── Reference Data ───────────────────────────────────────────────────────────

export const AIRCRAFT: Aircraft[] = [
  { id: "ac-001", registration: "N863CB", make: "Beechcraft", model: "King Air 350", serial: "FL-0863", year: 2018, totalTime: 4218.3 },
  { id: "ac-002", registration: "N512SX", make: "Cessna",     model: "Citation CJ3",  serial: "525B0512", year: 2016, totalTime: 3105.7 },
  { id: "ac-003", registration: "N741CB", make: "Piper",      model: "Seneca V",      serial: "3449741",  year: 2020, totalTime: 1842.1 },
]

export const MECHANICS: Mechanic[] = [
  { id: "mec-001", name: "J. Martinez",  certificate: "A&P/IA", certNumber: "A&P-2847391", role: "Lead Mechanic"    },
  { id: "mec-002", name: "R. Thompson",  certificate: "A&P/IA", certNumber: "A&P-1938472", role: "Inspector"        },
  { id: "mec-003", name: "D. Wilson",    certificate: "A&P",    certNumber: "A&P-3847562", role: "Mechanic"         },
  { id: "mec-004", name: "S. Nakamura",  certificate: "A&P",    certNumber: "A&P-2938471", role: "Avionics Tech"    },
  { id: "mec-005", name: "K. Rodriguez", certificate: "A&P",    certNumber: "A&P-4758291", role: "Mechanic"         },
]

// ─── Work Orders ──────────────────────────────────────────────────────────────

export const WORK_ORDERS: WorkOrder[] = [
  {
    id: "wo-001",
    woNumber: "WO-2025-0041",
    aircraftId: "ac-001",
    status: "open",
    woType: "100-Hour Inspection",
    description: "Scheduled 100-hour inspection per Beechcraft KA350 maintenance manual. Includes engine run-up, control surface check, avionics functional test.",
    priority: "routine",
    openedBy: "R. Thompson",
    openedAt: "2025-03-10T08:00:00Z",
    closedAt: "2025-03-14T16:45:00Z",
    meterAtOpen: 4100.0,
    meterAtClose: 4100.0,
    assignedMechanics: ["mec-001", "mec-002"],
    notes: "Completed on schedule. Minor discrepancy on left main gear squat switch — addressed under WO-2025-0041 line item 4. All items signed off.",
    items: [
      {
        id: "i-001", itemNumber: 1, category: "Engine Inspection & Oil Change", logbookSection: "Engine 1", taskNumber: "05-20-00",
        discrepancy: "100-Hour Inspection due per Beechcraft King Air 350 Maintenance Manual. Inspect engine bay, change engine oil, replace oil filters, check all accessories and drive pads.",
        correctiveAction: "100-hr engine inspection complied with per Beechcraft KA350 MM Section 05-20-00. Engine oil drained and replaced. Both oil filters replaced. Accessory section inspected — no discrepancies found. Oil consumption within published limits.",
        mechanicName: "J. Martinez", hours: 4.0, laborRate: 125,
        parts: [
          { id: "ip-001a", partNumber: "LW-16702", description: "Engine Oil Filter — Lycoming", qty: 2, unitPrice: 42.50 },
        ],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true, signedOffBy: "R. Thompson", signedOffAt: "2025-03-14T15:00:00Z",
        itemStatus: "done",
        itemLaborEntries: [
          { id: "ile-001a", mechName: "J. Martinez", hours: 4.0, clockedAt: "2025-03-10" },
        ],
      },
      {
        id: "i-002", itemNumber: 2, category: "Airframe & Landing Gear Inspection", logbookSection: "Airframe", taskNumber: "05-20-00",
        discrepancy: "100-Hour Inspection — airframe, flight controls, landing gear, and brake assemblies. Inspect per Beechcraft KA350 MM inspection checklist items AF-01 through AF-47.",
        correctiveAction: "Airframe, flight controls, and landing gear inspection complied with per KA350 MM. All control surface travel and rigging within limits. Brake pads within serviceable limits. Left main gear squat switch found worn — see Item 3 for corrective action.",
        mechanicName: "J. Martinez", hours: 6.0, laborRate: 125,
        parts: [],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true, signedOffBy: "R. Thompson", signedOffAt: "2025-03-14T15:30:00Z",
        itemStatus: "done", noPartsRequired: true,
        itemLaborEntries: [
          { id: "ile-002a", mechName: "J. Martinez", hours: 4.0, clockedAt: "2025-03-11" },
          { id: "ile-002b", mechName: "R. Thompson",  hours: 2.0, clockedAt: "2025-03-11" },
        ],
      },
      {
        id: "i-003", itemNumber: 3, category: "LH Main Gear Squat Switch R/R", logbookSection: "Airframe", taskNumber: "32-31-00",
        partNumber: "101-384007-5",
        discrepancy: "Left main gear squat switch (P/N 101-384007-5) found at wear limit during 100-hr inspection Item 2. Switch contacts pitted. Replacement required per Beechcraft KA350 MM 32-31-00.",
        correctiveAction: "Squat switch R/R complied with per Beechcraft KA350 MM Section 32-31-00. New switch installed and safety wired. Gear retraction cycle and micro-switch functional test performed — operation satisfactory. Logbook entry made.",
        mechanicName: "R. Thompson", hours: 2.5, laborRate: 125,
        parts: [
          { id: "ip-003a", partNumber: "101-384007-5", description: "Squat Switch — LH Main Gear", qty: 1, unitPrice: 187.00 },
        ],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true, signedOffBy: "R. Thompson", signedOffAt: "2025-03-14T14:00:00Z",
        itemStatus: "done",
        itemLaborEntries: [
          { id: "ile-003a", mechName: "R. Thompson", hours: 2.5, clockedAt: "2025-03-12" },
        ],
      },
      {
        id: "i-004", itemNumber: 4, category: "Avionics & IFR Certification", logbookSection: "Airframe", taskNumber: "31-10-00",
        discrepancy: "Avionics functional check required per 100-hr inspection checklist. Verify all IFR equipment per FAR 91.171 and 91.413. Altimeter, transponder, and static system check due.",
        correctiveAction: "All avionics functional checks complied with per 100-hr inspection checklist. Altimeter system tested per FAR 91.411 — within limits. Transponder tested per FAR 91.413 — Mode C encoding verified. All IFR equipment checks satisfactory.",
        mechanicName: "R. Thompson", hours: 3.0, laborRate: 125,
        parts: [],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true, signedOffBy: "R. Thompson", signedOffAt: "2025-03-14T15:30:00Z",
        itemStatus: "done", noPartsRequired: true,
        itemLaborEntries: [
          { id: "ile-004a", mechName: "R. Thompson",  hours: 2.0, clockedAt: "2025-03-13" },
          { id: "ile-004b", mechName: "S. Nakamura", hours: 1.0, clockedAt: "2025-03-14" },
        ],
      },
    ],
    laborEntries: [
      { id: "le-001", mechanicId: "mec-001", mechanicName: "J. Martinez",  workDate: "2025-03-10", hours: 4.0, description: "Engine bay inspection, oil change, filter replacement", billable: true },
      { id: "le-002", mechanicId: "mec-001", mechanicName: "J. Martinez",  workDate: "2025-03-11", hours: 4.0, description: "Airframe inspection, control surface rigging check", billable: true },
      { id: "le-003", mechanicId: "mec-002", mechanicName: "R. Thompson",  workDate: "2025-03-12", hours: 3.0, description: "Avionics functional check, IFR equipment inspection", billable: true },
      { id: "le-004", mechanicId: "mec-002", mechanicName: "R. Thompson",  workDate: "2025-03-13", hours: 2.5, description: "Squat switch R/R, gear swing, rigging verification", billable: true },
      { id: "le-005", mechanicId: "mec-001", mechanicName: "J. Martinez",  workDate: "2025-03-14", hours: 0.5, description: "Final inspection, engine run-up, paperwork", billable: true },
    ],
    statusHistory: [
      { id: "sh-001", fromStatus: null,            toStatus: "open",      changedBy: "R. Thompson", changedAt: "2025-03-10T08:00:00Z", notes: "WO opened for scheduled 100-hr" },
      { id: "sh-002", fromStatus: "open",           toStatus: "in_review", changedBy: "J. Martinez", changedAt: "2025-03-13T17:00:00Z", notes: "Work complete, submitted for IA review" },
      { id: "sh-003", fromStatus: "in_review",      toStatus: "billing",   changedBy: "R. Thompson", changedAt: "2025-03-14T15:45:00Z", notes: "All sign-offs complete, approved for billing" },
      { id: "sh-004", fromStatus: "billing",        toStatus: "completed", changedBy: "R. Thompson", changedAt: "2025-03-14T16:45:00Z", notes: "Invoice generated, WO closed" },
    ],
  },
  {
    id: "wo-002",
    woNumber: "WO-2025-0042",
    aircraftId: "ac-002",
    status: "waiting_on_parts",
    woType: "Unscheduled — Hydraulic",
    description: "Unscheduled maintenance: hydraulic fluid leak detected at nose gear actuator. Aircraft grounded pending inspection and repair.",
    priority: "urgent",
    openedBy: "D. Wilson",
    openedAt: "2025-03-28T10:15:00Z",
    meterAtOpen: 3098.2,
    assignedMechanics: ["mec-002", "mec-003"],
    notes: "Nose gear actuator seal kit ordered from Aviall. ETA 5 business days. Aircraft OOS until parts received.",
    discrepancyRef: "DW-2025-0089",
    items: [
      {
        id: "i-010", itemNumber: 1, category: "Hydraulic Leak — Fault Isolation", logbookSection: "Airframe", taskNumber: "29-10-00",
        discrepancy: "Hydraulic fluid leak observed at nose gear actuator. Fluid identified on nose gear doors and belly skin. Aircraft grounded. Inspect nose gear actuator seals and determine extent of leak.",
        correctiveAction: "Nose gear actuator inspected. Primary piston seal (P/N MS28775-228) found extruded and failed. Seal kit ordered from Aviall — PO-2025-0019. Aircraft remains out of service pending parts.",
        mechanicName: "D. Wilson", hours: 2.5, laborRate: 125,
        parts: [],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: false,
        itemStatus: "done", noPartsRequired: true,
        itemLaborEntries: [
          { id: "ile-010a", mechName: "D. Wilson", hours: 2.5, clockedAt: "2025-03-28" },
        ],
      },
      {
        id: "i-011", itemNumber: 2, category: "Nose Gear Actuator Seal R/R", logbookSection: "Airframe", taskNumber: "29-10-00",
        partNumber: "MS28775-228",
        discrepancy: "Nose gear actuator primary piston seal failed. Seal kit (P/N MS28775-228) required. Actuator R/R, system bleed, and functional test required upon parts receipt.",
        correctiveAction: "",
        mechanicName: "D. Wilson", hours: 4.0, laborRate: 125,
        parts: [
          { id: "ip-011a", partNumber: "MS28775-228", description: "Nose Gear Actuator Seal Kit", qty: 1, unitPrice: 64.00 },
          { id: "ip-011b", partNumber: "MIL-H-5606",  description: "Hydraulic Fluid MIL-H-5606 (1 qt)", qty: 2, unitPrice: 18.50 },
        ],
        shippingCost: 18.00, outsideServicesCost: 0,
        signOffRequired: true,
        itemStatus: "pending",
        itemLaborEntries: [],
      },
    ],
    laborEntries: [
      { id: "le-010", mechanicId: "mec-003", mechanicName: "D. Wilson",   workDate: "2025-03-28", hours: 2.5, description: "Fault isolation, identified failed actuator seal, documented discrepancy", billable: true },
    ],
    statusHistory: [
      { id: "sh-010", fromStatus: null,       toStatus: "open",             changedBy: "D. Wilson",   changedAt: "2025-03-28T10:15:00Z", notes: "Opened for hydraulic leak, aircraft grounded" },
      { id: "sh-011", fromStatus: "open",     toStatus: "waiting_on_parts", changedBy: "D. Wilson",   changedAt: "2025-03-28T14:30:00Z", notes: "Seal kit ordered from Aviall, PO-2025-0019" },
    ],
  },
  {
    id: "wo-003",
    woNumber: "WO-2025-0043",
    aircraftId: "ac-003",
    status: "open",
    woType: "Annual Inspection",
    description: "Annual airworthiness inspection per 14 CFR §91.409. Full airframe, powerplant, propeller, and avionics review.",
    priority: "routine",
    openedBy: "J. Martinez",
    openedAt: "2025-04-01T08:00:00Z",
    meterAtOpen: 1842.1,
    assignedMechanics: ["mec-003", "mec-001"],
    notes: "Annual due April 30. On schedule.",
    items: [
      {
        id: "i-020", itemNumber: 1, category: "Annual — Airframe Inspection", logbookSection: "Airframe", taskNumber: "05-10-00",
        discrepancy: "Annual airworthiness inspection — airframe, flight controls, landing gear, brakes, tires, and structures per 14 CFR §91.409 and Piper Seneca V MM inspection checklist.",
        correctiveAction: "",
        mechanicName: "D. Wilson", hours: 12.0, laborRate: 125,
        parts: [],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true,
        itemStatus: "in_progress", noPartsRequired: true,
        itemLaborEntries: [
          { id: "ile-020a", mechName: "D. Wilson",   hours: 4.0, clockedAt: "2025-04-01" },
          { id: "ile-020b", mechName: "J. Martinez", hours: 2.0, clockedAt: "2025-04-02" },
        ],
      },
      {
        id: "i-021", itemNumber: 2, category: "Annual — Powerplant Inspection", logbookSection: "Engine 1", taskNumber: "05-10-00",
        discrepancy: "Annual airworthiness inspection — both engines, engine mounts, exhaust, induction, fuel, and oil systems per Piper Seneca V MM and Lycoming O-360 overhaul manual.",
        correctiveAction: "",
        mechanicName: "D. Wilson", hours: 8.0, laborRate: 125,
        parts: [
          { id: "ip-021a", partNumber: "SA2797660-5", description: "Air Filter Element — Piper Seneca (both engines)", qty: 2, unitPrice: 38.00 },
        ],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true,
        itemStatus: "in_progress",
        itemLaborEntries: [
          { id: "ile-021a", mechName: "D. Wilson", hours: 4.0, clockedAt: "2025-04-02" },
        ],
      },
      {
        id: "i-022", itemNumber: 3, category: "Spark Plug Inspection / Replace", logbookSection: "Engine 1", taskNumber: "74-20-00",
        discrepancy: "Annual inspection — spark plug removal, inspection, and reinstallation on all cylinders. Inspect for wear, fouling, and gap per Lycoming SI-1008C.",
        correctiveAction: "",
        mechanicName: "J. Martinez", hours: 3.0, laborRate: 125,
        parts: [
          { id: "ip-022a", partNumber: "REM40E", description: "Spark Plug — Champion (all cylinders)", qty: 12, unitPrice: 22.50 },
        ],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true,
      },
      {
        id: "i-023", itemNumber: 4, category: "Pitot-Static & Transponder Check", logbookSection: "Airframe", taskNumber: "34-10-00",
        discrepancy: "Annual inspection — pitot-static system check, altimeter test per FAR 91.411, transponder check per FAR 91.413.",
        correctiveAction: "",
        mechanicName: "J. Martinez", hours: 2.0, laborRate: 125,
        parts: [],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true,
      },
    ],
    laborEntries: [
      { id: "le-020", mechanicId: "mec-003", mechanicName: "D. Wilson",   workDate: "2025-04-01", hours: 4.0, description: "Airframe visual, landing gear, brake pads, tires", billable: true },
      { id: "le-021", mechanicId: "mec-003", mechanicName: "D. Wilson",   workDate: "2025-04-02", hours: 4.0, description: "Engine induction, exhaust, accessories", billable: true },
      { id: "le-022", mechanicId: "mec-001", mechanicName: "J. Martinez", workDate: "2025-04-02", hours: 3.0, description: "Propeller inspection, log review, compliance check", billable: true },
    ],
    statusHistory: [
      { id: "sh-020", fromStatus: null,  toStatus: "open", changedBy: "J. Martinez", changedAt: "2025-04-01T08:00:00Z", notes: "Annual inspection opened" },
    ],
  },
  {
    id: "wo-004",
    woNumber: "WO-2025-0044",
    aircraftId: "ac-001",
    status: "in_review",
    woType: "Avionics — GPS Update",
    description: "Garmin GTN-750Xi database update and RAIM check. Annual Nav/Comm certification.",
    priority: "routine",
    openedBy: "S. Nakamura",
    openedAt: "2025-04-02T09:00:00Z",
    meterAtOpen: 4218.3,
    assignedMechanics: ["mec-004"],
    notes: "Database update complete. Awaiting IA sign-off on return-to-service.",
    items: [
      {
        id: "i-030", itemNumber: 1, category: "Nav / Charts Database Update", logbookSection: "Airframe", taskNumber: "34-CUS-001",
        discrepancy: "Nav/Charts database update required. Garmin GTN-750Xi navigation database expired 03-27-2026. Update nav and chart databases, perform RAIM prediction verification.",
        correctiveAction: "34-CUS-001 Nav database update complied with referencing Garmin GTN-750Xi LMM 190-01499-02. Database updated via Garmin Pilot. RAIM prediction verified for next 24 hrs. Databases expire 04-24-2026. Post-update operational check OK.",
        mechanicName: "S. Nakamura", hours: 1.5, laborRate: 135,
        parts: [],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true, signedOffBy: "S. Nakamura", signedOffAt: "2025-04-02T14:00:00Z",
      },
      {
        id: "i-031", itemNumber: 2, category: "IFR Certification — Pitot-Static / Transponder", logbookSection: "Airframe", taskNumber: "34-10-00",
        discrepancy: "Annual IFR certification due. Pitot-static system test per FAR 91.411 and transponder/encoder test per FAR 91.413 required. Last tested 04-01-2024.",
        correctiveAction: "Pitot-static system tested per FAR 91.411 using calibrated test set TL-007. Transponder and encoder tested per FAR 91.413 — Mode C altitude encoding verified. All checks within limits. Return to service signed — awaiting IA approval.",
        mechanicName: "S. Nakamura", hours: 2.0, laborRate: 135,
        parts: [],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true,
        itemStatus: "needs_review", noPartsRequired: true,
        itemLaborEntries: [
          { id: "ile-031a", mechName: "S. Nakamura", hours: 2.0, clockedAt: "2025-04-02" },
        ],
      },
    ],
    laborEntries: [
      { id: "le-030", mechanicId: "mec-004", mechanicName: "S. Nakamura", workDate: "2025-04-02", hours: 3.5, description: "DB update, RAIM test, transponder check, squawk 1200 verification", billable: true },
    ],
    statusHistory: [
      { id: "sh-030", fromStatus: null,   toStatus: "open",      changedBy: "S. Nakamura", changedAt: "2025-04-02T09:00:00Z", notes: "Avionics update WO opened" },
      { id: "sh-031", fromStatus: "open", toStatus: "in_review", changedBy: "S. Nakamura", changedAt: "2025-04-02T15:30:00Z", notes: "Work complete, forwarded to IA for review" },
    ],
  },
  {
    id: "wo-005",
    woNumber: "WO-2025-0045",
    aircraftId: "ac-002",
    status: "open",
    woType: "Engine Trend Monitoring",
    description: "Engine oil analysis, borescope inspection cylinder 2L and 3R per trend data flag. Oil consumption review.",
    priority: "routine",
    openedBy: "J. Martinez",
    openedAt: "2025-04-03T08:30:00Z",
    meterAtOpen: 3105.7,
    assignedMechanics: ["mec-001"],
    notes: "Trend data flagged slight rise in iron content. Borescope complete — no abnormal wear found. Continuing to monitor.",
    items: [
      {
        id: "i-040", itemNumber: 1, category: "Engine Condition Trend Monitoring (ECTM)", logbookSection: "Engine 1", taskNumber: "72-00-00 (ECTM)",
        discrepancy: "Engine condition trend monitoring (ECTM) flag raised by maintenance tracking system — elevated iron content in oil analysis. Borescope inspection of cylinders 2L and 3R required. Oil sample collection and lab analysis required.",
        correctiveAction: "72-00-00 (ECTM) Oil sample collected from both engines and submitted to Spectrex Aviation lab. Borescope inspection cylinders 2L and 3R complied with per Lycoming SI-1009-1. No abnormal wear patterns found. Continuing to monitor per ECTM program. Lab results pending.",
        mechanicName: "J. Martinez", hours: 2.0, laborRate: 125,
        parts: [],
        shippingCost: 0, outsideServicesCost: 45.00,
        signOffRequired: false,
      },
    ],
    laborEntries: [
      { id: "le-040", mechanicId: "mec-001", mechanicName: "J. Martinez", workDate: "2025-04-03", hours: 2.0, description: "Oil sample, borescope 2L and 3R, documented findings", billable: true },
    ],
    statusHistory: [
      { id: "sh-040", fromStatus: null, toStatus: "open", changedBy: "J. Martinez", changedAt: "2025-04-03T08:30:00Z", notes: "ETM WO opened per trend flag" },
    ],
  },
  {
    id: "wo-006",
    woNumber: "WO-2025-0046",
    aircraftId: "ac-001",
    status: "billing",
    woType: "Propeller Overhaul",
    description: "Prop overhaul — both Hartzell HC-E4N-3D propeller assemblies. Send to Hartzell approved overhaul facility.",
    priority: "routine",
    openedBy: "R. Thompson",
    openedAt: "2025-03-20T09:00:00Z",
    closedAt: undefined,
    meterAtOpen: 4200.0,
    assignedMechanics: ["mec-002", "mec-001"],
    notes: "Props returned from Hartzell. Installed and track/balance complete. Ready for billing.",
    items: [
      {
        id: "i-050", itemNumber: 1, category: "Propeller Removal & Send to Overhaul", logbookSection: "Propeller", taskNumber: "61-10-00",
        discrepancy: "Both Hartzell HC-E4N-3D propeller assemblies at TBO. Overhaul required per Hartzell Overhaul Manual 137E. Remove both props and send to Hartzell-authorized overhaul facility.",
        correctiveAction: "Both propeller assemblies removed per Hartzell OM 137E Section 3. Props logged, tagged, and shipped to Hartzell Overhaul Services, Piqua OH. Packing and shipping documentation completed. Aircraft secured.",
        mechanicName: "R. Thompson", hours: 3.0, laborRate: 125,
        parts: [],
        shippingCost: 285.00, outsideServicesCost: 4200.00,
        signOffRequired: true, signedOffBy: "R. Thompson", signedOffAt: "2025-03-21T11:00:00Z",
      },
      {
        id: "i-051", itemNumber: 2, category: "Propeller Install, Track & Balance", logbookSection: "Propeller", taskNumber: "61-10-00",
        discrepancy: "Overhauled propeller assemblies returned from Hartzell. Install both props, perform track and balance, engine run-up, and return to service.",
        correctiveAction: "Both propeller assemblies installed per Hartzell OM 137E. Prop track checked — within 1/8\" limit. Dynamic balance performed using Aces Systems RADS-AT — vibration 0.04 IPS (limit 0.20). Engine run-up normal. Return to service signed by IA.",
        mechanicName: "R. Thompson", hours: 4.0, laborRate: 125,
        parts: [
          { id: "ip-051a", partNumber: "AS-ANTISIZE-1", description: "Never-Seez Anti-Seize compound", qty: 1, unitPrice: 14.00 },
          { id: "ip-051b", partNumber: "AN-SFTY-20",    description: "Safety wire 0.020 — 1 lb spool", qty: 1, unitPrice: 16.50 },
        ],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true, signedOffBy: "R. Thompson", signedOffAt: "2025-04-01T15:00:00Z",
      },
    ],
    laborEntries: [
      { id: "le-050", mechanicId: "mec-002", mechanicName: "R. Thompson",  workDate: "2025-03-20", hours: 3.0, description: "Both props R/R, packed for overhaul shop", billable: true },
      { id: "le-051", mechanicId: "mec-001", mechanicName: "J. Martinez",  workDate: "2025-04-01", hours: 4.0, description: "Both props install, track/balance, run-up", billable: true },
    ],
    statusHistory: [
      { id: "sh-050", fromStatus: null,        toStatus: "open",             changedBy: "R. Thompson", changedAt: "2025-03-20T09:00:00Z", notes: "Prop overhaul WO opened" },
      { id: "sh-051", fromStatus: "open",       toStatus: "waiting_on_parts", changedBy: "R. Thompson", changedAt: "2025-03-20T13:00:00Z", notes: "Props shipped to Hartzell. ETA 8 business days." },
      { id: "sh-052", fromStatus: "waiting_on_parts", toStatus: "open",     changedBy: "J. Martinez", changedAt: "2025-04-01T08:00:00Z", notes: "Props returned from Hartzell, back in work" },
      { id: "sh-053", fromStatus: "open",       toStatus: "in_review",       changedBy: "J. Martinez", changedAt: "2025-04-01T15:30:00Z", notes: "Install complete, submitted for IA" },
      { id: "sh-054", fromStatus: "in_review",  toStatus: "billing",         changedBy: "R. Thompson", changedAt: "2025-04-01T16:30:00Z", notes: "All sign-offs complete. Move to billing." },
    ],
  },
  {
    id: "wo-007",
    woNumber: "WO-2025-0047",
    aircraftId: "ac-003",
    status: "draft",
    woType: "Brake Assembly R/R",
    description: "Left main gear brake assembly replacement. Brake discs at wear limit per 100-hr inspection finding.",
    priority: "routine",
    openedBy: "",
    openedAt: "2025-04-04T00:00:00Z",
    meterAtOpen: 1842.1,
    assignedMechanics: [],
    notes: "Draft — not yet opened. Parts on order.",
    items: [
      {
        id: "i-060", itemNumber: 1, category: "LH Main Gear Brake Disc R/R", logbookSection: "Airframe", taskNumber: "32-40-00",
        partNumber: "199-12801-5",
        discrepancy: "Left main gear brake disc assembly (P/N 199-12801-5) found at wear limit per 100-hr inspection annual finding. Minimum thickness 0.188\". Measured 0.181\". Replacement required per Piper MM 32-40-00. Parts on order.",
        correctiveAction: "",
        mechanicName: "", hours: 2.5, laborRate: 125,
        parts: [
          { id: "ip-060a", partNumber: "199-12801-5",  description: "Brake Disc Assembly — LH Main Gear", qty: 1, unitPrice: 312.00 },
          { id: "ip-060b", partNumber: "P/N-199-01100", description: "Brake Pads — LH Main",              qty: 1, unitPrice: 88.00 },
        ],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: true,
      },
    ],
    laborEntries: [],
    statusHistory: [
      { id: "sh-060", fromStatus: null, toStatus: "draft", changedBy: "J. Martinez", changedAt: "2025-04-04T00:00:00Z", notes: "Draft WO created from annual inspection finding" },
    ],
  },
  {
    id: "wo-008",
    woNumber: "WO-2025-0048",
    aircraftId: "ac-002",
    status: "open",
    woType: "Squawk — Cabin Pressurization",
    description: "Pilot-reported squawk: cabin altitude warning horn intermittent during cruise. Inspect pressurization controller and outflow valve.",
    priority: "urgent",
    openedBy: "D. Wilson",
    openedAt: "2025-04-04T07:00:00Z",
    meterAtOpen: 3105.7,
    assignedMechanics: ["mec-003"],
    notes: "Investigating. Suspect pressurization controller relay.",
    items: [
      {
        id: "i-070", itemNumber: 1, category: "Pressurization System — Fault Isolation", logbookSection: "Airframe", taskNumber: "21-30-00",
        discrepancy: "Pilot-reported squawk: cabin altitude warning horn intermittent during cruise at FL230. Cabin altitude exceeded 10,000 ft indication on two separate flights. Inspect pressurization controller, outflow valve, and safety valve per Citation CJ3 MM 21-30-00.",
        correctiveAction: "Pressurization controller bench-tested — relay coil measured 487 ohms (spec 480-520 ohms), within limits. Outflow valve inspected — valve seal showing early wear. Controller relay suspected intermittent. Pressurization relay (P/N WNC-PR-4802) ordered — PO-2025-0021. Investigation continuing.",
        mechanicName: "D. Wilson", hours: 3.0, laborRate: 125,
        parts: [],
        shippingCost: 0, outsideServicesCost: 0,
        signOffRequired: false,
      },
    ],
    laborEntries: [
      { id: "le-070", mechanicId: "mec-003", mechanicName: "D. Wilson",   workDate: "2025-04-04", hours: 1.5, description: "Initial squawk investigation, controller bench test in progress", billable: true },
    ],
    statusHistory: [
      { id: "sh-070", fromStatus: null, toStatus: "open", changedBy: "D. Wilson", changedAt: "2025-04-04T07:00:00Z", notes: "Squawk WO opened" },
    ],
  },
]

// ─── Inventory ────────────────────────────────────────────────────────────────

export const INVENTORY_PARTS: InventoryPart[] = [
  {
    id: "p-001", partNumber: "LW-16702", description: "Engine Oil Filter — Lycoming",
    manufacturer: "Lycoming", uom: "EA", qtyOnHand: 6, qtyReserved: 2, reorderPoint: 4,
    unitCost: 42.50, locationBin: "A-02-3", condition: "new", vendorId: "v-001", vendorName: "Aircraft Spruce", isConsumable: false,
    transactions: [
      { id: "t-001", type: "receipt",    qty: 12, unitCost: 42.50, date: "2025-02-15", performedBy: "K. Rodriguez", poRef: "PO-2025-0018", notes: "Received from Aircraft Spruce" },
      { id: "t-002", type: "issue",      qty: -2, unitCost: 42.50, date: "2025-03-12", performedBy: "J. Martinez",  woRef: "WO-2025-0041", notes: "Issued for 100-hr inspection" },
      { id: "t-003", type: "adjustment", qty: -4, unitCost: 42.50, date: "2025-03-20", performedBy: "K. Rodriguez", notes: "Inventory count adjustment" },
    ],
  },
  {
    id: "p-002", partNumber: "MS28775-228", description: "O-Ring Seal — Hydraulic Actuator",
    manufacturer: "Parker", uom: "EA", qtyOnHand: 0, qtyReserved: 1, reorderPoint: 5,
    unitCost: 4.80, locationBin: "B-01-1", condition: "new", vendorId: "v-002", vendorName: "Aviall", isConsumable: false,
    transactions: [
      { id: "t-010", type: "issue",   qty: -2, unitCost: 4.80, date: "2025-01-10", performedBy: "D. Wilson",   woRef: "WO-2025-0033", notes: "Hydraulic line repair" },
      { id: "t-011", type: "scrap",   qty: -3, unitCost: 4.80, date: "2025-02-22", performedBy: "K. Rodriguez", notes: "Expired seals — scrapped" },
    ],
  },
  {
    id: "p-003", partNumber: "REM40E", description: "Spark Plug — Champion",
    manufacturer: "Champion", uom: "EA", qtyOnHand: 24, qtyReserved: 12, reorderPoint: 12,
    unitCost: 22.50, locationBin: "A-03-1", condition: "new", vendorId: "v-001", vendorName: "Aircraft Spruce", isConsumable: false,
    transactions: [
      { id: "t-020", type: "receipt", qty: 48, unitCost: 22.50, date: "2025-03-01", performedBy: "K. Rodriguez", poRef: "PO-2025-0018", notes: "" },
      { id: "t-021", type: "issue",   qty: -12, unitCost: 22.50, date: "2025-03-18", performedBy: "D. Wilson", woRef: "WO-2025-0039", notes: "" },
      { id: "t-022", type: "issue",   qty: -12, unitCost: 22.50, date: "2025-04-02", performedBy: "D. Wilson", woRef: "WO-2025-0043", notes: "" },
    ],
  },
  {
    id: "p-004", partNumber: "199-12801-5", description: "Brake Disc Assembly — LH Main",
    manufacturer: "Beringer", uom: "EA", qtyOnHand: 0, qtyReserved: 1, reorderPoint: 1,
    unitCost: 312.00, locationBin: "C-01-2", condition: "new", vendorId: "v-003", vendorName: "Jetsco", isConsumable: false,
    transactions: [],
  },
  {
    id: "p-005", partNumber: "MIL-H-5606", description: "Hydraulic Fluid — MIL-H-5606 (1 qt)",
    manufacturer: "Shell", uom: "QT", qtyOnHand: 8, qtyReserved: 2, reorderPoint: 6,
    unitCost: 18.50, locationBin: "D-01-1", condition: "new", vendorId: "v-001", vendorName: "Aircraft Spruce", isConsumable: true,
    transactions: [
      { id: "t-030", type: "receipt", qty: 12, unitCost: 18.50, date: "2025-01-20", performedBy: "K. Rodriguez", poRef: "PO-2025-0015", notes: "" },
      { id: "t-031", type: "issue",   qty: -4, unitCost: 18.50, date: "2025-02-14", performedBy: "D. Wilson",    woRef: "WO-2025-0035", notes: "" },
    ],
  },
  {
    id: "p-006", partNumber: "SA2797660-5", description: "Air Filter Element — Piper Seneca",
    manufacturer: "Tempest", uom: "EA", qtyOnHand: 4, qtyReserved: 2, reorderPoint: 2,
    unitCost: 38.00, locationBin: "A-04-2", condition: "new", vendorId: "v-002", vendorName: "Aviall", isConsumable: false,
    transactions: [
      { id: "t-040", type: "receipt", qty: 6, unitCost: 38.00, date: "2025-03-15", performedBy: "K. Rodriguez", poRef: "PO-2025-0020", notes: "" },
      { id: "t-041", type: "issue",   qty: -2, unitCost: 38.00, date: "2025-04-01", performedBy: "D. Wilson",   woRef: "WO-2025-0043", notes: "" },
    ],
  },
  {
    id: "p-007", partNumber: "101-384007-5", description: "Squat Switch — LH Main Gear",
    manufacturer: "Beechcraft", uom: "EA", qtyOnHand: 2, qtyReserved: 0, reorderPoint: 1,
    unitCost: 187.00, locationBin: "C-02-1", condition: "new", vendorId: "v-001", vendorName: "Aircraft Spruce", isConsumable: false,
    transactions: [
      { id: "t-050", type: "receipt", qty: 2, unitCost: 187.00, date: "2025-03-11", performedBy: "K. Rodriguez", poRef: "PO-2025-0018", notes: "" },
      { id: "t-051", type: "issue",   qty: -1, unitCost: 187.00, date: "2025-03-13", performedBy: "R. Thompson", woRef: "WO-2025-0041", notes: "" },
    ],
  },
  {
    id: "p-008", partNumber: "P/N-199-01100", description: "Brake Pads — LH Main",
    manufacturer: "Beringer", uom: "SET", qtyOnHand: 3, qtyReserved: 1, reorderPoint: 2,
    unitCost: 88.00, locationBin: "C-01-3", condition: "new", vendorId: "v-003", vendorName: "Jetsco", isConsumable: false,
    transactions: [
      { id: "t-060", type: "receipt", qty: 4, unitCost: 88.00, date: "2025-02-28", performedBy: "K. Rodriguez", poRef: "PO-2025-0016", notes: "" },
      { id: "t-061", type: "issue",   qty: -1, unitCost: 88.00, date: "2025-03-05", performedBy: "D. Wilson",   woRef: "WO-2025-0040", notes: "" },
    ],
  },
]

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po-001", poNumber: "PO-2025-0018", vendorId: "v-001", vendorName: "Aircraft Spruce",
    status: "received", createdBy: "K. Rodriguez", createdAt: "2025-02-10T09:00:00Z",
    expectedDelivery: "2025-02-15",
    notes: "Regular stock replenishment order.",
    lines: [
      { id: "pl-001", partNumber: "LW-16702",     description: "Engine Oil Filter — Lycoming",    qtyOrdered: 12, qtyReceived: 12, unitCost: 42.50 },
      { id: "pl-002", partNumber: "REM40E",        description: "Spark Plug — Champion",           qtyOrdered: 48, qtyReceived: 48, unitCost: 22.50 },
      { id: "pl-003", partNumber: "101-384007-5",  description: "Squat Switch — LH Main Gear",     qtyOrdered: 2,  qtyReceived: 2,  unitCost: 187.00 },
      { id: "pl-004", partNumber: "MIL-PRF-7808",  description: "Turbine Engine Oil — 1 qt",       qtyOrdered: 24, qtyReceived: 24, unitCost: 28.00 },
    ],
  },
  {
    id: "po-002", poNumber: "PO-2025-0019", vendorId: "v-002", vendorName: "Aviall",
    status: "partial", createdBy: "K. Rodriguez", createdAt: "2025-03-28T14:30:00Z",
    expectedDelivery: "2025-04-07",
    notes: "Urgent — WO-2025-0042 nose gear actuator seal kit. 2nd line is regular stock.",
    lines: [
      { id: "pl-010", partNumber: "MS28775-228", description: "O-Ring Seal — Hydraulic Actuator",  qtyOrdered: 10, qtyReceived: 0,  unitCost: 4.80,  woRef: "WO-2025-0042" },
      { id: "pl-011", partNumber: "SA2797660-5", description: "Air Filter Element — Piper Seneca", qtyOrdered: 6,  qtyReceived: 6,  unitCost: 38.00 },
    ],
  },
  {
    id: "po-003", poNumber: "PO-2025-0020", vendorId: "v-003", vendorName: "Jetsco",
    status: "sent", createdBy: "K. Rodriguez", createdAt: "2025-04-01T11:00:00Z",
    expectedDelivery: "2025-04-10",
    notes: "Brake disc and pads for WO-2025-0047 plus stock replenishment.",
    lines: [
      { id: "pl-020", partNumber: "199-12801-5",  description: "Brake Disc Assembly — LH Main",  qtyOrdered: 1, qtyReceived: 0, unitCost: 312.00, woRef: "WO-2025-0047" },
      { id: "pl-021", partNumber: "P/N-199-01100", description: "Brake Pads — LH Main",          qtyOrdered: 2, qtyReceived: 0, unitCost: 88.00,  woRef: "WO-2025-0047" },
      { id: "pl-022", partNumber: "AV-TCS-4",     description: "Tire — Cleveland 6.00-6",        qtyOrdered: 4, qtyReceived: 0, unitCost: 145.00 },
      { id: "pl-023", partNumber: "AV-TCS-TUB",   description: "Tube — 6.00-6",                  qtyOrdered: 4, qtyReceived: 0, unitCost: 38.00 },
      { id: "pl-024", partNumber: "AV-TCS-FELT",  description: "Wheel felt grease retainer",     qtyOrdered: 8, qtyReceived: 0, unitCost: 12.00 },
      { id: "pl-025", partNumber: "MS9021-045",   description: "O-ring, AN boss fitting",         qtyOrdered: 20,qtyReceived: 0, unitCost: 2.20 },
    ],
  },
  {
    id: "po-004", poNumber: "PO-2025-0021", vendorId: "v-004", vendorName: "Wencor",
    status: "draft", createdBy: "K. Rodriguez", createdAt: "2025-04-03T10:00:00Z",
    expectedDelivery: undefined,
    notes: "Draft — pending manager approval.",
    lines: [
      { id: "pl-030", partNumber: "WNC-PR-4802", description: "Pressurization Controller Relay", qtyOrdered: 1, qtyReceived: 0, unitCost: 485.00, woRef: "WO-2025-0048" },
    ],
  },
  {
    id: "po-005", poNumber: "PO-2025-0022", vendorId: "v-001", vendorName: "Aircraft Spruce",
    status: "sent", createdBy: "K. Rodriguez", createdAt: "2025-04-04T08:00:00Z",
    expectedDelivery: "2025-04-09",
    notes: "Routine consumables replenishment.",
    lines: [
      { id: "pl-040", partNumber: "MIL-H-5606",   description: "Hydraulic Fluid — 1 qt",   qtyOrdered: 12, qtyReceived: 0, unitCost: 18.50 },
      { id: "pl-041", partNumber: "LPS-3-HEAVY",  description: "LPS-3 Heavy Duty Lubricant", qtyOrdered: 6,  qtyReceived: 0, unitCost: 24.00 },
      { id: "pl-042", partNumber: "AN-SFTY-20",   description: "Safety wire 0.020 — 1 lb",  qtyOrdered: 4,  qtyReceived: 0, unitCost: 16.50 },
    ],
  },
]

// ─── Tools ────────────────────────────────────────────────────────────────────

export const TOOLS: Tool[] = [
  {
    id: "tl-001", toolNumber: "TL-001", description: "Torque Wrench — 3/8\" Drive 0-150 in-lb",
    serialNumber: "TW-39182", manufacturer: "Snap-On", location: "Tool Room — Cabinet A",
    status: "active", calibrationIntervalDays: 365, lastCalibratedAt: "2024-12-01",
    nextCalibrationDue: "2025-12-01", calibrationVendor: "Precision Calibration Services",
    history: [
      { id: "tc-001", calibratedBy: "Precision Cal. Svc.", calibratedAt: "2024-12-01", nextDue: "2025-12-01", certificateNumber: "PCS-2024-18291", notes: "Within tolerance. No adjustments needed." },
      { id: "tc-002", calibratedBy: "Precision Cal. Svc.", calibratedAt: "2023-11-28", nextDue: "2024-12-01", certificateNumber: "PCS-2023-17021", notes: "Adjusted to within 2% tolerance." },
    ],
  },
  {
    id: "tl-002", toolNumber: "TL-002", description: "Digital Multimeter — Fluke 117",
    serialNumber: "FL-2948312", manufacturer: "Fluke", location: "Avionics Bench",
    status: "active", calibrationIntervalDays: 365, lastCalibratedAt: "2025-01-15",
    nextCalibrationDue: "2026-01-15", calibrationVendor: "Fluke Calibration Center",
    history: [
      { id: "tc-010", calibratedBy: "Fluke Cal Center", calibratedAt: "2025-01-15", nextDue: "2026-01-15", certificateNumber: "FC-2025-00481", notes: "All functions within spec." },
    ],
  },
  {
    id: "tl-003", toolNumber: "TL-003", description: "Torque Wrench — 1/2\" Drive 0-300 ft-lb",
    serialNumber: "TW-48291", manufacturer: "CDI", location: "Tool Room — Cabinet A",
    status: "due_soon", calibrationIntervalDays: 365, lastCalibratedAt: "2024-04-20",
    nextCalibrationDue: "2025-04-20", calibrationVendor: "Precision Calibration Services",
    history: [
      { id: "tc-020", calibratedBy: "Precision Cal. Svc.", calibratedAt: "2024-04-20", nextDue: "2025-04-20", certificateNumber: "PCS-2024-13782", notes: "" },
    ],
  },
  {
    id: "tl-004", toolNumber: "TL-004", description: "Pitot-Static Test Set — Laversab 6300",
    serialNumber: "LS-6300-0291", manufacturer: "Laversab", location: "Avionics Bench",
    status: "due_soon", calibrationIntervalDays: 730, lastCalibratedAt: "2023-04-05",
    nextCalibrationDue: "2025-04-05", calibrationVendor: "NATA-accredited lab",
    history: [
      { id: "tc-030", calibratedBy: "NATA Lab", calibratedAt: "2023-04-05", nextDue: "2025-04-05", certificateNumber: "NATA-2023-04219", notes: "Bi-annual certification." },
    ],
  },
  {
    id: "tl-005", toolNumber: "TL-005", description: "Dial Torque Indicator — 0-600 in-oz",
    serialNumber: "DT-92841", manufacturer: "Proto", location: "Tool Room — Cabinet B",
    status: "active", calibrationIntervalDays: 365, lastCalibratedAt: "2025-02-01",
    nextCalibrationDue: "2026-02-01", calibrationVendor: "Precision Calibration Services",
    history: [
      { id: "tc-040", calibratedBy: "Precision Cal. Svc.", calibratedAt: "2025-02-01", nextDue: "2026-02-01", certificateNumber: "PCS-2025-20012", notes: "" },
    ],
  },
  {
    id: "tl-006", toolNumber: "TL-006", description: "Borescope — Flexible 1m",
    serialNumber: "BS-38271", manufacturer: "Olympus", location: "Tool Room — Cabinet C",
    status: "active", calibrationIntervalDays: 365, lastCalibratedAt: "2025-01-10",
    nextCalibrationDue: "2026-01-10", calibrationVendor: "N/A — Visual inspection tool",
    history: [],
  },
  {
    id: "tl-007", toolNumber: "TL-007", description: "Compass Rose / Compass Swing Kit",
    serialNumber: "CS-10283", manufacturer: "Airpath", location: "Ramp — Locker",
    status: "overdue", calibrationIntervalDays: 365, lastCalibratedAt: "2024-01-20",
    nextCalibrationDue: "2025-01-20", calibrationVendor: "Precision Calibration Services",
    history: [
      { id: "tc-050", calibratedBy: "Precision Cal. Svc.", calibratedAt: "2024-01-20", nextDue: "2025-01-20", certificateNumber: "PCS-2024-10019", notes: "" },
      { id: "tc-051", calibratedBy: "Precision Cal. Svc.", calibratedAt: "2023-01-15", nextDue: "2024-01-20", certificateNumber: "PCS-2023-10008", notes: "" },
    ],
  },
  {
    id: "tl-008", toolNumber: "TL-008", description: "Rivet Gun — 3X",
    serialNumber: "RG-02918", manufacturer: "Chicago Pneumatic", location: "Tool Room — Cabinet B",
    status: "active", calibrationIntervalDays: 730, lastCalibratedAt: "2024-06-01",
    nextCalibrationDue: "2026-06-01", calibrationVendor: "Internal check only",
    history: [
      { id: "tc-060", calibratedBy: "J. Martinez", calibratedAt: "2024-06-01", nextDue: "2026-06-01", certificateNumber: "INT-2024-008", notes: "Pull force verified with test mandrels." },
    ],
  },
  {
    id: "tl-009", toolNumber: "TL-009", description: "ELT Test Set",
    serialNumber: "ELT-T-5518", manufacturer: "Artex", location: "Avionics Bench",
    status: "overdue", calibrationIntervalDays: 365, lastCalibratedAt: "2023-12-10",
    nextCalibrationDue: "2024-12-10", calibrationVendor: "Artex factory service",
    history: [
      { id: "tc-070", calibratedBy: "Artex Factory", calibratedAt: "2023-12-10", nextDue: "2024-12-10", certificateNumber: "ARX-2023-ELT-009", notes: "" },
    ],
  },
  {
    id: "tl-010", toolNumber: "TL-010", description: "Torque Wrench — 1/4\" Drive 0-80 in-lb",
    serialNumber: "TW-18274", manufacturer: "Snap-On", location: "Tool Room — Cabinet A",
    status: "due_soon", calibrationIntervalDays: 365, lastCalibratedAt: "2024-04-18",
    nextCalibrationDue: "2025-04-18", calibrationVendor: "Precision Calibration Services",
    history: [
      { id: "tc-080", calibratedBy: "Precision Cal. Svc.", calibratedAt: "2024-04-18", nextDue: "2025-04-18", certificateNumber: "PCS-2024-13650", notes: "" },
    ],
  },
  {
    id: "tl-011", toolNumber: "TL-011", description: "Transponder Ramp Tester — IFR-6000",
    serialNumber: "IFR-60-1182", manufacturer: "Astronics", location: "Avionics Bench",
    status: "overdue", calibrationIntervalDays: 365, lastCalibratedAt: "2023-11-01",
    nextCalibrationDue: "2024-11-01", calibrationVendor: "Astronics service center",
    history: [
      { id: "tc-090", calibratedBy: "Astronics Service", calibratedAt: "2023-11-01", nextDue: "2024-11-01", certificateNumber: "AST-2023-IFR-412", notes: "" },
    ],
  },
  {
    id: "tl-012", toolNumber: "TL-012", description: "Dial Indicator — 0.001\" resolution",
    serialNumber: "DI-00291", manufacturer: "Mitutoyo", location: "Tool Room — Cabinet B",
    status: "active", calibrationIntervalDays: 365, lastCalibratedAt: "2025-03-01",
    nextCalibrationDue: "2026-03-01", calibrationVendor: "Precision Calibration Services",
    history: [
      { id: "tc-100", calibratedBy: "Precision Cal. Svc.", calibratedAt: "2025-03-01", nextDue: "2026-03-01", certificateNumber: "PCS-2025-21088", notes: "" },
    ],
  },
]

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const INVOICES: Invoice[] = [
  {
    id: "inv-001", invoiceNumber: "INV-2025-0089", woId: "wo-001", woNumber: "WO-2025-0041",
    aircraftId: "ac-001", aircraftReg: "N863CB", customerName: "CB Aviation Inc.",
    status: "paid", issuedDate: "2025-03-15", dueDate: "2025-04-14",
    lines: [
      { id: "il-001", description: "100-hr inspection labor — Engine & accessories",   type: "labor",  qty: 8,   unitPrice: 125.00, extended: 1000.00, taxable: false },
      { id: "il-002", description: "100-hr inspection labor — Airframe & controls",    type: "labor",  qty: 6,   unitPrice: 125.00, extended: 750.00,  taxable: false },
      { id: "il-003", description: "Engine oil filter LW-16702 (x2)",                 type: "part",   qty: 2,   unitPrice: 56.25,  extended: 112.50,  taxable: true  },
      { id: "il-004", description: "Squat switch 101-384007-5",                        type: "part",   qty: 1,   unitPrice: 248.75, extended: 248.75,  taxable: true  },
      { id: "il-005", description: "Shop supplies",                                    type: "misc",   qty: 1,   unitPrice: 85.00,  extended: 85.00,   taxable: true  },
    ],
    subtotalLabor: 1750.00, subtotalParts: 361.25, subtotalMisc: 85.00, taxAmount: 37.14, grandTotal: 2233.39,
    notes: "Payment received via ACH. Ref #: ACH-2025-04821.",
  },
  {
    id: "inv-002", invoiceNumber: "INV-2025-0090", woId: "wo-006", woNumber: "WO-2025-0046",
    aircraftId: "ac-001", aircraftReg: "N863CB", customerName: "CB Aviation Inc.",
    status: "sent", issuedDate: "2025-04-02", dueDate: "2025-05-02",
    lines: [
      { id: "il-010", description: "Prop R/R, preparation for overhaul",              type: "labor",        qty: 3,   unitPrice: 125.00, extended: 375.00,  taxable: false },
      { id: "il-011", description: "Hartzell overhaul — both assemblies (net cost)",  type: "outside_labor",qty: 1,   unitPrice: 4200.00,extended: 4200.00, taxable: false },
      { id: "il-012", description: "Prop install, track/balance, operational check",  type: "labor",        qty: 4,   unitPrice: 125.00, extended: 500.00,  taxable: false },
      { id: "il-013", description: "Anti-seize, safety wire, consumables",            type: "misc",         qty: 1,   unitPrice: 42.00,  extended: 42.00,   taxable: true  },
    ],
    subtotalLabor: 875.00, subtotalParts: 0, subtotalMisc: 4242.00, taxAmount: 3.36, grandTotal: 5120.36,
    notes: "Net 30 terms.",
  },
  {
    id: "inv-003", invoiceNumber: "INV-2025-0091",
    aircraftId: "ac-002", aircraftReg: "N512SX", customerName: "CB Aviation Inc.",
    status: "draft", issuedDate: "2025-04-04",
    lines: [
      { id: "il-020", description: "Annual inspection labor — airframe",              type: "labor",  qty: 12,  unitPrice: 125.00, extended: 1500.00, taxable: false },
      { id: "il-021", description: "Annual inspection labor — powerplant",            type: "labor",  qty: 8,   unitPrice: 125.00, extended: 1000.00, taxable: false },
      { id: "il-022", description: "Air filter element SA2797660-5 (x2)",             type: "part",   qty: 2,   unitPrice: 50.35,  extended: 100.70,  taxable: true  },
      { id: "il-023", description: "Spark plugs REM40E (x12)",                        type: "part",   qty: 12,  unitPrice: 29.90,  extended: 358.80,  taxable: true  },
      { id: "il-024", description: "Shop supplies",                                   type: "misc",   qty: 1,   unitPrice: 65.00,  extended: 65.00,   taxable: true  },
    ],
    subtotalLabor: 2500.00, subtotalParts: 459.50, subtotalMisc: 65.00, taxAmount: 41.96, grandTotal: 3066.46,
    notes: "Draft — pending WO close-out.",
  },
  {
    id: "inv-004", invoiceNumber: "INV-2025-0092",
    aircraftId: "ac-003", aircraftReg: "N741CB", customerName: "CB Aviation Inc.",
    status: "void", issuedDate: "2025-03-22",
    lines: [
      { id: "il-030", description: "Avionics — GPS database update",                  type: "labor",  qty: 1.5, unitPrice: 135.00, extended: 202.50,  taxable: false },
    ],
    subtotalLabor: 202.50, subtotalParts: 0, subtotalMisc: 0, taxAmount: 0, grandTotal: 202.50,
    notes: "Voided — billing error. Reissued under INV-2025-0093.",
  },
]

// ─── Logbook Entries ──────────────────────────────────────────────────────────

const RTS = "I certify the work performed as described herein was accomplished in accordance with Title 14, Code of Federal Regulations, Part 135.411(a)(1), Part 91.409(f)(3), and Part 43, and is approved for return to service in respect to that work performed."

export const LOGBOOK_ENTRIES: LogbookEntry[] = [
  {
    id: "lb-001", entryNumber: "LB-2025-0041",
    aircraftId: "ac-001", aircraftReg: "N863CB", make: "Beechcraft", model: "King Air 350", serial: "FL-0863",
    woId: "wo-001", woNumber: "WO-2025-0041",
    entryDate: "2025-03-14",
    totalAircraftTime: 4100.0, totalAircraftTimeNew: 4100.0,
    landings: undefined, landingsNew: undefined,
    hobbs: 4100.0, hobbsNew: 4100.0,
    sectionTitle: "Airframe Entries",
    entries: [
      { number: 1, text: "100-hr engine inspection complied with per Beechcraft KA350 MM Section 05-20-00. Engine oil drained and replaced. Both oil filters (P/N LW-16702) replaced. Accessory section inspected — no discrepancies found. Oil consumption within published limits." },
      { number: 2, text: "Airframe, flight controls, and landing gear inspection complied with per KA350 MM. All control surface travel and rigging within limits. Brake pads within serviceable limits. Left main gear squat switch found worn — addressed in Item 3." },
      { number: 3, text: "Squat switch R/R complied with per Beechcraft KA350 MM Section 32-31-00. New switch (P/N 101-384007-5) installed and safety wired. Gear retraction cycle and micro-switch functional test performed — operation satisfactory." },
      { number: 4, text: "All avionics functional checks complied with per 100-hr inspection checklist. Altimeter system tested per FAR 91.411 — within limits. Transponder tested per FAR 91.413 — Mode C encoding verified. All IFR equipment checks satisfactory." },
    ],
    complianceRef: "B350 MM Chapter 05-20-00",
    returnToService: RTS,
    mechanicId: "mec-002", mechanicName: "R. Thompson",
    certificateType: "A&P/IA", certificateNumber: "A&P-1938472",
    isRIA: true, inspectorName: "R. Thompson", inspectorCert: "A&P-1938472",
    status: "signed", signedAt: "2025-03-14T16:30:00Z",
  },
  {
    id: "lb-002", entryNumber: "LB-2025-0046",
    aircraftId: "ac-001", aircraftReg: "N863CB", make: "Beechcraft", model: "King Air 350", serial: "FL-0863",
    woId: "wo-006", woNumber: "WO-2025-0046",
    entryDate: "2025-04-01",
    totalAircraftTime: 4218.3, totalAircraftTimeNew: 4218.3,
    hobbs: 4218.3, hobbsNew: 4218.3,
    sectionTitle: "Airframe Entries",
    entries: [
      { number: 1, text: "Both propeller assemblies removed per Hartzell OM 137E Section 3. Props logged, tagged, and shipped to Hartzell Overhaul Services, Piqua OH. Packing and shipping documentation completed. Aircraft secured." },
      { number: 2, text: "Both propeller assemblies installed per Hartzell OM 137E. Prop track checked — within 1/8\" limit. Dynamic balance performed using Aces Systems RADS-AT — vibration 0.04 IPS (limit 0.20 IPS). Engine run-up normal. Return to service approved." },
    ],
    returnToService: RTS,
    mechanicId: "mec-002", mechanicName: "R. Thompson",
    certificateType: "A&P/IA", certificateNumber: "A&P-1938472",
    isRIA: true, inspectorName: "R. Thompson", inspectorCert: "A&P-1938472",
    status: "signed", signedAt: "2025-04-01T16:00:00Z",
  },
  {
    id: "lb-003", entryNumber: "LB-2025-0044",
    aircraftId: "ac-001", aircraftReg: "N863CB", make: "Beechcraft", model: "King Air 350", serial: "FL-0863",
    woId: "wo-004", woNumber: "WO-2025-0044",
    entryDate: "2025-04-02",
    totalAircraftTime: 4218.3, totalAircraftTimeNew: 4218.3,
    hobbs: 4218.3, hobbsNew: 4218.3,
    sectionTitle: "Avionics Entries",
    entries: [
      { number: 1, text: "34-CUS-001 Nav database update complied with referencing Garmin GTN-750Xi LMM 190-01499-02. Database updated via Garmin Pilot. RAIM prediction verified for next 24 hrs. Databases expire 04-24-2026. Post-update operational check OK." },
      { number: 2, text: "Pitot-static system tested per FAR 91.411 using calibrated test set (TL-007). Transponder and encoder tested per FAR 91.413 — Mode C altitude encoding verified. All checks within limits. Return to service approved — awaiting IA sign-off." },
    ],
    complianceRef: "14 CFR §91.411 / §91.413",
    returnToService: RTS,
    mechanicId: "mec-004", mechanicName: "S. Nakamura",
    certificateType: "A&P", certificateNumber: "A&P-2938471",
    isRIA: false,
    status: "draft",
  },
]

// ─── SOPs ─────────────────────────────────────────────────────────────────────

export type SOPCategory =
  | "Work Orders"
  | "Parts & Inventory"
  | "Logbook"
  | "Invoicing"
  | "Tool Calibration"
  | "Safety"
  | "Portal Navigation"

export interface SOPStep {
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
  steps: SOPStep[]
  relatedSOPs: string[]   // sop ids
  tags: string[]
}

export const SOPS: SOP[] = [
  {
    id: "sop-001", sopNumber: "SOP-BB-001", title: "Opening a New Work Order",
    category: "Work Orders", revision: "A", effectiveDate: "2025-01-15", reviewDate: "2026-01-15",
    author: "J. Martinez", approvedBy: "R. Thompson",
    description: "Describes the procedure for creating and opening a new Work Order in Beet Box. Applies to all scheduled, unscheduled, and AOG maintenance events.",
    tags: ["work order", "create", "open", "WO"],
    relatedSOPs: ["sop-002", "sop-007"],
    steps: [
      { number: 1, instruction: "Navigate to the Work Orders module from the Beet Box sidebar." },
      { number: 2, instruction: 'Click the "+ New Work Order" button in the top-right of the dashboard.' },
      { number: 3, instruction: "Select the aircraft from the dropdown. Registration, make, and model are shown.", note: "If the aircraft is not listed, contact your system administrator." },
      { number: 4, instruction: 'Enter the Work Order Type (e.g., "100-Hour Inspection", "Unscheduled Maintenance — Hydraulic").' },
      { number: 5, instruction: "Set the priority: Routine, Urgent, or AOG.", warning: "AOG status must only be used when the aircraft is grounded. It flags the WO for immediate attention across the entire system." },
      { number: 6, instruction: "Enter a clear, concise description of the full scope of work." },
      { number: 7, instruction: "Record the aircraft meter reading (Hobbs or tach hours) at the time of opening." },
      { number: 8, instruction: "Assign one or more mechanics from the available personnel list." },
      { number: 9, instruction: 'Click "Create Work Order". The WO is created in Draft status.' },
      { number: 10, instruction: 'Review the WO detail page. Click "Open Work Order" in the bottom status bar to move the WO from Draft to Open, making it active for work.' },
    ],
  },
  {
    id: "sop-002", sopNumber: "SOP-BB-002", title: "Adding Items to a Work Order",
    category: "Work Orders", revision: "A", effectiveDate: "2025-01-15", reviewDate: "2026-01-15",
    author: "J. Martinez", approvedBy: "R. Thompson",
    description: "Procedure for adding line items to an open Work Order. Each item represents a discrete maintenance task that will generate an entry in the aircraft logbook.",
    tags: ["work order", "items", "line items", "tasks", "logbook section"],
    relatedSOPs: ["sop-001", "sop-003", "sop-005"],
    steps: [
      { number: 1, instruction: "Open the target Work Order from the Work Orders dashboard." },
      { number: 2, instruction: "Confirm the WO is in Open or In Progress status before adding items." },
      { number: 3, instruction: "Click the Items tab if not already selected." },
      { number: 4, instruction: "Identify the correct logbook section for the task: Airframe, Engine 1, Engine 2, Propeller, APU, or Other.", note: "Items must be in the correct section — this determines which aircraft logbook book the entry appears in." },
      { number: 5, instruction: 'Click the "+ Add" button in the appropriate section header.' },
      { number: 6, instruction: 'Enter the task name (e.g., "Engine Oil Change", "Brake Disc R/R").' },
      { number: 7, instruction: 'Enter the ATA chapter/task number if applicable (e.g., "05-20-00", "32-40-00").' },
      { number: 8, instruction: "Enter the discrepancy — describe what was found, what is required, or what the scheduled task is." },
      { number: 9, instruction: "Leave Corrective Action blank if work has not yet been performed. It will be filled in during or after the work." },
      { number: 10, instruction: "Enter estimated labor hours and confirm the labor rate." },
      { number: 11, instruction: 'Click "Add Item". The item appears in the section with Pending status.' },
    ],
  },
  {
    id: "sop-003", sopNumber: "SOP-BB-003", title: "Recording Discrepancy and Corrective Action",
    category: "Work Orders", revision: "B", effectiveDate: "2025-02-01", reviewDate: "2026-02-01",
    author: "R. Thompson", approvedBy: "R. Thompson",
    description: "The discrepancy and corrective action fields are the legal record of work performed. This SOP covers best practices for writing accurate, FAA-compliant entries that will flow directly into the aircraft logbook.",
    tags: ["discrepancy", "corrective action", "logbook", "FAA", "documentation"],
    relatedSOPs: ["sop-002", "sop-006", "sop-010"],
    steps: [
      { number: 1, instruction: "Open the Work Order and expand the item by clicking its row." },
      { number: 2, instruction: "The item card shows two text fields side-by-side: Discrepancy (left) and Corrective Action (right)." },
      { number: 3, instruction: "In the Discrepancy field, record what was found or what the task requires. Reference the maintenance manual section if applicable.", note: 'Example: "Left main gear squat switch (P/N 101-384007-5) found at wear limit per 100-hr inspection Item 2. Replacement required per KA350 MM 32-31-00."' },
      { number: 4, instruction: "Use the formatting toolbar (B, I, bullet, numbered list) to structure complex, multi-step discrepancies." },
      { number: 5, instruction: "After work is performed, enter the Corrective Action. Describe exactly what was done.", note: "Include: part numbers installed, manual/AD/SB references, test results, and return-to-service language where applicable." },
      { number: 6, instruction: "Corrective action text flows directly into the logbook entry when generated. Write as if you are writing the logbook entry itself.", warning: "Incomplete corrective action text will block logbook entry generation. The entry pulls directly from this field." },
      { number: 7, instruction: 'Set the item status to "Done" using the status buttons below the text fields.' },
      { number: 8, instruction: 'If review is required before sign-off, set status to "Needs Review" and notify the IA.' },
    ],
  },
  {
    id: "sop-004", sopNumber: "SOP-BB-004", title: "Clocking In Labor Hours",
    category: "Work Orders", revision: "A", effectiveDate: "2025-01-15", reviewDate: "2026-01-15",
    author: "J. Martinez", approvedBy: "R. Thompson",
    description: "Procedure for recording labor time against individual Work Order items. All billable labor must be clocked in at the item level for accurate invoice generation.",
    tags: ["labor", "hours", "clock in", "time", "billing"],
    relatedSOPs: ["sop-002", "sop-007"],
    steps: [
      { number: 1, instruction: "Open the Work Order and expand the item you worked on." },
      { number: 2, instruction: "Scroll to the Labor panel in the bottom-left of the expanded item card." },
      { number: 3, instruction: 'Review the "Not Clocked In" list to confirm your name appears there.' },
      { number: 4, instruction: 'Click "+ Clock In" to open the labor entry form.' },
      { number: 5, instruction: "Select your name from the Mechanic dropdown." },
      { number: 6, instruction: "Enter the number of hours worked on this item (e.g., 2.5)." },
      { number: 7, instruction: "Confirm or adjust the date field." },
      { number: 8, instruction: 'Click "Add". Your entry appears in the Clocked In list.', note: "Clocking in automatically updates the item's total billable hours and the WO's estimated total cost." },
      { number: 9, instruction: 'If you worked multiple sessions, click "+ Clock In" again to add additional entries.' },
      { number: 10, instruction: "Multiple mechanics can clock time on the same item independently." },
    ],
  },
  {
    id: "sop-005", sopNumber: "SOP-BB-005", title: "Parts Management on a Work Order Item",
    category: "Parts & Inventory", revision: "A", effectiveDate: "2025-02-01", reviewDate: "2026-02-01",
    author: "D. Wilson", approvedBy: "R. Thompson",
    description: "How to record parts used on individual Work Order items. Accurate parts records drive both the invoice and the logbook entry.",
    tags: ["parts", "work order", "inventory", "billing", "part number"],
    relatedSOPs: ["sop-002", "sop-008", "sop-009"],
    steps: [
      { number: 1, instruction: "Open the Work Order and expand the item requiring parts." },
      { number: 2, instruction: "Scroll to the Parts panel in the bottom-right of the expanded item card." },
      { number: 3, instruction: 'If no parts are needed for this task, check "No parts required for this task" to clear the warning indicator.' },
      { number: 4, instruction: 'To add a part, click "+ Add Part".' },
      { number: 5, instruction: "Enter the part number exactly as it appears on the component, packaging, or 8130 tag." },
      { number: 6, instruction: 'Enter a clear description (e.g., "Engine Oil Filter — Lycoming, P/N LW-16702").' },
      { number: 7, instruction: "Enter the quantity and unit price." },
      { number: 8, instruction: 'Click "Add Part". The part appears in the parts list.', note: "Part cost is immediately reflected in the item financial summary and WO estimated total." },
      { number: 9, instruction: "To remove a part, click the × button on the part row." },
      { number: 10, instruction: "If the part was ordered via Purchase Order, reference the PO number in the discrepancy field for traceability." },
    ],
  },
  {
    id: "sop-006", sopNumber: "SOP-BB-006", title: "Item Sign-Off Procedure",
    category: "Work Orders", revision: "B", effectiveDate: "2025-03-01", reviewDate: "2026-03-01",
    author: "R. Thompson", approvedBy: "R. Thompson",
    description: "The sign-off certifies that work described in the corrective action was performed correctly and the aircraft is approved for return to service in respect to that work. This is a legal statement under FAA regulations.",
    tags: ["sign-off", "certification", "return to service", "RTS", "IA", "A&P"],
    relatedSOPs: ["sop-003", "sop-007", "sop-010"],
    steps: [
      { number: 1, instruction: "Confirm all work for the item is complete: discrepancy filled, corrective action written, labor clocked, parts recorded." },
      { number: 2, instruction: 'Set the item status to "Done".' },
      { number: 3, instruction: "Read the corrective action text carefully for accuracy, completeness, and regulatory compliance." },
      { number: 4, instruction: 'In the Sign-off row at the bottom of the item card, click "Sign Off This Item".', warning: "Signing off is a legal certification of airworthiness. In production, this is tied to your FAA certificate number. Do not sign off work you did not perform or inspect." },
      { number: 5, instruction: "The sign-off records your name and the current timestamp. A green Signed badge appears in the item header." },
      { number: 6, instruction: "For work requiring IA authorization, the IA must complete the Inspector Release section before the item is fully released." },
      { number: 7, instruction: "All required sign-offs must be complete before the Work Order can advance to the Billing stage." },
      { number: 8, instruction: 'If a sign-off was made in error, click "Undo sign-off" and correct the issue before re-signing.' },
    ],
  },
  {
    id: "sop-007", sopNumber: "SOP-BB-007", title: "Completing and Closing a Work Order",
    category: "Work Orders", revision: "A", effectiveDate: "2025-02-15", reviewDate: "2026-02-15",
    author: "J. Martinez", approvedBy: "R. Thompson",
    description: "Step-by-step procedure for advancing a Work Order through review and billing to final completion, including logbook entry generation.",
    tags: ["complete", "close", "billing", "status", "logbook", "WO"],
    relatedSOPs: ["sop-006", "sop-010", "sop-011"],
    steps: [
      { number: 1, instruction: 'Confirm all items are in "Done" status with corrective actions complete.' },
      { number: 2, instruction: "Confirm all required sign-offs are complete. Check the sign-off row within each item." },
      { number: 3, instruction: 'Click "Submit for Review" in the bottom status bar to advance the WO to In Review status.' },
      { number: 4, instruction: "The IA or lead mechanic reviews all items and sign-offs." },
      { number: 5, instruction: 'Click "Approve → Billing" to advance to Billing status. Review all charges: labor, parts, shipping, outside services.' },
      { number: 6, instruction: 'Click "Complete Work Order" in the status bar.' },
      { number: 7, instruction: "A modal appears offering to generate a Logbook Entry from the WO data.", note: "Generating a logbook entry is strongly recommended for any work requiring a logbook record under 14 CFR Part 43." },
      { number: 8, instruction: "Select your preferred option. If generating an entry, you will be redirected to the Logbook module with the entry pre-populated from WO corrective actions." },
      { number: 9, instruction: "The WO is marked Completed and locked against further editing." },
      { number: 10, instruction: "Generate the invoice from the Invoicing module. See SOP-BB-011." },
    ],
  },
  {
    id: "sop-008", sopNumber: "SOP-BB-008", title: "Creating a Purchase Order",
    category: "Parts & Inventory", revision: "A", effectiveDate: "2025-01-15", reviewDate: "2026-01-15",
    author: "D. Wilson", approvedBy: "R. Thompson",
    description: "Procedure for creating a Purchase Order in Beet Box to order parts from an approved vendor. POs should be linked to the associated Work Order for full traceability.",
    tags: ["purchase order", "PO", "parts", "vendor", "order"],
    relatedSOPs: ["sop-005", "sop-009"],
    steps: [
      { number: 1, instruction: "Navigate to Purchase Orders in the Beet Box sidebar." },
      { number: 2, instruction: 'Click "+ New Purchase Order".' },
      { number: 3, instruction: "Select the vendor from the dropdown (Aircraft Spruce, Aviall, Wencor, Jetsco, etc.)." },
      { number: 4, instruction: "Link the PO to the associated Work Order if applicable. This allows WO tracking of parts on order.", note: "Linking a PO to a WO will enable the WO to show Waiting on Parts status and give full visibility into the order." },
      { number: 5, instruction: "Add line items: part number, description, quantity ordered, and unit cost for each part." },
      { number: 6, instruction: "Review the PO total before submitting." },
      { number: 7, instruction: 'Click "Create PO". The PO is saved in Draft status.' },
      { number: 8, instruction: 'Advance the PO to "Sent" status when the order has been placed with the vendor.' },
    ],
  },
  {
    id: "sop-009", sopNumber: "SOP-BB-009", title: "Receiving Parts Against a Purchase Order",
    category: "Parts & Inventory", revision: "A", effectiveDate: "2025-01-15", reviewDate: "2026-01-15",
    author: "D. Wilson", approvedBy: "R. Thompson",
    description: "How to receive and inspect incoming parts against an open Purchase Order, update inventory, and return the linked Work Order to active status.",
    tags: ["receive", "parts", "purchase order", "inspection", "8130", "airworthiness"],
    relatedSOPs: ["sop-008", "sop-005"],
    steps: [
      { number: 1, instruction: "Navigate to Purchase Orders and open the relevant PO." },
      { number: 2, instruction: "When parts arrive, click Receive on the PO detail page." },
      { number: 3, instruction: "For each line item, enter the quantity received.", note: "Partial receipts are supported. The PO will show Partial status until all lines are fully received." },
      { number: 4, instruction: "Inspect all received parts for correct part number, condition, and airworthiness documentation.", warning: "Do not accept or install any part without proper airworthiness certification (FAA Form 8130-3 or manufacturer's Certificate of Conformance). Quarantine and report any suspect parts." },
      { number: 5, instruction: "If all lines are received, the PO advances to Received status automatically." },
      { number: 6, instruction: "Navigate back to the linked Work Order. Add the received parts to the applicable WO items (see SOP-BB-005)." },
      { number: 7, instruction: 'Advance the WO status from "Waiting on Parts" to "Open" using the Parts Received button in the status bar.' },
    ],
  },
  {
    id: "sop-010", sopNumber: "SOP-BB-010", title: "Generating a Logbook Entry",
    category: "Logbook", revision: "A", effectiveDate: "2025-03-01", reviewDate: "2026-03-01",
    author: "R. Thompson", approvedBy: "R. Thompson",
    description: "Procedure for generating, reviewing, and signing a FAA-compliant aircraft logbook entry from a completed Work Order. The entry is auto-populated from WO corrective action text.",
    tags: ["logbook", "FAA", "RTS", "return to service", "sign", "A&P", "IA"],
    relatedSOPs: ["sop-003", "sop-006", "sop-007"],
    steps: [
      { number: 1, instruction: "Complete the associated Work Order (see SOP-BB-007), or navigate to Logbook → New Entry." },
      { number: 2, instruction: "If generated from the WO completion modal, you will be redirected to a pre-populated logbook entry." },
      { number: 3, instruction: "Review the Aircraft Total Time. Update the New TT field if the Hobbs or tach time changed during maintenance." },
      { number: 4, instruction: "Review each numbered entry. Entries are pulled from the WO item corrective action fields." },
      { number: 5, instruction: "Edit any entries for clarity, grammar, or to add required compliance references (AD, SB, MM section numbers)." },
      { number: 6, instruction: "Confirm the Return to Service statement is accurate and complete.", warning: "The RTS statement must comply with 14 CFR Part 43.9 or 43.11 as applicable. Consult your IA if uncertain about the applicable regulatory paragraph." },
      { number: 7, instruction: "Verify the mechanic name and FAA certificate number are correct." },
      { number: 8, instruction: "For IA-released work, complete the Inspector Release section (name and certificate number)." },
      { number: 9, instruction: 'Click "Sign & Lock Entry". This locks the entry against further editing and records the signing timestamp.' },
      { number: 10, instruction: 'For export, click "Export PDF" to download the FAA-format logbook entry.' },
    ],
  },
  {
    id: "sop-011", sopNumber: "SOP-BB-011", title: "Creating and Exporting an Invoice",
    category: "Invoicing", revision: "A", effectiveDate: "2025-03-15", reviewDate: "2026-03-15",
    author: "J. Martinez", approvedBy: "R. Thompson",
    description: "How to create a customer invoice from a completed Work Order, review all charges, and export a print-ready PDF matching the CB Aviation standard invoice format.",
    tags: ["invoice", "billing", "PDF", "export", "charges", "customer"],
    relatedSOPs: ["sop-007"],
    steps: [
      { number: 1, instruction: "Navigate to Invoicing in the Beet Box sidebar." },
      { number: 2, instruction: "Open the invoice linked to the completed Work Order, or create a new invoice." },
      { number: 3, instruction: "Verify all line items are populated from the WO: labor by item, parts, shipping, and outside services." },
      { number: 4, instruction: "Review subtotals: Total Shop Labor, Parts, Shipping, Additional Charges, Shop Supplies, and Tax." },
      { number: 5, instruction: "Confirm the customer name and billing address are correct." },
      { number: 6, instruction: "Check the Amount Due total against the WO cost estimate to ensure no items are missing." },
      { number: 7, instruction: 'Set invoice status to "Sent" when ready to transmit to the customer.' },
      { number: 8, instruction: 'Click "Export PDF" to download a formatted invoice.', note: "The PDF captures the invoice exactly as displayed on screen — including all line items, item-level discrepancy/corrective action text, and totals — matching the CB Aviation standard invoice layout." },
    ],
  },
  {
    id: "sop-012", sopNumber: "SOP-BB-012", title: "Tool Calibration Management",
    category: "Tool Calibration", revision: "A", effectiveDate: "2025-01-15", reviewDate: "2026-01-15",
    author: "J. Martinez", approvedBy: "R. Thompson",
    description: "Procedure for checking tool calibration status before use and recording calibration events in Beet Box. Applies to all precision tools requiring periodic calibration.",
    tags: ["tool", "calibration", "out of service", "precision", "compliance"],
    relatedSOPs: [],
    steps: [
      { number: 1, instruction: "Navigate to Tool Calibration in the Beet Box sidebar." },
      { number: 2, instruction: "The dashboard shows all tools color-coded by status: Green = current, Amber = due within 30 days, Red = overdue." },
      { number: 3, instruction: "Before using any calibrated tool, confirm its status is Green (current).", warning: "Using an out-of-calibration tool on aircraft maintenance is a regulatory violation under 14 CFR Part 43. Overdue tools must be immediately removed from service and physically tagged." },
      { number: 4, instruction: 'To log a new calibration, open the tool record and click "Record Calibration".' },
      { number: 5, instruction: "Enter the calibration date, vendor, and calibration certificate number." },
      { number: 6, instruction: "The next due date is calculated automatically based on the tool's calibration interval." },
      { number: 7, instruction: 'Tools with Overdue status must be physically tagged "Out of Service — Calibration Required" and removed from the tool room until serviced.' },
    ],
  },
  {
    id: "sop-013", sopNumber: "SOP-BB-013", title: "Portal Navigation and Getting Started",
    category: "Portal Navigation", revision: "A", effectiveDate: "2025-01-01", reviewDate: "2026-01-01",
    author: "J. Martinez", approvedBy: "R. Thompson",
    description: "An orientation guide to the SkyShare MX portal and Beet Box MX Suite. Covers login, navigation, and how to find help within the system.",
    tags: ["portal", "login", "navigation", "orientation", "getting started"],
    relatedSOPs: ["sop-001"],
    steps: [
      { number: 1, instruction: "Log in to SkyShare MX at your organization's portal URL using your assigned credentials." },
      { number: 2, instruction: 'From the main Dashboard, locate "Beet Box" in the left sidebar under Operations.' },
      { number: 3, instruction: 'Click "Beet Box" to enter the MX Suite module. The full-screen interface will load.' },
      { number: 4, instruction: "The Beet Box sidebar provides access to all MRO modules. Operations modules are listed at the top; SOP Library and Training are listed below." },
      { number: 5, instruction: 'To return to the main SkyShare portal at any time, click the "← SkyShareMX" button in the top-right of the Beet Box sidebar header.' },
      { number: 6, instruction: "For help with any procedure, navigate to SOP Library and search by keyword or browse by category." },
    ],
  },
]

// ─── Training ─────────────────────────────────────────────────────────────────

export type TrainingStatus = "current" | "expiring_soon" | "expired" | "not_trained"

export interface TrainingRecord {
  id: string
  mechanicId: string
  mechanicName: string
  sopId: string
  sopNumber: string
  sopTitle: string
  trainedBy: string
  trainedDate: string
  expiryDate: string
  status: TrainingStatus
  notes: string
}

export const TRAINING_RECORDS: TrainingRecord[] = [
  // ── J. Martinez (mec-001) — Lead Mechanic — trained on everything, all current ──
  { id: "tr-001", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-001", sopNumber: "SOP-BB-001", sopTitle: "Opening a New Work Order",             trainedBy: "R. Thompson", trainedDate: "2025-01-20", expiryDate: "2027-01-20", status: "current",      notes: "" },
  { id: "tr-002", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-002", sopNumber: "SOP-BB-002", sopTitle: "Adding Items to a Work Order",          trainedBy: "R. Thompson", trainedDate: "2025-01-20", expiryDate: "2027-01-20", status: "current",      notes: "" },
  { id: "tr-003", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-003", sopNumber: "SOP-BB-003", sopTitle: "Recording Discrepancy and Corrective Action", trainedBy: "R. Thompson", trainedDate: "2025-02-05", expiryDate: "2027-02-05", status: "current", notes: "" },
  { id: "tr-004", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-004", sopNumber: "SOP-BB-004", sopTitle: "Clocking In Labor Hours",               trainedBy: "R. Thompson", trainedDate: "2025-01-20", expiryDate: "2027-01-20", status: "current",      notes: "" },
  { id: "tr-005", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-005", sopNumber: "SOP-BB-005", sopTitle: "Parts Management on a Work Order Item", trainedBy: "R. Thompson", trainedDate: "2025-02-05", expiryDate: "2027-02-05", status: "current",      notes: "" },
  { id: "tr-006", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-006", sopNumber: "SOP-BB-006", sopTitle: "Item Sign-Off Procedure",               trainedBy: "R. Thompson", trainedDate: "2025-03-01", expiryDate: "2027-03-01", status: "current",      notes: "" },
  { id: "tr-007", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-007", sopNumber: "SOP-BB-007", sopTitle: "Completing and Closing a Work Order",   trainedBy: "R. Thompson", trainedDate: "2025-02-15", expiryDate: "2027-02-15", status: "current",      notes: "" },
  { id: "tr-008", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-008", sopNumber: "SOP-BB-008", sopTitle: "Creating a Purchase Order",             trainedBy: "R. Thompson", trainedDate: "2025-01-20", expiryDate: "2027-01-20", status: "current",      notes: "" },
  { id: "tr-009", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-009", sopNumber: "SOP-BB-009", sopTitle: "Receiving Parts Against a Purchase Order", trainedBy: "R. Thompson", trainedDate: "2025-01-20", expiryDate: "2027-01-20", status: "current",  notes: "" },
  { id: "tr-010", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-010", sopNumber: "SOP-BB-010", sopTitle: "Generating a Logbook Entry",            trainedBy: "R. Thompson", trainedDate: "2025-03-05", expiryDate: "2027-03-05", status: "current",      notes: "" },
  { id: "tr-011", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-011", sopNumber: "SOP-BB-011", sopTitle: "Creating and Exporting an Invoice",     trainedBy: "R. Thompson", trainedDate: "2025-03-20", expiryDate: "2027-03-20", status: "current",      notes: "" },
  { id: "tr-012", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-012", sopNumber: "SOP-BB-012", sopTitle: "Tool Calibration Management",           trainedBy: "R. Thompson", trainedDate: "2025-01-20", expiryDate: "2027-01-20", status: "current",      notes: "" },
  { id: "tr-013", mechanicId: "mec-001", mechanicName: "J. Martinez", sopId: "sop-013", sopNumber: "SOP-BB-013", sopTitle: "Portal Navigation and Getting Started", trainedBy: "R. Thompson", trainedDate: "2025-01-10", expiryDate: "2027-01-10", status: "current",      notes: "" },

  // ── R. Thompson (mec-002) — Inspector — SOPs 1-4 expired, 5-9 expiring soon, 10-13 current ──
  { id: "tr-020", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-001", sopNumber: "SOP-BB-001", sopTitle: "Opening a New Work Order",             trainedBy: "J. Martinez", trainedDate: "2024-01-10", expiryDate: "2026-01-10", status: "expired",       notes: "Renewal due. Schedule recurrent training." },
  { id: "tr-021", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-002", sopNumber: "SOP-BB-002", sopTitle: "Adding Items to a Work Order",          trainedBy: "J. Martinez", trainedDate: "2024-01-10", expiryDate: "2026-01-10", status: "expired",       notes: "Renewal due." },
  { id: "tr-022", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-003", sopNumber: "SOP-BB-003", sopTitle: "Recording Discrepancy and Corrective Action", trainedBy: "J. Martinez", trainedDate: "2024-01-10", expiryDate: "2026-01-10", status: "expired", notes: "Renewal due — critical SOP." },
  { id: "tr-023", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-004", sopNumber: "SOP-BB-004", sopTitle: "Clocking In Labor Hours",               trainedBy: "J. Martinez", trainedDate: "2024-01-10", expiryDate: "2026-01-10", status: "expired",       notes: "Renewal due." },
  { id: "tr-024", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-005", sopNumber: "SOP-BB-005", sopTitle: "Parts Management on a Work Order Item", trainedBy: "J. Martinez", trainedDate: "2024-05-15", expiryDate: "2026-05-15", status: "expiring_soon", notes: "Due in 6 weeks." },
  { id: "tr-025", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-006", sopNumber: "SOP-BB-006", sopTitle: "Item Sign-Off Procedure",               trainedBy: "J. Martinez", trainedDate: "2024-05-15", expiryDate: "2026-05-15", status: "expiring_soon", notes: "Due in 6 weeks — critical SOP." },
  { id: "tr-026", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-007", sopNumber: "SOP-BB-007", sopTitle: "Completing and Closing a Work Order",   trainedBy: "J. Martinez", trainedDate: "2024-05-15", expiryDate: "2026-05-15", status: "expiring_soon", notes: "Due in 6 weeks." },
  { id: "tr-027", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-008", sopNumber: "SOP-BB-008", sopTitle: "Creating a Purchase Order",             trainedBy: "J. Martinez", trainedDate: "2024-06-01", expiryDate: "2026-06-01", status: "expiring_soon", notes: "Due in 8 weeks." },
  { id: "tr-028", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-009", sopNumber: "SOP-BB-009", sopTitle: "Receiving Parts Against a Purchase Order", trainedBy: "J. Martinez", trainedDate: "2024-06-01", expiryDate: "2026-06-01", status: "expiring_soon", notes: "" },
  { id: "tr-029", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-010", sopNumber: "SOP-BB-010", sopTitle: "Generating a Logbook Entry",            trainedBy: "J. Martinez", trainedDate: "2025-03-01", expiryDate: "2027-03-01", status: "current",       notes: "" },
  { id: "tr-030", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-011", sopNumber: "SOP-BB-011", sopTitle: "Creating and Exporting an Invoice",     trainedBy: "J. Martinez", trainedDate: "2025-03-20", expiryDate: "2027-03-20", status: "current",       notes: "" },
  { id: "tr-031", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-012", sopNumber: "SOP-BB-012", sopTitle: "Tool Calibration Management",           trainedBy: "J. Martinez", trainedDate: "2025-01-20", expiryDate: "2027-01-20", status: "current",       notes: "" },
  { id: "tr-032", mechanicId: "mec-002", mechanicName: "R. Thompson", sopId: "sop-013", sopNumber: "SOP-BB-013", sopTitle: "Portal Navigation and Getting Started", trainedBy: "J. Martinez", trainedDate: "2025-01-10", expiryDate: "2027-01-10", status: "current",       notes: "" },

  // ── D. Wilson (mec-003) — Mechanic — trained on WO ops only, gaps in Logbook/Invoicing/Cal ──
  { id: "tr-040", mechanicId: "mec-003", mechanicName: "D. Wilson", sopId: "sop-001", sopNumber: "SOP-BB-001", sopTitle: "Opening a New Work Order",             trainedBy: "J. Martinez", trainedDate: "2025-02-01", expiryDate: "2027-02-01", status: "current", notes: "" },
  { id: "tr-041", mechanicId: "mec-003", mechanicName: "D. Wilson", sopId: "sop-002", sopNumber: "SOP-BB-002", sopTitle: "Adding Items to a Work Order",          trainedBy: "J. Martinez", trainedDate: "2025-02-01", expiryDate: "2027-02-01", status: "current", notes: "" },
  { id: "tr-042", mechanicId: "mec-003", mechanicName: "D. Wilson", sopId: "sop-003", sopNumber: "SOP-BB-003", sopTitle: "Recording Discrepancy and Corrective Action", trainedBy: "J. Martinez", trainedDate: "2025-02-01", expiryDate: "2027-02-01", status: "current", notes: "" },
  { id: "tr-043", mechanicId: "mec-003", mechanicName: "D. Wilson", sopId: "sop-004", sopNumber: "SOP-BB-004", sopTitle: "Clocking In Labor Hours",               trainedBy: "J. Martinez", trainedDate: "2025-02-01", expiryDate: "2027-02-01", status: "current", notes: "" },
  { id: "tr-044", mechanicId: "mec-003", mechanicName: "D. Wilson", sopId: "sop-005", sopNumber: "SOP-BB-005", sopTitle: "Parts Management on a Work Order Item", trainedBy: "J. Martinez", trainedDate: "2025-02-15", expiryDate: "2027-02-15", status: "current", notes: "" },
  { id: "tr-045", mechanicId: "mec-003", mechanicName: "D. Wilson", sopId: "sop-006", sopNumber: "SOP-BB-006", sopTitle: "Item Sign-Off Procedure",               trainedBy: "R. Thompson", trainedDate: "2025-03-01", expiryDate: "2027-03-01", status: "current", notes: "" },
  { id: "tr-046", mechanicId: "mec-003", mechanicName: "D. Wilson", sopId: "sop-013", sopNumber: "SOP-BB-013", sopTitle: "Portal Navigation and Getting Started", trainedBy: "J. Martinez", trainedDate: "2025-01-15", expiryDate: "2027-01-15", status: "current", notes: "" },

  // ── S. Nakamura (mec-004) — Avionics Tech — WO basics + portal, gaps in parts/logbook/invoicing ──
  { id: "tr-050", mechanicId: "mec-004", mechanicName: "S. Nakamura", sopId: "sop-001", sopNumber: "SOP-BB-001", sopTitle: "Opening a New Work Order",             trainedBy: "J. Martinez", trainedDate: "2025-02-10", expiryDate: "2027-02-10", status: "current", notes: "" },
  { id: "tr-051", mechanicId: "mec-004", mechanicName: "S. Nakamura", sopId: "sop-002", sopNumber: "SOP-BB-002", sopTitle: "Adding Items to a Work Order",          trainedBy: "J. Martinez", trainedDate: "2025-02-10", expiryDate: "2027-02-10", status: "current", notes: "" },
  { id: "tr-052", mechanicId: "mec-004", mechanicName: "S. Nakamura", sopId: "sop-003", sopNumber: "SOP-BB-003", sopTitle: "Recording Discrepancy and Corrective Action", trainedBy: "J. Martinez", trainedDate: "2025-02-10", expiryDate: "2027-02-10", status: "current", notes: "" },
  { id: "tr-053", mechanicId: "mec-004", mechanicName: "S. Nakamura", sopId: "sop-004", sopNumber: "SOP-BB-004", sopTitle: "Clocking In Labor Hours",               trainedBy: "J. Martinez", trainedDate: "2025-02-10", expiryDate: "2027-02-10", status: "current", notes: "" },
  { id: "tr-054", mechanicId: "mec-004", mechanicName: "S. Nakamura", sopId: "sop-013", sopNumber: "SOP-BB-013", sopTitle: "Portal Navigation and Getting Started", trainedBy: "J. Martinez", trainedDate: "2025-01-15", expiryDate: "2027-01-15", status: "current", notes: "" },

  // ── K. Rodriguez (mec-005) — Mechanic — newer, only basics, some expired ──
  { id: "tr-060", mechanicId: "mec-005", mechanicName: "K. Rodriguez", sopId: "sop-001", sopNumber: "SOP-BB-001", sopTitle: "Opening a New Work Order",             trainedBy: "J. Martinez", trainedDate: "2025-03-15", expiryDate: "2027-03-15", status: "current",  notes: "" },
  { id: "tr-061", mechanicId: "mec-005", mechanicName: "K. Rodriguez", sopId: "sop-002", sopNumber: "SOP-BB-002", sopTitle: "Adding Items to a Work Order",          trainedBy: "J. Martinez", trainedDate: "2025-03-15", expiryDate: "2027-03-15", status: "current",  notes: "" },
  { id: "tr-062", mechanicId: "mec-005", mechanicName: "K. Rodriguez", sopId: "sop-003", sopNumber: "SOP-BB-003", sopTitle: "Recording Discrepancy and Corrective Action", trainedBy: "J. Martinez", trainedDate: "2025-03-15", expiryDate: "2027-03-15", status: "current", notes: "" },
  { id: "tr-063", mechanicId: "mec-005", mechanicName: "K. Rodriguez", sopId: "sop-004", sopNumber: "SOP-BB-004", sopTitle: "Clocking In Labor Hours",               trainedBy: "J. Martinez", trainedDate: "2023-10-01", expiryDate: "2025-10-01", status: "expired",  notes: "Initial training expired. Recurrent not yet scheduled." },
  { id: "tr-064", mechanicId: "mec-005", mechanicName: "K. Rodriguez", sopId: "sop-005", sopNumber: "SOP-BB-005", sopTitle: "Parts Management on a Work Order Item", trainedBy: "J. Martinez", trainedDate: "2023-10-01", expiryDate: "2025-10-01", status: "expired",  notes: "Expired. Parts handling must be supervised until renewed." },
  { id: "tr-065", mechanicId: "mec-005", mechanicName: "K. Rodriguez", sopId: "sop-013", sopNumber: "SOP-BB-013", sopTitle: "Portal Navigation and Getting Started", trainedBy: "J. Martinez", trainedDate: "2025-03-10", expiryDate: "2027-03-10", status: "current",  notes: "" },
]

// ─── Helper lookups ───────────────────────────────────────────────────────────

export function getAircraft(id: string): Aircraft | undefined {
  return AIRCRAFT.find(a => a.id === id)
}

export function getWorkOrder(id: string): WorkOrder | undefined {
  return WORK_ORDERS.find(w => w.id === id)
}

export function getWorkOrderByNumber(num: string): WorkOrder | undefined {
  return WORK_ORDERS.find(w => w.woNumber === num)
}

export function getPart(id: string): InventoryPart | undefined {
  return INVENTORY_PARTS.find(p => p.id === id)
}

export function getPO(id: string): PurchaseOrder | undefined {
  return PURCHASE_ORDERS.find(p => p.id === id)
}

export function getTool(id: string): Tool | undefined {
  return TOOLS.find(t => t.id === id)
}

export function getInvoice(id: string): Invoice | undefined {
  return INVOICES.find(i => i.id === id)
}

export function getLogbookEntry(id: string): LogbookEntry | undefined {
  return LOGBOOK_ENTRIES.find(l => l.id === id)
}

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
  draft:   "Draft",
  sent:    "Sent",
  partial: "Partial Receipt",
  received:"Received",
  closed:  "Closed",
  voided:  "Voided",
}

export const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  active:          "Current",
  due_soon:        "Due Soon",
  overdue:         "Overdue",
  out_of_service:  "Out of Service",
  retired:         "Retired",
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent:  "Sent",
  paid:  "Paid",
  void:  "Void",
}

// ─── Permissions & Roles ──────────────────────────────────────────────────────

export type Permission =
  | "wo.view" | "wo.create" | "wo.edit_items" | "wo.delete" | "wo.advance_status" | "wo.void" | "wo.assign_mechanics"
  | "labor.log_own" | "labor.log_others" | "labor.delete"
  | "parts.add" | "parts.remove" | "parts.order"
  | "signoff.perform" | "signoff.undo"
  | "logbook.view" | "logbook.create" | "logbook.sign_lock" | "logbook.edit_locked"
  | "invoicing.view" | "invoicing.create" | "invoicing.edit" | "invoicing.void"
  | "inventory.view" | "inventory.adjust_qty" | "inventory.add_items"
  | "po.view" | "po.create" | "po.receive"
  | "tools.view" | "tools.edit"
  | "settings.view" | "settings.edit"

export const ALL_PERMISSIONS: Permission[] = [
  "wo.view","wo.create","wo.edit_items","wo.delete","wo.advance_status","wo.void","wo.assign_mechanics",
  "labor.log_own","labor.log_others","labor.delete",
  "parts.add","parts.remove","parts.order",
  "signoff.perform","signoff.undo",
  "logbook.view","logbook.create","logbook.sign_lock","logbook.edit_locked",
  "invoicing.view","invoicing.create","invoicing.edit","invoicing.void",
  "inventory.view","inventory.adjust_qty","inventory.add_items",
  "po.view","po.create","po.receive",
  "tools.view","tools.edit",
  "settings.view","settings.edit",
]

export interface MXRole {
  id: string
  name: string
  description: string
  color: string
  isSystem: boolean
  permissions: Permission[]
}

export interface SystemUser {
  id: string
  name: string
  email: string
  roleId: string
  status: "active" | "inactive"
  lastActive?: string
  certType?: string
  certNumber?: string
}

export const ROLES: MXRole[] = [
  {
    id: "role-admin",
    name: "System Admin",
    description: "Full unrestricted access to all modules and settings. Assign with care.",
    color: "#e11d48",
    isSystem: true,
    permissions: [...ALL_PERMISSIONS],
  },
  {
    id: "role-ia",
    name: "IA — Inspection Authorization",
    description: "Licensed to sign off annual inspections and major repairs. Full technical access plus logbook signing.",
    color: "#d4a017",
    isSystem: true,
    permissions: [
      "wo.view","wo.create","wo.edit_items","wo.advance_status","wo.assign_mechanics",
      "labor.log_own","labor.log_others","labor.delete",
      "parts.add","parts.remove","parts.order",
      "signoff.perform","signoff.undo",
      "logbook.view","logbook.create","logbook.sign_lock","logbook.edit_locked",
      "invoicing.view",
      "inventory.view","inventory.adjust_qty",
      "po.view","po.create","po.receive",
      "tools.view","tools.edit",
      "settings.view",
    ],
  },
  {
    id: "role-ap",
    name: "A&P Mechanic",
    description: "Certified airframe and powerplant mechanic. Can perform work and sign off routine maintenance.",
    color: "#3b82f6",
    isSystem: true,
    permissions: [
      "wo.view","wo.create","wo.edit_items","wo.advance_status","wo.assign_mechanics",
      "labor.log_own","labor.log_others",
      "parts.add","parts.remove","parts.order",
      "signoff.perform",
      "logbook.view","logbook.create",
      "invoicing.view",
      "inventory.view","inventory.adjust_qty",
      "po.view","po.create","po.receive",
      "tools.view",
      "settings.view",
    ],
  },
  {
    id: "role-service-writer",
    name: "Service Writer",
    description: "Opens work orders, communicates with customers, manages scheduling. No technical sign-off authority.",
    color: "#8b5cf6",
    isSystem: false,
    permissions: [
      "wo.view","wo.create","wo.advance_status","wo.assign_mechanics",
      "logbook.view",
      "invoicing.view","invoicing.create","invoicing.edit",
      "inventory.view",
      "po.view","po.create",
      "tools.view",
      "settings.view",
    ],
  },
  {
    id: "role-billing",
    name: "Billing & Accounting",
    description: "Invoicing and financial records only. Read-only access to work orders for reference.",
    color: "#10b981",
    isSystem: false,
    permissions: [
      "wo.view",
      "logbook.view",
      "invoicing.view","invoicing.create","invoicing.edit","invoicing.void",
      "po.view",
      "settings.view",
    ],
  },
  {
    id: "role-apprentice",
    name: "Apprentice / Student",
    description: "Under supervision. Can log their own time and view work orders. Cannot sign off or modify records.",
    color: "#6b7280",
    isSystem: false,
    permissions: [
      "wo.view",
      "labor.log_own",
      "logbook.view",
      "invoicing.view",
      "inventory.view",
      "po.view",
      "tools.view",
      "settings.view",
    ],
  },
]

export const SYSTEM_USERS: SystemUser[] = [
  { id: "usr-001", name: "Jonathan B.",   email: "jonathan@cbaviation.com",   roleId: "role-admin",          status: "active",   lastActive: "2025-04-04T08:30:00Z" },
  { id: "usr-002", name: "R. Thompson",   email: "r.thompson@cbaviation.com", roleId: "role-ia",             status: "active",   lastActive: "2025-04-04T07:15:00Z", certType: "A&P/IA", certNumber: "3468291" },
  { id: "usr-003", name: "D. Wilson",     email: "d.wilson@cbaviation.com",   roleId: "role-ap",             status: "active",   lastActive: "2025-04-04T06:45:00Z", certType: "A&P",    certNumber: "2914782" },
  { id: "usr-004", name: "J. Martinez",   email: "j.martinez@cbaviation.com", roleId: "role-ap",             status: "active",   lastActive: "2025-04-03T16:20:00Z", certType: "A&P",    certNumber: "3012847" },
  { id: "usr-005", name: "K. Rodriguez",  email: "k.rodriguez@cbaviation.com",roleId: "role-service-writer", status: "active",   lastActive: "2025-04-04T08:00:00Z" },
  { id: "usr-006", name: "M. Chen",       email: "m.chen@cbaviation.com",     roleId: "role-billing",        status: "active",   lastActive: "2025-04-03T14:10:00Z" },
  { id: "usr-007", name: "T. Owens",      email: "t.owens@cbaviation.com",    roleId: "role-apprentice",     status: "active",   lastActive: "2025-04-02T15:00:00Z", certType: "Student" },
  { id: "usr-008", name: "B. Garrett",    email: "b.garrett@cbaviation.com",  roleId: "role-ap",             status: "inactive", lastActive: "2025-03-15T09:00:00Z", certType: "A&P",    certNumber: "2788341" },
]
