import { useEffect, useState } from "react"
import type { DataField } from "./fleetData"

interface Props {
  initialFields: DataField[]
  tailNumber: string
  onSave: (fields: DataField[]) => Promise<void>
  onClose: () => void
}

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(212,160,23,0.05)",
  border: "none",
  borderBottom: "1.5px solid rgba(212,160,23,0.5)",
  borderRadius: "3px 3px 0 0",
  color: "hsl(var(--foreground))",
  fontFamily: "'Courier Prime','Courier New',monospace",
  outline: "none",
  fontSize: "1rem",
  padding: "9px 12px",
}
const urlLbl: React.CSSProperties = {
  fontSize: "0.72rem", fontFamily: "var(--font-heading)",
  textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700,
  color: "var(--skyshare-gold)", opacity: 0.9, marginBottom: 6,
}
const noteLbl: React.CSSProperties = {
  fontSize: "0.68rem", fontFamily: "var(--font-heading)",
  textTransform: "uppercase", letterSpacing: "0.09em",
  color: "hsl(var(--muted-foreground))", opacity: 0.6, marginBottom: 5, marginTop: 12,
}

// ─── Overlay ───────────────────────────────────────────────────────────────────
export default function DocumentationEditorOverlay({
  initialFields, tailNumber, onSave, onClose,
}: Props) {
  const [visible,   setVisible]   = useState(false)
  const [fields,    setFields]    = useState<DataField[]>(initialFields)
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() { setVisible(false); setTimeout(onClose, 220) }

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    try {
      // Trim whitespace from value fields so pasted URLs with leading/trailing
      // spaces don't silently break the "Open ↗" link detection on display.
      const trimmed = fields.map(f => ({
        ...f,
        value: f.value.trim() || "—",
      }))
      await onSave(trimmed)
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
        <div className="sticky top-0 z-10 flex items-center gap-4 px-8 py-4"
          style={{
            background: "hsl(0 0% 10%)",
            borderBottom: "1px solid rgba(212,160,23,0.4)",
            boxShadow: "0 1px 0 0 rgba(212,160,23,0.06)",
          }}>
          <button onClick={handleClose}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded"
            style={{
              background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)",
              border: "0.5px solid rgba(212,160,23,0.3)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.08em", cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
            ← {tailNumber}
          </button>
          <span className="text-sm font-semibold uppercase tracking-widest flex-1"
            style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            ✎ Documentation &amp; Manuals
          </span>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-sm px-3 py-1.5 rounded"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", fontFamily: "var(--font-heading)" }}>
                {saveError}
              </span>
            )}
            <button onClick={handleClose}
              className="text-sm px-4 py-2 rounded"
              style={{
                background: "transparent", color: "hsl(var(--muted-foreground))",
                border: "0.5px solid hsl(var(--border))",
                fontFamily: "var(--font-heading)", letterSpacing: "0.06em", cursor: "pointer",
              }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="text-sm px-5 py-2 rounded"
              style={{
                background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", border: "none",
                fontFamily: "var(--font-heading)", letterSpacing: "0.06em", fontWeight: 700,
                opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer",
              }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col gap-6" style={{ flex: 1, maxWidth: 780, width: "100%", margin: "0 auto" }}>
          <div className="rounded-lg flex flex-col gap-0"
            style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(212,160,23,0.2)", overflow: "hidden" }}>

            {/* Section header */}
            <div className="px-8 py-5"
              style={{ borderBottom: "0.5px solid rgba(212,160,23,0.2)", background: "rgba(212,160,23,0.04)" }}>
              <div className="text-sm font-bold uppercase tracking-widest"
                style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.14em" }}>
                Manual Links
              </div>
              <p className="text-xs mt-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
                Paste a full URL to make each manual directly openable from the aircraft card.
              </p>
            </div>

            {/* Field rows */}
            <div className="flex flex-col">
              {fields.map((f, idx) => (
                <div key={idx} className="px-8 py-7"
                  style={{ borderBottom: idx < fields.length - 1 ? "0.5px solid rgba(255,255,255,0.06)" : "none" }}>

                  {/* Manual name */}
                  <div style={{
                    fontSize: "1rem", fontWeight: 700,
                    color: "hsl(var(--foreground))",
                    fontFamily: "var(--font-heading)", letterSpacing: "0.04em",
                    marginBottom: 16,
                  }}>
                    {f.label}
                  </div>

                  {/* URL field */}
                  <div style={urlLbl}>Manual URL</div>
                  <input
                    value={f.value === "—" ? "" : f.value}
                    onChange={e => updateField(idx, { value: e.target.value || "—" })}
                    placeholder=""
                    style={inputBase}
                    onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                    onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.5)")}
                  />

                  {/* Note field */}
                  {f.note !== undefined && (
                    <>
                      <div style={noteLbl}>Note for techs</div>
                      <input
                        value={f.note}
                        onChange={e => updateField(idx, { note: e.target.value })}
                        placeholder="Optional note visible on aircraft card"
                        style={{ ...inputBase, fontSize: "0.9rem", padding: "7px 12px", opacity: 0.75, fontFamily: "var(--font-body)" }}
                        onFocus={e => (e.currentTarget.style.borderBottomColor = "var(--skyshare-gold)")}
                        onBlur={e  => (e.currentTarget.style.borderBottomColor = "rgba(212,160,23,0.5)")}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
