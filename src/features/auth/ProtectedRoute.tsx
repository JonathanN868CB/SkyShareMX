import { useEffect, useRef, useState } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "./AuthContext"
import { AuthTransitionScreen } from "@/app/AuthTransitionScreen"

const MIN_DISPLAY_MS = 1200

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  // Only show the branded transition screen when arriving from an OAuth callback.
  // Normal refreshes (already-logged-in) skip it entirely.
  const isOAuthTransition = useRef(sessionStorage.getItem("oauth_transition") === "1")
  if (isOAuthTransition.current) sessionStorage.removeItem("oauth_transition")

  type Phase = "entering" | "exiting" | "done"
  const [phase, setPhase] = useState<Phase>(isOAuthTransition.current ? "entering" : "done")
  const appearedAt = useRef<number>(Date.now())

  useEffect(() => {
    if (!loading && phase === "entering") {
      if (session) {
        const elapsed = Date.now() - appearedAt.current
        const delay = Math.max(0, MIN_DISPLAY_MS - elapsed)
        const t1 = setTimeout(() => {
          setPhase("exiting")
          const t2 = setTimeout(() => setPhase("done"), 420)
          return () => clearTimeout(t2)
        }, delay)
        return () => clearTimeout(t1)
      } else {
        setPhase("done")
      }
    }
  // phase intentionally omitted — including it cancels the timeout on re-render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session])

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
