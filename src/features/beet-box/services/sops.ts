import { supabase } from "@/lib/supabase"
import type { SOP, SOPStep, SOPCategory } from "../types"

export async function getSOPs(filters?: {
  category?: SOPCategory
  search?: string
}): Promise<SOP[]> {
  let query = supabase
    .from("bb_sops")
    .select("*, bb_sop_steps(*), bb_sop_related(related_sop_id)")
    .order("sop_number")

  if (filters?.category) query = query.eq("category", filters.category)
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(mapSOPRow)
}

export async function getSOPById(id: string): Promise<SOP | null> {
  const { data, error } = await supabase
    .from("bb_sops")
    .select("*, bb_sop_steps(*), bb_sop_related(related_sop_id)")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapSOPRow(data)
}

export async function createSOP(
  payload: Omit<SOP, "id" | "steps" | "relatedSopIds" | "createdAt" | "updatedAt"> & {
    steps?: Array<Omit<SOPStep, "id" | "sopId">>
    relatedSopIds?: string[]
  }
): Promise<SOP> {
  const { data: sop, error: sopErr } = await supabase
    .from("bb_sops")
    .insert({
      sop_number: payload.sopNumber,
      title: payload.title,
      category: payload.category,
      revision: payload.revision,
      effective_date: payload.effectiveDate ?? null,
      review_date: payload.reviewDate ?? null,
      author: payload.author ?? null,
      approved_by: payload.approvedBy ?? null,
      description: payload.description,
      tags: payload.tags,
    })
    .select("id")
    .single()

  if (sopErr) throw sopErr

  if (payload.steps?.length) {
    await supabase.from("bb_sop_steps").insert(
      payload.steps.map((s) => ({
        sop_id: sop.id,
        step_number: s.stepNumber,
        instruction: s.instruction,
        note: s.note ?? null,
        warning: s.warning ?? null,
      }))
    )
  }

  if (payload.relatedSopIds?.length) {
    await supabase.from("bb_sop_related").insert(
      payload.relatedSopIds.map((rid) => ({ sop_id: sop.id, related_sop_id: rid }))
    )
  }

  return (await getSOPById(sop.id))!
}

function mapSOPRow(row: any): SOP {
  const steps: SOPStep[] = ((row.bb_sop_steps ?? []) as any[])
    .sort((a, b) => a.step_number - b.step_number)
    .map((s) => ({
      id: s.id,
      sopId: s.sop_id,
      stepNumber: s.step_number,
      instruction: s.instruction,
      note: s.note,
      warning: s.warning,
    }))

  const relatedSopIds: string[] = (row.bb_sop_related ?? []).map((r: any) => r.related_sop_id)

  return {
    id: row.id,
    sopNumber: row.sop_number,
    title: row.title,
    category: row.category as SOPCategory,
    revision: row.revision,
    effectiveDate: row.effective_date,
    reviewDate: row.review_date,
    author: row.author,
    approvedBy: row.approved_by,
    description: row.description,
    tags: row.tags ?? [],
    steps,
    relatedSopIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
