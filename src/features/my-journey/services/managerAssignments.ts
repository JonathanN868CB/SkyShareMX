import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfileRef {
  id: string
  display_name: string | null
  full_name: string | null
  avatar_color: string | null
  avatar_initials: string | null
  mxlms_technician_id: number | null
  role?: string
}

export interface Assignment {
  id: string
  manager_profile_id: string
  subject_profile_id: string
  created_at: string
  manager?: ProfileRef
  subject?: ProfileRef
}

// ── Queries ───────────────────────────────────────────────────────────────────

// ── Internal helper ───────────────────────────────────────────────────────────

/** Returns the current user's profiles.id (UUID), or null if not authenticated. */
async function getMyProfileId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()
  return data?.id ?? null
}

/** Current manager: who do I manage? */
export async function getMyDirectReports(): Promise<Assignment[]> {
  const myProfileId = await getMyProfileId()
  if (!myProfileId) return []

  const { data, error } = await supabase
    .from("manager_assignments")
    .select(`
      id, manager_profile_id, subject_profile_id, created_at,
      subject:profiles!manager_assignments_subject_profile_id_fkey(
        id, display_name, full_name, avatar_color, avatar_initials, mxlms_technician_id, role
      )
    `)
    .eq("manager_profile_id", myProfileId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Assignment[]
}

/** Super Admin: every assignment in the org, grouped with both sides resolved. */
export async function getAllAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("manager_assignments")
    .select(`
      id, manager_profile_id, subject_profile_id, created_at,
      manager:profiles!manager_assignments_manager_profile_id_fkey(
        id, display_name, full_name, avatar_color, avatar_initials
      ),
      subject:profiles!manager_assignments_subject_profile_id_fkey(
        id, display_name, full_name, avatar_color, avatar_initials, mxlms_technician_id, role
      )
    `)
    .order("manager_profile_id", { ascending: true })
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Assignment[]
}

/**
 * Super Admin: assignments for a *specific* manager_profile_id —
 * used by the "View as manager" dropdown to load that manager's reports.
 */
export async function getAssignmentsForManager(managerProfileId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("manager_assignments")
    .select(`
      id, manager_profile_id, subject_profile_id, created_at,
      subject:profiles!manager_assignments_subject_profile_id_fkey(
        id, display_name, full_name, avatar_color, avatar_initials, mxlms_technician_id, role
      )
    `)
    .eq("manager_profile_id", managerProfileId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Assignment[]
}

/** Does the current user have at least one direct report? */
export async function amIAPeopleManager(): Promise<boolean> {
  const myProfileId = await getMyProfileId()
  if (!myProfileId) return false

  const { count, error } = await supabase
    .from("manager_assignments")
    .select("id", { count: "exact", head: true })
    .eq("manager_profile_id", myProfileId)
  if (error) return false
  return (count ?? 0) > 0
}

/**
 * All distinct profile IDs that appear as manager_profile_id.
 * Used to build the "View as Manager" dropdown — returns full ProfileRef objects.
 */
export async function getPeopleManagerProfiles(): Promise<ProfileRef[]> {
  // Fetch all assignments then dedupe manager_profile_ids
  const { data, error } = await supabase
    .from("manager_assignments")
    .select(`
      manager_profile_id,
      manager:profiles!manager_assignments_manager_profile_id_fkey(
        id, display_name, full_name, avatar_color, avatar_initials
      )
    `)
  if (error) throw error

  const seen = new Set<string>()
  const result: ProfileRef[] = []
  for (const row of (data ?? []) as any[]) {
    if (!seen.has(row.manager_profile_id) && row.manager) {
      seen.add(row.manager_profile_id)
      result.push(row.manager as ProfileRef)
    }
  }
  return result
}

// ── Mutations (Super Admin only — enforced by RLS) ────────────────────────────

export async function addAssignment(
  managerProfileId: string,
  subjectProfileId: string,
  createdByProfileId: string,
): Promise<void> {
  const { error } = await supabase
    .from("manager_assignments")
    .insert({
      manager_profile_id: managerProfileId,
      subject_profile_id: subjectProfileId,
      created_by: createdByProfileId,
    })
  if (error) throw error
}

export async function removeAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from("manager_assignments")
    .delete()
    .eq("id", id)
  if (error) throw error
}
