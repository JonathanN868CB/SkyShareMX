import { shouldAllowLovableOverlay } from "./env";

const LOVABLE_SCRIPT_SELECTOR = 'script[src*="lovable.app"]';
const LOVABLE_OVERLAY_SELECTORS = [
  "[data-lovable-overlay]",
  "[data-testid='lovable-overlay']",
  "#lovable-editor",
  "#lovable-overlay",
];
const LOVABLE_QUERY_PARAMS = ["lovable", "lovable_edit", "lovablePreview", "lovablePreviewMode"];

function removeLovableArtifacts() {
  if (typeof document === "undefined") {
    return;
  }

  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>(LOVABLE_SCRIPT_SELECTOR));
  scripts.forEach(script => {
    script.remove();
  });

  LOVABLE_OVERLAY_SELECTORS.forEach(selector => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    nodes.forEach(node => node.remove());
  });

  const globalWindow = window as typeof window & { __LOVABLE__?: unknown; Lovable?: unknown };
  if ("__LOVABLE__" in globalWindow) {
    try {
      delete globalWindow.__LOVABLE__;
    } catch {
      globalWindow.__LOVABLE__ = undefined;
    }
  }

  if ("Lovable" in globalWindow) {
    try {
      delete (globalWindow as Record<string, unknown>).Lovable;
    } catch {
      (globalWindow as Record<string, unknown>).Lovable = undefined;
    }
  }
}

function scrubLovableQueryParams() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const url = new URL(window.location.href);
    let changed = false;

    LOVABLE_QUERY_PARAMS.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    });

    if (changed) {
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, document.title, nextUrl);
    }
  } catch {
    // Ignore malformed URLs; nothing to scrub.
  }
}

export function enforceLovableOverlayPolicy() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (shouldAllowLovableOverlay()) {
    return;
  }

  scrubLovableQueryParams();
  removeLovableArtifacts();
}

