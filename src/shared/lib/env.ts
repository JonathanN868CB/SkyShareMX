const DEFAULT_DEV_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"] as const;
const FALLBACK_DEV = "http://localhost:5173";
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

function normalizeOrigin(u: string) {
  try {
    const url = new URL(u);
    return url.origin;
  } catch {
    return u.trim().replace(/\/+$/, "");
  }
}

export function sanitizeReturnTo(input?: string | null): string {
  if (!input) return "/";
  if (input.startsWith("/")) {
    return input;
  }

  try {
    const candidate = new URL(input);
    const siteOrigin = normalizeOrigin(getPublicSiteUrl());
    if (normalizeOrigin(candidate.origin) === siteOrigin) {
      return (candidate.pathname || "/") + (candidate.search || "") + (candidate.hash || "");
    }
  } catch {
    // Ignore errors and fall through to default
  }
  return "/";
}

export function rememberReturnTo(raw?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!raw) {
      sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
      return;
    }
    const sanitized = sanitizeReturnTo(raw);
    sessionStorage.setItem(RETURN_TO_STORAGE_KEY, sanitized);
  } catch {
    // Ignore storage errors (e.g., disabled cookies)
  }
}

export function popReturnToFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
    sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return sanitizeReturnTo(stored);
  } catch {
    return null;
  }
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

function requireEnvValue(keys: string[], description: string): string {
  for (const key of keys) {
    const value = readEnvValue(key);
    if (value) {
      return value;
    }
  }

  const message =
    `Missing required environment configuration for ${description}. ` +
    `Set one of: ${keys.join(", ")}.`;

  if (
    typeof console !== "undefined" &&
    (typeof process === "undefined" || process.env?.NODE_ENV !== "production")
  ) {
    console.warn(message);
  }

  throw new Error(message);
}

function resolveEnvSiteUrl() {
  const candidates = [
    readEnvValue("VITE_SITE_URL"),
    readEnvValue("VITE_PUBLIC_SITE_URL"),
    readEnvValue("SITE_URL"),
    readEnvValue("URL"),
    readEnvValue("NEXT_PUBLIC_SITE_URL"),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return normalizeOrigin(candidate);
    }
  }

  return normalizeOrigin(FALLBACK_DEV);
}

const SITE_URL_FROM_ENV = resolveEnvSiteUrl();

export function getSupabaseUrl(): string {
  return requireEnvValue(
    ["VITE_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
    "Supabase URL"
  );
}

export function getSupabaseAnonKey(): string {
  return requireEnvValue(
    [
      "VITE_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
    ],
    "Supabase anonymous key"
  );
}

export function getPublicSiteUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return SITE_URL_FROM_ENV;
}

export const SITE_URL = getPublicSiteUrl();

export function getAdminEmails(): string[] {
  const raw = readEnvValue("VITE_ADMIN_EMAILS") ?? "";
  const MASTER_ADMIN_EMAIL = "jonathan@skyshare.com";
  const configured = raw
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(value => value === MASTER_ADMIN_EMAIL);

  return Array.from(new Set([MASTER_ADMIN_EMAIL, ...configured]));
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
