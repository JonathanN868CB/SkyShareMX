// ─── Fleet Data ───────────────────────────────────────────────────────────────
// Base aircraft list drives the directory view.
// Detail records drive the overlay.
//
// Field value conventions:
//   "—"      = data not yet entered
//   "None"   = explicitly not enrolled / not applicable (intentional — not missing)
//   "N/A"    = structurally not applicable to this airframe type
//
// Adding a new aircraft:
//   1. Add AircraftBase to the relevant family in FLEET
//   2. Add an AircraftDetailData entry to AIRCRAFT_DETAILS keyed by tail number
//   3. Use makeDetail() for a blank template, then fill in known values
//
// Future: AIRCRAFT_DETAILS migrates to Supabase as a JSONB column per tail number.

export interface AircraftBase {
  id: string           // aircraft table UUID — used as FK by parts, discrepancies, etc.
  tailNumber: string
  year: number
  model: string
  serialNumber: string
}

// A single labeled data point
export interface DataField {
  label: string
  value: string         // never null/undefined — use "None" or "—" intentionally
  account?: string      // contract / account / subscription number
  link?: string         // portal or vendor URL
  note?: string         // special callout for techs
  group?: string        // visual sub-header within a section
  // Rich program metadata — shown as a compact sub-block under the program name
  provider?: string     // e.g. "Pratt & Whitney Canada"
  contractNumber?: string
  expiry?: string       // e.g. "2026-08" or "Aug 2026"
}

// Nav database subscription — special frequent-use data (28-day cycle)
// Credentials stored here are shared operational accounts, not personal passwords.
// In Supabase, this table is RLS-protected to authenticated users only.
export interface NavSubscription {
  serviceName: string              // e.g. "Garmin Aviation — Cycle Database"
  account: string                  // account / customer number
  loginUrl: string                 // portal URL
  username: string
  password: string                 // shared operational credential — masked in UI
  twoFactor: boolean
  twoFactorInstructions?: string   // e.g. "Authenticator app on ops iPad"
  cycleDays: number                // almost always 28
  cycleNote?: string               // any special note about update process
}

// Component Maintenance Manual entry — stored in aircraft_details.cmms[]
export interface CMMDocument {
  ataChapter: string    // e.g. "72-00"
  component?: string    // legacy: free-text component name (pre-structured schema)
  title?: string        // structured: document/system title e.g. "Air Conditioning System Components"
  manufacturer?: string // e.g. "Goodrich Corporation"
  docNumber: string     // manufacturer document/part number
  revision: string      // e.g. "Rev 5" or "Original"
  revisionDate?: string // e.g. "Dec 13/18"
  applicability?: string // e.g. "Cessna 525 A/B (CJ2/3)"
  driveLink: string     // Google Drive URL — empty string = not linked yet
  notes?: string
}

// Group CMM — shared manual applicable across one or more fleet families.
// Stored in the group_cmms Supabase table (not in aircraft_details).
export interface GroupCMM {
  id: string
  manufacturer: string
  docNumber: string
  ataChapter: string
  revision: string
  revisionDate: string
  title: string
  applicability: string
  driveLink: string
  notes: string
  groups: string[]      // fleet family names this CMM applies to
  createdAt?: string
  updatedAt?: string
}

// Free-form field within an avionics / connectivity service entry
export interface AvionicsField {
  name: string
  value: string
  sensitive?: boolean       // masks value in view mode with show/hide toggle
  builtin?: boolean         // true = part of the standard credential template; rendered in fixed grid
  type?: "text" | "boolean" // "boolean" = checkbox (value is "Yes"/"No"); default is "text"
  detail?: string           // supplemental text for boolean fields when value is "Yes" (e.g. 2FA instructions)
}

// Avionics / Connectivity service — flexible key-value model stored as JSONB.
// Managers and Super Admins edit this via the full-screen AvionicsEditorOverlay.
// Categories are free-form; use the datalist presets for consistency.
export interface AvionicsService {
  id: string            // stable UUID for React keys — never shown to users
  category: string      // "Flight Deck" | "Nav Database" | "Connectivity" | custom
  label: string         // service name, e.g. "Garmin Avionics Suite" or "Gogo Biz Av"
  fields: AvionicsField[]
  notes?: string        // optional free-text note shown at the bottom of the service
}

export interface AircraftDetailData {
  identity: DataField[]           // cert, company, prev tails, keys, hangar
  powerplant: DataField[]         // engine model(s), S/Ns, prop model/S/N
  apu: DataField[] | null         // null = this airframe type has no APU
  programs: DataField[]           // all programs combined (enrollment status + details)
  navSubscriptions: NavSubscription[]  // preserved for backward compat; display migrated to avionics
  documentation: DataField[]      // manual links, digital AFM, portals
  cmms: CMMDocument[]             // component maintenance manual library
  avionics: AvionicsService[]     // flexible avionics & connectivity services
  notes: string
  hobbsDifferential: number | null  // Hobbs meter offset: A/F TT = Hobbs + hobbsDifferential
}

// ─── Directory (flat base records) ───────────────────────────────────────────
export interface ModelFamily {
  family: string
  aircraft: AircraftBase[]
}

export interface ManufacturerGroup {
  manufacturer: string
  families: ModelFamily[]
}

export const FLEET: ManufacturerGroup[] = [
  {
    manufacturer: "Pilatus Aircraft",
    families: [
      {
        family: "PC-12/45 — Legacy",
        aircraft: [
          { tailNumber: "N499CB", year: 1999, model: "Pilatus PC-12/45 (Legacy)", serialNumber: "270" },
          { tailNumber: "N515RP", year: 2000, model: "Pilatus PC-12/45 (Legacy)", serialNumber: "330" },
          { tailNumber: "N870CB", year: 2005, model: "Pilatus PC-12/45 (Legacy)", serialNumber: "657" },
        ],
      },
      {
        family: "PC-12/47 — Legacy",
        aircraft: [
          { tailNumber: "N739S",  year: 2007, model: "Pilatus PC-12/47 (Legacy)", serialNumber: "844" },
          { tailNumber: "N863CB", year: 2007, model: "Pilatus PC-12/47 (Legacy)", serialNumber: "862" },
        ],
      },
      {
        family: "PC-12/47E — NG",
        aircraft: [
          { tailNumber: "N963CB", year: 2008, model: "Pilatus PC-12/47E NG", serialNumber: "1072" },
          { tailNumber: "N413UU", year: 2009, model: "Pilatus PC-12/47E NG", serialNumber: "1100" },
          { tailNumber: "N477KR", year: 2018, model: "Pilatus PC-12/47E NG", serialNumber: "1778" },
          { tailNumber: "N418T",  year: 2019, model: "Pilatus PC-12/47E NG", serialNumber: "1891" },
        ],
      },
      {
        family: "PC-12/47E — NGX",
        aircraft: [
          { tailNumber: "N511DR", year: 2024, model: "Pilatus PC-12/47E NGX", serialNumber: "2360" },
        ],
      },
    ],
  },
  {
    manufacturer: "Cessna / Textron Aviation",
    families: [
      {
        family: "Citation CJ2 (525A)",
        aircraft: [
          { tailNumber: "N868CB", year: 2002, model: "Cessna Citation CJ2 (525A)", serialNumber: "525A-0083" },
          { tailNumber: "N871CB", year: 2003, model: "Cessna Citation CJ2 (525A)", serialNumber: "525A-0149" },
          { tailNumber: "N744CB", year: 2004, model: "Cessna Citation CJ2 (525A)", serialNumber: "525A-0225" },
        ],
      },
      {
        family: "Citation 560XL",
        aircraft: [
          { tailNumber: "N766CB", year: 2003, model: "Cessna Citation 560XL", serialNumber: "560-5341" },
          { tailNumber: "N606CB", year: 2003, model: "Cessna Citation 560XL", serialNumber: "560-5333" },
        ],
      },
      {
        family: "Citation XLS+",
        aircraft: [
          { tailNumber: "N6TM", year: 2010, model: "Cessna Citation 560 XLS+", serialNumber: "560-6071" },
        ],
      },
      {
        family: "Citation M2 Gen2",
        aircraft: [
          { tailNumber: "N785PD", year: 2026, model: "Cessna Citation M2 Gen2", serialNumber: "525-1169" },
        ],
      },
    ],
  },
  {
    manufacturer: "Gulfstream Aerospace",
    families: [
      {
        family: "G200",
        aircraft: [
          { tailNumber: "N860CB", year: 2003, model: "Gulfstream G200", serialNumber: "85" },
          { tailNumber: "N861CB", year: 2004, model: "Gulfstream G200", serialNumber: "97" },
          { tailNumber: "N612FA", year: 2009, model: "Gulfstream G200", serialNumber: "213" },
        ],
      },
      {
        family: "G450",
        aircraft: [
          { tailNumber: "N663CB", year: 2006, model: "Gulfstream G450", serialNumber: "4058" },
          { tailNumber: "N787JS", year: 2010, model: "Gulfstream G450", serialNumber: "4189" },
        ],
      },
      {
        family: "GV",
        aircraft: [
          { tailNumber: "N563CB", year: 1997, model: "Gulfstream GV", serialNumber: "511" },
        ],
      },
    ],
  },
  {
    manufacturer: "Embraer",
    families: [
      {
        family: "Phenom 100 (EMB-500)",
        aircraft: [
          { tailNumber: "N450JF", year: 2010, model: "Embraer Phenom 100 (EMB-500)", serialNumber: "50000184" },
        ],
      },
      {
        family: "Phenom 300E (EMB-505)",
        aircraft: [
          { tailNumber: "N409KG", year: 2022, model: "Embraer Phenom 300E (EMB-505)", serialNumber: "8816" },
        ],
      },
      {
        family: "Legacy 650 (EMB-135BJ)",
        aircraft: [
          { tailNumber: "N650JF", year: 2015, model: "Embraer Legacy 650 (EMB-135BJ)", serialNumber: "14501215" },
        ],
      },
    ],
  },
]

export const TOTAL_AIRCRAFT = FLEET.reduce(
  (sum, m) => sum + m.families.reduce((s, f) => s + f.aircraft.length, 0),
  0
)

// All 13 fleet family names — used by the group CMM picker checkboxes
export const FLEET_FAMILY_NAMES: string[] = FLEET.flatMap(m => m.families.map(f => f.family))

// Look up which fleet family a tail number belongs to
export function getAircraftFamily(tailNumber: string): string | null {
  for (const mfr of FLEET) {
    for (const fam of mfr.families) {
      if (fam.aircraft.some(ac => ac.tailNumber === tailNumber)) return fam.family
    }
  }
  return null
}

// ─── Detail Template Builders ─────────────────────────────────────────────────
// Call makeDetail() to get a blank-but-structured record, then override fields
// for aircraft with known data. This keeps the file readable.
//
// Powerplant field label conventions (numbered per unit):
//   "Engine N Manufacturer"   e.g. "Pratt & Whitney Canada"
//   "Engine N Model"          e.g. "PT6A-67P"
//   "Engine N S/N"            e.g. "PCE-RY0739"
//   "Engine N Descriptor"     e.g. "Fin-off Conversion" (optional note)
//   "Propeller N Manufacturer" / "Propeller N Blades" / "Propeller N Model" / "Propeller N S/N"
// APU is stored separately in apu: DataField[] | null:
//   "APU N Manufacturer" / "APU N Model" / "APU N S/N"

interface MakeDetailParams {
  engineModel: string        // "Manufacturer ModelCode" e.g. "Pratt & Whitney Canada PT6A-67P"
  isTwin: boolean
  hasProp: boolean
  hasAPU: boolean
  avionicsSystems?: string[]  // kept for call-site compat; display migrated to avionics field
  documentation?: DataField[] // override default "—" documentation with populated values
}

// Split "Pratt & Whitney Canada PT6A-67P" → "Pratt & Whitney Canada"
function inferManufacturer(engineModel: string): string {
  const lc = engineModel.toLowerCase()
  if (lc.startsWith("pratt & whitney canada") || lc.startsWith("pratt and whitney canada")) return "Pratt & Whitney Canada"
  if (lc.startsWith("pratt & whitney") || lc.startsWith("pratt and whitney"))               return "Pratt & Whitney"
  if (lc.startsWith("williams international"))  return "Williams International"
  if (lc.startsWith("rolls-royce"))             return "Rolls-Royce"
  if (lc.startsWith("general electric"))        return "General Electric"
  if (lc.startsWith("honeywell"))               return "Honeywell"
  if (lc.startsWith("cfm international"))       return "CFM International"
  if (lc.startsWith("safran"))                  return "Safran"
  return "—"
}

// Strip manufacturer prefix from combined string → just the model code
function inferModelCode(engineModel: string): string {
  return engineModel
    .replace(/^Pratt (?:&|and) Whitney Canada\s*/i, "")
    .replace(/^Pratt (?:&|and) Whitney\s*/i, "")
    .replace(/^Williams International\s*/i, "")
    .replace(/^Rolls-Royce\s*/i, "")
    .replace(/^General Electric\s*/i, "")
    .replace(/^Honeywell\s*/i, "")
    .replace(/^CFM International\s*/i, "")
    .replace(/^Safran\s*/i, "")
    .trim() || engineModel
}

function makeDetail({
  engineModel,
  isTwin,
  hasProp,
  hasAPU,
  documentation: docOverride,
}: MakeDetailParams): AircraftDetailData {

  const mfr = inferManufacturer(engineModel)
  const mdl = inferModelCode(engineModel)

  const powerplant: DataField[] = [
    { label: "Engine 1 Manufacturer", value: mfr },
    { label: "Engine 1 Model",        value: mdl },
    { label: "Engine 1 S/N",          value: "—" },
    { label: "Engine 1 Descriptor",   value: "—" },
    ...(isTwin ? [
      { label: "Engine 2 Manufacturer", value: mfr },
      { label: "Engine 2 Model",        value: mdl },
      { label: "Engine 2 S/N",          value: "—" },
    ] : []),
    ...(hasProp ? [
      { label: "Propeller 1 Manufacturer", value: "—" },
      { label: "Propeller 1 Blades",       value: "—" },
      { label: "Propeller 1 Model",        value: "—" },
      { label: "Propeller 1 S/N",          value: "—" },
      { label: "Propeller 1 Descriptor",   value: "—" },
    ] : []),
  ]

  const apu: DataField[] | null = hasAPU
    ? [
        { label: "APU 1 Manufacturer", value: "—" },
        { label: "APU 1 Model",        value: "—" },
        { label: "APU 1 S/N",          value: "—" },
      ]
    : null

  const programs: DataField[] = [
    // Engine
    { label: "Engine Program",           value: "None", group: "Engine Program",   provider: "—", contractNumber: "—", expiry: "—" },
    // Engine Monitoring
    { label: "Engine Health Monitoring", value: "None", group: "Engine Monitoring", provider: "—", contractNumber: "—" },
    // Airframe
    { label: "Airframe MSP",             value: "None", group: "Airframe",          provider: "—", contractNumber: "—", expiry: "—" },
    { label: "Parts Program",            value: "None", group: "Airframe",          provider: "—", contractNumber: "—" },
    { label: "Maintenance Tracking",     value: "—",    group: "Airframe" },
    // APU program
    ...(hasAPU
      ? [{ label: "APU Program", value: "None", group: "APU Program", provider: "—", contractNumber: "—", expiry: "—" }]
      : []
    ),
  ]

  const documentation: DataField[] = docOverride ?? [
    { label: "Digital AFM",         value: "None" },
    { label: "Airframe Manuals",    value: "—" },
    { label: "Engine Manuals",      value: "—" },
    ...(hasProp ? [{ label: "Propeller Manuals", value: "—" }] : []),
    ...(hasAPU  ? [{ label: "APU Manuals",        value: "—" }] : []),
  ]

  return {
    identity: [
      { label: "Operating Certificate", value: "—" },
      { label: "Operating Company",     value: "—" },
      { label: "Previous Tail Number",  value: "None" },
      { label: "Primary Hangar",        value: "—" },
      { label: "Aircraft Variant",      value: "—" },
      { label: "Aircraft Note",         value: "—", note: "Short one-liner shown in hero bar, e.g. RVSM certified · WiFi installed 2024" },
      { label: "Ignition Key",          value: "—", note: "Standard fleet key, type-specific, or unique — include code if unique" },
      { label: "Ignition Key Location", value: "—" },
      { label: "Fuel Cap Key",          value: "—", note: "Same as ignition, unique code, or N/A if no lockable caps" },
      { label: "Fuel Cap Key Location", value: "—" },
    ],
    powerplant,
    apu,
    programs,
    navSubscriptions: [],
    documentation,
    cmms: [],
    avionics: [],
    notes: "",
    hobbsDifferential: null,
  }
}

// ─── Aircraft Detail Records ──────────────────────────────────────────────────

export const AIRCRAFT_DETAILS: Record<string, AircraftDetailData> = {

  // ── Pilatus PC-12/45 Legacy ──────────────────────────────────────────────────
  "N499CB": {
    identity: [
      { label: "Operating Certificate", value: "—",   note: "Part 91 / Part 135 / Both" },
      { label: "Operating Company",     value: "—" },
      { label: "Previous Tail Number",  value: "None" },
      { label: "Primary Hangar",        value: "—" },
      { label: "Aircraft Variant",      value: "Fin-off Conversion" },
      { label: "Aircraft Note",         value: "—" },
      { label: "Ignition Key",          value: "—",   note: "Standard Pilatus fleet key, unique code, etc." },
      { label: "Ignition Key Location", value: "—" },
      { label: "Fuel Cap Key",          value: "—",   note: "Same as ignition, unique code, or N/A" },
      { label: "Fuel Cap Key Location", value: "—" },
    ],
    powerplant: [
      { label: "Engine 1 Manufacturer", value: "Pratt & Whitney Canada" },
      { label: "Engine 1 Model",        value: "PT6A-67P" },
      { label: "Engine 1 S/N",          value: "PCE-RY0739" },
      { label: "Engine 1 Descriptor",   value: "Fin-off STC conversion" },
      { label: "Propeller 1 Manufacturer", value: "MT Propeller" },
      { label: "Propeller 1 Blades",       value: "5" },
      { label: "Propeller 1 Model",        value: "MTV-27-1-N-C-F-R(P)" },
      { label: "Propeller 1 S/N",          value: "150628" },
      { label: "Propeller 1 Descriptor",   value: "5-blade composite (MT Propeller, Germany) — Finnoff STC" },
    ],
    apu: null,
    programs: [
      { label: "Engine Program",           value: "None", group: "Engine Program",    provider: "—", contractNumber: "—", expiry: "—" },
      { label: "Engine Health Monitoring", value: "None", group: "Engine Monitoring",  provider: "—", contractNumber: "—" },
      { label: "Airframe MSP",             value: "None", group: "Airframe",           provider: "—", contractNumber: "—", expiry: "—" },
      { label: "Parts Program",            value: "None", group: "Airframe",           provider: "—", contractNumber: "—" },
      { label: "Maintenance Tracking",     value: "—",    group: "Airframe" },
    ],
    navSubscriptions: [
      {
        serviceName: "—",
        account: "—",
        loginUrl: "",
        username: "—",
        password: "—",
        twoFactor: false,
        twoFactorInstructions: "",
        cycleDays: 28,
        cycleNote: "",
      },
    ],
    documentation: [
      { label: "Digital AFM",                                    value: "None" },
      { label: "Pilatus PC-12/45 & PC-12/47 Maintenance Manual", value: "—", note: "PIL-02049 · Rev 50 · Jan 2026" },
      { label: "P&WC PT6A Maintenance Manual",                   value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
      { label: "MT Propeller Service Bulletin 1",                 value: "—", note: "MT-SB1 · Rev 11 · Oct 2025" },
      { label: "MT Propeller Overhaul Manual E-1083",             value: "—", note: "MT-E1083 · Rev 39 · May 2024" },
    ],
    cmms: [],
    avionics: [],
    notes: "",
  },
  "N515RP": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6A-67B", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                                    value: "None" },
    { label: "Pilatus PC-12/45 & PC-12/47 Maintenance Manual", value: "—", note: "PIL-02049 · Rev 50 · Jan 2026" },
    { label: "P&WC PT6A Maintenance Manual",                   value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
    { label: "Hartzell Propeller Maintenance Manual 147",       value: "—", note: "HC-MAN147 · Rev 23 · Sep 2025" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6A-67B" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "Hartzell" },
    { label: "Propeller 1 Blades",       value: "4" },
    { label: "Propeller 1 Model",        value: "HC-E4A-3D" },
    { label: "Propeller 1 S/N",          value: "—" },
    { label: "Propeller 1 Descriptor",   value: "4-blade aluminum Hartzell" },
  ]},
  "N870CB": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6A-67B", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                                    value: "None" },
    { label: "Pilatus PC-12/45 & PC-12/47 Maintenance Manual", value: "—", note: "PIL-02049 · Rev 50 · Jan 2026" },
    { label: "P&WC PT6A Maintenance Manual",                   value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
    { label: "Hartzell Propeller Maintenance Manual 147",       value: "—", note: "HC-MAN147 · Rev 23 · Sep 2025" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6A-67B" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "Hartzell" },
    { label: "Propeller 1 Blades",       value: "4" },
    { label: "Propeller 1 Model",        value: "HC-E4A-3D" },
    { label: "Propeller 1 S/N",          value: "—" },
    { label: "Propeller 1 Descriptor",   value: "4-blade aluminum Hartzell" },
  ]},

  // ── Pilatus PC-12/47 Legacy ──────────────────────────────────────────────────
  "N739S":  { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6A-67B", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                                    value: "None" },
    { label: "Pilatus PC-12/45 & PC-12/47 Maintenance Manual", value: "—", note: "PIL-02049 · Rev 50 · Jan 2026" },
    { label: "P&WC PT6A Maintenance Manual",                   value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
    { label: "Hartzell Propeller Maintenance Manual 147",       value: "—", note: "HC-MAN147 · Rev 23 · Sep 2025" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6A-67B" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "Hartzell" },
    { label: "Propeller 1 Blades",       value: "5" },
    { label: "Propeller 1 Model",        value: "HC-E5A-3A" },
    { label: "Propeller 1 S/N",          value: "—" },
    { label: "Propeller 1 Descriptor",   value: "5-blade composite Hartzell" },
  ]},
  "N863CB": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6A-67B", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                                    value: "None" },
    { label: "Pilatus PC-12/45 & PC-12/47 Maintenance Manual", value: "—", note: "PIL-02049 · Rev 50 · Jan 2026" },
    { label: "P&WC PT6A Maintenance Manual",                   value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
    { label: "Hartzell Propeller Maintenance Manual 147",       value: "—", note: "HC-MAN147 · Rev 23 · Sep 2025" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6A-67B" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "Hartzell" },
    { label: "Propeller 1 Blades",       value: "4" },
    { label: "Propeller 1 Model",        value: "HC-E4A-3D" },
    { label: "Propeller 1 S/N",          value: "—" },
    { label: "Propeller 1 Descriptor",   value: "4-blade aluminum Hartzell" },
  ]},

  // ── Pilatus PC-12/47E NG ─────────────────────────────────────────────────────
  "N963CB": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6A-67P", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                          value: "None" },
    { label: "Pilatus PC-12/47E Maintenance Manual", value: "—", note: "PIL-02300 · Rev 35 · Jan 2025" },
    { label: "P&WC PT6A Maintenance Manual",         value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
    { label: "MT Propeller Service Bulletin 1",       value: "—", note: "MT-SB1 · Rev 11 · Oct 2025" },
    { label: "MT Propeller Overhaul Manual E-1083",   value: "—", note: "MT-E1083 · Rev 39 · May 2024" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6A-67P" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "MT Propeller" },
    { label: "Propeller 1 Blades",       value: "7" },
    { label: "Propeller 1 Model",        value: "MTV-47-1-N-C-F-R(P)-V" },
    { label: "Propeller 1 S/N",          value: "231721" },
    { label: "Propeller 1 Descriptor",   value: "\"Silent Seven\" — 7-blade composite (MT Propeller, Germany)" },
  ]},
  "N413UU": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6A-67P", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                          value: "None" },
    { label: "Pilatus PC-12/47E Maintenance Manual", value: "—", note: "PIL-02300 · Rev 35 · Jan 2025" },
    { label: "P&WC PT6A Maintenance Manual",         value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
    { label: "Hartzell Propeller Maintenance Manual 147", value: "—", note: "HC-MAN147 · Rev 23 · Sep 2025" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6A-67P" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "Hartzell" },
    { label: "Propeller 1 Blades",       value: "4" },
    { label: "Propeller 1 Model",        value: "HC-E4A-3D" },
    { label: "Propeller 1 S/N",          value: "—" },
    { label: "Propeller 1 Descriptor",   value: "4-blade aluminum Hartzell" },
  ]},
  "N477KR": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6A-67P", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                          value: "None" },
    { label: "Pilatus PC-12/47E Maintenance Manual", value: "—", note: "PIL-02300 · Rev 35 · Jan 2025" },
    { label: "P&WC PT6A Maintenance Manual",         value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
    { label: "Hartzell Propeller Maintenance Manual 147", value: "—", note: "HC-MAN147 · Rev 23 · Sep 2025" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6A-67P" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "Hartzell" },
    { label: "Propeller 1 Blades",       value: "5" },
    { label: "Propeller 1 Model",        value: "HC-E5A-3A" },
    { label: "Propeller 1 S/N",          value: "—" },
    { label: "Propeller 1 Descriptor",   value: "5-blade composite Hartzell" },
  ]},
  "N418T":  { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6A-67P", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                          value: "None" },
    { label: "Pilatus PC-12/47E Maintenance Manual", value: "—", note: "PIL-02300 · Rev 35 · Jan 2025" },
    { label: "P&WC PT6A Maintenance Manual",         value: "—", note: "PWC-3038336 · Rev 62 · Oct 2025" },
    { label: "Hartzell Propeller Maintenance Manual 147", value: "—", note: "HC-MAN147 · Rev 23 · Sep 2025" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6A-67P" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "Hartzell" },
    { label: "Propeller 1 Blades",       value: "5" },
    { label: "Propeller 1 Model",        value: "HC-E5A-3A" },
    { label: "Propeller 1 S/N",          value: "—" },
    { label: "Propeller 1 Descriptor",   value: "5-blade composite Hartzell" },
  ]},

  // ── Pilatus PC-12/47E NGX ────────────────────────────────────────────────────
  "N511DR": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PT6E-67XP", isTwin: false, hasProp: true, hasAPU: false, documentation: [
    { label: "Digital AFM",                                       value: "None" },
    { label: "Pilatus PC-12/47E NGX Maintenance Manual",          value: "—", note: "PIL-02436 · Rev 13 · Jan 2025" },
    { label: "P&WC PT6E-67XP Engine Maintenance Manual",          value: "—", note: "PWC-PT6E-MM · Rev TBD" },
    { label: "Hartzell HC-E5A-31A Propeller Maintenance Manual",  value: "—", note: "HC-E5A-31A-MM · Rev TBD" },
  ]}), powerplant: [
    { label: "Engine 1 Manufacturer",    value: "Pratt & Whitney Canada" },
    { label: "Engine 1 Model",           value: "PT6E-67XP" },
    { label: "Engine 1 S/N",             value: "—" },
    { label: "Engine 1 Descriptor",      value: "—" },
    { label: "Propeller 1 Manufacturer", value: "Hartzell" },
    { label: "Propeller 1 Blades",       value: "5" },
    { label: "Propeller 1 Model",        value: "HC-E5A-31A" },
    { label: "Propeller 1 S/N",          value: "—" },
    { label: "Propeller 1 Descriptor",   value: "5-blade composite Hartzell (NGX)" },
  ]},

  // ── Cessna Citation CJ2 (525A) ───────────────────────────────────────────────
  "N868CB": makeDetail({ engineModel: "Williams International FJ44-2C", isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                       value: "None" },
    { label: "Cessna 525A Maintenance Manual",    value: "—", note: "525AMM-CH04 Rev 11 · 525AMM-CH05 Rev 21" },
    { label: "Williams FJ44-2C Engine Manual",    value: "—", note: "WI-64135 · Rev 69 · Sep 2025" },
  ]}),
  "N871CB": makeDetail({ engineModel: "Williams International FJ44-2C", isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                       value: "None" },
    { label: "Cessna 525A Maintenance Manual",    value: "—", note: "525AMM-CH04 Rev 11 · 525AMM-CH05 Rev 21" },
    { label: "Williams FJ44-2C Engine Manual",    value: "—", note: "WI-64135 · Rev 69 · Sep 2025" },
  ]}),
  "N744CB": makeDetail({ engineModel: "Williams International FJ44-2C", isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                       value: "None" },
    { label: "Cessna 525A Maintenance Manual",    value: "—", note: "525AMM-CH04 Rev 11 · 525AMM-CH05 Rev 21" },
    { label: "Williams FJ44-2C Engine Manual",    value: "—", note: "WI-64135 · Rev 69 · Sep 2025" },
  ]}),

  // ── Cessna Citation 560XL ─────────────────────────────────────────────────
  "N766CB": makeDetail({ engineModel: "Pratt & Whitney Canada PW545A",  isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                       value: "None" },
    { label: "Cessna 560XL Maintenance Manual",   value: "—", note: "56XMM-CH04 Rev 17 · 56XMM-CH05 Rev 50" },
    { label: "P&WC PW545A Engine Manual",         value: "—", note: "PWC-30J1272 · Rev 64 · Oct 2025" },
  ]}),
  "N606CB": makeDetail({ engineModel: "Pratt & Whitney Canada PW545A",  isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                       value: "None" },
    { label: "Cessna 560XL Maintenance Manual",   value: "—", note: "56XMM-CH04 Rev 17 · 56XMM-CH05 Rev 50" },
    { label: "P&WC PW545A Engine Manual",         value: "—", note: "PWC-30J1272 · Rev 64 · Oct 2025" },
  ]}),

  // ── Cessna Citation XLS+ ────────────────────────────────────────────────────
  "N6TM":   makeDetail({ engineModel: "Pratt & Whitney Canada PW545C",  isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                       value: "None" },
    { label: "Cessna 560XL Maintenance Manual",   value: "—", note: "56XMM-CH04 Rev 17 · 56XMM-CH05 Rev 50" },
    { label: "P&WC PW545C Engine Manual",         value: "—", note: "PWC-30J2302 (AWL) Rev 37 · PWC-30J2602 (Sched) Rev 37" },
  ]}),

  // ── Cessna Citation M2 Gen2 ──────────────────────────────────────────────────
  "N785PD": makeDetail({ engineModel: "Williams International FJ44-4A", isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                             value: "None" },
    { label: "Cessna Citation M2 Maintenance Manual",   value: "—", note: "525MM-M2 · Rev 10 · Sep 2025" },
    { label: "Williams FJ44-4A Engine Manual",          value: "—", note: "WI-FJ44-4A-MM · Rev TBD" },
  ]}),

  // ── Gulfstream G200 ──────────────────────────────────────────────────────────
  "N860CB": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PW306A", isTwin: true, hasProp: false, hasAPU: true, documentation: [
    { label: "Digital AFM",                    value: "None" },
    { label: "IAI G200 Maintenance Manual",    value: "—", note: "IAI-G200-1001-06 · Rev 39 · Aug 2025" },
    { label: "P&WC PW306A Engine Manual",      value: "—", note: "PWC-30B1412 · Rev 63 · Nov 2025" },
  ]}), apu: [
    { label: "APU 1 Manufacturer", value: "Honeywell" },
    { label: "APU 1 Model",        value: "GTCP36-150[IAI]" },
    { label: "APU 1 S/N",          value: "—" },
  ]},
  "N861CB": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PW306A", isTwin: true, hasProp: false, hasAPU: true, documentation: [
    { label: "Digital AFM",                    value: "None" },
    { label: "IAI G200 Maintenance Manual",    value: "—", note: "IAI-G200-1001-06 · Rev 39 · Aug 2025" },
    { label: "P&WC PW306A Engine Manual",      value: "—", note: "PWC-30B1412 · Rev 63 · Nov 2025" },
  ]}), apu: [
    { label: "APU 1 Manufacturer", value: "Honeywell" },
    { label: "APU 1 Model",        value: "GTCP36-150[IAI]" },
    { label: "APU 1 S/N",          value: "—" },
  ]},
  "N612FA": { ...makeDetail({ engineModel: "Pratt & Whitney Canada PW306A", isTwin: true, hasProp: false, hasAPU: true, documentation: [
    { label: "Digital AFM",                    value: "None" },
    { label: "IAI G200 Maintenance Manual",    value: "—", note: "IAI-G200-1001-06 · Rev 39 · Aug 2025" },
    { label: "P&WC PW306A Engine Manual",      value: "—", note: "PWC-30B1412 · Rev 63 · Nov 2025" },
  ]}), apu: [
    { label: "APU 1 Manufacturer", value: "Honeywell" },
    { label: "APU 1 Model",        value: "GTCP36-150[IAI]" },
    { label: "APU 1 S/N",          value: "—" },
  ]},

  // ── Gulfstream G450 ──────────────────────────────────────────────────────────
  "N663CB": { ...makeDetail({ engineModel: "Rolls-Royce Tay 611-8C", isTwin: true, hasProp: false, hasAPU: true, documentation: [
    { label: "Digital AFM",                               value: "None" },
    { label: "Gulfstream G450 AMM",                       value: "—", note: "GAC-G450-AMM · Rev 34 · Apr 2025" },
    { label: "Rolls-Royce Tay 611-8C Engine Manual",      value: "—", note: "RR-T-TAY-6RR · Rev 34 · Apr 2025" },
  ]}), apu: [
    { label: "APU 1 Manufacturer", value: "Honeywell" },
    { label: "APU 1 Model",        value: "GTCP36-150(GIV)" },
    { label: "APU 1 S/N",          value: "—" },
  ]},
  "N787JS": { ...makeDetail({ engineModel: "Rolls-Royce Tay 611-8C", isTwin: true, hasProp: false, hasAPU: true, documentation: [
    { label: "Digital AFM",                               value: "None" },
    { label: "Gulfstream G450 AMM",                       value: "—", note: "GAC-G450-AMM · Rev 34 · Apr 2025" },
    { label: "Rolls-Royce Tay 611-8C Engine Manual",      value: "—", note: "RR-T-TAY-6RR · Rev 34 · Apr 2025" },
  ]}), apu: [
    { label: "APU 1 Manufacturer", value: "Honeywell" },
    { label: "APU 1 Model",        value: "GTCP36-150(GIV)" },
    { label: "APU 1 S/N",          value: "—" },
  ]},

  // ── Gulfstream GV ────────────────────────────────────────────────────────────
  "N563CB": { ...makeDetail({ engineModel: "Rolls-Royce BR710C4-11", isTwin: true, hasProp: false, hasAPU: true, documentation: [
    { label: "Digital AFM",                               value: "None" },
    { label: "Gulfstream GV AMM",                         value: "—", note: "GAC-GV-AMM · Rev 59 · Jan 2025" },
    { label: "Rolls-Royce BR710C4-11 Engine Manual",      value: "—", note: "RR-BR710-MM · Rev TBD" },
  ]}), apu: [
    { label: "APU 1 Manufacturer", value: "Honeywell" },
    { label: "APU 1 Model",        value: "GTCP36-150(GIV)" },
    { label: "APU 1 S/N",          value: "—" },
  ]},

  // ── Embraer Phenom 100 ───────────────────────────────────────────────────────
  "N450JF": makeDetail({ engineModel: "Pratt & Whitney Canada PW617F-E", isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                            value: "None" },
    { label: "Embraer Phenom 100 (EMB-500) AMM",      value: "—", note: "EMB-500-AMM · Rev TBD" },
    { label: "P&WC PW617F-E Engine Manual",            value: "—", note: "PWC-PW617F-MM · Rev TBD" },
  ]}),

  // ── Embraer Phenom 300E ──────────────────────────────────────────────────────
  "N409KG": makeDetail({ engineModel: "Pratt & Whitney Canada PW535E1", isTwin: true, hasProp: false, hasAPU: false, documentation: [
    { label: "Digital AFM",                        value: "None" },
    { label: "Embraer EMB-505 AMM 2757",           value: "—", note: "Pt III Rev 8 · Pt IV Rev 2 · Engine Rev 32" },
    { label: "P&WC PW535E1 Engine Manual",         value: "—", note: "Integrated in EMB-505 AMM 2757 · EMB-AMM2757-ENG Rev 32" },
  ]}),

  // ── Embraer Legacy 650 ───────────────────────────────────────────────────────
  "N650JF": { ...makeDetail({ engineModel: "Rolls-Royce AE3007A1E", isTwin: true, hasProp: false, hasAPU: true, documentation: [
    { label: "Digital AFM",                               value: "None" },
    { label: "Embraer Legacy 650 (EMB-135BJ) AMM",       value: "—", note: "EMB-135BJ-AMM · Rev TBD" },
    { label: "Rolls-Royce AE3007A1E Engine Manual",       value: "—", note: "RR-AE3007-MM · Rev TBD" },
  ]}), apu: [
    { label: "APU 1 Manufacturer", value: "Honeywell" },
    { label: "APU 1 Model",        value: "—" },
    { label: "APU 1 S/N",          value: "—" },
  ]},
}
