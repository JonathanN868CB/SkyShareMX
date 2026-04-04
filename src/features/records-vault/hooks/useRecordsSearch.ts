import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { SearchHit, SourceCategory } from "../types"

export type RecordsSearchParams = {
  query: string
  aircraftId: string | null   // null = fleet-wide
  category: SourceCategory | null
  sourceId: string | null
  page: number
  pageSize: number
}

async function searchPages(params: RecordsSearchParams): Promise<SearchHit[]> {
  const { query, aircraftId, category, sourceId, page, pageSize } = params
  const offset = (page - 1) * pageSize

  const { data, error } = await supabase.rpc("rv_search_pages", {
    p_query:       query,
    p_aircraft_id: aircraftId ?? undefined,
    p_category:    category ?? undefined,
    p_source_id:   sourceId ?? undefined,
    p_limit:       pageSize,
    p_offset:      offset,
  })

  if (error) throw error
  return (data ?? []) as SearchHit[]
}

export function useRecordsSearch(params: RecordsSearchParams) {
  const enabled = params.query.trim().length >= 2

  return useQuery({
    queryKey: ["records-search", params],
    queryFn: () => searchPages(params),
    enabled,
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
  })
}
