import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const [redirecting, setRedirecting] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [devBypass, setDevBypass] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // Listen first so we don't miss events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔔 Login: Auth state changed:", event, session?.user?.email || "no user");
      setEmail(session?.user?.email ?? null);
      if (event === 'SIGNED_IN' && mounted) {
        console.log("✅ Login: Detected signed in, navigating to home");
        navigate('/', { replace: true });
      }
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const e = data.session?.user?.email ?? null;
      setEmail(e);
      if (data.session) {
        console.log("✅ Login: Existing session found, navigating to home");
        navigate('/', { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleGoogleLogin = async () => {
    console.log("🚀 Login: Starting Google OAuth flow");
    setErrMsg(null);
    setRedirecting(true);

    const redirectUrl = window.location.origin + "/auth/callback";
    console.log("🔄 Login: Using redirect URL:", redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error("❌ Login: OAuth error:", error);
      const errorMsg = error.code ? `${error.message} (${error.code})` : error.message || "Login failed";
      setErrMsg(errorMsg);
      setRedirecting(false);
      return;
    }

    // Simple redirect approach - works great in new tabs
    console.log("🔄 Login: Redirecting to Google OAuth");
  };

  const handleDevBypass = () => {
    console.log("🚧 Login: Development bypass - navigating to dashboard");
    setDevBypass(true);
    localStorage.setItem('dev-bypass', 'true');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
          {/* Logo placeholder */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-primary-foreground font-bold text-2xl">S</span>
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground mb-1">
              Maintenance Portal
            </h1>
            <p className="text-muted-foreground">
              The home base for SkyShare Maintenance
            </p>
          </div>

          {/* Already signed in state */}
          {email && (
            <div className="mb-4 p-3 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">
                You're already signed in as <span className="font-medium">{email}</span>
              </p>
              <button
                onClick={() => navigate("/")}
                className="text-primary hover:underline text-sm font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {/* Google login button */}
          <button
            onClick={handleGoogleLogin}
            disabled={redirecting}
            className="w-full bg-google-red hover:bg-google-red-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3 mb-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{redirecting ? "Signing you in…" : "Continue with Google"}</span>
          </button>

          {/* Development bypass button - only in development */}
          {import.meta.env.DEV && (
            <button
              onClick={handleDevBypass}
              className="w-full bg-muted hover:bg-muted/80 text-muted-foreground font-medium py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
            >
              Skip Login (Development)
            </button>
          )}
          
          {errMsg && (
            <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="text-sm text-destructive">{errMsg}</div>
              {errMsg.includes("iframe") || errMsg.includes("blocked") ? (
                <button
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Try opening in a new tab
                </button>
              ) : null}
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              By continuing, you agree to SkyShare's terms of service and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}