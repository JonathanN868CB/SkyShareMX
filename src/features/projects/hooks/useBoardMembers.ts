import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"

export function useBoardMemberMutations(boardId: string) {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pm_board", boardId] })

  const addMember = useMutation({
    mutationFn: async (profileId: string) => {
      if (!profile) throw new Error("Not authenticated")
      const { error } = await supabase.from("pm_board_members").insert({
        board_id:   boardId,
        profile_id: profileId,
        added_by:   profile.id,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const removeMember = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("pm_board_members")
        .delete()
        .eq("board_id", boardId)
        .eq("profile_id", profileId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { addMember, removeMember }
}

// Fetch all user profiles for the member picker
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, avatar_color, avatar_initials, avatar_url, role")
    .eq("status", "Active")
    .order("full_name")
  if (error) throw error
  return data ?? []
}
