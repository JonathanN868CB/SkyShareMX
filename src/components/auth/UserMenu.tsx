import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setEmail(data.session?.user?.email ?? null);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setEmail(session?.user?.email ?? null);
      }
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      {email ? (
        <>
          <span className="text-muted-foreground">Signed in as {email}</span>
          <button
            onClick={onLogout}
            className="rounded-md border border-border px-3 py-1 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Log out
          </button>
        </>
      ) : (
        <a
          href="/login"
          className="rounded-md border border-border px-3 py-1 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Sign in
        </a>
      )}
    </div>
  );
}