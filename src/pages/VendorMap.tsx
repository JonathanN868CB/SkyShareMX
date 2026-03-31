import { useState, useEffect, useCallback } from "react"
import { APIProvider, Map, Marker, InfoWindow } from "@vis.gl/react-google-maps"
import { Plus, Search, Plane } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import UTAH_AIRPORTS from "@/data/utahAirports"
import {
  GOLD, PIN_ICONS, TYPE_CONFIG,
  type Vendor, type VendorType, type PoiCard, type MapBounds,
} from "@/features/vendors/constants"
import { VendorPopup } from "@/features/vendors/components/VendorPopup"
import { VendorDetail } from "@/features/vendors/components/VendorDetail"
import { VendorSidebar } from "@/features/vendors/components/VendorSidebar"
import { VendorFormModal } from "@/features/vendors/components/VendorFormModal"
import { LegendDropdown } from "@/features/vendors/components/LegendDropdown"
import { AirportLayer } from "@/features/vendors/components/AirportLayer"
import { PoiClickHandler } from "@/features/vendors/components/PoiClickHandler"
import { PoiQuickAdd } from "@/features/vendors/components/PoiQuickAdd"

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

export default function VendorMap() {
  const { profile } = useAuth()
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
      .from("vendors").select("*").eq("active", true).order("name")
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
            <PoiQuickAdd
              poiCard={poiCard} poiSaved={poiSaved}
              poiName={poiName} poiPhone={poiPhone} poiNotes={poiNotes}
              poiType={poiType} poiPreferred={poiPreferred} saving={saving}
              onPoiNameChange={setPoiName} onPoiPhoneChange={setPoiPhone}
              onPoiNotesChange={setPoiNotes} onPoiTypeChange={setPoiType}
              onPoiPreferredChange={setPoiPreferred}
              onSave={savePoiVendor} onClose={() => setPoiCard(null)}
            />
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
            <VendorSidebar
              sidebarTab={sidebarTab} setSidebarTab={setSidebarTab}
              sidebarList={sidebarList} mrtVendors={mrtVendors}
              mapBounds={!!mapBounds}
              onSelectVendor={v => setDetailVendor(v)}
            />
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
