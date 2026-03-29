import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { AircraftDetailData, AvionicsService, CMMDocument, DataField, GroupCMM, NavSubscription } from "./fleetData"

// aircraft_details table was created after the last type generation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// Use Supabase array only if it has items — a partial upsert (e.g. CMMs-only save)
// creates rows where all other JSONB columns default to [], which is truthy and
// would bypass the ?? operator. Fall back to hardcoded data for any empty array.
function arr<T>(supabaseVal: unknown, fallback: T[]): T[] {
  const v = supabaseVal as T[] | null | undefined
  return v?.length ? v : fallback
}

// ─── Fetch ─────────────────────────────────────────────────────────────────────
// Falls back to the hardcoded record if no Supabase row exists yet, or if the
// row was created by a partial write (empty array fields).
export function useAircraftDetail(tailNumber: string, fallback: AircraftDetailData) {
  return useQuery<AircraftDetailData>({
    queryKey: ["aircraft_detail", tailNumber],
    queryFn: async () => {
      const { data, error } = await db
        .from("aircraft_details")
        .select("*")
        .eq("tail_number", tailNumber)
        .maybeSingle()

      if (error) throw error
      if (!data) return { ...fallback, cmms: fallback.cmms ?? [] }

      return {
        identity:         arr<DataField>(data.identity,         fallback.identity),
        powerplant:       arr<DataField>(data.powerplant,        fallback.powerplant),
        apu:              data.apu !== null && data.apu !== undefined
                            ? arr<DataField>(data.apu, fallback.apu ?? [])
                            : fallback.apu,
        programs:         arr<DataField>(data.programs,         fallback.programs),
        navSubscriptions: arr<NavSubscription>(data.nav_subscriptions, fallback.navSubscriptions),
        documentation:    arr<DataField>(data.documentation,    fallback.documentation),
        cmms:             (data.cmms as CMMDocument[]) ?? [],
        avionics:         arr<AvionicsService>(data.avionics,   fallback.avionics),
        notes:            data.notes ?? fallback.notes,
      } satisfies AircraftDetailData
    },
    staleTime: 30_000,
  })
}

// ─── Full upsert ───────────────────────────────────────────────────────────────
// Called when the super admin saves the main overlay. Always writes every field.
export function useUpsertAircraftDetail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      tailNumber,
      detail,
    }: {
      tailNumber: string
      detail: AircraftDetailData
    }) => {
      const { error } = await db.from("aircraft_details").upsert({
        tail_number:       tailNumber,
        identity:          detail.identity,
        powerplant:        detail.powerplant,
        apu:               detail.apu,
        programs:          detail.programs,
        nav_subscriptions: detail.navSubscriptions,
        documentation:     detail.documentation,
        cmms:              detail.cmms ?? [],
        avionics:          detail.avionics ?? [],
        notes:             detail.notes,
        updated_at:        new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: (_, { tailNumber }) => {
      qc.invalidateQueries({ queryKey: ["aircraft_detail", tailNumber] })
    },
  })
}

// ─── Group CMMs ────────────────────────────────────────────────────────────────
// Fetches all group CMMs whose `groups` array includes the given fleet family.
export function useGroupCMMs(familyGroup: string | null) {
  return useQuery<GroupCMM[]>({
    queryKey: ["group_cmms", familyGroup],
    queryFn: async () => {
      if (!familyGroup) return []
      const { data, error } = await db
        .from("group_cmms")
        .select("*")
        .contains("groups", [familyGroup])
        .order("ata_chapter")
      if (error) throw error
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id:            row.id as string,
        manufacturer:  (row.manufacturer  as string) || "",
        docNumber:     (row.doc_number    as string) || "",
        ataChapter:    (row.ata_chapter   as string) || "",
        revision:      (row.revision      as string) || "",
        revisionDate:  (row.revision_date as string) || "",
        title:         (row.title         as string) || "",
        applicability: (row.applicability as string) || "",
        driveLink:     (row.drive_link    as string) || "",
        notes:         (row.notes         as string) || "",
        groups:        (row.groups        as string[]) || [],
        createdAt:     row.created_at     as string | undefined,
        updatedAt:     row.updated_at     as string | undefined,
      })) as GroupCMM[]
    },
    enabled: !!familyGroup,
    staleTime: 30_000,
  })
}

export function useUpsertGroupCMM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cmm: Omit<GroupCMM, "createdAt" | "updatedAt">) => {
      const { error } = await db.from("group_cmms").upsert({
        id:            cmm.id || undefined,
        manufacturer:  cmm.manufacturer,
        doc_number:    cmm.docNumber,
        ata_chapter:   cmm.ataChapter,
        revision:      cmm.revision,
        revision_date: cmm.revisionDate,
        title:         cmm.title,
        applicability: cmm.applicability,
        drive_link:    cmm.driveLink,
        notes:         cmm.notes,
        groups:        cmm.groups,
        updated_at:    new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group_cmms"] })
    },
  })
}

export function useDeleteGroupCMM() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("group_cmms").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group_cmms"] })
    },
  })
}

// ─── CMMs-only update ──────────────────────────────────────────────────────────
// Uses UPDATE (not upsert) so it never creates a partial row with empty arrays
// for all other columns. If no row exists yet the update is a harmless no-op;
// the user must save the main overlay first to create the row.
export function useUpdateCMMs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      tailNumber,
      cmms,
    }: {
      tailNumber: string
      cmms: CMMDocument[]
    }) => {
      const { error } = await db
        .from("aircraft_details")
        .update({ cmms, updated_at: new Date().toISOString() })
        .eq("tail_number", tailNumber)
      if (error) throw error
    },
    onSuccess: (_, { tailNumber }) => {
      qc.invalidateQueries({ queryKey: ["aircraft_detail", tailNumber] })
    },
  })
}
