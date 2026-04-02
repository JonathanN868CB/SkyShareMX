import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

const db = supabase as any

// ─── System categorization by keyword matching on title ──────────────────────
const SYSTEM_KEYWORDS: [string, string[]][] = [
  ["De-Ice / Anti-Ice", ["de-ice", "deice", "de ice", "anti-ice", "boot", "ice detect"]],
  ["Avionics", ["ehsi", "adahrs", "cas ", "autopilot", "fms", "gps", "transponder", "display", "pusher"]],
  ["Fuel System", ["fuel", "contamination"]],
  ["Landing Gear / Tires", ["tire", "nosewheel", "shimmy", "brake", "gear door", "blown out"]],
  ["Propulsion", ["engine", "prop ", "propeller", "torque", "pt6", "prop de"]],
  ["Cabin / Interior", ["cabin", "door", "seat", "drawer", "latch", "panel", "interior", "armrest", "carpet"]],
  ["Comms / Connectivity", ["vccs", "radio", "com ", "intercom", "wifi", "internet", "satcom"]],
  ["Environmental", ["temp", "heating", "cooling", "bleed", "pressur", "aoa"]],
  ["Airframe", ["bird strike", "corrosion", "crack", "leak", "dent", "window", "dv window"]],
  ["Electrical / Lighting", ["light", "lamp", "battery", "generator", "alternator", "wire", "gauge"]],
]

function categorizeTitle(title: string): string {
  const lower = title.toLowerCase()
  for (const [category, keywords] of SYSTEM_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) return category
  }
  return "Other"
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface SystemCount {
  name: string
  count: number
}

export interface AircraftRate {
  tail: string
  rate: number
}

export interface QuarterBucket {
  label: string
  count: number
}

export interface FleetStats {
  fleetDisPerKHours: number
  criticalMelCount: number
  topSystem: SystemCount | null
  systemBreakdown: SystemCount[]
  avgResolutionDays: number | null
  bestAircraft: AircraftRate | null
  worstAircraft: AircraftRate | null
  quarterlyTrend: QuarterBucket[]
  totalRecords: number
  aircraftCount: number
  totalFleetHours: number
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useFleetStats() {
  return useQuery<FleetStats>({
    queryKey: ["fleet-stats"],
    queryFn: async () => {
      const [discResult, regResult] = await Promise.all([
        db
          .from("discrepancies")
          .select("aircraft_id, found_at, signoff_date, airframe_hours, has_mel, mel_category, title"),
        db
          .from("aircraft_registrations")
          .select("aircraft_id, registration")
          .eq("is_current", true),
      ])
      if (discResult.error) throw discResult.error
      if (regResult.error) throw regResult.error

      const discs: any[] = discResult.data ?? []
      const regs: any[] = regResult.data ?? []

      // Build aircraft_id → current tail lookup
      const regMap = new Map<string, string>()
      for (const r of regs) regMap.set(r.aircraft_id, r.registration)

      // ── Per-aircraft aggregation ───────────────────────────────────────
      const byAircraft = new Map<string, { count: number; maxHours: number; tail: string }>()
      for (const d of discs) {
        const tail = regMap.get(d.aircraft_id) ?? "Unknown"
        const ex = byAircraft.get(d.aircraft_id)
        const hrs = d.airframe_hours ? Number(d.airframe_hours) : 0
        if (ex) {
          ex.count++
          if (hrs > ex.maxHours) ex.maxHours = hrs
        } else {
          byAircraft.set(d.aircraft_id, { count: 1, maxHours: hrs, tail })
        }
      }

      // ── Stat 1: Fleet reliability rate (dis per 1K hours) ──────────────
      let totalDis = 0
      let totalHours = 0
      for (const v of byAircraft.values()) {
        totalDis += v.count
        totalHours += v.maxHours
      }
      const fleetDisPerKHours = totalHours > 0 ? (totalDis / totalHours) * 1000 : 0

      // ── Stat 2: Critical MEL count (Category A & B) ────────────────────
      let criticalMelCount = 0
      for (const d of discs) {
        if (d.has_mel && d.mel_category) {
          const cat = d.mel_category.toLowerCase().replace("category ", "").trim()
          if (cat === "a" || cat === "b") criticalMelCount++
        }
      }

      // ── Stat 3: System breakdown ───────────────────────────────────────
      const sysCounts = new Map<string, number>()
      for (const d of discs) {
        const cat = categorizeTitle(d.title)
        sysCounts.set(cat, (sysCounts.get(cat) ?? 0) + 1)
      }
      const systemBreakdown = Array.from(sysCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
      const topSystem = systemBreakdown[0] ?? null

      // ── Stat 4: Average resolution time ────────────────────────────────
      let totalDays = 0
      let resCount = 0
      for (const d of discs) {
        if (d.found_at && d.signoff_date) {
          const diff =
            (new Date(d.signoff_date).getTime() - new Date(d.found_at).getTime()) /
            86_400_000
          if (diff >= 0 && diff < 365) {
            totalDays += diff
            resCount++
          }
        }
      }
      const avgResolutionDays = resCount > 0 ? totalDays / resCount : null

      // ── Stat 5: Best / worst aircraft by dis per 1K hours ──────────────
      const rates = Array.from(byAircraft.values())
        .filter(v => v.maxHours >= 400)
        .map(v => ({
          tail: v.tail,
          rate: v.maxHours > 0 ? (v.count / v.maxHours) * 1000 : 0,
        }))
        .sort((a, b) => a.rate - b.rate)
      const bestAircraft = rates[0] ?? null
      const worstAircraft = rates.length > 1 ? rates[rates.length - 1] : null

      // ── Stat 6: Quarterly trend (last 4 quarters) ─────────────────────
      const now = new Date()
      const currentQ = Math.floor(now.getMonth() / 3)
      const currentY = now.getFullYear()
      const quarterBuckets: { label: string; start: Date; end: Date; count: number }[] = []

      for (let i = 3; i >= 0; i--) {
        let q = currentQ - i
        let y = currentY
        while (q < 0) {
          q += 4
          y--
        }
        const startMonth = q * 3
        const start = new Date(Date.UTC(y, startMonth, 1))
        const end = new Date(Date.UTC(y, startMonth + 3, 1))
        quarterBuckets.push({
          label: `Q${q + 1} '${String(y).slice(2)}`,
          start,
          end,
          count: 0,
        })
      }

      for (const d of discs) {
        if (!d.found_at) continue
        const dt = new Date(d.found_at)
        for (const qb of quarterBuckets) {
          if (dt >= qb.start && dt < qb.end) {
            qb.count++
            break
          }
        }
      }

      return {
        fleetDisPerKHours,
        criticalMelCount,
        topSystem,
        systemBreakdown,
        avgResolutionDays,
        bestAircraft,
        worstAircraft,
        quarterlyTrend: quarterBuckets.map(qb => ({
          label: qb.label,
          count: qb.count,
        })),
        totalRecords: discs.length,
        aircraftCount: byAircraft.size,
        totalFleetHours: Math.round(totalHours),
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}
