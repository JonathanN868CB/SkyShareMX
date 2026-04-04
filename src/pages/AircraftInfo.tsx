import { useState, useEffect } from "react"
import { AIRCRAFT_DETAILS } from "./aircraft/fleetData"
import type { AircraftBase, ManufacturerGroup } from "./aircraft/fleetData"
import AircraftDetailOverlay from "./aircraft/AircraftDetailOverlay"
import { useFleet } from "./aircraft/useFleet"

// ─── Aircraft Card ─────────────────────────────────────────────────────────────
function AircraftCard({ ac, onOpen }: { ac: AircraftBase; onOpen: (ac: AircraftBase) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <>
      {/* Keyframes — injected once per page, React dedupes */}
      <style>{`
        @keyframes ac-holo {
          0%   { background-position: 0% 50%;   }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%;   }
        }
        @keyframes ac-chroma {
          0%, 100% { text-shadow: -1.5px 0 rgba(193,2,48,0.55), 1.5px 0 rgba(0,180,255,0.45); }
          50%       { text-shadow:  1.5px 0 rgba(193,2,48,0.55), -1.5px 0 rgba(0,180,255,0.45); }
        }
        @keyframes ac-scan {
          0%   { transform: translateY(-100%); opacity: 0;    }
          10%  {                               opacity: 0.55;  }
          90%  {                               opacity: 0.55;  }
          100% { transform: translateY(200%); opacity: 0;    }
        }
      `}</style>

      <div
        className="card-elevated rounded-md px-4 py-3 flex flex-col gap-1"
        style={{
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          transition: "transform 0.18s ease, box-shadow 0.2s ease, border-color 0.2s ease",
          transform: hovered ? "translateY(-2px) scale(1.015)" : "translateY(0) scale(1)",
          boxShadow: hovered
            ? "0 8px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,160,23,0.35), 0 0 18px rgba(193,2,48,0.12)"
            : "0 2px 8px rgba(0,0,0,0.3)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onOpen(ac)}
      >
        {/* Holographic shimmer layer */}
        {hovered && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(125deg, transparent 20%, rgba(193,2,48,0.07) 30%, rgba(212,160,23,0.09) 42%, rgba(0,180,255,0.07) 54%, rgba(1,46,69,0.06) 64%, transparent 74%)",
              backgroundSize: "300% 300%",
              animation: "ac-holo 2s ease infinite",
              pointerEvents: "none",
              borderRadius: "inherit",
            }}
          />
        )}

        {/* Scan line */}
        {hovered && (
          <span
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(212,160,23,0.5), transparent)",
              animation: "ac-scan 1.6s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Tail number with chromatic aberration on hover */}
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.05rem",
            color: "var(--skyshare-gold)",
            letterSpacing: "0.12em",
            fontWeight: 600,
            position: "relative",
            zIndex: 1,
            animation: hovered ? "ac-chroma 1.4s ease-in-out infinite" : "none",
            transition: "letter-spacing 0.2s ease",
          }}
        >
          {ac.tailNumber}
        </div>

        <div
          className="text-xs"
          style={{
            color: hovered ? "rgba(255,255,255,0.55)" : "hsl(var(--muted-foreground))",
            fontFamily: "'Courier Prime','Courier New',monospace",
            position: "relative",
            zIndex: 1,
            transition: "color 0.2s ease",
          }}
        >
          S/N &nbsp;{ac.serialNumber}
        </div>

        <div
          style={{
            height: "0.5px",
            background: hovered ? "rgba(212,160,23,0.5)" : "rgba(212,160,23,0.2)",
            margin: "2px 0",
            transition: "background 0.2s ease",
            position: "relative",
            zIndex: 1,
          }}
        />

        <div
          className="text-xs"
          style={{
            color: hovered ? "rgba(255,255,255,0.5)" : "hsl(var(--muted-foreground))",
            letterSpacing: "0.04em",
            position: "relative",
            zIndex: 1,
            transition: "color 0.2s ease",
          }}
        >
          {ac.year}
        </div>
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
