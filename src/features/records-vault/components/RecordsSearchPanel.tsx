import { Search, X } from "lucide-react"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
import { Label } from "@/shared/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { SOURCE_CATEGORIES, SOURCE_CATEGORY_LABELS } from "../constants"
import type { SourceCategory } from "../types"
import type { AircraftBase } from "@/pages/aircraft/fleetData"

interface Props {
  query: string
  onQueryChange: (q: string) => void
  selectedAircraftId: string | null
  onAircraftChange: (id: string | null) => void
  selectedCategory: SourceCategory | null
  onCategoryChange: (c: SourceCategory | null) => void
  selectedSourceId: string | null
  onSourceChange: (id: string | null) => void
  aircraft: AircraftBase[]
  sources: Array<{ id: string; original_filename: string }>
  isLoadingAircraft: boolean
}

export function RecordsSearchPanel({
  query,
  onQueryChange,
  selectedAircraftId,
  onAircraftChange,
  selectedCategory,
  onCategoryChange,
  selectedSourceId,
  onSourceChange,
  aircraft,
  sources,
  isLoadingAircraft,
}: Props) {
  function clearAll() {
    onQueryChange("")
    onAircraftChange(null)
    onCategoryChange(null)
    onSourceChange(null)
  }

  const hasFilters = query || selectedAircraftId || selectedCategory || selectedSourceId

  return (
    <div className="flex flex-col gap-5">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 pr-9"
          placeholder="Search records…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => onQueryChange("")}
            tabIndex={-1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Aircraft scope */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Aircraft
        </Label>
        <Select
          value={selectedAircraftId ?? "fleet"}
          onValueChange={(v) => onAircraftChange(v === "fleet" ? null : v)}
          disabled={isLoadingAircraft}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="All aircraft" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fleet">All aircraft (fleet-wide)</SelectItem>
            {aircraft.map((ac) => (
              <SelectItem key={ac.id} value={ac.id}>
                {ac.tailNumber} — {ac.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category filter */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Category
        </Label>
        <Select
          value={selectedCategory ?? "all"}
          onValueChange={(v) => onCategoryChange(v === "all" ? null : (v as SourceCategory))}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {SOURCE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {SOURCE_CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Source document filter */}
      {sources.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Source Document
          </Label>
          <Select
            value={selectedSourceId ?? "all"}
            onValueChange={(v) => onSourceChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All documents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All documents</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.original_filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Clear */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground w-full justify-start">
          <X className="h-3.5 w-3.5 mr-1.5" />
          Clear all filters
        </Button>
      )}
    </div>
  )
}
