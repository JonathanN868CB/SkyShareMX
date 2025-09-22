import { SupabaseClient, Session } from "@supabase/supabase-js";

let initialSessionHandled = false;

type Handlers = {
  onSession: (session: Session | null) => Promise<void> | void;
  onReady: () => void; // clear loaders / disable mock-mode
  onError?: (err: unknown) => void; // optional toast
};

export function bootstrapAuth(client: SupabaseClient, handlers: Handlers) {
  const { onSession, onReady, onError } = handlers;

  // 1) Read persisted session once
  client.auth
    .getSession()
    .then(async ({ data, error }) => {
      if (error) throw error;
      await onSession(data?.session ?? null);
      onReady();
    })
    .catch(err => {
      onError?.(err);
      // Even on error, ensure UI becomes interactive (shows login)
      onSession(null);
      onReady();
    });

  // 2) Subscribe to auth changes
  const { data: sub } = client.auth.onAuthStateChange(async (event, session) => {
    if (event === "INITIAL_SESSION") {
      if (!initialSessionHandled) {
        await onSession(session ?? null);
        initialSessionHandled = true;
      }
      return;
    }
    await onSession(session ?? null);
  });

  return () => sub.subscription.unsubscribe();
}
