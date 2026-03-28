import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/features/auth"
import { Button } from "@/shared/ui/button"
import skyShareLogo from "@/shared/assets/skyshare-logo.png"

export default function Login() {
  const { session, loading, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && session) navigate("/app", { replace: true })
  }, [loading, session, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Decorative gradient orbs */}
      <div
        className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--skyshare-navy) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--skyshare-crimson) 0%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        {/* Top stripe */}
        <div className="stripe-divider rounded-t" />

        {/* Card */}
        <div
          className="p-8 space-y-8"
          style={{
            background: "hsl(var(--card))",
            borderLeft: "1px solid hsl(var(--border))",
            borderRight: "1px solid hsl(var(--border))",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          {/* Logo + brand */}
          <div className="flex flex-col items-center gap-3">
            <img
              src={skyShareLogo}
              alt="SkyShare"
              className="h-12 w-auto object-contain brightness-0 invert opacity-90"
            />
            <div className="text-center space-y-0.5">
              <p
                className="text-[11px] font-bold tracking-[0.35em] uppercase"
                style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
              >
                Maintenance Portal
              </p>
              <p className="text-xs text-white/25 tracking-wide">
                Internal operations platform
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "hsl(var(--border))" }} />

          {/* Sign in */}
          <div className="space-y-4">
            <Button
              onClick={signInWithGoogle}
              className="w-full font-bold uppercase tracking-[0.1em] text-sm shadow-lg border-0"
              style={{
                background: "var(--skyshare-gold)",
                color: "hsl(0 0% 8%)",
                fontFamily: "var(--font-heading)",
                borderRadius: "3px",
                height: "44px",
              }}
              size="lg"
            >
              <GoogleIcon className="mr-2.5 h-4 w-4" />
              Continue with Google
            </Button>

            <p className="text-[11px] text-white/25 text-center tracking-wide">
              Restricted to @skyshare.com accounts
            </p>
          </div>

          {/* Request access */}
          <p className="text-center text-xs text-white/25">
            Need access?{" "}
            <a
              href="/request-access"
              className="transition-colors"
              style={{ color: "var(--skyshare-gold)", opacity: 0.8 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.8")}
            >
              Request it here
            </a>
          </p>
        </div>

        {/* Bottom stripe */}
        <div className="stripe-divider rounded-b" />
      </div>
    </div>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
