import { FileText, BookOpen } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import type { SearchHit } from "../types"

interface Props {
  hit: SearchHit
  onViewPage: (hit: SearchHit) => void
}

// Replace [[term]] markers from ts_headline with <mark> spans
function renderExcerpt(excerpt: string): React.ReactNode {
  const parts = excerpt.split(/(\[\[.*?\]\])/g)
  return parts.map((part, i) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      return (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-800/60 text-yellow-900 dark:text-yellow-100 rounded px-0.5"
        >
          {part.slice(2, -2)}
        </mark>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function RecordsResultCard({ hit, onViewPage }: Props) {
  const categoryLabel = SOURCE_CATEGORY_LABELS[hit.source_category] ?? hit.source_category

  return (
    <div className="group rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate" title={hit.original_filename}>
              {hit.original_filename}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">
                Page {hit.page_number}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{categoryLabel}</span>
              {hit.observed_registration && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {hit.observed_registration}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => onViewPage(hit)}
        >
          <BookOpen className="h-3.5 w-3.5" />
          View Page
        </Button>
      </div>

      {hit.ocr_excerpt && (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3 font-mono text-xs">
          …{renderExcerpt(hit.ocr_excerpt)}…
        </p>
      )}
    </div>
  )
}
