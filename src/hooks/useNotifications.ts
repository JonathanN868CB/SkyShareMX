import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"

export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  metadata: Record<string, string>
  read: boolean
  created_at: string
}

export function useNotifications() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20)
    setNotifications((data as AppNotification[]) ?? [])
    setLoading(false)
  }, [profile?.id])

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from("notifications").update({ read: true }).eq("id", id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!profile?.id) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("recipient_profile_id", profile.id)
      .eq("read", false)
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    fetchNotifications()

    // Realtime — prepend new notifications as they arrive
    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_profile_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as AppNotification, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id, fetchNotifications])

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
