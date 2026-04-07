import { useState } from "react"
import { X, AlertTriangle } from "lucide-react"
import type { AircraftTimesSnapshot } from "../../types"

// ─── Sub-component: Times card shell ─────────────────────────────────────────
export function TimesCard({ title, color, subtitle, children }: {
  title: string; color: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,20%)", borderTop: `3px solid ${color}` }}>
      <div className="px-5 py-3" style={{ background: `${color}10`, borderBottom: "1px solid hsl(0,0%,19%)" }}>
        <span className="text-sm font-bold uppercase tracking-widest" style={{ color, fontFamily: "var(--font-heading)" }}>{title}</span>
        {subtitle && <span className="ml-2 text-[10px] text-white/25" style={{ fontFamily: "var(--font-heading)" }}>— {subtitle}</span>}
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  )
}

// ─── Sub-component: Times row with always-visible stepper ────────────────────
export function TimesRow({ label, value, unit, step, onChange }: {
  label: string; value: string; unit: string; step: string; onChange: (v: string) => void
}) {
  const stepNum = parseFloat(step) || 1
  function nudge(dir: 1 | -1) {
    const cur = parseFloat(value)
    const next = isNaN(cur) ? (dir > 0 ? stepNum : 0) : Math.round((cur + dir * stepNum) * 10000) / 10000
    onChange(String(next))
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-white/50 text-xs leading-tight flex-1" style={{ fontFamily: "var(--font-heading)" }}>{label}</label>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="flex items-stretch rounded-lg overflow-hidden w-32"
          style={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,34%)" }}
        >
          <input
            type="number"
            step={step}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="—"
            className="flex-1 min-w-0 text-center text-white text-sm font-mono focus:outline-none bg-transparent py-1.5 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{ colorScheme: "dark" }}
          />
          <div
            className="flex flex-col flex-shrink-0"
            style={{ borderLeft: "1px solid hsl(0,0%,28%)", background: "hsl(0,0%,17%)", width: "22px" }}
          >
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); nudge(1) }}
              className="flex-1 flex items-center justify-center transition-colors hover:bg-white/10 active:bg-white/20"
              style={{ borderBottom: "1px solid hsl(0,0%,24%)" }}
            >
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
                <path d="M1 4L4 1L7 4" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); nudge(-1) }}
              className="flex-1 flex items-center justify-center transition-colors hover:bg-white/10 active:bg-white/20"
            >
              <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
                <path d="M1 1L4 4L7 1" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        {unit
          ? <span className="text-white/30 text-xs w-6">{unit}</span>
          : <span className="w-6" />
        }
      </div>
    </div>
  )
}

// ─── Sub-component: Delta stepper (flight adjustment) ────────────────────────
export function DeltaStepper({ value, step, onChange }: { value: string; step: number; onChange: (v: string) => void }) {
  function nudge(dir: 1 | -1) {
    const cur = parseFloat(value)
    const next = isNaN(cur) ? (dir > 0 ? step : 0) : Math.round((cur + dir * step) * 10000) / 10000
    onChange(String(next))
  }
  return (
    <div
      className="flex items-stretch rounded-lg overflow-hidden"
      style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,32%)", width: "90px" }}
    >
      <input
        type="number"
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className="flex-1 min-w-0 text-center text-white text-sm font-mono focus:outline-none bg-transparent py-1.5 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={{ colorScheme: "dark" }}
      />
      <div
        className="flex flex-col flex-shrink-0"
        style={{ borderLeft: "1px solid hsl(0,0%,28%)", background: "hsl(0,0%,20%)", width: "22px" }}
      >
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); nudge(1) }}
          className="flex-1 flex items-center justify-center transition-colors hover:bg-white/10 active:bg-white/20"
          style={{ borderBottom: "1px solid hsl(0,0%,26%)" }}
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
            <path d="M1 4L4 1L7 4" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); nudge(-1) }}
          className="flex-1 flex items-center justify-center transition-colors hover:bg-white/10 active:bg-white/20"
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
            <path d="M1 1L4 4L7 1" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Sub-component: Serial number text row ───────────────────────────────────
function SerialRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-white/50 text-xs leading-tight flex-1" style={{ fontFamily: "var(--font-heading)" }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        className="w-32 text-center text-white text-sm font-mono focus:outline-none bg-transparent rounded-lg py-1.5 px-2"
        style={{ background: "hsl(0,0%,10%)", border: "1px solid hsl(0,0%,34%)" }}
      />
      <span className="w-6" />
    </div>
  )
}

// ─── Internal edit draft type ────────────────────────────────────────────────
type TimesEditDraft = {
  airframeHrs: string; landings: string
  eng1Tsn: string; eng1Csn: string; eng1Serial: string
  eng2Tsn: string; eng2Csn: string; eng2Serial: string
  propTsn: string; propCsn: string; propSerial: string
  apuHrs:  string; apuStarts: string; apuSerial: string
  hobbs:   string
}

function snapshotToEditDraft(t: AircraftTimesSnapshot | null): TimesEditDraft {
  const s = (v: number | null | undefined) => v != null ? String(v) : ""
  return {
    airframeHrs: s(t?.airframeHrs), landings: s(t?.landings),
    eng1Tsn: s(t?.eng1Tsn), eng1Csn: s(t?.eng1Csn), eng1Serial: t?.eng1Serial ?? "",
    eng2Tsn: s(t?.eng2Tsn), eng2Csn: s(t?.eng2Csn), eng2Serial: t?.eng2Serial ?? "",
    propTsn: s(t?.propTsn), propCsn: s(t?.propCsn), propSerial: t?.propSerial ?? "",
    apuHrs:  s(t?.apuHrs),  apuStarts: s(t?.apuStarts), apuSerial: t?.apuSerial ?? "",
    hobbs:   s(t?.hobbs),
  }
}

function editDraftToSnapshot(d: TimesEditDraft, prevWarnings: string[]): AircraftTimesSnapshot {
  const n = (s: string) => { const v = parseFloat(s); return isNaN(v) ? null : v }
  const str = (s: string) => s.trim() || null
  return {
    airframeHrs: n(d.airframeHrs), landings: n(d.landings),
    eng1Tsn: n(d.eng1Tsn), eng1Csn: n(d.eng1Csn), eng1Serial: str(d.eng1Serial),
    eng2Tsn: n(d.eng2Tsn), eng2Csn: n(d.eng2Csn), eng2Serial: str(d.eng2Serial),
    propTsn: n(d.propTsn), propCsn: n(d.propCsn), propSerial: str(d.propSerial),
    apuHrs:  n(d.apuHrs),  apuStarts: n(d.apuStarts), apuSerial: str(d.apuSerial),
    hobbs:   n(d.hobbs),
    parseWarnings: prevWarnings,
  }
}

// ─── Main export: Times Edit Modal ───────────────────────────────────────────
export interface TimesEditModalProps {
  open: boolean
  onClose: () => void
  /** Display label shown in the modal subtitle, e.g. "N863CB — Cirrus SR22T" */
  aircraftLabel: string
  /** Current snapshot, used to seed the edit fields */
  initialTimes: AircraftTimesSnapshot | null
  /** Hobbs differential from aircraft_details; null = not configured */
  hobbsDiff: number | null
  /** Called with the confirmed new snapshot */
  onConfirm: (times: AircraftTimesSnapshot) => void
}

export function TimesEditModal({ open, onClose, aircraftLabel, initialTimes, hobbsDiff, onConfirm }: TimesEditModalProps) {
  const [edits,      setEdits]      = useState<TimesEditDraft>(() => snapshotToEditDraft(initialTimes))
  const [deltaHrs,   setDeltaHrs]   = useState("")
  const [deltaCycles, setDeltaCycles] = useState("")

  // Re-seed edits whenever the modal is opened with new data
  const [lastInitial, setLastInitial] = useState(initialTimes)
  if (open && initialTimes !== lastInitial) {
    setLastInitial(initialTimes)
    setEdits(snapshotToEditDraft(initialTimes))
    setDeltaHrs("")
    setDeltaCycles("")
  }

  function applyDelta() {
    const dh = parseFloat(deltaHrs)   || 0
    const dc = parseFloat(deltaCycles) || 0
    const addH = (s: string) => { const v = parseFloat(s); return isNaN(v) ? s : String(Math.round((v + dh) * 10) / 10) }
    const addC = (s: string) => { const v = parseFloat(s); return isNaN(v) ? s : String(Math.round(v + dc)) }
    setEdits(p => ({
      ...p,
      airframeHrs: addH(p.airframeHrs),
      hobbs:       addH(p.hobbs),
      eng1Tsn:     addH(p.eng1Tsn),
      eng2Tsn:     addH(p.eng2Tsn),
      propTsn:     addH(p.propTsn),
      apuHrs:      addH(p.apuHrs),
      landings:    addC(p.landings),
      eng1Csn:     addC(p.eng1Csn),
      eng2Csn:     addC(p.eng2Csn),
      propCsn:     addC(p.propCsn),
      apuStarts:   addC(p.apuStarts),
    }))
    setDeltaHrs("")
    setDeltaCycles("")
  }

  function handleConfirm() {
    onConfirm(editDraftToSnapshot(edits, initialTimes?.parseWarnings ?? []))
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative rounded-2xl shadow-2xl overflow-y-auto"
        style={{
          background: "hsl(0,0%,11%)",
          border: "1px solid hsl(0,0%,24%)",
          width: "min(860px, 96vw)",
          maxHeight: "90vh",
        }}
      >
        {/* Modal header */}
        <div className="px-8 py-5" style={{ borderBottom: "1px solid hsl(0,0%,18%)" }}>
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.06em" }}>
                Aircraft Times &amp; Cycles
              </h2>
              <p className="text-white/40 text-sm mt-0.5">
                {aircraftLabel}
              </p>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Flight adjustment row */}
          <div
            className="flex items-center gap-4 px-4 py-3 rounded-xl"
            style={{ background: "hsl(0,0%,8%)", border: "1px solid hsl(0,0%,22%)" }}
          >
            <div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>
                Unclosed Flight Adjustment
              </p>
              <p className="text-white/30 text-[10px] mt-0.5">Add one flight's delta to all applicable fields simultaneously</p>
            </div>
            <div className="flex flex-col gap-2 ml-auto flex-shrink-0">
              <p className="text-right text-[10px] italic" style={{ color: "rgba(212,160,23,0.45)", fontFamily: "var(--font-heading)" }}>
                If you had to use this, complain loudly.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs" style={{ fontFamily: "var(--font-heading)" }}>Δ Hours</span>
                  <DeltaStepper step={0.1} value={deltaHrs} onChange={setDeltaHrs} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-xs" style={{ fontFamily: "var(--font-heading)" }}>Δ Cycles</span>
                  <DeltaStepper step={1} value={deltaCycles} onChange={setDeltaCycles} />
                </div>
                <button
                  onClick={applyDelta}
                  disabled={!deltaHrs && !deltaCycles}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                  style={{
                    background: (deltaHrs || deltaCycles) ? "var(--skyshare-gold)" : "hsl(0,0%,18%)",
                    color:      (deltaHrs || deltaCycles) ? "#000" : "hsl(0,0%,35%)",
                  }}
                >
                  Apply to All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Parse warnings banner */}
        {initialTimes?.parseWarnings && initialTimes.parseWarnings.length > 0 && (
          <div className="mx-8 mt-5 flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.25)" }}>
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-xs font-semibold mb-0.5" style={{ fontFamily: "var(--font-heading)" }}>Some values could not be auto-detected</p>
              {initialTimes.parseWarnings.map((w, i) => (
                <p key={i} className="text-amber-400/70 text-xs">{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Component sections */}
        <div className="px-8 py-6 grid grid-cols-2 gap-5">

          {/* ── Airframe ── */}
          <TimesCard title="Airframe" color="#d4a017">
            <TimesRow label="Total Time (TT)" unit="hrs" step="0.1"
              value={edits.airframeHrs}
              onChange={v => setEdits(p => ({ ...p, airframeHrs: v }))} />
            <TimesRow label="Total Landings" unit="" step="1"
              value={edits.landings}
              onChange={v => setEdits(p => ({ ...p, landings: v }))} />
          </TimesCard>

          {/* ── Hobbs ── */}
          <TimesCard title="Hobbs Meter" color="#34d399">
            <TimesRow label="Current Reading" unit="hrs" step="0.1"
              value={edits.hobbs}
              onChange={v => setEdits(p => ({ ...p, hobbs: v }))} />
            {(() => {
              const hobbsVal = parseFloat(edits.hobbs)
              const afVal    = parseFloat(edits.airframeHrs)
              if (hobbsDiff != null && !isNaN(hobbsVal)) {
                const expected = Math.round((hobbsVal + hobbsDiff) * 10) / 10
                const delta    = !isNaN(afVal) ? Math.round((afVal - expected) * 10) / 10 : null
                return (
                  <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px solid hsl(0,0%,20%)" }}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-white/35" style={{ fontFamily: "var(--font-heading)" }}>
                        Hobbs + Diff ({hobbsDiff > 0 ? "+" : ""}{hobbsDiff}) =
                      </span>
                      <span className="font-mono text-emerald-400/80">{expected.toLocaleString()} hrs</span>
                    </div>
                    {delta != null && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-white/35" style={{ fontFamily: "var(--font-heading)" }}>vs A/F TT Δ</span>
                        <span className={`font-mono font-bold ${Math.abs(delta) > 2 ? "text-amber-400" : "text-emerald-400/70"}`}>
                          {delta > 0 ? "+" : ""}{delta} hrs
                          {Math.abs(delta) > 2 && " ⚠"}
                        </span>
                      </div>
                    )}
                  </div>
                )
              }
              if (hobbsDiff == null) {
                return (
                  <div className="mt-2 pt-2" style={{ borderTop: "1px solid hsl(0,0%,20%)" }}>
                    <p className="text-white/20 text-[10px] italic leading-snug">
                      No differential configured — set in Aircraft Info admin to enable comparison
                    </p>
                  </div>
                )
              }
              return null
            })()}
          </TimesCard>

          {/* ── Engine 1 ── */}
          <TimesCard title="Engine 1" color="#60a5fa">
            <SerialRow label="Serial Number" value={edits.eng1Serial}
              onChange={v => setEdits(p => ({ ...p, eng1Serial: v }))} />
            <TimesRow label="Time Since New (TSN)" unit="hrs" step="0.1"
              value={edits.eng1Tsn}
              onChange={v => setEdits(p => ({ ...p, eng1Tsn: v }))} />
            <TimesRow label="Cycles Since New (ENC)" unit="" step="1"
              value={edits.eng1Csn}
              onChange={v => setEdits(p => ({ ...p, eng1Csn: v }))} />
          </TimesCard>

          {/* ── Engine 2 ── */}
          <TimesCard title="Engine 2" color="#93c5fd" subtitle="Leave blank if single-engine">
            <SerialRow label="Serial Number" value={edits.eng2Serial}
              onChange={v => setEdits(p => ({ ...p, eng2Serial: v }))} />
            <TimesRow label="Time Since New (TSN)" unit="hrs" step="0.1"
              value={edits.eng2Tsn}
              onChange={v => setEdits(p => ({ ...p, eng2Tsn: v }))} />
            <TimesRow label="Cycles Since New (ENC)" unit="" step="1"
              value={edits.eng2Csn}
              onChange={v => setEdits(p => ({ ...p, eng2Csn: v }))} />
          </TimesCard>

          {/* ── Propeller ── */}
          <TimesCard title="Propeller" color="#6ee7b7" subtitle="Leave blank if jet">
            <SerialRow label="Serial Number" value={edits.propSerial}
              onChange={v => setEdits(p => ({ ...p, propSerial: v }))} />
            <TimesRow label="Time Since New (TSN)" unit="hrs" step="0.1"
              value={edits.propTsn}
              onChange={v => setEdits(p => ({ ...p, propTsn: v }))} />
            <TimesRow label="Cycles Since New" unit="" step="1"
              value={edits.propCsn}
              onChange={v => setEdits(p => ({ ...p, propCsn: v }))} />
          </TimesCard>

          {/* ── APU ── */}
          <TimesCard title="APU" color="#c4b5fd" subtitle="Leave blank if no APU">
            <SerialRow label="Serial Number" value={edits.apuSerial}
              onChange={v => setEdits(p => ({ ...p, apuSerial: v }))} />
            <TimesRow label="APU Hours" unit="hrs" step="0.1"
              value={edits.apuHrs}
              onChange={v => setEdits(p => ({ ...p, apuHrs: v }))} />
            <TimesRow label="APU Starts / Cycles" unit="" step="1"
              value={edits.apuStarts}
              onChange={v => setEdits(p => ({ ...p, apuStarts: v }))} />
          </TimesCard>

        </div>

        {/* Modal footer */}
        <div
          className="flex items-center justify-between px-8 py-5 sticky bottom-0"
          style={{ borderTop: "1px solid hsl(0,0%,18%)", background: "hsl(0,0%,11%)" }}
        >
          <p className="text-white/25 text-xs" style={{ fontFamily: "var(--font-heading)" }}>
            Blank fields are excluded — enter only what applies to this aircraft
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm text-white/50 hover:text-white/80 transition-colors"
              style={{ background: "hsl(0,0%,17%)", border: "1px solid hsl(0,0%,26%)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-8 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: "var(--skyshare-gold)", color: "#000", boxShadow: "0 0 20px rgba(212,160,23,0.3)" }}
            >
              Apply Times
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
