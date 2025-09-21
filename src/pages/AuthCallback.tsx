import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/api";
import { popReturnToFromStorage, sanitizeReturnTo } from "@/shared/lib/env";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  const rawQueryReturnTo = useMemo(
    () => new URLSearchParams(location.search).get("returnTo"),
    [location.search],
  );
  const queryReturnTo = useMemo(
    () => (rawQueryReturnTo ? sanitizeReturnTo(rawQueryReturnTo) : null),
    [rawQueryReturnTo],
  );

  useEffect(() => {
    let mounted = true;
    const storedReturnTo = popReturnToFromStorage();
    const preferredReturnTo = queryReturnTo ?? storedReturnTo;
    const targetPath = preferredReturnTo && preferredReturnTo !== "/"
      ? preferredReturnTo
      : "/app";

    const handleAuthCallback = async () => {
      console.log("🔄 AuthCallback: Processing auth callback");

      try {
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: sessionData } = await supabase.auth.getSession();
        console.log(
          "📋 AuthCallback: Session check:",
          sessionData.session ? "✅ Found" : "❌ None",
        );

        if (sessionData.session && mounted) {
          console.log("✅ AuthCallback: Authentication successful, redirecting");
          navigate(targetPath, { replace: true });
        } else {
          console.log("❌ AuthCallback: No session found, redirecting to landing");
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.error("❌ AuthCallback: Error:", error);
        if (mounted) {
          navigate("/", { replace: true });
        }
      }
    };

    handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [navigate, queryReturnTo]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing sign-in...</p>
      </div>
    </div>
  );
}
