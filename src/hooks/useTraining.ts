import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/features/auth"

export interface TrainingRow {
  trainingItem:     string
  category:         string
  assignedDate:     string
  dueDate:          string
  trainingResource: string
  status:           string
  notes:            string
  submitCompletion: string
}

const COOLDOWN_SECONDS = 600 // 10 minutes

export function useTraining(targetProfileId?: string) {
  const { session, profile } = useAuth()

  const [rows, setRows]                   = useState<TrainingRow[]>([])
  const [loading, setLoading]             = useState(false)
  const [linked, setLinked]               = useState<boolean | null>(null)
  const [authExpired, setAuthExpired]     = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [cooldown, setCooldown]           = useState(0)

  const hasFetchedRef = useRef(false)
  const loadingRef    = useRef(false)

  // Seed lastRefreshed from the profile on first load
  useEffect(() => {
    const ts = targetProfileId
      ? null  // admin view: no cached timestamp available client-side
      : profile?.training_last_refreshed
    if (ts) setLastRefreshed(new Date(ts))
  }, [profile?.training_last_refreshed, targetProfileId])

  // Cooldown countdown — ticks every second while > 0
  useEffect(() => {
    if (!lastRefreshed) return
    const update = () => {
      const elapsed  = (Date.now() - lastRefreshed.getTime()) / 1000
      const remaining = Math.max(0, COOLDOWN_SECONDS - Math.floor(elapsed))
      setCooldown(remaining)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [lastRefreshed])

  const fetchTraining = useCallback(async () => {
    if (!session?.access_token) return
    if (loadingRef.current) return

    loadingRef.current = true
    setLoading(true)
    setAuthExpired(false)

    try {
      const body: Record<string, string> = {}
      if (targetProfileId) body.targetProfileId = targetProfileId

      const res  = await fetch("/.netlify/functions/get-training-data", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json() as {
        rows?: TrainingRow[]
        linked?: boolean
        lastRefreshed?: string
        error?: string
      }

      if (res.status === 401 && data.error === "google_auth_expired") {
        setAuthExpired(true)
        setLinked(false)
        return
      }

      if (!res.ok) {
        console.error("get-training-data error:", data.error)
        return
      }

      setRows(data.rows ?? [])
      setLinked(data.linked ?? false)
      if (data.lastRefreshed) setLastRefreshed(new Date(data.lastRefreshed))
    } catch (err) {
      console.error("useTraining fetch error:", err)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [session?.access_token, targetProfileId])

  // Auto-fetch once per mount when the user has a linked sheet
  useEffect(() => {
    if (hasFetchedRef.current) return
    if (!profile && !targetProfileId) return

    // For regular user: only auto-fetch if they have a sheet linked
    if (!targetProfileId && !profile?.training_sheet_file_id) {
      setLinked(false)
      return
    }

    hasFetchedRef.current = true
    fetchTraining()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.training_sheet_file_id, targetProfileId])

  const canRefresh = !loading && cooldown === 0

  // Format cooldown as M:SS for display
  const cooldownLabel = cooldown > 0
    ? `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`
    : null

  return {
    rows,
    loading,
    linked,
    authExpired,
    lastRefreshed,
    cooldown,
    cooldownLabel,
    canRefresh,
    refresh: fetchTraining,
  }
}
