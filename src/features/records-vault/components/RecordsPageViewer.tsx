import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, AlertTriangle, X, ChevronLeft, ChevronRight, FileText, ChevronDown, ChevronUp } from "lucide-react"
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
  hits: SearchHit[]   // all hits for the document being viewed
  hitIndex: number    // which hit to start on (index into hits[])
  query: string
}

// ─── Excerpt highlighting ─────────────────────────────────────────────────────
// ts_headline wraps matches in <b>…</b> by default. We parse these into
// React spans so we can style them without dangerouslySetInnerHTML.

function ExcerptHighlighted({ text }: { text: string }) {
  type Part = { content: string; highlight: boolean }
  const parts: Part[] = []
  let rest = text
  while (rest.length > 0) {
    const start = rest.indexOf("<b>")
    if (start === -1) { parts.push({ content: rest, highlight: false }); break }
    if (start > 0) parts.push({ content: rest.slice(0, start), highlight: false })
    const end = rest.indexOf("</b>", start)
    if (end === -1) { parts.push({ content: rest.slice(start + 3), highlight: true }); break }
    parts.push({ content: rest.slice(start + 3, end), highlight: true })
    rest = rest.slice(end + 4)
  }
  return (
    <span className="text-sm leading-relaxed text-foreground/80">
      {parts.map((p, i) =>
        p.highlight
          ? (
            <mark
              key={i}
              className="bg-yellow-200 dark:bg-yellow-700/60 text-foreground font-semibold px-0.5 rounded-sm not-italic"
            >
              {p.content}
            </mark>
          )
          : <span key={i}>{p.content}</span>
      )}
    </span>
  )
}

// ─── Category badge colours ───────────────────────────────────────────────────

const CATEGORY_COLOUR: Record<SourceCategory | string, string> = {
  logbook:      "text-blue-600 dark:text-blue-400",
  work_package: "text-purple-600 dark:text-purple-400",
  inspection:   "text-amber-600 dark:text-amber-400",
  ad_compliance:"text-red-600 dark:text-red-400",
  major_repair: "text-orange-600 dark:text-orange-400",
  other:        "text-muted-foreground",
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropertiesPanel({
  hit,
  source,
  tailNumber,
}: {
  hit: SearchHit
  source: RecordSource | undefined
  tailNumber: string | undefined
}) {
  const [open, setOpen] = useState(true)

  function fmtDate(iso: string | null | undefined) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" })
  }

  const catColour = CATEGORY_COLOUR[hit.source_category] ?? "text-muted-foreground"

  return (
    <div
      className="shrink-0 flex flex-col border-l border-border overflow-hidden transition-all duration-200"
      style={{ width: open ? "272px" : "36px" }}
    >
      {/* Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center py-2.5 hover:bg-muted/40 transition-colors shrink-0 border-b border-border"
        title={open ? "Collapse properties" : "File properties"}
      >
        {open
          ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
          : <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 min-w-0">

          {/* File name */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">File</p>
            <p className="text-xs font-medium text-foreground break-all leading-snug">
              {hit.original_filename}
            </p>
          </div>

          {/* Aircraft */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Aircraft</p>
            <p className="text-xs text-foreground">
              {tailNumber ?? hit.observed_registration ?? "—"}
            </p>
            {hit.observed_registration && tailNumber && hit.observed_registration !== tailNumber && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                On doc: {hit.observed_registration}
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Category</p>
            <p className={`text-xs font-medium ${catColour}`}>
              {SOURCE_CATEGORY_LABELS[hit.source_category]}
            </p>
          </div>

          {/* Date range */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Date Range</p>
            <p className="text-xs text-foreground">
              {hit.date_range_start || hit.date_range_end
                ? `${fmtDate(hit.date_range_start)} – ${fmtDate(hit.date_range_end)}`
                : "—"}
            </p>
          </div>

          {/* Pages (from full source record) */}
          {source?.page_count != null && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Pages</p>
              <p className="text-xs text-foreground">{source.page_count} indexed</p>
            </div>
          )}

          {/* OCR quality */}
          {source?.ocr_quality_score != null && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">OCR Quality</p>
              <p className="text-xs text-foreground">{Math.round(source.ocr_quality_score * 100)}%</p>
            </div>
          )}

          {/* Notes */}
          {source?.notes && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
              <p className="text-xs text-foreground leading-snug">{source.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main viewer ──────────────────────────────────────────────────────────────

export function RecordsPageViewer({ open, onClose, hits, hitIndex, query }: Props) {
  const [currentIndex, setCurrentIndex] = useState(hitIndex)
  const [excerptExpanded, setExcerptExpanded] = useState(true)
  const { allAircraft } = useRecordsVaultCtx()

  // Reset to the target hit whenever the viewer opens on a new hit
  useEffect(() => {
    if (open) {
      setCurrentIndex(hitIndex)
      setExcerptExpanded(true)
    }
  }, [open, hitIndex])

  const currentHit = hits[currentIndex] ?? null

  // Fetch single-page PDF (cached after first load)
  const { data: pdfUrl, isLoading, error } = useRecordPageUrl(
    open && currentHit ? currentHit.record_source_id : null,
    currentHit?.page_number
  )

  // Fetch full source record for properties panel
  const { data: source } = useQuery({
    queryKey: ["record-source-detail", currentHit?.record_source_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_record_sources")
        .select("id, page_count, ocr_quality_score, notes, file_size_bytes")
        .eq("id", currentHit!.record_source_id)
        .single()
      if (error) throw error
      return data as Pick<RecordSource, "id" | "page_count" | "ocr_quality_score" | "notes" | "file_size_bytes">
    },
    enabled: open && !!currentHit?.record_source_id,
    staleTime: 5 * 60 * 1000,
  })

  const aircraft = allAircraft.find((a) => a.id === currentHit?.aircraft_id)

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < hits.length - 1

  // The excerpt from ts_headline contains <b>…</b> markup for matches
  const hasExcerpt = !!currentHit?.ocr_excerpt?.trim()

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-none w-screen h-screen p-0 gap-0 rounded-none flex flex-col">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex-none flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />

          {/* Document title + registration */}
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

          {/* Match navigation */}
          {hits.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={!hasPrev}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                title="Previous match"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground tabular-nums px-1 min-w-[90px] text-center whitespace-nowrap">
                p.{currentHit?.page_number} · {currentIndex + 1} of {hits.length} matches
              </span>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(hits.length - 1, i + 1))}
                disabled={!hasNext}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                title="Next match"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {hits.length === 1 && currentHit && (
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              Page {currentHit.page_number}
            </span>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="ml-1 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body: PDF + Properties ────────────────────────────────────────── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* PDF area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

            {/* PDF iframe */}
            <div className="flex-1 min-h-0 relative bg-muted/20">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Loading page…</p>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
                  <p className="text-sm text-destructive">Failed to load page. Please try again.</p>
                </div>
              )}

              {pdfUrl && (
                <iframe
                  key={`${currentHit?.record_source_id}-${currentHit?.page_number}`}
                  src={pdfUrl}
                  className="w-full h-full border-0"
                  title={currentHit?.original_filename ?? "Record"}
                />
              )}
            </div>

            {/* OCR excerpt bar — only shown when a real search produced a match */}
            {hasExcerpt && (
              <div className="flex-none border-t border-border bg-muted/10 shrink-0">
                <button
                  onClick={() => setExcerptExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                    Match Context
                  </span>
                  {excerptExpanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>

                {excerptExpanded && (
                  <div className="px-4 pb-3">
                    <ExcerptHighlighted text={currentHit.ocr_excerpt} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Properties panel */}
          <PropertiesPanel
            hit={currentHit ?? hits[0]}
            source={source as RecordSource | undefined}
            tailNumber={aircraft?.tailNumber}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
