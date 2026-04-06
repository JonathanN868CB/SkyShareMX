import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { PmBoard } from "@/entities/supabase"
import { PM_DEFAULT_STATUSES as DEFAULTS } from "@/entities/supabase"
import { useAuth } from "@/features/auth"

export type BoardCard = PmBoard & {
  member_count: number
  group_count: number
}

export function useBoards() {
  const { profile } = useAuth()

  return useQuery({
    queryKey: ["pm_boards", profile?.id],
    queryFn: async (): Promise<BoardCard[]> => {
      const { data, error } = await supabase
        .from("pm_boards")
        .select(`
          *,
          pm_board_members(count),
          pm_groups(count)
        `)
        .is("archived_at", null)
        .order("created_at", { ascending: false })

      if (error) throw error

      return (data ?? []).map((b: any) => ({
        ...b,
        member_count: b.pm_board_members?.[0]?.count ?? 0,
        group_count:  b.pm_groups?.[0]?.count ?? 0,
      }))
    },
    enabled: !!profile,
  })
}

export function useCreateBoard() {
  const qc = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({ name, color, description }: { name: string; color: string; description?: string }) => {
      if (!profile) throw new Error("Not authenticated")

      // Create board
      const { data: board, error: boardErr } = await supabase
        .from("pm_boards")
        .insert({ name, color, description: description ?? null, created_by: profile.id })
        .select()
        .single()

      if (boardErr || !board) throw boardErr ?? new Error("Failed to create board")

      // Auto-add creator as first member
      await supabase
        .from("pm_board_members")
        .insert({ board_id: board.id, profile_id: profile.id, added_by: profile.id })

      // Seed default statuses
      await supabase.from("pm_statuses").insert(
        DEFAULTS.map((s, i) => ({
          board_id:   board.id,
          label:      s.label,
          color:      s.color,
          sort_order: i,
          is_default: s.is_default,
        }))
      )

      return board as PmBoard
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm_boards"] }),
  })
}

export function useDeleteBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (boardId: string) => {
      const { error } = await supabase.from("pm_boards").delete().eq("id", boardId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm_boards"] }),
  })
}
