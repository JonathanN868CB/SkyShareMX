import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/entities/supabase";
import type { EmploymentStatus, Role, UserSummary } from "../../src/lib/types/users";

interface HandlerEvent {
  httpMethod: string;
  body?: string | null;
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
  "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
};

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
const MASTER_ADMIN_EMAIL = "jonathan@skyshare.com";

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
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile for authorization", profileError);
    return jsonResponse(500, { error: "Unable to verify permissions" });
  }

  const role = typeof profile?.role === "string" ? profile.role : "";
  if (role !== "Super Admin" && role !== "Admin") {
    return jsonResponse(403, { error: "Forbidden" });
  }

  return { userId };
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

function jsonResponse(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  } satisfies HandlerResponse;
}

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

async function handlePatch(
  supabase: ReturnType<typeof resolveSupabase>,
  payload: Record<string, unknown>,
) {
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const action = typeof payload.action === "string" ? payload.action : "";

  if (!userId || !action) {
    return jsonResponse(400, { error: "userId and action are required" });
  }

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile", profileError);
    return jsonResponse(500, { error: "Failed to load profile" });
  }

  if (!existingProfile) {
    return jsonResponse(404, { error: "User not found" });
  }

  if (existingProfile.is_super_admin) {
    return jsonResponse(403, { error: "Super admin settings are locked" });
  }

  const normalizedEmail = normalizeEmail(existingProfile.email as string | undefined);
  const isProtectedEmail = normalizedEmail === MASTER_ADMIN_EMAIL;

  if (action === "role") {
    const nextRole = normalizeRole(payload.role);
    if (!nextRole || !ROLE_VALUES.includes(nextRole)) {
      return jsonResponse(400, { error: "Invalid role" });
    }

    if (isProtectedEmail && nextRole !== "admin") {
      return jsonResponse(403, { error: "Jonathan’s admin access cannot be changed" });
    }

    if (!isProtectedEmail && nextRole === "admin") {
      return jsonResponse(403, { error: "Only jonathan@skyshare.com can be an admin" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ role: nextRole } as unknown as Record<string, unknown>)
      .eq("user_id", userId)
      .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin")
      .single();

    if (error) {
      console.error("Failed to update role", error);
      return jsonResponse(500, { error: "Failed to update role" });
    }

    return jsonResponse(200, { user: mapProfile(data as Record<string, unknown>) });
  }

  if (action === "employment_status") {
    const nextStatus = typeof payload.employmentStatus === "string"
      ? (payload.employmentStatus.toLowerCase() as EmploymentStatus)
      : undefined;

    if (!nextStatus || !STATUS_VALUES.includes(nextStatus)) {
      return jsonResponse(400, { error: "Invalid employment status" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ employment_status: nextStatus } as unknown as Record<string, unknown>)
      .eq("user_id", userId)
      .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin")
      .single();

    if (error) {
      console.error("Failed to update employment status", error);
      return jsonResponse(500, { error: "Failed to update employment status" });
    }

    return jsonResponse(200, { user: mapProfile(data as Record<string, unknown>) });
  }

  return jsonResponse(400, { error: "Unsupported action" });
}

async function handleDelete(
  supabase: ReturnType<typeof resolveSupabase>,
  rawUserId: string | undefined,
) {
  const userId = (rawUserId ?? "").trim();
  if (!userId) {
    return jsonResponse(400, { error: "userId is required" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, email, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile for delete", profileError);
    return jsonResponse(500, { error: "Failed to load profile" });
  }

  let authEmail = "";
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError && authError.status !== 404) {
    console.error("Failed to load auth user", authError);
    return jsonResponse(authError.status ?? 500, { error: "Failed to load auth user" });
  }

  if (authData?.user?.email) {
    authEmail = normalizeEmail(authData.user.email);
  }

  const hadProfile = Boolean(profile);
  const hadAuthUser = Boolean(authData?.user);
  const profileEmail = normalizeEmail(profile?.email as string | undefined);
  const targetEmail = profileEmail || authEmail;
  const profileRole = typeof profile?.role === "string" ? profile.role : "";
  const isProtected = profileRole === "Super Admin" || targetEmail === MASTER_ADMIN_EMAIL;

  if (isProtected) {
    return jsonResponse(403, { error: "Admin accounts cannot be deleted" });
  }

  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteAuthError && deleteAuthError.status !== 404) {
    console.error("Failed to delete auth user", deleteAuthError);
    return jsonResponse(deleteAuthError.status ?? 500, { error: "Failed to delete auth user" });
  }

  const { error: deleteProfileError } = await supabase.from("profiles").delete().eq("user_id", userId);
  if (deleteProfileError) {
    console.error("Failed to delete profile", deleteProfileError);
    return jsonResponse(500, { error: "Failed to delete profile" });
  }

  const message = hadAuthUser || hadProfile ? "User deleted" : "User deleted (already absent)";

  return jsonResponse(200, { ok: true, message });
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "PATCH" && event.httpMethod !== "DELETE") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const supabase = resolveSupabase();
    const authResult = await requireAdmin(event, supabase);
    if ("statusCode" in authResult) {
      return authResult;
    }
    if (event.httpMethod === "PATCH") {
      const payload = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
      return await handlePatch(supabase, payload);
    }

    const payload = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
    const userId = event.queryStringParameters?.id ?? (typeof payload.userId === "string" ? payload.userId : undefined);
    return await handleDelete(supabase, userId);
  } catch (error) {
    console.error("users-admin error", error);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
};
