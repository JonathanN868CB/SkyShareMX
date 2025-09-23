import { buildAuthorizedHeaders } from "@/lib/api/users";

const ROLE_DEFAULTS_ENDPOINT = "/.netlify/functions/role-defaults";

const ROLE_KEYS = ["manager", "technician", "viewer"] as const;
const PERMISSION_LEVEL_VALUES = ["none", "read", "write"] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];
export type PermissionLevel = (typeof PERMISSION_LEVEL_VALUES)[number];

export type RoleDefaultsMap = Record<RoleKey, Record<string, PermissionLevel>>;

const VALID_ROLE_KEYS = new Set<RoleKey>(ROLE_KEYS);
const VALID_PERMISSION_LEVELS = new Set<PermissionLevel>(PERMISSION_LEVEL_VALUES);

function assertClientSide() {
  if (typeof window === "undefined" && typeof fetch === "undefined") {
    throw new Error("Role defaults API is not available in this execution environment");
  }
}

async function handleResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function createEmptyRoleDefaultsMap(): RoleDefaultsMap {
  return ROLE_KEYS.reduce<RoleDefaultsMap>((accumulator, role) => {
    accumulator[role] = {};
    return accumulator;
  }, {} as RoleDefaultsMap);
}

function coerceRoleKey(value: unknown): RoleKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return VALID_ROLE_KEYS.has(normalized as RoleKey) ? (normalized as RoleKey) : null;
}

function isPermissionLevel(value: unknown): value is PermissionLevel {
  return typeof value === "string" && VALID_PERMISSION_LEVELS.has(value as PermissionLevel);
}

function normalizePermissionLevel(value: unknown): PermissionLevel | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return isPermissionLevel(normalized) ? (normalized as PermissionLevel) : null;
}

function parseSections(value: unknown): Record<string, PermissionLevel> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries: Array<[string, PermissionLevel]> = [];
  for (const [section, level] of Object.entries(value as Record<string, unknown>)) {
    const normalizedSection = section.trim();
    const normalizedLevel = normalizePermissionLevel(level);

    if (normalizedSection && normalizedLevel) {
      entries.push([normalizedSection, normalizedLevel]);
    }
  }

  return Object.fromEntries(entries);
}

function parseRoleDefaults(payload: unknown): RoleDefaultsMap {
  const map = createEmptyRoleDefaultsMap();

  if (!payload || typeof payload !== "object") {
    return map;
  }

  for (const [roleKey, sections] of Object.entries(payload as Record<string, unknown>)) {
    const role = coerceRoleKey(roleKey);
    if (!role) {
      continue;
    }

    map[role] = parseSections(sections);
  }

  return map;
}

export async function fetchRoleDefaults(): Promise<RoleDefaultsMap> {
  assertClientSide();

  const headers = await buildAuthorizedHeaders({ Accept: "application/json" });
  const response = await fetch(ROLE_DEFAULTS_ENDPOINT, {
    method: "GET",
    headers,
  });

  const payload = await handleResponse(response);
  return parseRoleDefaults((payload as Record<string, unknown>).roleDefaults);
}

function serializeChanges(changes: Array<{ section: string; level: PermissionLevel }>) {
  const deduped = new Map<string, PermissionLevel>();

  for (const change of changes) {
    const section = typeof change.section === "string" ? change.section.trim() : "";
    const level = normalizePermissionLevel(change.level);

    if (section && level) {
      deduped.set(section, level);
    }
  }

  return Array.from(deduped.entries(), ([section, level]) => ({ section, level }));
}

export async function updateRoleDefaults(
  role: RoleKey,
  changes: Array<{ section: string; level: PermissionLevel }>,
): Promise<void> {
  assertClientSide();

  const response = await fetch(ROLE_DEFAULTS_ENDPOINT, {
    method: "PUT",
    headers: await buildAuthorizedHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({
      role,
      changes: serializeChanges(changes),
    }),
  });

  await handleResponse(response);
}
