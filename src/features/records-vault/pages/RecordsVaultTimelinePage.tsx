import { useState } from "react"
import {
  Loader2, Search, Filter, Calendar, Clock, Wrench,
  ShieldCheck, Package, AlertTriangle, FileCheck, RotateCcw,
  ChevronDown, ChevronUp, ExternalLink, FolderOpen,
} from "lucide-react"
import { useRecordsVaultCtx } from "../RecordsVaultApp"
import { useTimeline } from "../hooks/useTimeline"
import { useRecordSources } from "../hooks/useRecordSources"
import { RecordsVaultViewer } from "../components/RecordsVaultViewer"
import type { MaintenanceEvent, EventType, SearchHit, SourceCategory } from "../types"

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  EventType | string,
  { label: string; icon: React.FC<{ className?: string }>; colour: string; dotColour: string }
> = {
  logbook_entry:    { label: "Logbook Entry",       icon: FileCheck,   colour: "text-sky-600 dark:text-sky-400",      dotColour: "bg-sky-500"    },
  inspection:       { label: "Inspection",           icon: ShieldCheck, colour: "text-amber-600 dark:text-amber-400",  dotColour: "bg-amber-500"  },
  ad_compliance:    { label: "AD Compliance",        icon: AlertTriangle,colour:"text-red-600 dark:text-red-400",      dotColour: "bg-red-500"    },
  sb_compliance:    { label: "SB Compliance",        icon: ShieldCheck, colour: "text-orange-600 dark:text-orange-400",dotColour: "bg-orange-500" },
  component_install:{ label: "Component Install",    icon: Package,     colour: "text-green-600 dark:text-green-400",  dotColour: "bg-green-500"  },
  component_removal:{ label: "Component Removal",    icon: Package,     colour: "text-slate-600 dark:text-slate-400",  dotColour: "bg-slate-500"  },
  repair:           { label: "Repair",               icon: Wrench,      colour: "text-purple-600 dark:text-purple-400",dotColour: "bg-purple-500" },
  alteration:       { label: "Alteration",           icon: Wrench,      colour: "text-fuchsia-600 dark:text-fuchsia-400",dotColour:"bg-fuchsia-500"},
  overhaul:         { label: "Overhaul",             icon: RotateCcw,   colour: "text-indigo-600 dark:text-indigo-400",dotColour: "bg-indigo-500" },
  return_to_service:{ label: "Return to Service",    icon: FileCheck,   colour: "text-teal-600 dark:text-teal-400",    dotColour: "bg-teal-500"   },
  discrepancy:      { label: "Discrepancy",          icon: AlertTriangle,colour:"text-rose-600 dark:text-rose-400",    dotColour: "bg-rose-500"   },
  other:            { label: "Other",                icon: FileCheck,   colour: "text-muted-foreground",               dotColour: "bg-muted-foreground"},
}

const EVENT_TYPE_FILTERS: Array<{ value: EventType | "all"; label: string }> = [
  { value: "all",              label: "All" },
  { value: "logbook_entry",    label: "Logbook" },
  { value: "inspection",       label: "Inspection" },
  { value: "ad_compliance",    label: "AD" },
  { value: "sb_compliance",    label: "SB" },
  { value: "component_install",label: "Install" },
  { value: "component_removal",label: "Removal" },
  { value: "repair",           label: "Repair" },
  { value: "overhaul",         label: "Overhaul" },
]

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  onViewSource,
}: {
  event: MaintenanceEvent
  onViewSource: (event: MaintenanceEvent) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = EVENT_CONFIG[event.event_type] ?? EVENT_CONFIG.other
  const Icon = cfg.icon

  function fmtDate(iso: string | null) {
    if (!iso) return "Date unknown"
    return new Date(iso + "T12:00:00").toLocaleDateString([], {
      day: "numeric", month: "short", year: "numeric",
    })
  }

  const hasDetails =
    (event.part_numbers?.length ?? 0) > 0 ||
    (event.serial_numbers?.length ?? 0) > 0 ||
    event.work_order_number ||
    event.ad_sb_number ||
    event.performed_by ||
    event.approved_by ||
    event.station

  return (
    <div className="group relative pl-8">
      {/* Timeline dot */}
      <div className={`absolute left-0 top-3.5 w-3 h-3 rounded-full border-2 border-background ${cfg.dotColour} z-10`} />

      <div className="border border-border rounded-md bg-card hover:border-border/80 hover:shadow-sm transition-all duration-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3">
          <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.colour}`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground leading-snug">{event.description}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {event.confidence != null && event.confidence < 0.6 && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                    Low confidence
                  </span>
                )}
                <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted ${cfg.colour}`}>
                  {cfg.label}
                </span>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fmtDate(event.event_date)}
              </span>
              {event.aircraft_total_time != null && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {event.aircraft_total_time.toFixed(1)} TT
                </span>
              )}
              {event.work_order_number && (
                <span className="text-xs text-muted-foreground">WO {event.work_order_number}</span>
              )}
              {event.ad_sb_number && (
                <span className="text-xs font-medium text-red-600 dark:text-red-400">{event.ad_sb_number}</span>
              )}
            </div>

            {/* Source doc */}
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={() => onViewSource(event)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{event.original_filename}</span>
              </button>
            </div>
          </div>

          {/* Expand button */}
          {hasDetails && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1 rounded hover:bg-muted transition-colors shrink-0"
            >
              {expanded
                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </button>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && hasDetails && (
          <div className="border-t border-border bg-muted/20 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2">
            {(event.part_numbers?.length ?? 0) > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Part Numbers</p>
                <p className="text-xs text-foreground font-mono">{event.part_numbers.join(", ")}</p>
              </div>
            )}
            {(event.serial_numbers?.length ?? 0) > 0 && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Serial Numbers</p>
                <p className="text-xs text-foreground font-mono">{event.serial_numbers.join(", ")}</p>
              </div>
            )}
            {event.performed_by && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Performed By</p>
                <p className="text-xs text-foreground">{event.performed_by}</p>
              </div>
            )}
            {event.approved_by && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Approved By</p>
                <p className="text-xs text-foreground">{event.approved_by}</p>
              </div>
            )}
            {event.station && (
              <div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Station</p>
                <p className="text-xs text-foreground">{event.station}</p>
              </div>
            )}
            {event.extraction_notes && (
              <div className="col-span-2">
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Extraction Note</p>
                <p className="text-xs text-muted-foreground italic">{event.extraction_notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecordsVaultTimelinePage() {
  const { selectedAircraftId } = useRecordsVaultCtx()

  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerHits, setViewerHits] = useState<SearchHit[]>([])
  const [viewerTotalPages, setViewerTotalPages] = useState(1)

  const { data: sources = [] } = useRecordSources(selectedAircraftId)

  const { data, isLoading } = useTimeline({
    aircraftId:  selectedAircraftId,
    eventType:   eventTypeFilter === "all" ? null : eventTypeFilter,
    query:       debouncedQuery || undefined,
    limit:       100,
  })

  const events = data?.events ?? []
  const total  = data?.total ?? 0

  // Debounce search
  const handleSearch = (val: string) => {
    setSearchQuery(val)
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t)
    ;(handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
      setDebouncedQuery(val)
    }, 300)
  }

  function openViewerForEvent(event: MaintenanceEvent) {
    const source = sources.find((s) => s.id === event.record_source_id)
    const pageNum = event.page_ids?.[0]
      ? undefined  // We'd need to look up the actual page number from the page_id
      : 1          // Fallback to page 1

    // Build a synthetic SearchHit for the viewer
    const syntheticHit: SearchHit = {
      page_id: event.page_ids?.[0] ?? event.id,
      record_source_id: event.record_source_id,
      aircraft_id: event.aircraft_id,
      page_number: pageNum ?? 1,
      original_filename: event.original_filename ?? source?.original_filename ?? "Document",
      source_category: (event.source_category ?? source?.source_category ?? "other") as SourceCategory,
      observed_registration: source?.observed_registration ?? null,
      date_range_start: source?.date_range_start ?? null,
      date_range_end: source?.date_range_end ?? null,
      ocr_excerpt: "",
      rank: 0,
    }

    setViewerHits([syntheticHit])
    setViewerTotalPages(source?.page_count ?? 1)
    setViewerOpen(true)
  }

  // Group events by month for the timeline
  function getMonthLabel(iso: string | null): string {
    if (!iso) return "Date Unknown"
    const d = new Date(iso + "T12:00:00")
    return d.toLocaleDateString([], { month: "long", year: "numeric" })
  }

  const grouped: Array<{ month: string; events: MaintenanceEvent[] }> = []
  let lastMonth = ""
  for (const ev of events) {
    const m = getMonthLabel(ev.event_date)
    if (m !== lastMonth) {
      grouped.push({ month: m, events: [ev] })
      lastMonth = m
    } else {
      grouped[grouped.length - 1].events.push(ev)
    }
  }

  const noAircraft = !selectedAircraftId

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Toolbar */}
      <div className="flex-none px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Aircraft Timeline</h1>
            {total > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {total} maintenance events extracted from {sources.filter((s) => s.extraction_status === "complete").length} documents
              </p>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              filtersOpen ? "border-primary/50 bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={noAircraft ? "Select an aircraft to view timeline" : "Search maintenance events, part numbers, AD numbers…"}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={noAircraft}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-border bg-background placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
          />
        </div>

        {/* Event type filter pills */}
        {filtersOpen && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {EVENT_TYPE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setEventTypeFilter(value)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  eventTypeFilter === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {noAircraft && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Select an aircraft</p>
            <p className="text-xs text-muted-foreground">Use the aircraft selector in the sidebar to view a maintenance timeline.</p>
          </div>
        )}

        {!noAircraft && isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!noAircraft && !isLoading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No events found</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {debouncedQuery || eventTypeFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Upload and index documents to populate the timeline. Events are extracted automatically after OCR completes."}
            </p>
          </div>
        )}

        {/* Timeline grouped by month */}
        {grouped.map(({ month, events: monthEvents }) => (
          <div key={month} className="mb-8">
            {/* Month header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                {month}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Vertical timeline line + cards */}
            <div className="relative">
              <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-3">
                {monthEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} onViewSource={openViewerForEvent} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Viewer */}
      {viewerOpen && viewerHits.length > 0 && (
        <RecordsVaultViewer
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          hits={viewerHits}
          hitIndex={0}
          query=""
          totalPages={viewerTotalPages}
        />
      )}
    </div>
  )
}
