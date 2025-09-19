import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/shared/lib/api";
import { enableDevBypass, isDevBypassActive, isDevEnvironment, rememberReturnTo } from "@/shared/lib/env";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isDev = isDevEnvironment();
  const initialBypass = isDevBypassActive();
  const location = useLocation();

  const [loading, setLoading] = useState(!initialBypass);
  const [hasSession, setHasSession] = useState(initialBypass);

  useEffect(() => {
    // Check if we're in development mode with multiple fallbacks (same logic as Login)
    const isDev = isDevEnvironment();
    const devBypass = isDevBypassActive();

    console.log("🔒 ProtectedRoute: Dev check", { isDev, devBypass, hostname: window.location.hostname });

    if (devBypass) {
      console.log("🚧 ProtectedRoute: Dev bypass active, allowing access");
      setHasSession(true);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
        setLoading(false);
      } else {
        const intendedPath = `${location.pathname}${location.search}${location.hash}`;
        rememberReturnTo(intendedPath);
        if (isDev) {
          console.log("🚧 ProtectedRoute: No session in preview/dev, enabling dev bypass automatically");
          enableDevBypass();
          setHasSession(true);
          setLoading(false);
        } else {
          setHasSession(false);
          setLoading(false);
        }
      }
    });
  }, [location.hash, location.pathname, location.search]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!hasSession) return <Navigate to="/login" replace />;
  return children;
}