import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"

import type { PmStatus } from "@/entities/supabase"

interface StatusPillProps {
  status:    PmStatus | null
  statuses:  PmStatus[]
  onSelect?: (statusId: string | null) => void
  readonly?: boolean
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const NO_STATUS_COLOR = "#6b7280"

export function StatusPill({ status, statuses, onSelect, readonly = false }: StatusPillProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const color = status?.color ?? NO_STATUS_COLOR
  const label = status?.label ?? "No Status"

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      // Close if click is outside trigger and outside the portal dropdown
      const target = e.target as Node
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        // Check if click is inside the portal dropdown (has data attribute)
        const portal = document.getElementById("status-pill-portal")
        if (!portal || !portal.contains(target)) setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function openDropdown(e: React.MouseEvent) {
    e.stopPropagation()
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setCoords({ top: rect.bottom + 6, left: rect.left })
    setOpen(o => !o)
  }

  // The pill shown inline on the row / drawer
  const pillEl = (
    <div
      style={{
        background:    status ? color : "rgba(255,255,255,0.07)",
        color:         status ? "#fff" : "rgba(255,255,255,0.45)",
        borderRadius:  5,
        padding:       "5px 12px",
        fontSize:      12,
        fontFamily:    "var(--font-heading)",
        fontWeight:    700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace:    "nowrap",
        display:       "inline-block",
        minWidth:      100,
        textAlign:     "center",
        border:        status ? "none" : "1px solid rgba(255,255,255,0.15)",
        cursor:        readonly ? "default" : "pointer",
        transition:    "filter 0.12s, transform 0.12s",
      }}
      className={readonly ? "" : "hover:brightness-125 hover:scale-[1.03]"}
    >
      {label}
    </div>
  )

  if (readonly || !onSelect) return pillEl

  const dropdown = open && coords ? createPortal(
    <div
      id="status-pill-portal"
      onClick={e => e.stopPropagation()}
      style={{
        position:     "fixed",
        top:          coords.top,
        left:         coords.left,
        zIndex:       9999,
        background:   "hsl(0 0% 13%)",
        border:       "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        minWidth:     180,
        boxShadow:    "0 12px 32px rgba(0,0,0,0.65)",
        overflow:     "hidden",
        padding:      "8px",
      }}
    >
          {/* No Status option */}
          <button
            onClick={() => { onSelect(null); setOpen(false) }}
            style={{
              display:       "block",
              width:         "100%",
              padding:       "8px 12px",
              marginBottom:  4,
              borderRadius:  6,
              border:        !status ? "2px solid rgba(255,255,255,0.5)" : "2px solid transparent",
              background:    "rgba(107,114,128,0.35)",
              color:         "rgba(255,255,255,0.6)",
              fontSize:      12,
              fontFamily:    "var(--font-heading)",
              fontWeight:    700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textAlign:     "center",
              cursor:        "pointer",
              transition:    "filter 0.1s",
            }}
            className="hover:brightness-125"
          >
            No Status
          </button>

          {/* Statuses */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {statuses.map(s => (
              <button
                key={s.id}
                onClick={() => { onSelect(s.id); setOpen(false) }}
                style={{
                  display:       "block",
                  width:         "100%",
                  padding:       "8px 12px",
                  borderRadius:  6,
                  border:        s.id === status?.id ? "2px solid rgba(255,255,255,0.6)" : "2px solid transparent",
                  background:    s.color,
                  color:         "#fff",
                  fontSize:      12,
                  fontFamily:    "var(--font-heading)",
                  fontWeight:    700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textAlign:     "center",
                  cursor:        "pointer",
                  transition:    "filter 0.1s",
                }}
                className="hover:brightness-110"
              >
                {s.label}
              </button>
            ))}
          </div>

        </div>,
    document.body
  ) : null

  return (
    <div ref={triggerRef} style={{ display: "inline-block" }}>
      <div onClick={openDropdown}>
        {pillEl}
      </div>
      {dropdown}
    </div>
  )
}
