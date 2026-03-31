// ============================================================================
// Vendor Map Constants, Types, and Icon Configuration
// ============================================================================

export const GOLD = "#d4a017"

// ── Legacy vendor types (map classification) ────────────────────────────────

export type VendorType =
  | "preferred" | "general" | "avionics" | "engine"
  | "sheet_metal" | "interior" | "paint"

export type Vendor = {
  id: string; name: string; airport_code: string | null
  city: string | null; state: string | null; country: string
  lat: number | null; lng: number | null
  phone: string | null; email: string | null; website: string | null
  specialties: string[] | null; notes: string | null
  preferred: boolean; vendor_type: VendorType; active: boolean; is_mrt: boolean
}

export type VendorContact = {
  id: string; vendor_id: string; name: string; title: string | null
  role: string | null; phone: string | null; mobile: string | null
  email: string | null; is_primary: boolean
}

export type PoiCard = {
  name: string; address: string; phone: string; website: string
  lat: number; lng: number; city: string; state: string
}

export type MapBounds = { north: number; south: number; east: number; west: number }

export const CONTACT_ROLES = ["Sales", "Project Manager", "QC Lead", "General Manager", "Owner", "Other"]

// ── Type configuration ──────────────────────────────────────────────────────

export const TYPE_CONFIG: Record<VendorType, {
  label: string; color: string; sym: string; desc: string
}> = {
  preferred:   { label: "Preferred",    color: "#d4a017", sym: "★",   desc: "Pre-approved preferred vendor"      },
  general:     { label: "General MRO",  color: "#475569", sym: "MX",  desc: "Full-service repair station"        },
  avionics:    { label: "Avionics",     color: "#6d28d9", sym: "AV",  desc: "Avionics specialist"                },
  engine:      { label: "Engine",       color: "#b91c1c", sym: "ENG", desc: "Engine repair / overhaul"           },
  sheet_metal: { label: "Sheet Metal",  color: "#0e7490", sym: "SM",  desc: "Airframe / structural repair"       },
  interior:    { label: "Interior",     color: "#92400e", sym: "INT", desc: "Cabin / seating / interior refurb"  },
  paint:       { label: "Paint",        color: "#c2410c", sym: "PNT", desc: "Aircraft paint & refinishing"       },
}

export const TYPE_ORDER = Object.keys(TYPE_CONFIG) as VendorType[]

// ── SVG icon generation ─────────────────────────────────────────────────────

function makeIconUrl(type: VendorType): string {
  const { color } = TYPE_CONFIG[type]
  const c = color
  const w = "white"

  const svgs: Record<VendorType, string> = {
    preferred: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <polygon points="16,1 19.8,11.4 31,12 22.6,19.6 25.4,30.5 16,24.5 6.6,30.5 9.4,19.6 1,12 12.2,11.4"
        fill="${c}" stroke="rgba(0,0,0,0.25)" stroke-width="1" stroke-linejoin="round"/>
      <polygon points="16,6 18.4,13 25.5,13.4 20,18 21.8,25 16,21.2 10.2,25 12,18 6.5,13.4 13.6,13"
        fill="white" opacity="0.18"/>
      <circle cx="16" cy="16" r="3" fill="white" opacity="0.35"/>
    </svg>`,

    general: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>`,

    avionics: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <rect x="2" y="4" width="26" height="22" rx="2" fill="${c}" stroke="black" stroke-opacity="0.25" stroke-width="1"/>
      <circle cx="5"  cy="7"  r="1.3" fill="${w}" opacity="0.5"/>
      <circle cx="25" cy="7"  r="1.3" fill="${w}" opacity="0.5"/>
      <circle cx="5"  cy="23" r="1.3" fill="${w}" opacity="0.5"/>
      <circle cx="25" cy="23" r="1.3" fill="${w}" opacity="0.5"/>
      <rect x="9" y="10" width="12" height="10" rx="1.5" fill="${w}" opacity="0.18"/>
      <rect x="10" y="11" width="10" height="8" rx="1" fill="black" opacity="0.35"/>
      <line x1="11" y1="11" x2="11" y2="9"  stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="13" y1="11" x2="13" y2="9"  stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="15" y1="11" x2="15" y2="9"  stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="17" y1="11" x2="17" y2="9"  stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="19" y1="11" x2="19" y2="9"  stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="11" y1="19" x2="11" y2="21" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="13" y1="19" x2="13" y2="21" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="15" y1="19" x2="15" y2="21" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="17" y1="19" x2="17" y2="21" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="19" y1="19" x2="19" y2="21" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="10" y1="13" x2="8"  y2="13" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="10" y1="15" x2="8"  y2="15" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="10" y1="17" x2="8"  y2="17" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="20" y1="13" x2="22" y2="13" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="20" y1="15" x2="22" y2="15" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <line x1="20" y1="17" x2="22" y2="17" stroke="${w}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>
      <circle cx="15" cy="15" r="2" fill="${w}" opacity="0.55"/>
    </svg>`,

    engine: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <circle cx="15" cy="15" r="13.5" fill="${c}" stroke="black" stroke-opacity="0.2" stroke-width="1"/>
      <path d="M12.5,11 C10,7 9,4 10.5,3.5 L14,3.5 C15.5,5 16.5,8 17.5,11Z" fill="${w}" opacity="0.85" transform="rotate(0 15 15)"/>
      <path d="M12.5,11 C10,7 9,4 10.5,3.5 L14,3.5 C15.5,5 16.5,8 17.5,11Z" fill="${w}" opacity="0.85" transform="rotate(60 15 15)"/>
      <path d="M12.5,11 C10,7 9,4 10.5,3.5 L14,3.5 C15.5,5 16.5,8 17.5,11Z" fill="${w}" opacity="0.85" transform="rotate(120 15 15)"/>
      <path d="M12.5,11 C10,7 9,4 10.5,3.5 L14,3.5 C15.5,5 16.5,8 17.5,11Z" fill="${w}" opacity="0.85" transform="rotate(180 15 15)"/>
      <path d="M12.5,11 C10,7 9,4 10.5,3.5 L14,3.5 C15.5,5 16.5,8 17.5,11Z" fill="${w}" opacity="0.85" transform="rotate(240 15 15)"/>
      <path d="M12.5,11 C10,7 9,4 10.5,3.5 L14,3.5 C15.5,5 16.5,8 17.5,11Z" fill="${w}" opacity="0.85" transform="rotate(300 15 15)"/>
      <circle cx="15" cy="15" r="4.5" fill="${c}"/>
      <circle cx="15" cy="15" r="2.8" fill="${w}" opacity="0.95"/>
      <circle cx="15" cy="15" r="1.3" fill="${c}"/>
    </svg>`,

    sheet_metal: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <rect x="3" y="5" width="19" height="9" rx="3"
        fill="${c}" stroke="black" stroke-opacity="0.25" stroke-width="1"/>
      <path d="M3,5 L3,14 L1,12 L1,7Z" fill="${c}"/>
      <path d="M17,13.5 L23,27 L20,28 L14,14.5Z"
        fill="${c}" stroke="black" stroke-opacity="0.2" stroke-width="0.8"/>
      <rect x="5" y="7" width="13" height="3" rx="1.5" fill="${w}" opacity="0.25"/>
    </svg>`,

    interior: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <rect x="5" y="1" width="7" height="5" rx="2.5" fill="${c}"/>
      <path d="M6,4 L10,4 L13,21 L9,21Z" fill="${c}"/>
      <path d="M8,20 Q21,19 23,22 L23,25 Q10,25 8,24Z" fill="${c}"/>
      <path d="M13,17 L22,16 L22,19 L13,19Z" fill="${c}" rx="1"/>
      <rect x="11" y="25" width="3" height="4" rx="1.5" fill="${c}"/>
      <rect x="18" y="25" width="3" height="4" rx="1.5" fill="${c}"/>
      <line x1="9" y1="7" x2="12" y2="19" stroke="${w}" stroke-width="1.2" opacity="0.3"/>
    </svg>`,

    paint: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <rect x="7" y="14" width="12" height="14" rx="4"
        fill="${c}" stroke="black" stroke-opacity="0.25" stroke-width="1"/>
      <path d="M7,18 Q7,14 13,14 Q19,14 19,18" fill="${c}"/>
      <rect x="9" y="9" width="9" height="6" rx="2"
        fill="${c}" stroke="black" stroke-opacity="0.2" stroke-width="1"/>
      <rect x="15" y="6" width="3.5" height="4" rx="1" fill="${c}"/>
      <circle cx="22" cy="4" r="2.2" fill="${c}" opacity="0.8"/>
      <circle cx="26" cy="7" r="1.6" fill="${c}" opacity="0.6"/>
      <circle cx="25" cy="2" r="1.4" fill="${c}" opacity="0.65"/>
      <circle cx="28" cy="4" r="1" fill="${c}" opacity="0.4"/>
      <circle cx="20" cy="2" r="1.2" fill="${c}" opacity="0.5"/>
      <rect x="9" y="16" width="4" height="10" rx="2" fill="${w}" opacity="0.15"/>
    </svg>`,
  }

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgs[type])}`
}

const ICON_DIMS: Record<VendorType, { w: number; h: number; ax: number; ay: number }> = {
  preferred:   { w: 32, h: 32, ax: 16, ay: 16 },
  general:     { w: 30, h: 30, ax: 15, ay: 15 },
  avionics:    { w: 30, h: 30, ax: 15, ay: 15 },
  engine:      { w: 30, h: 30, ax: 15, ay: 15 },
  sheet_metal: { w: 30, h: 30, ax: 15, ay: 15 },
  interior:    { w: 30, h: 30, ax: 15, ay: 15 },
  paint:       { w: 30, h: 30, ax: 15, ay: 15 },
}

export const PIN_ICONS = Object.fromEntries(
  TYPE_ORDER.map(t => {
    const d = ICON_DIMS[t]
    return [t, { url: makeIconUrl(t), scaledSize: { width: d.w, height: d.h }, anchor: { x: d.ax, y: d.ay } }]
  })
) as Record<VendorType, { url: string; scaledSize: { width: number; height: number }; anchor: { x: number; y: number } }>

export const AIRPORT_DOT = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">' +
    '<g transform="rotate(-35 13 13)">' +
    '<rect x="9.5" y="1" width="7" height="24" rx="1.5" fill="#4a6f8a" stroke="rgba(255,255,255,0.35)" stroke-width="0.75"/>' +
    '<rect x="10.5" y="2.5"  width="5" height="1.5" fill="white" opacity="0.85"/>' +
    '<rect x="10.5" y="22"   width="5" height="1.5" fill="white" opacity="0.85"/>' +
    '<line x1="13" y1="6"    x2="13" y2="9"    stroke="white" stroke-width="1.1" stroke-opacity="0.7"/>' +
    '<line x1="13" y1="11.5" x2="13" y2="14.5" stroke="white" stroke-width="1.1" stroke-opacity="0.7"/>' +
    '<line x1="13" y1="17"   x2="13" y2="20"   stroke="white" stroke-width="1.1" stroke-opacity="0.7"/>' +
    '</g>' +
    '</svg>'
  )}`,
  scaledSize: { width: 26, height: 26 },
  anchor: { x: 13, y: 13 },
}
