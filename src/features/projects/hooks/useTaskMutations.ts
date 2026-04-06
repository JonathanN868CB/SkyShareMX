import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"

export function useTaskMutations(boardId: string) {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pm_board", boardId] })

  const createTask = useMutation({
    mutationFn: async ({
      groupId,
      parentTaskId,
      name,
    }: {
      groupId: string
      parentTaskId?: string
      name: string
    }) => {
      if (!profile) throw new Error("Not authenticated")

      // Get max sort_order for this group (or parent task's children)
      const query = supabase.from("pm_tasks").select("sort_order").eq("group_id", groupId)
      if (parentTaskId) {
        query.eq("parent_task_id", parentTaskId)
      } else {
        query.is("parent_task_id", null)
      }
      const { data: existing } = await query.order("sort_order", { ascending: false }).limit(1)
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

      const { data, error } = await supabase
        .from("pm_tasks")
        .insert({
          group_id:       groupId,
          parent_task_id: parentTaskId ?? null,
          name,
          sort_order:     nextOrder,
          created_by:     profile.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: {
      id: string
      name?: string
      champion_id?: string | null
      status_id?: string | null
      due_date?: string | null
      completion_note?: string | null
      group_id?: string
    }) => {
      const { error } = await supabase
        .from("pm_tasks")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("pm_tasks").delete().eq("id", taskId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // Reorder tasks within a group (top-level only)
  const reorderTasks = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from("pm_tasks").update({ sort_order: i }).eq("id", id)
        )
      )
    },
    onSuccess: invalidate,
  })

  // Move task to a different group
  const moveTask = useMutation({
    mutationFn: async ({ taskId, targetGroupId }: { taskId: string; targetGroupId: string }) => {
      const { data: existing } = await supabase
        .from("pm_tasks")
        .select("sort_order")
        .eq("group_id", targetGroupId)
        .is("parent_task_id", null)
        .order("sort_order", { ascending: false })
        .limit(1)
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1
      const { error } = await supabase
        .from("pm_tasks")
        .update({ group_id: targetGroupId, sort_order: nextOrder, updated_at: new Date().toISOString() })
        .eq("id", taskId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // Set contributors (replaces existing set)
  const setContributors = useMutation({
    mutationFn: async ({ taskId, profileIds }: { taskId: string; profileIds: string[] }) => {
      if (!profile) throw new Error("Not authenticated")
      // Delete existing then insert new
      await supabase.from("pm_task_contributors").delete().eq("task_id", taskId)
      if (profileIds.length > 0) {
        const { error } = await supabase.from("pm_task_contributors").insert(
          profileIds.map(pid => ({ task_id: taskId, profile_id: pid }))
        )
        if (error) throw error
      }
    },
    onSuccess: invalidate,
  })

  return { createTask, updateTask, deleteTask, reorderTasks, moveTask, setContributors }
}
