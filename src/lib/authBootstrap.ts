import { SupabaseClient, Session } from "@supabase/supabase-js";

import { appendAuthLog } from "@/debug";

let wired = false;

type Handlers = {
  onSession: (session: Session | null) => Promise<void> | void;
  onReady: () => void;
  onError?: (err: unknown) => void;
};

export function bootstrapAuth(client: SupabaseClient, handlers: Handlers) {
  const { onSession, onReady, onError } = handlers;

  if (wired) {
    appendAuthLog("bootstrapAuth: duplicate call ignored");
    return () => {};
  }

  wired = true;
  appendAuthLog("bootstrapAuth: start");

  let initialSessionHandled = false;

  (async () => {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw error;
      }
      appendAuthLog("getSession resolved");
      await onSession(data?.session ?? null);
    } catch (err) {
      appendAuthLog("getSession error → falling back to null");
      onError?.(err);
      await onSession(null);
    } finally {
      const flushReady = () => {
        appendAuthLog("bootstrapAuth onReady()");
        onReady();
      };
      if (typeof queueMicrotask === "function") {
        queueMicrotask(flushReady);
      } else {
        Promise.resolve().then(flushReady);
      }
    }
  })();

  const { data: sub } = client.auth.onAuthStateChange(async (event, session) => {
    appendAuthLog(`onAuthStateChange: ${event}`);
    if (event === "INITIAL_SESSION") {
      if (!initialSessionHandled) {
        initialSessionHandled = true;
        await onSession(session ?? null);
        appendAuthLog("INITIAL_SESSION handled");
      }
      return;
    }
    await onSession(session ?? null);
  });

  return () => {
    appendAuthLog("bootstrapAuth: unsubscribe");
    wired = false;
    sub.subscription.unsubscribe();
  };
}
