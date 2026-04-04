import { useRef, useEffect } from "react"

// ── Constants ────────────────────────────────────────────────────────────────
const PADDLE_W   = 5
const PADDLE_H   = 44
const BALL_R     = 7          // collision radius
const S_SIZE     = 18         // drawn size of the S mark (px)
const BALL_SPEED = 312        // px/s base speed
const TOMMY_MAX  = 224        // px/s max Tommy speed (–20%)
// How far outside the banner the mouse can roam and still keep the game active.
// Expressed as a fraction of the banner height (0.30 = 30 %).
const HOVER_OVERRUN_FRAC = 0.30

// ── PongGame ─────────────────────────────────────────────────────────────────
// Positioned absolutely inside a relative container — caller must set
// position:relative on the wrapping div.

export function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sImgRef   = useRef<HTMLImageElement | null>(null)

  // All mutable game state lives here so the RAF closure always sees fresh values.
  const state = useRef({
    bx: 0,    by: 0,          // ball position (px)
    vx: BALL_SPEED,           // ball velocity (px/s)
    vy: BALL_SPEED * 0.55,
    py: 0,                    // player paddle center (px)
    ty: 0,                    // tommy paddle center (px)
    playerScore: 0,
    tommyScore: 0,
    hovering: false,
    mouseY: 0,                // mouse Y relative to container top (px)
    prevTime: 0,              // last RAF timestamp
    raf: 0,
    W: 0, H: 0,               // canvas dimensions
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const s = state.current

    // ── Sprite ───────────────────────────────────────────────────────────────
    const sImg = new Image()
    sImg.src = "/skyshare-s_white-transparent_32.png"
    sImg.onload = () => { sImgRef.current = sImg }

    // ── Sizing ───────────────────────────────────────────────────────────────
    const sync = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width  = r.width
      canvas.height = r.height
      s.W = r.width
      s.H = r.height
      if (s.bx === 0) s.bx = s.W / 2
      if (s.by === 0) s.by = s.H / 2
      if (s.py === 0) s.py = s.H / 2
      if (s.ty === 0) s.ty = s.H / 2
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(canvas)

    // ── Input — document-level so the mouse can roam outside the banner ───────
    const container = canvas.parentElement!

    const onDocMove = (e: MouseEvent) => {
      const rect    = container.getBoundingClientRect()
      const overrunV = rect.height * HOVER_OVERRUN_FRAC
      // Small horizontal margin so a stray pixel off the left/right edge doesn't kill it
      const overrunH = 20

      const inX = e.clientX >= rect.left  - overrunH && e.clientX <= rect.right  + overrunH
      const inY = e.clientY >= rect.top   - overrunV && e.clientY <= rect.bottom + overrunV

      s.hovering = inX && inY
      // Always update mouseY so the paddle follows smoothly while mouse is near
      s.mouseY = e.clientY - rect.top
    }

    document.addEventListener("mousemove", onDocMove)

    // ── Ball reset ────────────────────────────────────────────────────────────
    const resetBall = (toRight: boolean) => {
      s.bx = s.W / 2
      s.by = s.H / 2
      const angle = Math.random() * 0.6 - 0.3          // ± 0.3 rad
      const spd   = BALL_SPEED * (1 + s.playerScore * 0.03)
      s.vx = (toRight ? 1 : -1) * spd * Math.cos(angle)
      s.vy = spd * Math.sin(angle)
    }

    // ── Draw helper ───────────────────────────────────────────────────────────
    const drawPaddle = (
      ctx: CanvasRenderingContext2D,
      x: number, y: number,
      color: string,
    ) => {
      ctx.fillStyle = color
      const rx = x - PADDLE_W / 2
      const ry = y - PADDLE_H / 2
      ctx.beginPath()
      ctx.roundRect(rx, ry, PADDLE_W, PADDLE_H, 2)
      ctx.fill()
    }

    // ── Game loop ─────────────────────────────────────────────────────────────
    const tick = (rafTime: number) => {
      s.raf = requestAnimationFrame(tick)

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const dt = Math.min((rafTime - (s.prevTime || rafTime)) / 1000, 0.05)
      s.prevTime = rafTime
      const { W, H } = s

      if (s.hovering && W > 0 && H > 0) {
        // Player paddle — follows mouse Y with slight smoothing
        s.py += (s.mouseY - s.py) * Math.min(dt * 14, 1)

        // Tommy AI — lazy tracking
        const diff = s.by - s.ty
        s.ty += Math.sign(diff) * Math.min(Math.abs(diff), TOMMY_MAX * dt)

        // Clamp paddles
        const half = PADDLE_H / 2
        s.py = Math.max(half, Math.min(H - half, s.py))
        s.ty = Math.max(half, Math.min(H - half, s.ty))

        // Ball movement
        s.bx += s.vx * dt
        s.by += s.vy * dt

        // Wall bounces
        if (s.by - BALL_R <= 0) { s.by = BALL_R;     s.vy =  Math.abs(s.vy) }
        if (s.by + BALL_R >= H) { s.by = H - BALL_R; s.vy = -Math.abs(s.vy) }

        // Player paddle collision (left)
        const pEdge = PADDLE_W + BALL_R
        if (s.vx < 0 && s.bx <= pEdge && Math.abs(s.by - s.py) <= PADDLE_H / 2 + BALL_R) {
          s.bx = pEdge
          const hit = (s.by - s.py) / (PADDLE_H / 2)
          const spd = Math.hypot(s.vx, s.vy) * 1.04
          s.vx =  Math.abs(Math.cos(hit * 0.9) * spd)
          s.vy =  Math.sin(hit * 0.9) * spd
        }

        // Tommy paddle collision (right)
        const tEdge = W - PADDLE_W - BALL_R
        if (s.vx > 0 && s.bx >= tEdge && Math.abs(s.by - s.ty) <= PADDLE_H / 2 + BALL_R) {
          s.bx = tEdge
          const hit = (s.by - s.ty) / (PADDLE_H / 2)
          const spd = Math.hypot(s.vx, s.vy) * 1.04
          s.vx = -Math.abs(Math.cos(hit * 0.9) * spd)
          s.vy =  Math.sin(hit * 0.9) * spd
        }

        // Scoring
        if (s.bx < -BALL_R * 2)      { s.tommyScore++;  resetBall(false) }
        if (s.bx > W + BALL_R * 2)   { s.playerScore++; resetBall(true)  }
      }

      // ── Draw ────────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H)
      if (W === 0 || H === 0) return

      ctx.save()
      ctx.globalAlpha = s.hovering ? 1 : 0.22

      // Center dashed divider
      ctx.setLineDash([4, 8])
      ctx.strokeStyle = "rgba(255,255,255,0.08)"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(W / 2, 0)
      ctx.lineTo(W / 2, H)
      ctx.stroke()
      ctx.setLineDash([])

      // Paddles
      drawPaddle(ctx, PADDLE_W / 2,     s.py, "rgba(212,160,23,0.92)")
      drawPaddle(ctx, W - PADDLE_W / 2, s.ty,
        s.hovering ? "rgba(200,50,50,0.88)" : "rgba(200,50,50,0.3)")

      // S mark glow
      const glowR = S_SIZE * 0.9
      const grd = ctx.createRadialGradient(s.bx, s.by, 0, s.bx, s.by, glowR)
      grd.addColorStop(0, "rgba(255,255,255,0.35)")
      grd.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(s.bx, s.by, glowR, 0, Math.PI * 2)
      ctx.fill()

      // S mark sprite
      if (sImgRef.current) {
        const half = S_SIZE / 2
        ctx.drawImage(sImgRef.current, s.bx - half, s.by - half, S_SIZE, S_SIZE)
      } else {
        ctx.fillStyle = "#ffffff"
        ctx.beginPath()
        ctx.arc(s.bx, s.by, BALL_R, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()

      // ── Scores — always full opacity, persist for the session ─────────────
      ctx.save()
      ctx.font         = "700 10px 'Courier New', monospace"
      ctx.textBaseline = "top"

      ctx.fillStyle = "rgba(212,160,23,0.85)"
      ctx.textAlign = "left"
      ctx.fillText(`YOU: ${s.playerScore}`, PADDLE_W + 10, 8)

      ctx.fillStyle = "rgba(200,50,50,0.75)"
      ctx.textAlign = "right"
      ctx.fillText(`TOMMY: ${s.tommyScore}`, W - PADDLE_W - 10, 8)

      ctx.restore()
    }

    s.raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(s.raf)
      ro.disconnect()
      document.removeEventListener("mousemove", onDocMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        display: "block",
      }}
    />
  )
}
