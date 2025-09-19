import type { ReactNode } from "react";
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const handleReset = () => {
    resetErrorBoundary();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div
      role="alert"
      className="space-y-4 rounded-md border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive"
    >
      <div className="space-y-2">
        <h2 className="text-base font-semibold">Something went wrong.</h2>
        <p className="text-xs text-destructive/80">{error?.message ?? "An unexpected error occurred."}</p>
      </div>
      <button
        type="button"
        onClick={handleReset}
        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Reload page
      </button>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ReactErrorBoundary fallbackRender={props => <ErrorFallback {...props} />} onReset={() => {}}>
      {children}
    </ReactErrorBoundary>
  );
}
