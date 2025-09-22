import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { appendAuthLog } from "@/debug";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { isDevBypassActive, rememberReturnTo } from "@/shared/lib/env";

const hiddenWrapperStyle: CSSProperties = {
  position: "absolute",
  width: 0,
  height: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
};

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const { loading, user } = useUserPermissions();
  const devBypass = isDevBypassActive();
  const hasAccess = devBypass || Boolean(user);
  const recordedReturn = useRef(false);

  useEffect(() => {
    appendAuthLog(`ProtectedRoute mount (${location.pathname})`);
    return () => {
      appendAuthLog("ProtectedRoute unmount");
    };
  }, [location.pathname]);

  useEffect(() => {
    appendAuthLog(
      `ProtectedRoute state change: loading=${loading ? "true" : "false"}, devBypass=${
        devBypass ? "true" : "false"
      }, user=${user ? user.id ?? "present" : "null"}`,
    );
  }, [loading, devBypass, user]);

  useEffect(() => {
    if (loading) {
      appendAuthLog("ProtectedRoute decision: show loader");
      return;
    }

    if (hasAccess) {
      appendAuthLog("ProtectedRoute decision: render children");
      recordedReturn.current = false;
      return;
    }

    appendAuthLog("ProtectedRoute decision: redirect to /");
    if (!recordedReturn.current) {
      const intendedPath = `${location.pathname}${location.search}${location.hash}`;
      rememberReturnTo(intendedPath);
      recordedReturn.current = true;
      appendAuthLog(`ProtectedRoute rememberReturnTo: ${intendedPath}`);
    }
  }, [loading, hasAccess, location.pathname, location.search, location.hash]);

  if (loading) {
    return (
      <>
        <div className="p-6 text-sm text-muted-foreground" aria-live="polite">
          Loading…
        </div>
        <div style={hiddenWrapperStyle} aria-hidden>
          {children}
        </div>
      </>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return children;
}