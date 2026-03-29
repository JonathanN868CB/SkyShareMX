import { useEffect, useState } from "react"
import type { AvionicsField, AvionicsService } from "./fleetData"

interface Props {
  initialServices: AvionicsService[]
  tailNumber: string
  onSave: (services: AvionicsService[]) => Promise<void>
  onClose: () => void
}

const CATEGORY_PRESETS = [
  "Flight Deck",
  "Nav Database",
  "Connectivity",
  "Weather",
  "Communications",
  "ATC / Datalink",
  "Surveillance",
]

// ─── Standard credential template ─────────────────────────────────────────────
// Every new service starts with these six fields. They render in a structured
// 2-column grid and cannot be individually removed (only the whole service can).
function defaultFields(): AvionicsField[] {
  return [
    // Row 1 — account identity
    { name: "Provider",     value: "", builtin: true, type: "text" },
    { name: "Account #",    value: "", builtin: true, type: "text" },
    { name: "Expiry",       value: "", builtin: true, type: "text" },
    { name: "Subscription", value: "", builtin: true, type: "text" },
    // Row 2 — credentials
    { name: "Username",     value: "", builtin: true, type: "text" },
    { name: "Password",     value: "", builtin: true, type: "text", sensitive: true },
    { name: "2FA",          value: "No", builtin: true, type: "boolean", detail: "" },
    { name: "Login URL",    value: "", builtin: true, type: "text" },
  ]
}

function newService(): AvionicsService {
  return { id: crypto.randomUUID(), category: "", label: "", fields: defaultFields() }
}

function cloneService(svc: AvionicsService): AvionicsService {
  return { ...svc, id: crypto.randomUUID() }
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(212,160,23,0.04)",
  border: "none",
  borderBottom: "1px solid rgba(212,160,23,0.3)",
  borderRadius: "2px 2px 0 0",
  color: "hsl(var(--foreground))",
  fontFamily: "var(--font-body)",
  outline: "none",
}
const inputMd: React.CSSProperties  = { ...inputBase, fontSize: "0.875rem", padding: "4px 6px" }
const inputSm: React.CSSProperties  = { ...inputBase, fontSize: "0.8rem",   padding: "3px 5px" }
const lbl: React.CSSProperties = {
  fontSize: "0.6rem", fontFamily: "var(--font-heading)",
  textTransform: "uppercase", letterSpacing: "0.09em",
  color: "hsl(var(--muted-foreground))", opacity: 0.5, marginBottom: 2,
}

function LabeledInput({
  label, value, onChange, placeholder, sensitive, style,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; sensitive?: boolean; style?: React.CSSProperties
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col" style={style}>
      <div style={lbl}>{label}{sensitive && " 🔒"}</div>
      <div className="relative flex items-center">
        <input
          type={sensitive && !show ? "password" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? label}
          style={{ ...inputMd, paddingRight: sensitive ? 36 : undefined }}
        />
        {sensitive && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            style={{
              position: "absolute", right: 4,
              fontSize: "0.6rem", fontFamily: "var(--font-heading)",
              color: "hsl(var(--muted-foreground))", opacity: 0.5,
              background: "none", border: "none", cursor: "pointer", padding: "0 2px",
            }}>
            {show ? "hide" : "show"}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Standard fields grid (builtin) ───────────────────────────────────────────
function StandardFields({ svc, onUpdate }: {
  svc: AvionicsService
  onUpdate: (changes: Partial<AvionicsService>) => void
}) {
  function updateAt(idx: number, changes: Partial<AvionicsField>) {
    onUpdate({ fields: svc.fields.map((f, i) => i === idx ? { ...f, ...changes } : f) })
  }

  const idxOf = (name: string) => svc.fields.findIndex(f => f.builtin && f.name === name)

  const piIdx  = idxOf("Provider");     const pi  = svc.fields[piIdx]
  const anIdx  = idxOf("Account #");    const an  = svc.fields[anIdx]
  const exIdx  = idxOf("Expiry");       const ex  = svc.fields[exIdx]
  const subIdx = idxOf("Subscription"); const sub = svc.fields[subIdx]
  const unIdx  = idxOf("Username");     const un  = svc.fields[unIdx]
  const pwIdx  = idxOf("Password");     const pw  = svc.fields[pwIdx]
  const faIdx  = idxOf("2FA");          const fa  = svc.fields[faIdx]
  const luIdx  = idxOf("Login URL");    const lu  = svc.fields[luIdx]

  return (
    <div className="flex flex-col gap-2.5">
      {/* Row 1: Provider · Account # · Expiry · Subscription */}
      <div className="grid grid-cols-4 gap-3">
        {pi  && <LabeledInput label="Provider"     value={pi.value}  onChange={v => updateAt(piIdx,  { value: v })} />}
        {an  && <LabeledInput label="Account #"    value={an.value}  onChange={v => updateAt(anIdx,  { value: v })} />}
        {ex  && <LabeledInput label="Expiry"       value={ex.value}  onChange={v => updateAt(exIdx,  { value: v })} placeholder="MM/YYYY" />}
        {sub && <LabeledInput label="Subscription" value={sub.value} onChange={v => updateAt(subIdx, { value: v })} placeholder="e.g. North America" />}
      </div>

      {/* Row 2: Username · Password · 2FA · Login URL */}
      <div className="grid grid-cols-4 gap-3">
        {un && <LabeledInput label="Username"  value={un.value} onChange={v => updateAt(unIdx, { value: v })} />}
        {pw && <LabeledInput label="Password"  value={pw.value} onChange={v => updateAt(pwIdx, { value: v })} sensitive />}
        {fa && (
          <div className="flex flex-col gap-1">
            <div style={lbl}>2FA</div>
            <label className="flex items-center gap-2 cursor-pointer" style={{ height: "1.9rem" }}>
              <input
                type="checkbox"
                checked={fa.value === "Yes"}
                onChange={e => updateAt(faIdx, { value: e.target.checked ? "Yes" : "No" })}
                style={{ accentColor: "var(--skyshare-gold)", width: 14, height: 14, flexShrink: 0 }}
              />
              <span style={{
                fontSize: "0.8rem",
                color: fa.value === "Yes" ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                opacity: fa.value === "Yes" ? 1 : 0.5,
              }}>
                {fa.value === "Yes" ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>
        )}
        {lu && <LabeledInput label="Login URL" value={lu.value} onChange={v => updateAt(luIdx, { value: v })} placeholder="https://…" />}
      </div>

      {/* 2FA instructions — full width, only when enabled */}
      {fa?.value === "Yes" && (
        <div className="flex flex-col">
          <div style={lbl}>2FA Instructions</div>
          <input
            value={fa.detail ?? ""}
            onChange={e => updateAt(faIdx, { detail: e.target.value })}
            placeholder="e.g. Authenticator app on ops iPad"
            style={inputMd}
          />
        </div>
      )}
    </div>
  )
}

// ─── Service card ──────────────────────────────────────────────────────────────
function ServiceCard({
  svc, svcIndex, onUpdate, onRemove, onDuplicate,
}: {
  svc: AvionicsService
  svcIndex: number
  onUpdate: (changes: Partial<AvionicsService>) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const customFields = svc.fields.filter(f => !f.builtin)

  function addCustomField() {
    onUpdate({ fields: [...svc.fields, { name: "", value: "" }] })
  }

  function removeCustomField(globalIdx: number) {
    onUpdate({ fields: svc.fields.filter((_, i) => i !== globalIdx) })
  }

  function updateCustomField(globalIdx: number, changes: Partial<AvionicsField>) {
    onUpdate({ fields: svc.fields.map((f, i) => i === globalIdx ? { ...f, ...changes } : f) })
  }

  const hasNotes = svc.notes !== undefined

  return (
    <div className="rounded-lg flex flex-col gap-4 p-4"
      style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(212,160,23,0.2)" }}>

      {/* Header: category · label · duplicate · remove */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col flex-1 min-w-0">
          <div style={lbl}>Category</div>
          <input
            list={`cats-${svcIndex}`}
            value={svc.category}
            onChange={e => onUpdate({ category: e.target.value })}
            placeholder="e.g. Nav Database"
            style={inputMd}
          />
          <datalist id={`cats-${svcIndex}`}>
            {CATEGORY_PRESETS.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div style={lbl}>Service Label</div>
          <input
            value={svc.label}
            onChange={e => onUpdate({ label: e.target.value })}
            placeholder="e.g. Jeppesen NavData"
            style={inputMd}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 pt-4 shrink-0">
          <button
            onClick={onDuplicate}
            title="Duplicate service"
            className="text-xs px-2.5 py-1 rounded"
            style={{
              background: "rgba(212,160,23,0.07)", color: "var(--skyshare-gold)",
              border: "0.5px solid rgba(212,160,23,0.25)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.05em", cursor: "pointer",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.07)")}>
            Duplicate
          </button>
          <button
            onClick={onRemove}
            title="Remove service"
            className="text-xs px-2.5 py-1 rounded"
            style={{
              background: "transparent", color: "hsl(var(--muted-foreground))",
              border: "0.5px solid rgba(239,68,68,0.25)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.05em", cursor: "pointer", opacity: 0.6,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)" }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)" }}>
            Remove
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "0.5px", background: "rgba(212,160,23,0.15)" }} />

      {/* Standard credential fields */}
      <StandardFields svc={svc} onUpdate={onUpdate} />

      {/* Custom extra fields */}
      {customFields.length > 0 && (
        <>
          <div style={{ height: "0.5px", background: "rgba(212,160,23,0.1)" }} />
          <div className="flex flex-col gap-2">
            <div style={{ ...lbl, opacity: 0.3, marginBottom: 0 }}>Additional Fields</div>
            {svc.fields.map((f, globalIdx) => {
              if (f.builtin) return null
              return (
                <div key={globalIdx} className="flex items-center gap-2">
                  <div className="flex flex-col" style={{ width: 130, flexShrink: 0 }}>
                    <input
                      value={f.name}
                      onChange={e => updateCustomField(globalIdx, { name: e.target.value })}
                      placeholder="Field name"
                      style={{ ...inputSm }}
                    />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <input
                      value={f.value}
                      onChange={e => updateCustomField(globalIdx, { value: e.target.value })}
                      placeholder="Value"
                      style={{ ...inputSm }}
                    />
                  </div>
                  <label
                    title="Mask in view mode"
                    className="flex items-center gap-1 shrink-0 cursor-pointer"
                    style={{
                      fontSize: "0.7rem",
                      color: f.sensitive ? "var(--skyshare-gold)" : "hsl(var(--muted-foreground))",
                      opacity: f.sensitive ? 1 : 0.4,
                      fontFamily: "var(--font-heading)", userSelect: "none",
                    }}>
                    <input
                      type="checkbox"
                      checked={!!f.sensitive}
                      onChange={e => updateCustomField(globalIdx, { sensitive: e.target.checked })}
                      style={{ accentColor: "var(--skyshare-gold)", width: 11, height: 11 }}
                    />
                    🔒
                  </label>
                  <button
                    onClick={() => removeCustomField(globalIdx)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "hsl(var(--muted-foreground))", opacity: 0.35,
                      fontSize: "1rem", lineHeight: 1, padding: "0 2px", flexShrink: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0.35")}>
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Notes */}
      {hasNotes && (
        <>
          <div style={{ height: "0.5px", background: "rgba(212,160,23,0.1)" }} />
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div style={lbl}>Notes</div>
              <button
                onClick={() => onUpdate({ notes: undefined })}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "hsl(var(--muted-foreground))", opacity: 0.3,
                  fontSize: "0.65rem", fontFamily: "var(--font-heading)",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.3")}>
                remove notes
              </button>
            </div>
            <textarea
              value={svc.notes ?? ""}
              onChange={e => onUpdate({ notes: e.target.value })}
              placeholder="Any additional notes about this service…"
              rows={3}
              style={{
                ...inputBase,
                fontSize: "0.8rem",
                padding: "5px 6px",
                resize: "vertical",
                minHeight: 56,
                fontFamily: "var(--font-body)",
              }}
            />
          </div>
        </>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={addCustomField}
          className="text-xs px-2.5 py-1 rounded"
          style={{
            background: "rgba(212,160,23,0.07)", color: "var(--skyshare-gold)",
            border: "0.5px solid rgba(212,160,23,0.25)",
            fontFamily: "var(--font-heading)", letterSpacing: "0.05em", cursor: "pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.07)")}>
          + Add Field
        </button>
        {!hasNotes && (
          <button
            onClick={() => onUpdate({ notes: "" })}
            className="text-xs px-2.5 py-1 rounded"
            style={{
              background: "transparent", color: "hsl(var(--muted-foreground))",
              border: "0.5px solid hsl(var(--border))",
              fontFamily: "var(--font-heading)", letterSpacing: "0.05em", cursor: "pointer", opacity: 0.55,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "hsl(var(--foreground))" }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "0.55"; e.currentTarget.style.color = "hsl(var(--muted-foreground))" }}>
            + Add Notes
          </button>
        )}
      </div>

    </div>
  )
}

// ─── Overlay ───────────────────────────────────────────────────────────────────
export default function AvionicsEditorOverlay({ initialServices, tailNumber, onSave, onClose }: Props) {
  const [visible,   setVisible]   = useState(false)
  const [services,  setServices]  = useState<AvionicsService[]>(
    initialServices.length ? initialServices : [newService()]
  )
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

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError("")
    try {
      await onSave(services)
      setVisible(false)
      setTimeout(onClose, 220)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
      setSaving(false)
    }
  }

  function addService() {
    setServices(s => [...s, newService()])
  }

  function updateService(idx: number, changes: Partial<AvionicsService>) {
    setServices(s => s.map((svc, i) => i === idx ? { ...svc, ...changes } : svc))
  }

  function removeService(idx: number) {
    setServices(s => s.filter((_, i) => i !== idx))
  }

  function duplicateService(idx: number) {
    setServices(s => {
      const copy = cloneService(s[idx])
      const next = [...s]
      next.splice(idx + 1, 0, copy)
      return next
    })
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
            ✎ Avionics &amp; Connectivity
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
          Each card is one service or subscription. Standard credential fields are pre-filled. Use <strong style={{ color: "hsl(var(--foreground))", opacity: 0.7 }}>+ Add Field</strong> for anything extra and <strong style={{ color: "hsl(var(--foreground))", opacity: 0.7 }}>Duplicate</strong> to copy an existing card.
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4" style={{ flex: 1 }}>
          {services.map((svc, i) => (
            <ServiceCard
              key={svc.id}
              svc={svc}
              svcIndex={i}
              onUpdate={changes => updateService(i, changes)}
              onRemove={() => removeService(i)}
              onDuplicate={() => duplicateService(i)}
            />
          ))}

          <button onClick={addService}
            className="text-xs px-4 py-2.5 rounded self-start"
            style={{
              background: "rgba(212,160,23,0.08)", color: "var(--skyshare-gold)",
              border: "0.5px solid rgba(212,160,23,0.3)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.07em", cursor: "pointer",
              marginTop: services.length ? 0 : undefined,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.18)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.08)")}>
            + Add Service
          </button>
        </div>

      </div>
    </div>
  )
}
