import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { RecordSource } from "../types"

async function fetchRecordSources(aircraftId: string | null): Promise<RecordSource[]> {
  let query = supabase
    .from("rv_record_sources")
    .select("*")
    .order("created_at", { ascending: false })

  if (aircraftId) {
    query = query.eq("aircraft_id", aircraftId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as RecordSource[]
}

export function useRecordSources(aircraftId: string | null) {
  return useQuery({
    queryKey: ["record-sources", aircraftId],
    queryFn: () => fetchRecordSources(aircraftId),
    staleTime: 30_000,
    retry: 1,
  })
}
