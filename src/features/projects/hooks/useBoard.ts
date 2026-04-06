import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type {
  PmBoard, PmGroup, PmTask, PmStatus, PmProfile,
  PmBoardMember, PmTaskWithRelations, PmGroupWithTasks, PmBoardWithGroups,
} from "@/entities/supabase"
import { useAuth } from "@/features/auth"

// ─── Fetch full board data ────────────────────────────────────────────────────
export function useBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: ["pm_board", boardId],
    queryFn: async (): Promise<PmBoardWithGroups> => {
      if (!boardId) throw new Error("No boardId")

        const [boardRes, groupsRes, statusesRes, membersRes] = await Promise.all([
        supabase.from("pm_boards").select("*").eq("id", boardId).single(),
        supabase.from("pm_groups").select("*").eq("board_id", boardId).order("sort_order"),
        supabase.from("pm_statuses").select("*").eq("board_id", boardId).order("sort_order"),
        supabase.from("pm_board_members")
          .select(`
            *,
            profile:profiles!pm_board_members_profile_id_fkey(id, full_name, display_name, avatar_color, avatar_initials, avatar_url)
          `)
          .eq("board_id", boardId),
      ])

      if (boardRes.error) throw boardRes.error
      const board = boardRes.data as PmBoard

      const groups = (groupsRes.data ?? []) as PmGroup[]
      const groupIds = groups.map(g => g.id)

      // Fetch tasks now we have group IDs
      const { data: rawTasks, error: tasksErr } = groupIds.length
        ? await supabase.from("pm_tasks")
            .select(`
              *,
              champion:profiles!pm_tasks_champion_id_fkey(id, full_name, display_name, avatar_color, avatar_initials, avatar_url),
              status:pm_statuses(id, label, color),
              pm_task_contributors(
                profile_id,
                profiles!pm_task_contributors_profile_id_fkey(id, full_name, display_name, avatar_color, avatar_initials, avatar_url)
              )
            `)
            .in("group_id", groupIds)
            .is("archived_at", null)
            .order("sort_order")
        : { data: [], error: null }

      if (tasksErr) throw tasksErr

      // Get comment + attachment counts
      const taskIds = (rawTasks ?? []).map((t: any) => t.id)
      const [commentsRes, attachmentsRes] = taskIds.length
        ? await Promise.all([
            supabase.from("pm_task_comments").select("task_id").in("task_id", taskIds),
            supabase.from("pm_task_attachments").select("task_id").in("task_id", taskIds),
          ])
        : [{ data: [] }, { data: [] }]

      const commentCounts: Record<string, number> = {}
      const attachmentCounts: Record<string, number> = {}
      ;(commentsRes.data ?? []).forEach((r: any) => {
        commentCounts[r.task_id] = (commentCounts[r.task_id] ?? 0) + 1
      })
      ;(attachmentsRes.data ?? []).forEach((r: any) => {
        attachmentCounts[r.task_id] = (attachmentCounts[r.task_id] ?? 0) + 1
      })

      // Shape tasks
      const shapedTasks: PmTaskWithRelations[] = (rawTasks ?? []).map((t: any) => ({
        ...t,
        champion: t.champion ?? null,
        contributors: (t.pm_task_contributors ?? []).map((c: any) => c.profiles).filter(Boolean),
        status: t.status ?? null,
        subtasks: [],
        comment_count: commentCounts[t.id] ?? 0,
        attachment_count: attachmentCounts[t.id] ?? 0,
      }))

      // Separate top-level tasks and subtasks
      const topTasks = shapedTasks.filter(t => !t.parent_task_id)
      const subTasks = shapedTasks.filter(t => !!t.parent_task_id)

      topTasks.forEach(t => {
        t.subtasks = subTasks.filter(s => s.parent_task_id === t.id)
      })

      // Group tasks by group_id
      const tasksByGroup: Record<string, PmTaskWithRelations[]> = {}
      topTasks.forEach(t => {
        if (!tasksByGroup[t.group_id]) tasksByGroup[t.group_id] = []
        tasksByGroup[t.group_id].push(t)
      })

      const groupsWithTasks: PmGroupWithTasks[] = groups.map(g => ({
        ...g,
        tasks: tasksByGroup[g.id] ?? [],
      }))

      return {
        ...board,
        groups: groupsWithTasks,
        statuses: (statusesRes.data ?? []) as PmStatus[],
        members: (membersRes.data ?? []) as any,
      }
    },
    enabled: !!boardId,
    staleTime: 30_000,
  })
}

// ─── Group mutations ──────────────────────────────────────────────────────────
export function useGroupMutations(boardId: string) {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pm_board", boardId] })

  const createGroup = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      if (!profile) throw new Error("Not authenticated")
      const { data: existing } = await supabase
        .from("pm_groups").select("sort_order").eq("board_id", boardId).order("sort_order", { ascending: false }).limit(1)
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1
      const { error } = await supabase.from("pm_groups").insert({
        board_id: boardId, name, color, sort_order: nextOrder, created_by: profile.id,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const updateGroup = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const { error } = await supabase.from("pm_groups").update({ name, color, updated_at: new Date().toISOString() }).eq("id", id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const deleteGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("pm_groups").delete().eq("id", groupId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const reorderGroups = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, i) => supabase.from("pm_groups").update({ sort_order: i }).eq("id", id))
      await Promise.all(updates)
    },
    onSuccess: invalidate,
  })

  return { createGroup, updateGroup, deleteGroup, reorderGroups }
}

// ─── Status mutations ─────────────────────────────────────────────────────────
export function useStatusMutations(boardId: string) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pm_board", boardId] })

  const createStatus = useMutation({
    mutationFn: async ({ label, color }: { label: string; color: string }) => {
      const { data: existing } = await supabase
        .from("pm_statuses").select("sort_order").eq("board_id", boardId).order("sort_order", { ascending: false }).limit(1)
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1
      const { error } = await supabase.from("pm_statuses").insert({ board_id: boardId, label, color, sort_order: nextOrder })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, label, color }: { id: string; label?: string; color?: string }) => {
      const { error } = await supabase.from("pm_statuses").update({ label, color }).eq("id", id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const deleteStatus = useMutation({
    mutationFn: async (statusId: string) => {
      // Null out tasks that use this status
      await supabase.from("pm_tasks").update({ status_id: null }).eq("status_id", statusId)
      const { error } = await supabase.from("pm_statuses").delete().eq("id", statusId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const reorderStatuses = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(orderedIds.map((id, i) => supabase.from("pm_statuses").update({ sort_order: i }).eq("id", id)))
    },
    onSuccess: invalidate,
  })

  return { createStatus, updateStatus, deleteStatus, reorderStatuses }
}
