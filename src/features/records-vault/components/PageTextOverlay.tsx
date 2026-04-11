/**
 * PageTextOverlay — Blue Tail style page viewer
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
// Keeps the drag-select highlight consistent with the Blue Tail blue.

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

export function PageTextOverlay({ imageUrl, wordGeometry, checkboxes, searchQuery, pageNumber }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const imgRef        = useRef<HTMLImageElement>(null)

  const [imageLoaded,   setImageLoaded]   = useState(false)
  const [imageError,    setImageError]    = useState(false)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => { injectSelectionStyle() }, [])

  // Reset state when imageUrl or page changes
  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
    setContainerSize(null)
  }, [imageUrl, pageNumber])

  // Track container size — word span pixel positions depend on the rendered
  // image dimensions, which change whenever the panel is resized.
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
    return () => ro.disconnect()
  }, [updateSize])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
    updateSize()
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
            className="block max-w-full h-auto shadow-xl select-none"
            style={{ display: imageLoaded ? "block" : "none" }}
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
                pointerEvents:  "none",   // scroll/click pass through to image
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
                      // pointer-events: none inherited from parent (cannot override
                      // in a pointer-events: none subtree via CSS alone); text
                      // selection works via keyboard and browser find-in-page
                      cursor: "text",
                    }}
                  >
                    {word.text}
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
