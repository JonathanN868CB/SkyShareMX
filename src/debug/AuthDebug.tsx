/* eslint-disable react-refresh/only-export-components */
import React from "react";

const MAX_BUFFER = 200;

const isDebugEnabled = () => {
  const metaEnv =
    (typeof import.meta !== "undefined" ? (import.meta.env as Record<string, string | undefined>) : undefined) ?? undefined;
  const value = metaEnv?.VITE_DEBUG_AUTH ?? (typeof process !== "undefined" ? process.env?.VITE_DEBUG_AUTH : undefined);
  return value === "1";
};

const buffer: string[] = [];

export function appendAuthLog(line: string) {
  if (!isDebugEnabled()) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  const parts = new Date().toISOString().split("T");
  const time = (parts[1] ?? "").replace("Z", "");
  buffer.push(`[${time}] ${line}`);
  if (buffer.length > MAX_BUFFER) {
    buffer.shift();
  }
  const ev = new CustomEvent("auth-debug-append", { detail: buffer.slice() });
  window.dispatchEvent(ev);
}

export function AuthDebugOverlay() {
  const enabled = isDebugEnabled() && typeof window !== "undefined";
  const [visible, setVisible] = React.useState(true);
  const [lines, setLines] = React.useState<string[]>(() => buffer.slice());

  React.useEffect(() => {
    if (!enabled || !visible) {
      return;
    }
    const handleAppend = (event: Event) => {
      const detail = (event as CustomEvent<string[]>).detail ?? [];
      setLines(detail);
    };
    window.addEventListener("auth-debug-append", handleAppend);
    setLines(buffer.slice());
    return () => {
      window.removeEventListener("auth-debug-append", handleAppend);
    };
  }, [enabled, visible]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    setLines(buffer.slice());
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  if (!visible) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        style={{
          position: "fixed",
          right: 8,
          bottom: 8,
          zIndex: 99999,
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          padding: "6px 10px",
          fontSize: 12,
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
        }}
      >
        Show Auth Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 99999,
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        padding: "8px 10px",
        fontSize: 12,
        maxWidth: 420,
        maxHeight: 260,
        overflow: "auto",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontWeight: 700 }}>Auth Debug</div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12,
            lineHeight: 1,
          }}
          aria-label="Close auth debug overlay"
        >
          ×
        </button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{lines.join("\n")}</pre>
    </div>
  );
}
