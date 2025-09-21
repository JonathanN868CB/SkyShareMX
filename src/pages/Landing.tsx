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
        background:
          `
          radial-gradient(1200px 600px at 20% 10%, rgba(247,219,215,.8), transparent 60%),
          radial-gradient(900px 520px at 85% 15%, rgba(255,224,230,.7), transparent 55%),
          radial-gradient(1100px 680px at 50% 85%, rgba(232,240,255,.8), transparent 60%),
          radial-gradient(700px 420px at 10% 80%, rgba(255,240,220,.7), transparent 55%),
          radial-gradient(1000px 560px at 90% 70%, rgba(240,230,255,.6), transparent 60%),
          #f7f3ef
          `,
      }}
    >
      <div className="w-[92%] max-w-2xl rounded-2xl bg-white/85 backdrop-blur shadow-2xl p-8 md:p-10">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* TODO: replace with real logo/wordmark component if present */}
          <div className="h-12 w-12 rounded-xl bg-black/90 text-white grid place-items-center text-2xl font-semibold select-none">
            S
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Maintenance Portal</h1>
            <p className="mt-2 text-base md:text-lg text-neutral-600">The home base for SkyShare Maintenance</p>
          </div>
          {domainMessage ? (
            <div className="w-full rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-sm">
              {domainMessage}
            </div>
          ) : null}
          <button
            onClick={handleGoogle}
            className="w-full md:w-auto px-6 py-3 md:px-8 md:py-3 rounded-xl font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400"
            aria-label="Continue with Google"
            style={{
              background:
                `linear-gradient(180deg, #d3292c 0%, #c01a22 100%)`,
            }}
          >
            Continue with Google
          </button>
          <p className="text-sm text-neutral-600 mt-2">
            Access restricted to <span className="font-medium">@skyshare.com</span> email addresses
          </p>
        </div>
      </div>
    </div>
  );
}
