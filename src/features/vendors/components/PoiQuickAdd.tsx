import { Plus, X, CheckCircle } from "lucide-react"
import { GOLD, TYPE_CONFIG, TYPE_ORDER, type VendorType, type PoiCard } from "../constants"

export function PoiQuickAdd({
  poiCard, poiSaved, poiName, poiPhone, poiNotes, poiType, poiPreferred, saving,
  onPoiNameChange, onPoiPhoneChange, onPoiNotesChange, onPoiTypeChange, onPoiPreferredChange,
  onSave, onClose,
}: {
  poiCard: PoiCard
  poiSaved: boolean
  poiName: string; poiPhone: string; poiNotes: string
  poiType: VendorType; poiPreferred: boolean; saving: boolean
  onPoiNameChange: (v: string) => void
  onPoiPhoneChange: (v: string) => void
  onPoiNotesChange: (v: string) => void
  onPoiTypeChange: (v: VendorType) => void
  onPoiPreferredChange: (v: boolean) => void
  onSave: () => void; onClose: () => void
}) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md shadow-2xl z-10"
      style={{ background: "hsl(var(--background))", border: `1px solid ${GOLD}`, width: 360 }}>
      {poiSaved ? (
        <div className="flex items-center justify-center gap-2 py-5">
          <CheckCircle className="w-5 h-5" style={{ color: GOLD }} />
          <span className="text-sm font-medium">Added to vendor list!</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: GOLD }}>Add to vendor list</p>
            <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="px-4 pb-3 space-y-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Vendor Name *</p>
              <input className="form-input" value={poiName} onChange={e => onPoiNameChange(e.target.value)} placeholder="Business name" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Vendor Type</p>
              <div className="grid grid-cols-5 gap-1">
                {TYPE_ORDER.map(k => {
                  const cfg = TYPE_CONFIG[k]
                  return (
                    <button key={k} onClick={() => onPoiTypeChange(k)}
                      className="text-[9px] py-1 rounded-sm border font-bold transition-colors leading-tight"
                      style={{
                        borderColor: poiType === k ? cfg.color : "hsl(var(--border))",
                        color:       poiType === k ? cfg.color : "hsl(var(--muted-foreground))",
                        background:  poiType === k ? `${cfg.color}18` : "transparent",
                      }}
                    >{cfg.sym}</button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Phone</p>
              <input className="form-input" value={poiPhone} onChange={e => onPoiPhoneChange(e.target.value)} placeholder="—" />
            </div>
            {poiCard.address && <p className="text-[10px] text-muted-foreground">📍 {poiCard.address}</p>}
            {poiCard.website && <p className="text-[10px] text-muted-foreground truncate">🌐 {poiCard.website.replace(/^https?:\/\//, "")}</p>}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Notes</p>
              <input className="form-input" value={poiNotes} onChange={e => onPoiNotesChange(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={poiPreferred} onChange={e => onPoiPreferredChange(e.target.checked)} />
              <span className="text-xs" style={{ color: poiPreferred ? GOLD : "hsl(var(--muted-foreground))" }}>Preferred</span>
            </label>
            <button onClick={onSave} disabled={saving || !poiName.trim()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm text-white disabled:opacity-50"
              style={{ background: GOLD }}>
              <Plus className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Add Vendor"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
