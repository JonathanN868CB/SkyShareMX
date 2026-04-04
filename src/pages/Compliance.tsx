import { useState } from "react"
import { Plane, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { FLEET } from "@/pages/aircraft/fleetData"
import MmAuditSection from "@/features/mm-audit/MmAuditSection"

// ─── Color token ─────────────────────────────────────────────────────────────
const C = "#a78bfa" // violet-400 — compliance accent
const rgba = (a: number) => `rgba(167,139,250,${a})`

// ─── Fleet registration metadata ─────────────────────────────────────────────
// Tail numbers and aircraft types are sourced directly from fleetData.ts.
// Add compliance-specific fields here — update as registration info is confirmed.
type RegMeta = { owner: string; fraction: string; regExpiry: string; status: string; notes: string }

const regMeta: Record<string, RegMeta> = {
  // Pilatus PC-12/45 Legacy
  "N499CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N515RP": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N870CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Pilatus PC-12/47 Legacy
  "N739S":  { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N863CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Pilatus PC-12/47E NG
  "N963CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N413UU": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N477KR": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N418T":  { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Pilatus PC-12/47E NGX
  "N511DR": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Cessna Citation CJ2
  "N868CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N871CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N744CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Cessna Citation 560XL / XLS+
  "N766CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N606CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N6TM":   { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Cessna Citation M2 Gen2
  "N785PD": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Gulfstream G200
  "N860CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N861CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N612FA": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Gulfstream G450
  "N663CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  "N787JS": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Gulfstream GV
  "N563CB": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Embraer Phenom 100
  "N450JF": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Embraer Phenom 300E
  "N409KG": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
  // Embraer Legacy 650
  "N650JF": { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" },
}

const fallbackMeta: RegMeta = { owner: "—", fraction: "—", regExpiry: "—", status: "Current", notes: "" }

// ─── Status Chip ──────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Current:  { bg: "rgba(16,185,129,0.1)",  color: "#10b981" },
    Review:   { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b" },
    Overdue:  { bg: "rgba(239,68,68,0.1)",   color: "#f87171" },
    Pending:  { bg: "rgba(167,139,250,0.1)", color: "#a78bfa" },
    Planning: { bg: "rgba(96,165,250,0.1)",  color: "#60a5fa" },
  }
  const s = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase"
      style={{ background: s.bg, color: s.color, fontFamily: "var(--font-heading)" }}
    >
      {status}
    </span>
  )
}

// ─── Registration Aircraft Card ───────────────────────────────────────────────
function RegCard({ tailNumber, model, meta }: { tailNumber: string; model: string; meta: RegMeta }) {
  return (
    <div
      className="card-elevated rounded-md px-4 py-3 flex flex-col gap-1.5"
      style={{ border: `1px solid ${rgba(0.08)}` }}
    >
      <div className="flex items-start justify-between gap-1">
        <div
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "1.05rem",
            color: C,
            letterSpacing: "0.12em",
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {tailNumber}
        </div>
        <StatusChip status={meta.status} />
      </div>

      <div
        className="text-xs"
        style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.03em" }}
      >
        {model}
      </div>

      {meta.regExpiry !== "—" && (
        <div
          className="text-[10px]"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}
        >
          Exp: {meta.regExpiry}
        </div>
      )}

      {meta.notes && (
        <div
          className="text-[10px] italic"
          style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}
        >
          {meta.notes}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Compliance() {
  const [regsOpen, setRegsOpen] = useState(true)

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="hero-area">
        <h1 className="text-[2.6rem] leading-none text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
          COMPLIANCE
        </h1>
        <div className="mt-2 mb-2" style={{ height: "1px", background: C, width: "3.5rem" }} />
        <p className="text-sm text-muted-foreground" style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          Manual Audits · Registrations · Program Oversight
        </p>
      </div>

      {/* ── MM Revision & Audit Tracking ──────────────────────────────────── */}
      <MmAuditSection />

      {/* ── Aircraft Registrations ────────────────────────────────────────── */}
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
        <CardHeader
          className="cursor-pointer select-none"
          style={{ paddingBottom: regsOpen ? "0.75rem" : "1rem" }}
          onClick={() => setRegsOpen(o => !o)}
          onMouseEnter={e => (e.currentTarget.style.background = rgba(0.04))}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: rgba(0.1) }}>
                <Plane className="h-4 w-4" style={{ color: C }} />
              </div>
              <CardTitle style={{ fontFamily: "var(--font-heading)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C }}>
                Aircraft Registrations
              </CardTitle>
            </div>
            <ChevronRight
              className="h-4 w-4 transition-transform duration-200 flex-shrink-0"
              style={{ color: C, transform: regsOpen ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          </div>
        </CardHeader>

        {regsOpen && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-6" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
              Fractional fleet — registrations are actively managed as ownership shares transfer. Verify status before any registration-sensitive task.
            </p>

            <div className="flex flex-col gap-8">
              {FLEET.map(mfr => {
                const total = mfr.families.reduce((s, f) => s + f.aircraft.length, 0)
                return (
                  <div key={mfr.manufacturer} className="flex flex-col gap-5">

                    {/* Manufacturer header */}
                    <div>
                      <div className="flex items-baseline gap-3">
                        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", letterSpacing: "0.08em", color: "hsl(var(--foreground))", lineHeight: 1 }}>
                          {mfr.manufacturer}
                        </h2>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{ background: rgba(0.12), color: C, fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
                        >
                          {total}
                        </span>
                      </div>
                      <div style={{ height: "1px", marginTop: "0.5rem", background: `linear-gradient(to right, ${rgba(0.4)}, transparent)` }} />
                    </div>

                    {/* Family blocks */}
                    <div className="flex flex-col gap-5 pl-1">
                      {mfr.families.map(fam => (
                        <div key={fam.family} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <div style={{ width: 3, height: 14, borderRadius: 2, background: rgba(0.5), flexShrink: 0 }} />
                            <span
                              className="text-xs font-semibold uppercase tracking-widest"
                              style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}
                            >
                              {fam.family}
                            </span>
                            <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
                              · {fam.aircraft.length} aircraft
                            </span>
                          </div>
                          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                            {fam.aircraft.map(ac => {
                              const meta = regMeta[ac.tailNumber] ?? fallbackMeta
                              return (
                                <RegCard
                                  key={ac.tailNumber}
                                  tailNumber={ac.tailNumber}
                                  model={ac.model}
                                  meta={meta}
                                />
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>

    </div>
  )
}
