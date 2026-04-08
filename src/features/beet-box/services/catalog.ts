import { supabase } from "@/lib/supabase"
import type {
  CatalogEntry,
  CatalogVendorLink,
  CatalogRelationshipRow,
  CatalogRelationshipType,
  PartClassification,
} from "../types"

// ─── List / Search ───────────────────────────────────────────────────────────

export async function getCatalogEntries(filters?: {
  search?: string
  partType?: PartClassification
  ataChapter?: string
}): Promise<CatalogEntry[]> {
  let query = supabase
    .from("parts_catalog")
    .select("*")
    .order("part_number")

  if (filters?.search) {
    query = query.or(
      `part_number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    )
  }
  if (filters?.partType) {
    query = query.eq("part_type", filters.partType)
  }
  if (filters?.ataChapter) {
    query = query.eq("ata_chapter", filters.ataChapter)
  }

  const { data, error } = await query
  if (error) throw error

  const catalogIds = (data ?? []).map((r: { id: string }) => r.id)

  // Aggregate on-hand inventory per catalog_id
  let invMap: Record<string, number> = {}
  if (catalogIds.length > 0) {
    const { data: invData } = await supabase
      .from("bb_inventory_parts")
      .select("catalog_id, qty_on_hand")
      .in("catalog_id", catalogIds)

    invData?.forEach((r: { catalog_id: string; qty_on_hand: number }) => {
      invMap[r.catalog_id] = (invMap[r.catalog_id] ?? 0) + r.qty_on_hand
    })
  }

  return (data ?? []).map((row: Record<string, unknown>) => mapCatalogRow(row, invMap[row.id as string]))
}

// ─── Single Entry ────────────────────────────────────────────────────────────

export async function getCatalogEntryById(id: string): Promise<CatalogEntry | null> {
  const [
    { data: row, error: rowErr },
    { data: vendorRows, error: vErr },
    { data: relA, error: relAErr },
    { data: relB, error: relBErr },
    { data: invRows, error: invErr },
  ] = await Promise.all([
    supabase.from("parts_catalog").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("parts_catalog_vendors")
      .select("*, vendors!inner(name)")
      .eq("catalog_id", id)
      .order("is_preferred", { ascending: false }),
    supabase
      .from("parts_relationships")
      .select("*, parts_catalog!parts_relationships_part_b_id_fkey(part_number, description)")
      .eq("part_a_id", id),
    supabase
      .from("parts_relationships")
      .select("*, parts_catalog!parts_relationships_part_a_id_fkey(part_number, description)")
      .eq("part_b_id", id),
    supabase
      .from("bb_inventory_parts")
      .select("catalog_id, qty_on_hand")
      .eq("catalog_id", id),
  ])

  if (rowErr) throw rowErr
  if (!row) return null

  const totalOnHand = (invRows ?? []).reduce(
    (sum: number, r: { qty_on_hand: number }) => sum + r.qty_on_hand, 0
  )

  const entry = mapCatalogRow(row, totalOnHand)

  // Vendors
  entry.vendors = (vendorRows ?? []).map((v: Record<string, unknown>) => ({
    id: v.id as string,
    catalogId: v.catalog_id as string,
    vendorId: v.vendor_id as string,
    vendorName: (v.vendors as { name: string })?.name ?? "Unknown",
    leadTimeDays: v.lead_time_days as number | null,
    lastUnitCost: v.last_unit_cost as number | null,
    isPreferred: v.is_preferred as boolean,
    notes: v.notes as string | null,
    createdAt: v.created_at as string,
  }))

  // Relationships — outgoing (this part → other)
  const outgoing: CatalogRelationshipRow[] = (relA ?? []).map((r: Record<string, unknown>) => {
    const related = r.parts_catalog as { part_number: string; description: string | null } | null
    return {
      id: r.id as string,
      relatedPartId: r.part_b_id as string,
      relatedPartNumber: related?.part_number ?? "",
      relatedDescription: related?.description ?? null,
      relationshipType: r.relationship_type as CatalogRelationshipType,
      direction: "outgoing" as const,
      notes: r.notes as string | null,
    }
  })

  // Relationships — incoming (other part → this)
  const incoming: CatalogRelationshipRow[] = (relB ?? []).map((r: Record<string, unknown>) => {
    const related = r.parts_catalog as { part_number: string; description: string | null } | null
    return {
      id: r.id as string,
      relatedPartId: r.part_a_id as string,
      relatedPartNumber: related?.part_number ?? "",
      relatedDescription: related?.description ?? null,
      relationshipType: r.relationship_type as CatalogRelationshipType,
      direction: "incoming" as const,
      notes: r.notes as string | null,
    }
  })

  if (vErr) console.warn("vendor load err", vErr)
  if (relAErr) console.warn("relA load err", relAErr)
  if (relBErr) console.warn("relB load err", relBErr)
  if (invErr) console.warn("inv load err", invErr)

  entry.relationships = [...outgoing, ...incoming]

  return entry
}

// ─── Typeahead Search ────────────────────────────────────────────────────────

export interface CatalogSearchResult {
  id: string
  partNumber: string
  description: string | null
  inventoryOnHand: number
  locationBin: string | null
}

export async function searchCatalog(query: string): Promise<CatalogSearchResult[]> {
  if (!query.trim()) return []

  const { data, error } = await supabase
    .from("parts_catalog")
    .select("id, part_number, description")
    .or(`part_number.ilike.%${query}%,description.ilike.%${query}%`)
    .order("part_number")
    .limit(15)

  if (error) throw error
  if (!data || data.length === 0) return []

  // Fetch inventory for these catalog IDs
  const catalogIds = data.map((r: { id: string }) => r.id)
  const { data: invData } = await supabase
    .from("bb_inventory_parts")
    .select("catalog_id, qty_on_hand, location_bin")
    .in("catalog_id", catalogIds)

  const invMap: Record<string, { qty: number; bin: string | null }> = {}
  invData?.forEach((r: { catalog_id: string; qty_on_hand: number; location_bin: string | null }) => {
    if (!invMap[r.catalog_id]) invMap[r.catalog_id] = { qty: 0, bin: null }
    invMap[r.catalog_id].qty += r.qty_on_hand
    if (r.location_bin && !invMap[r.catalog_id].bin) invMap[r.catalog_id].bin = r.location_bin
  })

  return data.map((r: { id: string; part_number: string; description: string | null }) => ({
    id: r.id,
    partNumber: r.part_number,
    description: r.description,
    inventoryOnHand: invMap[r.id]?.qty ?? 0,
    locationBin: invMap[r.id]?.bin ?? null,
  }))
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createCatalogEntry(payload: {
  partNumber: string
  description?: string | null
  ataChapter?: string | null
  partType?: PartClassification | null
  unitOfMeasure?: string
  manufacturer?: string | null
  isSerialized?: boolean
  isShelfLife?: boolean
  shelfLifeMonths?: number | null
  isRotable?: boolean
  aircraftApplicability?: string[] | null
  notes?: string | null
}): Promise<CatalogEntry> {
  const { data, error } = await supabase
    .from("parts_catalog")
    .insert({
      part_number: payload.partNumber.trim(),
      description: payload.description ?? null,
      ata_chapter: payload.ataChapter ?? null,
      part_type: payload.partType ?? null,
      unit_of_measure: payload.unitOfMeasure ?? "EA",
      manufacturer: payload.manufacturer ?? null,
      is_serialized: payload.isSerialized ?? false,
      is_shelf_life: payload.isShelfLife ?? false,
      shelf_life_months: payload.shelfLifeMonths ?? null,
      is_rotable: payload.isRotable ?? false,
      aircraft_applicability: payload.aircraftApplicability ?? null,
      notes: payload.notes ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return mapCatalogRow(data)
}

export async function updateCatalogEntry(
  id: string,
  payload: Partial<{
    description: string | null
    ataChapter: string | null
    partType: PartClassification | null
    unitOfMeasure: string
    manufacturer: string | null
    isSerialized: boolean
    isShelfLife: boolean
    shelfLifeMonths: number | null
    isRotable: boolean
    aircraftApplicability: string[] | null
    notes: string | null
  }>
): Promise<void> {
  const { error } = await supabase
    .from("parts_catalog")
    .update({
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.ataChapter !== undefined && { ata_chapter: payload.ataChapter }),
      ...(payload.partType !== undefined && { part_type: payload.partType }),
      ...(payload.unitOfMeasure !== undefined && { unit_of_measure: payload.unitOfMeasure }),
      ...(payload.manufacturer !== undefined && { manufacturer: payload.manufacturer }),
      ...(payload.isSerialized !== undefined && { is_serialized: payload.isSerialized }),
      ...(payload.isShelfLife !== undefined && { is_shelf_life: payload.isShelfLife }),
      ...(payload.shelfLifeMonths !== undefined && { shelf_life_months: payload.shelfLifeMonths }),
      ...(payload.isRotable !== undefined && { is_rotable: payload.isRotable }),
      ...(payload.aircraftApplicability !== undefined && { aircraft_applicability: payload.aircraftApplicability }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
    })
    .eq("id", id)

  if (error) throw error
}

// ─── Vendor Links ────────────────────────────────────────────────────────────

export async function addCatalogVendor(
  catalogId: string,
  vendorId: string,
  data?: { leadTimeDays?: number; lastUnitCost?: number; isPreferred?: boolean; notes?: string }
): Promise<CatalogVendorLink> {
  const { data: row, error } = await supabase
    .from("parts_catalog_vendors")
    .insert({
      catalog_id: catalogId,
      vendor_id: vendorId,
      lead_time_days: data?.leadTimeDays ?? null,
      last_unit_cost: data?.lastUnitCost ?? null,
      is_preferred: data?.isPreferred ?? false,
      notes: data?.notes ?? null,
    })
    .select("*, vendors!inner(name)")
    .single()

  if (error) throw error
  return {
    id: row.id,
    catalogId: row.catalog_id,
    vendorId: row.vendor_id,
    vendorName: (row.vendors as { name: string })?.name ?? "Unknown",
    leadTimeDays: row.lead_time_days,
    lastUnitCost: row.last_unit_cost,
    isPreferred: row.is_preferred,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export async function removeCatalogVendor(id: string): Promise<void> {
  const { error } = await supabase.from("parts_catalog_vendors").delete().eq("id", id)
  if (error) throw error
}

// ─── Relationships ───────────────────────────────────────────────────────────

export async function addRelationship(
  partAId: string,
  partBId: string,
  type: CatalogRelationshipType,
  notes?: string
): Promise<void> {
  const { error } = await supabase.from("parts_relationships").insert({
    part_a_id: partAId,
    part_b_id: partBId,
    relationship_type: type,
    notes: notes ?? null,
  })
  if (error) throw error
}

export async function removeRelationship(id: string): Promise<void> {
  const { error } = await supabase.from("parts_relationships").delete().eq("id", id)
  if (error) throw error
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapCatalogRow(row: Record<string, unknown>, inventoryOnHand?: number): CatalogEntry {
  return {
    id: row.id as string,
    partNumber: row.part_number as string,
    description: row.description as string | null,
    ataChapter: row.ata_chapter as string | null,
    partType: row.part_type as PartClassification | null,
    unitOfMeasure: row.unit_of_measure as string,
    manufacturer: row.manufacturer as string | null,
    isSerialized: row.is_serialized as boolean,
    isShelfLife: row.is_shelf_life as boolean,
    shelfLifeMonths: row.shelf_life_months as number | null,
    isRotable: row.is_rotable as boolean,
    aircraftApplicability: row.aircraft_applicability as string[] | null,
    notes: row.notes as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    inventoryOnHand,
  }
}
