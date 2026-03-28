import { useEffect, useRef, useState } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "./AuthContext"
import { AuthTransitionScreen } from "@/app/AuthTransitionScreen"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  // Only show the branded transition screen when arriving from an OAuth callback.
  // Normal refreshes (already-logged-in) skip it entirely.
  const isOAuthTransition = useRef(sessionStorage.getItem("oauth_transition") === "1")
  if (isOAuthTransition.current) sessionStorage.removeItem("oauth_transition")

  type Phase = "entering" | "exiting" | "done"
  const [phase, setPhase] = useState<Phase>(isOAuthTransition.current ? "entering" : "done")

  useEffect(() => {
    if (!loading && phase === "entering") {
      if (session) {
        setPhase("exiting")
        const t = setTimeout(() => setPhase("done"), 420)
        return () => clearTimeout(t)
      } else {
        setPhase("done")
      }
    }
  }, [loading, session, phase])

  if (phase !== "done") {
    return <AuthTransitionScreen exiting={phase === "exiting"} />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
