import { FileText, AlertTriangle, FolderOpen } from "lucide-react"
import { IngestionStatusBadge } from "./IngestionStatusBadge"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import type { RecordSource } from "../types"

interface Props {
  sources: RecordSource[]
  isLoading: boolean
  onViewSource: (source: RecordSource) => void
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function RecordSourcesList({ sources, isLoading, onViewSource }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-2" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        ))}
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">No records uploaded yet</p>
        <p className="text-xs text-muted-foreground">
          Upload a PDF to get started. Manager or above can upload records.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <button
          key={source.id}
          className="w-full text-left rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-colors"
          onClick={() => onViewSource(source)}
        >
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground truncate">
                  {source.original_filename}
                </span>
                <IngestionStatusBadge status={source.ingestion_status} />
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {SOURCE_CATEGORY_LABELS[source.source_category]}
                </span>
                {source.page_count && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{source.page_count} pages</span>
                  </>
                )}
                {source.file_size_bytes && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(source.file_size_bytes)}</span>
                  </>
                )}
                {source.observed_registration && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-mono text-muted-foreground">{source.observed_registration}</span>
                  </>
                )}
                {(source.date_range_start || source.date_range_end) && (
                  <>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(source.date_range_start)}
                      {source.date_range_end && ` – ${formatDate(source.date_range_end)}`}
                    </span>
                  </>
                )}
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  Uploaded {formatDate(source.created_at)}
                </span>
              </div>
              {source.ingestion_status === "failed" && source.ingestion_error && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{source.ingestion_error}</span>
                </div>
              )}
              {source.notes && (
                <p className="mt-1.5 text-xs text-muted-foreground italic">{source.notes}</p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
