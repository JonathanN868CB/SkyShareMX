import { useState, useMemo, createContext, useContext } from "react"
import { Outlet, Navigate } from "react-router-dom"
import { useFleet } from "@/pages/aircraft/useFleet"
import { RecordsVaultSidebar } from "./RecordsVaultSidebar"
import { RecordsUploadModal } from "./components/RecordsUploadModal"
import type { AircraftBase } from "@/pages/aircraft/fleetData"

// ─── Context ──────────────────────────────────────────────────────────────────

export type SearchAircraftGroup = {
  id:           string
  tailNumber:   string
  serialNumber: string
  count:        number
}

type RecordsVaultCtx = {
  selectedAircraftId: string | null
  setSelectedAircraftId: (id: string | null) => void
  allAircraft: AircraftBase[]
  fleetLoading: boolean
  openUpload: () => void
  // Search result aircraft groups — written by search page, read by sidebar
  searchAircraftGroups: SearchAircraftGroup[]
  setSearchAircraftGroups: (groups: SearchAircraftGroup[]) => void
  selectedAircraftFilter: string | null
  setSelectedAircraftFilter: (id: string | null) => void
}

const RecordsVaultContext = createContext<RecordsVaultCtx>({
  selectedAircraftId: null,
  setSelectedAircraftId: () => {},
  allAircraft: [],
  fleetLoading: false,
  openUpload: () => {},
  searchAircraftGroups: [],
  setSearchAircraftGroups: () => {},
  selectedAircraftFilter: null,
  setSelectedAircraftFilter: () => {},
})

export function useRecordsVaultCtx() {
  return useContext(RecordsVaultContext)
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export function RecordsVaultApp() {
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [searchAircraftGroups, setSearchAircraftGroups] = useState<SearchAircraftGroup[]>([])
  const [selectedAircraftFilter, setSelectedAircraftFilter] = useState<string | null>(null)

  const { data: fleetGroups = [], isLoading: fleetLoading } = useFleet()
  const allAircraft = useMemo<AircraftBase[]>(
    () => fleetGroups.flatMap((g) => g.families.flatMap((f) => f.aircraft)),
    [fleetGroups]
  )

  return (
    <RecordsVaultContext.Provider
      value={{
        selectedAircraftId,
        setSelectedAircraftId,
        allAircraft,
        fleetLoading,
        openUpload: () => setUploadOpen(true),
        searchAircraftGroups,
        setSearchAircraftGroups,
        selectedAircraftFilter,
        setSelectedAircraftFilter,
      }}
    >
      <div
        className="flex h-screen w-screen overflow-hidden animate-in fade-in duration-200"
        style={{ background: "hsl(0 0% 12%)" }}
      >
        <RecordsVaultSidebar />
        <main className="flex-1 overflow-hidden min-w-0 flex flex-col bg-background">
          <Outlet />
        </main>
      </div>

      <RecordsUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        aircraft={allAircraft}
        defaultAircraftId={selectedAircraftId}
      />
    </RecordsVaultContext.Provider>
  )
}

export function RecordsVaultRedirect() {
  return <Navigate to="/app/records-vault/search" replace />
}
