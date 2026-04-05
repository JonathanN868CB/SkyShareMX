import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/entities/supabase";
import type { EmploymentStatus, Role, UserSummary, UsersListResponse } from "../../src/lib/types/users";

interface HandlerEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  } satisfies HandlerResponse;
}

const ROLE_VALUES: Role[] = ["admin", "manager", "technician", "guest"];
const STATUS_VALUES: EmploymentStatus[] = ["active", "inactive"];
const ROLE_NORMALIZATION_ALIASES: Partial<Record<string, Role>> = {
  // Legacy aliases kept for backward compatibility
  "read-only": "guest",
  "read only": "guest",
  readonly: "guest",
  viewer: "guest",
  "super-admin": "admin",
  "super admin": "admin",
  superadmin: "admin",
};

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

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizeString(value: string | undefined) {
  return (value ?? "").trim();
}

function normalizeRole(value: unknown): Role | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const canonical = normalized.replace(/[\s_]+/g, "-");
  const alias = ROLE_NORMALIZATION_ALIASES[normalized] ?? ROLE_NORMALIZATION_ALIASES[canonical];

  if (alias) {
    return alias;
  }

  if (ROLE_VALUES.includes(normalized as Role)) {
    return normalized as Role;
  }

  if (ROLE_VALUES.includes(canonical as Role)) {
    return canonical as Role;
  }

  return undefined;
}

function mapProfile(row: Record<string, unknown>): UserSummary {
  const fullName = typeof row.full_name === "string" && row.full_name.trim().length > 0 ? row.full_name.trim() : (row.email as string);
  const role: Role = normalizeRole(row.role) ?? "guest";

  return {
    userId: String(row.user_id ?? ""),
    fullName,
    email: String(row.email ?? ""),
    role,
    employmentStatus: (row.employment_status ?? "inactive") as EmploymentStatus,
    lastLogin: row.last_login ? String(row.last_login) : null,
    isSuperAdmin: Boolean(row.is_super_admin),
  };
}

async function refreshLastLogins(
  supabase: ReturnType<typeof resolveSupabase>,
  records: UserSummary[],
) {
  await Promise.all(
    records.map(async record => {
      try {
        const { data } = await supabase.auth.admin.getUserById(record.userId);
        const authUser = data?.user;
        if (!authUser?.last_sign_in_at) return;
        const current = record.lastLogin ? Date.parse(record.lastLogin) : 0;
        const latest = Date.parse(authUser.last_sign_in_at);
        if (Number.isNaN(latest) || latest <= 0 || latest <= current) return;
        await supabase
          .from("profiles")
          .update({ last_login: authUser.last_sign_in_at })
          .eq("user_id", record.userId);
        record.lastLogin = authUser.last_sign_in_at;
      } catch (error) {
        console.error("Failed to refresh last login for", record.userId, error);
      }
    }),
  );
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const supabase = resolveSupabase();
    const authResult = await requireAdmin(event, supabase);
    if ("statusCode" in authResult) {
      return authResult;
    }
    const searchTerm = normalizeString(event.queryStringParameters?.search);
    const roleParam = normalizeString(event.queryStringParameters?.role).toLowerCase();
    const statusParam = normalizeString(event.queryStringParameters?.status).toLowerCase();
    const page = parseNumber(event.queryStringParameters?.page, 1);
    const perPage = parseNumber(event.queryStringParameters?.perPage, 50);

    const safeRole = ROLE_VALUES.includes(roleParam as Role) ? (roleParam as Role) : undefined;
    const safeStatus = STATUS_VALUES.includes(statusParam as EmploymentStatus)
      ? (statusParam as EmploymentStatus)
      : undefined;

    const rangeStart = (page - 1) * perPage;
    const rangeEnd = rangeStart + perPage - 1;

    let query = supabase
      .from("profiles")
      .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin", { count: "exact" })
      .order("full_name", { ascending: true })
      .range(rangeStart, rangeEnd);

    if (searchTerm) {
      const pattern = `%${searchTerm.replace(/%/g, "").replace(/_/g, "")}%`;
      query = query.or(
        [
          `full_name.ilike.${pattern}`,
          `email.ilike.${pattern}`,
          `role.ilike.${pattern}`,
        ].join(","),
      );
    }

    if (safeRole) {
      query = query.eq("role", safeRole);
    }

    if (safeStatus) {
      query = query.eq("employment_status", safeStatus);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("Failed to query profiles", error);
      throw error;
    }

    const mapped = (data ?? []).map(row => mapProfile(row));

    await refreshLastLogins(supabase, mapped);

    const payload: UsersListResponse = {
      data: mapped,
      total: typeof count === "number" ? count : mapped.length,
      page,
      perPage,
    };

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };
  } catch (error) {
    console.error("users-list error", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
    };
  }
};
