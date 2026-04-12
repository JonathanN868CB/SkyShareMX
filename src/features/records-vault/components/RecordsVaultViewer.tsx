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

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  X, ChevronLeft, ChevronRight, FileText, BookOpen,
  ChevronDown, ChevronUp, Loader2, AlertTriangle, Search, Hand, ZoomIn, Download,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRecordPageUrl } from "../hooks/useRecordPageUrl"
import { useRecordPageImageUrl } from "../hooks/useRecordPageImageUrl"
import { useRecordPageImageUrlBatch } from "../hooks/useRecordPageImageUrlBatch"
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
  pageNumber, recordSourceId, isActive, isMatch, matchIndex, isS3Ingested, prefetchedUrl, onClick,
}: {
  pageNumber:     number
  recordSourceId: string
  isActive:       boolean
  isMatch:        boolean
  matchIndex:     number | null
  isS3Ingested:   boolean
  prefetchedUrl:  string | null | undefined  // from batch query; undefined = outside window
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

  // Prefer the batch-prefetched URL when available. Only fall back to the
  // per-page hook if this thumbnail was rendered outside the prefetch window
  // AND has actually been scrolled into view — prevents a thumbnail storm.
  const needsFallback = prefetchedUrl === undefined && inView
  const { data: fallbackImageUrl } = useRecordPageImageUrl(
    needsFallback ? recordSourceId : null,
    pageNumber,
    { pollWhileMissing: isS3Ingested },
  )
  const imageUrl = prefetchedUrl ?? fallbackImageUrl ?? null

  const { data: pdfUrl } = useRecordPageUrl(
    inView && !imageUrl && !isS3Ingested ? recordSourceId : null,
    pageNumber,
  )

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
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`p.${pageNumber}`}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        ) : pdfUrl ? (
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
  // Banner: rasterization redirect (set when we land on a different page than requested)
  const [redirectBanner, setRedirectBanner] = useState<{ requested: number; shown: number } | null>(null)
  // Banner: shown briefly when cross-book navigation changes the active document
  const [docTransition, setDocTransition] = useState<{ filename: string; tailNumber: string | null } | null>(null)
  const prevSourceIdRef = useRef<string | null>(null)
  const jumpInputRef  = useRef<HTMLInputElement>(null)
  const centerRef     = useRef<HTMLDivElement>(null)
  // Print
  const [printMenuOpen,   setPrintMenuOpen]   = useState(false)
  const [printScope,      setPrintScope]      = useState<"current" | "all">("current")
  const [printHighlights, setPrintHighlights] = useState(true)
  const [isPrinting,      setIsPrinting]      = useState(false)
  const printMenuRef = useRef<HTMLDivElement>(null)

  const { allAircraft } = useRecordsVaultCtx()

  const currentHit     = hits[currentHitIdx] ?? hits[0]
  const recordSourceId = currentHit?.record_source_id ?? null
  const aircraft       = allAircraft.find((a) => a.id === currentHit?.aircraft_id)

  // Only use hits from the current document for thumbnail badges and page→hit mapping.
  // When the viewer holds cross-doc hits, page numbers collide across documents
  // (page 5 of doc A is not the same page as page 5 of doc B).
  const currentDocHits = hits.filter((h) => h.record_source_id === recordSourceId)
  const matchPages     = new Set(currentDocHits.map((h) => h.page_number))
  const pageToHitIndex = new Map(
    hits.reduce((acc, h, i) => {
      if (h.record_source_id === recordSourceId) acc.push([h.page_number, i] as [number, number])
      return acc
    }, [] as [number, number][])
  )
  const isMultiDoc = hits.some((h) => h.record_source_id !== recordSourceId)

  // Unique (doc, page) pairs across all hits — used for "all result pages" print scope
  const uniquePrintPages = useMemo(() => {
    const seen = new Set<string>()
    return hits.filter((h) => {
      const key = `${h.record_source_id}:${h.page_number}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) =>
      a.record_source_id.localeCompare(b.record_source_id) || a.page_number - b.page_number
    )
  }, [hits])

  useEffect(() => {
    if (open) {
      setCurrentPage(hits[hitIndex]?.page_number ?? 1)
      setCurrentHitIdx(hitIndex)
      setExcerptOpen(true)
      setShowJumpInput(false)
      setRedirectBanner(null)
      setDocTransition(null)
      prevSourceIdRef.current = null
    }
  }, [open, hitIndex, hits])

  // First-ready-page fallback. When the viewer opens on a page that isn't
  // rasterized yet (search hit near the end of a 300-page doc, rasterizer
  // still running), land on the first ready page at or after the requested
  // page instead of hanging on "Preparing page…". The banner lets the user
  // retry once rasterization advances.
  useEffect(() => {
    if (!open || !recordSourceId) return
    const requestedPage = hits[hitIndex]?.page_number ?? 1
    let cancelled = false

    ;(async () => {
      const { data: firstReady } = await supabase
        .from("rv_pages")
        .select("page_number")
        .eq("record_source_id", recordSourceId)
        .gte("page_number", requestedPage)
        .not("page_image_uploaded_at", "is", null)
        .order("page_number", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (!firstReady) {
        // Nothing at/after is ready — try the most recent ready page before.
        const { data: lastReadyBefore } = await supabase
          .from("rv_pages")
          .select("page_number")
          .eq("record_source_id", recordSourceId)
          .lt("page_number", requestedPage)
          .not("page_image_uploaded_at", "is", null)
          .order("page_number", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (cancelled) return
        if (lastReadyBefore && lastReadyBefore.page_number !== requestedPage) {
          setCurrentPage(lastReadyBefore.page_number)
          setRedirectBanner({ requested: requestedPage, shown: lastReadyBefore.page_number })
        }
        return
      }

      if (firstReady.page_number !== requestedPage) {
        setCurrentPage(firstReady.page_number)
        setRedirectBanner({ requested: requestedPage, shown: firstReady.page_number })
      }
    })()

    return () => { cancelled = true }
  }, [open, recordSourceId, hitIndex, hits])

  useEffect(() => {
    const idx = pageToHitIndex.get(currentPage)
    if (idx !== undefined) setCurrentHitIdx(idx)
  }, [currentPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Use a ref so navigate always reads the latest effectiveTotalPages without
  // needing it as a dependency (avoids stale closure with cross-doc navigation).
  const effectiveTotalPagesRef = useRef(totalPages || 1)

  const navigate = useCallback((delta: number) => {
    setCurrentPage((p) => Math.max(1, Math.min(effectiveTotalPagesRef.current, p + delta)))
  }, [])

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

  // Show a brief transition banner when cross-book navigation changes the active document
  useEffect(() => {
    if (!recordSourceId) return
    if (prevSourceIdRef.current && prevSourceIdRef.current !== recordSourceId) {
      const a = allAircraft.find((x) => x.id === currentHit?.aircraft_id)
      setDocTransition({
        filename:   currentHit?.original_filename ?? "Document",
        tailNumber: a?.tailNumber ?? null,
      })
      const t = setTimeout(() => setDocTransition(null), 3500)
      return () => clearTimeout(t)
    }
    prevSourceIdRef.current = recordSourceId
  }, [recordSourceId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Any document that came through the S3 ingest pipeline always requires the
  // per-page JPEG path — PDF.js cannot render the compression codecs these
  // PDFs tend to carry (JBIG2, CCITTFax). The rasterizer now mirrors the
  // original PDF to Supabase for other surfaces, but the viewer still reads
  // JPEGs for any s3_key-flagged source, whether rasterization is complete,
  // in progress, or still pending.
  const isS3Ingested = !!source?.s3_key

  const hasPrevHit = currentHitIdx > 0
  const hasNextHit = currentHitIdx < hits.length - 1
  const hasExcerpt = !!currentHit?.ocr_excerpt?.trim() && query

  function handleJumpSubmit() {
    const n = parseInt(pageJumpValue, 10)
    if (!isNaN(n) && n >= 1 && n <= effectiveTotalPages) setCurrentPage(n)
    setShowJumpInput(false)
    setPageJumpValue("")
  }

  // Close print popover when clicking outside
  useEffect(() => {
    if (!printMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setPrintMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [printMenuOpen])

  async function handlePrint() {
    if (!recordSourceId) return

    // Open the window SYNCHRONOUSLY before any await — browsers block window.open()
    // called after an async operation (popup blocker treats it as unsolicited).
    const win = window.open("", "_blank", "width=960,height=720")
    if (!win) return
    win.document.write(
      `<html><head><meta charset="utf-8"><title>Preparing…</title>` +
      `<style>body{background:#111;color:#888;font-family:sans-serif;display:flex;` +
      `align-items:center;justify-content:center;height:100vh;margin:0;font-size:14px}</style>` +
      `</head><body>Preparing pages…</body></html>`
    )

    setIsPrinting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { win.close(); return }

      const pagesToPrint = printScope === "current"
        ? [{ recordSourceId, pageNumber: currentPage }]
        : uniquePrintPages.map((h) => ({ recordSourceId: h.record_source_id, pageNumber: h.page_number }))

      const pageData = await Promise.all(
        pagesToPrint.map(async ({ recordSourceId: srcId, pageNumber }) => {
          // Fetch signed image URL
          const resp = await fetch("/.netlify/functions/records-vault-page-image-url", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ recordSourceId: srcId, pageNumber }),
          })
          const { signedUrl } = resp.ok ? await resp.json() : { signedUrl: null }

          // Fetch word geometry for highlights
          type HighlightBox = { left: number; top: number; width: number; height: number }
          let highlights: HighlightBox[] = []
          if (printHighlights && query) {
            const { data: pageRow } = await supabase
              .from("rv_pages")
              .select("word_geometry")
              .eq("record_source_id", srcId)
              .eq("page_number", pageNumber)
              .maybeSingle()
            if (pageRow?.word_geometry) {
              const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
              highlights = (pageRow.word_geometry as Array<{ text: string; geometry: HighlightBox }>)
                .filter((w) => terms.some((t) => w.text.toLowerCase().includes(t)))
                .map((w) => w.geometry)
            }
          }

          return { pageNumber, signedUrl: signedUrl as string | null, highlights }
        })
      )

      // Build print HTML
      const pagesHtml = pageData.map(({ pageNumber, signedUrl, highlights }) => {
        if (!signedUrl) {
          return `<div class="page-missing">Page ${pageNumber} — image not available</div>`
        }
        const overlayHtml = highlights.map((h) =>
          `<div class="hl" style="left:${h.left * 100}%;top:${h.top * 100}%;width:${h.width * 100}%;height:${h.height * 100}%"></div>`
        ).join("")
        return `
          <div class="page">
            <div class="wrap">
              <img src="${signedUrl}" class="img" />
              ${overlayHtml ? `<div class="overlays">${overlayHtml}</div>` : ""}
            </div>
            <div class="pnum">p.${pageNumber}</div>
          </div>`
      }).join("")

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${currentHit?.original_filename ?? "Records Vault"}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#fff;font-family:sans-serif}
  .page{page-break-after:always;padding:12px 16px}
  .page:last-child{page-break-after:auto}
  .wrap{position:relative;display:inline-block;max-width:100%}
  .img{display:block;max-width:100%;height:auto}
  .overlays{position:absolute;inset:0;pointer-events:none}
  .hl{position:absolute;background:rgba(212,160,23,0.32);border:1px solid rgba(212,160,23,0.65);border-radius:1px}
  .pnum{margin-top:4px;font-size:9px;color:#aaa;text-align:right}
  .page-missing{padding:24px;color:#999;font-size:13px}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{padding:0}
  }
</style>
</head>
<body>${pagesHtml}</body>
</html>`

      win.document.open()
      win.document.write(html)
      win.document.close()
      win.onload = () => win.print()
    } finally {
      setIsPrinting(false)
      setPrintMenuOpen(false)
    }
  }

  // Prefer source.page_count (auto-updates per document during cross-book nav)
  // over the totalPages prop, which is only set for the initially-opened document.
  const effectiveTotalPages = source?.page_count || totalPages || hits.length
  effectiveTotalPagesRef.current = effectiveTotalPages

  // Strip page list — always sparse. The previous "<=200 → render all" path
  // fired a page-image-url request per thumbnail on open, which was the root
  // cause of the 316-page viewer hang. Now we render a fixed window:
  //   - first 10 pages (logbook covers / indexes)
  //   - current page ±10
  //   - every page with a search match
  // The set stays bounded (~30-40 items) regardless of document length, and
  // React Query caches results as the user scrolls into new windows.
  const stripPages: number[] = (() => {
    const seen = new Set<number>()
    for (let p = 1; p <= Math.min(10, effectiveTotalPages); p++) seen.add(p)
    for (let p = Math.max(1, currentPage - 10); p <= Math.min(effectiveTotalPages, currentPage + 10); p++) {
      seen.add(p)
    }
    for (const h of hits) {
      if (h.page_number >= 1 && h.page_number <= effectiveTotalPages) seen.add(h.page_number)
    }
    return Array.from(seen).sort((a, b) => a - b)
  })()

  // Batch-prefetch signed URLs for every thumbnail in the current window.
  // One function invocation + one DB round trip instead of N per-thumbnail
  // requests. The batch hook polls with backoff while any entry is null so
  // thumbnails light up as rasterization progresses.
  const { data: prefetched } = useRecordPageImageUrlBatch(
    recordSourceId ?? null,
    stripPages,
  )

  if (!open) return null

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">

      {/* ── Document transition banner (cross-book navigation) ───────────────── */}
      {docTransition && (
        <div
          className="flex-none flex items-center gap-2 px-4 py-1.5 text-xs border-b border-border shrink-0"
          style={{ background: "rgba(212,160,23,0.08)" }}
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--skyshare-gold)" }} />
          <span className="text-foreground/80">
            Now viewing:{" "}
            <span className="font-medium text-foreground">{docTransition.filename}</span>
            {docTransition.tailNumber && (
              <span className="ml-2 font-mono text-muted-foreground">{docTransition.tailNumber}</span>
            )}
          </span>
          <button
            onClick={() => setDocTransition(null)}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

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
        <div className="flex items-center gap-3 shrink-0">

          {/* Print button — only when there are search results */}
          {hits.length > 0 && query && (
            <div className="relative shrink-0" ref={printMenuRef}>
              <button
                onClick={() => setPrintMenuOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded transition-colors text-xs font-medium ${
                  printMenuOpen
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
                title="Print result pages"
              >
                <Download className="h-4 w-4 shrink-0" />
                PDF
              </button>

              {printMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-56 rounded-md border border-border bg-background shadow-xl z-50 p-3 space-y-3"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}
                >
                  {/* Scope */}
                  <div className="space-y-2">
                    <p
                      className="text-[9px] font-semibold uppercase tracking-widest"
                      style={{ color: "var(--skyshare-gold)", opacity: 0.7 }}
                    >
                      Pages
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="print-scope"
                        checked={printScope === "current"}
                        onChange={() => setPrintScope("current")}
                        className="accent-amber-500"
                      />
                      <span className="text-xs text-foreground/80 group-hover:text-foreground transition-colors">
                        Current page
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="print-scope"
                        checked={printScope === "all"}
                        onChange={() => setPrintScope("all")}
                        className="accent-amber-500"
                      />
                      <span className="text-xs text-foreground/80 group-hover:text-foreground transition-colors">
                        All result pages
                        <span className="ml-1 tabular-nums text-muted-foreground">
                          ({uniquePrintPages.length})
                        </span>
                      </span>
                    </label>
                  </div>

                  {/* Highlights toggle */}
                  <div className="border-t border-border pt-2.5">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={printHighlights}
                        onChange={(e) => setPrintHighlights(e.target.checked)}
                        className="accent-amber-500"
                      />
                      <span className="text-xs text-foreground/80 group-hover:text-foreground transition-colors">
                        Include highlights
                      </span>
                    </label>
                  </div>

                  {/* Action */}
                  <button
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, rgba(212,160,23,0.18) 0%, rgba(212,160,23,0.06) 100%)",
                      border: "1px solid rgba(212,160,23,0.35)",
                      color: "rgba(255,255,255,0.9)",
                      fontFamily: "var(--font-heading)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {isPrinting
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Preparing…</>
                      : <><Download className="h-3 w-3" style={{ color: "var(--skyshare-gold)" }} /> Print to PDF</>
                    }
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-muted-foreground/80">
            <Hand className="h-7 w-7" />
            <span className="text-[11px] leading-tight">Hold middle click to pan</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/80">
            <ZoomIn className="h-7 w-7" />
            <span className="text-[11px] leading-tight">Scroll wheel to zoom</span>
          </div>
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
        {hits.length > 0 && query && (
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
            <span className="text-xs text-muted-foreground tabular-nums min-w-[80px] text-center">
              {isMultiDoc
                ? `${currentHitIdx + 1} / ${hits.length} total`
                : `${currentHitIdx + 1} / ${hits.length} matches`}
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
                isS3Ingested={isS3Ingested}
                prefetchedUrl={prefetched ? (prefetched[pageNum] ?? null) : undefined}
                onClick={() => setCurrentPage(pageNum)}
              />
            ))}
          </div>
        </div>

        {/* CENTER — page image with text overlay (or PDF.js fallback) */}
        <div ref={centerRef} className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
          {redirectBanner && (
            <div className="flex-none flex items-center justify-between gap-3 px-4 py-2 border-b border-amber-500/40 bg-amber-500/10">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px] text-amber-200/90">
                  Page {redirectBanner.requested} not ready yet — showing page {redirectBanner.shown}.
                </span>
              </div>
              <button
                onClick={() => {
                  setCurrentPage(redirectBanner.requested)
                  setRedirectBanner(null)
                }}
                className="text-[10px] font-semibold uppercase tracking-wider text-amber-200 hover:text-amber-50 px-2 py-0.5 rounded hover:bg-amber-500/20 transition-colors shrink-0"
              >
                Retry
              </button>
            </div>
          )}
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
