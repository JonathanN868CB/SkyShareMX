import { supabase } from "@/lib/supabase"
import type { FleetAircraft, AircraftRef } from "../types"

// Fetch all active fleet aircraft with their current registration
export async function getFleetAircraft(): Promise<FleetAircraft[]> {
  const [{ data: acRows, error: acErr }, { data: regRows, error: regErr }] =
    await Promise.all([
      supabase
        .from("aircraft")
        .select("id, make, model_family, model_full, serial_number, year, is_twin, has_prop, has_apu, engine_manufacturer, engine_model")
        .eq("status", "active")
        .order("make"),
      supabase
        .from("aircraft_registrations")
        .select("aircraft_id, registration")
        .eq("is_current", true),
    ])

  if (acErr) throw acErr
  if (regErr) throw regErr

  const regMap = new Map<string, string>(
    (regRows ?? []).map((r) => [r.aircraft_id, r.registration])
  )

  return (acRows ?? []).map((row) => ({
    id: row.id,
    make: row.make,
    modelFamily: row.model_family,
    modelFull: row.model_full,
    serialNumber: row.serial_number,
    year: row.year,
    isTwin: row.is_twin,
    hasProp: row.has_prop,
    hasApu: row.has_apu,
    engineManufacturer: row.engine_manufacturer,
    engineModel: row.engine_model,
    registration: regMap.get(row.id) ?? null,
  }))
}

export async function getAircraftById(id: string): Promise<FleetAircraft | null> {
  const [{ data: ac, error: acErr }, { data: reg, error: regErr }] =
    await Promise.all([
      supabase
        .from("aircraft")
        .select("id, make, model_family, model_full, serial_number, year, is_twin, has_prop, has_apu, engine_manufacturer, engine_model")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("aircraft_registrations")
        .select("registration")
        .eq("aircraft_id", id)
        .eq("is_current", true)
        .maybeSingle(),
    ])

  if (acErr) throw acErr
  if (regErr) throw regErr
  if (!ac) return null

  return {
    id: ac.id,
    make: ac.make,
    modelFamily: ac.model_family,
    modelFull: ac.model_full,
    serialNumber: ac.serial_number,
    year: ac.year,
    isTwin: ac.is_twin,
    hasProp: ac.has_prop,
    hasApu: ac.has_apu,
    engineManufacturer: ac.engine_manufacturer,
    engineModel: ac.engine_model,
    registration: reg?.registration ?? null,
  }
}

// Build an AircraftRef from a fleet aircraft row + registration map.
// Used internally by work order / invoice / logbook service mappers.
export function buildAircraftRef(
  aircraftId: string | null,
  guestRegistration: string | null,
  guestSerial: string | null,
  acMap: Map<string, { make: string; modelFull: string; serialNumber: string }>,
  regMap: Map<string, string>
): AircraftRef | null {
  if (aircraftId) {
    const ac = acMap.get(aircraftId)
    return {
      aircraftId,
      registration: regMap.get(aircraftId) ?? null,
      serialNumber: ac?.serialNumber ?? null,
      make: ac?.make ?? null,
      modelFull: ac?.modelFull ?? null,
    }
  }
  if (guestRegistration) {
    return {
      aircraftId: null,
      registration: guestRegistration,
      serialNumber: guestSerial,
      make: null,
      modelFull: null,
    }
  }
  return null
}
