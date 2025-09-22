import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/entities/supabase";
import { ROLES } from "../../src/lib/types/users";

type Role = (typeof ROLES)[number];

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

interface RoleDefaultRecord {
  role: Role;
  permissions: Record<string, boolean>;
  updatedAt: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, PATCH, OPTIONS",
};

const VALID_ROLES = new Set<Role>(ROLES);

function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  } satisfies HandlerResponse;
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

function sanitizeRole(value: unknown): Role | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return VALID_ROLES.has(normalized as Role) ? (normalized as Role) : null;
}

function sanitizePermissions(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries: Array<[string, boolean]> = [];
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== "string") continue;
    if (typeof raw === "boolean") {
      entries.push([key, raw]);
      continue;
    }
    if (raw === "true" || raw === "false") {
      entries.push([key, raw === "true"]);
    }
  }

  return Object.fromEntries(entries);
}

function mapRow(row: Database["public"]["Tables"]["role_default_permissions"]["Row"]): RoleDefaultRecord | null {
  const role = sanitizeRole(row.role);
  if (!role) {
    return null;
  }

  return {
    role,
    permissions: sanitizePermissions(row.permissions),
    updatedAt: row.updated_at,
  } satisfies RoleDefaultRecord;
}

async function handleGet(supabase: ReturnType<typeof resolveSupabase>) {
  const { data, error } = await supabase
    .from("role_default_permissions")
    .select("role, permissions, updated_at")
    .order("role", { ascending: true });

  if (error) {
    console.error("Failed to load role default permissions", error);
    return jsonResponse(500, { error: "Failed to load saved defaults" });
  }

  const roleDefaults = (data ?? [])
    .map(mapRow)
    .filter((row): row is RoleDefaultRecord => Boolean(row));

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

  const role = sanitizeRole(payload.role);
  if (!role) {
    return jsonResponse(400, { error: "A supported role is required" });
  }

  const permissions = sanitizePermissions(payload.permissions);

  const { data, error } = await supabase
    .from("role_default_permissions")
    .upsert(
      { role, permissions },
      {
        onConflict: "role",
        ignoreDuplicates: false,
      },
    )
    .select("role, permissions, updated_at")
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to save role default permissions", error);
    return jsonResponse(500, { error: "Failed to save role defaults" });
  }

  const mapped = mapRow(data);
  if (!mapped) {
    return jsonResponse(500, { error: "Failed to parse role defaults" });
  }

  return jsonResponse(200, { roleDefault: mapped });
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
