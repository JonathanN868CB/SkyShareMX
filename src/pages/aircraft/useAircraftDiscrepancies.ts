import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

const db = supabase as any

export interface DiscrepancyRow {
  id: string
  jetinsight_discrepancy_id: string
  title: string
  pilot_report: string | null
  found_by_name: string | null
  found_at: string | null
  location_raw: string | null
  location_icao: string | null
  corrective_action: string | null
  amm_references: string[] | null
  technician_name: string | null
  technician_credential_type: string | null
  company: string | null
  signoff_date: string | null
  airframe_hours: number | null
  airframe_cycles: number | null
  status: string
  import_confidence: string | null
  import_notes: string | null
}

/** Fetches all discrepancies for an aircraft, looked up by current tail number. */
export function useAircraftDiscrepancies(tailNumber: string | null) {
  return useQuery<DiscrepancyRow[]>({
    queryKey: ["aircraft-discrepancies", tailNumber],
    enabled: !!tailNumber,
    queryFn: async () => {
      // Look up aircraft_id from current registration
      const { data: reg, error: regErr } = await db
        .from("aircraft_registrations")
        .select("aircraft_id")
        .eq("registration", tailNumber)
        .eq("is_current", true)
        .single()
      if (regErr) throw regErr

      const { data, error } = await db
        .from("discrepancies")
        .select(
          "id, jetinsight_discrepancy_id, title, pilot_report, found_by_name, found_at, " +
          "location_raw, location_icao, corrective_action, amm_references, " +
          "technician_name, technician_credential_type, company, signoff_date, " +
          "airframe_hours, airframe_cycles, status, import_confidence, import_notes"
        )
        .eq("aircraft_id", reg.aircraft_id)
        .order("found_at", { ascending: false })
      if (error) throw error
      return data ?? []
    },
    staleTime: 2 * 60 * 1000,
  })
}
