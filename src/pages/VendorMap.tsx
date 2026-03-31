import { useState, useEffect, useCallback, useRef } from "react"
import {
  APIProvider, Map, Marker, InfoWindow,
  useMap, useMapsLibrary,
} from "@vis.gl/react-google-maps"
import {
  Phone, Globe, Star, MapPin, Plus, X,
  CheckCircle, ChevronLeft, ExternalLink, Pencil, ChevronDown, ChevronUp, Truck, Maximize2, Minimize2,
  Search, Plane,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import UTAH_AIRPORTS from "@/data/utahAirports"

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string
const GOLD    = "#d4a017"

// ── 10 Vendor types ───────────────────────────────────────────────────────────
type VendorType =
  | "preferred" | "general" | "avionics" | "engine"
  | "sheet_metal" | "interior" | "paint"

const TYPE_CONFIG: Record<VendorType, {
  label: string; color: string; sym: string; desc: string
}> = {
  preferred:  { label: "Preferred",    color: "#d4a017", sym: "★",   desc: "Pre-approved preferred vendor"      },
  general:    { label: "General MRO",  color: "#475569", sym: "MX",  desc: "Full-service repair station"        },
  avionics:   { label: "Avionics",     color: "#6d28d9", sym: "AV",  desc: "Avionics specialist"                },
  engine:     { label: "Engine",       color: "#b91c1c", sym: "ENG", desc: "Engine repair / overhaul"           },
  sheet_metal: { label: "Sheet Metal", color: "#0e7490", sym: "SM",  desc: "Airframe / structural repair"       },
  interior:   { label: "Interior",     color: "#92400e", sym: "INT", desc: "Cabin / seating / interior refurb"  },
  paint:      { label: "Paint",        color: "#c2410c", sym: "PNT", desc: "Aircraft paint & refinishing"       },
}

const TYPE_ORDER = Object.keys(TYPE_CONFIG) as VendorType[]

// ── Representational shape icons ─────────────────────────────────────────────
function makeIconUrl(type: VendorType): string {
  const { color } = TYPE_CONFIG[type]
  const c = color
  const w = "white"

  const svgs: Record<VendorType, string> = {

    // ★ PREFERRED — dramatic 5-point star with inner shimmer
    preferred: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <polygon points="16,1 19.8,11.4 31,12 22.6,19.6 25.4,30.5 16,24.5 6.6,30.5 9.4,19.6 1,12 12.2,11.4"
        fill="${c}" stroke="rgba(0,0,0,0.25)" stroke-width="1" stroke-linejoin="round"/>
      <polygon points="16,6 18.4,13 25.5,13.4 20,18 21.8,25 16,21.2 10.2,25 12,18 6.5,13.4 13.6,13"
        fill="white" opacity="0.18"/>
      <circle cx="16" cy="16" r="3" fill="white" opacity="0.35"/>
    </svg>`,

    // 🔧 GENERAL MRO — Lucide Wrench icon path (exact, from lucide-react source)
    general: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>`,

    // 📡 AVIONICS — radar/signal waves pulsing from a point
    // 🖥 AVIONICS — PCB circuit board: rectangular board, IC chip with pins, trace lines, corner holes
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

    // ✈ ENGINE — turbofan disc front-on: filled disc, 6 wide swept blades from hub ring to outer, center spinner
    // Blades start at hub RING edge (not center) — avoids wagon-wheel look
    // Each blade: 5px wide at root, sweeps strongly left (leading edge), tapers to tip near outer ring
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

    // 🔨 SHEET METAL — hammer silhouette (head + angled handle)
    sheet_metal: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <rect x="3" y="5" width="19" height="9" rx="3"
        fill="${c}" stroke="black" stroke-opacity="0.25" stroke-width="1"/>
      <path d="M3,5 L3,14 L1,12 L1,7Z" fill="${c}"/>
      <path d="M17,13.5 L23,27 L20,28 L14,14.5Z"
        fill="${c}" stroke="black" stroke-opacity="0.2" stroke-width="0.8"/>
      <rect x="5" y="7" width="13" height="3" rx="1.5" fill="${w}" opacity="0.25"/>
    </svg>`,

    // 💺 INTERIOR — classic airline seat side-profile
    interior: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
      <rect x="5" y="1" width="7" height="5" rx="2.5" fill="${c}"/>
      <path d="M6,4 L10,4 L13,21 L9,21Z" fill="${c}"/>
      <path d="M8,20 Q21,19 23,22 L23,25 Q10,25 8,24Z" fill="${c}"/>
      <path d="M13,17 L22,16 L22,19 L13,19Z" fill="${c}" rx="1"/>
      <rect x="11" y="25" width="3" height="4" rx="1.5" fill="${c}"/>
      <rect x="18" y="25" width="3" height="4" rx="1.5" fill="${c}"/>
      <line x1="9" y1="7" x2="12" y2="19" stroke="${w}" stroke-width="1.2" opacity="0.3"/>
    </svg>`,

    // 🎨 PAINT — spray can with mist cloud
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

// Width/height/anchor per shape (anchor = visual center of the icon)
const ICON_DIMS: Record<VendorType, { w: number; h: number; ax: number; ay: number }> = {
  preferred:   { w: 32, h: 32, ax: 16, ay: 16 },
  general:     { w: 30, h: 30, ax: 15, ay: 15 },
  avionics:    { w: 30, h: 30, ax: 15, ay: 15 },
  engine:      { w: 30, h: 30, ax: 15, ay: 15 },
  sheet_metal: { w: 30, h: 30, ax: 15, ay: 15 },
  interior:    { w: 30, h: 30, ax: 15, ay: 15 },
  paint:       { w: 30, h: 30, ax: 15, ay: 15 },
}

const PIN_ICONS = Object.fromEntries(
  TYPE_ORDER.map(t => {
    const d = ICON_DIMS[t]
    return [t, { url: makeIconUrl(t), scaledSize: { width: d.w, height: d.h }, anchor: { x: d.ax, y: d.ay } }]
  })
) as Record<VendorType, { url: string; scaledSize: { width: number; height: number }; anchor: { x: number; y: number } }>

// ── Types ─────────────────────────────────────────────────────────────────────
type Vendor = {
  id: string; name: string; airport_code: string | null
  city: string | null; state: string | null; country: string
  lat: number | null; lng: number | null
  phone: string | null; email: string | null; website: string | null
  specialties: string[] | null; notes: string | null
  preferred: boolean; vendor_type: VendorType; active: boolean; is_mrt: boolean
}

type PoiCard = {
  name: string; address: string; phone: string; website: string
  lat: number; lng: number; city: string; state: string
}

type MapBounds = { north: number; south: number; east: number; west: number }

// ── Main component ────────────────────────────────────────────────────────────
export default function VendorMap() {
  const { profile } = useAuth()
  const isAdmin        = profile?.role === "Super Admin" || profile?.role === "Admin"
  const isSuperAdmin   = profile?.role === "Super Admin"
  const canEditVendors = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"

  const [vendors,      setVendors]      = useState<Vendor[]>([])
  const [mapBounds,    setMapBounds]    = useState<MapBounds | null>(null)
  const [filterType,   setFilterType]   = useState<VendorType | "all">("all")
  const [selected,     setSelected]     = useState<Vendor | null>(null)
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [poiCard,      setPoiCard]      = useState<PoiCard | null>(null)
  const [poiSaved,     setPoiSaved]     = useState(false)
  const [poiPreferred, setPoiPreferred] = useState(false)
  const [poiType,      setPoiType]      = useState<VendorType>("general")
  const [poiName,      setPoiName]      = useState("")
  const [poiPhone,     setPoiPhone]     = useState("")
  const [poiNotes,     setPoiNotes]     = useState("")
  const [sidebarTab,      setSidebarTab]      = useState<"vendors" | "mrt">("vendors")
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [mapZoom,         setMapZoom]         = useState(4)
  const [showAirports,    setShowAirports]    = useState(true)
  const [airportQuery,    setAirportQuery]    = useState("")
  const [flyToCode,       setFlyToCode]       = useState<string | null>(null)

  const blankForm = {
    name: "", airport_code: "", city: "", state: "", country: "USA",
    lat: "", lng: "", phone: "", email: "", website: "",
    specialties: "", notes: "", preferred: false, vendor_type: "general" as VendorType, is_mrt: false,
  }
  const [form, setForm] = useState(blankForm)

  useEffect(() => { loadVendors() }, [])

  async function loadVendors() {
    const { data } = await supabase
      .from("vendors").select("*").eq("active", true)
      .order("name")
    if (data) setVendors(data as Vendor[])
  }

  const boundsFiltered = mapBounds
    ? vendors.filter(v => v.lat && v.lng &&
        v.lat >= mapBounds.south && v.lat <= mapBounds.north &&
        v.lng >= mapBounds.west  && v.lng <= mapBounds.east)
    : vendors

  const sidebarList = filterType === "all"
    ? boundsFiltered
    : boundsFiltered.filter(v => v.vendor_type === filterType)

  const mrtVendors    = vendors.filter(v => v.is_mrt)
  const mappedVendors = vendors.filter(v => v.lat && v.lng && !v.is_mrt)

  async function saveManualVendor() {
    setSaving(true)
    await supabase.from("vendors").insert({
      name: form.name.trim(),
      airport_code: form.airport_code.trim() || null,
      city: form.city.trim() || null, state: form.state.trim() || null,
      country: form.country || "USA",
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      phone: form.phone.trim() || null, email: form.email.trim() || null,
      website: form.website.trim() || null,
      specialties: form.specialties ? form.specialties.split(",").map(s => s.trim()).filter(Boolean) : null,
      notes: form.notes.trim() || null,
      preferred: form.preferred, vendor_type: form.vendor_type, is_mrt: form.is_mrt,
    })
    setForm(blankForm); setShowForm(false); setSaving(false)
    await loadVendors()
  }

  async function savePoiVendor() {
    if (!poiCard) return
    const name = poiName.trim() || poiCard.name
    if (!name) return
    setSaving(true)
    await supabase.from("vendors").insert({
      name, city: poiCard.city || null, state: poiCard.state || null, country: "USA",
      lat: poiCard.lat, lng: poiCard.lng,
      phone: (poiPhone.trim() || poiCard.phone) || null,
      website: poiCard.website || null,
      notes: poiNotes.trim() || null,
      preferred: poiPreferred, vendor_type: poiType,
    })
    setSaving(false); setPoiSaved(true)
    await loadVendors()
    setTimeout(() => {
      setPoiCard(null); setPoiSaved(false); setPoiPreferred(false)
      setPoiType("general"); setPoiName(""); setPoiPhone(""); setPoiNotes("")
    }, 1800)
  }

  const handlePoiClick = useCallback((card: PoiCard) => {
    setSelected(null); setDetailVendor(null)
    setPoiCard(card); setPoiSaved(false); setPoiPreferred(false)
    setPoiType("general"); setPoiName(card.name); setPoiPhone(card.phone); setPoiNotes("")
  }, [])

  function openDetail(v: Vendor) { setSelected(null); setDetailVendor(v) }

  const airportSuggestions = airportQuery.trim().length >= 1
    ? UTAH_AIRPORTS.filter(a =>
        a.code.startsWith(airportQuery.toUpperCase()) ||
        a.name.toLowerCase().includes(airportQuery.toLowerCase())
      ).slice(0, 5)
    : []

  return (
    <div className="flex flex-col" style={{ margin: "-1.5rem", height: "calc(100vh - 3.5rem)", background: "hsl(var(--background))", overflow: "hidden" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="shrink-0">
          <h1 className="text-xl font-bold tracking-wide" style={{ fontFamily: "var(--font-heading)", color: GOLD }}>
            MX Vendor Map
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {vendors.filter(v => !v.is_mrt).length} vendors · <span style={{ color: GOLD }}>{sidebarList.length} in view</span>
            {mrtVendors.length > 0 && <span className="ml-2" style={{ color: GOLD }}>· {mrtVendors.length} MRT</span>}
            {canEditVendors && <span className="ml-2 opacity-40">· Click any business to add</span>}
          </p>
        </div>

        {/* Airport search */}
        <div className="relative shrink-0" style={{ width: 200 }}>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm"
            style={{ background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border))" }}>
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              value={airportQuery}
              onChange={e => setAirportQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && airportSuggestions.length > 0) {
                  setFlyToCode(airportSuggestions[0].code)
                  setAirportQuery("")
                }
                if (e.key === "Escape") setAirportQuery("")
              }}
              onBlur={() => setTimeout(() => setAirportQuery(""), 150)}
              placeholder="Fly to airport…"
              className="bg-transparent outline-none text-xs w-full placeholder:text-muted-foreground/50"
            />
          </div>
          {airportSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-sm shadow-xl z-50 overflow-hidden"
              style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
              {airportSuggestions.map(a => (
                <button key={a.code}
                  onMouseDown={() => { setFlyToCode(a.code); setAirportQuery("") }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors">
                  <span className="text-xs font-bold shrink-0" style={{ color: GOLD, minWidth: 32 }}>{a.code}</span>
                  <span className="text-xs text-muted-foreground truncate">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Airport layer toggle */}
          <button
            onClick={() => setShowAirports(v => !v)}
            title={showAirports ? "Hide airport layer" : "Show airports (zoom in to see)"}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-sm border transition-colors"
            style={{
              borderColor: showAirports ? "rgba(107,159,212,0.5)" : "hsl(var(--border))",
              color: showAirports ? "#6b9fd4" : "hsl(var(--muted-foreground))",
              background: showAirports ? "rgba(107,159,212,0.08)" : "transparent",
            }}
          >
            <Plane className="w-3.5 h-3.5" />
          </button>
          <LegendDropdown />
          {canEditVendors && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-xs px-3 py-1 rounded-sm text-white"
              style={{ background: GOLD }}
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <APIProvider apiKey={API_KEY} libraries={["places"]}>
            <Map
              defaultCenter={{ lat: 39.5, lng: -98.35 }}
              defaultZoom={4}
              mapTypeId="roadmap"
              style={{ width: "100%", height: "100%" }}
              gestureHandling="greedy"
              onBoundsChanged={(e: any) => setMapBounds(e.detail.bounds)}
              onZoomChanged={(e: any) => setMapZoom(e.detail.zoom)}
              onClick={() => setSelected(null)}
            >
              {canEditVendors && <PoiClickHandler onPoiClick={handlePoiClick} />}
              <AirportLayer
                show={showAirports}
                zoom={mapZoom}
                flyToCode={flyToCode}
                onFlownTo={() => setFlyToCode(null)}
              />

              {mappedVendors.map(v => (
                <Marker
                  key={v.id}
                  position={{ lat: v.lat!, lng: v.lng! }}
                  icon={PIN_ICONS[v.vendor_type] as any}
                  title={v.name}
                  onClick={() => { setPoiCard(null); setSelected(v) }}
                />
              ))}

              {selected && selected.lat && selected.lng && (
                <InfoWindow
                  position={{ lat: selected.lat, lng: selected.lng }}
                  onCloseClick={() => setSelected(null)}
                  headerDisabled
                >
                  <VendorPopup vendor={selected}
                    onClose={() => setSelected(null)}
                    onDetail={() => openDetail(selected)}
                  />
                </InfoWindow>
              )}
            </Map>
          </APIProvider>


          {/* POI quick-add card */}
          {poiCard && canEditVendors && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md shadow-2xl z-10"
              style={{ background: "hsl(var(--background))", border: `1px solid ${GOLD}`, width: 360 }}>
              {poiSaved ? (
                <div className="flex items-center justify-center gap-2 py-5">
                  <CheckCircle className="w-5 h-5" style={{ color: GOLD }} />
                  <span className="text-sm font-medium">Added to vendor list!</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <p className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Add to vendor list</p>
                    <button onClick={() => setPoiCard(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
                  </div>
                  <div className="px-4 pb-3 space-y-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Vendor Name *</p>
                      <input className="form-input" value={poiName} onChange={e => setPoiName(e.target.value)} placeholder="Business name" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Vendor Type</p>
                      <div className="grid grid-cols-5 gap-1">
                        {TYPE_ORDER.map(k => {
                          const cfg = TYPE_CONFIG[k]
                          return (
                            <button key={k} onClick={() => setPoiType(k)}
                              className="text-[9px] py-1 rounded-sm border font-bold transition-colors leading-tight"
                              style={{
                                borderColor: poiType === k ? cfg.color : "hsl(var(--border))",
                                color:       poiType === k ? cfg.color : "hsl(var(--muted-foreground))",
                                background:  poiType === k ? `${cfg.color}18` : "transparent",
                              }}
                            >{cfg.sym}</button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Phone</p>
                      <input className="form-input" value={poiPhone} onChange={e => setPoiPhone(e.target.value)} placeholder="—" />
                    </div>
                    {poiCard.address && <p className="text-[10px] text-muted-foreground">📍 {poiCard.address}</p>}
                    {poiCard.website && <p className="text-[10px] text-muted-foreground truncate">🌐 {poiCard.website.replace(/^https?:\/\//, "")}</p>}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Notes</p>
                      <input className="form-input" value={poiNotes} onChange={e => setPoiNotes(e.target.value)} placeholder="Optional" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={poiPreferred} onChange={e => setPoiPreferred(e.target.checked)} />
                      <span className="text-xs" style={{ color: poiPreferred ? GOLD : "hsl(var(--muted-foreground))" }}>Preferred</span>
                    </label>
                    <button onClick={savePoiVendor} disabled={saving || !poiName.trim()}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm text-white disabled:opacity-50"
                      style={{ background: GOLD }}>
                      <Plus className="w-3.5 h-3.5" />
                      {saving ? "Saving…" : "Add Vendor"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={`${sidebarExpanded ? "w-[62%]" : "w-80"} flex-shrink-0 flex flex-col overflow-hidden transition-[width] duration-200`} style={{ borderLeft: "1px solid hsl(var(--border))" }}>
          {detailVendor ? (
            <VendorDetail
              vendor={detailVendor}
              onBack={() => { setDetailVendor(null); setSidebarExpanded(false) }}
              isAdmin={canEditVendors}
              onRefresh={async () => { await loadVendors() }}
              onUpdated={v => setDetailVendor(v)}
              expanded={sidebarExpanded}
              onToggleExpand={() => setSidebarExpanded(e => !e)}
              isSuperAdmin={isSuperAdmin}
            />
          ) : (
            <>
              {/* Tab bar */}
              <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                <button
                  onClick={() => setSidebarTab("vendors")}
                  className="flex-1 text-xs py-2.5 font-semibold tracking-wide transition-colors"
                  style={{
                    color: sidebarTab === "vendors" ? GOLD : "hsl(var(--muted-foreground))",
                    borderBottom: sidebarTab === "vendors" ? `2px solid ${GOLD}` : "2px solid transparent",
                  }}
                >Vendor List</button>
                <button
                  onClick={() => setSidebarTab("mrt")}
                  className="flex-1 text-xs py-2.5 font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5"
                  style={{
                    color: sidebarTab === "mrt" ? GOLD : "hsl(var(--muted-foreground))",
                    borderBottom: sidebarTab === "mrt" ? `2px solid ${GOLD}` : "2px solid transparent",
                  }}
                >
                  <Truck className="w-3 h-3" /> MRT Teams
                  {mrtVendors.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ background: `${GOLD}25`, color: GOLD }}>{mrtVendors.length}</span>
                  )}
                </button>
              </div>

              {sidebarTab === "vendors" ? (
                <>
                  <div className="px-3 pt-3 pb-2 flex-shrink-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {mapBounds ? "In current view" : "All vendors"} · {sidebarList.length}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
                    {sidebarList.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-10 px-4">
                        No vendors in this area. Pan or zoom out to find more.
                      </p>
                    )}
                    {sidebarList.map(v => {
                      const cfg = TYPE_CONFIG[v.vendor_type]
                      return (
                        <button key={v.id} onClick={() => setDetailVendor(v)}
                          className="w-full text-left px-3 py-2.5 rounded-sm transition-colors"
                          style={{ border: "1px solid hsl(var(--border))" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--accent))")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                            <span className="text-sm font-semibold truncate flex-1">{v.name}</span>
                            {v.preferred && <Star className="w-3 h-3 flex-shrink-0" style={{ color: GOLD }} fill={GOLD} />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 ml-3.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                              style={{ background: `${cfg.color}18`, color: cfg.color }}>
                              {cfg.sym} {cfg.label}
                            </span>
                            {v.city && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {v.city}{v.state ? `, ${v.state}` : ""}
                              </span>
                            )}
                          </div>
                          {v.phone && <p className="text-[11px] text-muted-foreground mt-0.5 ml-3.5">{v.phone}</p>}
                          {v.notes && (
                            <p className="text-[10px] text-muted-foreground mt-1 ml-3.5 italic opacity-60 line-clamp-2">
                              {v.notes}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="px-3 pt-3 pb-2 flex-shrink-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      Mobile Response Teams · {mrtVendors.length}
                    </p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
                    {mrtVendors.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-10 px-4">
                        No MRT vendors yet. Add a vendor and check "Mobile Response Team."
                      </p>
                    )}
                    {mrtVendors.map(v => {
                      const cfg = TYPE_CONFIG[v.vendor_type]
                      return (
                        <button key={v.id} onClick={() => setDetailVendor(v)}
                          className="w-full text-left px-3 py-2.5 rounded-sm transition-colors"
                          style={{ border: "1px solid hsl(var(--border))" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--accent))")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                            <span className="text-sm font-semibold truncate flex-1">{v.name}</span>
                            {v.preferred && <Star className="w-3 h-3 flex-shrink-0" style={{ color: GOLD }} fill={GOLD} />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 ml-5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                              style={{ background: `${cfg.color}18`, color: cfg.color }}>
                              {cfg.sym} {cfg.label}
                            </span>
                            {v.city && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {v.city}{v.state ? `, ${v.state}` : ""}
                              </span>
                            )}
                          </div>
                          {v.phone && <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">{v.phone}</p>}
                          {v.notes && (
                            <p className="text-[10px] text-muted-foreground mt-1 ml-5 italic opacity-60 line-clamp-2">
                              {v.notes}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Manual Add Modal */}
      {showForm && (
        <VendorFormModal
          title="Add Vendor"
          initial={blankForm}
          saving={saving}
          onSave={saveManualVendor}
          onCancel={() => setShowForm(false)}
          onChange={setForm}
          form={form}
        />
      )}

      <style>{`
        .form-input {
          width: 100%;
          padding: 0.35rem 0.6rem;
          border-radius: 0.25rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 0.8rem;
          outline: none;
        }
        .form-input:focus { border-color: ${GOLD}; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  )
}

// ── Map popup (InfoWindow content) ────────────────────────────────────────────
function VendorPopup({ vendor, onClose, onDetail }: {
  vendor: Vendor; onClose: () => void; onDetail: () => void
}) {
  const cfg = TYPE_CONFIG[vendor.vendor_type]
  return (
    <div style={{ minWidth: 190, maxWidth: 240, fontFamily: "sans-serif", position: "relative" }}>
      <button onClick={onClose}
        style={{ position: "absolute", top: 0, right: 0, cursor: "pointer", background: "none", border: "none", padding: 2, lineHeight: 1, color: "#666", fontSize: 16 }}
      >×</button>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, paddingRight: 16 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${cfg.color}20`, color: cfg.color }}>
          {cfg.sym} {cfg.label}
        </span>
        {vendor.preferred && <Star style={{ width: 11, height: 11, color: GOLD }} fill={GOLD} />}
      </div>
      <strong style={{ fontSize: 13, display: "block", marginBottom: 2 }}>{vendor.name}</strong>
      {vendor.city && <p style={{ fontSize: 11, color: "#777", margin: "2px 0" }}>{vendor.city}{vendor.state ? `, ${vendor.state}` : ""}</p>}
      {vendor.phone && (
        <p style={{ fontSize: 11, margin: "3px 0" }}>
          <a href={`tel:${vendor.phone}`} style={{ color: "#1a73e8" }}>{vendor.phone}</a>
        </p>
      )}
      <button onClick={onDetail}
        style={{ marginTop: 6, fontSize: 11, color: "#1a73e8", cursor: "pointer", background: "none", border: "none", padding: 0, textDecoration: "underline" }}>
        Full details →
      </button>
    </div>
  )
}

// ── Vendor detail + full edit ─────────────────────────────────────────────────
type VendorContact = {
  id: string; vendor_id: string; name: string; title: string | null
  role: string | null; phone: string | null; mobile: string | null
  email: string | null; is_primary: boolean
}

const CONTACT_ROLES = ["Sales", "Project Manager", "QC Lead", "General Manager", "Owner", "Other"]

function VendorDetail({ vendor, onBack, isAdmin, onRefresh, onUpdated, expanded, onToggleExpand, isSuperAdmin }: {
  vendor: Vendor; onBack: () => void; isAdmin: boolean
  onRefresh: () => Promise<void>; onUpdated: (v: Vendor) => void
  expanded: boolean; onToggleExpand: () => void; isSuperAdmin: boolean
}) {
  const cfg = TYPE_CONFIG[vendor.vendor_type]
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [contacts, setContacts] = useState<VendorContact[]>([])
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState({ name: "", title: "", role: "Sales", phone: "", mobile: "", email: "", is_primary: false })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [edit, setEdit] = useState({
    name:         vendor.name,
    vendor_type:  vendor.vendor_type,
    preferred:    vendor.preferred,
    airport_code: vendor.airport_code ?? "",
    city:         vendor.city ?? "",
    state:        vendor.state ?? "",
    country:      vendor.country,
    phone:        vendor.phone ?? "",
    email:        vendor.email ?? "",
    website:      vendor.website ?? "",
    specialties:  (vendor.specialties ?? []).join(", "),
    notes:        vendor.notes ?? "",
    lat:          vendor.lat?.toString() ?? "",
    lng:          vendor.lng?.toString() ?? "",
    is_mrt:       vendor.is_mrt,
  })

  async function saveEdits() {
    setSaving(true)
    const payload = {
      name:         edit.name.trim(),
      vendor_type:  edit.vendor_type,
      preferred:    edit.preferred,
      airport_code: edit.airport_code.trim() || null,
      city:         edit.city.trim() || null,
      state:        edit.state.trim() || null,
      country:      edit.country || "USA",
      phone:        edit.phone.trim() || null,
      email:        edit.email.trim() || null,
      website:      edit.website.trim() || null,
      specialties:  edit.specialties ? edit.specialties.split(",").map(s => s.trim()).filter(Boolean) : null,
      notes:        edit.notes.trim() || null,
      lat:          edit.lat ? parseFloat(edit.lat) : null,
      lng:          edit.lng ? parseFloat(edit.lng) : null,
      is_mrt:       edit.is_mrt,
    }
    await supabase.from("vendors").update(payload).eq("id", vendor.id)
    setSaving(false)
    setEditing(false)
    onUpdated({ ...vendor, ...payload } as Vendor)
    await onRefresh()
  }

  useEffect(() => {
    supabase.from("vendor_contacts").select("*")
      .eq("vendor_id", vendor.id).order("is_primary", { ascending: false }).order("created_at")
      .then(({ data }) => setContacts(data ?? []))
  }, [vendor.id])

  async function loadContacts() {
    const { data } = await supabase.from("vendor_contacts").select("*")
      .eq("vendor_id", vendor.id).order("is_primary", { ascending: false }).order("created_at")
    setContacts(data ?? [])
  }

  async function saveContact() {
    const payload = {
      name:       contactForm.name.trim(),
      title:      contactForm.title.trim() || null,
      role:       contactForm.role || null,
      phone:      contactForm.phone.trim() || null,
      mobile:     contactForm.mobile.trim() || null,
      email:      contactForm.email.trim() || null,
      is_primary: contactForm.is_primary,
    }
    if (editingContactId) {
      await supabase.from("vendor_contacts").update(payload).eq("id", editingContactId)
    } else {
      await supabase.from("vendor_contacts").insert({ vendor_id: vendor.id, ...payload })
    }
    setShowContactForm(false); setEditingContactId(null)
    setContactForm({ name: "", title: "", role: "Sales", phone: "", mobile: "", email: "", is_primary: false })
    await loadContacts()
  }

  async function deleteContact(id: string) {
    await supabase.from("vendor_contacts").delete().eq("id", id)
    await loadContacts()
  }

  async function deleteVendor() {
    await supabase.from("vendors").delete().eq("id", vendor.id)
    onBack()
    await onRefresh()
  }

  function startEditContact(c: VendorContact) {
    setContactForm({ name: c.name, title: c.title ?? "", role: c.role ?? "Sales", phone: c.phone ?? "", mobile: c.mobile ?? "", email: c.email ?? "", is_primary: c.is_primary })
    setEditingContactId(c.id)
    setShowContactForm(true)
  }

  if (editing) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <p className="text-xs font-bold tracking-wide" style={{ color: GOLD }}>Edit Vendor</p>
          <button onClick={() => setEditing(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          <Field label="Name *">
            <input className="form-input" value={edit.name} onChange={e => setEdit(f => ({ ...f, name: e.target.value }))} />
          </Field>
          {/* Type grid */}
          <Field label="Type">
            <div className="grid grid-cols-2 gap-1.5">
              {TYPE_ORDER.map(k => {
                const c = TYPE_CONFIG[k]
                const active = edit.vendor_type === k
                return (
                  <button key={k} type="button" onClick={() => setEdit(f => ({ ...f, vendor_type: k }))}
                    className="text-[10px] py-1.5 px-2 rounded-sm border font-bold text-left transition-colors"
                    style={{
                      borderColor: active ? c.color : "hsl(var(--border))",
                      color:       active ? c.color : "hsl(var(--muted-foreground))",
                      background:  active ? `${c.color}15` : "transparent",
                    }}
                  >
                    <span>{c.sym}</span> {c.label}
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Airport Code">
              <input className="form-input font-mono uppercase" value={edit.airport_code} onChange={e => setEdit(f => ({ ...f, airport_code: e.target.value }))} placeholder="KDAL" maxLength={4} />
            </Field>
            <Field label="Country">
              <input className="form-input" value={edit.country} onChange={e => setEdit(f => ({ ...f, country: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="City">
              <input className="form-input" value={edit.city} onChange={e => setEdit(f => ({ ...f, city: e.target.value }))} />
            </Field>
            <Field label="State">
              <input className="form-input" value={edit.state} onChange={e => setEdit(f => ({ ...f, state: e.target.value }))} maxLength={2} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lat">
              <input className="form-input" type="number" step="any" value={edit.lat} onChange={e => setEdit(f => ({ ...f, lat: e.target.value }))} />
            </Field>
            <Field label="Lng">
              <input className="form-input" type="number" step="any" value={edit.lng} onChange={e => setEdit(f => ({ ...f, lng: e.target.value }))} />
            </Field>
          </div>
          <Field label="Phone">
            <input className="form-input" value={edit.phone} onChange={e => setEdit(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <input className="form-input" value={edit.email} onChange={e => setEdit(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Website">
            <input className="form-input" value={edit.website} onChange={e => setEdit(f => ({ ...f, website: e.target.value }))} />
          </Field>
          <Field label="Specialties (comma-separated)">
            <input className="form-input" value={edit.specialties} onChange={e => setEdit(f => ({ ...f, specialties: e.target.value }))} placeholder="Engine, Avionics…" />
          </Field>
          <Field label="Notes">
            <textarea className="form-input resize-none" rows={3} value={edit.notes} onChange={e => setEdit(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={edit.preferred} onChange={e => setEdit(f => ({ ...f, preferred: e.target.checked }))} />
            <span className="text-xs" style={{ color: edit.preferred ? GOLD : "hsl(var(--muted-foreground))" }}>Preferred vendor</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={edit.is_mrt} onChange={e => setEdit(f => ({ ...f, is_mrt: e.target.checked }))} />
            <span className="text-xs" style={{ color: edit.is_mrt ? GOLD : "hsl(var(--muted-foreground))" }}>Mobile Response Team (MRT) — no map pin</span>
          </label>
        </div>
        <div className="flex gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <button onClick={() => setEditing(false)} className="flex-1 py-2 text-xs rounded-sm font-semibold" style={{ background: "#1e3a5f", color: "white" }}>← Back</button>
          <button onClick={saveEdits} disabled={!edit.name.trim() || saving}
            className="flex-1 py-1.5 text-xs rounded-sm text-white disabled:opacity-50"
            style={{ background: GOLD }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
        {isSuperAdmin && (
          <div className="px-4 pb-4 flex-shrink-0">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-xs py-1.5 rounded-sm transition-colors"
                style={{ color: "#f87171", border: "1px solid rgba(248,113,113,0.25)", background: "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                Delete vendor
              </button>
            ) : (
              <div className="rounded-sm p-3 space-y-2" style={{ border: "1px solid #f87171", background: "rgba(248,113,113,0.06)" }}>
                <p className="text-xs text-center font-semibold" style={{ color: "#f87171" }}>
                  Permanently delete {vendor.name}?
                </p>
                <p className="text-[10px] text-center text-muted-foreground">This cannot be undone.</p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 text-xs py-1.5 rounded-sm text-muted-foreground"
                    style={{ border: "1px solid hsl(var(--border))" }}
                  >Cancel</button>
                  <button
                    onClick={deleteVendor}
                    className="flex-1 text-xs py-1.5 rounded-sm text-white font-semibold"
                    style={{ background: "#ef4444" }}
                  >Yes, Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Read view ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-sm transition-colors"
            style={{
              border: `1px solid ${expanded ? GOLD : "hsl(var(--border))"}`,
              color: expanded ? GOLD : "hsl(var(--muted-foreground))",
              background: expanded ? `${GOLD}15` : "transparent",
            }}
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            {expanded ? "Collapse" : "Expand"}
          </button>
          {isAdmin && (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-sm"
              style={{ background: `${GOLD}18`, color: GOLD }}>
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Name + type */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm"
              style={{ background: `${cfg.color}20`, color: cfg.color }}>
              {cfg.sym} {cfg.label}
            </span>
            {vendor.preferred && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1"
                style={{ background: `${GOLD}20`, color: GOLD }}>
                <Star className="w-2.5 h-2.5" fill={GOLD} /> Preferred
              </span>
            )}
            {vendor.is_mrt && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1"
                style={{ background: `${GOLD}15`, color: GOLD }}>
                <Truck className="w-2.5 h-2.5" /> MRT
              </span>
            )}
          </div>
          <h2 className="text-base font-bold leading-snug">{vendor.name}</h2>
          {(vendor.city || vendor.airport_code) && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {vendor.airport_code && <span className="font-mono mr-1">{vendor.airport_code}</span>}
              {vendor.city}{vendor.state ? `, ${vendor.state}` : ""}
            </p>
          )}
        </div>

        {/* Contact */}
        <div className="space-y-2" style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Contact</p>
          {vendor.phone ? (
            <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: GOLD }}>
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />{vendor.phone}
            </a>
          ) : <p className="text-xs text-muted-foreground italic">No phone on file</p>}
          {vendor.email && (
            <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:underline">
              <span className="text-sm">✉</span>{vendor.email}
            </a>
          )}
          {vendor.website && (
            <a href={vendor.website} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:underline">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{vendor.website.replace(/^https?:\/\//, "")}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
            </a>
          )}
        </div>

        {/* Key Contacts */}
        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Key Contacts</p>
            {isAdmin && !showContactForm && (
              <button
                onClick={() => { setContactForm({ name: "", title: "", role: "Sales", phone: "", mobile: "", email: "", is_primary: false }); setEditingContactId(null); setShowContactForm(true) }}
                className="flex items-center gap-0.5 text-[9px] font-semibold"
                style={{ color: GOLD }}
              ><Plus className="w-3 h-3" /> Add</button>
            )}
          </div>

          {showContactForm && (
            <div className="rounded-sm p-3 mb-3 space-y-2" style={{ border: `1px solid ${GOLD}40`, background: `${GOLD}08` }}>
              <Field label="Name *">
                <input className="form-input" value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </Field>
              <Field label="Title">
                <input className="form-input" value={contactForm.title} onChange={e => setContactForm(f => ({ ...f, title: e.target.value }))} placeholder="Regional Sales Manager" />
              </Field>
              <Field label="Role">
                <select className="form-input" value={contactForm.role} onChange={e => setContactForm(f => ({ ...f, role: e.target.value }))}>
                  {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Phone">
                  <input className="form-input" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="(970) 555-0100" />
                </Field>
                <Field label="Mobile">
                  <input className="form-input" value={contactForm.mobile} onChange={e => setContactForm(f => ({ ...f, mobile: e.target.value }))} placeholder="(970) 555-0200" />
                </Field>
              </div>
              <Field label="Email">
                <input className="form-input" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="name@company.com" />
              </Field>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contactForm.is_primary} onChange={e => setContactForm(f => ({ ...f, is_primary: e.target.checked }))} />
                <span className="text-xs text-muted-foreground">Primary contact</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowContactForm(false); setEditingContactId(null); setContactForm({ name: "", title: "", role: "Sales", phone: "", mobile: "", email: "", is_primary: false }) }}
                  className="flex-1 py-1.5 text-xs rounded-sm text-muted-foreground"
                  style={{ border: "1px solid hsl(var(--border))" }}
                >Cancel</button>
                <button onClick={saveContact} disabled={!contactForm.name.trim()}
                  className="flex-1 py-1.5 text-xs rounded-sm text-white disabled:opacity-40"
                  style={{ background: GOLD }}>
                  {editingContactId ? "Update" : "Add Contact"}
                </button>
              </div>
              {editingContactId && (
                <button onClick={() => deleteContact(editingContactId)}
                  className="w-full text-xs py-1 transition-colors"
                  style={{ color: "#f87171" }}>
                  Delete contact
                </button>
              )}
            </div>
          )}

          {contacts.length === 0 && !showContactForm && (
            <p className="text-xs text-muted-foreground italic opacity-50">No contacts on file.</p>
          )}

          <div className="space-y-2">
            {contacts.map(c => (
              <div key={c.id} className="rounded-sm p-2.5" style={{ background: "hsl(var(--accent))", border: "1px solid hsl(var(--border))" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate">{c.name}</p>
                    {c.title && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{c.title}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.is_primary && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: `${GOLD}20`, color: GOLD }}>PRIMARY</span>
                    )}
                    {c.role && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>{c.role}</span>
                    )}
                    {isAdmin && (
                      <button onClick={() => startEditContact(c)} className="opacity-40 hover:opacity-80 transition-opacity">
                        <Pencil className="w-3 h-3" style={{ color: GOLD }} />
                      </button>
                    )}
                  </div>
                </div>
                {(c.phone || c.mobile) && (
                  <p className="text-[10px] mt-1.5 flex items-center gap-1 flex-wrap">
                    <Phone className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
                    {c.phone && <a href={`tel:${c.phone}`} style={{ color: GOLD }}>{c.phone}</a>}
                    {c.phone && c.mobile && <span className="opacity-40">·</span>}
                    {c.mobile && <span className="text-muted-foreground">M: {c.mobile}</span>}
                  </p>
                )}
                {c.email && (
                  <p className="text-[10px] mt-0.5">
                    <a href={`mailto:${c.email}`} className="text-muted-foreground hover:underline">{c.email}</a>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Specialties */}
        {vendor.specialties && vendor.specialties.length > 0 && (
          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Specialties</p>
            <div className="flex flex-wrap gap-1.5">
              {vendor.specialties.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-sm font-semibold"
                  style={{ background: `${cfg.color}15`, color: cfg.color }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Notes</p>
          <p className="text-xs text-muted-foreground leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>
            {vendor.notes || <span className="italic opacity-50">No notes yet.</span>}
          </p>
        </div>

        {/* Google Maps link */}
        {vendor.lat && vendor.lng && (
          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "0.875rem" }}>
            <a href={`https://www.google.com/maps/search/?api=1&query=${vendor.lat},${vendor.lng}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:underline">
              <MapPin className="w-3.5 h-3.5" />View on Google Maps
              <ExternalLink className="w-3 h-3 opacity-50" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Legend dropdown (header) ──────────────────────────────────────────────────
function LegendDropdown() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border font-semibold transition-colors"
        style={{
          borderColor: open ? GOLD : "hsl(var(--border))",
          color: open ? GOLD : "hsl(var(--muted-foreground))",
          background: open ? `${GOLD}12` : "transparent",
        }}
      >
        Legend
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-md shadow-xl z-50"
          style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", minWidth: 220 }}
        >
          <p className="px-4 pt-3 pb-2 text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>
            Vendor Icon Legend
          </p>
          <div className="px-3 pb-3 space-y-0.5">
            {TYPE_ORDER.map(t => {
              const cfg = TYPE_CONFIG[t]
              return (
                <div key={t} className="flex items-center gap-3 px-1 py-1.5 rounded-sm">
                  {/* Shape preview */}
                  <img
                    src={PIN_ICONS[t].url}
                    alt={cfg.label}
                    style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }}
                  />
                  <div>
                    <p className="text-xs font-semibold leading-tight">{cfg.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{cfg.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vendor form modal (add manually) ─────────────────────────────────────────
function VendorFormModal({ title, form, saving, onSave, onCancel, onChange }: {
  title: string
  form: ReturnType<typeof useState<any>>[0]
  saving: boolean
  onSave: () => void
  onCancel: () => void
  onChange: (f: any) => void
}) {
  const f = form
  const setF = (patch: Partial<typeof f>) => onChange({ ...f, ...patch })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-md shadow-xl overflow-y-auto"
        style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <h2 className="text-sm font-semibold tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>
          <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Vendor Name *">
            <input className="form-input" value={f.name} onChange={e => setF({ name: e.target.value })} placeholder="e.g. Dallas Airmotive" />
          </Field>
          <Field label="Vendor Type">
            <div className="grid grid-cols-2 gap-2">
              {TYPE_ORDER.map(k => {
                const c = TYPE_CONFIG[k]; const active = f.vendor_type === k
                return (
                  <button key={k} type="button" onClick={() => setF({ vendor_type: k })}
                    className="text-xs py-2 px-3 rounded-sm border font-medium text-left transition-colors"
                    style={{ borderColor: active ? c.color : "hsl(var(--border))", color: active ? c.color : "hsl(var(--muted-foreground))", background: active ? `${c.color}15` : "transparent" }}>
                    <span className="font-bold">{c.sym}</span> {c.label}
                    <span className="block text-[9px] opacity-60 mt-0.5">{c.desc}</span>
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Airport Code"><input className="form-input font-mono uppercase" value={f.airport_code} onChange={e => setF({ airport_code: e.target.value })} placeholder="KDAL" maxLength={4} /></Field>
            <Field label="Country"><input className="form-input" value={f.country} onChange={e => setF({ country: e.target.value })} placeholder="USA" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><input className="form-input" value={f.city} onChange={e => setF({ city: e.target.value })} placeholder="Dallas" /></Field>
            <Field label="State"><input className="form-input" value={f.state} onChange={e => setF({ state: e.target.value })} placeholder="TX" maxLength={2} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><input className="form-input" type="number" step="any" value={f.lat} onChange={e => setF({ lat: e.target.value })} placeholder="32.8481" /></Field>
            <Field label="Longitude"><input className="form-input" type="number" step="any" value={f.lng} onChange={e => setF({ lng: e.target.value })} placeholder="-96.8512" /></Field>
          </div>
          <Field label="Phone"><input className="form-input" value={f.phone} onChange={e => setF({ phone: e.target.value })} placeholder="(214) 555-0100" /></Field>
          <Field label="Website"><input className="form-input" value={f.website} onChange={e => setF({ website: e.target.value })} placeholder="https://example.com" /></Field>
          <Field label="Specialties (comma-separated)"><input className="form-input" value={f.specialties} onChange={e => setF({ specialties: e.target.value })} placeholder="Engine, Sheet Metal, Interiors" /></Field>
          <Field label="Notes"><textarea className="form-input resize-none" rows={3} value={f.notes} onChange={e => setF({ notes: e.target.value })} placeholder="AOG availability, turnaround time, contact preferences…" /></Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.preferred} onChange={e => setF({ preferred: e.target.checked })} />
            <span className="text-sm" style={{ color: f.preferred ? GOLD : "hsl(var(--muted-foreground))" }}>Mark as preferred</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.is_mrt} onChange={e => setF({ is_mrt: e.target.checked })} />
            <span className="text-sm" style={{ color: f.is_mrt ? GOLD : "hsl(var(--muted-foreground))" }}>Mobile Response Team (MRT) — no map pin</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <button onClick={onCancel} className="px-4 py-1.5 text-sm rounded-sm border text-muted-foreground" style={{ borderColor: "hsl(var(--border))" }}>Cancel</button>
          <button onClick={onSave} disabled={!f.name?.trim() || saving} className="px-4 py-1.5 text-sm rounded-sm text-white disabled:opacity-50" style={{ background: GOLD }}>
            {saving ? "Saving…" : "Save Vendor"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Airport reference dot layer ───────────────────────────────────────────────

const AIRPORT_DOT = {
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">' +
    '<g transform="rotate(-35 13 13)">' +
    // Runway surface
    '<rect x="9.5" y="1" width="7" height="24" rx="1.5" fill="#4a6f8a" stroke="rgba(255,255,255,0.35)" stroke-width="0.75"/>' +
    // Threshold bars — top
    '<rect x="10.5" y="2.5"  width="5" height="1.5" fill="white" opacity="0.85"/>' +
    // Threshold bars — bottom
    '<rect x="10.5" y="22"   width="5" height="1.5" fill="white" opacity="0.85"/>' +
    // Centerline dashes
    '<line x1="13" y1="6"    x2="13" y2="9"    stroke="white" stroke-width="1.1" stroke-opacity="0.7"/>' +
    '<line x1="13" y1="11.5" x2="13" y2="14.5" stroke="white" stroke-width="1.1" stroke-opacity="0.7"/>' +
    '<line x1="13" y1="17"   x2="13" y2="20"   stroke="white" stroke-width="1.1" stroke-opacity="0.7"/>' +
    '</g>' +
    '</svg>'
  )}`,
  scaledSize: { width: 26, height: 26 },
  anchor: { x: 13, y: 13 },
}

function AirportLayer({
  show, zoom, flyToCode, onFlownTo,
}: {
  show: boolean; zoom: number; flyToCode: string | null; onFlownTo: () => void
}) {
  const map = useMap()
  const [hovered, setHovered] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!map || !flyToCode) return
    const a = UTAH_AIRPORTS.find(x => x.code === flyToCode)
    if (a) { map.panTo({ lat: a.lat, lng: a.lng }); map.setZoom(11) }
    onFlownTo()
  }, [map, flyToCode, onFlownTo])

  const hoveredAirport = hovered ? (UTAH_AIRPORTS.find(a => a.code === hovered) ?? null) : null

  if (!show || zoom < 7) return null

  return (
    <>
      {UTAH_AIRPORTS.map(a => (
        <Marker
          key={a.code}
          position={{ lat: a.lat, lng: a.lng }}
          icon={AIRPORT_DOT as any}
          zIndex={1}
          onMouseOver={() => {
            if (closeTimer.current) clearTimeout(closeTimer.current)
            setHovered(a.code)
          }}
          onMouseOut={() => {
            closeTimer.current = setTimeout(() => setHovered(null), 150)
          }}
        />
      ))}
      {hoveredAirport && (
        <InfoWindow
          position={{ lat: hoveredAirport.lat, lng: hoveredAirport.lng }}
          headerDisabled
          onCloseClick={() => setHovered(null)}
        >
          <div style={{
            background: "#0f1117",
            border: "0.5px solid rgba(212,160,23,0.45)",
            borderRadius: 5,
            padding: "5px 10px",
          }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#d4a017", letterSpacing: "0.1em", fontFamily: "monospace" }}>
              {hoveredAirport.code}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>
              {hoveredAirport.name}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  )
}

// ── POI click handler ─────────────────────────────────────────────────────────
function PoiClickHandler({ onPoiClick }: { onPoiClick: (c: PoiCard) => void }) {
  const map = useMap()
  const placesLib = useMapsLibrary("places")
  useEffect(() => {
    if (!map || !placesLib) return
    const svc = new placesLib.PlacesService(map)
    const listener = map.addListener("click", (e: google.maps.MapMouseEvent & { placeId?: string }) => {
      if (!e.placeId || !e.latLng) return
      e.stop()
      svc.getDetails(
        { placeId: e.placeId, fields: ["name","formatted_address","formatted_phone_number","website","geometry","address_components"] },
        (place, status) => {
          if (status !== placesLib.PlacesServiceStatus.OK || !place) return
          let city = "", state = ""
          for (const c of place.address_components ?? []) {
            if (c.types.includes("locality")) city = c.long_name
            if (c.types.includes("administrative_area_level_1")) state = c.short_name
          }
          onPoiClick({
            name: place.name ?? "", address: place.formatted_address ?? "",
            phone: place.formatted_phone_number ?? "", website: place.website ?? "",
            lat: place.geometry?.location?.lat() ?? e.latLng!.lat(),
            lng: place.geometry?.location?.lng() ?? e.latLng!.lng(),
            city, state,
          })
        }
      )
    })
    return () => { google.maps.event.removeListener(listener) }
  }, [map, placesLib, onPoiClick])
  return null
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}
