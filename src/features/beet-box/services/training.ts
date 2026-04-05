import { supabase } from "@/lib/supabase"
import type { TrainingRecord, TrainingStatus } from "../types"

export async function getTrainingRecords(filters?: {
  mechanicId?: string
  status?: TrainingStatus | TrainingStatus[]
}): Promise<TrainingRecord[]> {
  let query = supabase
    .from("bb_training_records")
    .select("*")
    .order("issued_date", { ascending: false })

  if (filters?.mechanicId) query = query.eq("mechanic_id", filters.mechanicId)
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in("status", statuses)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map(mapTrainingRow)
}

export async function getTrainingByMechanic(mechanicId: string): Promise<TrainingRecord[]> {
  return getTrainingRecords({ mechanicId })
}

export async function createTrainingRecord(
  payload: Omit<TrainingRecord, "id" | "createdAt" | "updatedAt">
): Promise<TrainingRecord> {
  const { data, error } = await supabase
    .from("bb_training_records")
    .insert({
      mechanic_id: payload.mechanicId,
      training_type: payload.trainingType,
      issued_date: payload.issuedDate,
      expiry_date: payload.expiryDate ?? null,
      issuer: payload.issuer,
      certificate_number: payload.certificateNumber ?? null,
      status: computeStatus(payload.expiryDate),
      notes: payload.notes ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return mapTrainingRow(data)
}

export async function updateTrainingRecord(
  id: string,
  payload: Partial<Omit<TrainingRecord, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  const status = payload.expiryDate !== undefined
    ? computeStatus(payload.expiryDate)
    : payload.status

  const { error } = await supabase
    .from("bb_training_records")
    .update({
      ...(payload.trainingType !== undefined && { training_type: payload.trainingType }),
      ...(payload.issuedDate !== undefined && { issued_date: payload.issuedDate }),
      ...(payload.expiryDate !== undefined && { expiry_date: payload.expiryDate }),
      ...(payload.issuer !== undefined && { issuer: payload.issuer }),
      ...(payload.certificateNumber !== undefined && { certificate_number: payload.certificateNumber }),
      ...(status !== undefined && { status }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
    })
    .eq("id", id)

  if (error) throw error
}

// Compute training status from expiry date
function computeStatus(expiryDate: string | null | undefined): TrainingStatus {
  if (!expiryDate) return "current"
  const expiry = new Date(expiryDate)
  const today = new Date()
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) return "expired"
  if (daysUntilExpiry <= 60) return "expiring_soon"
  return "current"
}

function mapTrainingRow(row: any): TrainingRecord {
  return {
    id: row.id,
    mechanicId: row.mechanic_id,
    trainingType: row.training_type,
    issuedDate: row.issued_date,
    expiryDate: row.expiry_date,
    issuer: row.issuer,
    certificateNumber: row.certificate_number,
    status: row.status as TrainingStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
