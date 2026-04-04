import { useState, useCallback } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { ChevronLeft, ChevronRight, X, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { useRecordPageUrl } from "../hooks/useRecordPageUrl"
import type { SearchHit } from "../types"

// Configure PDF.js worker — use the locally bundled worker (Vite resolves this at build time)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

interface Props {
  open: boolean
  onClose: () => void
  hit: SearchHit | null   // the search hit that opened this viewer
}

export function RecordsPageViewer({ open, onClose, hit }: Props) {
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [jumpValue, setJumpValue] = useState("")

  const { data: pdfUrl, isLoading: urlLoading, error: urlError } =
    useRecordPageUrl(open && hit ? hit.record_source_id : null)

  // When a new hit opens the viewer, jump to its page
  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
      if (hit) {
        setCurrentPage(Math.min(hit.page_number, n))
      }
    },
    [hit]
  )

  function goPrev() {
    setCurrentPage((p) => Math.max(1, p - 1))
  }

  function goNext() {
    setCurrentPage((p) => Math.min(numPages ?? p, p + 1))
  }

  function handleJump(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(jumpValue, 10)
    if (!isNaN(n) && numPages && n >= 1 && n <= numPages) {
      setCurrentPage(n)
    }
    setJumpValue("")
  }

  const title = hit
    ? `${hit.original_filename} — Page ${currentPage}${numPages ? ` / ${numPages}` : ""}`
    : "Record Viewer"

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-none px-5 py-3 border-b border-border flex-row items-center justify-between">
          <DialogTitle className="text-sm font-medium text-foreground truncate pr-4">
            {title}
          </DialogTitle>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Navigation bar */}
        <div className="flex-none flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>

          <form onSubmit={handleJump} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Jump to page</span>
            <Input
              className="w-16 h-7 text-xs text-center"
              placeholder={String(currentPage)}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              type="number"
              min={1}
              max={numPages ?? undefined}
            />
          </form>

          {numPages && (
            <span className="text-xs text-muted-foreground">
              of {numPages}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={!numPages || currentPage >= numPages}
            onClick={goNext}
            className="ml-auto"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* PDF render area */}
        <div className="flex-1 overflow-auto flex items-start justify-center bg-muted/20 p-4">
          {urlLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Loading document…</p>
            </div>
          )}

          {urlError && (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive">Failed to load document. Please try again.</p>
            </div>
          )}

          {pdfUrl && (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={(err) => console.error("[RecordsPageViewer] PDF load error:", err)}
              loading={
                <div className="flex items-center gap-2 py-20 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Rendering…</span>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                className="shadow-lg rounded"
                width={Math.min(window.innerWidth * 0.75, 900)}
              />
            </Document>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
