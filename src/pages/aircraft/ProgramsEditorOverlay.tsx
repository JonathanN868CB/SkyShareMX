import { useEffect, useState } from "react"
import type { DataField } from "./fleetData"

interface Props {
  initialPrograms: DataField[]
  tailNumber: string
  onSave: (programs: DataField[]) => Promise<void>
  onClose: () => void
}

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(212,160,23,0.04)",
  border: "none",
  borderBottom: "1px solid rgba(212,160,23,0.5)",
  borderRadius: "2px 2px 0 0",
  color: "hsl(var(--foreground))",
  fontFamily: "var(--font-body)",
  outline: "none",
}
const inputMd: React.CSSProperties = { ...inputBase, fontSize: "0.875rem", padding: "4px 6px" }
const inputSm: React.CSSProperties = { ...inputBase, fontSize: "0.8rem",   padding: "3px 5px" }
const lbl: React.CSSProperties = {
  fontSize: "0.6rem", fontFamily: "var(--font-heading)",
  textTransform: "uppercase", letterSpacing: "0.09em",
  color: "hsl(var(--muted-foreground))", opacity: 0.55, marginBottom: 2,
}

function focusGold(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)"
}
function blurGold(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.5)"
}

// ─── Single program editor card ───────────────────────────────────────────────
function ProgramEditCard({
  field,
  onChange,
}: {
  field: DataField
  onChange: (changes: Partial<DataField>) => void
}) {
  const isNone = !field.value || field.value === "None" || field.value === "—"

  return (
    <div className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(212,160,23,0.2)" }}>

      {/* Program name label */}
      <div className="text-sm font-semibold"
        style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
        {field.label}
      </div>

      <div style={{ height: "0.5px", background: "rgba(212,160,23,0.15)" }} />

      {/* Enrolled toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer" style={{ flexShrink: 0 }}>
          <input
            type="checkbox"
            checked={!isNone}
            onChange={e => onChange({ value: e.target.checked ? "" : "None" })}
            style={{ accentColor: "var(--skyshare-gold)", width: 14, height: 14 }}
          />
          <span style={{
            fontSize: "0.8rem",
            color: !isNone ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
            fontFamily: "var(--font-body)",
          }}>
            Enrolled
          </span>
        </label>
        {!isNone && (
          <div className="flex-1" style={{ minWidth: 160 }}>
            <div style={lbl}>Program Name / Description</div>
            <input
              value={field.value === "None" || field.value === "—" ? "" : field.value}
              onChange={e => onChange({ value: e.target.value || "" })}
              placeholder="e.g. JSSI Tip-to-Tail"
              style={inputMd}
              onFocus={focusGold}
              onBlur={blurGold}
            />
          </div>
        )}
      </div>

      {/* Detail fields — only when enrolled */}
      {!isNone && (
        <div className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {[
            { key: "provider",       label: "Provider"    },
            { key: "contractNumber", label: "Contract #"  },
            { key: "expiry",         label: "Expiry Date" },
            { key: "account",        label: "Account #"   },
          ].map(item => {
            const raw = (field as Record<string, string | undefined>)[item.key] ?? ""
            return (
              <div key={item.key}>
                <div style={lbl}>{item.label}</div>
                <input
                  value={raw === "—" ? "" : raw}
                  onChange={e => onChange({ [item.key]: e.target.value || "—" })}
                  placeholder={item.label}
                  style={inputSm}
                  onFocus={focusGold}
                  onBlur={blurGold}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Note — always visible */}
      <div>
        <div style={lbl}>Note</div>
        <input
          value={field.note ?? ""}
          onChange={e => onChange({ note: e.target.value })}
          placeholder="Optional note"
          style={inputSm}
          onFocus={focusGold}
          onBlur={blurGold}
        />
      </div>
    </div>
  )
}

// ─── Overlay ───────────────────────────────────────────────────────────────────
export default function ProgramsEditorOverlay({
  initialPrograms, tailNumber, onSave, onClose,
}: Props) {
  const [visible,   setVisible]   = useState(false)
  const [programs,  setPrograms]  = useState<DataField[]>(initialPrograms)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState("")

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

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    try {
      await onSave(programs)
      setVisible(false)
      setTimeout(onClose, 220)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
      setSaving(false)
    }
  }

  function updateProgram(idx: number, changes: Partial<DataField>) {
    setPrograms(p => p.map((f, i) => i === idx ? { ...f, ...changes } : f))
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
          <span className="text-xs font-semibold uppercase tracking-widest flex-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            ✎ Programs &amp; Enrollment
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

        {/* Instruction banner */}
        <div className="px-6 py-2 text-xs"
          style={{
            background: "rgba(212,160,23,0.06)",
            borderBottom: "0.5px solid rgba(212,160,23,0.2)",
            color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-body)",
          }}>
          Check <strong style={{ color: "hsl(var(--foreground))", opacity: 0.7 }}>Enrolled</strong> to enter program details. Uncheck to mark as not enrolled.
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4" style={{ flex: 1 }}>
          {programs.map((field, idx) => (
            <ProgramEditCard
              key={field.label + (field.group ?? "")}
              field={field}
              onChange={changes => updateProgram(idx, changes)}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
