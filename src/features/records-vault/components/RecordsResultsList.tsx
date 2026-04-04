import { Search, FileSearch } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { RecordsResultCard } from "./RecordsResultCard"
import type { SearchHit } from "../types"

interface Props {
  hits: SearchHit[]
  isLoading: boolean
  isError: boolean
  query: string
  page: number
  pageSize: number
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
  onPageChange,
  onViewPage,
}: Props) {
  if (!query || query.trim().length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          Enter a search term to begin — try a part number, name, or phrase.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-2" />
            <div className="h-3 bg-muted rounded w-1/4 mb-3" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-4/5 mt-1" />
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
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground px-1">
        {hits.length === pageSize
          ? `Page ${page} — showing ${pageSize} results`
          : `${hits.length} result${hits.length !== 1 ? "s" : ""} on page ${page}`}
      </p>

      {hits.map((hit) => (
        <RecordsResultCard key={hit.page_id} hit={hit} onViewPage={onViewPage} />
      ))}

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between pt-2">
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
