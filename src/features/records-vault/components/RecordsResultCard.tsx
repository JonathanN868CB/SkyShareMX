import { BookOpen } from "lucide-react"
import { SOURCE_CATEGORY_LABELS } from "../constants"
import type { SearchHit } from "../types"

interface Props {
  hit: SearchHit
  onViewPage: (hit: SearchHit) => void
}

const CATEGORY_COLORS: Record<string, string> = {
  logbook:      "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  work_package: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  inspection:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ad_compliance:"bg-red-500/10 text-red-600 dark:text-red-400",
  major_repair: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  other:        "bg-muted text-muted-foreground",
}

// Replace [[term]] markers from ts_headline with <mark> spans
function renderExcerpt(excerpt: string): React.ReactNode {
  const parts = excerpt.split(/(\[\[.*?\]\])/g)
  return parts.map((part, i) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      return (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-800/60 text-yellow-900 dark:text-yellow-100 rounded-sm px-0.5 not-italic font-medium"
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
  const categoryColor = CATEGORY_COLORS[hit.source_category] ?? CATEGORY_COLORS.other

  return (
    <div
      className="group rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-accent/20 transition-colors cursor-pointer"
      onClick={() => onViewPage(hit)}
    >
      <div className="flex items-stretch">
        {/* Page number tab — left edge */}
        <div className="flex flex-col items-center justify-center w-14 shrink-0 border-r border-border px-1 py-4 gap-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none">pg</span>
          <span className="text-xl font-bold text-foreground leading-none tabular-nums">
            {hit.page_number}
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground leading-tight truncate">
                {hit.original_filename}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${categoryColor}`}>
                  {categoryLabel}
                </span>
                {hit.observed_registration && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                    {hit.observed_registration}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); onViewPage(hit) }}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              Open
            </button>
          </div>

          {hit.ocr_excerpt && (
            <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {renderExcerpt(hit.ocr_excerpt)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
