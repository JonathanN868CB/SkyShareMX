import { useRef, useEffect } from "react"
import { createPortal } from "react-dom"

// ── Constants ────────────────────────────────────────────────────────────────
const PADDLE_W   = 5
const PADDLE_H   = 44
const BALL_R     = 7
const S_SIZE     = 18
const BALL_SPEED = 312
const TOMMY_MAX  = 107
const BURST_LIFE = 3
const VOLLEY_THRESHOLD = 7   // volleys before second ball spawns
const HOVER_OVERRUN_FRAC = 0.30

// ── PongGame ─────────────────────────────────────────────────────────────────
export function PongGame() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const sImgRef    = useRef<HTMLImageElement | null>(null)

  const state = useRef({
    // Ball 1
    bx: 0, by: 0,
    vx: BALL_SPEED,
    vy: BALL_SPEED * 0.55,
    // Ball 2
    b2Active: false,
    b2x: 0, b2y: 0, b2vx: 0, b2vy: 0,
    // Paddles
    py: 0,
    ty: 0,
    // Scores & session state
    playerScore: 0,
    tommyScore: 0,
    hovering: false,
    mouseY: 0,
    prevTime: 0,
    raf: 0,
    W: 0, H: 0,
    volleyCount: 0,        // paddle hits in current rally; resets on score
    tommyHitCount: 0,
    tommyErrorActive: false,
    tommyErrorTimer: 0,
    // POW burst (Tommy slam)
    powActive: false, powX: 0, powY: 0, powVx: 0, powVy: 0, powAge: 0,
    // Tommy scores burst
    winsActive: false, winsX: 0, winsY: 0, winsVx: 0, winsVy: 0, winsAge: 0,
    winsLines: ["TOMMY", "SCORES!"] as string[],
  })

  useEffect(() => {
    const canvas  = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas || !overlay) return
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

    const syncOverlay = () => {
      overlay.width  = window.innerWidth
      overlay.height = window.innerHeight
    }
    syncOverlay()
    window.addEventListener("resize", syncOverlay)

    // ── Input ─────────────────────────────────────────────────────────────────
    const container = canvas.parentElement!
    const onDocMove = (e: MouseEvent) => {
      const rect     = container.getBoundingClientRect()
      const overrunV = rect.height * HOVER_OVERRUN_FRAC
      const overrunH = 20
      const inX = e.clientX >= rect.left - overrunH && e.clientX <= rect.right  + overrunH
      const inY = e.clientY >= rect.top  - overrunV && e.clientY <= rect.bottom + overrunV
      s.hovering = inX && inY
      s.mouseY   = e.clientY - rect.top
    }
    document.addEventListener("mousemove", onDocMove)

    // ── Ball reset ────────────────────────────────────────────────────────────
    const resetBall = (toRight: boolean) => {
      s.bx = s.W / 2
      s.by = s.H / 2
      const angle = Math.random() * 0.6 - 0.3
      const spd   = BALL_SPEED * (1 + s.playerScore * 0.03)
      s.vx = (toRight ? 1 : -1) * spd * Math.cos(angle)
      s.vy = spd * Math.sin(angle)
      // Kill second ball and reset rally counter
      s.b2Active   = false
      s.volleyCount = 0
    }

    // ── Draw helpers ──────────────────────────────────────────────────────────
    const drawPaddle = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(x - PADDLE_W / 2, y - PADDLE_H / 2, PADDLE_W, PADDLE_H, 2)
      ctx.fill()
    }

    const drawBall = (
      ctx: CanvasRenderingContext2D,
      bx: number, by: number,
      glowColor: string,
    ) => {
      const glowR = S_SIZE * 0.9
      const grd = ctx.createRadialGradient(bx, by, 0, bx, by, glowR)
      grd.addColorStop(0, glowColor)
      grd.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(bx, by, glowR, 0, Math.PI * 2)
      ctx.fill()

      if (sImgRef.current) {
        const half = S_SIZE / 2
        ctx.drawImage(sImgRef.current, bx - half, by - half, S_SIZE, S_SIZE)
      } else {
        ctx.fillStyle = "#ffffff"
        ctx.beginPath()
        ctx.arc(bx, by, BALL_R, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawStarburst = (
      ctx: CanvasRenderingContext2D,
      outerR: number, innerR: number, points: number,
    ) => {
      ctx.beginPath()
      for (let i = 0; i < points * 2; i++) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 === 0 ? outerR : innerR
        ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
      }
      ctx.closePath()
    }

    // ── Comic burst renderer ──────────────────────────────────────────────────
    const drawBurst = (
      ctx: CanvasRenderingContext2D,
      x: number, y: number, age: number,
      isPow: boolean,
      lines?: string[],
    ) => {
      const t     = age / BURST_LIFE
      const alpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1

      let scale: number
      if (t < 0.033)      scale = (t / 0.033) * 1.7
      else if (t < 0.073) scale = 1.7 - ((t - 0.033) / 0.04) * 0.7
      else                scale = 1.0

      const shakeAmt = t < 0.1 ? 6 : t < 0.85 ? 2.5 : 0
      const sx = x + (Math.random() * 2 - 1) * shakeAmt
      const sy = y + (Math.random() * 2 - 1) * shakeAmt
      const rot = Math.sin(age * 9) * 0.07 + (isPow ? 0.12 : -0.10)

      const outerR = isPow ? 62 : 84
      const innerR = isPow ? 38 : 52
      const points = isPow ? 13 : 11

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(sx, sy)
      ctx.rotate(rot)
      ctx.scale(scale, scale)

      ctx.shadowColor   = "rgba(0,0,0,0.65)"
      ctx.shadowBlur    = 14
      ctx.shadowOffsetX = 3
      ctx.shadowOffsetY = 4

      drawStarburst(ctx, outerR, innerR, points)
      ctx.fillStyle = isPow ? "#FFE000" : "#CC1111"
      ctx.fill()

      ctx.shadowBlur = 0
      ctx.strokeStyle = "#111111"
      ctx.lineWidth   = isPow ? 4.5 : 5.5
      ctx.lineJoin    = "round"
      ctx.stroke()

      drawStarburst(ctx, outerR * 0.84, innerR * 0.84, points)
      ctx.strokeStyle = "rgba(0,0,0,0.18)"
      ctx.lineWidth   = 1.5
      ctx.stroke()

      const fontSize = isPow ? 36 : 28
      ctx.font         = `900 ${fontSize}px Impact, 'Arial Black', Arial, sans-serif`
      ctx.textAlign    = "center"
      ctx.textBaseline = "middle"

      if (isPow) {
        ctx.strokeStyle = "#111111"; ctx.lineWidth = 7; ctx.lineJoin = "round"
        ctx.strokeText("POW!", 0, 1)
        ctx.fillStyle = "#CC0000"; ctx.fillText("POW!", 0, 1)
        ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillText("POW!", 0, -2)
      } else {
        const lineH    = fontSize * 1.05
        const twoLines = lines ?? ["TOMMY", "SCORES!"]
        twoLines.forEach((line, i) => {
          const ly = (i - 0.5) * lineH
          ctx.strokeStyle = "#111111"; ctx.lineWidth = 7; ctx.lineJoin = "round"
          ctx.strokeText(line, 0, ly + 1)
          ctx.fillStyle = "#FFFFFF"; ctx.fillText(line, 0, ly + 1)
          ctx.fillStyle = "rgba(255,220,0,0.35)"; ctx.fillText(line, 0, ly - 1)
        })
      }

      ctx.restore()
    }

    // ── Game loop ─────────────────────────────────────────────────────────────
    const tick = (rafTime: number) => {
      s.raf = requestAnimationFrame(tick)

      const ctx  = canvas.getContext("2d")
      const octx = overlay.getContext("2d")
      if (!ctx || !octx) return

      const dt = Math.min((rafTime - (s.prevTime || rafTime)) / 1000, 0.05)
      s.prevTime = rafTime
      const { W, H } = s

      // Advance burst animations
      if (s.powActive) {
        s.powAge += dt; s.powX += s.powVx * dt; s.powY += s.powVy * dt
        if (s.powAge >= BURST_LIFE) s.powActive = false
      }
      if (s.winsActive) {
        s.winsAge += dt; s.winsX += s.winsVx * dt; s.winsY += s.winsVy * dt
        if (s.winsAge >= BURST_LIFE) s.winsActive = false
      }

      if (s.hovering && W > 0 && H > 0) {
        // ── Player paddle ──────────────────────────────────────────────────
        s.py += (s.mouseY - s.py) * Math.min(dt * 14, 1)

        // ── Tommy AI ───────────────────────────────────────────────────────
        s.tommyErrorTimer -= dt
        if (s.tommyErrorTimer <= 0) {
          s.tommyErrorActive = Math.random() < 0.15
          s.tommyErrorTimer  = 0.3 + Math.random() * 0.5
        }
        // Tommy tracks whichever ball is closer to his side
        const tommyTarget = (s.b2Active && s.b2x > s.bx) ? s.b2y : s.by
        const diff     = tommyTarget - s.ty
        const errorDir = s.tommyErrorActive ? -1 : 1
        s.ty += errorDir * Math.sign(diff) * Math.min(Math.abs(diff), TOMMY_MAX * dt)

        // Clamp paddles
        const half = PADDLE_H / 2
        s.py = Math.max(half, Math.min(H - half, s.py))
        s.ty = Math.max(half, Math.min(H - half, s.ty))

        // ── Ball 1 movement ────────────────────────────────────────────────
        s.bx += s.vx * dt
        s.by += s.vy * dt

        if (s.by - BALL_R <= 0) { s.by = BALL_R;     s.vy =  Math.abs(s.vy) }
        if (s.by + BALL_R >= H) { s.by = H - BALL_R; s.vy = -Math.abs(s.vy) }

        // Ball 1 — player paddle
        const pEdge = PADDLE_W + BALL_R
        if (s.vx < 0 && s.bx <= pEdge && Math.abs(s.by - s.py) <= PADDLE_H / 2 + BALL_R) {
          s.bx = pEdge
          const hit = (s.by - s.py) / (PADDLE_H / 2)
          const spd = Math.hypot(s.vx, s.vy) * 1.04
          s.vx =  Math.abs(Math.cos(hit * 0.9) * spd)
          s.vy =  Math.sin(hit * 0.9) * spd
          s.volleyCount++
        }

        // Ball 1 — Tommy paddle
        const tEdge = W - PADDLE_W - BALL_R
        if (s.vx > 0 && s.bx >= tEdge && Math.abs(s.by - s.ty) <= PADDLE_H / 2 + BALL_R) {
          s.bx = tEdge
          s.tommyHitCount++
          s.volleyCount++
          const hit    = (s.by - s.ty) / (PADDLE_H / 2)
          const isSlam = s.tommyHitCount % 5 === 0
          const spd    = Math.hypot(s.vx, s.vy) * 1.04 * (isSlam ? 5 : 1)
          s.vx = -Math.abs(Math.cos(hit * 0.9) * spd)
          s.vy =  Math.sin(hit * 0.9) * spd

          if (isSlam) {
            const rect  = canvas.getBoundingClientRect()
            s.powActive = true
            s.powAge    = 0
            // Anchor near the right edge, clamped so burst never clips off-screen
            s.powX      = Math.min(rect.right - 100, overlay.width - 100)
            s.powY      = rect.top  + s.ty + (Math.random() * 20 - 10)
            s.powVx     = -(85 + Math.random() * 30)
            s.powVy     =   30 + Math.random() * 35
          }
        }

        // Spawn second ball after threshold volleys
        if (s.volleyCount === VOLLEY_THRESHOLD && !s.b2Active) {
          s.b2Active = true
          s.b2x = W / 2
          s.b2y = H * (0.25 + Math.random() * 0.5)
          const angle2 = Math.random() < 0.5
            ? Math.random() * 0.5 - 0.25
            : Math.PI + Math.random() * 0.5 - 0.25
          const spd2 = BALL_SPEED
          s.b2vx = Math.cos(angle2) * spd2
          s.b2vy = Math.sin(angle2) * spd2
        }

        // ── Ball 2 movement ────────────────────────────────────────────────
        if (s.b2Active) {
          s.b2x += s.b2vx * dt
          s.b2y += s.b2vy * dt

          // Wall bounces
          if (s.b2y - BALL_R <= 0) { s.b2y = BALL_R;     s.b2vy =  Math.abs(s.b2vy) }
          if (s.b2y + BALL_R >= H) { s.b2y = H - BALL_R; s.b2vy = -Math.abs(s.b2vy) }

          // Ball 2 — player paddle
          if (s.b2vx < 0 && s.b2x <= pEdge && Math.abs(s.b2y - s.py) <= PADDLE_H / 2 + BALL_R) {
            s.b2x = pEdge
            const hit = (s.b2y - s.py) / (PADDLE_H / 2)
            const spd = Math.hypot(s.b2vx, s.b2vy) * 1.04
            s.b2vx =  Math.abs(Math.cos(hit * 0.9) * spd)
            s.b2vy =  Math.sin(hit * 0.9) * spd
          }

          // Ball 2 — Tommy paddle
          if (s.b2vx > 0 && s.b2x >= tEdge && Math.abs(s.b2y - s.ty) <= PADDLE_H / 2 + BALL_R) {
            s.b2x = tEdge
            const hit = (s.b2y - s.ty) / (PADDLE_H / 2)
            const spd = Math.hypot(s.b2vx, s.b2vy) * 1.04
            s.b2vx = -Math.abs(Math.cos(hit * 0.9) * spd)
            s.b2vy =  Math.sin(hit * 0.9) * spd
          }

          // Ball 2 exits — just deactivate (no score change)
          if (s.b2x < -BALL_R * 4 || s.b2x > W + BALL_R * 4) {
            s.b2Active = false
          }

          // ── Ball-to-ball elastic collision ─────────────────────────────
          const dx  = s.b2x - s.bx
          const dy  = s.b2y - s.by
          const d   = Math.hypot(dx, dy)
          if (d < BALL_R * 2 && d > 0) {
            const nx  = dx / d
            const ny  = dy / d
            // Velocity components along the collision normal
            const v1n = s.vx  * nx + s.vy  * ny
            const v2n = s.b2vx * nx + s.b2vy * ny
            // Only resolve if balls are actually approaching each other
            if (v1n > v2n) {
              const impulse = v2n - v1n
              s.vx   += impulse * nx;  s.vy   += impulse * ny
              s.b2vx -= impulse * nx;  s.b2vy -= impulse * ny
              // Separate so they don't tunnel into each other
              const overlap = (BALL_R * 2 - d) * 0.5
              s.bx  -= nx * overlap;   s.by  -= ny * overlap
              s.b2x += nx * overlap;   s.b2y += ny * overlap
            }
          }
        }

        // ── Scoring ────────────────────────────────────────────────────────
        if (s.bx < -BALL_R * 2) {
          s.tommyScore++
          resetBall(false)
          const TOMMY_TAUNTS = [
            ["TOMMY", "SCORES!"],
            ["BOOM",  "BABY!"],
            ["TOO",   "EASY!"],
            ["NICE",  "TRY!"],
          ]
          s.winsLines  = TOMMY_TAUNTS[Math.floor(Math.random() * TOMMY_TAUNTS.length)]
          const rect   = canvas.getBoundingClientRect()
          s.winsActive = true
          s.winsAge    = 0
          // Anchor near right edge, clamped so burst never clips off-screen
          s.winsX      = Math.min(rect.right - 130, overlay.width - 130)
          s.winsY      = rect.top + H * 0.5
          s.winsVx     = -(55 + Math.random() * 25)
          s.winsVy     =   20 + Math.random() * 30
        }
        if (s.bx > W + BALL_R * 2) { s.playerScore++; resetBall(true) }
      }

      // ── Draw game canvas ──────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H)
      if (W === 0 || H === 0) return

      ctx.save()
      ctx.globalAlpha = s.hovering ? 1 : 0.22

      // Center divider
      ctx.setLineDash([4, 8])
      ctx.strokeStyle = "rgba(255,255,255,0.08)"
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
      ctx.setLineDash([])

      // Paddles
      drawPaddle(ctx, PADDLE_W / 2,     s.py, "rgba(212,160,23,0.92)")
      drawPaddle(ctx, W - PADDLE_W / 2, s.ty,
        s.hovering ? "rgba(200,50,50,0.88)" : "rgba(200,50,50,0.3)")

      // Ball 1 — white glow
      drawBall(ctx, s.bx, s.by, "rgba(255,255,255,0.35)")

      // Ball 2 — cyan glow to distinguish it
      if (s.b2Active) {
        drawBall(ctx, s.b2x, s.b2y, "rgba(80,220,255,0.45)")
      }

      ctx.restore()

      // Scores
      ctx.save()
      ctx.font = "700 12px 'Courier New', monospace"; ctx.textBaseline = "top"
      ctx.fillStyle = "rgba(212,160,23,0.85)"; ctx.textAlign = "left"
      ctx.fillText(`YOU: ${s.playerScore}`, PADDLE_W + 10, 8)
      ctx.fillStyle = "rgba(200,50,50,0.75)"; ctx.textAlign = "right"
      ctx.fillText(`TOMMY: ${s.tommyScore}`, W - PADDLE_W - 10, 8)
      ctx.restore()

      // ── Overlay (always above everything) ────────────────────────────────
      octx.clearRect(0, 0, overlay.width, overlay.height)
      if (s.powActive)  drawBurst(octx, s.powX,  s.powY,  s.powAge,  true)
      if (s.winsActive) drawBurst(octx, s.winsX, s.winsY, s.winsAge, false, s.winsLines)
    }

    s.raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(s.raf)
      ro.disconnect()
      document.removeEventListener("mousemove", onDocMove)
      window.removeEventListener("resize", syncOverlay)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          zIndex: 0, pointerEvents: "none", display: "block",
        }}
      />
      {createPortal(
        <canvas
          ref={overlayRef}
          aria-hidden="true"
          style={{
            position: "fixed", top: 0, left: 0,
            width: "100vw", height: "100vh",
            zIndex: 9999, pointerEvents: "none", display: "block",
          }}
        />,
        document.body,
      )}
    </>
  )
}
