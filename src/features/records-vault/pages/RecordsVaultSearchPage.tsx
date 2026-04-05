import { useState, useMemo } from "react"
import { Search, X, ArrowDownUp, Clock } from "lucide-react"
import { Input } from "@/shared/ui/input"
import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { useRecordSources } from "../hooks/useRecordSources"
import { useRecordsSearch } from "../hooks/useRecordsSearch"
import { RecordsResultsList } from "../components/RecordsResultsList"
import { RecordsPageViewer } from "../components/RecordsPageViewer"
import type { SourceCategory, SearchHit } from "../types"
import type { SortBy } from "../hooks/useRecordsSearch"

const PAGE_SIZE = 25

const CATEGORY_FILTERS: Array<{ value: SourceCategory | "all"; label: string }> = [
  { value: "all",          label: "All" },
  { value: "logbook",      label: "Logbook" },
  { value: "work_package", label: "Work Package" },
  { value: "inspection",   label: "Inspection" },
  { value: "ad_compliance",label: "AD Compliance" },
  { value: "major_repair", label: "Major Repair" },
  { value: "other",        label: "Other" },
]

export default function RecordsVaultSearchPage() {
  const { selectedAircraftId } = useRecordsVaultCtx()

  const [query, setQuery]               = useState("")
  const [searchPage, setSearchPage]     = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<SourceCategory | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [sortBy, setSortBy]             = useState<SortBy>("relevance")

  const [viewerOpen, setViewerOpen]   = useState(false)
  const [viewerHits, setViewerHits]   = useState<SearchHit[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)

  const { data: sources = [] } = useRecordSources(selectedAircraftId)

  const sourceOptions = useMemo(
    () =>
      sources
        .filter((s) => s.ingestion_status === "indexed")
        .map((s) => ({ id: s.id, original_filename: s.original_filename })),
    [sources]
  )

  const { data: hits = [], isLoading: searchLoading, isError: searchError } =
    useRecordsSearch({
      query,
      aircraftId: selectedAircraftId,
      category: selectedCategory,
      sourceId: selectedSourceId,
      sortBy,
      page: searchPage,
      pageSize: PAGE_SIZE,
    })

  function handleQueryChange(q: string) {
    setQuery(q)
    setSearchPage(1)
  }

  function handleSortChange(s: SortBy) {
    setSortBy(s)
    setSearchPage(1)
  }

  function handleViewPage(hit: SearchHit) {
    // Collect all hits for this document and open the viewer at the clicked hit
    const docHits = hits.filter((h) => h.record_source_id === hit.record_source_id)
    const index = docHits.findIndex((h) => h.page_id === hit.page_id)
    setViewerHits(docHits)
    setViewerIndex(Math.max(0, index))
    setViewerOpen(true)
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* ── Search bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-5 pb-3 border-b border-border">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 pr-9 h-10"
            placeholder="Part numbers, dates, names, tail numbers, handwriting…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => { handleQueryChange(""); setSelectedCategory(null); setSelectedSourceId(null) }}
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter + sort row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* Category pills */}
          {CATEGORY_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setSelectedCategory(value === "all" ? null : value as SourceCategory); setSearchPage(1) }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                (value === "all" && !selectedCategory) || selectedCategory === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {label}
            </button>
          ))}

          {/* Source document filter */}
          {sourceOptions.length > 0 && (
            <>
              <span className="text-muted-foreground/40 text-xs mx-1">|</span>
              <select
                value={selectedSourceId ?? "all"}
                onChange={(e) => { setSelectedSourceId(e.target.value === "all" ? null : e.target.value); setSearchPage(1) }}
                className="h-7 px-2 rounded-full text-xs bg-muted text-muted-foreground border-0 outline-none cursor-pointer"
              >
                <option value="all">All documents</option>
                {sourceOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.original_filename}</option>
                ))}
              </select>
            </>
          )}

          {/* Sort toggle — only shown when there are results */}
          {hits.length > 0 && (
            <div className="ml-auto flex items-center gap-1 rounded-full bg-muted p-0.5">
              <button
                onClick={() => handleSortChange("relevance")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortBy === "relevance"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowDownUp className="h-3 w-3" />
                Relevance
              </button>
              <button
                onClick={() => handleSortChange("date_desc")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortBy === "date_desc"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="h-3 w-3" />
                Newest first
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <RecordsResultsList
          hits={hits}
          isLoading={searchLoading}
          isError={searchError}
          query={query}
          page={searchPage}
          pageSize={PAGE_SIZE}
          sortBy={sortBy}
          onPageChange={setSearchPage}
          onViewPage={handleViewPage}
        />
      </main>

      <RecordsPageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        hits={viewerHits}
        hitIndex={viewerIndex}
        query={query}
      />
    </div>
  )
}
