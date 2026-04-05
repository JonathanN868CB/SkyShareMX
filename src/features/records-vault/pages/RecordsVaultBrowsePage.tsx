import { useState } from "react"
import {
  Loader2,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Trash2,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { useRecordSources } from "../hooks/useRecordSources"
import { useRecordPageUrl } from "../hooks/useRecordPageUrl"
import { PdfPageRenderer } from "../components/PdfPageRenderer"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import type { RecordSource, SourceCategory } from "../types"

// ─── Category filter pills ────────────────────────────────────────────────────

const CATEGORY_FILTERS: Array<{ value: SourceCategory | "all"; label: string }> = [
  { value: "all",          label: "All" },
  { value: "logbook",      label: "Logbook" },
  { value: "work_package", label: "Work Package" },
  { value: "inspection",   label: "Inspection" },
  { value: "ad_compliance",label: "AD Compliance" },
  { value: "major_repair", label: "Major Repair" },
  { value: "other",        label: "Other" },
]

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ source }: { source: RecordSource }) {
  const s = source.ingestion_status
  const v = (source as RecordSource & { verification_status?: string }).verification_status

  if (s === "indexed" && v === "verified")
    return <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
  if (s === "indexed" && v === "partial")
    return <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
  if (s === "failed")
    return <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
  if (s === "extracting")
    return <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
  return <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
}

// ─── Source list card ─────────────────────────────────────────────────────────

function SourceCard({
  source,
  selected,
  onClick,
}: {
  source: RecordSource
  selected: boolean
  onClick: () => void
}) {
  const v = (source as RecordSource & { verification_status?: string }).verification_status

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-md border transition-all duration-100 ${
        selected
          ? "border-primary/50 bg-primary/5"
          : "border-transparent hover:border-border hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <StatusDot source={source} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs leading-snug line-clamp-2 ${selected ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>
            {source.original_filename}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {SOURCE_CATEGORY_LABELS[source.source_category]}
            </span>
            {source.page_count && source.ingestion_status === "indexed" && (
              <span className="text-[10px] text-muted-foreground">
                · {source.page_count} pp
                {v === "verified" && <span className="text-green-600 dark:text-green-400 ml-1">✓</span>}
                {v === "partial" && <span className="text-yellow-600 dark:text-yellow-400 ml-1">⚠</span>}
              </span>
            )}
            {source.ingestion_status === "extracting" && (
              <span className="text-[10px] text-blue-500">· Processing…</span>
            )}
            {source.ingestion_status === "failed" && (
              <span className="text-[10px] text-destructive">· Failed</span>
            )}
            {source.ingestion_status === "pending" && (
              <span className="text-[10px] text-muted-foreground">· Queued</span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Metadata panel ───────────────────────────────────────────────────────────

function MetadataPanel({ source }: { source: RecordSource }) {
  const [expanded, setExpanded] = useState(true)
  const v = (source as RecordSource & {
    verification_status?: string
    pages_inserted?: number | null
    ingestion_completed_at?: string | null
    ocr_quality_score?: number | null
  })

  function fmtDate(iso: string | null) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" })
  }

  function timeAgo(iso: string | null) {
    if (!iso) return ""
    const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
    if (secs < 60) return "just now"
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  }

  return (
    <div
      className="border-t border-border bg-muted/10 shrink-0"
      style={{ maxHeight: expanded ? "220px" : "40px", transition: "max-height 0.2s ease", overflow: "hidden" }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Document Info
        </span>
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>

      <div className="px-4 pb-4 grid grid-cols-2 gap-x-6 gap-y-2 overflow-y-auto" style={{ maxHeight: "170px" }}>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Category</p>
          <p className="text-xs text-foreground">{SOURCE_CATEGORY_LABELS[source.source_category]}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Registration</p>
          <p className="text-xs text-foreground">{source.observed_registration ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Date Range</p>
          <p className="text-xs text-foreground">
            {source.date_range_start || source.date_range_end
              ? `${fmtDate(source.date_range_start)} – ${fmtDate(source.date_range_end)}`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Pages</p>
          <p className="text-xs text-foreground">
            {source.page_count
              ? `${v.pages_inserted ?? source.page_count} / ${source.page_count} indexed`
              : "—"}
          </p>
        </div>
        {v.ocr_quality_score != null && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">OCR Quality</p>
            <p className="text-xs text-foreground">{Math.round(v.ocr_quality_score * 100)}%</p>
          </div>
        )}
        {v.ingestion_completed_at && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Indexed</p>
            <p className="text-xs text-foreground">{timeAgo(v.ingestion_completed_at)}</p>
          </div>
        )}
        {source.notes && (
          <div className="col-span-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Notes</p>
            <p className="text-xs text-foreground">{source.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Inline viewer — PDF.js canvas rendering ────────────────────────────────
// Uses react-pdf (PDF.js) for canvas rendering with text layer.
// Falls back to iframe if PDF.js fails (white screen protection).

function InlineViewer({ source, onDelete }: { source: RecordSource; onDelete: () => void }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()
  const totalPages = source.page_count ?? 1
  const { data: pdfUrl, isLoading, error } = useRecordPageUrl(source.id, currentPage)

  async function handleDelete() {
    if (!window.confirm(`Delete "${source.original_filename}"?\n\nThis will permanently remove the file and all indexed pages.`)) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from("rv_record_sources")
        .delete()
        .eq("id", source.id)
      if (error) throw error
      toast({ title: "Deleted", description: `${source.original_filename} removed.` })
      onDelete()
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header bar */}
      <div className="flex-none flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
        <p className="text-xs font-medium text-foreground truncate flex-1 min-w-0">
          {source.original_filename}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-1.5 py-0.5 rounded text-xs hover:bg-muted disabled:opacity-30 transition-colors"
            >
              ←
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-1.5 py-0.5 rounded text-xs hover:bg-muted disabled:opacity-30 transition-colors"
            >
              →
            </button>
          </div>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors"
          title="Delete document"
        >
          {deleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* PDF area */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Loading page {currentPage}…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive mb-3" />
            <p className="text-sm text-destructive">Failed to load document.</p>
          </div>
        )}

        {pdfUrl && (
          <PdfPageRenderer
            pdfUrl={pdfUrl}
            pageKey={`browse-${source.id}-${currentPage}`}
          />
        )}
      </div>

      {/* Metadata panel */}
      <MetadataPanel source={source} />
    </div>
  )
}

// ─── Main Browse Page ─────────────────────────────────────────────────────────

export default function RecordsVaultBrowsePage() {
  const { selectedAircraftId } = useRecordsVaultCtx()
  const [categoryFilter, setCategoryFilter] = useState<SourceCategory | "all">("all")
  const [selectedSource, setSelectedSource] = useState<RecordSource | null>(null)
  const queryClient = useQueryClient()

  const { data: sources = [], isLoading } = useRecordSources(selectedAircraftId)

  const filtered = categoryFilter === "all"
    ? sources
    : sources.filter((s) => s.source_category === categoryFilter)

  const activeCategories = CATEGORY_FILTERS.filter(
    (f) => f.value === "all" || sources.some((s) => s.source_category === f.value)
  )

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left — source list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border overflow-hidden">
        {/* Category filter pills */}
        <div className="px-3 pt-3 pb-2 border-b border-border flex flex-wrap gap-1.5 shrink-0">
          {activeCategories.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setCategoryFilter(value)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                categoryFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className="px-3 py-2 shrink-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {filtered.length} {filtered.length === 1 ? "document" : "documents"}
          </p>
        </div>

        {/* Source cards */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No documents found</p>
            </div>
          )}

          {filtered.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              selected={selectedSource?.id === source.id}
              onClick={() => setSelectedSource(source)}
            />
          ))}
        </div>
      </div>

      {/* Right — viewer */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!selectedSource ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">
              Select a document to preview
            </p>
            <p className="text-xs text-muted-foreground">
              Choose any document from the list on the left
            </p>
          </div>
        ) : (
          <InlineViewer
            key={selectedSource.id}
            source={selectedSource}
            onDelete={() => {
              setSelectedSource(null)
              queryClient.invalidateQueries({ queryKey: ["record-sources", selectedAircraftId] })
            }}
          />
        )}
      </div>
    </div>
  )
}
