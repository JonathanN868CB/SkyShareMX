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
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  X, ChevronLeft, ChevronRight, FileText, ChevronDown,
  ChevronUp, Loader2, AlertTriangle, Search, Download, AlertCircle, Trash2,
} from "lucide-react"
import { Dialog, DialogContent } from "@/shared/ui/dialog"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { useRecordPageUrl } from "../hooks/useRecordPageUrl"
import { usePageImage } from "../hooks/usePageImage"
import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import type { SearchHit, RecordSource, SourceCategory } from "../types"

const MANAGER_ROLES = ["Manager", "Director of Maintenance", "DPE", "Admin", "Super Admin"]

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

// ─── Page confidence map hook ─────────────────────────────────────────────────
// Fetches ocr_confidence for all pages in a document in a single query.
// Used to show low-confidence warnings in the page strip.

const OCR_CONFIDENCE_WARN = 0.7

function usePageConfidenceMap(recordSourceId: string | null) {
  return useQuery({
    queryKey: ["rv-page-confidence", recordSourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_pages")
        .select("page_number, ocr_confidence, page_image_path")
        .eq("record_source_id", recordSourceId!)
        .order("page_number", { ascending: true })
      if (error) throw error
      const map = new Map<number, { confidence: number | null; imagePath: string | null }>()
      for (const row of data ?? []) {
        map.set(row.page_number, {
          confidence: row.ocr_confidence,
          imagePath:  row.page_image_path,
        })
      }
      return map
    },
    enabled: !!recordSourceId,
    staleTime: 10 * 60 * 1000,
  })
}

// ─── Page strip item ──────────────────────────────────────────────────────────

function PageThumbnail({
  recordSourceId,
  pageNumber,
  imagePath,
}: {
  recordSourceId: string
  pageNumber: number
  imagePath: string | null
}) {
  // Try DB-stored image path first; fall back to Netlify signed URL
  const { data: signedUrl } = usePageImage(
    imagePath ? recordSourceId : null,
    pageNumber,
  )

  if (!signedUrl) return null

  return (
    <img
      src={signedUrl}
      alt={`Page ${pageNumber}`}
      className="w-full rounded-sm object-cover border border-border/40"
      style={{ aspectRatio: "8.5 / 11", minHeight: "60px" }}
      loading="lazy"
    />
  )
}

function PageStripItem({
  recordSourceId,
  pageNumber,
  isActive,
  isMatch,
  matchIndex,
  lowConfidence,
  imagePath,
  onClick,
}: {
  recordSourceId: string
  pageNumber: number
  isActive: boolean
  isMatch: boolean
  matchIndex: number | null
  lowConfidence: boolean
  imagePath: string | null
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
      className={`w-full text-left px-1.5 py-1.5 rounded-sm flex flex-col gap-1 transition-all duration-100 ${
        isActive
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted/50 border border-transparent"
      }`}
    >
      {/* Thumbnail image if available */}
      {imagePath && (
        <PageThumbnail
          recordSourceId={recordSourceId}
          pageNumber={pageNumber}
          imagePath={imagePath}
        />
      )}

      {/* Page number row */}
      <div className="flex items-center gap-1 px-0.5">
        <span className={`tabular-nums text-xs min-w-[24px] ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {pageNumber}
        </span>
        {isMatch && (
          <span className="text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 shrink-0">
            {matchIndex !== null ? `#${matchIndex + 1}` : "match"}
          </span>
        )}
        {lowConfidence && (
          <AlertCircle
            className="h-3 w-3 text-amber-500 shrink-0 ml-auto"
            title="Low OCR confidence — text may be inaccurate"
          />
        )}
      </div>
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
  onNavigate,
}: {
  recordSourceId: string
  pageNumber: number
  filename: string
  totalPages: number
  onNavigate: (delta: number) => void
}) {
  const { data: pdfUrl, isLoading, error } = useRecordPageUrl(recordSourceId, pageNumber)
  usePreloadAdjacentPages(recordSourceId, pageNumber, totalPages)

  // Throttle wheel navigation so rapid scrolls don't skip multiple pages
  const lastWheelTime = useRef(0)
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const now = Date.now()
    if (now - lastWheelTime.current < 120) return // 120ms throttle ≈ max 8 pages/sec
    lastWheelTime.current = now
    onNavigate(e.deltaY > 0 ? 1 : -1)
  }

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
        <>
          <iframe
            key={`${recordSourceId}-${pageNumber}`}
            // #toolbar=0&navpanes=0 hides the browser's native PDF UI (download btn, zoom, X)
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full border-0"
            title={`${filename} — page ${pageNumber}`}
            scrolling="no"
          />
          {/*
            Transparent overlay captures scroll wheel events for page navigation.
            Iframes swallow all scroll events and never propagate them up.
            Scanned PDFs have no selectable text, so blocking pointer-events is fine.
          */}
          <div
            className="absolute inset-0"
            onWheel={handleWheel}
            style={{ cursor: "default", background: "transparent" }}
          />
        </>
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
  onDelete,
  isManager,
}: {
  hit: SearchHit
  source: RecordSource | undefined | null
  tailNumber: string | undefined
  panelOpen: boolean
  onToggle: () => void
  onDelete?: () => void
  isManager?: boolean
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
          {source?.chunks_generated != null && source.chunks_generated > 0 && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Vector Chunks</p>
              <p className="text-xs text-foreground">{source.chunks_generated} indexed</p>
            </div>
          )}
          {source?.notes && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
              <p className="text-xs text-foreground leading-snug">{source.notes}</p>
            </div>
          )}

          {isManager && onDelete && (
            <div className="pt-2 mt-2 border-t border-border">
              <button
                onClick={onDelete}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Delete document
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  filename,
  pageCount,
  onCancel,
  onConfirm,
  isDeleting,
}: {
  open: boolean
  filename: string
  pageCount: number | null | undefined
  onCancel: () => void
  onConfirm: () => void
  isDeleting: boolean
}) {
  const [step, setStep] = useState<1 | 2>(1)

  useEffect(() => {
    if (open) setStep(1)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-background border border-border rounded-lg shadow-xl w-[400px] p-6 space-y-4">
        {step === 1 ? (
          <>
            <p className="text-sm font-semibold text-foreground">Delete this document?</p>
            <p className="text-xs text-muted-foreground font-medium break-all">{filename}</p>
            <p className="text-xs text-muted-foreground">This will permanently remove:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>{pageCount ?? "all"} indexed pages</li>
              <li>All extracted maintenance events</li>
              <li>All vector search chunks</li>
              <li>Original PDF and cached files from storage</li>
            </ul>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={() => setStep(2)} className="px-3 py-1.5 text-xs rounded bg-muted hover:bg-muted/80 text-foreground transition-colors">
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-destructive">This cannot be undone</p>
            <p className="text-xs text-muted-foreground">
              All pages, events, and storage files for <span className="font-medium text-foreground break-all">{filename}</span> will be permanently deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onCancel} disabled={isDeleting} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
                Permanently Delete
              </button>
            </div>
          </>
        )}
      </div>
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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const jumpInputRef = useRef<HTMLInputElement>(null)

  const { allAircraft } = useRecordsVaultCtx()
  const queryClient = useQueryClient()

  const currentHit = hits[currentHitIdx] ?? hits[0]
  const recordSourceId = currentHit?.record_source_id ?? null
  const aircraft = allAircraft.find((a) => a.id === currentHit?.aircraft_id)

  // Page metadata: confidence scores + image paths
  const { data: pageMetaMap } = usePageConfidenceMap(open ? recordSourceId : null)

  // Current page PDF URL — used for download
  const { data: currentPageUrl } = useRecordPageUrl(recordSourceId, currentPage)

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

  const { profile } = useAuth()
  const isManager = !!profile && MANAGER_ROLES.includes(profile.role as string)

  async function handleDeleteConfirm() {
    if (!recordSourceId) return
    setIsDeleting(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const resp = await fetch("/.netlify/functions/records-vault-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recordSourceId }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }))
        console.error("[delete]", err)
      } else {
        setDeleteOpen(false)
        queryClient.invalidateQueries({ queryKey: ["record-sources"] })
        queryClient.invalidateQueries({ queryKey: ["rv-source-detail", recordSourceId] })
        onClose()
      }
    } finally {
      setIsDeleting(false)
    }
  }

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
      <DialogContent hideCloseButton className="max-w-none w-screen h-screen p-0 gap-0 rounded-none flex flex-col">

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

          {/* Download current page */}
          {currentPageUrl && (
            <a
              href={currentPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 border-l border-border pl-3"
              title={`Download page ${currentPage}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
            </a>
          )}

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
          <div className="w-[96px] shrink-0 flex flex-col border-r border-border bg-muted/5 overflow-y-auto">
            <div className="px-1 pt-1 space-y-0.5">
              {stripPages.map((pageNum) => {
                const pageMeta = pageMetaMap?.get(pageNum)
                return (
                  <PageStripItem
                    key={pageNum}
                    recordSourceId={recordSourceId ?? ""}
                    pageNumber={pageNum}
                    isActive={pageNum === currentPage}
                    isMatch={matchPages.has(pageNum)}
                    matchIndex={matchPages.has(pageNum) ? (pageToHitIndex.get(pageNum) ?? null) : null}
                    lowConfidence={
                      pageMeta?.confidence != null &&
                      pageMeta.confidence < OCR_CONFIDENCE_WARN
                    }
                    imagePath={pageMeta?.imagePath ?? null}
                    onClick={() => setCurrentPage(pageNum)}
                  />
                )
              })}
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
                  onNavigate={navigate}
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
            isManager={isManager}
            onDelete={() => setDeleteOpen(true)}
          />
        </div>
      </DialogContent>

      <DeleteConfirmDialog
        open={deleteOpen}
        filename={currentHit?.original_filename ?? ""}
        pageCount={source?.page_count}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </Dialog>
  )
}
