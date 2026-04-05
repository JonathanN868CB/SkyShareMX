import { useState } from "react"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  Trash2,
  Brain,
  Layers,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useRecordsPipeline, type PipelineSource } from "../hooks/useRecordsPipeline"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import type { ExtractionStatus, ChunkStatus } from "../types"

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterMode = "all" | "processing" | "verified" | "needs_attention"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso) return ""
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const secs = Math.round((end - start) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return "just now"
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

// ─── Three-stage pipeline indicator ──────────────────────────────────────────

type StageState = "pending" | "running" | "done" | "failed"

function StageChip({
  icon: Icon,
  label,
  detail,
  state,
}: {
  icon: React.ElementType
  label: string
  detail?: string
  state: StageState
}) {
  const colours: Record<StageState, string> = {
    pending: "text-muted-foreground/60",
    running: "text-blue-600 dark:text-blue-400",
    done:    "text-green-600 dark:text-green-400",
    failed:  "text-destructive",
  }
  const colour = colours[state]

  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${colour}`}>
      {state === "running"
        ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        : state === "done"
        ? <CheckCircle2 className="h-3 w-3 shrink-0" />
        : state === "failed"
        ? <XCircle className="h-3 w-3 shrink-0" />
        : <Clock className="h-3 w-3 shrink-0" />
      }
      <Icon className="h-3 w-3 shrink-0" />
      {label}
      {detail && <span className="font-normal opacity-70">{detail}</span>}
    </span>
  )
}

function PipelineSeparator({ active }: { active: boolean }) {
  return (
    <span className={`text-[10px] ${active ? "text-muted-foreground/50" : "text-muted-foreground/20"}`}>
      →
    </span>
  )
}

function StatusIndicator({ source }: { source: PipelineSource }) {
  const {
    ingestion_status, verification_status, pages_extracted, pages_inserted,
    extraction_status, events_extracted,
    chunk_status, chunks_generated,
  } = source

  // ── Stage 1: OCR ────────────────────────────────────────────────────────────
  let ocrState: StageState = "pending"
  let ocrDetail: string | undefined
  if (ingestion_status === "extracting") { ocrState = "running" }
  else if (ingestion_status === "indexed") {
    ocrState = verification_status === "partial" ? "failed" : "done"
    ocrDetail = pages_inserted != null ? ` ${pages_inserted}p` : undefined
  } else if (ingestion_status === "failed") {
    ocrState = "failed"
  }

  // ── Stage 2: Event extraction ────────────────────────────────────────────────
  const exStatus = (extraction_status ?? "pending") as ExtractionStatus
  let evState: StageState = "pending"
  let evDetail: string | undefined
  if (exStatus === "extracting") { evState = "running" }
  else if (exStatus === "complete") {
    evState = "done"
    evDetail = events_extracted != null ? ` ${events_extracted}ev` : undefined
  } else if (exStatus === "failed") { evState = "failed" }

  // ── Stage 3: Vector embeddings ────────────────────────────────────────────────
  const ckStatus = (chunk_status ?? "pending") as ChunkStatus
  let vecState: StageState = "pending"
  let vecDetail: string | undefined
  if (ckStatus === "chunking") { vecState = "running" }
  else if (ckStatus === "chunked") {
    vecState = "done"
    vecDetail = chunks_generated != null ? ` ${chunks_generated}ch` : undefined
  } else if (ckStatus === "failed") { vecState = "failed" }

  const ocrDoneOrBetter = ocrState === "done"

  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      <StageChip icon={FileText} label="OCR" detail={ocrDetail} state={ocrState} />
      <PipelineSeparator active={ocrDoneOrBetter} />
      <StageChip icon={Brain}    label="Events" detail={evDetail} state={evState} />
      <PipelineSeparator active={evState === "done"} />
      <StageChip icon={Layers}   label="Vectors" detail={vecDetail} state={vecState} />
      {verification_status === "partial" && (
        <span className="flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-400 font-medium">
          <AlertTriangle className="h-3 w-3" />
          {pages_inserted ?? "?"}/{pages_extracted ?? "?"} pages inserted
        </span>
      )}
    </span>
  )
}

// ─── Single source row ────────────────────────────────────────────────────────

function SourceRow({
  source,
  onRetry,
  onDelete,
  retrying,
  deleting,
}: {
  source: PipelineSource
  onRetry: (id: string, ocrDone: boolean) => void
  onDelete: (id: string, filename: string) => void
  retrying: boolean
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  // Can always retry if OCR failed/partial; can re-run extract+embed if indexed
  const canRetry =
    source.ingestion_status === "failed" ||
    source.ingestion_status === "pending" ||
    source.verification_status === "partial" ||
    source.ingestion_status === "indexed"  // covers re-running extract/embed

  // Whether OCR is done — if so, retry only needs to re-run extract+embed
  const ocrAlreadyDone = source.ingestion_status === "indexed"

  const duration = formatDuration(
    source.ingestion_started_at,
    source.ingestion_completed_at
  )
  const ago = timeAgo(source.ingestion_completed_at ?? source.created_at)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">
              {source.original_filename}
            </span>
            <span className="text-xs text-muted-foreground">
              {SOURCE_CATEGORY_LABELS[source.source_category]}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <StatusIndicator source={source} />
            {duration && (
              <span className="text-xs text-muted-foreground">{duration}</span>
            )}
            {ago && (
              <span className="text-xs text-muted-foreground">{ago}</span>
            )}
          </div>

          {source.ingestion_error && (
            <p className="mt-1.5 text-xs text-destructive font-mono bg-destructive/5 rounded px-2 py-1">
              {source.ingestion_error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canRetry && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => onRetry(source.id, ocrAlreadyDone)}
              disabled={
                retrying || deleting ||
                source.ingestion_status === "extracting" ||
                source.extraction_status === "extracting" ||
                source.chunk_status === "chunking"
              }
              title={ocrAlreadyDone ? "Re-run event extraction + vector embedding" : "Retry OCR ingestion"}
            >
              <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
              {ocrAlreadyDone ? "Re-extract" : source.verification_status === "partial" ? "Re-process" : "Retry"}
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(source.id, source.original_filename)}
            disabled={retrying || deleting || source.ingestion_status === "extracting"}
            title="Delete record"
          >
            {deleting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />}
          </Button>

          {source.log.length > 0 && (
            <button
              className="text-muted-foreground hover:text-foreground p-1"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable step log */}
      {expanded && source.log.length > 0 && (
        <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Processing log
          </p>
          {source.log.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground/60 font-mono shrink-0 w-20">
                {new Date(entry.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span
                className={
                  entry.step === "verified"
                    ? "text-green-600 dark:text-green-400"
                    : entry.step === "failed" || entry.step === "partial"
                    ? "text-destructive"
                    : "text-foreground"
                }
              >
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Batch group ──────────────────────────────────────────────────────────────

function BatchGroup({
  label,
  sources,
  onRetry,
  onDelete,
  retryingId,
  deletingId,
}: {
  label: string
  sources: PipelineSource[]
  onRetry: (id: string, ocrDone: boolean) => void
  onDelete: (id: string, filename: string) => void
  retryingId: string | null
  deletingId: string | null
}) {
  const allDone = (s: PipelineSource) =>
    s.ingestion_status === "indexed" &&
    s.extraction_status === "complete" &&
    s.chunk_status === "chunked"

  const verified  = sources.filter((s) => allDone(s) && s.verification_status === "verified").length
  const failed    = sources.filter(
    (s) => s.ingestion_status === "failed" || s.extraction_status === "failed" || s.chunk_status === "failed"
  ).length
  const partial   = sources.filter((s) => s.verification_status === "partial").length
  const running   = sources.filter(
    (s) =>
      s.ingestion_status === "pending" || s.ingestion_status === "extracting" ||
      s.extraction_status === "extracting" || s.chunk_status === "chunking"
  ).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{sources.length} files</span>
          {verified > 0 && (
            <span className="text-green-600 dark:text-green-400">
              · {verified} verified
            </span>
          )}
          {running > 0 && (
            <span className="text-blue-600 dark:text-blue-400">
              · {running} processing
            </span>
          )}
          {partial > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400">
              · {partial} partial
            </span>
          )}
          {failed > 0 && (
            <span className="text-destructive">· {failed} failed</span>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {sources.map((s) => (
          <SourceRow
            key={s.id}
            source={s}
            onRetry={onRetry}
            onDelete={onDelete}
            retrying={retryingId === s.id}
            deleting={deletingId === s.id}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

interface Props {
  aircraftId: string | null
}

export function RecordsPipelineView({ aircraftId }: Props) {
  const { sources, loading, reload } = useRecordsPipeline(aircraftId)
  const { toast } = useToast()
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>("all")

  async function handleRetry(recordSourceId: string, ocrAlreadyDone: boolean) {
    setRetryingId(recordSourceId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")

      // If OCR is already done, skip re-OCR and just re-run extract + embed
      const endpoint = ocrAlreadyDone
        ? "/.netlify/functions/records-vault-reextract"
        : "/.netlify/functions/records-vault-retry"

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ recordSourceId }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error ?? "Retry failed")

      toast({
        title: ocrAlreadyDone ? "Re-extraction triggered" : "Retry triggered",
        description: json.message ?? `Processing ${json.queued ?? 1} document(s)`,
      })
    } catch (err) {
      toast({
        title: "Retry failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setRetryingId(null)
    }
  }

  async function handleDelete(recordSourceId: string, filename: string) {
    if (!window.confirm(`Delete "${filename}"? This will permanently remove the file and all indexed pages.`)) return
    setDeletingId(recordSourceId)
    try {
      const { error } = await supabase
        .from("rv_record_sources")
        .delete()
        .eq("id", recordSourceId)
      if (error) throw error
      toast({ title: "Deleted", description: `${filename} removed.` })
      reload()
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
    }
  }

  function isProcessing(s: PipelineSource) {
    return (
      s.ingestion_status === "pending" || s.ingestion_status === "extracting" ||
      s.extraction_status === "extracting" || s.chunk_status === "chunking"
    )
  }

  function needsAttention(s: PipelineSource) {
    return (
      s.ingestion_status === "failed" || s.verification_status === "partial" ||
      s.extraction_status === "failed" || s.chunk_status === "failed"
    )
  }

  function isFullyComplete(s: PipelineSource) {
    return (
      s.ingestion_status === "indexed" &&
      s.extraction_status === "complete" &&
      s.chunk_status === "chunked"
    )
  }

  // Filter
  const filtered = sources.filter((s) => {
    if (filter === "verified")        return isFullyComplete(s) && s.verification_status === "verified"
    if (filter === "processing")      return isProcessing(s)
    if (filter === "needs_attention") return needsAttention(s)
    return true
  })

  // Group by import_batch (nulls go into "Individual uploads")
  const groups = new Map<string, PipelineSource[]>()
  for (const s of filtered) {
    const key = s.import_batch ?? "__individual__"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  const needsAttentionCount = sources.filter(needsAttention).length
  const processingCount = sources.filter(isProcessing).length

  const FILTERS: Array<{ key: FilterMode; label: string; count?: number }> = [
    { key: "all",              label: "All",             count: sources.length },
    { key: "processing",       label: "Processing",      count: processingCount || undefined },
    { key: "verified",         label: "Verified" },
    { key: "needs_attention",  label: "Needs Attention", count: needsAttentionCount || undefined },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">No records uploaded yet</p>
        <p className="text-xs text-muted-foreground">
          Upload files to see the ingestion pipeline here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  filter === key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : key === "needs_attention"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-muted-foreground/20"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}

        <button
          onClick={reload}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Groups */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No records match this filter.
        </p>
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([batchKey, batchSources]) => (
            <BatchGroup
              key={batchKey}
              label={batchKey === "__individual__" ? "Individual uploads" : batchKey}
              sources={batchSources}
              onRetry={handleRetry}
              onDelete={handleDelete}
              retryingId={retryingId}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
