import { useState } from "react"
import { FLEET, TOTAL_AIRCRAFT, AIRCRAFT_DETAILS } from "./aircraft/fleetData"
import type { AircraftBase } from "./aircraft/fleetData"
import AircraftDetailOverlay from "./aircraft/AircraftDetailOverlay"

// ─── Aircraft Card ─────────────────────────────────────────────────────────────
function AircraftCard({ ac, onOpen }: { ac: AircraftBase; onOpen: (ac: AircraftBase) => void }) {
  return (
    <div
      className="card-elevated card-hoverable rounded-md px-4 py-3 flex flex-col gap-1"
      style={{ cursor: "pointer" }}
      onClick={() => onOpen(ac)}
    >
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.05rem",
          color: "var(--skyshare-gold)",
          letterSpacing: "0.12em",
          fontWeight: 600,
        }}
      >
        {ac.tailNumber}
      </div>

      <div
        className="text-xs"
        style={{
          color: "hsl(var(--muted-foreground))",
          fontFamily: "'Courier Prime','Courier New',monospace",
        }}
      >
        S/N &nbsp;{ac.serialNumber}
      </div>

      <div style={{ height: "0.5px", background: "rgba(212,160,23,0.2)", margin: "2px 0" }} />

      <div
        className="text-xs"
        style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.04em" }}
      >
        {ac.year}
      </div>
    </div>
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
  group: typeof FLEET[number]
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

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AircraftInfo() {
  const [selected, setSelected] = useState<AircraftBase | null>(null)

  const detail = selected ? AIRCRAFT_DETAILS[selected.tailNumber] : null

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
              {TOTAL_AIRCRAFT}
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
        {FLEET.map(group => (
          <ManufacturerSection key={group.manufacturer} group={group} onOpen={setSelected} />
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
