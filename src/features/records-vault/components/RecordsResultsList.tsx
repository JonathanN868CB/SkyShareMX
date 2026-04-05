import { useMemo } from "react"
import { Search, FileSearch, FileText, BookOpen, AlertCircle } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import type { SearchHit } from "../types"
import type { SortBy } from "../hooks/useRecordsSearch"

// ─── Category colors (shared with RecordsResultCard) ─────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  logbook:      "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  work_package: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  inspection:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ad_compliance:"bg-red-500/10 text-red-600 dark:text-red-400",
  major_repair: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  other:        "bg-muted text-muted-foreground",
}

// Parse ts_headline <b>term</b> markers into highlighted <mark> spans
function renderExcerpt(excerpt: string): React.ReactNode {
  const parts = excerpt.split(/(<b>.*?<\/b>)/g)
  return parts.map((part, i) => {
    if (part.startsWith("<b>") && part.endsWith("</b>")) {
      return (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-800/60 text-yellow-900 dark:text-yellow-100 rounded-sm px-0.5 font-medium not-italic"
        >
          {part.slice(3, -4)}
        </mark>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ─── Compact page hit row (used inside a document group) ─────────────────────

function PageHitRow({
  hit,
  onViewPage,
}: {
  hit: SearchHit
  onViewPage: (hit: SearchHit) => void
}) {
  return (
    <div
      className="group flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={() => onViewPage(hit)}
    >
      {/* Page number */}
      <span className="text-xs font-bold tabular-nums text-muted-foreground w-10 shrink-0">
        p.{hit.page_number}
      </span>

      {/* Excerpt */}
      <p className="flex-1 text-xs text-muted-foreground leading-relaxed line-clamp-1 min-w-0">
        {hit.ocr_excerpt ? renderExcerpt(hit.ocr_excerpt) : (
          <span className="italic">No excerpt available</span>
        )}
      </p>

      {/* Open button — visible on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); onViewPage(hit) }}
        className="shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground group-hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
      >
        <BookOpen className="h-3 w-3" />
        Open
      </button>
    </div>
  )
}

// ─── Document group ───────────────────────────────────────────────────────────

interface DocumentGroup {
  record_source_id: string
  original_filename: string
  source_category: string
  observed_registration: string | null
  date_range_start: string | null
  date_range_end: string | null
  hits: SearchHit[]
}

function fmtDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" })
}

function DocumentGroupCard({
  group,
  sortBy,
  onViewPage,
}: {
  group: DocumentGroup
  sortBy: SortBy
  onViewPage: (hit: SearchHit) => void
}) {
  const categoryLabel = SOURCE_CATEGORY_LABELS[group.source_category] ?? group.source_category
  const categoryColor = CATEGORY_COLORS[group.source_category] ?? CATEGORY_COLORS.other

  const hasDate = group.date_range_start || group.date_range_end
  const dateLabel = hasDate
    ? group.date_range_start === group.date_range_end || !group.date_range_start
      ? fmtDate(group.date_range_end ?? group.date_range_start)
      : `${fmtDate(group.date_range_start)} – ${fmtDate(group.date_range_end)}`
    : null

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Document header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 border-b border-border">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate leading-tight">
            {group.original_filename}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${categoryColor}`}>
              {categoryLabel}
            </span>
            {group.observed_registration && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {group.observed_registration}
              </span>
            )}
            {dateLabel ? (
              <span className="text-[10px] text-muted-foreground">{dateLabel}</span>
            ) : sortBy === "date_desc" ? (
              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-2.5 w-2.5" />
                No date on record
              </span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {group.hits.length} {group.hits.length === 1 ? "match" : "matches"}
        </span>
      </div>

      {/* Page hits */}
      <div>
        {group.hits.map((hit) => (
          <PageHitRow key={hit.page_id} hit={hit} onViewPage={onViewPage} />
        ))}
      </div>
    </div>
  )
}

// ─── Main list ────────────────────────────────────────────────────────────────

interface Props {
  hits: SearchHit[]
  isLoading: boolean
  isError: boolean
  query: string
  page: number
  pageSize: number
  sortBy: SortBy
  onPageChange: (page: number) => void
  onViewPage: (hit: SearchHit) => void
}

export function RecordsResultsList({
  hits,
  isLoading,
  isError,
  query,
  page,
  pageSize,
  sortBy,
  onPageChange,
  onViewPage,
}: Props) {
  // Group hits by source document, preserving server sort order across groups
  const groups = useMemo<DocumentGroup[]>(() => {
    const map = new Map<string, DocumentGroup>()
    for (const hit of hits) {
      if (!map.has(hit.record_source_id)) {
        map.set(hit.record_source_id, {
          record_source_id:      hit.record_source_id,
          original_filename:     hit.original_filename,
          source_category:       hit.source_category,
          observed_registration: hit.observed_registration ?? null,
          date_range_start:      hit.date_range_start ?? null,
          date_range_end:        hit.date_range_end ?? null,
          hits: [],
        })
      }
      map.get(hit.record_source_id)!.hits.push(hit)
    }
    return Array.from(map.values())
  }, [hits])

  // ── Empty / loading / error states ───────────────────────────────────────

  if (!query || query.trim().length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          Enter a search term to begin.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border overflow-hidden animate-pulse">
            <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center gap-3">
              <div className="h-4 w-4 bg-muted rounded" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-2/3 mb-1.5" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
              <div className="h-3 bg-muted rounded w-16" />
            </div>
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
                <div className="h-3 bg-muted rounded w-8 shrink-0" />
                <div className="h-3 bg-muted rounded flex-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-destructive">Search failed. Please try again.</p>
      </div>
    )
  }

  if (hits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileSearch className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">No results found</p>
        <p className="text-xs text-muted-foreground">
          Try a different term, or check that records have finished processing.
        </p>
      </div>
    )
  }

  const hasPrev = page > 1
  const hasNext = hits.length === pageSize

  return (
    <div className="flex flex-col gap-4">
      {/* Summary line */}
      <p className="text-xs text-muted-foreground px-0.5">
        {hits.length} {hits.length === 1 ? "page" : "pages"} across{" "}
        <span className="text-foreground font-medium">{groups.length}</span>{" "}
        {groups.length === 1 ? "document" : "documents"}
        {page > 1 && ` — page ${page}`}
      </p>

      {/* Document groups */}
      {groups.map((group) => (
        <DocumentGroupCard
          key={group.record_source_id}
          group={group}
          sortBy={sortBy}
          onViewPage={onViewPage}
        />
      ))}

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => onPageChange(page - 1)}
          >
            ← Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => onPageChange(page + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}
