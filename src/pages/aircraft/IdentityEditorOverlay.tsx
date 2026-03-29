import { useEffect, useState } from "react"
import type { DataField } from "./fleetData"

interface Props {
  initialIdentity: DataField[]
  tailNumber: string
  onSave: (identity: DataField[]) => Promise<void>
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
  fontSize: "0.875rem",
  padding: "4px 6px",
}
const lbl: React.CSSProperties = {
  fontSize: "0.6rem", fontFamily: "var(--font-heading)",
  textTransform: "uppercase", letterSpacing: "0.09em",
  color: "hsl(var(--muted-foreground))", opacity: 0.55, marginBottom: 2,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-5 flex flex-col gap-4"
      style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(212,160,23,0.2)" }}>
      <div className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}>
        {title}
      </div>
      <div style={{ height: "0.5px", background: "rgba(212,160,23,0.15)" }} />
      <div className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {children}
      </div>
    </div>
  )
}

// ─── Overlay ───────────────────────────────────────────────────────────────────
export default function IdentityEditorOverlay({
  initialIdentity, tailNumber, onSave, onClose,
}: Props) {
  const [visible,   setVisible]   = useState(false)
  const [fields,    setFields]    = useState<DataField[]>(initialIdentity)
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
      await onSave(fields)
      setVisible(false)
      setTimeout(onClose, 220)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
      setSaving(false)
    }
  }

  function updateField(idx: number, changes: Partial<DataField>) {
    setFields(f => f.map((item, i) => i === idx ? { ...item, ...changes } : item))
  }

  const mainFields = fields.filter(f => !f.label.toLowerCase().includes("key"))
  const keyFields  = fields.filter(f =>  f.label.toLowerCase().includes("key"))

  function FieldInput({ f }: { f: DataField }) {
    const idx = fields.indexOf(f)
    return (
      <div>
        <div style={lbl}>{f.label}</div>
        <input
          value={f.value === "—" ? "" : f.value}
          onChange={e => updateField(idx, { value: e.target.value || "—" })}
          placeholder={f.label}
          style={inputBase}
          onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
          onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.5)")}
        />
        {f.note !== undefined && (
          <input
            value={f.note}
            onChange={e => updateField(idx, { note: e.target.value })}
            placeholder="Note"
            style={{ ...inputBase, fontSize: "0.75rem", padding: "3px 6px", marginTop: 4, opacity: 0.7 }}
            onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
            onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.5)")}
          />
        )}
      </div>
    )
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
            ✎ Identity &amp; Operations
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
        <div className="p-6 flex flex-col gap-5" style={{ flex: 1 }}>
          {mainFields.length > 0 && (
            <Section title="Identity &amp; Operations">
              {mainFields.map(f => <FieldInput key={f.label} f={f} />)}
            </Section>
          )}
          {keyFields.length > 0 && (
            <Section title="Keys &amp; Codes">
              {keyFields.map(f => <FieldInput key={f.label} f={f} />)}
            </Section>
          )}
        </div>

      </div>
    </div>
  )
}
