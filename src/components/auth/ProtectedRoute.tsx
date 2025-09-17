import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Check for development bypass
    const devBypass = import.meta.env.DEV && localStorage.getItem('dev-bypass') === 'true';
    
    if (devBypass) {
      setHasSession(true);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!hasSession) return <Navigate to="/login" replace />;
  return children;
}