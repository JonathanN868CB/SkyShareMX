import type { Role } from "@/lib/types/users";
import { buildAuthorizedHeaders } from "@/lib/api/users";

const ROLE_DEFAULTS_ENDPOINT = "/.netlify/functions/role-defaults";

export type RolePermissionSnapshot = Record<string, boolean>;

export interface RoleDefaultSnapshot {
  role: Role;
  permissions: RolePermissionSnapshot;
  updatedAt: string;
}

export type RoleDefaultsMap = Partial<Record<Role, RolePermissionSnapshot>>;

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

function normalizePermissions(input: unknown): RolePermissionSnapshot {
  if (!input || typeof input !== "object") {
    return {};
  }

  const entries: Array<[string, boolean]> = [];
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "boolean") {
      entries.push([key, value]);
    }
  }

  return Object.fromEntries(entries);
}

function coerceRole(value: unknown): Role | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "admin" || normalized === "manager" || normalized === "technician" || normalized === "viewer") {
    return normalized as Role;
  }

  return null;
}

function parseRoleDefaults(payload: unknown): RoleDefaultsMap {
  if (!Array.isArray(payload)) {
    return {};
  }

  return payload.reduce<RoleDefaultsMap>((accumulator, entry) => {
    if (!entry || typeof entry !== "object") {
      return accumulator;
    }

    const role = coerceRole((entry as Record<string, unknown>).role);
    if (!role) {
      return accumulator;
    }

    accumulator[role] = normalizePermissions((entry as Record<string, unknown>).permissions);
    return accumulator;
  }, {});
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

export async function updateRoleDefaults(role: Role, permissions: RolePermissionSnapshot): Promise<RoleDefaultSnapshot> {
  assertClientSide();

  const response = await fetch(ROLE_DEFAULTS_ENDPOINT, {
    method: "PUT",
    headers: await buildAuthorizedHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({
      role,
      permissions: normalizePermissions(permissions),
    }),
  });

  const payload = await handleResponse(response);
  const record = (payload as Record<string, unknown>).roleDefault;
  if (!record || typeof record !== "object") {
    throw new Error("Unexpected response shape");
  }

  const parsedRole = coerceRole((record as Record<string, unknown>).role);
  if (!parsedRole) {
    throw new Error("Unexpected response role");
  }

  const updatedAtValue =
    (record as Record<string, unknown>).updatedAt ?? (record as Record<string, unknown>).updated_at;

  return {
    role: parsedRole,
    permissions: normalizePermissions((record as Record<string, unknown>).permissions),
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : "",
  } satisfies RoleDefaultSnapshot;
}
