import { supabase } from "@/lib/supabase"

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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ManagerNote {
  id: string
  author_profile_id: string
  subject_profile_id: string
  note_text: string
  note_date: string
  created_at: string
  updated_at: string
  /** Resolved only when queried with joins (Super Admin view) */
  author?: {
    id: string
    display_name: string | null
    full_name: string | null
    avatar_color: string | null
    avatar_initials: string | null
  }
  subject?: {
    id: string
    display_name: string | null
    full_name: string | null
    avatar_color: string | null
    avatar_initials: string | null
  }
}

export interface ManagerNoteInsert {
  subject_profile_id: string
  note_text: string
  note_date?: string
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Manager: fetch all notes I have written about a specific direct report.
 * RLS ensures you can only read notes where author_profile_id = my profile.
 */
export async function getMyNotesForSubject(subjectProfileId: string): Promise<ManagerNote[]> {
  const myProfileId = await getMyProfileId()
  if (!myProfileId) return []

  const { data, error } = await supabase
    .from("journey_manager_notes")
    .select("id, author_profile_id, subject_profile_id, note_text, note_date, created_at, updated_at")
    .eq("author_profile_id", myProfileId)
    .eq("subject_profile_id", subjectProfileId)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as ManagerNote[]
}

/**
 * Manager: fetch all notes I have written (all subjects).
 * Useful for a "Supervisors" overview — all notes by me.
 */
export async function getAllMyNotes(): Promise<ManagerNote[]> {
  const myProfileId = await getMyProfileId()
  if (!myProfileId) return []

  const { data, error } = await supabase
    .from("journey_manager_notes")
    .select("id, author_profile_id, subject_profile_id, note_text, note_date, created_at, updated_at")
    .eq("author_profile_id", myProfileId)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as ManagerNote[]
}

/**
 * Super Admin: every note in the org, with both sides resolved.
 */
export async function getAllNotesAdmin(): Promise<ManagerNote[]> {
  const { data, error } = await supabase
    .from("journey_manager_notes")
    .select(`
      id, author_profile_id, subject_profile_id, note_text, note_date, created_at, updated_at,
      author:profiles!journey_manager_notes_author_profile_id_fkey(
        id, display_name, full_name, avatar_color, avatar_initials
      ),
      subject:profiles!journey_manager_notes_subject_profile_id_fkey(
        id, display_name, full_name, avatar_color, avatar_initials
      )
    `)
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ManagerNote[]
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function addManagerNote(payload: ManagerNoteInsert): Promise<void> {
  const { error } = await supabase
    .from("journey_manager_notes")
    .insert({
      subject_profile_id: payload.subject_profile_id,
      note_text: payload.note_text.trim(),
      note_date: payload.note_date ?? new Date().toISOString().split("T")[0],
    })
  if (error) throw error
}

export async function updateManagerNote(id: string, noteText: string): Promise<void> {
  const { error } = await supabase
    .from("journey_manager_notes")
    .update({ note_text: noteText.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export async function deleteManagerNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("journey_manager_notes")
    .delete()
    .eq("id", id)
  if (error) throw error
}
