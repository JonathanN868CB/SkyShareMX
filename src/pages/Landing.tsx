import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

import {
  consumeDomainDeniedMessage,
  getPublicSiteUrl,
  rememberReturnTo,
  sanitizeReturnTo,
} from "@/shared/lib/env";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
);

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [domainMessage, setDomainMessage] = useState<string | null>(null);

  const rawReturnTo = useMemo(() => new URLSearchParams(location.search).get("returnTo"), [location.search]);
  const safeReturnTo = useMemo(
    () => (rawReturnTo ? sanitizeReturnTo(rawReturnTo) : null),
    [rawReturnTo],
  );

  useEffect(() => {
    if (safeReturnTo) {
      rememberReturnTo(safeReturnTo);
    }
  }, [safeReturnTo]);

  useEffect(() => {
    const message = consumeDomainDeniedMessage();
    if (message) {
      setDomainMessage(message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) navigate("/app", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/app", { replace: true });
    });
    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleGoogle = async () => {
    const siteUrl = getPublicSiteUrl();
    const redirectUrl = safeReturnTo
      ? `${siteUrl}/auth/callback?returnTo=${encodeURIComponent(safeReturnTo)}`
      : `${siteUrl}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl },
    });
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden grid place-items-center"
      aria-label="SkyShare Maintenance Portal login"
      style={{
        // Rich, responsive, full-bleed background (no images)
        background: `
          radial-gradient(1200px 620px at 22% 8%, rgba(248,219,215,.92), transparent 62%),
          radial-gradient(980px 540px at 86% 14%, rgba(255,210,220,.82), transparent 56%),
          radial-gradient(1120px 700px at 50% 86%, rgba(232,240,255,.88), transparent 60%),
          radial-gradient(760px 460px at 12% 82%, rgba(255,240,220,.82), transparent 56%),
          radial-gradient(1080px 600px at 92% 72%, rgba(240,230,255,.78), transparent 60%),
          radial-gradient(1200px 900px at 50% 0%, rgba(255,255,255,.28), transparent 70%),
          radial-gradient(1600px 900px at 50% 100%, rgba(0,0,0,.06), transparent 70%),
          #f7f3ef
        `,
      }}
    >
      <div className="relative w-[92%] max-w-xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[34px] opacity-70 blur-[90px]"
          style={{
            background:
              "radial-gradient(110% 120% at 28% 18%, rgba(255,255,255,0.75), rgba(255,255,255,0))",
          }}
        />
        <div
          className="relative overflow-hidden rounded-[26px] border border-white/45 px-8 py-9 md:px-12 md:py-11 shadow-[0_28px_60px_rgba(20,25,45,0.22)] ring-1 ring-white/55 backdrop-blur-3xl"
          style={{
            background:
              "linear-gradient(164deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.7) 48%, rgba(255,255,255,0.52) 100%)",
          }}
        >
          <div className="flex flex-col items-center gap-7 text-center">
            {/* Horizontal SkyShare wordmark */}
            <img
              src="/brands/skyshare-lockup.png"
              alt="SkyShare"
              className="w-48 md:w-60 lg:w-[17rem] select-none drop-shadow-sm"
              draggable={false}
            />
            <div className="max-w-sm">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">Maintenance Portal</h1>
              <p className="mt-3 text-base md:text-lg text-neutral-600">The home base for SkyShare Maintenance</p>
            </div>
            {domainMessage ? (
              <div className="w-full rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-sm">
                {domainMessage}
              </div>
            ) : null}
            <button
              onClick={handleGoogle}
              className="w-full md:w-auto min-w-[240px] px-7 py-3 md:px-9 md:py-3 rounded-xl font-semibold text-white border border-white/20 shadow-[0_6px_20px_rgba(193,34,43,.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400"
              aria-label="Continue with Google"
              style={{
                background: `linear-gradient(180deg, #d93a3e 0%, #c8222b 55%, #b81b25 100%)`,
              }}
            >
              Continue with Google
            </button>
            <p className="text-sm text-neutral-600 mt-1.5">
              Access restricted to <span className="font-medium">@skyshare.com</span> email addresses
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
