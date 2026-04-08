import { supabase } from "@/lib/supabase"

// ─── Personnel Compliance ────────────────────────────────────────────────────

export interface PersonnelCompliance {
  profileId: string
  name: string
  certType: string | null
  certNumber: string | null
  hasCert: boolean
  trainingRecords: number
  expiredTraining: number
  expiringSoonTraining: number  // within 30 days
  currentTraining: number
}

export async function getPersonnelCompliance(): Promise<PersonnelCompliance[]> {
  // Get all labor-eligible mechanics
  const { data: mechs, error: mErr } = await supabase
    .from("bb_work_order_mechanics")
    .select("profile_id, profiles!inner(full_name, display_name)")

  // Fallback: get from profiles directly if no WO mechanics
  const { data: techRows } = await supabase
    .from("bb_mechanic_certs")
    .select("profile_id, cert_type, cert_number, profiles!inner(full_name, display_name)")

  if (mErr && !techRows) throw mErr

  // Build unique profile map
  const profileMap = new Map<string, { name: string; certType: string | null; certNumber: string | null }>()

  for (const row of techRows ?? []) {
    const p = row.profiles as any
    profileMap.set(row.profile_id, {
      name: p?.display_name || p?.full_name || "Unknown",
      certType: row.cert_type,
      certNumber: row.cert_number,
    })
  }

  // Also include WO mechanics who may not have certs
  for (const row of mechs ?? []) {
    if (!profileMap.has(row.profile_id)) {
      const p = (row as any).profiles
      profileMap.set(row.profile_id, {
        name: p?.display_name || p?.full_name || "Unknown",
        certType: null,
        certNumber: null,
      })
    }
  }

  // Get all training records
  const { data: training } = await supabase
    .from("bb_training_records")
    .select("mechanic_id, status, expiry_date")

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const results: PersonnelCompliance[] = []
  for (const [profileId, info] of profileMap) {
    const myTraining = (training ?? []).filter(t => t.mechanic_id === profileId)
    const expired = myTraining.filter(t => t.status === "expired" || (t.expiry_date && new Date(t.expiry_date) < now)).length
    const expiringSoon = myTraining.filter(t => {
      if (!t.expiry_date) return false
      const exp = new Date(t.expiry_date)
      return exp >= now && exp <= thirtyDays
    }).length
    const current = myTraining.length - expired - expiringSoon

    results.push({
      profileId,
      name: info.name,
      certType: info.certType,
      certNumber: info.certNumber,
      hasCert: !!info.certType,
      trainingRecords: myTraining.length,
      expiredTraining: expired,
      expiringSoonTraining: expiringSoon,
      currentTraining: Math.max(0, current),
    })
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Tool Calibration Compliance ─────────────────────────────────��───────────

export interface ToolCalibrationStatus {
  id: string
  toolNumber: string
  description: string
  status: string
  nextCalibrationDue: string | null
  lastCalibratedAt: string | null
  calibrationIntervalDays: number
  daysUntilDue: number | null
  isOverdue: boolean
  isDueSoon: boolean  // within 30 days
}

export async function getToolCalibrationCompliance(): Promise<ToolCalibrationStatus[]> {
  const { data, error } = await supabase
    .from("bb_tools")
    .select("id, tool_number, description, status, next_calibration_due, last_calibrated_at, calibration_interval_days")
    .order("next_calibration_due", { ascending: true, nullsFirst: false })

  if (error) throw error

  const now = new Date()
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  return (data ?? []).map(t => {
    const due = t.next_calibration_due ? new Date(t.next_calibration_due) : null
    const daysUntilDue = due ? Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

    return {
      id: t.id,
      toolNumber: t.tool_number,
      description: t.description,
      status: t.status,
      nextCalibrationDue: t.next_calibration_due,
      lastCalibratedAt: t.last_calibrated_at,
      calibrationIntervalDays: t.calibration_interval_days,
      daysUntilDue,
      isOverdue: due ? due < now : false,
      isDueSoon: due ? (due >= now && due <= thirtyDays) : false,
    }
  })
}

// ─── Compliance Score ────────────────────────────────────────────────────────

export interface ComplianceScore {
  overall: number  // 0–100
  personnel: { score: number; total: number; compliant: number; issues: string[] }
  training: { score: number; total: number; current: number; expiring: number; expired: number }
  tooling: { score: number; total: number; current: number; dueSoon: number; overdue: number }
}

export async function getComplianceScore(): Promise<ComplianceScore> {
  const [personnel, tools] = await Promise.all([
    getPersonnelCompliance(),
    getToolCalibrationCompliance(),
  ])

  // Personnel score: all techs should have certs
  const certifiedCount = personnel.filter(p => p.hasCert).length
  const personnelIssues: string[] = []
  for (const p of personnel) {
    if (!p.hasCert) personnelIssues.push(`${p.name}: no certification on file`)
    if (p.expiredTraining > 0) personnelIssues.push(`${p.name}: ${p.expiredTraining} expired training record(s)`)
  }
  const personnelScore = personnel.length > 0
    ? Math.round((certifiedCount / personnel.length) * 100)
    : 100

  // Training score
  const totalTraining = personnel.reduce((s, p) => s + p.trainingRecords, 0)
  const currentTraining = personnel.reduce((s, p) => s + p.currentTraining, 0)
  const expiringTraining = personnel.reduce((s, p) => s + p.expiringSoonTraining, 0)
  const expiredTraining = personnel.reduce((s, p) => s + p.expiredTraining, 0)
  const trainingScore = totalTraining > 0
    ? Math.round((currentTraining / totalTraining) * 100)
    : 100  // No training records = nothing expired

  // Tool score
  const toolCurrent = tools.filter(t => !t.isOverdue && !t.isDueSoon).length
  const toolDueSoon = tools.filter(t => t.isDueSoon).length
  const toolOverdue = tools.filter(t => t.isOverdue).length
  const toolScore = tools.length > 0
    ? Math.round((toolCurrent / tools.length) * 100)
    : 100

  // Overall: weighted average (personnel 40%, training 30%, tools 30%)
  const overall = Math.round(personnelScore * 0.4 + trainingScore * 0.3 + toolScore * 0.3)

  return {
    overall,
    personnel: { score: personnelScore, total: personnel.length, compliant: certifiedCount, issues: personnelIssues },
    training: { score: trainingScore, total: totalTraining, current: currentTraining, expiring: expiringTraining, expired: expiredTraining },
    tooling: { score: toolScore, total: tools.length, current: toolCurrent, dueSoon: toolDueSoon, overdue: toolOverdue },
  }
}
