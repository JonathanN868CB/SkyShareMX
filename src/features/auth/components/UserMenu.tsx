import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/api";
import { useUserPermissions } from "@/hooks/useUserPermissions";

export default function UserMenu() {
  const navigate = useNavigate();
  const { user } = useUserPermissions();
  const email = user?.email ?? null;

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
          href="/"
          className="rounded-md border border-border px-3 py-1 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Sign in
        </a>
      )}
    </div>
  );
}