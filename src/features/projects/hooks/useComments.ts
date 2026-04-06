import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import type { PmTaskComment, PmProfile } from "@/entities/supabase"

export type CommentWithAuthor = PmTaskComment & { author: PmProfile }

export function useComments(taskId: string | null) {
  return useQuery({
    queryKey: ["pm_comments", taskId],
    queryFn: async (): Promise<CommentWithAuthor[]> => {
      if (!taskId) return []
      const { data, error } = await supabase
        .from("pm_task_comments")
        .select(`
          *,
          author:profiles!pm_task_comments_author_id_fkey(id, full_name, display_name, avatar_color, avatar_initials, avatar_url)
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })

      if (error) throw error
      return (data ?? []) as CommentWithAuthor[]
    },
    enabled: !!taskId,
    staleTime: 15_000,
  })
}

export function useCommentMutations(taskId: string, boardId: string) {
  const qc = useQueryClient()
  const { profile } = useAuth()

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!profile) throw new Error("Not authenticated")
      const { error } = await supabase.from("pm_task_comments").insert({
        task_id:   taskId,
        author_id: profile.id,
        content,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_comments", taskId] })
      qc.invalidateQueries({ queryKey: ["pm_board", boardId] })
    },
  })

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("pm_task_comments").delete().eq("id", commentId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm_comments", taskId] }),
  })

  return { addComment, deleteComment }
}
