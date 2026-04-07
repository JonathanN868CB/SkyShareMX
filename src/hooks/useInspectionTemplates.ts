import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { InspectionCardTemplate, TemplateAuditEntry, FieldDef } from "@/entities/supabase"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Fetch all templates ───────────────────────────────────────────────────────

export function useTemplates() {
  return useQuery<InspectionCardTemplate[]>({
    queryKey: ["inspection_card_templates"],
    queryFn: async () => {
      const { data, error } = await db
        .from("inspection_card_templates")
        .select("*")
        .order("created_at", { ascending: true })
      if (error) throw error
      return (data ?? []) as InspectionCardTemplate[]
    },
    staleTime: 30_000,
  })
}

// ─── Fetch audit log for a single template ────────────────────────────────────

export function useTemplateAudit(templateId: string | undefined) {
  return useQuery<TemplateAuditEntry[]>({
    queryKey: ["inspection_card_template_audit", templateId],
    queryFn: async () => {
      const { data, error } = await db
        .from("inspection_card_template_audit")
        .select("*")
        .eq("template_id", templateId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as TemplateAuditEntry[]
    },
    enabled: !!templateId,
    staleTime: 30_000,
  })
}

// ─── Create template ──────────────────────────────────────────────────────────

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      aircraft_type,
      field_schema,
      actorId,
      actorName,
    }: {
      name: string
      aircraft_type?: string
      field_schema?: FieldDef[]
      actorId: string
      actorName: string
    }) => {
      const { data, error } = await db
        .from("inspection_card_templates")
        .insert({
          name,
          aircraft_type: aircraft_type ?? null,
          field_schema: field_schema ?? [],
          created_by: actorId,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        })
        .select("id")
        .single()
      if (error) throw error

      await db.from("inspection_card_template_audit").insert({
        template_id: data.id,
        action: "created",
        actor_id: actorId,
        actor_name: actorName,
        details: { name },
      })

      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection_card_templates"] })
    },
  })
}

// ─── Copy template ────────────────────────────────────────────────────────────

export function useCopyTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      source,
      actorId,
      actorName,
    }: {
      source: InspectionCardTemplate
      actorId: string
      actorName: string
    }) => {
      const newName = `${source.name} (Copy)`
      const { data, error } = await db
        .from("inspection_card_templates")
        .insert({
          name: newName,
          aircraft_type: source.aircraft_type,
          field_schema: source.field_schema,
          created_by: actorId,
          updated_at: new Date().toISOString(),
          updated_by: actorId,
        })
        .select("id")
        .single()
      if (error) throw error

      await db.from("inspection_card_template_audit").insert({
        template_id: data.id,
        action: "copied_from",
        actor_id: actorId,
        actor_name: actorName,
        details: { source_id: source.id, source_name: source.name, new_name: newName },
      })

      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection_card_templates"] })
    },
  })
}

// ─── Rename template ──────────────────────────────────────────────────────────

export function useRenameTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      previousName,
      actorId,
      actorName,
    }: {
      id: string
      name: string
      previousName: string
      actorId: string
      actorName: string
    }) => {
      const { error } = await db
        .from("inspection_card_templates")
        .update({ name, updated_at: new Date().toISOString(), updated_by: actorId })
        .eq("id", id)
      if (error) throw error

      await db.from("inspection_card_template_audit").insert({
        template_id: id,
        action: "renamed",
        actor_id: actorId,
        actor_name: actorName,
        details: { from: previousName, to: name },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection_card_templates"] })
      qc.invalidateQueries({ queryKey: ["fourteen-day-checks", "fleet"] })
    },
  })
}

// ─── Save field schema ────────────────────────────────────────────────────────

export function useUpdateTemplateFields() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      field_schema,
      action,
      actorId,
      actorName,
      details,
    }: {
      id: string
      field_schema: FieldDef[]
      action: string
      actorId: string
      actorName: string
      details?: Record<string, unknown>
    }) => {
      const { error } = await db
        .from("inspection_card_templates")
        .update({ field_schema, updated_at: new Date().toISOString(), updated_by: actorId })
        .eq("id", id)
      if (error) throw error

      await db.from("inspection_card_template_audit").insert({
        template_id: id,
        action,
        actor_id: actorId,
        actor_name: actorName,
        details: details ?? null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection_card_templates"] })
    },
  })
}

// ─── Delete template (Super Admin only — enforced by RLS) ─────────────────────

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("inspection_card_templates")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection_card_templates"] })
      qc.invalidateQueries({ queryKey: ["fourteen-day-checks", "fleet"] })
    },
  })
}

// ─── Assign template to an aircraft token ─────────────────────────────────────

export function useAssignTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      tokenId,
      templateId,
      templateName,
      registration,
      actorId,
      actorName,
    }: {
      tokenId: string
      templateId: string | null
      templateName: string | null
      registration: string
      actorId: string
      actorName: string
    }) => {
      const { error } = await db
        .from("fourteen_day_check_tokens")
        .update({ template_id: templateId })
        .eq("id", tokenId)
      if (error) throw error

      // Write audit entry to the template being assigned (if assigning)
      if (templateId) {
        await db.from("inspection_card_template_audit").insert({
          template_id: templateId,
          action: "aircraft_assigned",
          actor_id: actorId,
          actor_name: actorName,
          details: { registration, token_id: tokenId },
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fourteen-day-checks", "fleet"] })
    },
  })
}

// ─── Delete a single audit entry (Super Admin only — enforced by RLS) ─────────

export function useDeleteAuditEntry(templateId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await db
        .from("inspection_card_template_audit")
        .delete()
        .eq("id", entryId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspection_card_template_audit", templateId] })
    },
  })
}
