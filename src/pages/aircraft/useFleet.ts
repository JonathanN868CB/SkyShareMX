import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { AircraftBase, ManufacturerGroup } from "./fleetData"

// aircraft + aircraft_registrations were added after the last type generation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// Preserve the intentional display order for manufacturers and model families.
const MAKE_ORDER = [
  "Pilatus Aircraft",
  "Cessna / Textron Aviation",
  "Gulfstream Aerospace",
  "Embraer",
]

const FAMILY_ORDER = [
  "PC-12/45 — Legacy",
  "PC-12/47 — Legacy",
  "PC-12/47E — NG",
  "PC-12 — NGX",
  "Citation CJ2 (525A)",
  "Citation 560XL / XLS+",
  "Citation M2 Gen2",
  "G200",
  "G450",
  "GV",
  "Phenom 100 (EMB-500)",
  "Phenom 300E (EMB-505)",
  "Legacy 650 (EMB-135BJ)",
]

export function useFleet() {
  return useQuery<ManufacturerGroup[]>({
    queryKey: ["fleet"],
    queryFn: async () => {
      const [
        { data: aircraftRows, error: aErr },
        { data: regRows,      error: rErr },
      ] = await Promise.all([
        db
          .from("aircraft")
          .select("id, make, model_family, model_full, serial_number, year")
          .eq("status", "active"),
        db
          .from("aircraft_registrations")
          .select("aircraft_id, registration")
          .eq("is_current", true),
      ])

      if (aErr) throw aErr
      if (rErr) throw rErr

      // aircraft_id → current tail number
      const regMap = new Map<string, string>(
        (regRows ?? []).map(
          (r: { aircraft_id: string; registration: string }) =>
            [r.aircraft_id, r.registration] as const
        )
      )

      // Group into make → model_family → AircraftBase[]
      const groups = new Map<string, Map<string, AircraftBase[]>>()

      for (const row of aircraftRows ?? []) {
        const tailNumber = regMap.get(row.id)
        if (!tailNumber) continue

        const ac: AircraftBase = {
          id:           row.id,
          tailNumber,
          year:         row.year,
          model:        row.model_full,
          serialNumber: row.serial_number,
        }

        if (!groups.has(row.make)) groups.set(row.make, new Map())
        const families = groups.get(row.make)!
        if (!families.has(row.model_family)) families.set(row.model_family, [])
        families.get(row.model_family)!.push(ac)
      }

      // Sort aircraft within each family by year ascending
      for (const families of groups.values()) {
        for (const aircraft of families.values()) {
          aircraft.sort((a, b) => a.year - b.year)
        }
      }

      // Assemble in the correct display order
      return MAKE_ORDER
        .filter(make => groups.has(make))
        .map(make => {
          const families = groups.get(make)!
          const sorted = Array.from(families.entries()).sort(([a], [b]) => {
            const ai = FAMILY_ORDER.indexOf(a)
            const bi = FAMILY_ORDER.indexOf(b)
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
          })
          return {
            manufacturer: make,
            families: sorted.map(([family, aircraft]) => ({ family, aircraft })),
          }
        })
    },
    staleTime: 5 * 60 * 1000, // fleet data changes rarely
  })
}
