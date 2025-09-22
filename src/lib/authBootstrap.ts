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

  const invokeSessionHandler = (session: Session | null, source: string) => {
    try {
      const result = onSession(session);
      if (result && typeof (result as PromiseLike<void>).then === "function") {
        (result as PromiseLike<void>).catch(error => {
          appendAuthLog(
            `bootstrapAuth onSession error (${source}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          try {
            onError?.(error);
          } catch (handlerError) {
            appendAuthLog(
              `bootstrapAuth onError error (${source}): ${
                handlerError instanceof Error ? handlerError.message : String(handlerError)
              }`,
            );
          }
        });
      }
    } catch (error) {
      appendAuthLog(
        `bootstrapAuth onSession error (${source}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      try {
        onError?.(error);
      } catch (handlerError) {
        appendAuthLog(
          `bootstrapAuth onError error (${source}): ${
            handlerError instanceof Error ? handlerError.message : String(handlerError)
          }`,
        );
      }
    }
  };

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
      invokeSessionHandler(data?.session ?? null, "getSession");
    } catch (err) {
      appendAuthLog("getSession error → falling back to null");
      onError?.(err);
      invokeSessionHandler(null, "getSession-fallback");
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

  const { data: sub } = client.auth.onAuthStateChange((event, session) => {
    appendAuthLog(`onAuthStateChange: ${event}`);
    if (event === "INITIAL_SESSION") {
      if (!initialSessionHandled) {
        initialSessionHandled = true;
        invokeSessionHandler(session ?? null, "INITIAL_SESSION");
        appendAuthLog("INITIAL_SESSION handled");
      }
      return;
    }
    invokeSessionHandler(session ?? null, event);
  });

  return () => {
    appendAuthLog("bootstrapAuth: unsubscribe");
    wired = false;
    sub.subscription.unsubscribe();
  };
}
