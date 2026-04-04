import { useState, useMemo } from "react"
import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { useRecordSources } from "../hooks/useRecordSources"
import { useRecordsSearch } from "../hooks/useRecordsSearch"
import { RecordsSearchPanel } from "../components/RecordsSearchPanel"
import { RecordsResultsList } from "../components/RecordsResultsList"
import { RecordsPageViewer } from "../components/RecordsPageViewer"
import type { SourceCategory, SearchHit } from "../types"

const PAGE_SIZE = 25

export default function RecordsVaultSearchPage() {
  const { selectedAircraftId } = useRecordsVaultCtx()

  const [query, setQuery] = useState("")
  const [searchPage, setSearchPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<SourceCategory | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerHit, setViewerHit] = useState<SearchHit | null>(null)

  const { data: sources = [] } = useRecordSources(selectedAircraftId)

  const sourceOptions = useMemo(
    () =>
      sources
        .filter((s) => s.ingestion_status === "indexed")
        .map((s) => ({ id: s.id, original_filename: s.original_filename })),
    [sources]
  )

  const {
    data: hits = [],
    isLoading: searchLoading,
    isError: searchError,
  } = useRecordsSearch({
    query,
    aircraftId: selectedAircraftId,
    category: selectedCategory,
    sourceId: selectedSourceId,
    page: searchPage,
    pageSize: PAGE_SIZE,
  })

  function handleQueryChange(q: string) {
    setQuery(q)
    setSearchPage(1)
  }

  return (
    <div className="flex flex-1 h-full min-h-0 overflow-hidden">
      {/* Left filter panel */}
      <aside className="w-60 shrink-0 border-r border-border overflow-y-auto p-4">
        <RecordsSearchPanel
          query={query}
          onQueryChange={handleQueryChange}
          selectedCategory={selectedCategory}
          onCategoryChange={(c) => { setSelectedCategory(c); setSearchPage(1) }}
          selectedSourceId={selectedSourceId}
          onSourceChange={(id) => { setSelectedSourceId(id); setSearchPage(1) }}
          sources={sourceOptions}
        />
      </aside>

      {/* Results */}
      <main className="flex-1 min-w-0 overflow-y-auto p-6">
        <RecordsResultsList
          hits={hits}
          isLoading={searchLoading}
          isError={searchError}
          query={query}
          page={searchPage}
          pageSize={PAGE_SIZE}
          onPageChange={setSearchPage}
          onViewPage={(hit) => { setViewerHit(hit); setViewerOpen(true) }}
        />
      </main>

      <RecordsPageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        hit={viewerHit}
      />
    </div>
  )
}
