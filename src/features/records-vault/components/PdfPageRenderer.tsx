/**
 * PdfPageRenderer — Dual-mode page renderer
 *
 * Rendering priority (PDF is always preferred):
 *   1. PDF.js canvas + text layer — efficient, native highlighting
 *   2. Page image fallback — only when PDF.js fails (JBIG2/CCITTFax)
 *      Images are pre-stored during ingestion when problematic codecs are
 *      detected, so the fallback is instant with no runtime decisions.
 *
 * No iframe fallback. If both paths fail, shows an error banner.
 *
 * Features:
 *   - PDF.js with native text-layer search highlighting (primary)
 *   - Image renderer for JBIG2/CCITTFax pages (backup)
 *   - Zoom controls (fit-width, manual scale)
 *   - Pan tool (click-drag to scroll when zoomed)
 *   - Wheel-to-navigate between pages
 *
 * Text selection and search highlighting for image-rendered pages is
 * handled by the OCR Text companion pane (OcrTextPane) at the viewer
 * level, using Mistral's raw_ocr_text — not in-page overlays.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import {
  Loader2, AlertTriangle, ZoomIn, ZoomOut, Maximize2, ImageOff, Hand,
} from "lucide-react"
import type { WordGeometry } from "../types"

// Configure PDF.js worker from local package (CDN may not have this version)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString()

// ─── Types ───────────────────────────────────────────────────────────────────

interface PdfPageRendererProps {
  /** Signed URL for the PDF (full document — PDF.js uses range requests) */
  pdfUrl: string
  /** Signed URL for a pre-rendered page image (fallback when PDF.js fails) */
  pageImageUrl?: string | null
  /** Which page to render from the document (1-based, default 1) */
  pageNumber?: number
  /** Search query to highlight on the page (optional) */
  searchQuery?: string
  /** Unique key for forcing re-render on page change */
  pageKey: string
  /**
   * Textract word-level geometry for the current page.
   * When provided, a transparent text overlay is projected over the canvas
   * using normalized bounding boxes — same approach as PageTextOverlay.
   * Search matches are highlighted gold. Text selection works natively.
   * When provided, the PDF.js built-in text layer is disabled to avoid duplication.
   */
  wordGeometry?: WordGeometry[] | null
  /** Called when PDF.js can't render the page (blank canvas / JBIG2).
   *  Parent should respond by fetching a page image URL. */
  onPdfFailed?: () => void
  /** Callback when page finishes rendering (for performance tracking) */
  onRenderComplete?: () => void
  /** Called when user scrolls past the bottom of the page */
  onNextPage?: () => void
  /** Called when user scrolls past the top of the page */
  onPrevPage?: () => void
}

// ─── Zoom presets ────────────────────────────────────────────────────────────

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0]
const DEFAULT_ZOOM_IDX = 2 // 1.0

// ─── Pan (hand tool) hook ────────────────────────────────────────────────────

function usePanMode(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [panMode, setPanMode] = useState(false)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panMode || !containerRef.current) return
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    containerRef.current.style.cursor = "grabbing"
    e.preventDefault()
  }, [panMode, containerRef])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    containerRef.current.scrollLeft -= dx
    containerRef.current.scrollTop -= dy
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [containerRef])

  const onMouseUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    if (containerRef.current) {
      containerRef.current.style.cursor = panMode ? "grab" : ""
    }
  }, [panMode, containerRef])

  return { panMode, setPanMode, panHandlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp } }
}

// ─── Highlight overlay logic ─────────────────────────────────────────────────

/**
 * After PDF.js renders the text layer, scan it for search term matches
 * and apply highlight styling. Uses the actual DOM text layer spans
 * that PDF.js creates — their positions are already pixel-perfect.
 */
function highlightTextLayer(container: HTMLDivElement, query: string) {
  if (!query.trim()) return

  const textLayerEl = container.querySelector(".react-pdf__Page__textContent")
  if (!textLayerEl) return

  const spans = textLayerEl.querySelectorAll("span")
  const lowerQuery = query.toLowerCase()

  spans.forEach((span) => {
    const text = span.textContent?.toLowerCase() ?? ""
    if (text.includes(lowerQuery)) {
      const original = span.textContent ?? ""
      const idx = text.indexOf(lowerQuery)
      if (idx === -1) return

      const before = original.slice(0, idx)
      const match = original.slice(idx, idx + query.length)
      const after = original.slice(idx + query.length)

      span.innerHTML = ""
      if (before) span.appendChild(document.createTextNode(before))

      const mark = document.createElement("mark")
      mark.textContent = match
      mark.style.cssText = "background: rgba(212,160,23,0.45); color: inherit; border-radius: 2px; padding: 0 1px; mix-blend-mode: multiply;"
      span.appendChild(mark)

      if (after) span.appendChild(document.createTextNode(after))
    }
  })
}

// ─── Image renderer (fallback for JBIG2/CCITTFax scanned documents) ──────────

function ImagePageRenderer({
  imageUrl,
  onNextPage,
  onPrevPage,
}: {
  imageUrl: string
  onNextPage?: () => void
  onPrevPage?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const wheelDebounceRef = useRef<number | null>(null)
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM_IDX)
  const [fitMode, setFitMode] = useState<"width" | "manual">("width")
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [containerWidth, setContainerWidth] = useState(800)
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const { panMode, setPanMode, panHandlers } = usePanMode(containerRef)

  const scale = ZOOM_STEPS[zoomIdx]

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w && w > 0) setContainerWidth(w)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Reset on image URL change
  useEffect(() => {
    setImgLoaded(false)
    setImgError(false)
    setImgNaturalSize(null)
    setFitMode("width")
    setZoomIdx(DEFAULT_ZOOM_IDX)
  }, [imageUrl])

  const handleImgLoad = useCallback(() => {
    setImgLoaded(true)
    if (imgRef.current) {
      setImgNaturalSize({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      })
    }
  }, [])

  const handleWheelCapture = useCallback((e: React.WheelEvent) => {
    if (containerRef.current) {
      const el = containerRef.current
      if (el.scrollHeight > el.clientHeight + 2) {
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4
        const atTop = el.scrollTop <= 0
        if (e.deltaY > 0 && !atBottom) return
        if (e.deltaY < 0 && !atTop) return
      }
    }
    if (wheelDebounceRef.current) return
    wheelDebounceRef.current = window.setTimeout(() => { wheelDebounceRef.current = null }, 350)
    if (e.deltaY > 0) onNextPage?.()
    else if (e.deltaY < 0) onPrevPage?.()
  }, [onNextPage, onPrevPage])

  if (imgError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-neutral-800 text-muted-foreground">
        <ImageOff className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-xs">Page image failed to load</p>
      </div>
    )
  }

  const imgWidth = fitMode === "width" ? containerWidth - 24 : undefined
  const imgStyle = fitMode === "manual"
    ? { transform: `scale(${scale})`, transformOrigin: "top center" }
    : undefined

  return (
    <div className="flex flex-col h-full min-h-0" onWheelCapture={handleWheelCapture}>
      {/* Zoom toolbar */}
      <div className="flex items-center justify-center gap-1 px-3 py-1.5 bg-muted/30 border-b border-border shrink-0">
        <button
          onClick={() => { setFitMode("manual"); setZoomIdx((i) => Math.max(0, i - 1)) }}
          disabled={zoomIdx <= 0 && fitMode === "manual"}
          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <span className="text-[10px] text-muted-foreground tabular-nums min-w-[44px] text-center">
          {fitMode === "width" ? "Fit" : `${Math.round(scale * 100)}%`}
        </span>
        <button
          onClick={() => { setFitMode("manual"); setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1)) }}
          disabled={zoomIdx >= ZOOM_STEPS.length - 1}
          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="w-px h-3.5 bg-border mx-1" />
        <button
          onClick={() => { setFitMode("width"); setZoomIdx(DEFAULT_ZOOM_IDX) }}
          className={`p-1 rounded transition-colors ${fitMode === "width" ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          title="Fit to width"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-3.5 bg-border mx-1" />
        <button
          onClick={() => setPanMode((p) => !p)}
          className={`p-1 rounded transition-colors ${panMode ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          title="Pan (click and drag to scroll)"
        >
          <Hand className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Image rendering area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-neutral-800 flex justify-center"
        style={{ cursor: panMode ? "grab" : undefined }}
        {...panHandlers}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="relative py-3" style={imgStyle}>
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Record page"
            width={imgWidth}
            style={{
              maxWidth: fitMode === "width" ? `${containerWidth - 24}px` : undefined,
              display: imgLoaded ? "block" : "none",
            }}
            onLoad={handleImgLoad}
            onError={() => setImgError(true)}
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}

// ─── PDF.js renderer (primary path — efficient with native highlighting) ─────

// ─── Text selection style for Textract overlay ───────────────────────────────

let pdfOverlayStyleInjected = false
function injectPdfOverlayStyle() {
  if (pdfOverlayStyleInjected || typeof document === "undefined") return
  pdfOverlayStyleInjected = true
  const style = document.createElement("style")
  style.textContent = `
    .rv-pdf-text-layer span::selection {
      background: rgba(59, 130, 246, 0.45);
      color: transparent;
    }
    .rv-pdf-text-layer span::-moz-selection {
      background: rgba(59, 130, 246, 0.45);
      color: transparent;
    }
  `
  document.head.appendChild(style)
}

export function PdfPageRenderer({
  pdfUrl,
  pageImageUrl,
  pageNumber = 1,
  searchQuery,
  pageKey,
  wordGeometry,
  onPdfFailed,
  onRenderComplete,
  onNextPage,
  onPrevPage,
}: PdfPageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wheelDebounceRef = useRef<number | null>(null)
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM_IDX)
  const [containerWidth, setContainerWidth] = useState(800)
  const [fitMode, setFitMode] = useState<"width" | "manual">("width")
  const [loadError, setLoadError] = useState(false)
  const [rendering, setRendering] = useState(true)
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null)
  const { panMode, setPanMode, panHandlers } = usePanMode(containerRef)

  // Inject selection style once for the Textract overlay
  useEffect(() => {
    if (wordGeometry?.length) injectPdfOverlayStyle()
  }, [wordGeometry])

  const scale = ZOOM_STEPS[zoomIdx]

  // ── All hooks must be declared before any conditional returns ─────────────

  // Measure container width for fit-width mode
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w && w > 0) setContainerWidth(w)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Reset state when page changes
  useEffect(() => {
    setFitMode("width")
    setZoomIdx(DEFAULT_ZOOM_IDX)
    setLoadError(false)
    setRendering(true)
    setCanvasSize(null)
  }, [pageKey])

  // Precompute which words match the search query (for gold highlighting)
  const matchSet = useMemo<Set<number>>(() => {
    if (!searchQuery?.trim() || !wordGeometry?.length) return new Set()
    const q = searchQuery.toLowerCase()
    const matches = new Set<number>()
    wordGeometry.forEach((w, i) => {
      if (w.text.toLowerCase().includes(q)) matches.add(i)
    })
    return matches
  }, [wordGeometry, searchQuery])

  const handleZoomIn = useCallback(() => {
    setFitMode("manual")
    setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setFitMode("manual")
    setZoomIdx((i) => Math.max(0, i - 1))
  }, [])

  const handleFitWidth = useCallback(() => {
    setFitMode("width")
    setZoomIdx(DEFAULT_ZOOM_IDX)
  }, [])

  // Memoize pdf options to prevent re-creating the object
  const pdfOptions = useMemo(() => ({
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/standard_fonts/`,
  }), [])

  function onPageRenderSuccess() {
    setRendering(false)

    requestAnimationFrame(() => {
      if (containerRef.current) {
        const canvas = containerRef.current.querySelector("canvas")
        if (canvas) {
          // Capture canvas dimensions for the Textract word geometry overlay
          setCanvasSize({ w: canvas.clientWidth, h: canvas.clientHeight })

          try {
            const ctx = canvas.getContext("2d")
            if (ctx) {
              // Detect blank canvas — JBIG2/CCITTFax pages that PDF.js can't decode
              // render as all-white. Sample 3 patches across the canvas.
              const patches = [
                { x: 0, y: 0 },
                { x: Math.max(0, Math.floor(canvas.width / 2) - 100), y: Math.max(0, Math.floor(canvas.height / 2) - 100) },
                { x: Math.max(0, canvas.width - 200), y: Math.max(0, canvas.height - 200) },
              ]
              let totalNonWhite = 0
              for (const patch of patches) {
                const w = Math.min(200, canvas.width - patch.x)
                const h = Math.min(200, canvas.height - patch.y)
                if (w <= 0 || h <= 0) continue
                const { data } = ctx.getImageData(patch.x, patch.y, w, h)
                for (let i = 0; i < data.length; i += 16) {
                  if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) totalNonWhite++
                }
              }
              if (totalNonWhite < 20) {
                onPdfFailed?.()
                setLoadError(true)
                return
              }
            }
          } catch {
            // Canvas read failed (tainted canvas) — leave as-is
          }
        }

        // Canvas has content — apply search highlights to PDF.js text layer
        // (only used when no Textract wordGeometry is available)
        if (searchQuery && !wordGeometry?.length) {
          highlightTextLayer(containerRef.current, searchQuery)
        }
      }
    })

    onRenderComplete?.()
  }

  function onPageRenderError() {
    onPdfFailed?.()
    setLoadError(true)
    setRendering(false)
  }

  function onDocLoadError() {
    onPdfFailed?.()
    setLoadError(true)
    setRendering(false)
  }

  // Wheel-to-navigate
  const handleWheelCapture = useCallback((e: React.WheelEvent) => {
    if (containerRef.current) {
      const el = containerRef.current
      if (el.scrollHeight > el.clientHeight + 2) {
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4
        const atTop = el.scrollTop <= 0
        if (e.deltaY > 0 && !atBottom) return
        if (e.deltaY < 0 && !atTop) return
      }
    }
    if (wheelDebounceRef.current) return
    wheelDebounceRef.current = window.setTimeout(() => { wheelDebounceRef.current = null }, 350)
    if (e.deltaY > 0) onNextPage?.()
    else if (e.deltaY < 0) onPrevPage?.()
  }, [onNextPage, onPrevPage])

  // ── PDF.js failed → fall back to pre-rendered image (if available) ────────
  if (loadError && pageImageUrl) {
    return (
      <ImagePageRenderer
        imageUrl={pageImageUrl}
        onNextPage={onNextPage}
        onPrevPage={onPrevPage}
      />
    )
  }

  // ── Error state — NO iframe fallback ──────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-neutral-800">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">Page rendering failed</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
          This scanned page uses a compression format (JBIG2) that cannot be displayed directly.
          Re-ingesting the document will generate page images that render correctly.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0" onWheelCapture={handleWheelCapture}>
      {/* Zoom toolbar */}
      <div className="flex items-center justify-center gap-1 px-3 py-1.5 bg-muted/30 border-b border-border shrink-0">
        <button
          onClick={handleZoomOut}
          disabled={zoomIdx <= 0 && fitMode === "manual"}
          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <span className="text-[10px] text-muted-foreground tabular-nums min-w-[44px] text-center">
          {fitMode === "width" ? "Fit" : `${Math.round(scale * 100)}%`}
        </span>
        <button
          onClick={handleZoomIn}
          disabled={zoomIdx >= ZOOM_STEPS.length - 1}
          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="w-px h-3.5 bg-border mx-1" />
        <button
          onClick={handleFitWidth}
          className={`p-1 rounded transition-colors ${fitMode === "width" ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          title="Fit to width"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-3.5 bg-border mx-1" />
        <button
          onClick={() => setPanMode((p) => !p)}
          className={`p-1 rounded transition-colors ${panMode ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
          title="Pan (click and drag to scroll)"
        >
          <Hand className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* PDF rendering area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto bg-neutral-800 flex justify-center items-start"
        style={{ cursor: panMode ? "grab" : undefined }}
        {...panHandlers}
      >
        {rendering && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Wrapper: position:relative so the Textract overlay can be absolute within it */}
        <div className="py-3" style={{ display: "inline-block" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <Document
              file={pdfUrl}
              loading={null}
              error={null}
              onLoadError={onDocLoadError}
              options={pdfOptions}
            >
              <Page
                pageNumber={pageNumber}
                width={fitMode === "width" ? containerWidth - 24 : undefined}
                scale={fitMode === "manual" ? scale : undefined}
                renderTextLayer={!wordGeometry?.length}
                renderAnnotationLayer={false}
                onRenderSuccess={onPageRenderSuccess}
                onRenderError={onPageRenderError}
                loading={null}
              />
            </Document>

            {/* Textract word geometry overlay — same technique as PageTextOverlay.
                Transparent spans positioned by normalized bounding boxes.
                Gold highlight on search matches. Native text selection. */}
            {canvasSize && wordGeometry && wordGeometry.length > 0 && (
              <div
                className="rv-pdf-text-layer"
                aria-hidden={false}
                style={{
                  position:         "absolute",
                  top:              0,
                  left:             0,
                  width:            canvasSize.w,
                  height:           canvasSize.h,
                  pointerEvents:    "none",
                  userSelect:       "text",
                  WebkitUserSelect: "text",
                }}
              >
                {wordGeometry.map((word, i) => {
                  const { left, top, width, height } = word.geometry
                  const px = left   * canvasSize.w
                  const py = top    * canvasSize.h
                  const pw = width  * canvasSize.w
                  const ph = height * canvasSize.h
                  const isMatch = matchSet.has(i)
                  return (
                    <span
                      key={i}
                      style={{
                        position:     "absolute",
                        left:         `${px}px`,
                        top:          `${py}px`,
                        width:        `${pw}px`,
                        height:       `${ph}px`,
                        fontSize:     `${ph * 0.82}px`,
                        lineHeight:   "1",
                        whiteSpace:   "nowrap",
                        overflow:     "hidden",
                        color:        "transparent",
                        background:   isMatch ? "rgba(212,160,23,0.38)" : "transparent",
                        borderRadius: isMatch ? "2px" : "0",
                        cursor:       "text",
                      }}
                    >
                      {word.text}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
