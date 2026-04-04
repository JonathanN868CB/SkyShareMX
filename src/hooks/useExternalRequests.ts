import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ExternalRequest, ExternalSubmission, ExternalSubmissionAttachment } from "@/entities/supabase"

// ─── List all requests ────────────────────────────────────────────────────────

async function fetchExternalRequests(): Promise<ExternalRequest[]> {
  const { data, error } = await supabase
    .from("external_requests")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as ExternalRequest[]
}

export function useExternalRequests() {
  return useQuery({
    queryKey: ["external-requests"],
    queryFn: fetchExternalRequests,
    staleTime: 30_000,
    retry: 1,
  })
}

// ─── Single request detail ────────────────────────────────────────────────────

async function fetchExternalRequest(id: string): Promise<ExternalRequest> {
  const { data, error } = await supabase
    .from("external_requests")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data as ExternalRequest
}

export function useExternalRequest(id: string | undefined) {
  return useQuery({
    queryKey: ["external-requests", id],
    queryFn: () => fetchExternalRequest(id!),
    enabled: !!id,
    staleTime: 15_000,
    retry: 1,
  })
}

// ─── Submission for a request ─────────────────────────────────────────────────

async function fetchSubmission(requestId: string): Promise<ExternalSubmission | null> {
  const { data, error } = await supabase
    .from("external_submissions")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle()
  if (error) throw error
  return data as ExternalSubmission | null
}

async function fetchAttachments(submissionId: string): Promise<ExternalSubmissionAttachment[]> {
  const { data, error } = await supabase
    .from("external_submission_attachments")
    .select("*")
    .eq("submission_id", submissionId)
    .order("uploaded_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as ExternalSubmissionAttachment[]
}

export function useExternalSubmission(requestId: string | undefined) {
  return useQuery({
    queryKey: ["external-submission", requestId],
    queryFn: () => fetchSubmission(requestId!),
    enabled: !!requestId,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useExternalAttachments(submissionId: string | undefined) {
  return useQuery({
    queryKey: ["external-attachments", submissionId],
    queryFn: () => fetchAttachments(submissionId!),
    enabled: !!submissionId,
    staleTime: 15_000,
    retry: 1,
  })
}

// ─── Invalidation helper ──────────────────────────────────────────────────────

export function useInvalidateExternalRequests() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["external-requests"] })
  }
}
