// ─── Beet Box — MX Library Service ───────────────────────────────────────────
// Flat Rates and Canned Corrective Actions, keyed by (aircraft_model, ref_code)

import { supabase } from "@/lib/supabase"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LibFlatRate {
  id:             string
  aircraftModel:  string
  refCode:        string
  hours:          number
  laborRate:      number
  description:    string | null
  createdByName:  string | null
  createdAt:      string
}

export interface LibCorrectiveAction {
  id:                   string
  aircraftModel:        string
  refCode:              string
  correctiveActionText: string
  createdByName:        string | null
  createdAt:            string
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFR(row: any): LibFlatRate {
  return {
    id:            row.id,
    aircraftModel: row.aircraft_model,
    refCode:       row.ref_code,
    hours:         Number(row.hours),
    laborRate:     Number(row.labor_rate),
    description:   row.description ?? null,
    createdByName: row.created_by_name ?? null,
    createdAt:     row.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCA(row: any): LibCorrectiveAction {
  return {
    id:                   row.id,
    aircraftModel:        row.aircraft_model,
    refCode:              row.ref_code,
    correctiveActionText: row.corrective_action_text,
    createdByName:        row.created_by_name ?? null,
    createdAt:            row.created_at,
  }
}

// ─── Fetch all ────────────────────────────────────────────────────────────────

export async function getFlatRates(): Promise<LibFlatRate[]> {
  const { data } = await supabase
    .from("bb_library_flat_rates")
    .select("*")
    .order("aircraft_model")
    .order("ref_code")
  return (data ?? []).map(mapFR)
}

export async function getCorrectiveActions(): Promise<LibCorrectiveAction[]> {
  const { data } = await supabase
    .from("bb_library_corrective_actions")
    .select("*")
    .order("aircraft_model")
    .order("ref_code")
  return (data ?? []).map(mapCA)
}

// ─── Single lookup (returns null if no match) ─────────────────────────────────

export async function lookupFlatRate(
  aircraftModel: string,
  refCode: string
): Promise<LibFlatRate | null> {
  if (!aircraftModel.trim() || !refCode.trim()) return null
  const { data } = await supabase
    .from("bb_library_flat_rates")
    .select("*")
    .eq("aircraft_model", aircraftModel.trim())
    .eq("ref_code", refCode.trim())
    .limit(1)
  return data?.[0] ? mapFR(data[0]) : null
}

export async function lookupCorrectiveAction(
  aircraftModel: string,
  refCode: string
): Promise<LibCorrectiveAction | null> {
  if (!aircraftModel.trim() || !refCode.trim()) return null
  const { data } = await supabase
    .from("bb_library_corrective_actions")
    .select("*")
    .eq("aircraft_model", aircraftModel.trim())
    .eq("ref_code", refCode.trim())
    .limit(1)
  return data?.[0] ? mapCA(data[0]) : null
}

// ─── Upsert (create or update on conflict) ────────────────────────────────────

export async function upsertFlatRate(
  entry: Omit<LibFlatRate, "id" | "createdAt">
): Promise<void> {
  await supabase.from("bb_library_flat_rates").upsert(
    {
      aircraft_model:  entry.aircraftModel.trim(),
      ref_code:        entry.refCode.trim(),
      hours:           entry.hours,
      labor_rate:      entry.laborRate,
      description:     entry.description ?? null,
      created_by_name: entry.createdByName ?? null,
    },
    { onConflict: "aircraft_model,ref_code" }
  )
}

export async function upsertCorrectiveAction(
  entry: Omit<LibCorrectiveAction, "id" | "createdAt">
): Promise<void> {
  await supabase.from("bb_library_corrective_actions").upsert(
    {
      aircraft_model:         entry.aircraftModel.trim(),
      ref_code:               entry.refCode.trim(),
      corrective_action_text: entry.correctiveActionText,
      created_by_name:        entry.createdByName ?? null,
    },
    { onConflict: "aircraft_model,ref_code" }
  )
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteFlatRate(id: string): Promise<void> {
  await supabase.from("bb_library_flat_rates").delete().eq("id", id)
}

export async function deleteCorrectiveAction(id: string): Promise<void> {
  await supabase.from("bb_library_corrective_actions").delete().eq("id", id)
}
