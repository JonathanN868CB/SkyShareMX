import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { GOLD, TYPE_CONFIG, TYPE_ORDER, PIN_ICONS } from "../constants"

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
          style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", minWidth: 220 }}
        >
          <p className="px-4 pt-3 pb-2 text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>
            Vendor Icon Legend
          </p>
          <div className="px-3 pb-3 space-y-0.5">
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
        </div>
      )}
    </div>
  )
}
