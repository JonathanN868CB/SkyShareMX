import { useState, useEffect, useRef } from "react"
import { Marker, InfoWindow, useMap } from "@vis.gl/react-google-maps"
import UTAH_AIRPORTS from "@/data/utahAirports"
import { AIRPORT_DOT } from "../constants"

export function AirportLayer({
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
