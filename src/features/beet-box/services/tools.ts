import { supabase } from "@/lib/supabase"
import type { Tool, CalibrationRecord, ToolStatus } from "../types"

export async function getTools(filters?: {
  status?: ToolStatus | ToolStatus[]
  search?: string
}): Promise<Tool[]> {
  let query = supabase
    .from("bb_tools")
    .select("*")
    .order("tool_number")

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in("status", statuses)
  }
  if (filters?.search) {
    query = query.or(`description.ilike.%${filters.search}%,tool_number.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => mapToolRow(row, []))
}

export async function getToolById(id: string): Promise<Tool | null> {
  const [{ data: tool, error: tErr }, { data: history, error: hErr }] =
    await Promise.all([
      supabase.from("bb_tools").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("bb_calibration_records")
        .select("*")
        .eq("tool_id", id)
        .order("calibrated_at", { ascending: false }),
    ])

  if (tErr) throw tErr
  if (hErr) throw hErr
  if (!tool) return null

  return mapToolRow(tool, history ?? [])
}

export async function createTool(
  payload: Omit<Tool, "id" | "history" | "createdAt" | "updatedAt">
): Promise<Tool> {
  const { data, error } = await supabase
    .from("bb_tools")
    .insert({
      tool_number: payload.toolNumber,
      description: payload.description,
      serial_number: payload.serialNumber ?? null,
      manufacturer: payload.manufacturer ?? null,
      location: payload.location ?? null,
      status: payload.status,
      calibration_interval_days: payload.calibrationIntervalDays,
      last_calibrated_at: payload.lastCalibratedAt ?? null,
      next_calibration_due: payload.nextCalibrationDue ?? null,
      calibration_vendor: payload.calibrationVendor ?? null,
      notes: payload.notes ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return mapToolRow(data, [])
}

export async function updateTool(
  id: string,
  payload: Partial<Omit<Tool, "id" | "history" | "createdAt" | "updatedAt">>
): Promise<void> {
  const { error } = await supabase
    .from("bb_tools")
    .update({
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.serialNumber !== undefined && { serial_number: payload.serialNumber }),
      ...(payload.manufacturer !== undefined && { manufacturer: payload.manufacturer }),
      ...(payload.location !== undefined && { location: payload.location }),
      ...(payload.status !== undefined && { status: payload.status }),
      ...(payload.calibrationIntervalDays !== undefined && { calibration_interval_days: payload.calibrationIntervalDays }),
      ...(payload.lastCalibratedAt !== undefined && { last_calibrated_at: payload.lastCalibratedAt }),
      ...(payload.nextCalibrationDue !== undefined && { next_calibration_due: payload.nextCalibrationDue }),
      ...(payload.calibrationVendor !== undefined && { calibration_vendor: payload.calibrationVendor }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
    })
    .eq("id", id)

  if (error) throw error
}

export async function recordCalibration(
  toolId: string,
  entry: {
    calibratedBy?: string      // profile id (null if external vendor)
    calibratedByName: string
    calibratedAt: string       // ISO date string
    nextDue: string
    certificateNumber?: string
    notes?: string
  }
): Promise<CalibrationRecord> {
  const { data: cal, error: calErr } = await supabase
    .from("bb_calibration_records")
    .insert({
      tool_id: toolId,
      calibrated_by: entry.calibratedBy ?? null,
      calibrated_by_name: entry.calibratedByName,
      calibrated_at: entry.calibratedAt,
      next_due: entry.nextDue,
      certificate_number: entry.certificateNumber ?? null,
      notes: entry.notes ?? null,
    })
    .select()
    .single()

  if (calErr) throw calErr

  // Update tool status + calibration dates
  const today = new Date()
  const due = new Date(entry.nextDue)
  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const newStatus: ToolStatus =
    daysUntilDue < 0 ? "overdue" :
    daysUntilDue <= 30 ? "due_soon" :
    "active"

  await supabase.from("bb_tools").update({
    last_calibrated_at: entry.calibratedAt,
    next_calibration_due: entry.nextDue,
    status: newStatus,
  }).eq("id", toolId)

  return {
    id: cal.id,
    toolId: cal.tool_id,
    calibratedBy: cal.calibrated_by,
    calibratedByName: cal.calibrated_by_name,
    calibratedAt: cal.calibrated_at,
    nextDue: cal.next_due,
    certificateNumber: cal.certificate_number,
    notes: cal.notes,
    createdAt: cal.created_at,
  }
}

function mapToolRow(row: any, history: any[]): Tool {
  return {
    id: row.id,
    toolNumber: row.tool_number,
    description: row.description,
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer,
    location: row.location,
    status: row.status as ToolStatus,
    calibrationIntervalDays: row.calibration_interval_days,
    lastCalibratedAt: row.last_calibrated_at,
    nextCalibrationDue: row.next_calibration_due,
    calibrationVendor: row.calibration_vendor,
    notes: row.notes,
    history: history.map((h) => ({
      id: h.id,
      toolId: h.tool_id,
      calibratedBy: h.calibrated_by,
      calibratedByName: h.calibrated_by_name,
      calibratedAt: h.calibrated_at,
      nextDue: h.next_due,
      certificateNumber: h.certificate_number,
      notes: h.notes,
      createdAt: h.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
