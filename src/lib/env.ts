const DEFAULT_DEV_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"] as const;
const DEFAULT_SITE_URL = "https://skyshare-maintenance.netlify.app";
const RETURN_TO_STORAGE_KEY = "skyshare:returnTo";
const DOMAIN_DENIED_MESSAGE_KEY = "auth:domainDeniedMessage";

const envHosts = (import.meta.env.VITE_DEV_HOSTS ?? "")
  .split(",")
  .map(host => host.trim().toLowerCase())
  .filter(Boolean);

const uniqueHosts = Array.from(new Set([...DEFAULT_DEV_HOSTS, ...envHosts]));

function matchesHost(hostname: string, candidate: string) {
  if (!candidate) return false;
  const normalized = candidate
    .replace(/^\*\./, "")
    .replace(/^\*/, "")
    .replace(/^\./, "")
    .toLowerCase();

  if (!normalized) return false;

  return hostname === normalized || hostname.endsWith(`.${normalized}`);
}

export const DEV_HOSTS = uniqueHosts;

export function isDevEnvironment(): boolean {
  if (import.meta.env.DEV || import.meta.env.MODE === "development") {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  return uniqueHosts.some(candidate => matchesHost(hostname, candidate));
}

export function isDevBypassActive(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return isDevEnvironment() && localStorage.getItem("dev-bypass") === "true";
}

export function enableDevBypass() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("dev-bypass", "true");
}

function normalizeOrigin(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return undefined;
    }
    return url.origin.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

function resolveEnvPublicSiteUrl() {
  const browserValue = normalizeOrigin(import.meta.env.VITE_PUBLIC_SITE_URL);

  if (browserValue) {
    return browserValue;
  }

  if (typeof process !== "undefined" && process.env) {
    const envValue =
      normalizeOrigin(process.env.VITE_PUBLIC_SITE_URL) ??
      normalizeOrigin(process.env.SITE_URL) ??
      normalizeOrigin(process.env.URL) ??
      normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);

    if (envValue) {
      return envValue;
    }
  }

  return undefined;
}

export function getPublicSiteUrl() {
  if (typeof window !== "undefined") {
    return resolveEnvPublicSiteUrl() ?? window.location.origin;
  }
  return resolveEnvPublicSiteUrl() ?? DEFAULT_SITE_URL;
}

export function sanitizeReturnTo(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function rememberReturnTo(raw: string | null) {
  if (typeof window === "undefined") return;
  const sanitized = sanitizeReturnTo(raw);
  if (sanitized && sanitized.startsWith("/app")) {
    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, sanitized);
  } else {
    sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
  }
}

export function popReturnToFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
  sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
  const sanitized = sanitizeReturnTo(stored);
  if (sanitized && sanitized.startsWith("/app")) {
    return sanitized;
  }
  return null;
}

function readEnvValue(key: string): string | undefined {
  const browserEnv =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>)
      : undefined;
  const browserValue = browserEnv?.[key];
  if (typeof browserValue === "string" && browserValue.length > 0) {
    return browserValue;
  }
  if (typeof process !== "undefined" && process.env) {
    const serverValue = process.env[key];
    if (typeof serverValue === "string" && serverValue.length > 0) {
      return serverValue;
    }
  }
  return undefined;
}

export function getAdminEmails(): string[] {
  const raw = readEnvValue("VITE_ADMIN_EMAILS") ?? "";
  return raw
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export function setDomainDeniedMessage(message: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DOMAIN_DENIED_MESSAGE_KEY, message);
}

export function consumeDomainDeniedMessage(): string | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(DOMAIN_DENIED_MESSAGE_KEY);
  if (stored) {
    sessionStorage.removeItem(DOMAIN_DENIED_MESSAGE_KEY);
    return stored;
  }
  return null;
}
