import { Loader2, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { useRecordPageUrl } from "../hooks/useRecordPageUrl"
import type { SearchHit } from "../types"

interface Props {
  open: boolean
  onClose: () => void
  hit: SearchHit | null
}

export function RecordsPageViewer({ open, onClose, hit }: Props) {
  const { data: pdfUrl, isLoading, error } = useRecordPageUrl(
    open && hit ? hit.record_source_id : null
  )

  // Append #page=N so the browser's native PDF viewer opens at the right page.
  // Works in Chrome and Firefox; Safari ignores the fragment but still shows the doc.
  const iframeSrc = pdfUrl && hit ? `${pdfUrl}#page=${hit.page_number}` : pdfUrl

  const title = hit
    ? `${hit.original_filename} — Page ${hit.page_number}`
    : "Record Viewer"

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="flex-none px-5 py-3 border-b border-border">
          <DialogTitle className="text-sm font-medium text-foreground truncate pr-8">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 relative">
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
              key={iframeSrc}
              src={iframeSrc}
              className="w-full h-full border-0"
              title={hit?.original_filename ?? "Record"}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
