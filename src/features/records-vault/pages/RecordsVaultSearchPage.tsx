import { useState, useMemo, useEffect } from "react"
import {
  Search, X, ArrowDownUp, Clock,
  AlertCircle, Loader2, FolderOpen, Globe, Plane, Pencil,
  ChevronDown, ChevronRight,
} from "lucide-react"
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, rectSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/shared/lib/utils"
import { Input } from "@/shared/ui/input"
import { supabase } from "@/lib/supabase"
import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { useRecordSources } from "../hooks/useRecordSources"
import { useRecordsSearch } from "../hooks/useRecordsSearch"
import { RecordsResultsList } from "../components/RecordsResultsList"
import { RecordsVaultViewer } from "../components/RecordsVaultViewer"
import { LabelEditModal } from "../components/LabelEditModal"
import type { SourceCategory, SearchHit, RecordSource } from "../types"
import type { SortBy } from "../hooks/useRecordsSearch"
import type { AircraftBase } from "@/pages/aircraft/fleetData"

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

const CATEGORY_BORDER: Record<string, string> = {
  logbook:      "border-l-blue-500",
  work_package: "border-l-purple-500",
  inspection:   "border-l-amber-500",
  ad_compliance:"border-l-red-500",
  major_repair: "border-l-orange-500",
  other:        "border-l-border",
}

// Book spine colors — actual hex so we can drive inline inset-shadow spines
const CATEGORY_SPINE: Record<string, string> = {
  logbook:      "#3b82f6",
  work_package: "#a855f7",
  inspection:   "#f59e0b",
  ad_compliance:"#ef4444",
  major_repair: "#f97316",
  other:        "#6b7280",
}

// ─── Aircraft filter pane ────────────────────────────────────────────────────

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({ sources }: { sources: RecordSource[] }) {
  if (sources.length === 0) return null
  const indexed    = sources.filter((s) => s.ingestion_status === "indexed")
  const processing = sources.filter((s) => s.ingestion_status === "extracting" || s.ingestion_status === "pending")
  const failed     = sources.filter((s) => s.ingestion_status === "failed")
  const totalPages = indexed.reduce((sum, s) => sum + (s.page_count ?? 0), 0)

  return (
    <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-muted/20 text-xs text-muted-foreground shrink-0">
      <span className="font-medium text-foreground">{indexed.length}</span>
      <span>{indexed.length === 1 ? "document" : "documents"}</span>
      <span className="text-muted-foreground/30">·</span>
      <span><span className="font-medium text-foreground">{totalPages.toLocaleString()}</span> pages searchable</span>
      {processing.length > 0 && (
        <>
          <span className="text-muted-foreground/30">·</span>
          <span className="flex items-center gap-1.5 text-blue-500">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
            {processing.length} processing
          </span>
        </>
      )}
      {failed.length > 0 && (
        <>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-destructive">{failed.length} failed</span>
        </>
      )}
    </div>
  )
}

// ─── Document card (shown when not searching) ─────────────────────────────────

function fmtMY(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString([], { month: "short", year: "numeric" })
}

function fmtCoverDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
}

const COMPONENT_LABELS: Record<string, string> = {
  airframe:  "Airframe",
  engine:    "Engine",
  propeller: "Propeller",
}

function DocumentCard({
  source,
  onOpen,
  onEdit,
}: {
  source: RecordSource
  onOpen: () => void
  onEdit: () => void
}) {
  const isIndexed    = source.ingestion_status === "indexed"
  const isProcessing = source.ingestion_status === "extracting"
  const isFailed     = source.ingestion_status === "failed"
  const isPending    = source.ingestion_status === "pending"

  const spineColor = CATEGORY_SPINE[source.source_category] ?? CATEGORY_SPINE.other

  const v = source as RecordSource & { verification_status?: string }

  const label = source.display_label
  const hasLabel = !!label && (label.registration || label.serial || label.component || label.logbook_number || label.date_start || label.date_end)

  const dateStart = fmtCoverDate(label?.date_start ?? source.date_range_start)
  const dateEnd   = fmtCoverDate(label?.date_end   ?? source.date_range_end)
  const hasDateRange = !!dateStart && !!dateEnd && dateStart !== dateEnd
  const singleDate   = !hasDateRange ? (dateStart ?? dateEnd ?? null) : null

  return (
    <div
      className={cn(
        "group relative aspect-square mx-auto rounded-md overflow-hidden",
        "bg-card transition-all duration-150",
        isIndexed ? "hover:-translate-y-0.5" : "opacity-70"
      )}
      style={{
        width:    "calc(100% - 10px)",
        boxShadow: [
          `inset 7px 0 0 0 ${spineColor}`,
          "inset 8px 0 5px -3px rgba(0,0,0,0.45)",
          "inset -2px 0 0 0 rgba(0,0,0,0.18)",
          "0 2px 6px rgba(0,0,0,0.18)",
        ].join(", "),
      }}
    >
      {/* Page-edge gradient on the right */}
      <div
        className="absolute top-1.5 right-0 bottom-1.5 w-[4px] pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.04))" }}
      />

      {/* Click target — the full cover opens the viewer */}
      <button
        onClick={isIndexed ? onOpen : undefined}
        disabled={!isIndexed}
        title={source.original_filename}
        className={cn(
          "absolute inset-0 text-left",
          isIndexed ? "cursor-pointer" : "cursor-default"
        )}
      />

      {/* Edit pencil + status dot — absolute so they don't reserve row space */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 pointer-events-auto z-10">
        {isIndexed && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-opacity"
            title="Edit label"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        <span className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          isIndexed && v.verification_status === "verified" && "bg-green-500",
          isIndexed && v.verification_status === "partial"  && "bg-yellow-500",
          isFailed   && "bg-red-500",
          isProcessing && "bg-blue-500 animate-pulse",
          isPending    && "bg-muted-foreground/30",
        )} />
      </div>

      {/* Content overlay — pointer-events: none so the button behind catches clicks */}
      <div className="relative pl-4 pr-2.5 pt-3 pb-2.5 h-full flex flex-col items-center text-center pointer-events-none">
        {hasLabel ? (
          <>
            {label?.registration && (
              <p
                className="text-3xl font-bold text-foreground leading-none tracking-wide break-words"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
              >
                {label.registration}
              </p>
            )}
            {label?.serial && (
              <p className="text-[12px] font-mono text-muted-foreground leading-tight break-all mt-1.5">
                S/N {label.serial}
              </p>
            )}
            {label?.component && (
              <p
                className="text-[11px] uppercase text-muted-foreground/90 leading-tight mt-1"
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.18em" }}
              >
                {COMPONENT_LABELS[label.component]}
              </p>
            )}
            {label?.logbook_number && (
              <p
                className="text-[11px] uppercase text-muted-foreground/90 leading-tight mt-0.5"
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.18em" }}
              >
                {label.logbook_number}
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] font-medium text-foreground leading-snug line-clamp-5 break-words mt-1">
            {source.original_filename}
          </p>
        )}

        {/* Bottom: stacked dates */}
        <div className="flex flex-col items-center gap-0.5 mt-auto">
          {hasDateRange ? (
            <>
              <span
                className="text-[10px] font-semibold text-foreground/80 text-center truncate max-w-full"
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
              >
                {dateStart}
              </span>
              <span
                className="text-[10px] font-semibold text-foreground/80 text-center truncate max-w-full"
                style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
              >
                {dateEnd}
              </span>
            </>
          ) : singleDate ? (
            <span
              className="text-[10px] font-semibold text-foreground/80 text-center truncate max-w-full"
              style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
            >
              {singleDate}
            </span>
          ) : source.page_count && isIndexed ? (
            <span className="text-[10px] text-muted-foreground tabular-nums">{source.page_count} pp</span>
          ) : null}

          {isProcessing && (
            <div className="flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 text-blue-500 animate-spin" />
              <span className="text-[10px] text-blue-500">Indexing…</span>
            </div>
          )}
          {isPending && (
            <span className="text-[10px] text-muted-foreground">Queued</span>
          )}
          {isFailed && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5 text-destructive shrink-0" />
              <span className="text-[10px] text-destructive truncate">Failed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sortable card wrapper ────────────────────────────────────────────────────

function SortableDocumentCard({
  source, onOpen, onEdit,
}: { source: RecordSource; onOpen: () => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: source.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition,
        opacity:    isDragging ? 0.45 : 1,
        zIndex:     isDragging ? 50 : undefined,
        cursor:     isDragging ? "grabbing" : "grab",
      }}
      {...attributes}
      {...listeners}
    >
      <DocumentCard source={source} onOpen={onOpen} onEdit={onEdit} />
    </div>
  )
}

// ─── Document grid (idle state) ───────────────────────────────────────────────

const GRID_COLS = "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"

function TailSection({
  tail,
  sources,
  categoryFilter,
  onOpen,
  onEdit,
  onReorder,
}: {
  tail: string
  sources: RecordSource[]
  categoryFilter: SourceCategory | null
  onOpen: (source: RecordSource) => void
  onEdit: (source: RecordSource) => void
  onReorder: (ordered: RecordSource[]) => void
}) {
  const [expanded, setExpanded] = useState(true)

  const filtered = categoryFilter
    ? sources.filter((s) => s.source_category === categoryFilter)
    : sources

  const [items, setItems] = useState<RecordSource[]>(filtered)
  const filteredKey = filtered.map((s) => s.id).join(",")
  useEffect(() => { setItems(filtered) }, [filteredKey]) // eslint-disable-line

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((s) => s.id === active.id)
    const newIdx = items.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    setItems(reordered)
    onReorder(reordered)
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span
          className="text-xs font-semibold tracking-wider uppercase text-foreground"
          style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.15em" }}
        >
          {tail}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">
          {filtered.length} {filtered.length === 1 ? "document" : "documents"}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-border">
          {categoryFilter ? (
            <div className={`grid ${GRID_COLS} gap-3`}>
              {filtered.map((source) => (
                <DocumentCard
                  key={source.id}
                  source={source}
                  onOpen={() => onOpen(source)}
                  onEdit={() => onEdit(source)}
                />
              ))}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
                <div className={`grid ${GRID_COLS} gap-3`}>
                  {items.map((source) => (
                    <SortableDocumentCard
                      key={source.id}
                      source={source}
                      onOpen={() => onOpen(source)}
                      onEdit={() => onEdit(source)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  )
}

function DocumentGrid({
  sources,
  isLoading,
  categoryFilter,
  allAircraft,
  onOpen,
  onEdit,
  onReorder,
}: {
  sources: RecordSource[]
  isLoading: boolean
  categoryFilter: SourceCategory | null
  allAircraft: { id: string; tailNumber: string }[]
  onOpen: (source: RecordSource) => void
  onEdit: (source: RecordSource) => void
  onReorder: (ordered: RecordSource[]) => void
}) {
  const filtered = categoryFilter
    ? sources.filter((s) => s.source_category === categoryFilter)
    : sources

  // Local order state — initialise from filtered, reset if source set changes
  const [items, setItems] = useState<RecordSource[]>(filtered)
  const filteredKey = filtered.map((s) => s.id).join(",")
  useEffect(() => { setItems(filtered) }, [filteredKey]) // eslint-disable-line

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((s) => s.id === active.id)
    const newIdx = items.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    setItems(reordered)
    onReorder(reordered)
  }

  if (isLoading) {
    return (
      <div className={`grid ${GRID_COLS} gap-3`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-md bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FolderOpen className="h-10 w-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">
          {sources.length === 0 ? "No records yet" : "No documents in this category"}
        </p>
        <p className="text-xs text-muted-foreground">
          {sources.length === 0
            ? "Upload a PDF to get started."
            : "Try a different category filter."}
        </p>
      </div>
    )
  }

  // Group by aircraft with collapsible bars (always, even for a single tail)
  const uniqueAircraftIds = Array.from(new Set(sources.map((s) => s.aircraft_id))).filter(Boolean)
  if (uniqueAircraftIds.length >= 1) {
    const byAircraft = new Map<string, RecordSource[]>()
    for (const s of sources) {
      if (!byAircraft.has(s.aircraft_id)) byAircraft.set(s.aircraft_id, [])
      byAircraft.get(s.aircraft_id)!.push(s)
    }
    const sortedIds = Array.from(byAircraft.keys()).sort((a, b) => {
      const ta = allAircraft.find((ac) => ac.id === a)?.tailNumber ?? a
      const tb = allAircraft.find((ac) => ac.id === b)?.tailNumber ?? b
      return ta.localeCompare(tb)
    })
    return (
      <div className="space-y-3">
        {sortedIds.map((aircraftId) => {
          const tail = allAircraft.find((ac) => ac.id === aircraftId)?.tailNumber ?? aircraftId
          const acSources = byAircraft.get(aircraftId) ?? []
          return (
            <TailSection
              key={aircraftId}
              tail={tail}
              sources={acSources}
              categoryFilter={categoryFilter}
              onOpen={onOpen}
              onEdit={onEdit}
              onReorder={onReorder}
            />
          )
        })}
      </div>
    )
  }

  // Single-aircraft view: flat grid with drag-and-drop
  if (categoryFilter) {
    return (
      <div className={`grid ${GRID_COLS} gap-3`}>
        {filtered.map((source) => (
          <DocumentCard
            key={source.id}
            source={source}
            onOpen={() => onOpen(source)}
            onEdit={() => onEdit(source)}
          />
        ))}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div className={`grid ${GRID_COLS} gap-3`}>
          {items.map((source) => (
            <SortableDocumentCard
              key={source.id}
              source={source}
              onOpen={() => onOpen(source)}
              onEdit={() => onEdit(source)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecordsVaultSearchPage() {
  const {
    selectedAircraftId, allAircraft,
    setSearchAircraftGroups,
    selectedAircraftFilter, setSelectedAircraftFilter,
  } = useRecordsVaultCtx()

  const [query, setQuery]               = useState("")
  const [searchPage, setSearchPage]     = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<SourceCategory | null>(null)
  const [sortBy, setSortBy]             = useState<SortBy>("relevance")
  const [fleetWide, setFleetWide]       = useState(false)

  // Determine search scope: fleet-wide or aircraft-scoped
  const searchAircraftId = fleetWide ? null : selectedAircraftId
  const currentAircraft = allAircraft.find((a) => a.id === selectedAircraftId)

  const [viewerOpen, setViewerOpen]       = useState(false)
  const [viewerHits, setViewerHits]       = useState<SearchHit[]>([])
  const [viewerIndex, setViewerIndex]     = useState(0)
  const [viewerQuery, setViewerQuery]     = useState("")
  const [viewerTotalPages, setViewerTotalPages] = useState(1)

  // Book filter (top pills) — null = all books; string = specific record_source_id
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)

  const [editingSource, setEditingSource] = useState<RecordSource | null>(null)

  const { data: sources = [], isLoading: sourcesLoading } = useRecordSources(selectedAircraftId)

  const { data: hits = [], isLoading: searchLoading, isError: searchError } =
    useRecordsSearch({
      query,
      aircraftId: searchAircraftId,
      category: selectedCategory,
      sourceId: null,
      sortBy,
      page: searchPage,
      pageSize: PAGE_SIZE,
    })

  const isSearchActive = query.trim().length >= 2

  // Category pills — only show categories that actually exist in sources
  const activeCategories = useMemo(
    () => CATEGORY_FILTERS.filter(
      (f) => f.value === "all" || sources.some((s) => s.source_category === f.value)
    ),
    [sources]
  )

  // Aircraft filter pane — one row per aircraft that has search hits
  const aircraftGroups = useMemo<Array<{ id: string; tailNumber: string; serialNumber: string; count: number }>>(() => {
    if (!isSearchActive || hits.length === 0) return []
    const seen = new Map<string, { tailNumber: string; serialNumber: string; count: number }>()
    for (const hit of hits) {
      if (!seen.has(hit.aircraft_id)) {
        const ac = allAircraft.find((a) => a.id === hit.aircraft_id)
        seen.set(hit.aircraft_id, {
          tailNumber:   ac?.tailNumber   ?? hit.observed_registration ?? "Unknown",
          serialNumber: ac?.serialNumber ?? "—",
          count: 0,
        })
      }
      seen.get(hit.aircraft_id)!.count++
    }
    return Array.from(seen.entries()).map(([id, v]) => ({ id, ...v }))
  }, [hits, allAircraft, isSearchActive])

  // Sync aircraft groups to context so the sidebar can display them.
  useEffect(() => {
    setSearchAircraftGroups(aircraftGroups)
  }, [aircraftGroups]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear on unmount so the list doesn't linger on other pages (e.g. Pipeline).
  useEffect(() => {
    return () => { setSearchAircraftGroups([]) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset book filter when aircraft filter changes (sidebar-driven)
  useEffect(() => {
    setSelectedBookId(null)
  }, [selectedAircraftFilter])

  // Book filter pills — ordered list of docs found in search results, with hit counts.
  // When an aircraft is selected in the left pane, only show that aircraft's books.
  const bookGroups = useMemo<Array<{ id: string; label: string; category: string; count: number }>>(() => {
    if (!isSearchActive || hits.length === 0) return []
    const relevantHits = selectedAircraftFilter
      ? hits.filter((h) => h.aircraft_id === selectedAircraftFilter)
      : hits
    const seen = new Map<string, { label: string; category: string; count: number }>()
    for (const hit of relevantHits) {
      if (!seen.has(hit.record_source_id)) {
        const source = sources.find((s) => s.id === hit.record_source_id)
        const dl = source?.display_label
        let label = hit.original_filename
        if (dl) {
          const parts = [dl.registration, dl.logbook_number].filter(Boolean)
          if (parts.length > 0) label = parts.join(" · ")
        } else if (hit.observed_registration) {
          label = hit.observed_registration
        }
        seen.set(hit.record_source_id, { label, category: hit.source_category, count: 0 })
      }
      seen.get(hit.record_source_id)!.count++
    }
    return Array.from(seen.entries()).map(([id, v]) => ({ id, ...v }))
  }, [hits, sources, isSearchActive, selectedAircraftFilter])

  const showBookPills = bookGroups.length >= 2

  function handleQueryChange(q: string) {
    setQuery(q)
    setSearchPage(1)
    setSelectedAircraftFilter(null)
    setSelectedBookId(null)
    // Close viewer so the user can see updated results and click one
    if (viewerOpen) setViewerOpen(false)
  }

  function handleSortChange(s: SortBy) {
    setSortBy(s)
    setSearchPage(1)
    setSelectedAircraftFilter(null)
    setSelectedBookId(null)
  }

  // Open viewer from a search hit.
  // Scope the viewer's hit list based on the active aircraft/book filters:
  //   - specific book selected → only that book's hits
  //   - specific aircraft selected → all that aircraft's hits (cross-book within aircraft)
  //   - nothing selected → full fleet result set (full cross-aircraft traversal)
  function handleViewHit(hit: SearchHit) {
    let filteredHits = hits
    if (selectedBookId) {
      filteredHits = hits.filter((h) => h.record_source_id === selectedBookId)
    } else if (selectedAircraftFilter) {
      filteredHits = hits.filter((h) => h.aircraft_id === selectedAircraftFilter)
    }
    const index     = filteredHits.findIndex((h) => h.page_id === hit.page_id)
    const source    = sources.find((s) => s.id === hit.record_source_id)
    const isSingleDoc = filteredHits.every((h) => h.record_source_id === filteredHits[0]?.record_source_id)
    setViewerHits(filteredHits)
    setViewerIndex(Math.max(0, index))
    setViewerQuery(query)
    // For a single-book result pass exact page count; for multi-doc pass 0 so
    // the viewer derives effectiveTotalPages from source.page_count per document.
    setViewerTotalPages(isSingleDoc ? (source?.page_count ?? 1) : 0)
    setViewerOpen(true)
  }

  // Persist a reordered document grid to rv_record_sources.sort_order
  async function handleReorder(ordered: RecordSource[]) {
    await Promise.all(
      ordered.map((s, i) =>
        supabase.from("rv_record_sources").update({ sort_order: i }).eq("id", s.id)
      )
    )
  }

  // Open viewer from a document card (no search context — page 1)
  function handleOpenSource(source: RecordSource) {
    const syntheticHit: SearchHit = {
      page_id:               source.id,
      record_source_id:      source.id,
      aircraft_id:           source.aircraft_id,
      page_number:           1,
      original_filename:     source.original_filename,
      source_category:       source.source_category,
      observed_registration: source.observed_registration,
      date_range_start:      source.date_range_start,
      date_range_end:        source.date_range_end,
      ocr_excerpt:           "",
      rank:                  0,
    }
    setViewerHits([syntheticHit])
    setViewerIndex(0)
    setViewerQuery("")
    setViewerTotalPages(source.page_count ?? 1)
    setViewerOpen(true)
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-5 pb-3 border-b border-border">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 pr-9 h-10"
            placeholder="Search part numbers, dates, names, tail numbers…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => { handleQueryChange(""); setSelectedCategory(null) }}
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter row — scope toggle + category pills + book pills + sort toggle (no wrap) */}
        <div className="flex items-center gap-2 mt-3">
          {/* Fleet scope toggle */}
          {selectedAircraftId && (
            <div className="flex items-center rounded-full bg-muted p-0.5 mr-1 shrink-0">
              <button
                onClick={() => { setFleetWide(false); setSearchPage(1); setSelectedAircraftFilter(null); setSelectedBookId(null) }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  !fleetWide
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={currentAircraft?.tailNumber ? `Search ${currentAircraft.tailNumber} only` : "This aircraft"}
              >
                <Plane className="h-3 w-3" />
                {currentAircraft?.tailNumber ?? "Aircraft"}
              </button>
              <button
                onClick={() => { setFleetWide(true); setSearchPage(1); setSelectedAircraftFilter(null); setSelectedBookId(null) }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  fleetWide
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Search all aircraft"
              >
                <Globe className="h-3 w-3" />
                Fleet
              </button>
            </div>
          )}

          {activeCategories.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setSelectedCategory(value === "all" ? null : value as SourceCategory); setSearchPage(1); setSelectedAircraftFilter(null); setSelectedBookId(null) }}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                (value === "all" && !selectedCategory) || selectedCategory === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {label}
            </button>
          ))}

          {/* Book filter pills — scrollable strip, no wrapping */}
          {showBookPills && (
            <>
              <span className="w-px h-4 bg-border self-center shrink-0" />

              {/* Scrollable pill row — hides scrollbar but stays single-line */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button
                  onClick={() => setSelectedBookId(null)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    !selectedBookId
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  All Books · {hits.length}
                </button>

                {bookGroups.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => setSelectedBookId(book.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedBookId === book.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    title={book.label}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: CATEGORY_SPINE[book.category] ?? "#6b7280" }}
                    />
                    <span className="whitespace-nowrap">{book.label}</span>
                    <span className={`shrink-0 tabular-nums ${selectedBookId === book.id ? "opacity-80" : "opacity-55"}`}>
                      · {book.count}
                    </span>
                  </button>
                ))}
              </div>

              <span className="w-px h-4 bg-border self-center shrink-0" />
            </>
          )}

          {/* Sort toggle — only shown in search mode with results */}
          {isSearchActive && hits.length > 0 && (
            <div className={`shrink-0 flex items-center gap-1 rounded-full bg-muted p-0.5 ${!showBookPills ? "ml-auto" : ""}`}>
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

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {viewerOpen ? (
        /* Viewer mode — inline, replaces content but search bar stays */
        <RecordsVaultViewer
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          hits={viewerHits}
          hitIndex={viewerIndex}
          query={viewerQuery}
          totalPages={viewerTotalPages}
        />
      ) : (
        <>
          {/* Stats strip */}
          {!isSearchActive && <StatsStrip sources={sources} />}

          <main className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {isSearchActive ? (() => {
              // Apply aircraft then book filter for the displayed list
              let displayHits = hits
              if (selectedAircraftFilter) displayHits = displayHits.filter((h) => h.aircraft_id === selectedAircraftFilter)
              if (selectedBookId)         displayHits = displayHits.filter((h) => h.record_source_id === selectedBookId)
              return (
                <RecordsResultsList
                  hits={displayHits}
                  isLoading={searchLoading}
                  isError={searchError}
                  query={query}
                  page={searchPage}
                  pageSize={PAGE_SIZE}
                  sortBy={sortBy}
                  onPageChange={setSearchPage}
                  onViewPage={handleViewHit}
                />
              )
            })() : (
              /* Gallery mode — document cards */
              <>
                <DocumentGrid
                  sources={sources}
                  isLoading={sourcesLoading}
                  categoryFilter={selectedCategory}
                  allAircraft={allAircraft}
                  onOpen={handleOpenSource}
                  onEdit={setEditingSource}
                  onReorder={handleReorder}
                />
              </>
            )}
          </main>
        </>
      )}

      {editingSource && (
        <LabelEditModal
          source={editingSource}
          onClose={() => setEditingSource(null)}
          aircraftId={selectedAircraftId}
        />
      )}
    </div>
  )
}
