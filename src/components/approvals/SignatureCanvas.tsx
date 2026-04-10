import { useEffect, useRef, useState } from "react"
import { Eraser, PenLine } from "lucide-react"

/**
 * Pen/touch drawing surface for capturing a customer signature on the public
 * approval portal. Exposes toPNGDataUrl() + clear() via the onReady callback
 * (parent stores the handle and calls it on submit). Tracks `hasInk` so the
 * parent can disable submit until something has been drawn.
 */

export interface SignatureCanvasHandle {
  toPNGDataUrl: () => string
  clear:        () => void
}

interface SignatureCanvasProps {
  onReady?:  (handle: SignatureCanvasHandle) => void
  onChange?: (hasInk: boolean) => void
  height?:   number
}

export function SignatureCanvas({ onReady, onChange, height = 180 }: SignatureCanvasProps) {
  const canvasRef   = useRef<HTMLCanvasElement | null>(null)
  const drawingRef  = useRef(false)
  const lastPtRef   = useRef<{ x: number; y: number } | null>(null)
  const [hasInk, setHasInk] = useState(false)

  // Prep the backing bitmap at device-pixel resolution so strokes stay crisp
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr  = window.devicePixelRatio || 1
      canvas.width  = Math.max(1, Math.floor(rect.width  * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.lineCap   = "round"
      ctx.lineJoin  = "round"
      ctx.lineWidth = 2
      ctx.strokeStyle = "#f5f3ee"
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // Expose handle to parent
  useEffect(() => {
    if (!onReady) return
    onReady({
      toPNGDataUrl: () => {
        const canvas = canvasRef.current
        if (!canvas) return ""
        return canvas.toDataURL("image/png")
      },
      clear: () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
        setHasInk(false)
        onChange?.(false)
      },
    })
  }, [onReady, onChange])

  const pointerAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawingRef.current = true
    lastPtRef.current  = pointerAt(e)
  }

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const pt = pointerAt(e)
    const last = lastPtRef.current ?? pt
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    lastPtRef.current = pt

    if (!hasInk) {
      setHasInk(true)
      onChange?.(true)
    }
  }

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false
    lastPtRef.current  = null
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHasInk(false)
    onChange?.(false)
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: "1px solid rgba(212,160,23,0.25)",
        background: "rgba(0,0,0,0.35)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <div className="flex items-center gap-2">
          <PenLine className="h-3 w-3" style={{ color: "var(--skyshare-gold)" }} />
          <span
            className="text-[9px] uppercase tracking-widest"
            style={{
              color: "var(--skyshare-gold)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.2em",
            }}
          >
            Sign Here
          </span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasInk}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest transition-opacity disabled:opacity-30 hover:opacity-70"
          style={{
            color: "rgba(255,255,255,0.5)",
            fontFamily: "var(--font-heading)",
            letterSpacing: "0.15em",
          }}
        >
          <Eraser className="h-3 w-3" />
          Clear
        </button>
      </div>

      {/* Drawing surface */}
      <div style={{ position: "relative", height, touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          onPointerLeave={handleUp}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            cursor: "crosshair",
            touchAction: "none",
          }}
        />
        {!hasInk && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{
              color: "rgba(255,255,255,0.18)",
              fontFamily: "'Dancing Script', cursive",
              fontSize: "1.6rem",
            }}
          >
            Sign here
          </div>
        )}
        {/* Signature line */}
        <div
          className="pointer-events-none absolute left-6 right-6"
          style={{
            bottom: "24%",
            height: 1,
            background: "rgba(212,160,23,0.3)",
          }}
        />
      </div>
    </div>
  )
}
