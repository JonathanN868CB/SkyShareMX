import React, { useEffect, useState } from "react"
import type { DataField } from "./fleetData"
import { supabase } from "@/lib/supabase"

interface Props {
  initialPowerplant: DataField[]
  initialApu: DataField[] | null
  initialHobbsDiff: number | null
  tailNumber: string
  aircraftId: string
  onSave: (powerplant: DataField[], apu: DataField[] | null, hobbsDiff: number | null) => Promise<void>
  onClose: () => void
}

interface ClientOption {
  id: string
  name: string
  address: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  taxable: boolean
  inactive: boolean
}

// ─── Pattern types ─────────────────────────────────────────────────────────────
type Pattern = "A" | "B" | "C"

const PATTERN_OPTIONS: { value: Pattern; label: string }[] = [
  { value: "A", label: "Pattern A — Single Engine + Propeller" },
  { value: "B", label: "Pattern B — Twin Engine, No APU" },
  { value: "C", label: "Pattern C — Twin Engine + APU" },
]

interface EditRow {
  displayLabel: string   // "ENG", "PROP", "ENG 1", "ENG 2", "APU"
  fieldPrefix: string    // "Engine 1", "Propeller 1", "APU 1", etc.
  unitType: "engine" | "prop" | "apu"
  model: string
  sn: string
  note: string
}

function getDefaultRows(pattern: Pattern): EditRow[] {
  switch (pattern) {
    case "A": return [
      { displayLabel: "ENG",  fieldPrefix: "Engine 1",    unitType: "engine", model: "—", sn: "—", note: "—" },
      { displayLabel: "PROP", fieldPrefix: "Propeller 1", unitType: "prop",   model: "—", sn: "—", note: "—" },
    ]
    case "B": return [
      { displayLabel: "ENG 1", fieldPrefix: "Engine 1", unitType: "engine", model: "—", sn: "—", note: "—" },
      { displayLabel: "ENG 2", fieldPrefix: "Engine 2", unitType: "engine", model: "—", sn: "—", note: "—" },
    ]
    case "C": return [
      { displayLabel: "ENG 1", fieldPrefix: "Engine 1", unitType: "engine", model: "—", sn: "—", note: "—" },
      { displayLabel: "ENG 2", fieldPrefix: "Engine 2", unitType: "engine", model: "—", sn: "—", note: "—" },
      { displayLabel: "APU",   fieldPrefix: "APU 1",    unitType: "apu",    model: "—", sn: "—", note: "—" },
    ]
  }
}

function detectPattern(powerplant: DataField[], apu: DataField[] | null): Pattern {
  const hasProp = powerplant.some(f => /^propeller\s/i.test(f.label) || f.label.toLowerCase() === "propeller model")
  const hasApu  = apu !== null && apu.length > 0
  const engNums = [...new Set(
    powerplant
      .map(f => { const m = f.label.match(/^Engine\s+(\d+)\b/i); return m ? parseInt(m[1]) : 0 })
      .filter(n => n > 0)
  )]
  const isTwin = engNums.length > 1
  if (hasProp) return "A"
  if (hasApu || isTwin) return hasApu ? "C" : "B"
  return "B"
}

function loadRows(pattern: Pattern, powerplant: DataField[], apu: DataField[] | null): EditRow[] {
  const allFields = [...powerplant, ...(apu ?? [])]
  function fv(label: string) {
    return allFields.find(f => f.label === label)?.value ?? "—"
  }
  return getDefaultRows(pattern).map(row => ({
    ...row,
    model: fv(`${row.fieldPrefix} Model`),
    sn:    fv(`${row.fieldPrefix} S/N`),
    note:  fv(`${row.fieldPrefix} Descriptor`),
  }))
}

// When switching patterns, preserve matching rows' data
function applyPattern(newPattern: Pattern, currentRows: EditRow[]): EditRow[] {
  return getDefaultRows(newPattern).map(row => {
    const existing = currentRows.find(r => r.fieldPrefix === row.fieldPrefix)
    return existing ? { ...row, model: existing.model, sn: existing.sn, note: existing.note } : row
  })
}

function serializeRows(rows: EditRow[], initialPowerplant: DataField[], initialApu: DataField[] | null): {
  powerplant: DataField[]
  apu: DataField[] | null
} {
  const allExisting = [...initialPowerplant, ...(initialApu ?? [])]
  function existingVal(label: string) {
    return allExisting.find(f => f.label === label)?.value ?? "—"
  }

  const engineRows = rows.filter(r => r.unitType === "engine")
  const propRows   = rows.filter(r => r.unitType === "prop")
  const apuRows    = rows.filter(r => r.unitType === "apu")

  const powerplant: DataField[] = [
    ...engineRows.flatMap(r => [
      { label: `${r.fieldPrefix} Manufacturer`, value: existingVal(`${r.fieldPrefix} Manufacturer`) },
      { label: `${r.fieldPrefix} Model`,        value: r.model || "—" },
      { label: `${r.fieldPrefix} S/N`,          value: r.sn    || "—" },
      { label: `${r.fieldPrefix} Descriptor`,   value: r.note  || "—" },
    ]),
    ...propRows.flatMap(r => [
      { label: `${r.fieldPrefix} Manufacturer`, value: existingVal(`${r.fieldPrefix} Manufacturer`) },
      { label: `${r.fieldPrefix} Blades`,       value: existingVal(`${r.fieldPrefix} Blades`) },
      { label: `${r.fieldPrefix} Model`,        value: r.model || "—" },
      { label: `${r.fieldPrefix} S/N`,          value: r.sn    || "—" },
      { label: `${r.fieldPrefix} Descriptor`,   value: r.note  || "—" },
    ]),
  ]

  const apu: DataField[] | null = apuRows.length > 0
    ? apuRows.flatMap(r => [
        { label: `${r.fieldPrefix} Manufacturer`, value: existingVal(`${r.fieldPrefix} Manufacturer`) },
        { label: `${r.fieldPrefix} Model`,        value: r.model || "—" },
        { label: `${r.fieldPrefix} S/N`,          value: r.sn    || "—" },
      ])
    : null

  return { powerplant, apu }
}

// ─── Shared input style ────────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(212,160,23,0.04)",
  border: "none",
  borderBottom: "1px solid rgba(212,160,23,0.35)",
  borderRadius: "2px 2px 0 0",
  color: "hsl(var(--foreground))",
  fontFamily: "var(--font-body)",
  outline: "none",
  fontSize: "0.8125rem",
  padding: "4px 6px",
}

// ─── Overlay ───────────────────────────────────────────────────────────────────
export default function PropulsionEditorOverlay({
  initialPowerplant, initialApu, initialHobbsDiff, tailNumber, aircraftId, onSave, onClose,
}: Props) {
  const [visible,   setVisible]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState("")

  const [pattern,   setPattern]   = useState<Pattern>(() => detectPattern(initialPowerplant, initialApu))
  const [rows,      setRows]      = useState<EditRow[]>(() =>
    loadRows(detectPattern(initialPowerplant, initialApu), initialPowerplant, initialApu)
  )
  const [hobbsDiff, setHobbsDiff] = useState(initialHobbsDiff != null ? String(initialHobbsDiff) : "")

  // ── Client assignment state ────────────────────────────────────────────────
  const [clientList, setClientList]   = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [initialClientId, setInitialClientId]   = useState<string | null>(null)
  const [clientLoading, setClientLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadClientData() {
      const [clientsRes, acRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, address, address2, city, state, zip, taxable, inactive")
          .order("name"),
        supabase
          .from("aircraft")
          .select("client_id")
          .eq("id", aircraftId)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (!clientsRes.error && clientsRes.data) {
        setClientList(clientsRes.data as ClientOption[])
      }
      const current = (acRes.data?.client_id as string | null) ?? null
      setSelectedClientId(current)
      setInitialClientId(current)
      setClientLoading(false)
    }
    loadClientData()
    return () => { cancelled = true }
  }, [aircraftId])

  const selectedClient = clientList.find(c => c.id === selectedClientId) ?? null

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function handleClose() { setVisible(false); setTimeout(onClose, 220) }

  function handlePatternChange(newPattern: Pattern) {
    setPattern(newPattern)
    setRows(prev => applyPattern(newPattern, prev))
  }

  function updateRow(i: number, field: keyof Pick<EditRow, "model" | "sn" | "note">, value: string) {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: value || "—" } : r))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    try {
      const { powerplant, apu } = serializeRows(rows, initialPowerplant, initialApu)
      const diffRaw = hobbsDiff.trim() !== "" ? parseFloat(hobbsDiff) : null
      const diff    = diffRaw != null && !isNaN(diffRaw) ? diffRaw : null
      await onSave(powerplant, apu, diff)

      // Persist client assignment if it changed
      if (selectedClientId !== initialClientId) {
        const { error: clientErr } = await supabase
          .from("aircraft")
          .update({ client_id: selectedClientId })
          .eq("id", aircraftId)
        if (clientErr) throw clientErr
      }

      setVisible(false)
      setTimeout(onClose, 220)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 55,
      background: "hsl(var(--background))", overflowY: "auto", overflowX: "hidden",
      opacity: visible ? 1 : 0,
      transform: visible ? "scale(1)" : "scale(0.97)",
      transition: "opacity 0.2s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <div style={{
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1) 0.04s",
        minHeight: "100%", display: "flex", flexDirection: "column",
      }}>

        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3"
          style={{
            background: "hsl(0 0% 10%)",
            borderBottom: "1px solid rgba(212,160,23,0.4)",
            boxShadow: "0 1px 0 0 rgba(212,160,23,0.06)",
          }}>
          <button onClick={handleClose}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded"
            style={{
              background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)",
              border: "0.5px solid rgba(212,160,23,0.3)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.08em", cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
            ← {tailNumber}
          </button>
          <span className="text-xs px-2 py-0.5 rounded"
            style={{
              background: "rgba(193,2,48,0.12)", color: "var(--skyshare-red-light)",
              border: "0.5px solid rgba(193,2,48,0.3)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.08em", flexShrink: 0,
            }}>
            Super Admin
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest flex-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            ✎ Hero Bar — Powerplant
          </span>
          <div className="flex items-center gap-2">
            {saveError && (
              <span className="text-xs px-2 py-1 rounded"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", fontFamily: "var(--font-heading)" }}>
                {saveError}
              </span>
            )}
            <button onClick={handleClose}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: "transparent", color: "hsl(var(--muted-foreground))",
                border: "0.5px solid hsl(var(--border))",
                fontFamily: "var(--font-heading)", letterSpacing: "0.06em", cursor: "pointer",
              }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", border: "none",
                fontFamily: "var(--font-heading)", letterSpacing: "0.06em", fontWeight: 600,
                opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer",
              }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6" style={{ flex: 1, maxWidth: 800 }}>

          {/* Pattern selector */}
          <div className="rounded-lg p-5 flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(212,160,23,0.2)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}>
              Powerplant Configuration
            </div>
            <div style={{ height: "0.5px", background: "rgba(212,160,23,0.15)" }} />
            <div>
              <div style={{
                fontSize: "0.6rem", fontFamily: "var(--font-heading)", textTransform: "uppercase",
                letterSpacing: "0.09em", color: "hsl(var(--muted-foreground))", opacity: 0.55, marginBottom: 4,
              }}>
                Layout Pattern
              </div>
              <select
                value={pattern}
                onChange={e => handlePatternChange(e.target.value as Pattern)}
                style={{
                  background: "hsl(var(--background))",
                  colorScheme: "dark light",
                  border: "none",
                  borderBottom: "1px solid rgba(212,160,23,0.5)",
                  borderRadius: "2px 2px 0 0",
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8125rem",
                  padding: "5px 8px",
                  outline: "none",
                  cursor: "pointer",
                  width: "100%",
                  maxWidth: 380,
                }}
                onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.5)")}>
                {PATTERN_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Edit grid — matches hero bar display layout */}
          <div className="rounded-lg p-5 flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(212,160,23,0.2)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}>
              Powerplant Details
            </div>
            <div style={{ height: "0.5px", background: "rgba(212,160,23,0.15)" }} />

            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 1fr 1.2fr",
              columnGap: 12,
              alignItems: "end",
              marginBottom: 2,
            }}>
              <div />
              {["Model", "Serial Number", "Note / Descriptor"].map(h => (
                <div key={h} style={{
                  fontSize: "0.6rem", fontFamily: "var(--font-heading)", textTransform: "uppercase",
                  letterSpacing: "0.09em", color: "hsl(var(--muted-foreground))", opacity: 0.55,
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "56px 1fr 1fr 1.2fr",
              columnGap: 12,
              alignItems: "center",
            }}>
              {rows.map((row, i) => {
                const isLast = i === rows.length - 1
                const rowBorder = isLast ? "none" : "0.5px solid rgba(212,160,23,0.1)"
                const cellPad: React.CSSProperties = { padding: "8px 0", borderBottom: rowBorder }
                return (
                  <React.Fragment key={row.fieldPrefix}>
                    {/* Label */}
                    <div style={{
                      ...cellPad,
                      fontFamily: "'Courier Prime','Courier New',monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(212,160,23,0.7)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      {row.displayLabel}
                    </div>

                    {/* Model */}
                    <div style={cellPad}>
                      <input
                        value={row.model === "—" ? "" : row.model}
                        onChange={e => updateRow(i, "model", e.target.value)}
                        placeholder="Model"
                        style={{ ...inputBase, fontFamily: "'Courier Prime','Courier New',monospace" }}
                        onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                        onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.35)")}
                      />
                    </div>

                    {/* S/N */}
                    <div style={cellPad}>
                      <input
                        value={row.sn === "—" ? "" : row.sn}
                        onChange={e => updateRow(i, "sn", e.target.value)}
                        placeholder="Serial Number"
                        style={{ ...inputBase, fontFamily: "'Courier Prime','Courier New',monospace" }}
                        onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                        onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.35)")}
                      />
                    </div>

                    {/* Note */}
                    <div style={cellPad}>
                      <input
                        value={row.note === "—" ? "" : row.note}
                        onChange={e => updateRow(i, "note", e.target.value)}
                        placeholder="Note (optional)"
                        style={{ ...inputBase }}
                        onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                        onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.35)")}
                      />
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          </div>

          {/* Hobbs differential */}
          <div className="rounded-lg p-5 flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(212,160,23,0.2)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}>
              Hobbs Meter Differential
            </div>
            <div style={{ height: "0.5px", background: "rgba(212,160,23,0.15)" }} />
            <p style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
              The fixed offset between the Hobbs meter reading and the airframe total time.{" "}
              <span style={{ color: "rgba(212,160,23,0.7)" }}>A/F TT = Hobbs + Differential.</span>
              {" "}Leave blank if Hobbs tracks A/F TT exactly (common on jets).
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 320 }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: "0.6rem", fontFamily: "var(--font-heading)", textTransform: "uppercase",
                  letterSpacing: "0.09em", color: "hsl(var(--muted-foreground))", opacity: 0.55, marginBottom: 4,
                }}>
                  Differential (hrs)
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={hobbsDiff}
                  onChange={e => setHobbsDiff(e.target.value)}
                  placeholder="e.g. 50.3"
                  style={{
                    ...inputBase,
                    fontFamily: "'Courier Prime','Courier New',monospace",
                    colorScheme: "dark light",
                  }}
                  onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                  onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.35)")}
                />
              </div>
              {hobbsDiff.trim() !== "" && !isNaN(parseFloat(hobbsDiff)) && (
                <div style={{ fontSize: "0.7rem", color: "rgba(212,160,23,0.6)", fontFamily: "var(--font-heading)", marginTop: 14 }}>
                  Hobbs + {parseFloat(hobbsDiff).toFixed(1)} hrs = A/F TT
                </div>
              )}
            </div>
          </div>

          {/* Client assignment */}
          <div className="rounded-lg p-5 flex flex-col gap-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(212,160,23,0.2)" }}>
            <div className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}>
              Billing Client
            </div>
            <div style={{ height: "0.5px", background: "rgba(212,160,23,0.15)" }} />
            <p style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
              The billing entity responsible for work performed on this aircraft.
              Used by work orders and invoices to pull customer info automatically.
            </p>

            {clientLoading ? (
              <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", opacity: 0.55 }}>
                Loading clients…
              </div>
            ) : (
              <>
                <div>
                  <div style={{
                    fontSize: "0.6rem", fontFamily: "var(--font-heading)", textTransform: "uppercase",
                    letterSpacing: "0.09em", color: "hsl(var(--muted-foreground))", opacity: 0.55, marginBottom: 4,
                  }}>
                    Assigned Client
                  </div>
                  <select
                    value={selectedClientId ?? ""}
                    onChange={e => setSelectedClientId(e.target.value || null)}
                    style={{
                      background: "hsl(var(--background))",
                      colorScheme: "dark light",
                      border: "none",
                      borderBottom: "1px solid rgba(212,160,23,0.5)",
                      borderRadius: "2px 2px 0 0",
                      color: "hsl(var(--foreground))",
                      fontFamily: "var(--font-body)",
                      fontSize: "0.8125rem",
                      padding: "5px 8px",
                      outline: "none",
                      cursor: "pointer",
                      width: "100%",
                      maxWidth: 420,
                    }}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                    onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.5)")}>
                    <option value="">— No client assigned —</option>
                    {clientList
                      .filter(c => !c.inactive || c.id === selectedClientId)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.inactive ? " (inactive)" : ""}
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* Preview of selected client */}
                {selectedClient && (
                  <div style={{
                    marginTop: 6,
                    padding: "10px 12px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.03)",
                    border: "0.5px solid rgba(212,160,23,0.15)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                        marginBottom: 2,
                      }}>
                        {selectedClient.name}
                      </div>
                      <div style={{
                        fontSize: "0.7rem",
                        color: "hsl(var(--muted-foreground))",
                        opacity: 0.7,
                        lineHeight: 1.5,
                      }}>
                        {[selectedClient.address, selectedClient.address2].filter(Boolean).join(", ") || "No address on file"}
                        {(selectedClient.city || selectedClient.state || selectedClient.zip) && (
                          <> <br/>{[selectedClient.city, selectedClient.state, selectedClient.zip].filter(Boolean).join(", ")}</>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      background: selectedClient.taxable ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.04)",
                      color: selectedClient.taxable ? "#fbbf24" : "hsl(var(--muted-foreground))",
                      border: selectedClient.taxable ? "1px solid rgba(251,191,36,0.25)" : "1px solid rgba(255,255,255,0.08)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}>
                      {selectedClient.taxable ? "Taxable" : "Non-Taxable"}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
