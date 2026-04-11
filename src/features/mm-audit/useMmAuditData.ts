import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { FLEET_FAMILY_NAMES } from "@/pages/aircraft/fleetData"
import type {
  MmSourceDocument,
  MmAircraftDocument,
  MmAuditCampaign,
  MmAuditRecord,
  MmMelTracking,
  MmCampaignRevisionChange,
  AircraftDocumentRow,
  AircraftAuditSummary,
  AuditProfileGroup,
  AuditStatus,
  CampaignSummary,
} from "./types"

// mm_ tables were created after the last type generation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve the current auth user's profiles.id (FK target for created_by / updated_by / audited_by) */
async function getProfileId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await db.from("profiles").select("id").eq("user_id", user.id).single()
  return data?.id ?? null
}

function getAuditStatus(latestAudit: MmAuditRecord | null): AuditStatus {
  if (!latestAudit) return "never_audited"
  const due = new Date(latestAudit.next_due_date)
  const now = new Date()
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
  if (daysUntilDue < 0) return "overdue"
  if (daysUntilDue <= 30) return "due_soon"
  return "current"
}

function computeFingerprint(docs: { source_document_id: string; assembly_type: string; requirement_type: string; section: string | null }[]): string {
  const sorted = [...docs]
    .sort((a, b) =>
      (a.source_document_id + a.assembly_type + a.requirement_type).localeCompare(
        b.source_document_id + b.assembly_type + b.requirement_type
      )
    )
  const key = sorted
    .map(d => `${d.source_document_id}|${d.assembly_type}|${d.requirement_type}|${d.section ?? ""}`)
    .join("||")
  // Simple hash — djb2
  let hash = 5381
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

// ─── Fleet Overview (all aircraft docs + latest audits) ─────────────────────

export function useMmFleetOverview() {
  return useQuery<{
    rows: AircraftDocumentRow[]
    summaries: AircraftAuditSummary[]
    profiles: AuditProfileGroup[]
  }>({
    queryKey: ["mm_fleet_overview"],
    queryFn: async () => {
      // 1. Fetch aircraft documents with source doc + aircraft info
      const { data: adRows, error: adErr } = await db
        .from("mm_aircraft_documents")
        .select(`
          *,
          source_document:mm_source_documents(*),
          aircraft:aircraft!inner(
            id,
            model_full,
            model_family,
            aircraft_registrations!inner(registration, is_current)
          )
        `)
        .eq("is_applicable", true)

      if (adErr) throw adErr

      // 2. Fetch latest audit per aircraft_document_id — only from CLOSED campaigns (or ad-hoc with no campaign)
      const { data: auditRows, error: auditErr } = await db
        .from("mm_audit_records")
        .select("*, campaign:mm_audit_campaigns(status)")
        .order("audit_date", { ascending: false })

      if (auditErr) throw auditErr

      // Build latest audit lookup — only count finalized records (closed campaign or no campaign)
      const latestAuditMap = new Map<string, MmAuditRecord>()
      for (const ar of auditRows ?? []) {
        const campaignStatus = (ar as any).campaign?.status
        const isFinalized = !ar.campaign_id || campaignStatus === "closed"
        if (isFinalized && !latestAuditMap.has(ar.aircraft_document_id)) {
          latestAuditMap.set(ar.aircraft_document_id, ar)
        }
      }

      // 3. Map to AircraftDocumentRow
      const rows: AircraftDocumentRow[] = (adRows ?? [])
        .filter((r: any) => r.aircraft.aircraft_registrations?.some((reg: any) => reg.is_current))
        .map((r: any) => {
          const currentReg = r.aircraft.aircraft_registrations.find((reg: any) => reg.is_current)
          return {
            ...r,
            registration: currentReg?.registration ?? "",
            model: r.aircraft.model_full ?? r.aircraft.model_family,
            model_family: r.aircraft.model_family,
            source_document: r.source_document as MmSourceDocument,
            latest_audit: latestAuditMap.get(r.id) ?? null,
            aircraft: undefined,
          }
        })

      // 4. Compute per-aircraft summaries
      const byAircraft = new Map<string, AircraftDocumentRow[]>()
      for (const row of rows) {
        const list = byAircraft.get(row.aircraft_id) ?? []
        list.push(row)
        byAircraft.set(row.aircraft_id, list)
      }

      const summaries: AircraftAuditSummary[] = []
      for (const [aircraftId, docs] of byAircraft) {
        const first = docs[0]
        const statuses = docs.map(d => getAuditStatus(d.latest_audit))
        const overdue = statuses.filter(s => s === "overdue").length
        const dueSoon = statuses.filter(s => s === "due_soon").length
        const audited = statuses.filter(s => s !== "never_audited").length
        const worstStatus: AuditStatus =
          overdue > 0 ? "overdue" :
          statuses.includes("never_audited") ? "never_audited" :
          dueSoon > 0 ? "due_soon" : "current"

        summaries.push({
          aircraft_id: aircraftId,
          registration: first.registration,
          model: first.model,
          model_family: first.model_family,
          total_docs: docs.length,
          audited_docs: audited,
          overdue_docs: overdue,
          due_soon_docs: dueSoon,
          status: worstStatus,
        })
      }

      // 5. Compute audit profile groups — grouped by model_family (matches FLEET layout)
      const familyMap = new Map<string, { aircraft: AircraftAuditSummary[]; docs: AircraftDocumentRow[] }>()
      for (const [aircraftId, docs] of byAircraft) {
        const family = docs[0]?.model_family ?? "Unknown"
        const entry = familyMap.get(family) ?? { aircraft: [], docs: [] }
        const summary = summaries.find(s => s.aircraft_id === aircraftId)
        if (summary) entry.aircraft.push(summary)
        // Collect all unique docs across aircraft in this family
        for (const d of docs) {
          if (!entry.docs.some(existing => existing.source_document_id === d.source_document_id && existing.assembly_type === d.assembly_type && existing.requirement_type === d.requirement_type)) {
            entry.docs.push(d)
          }
        }
        familyMap.set(family, entry)
      }

      const profiles: AuditProfileGroup[] = []
      for (const [family, { aircraft, docs }] of familyMap) {
        profiles.push({
          fingerprint: family,
          display_name: family,
          aircraft,
          documents: docs,
          total_items: aircraft.reduce((sum, a) => sum + a.total_docs, 0),
          audited_items: aircraft.reduce((sum, a) => sum + a.audited_docs, 0),
        })
      }

      // Sort by FLEET family order (matches Aircraft Info tab layout)
      profiles.sort((a, b) => {
        const aIdx = FLEET_FAMILY_NAMES.indexOf(a.display_name)
        const bIdx = FLEET_FAMILY_NAMES.indexOf(b.display_name)
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
      })

      return { rows, summaries, profiles }
    },
    staleTime: 30_000,
  })
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export function useMmCampaigns() {
  return useQuery<CampaignSummary[]>({
    queryKey: ["mm_campaigns"],
    queryFn: async () => {
      const { data: campaigns, error } = await db
        .from("mm_audit_campaigns")
        .select("*")
        .order("period_start", { ascending: false })

      if (error) throw error
      if (!campaigns?.length) return []

      // For each campaign, count total applicable docs and audited records
      const { count: totalCount } = await db
        .from("mm_aircraft_documents")
        .select("*", { count: "exact", head: true })
        .eq("is_applicable", true)

      const result: CampaignSummary[] = []
      for (const c of campaigns) {
        const { count: auditedCount } = await db
          .from("mm_audit_records")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", c.id)
        const { count: stagedRevCount } = await db
          .from("mm_campaign_revision_changes")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", c.id)
        const now = new Date()
        const end = new Date(c.period_end)
        const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000))

        const total = totalCount ?? 0
        const audited = auditedCount ?? 0
        result.push({
          ...c,
          total_items: total,
          audited_items: audited,
          progress_pct: total > 0 ? Math.round((audited / total) * 100) : 0,
          days_remaining: daysRemaining,
          staged_revision_count: stagedRevCount ?? 0,
        })
      }

      return result
    },
    staleTime: 30_000,
  })
}

// ─── Create Campaign ────────────────────────────────────────────────────────

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; period_start: string; period_end: string }) => {
      const profileId = await getProfileId()
      const { error } = await db
        .from("mm_audit_campaigns")
        .insert({
          name: input.name,
          period_start: input.period_start,
          period_end: input.period_end,
          created_by: profileId,
        })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
    },
  })
}

// ─── Backdate Campaign (Super Admin — backfill history) ────────────────────

export function useBackdateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      period_start: string
      period_end: string
      audit_date: string
      /** Per source-document revision overrides; key = source_document_id, value = revision string */
      revisionOverrides: Record<string, string>
    }) => {
      const profileId = await getProfileId()
      const now = new Date().toISOString()

      // 1. Create campaign already closed
      const { data: campaign, error: campErr } = await db
        .from("mm_audit_campaigns")
        .insert({
          name: input.name,
          period_start: input.period_start,
          period_end: input.period_end,
          status: "closed",
          closed_at: now,
          created_by: profileId,
          approved_by_admin: profileId,
          approved_by_admin_at: now,
          approved_by_super_admin: profileId,
          approved_by_super_admin_at: now,
        })
        .select("id")
        .single()

      if (campErr) throw campErr
      const campaignId = campaign.id

      // 2. Fetch all applicable aircraft documents with source doc
      const { data: adRows, error: adErr } = await db
        .from("mm_aircraft_documents")
        .select("id, source_document_id, source_document:mm_source_documents(current_revision)")
        .eq("is_applicable", true)

      if (adErr) throw adErr

      // 3. Create audit records for every aircraft-document
      const records = (adRows ?? []).map((row: any) => {
        const sdCurrentRev = row.source_document?.current_revision ?? "TBD"
        const overrideRev = input.revisionOverrides[row.source_document_id]
        return {
          aircraft_document_id: row.id,
          campaign_id: campaignId,
          audited_revision: overrideRev ?? sdCurrentRev,
          audit_date: input.audit_date,
          audited_by: profileId,
          notes: "Backdated audit — historical backfill",
        }
      })

      // Insert in batches of 50 to avoid payload limits
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50)
        const { error } = await db.from("mm_audit_records").insert(batch)
        if (error) throw error
      }

      return { campaignId, recordCount: records.length }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
    },
  })
}

// ─── Batch Create Audit Records ─────────────────────────────────────────────

export function useCreateAuditRecordBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      records: {
        aircraft_document_id: string
        audited_revision: string
        audit_date: string
        campaign_id?: string | null
        notes?: string | null
      }[]
    }) => {
      const profileId = await getProfileId()
      const rows = input.records.map(r => ({
        aircraft_document_id: r.aircraft_document_id,
        audited_revision: r.audited_revision,
        audit_date: r.audit_date,
        campaign_id: r.campaign_id ?? null,
        audited_by: profileId,
        notes: r.notes ?? null,
      }))
      const { error } = await db.from("mm_audit_records").insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
    },
  })
}

// ─── Audit History for a specific aircraft-document pair ─────────────────────

export function useAuditHistory(aircraftDocumentId: string | null) {
  return useQuery<MmAuditRecord[]>({
    queryKey: ["mm_audit_history", aircraftDocumentId],
    queryFn: async () => {
      if (!aircraftDocumentId) return []
      const { data, error } = await db
        .from("mm_audit_records")
        .select("*")
        .eq("aircraft_document_id", aircraftDocumentId)
        .order("audit_date", { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!aircraftDocumentId,
    staleTime: 30_000,
  })
}

// ─── Workspace: items grouped by source document ────────────────────────────

export interface WorkspaceDocGroup {
  source_document_id: string
  document_number: string
  document_name: string
  document_url: string | null
  current_revision: string
  current_rev_date: string | null
  items: WorkspaceItem[]
  all_reviewed: boolean
  has_revision_change: boolean
  previous_revision: string | null
  /** True when the revision change is staged (not yet applied to the permanent DB) */
  is_staged: boolean
}

export interface WorkspaceItem {
  aircraft_document_id: string
  aircraft_id: string
  registration: string
  model: string
  model_family: string
  assembly_type: string
  requirement_type: string
  section: string | null
  assembly_detail: string | null
  current_revision: string
  latest_audit: MmAuditRecord | null
  status: AuditStatus
}

export function useMmWorkspaceData(campaignId: string | null) {
  return useQuery<WorkspaceDocGroup[]>({
    queryKey: ["mm_workspace", campaignId],
    queryFn: async () => {
      // Fetch all applicable aircraft documents with source doc + aircraft info
      const { data: adRows, error: adErr } = await db
        .from("mm_aircraft_documents")
        .select(`
          id,
          aircraft_id,
          source_document_id,
          assembly_type,
          requirement_type,
          section,
          assembly_detail,
          source_document:mm_source_documents(*),
          aircraft:aircraft!inner(
            id,
            model_full,
            model_family,
            aircraft_registrations!inner(registration, is_current)
          )
        `)
        .eq("is_applicable", true)

      if (adErr) throw adErr

      // Fetch staged revision changes for this campaign
      const stagedRevMap = new Map<string, MmCampaignRevisionChange>()
      if (campaignId) {
        const { data: stagedRows } = await db
          .from("mm_campaign_revision_changes")
          .select("*")
          .eq("campaign_id", campaignId)
        for (const sr of stagedRows ?? []) {
          stagedRevMap.set(sr.source_document_id, sr)
        }
      }

      // Fetch latest audit per aircraft_document_id (all records — workspace sees everything)
      const { data: auditRows, error: auditErr } = await db
        .from("mm_audit_records")
        .select("*")
        .order("audit_date", { ascending: false })

      if (auditErr) throw auditErr

      const latestAuditMap = new Map<string, MmAuditRecord>()
      for (const ar of auditRows ?? []) {
        if (!latestAuditMap.has(ar.aircraft_document_id)) {
          latestAuditMap.set(ar.aircraft_document_id, ar)
        }
      }

      // Group by source_document_id
      const groupMap = new Map<string, WorkspaceDocGroup>()

      for (const r of (adRows ?? []).filter((row: any) => row.aircraft.aircraft_registrations?.some((reg: any) => reg.is_current))) {
        const sd = r.source_document as MmSourceDocument
        const staged = stagedRevMap.get(r.source_document_id)
        // In the workspace, show the staged revision if one exists for this campaign
        const effectiveRevision = staged?.new_revision ?? sd.current_revision
        const latestAudit = latestAuditMap.get(r.id) ?? null
        const currentReg = r.aircraft.aircraft_registrations.find((reg: any) => reg.is_current)

        const item: WorkspaceItem = {
          aircraft_document_id: r.id,
          aircraft_id: r.aircraft_id,
          registration: currentReg?.registration ?? "",
          model: r.aircraft.model_full ?? r.aircraft.model_family,
          model_family: r.aircraft.model_family,
          assembly_type: r.assembly_type,
          requirement_type: r.requirement_type,
          section: r.section,
          assembly_detail: r.assembly_detail,
          current_revision: effectiveRevision,
          latest_audit: latestAudit,
          status: getAuditStatus(latestAudit),
        }

        let group = groupMap.get(r.source_document_id)
        if (!group) {
          group = {
            source_document_id: r.source_document_id,
            document_number: sd.document_number,
            document_name: sd.document_name,
            document_url: sd.document_url ?? null,
            current_revision: effectiveRevision,
            current_rev_date: sd.current_rev_date,
            items: [],
            all_reviewed: true,
            has_revision_change: false,
            previous_revision: staged ? staged.old_revision : null,
            is_staged: !!staged,
          }
          groupMap.set(r.source_document_id, group)
        }

        group.items.push(item)

        if (item.status !== "current") group.all_reviewed = false
        if (staged) {
          // Staged revision change — flag it
          group.has_revision_change = true
          group.previous_revision = staged.old_revision
        } else if (latestAudit && latestAudit.audited_revision !== sd.current_revision) {
          group.has_revision_change = true
          group.previous_revision = latestAudit.audited_revision
        }
      }

      const groups = [...groupMap.values()]
      // Sort by FLEET family order, then by document name within same family
      groups.sort((a, b) => {
        const aFamily = a.items[0]?.model_family ?? ""
        const bFamily = b.items[0]?.model_family ?? ""
        const aIdx = FLEET_FAMILY_NAMES.indexOf(aFamily)
        const bIdx = FLEET_FAMILY_NAMES.indexOf(bFamily)
        const familyDiff = (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
        if (familyDiff !== 0) return familyDiff
        return a.document_name.localeCompare(b.document_name)
      })
      return groups
    },
    staleTime: 30_000,
  })
}

// ─── Source Documents (full CRUD) ───────────────────────────────────────────

export function useSourceDocuments() {
  return useQuery<MmSourceDocument[]>({
    queryKey: ["mm_source_documents"],
    queryFn: async () => {
      const { data, error } = await db
        .from("mm_source_documents")
        .select("*")
        .order("document_name")
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })
}

export function useUpsertSourceDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      document_number: string
      document_name: string
      document_url?: string | null
      current_revision: string
      current_rev_date?: string | null
      notes?: string | null
    }) => {
      const profileId = await getProfileId()
      const row = {
        ...input,
        updated_by: profileId,
        updated_at: new Date().toISOString(),
      }
      if (input.id) {
        const { error } = await db.from("mm_source_documents").update(row).eq("id", input.id)
        if (error) throw error
      } else {
        const { error } = await db.from("mm_source_documents").insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_source_documents"] })
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
    },
  })
}

// ─── Staged Revision Update (writes to campaign staging table, not source docs) ─

export function useStageRevisionChange() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      campaign_id: string
      source_document_id: string
      old_revision: string
      new_revision: string
    }) => {
      const profileId = await getProfileId()
      // Upsert — if already staged for this campaign+doc, update it
      const { data: existing } = await db
        .from("mm_campaign_revision_changes")
        .select("id")
        .eq("campaign_id", input.campaign_id)
        .eq("source_document_id", input.source_document_id)
        .maybeSingle()

      if (existing) {
        const { error } = await db
          .from("mm_campaign_revision_changes")
          .update({
            old_revision: input.old_revision,
            new_revision: input.new_revision,
            proposed_by: profileId,
            proposed_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
        if (error) throw error
      } else {
        const { error } = await db
          .from("mm_campaign_revision_changes")
          .insert({
            campaign_id: input.campaign_id,
            source_document_id: input.source_document_id,
            old_revision: input.old_revision,
            new_revision: input.new_revision,
            proposed_by: profileId,
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
    },
  })
}

/** Revert a staged revision change (delete from staging table) */
export function useRevertStagedRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { campaign_id: string; source_document_id: string }) => {
      const { error } = await db
        .from("mm_campaign_revision_changes")
        .delete()
        .eq("campaign_id", input.campaign_id)
        .eq("source_document_id", input.source_document_id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
    },
  })
}

// ─── Campaign Approval + Finalization ──────────────────────────────────────

/** Admin or Super Admin records their approval on the campaign */
export function useApproveCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { campaign_id: string; role: "Admin" | "Super Admin" }) => {
      const profileId = await getProfileId()
      const now = new Date().toISOString()
      const update = input.role === "Super Admin"
        ? { approved_by_super_admin: profileId, approved_by_super_admin_at: now }
        : { approved_by_admin: profileId, approved_by_admin_at: now }
      const { error } = await db
        .from("mm_audit_campaigns")
        .update(update)
        .eq("id", input.campaign_id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
    },
  })
}

/** Finalize campaign: apply all staged revision changes to source docs, close campaign */
export function useFinalizeCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { campaign_id: string }) => {
      const profileId = await getProfileId()
      const now = new Date().toISOString()

      // 1. Fetch all staged revision changes
      const { data: staged, error: stErr } = await db
        .from("mm_campaign_revision_changes")
        .select("*")
        .eq("campaign_id", input.campaign_id)
      if (stErr) throw stErr

      // 2. Apply each staged revision to the permanent source documents table
      for (const sr of staged ?? []) {
        const { error } = await db
          .from("mm_source_documents")
          .update({
            current_revision: sr.new_revision,
            updated_by: profileId,
            updated_at: now,
          })
          .eq("id", sr.source_document_id)
        if (error) throw error
      }

      // 3. Close the campaign
      const { error: closeErr } = await db
        .from("mm_audit_campaigns")
        .update({ status: "closed", closed_at: now })
        .eq("id", input.campaign_id)
      if (closeErr) throw closeErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
      qc.invalidateQueries({ queryKey: ["mm_source_documents"] })
      qc.invalidateQueries({ queryKey: ["mm_revision_alerts"] })
    },
  })
}

/** Cancel a campaign — Super Admin only. Discards staged revisions, marks cancelled. */
export function useCancelCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { campaign_id: string }) => {
      // Delete staged revision changes
      const { error: delErr } = await db
        .from("mm_campaign_revision_changes")
        .delete()
        .eq("campaign_id", input.campaign_id)
      if (delErr) throw delErr

      // Delete audit records tied to this campaign (they were never finalized)
      const { error: auditDelErr } = await db
        .from("mm_audit_records")
        .delete()
        .eq("campaign_id", input.campaign_id)
      if (auditDelErr) throw auditDelErr

      // Mark campaign cancelled
      const { error: updateErr } = await db
        .from("mm_audit_campaigns")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", input.campaign_id)
      if (updateErr) throw updateErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
    },
  })
}

/** Permanently delete a cancelled campaign — Super Admin only */
export function useDeleteCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { campaign_id: string }) => {
      // CASCADE on mm_campaign_revision_changes handles cleanup
      // Audit records were already deleted on cancel, but clean up any stragglers
      const { error: auditErr } = await db
        .from("mm_audit_records")
        .delete()
        .eq("campaign_id", input.campaign_id)
      if (auditErr) throw auditErr

      const { error } = await db
        .from("mm_audit_campaigns")
        .delete()
        .eq("id", input.campaign_id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_campaigns"] })
    },
  })
}

// ─── Revision Alerts ────────────────────────────────────────────────────────
// A revision alert exists when a source document's current_revision differs
// from the latest audited_revision for any linked aircraft-document.

export interface RevisionAlert {
  source_document_id: string
  document_number: string
  document_name: string
  current_revision: string
  previous_revision: string
  affected_aircraft: { aircraft_document_id: string; registration: string }[]
}

export function useRevisionAlerts() {
  return useQuery<RevisionAlert[]>({
    queryKey: ["mm_revision_alerts"],
    queryFn: async () => {
      // Fetch all aircraft docs with source doc and latest audit
      const { data: adRows, error: adErr } = await db
        .from("mm_aircraft_documents")
        .select(`
          id,
          aircraft_id,
          source_document_id,
          source_document:mm_source_documents(id, document_number, document_name, current_revision),
          aircraft:aircraft!inner(
            id,
            aircraft_registrations!inner(registration, is_current)
          )
        `)
        .eq("is_applicable", true)

      if (adErr) throw adErr

      const { data: auditRows, error: auditErr } = await db
        .from("mm_audit_records")
        .select("aircraft_document_id, audited_revision, campaign_id, campaign:mm_audit_campaigns(status)")
        .order("audit_date", { ascending: false })

      if (auditErr) throw auditErr

      // Only consider finalized audit records (closed campaign or no campaign)
      const latestRevMap = new Map<string, string>()
      for (const ar of auditRows ?? []) {
        const campaignStatus = (ar as any).campaign?.status
        const isFinalized = !ar.campaign_id || campaignStatus === "closed"
        if (isFinalized && !latestRevMap.has(ar.aircraft_document_id)) {
          latestRevMap.set(ar.aircraft_document_id, ar.audited_revision)
        }
      }

      // Group by source document where revision changed
      const alertMap = new Map<string, RevisionAlert>()
      for (const r of (adRows ?? []).filter((row: any) => row.aircraft?.aircraft_registrations?.some((reg: any) => reg.is_current))) {
        const sd = r.source_document as MmSourceDocument
        const lastRev = latestRevMap.get(r.id)
        if (!lastRev || lastRev === sd.current_revision) continue

        let alert = alertMap.get(r.source_document_id)
        if (!alert) {
          alert = {
            source_document_id: r.source_document_id,
            document_number: sd.document_number,
            document_name: sd.document_name,
            current_revision: sd.current_revision,
            previous_revision: lastRev,
            affected_aircraft: [],
          }
          alertMap.set(r.source_document_id, alert)
        }
        const currentReg = r.aircraft?.aircraft_registrations?.find((reg: any) => reg.is_current)
        const reg = currentReg?.registration ?? ""
        if (!alert.affected_aircraft.some((a: { aircraft_document_id: string }) => a.aircraft_document_id === r.id)) {
          alert.affected_aircraft.push({ aircraft_document_id: r.id, registration: reg })
        }
      }

      return [...alertMap.values()]
    },
    staleTime: 30_000,
  })
}

// ─── Aircraft-Document linkage management ───────────────────────────────────

export interface AircraftDocLink {
  id: string
  aircraft_id: string
  registration: string
  source_document_id: string
  assembly_type: string
  requirement_type: string
  section: string | null
  assembly_detail: string | null
  is_applicable: boolean
}

export function useAircraftDocLinks(sourceDocumentId: string | null) {
  return useQuery<AircraftDocLink[]>({
    queryKey: ["mm_aircraft_doc_links", sourceDocumentId],
    queryFn: async () => {
      if (!sourceDocumentId) return []
      const { data, error } = await db
        .from("mm_aircraft_documents")
        .select(`
          id, aircraft_id, source_document_id, assembly_type, requirement_type,
          section, assembly_detail, is_applicable,
          aircraft:aircraft!inner(
            id,
            aircraft_registrations!inner(registration, is_current)
          )
        `)
        .eq("source_document_id", sourceDocumentId)

      if (error) throw error
      return (data ?? [])
        .filter((r: any) => r.aircraft?.aircraft_registrations?.some((reg: any) => reg.is_current))
        .map((r: any) => {
          const currentReg = r.aircraft.aircraft_registrations.find((reg: any) => reg.is_current)
          return {
            id: r.id,
            aircraft_id: r.aircraft_id,
            registration: currentReg?.registration ?? "",
            source_document_id: r.source_document_id,
            assembly_type: r.assembly_type,
            requirement_type: r.requirement_type,
            section: r.section,
            assembly_detail: r.assembly_detail,
            is_applicable: r.is_applicable,
          }
        })
    },
    enabled: !!sourceDocumentId,
    staleTime: 30_000,
  })
}

export function useToggleApplicability() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_applicable }: { id: string; is_applicable: boolean }) => {
      const { error } = await db
        .from("mm_aircraft_documents")
        .update({ is_applicable })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_aircraft_doc_links"] })
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
    },
  })
}

export function useDeleteSourceDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("mm_source_documents").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_source_documents"] })
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
    },
  })
}

export function useUpsertAircraftDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      aircraft_id: string
      source_document_id: string
      assembly_type: string
      requirement_type: string
      section: string | null
      assembly_detail: string | null
      is_applicable: boolean
    }) => {
      if (input.id) {
        const { error } = await db
          .from("mm_aircraft_documents")
          .update({
            assembly_type: input.assembly_type,
            requirement_type: input.requirement_type,
            section: input.section,
            assembly_detail: input.assembly_detail,
            is_applicable: input.is_applicable,
          })
          .eq("id", input.id)
        if (error) throw error
      } else {
        const { error } = await db.from("mm_aircraft_documents").insert({
          aircraft_id: input.aircraft_id,
          source_document_id: input.source_document_id,
          assembly_type: input.assembly_type,
          requirement_type: input.requirement_type,
          section: input.section,
          assembly_detail: input.assembly_detail,
          is_applicable: input.is_applicable,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_aircraft_doc_links"] })
      qc.invalidateQueries({ queryKey: ["mm_aircraft_library_docs"] })
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
    },
  })
}

export function useDeleteAircraftDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("mm_aircraft_documents").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_aircraft_doc_links"] })
      qc.invalidateQueries({ queryKey: ["mm_aircraft_library_docs"] })
      qc.invalidateQueries({ queryKey: ["mm_fleet_overview"] })
      qc.invalidateQueries({ queryKey: ["mm_workspace"] })
    },
  })
}

// ─── Per-aircraft library docs (for aircraft info documentation card) ────────

export interface AircraftLibraryDoc {
  id: string
  source_document_id: string
  assembly_type: string
  requirement_type: string
  section: string | null
  assembly_detail: string | null
  document_number: string
  document_name: string
  document_url: string | null
  current_revision: string
  current_rev_date: string | null
}

export function useAircraftLibraryDocs(aircraftId: string | undefined) {
  return useQuery<AircraftLibraryDoc[]>({
    queryKey: ["mm_aircraft_library_docs", aircraftId],
    enabled: !!aircraftId,
    queryFn: async () => {
      const { data, error } = await db
        .from("mm_aircraft_documents")
        .select(`
          id, source_document_id, assembly_type, requirement_type,
          section, assembly_detail,
          source_document:mm_source_documents(
            id, document_number, document_name, document_url,
            current_revision, current_rev_date
          )
        `)
        .eq("aircraft_id", aircraftId!)
        .eq("is_applicable", true)
        .order("assembly_type")
      if (error) throw error
      return (data ?? []).map((row: any) => ({
        id: row.id,
        source_document_id: row.source_document_id,
        assembly_type: row.assembly_type,
        requirement_type: row.requirement_type,
        section: row.section,
        assembly_detail: row.assembly_detail,
        document_number: row.source_document.document_number,
        document_name: row.source_document.document_name,
        document_url: row.source_document.document_url,
        current_revision: row.source_document.current_revision,
        current_rev_date: row.source_document.current_rev_date,
      }))
    },
    staleTime: 30_000,
  })
}

/** All current-registration aircraft for use in pickers */
export function useAllAircraft() {
  return useQuery<{ aircraft_id: string; registration: string; model_full: string }[]>({
    queryKey: ["mm_all_aircraft"],
    queryFn: async () => {
      const { data, error } = await db
        .from("aircraft_registrations")
        .select("aircraft_id, registration, aircraft:aircraft!inner(model_full)")
        .eq("is_current", true)
        .order("registration")
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        aircraft_id: r.aircraft_id,
        registration: r.registration,
        model_full: r.aircraft?.model_full ?? "",
      }))
    },
    staleTime: 60_000,
  })
}

// ─── MEL / Policy Letter Tracking ───────────────────────────────────────────

export function useMelTracking() {
  return useQuery<MmMelTracking[]>({
    queryKey: ["mm_mel_tracking"],
    queryFn: async () => {
      const { data, error } = await db
        .from("mm_mel_tracking")
        .select("*")
        .order("model_family")
        .order("document_type")
        .order("document_number")
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })
}

export function useUpsertMelTracking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      model_family: string
      document_type: "mmel" | "policy_letter"
      document_number: string
      revision_number?: string | null
      revision_date?: string | null
      review_date?: string | null
      next_due_date?: string | null
      update_needed?: boolean
    }) => {
      const profileId = await getProfileId()
      const row = {
        ...input,
        updated_by: profileId,
        updated_at: new Date().toISOString(),
      }
      if (input.id) {
        const { error } = await db.from("mm_mel_tracking").update(row).eq("id", input.id)
        if (error) throw error
      } else {
        const { error } = await db.from("mm_mel_tracking").insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mm_mel_tracking"] })
    },
  })
}
