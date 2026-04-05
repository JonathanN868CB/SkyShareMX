import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { MaintenanceEvent, EventType } from "../types"

interface TimelineParams {
  aircraftId: string | null
  eventType?: EventType | null
  dateFrom?: string | null
  dateTo?: string | null
  query?: string
  limit?: number
  offset?: number
}

export function useTimeline({
  aircraftId,
  eventType,
  dateFrom,
  dateTo,
  query,
  limit = 50,
  offset = 0,
}: TimelineParams) {
  return useQuery({
    queryKey: ["rv-timeline", aircraftId, eventType, dateFrom, dateTo, query, limit, offset],
    queryFn: async () => {
      if (!aircraftId) return { events: [], total: 0 }

      const { data, error } = await supabase.rpc("rv_get_timeline", {
        p_aircraft_id: aircraftId,
        p_event_type:  eventType ?? null,
        p_date_from:   dateFrom  ?? null,
        p_date_to:     dateTo    ?? null,
        p_query:       query || null,
        p_limit:       limit,
        p_offset:      offset,
      })

      if (error) throw error

      const rows = (data ?? []) as MaintenanceEvent[]
      const total = rows[0]?.total_count ?? 0
      return { events: rows, total: Number(total) }
    },
    enabled: !!aircraftId,
    staleTime: 2 * 60 * 1000,
  })
}
