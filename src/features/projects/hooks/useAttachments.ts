import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import type { PmTaskAttachment } from "@/entities/supabase"

export function useAttachments(taskId: string | null) {
  return useQuery({
    queryKey: ["pm_attachments", taskId],
    queryFn: async (): Promise<PmTaskAttachment[]> => {
      if (!taskId) return []
      const { data, error } = await supabase
        .from("pm_task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as PmTaskAttachment[]
    },
    enabled: !!taskId,
  })
}

export function useAttachmentMutations(taskId: string, boardId: string) {
  const qc = useQueryClient()
  const { profile } = useAuth()

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      if (!profile) throw new Error("Not authenticated")

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("No session token")

      // Get signed upload URL from Netlify function
      const res = await fetch("/.netlify/functions/projects-attachment-url", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ fileName: file.name, mimeType: file.type, taskId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Failed to get upload URL")
      }

      const { signedUrl, token: uploadToken, storagePath } = await res.json()

      // Upload directly to storage
      const { error: uploadErr } = await supabase.storage
        .from("projects-attachments")
        .uploadToSignedUrl(storagePath, uploadToken, file, {
          contentType: file.type,
        })

      if (uploadErr) throw uploadErr

      // Register attachment record
      const { error: insertErr } = await supabase.from("pm_task_attachments").insert({
        task_id:      taskId,
        file_name:    file.name,
        file_size:    file.size,
        storage_path: storagePath,
        uploaded_by:  profile.id,
      })

      if (insertErr) throw insertErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_attachments", taskId] })
      qc.invalidateQueries({ queryKey: ["pm_board", boardId] })
    },
  })

  const deleteAttachment = useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await supabase.storage.from("projects-attachments").remove([storagePath])
      const { error } = await supabase.from("pm_task_attachments").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_attachments", taskId] })
      qc.invalidateQueries({ queryKey: ["pm_board", boardId] })
    },
  })

  const getDownloadUrl = async (storagePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from("projects-attachments")
      .createSignedUrl(storagePath, 300) // 5-minute TTL
    if (error) throw error
    return data.signedUrl
  }

  return { uploadAttachment, deleteAttachment, getDownloadUrl }
}
