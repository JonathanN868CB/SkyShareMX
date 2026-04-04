import { supabase } from "@/lib/supabase"
import type { FieldDef } from "@/entities/supabase"

const BASE = "/.netlify/functions"

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return `Bearer ${token}`
}

// ─── Create request (returns { id, token }) ───────────────────────────────────

export async function createExternalRequest(params: {
  title: string
  instructions?: string
  fieldSchema: FieldDef[]
  recipientName: string
  recipientEmail: string
  expiresAt?: string
  parentType?: string
  parentId?: string
  parentLabel?: string
}): Promise<{ id: string; token: string }> {
  const auth = await getAuthHeader()
  const res = await fetch(`${BASE}/external-request-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({
      title: params.title,
      instructions: params.instructions ?? "",
      fieldSchema: params.fieldSchema,
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
      expiresAt: params.expiresAt ?? null,
      parentType: params.parentType ?? null,
      parentId: params.parentId ?? null,
      parentLabel: params.parentLabel ?? null,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Failed to create request")
  return body
}

// ─── Send request email ───────────────────────────────────────────────────────

export async function sendExternalRequest(requestId: string): Promise<void> {
  const auth = await getAuthHeader()
  const res = await fetch(`${BASE}/external-request-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ requestId }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Failed to send request")
}

// ─── Delete request + storage cleanup ────────────────────────────────────────

export async function deleteExternalRequest(requestId: string): Promise<void> {
  const auth = await getAuthHeader()
  const res = await fetch(`${BASE}/external-request-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ requestId }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Failed to delete request")
}

// ─── Update review notes + mark reviewed ─────────────────────────────────────

export async function markExternalRequestReviewed(requestId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("external_requests")
    .update({
      status: "reviewed",
      review_notes: notes || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
  if (error) throw error
}

export async function saveReviewNotes(requestId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from("external_requests")
    .update({ review_notes: notes || null })
    .eq("id", requestId)
  if (error) throw error
}

// ─── Get signed download URL for an attachment ────────────────────────────────

export async function getDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("external-submissions")
    .createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) throw new Error("Could not generate download URL")
  return data.signedUrl
}
