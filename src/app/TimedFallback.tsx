import React from "react";

import { appendAuthLog } from "@/debug";

export function TimedFallback({ children }: { children: React.ReactNode }) {
  const [stale, setStale] = React.useState(false);

  React.useEffect(() => {
    appendAuthLog("Suspense fallback enter");
    const id = setTimeout(() => setStale(true), 1500);
    return () => {
      clearTimeout(id);
      appendAuthLog("Suspense fallback exit");
    };
  }, []);

  React.useEffect(() => {
    if (stale) {
      appendAuthLog("Suspense fallback >1500ms");
    }
  }, [stale]);

  return <>{children}</>;
}
