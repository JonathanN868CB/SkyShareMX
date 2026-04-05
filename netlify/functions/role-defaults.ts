import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/entities/supabase";
const ROLE_DEFAULTS_QUERY =
  "select role::text as role, section, level::text as level from public.role_default_permissions";

const ROLE_DEFAULT_ROLES = ["manager", "technician", "guest"] as const;
const IMMUTABLE_ROLES = new Set(["admin"]);

type RoleDefaultsRole = (typeof ROLE_DEFAULT_ROLES)[number];

type PermissionLevel = "none" | "read" | "write";

type RoleDefaultsMap = Record<RoleDefaultsRole, Record<string, PermissionLevel>>;

interface HandlerEvent {
  httpMethod: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, PATCH, OPTIONS",
};

const VALID_ROLE_DEFAULT_ROLES = new Set<RoleDefaultsRole>(ROLE_DEFAULT_ROLES);
const VALID_PERMISSION_LEVELS = new Set<PermissionLevel>(["none", "read", "write"]);

interface RoleDefaultRow {
  role: unknown;
  section: unknown;
  level: unknown;
}

interface RoleDefaultChange {
  section: string;
  level: PermissionLevel;
}

function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  } satisfies HandlerResponse;
}

function createEmptyRoleDefaultsMap(): RoleDefaultsMap {
  return {
    manager: {},
    technician: {},
    viewer: {},
  } satisfies RoleDefaultsMap;
}

function normalizeRole(value: unknown): RoleDefaultsRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized && VALID_ROLE_DEFAULT_ROLES.has(normalized as RoleDefaultsRole)
    ? (normalized as RoleDefaultsRole)
    : null;
}

function normalizeSection(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeLevel(value: unknown): PermissionLevel | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return VALID_PERMISSION_LEVELS.has(normalized as PermissionLevel) ? (normalized as PermissionLevel) : null;
}

function isImmutableRole(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && IMMUTABLE_ROLES.has(normalized);
}

function mapRowsToRoleDefaults(rows: RoleDefaultRow[] | null | undefined): RoleDefaultsMap {
  const roleDefaults = createEmptyRoleDefaultsMap();

  if (!Array.isArray(rows)) {
    return roleDefaults;
  }

  for (const row of rows) {
    const role = normalizeRole(row.role);
    const section = normalizeSection(row.section);
    const level = normalizeLevel(row.level);

    if (role && section && level) {
      roleDefaults[role][section] = level;
    }
  }

  return roleDefaults;
}

function coerceChange(entry: unknown): RoleDefaultChange | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const section = normalizeSection((entry as Record<string, unknown>).section);
  const level = normalizeLevel((entry as Record<string, unknown>).level);

  if (!section || !level) {
    return null;
  }

  return { section, level } satisfies RoleDefaultChange;
}

function parseChanges(value: unknown): RoleDefaultChange[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: RoleDefaultChange[] = [];

  for (const entry of value) {
    const change = coerceChange(entry);
    if (!change) {
      return null;
    }
    parsed.push(change);
  }

  return parsed;
}

function dedupeChanges(changes: RoleDefaultChange[]): RoleDefaultChange[] {
  const deduped = new Map<string, PermissionLevel>();

  for (const change of changes) {
    deduped.set(change.section, change.level);
  }

  return Array.from(deduped.entries(), ([section, level]) => ({ section, level } satisfies RoleDefaultChange));
}

function coerceRoleForUpdate(value: unknown): RoleDefaultsRole | null {
  return normalizeRole(value);
}

function isAdminPermissionsFixedError(error: unknown): boolean {
  if (!error || (typeof error !== "object" && !(error instanceof Error))) {
    return false;
  }

  const errorObject = (error as Record<string, unknown>) ?? {};
  const code = typeof errorObject.code === "string" ? errorObject.code : undefined;

  const messageParts: string[] = [];

  if (typeof errorObject.message === "string") {
    messageParts.push(errorObject.message);
  } else if (error instanceof Error && typeof error.message === "string") {
    messageParts.push(error.message);
  }

  if (typeof errorObject.details === "string") {
    messageParts.push(errorObject.details);
  }

  if (typeof errorObject.hint === "string") {
    messageParts.push(errorObject.hint);
  }

  const normalizedMessages = messageParts.map(part => part.toLowerCase());

  if (normalizedMessages.some(part => part.includes("admin permissions are fixed"))) {
    return true;
  }

  if (code === "23514") {
    if (normalizedMessages.some(part => part.includes("role_default_permissions") && part.includes("admin"))) {
      return true;
    }

    if (normalizedMessages.some(part => part.includes("role_default_permissions_role_check"))) {
      return true;
    }
  }

  return false;
}

function buildUpsertStatement(role: RoleDefaultsRole, changes: RoleDefaultChange[]) {
  const placeholders: string[] = [];
  const params: Array<string> = [];

  changes.forEach((change, index) => {
    const offset = index * 3;
    placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
    params.push(role, change.section, change.level);
  });

  const sql =
    "insert into public.role_default_permissions (role, section, level) values " +
    placeholders.join(", ") +
    " on conflict (role, section) do update set level = excluded.level";

  return { sql, params };
}

async function executeSql<T>(
  supabase: ReturnType<typeof resolveSupabase>,
  sql: string,
  params: unknown[] = [],
): Promise<{ data: T | null; error: unknown | null }> {
  try {
    const response = await (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    }).rpc("query", { query: sql, params });

    if (response.error) {
      return { data: null, error: response.error };
    }

    return { data: (response.data as T) ?? null, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

function resolveSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Supabase credentials are not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE)");
  }

  return createClient<Database>(supabaseUrl, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function resolveSupabaseAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase credentials are not configured (SUPABASE_URL, SUPABASE_ANON_KEY)");
  }

  return createClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getAccessToken(event: HandlerEvent) {
  const header = event.headers?.authorization ?? event.headers?.Authorization;
  if (!header) {
    return null;
  }

  const parts = header.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }

  const [scheme, ...rest] = parts;
  if (!/^bearer$/i.test(scheme)) {
    return null;
  }

  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

async function requireAdmin(
  event: HandlerEvent,
  supabase: ReturnType<typeof resolveSupabase>,
): Promise<HandlerResponse | { userId: string }> {
  const token = getAccessToken(event);
  if (!token) {
    return jsonResponse(401, { error: "Authentication required" });
  }

  const authClient = resolveSupabaseAuthClient();
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data?.user) {
    console.error("Failed to verify Supabase session", error);
    const status = error?.status ?? 401;
    return jsonResponse(status === 404 ? 401 : status, { error: "Invalid or expired session" });
  }

  const userId = data.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, role, role_enum, is_super_admin")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile for authorization", profileError);
    return jsonResponse(500, { error: "Unable to verify permissions" });
  }

  const normalizedRole = typeof profile?.role === "string" ? profile.role.toLowerCase() : "";
  const roleEnum = typeof profile?.role_enum === "string" ? profile.role_enum : "";
  const isSuperAdmin = Boolean(profile?.is_super_admin) || roleEnum === "Super Admin";

  if (normalizedRole !== "admin" && !isSuperAdmin) {
    return jsonResponse(403, { error: "Forbidden" });
  }

  return { userId };
}

async function handleGet(supabase: ReturnType<typeof resolveSupabase>) {
  const { data, error } = await executeSql<RoleDefaultRow[]>(supabase, ROLE_DEFAULTS_QUERY);

  if (error) {
    console.error("Failed to load role default permissions", error);
    return jsonResponse(500, { error: "Failed to load saved defaults" });
  }

  const roleDefaults = mapRowsToRoleDefaults(data ?? []);

  return jsonResponse(200, { roleDefaults });
}

async function handleUpsert(
  event: HandlerEvent,
  supabase: ReturnType<typeof resolveSupabase>,
): Promise<HandlerResponse> {
  if (!event.body) {
    return jsonResponse(400, { error: "Request body is required" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body);
  } catch (error) {
    console.error("Invalid JSON payload", error);
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  if (isImmutableRole(payload.role)) {
    return jsonResponse(400, { error: "Admin permissions are fixed" });
  }

  const role = coerceRoleForUpdate(payload.role);
  if (!role) {
    return jsonResponse(400, { error: "A supported role is required" });
  }

  const parsedChanges = parseChanges(payload.changes);
  if (!parsedChanges) {
    return jsonResponse(400, { error: "Each change entry must include a section and level" });
  }

  const changes = dedupeChanges(parsedChanges);

  if (changes.length === 0) {
    return jsonResponse(200, { success: true });
  }

  const { sql, params } = buildUpsertStatement(role, changes);
  const { error } = await executeSql<null>(supabase, sql, params);

  if (error) {
    if (isAdminPermissionsFixedError(error)) {
      return jsonResponse(400, { error: "Admin permissions are fixed" });
    }

    console.error("Failed to save role default permissions", error);
    return jsonResponse(500, { error: "Failed to save role defaults" });
  }

  return jsonResponse(200, { success: true });
}

export async function handler(event: HandlerEvent): Promise<HandlerResponse> {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders } satisfies HandlerResponse;
    }

    const supabase = resolveSupabase();
    const result = await requireAdmin(event, supabase);
    if ("statusCode" in result) {
      return result;
    }

    if (event.httpMethod === "GET") {
      return handleGet(supabase);
    }

    if (event.httpMethod === "PUT" || event.httpMethod === "PATCH") {
      return handleUpsert(event, supabase);
    }

    return jsonResponse(405, { error: "Method not allowed" });
  } catch (error) {
    console.error("Unhandled role defaults error", error);
    return jsonResponse(500, { error: "Unexpected error" });
  }
}
