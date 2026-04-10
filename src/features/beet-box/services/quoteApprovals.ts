// ============================================================================
// Quote / Change-Order Approval service
// ============================================================================
// Thin client-side layer over the Netlify functions that handle tokenized
// approval requests, plus direct-read helpers for loading the request +
// submission + per-item decisions back into the authed app.
//
// Send flow (quote or CO): the authed app calls `bb-approval-send` with a
// work-order id, kind, and recipient. The function renders the unsigned PDF,
// creates `bb_approval_requests`, and emails the recipient a tokenized link.
//
// Public portal (no auth): customer opens /approval/:token, the page fetches
// the snapshot via `bb-approval-public`, draws their signature, and submits
// per-item decisions via `bb-approval-submit`. The signed PDF is rendered on
// the server and stored alongside the unsigned copy.
// ============================================================================

import { supabase } from "@/lib/supabase"
import type {
  ApprovalRequest,
  ApprovalSubmission,
  ApprovalItemDecision,
  ApprovalKind,
} from "../types"

// ── Auth helper ─────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return token
}

async function postFn<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`/.netlify/functions/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`)
  }
  return json as T
}

async function getFn<T>(path: string, query: Record<string, string>): Promise<T> {
  const token = await getAccessToken()
  const qs = new URLSearchParams(query).toString()
  const res = await fetch(`/.netlify/functions/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`)
  }
  return json as T
}

// ── Send for approval (quote or change order) ─────────────────────────────

export interface SendForApprovalPayload {
  workOrderId:     string
  kind:            ApprovalKind
  recipientName:   string
  recipientEmail:  string
  expiresAt?:      string       // ISO; optional
  message?:        string       // optional note for the email body
}

export interface SendForApprovalResult {
  approvalRequestId: string
  encodedToken:      string
  approvalUrl:       string
}

export async function sendForApproval(
  payload: SendForApprovalPayload,
): Promise<SendForApprovalResult> {
  return postFn<SendForApprovalResult>("bb-approval-send", payload)
}

// Convenience wrappers so UI code doesn't have to remember the discriminator.
export function sendQuoteForApproval(
  payload: Omit<SendForApprovalPayload, "kind">,
): Promise<SendForApprovalResult> {
  return sendForApproval({ ...payload, kind: "quote" })
}

export function sendChangeOrderForApproval(
  payload: Omit<SendForApprovalPayload, "kind">,
): Promise<SendForApprovalResult> {
  return sendForApproval({ ...payload, kind: "change_order" })
}

// ── Load latest approval bundle for a WO / quote / CO ─────────────────────

export interface ApprovalBundle {
  request:    ApprovalRequest
  submission: ApprovalSubmission | null
  decisions:  ApprovalItemDecision[]
}

function mapRequestRow(row: any): ApprovalRequest {
  return {
    id:              row.id,
    workOrderId:     row.work_order_id,
    kind:            row.kind as ApprovalKind,
    token:           row.token,
    recipientName:   row.recipient_name,
    recipientEmail:  row.recipient_email,
    snapshotTotal:   Number(row.snapshot_total ?? 0),
    unsignedPdfPath: row.unsigned_pdf_path ?? null,
    status:          row.status,
    expiresAt:       row.expires_at ?? null,
    sentAt:          row.sent_at,
    sentBy:          row.sent_by ?? null,
    submittedAt:     row.submitted_at ?? null,
    createdAt:       row.created_at,
  }
}

function mapSubmissionRow(row: any): ApprovalSubmission {
  return {
    id:                 row.id,
    approvalRequestId:  row.approval_request_id,
    signerName:         row.signer_name,
    signerEmail:        row.signer_email,
    signerTitle:        row.signer_title ?? null,
    signatureHash:      row.signature_hash,
    signatureImagePath: row.signature_image_path,
    signedPdfPath:      row.signed_pdf_path ?? null,
    submittedAt:        row.submitted_at,
  }
}

function mapDecisionRow(row: any): ApprovalItemDecision {
  return {
    id:                row.id,
    approvalRequestId: row.approval_request_id,
    woItemId:          row.wo_item_id,
    decision:          row.decision,
    decidedAt:         row.decided_at,
  }
}

/**
 * Loads the most recent approval request for a given work order / quote / CO,
 * plus the customer's submission (if they've signed) and per-item decisions.
 * Returns null if nothing has been sent yet.
 */
export async function getLatestApprovalForWorkOrder(
  workOrderId: string,
): Promise<ApprovalBundle | null> {
  const { data: reqRow, error: reqErr } = await supabase
    .from("bb_approval_requests")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (reqErr) throw reqErr
  if (!reqRow) return null

  const [submissionRes, decisionsRes] = await Promise.all([
    supabase
      .from("bb_approval_submissions")
      .select("*")
      .eq("approval_request_id", reqRow.id)
      .maybeSingle(),
    supabase
      .from("bb_approval_item_decisions")
      .select("*")
      .eq("approval_request_id", reqRow.id),
  ])

  if (submissionRes.error) throw submissionRes.error
  if (decisionsRes.error)  throw decisionsRes.error

  return {
    request:    mapRequestRow(reqRow),
    submission: submissionRes.data ? mapSubmissionRow(submissionRes.data) : null,
    decisions:  (decisionsRes.data ?? []).map(mapDecisionRow),
  }
}

/**
 * All approval requests a WO has ever sent — useful for the audit panel so a
 * manager can see the full resend history.
 */
export async function listApprovalsForWorkOrder(
  workOrderId: string,
): Promise<ApprovalRequest[]> {
  const { data, error } = await supabase
    .from("bb_approval_requests")
    .select("*")
    .eq("work_order_id", workOrderId)
    .order("sent_at", { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapRequestRow)
}

// ── Signed-URL fetch for internal PDF download ────────────────────────────

export async function getApprovalPdfUrl(
  approvalRequestId: string,
  variant: "unsigned" | "signed",
): Promise<string> {
  const result = await getFn<{ url: string }>("bb-approval-pdf-url", {
    approvalRequestId,
    variant,
  })
  return result.url
}

// ── Mid-WO "Found Discrepancy" ────────────────────────────────────────────

export interface FindDiscrepancyPayload {
  parentItemId:      string     // inspection item that surfaced the finding
  workOrderId:       string
  discrepancyType:   "airworthy" | "recommendation"
  category:          string
  discrepancy:       string
  correctiveAction:  string
  estimatedHours:    number
  laborRate:         number
  partNumber?:       string
}

/**
 * Inserts a new item on the WO, links it to the inspection item that found
 * it, and marks it pending customer approval. The caller is responsible for
 * uploading any photos via `uploadWoItemAttachment` after the item id comes
 * back.
 */
export async function findDiscrepancy(
  payload: FindDiscrepancyPayload,
): Promise<{ itemId: string }> {
  // Next item number on the WO
  const { data: countRows, error: countErr } = await supabase
    .from("bb_work_order_items")
    .select("item_number")
    .eq("work_order_id", payload.workOrderId)
    .order("item_number", { ascending: false })
    .limit(1)
  if (countErr) throw countErr
  const nextItemNumber = (countRows?.[0]?.item_number ?? 0) + 1

  const { data, error } = await supabase
    .from("bb_work_order_items")
    .insert({
      work_order_id:            payload.workOrderId,
      item_number:              nextItemNumber,
      category:                 payload.category,
      logbook_section:          "Airframe",
      discrepancy:              payload.discrepancy,
      corrective_action:        payload.correctiveAction,
      estimated_hours:          payload.estimatedHours,
      labor_rate:               payload.laborRate,
      part_number:              payload.partNumber ?? null,
      item_status:              "pending",
      customer_approval_status: "pending",
      parent_item_id:           payload.parentItemId,
      discrepancy_type:         payload.discrepancyType,
    })
    .select("id")
    .single()

  if (error) throw error
  return { itemId: data.id }
}

/**
 * Lists mid-WO discrepancy items that haven't yet been bundled into a
 * change-order approval. These are the candidates for "Create Change Order".
 */
export async function listPendingDiscrepancies(workOrderId: string) {
  const { data, error } = await supabase
    .from("bb_work_order_items")
    .select("*")
    .eq("work_order_id", workOrderId)
    .not("parent_item_id", "is", null)
    .eq("customer_approval_status", "pending")
    .order("item_number")

  if (error) throw error
  return data ?? []
}

// ── Change Order creation ─────────────────────────────────────────────────

/**
 * Creates a new bb_work_orders row with wo_type='change_order' linked to the
 * parent WO and reassigns the given item ids to the new CO. Returns the new
 * CO id + number.
 */
export async function createChangeOrder(
  parentWoId: string,
  itemIds: string[],
  description: string,
  createdBy: string,
): Promise<{ id: string; coNumber: string }> {
  if (itemIds.length === 0) throw new Error("Select at least one item")

  // Load parent WO to inherit aircraft + meter
  const { data: parentRow, error: parentErr } = await supabase
    .from("bb_work_orders")
    .select("aircraft_id, guest_registration, guest_serial, meter_at_open")
    .eq("id", parentWoId)
    .single()
  if (parentErr) throw parentErr

  // CO number: CO-YY-NNNN scoped to wo_type='change_order'
  const yy = String(new Date().getFullYear()).slice(-2)
  const { count } = await supabase
    .from("bb_work_orders")
    .select("id", { count: "exact", head: true })
    .eq("wo_type", "change_order")
  const seq = String((count ?? 0) + 1).padStart(4, "0")
  const coNumber = `CO-${yy}-${seq}`

  // Insert CO
  const { data: coRow, error: coErr } = await supabase
    .from("bb_work_orders")
    .insert({
      wo_number:          coNumber,
      wo_type:            "change_order",
      parent_wo_id:       parentWoId,
      description,
      aircraft_id:        parentRow.aircraft_id,
      guest_registration: parentRow.guest_registration,
      guest_serial:       parentRow.guest_serial,
      meter_at_open:      parentRow.meter_at_open,
      opened_by:          createdBy,
      status:             "draft",
      quote_status:       "draft",
    })
    .select("id")
    .single()
  if (coErr) throw coErr
  const coId = coRow.id as string

  // Move the selected items from the parent WO onto the CO
  const { error: moveErr } = await supabase
    .from("bb_work_order_items")
    .update({ work_order_id: coId })
    .in("id", itemIds)
  if (moveErr) throw moveErr

  // Audit trail on both sides
  await supabase.from("bb_work_order_audit_trail").insert([
    {
      work_order_id: parentWoId,
      entry_type:    "wo_created",
      actor_id:      createdBy,
      summary:       `Change order ${coNumber} created (${itemIds.length} item${itemIds.length === 1 ? "" : "s"})`,
      field_name:    "change_order",
      new_value:     coId,
    },
    {
      work_order_id: coId,
      entry_type:    "wo_created",
      actor_id:      createdBy,
      summary:       `${coNumber} bundled from parent WO discrepancies`,
      field_name:    "parent_wo_id",
      new_value:     parentWoId,
    },
  ])

  return { id: coId, coNumber }
}

/**
 * Lists every change order attached to a parent WO — used by the
 * ChangeOrdersPanel on WorkOrderDetail.
 */
export async function listChangeOrdersForWo(parentWoId: string) {
  const { data, error } = await supabase
    .from("bb_work_orders")
    .select("*")
    .eq("parent_wo_id", parentWoId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── WO item attachments (photos on discrepancies) ─────────────────────────

/**
 * Uploads a file to `bb-wo-attachments` and records a row in
 * `bb_wo_item_attachments`. Storage path convention mirrors the migration:
 * `{workOrderId}/{itemId}/{uuid}-{fname}`.
 */
export async function uploadWoItemAttachment(
  workOrderId: string,
  woItemId:    string,
  file:        File,
): Promise<{ id: string; storagePath: string }> {
  const uploadedBy = await (async () => {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return null
    const { data: p } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle()
    return p?.id ?? null
  })()

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${workOrderId}/${woItemId}/${crypto.randomUUID()}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from("bb-wo-attachments")
    .upload(storagePath, file, { contentType: file.type, upsert: false })
  if (upErr) throw upErr

  const kind: "photo" | "doc" | "other" =
    file.type.startsWith("image/") ? "photo"
    : file.type.startsWith("application/") ? "doc"
    : "other"

  const { data: row, error: insErr } = await supabase
    .from("bb_wo_item_attachments")
    .insert({
      wo_item_id:      woItemId,
      work_order_id:   workOrderId,
      kind,
      file_name:       file.name,
      storage_path:    storagePath,
      mime_type:       file.type || null,
      file_size_bytes: file.size,
      uploaded_by:     uploadedBy,
    })
    .select("id")
    .single()
  if (insErr) throw insErr

  return { id: row.id, storagePath }
}

export async function getAttachmentSignedUrl(
  storagePath: string,
  ttlSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("bb-wo-attachments")
    .createSignedUrl(storagePath, ttlSeconds)
  if (error) throw error
  return data.signedUrl
}

export async function deleteWoItemAttachment(
  attachmentId: string,
  storagePath:  string,
): Promise<void> {
  await supabase.storage.from("bb-wo-attachments").remove([storagePath])
  const { error } = await supabase
    .from("bb_wo_item_attachments")
    .delete()
    .eq("id", attachmentId)
  if (error) throw error
}
