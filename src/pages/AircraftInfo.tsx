import { useState, useEffect } from "react"
import { AIRCRAFT_DETAILS } from "./aircraft/fleetData"
import type { AircraftBase, ManufacturerGroup } from "./aircraft/fleetData"
import AircraftDetailOverlay from "./aircraft/AircraftDetailOverlay"
import { useFleet } from "./aircraft/useFleet"

// ─── Aircraft Card ─────────────────────────────────────────────────────────────
function AircraftCard({ ac, onOpen }: { ac: AircraftBase; onOpen: (ac: AircraftBase) => void }) {
  const [hovered, setHovered] = useState(false)
  const [glintKey, setGlintKey] = useState(0) // increment to re-trigger glint

  function handleEnter() {
    setHovered(true)
    setGlintKey(k => k + 1)
  }

  return (
    <>
      <style>{`
        @keyframes ac-glint {
          0%   { transform: translateX(-180%) skewX(-18deg); opacity: 0;    }
          12%  {                                              opacity: 1;    }
          88%  {                                              opacity: 0.85; }
          100% { transform: translateX(280%)  skewX(-18deg); opacity: 0;    }
        }
        @keyframes ac-runway {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes ac-port {
          0%, 100% { opacity: 1;   box-shadow: 0 0 5px 1px rgba(193,2,48,0.9); }
          45%, 55% { opacity: 0.2; box-shadow: none; }
        }
        @keyframes ac-starboard {
          0%, 40%  { opacity: 0.2; box-shadow: none; }
          50%, 100%{ opacity: 1;   box-shadow: 0 0 5px 1px rgba(0,210,90,0.9); }
        }
      `}</style>

      <div
        className="card-elevated rounded-md flex flex-col"
        style={{
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          padding: "10px 14px 12px",
          gap: 0,
          border: `1px solid ${hovered ? "rgba(212,160,23,0.55)" : "rgba(255,255,255,0.08)"}`,
          transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
          transform: hovered ? "translateY(-5px)" : "translateY(0)",
          boxShadow: hovered
            ? "0 16px 40px rgba(0,0,0,0.55), 0 4px 12px rgba(212,160,23,0.12), 0 0 0 1px rgba(212,160,23,0.12)"
            : "0 2px 6px rgba(0,0,0,0.25)",
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onOpen(ac)}
      >

        {/* ── Single-shot aluminum glint — fires once on each hover entry ── */}
        <span
          key={glintKey}
          style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: 0,
            width: "35%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), rgba(255,255,255,0.11), rgba(255,255,255,0.07), transparent)",
            animation: hovered ? "ac-glint 0.5s ease-out forwards" : "none",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* ── Navigation lights — port (red) left, starboard (green) right ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          {/* Port — red, left wing */}
          <span
            title="Port"
            style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "#c10230",
              opacity: hovered ? 1 : 0,
              animation: hovered ? "ac-port 1.4s ease-in-out infinite" : "none",
              transition: "opacity 0.3s ease",
              flexShrink: 0,
            }}
          />

          {/* Tail number — expands confidently, no distortion */}
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.05rem",
              fontWeight: 600,
              color: hovered ? "#f2c040" : "var(--skyshare-gold)",
              letterSpacing: hovered ? "0.2em" : "0.12em",
              transition: "letter-spacing 0.3s ease, color 0.2s ease",
              position: "relative",
              zIndex: 1,
              flex: 1,
              textAlign: "center",
            }}
          >
            {ac.tailNumber}
          </div>

          {/* Starboard — green, right wing */}
          <span
            title="Starboard"
            style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "#00d25a",
              opacity: hovered ? 1 : 0,
              animation: hovered ? "ac-starboard 1.4s ease-in-out infinite" : "none",
              transition: "opacity 0.3s ease",
              flexShrink: 0,
            }}
          />
        </div>

        {/* S/N */}
        <div
          className="text-xs"
          style={{
            color: hovered ? "rgba(255,255,255,0.6)" : "hsl(var(--muted-foreground))",
            fontFamily: "'Courier Prime','Courier New',monospace",
            position: "relative",
            zIndex: 1,
            transition: "color 0.2s ease",
            textAlign: "center",
          }}
        >
          S/N&nbsp;{ac.serialNumber}
        </div>

        {/* Divider */}
        <div
          style={{
            height: "0.5px",
            background: hovered ? "rgba(212,160,23,0.6)" : "rgba(212,160,23,0.2)",
            margin: "5px 0",
            transition: "background 0.25s ease",
            position: "relative",
            zIndex: 1,
          }}
        />

        {/* Year */}
        <div
          className="text-xs"
          style={{
            color: hovered ? "rgba(255,255,255,0.55)" : "hsl(var(--muted-foreground))",
            letterSpacing: "0.04em",
            position: "relative",
            zIndex: 1,
            transition: "color 0.2s ease",
            textAlign: "center",
          }}
        >
          {ac.year}
        </div>

        {/* ── Runway bar — brand gradient slides in from left at card bottom ── */}
        {hovered && (
          <span
            style={{
              position: "absolute",
              bottom: 0, left: 0, right: 0,
              height: "2px",
              background: "linear-gradient(90deg, #c10230 0%, #d4a017 50%, #012e45 100%)",
              animation: "ac-runway 0.28s ease-out forwards",
              transformOrigin: "left center",
              zIndex: 3,
            }}
          />
        )}
      </div>
    </>
  )
}

// ─── Model Family Block ────────────────────────────────────────────────────────
function FamilyBlock({ family, label, onOpen }: {
  family: AircraftBase[]
  label: string
  onOpen: (ac: AircraftBase) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div style={{ width: 3, height: 14, borderRadius: 2, background: "rgba(212,160,23,0.5)", flexShrink: 0 }} />
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
        >
          {label}
        </span>
        <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
          · {family.length} aircraft
        </span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
        {family.map(ac => (
          <AircraftCard key={ac.tailNumber} ac={ac} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

// ─── Manufacturer Section ──────────────────────────────────────────────────────
function ManufacturerSection({ group, onOpen }: {
  group: ManufacturerGroup
  onOpen: (ac: AircraftBase) => void
}) {
  const total = group.families.reduce((s, f) => s + f.aircraft.length, 0)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-baseline gap-3">
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.45rem",
              letterSpacing: "0.08em",
              color: "hsl(var(--foreground))",
              lineHeight: 1,
            }}
          >
            {group.manufacturer}
          </h2>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{
              background: "rgba(212,160,23,0.12)",
              color: "var(--skyshare-gold)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.06em",
            }}
          >
            {total}
          </span>
        </div>
        <div
          style={{
            height: "1px",
            marginTop: "0.5rem",
            background: "linear-gradient(to right, rgba(212,160,23,0.4), transparent)",
          }}
        />
      </div>

      <div className="flex flex-col gap-6 pl-1">
        {group.families.map(f => (
          <FamilyBlock key={f.family} label={f.family} family={f.aircraft} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────
function FleetSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {[1, 2].map(i => (
        <div key={i} className="flex flex-col gap-5">
          <div>
            <div className="h-6 w-48 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div style={{ height: "1px", marginTop: "0.5rem", background: "rgba(212,160,23,0.15)" }} />
          </div>
          <div className="grid gap-2 pl-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="rounded-md px-4 py-3 h-20 animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AircraftInfo() {
  const [selected, setSelected] = useState<AircraftBase | null>(null)
  const { data: fleet, isLoading, isError } = useFleet()

  function openSelected(ac: AircraftBase) {
    setSelected(ac)
    window.history.pushState({ aircraftDetail: true }, "")
  }

  useEffect(() => {
    if (!selected) return
    const handlePop = () => setSelected(null)
    window.addEventListener("popstate", handlePop)
    return () => window.removeEventListener("popstate", handlePop)
  }, [selected])

  const detail = selected ? AIRCRAFT_DETAILS[selected.tailNumber] : null
  const totalAircraft = fleet?.reduce((sum, g) => sum + g.families.reduce((s, f) => s + f.aircraft.length, 0), 0) ?? "—"

  return (
    <>
      <div className="flex flex-col gap-8 p-6">

        {/* Hero */}
        <div className="hero-area flex items-end justify-between">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
            >
              Fleet Directory
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2rem",
                letterSpacing: "0.08em",
                color: "hsl(var(--foreground))",
                lineHeight: 1,
              }}
            >
              Aircraft Info
            </h1>
          </div>
          <div className="text-right">
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2rem",
                letterSpacing: "0.06em",
                color: "var(--skyshare-gold)",
                lineHeight: 1,
              }}
            >
              {totalAircraft}
            </div>
            <div
              className="text-xs uppercase tracking-widest"
              style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
            >
              Aircraft
            </div>
          </div>
        </div>

        {/* Fleet */}
        {isLoading && <FleetSkeleton />}
        {isError && (
          <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            Failed to load fleet data.
          </p>
        )}
        {fleet?.map(group => (
          <ManufacturerSection key={group.manufacturer} group={group} onOpen={openSelected} />
        ))}

      </div>

      {/* Detail overlay — mounts over the full layout */}
      {selected && detail && (
        <AircraftDetailOverlay
          aircraft={selected}
          detail={detail}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
