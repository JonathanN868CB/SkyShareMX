import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

const db = supabase as any

/** Returns a map of tail number → discrepancy count. */
export function useDiscrepancyCounts() {
  return useQuery<Map<string, number>>({
    queryKey: ["discrepancy-counts"],
    queryFn: async () => {
      const [discResult, regResult] = await Promise.all([
        db.from("discrepancies").select("aircraft_id"),
        db.from("aircraft_registrations").select("aircraft_id, registration").eq("is_current", true),
      ])
      if (discResult.error) throw discResult.error
      if (regResult.error) throw regResult.error

      const regMap = new Map<string, string>()
      for (const r of regResult.data ?? []) regMap.set(r.aircraft_id, r.registration)

      const countMap = new Map<string, number>()
      for (const d of discResult.data ?? []) {
        const tail = regMap.get(d.aircraft_id)
        if (!tail) continue
        countMap.set(tail, (countMap.get(tail) ?? 0) + 1)
      }
      return countMap
    },
    staleTime: 2 * 60 * 1000,
  })
}
