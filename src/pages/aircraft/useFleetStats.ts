import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

const db = supabase as any

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AircraftRate {
  tail: string
  rate: number
}

export interface QuarterBucket {
  label: string
  count: number
  yr: number
  q: number   // 1–4
}

// Per-aircraft stats anchored to operational hours (max - min airframe_hours)
export interface AircraftStat {
  tail: string
  make: string
  modelFamily: string
  disCount: number
  acqHours: number            // hours at first recorded discrepancy — our baseline
  currentHours: number
  opsHours: number            // hours under our operation = current - acq
  openCount: number
  deferredCount: number
  melCount: number
  activeCatA: number          // currently deferred Cat A MEL items
  activeCatB: number          // currently deferred Cat B MEL items
  avgResolutionDays: number | null
  rate: number | null         // dis per 100 ops hours; null if opsHours < 200
}

// Aggregated rate for a manufacturer or model family
export interface GroupRate {
  label: string
  disCount: number
  opsHours: number
  rate: number                // dis per 100 ops hours
  aircraftCount: number
}

export interface FleetStats {
  // Rates — all based on operational hours under our care, per 100 hours
  fleetDisPer100h: number
  totalOpsHours: number
  // Resolution
  avgResolutionDays: number | null
  // Best / worst by rate
  bestAircraft: AircraftRate | null
  worstAircraft: AircraftRate | null
  // Cross-fleet comparisons
  byManufacturer: GroupRate[]   // one row per make, sorted by rate desc
  byModelFamily: GroupRate[]    // one row per model_family, sorted by rate desc
  // Quarterly trend
  quarterlyTrend: QuarterBucket[]
  // Per-aircraft detail
  perAircraftStats: AircraftStat[]
  // Totals
  totalRecords: number
  aircraftCount: number
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useFleetStats() {
  return useQuery<FleetStats>({
    queryKey: ["fleet-stats"],
    queryFn: async () => {

      // ── Per-aircraft aggregates + quarterly trend (two lightweight RPCs) ──
      const [analyticsResult, trendResult] = await Promise.all([
        db.rpc("get_fleet_analytics"),
        db.rpc("get_quarterly_dis_trend"),
      ])
      if (analyticsResult.error) throw analyticsResult.error
      if (trendResult.error)    throw trendResult.error

      const analyticsRows: any[] = analyticsResult.data ?? []
      const trendRows:     any[] = trendResult.data    ?? []

      // ── Build per-aircraft stats ──────────────────────────────────────────
      const MIN_OPS_HOURS = 200
      const perAircraftStats: AircraftStat[] = analyticsRows.map((r: any) => {
        const opsHours = Number(r.ops_hours ?? 0)
        return {
          tail:               r.registration,
          make:               r.make ?? "",
          modelFamily:        r.model_family ?? "",
          disCount:           Number(r.dis_count ?? 0),
          acqHours:           Number(r.acq_hours ?? 0),
          currentHours:       Number(r.current_hours ?? 0),
          opsHours,
          openCount:          Number(r.open_count ?? 0),
          deferredCount:      Number(r.deferred_count ?? 0),
          melCount:           Number(r.mel_count ?? 0),
          activeCatA:         Number(r.active_cat_a ?? 0),
          activeCatB:         Number(r.active_cat_b ?? 0),
          avgResolutionDays:  r.avg_resolution_days != null ? Number(r.avg_resolution_days) : null,
          rate:               opsHours >= MIN_OPS_HOURS
                                ? (Number(r.dis_count) / opsHours) * 100
                                : null,
        }
      })

      // ── Fleet-wide totals ─────────────────────────────────────────────────
      const totalOpsHours = Math.round(perAircraftStats.reduce((s, ac) => s + ac.opsHours, 0))
      const totalRecords  = perAircraftStats.reduce((s, ac) => s + ac.disCount, 0)

      // ── Fleet reliability rate (rated aircraft only) ──────────────────────
      const ratedAircraft = perAircraftStats.filter(ac => ac.rate !== null)
      const fleetDisPer100h = ratedAircraft.length > 0
        ? (ratedAircraft.reduce((s, ac) => s + ac.disCount, 0) /
           ratedAircraft.reduce((s, ac) => s + ac.opsHours, 0)) * 100
        : 0

      // ── Best / worst by rate ──────────────────────────────────────────────
      const sortedByRate  = [...ratedAircraft].sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))
      const bestAircraft  = sortedByRate[0]
        ? { tail: sortedByRate[0].tail,  rate: sortedByRate[0].rate! }
        : null
      const worstAircraft = sortedByRate.length > 1
        ? { tail: sortedByRate[sortedByRate.length - 1].tail, rate: sortedByRate[sortedByRate.length - 1].rate! }
        : null

      // ── Fleet-wide avg resolution (weighted by dis count per aircraft) ────
      let resDaySum = 0, resDisSum = 0
      for (const ac of perAircraftStats) {
        if (ac.avgResolutionDays !== null && ac.disCount > 0) {
          resDaySum += ac.avgResolutionDays * ac.disCount
          resDisSum += ac.disCount
        }
      }
      const avgResolutionDays = resDisSum > 0 ? resDaySum / resDisSum : null

      // ── By manufacturer ──────────────────────────────────────────────────
      const mfrMap = new Map<string, { dis: number; ops: number; count: number }>()
      for (const ac of ratedAircraft) {
        const ex = mfrMap.get(ac.make)
        if (ex) { ex.dis += ac.disCount; ex.ops += ac.opsHours; ex.count++ }
        else    mfrMap.set(ac.make, { dis: ac.disCount, ops: ac.opsHours, count: 1 })
      }
      const byManufacturer: GroupRate[] = Array.from(mfrMap.entries())
        .map(([label, v]) => ({
          label,
          disCount:     v.dis,
          opsHours:     Math.round(v.ops),
          rate:         (v.dis / v.ops) * 100,
          aircraftCount: v.count,
        }))
        .sort((a, b) => b.rate - a.rate)

      // ── By model family ──────────────────────────────────────────────────
      const famMap = new Map<string, { dis: number; ops: number; count: number; make: string }>()
      for (const ac of ratedAircraft) {
        const ex = famMap.get(ac.modelFamily)
        if (ex) { ex.dis += ac.disCount; ex.ops += ac.opsHours; ex.count++ }
        else    famMap.set(ac.modelFamily, { dis: ac.disCount, ops: ac.opsHours, count: 1, make: ac.make })
      }
      const byModelFamily: GroupRate[] = Array.from(famMap.entries())
        .map(([label, v]) => ({
          label,
          disCount:     v.dis,
          opsHours:     Math.round(v.ops),
          rate:         (v.dis / v.ops) * 100,
          aircraftCount: v.count,
        }))
        .sort((a, b) => b.rate - a.rate)

      // ── Quarterly trend from RPC ──────────────────────────────────────────
      const now = new Date()
      const currentQ = Math.floor(now.getMonth() / 3)
      const currentY = now.getFullYear()
      const quarterBuckets: { label: string; yr: number; q: number; count: number }[] = []
      for (let i = 3; i >= 0; i--) {
        let q = currentQ - i, y = currentY
        while (q < 0) { q += 4; y-- }
        quarterBuckets.push({ label: `Q${q + 1} '${String(y).slice(2)}`, yr: y, q: q + 1, count: 0 })
      }
      for (const row of trendRows) {
        const b = quarterBuckets.find(b => b.yr === Number(row.yr) && b.q === Number(row.q))
        if (b) b.count = Number(row.count)
      }

      return {
        fleetDisPer100h,
        totalOpsHours,
        avgResolutionDays,
        bestAircraft,
        worstAircraft,
        byManufacturer,
        byModelFamily,
        quarterlyTrend: quarterBuckets.map(b => ({ label: b.label, count: b.count, yr: b.yr, q: b.q })),
        perAircraftStats,
        totalRecords,
        aircraftCount: perAircraftStats.length,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}
