import { useState, useEffect } from "react"
import { Loader2, AlertTriangle, X, ChevronLeft, ChevronRight, FileText } from "lucide-react"
import { Dialog, DialogContent } from "@/shared/ui/dialog"
import { useRecordPageUrl } from "../hooks/useRecordPageUrl"
import type { SearchHit } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  hits: SearchHit[]   // all hits for the document being viewed
  hitIndex: number    // which hit to start on (index into hits[])
  query: string
}

export function RecordsPageViewer({ open, onClose, hits, hitIndex, query }: Props) {
  const [currentIndex, setCurrentIndex] = useState(hitIndex)

  // Reset to the target hit whenever the viewer opens on a new hit
  useEffect(() => {
    if (open) setCurrentIndex(hitIndex)
  }, [open, hitIndex])

  const currentHit = hits[currentIndex] ?? null

  const { data: pdfUrl, isLoading, error } = useRecordPageUrl(
    open && currentHit ? currentHit.record_source_id : null
  )

  // #page=N jumps to the right page; #search=term highlights in Firefox (PDF.js).
  // Chrome (PDFium) ignores #search but still navigates to the page.
  const iframeSrc = pdfUrl && currentHit
    ? `${pdfUrl}#page=${currentHit.page_number}${query ? `&search=${encodeURIComponent(query)}` : ""}`
    : pdfUrl ?? undefined

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < hits.length - 1

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* Full-screen: fills the viewport, no rounded corners, no padding */}
      <DialogContent className="max-w-none w-screen h-screen p-0 gap-0 rounded-none flex flex-col">

        {/* ── Header bar ──────────────────────────────────────────────────── */}
        <div className="flex-none flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background">
          {/* Document info */}
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">
              {currentHit?.original_filename ?? "Record"}
            </p>
            {currentHit?.observed_registration && (
              <p className="text-[10px] font-mono text-muted-foreground">
                {currentHit.observed_registration}
              </p>
            )}
          </div>

          {/* Match navigation — only shown when there are multiple hits */}
          {hits.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={!hasPrev}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                title="Previous match"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground tabular-nums px-1 min-w-[80px] text-center">
                p.{currentHit?.page_number} · {currentIndex + 1} of {hits.length}
              </span>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(hits.length - 1, i + 1))}
                disabled={!hasNext}
                className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                title="Next match"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {hits.length === 1 && currentHit && (
            <span className="text-xs text-muted-foreground shrink-0">
              Page {currentHit.page_number}
            </span>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="ml-1 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── PDF viewer ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 relative bg-muted/30">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Loading document…</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive">Failed to load document. Please try again.</p>
            </div>
          )}

          {iframeSrc && (
            <iframe
              key={currentHit?.record_source_id}
              src={iframeSrc}
              className="w-full h-full border-0"
              title={currentHit?.original_filename ?? "Record"}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
