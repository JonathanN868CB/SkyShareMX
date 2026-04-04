import { useState, useMemo } from "react"
import { Upload, Search as SearchIcon, FolderOpen, Activity } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { useAuth } from "@/features/auth"
import { useFleet } from "@/pages/aircraft/useFleet"
import { useRecordSources } from "../hooks/useRecordSources"
import { useRecordsSearch } from "../hooks/useRecordsSearch"
import { RecordsSearchPanel } from "./RecordsSearchPanel"
import { RecordsResultsList } from "./RecordsResultsList"
import { RecordSourcesList } from "./RecordSourcesList"
import { RecordsPageViewer } from "./RecordsPageViewer"
import { RecordsUploadModal } from "./RecordsUploadModal"
import { RecordsPipelineView } from "./RecordsPipelineView"
import { MANAGER_ROLES } from "../constants"
import type { SourceCategory, SearchHit, RecordSource } from "../types"
import type { AircraftBase } from "@/pages/aircraft/fleetData"

const PAGE_SIZE = 25

export function RecordsVaultLayout() {
  const { profile } = useAuth()
  const isManager = MANAGER_ROLES.includes(profile?.role as typeof MANAGER_ROLES[number])

  // Fleet data for aircraft scope selector
  const { data: fleetGroups = [], isLoading: fleetLoading } = useFleet()
  const allAircraft = useMemo<AircraftBase[]>(
    () => fleetGroups.flatMap((g) => g.families.flatMap((f) => f.aircraft)),
    [fleetGroups]
  )

  // Scope + filter state
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<SourceCategory | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)

  // Search state
  const [query, setQuery] = useState("")
  const [searchPage, setSearchPage] = useState(1)

  // Page viewer state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerHit, setViewerHit] = useState<SearchHit | null>(null)

  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false)

  // Source list (for Browse tab + source filter dropdown)
  const { data: sources = [], isLoading: sourcesLoading } =
    useRecordSources(selectedAircraftId)

  // Search results
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

  function handleViewPage(hit: SearchHit) {
    setViewerHit(hit)
    setViewerOpen(true)
  }

  function handleViewSource(source: RecordSource) {
    // Open the viewer with a synthetic hit pointing to page 1
    setViewerHit({
      page_id: "",
      record_source_id: source.id,
      aircraft_id: source.aircraft_id,
      page_number: 1,
      original_filename: source.original_filename,
      source_category: source.source_category,
      observed_registration: source.observed_registration,
      ocr_excerpt: "",
      rank: 0,
    })
    setViewerOpen(true)
  }

  function handleQueryChange(q: string) {
    setQuery(q)
    setSearchPage(1)
  }

  // Source options for the filter dropdown (only indexed ones are searchable)
  const sourceOptions = useMemo(
    () =>
      sources
        .filter((s) => s.ingestion_status === "indexed")
        .map((s) => ({ id: s.id, original_filename: s.original_filename })),
    [sources]
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Records Vault</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search and browse historical aircraft records
          </p>
        </div>
        {isManager && (
          <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Record
          </Button>
        )}
      </div>

      {/* Main two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel — search + filters */}
        <aside className="w-64 shrink-0 border-r border-border overflow-y-auto p-4 flex flex-col gap-2">
          <RecordsSearchPanel
            query={query}
            onQueryChange={handleQueryChange}
            selectedAircraftId={selectedAircraftId}
            onAircraftChange={(id) => {
              setSelectedAircraftId(id)
              setSelectedSourceId(null)
              setSearchPage(1)
            }}
            selectedCategory={selectedCategory}
            onCategoryChange={(c) => {
              setSelectedCategory(c)
              setSearchPage(1)
            }}
            selectedSourceId={selectedSourceId}
            onSourceChange={(id) => {
              setSelectedSourceId(id)
              setSearchPage(1)
            }}
            aircraft={allAircraft}
            sources={sourceOptions}
            isLoadingAircraft={fleetLoading}
          />
        </aside>

        {/* Center panel — Search results or Browse sources */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Tabs defaultValue="search" className="h-full flex flex-col">
            <div className="px-5 pt-4 pb-0 border-b border-border shrink-0">
              <TabsList className="h-8">
                <TabsTrigger value="search" className="text-xs gap-1.5">
                  <SearchIcon className="h-3.5 w-3.5" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="browse" className="text-xs gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Browse Sources
                  {sources.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {sources.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="text-xs gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Pipeline
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="search" className="flex-1 overflow-y-auto p-5 mt-0">
              <RecordsResultsList
                hits={hits}
                isLoading={searchLoading}
                isError={searchError}
                query={query}
                page={searchPage}
                pageSize={PAGE_SIZE}
                onPageChange={setSearchPage}
                onViewPage={handleViewPage}
              />
            </TabsContent>

            <TabsContent value="browse" className="flex-1 overflow-y-auto p-5 mt-0">
              <RecordSourcesList
                sources={sources}
                isLoading={sourcesLoading}
                onViewSource={handleViewSource}
              />
            </TabsContent>

            <TabsContent value="pipeline" className="flex-1 overflow-y-auto p-5 mt-0">
              <RecordsPipelineView aircraftId={selectedAircraftId} />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Page viewer modal */}
      <RecordsPageViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        hit={viewerHit}
      />

      {/* Upload modal */}
      <RecordsUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        aircraft={allAircraft}
        defaultAircraftId={selectedAircraftId}
      />
    </div>
  )
}
