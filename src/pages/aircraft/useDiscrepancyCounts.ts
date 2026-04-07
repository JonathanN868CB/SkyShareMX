import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

const db = supabase as any

/** Returns a map of tail number → discrepancy count. */
export function useDiscrepancyCounts() {
  return useQuery<Map<string, number>>({
    queryKey: ["discrepancy-counts"],
    queryFn: async () => {
      // Aggregate on the DB side to avoid the 1,000-row default cap.
      // One row per current registration — no client-side row explosion.
      const { data, error } = await db.rpc("get_discrepancy_counts_by_tail")
      if (error) throw error

      const countMap = new Map<string, number>()
      for (const r of data ?? []) countMap.set(r.registration, Number(r.count))
      return countMap
    },
    staleTime: 2 * 60 * 1000,
  })
}
