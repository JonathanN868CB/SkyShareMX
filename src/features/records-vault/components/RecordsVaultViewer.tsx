/**
 * RecordsVaultViewer — Phase 2 document viewer
 *
 * Layout:
 *   [LEFT: page strip] | [CENTER: single-page PDF] | [RIGHT: properties panel]
 *
 * Navigation:
 *   - Scroll the page strip OR use ←/→/↑/↓ keyboard arrows
 *   - Pages N-1, N, N+1 are preloaded via TanStack Query cache
 *   - Smooth opacity transition on every page change
 *   - Search matches are highlighted in the strip and jump-to is instant
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  X, ChevronLeft, ChevronRight, FileText, ChevronDown,
  ChevronUp, Loader2, AlertTriangle, Search,
} from "lucide-react"
import { Dialog, DialogContent } from "@/shared/ui/dialog"
import { supabase } from "@/lib/supabase"
import { useRecordPageUrl } from "../hooks/useRecordPageUrl"
import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import type { SearchHit, RecordSource, SourceCategory } from "../types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  hits: SearchHit[]    // all search hits for this document (or [syntheticHit] for browse)
  hitIndex: number     // initial hit index
  query: string        // search query for excerpt display
  totalPages: number   // total pages in the document
}

// ─── Excerpt parser (ts_headline <b> tags → <mark> elements) ─────────────────

function ExcerptHighlighted({ text }: { text: string }) {
  type Part = { content: string; highlight: boolean }
  const parts: Part[] = []
  let rest = text
  while (rest.length > 0) {
    const s = rest.indexOf("<b>")
    if (s === -1) { parts.push({ content: rest, highlight: false }); break }
    if (s > 0) parts.push({ content: rest.slice(0, s), highlight: false })
    const e = rest.indexOf("</b>", s)
    if (e === -1) { parts.push({ content: rest.slice(s + 3), highlight: true }); break }
    parts.push({ content: rest.slice(s + 3, e), highlight: true })
    rest = rest.slice(e + 4)
  }
  return (
    <span className="text-xs leading-relaxed text-foreground/80">
      {parts.map((p, i) =>
        p.highlight
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/60 text-foreground font-semibold px-0.5 rounded-sm">{p.content}</mark>
          : <span key={i}>{p.content}</span>
      )}
    </span>
  )
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLOUR: Record<SourceCategory | string, string> = {
  logbook:      "text-blue-500",
  work_package: "text-purple-500",
  inspection:   "text-amber-500",
  ad_compliance:"text-red-500",
  major_repair: "text-orange-500",
  other:        "text-muted-foreground",
}

// ─── Page strip item ──────────────────────────────────────────────────────────

function PageStripItem({
  pageNumber,
  isActive,
  isMatch,
  matchIndex,
  onClick,
}: {
  pageNumber: number
  isActive: boolean
  isMatch: boolean
  matchIndex: number | null
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [isActive])

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-sm flex items-center gap-2 transition-all duration-100 ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted/50 border border-transparent"
      }`}
    >
      <span className={`tabular-nums text-xs min-w-[28px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
        {pageNumber}
      </span>
      {isMatch && (
        <span className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 shrink-0">
          {matchIndex !== null ? `#${matchIndex + 1}` : "match"}
        </span>
      )}
    </button>
  )
}

// ─── Preload hook — keeps N-1, N, N+1 in cache ───────────────────────────────

function usePreloadAdjacentPages(
  recordSourceId: string | null,
  currentPage: number,
  totalPages: number,
) {
  const prevPage = Math.max(1, currentPage - 1)
  const nextPage = Math.min(totalPages, currentPage + 1)

  // These queries run in background — results are cached; the main viewer
  // hook picks them up instantly when the user navigates.
  useRecordPageUrl(currentPage > 1  ? recordSourceId : null, prevPage)
  useRecordPageUrl(currentPage < totalPages ? recordSourceId : null, nextPage)
}

// ─── PDF pane ─────────────────────────────────────────────────────────────────

function PdfPane({
  recordSourceId,
  pageNumber,
  filename,
  totalPages,
}: {
  recordSourceId: string
  pageNumber: number
  filename: string
  totalPages: number
}) {
  const { data: pdfUrl, isLoading, error } = useRecordPageUrl(recordSourceId, pageNumber)
  usePreloadAdjacentPages(recordSourceId, pageNumber, totalPages)

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 z-10">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Loading page {pageNumber}…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <AlertTriangle className="h-7 w-7 text-destructive mb-2" />
          <p className="text-xs text-destructive">Failed to load page. Try navigating away and back.</p>
        </div>
      )}
      {pdfUrl && (
        <iframe
          key={`${recordSourceId}-${pageNumber}`}
          src={pdfUrl}
          className="w-full h-full border-0"
          title={`${filename} — page ${pageNumber}`}
          scrolling="no"
        />
      )}
    </div>
  )
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  hit,
  source,
  tailNumber,
  panelOpen,
  onToggle,
}: {
  hit: SearchHit
  source: RecordSource | undefined | null
  tailNumber: string | undefined
  panelOpen: boolean
  onToggle: () => void
}) {
  function fmtDate(iso: string | null | undefined) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" })
  }

  return (
    <div
      className="shrink-0 flex flex-col border-l border-border overflow-hidden transition-all duration-200"
      style={{ width: panelOpen ? "260px" : "32px" }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-center py-2.5 hover:bg-muted/40 transition-colors shrink-0 border-b border-border"
        title={panelOpen ? "Collapse" : "File Properties"}
      >
        {panelOpen
          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>

      {panelOpen && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0">
          <div>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">File</p>
            <p className="text-xs font-medium text-foreground break-all leading-snug">{hit.original_filename}</p>
          </div>
          <div>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Aircraft</p>
            <p className="text-xs text-foreground">{tailNumber ?? hit.observed_registration ?? "—"}</p>
            {hit.observed_registration && tailNumber && hit.observed_registration !== tailNumber && (
              <p className="text-[9px] text-muted-foreground mt-0.5">On doc: {hit.observed_registration}</p>
            )}
          </div>
          <div>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Category</p>
            <p className={`text-xs font-medium ${CAT_COLOUR[hit.source_category] ?? ""}`}>
              {SOURCE_CATEGORY_LABELS[hit.source_category]}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Date Range</p>
            <p className="text-xs text-foreground">
              {hit.date_range_start || hit.date_range_end
                ? `${fmtDate(hit.date_range_start)} – ${fmtDate(hit.date_range_end)}`
                : "—"}
            </p>
          </div>
          {source?.page_count != null && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Pages</p>
              <p className="text-xs text-foreground">{source.page_count} indexed</p>
            </div>
          )}
          {source?.ocr_quality_score != null && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">OCR Quality</p>
              <p className="text-xs text-foreground">{Math.round(source.ocr_quality_score * 100)}%</p>
            </div>
          )}
          {source?.events_extracted != null && source.events_extracted > 0 && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Events Extracted</p>
              <p className="text-xs text-foreground">{source.events_extracted} maintenance events</p>
            </div>
          )}
          {source?.notes && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
              <p className="text-xs text-foreground leading-snug">{source.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Viewer ──────────────────────────────────────────────────────────────

export function RecordsVaultViewer({ open, onClose, hits, hitIndex, query, totalPages }: Props) {
  const [currentPage, setCurrentPage] = useState(hits[hitIndex]?.page_number ?? 1)
  const [currentHitIdx, setCurrentHitIdx] = useState(hitIndex)
  const [excerptOpen, setExcerptOpen] = useState(true)
  const [propsPanelOpen, setPropsPanelOpen] = useState(true)
  const [pageJumpValue, setPageJumpValue] = useState("")
  const [showJumpInput, setShowJumpInput] = useState(false)
  const jumpInputRef = useRef<HTMLInputElement>(null)

  const { allAircraft } = useRecordsVaultCtx()

  const currentHit = hits[currentHitIdx] ?? hits[0]
  const recordSourceId = currentHit?.record_source_id ?? null
  const aircraft = allAircraft.find((a) => a.id === currentHit?.aircraft_id)

  // Build a Set of match page numbers for the strip
  const matchPages = new Set(hits.map((h) => h.page_number))
  // Map page_number → hit index (for #N label in strip)
  const pageToHitIndex = new Map(hits.map((h, i) => [h.page_number, i]))

  // Reset state when viewer opens
  useEffect(() => {
    if (open) {
      const startPage = hits[hitIndex]?.page_number ?? 1
      setCurrentPage(startPage)
      setCurrentHitIdx(hitIndex)
      setExcerptOpen(true)
      setShowJumpInput(false)
    }
  }, [open, hitIndex, hits])

  // When current page is a hit page, keep currentHitIdx in sync
  useEffect(() => {
    const hitIdxForPage = pageToHitIndex.get(currentPage)
    if (hitIdxForPage !== undefined) {
      setCurrentHitIdx(hitIdxForPage)
    }
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  const navigate = useCallback((delta: number) => {
    setCurrentPage((p) => Math.max(1, Math.min(totalPages, p + delta)))
  }, [totalPages])

  const jumpToHit = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(hits.length - 1, idx))
    setCurrentHitIdx(clamped)
    setCurrentPage(hits[clamped]?.page_number ?? currentPage)
  }, [hits, currentPage])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (showJumpInput) return
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); navigate(1) }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); navigate(-1) }
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, navigate, onClose, showJumpInput])

  // Fetch source metadata for properties panel
  const { data: source } = useQuery({
    queryKey: ["rv-source-detail", recordSourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_record_sources")
        .select("id, page_count, ocr_quality_score, notes, events_extracted, extraction_status")
        .eq("id", recordSourceId!)
        .single()
      if (error) throw error
      return data as RecordSource
    },
    enabled: open && !!recordSourceId,
    staleTime: 5 * 60 * 1000,
  })

  const hasPrevHit  = currentHitIdx > 0
  const hasNextHit  = currentHitIdx < hits.length - 1
  const hasExcerpt  = !!currentHit?.ocr_excerpt?.trim() && query

  // Page jump submit
  function handleJumpSubmit() {
    const n = parseInt(pageJumpValue, 10)
    if (!isNaN(n) && n >= 1 && n <= totalPages) setCurrentPage(n)
    setShowJumpInput(false)
    setPageJumpValue("")
  }

  // Scroll handler for page strip — scroll in strip triggers page loads
  // (strip is scrollable independently; clicking a row is the primary nav)

  const effectiveTotalPages = totalPages || source?.page_count || hits.length

  // Build page list for strip: only pages with hits + a sliding window around current page
  // For large documents this keeps the strip fast
  const stripPages: number[] = []
  const WINDOW = 5
  const seenPages = new Set<number>()

  // Always include match pages
  for (const h of hits) seenPages.add(h.page_number)
  // Include window around current page
  for (let p = Math.max(1, currentPage - WINDOW); p <= Math.min(effectiveTotalPages, currentPage + WINDOW); p++) {
    seenPages.add(p)
  }
  // Sort and deduplicate
  const sortedPages = Array.from(seenPages).sort((a, b) => a - b)

  // Fill in gaps to make it a full sequential list if small doc
  if (effectiveTotalPages <= 200) {
    for (let p = 1; p <= effectiveTotalPages; p++) stripPages.push(p)
  } else {
    stripPages.push(...sortedPages)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-none w-screen h-screen p-0 gap-0 rounded-none flex flex-col">

        {/* ── Top bar ────────────────────────────────────────────────────────── */}
        <div className="flex-none flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />

          {/* Doc title */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">
              {currentHit?.original_filename ?? "Record"}
            </p>
            {aircraft && (
              <p className="text-[10px] font-mono text-muted-foreground leading-none mt-0.5">
                {aircraft.tailNumber}
              </p>
            )}
          </div>

          {/* Page indicator + jump */}
          <div className="flex items-center gap-1.5 shrink-0">
            {showJumpInput ? (
              <input
                ref={jumpInputRef}
                type="number"
                min={1}
                max={effectiveTotalPages}
                value={pageJumpValue}
                onChange={(e) => setPageJumpValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleJumpSubmit()
                  if (e.key === "Escape") { setShowJumpInput(false); setPageJumpValue("") }
                }}
                onBlur={handleJumpSubmit}
                autoFocus
                className="w-16 text-xs text-center rounded border border-border bg-muted px-1 py-0.5 outline-none focus:border-primary"
              />
            ) : (
              <button
                onClick={() => { setShowJumpInput(true); setPageJumpValue(String(currentPage)) }}
                className="text-xs text-muted-foreground hover:text-foreground tabular-nums px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                title="Jump to page"
              >
                p.{currentPage}{effectiveTotalPages > 0 ? ` / ${effectiveTotalPages}` : ""}
              </button>
            )}
          </div>

          {/* Match navigation (search mode only) */}
          {hits.length > 1 && query && (
            <div className="flex items-center gap-1 shrink-0 border-l border-border pl-3">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={() => jumpToHit(currentHitIdx - 1)}
                disabled={!hasPrevHit}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                title="Previous match"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground tabular-nums min-w-[70px] text-center">
                {currentHitIdx + 1} / {hits.length} matches
              </span>
              <button
                onClick={() => jumpToHit(currentHitIdx + 1)}
                disabled={!hasNextHit}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                title="Next match"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Prev/Next page */}
          <div className="flex items-center gap-1 shrink-0 border-l border-border pl-3">
            <button
              onClick={() => navigate(-1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
              title="Previous page (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate(1)}
              disabled={currentPage >= effectiveTotalPages}
              className="p-1.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
              title="Next page (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 border-l border-border ml-1 pl-3"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* LEFT — page strip */}
          <div className="w-[72px] shrink-0 flex flex-col border-r border-border bg-muted/5 overflow-y-auto">
            <div className="px-1 pt-1 space-y-0.5">
              {stripPages.map((pageNum) => (
                <PageStripItem
                  key={pageNum}
                  pageNumber={pageNum}
                  isActive={pageNum === currentPage}
                  isMatch={matchPages.has(pageNum)}
                  matchIndex={matchPages.has(pageNum) ? (pageToHitIndex.get(pageNum) ?? null) : null}
                  onClick={() => setCurrentPage(pageNum)}
                />
              ))}
            </div>
          </div>

          {/* CENTER — PDF */}
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">

            {/* PDF iframe area */}
            <div className="flex-1 min-h-0 bg-muted/20">
              {recordSourceId && (
                <PdfPane
                  recordSourceId={recordSourceId}
                  pageNumber={currentPage}
                  filename={currentHit?.original_filename ?? ""}
                  totalPages={effectiveTotalPages}
                />
              )}
            </div>

            {/* OCR excerpt — only in search mode */}
            {hasExcerpt && (
              <div className="flex-none border-t border-border bg-muted/10 shrink-0">
                <button
                  onClick={() => setExcerptOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Match Context
                  </span>
                  {excerptOpen
                    ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    : <ChevronUp className="h-3 w-3 text-muted-foreground" />
                  }
                </button>
                {excerptOpen && (
                  <div className="px-4 pb-3">
                    <ExcerptHighlighted text={currentHit.ocr_excerpt} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — properties panel */}
          <PropertiesPanel
            hit={currentHit}
            source={source}
            tailNumber={aircraft?.tailNumber}
            panelOpen={propsPanelOpen}
            onToggle={() => setPropsPanelOpen((v) => !v)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
