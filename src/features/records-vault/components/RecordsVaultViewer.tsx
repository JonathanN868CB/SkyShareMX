/**
 * RecordsVaultViewer — Phase B document viewer
 *
 * Layout:
 *   [LEFT 15%: page strip] | [CENTER 85%: scanned page + text overlay]
 *
 * The center panel shows the scanned page image. When a Textract-indexed
 * document is open, a transparent word-level text layer is projected over the
 * image using bounding-box geometry. Search matches are highlighted in gold
 * directly on the scan.
 *
 * For documents without a stored page image, the center falls back to
 * PdfPageRenderer (PDF.js) which renders directly from the stored PDF.
 *
 * Navigation:
 *   - Scroll the page strip OR use ←/→/↑/↓ keyboard arrows
 *   - Pages N-1, N, N+1 are preloaded via TanStack Query cache
 *   - Search match navigation (prev / next match buttons in topbar)
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  X, ChevronLeft, ChevronRight, FileText,
  ChevronDown, ChevronUp, Loader2, AlertTriangle, Search,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRecordPageUrl } from "../hooks/useRecordPageUrl"
import { useRecordPageImageUrl } from "../hooks/useRecordPageImageUrl"
import { usePageGeometry } from "../hooks/usePageGeometry"
import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import { PdfPageRenderer } from "./PdfPageRenderer"
import { PageTextOverlay } from "./PageTextOverlay"
import type { SearchHit, RecordSource, SourceCategory } from "../types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  hits: SearchHit[]    // all search hits for this document (or [syntheticHit] for browse)
  hitIndex: number     // initial hit index
  query: string        // search query for excerpt display + word highlighting
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
  logbook:       "text-blue-500",
  work_package:  "text-purple-500",
  inspection:    "text-amber-500",
  ad_compliance: "text-red-500",
  major_repair:  "text-orange-500",
  other:         "text-muted-foreground",
}

// ─── Thumbnail strip item ─────────────────────────────────────────────────────

function ThumbnailItem({
  pageNumber, recordSourceId, isActive, isMatch, matchIndex, onClick,
}: {
  pageNumber:     number
  recordSourceId: string
  isActive:       boolean
  isMatch:        boolean
  matchIndex:     number | null
  onClick:        () => void
}) {
  const ref     = useRef<HTMLButtonElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }, [isActive])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { rootMargin: "150px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { data: pdfUrl } = useRecordPageUrl(inView ? recordSourceId : null, pageNumber)

  const IFRAME_SIZE = 840
  const THUMB_WIDTH = 152
  const scale       = THUMB_WIDTH / IFRAME_SIZE
  const thumbHeight = Math.round(IFRAME_SIZE * scale)

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={`w-full p-1 rounded transition-all duration-100 ${
        isActive ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-muted/40"
      }`}
    >
      <div
        className="relative w-full overflow-hidden rounded bg-muted/20"
        style={{ height: `${thumbHeight}px` }}
      >
        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit`}
            className="absolute top-0 left-0 border-0 pointer-events-none"
            style={{
              width:           `${IFRAME_SIZE}px`,
              height:          `${IFRAME_SIZE}px`,
              transform:       `scale(${scale})`,
              transformOrigin: "0 0",
            }}
            title={`p.${pageNumber}`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold tabular-nums" style={{ color: "rgba(255,255,255,0.08)" }}>
              {pageNumber}
            </span>
          </div>
        )}

        {isMatch && (
          <div
            className="absolute top-1 right-1 text-[8px] font-bold uppercase tracking-wide px-1 py-0.5 rounded z-10"
            style={{ background: "var(--skyshare-gold)", color: "#000" }}
          >
            {matchIndex !== null ? `#${matchIndex + 1}` : "✓"}
          </div>
        )}
      </div>

      <p className={`text-center tabular-nums mt-0.5 text-[10px] ${isActive ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
        {pageNumber}
      </p>
    </button>
  )
}

// ─── Center panel — image overlay OR PDF.js fallback ─────────────────────────

function CenterPanel({
  recordSourceId, pageNumber, searchQuery, isS3Ingested, onNextPage, onPrevPage,
}: {
  recordSourceId: string
  pageNumber:     number
  searchQuery:    string
  isS3Ingested:   boolean
  onNextPage:     () => void
  onPrevPage:     () => void
}) {
  const { data: pageImageUrl, isLoading: imageUrlLoading } = useRecordPageImageUrl(
    recordSourceId,
    pageNumber,
    // S3-ingested docs rely on the background rasterizer — poll until it lands
    // so the viewer flips from "Processing" to the rendered page automatically.
    { pollWhileMissing: isS3Ingested },
  )
  const { data: geometry,    isLoading: geoLoading }       = usePageGeometry(recordSourceId, pageNumber)

  // S3-ingested docs never fall back to PDF.js — PDF.js cannot decode the
  // codecs that server-side rasterization exists to work around (JBIG2,
  // CCITTFax). Show a processing state instead until the image lands.
  const needsPdf = !pageImageUrl && !imageUrlLoading && !isS3Ingested
  const { data: pdfUrl, isLoading: pdfLoading, error: pdfError } = useRecordPageUrl(
    needsPdf ? recordSourceId : null,
  )

  const isLoading = imageUrlLoading || geoLoading || (needsPdf && pdfLoading)
  const showProcessing =
    isS3Ingested && !pageImageUrl && !imageUrlLoading

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 z-10 pointer-events-none">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Loading page {pageNumber}…</p>
        </div>
      )}

      {/* Path A — stored page image: Textract documents with word-level overlay */}
      {pageImageUrl && (
        <PageTextOverlay
          imageUrl={pageImageUrl}
          wordGeometry={geometry?.word_geometry ?? null}
          checkboxes={geometry?.checkboxes_extracted ?? null}
          searchQuery={searchQuery || undefined}
          pageNumber={pageNumber}
        />
      )}

      {/* Path B — S3-ingested doc, rasterization still running. Polling the
          image URL every 5s will flip us into Path A as soon as the page
          image lands in Supabase Storage. */}
      {showProcessing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--skyshare-gold)" }} />
          <p className="text-xs font-semibold uppercase tracking-widest text-foreground/80">
            Preparing page {pageNumber}
          </p>
          <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
            This document is being rendered on the server. Pages will appear automatically as they become available — usually within a minute of upload.
          </p>
        </div>
      )}

      {/* Path C — legacy Supabase-uploaded docs (client-side rasterized):
          fall back to PDF.js, which renders cleanly because the upload
          modal pre-normalized the PDF. */}
      {!pageImageUrl && !imageUrlLoading && !isS3Ingested && (
        <>
          {pdfError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <AlertTriangle className="h-7 w-7 text-destructive mb-2" />
              <p className="text-xs text-destructive">Failed to load document.</p>
            </div>
          )}
          {pdfUrl && (
            <PdfPageRenderer
              pdfUrl={pdfUrl}
              pageImageUrl={undefined}
              pageNumber={pageNumber}
              pageKey={`${recordSourceId}-${pageNumber}`}
              searchQuery={searchQuery || undefined}
              wordGeometry={geometry?.word_geometry ?? null}
              onNextPage={onNextPage}
              onPrevPage={onPrevPage}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─── Event type labels + colors ──────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  logbook_entry:     "Logbook Entry",
  inspection:        "Inspection",
  ad_compliance:     "AD Compliance",
  sb_compliance:     "SB Compliance",
  component_install: "Component Install",
  component_removal: "Component Removal",
  repair:            "Repair",
  alteration:        "Alteration",
  overhaul:          "Overhaul",
  return_to_service: "Return to Service",
  discrepancy:       "Discrepancy",
  other:             "Other",
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  inspection:        "text-amber-500",
  ad_compliance:     "text-red-500",
  sb_compliance:     "text-red-400",
  component_install: "text-green-500",
  component_removal: "text-orange-500",
  repair:            "text-blue-500",
  discrepancy:       "text-destructive",
}

// ─── Page events hook ─────────────────────────────────────────────────────────

function usePageEvents(recordSourceId: string | null, currentPageId: string | null) {
  return useQuery({
    queryKey: ["rv-page-events", recordSourceId, currentPageId],
    queryFn: async () => {
      if (!recordSourceId) return []
      const { data, error } = await supabase
        .from("rv_maintenance_events")
        .select("id, event_type, event_date, description, part_numbers, serial_numbers, work_order_number, confidence, page_ids")
        .eq("record_source_id", recordSourceId)
        .order("event_date", { ascending: true, nullsFirst: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as Array<{
        id:                string
        event_type:        string
        event_date:        string | null
        description:       string
        part_numbers:      string[]
        serial_numbers:    string[]
        work_order_number: string | null
        confidence:        number | null
        page_ids:          string[]
      }>
    },
    enabled: !!recordSourceId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  hit, source, tailNumber, panelOpen, onToggle, currentPageId,
}: {
  hit:           SearchHit
  source:        RecordSource | undefined | null
  tailNumber:    string | undefined
  panelOpen:     boolean
  onToggle:      () => void
  currentPageId: string | null
}) {
  const { data: allEvents = [] } = usePageEvents(hit?.record_source_id, currentPageId)
  const pageEvents    = currentPageId ? allEvents.filter((e) => e.page_ids.includes(currentPageId)) : []
  const hasPageEvents = pageEvents.length > 0

  function fmtDate(iso: string | null | undefined) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" })
  }
  function fmtEventDate(iso: string | null) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div
      className="shrink-0 flex flex-col border-l border-border overflow-hidden transition-all duration-200"
      style={{ width: panelOpen ? "280px" : "32px" }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-center py-2.5 hover:bg-muted/40 transition-colors shrink-0 border-b border-border"
        title={panelOpen ? "Collapse" : "File Properties"}
      >
        {panelOpen
          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronLeft  className="h-3.5 w-3.5 text-muted-foreground" />
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
              <div className="flex items-center gap-2">
                <p className="text-xs text-foreground">{Math.round(source.ocr_quality_score * 100)}%</p>
                {source.ocr_quality_score < 0.5 && (
                  <span className="text-[9px] text-amber-500">Low — review source page</span>
                )}
              </div>
            </div>
          )}
          {source?.notes && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
              <p className="text-xs text-foreground leading-snug">{source.notes}</p>
            </div>
          )}

          {(hasPageEvents || allEvents.length > 0) && (
            <div className="border-t border-border pt-3">
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--skyshare-gold)" }}>
                {hasPageEvents ? "Events on This Page" : "Events in Document"}
              </p>
              <div className="space-y-2.5">
                {(hasPageEvents ? pageEvents : allEvents.slice(0, 8)).map((event) => (
                  <div key={event.id} className="rounded bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[9px] font-semibold uppercase tracking-wide ${EVENT_TYPE_COLORS[event.event_type] ?? "text-muted-foreground"}`}>
                        {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                      </span>
                      {event.confidence != null && event.confidence < 0.7 && (
                        <span className="text-[8px] text-amber-500" title={`${Math.round(event.confidence * 100)}% confidence`}>~</span>
                      )}
                    </div>
                    {event.event_date && (
                      <p className="text-[10px] text-muted-foreground mb-0.5">{fmtEventDate(event.event_date)}</p>
                    )}
                    <p className="text-[11px] text-foreground/80 leading-snug line-clamp-3">{event.description}</p>
                    {event.work_order_number && (
                      <p className="text-[10px] text-muted-foreground mt-1">W/O: {event.work_order_number}</p>
                    )}
                    {event.part_numbers.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">P/N: {event.part_numbers.join(", ")}</p>
                    )}
                  </div>
                ))}
              </div>
              {!hasPageEvents && allEvents.length > 8 && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  +{allEvents.length - 8} more events in this document
                </p>
              )}
            </div>
          )}

          {source?.events_extracted != null && source.events_extracted > 0 && allEvents.length === 0 && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Events Extracted</p>
              <p className="text-xs text-foreground">{source.events_extracted} maintenance events</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Viewer ──────────────────────────────────────────────────────────────

export function RecordsVaultViewer({ open, onClose, hits, hitIndex, query, totalPages }: Props) {
  const [currentPage,    setCurrentPage]    = useState(hits[hitIndex]?.page_number ?? 1)
  const [currentHitIdx,  setCurrentHitIdx]  = useState(hitIndex)
  const [excerptOpen,    setExcerptOpen]    = useState(true)
  const [propsPanelOpen, setPropsPanelOpen] = useState(false)
  const [pageJumpValue,  setPageJumpValue]  = useState("")
  const [showJumpInput,  setShowJumpInput]  = useState(false)
  const jumpInputRef  = useRef<HTMLInputElement>(null)
  const centerRef     = useRef<HTMLDivElement>(null)
  const wheelDebounce = useRef<number | null>(null)

  const { allAircraft } = useRecordsVaultCtx()

  const currentHit     = hits[currentHitIdx] ?? hits[0]
  const recordSourceId = currentHit?.record_source_id ?? null
  const aircraft       = allAircraft.find((a) => a.id === currentHit?.aircraft_id)

  const matchPages     = new Set(hits.map((h) => h.page_number))
  const pageToHitIndex = new Map(hits.map((h, i) => [h.page_number, i]))

  useEffect(() => {
    if (open) {
      setCurrentPage(hits[hitIndex]?.page_number ?? 1)
      setCurrentHitIdx(hitIndex)
      setExcerptOpen(true)
      setShowJumpInput(false)
    }
  }, [open, hitIndex, hits])

  useEffect(() => {
    const idx = pageToHitIndex.get(currentPage)
    if (idx !== undefined) setCurrentHitIdx(idx)
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); navigate(1)  }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); navigate(-1) }
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, navigate, onClose, showJumpInput])

  useEffect(() => {
    if (!open) return
    const handleWheel = (e: WheelEvent) => {
      const el = centerRef.current
      if (!el) return
      const { left, right, top, bottom } = el.getBoundingClientRect()
      if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) return
      e.preventDefault()
      if (wheelDebounce.current) return
      wheelDebounce.current = window.setTimeout(() => { wheelDebounce.current = null }, 350)
      if (e.deltaY > 0) navigate(1)
      else navigate(-1)
    }
    window.addEventListener("wheel", handleWheel, { passive: false })
    return () => window.removeEventListener("wheel", handleWheel)
  }, [open, navigate])

  const { data: source } = useQuery({
    queryKey: ["rv-source-detail", recordSourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_record_sources")
        .select("id, page_count, ocr_quality_score, notes, events_extracted, extraction_status, s3_key, storage_path")
        .eq("id", recordSourceId!)
        .single()
      if (error) throw error
      return data as RecordSource & { s3_key: string | null; storage_path: string | null }
    },
    enabled: open && !!recordSourceId,
    staleTime: 5 * 60 * 1000,
  })

  // S3-ingested docs skip the PDF.js fallback entirely — PDF.js cannot render
  // the compression codecs that the server-side rasterizer exists to work
  // around (JBIG2, CCITTFax). Detected by presence of s3_key with no
  // storage_path, which is the canonical shape for Textract pipeline docs.
  const isS3Ingested = !!source?.s3_key && !source?.storage_path

  const hasPrevHit = currentHitIdx > 0
  const hasNextHit = currentHitIdx < hits.length - 1
  const hasExcerpt = !!currentHit?.ocr_excerpt?.trim() && query

  function handleJumpSubmit() {
    const n = parseInt(pageJumpValue, 10)
    if (!isNaN(n) && n >= 1 && n <= effectiveTotalPages) setCurrentPage(n)
    setShowJumpInput(false)
    setPageJumpValue("")
  }

  const effectiveTotalPages = totalPages || source?.page_count || hits.length

  // Strip page list: all match pages + sliding window around current page
  const seenPages = new Set<number>()
  for (const h of hits) seenPages.add(h.page_number)
  for (let p = Math.max(1, currentPage - 5); p <= Math.min(effectiveTotalPages, currentPage + 5); p++) {
    seenPages.add(p)
  }
  const stripPages: number[] = effectiveTotalPages <= 200
    ? Array.from({ length: effectiveTotalPages }, (_, i) => i + 1)
    : Array.from(seenPages).sort((a, b) => a - b)

  if (!open) return null

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-none flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />

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

        {/* Match navigation */}
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

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* LEFT — thumbnail strip */}
        <div className="w-[176px] shrink-0 flex flex-col border-r border-border bg-muted/5 overflow-y-auto">
          <div className="p-1.5 space-y-1">
            {stripPages.map((pageNum) => (
              <ThumbnailItem
                key={pageNum}
                pageNumber={pageNum}
                recordSourceId={recordSourceId ?? ""}
                isActive={pageNum === currentPage}
                isMatch={matchPages.has(pageNum)}
                matchIndex={matchPages.has(pageNum) ? (pageToHitIndex.get(pageNum) ?? null) : null}
                onClick={() => setCurrentPage(pageNum)}
              />
            ))}
          </div>
        </div>

        {/* CENTER — page image with text overlay (or PDF.js fallback) */}
        <div ref={centerRef} className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 bg-muted/20">
            {recordSourceId && (
              <CenterPanel
                recordSourceId={recordSourceId}
                pageNumber={currentPage}
                searchQuery={query}
                isS3Ingested={isS3Ingested}
                onNextPage={() => navigate(1)}
                onPrevPage={() => navigate(-1)}
              />
            )}
          </div>

          {/* Match context excerpt — search mode only */}
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
                  : <ChevronUp   className="h-3 w-3 text-muted-foreground" />
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

        {/* RIGHT — properties + intelligence panel */}
        <PropertiesPanel
          hit={currentHit}
          source={source}
          tailNumber={aircraft?.tailNumber}
          panelOpen={propsPanelOpen}
          onToggle={() => setPropsPanelOpen((v) => !v)}
          currentPageId={matchPages.has(currentPage) ? currentHit?.page_id ?? null : null}
        />
      </div>
    </div>
  )
}
