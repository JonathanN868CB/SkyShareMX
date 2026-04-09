import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { FourteenDayCheckToken, FourteenDayCheckSubmission, FourteenDayCheckAttachment, FieldDef } from "@/entities/supabase"
import { encodeToken } from "@/shared/lib/tokenEncoder"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Derived types ────────────────────────────────────────────────────────────

export type CheckStatus = "ok" | "due_soon" | "overdue" | "never"

export type AircraftCheckSummary = {
  tokenId: string
  encodedToken: string           // base62 for URL
  aircraftId: string
  registration: string
  model: string | null
  traxxallUrl: string | null
  templateId: string | null
  templateName: string | null
  lastSubmittedAt: string | null
  lastReviewStatus: FourteenDayCheckSubmission["review_status"] | null
  daysSince: number | null
  status: CheckStatus
  hasPendingSubmission: boolean
  hasFlaggedSubmission: boolean
  lastDispatch: { id: string; sentToName: string; sentToEmail: string; sentAt: string } | null
}

function computeStatus(daysSince: number | null): CheckStatus {
  if (daysSince === null) return "never"
  if (daysSince > 14) return "overdue"
  if (daysSince > 10) return "due_soon"
  return "ok"
}

function daysBetween(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

// ─── Fleet check summaries ────────────────────────────────────────────────────

async function fetchFleetSummaries(): Promise<AircraftCheckSummary[]> {
  // Load all tokens with aircraft + current registration
  const { data: tokens, error: tErr } = await db
    .from("fourteen_day_check_tokens")
    .select(`
      id,
      token,
      aircraft_id,
      traxxall_url,
      template_id,
      template:template_id ( id, name ),
      aircraft:aircraft_id (
        id,
        model_full,
        aircraft_registrations (registration, is_current)
      )
    `)

  if (tErr) throw tErr
  if (!tokens?.length) return []

  // Load all submissions (just enough fields to compute status per aircraft)
  const tokenIds = tokens.map((t: any) => t.id)
  const { data: allSubs, error: sErr } = await db
    .from("fourteen_day_check_submissions")
    .select("id, token_id, aircraft_id, submitted_at, review_status")
    .in("token_id", tokenIds)
    .order("submitted_at", { ascending: false })

  if (sErr) throw sErr

  // Load latest dispatch per token
  const { data: allDispatches } = await db
    .from("fourteen_day_check_dispatches")
    .select("id, token_id, sent_to_name, sent_to_email, sent_at")
    .in("token_id", tokenIds)
    .order("sent_at", { ascending: false })

  const latestDispatchByToken = new Map<string, { id: string; sentToName: string; sentToEmail: string; sentAt: string }>()
  for (const d of (allDispatches ?? [])) {
    if (!latestDispatchByToken.has(d.token_id)) {
      latestDispatchByToken.set(d.token_id, {
        id:          d.id,
        sentToName:  d.sent_to_name,
        sentToEmail: d.sent_to_email,
        sentAt:      d.sent_at,
      })
    }
  }

  // Latest submission per token_id
  const latestByToken = new Map<string, FourteenDayCheckSubmission>()
  for (const sub of (allSubs ?? [])) {
    if (!latestByToken.has(sub.token_id)) {
      latestByToken.set(sub.token_id, sub)
    }
  }

  // Pending submissions per token_id (for badge)
  const pendingTokenIds = new Set<string>(
    (allSubs ?? [])
      .filter((s: any) => s.review_status === "pending")
      .map((s: any) => s.token_id)
  )

  // Flagged submissions per token_id (for summary tile)
  const flaggedTokenIds = new Set<string>(
    (allSubs ?? [])
      .filter((s: any) => s.review_status === "flagged")
      .map((s: any) => s.token_id)
  )

  return tokens.map((t: any) => {
    const regs = t.aircraft?.aircraft_registrations ?? []
    const currentReg = regs.find((r: any) => r.is_current)
    const registration = currentReg?.registration ?? "UNKNOWN"

    const latest = latestByToken.get(t.id) ?? null
    const daysSince = latest ? daysBetween(latest.submitted_at) : null
    const status = computeStatus(daysSince)

    const dispatch = latestDispatchByToken.get(t.id) ?? null
    // Only show the dispatch indicator if it was sent after the most recent submission.
    // Once a submission comes in (or is archived/cleared), the dispatch is "answered".
    const dispatchIsUnanswered =
      dispatch !== null &&
      (latest === null || dispatch.sentAt > latest.submitted_at)

    return {
      tokenId: t.id,
      encodedToken: encodeToken(t.token),
      aircraftId: t.aircraft_id,
      registration,
      model: t.aircraft?.model_full ?? null,
      traxxallUrl: t.traxxall_url ?? null,
      templateId: t.template_id ?? null,
      templateName: (t.template as { name?: string } | null)?.name ?? null,
      lastSubmittedAt: latest?.submitted_at ?? null,
      lastReviewStatus: latest?.review_status ?? null,
      daysSince,
      status,
      hasPendingSubmission: pendingTokenIds.has(t.id),
      hasFlaggedSubmission: flaggedTokenIds.has(t.id),
      lastDispatch: dispatchIsUnanswered ? dispatch : null,
    }
  })
}

export function useFleetCheckSummaries() {
  return useQuery({
    queryKey: ["fourteen-day-checks", "fleet"],
    queryFn: fetchFleetSummaries,
    staleTime: 30_000,
    retry: 1,
  })
}

// ─── Pending submissions queue ────────────────────────────────────────────────

export type PendingSubmission = FourteenDayCheckSubmission & {
  registration: string
}

async function fetchPendingSubmissions(): Promise<PendingSubmission[]> {
  const { data, error } = await db
    .from("fourteen_day_check_submissions")
    .select(`
      id,
      token_id,
      aircraft_id,
      submitter_name,
      field_values,
      notes,
      submitted_at,
      submitter_ip,
      review_status,
      review_notes,
      reviewed_by,
      reviewed_at,
      token:token_id (
        aircraft:aircraft_id (
          aircraft_registrations (registration, is_current)
        )
      )
    `)
    .eq("review_status", "pending")
    .order("submitted_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any) => {
    const regs = row.token?.aircraft?.aircraft_registrations ?? []
    const currentReg = regs.find((r: any) => r.is_current)
    return {
      ...row,
      registration: currentReg?.registration ?? "UNKNOWN",
    }
  })
}

export function usePendingSubmissions() {
  return useQuery({
    queryKey: ["fourteen-day-checks", "pending"],
    queryFn: fetchPendingSubmissions,
    staleTime: 15_000,
    retry: 1,
  })
}

// ─── Single submission with attachments ──────────────────────────────────────

async function fetchSubmission(id: string): Promise<FourteenDayCheckSubmission> {
  const { data, error } = await db
    .from("fourteen_day_check_submissions")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data as FourteenDayCheckSubmission
}

export function useCheckSubmission(id: string | undefined) {
  return useQuery({
    queryKey: ["fourteen-day-checks", "submission", id],
    queryFn: () => fetchSubmission(id!),
    enabled: !!id,
    staleTime: 10_000,
    retry: 1,
  })
}

async function fetchAttachments(submissionId: string): Promise<FourteenDayCheckAttachment[]> {
  const { data, error } = await db
    .from("fourteen_day_check_attachments")
    .select("*")
    .eq("submission_id", submissionId)
    .order("uploaded_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as FourteenDayCheckAttachment[]
}

export function useCheckAttachments(submissionId: string | undefined) {
  return useQuery({
    queryKey: ["fourteen-day-checks", "attachments", submissionId],
    queryFn: () => fetchAttachments(submissionId!),
    enabled: !!submissionId,
    staleTime: 30_000,
    retry: 1,
  })
}

// ─── History for a single aircraft ───────────────────────────────────────────

async function fetchHistory(tokenId: string): Promise<FourteenDayCheckSubmission[]> {
  const { data, error } = await db
    .from("fourteen_day_check_submissions")
    .select("*")
    .eq("token_id", tokenId)
    .order("submitted_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as FourteenDayCheckSubmission[]
}

export function useCheckHistory(tokenId: string | undefined) {
  return useQuery({
    queryKey: ["fourteen-day-checks", "history", tokenId],
    queryFn: () => fetchHistory(tokenId!),
    enabled: !!tokenId,
    staleTime: 30_000,
    retry: 1,
  })
}

// ─── Signed download URL for an attachment ────────────────────────────────────

export async function getCheckPhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("fourteen-day-checks")
    .createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to get download URL")
  return data.signedUrl
}

// ─── Review actions ───────────────────────────────────────────────────────────

export async function updateSubmissionStatus(
  id: string,
  status: FourteenDayCheckSubmission["review_status"],
  notes?: string,
  reviewedBy?: string
): Promise<void> {
  const update: Record<string, unknown> = { review_status: status }
  if (notes !== undefined) update.review_notes = notes
  if (status !== "pending") {
    update.reviewed_at = new Date().toISOString()
    if (reviewedBy) update.reviewed_by = reviewedBy
  }
  const { error } = await db
    .from("fourteen_day_check_submissions")
    .update(update)
    .eq("id", id)
  if (error) throw error
}

export async function saveReviewNotes(id: string, notes: string): Promise<void> {
  const { error } = await db
    .from("fourteen_day_check_submissions")
    .update({ review_notes: notes })
    .eq("id", id)
  if (error) throw error
}

export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await db
    .from("fourteen_day_check_submissions")
    .delete()
    .eq("id", id)
  if (error) throw error
}

export async function deleteDispatch(id: string): Promise<void> {
  const { error } = await db
    .from("fourteen_day_check_dispatches")
    .delete()
    .eq("id", id)
  if (error) throw error
}

// ─── Field schema for a single token ─────────────────────────────────────────

async function fetchTokenFieldSchema(tokenId: string): Promise<FieldDef[]> {
  const { data, error } = await db
    .from("fourteen_day_check_tokens")
    .select("field_schema")
    .eq("id", tokenId)
    .single()
  if (error) throw error
  return (data?.field_schema ?? []) as FieldDef[]
}

export function useTokenFieldSchema(tokenId: string | undefined) {
  return useQuery({
    queryKey: ["fourteen-day-checks", "token-schema", tokenId],
    queryFn: () => fetchTokenFieldSchema(tokenId!),
    enabled: !!tokenId,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

// ─── Invalidation ────────────────────────────────────────────────────────────

export function useInvalidateChecks() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["fourteen-day-checks"] })
  }
}
