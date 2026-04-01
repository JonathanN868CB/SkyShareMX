import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { GOLD, STATUS_DISPLAY, TYPE_CONFIG, TYPE_ORDER, PIN_ICONS, type VendorOperationalStatus } from "../constants"

const STATUS_ORDER: VendorOperationalStatus[] = ["approved", "pending", "discovered", "restricted", "inactive"]

export function LegendDropdown() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm border font-semibold transition-colors"
        style={{
          borderColor: open ? GOLD : "hsl(var(--border))",
          color: open ? GOLD : "hsl(var(--muted-foreground))",
          background: open ? `${GOLD}12` : "transparent",
        }}
      >
        Legend
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-md shadow-xl z-50"
          style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", minWidth: 240 }}
        >
          {/* Vendor type icons */}
          <p className="px-4 pt-3 pb-2 text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>
            Vendor Type
          </p>
          <div className="px-3 pb-2 space-y-0.5">
            {TYPE_ORDER.map(t => {
              const cfg = TYPE_CONFIG[t]
              return (
                <div key={t} className="flex items-center gap-3 px-1 py-1.5 rounded-sm">
                  <img
                    src={PIN_ICONS[t].url}
                    alt={cfg.label}
                    style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }}
                  />
                  <div>
                    <p className="text-xs font-semibold leading-tight">{cfg.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{cfg.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Status dot indicators */}
          <div style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <p className="px-4 pt-2.5 pb-1.5 text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>
              Status Indicator
            </p>
            <div className="px-3 pb-3 space-y-0.5">
              {STATUS_ORDER.map(s => {
                const cfg = STATUS_DISPLAY[s]
                return (
                  <div key={s} className="flex items-center gap-3 px-1 py-1 rounded-sm">
                    <span className="w-[22px] flex items-center justify-center shrink-0">
                      <span className="w-[9px] h-[9px] rounded-full inline-block"
                        style={{ background: cfg.color, border: "1px solid rgba(0,0,0,0.2)" }} />
                    </span>
                    <p className="text-xs" style={{ color: cfg.color }}>{cfg.label}</p>
                  </div>
                )
              })}
              <div className="flex items-center gap-3 px-1 py-1 rounded-sm">
                <span className="w-[22px] flex items-center justify-center shrink-0">
                  <span className="w-[9px] h-[9px] rounded-full inline-block opacity-40"
                    style={{ background: "#9ca3af", border: "1px solid rgba(0,0,0,0.2)" }} />
                </span>
                <p className="text-xs text-muted-foreground opacity-50">Dimmed = Inactive/Archived</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
