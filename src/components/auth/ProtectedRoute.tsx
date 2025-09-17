import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Check if we're in development mode with multiple fallbacks (same logic as Login)
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || window.location.hostname === 'localhost' || window.location.hostname.includes('lovable.app');
    const devBypass = isDev && localStorage.getItem('dev-bypass') === 'true';
    
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
        if (isDev) {
          console.log("🚧 ProtectedRoute: No session in preview/dev, enabling dev bypass automatically");
          localStorage.setItem('dev-bypass', 'true');
          setHasSession(true);
          setLoading(false);
        } else {
          setHasSession(false);
          setLoading(false);
        }
      }
    });
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!hasSession) return <Navigate to="/login" replace />;
  return children;
}