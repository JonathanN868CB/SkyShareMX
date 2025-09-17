import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Processing authentication...");

  useEffect(() => {
    console.log("🔄 AuthCallback: Starting auth processing");
    
    let timeoutId: NodeJS.Timeout;
    let mounted = true;
    
    const handleAuthCallback = async () => {
      try {
        console.log("🔍 AuthCallback: Checking initial session");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("❌ AuthCallback: Session error:", error);
          if (mounted) {
            setStatus("Authentication failed");
            navigate("/login?error=" + encodeURIComponent(error.message));
          }
          return;
        }

        if (data.session) {
          console.log("✅ AuthCallback: Session found immediately", data.session.user?.email);
          if (mounted) {
            setStatus("Authentication successful! Redirecting...");
            setTimeout(() => {
              try {
                if (window.opener && !window.opener.closed) {
                  console.log("📤 AuthCallback: Posting success message to parent");
                  window.opener.postMessage({ type: 'oauth-success' }, "*");
                  window.close();
                  return;
                }
              } catch (e) {
                console.log("⚠️ AuthCallback: Could not message parent:", e);
              }
              console.log("🏠 AuthCallback: Navigating to home");
              navigate("/", { replace: true });
            }, 100);
          }
          return;
        }

        console.log("⏳ AuthCallback: No immediate session, listening for auth changes");
        setStatus("Waiting for authentication to complete...");
        
        // Listen for auth state changes if no immediate session
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log("🔔 AuthCallback: Auth state changed:", event, session?.user?.email || "no user");
          
          if (event === 'SIGNED_IN' && session) {
            console.log("✅ AuthCallback: User signed in via state change");
            if (mounted) {
              setStatus("Authentication successful! Redirecting...");
              setTimeout(() => {
                try {
                  if (window.opener && !window.opener.closed) {
                    console.log("📤 AuthCallback: Posting success message to parent");
                    window.opener.postMessage({ type: 'oauth-success' }, "*");
                    window.close();
                    return;
                  }
                } catch (e) {
                  console.log("⚠️ AuthCallback: Could not message parent:", e);
                }
                console.log("🏠 AuthCallback: Navigating to home");
                navigate("/", { replace: true });
              }, 100);
            }
          } else if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
            console.log("❌ AuthCallback: Auth failed or signed out");
            if (mounted) {
              setStatus("Authentication failed");
              navigate("/login", { replace: true });
            }
          }
        });

        // Timeout fallback
        timeoutId = setTimeout(() => {
          console.log("⏰ AuthCallback: Timeout reached, redirecting to login");
          if (mounted) {
            setStatus("Authentication timed out");
            navigate("/login", { replace: true });
          }
        }, 10000);

        return () => {
          subscription.unsubscribe();
        };
        
      } catch (err) {
        console.error("❌ AuthCallback: Unexpected error:", err);
        if (mounted) {
          setStatus("Authentication error");
          navigate("/login", { replace: true });
        }
      }
    };

    const cleanup = handleAuthCallback();
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}