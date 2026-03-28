import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { isAllowedEmail } from "@/shared/lib/env"

export default function AuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error || !session) {
        navigate("/?error=auth_failed", { replace: true })
        return
      }

      const email = session.user.email ?? ""

      if (!isAllowedEmail(email)) {
        await supabase.auth.signOut()
        navigate("/?error=domain_denied", { replace: true })
        return
      }

      // Fetch profile to check status
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", session.user.id)
        .single()

      if (!profile || profile.status === "Pending") {
        navigate("/request-access?status=pending", { replace: true })
        return
      }

      if (profile.status === "Suspended" || profile.status === "Inactive") {
        await supabase.auth.signOut()
        navigate(`/?error=${profile.status.toLowerCase()}`, { replace: true })
        return
      }

      // Update last_login
      await supabase
        .from("profiles")
        .update({ last_login: new Date().toISOString() })
        .eq("user_id", session.user.id)

      navigate("/app", { replace: true })
    })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted-foreground text-sm">Signing you in…</div>
    </div>
  )
}
