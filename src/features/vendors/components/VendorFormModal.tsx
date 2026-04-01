import { X, AlertCircle } from "lucide-react"
import { GOLD, STATUS_DISPLAY, TYPE_CONFIG, TYPE_ORDER } from "../constants"
import { Field } from "./Field"

export function VendorFormModal({ title, form, saving, onSave, onCancel, onChange }: {
  title: string
  form: any
  saving: boolean
  onSave: () => void
  onCancel: () => void
  onChange: (f: any) => void
}) {
  const f = form
  const setF = (patch: Partial<typeof f>) => onChange({ ...f, ...patch })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-md shadow-xl overflow-y-auto"
        style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <h2 className="text-sm font-semibold tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>
          <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Vendor Name *">
            <input className="form-input" value={f.name} onChange={e => setF({ name: e.target.value })} placeholder="e.g. Dallas Airmotive" />
          </Field>
          <Field label="Vendor Type">
            <div className="grid grid-cols-2 gap-2">
              {TYPE_ORDER.map(k => {
                const c = TYPE_CONFIG[k]; const active = f.vendor_type === k
                return (
                  <button key={k} type="button" onClick={() => setF({ vendor_type: k })}
                    className="text-xs py-2 px-3 rounded-sm border font-medium text-left transition-colors"
                    style={{ borderColor: active ? c.color : "hsl(var(--border))", color: active ? c.color : "hsl(var(--muted-foreground))", background: active ? `${c.color}15` : "transparent" }}>
                    <span className="font-bold">{c.sym}</span> {c.label}
                    <span className="block text-[9px] opacity-60 mt-0.5">{c.desc}</span>
                  </button>
                )
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Airport Code"><input className="form-input font-mono uppercase" value={f.airport_code} onChange={e => setF({ airport_code: e.target.value })} placeholder="KDAL" maxLength={4} /></Field>
            <Field label="Country"><input className="form-input" value={f.country} onChange={e => setF({ country: e.target.value })} placeholder="USA" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><input className="form-input" value={f.city} onChange={e => setF({ city: e.target.value })} placeholder="Dallas" /></Field>
            <Field label="State"><input className="form-input" value={f.state} onChange={e => setF({ state: e.target.value })} placeholder="TX" maxLength={2} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><input className="form-input" type="number" step="any" value={f.lat} onChange={e => setF({ lat: e.target.value })} placeholder="32.8481" /></Field>
            <Field label="Longitude"><input className="form-input" type="number" step="any" value={f.lng} onChange={e => setF({ lng: e.target.value })} placeholder="-96.8512" /></Field>
          </div>
          <Field label="Phone"><input className="form-input" value={f.phone} onChange={e => setF({ phone: e.target.value })} placeholder="(214) 555-0100" /></Field>
          <Field label="Website"><input className="form-input" value={f.website} onChange={e => setF({ website: e.target.value })} placeholder="https://example.com" /></Field>
          <Field label="Specialties (comma-separated)"><input className="form-input" value={f.specialties} onChange={e => setF({ specialties: e.target.value })} placeholder="Engine, Sheet Metal, Interiors" /></Field>
          <Field label="Notes"><textarea className="form-input resize-none" rows={3} value={f.notes} onChange={e => setF({ notes: e.target.value })} placeholder="AOG availability, turnaround time, contact preferences…" /></Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.preferred} onChange={e => setF({ preferred: e.target.checked })} />
            <span className="text-sm" style={{ color: f.preferred ? GOLD : "hsl(var(--muted-foreground))" }}>Mark as preferred</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.is_mrt} onChange={e => setF({ is_mrt: e.target.checked })} />
            <span className="text-sm" style={{ color: f.is_mrt ? GOLD : "hsl(var(--muted-foreground))" }}>Mobile Response Team (MRT) — no map pin</span>
          </label>
        </div>
        <div className="px-5 py-4 space-y-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: STATUS_DISPLAY.discovered.color }} />
            <span className="text-xs text-muted-foreground">
              New vendors are saved as <span className="font-bold" style={{ color: STATUS_DISPLAY.discovered.color }}>Discovered</span> and require evaluation before use.
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="px-4 py-1.5 text-sm rounded-sm border text-muted-foreground" style={{ borderColor: "hsl(var(--border))" }}>Cancel</button>
            <button onClick={onSave} disabled={!f.name?.trim() || saving} className="px-4 py-1.5 text-sm rounded-sm text-white disabled:opacity-50" style={{ background: GOLD }}>
              {saving ? "Saving…" : "Save Vendor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
