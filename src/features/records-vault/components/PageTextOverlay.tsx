/**
 * PageTextOverlay — Textract word-overlay page viewer
 *
 * Renders a scanned page image with a transparent, selectable text layer
 * projected exactly onto the image using Textract word-level bounding boxes.
 *
 * Layout:
 *   position: relative container
 *     <img>                       — the scanned page (visual layer)
 *     <div position: absolute>    — the text layer (invisible but interactive)
 *       <span> per word           — positioned using normalized Textract geometry
 *
 * Search matches:  word spans matching the search query get a gold
 *                  semi-transparent background (like a highlighter on the scan).
 *
 * Text selection:  browser-native. CSS `::selection` gives the blue tint.
 *                  The text layer uses `pointer-events: none` so scroll and
 *                  zoom gestures still reach the underlying image/page.
 *
 * Fallback:        when no page_image_path is available the component renders
 *                  nothing — the caller (RecordsVaultViewer) renders PdfPageRenderer
 *                  instead.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
import type { WordGeometry, CheckboxElement } from "../types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Returns true if the word text contains the search query (case-insensitive). */
function wordMatches(wordText: string, query: string): boolean {
  if (!query.trim()) return false
  return wordText.toLowerCase().includes(query.toLowerCase())
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  imageUrl:     string
  wordGeometry: WordGeometry[]     | null
  checkboxes?:  CheckboxElement[]  | null
  searchQuery?: string
  pageNumber:   number
}

// ─── CSS injected once for ::selection ───────────────────────────────────────
// Keeps the drag-select highlight consistent across the viewer.

let selectionStyleInjected = false
function injectSelectionStyle() {
  if (selectionStyleInjected || typeof document === "undefined") return
  selectionStyleInjected = true
  const style = document.createElement("style")
  style.textContent = `
    .rv-text-layer span::selection {
      background: rgba(59, 130, 246, 0.45);
      color: transparent;
    }
    .rv-text-layer span::-moz-selection {
      background: rgba(59, 130, 246, 0.45);
      color: transparent;
    }
  `
  document.head.appendChild(style)
}

// ─── Component ────────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.15

export function PageTextOverlay({ imageUrl, wordGeometry, checkboxes, searchQuery, pageNumber }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const imgRef        = useRef<HTMLImageElement>(null)

  const [imageLoaded,   setImageLoaded]   = useState(false)
  const [imageError,    setImageError]    = useState(false)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)
  const [zoom,          setZoom]          = useState(1)
  const [isPanning,     setIsPanning]     = useState(false)

  useEffect(() => { injectSelectionStyle() }, [])

  // Reset state when imageUrl or page changes
  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
    setContainerSize(null)
    setZoom(1)
  }, [imageUrl, pageNumber])

  // Track rendered image size — word span pixel positions depend on it, which
  // changes whenever the panel is resized OR the user zooms in/out.
  const updateSize = useCallback(() => {
    const img = imgRef.current
    if (!img || !img.complete) return
    setContainerSize({ w: img.clientWidth, h: img.clientHeight })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    const img = imgRef.current
    if (img) ro.observe(img)
    return () => ro.disconnect()
  }, [updateSize, imageLoaded])

  // Re-measure after zoom changes commit so overlay matches the new image size
  useEffect(() => {
    requestAnimationFrame(() => updateSize())
  }, [zoom, updateSize])

  // Mouse wheel → zoom. preventDefault requires a non-passive listener, which
  // React's synthetic onWheel can't give us, so attach natively.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const direction = e.deltaY < 0 ? 1 : -1
      setZoom((z) => {
        const next = z + direction * ZOOM_STEP
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(next.toFixed(3))))
      })
    }
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [])

  // Middle mouse button → grab-pan the page. Windows/Linux browsers treat
  // middle-click as auto-scroll; preventDefault on mousedown suppresses that
  // so we can drive scrollLeft/scrollTop directly from pointer movement.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let panning    = false
    let lastX      = 0
    let lastY      = 0

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1) return   // middle only
      e.preventDefault()
      panning = true
      lastX = e.clientX
      lastY = e.clientY
      setIsPanning(true)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!panning) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      el.scrollLeft -= dx
      el.scrollTop  -= dy
    }

    const stop = () => {
      if (!panning) return
      panning = false
      setIsPanning(false)
    }

    // Swallow the auxclick that fires on middle-button release — without this
    // some browsers still try to enter autoscroll mode after the drag ends.
    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault()
    }

    el.addEventListener("mousedown", onMouseDown)
    el.addEventListener("auxclick",  onAuxClick)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup",   stop)
    window.addEventListener("blur",      stop)

    return () => {
      el.removeEventListener("mousedown", onMouseDown)
      el.removeEventListener("auxclick",  onAuxClick)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup",   stop)
      window.removeEventListener("blur",      stop)
    }
  }, [])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
    // Defer measurement until after React commits the state change — reading
    // clientWidth synchronously here returns 0 because the image's layout
    // hasn't been applied yet, which would render every word span at 0×0.
    requestAnimationFrame(() => updateSize())
  }, [updateSize])

  // Pre-compute which words match so we don't recalculate per-span
  const matchSet = useMemo<Set<number>>(() => {
    if (!searchQuery?.trim() || !wordGeometry) return new Set()
    const matches = new Set<number>()
    wordGeometry.forEach((w, i) => {
      if (wordMatches(w.text, searchQuery)) matches.add(i)
    })
    return matches
  }, [wordGeometry, searchQuery])

  const hasOverlay = imageLoaded && !!containerSize && !!wordGeometry?.length

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-start justify-center overflow-auto bg-muted/30"
      style={{
        cursor: isPanning ? "grabbing" : undefined,
        // Disable text selection mid-pan so drag doesn't accidentally select
        // a huge block of words while the user drags with middle mouse.
        userSelect: isPanning ? "none" : undefined,
      }}
    >
      {/* ── Page image ───────────────────────────────────────────────────── */}
      {!imageError ? (
        <div className="relative inline-block">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center min-w-[200px] min-h-[260px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <img
            ref={imgRef}
            src={imageUrl}
            alt={`Page ${pageNumber}`}
            className="block h-auto shadow-xl select-none"
            // Zoom is applied as a pixel-based width override so the browser
            // reflows the image and scrollbars appear naturally when it
            // overflows the container. The text layer re-measures via the
            // zoom useEffect so word spans stay aligned to the scan.
            style={{
              width:    `${zoom * 100}%`,
              maxWidth: "none",
            }}
            onLoad={handleImageLoad}
            onError={() => setImageError(true)}
            draggable={false}
          />

          {/* ── Text layer — only rendered once image dimensions are known ── */}
          {hasOverlay && containerSize && wordGeometry && (
            <div
              className="rv-text-layer absolute inset-0"
              aria-hidden={false}
              style={{
                width:          containerSize.w,
                height:         containerSize.h,
                // Parent is pointer-events: none so wheel/scroll gestures on
                // the gutter between words pass through to the image, but
                // individual word spans opt back in with pointer-events: auto
                // so drag-select and click still target text.
                pointerEvents:  "none",
                userSelect:     "text",
                WebkitUserSelect: "text",
              }}
            >
              {wordGeometry.map((word, i) => {
                const { left, top, width, height } = word.geometry
                const px = left   * containerSize.w
                const py = top    * containerSize.h
                const pw = width  * containerSize.w
                const ph = height * containerSize.h

                const isMatch = matchSet.has(i)

                return (
                  <span
                    key={i}
                    style={{
                      position:   "absolute",
                      left:       `${px}px`,
                      top:        `${py}px`,
                      width:      `${pw}px`,
                      height:     `${ph}px`,
                      // Font size tuned to match bounding box height
                      fontSize:   `${ph * 0.82}px`,
                      lineHeight: "1",
                      whiteSpace: "nowrap",
                      overflow:   "hidden",
                      // Text is invisible — the scanned image provides the visual
                      color:      "transparent",
                      // Search match: gold highlighter on top of the scan
                      background: isMatch
                        ? "rgba(212, 160, 23, 0.38)"
                        : "transparent",
                      // Rounded corners on highlighted spans to soften the overlay
                      borderRadius: isMatch ? "2px" : "0",
                      // Opt back in to pointer events so drag-select targets
                      // word spans even though the parent text layer disables
                      // them for pass-through scroll.
                      pointerEvents: "auto",
                      cursor: "text",
                    }}
                  >
                    {/* Trailing space is clipped by overflow: hidden so it
                        stays invisible, but copy/paste picks it up — without
                        it, adjacent absolute spans concatenate into "word1word2". */}
                    {word.text + " "}
                  </span>
                )
              })}

              {/* ── Checkbox overlays — SELECTION_ELEMENT highlights ──────── */}
              {checkboxes?.map((cb, i) => {
                if (!cb.selected) return null  // un-checked: no overlay needed, image shows it
                const px = cb.geometry.left   * containerSize.w
                const py = cb.geometry.top    * containerSize.h
                const pw = cb.geometry.width  * containerSize.w
                const ph = cb.geometry.height * containerSize.h
                return (
                  <span
                    key={`cb-${i}`}
                    title={cb.label ?? "Checked"}
                    style={{
                      position:     "absolute",
                      left:         `${px}px`,
                      top:          `${py}px`,
                      width:        `${pw}px`,
                      height:       `${ph}px`,
                      fontSize:     `${ph * 0.85}px`,
                      lineHeight:   "1",
                      color:        "transparent",
                      // Selected checkboxes get a soft green highlight so reviewers
                      // can immediately see which items are checked on AD/inspection
                      // forms without having to scrutinize the scan pixel-by-pixel.
                      background:   "rgba(16, 185, 129, 0.30)",
                      borderRadius: "2px",
                      cursor:       "default",
                    }}
                  >
                    ☑
                  </span>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
          <p className="text-xs">Page image failed to load.</p>
        </div>
      )}
    </div>
  )
}
