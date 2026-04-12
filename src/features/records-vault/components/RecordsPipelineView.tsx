import { useMemo, useState } from "react"
import {
  Loader2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  Trash2,
  Brain,
  Layers,
  Image,
  Upload,
  Printer,
  ScanLine,
  Tag,
  Search,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useRecordsPipeline, type PipelineSource, type IngestionLogEntry } from "../hooks/useRecordsPipeline"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import { ChunkInspectorDrawer } from "./ChunkInspectorDrawer"

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterMode = "all" | "processing" | "verified" | "needs_attention"

type StageKey = "upload" | "rasterize" | "textract" | "events" | "embeddings" | "label"
type StageState = "pending" | "running" | "done" | "partial" | "failed"

type StageInfo = {
  key:    StageKey
  label:  string
  icon:   React.ElementType
  state:  StageState
  detail: string | undefined
  /** Latest rv_ingestion_log message that explains why this stage is not green */
  why:    string | null
}

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

/** Map log steps to the stage they belong to so we can surface the last "why" text. */
const LOG_STEP_TO_STAGE: Record<string, StageKey> = {
  upload_failed:        "upload",
  rasterize_failed:     "rasterize",
  rasterize_partial:    "rasterize",
  textract_failed:      "textract",
  textract_throttled:   "textract",
  events_failed:        "events",
  extraction_failed:    "events",
  embedding_failed:     "embeddings",
  chunk_failed:         "embeddings",
  label_failed:         "label",
}

function lastLogFor(stage: StageKey, log: IngestionLogEntry[]): string | null {
  // Scan newest-first for an entry tagged to this stage with a message.
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]
    if (LOG_STEP_TO_STAGE[entry.step] === stage && entry.message) {
      return entry.message
    }
  }
  return null
}

/** Build a 5-stage status line for a source, newest → label. */
function computeStages(source: PipelineSource): StageInfo[] {
  const log = source.log ?? []

  // 1. Upload — if the row exists at all, the register happened; the file may
  //    still be mid-PUT though, so use the presence of s3_key / storage_path.
  const uploaded = !!source.s3_key || !!source.storage_path
  const uploadState: StageState = uploaded ? "done" : "pending"

  // 2. Rasterize — prefer the new column, fall back to page_images_stored.
  const rasterizeRaw = source.rasterize_status ?? "pending"
  let rasterizeState: StageState = "pending"
  let rasterizeDetail: string | undefined
  const total = source.page_count ?? source.pages_inserted ?? 0
  const images = source.page_images_stored ?? 0
  if (rasterizeRaw === "rasterized") rasterizeState = "done"
  else if (rasterizeRaw === "partial") rasterizeState = "partial"
  else if (rasterizeRaw === "failed") rasterizeState = "failed"
  else if (total > 0 && images > 0 && images >= total) rasterizeState = "done"
  else if (total > 0 && images > 0) rasterizeState = "running"
  if (total > 0) rasterizeDetail = `${images}/${total}p`

  // 3. Textract OCR — uses legacy ingestion_status.
  let textractState: StageState = "pending"
  let textractDetail: string | undefined
  if (source.ingestion_status === "extracting") textractState = "running"
  else if (source.ingestion_status === "indexed") {
    textractState = source.verification_status === "partial" ? "partial" : "done"
    if (source.pages_inserted != null) textractDetail = `${source.pages_inserted}p`
  } else if (source.ingestion_status === "failed") textractState = "failed"

  // 4. Embeddings — uses chunk_status.
  let embeddingsState: StageState = "pending"
  let embeddingsDetail: string | undefined
  if (source.chunk_status === "chunking") embeddingsState = "running"
  else if (source.chunk_status === "chunked") embeddingsState = "done"
  else if (source.chunk_status === "failed") embeddingsState = "failed"
  if (source.chunks_generated != null) embeddingsDetail = `${source.chunks_generated}ch`

  // 5. Label — new label_status column; if missing but display_label is set,
  //    assume legacy "generated".
  const labelRaw = source.label_status ?? "pending"
  let labelState: StageState = "pending"
  if (labelRaw === "generated") labelState = "done"
  else if (labelRaw === "failed") labelState = "failed"
  else if (source.display_label && labelRaw === "pending") labelState = "done"

  return [
    { key: "upload",     label: "Upload",     icon: Upload,    state: uploadState,     detail: undefined,       why: uploadState === "failed" ? lastLogFor("upload", log) : null },
    { key: "rasterize",  label: "Rasterize",  icon: Printer,   state: rasterizeState,  detail: rasterizeDetail, why: rasterizeState === "failed" || rasterizeState === "partial" ? lastLogFor("rasterize", log) : null },
    { key: "textract",   label: "Textract",   icon: ScanLine,  state: textractState,   detail: textractDetail,  why: textractState === "failed" || textractState === "partial" ? lastLogFor("textract", log) : null },
    { key: "embeddings", label: "Vectors",    icon: Layers,    state: embeddingsState, detail: embeddingsDetail,why: embeddingsState === "failed" ? lastLogFor("embeddings", log) : null },
    { key: "label",      label: "Label",      icon: Tag,       state: labelState,      detail: undefined,       why: labelState === "failed" ? lastLogFor("label", log) : null },
  ]
}

const STATE_STYLES: Record<StageState, { bg: string; fg: string; dot: string }> = {
  pending: { bg: "bg-muted/40",      fg: "text-muted-foreground/70",       dot: "bg-muted-foreground/30" },
  running: { bg: "bg-blue-500/10",   fg: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500 animate-pulse" },
  done:    { bg: "bg-green-500/10",  fg: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
  partial: { bg: "bg-amber-500/10",  fg: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  failed:  { bg: "bg-destructive/10", fg: "text-destructive",              dot: "bg-destructive" },
}

// ─── Stage chip ──────────────────────────────────────────────────────────────

function StageChip({ stage }: { stage: StageInfo }) {
  const { bg, fg, dot } = STATE_STYLES[stage.state]
  const Icon = stage.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${bg} ${fg}`}
      title={
        stage.why
          ? `${stage.label} — ${stage.state}: ${stage.why}`
          : `${stage.label} — ${stage.state}${stage.detail ? ` (${stage.detail})` : ""}`
      }
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      <Icon className="h-3 w-3 shrink-0" />
      {stage.label}
      {stage.detail && <span className="font-normal opacity-70">·{stage.detail}</span>}
    </span>
  )
}

function RenderModeBadge({ source }: { source: PipelineSource }) {
  if (source.ingestion_status !== "indexed") return null
  const total = source.page_count ?? source.pages_inserted ?? 0
  const images = source.page_images_stored
  if (images == null || images === 0 || total === 0) return null
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-medium text-amber-500 dark:text-amber-400"
      title={
        images >= total
          ? "All pages use pre-rendered images (scanned document)"
          : `${images} pages use images, ${total - images} use PDF.js`
      }
    >
      <Image className="h-3 w-3 shrink-0" />
      IMG {images}/{total}
    </span>
  )
}

// ─── Source row ──────────────────────────────────────────────────────────────

type RerunStage = "events" | "embeddings" | "label" | "all"

function SourceRow({
  source,
  stages,
  selected,
  onToggleSelect,
  onRerun,
  onDelete,
  onInspectChunks,
  busy,
  deleting,
}: {
  source: PipelineSource
  stages: StageInfo[]
  selected: boolean
  onToggleSelect: (id: string) => void
  onRerun: (id: string, stage: RerunStage, ocrDone: boolean) => void
  onDelete: (id: string, filename: string) => void
  onInspectChunks: (id: string, filename: string) => void
  busy: boolean
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const ocrAlreadyDone = source.ingestion_status === "indexed"
  const failedStages = stages.filter((s) => s.state === "failed")
  const partialStages = stages.filter((s) => s.state === "partial")
  const primaryWhy = failedStages[0]?.why ?? partialStages[0]?.why ?? null

  // Pick the best default "Retry" target based on what's broken.
  const defaultRerun: RerunStage =
    failedStages.some((s) => s.key === "events") ? "events"
    : failedStages.some((s) => s.key === "embeddings") ? "embeddings"
    : failedStages.some((s) => s.key === "label") ? "label"
    : "all"

  const duration = formatDuration(source.ingestion_started_at, source.ingestion_completed_at)
  const ago = timeAgo(source.ingestion_completed_at ?? source.created_at)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(source.id)}
          className="mt-1 h-3.5 w-3.5 rounded border-border accent-[var(--skyshare-gold)] shrink-0 cursor-pointer"
          title="Select for bulk actions"
        />

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

          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {stages.map((s) => <StageChip key={s.key} stage={s} />)}
            <RenderModeBadge source={source} />
            {duration && (
              <span className="text-[10px] text-muted-foreground ml-1">{duration}</span>
            )}
            {ago && (
              <span className="text-[10px] text-muted-foreground">{ago}</span>
            )}
          </div>

          {primaryWhy && (
            <p className="mt-1.5 text-[11px] text-destructive/90 font-mono bg-destructive/5 rounded px-2 py-1 truncate" title={primaryWhy}>
              {primaryWhy}
            </p>
          )}

          {source.ingestion_error && !primaryWhy && (
            <p className="mt-1.5 text-xs text-destructive font-mono bg-destructive/5 rounded px-2 py-1 truncate" title={source.ingestion_error}>
              {source.ingestion_error}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={() => onRerun(source.id, defaultRerun, ocrAlreadyDone)}
            disabled={busy || deleting || source.ingestion_status === "extracting"}
            title={
              defaultRerun === "events" ? "Re-run event extraction"
              : defaultRerun === "embeddings" ? "Re-run vector embeddings"
              : defaultRerun === "label" ? "Re-run display label generation"
              : ocrAlreadyDone ? "Re-run extraction + embeddings + label" : "Retry OCR"
            }
          >
            <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
            {defaultRerun === "events" ? "Re-events"
              : defaultRerun === "embeddings" ? "Re-embed"
              : defaultRerun === "label" ? "Re-label"
              : ocrAlreadyDone ? "Re-run" : "Retry"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onInspectChunks(source.id, source.original_filename)}
            disabled={busy || deleting || source.chunk_status !== "chunked"}
            title="Inspect chunks"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(source.id, source.original_filename)}
            disabled={busy || deleting || source.ingestion_status === "extracting"}
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
              title={expanded ? "Hide log" : "Show log"}
            >
              {expanded
                ? <ChevronDown className="h-4 w-4" />
                : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

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
                    : entry.step.endsWith("_failed") || entry.step === "partial" || entry.step === "failed"
                    ? "text-destructive"
                    : entry.step === "render_decision" || entry.step.endsWith("_throttled") || entry.step.endsWith("_partial")
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-foreground"
                }
              >
                {entry.step}: {entry.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Batch group ─────────────────────────────────────────────────────────────

function BatchGroup({
  label,
  sources,
  stagesById,
  selectedIds,
  onToggleSelect,
  onRerun,
  onDelete,
  onInspectChunks,
  busyId,
  deletingId,
}: {
  label: string
  sources: PipelineSource[]
  stagesById: Map<string, StageInfo[]>
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onRerun: (id: string, stage: RerunStage, ocrDone: boolean) => void
  onDelete: (id: string, filename: string) => void
  onInspectChunks: (id: string, filename: string) => void
  busyId: string | null
  deletingId: string | null
}) {
  const fullyGreen = (s: PipelineSource) => {
    const stages = stagesById.get(s.id) ?? []
    return stages.length > 0 && stages.every((st) => st.state === "done")
  }
  const anyFailed = (s: PipelineSource) => {
    const stages = stagesById.get(s.id) ?? []
    return stages.some((st) => st.state === "failed")
  }
  const anyPartial = (s: PipelineSource) => {
    const stages = stagesById.get(s.id) ?? []
    return stages.some((st) => st.state === "partial")
  }
  const anyRunning = (s: PipelineSource) => {
    const stages = stagesById.get(s.id) ?? []
    return stages.some((st) => st.state === "running")
  }

  const green   = sources.filter(fullyGreen).length
  const failed  = sources.filter(anyFailed).length
  const partial = sources.filter((s) => !anyFailed(s) && anyPartial(s)).length
  const running = sources.filter(anyRunning).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{sources.length} files</span>
          {green > 0   && <span className="text-green-600 dark:text-green-400">· {green} green</span>}
          {running > 0 && <span className="text-blue-600 dark:text-blue-400">· {running} processing</span>}
          {partial > 0 && <span className="text-amber-600 dark:text-amber-400">· {partial} partial</span>}
          {failed > 0  && <span className="text-destructive">· {failed} failed</span>}
        </div>
      </div>
      <div className="space-y-2">
        {sources.map((s) => (
          <SourceRow
            key={s.id}
            source={s}
            stages={stagesById.get(s.id) ?? []}
            selected={selectedIds.has(s.id)}
            onToggleSelect={onToggleSelect}
            onRerun={onRerun}
            onDelete={onDelete}
            onInspectChunks={onInspectChunks}
            busy={busyId === s.id}
            deleting={deletingId === s.id}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

interface Props {
  aircraftId: string | null
}

export function RecordsPipelineView({ aircraftId }: Props) {
  const { sources, registrationByAircraftId, loading, reload } = useRecordsPipeline(aircraftId)
  const [collapsedTails, setCollapsedTails] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [inspectingId, setInspectingId] = useState<string | null>(null)
  const [inspectingName, setInspectingName] = useState<string | null>(null)

  // Compute stages once per source; memoized so StageChips don't thrash.
  const stagesById = useMemo(() => {
    const map = new Map<string, StageInfo[]>()
    for (const s of sources) map.set(s.id, computeStages(s))
    return map
  }, [sources])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function callFn(endpoint: string, body: Record<string, unknown>): Promise<{ ok: boolean; msg?: string }> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { ok: false, msg: "Not authenticated" }
    try {
      const resp = await fetch(`/.netlify/functions/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) return { ok: false, msg: json.error ?? `HTTP ${resp.status}` }
      return { ok: true, msg: json.message }
    } catch (err) {
      return { ok: false, msg: err instanceof Error ? err.message : "Unknown error" }
    }
  }

  async function handleRerun(recordSourceId: string, stage: RerunStage, ocrAlreadyDone: boolean) {
    setBusyId(recordSourceId)
    try {
      let endpoint: string
      switch (stage) {
        case "events":     endpoint = "records-vault-reextract-events"; break
        case "embeddings": endpoint = "records-vault-reembed";          break
        case "label":      endpoint = "records-vault-relabel";          break
        case "all":
          endpoint = ocrAlreadyDone
            ? "records-vault-retry-from-textract"
            : "records-vault-retry"
          break
      }
      const res = await callFn(endpoint, { recordSourceId })
      if (!res.ok) throw new Error(res.msg)
      toast({
        title: `Re-run triggered (${stage})`,
        description: res.msg ?? "Pipeline stage re-queued.",
      })
    } catch (err) {
      toast({
        title: "Re-run failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setBusyId(null)
    }
  }

  async function handleBulkRerun(stage: RerunStage) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      let endpoint: string
      switch (stage) {
        case "events":     endpoint = "records-vault-reextract-events"; break
        case "embeddings": endpoint = "records-vault-reembed";          break
        case "label":      endpoint = "records-vault-relabel";          break
        case "all":        endpoint = "records-vault-retry-from-textract"; break
      }
      const results = await Promise.all(ids.map((id) => callFn(endpoint, { recordSourceId: id })))
      const okCount = results.filter((r) => r.ok).length
      const failCount = results.length - okCount
      toast({
        title: `Bulk ${stage} re-run`,
        description: failCount === 0
          ? `Triggered for ${okCount} source(s).`
          : `${okCount} succeeded, ${failCount} failed.`,
        variant: failCount > 0 ? "destructive" : undefined,
      })
      if (okCount > 0) clearSelection()
    } finally {
      setBulkBusy(false)
    }
  }

  function handleInspectChunks(recordSourceId: string, filename: string) {
    setInspectingId(recordSourceId)
    setInspectingName(filename)
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
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(recordSourceId)
        return next
      })
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

  // ── Filters / grouping / summary ────────────────────────────────────────────

  function isProcessing(s: PipelineSource) {
    const stages = stagesById.get(s.id) ?? []
    return stages.some((st) => st.state === "running")
  }
  function needsAttention(s: PipelineSource) {
    const stages = stagesById.get(s.id) ?? []
    return stages.some((st) => st.state === "failed" || st.state === "partial")
  }
  function isGreen(s: PipelineSource) {
    const stages = stagesById.get(s.id) ?? []
    return stages.length > 0 && stages.every((st) => st.state === "done")
  }

  const filtered = sources.filter((s) => {
    if (filter === "verified")        return isGreen(s)
    if (filter === "processing")      return isProcessing(s)
    if (filter === "needs_attention") return needsAttention(s)
    return true
  })

  // Batch groups (individual uploads / named import batches) — same as before.
  function buildBatchGroups(subset: PipelineSource[]) {
    const groups = new Map<string, PipelineSource[]>()
    for (const s of subset) {
      const key = s.import_batch ?? "__individual__"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(s)
    }
    return groups
  }

  // Tail groups — group the filtered sources by current registration, so the
  // operator can collapse per aircraft. "Unassigned" buckets anything without
  // a known registration. Sorted alphabetically for stable ordering.
  const tailGroups = new Map<string, PipelineSource[]>()
  for (const s of filtered) {
    const tail = (s.aircraft_id && registrationByAircraftId.get(s.aircraft_id)) || "Unassigned"
    if (!tailGroups.has(tail)) tailGroups.set(tail, [])
    tailGroups.get(tail)!.push(s)
  }
  const sortedTails = Array.from(tailGroups.keys()).sort((a, b) => a.localeCompare(b))
  const showTailGrouping = sortedTails.length > 1

  function toggleTail(tail: string) {
    setCollapsedTails((prev) => {
      const next = new Set(prev)
      if (next.has(tail)) next.delete(tail)
      else next.add(tail)
      return next
    })
  }

  const greenCount    = sources.filter(isGreen).length
  const processingCount = sources.filter(isProcessing).length
  const needsAttentionCount = sources.filter(needsAttention).length
  const totalChunks = sources.reduce((n, s) => n + (s.chunks_generated ?? 0), 0)
  const totalPages  = sources.reduce((n, s) => n + (s.page_count ?? 0), 0)
  const avgChunksPerPage = totalPages > 0 ? (totalChunks / totalPages).toFixed(1) : "–"

  const FILTERS: Array<{ key: FilterMode; label: string; count?: number }> = [
    { key: "all",              label: "All",             count: sources.length },
    { key: "processing",       label: "Processing",      count: processingCount || undefined },
    { key: "verified",         label: "Green",           count: greenCount || undefined },
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

  const selectedCount = selectedIds.size

  return (
    <div className="space-y-5">
      {/* Coverage summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <SummaryTile label="Sources" value={sources.length} />
        <SummaryTile label="Green" value={greenCount} accent="green" />
        <SummaryTile label="Processing" value={processingCount} accent="blue" />
        <SummaryTile label="Needs Attention" value={needsAttentionCount} accent={needsAttentionCount > 0 ? "red" : undefined} />
        <SummaryTile label="Chunks" value={totalChunks} sub={`${avgChunksPerPage}/pg`} />
      </div>

      {/* Filter bar + bulk actions */}
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

      {/* Sticky bulk bar — only when selection is non-empty */}
      {selectedCount > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-sm flex-wrap">
          <span className="text-xs font-medium text-foreground">
            {selectedCount} selected
          </span>
          <div className="h-4 w-px bg-border" />
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  disabled={bulkBusy}
                  onClick={() => handleBulkRerun("events")}>
            <Brain className="h-3 w-3" /> Re-extract events
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  disabled={bulkBusy}
                  onClick={() => handleBulkRerun("embeddings")}>
            <Layers className="h-3 w-3" /> Re-embed
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  disabled={bulkBusy}
                  onClick={() => handleBulkRerun("label")}>
            <Tag className="h-3 w-3" /> Re-label
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  disabled={bulkBusy}
                  onClick={() => handleBulkRerun("all")}>
            <RefreshCw className={`h-3 w-3 ${bulkBusy ? "animate-spin" : ""}`} /> Retry from Textract
          </Button>
          <button
            onClick={clearSelection}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Groups */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No records match this filter.
        </p>
      ) : showTailGrouping ? (
        <div className="space-y-4">
          {sortedTails.map((tail) => {
            const tailSources = tailGroups.get(tail) ?? []
            const collapsed = collapsedTails.has(tail)
            const greenN = tailSources.filter(isGreen).length
            const needsN = tailSources.filter(needsAttention).length
            const chunksN = tailSources.reduce((n, s) => n + (s.chunks_generated ?? 0), 0)
            const batches = buildBatchGroups(tailSources)
            return (
              <div key={tail} className="rounded-md border border-border bg-card/30">
                <button
                  onClick={() => toggleTail(tail)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className="text-xs font-semibold tracking-wider uppercase text-foreground"
                    style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.15em" }}
                  >
                    {tail}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {tailSources.length} source{tailSources.length === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
                    {greenN > 0 && (
                      <span className="text-green-600 dark:text-green-400">✓ {greenN}</span>
                    )}
                    {needsN > 0 && (
                      <span className="text-destructive">! {needsN}</span>
                    )}
                    <span>{chunksN.toLocaleString()} ch</span>
                  </span>
                </button>
                {!collapsed && (
                  <div className="px-3 pb-3 pt-1 space-y-4">
                    {Array.from(batches.entries()).map(([batchKey, batchSources]) => (
                      <BatchGroup
                        key={batchKey}
                        label={batchKey === "__individual__" ? "Individual uploads" : batchKey}
                        sources={batchSources}
                        stagesById={stagesById}
                        selectedIds={selectedIds}
                        onToggleSelect={toggleSelect}
                        onRerun={handleRerun}
                        onDelete={handleDelete}
                        onInspectChunks={handleInspectChunks}
                        busyId={busyId}
                        deletingId={deletingId}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(buildBatchGroups(filtered).entries()).map(([batchKey, batchSources]) => (
            <BatchGroup
              key={batchKey}
              label={batchKey === "__individual__" ? "Individual uploads" : batchKey}
              sources={batchSources}
              stagesById={stagesById}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onRerun={handleRerun}
              onDelete={handleDelete}
              onInspectChunks={handleInspectChunks}
              busyId={busyId}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}

      <ChunkInspectorDrawer
        open={inspectingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInspectingId(null)
            setInspectingName(null)
          }
        }}
        recordSourceId={inspectingId}
        filename={inspectingName}
      />
    </div>
  )
}

function SummaryTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number
  sub?: string
  accent?: "green" | "blue" | "red"
}) {
  const accentColor =
    accent === "green" ? "text-green-600 dark:text-green-400"
    : accent === "blue" ? "text-blue-600 dark:text-blue-400"
    : accent === "red"  ? "text-destructive"
    : "text-foreground"

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p
        className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${accentColor}`}>
        {value.toLocaleString()}
        {sub && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{sub}</span>}
      </p>
    </div>
  )
}
