const DEFAULT_DEV_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"] as const;

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
