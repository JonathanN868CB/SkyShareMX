import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/entities/supabase";
import type { EmploymentStatus, Role, UserSummary } from "../../src/lib/types/users";

interface HandlerEvent {
  httpMethod: string;
  body?: string | null;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
};

const ROLE_VALUES: Role[] = ["admin", "manager", "technician", "viewer"];
const STATUS_VALUES: EmploymentStatus[] = ["active", "inactive"];

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

function mapProfile(row: Record<string, unknown>): UserSummary {
  const fullName = typeof row.full_name === "string" && row.full_name.trim().length > 0 ? row.full_name.trim() : (row.email as string);

  return {
    userId: String(row.user_id ?? ""),
    fullName,
    email: String(row.email ?? ""),
    role: (row.role ?? "viewer") as Role,
    employmentStatus: (row.employment_status ?? "inactive") as EmploymentStatus,
    lastLogin: row.last_login ? String(row.last_login) : null,
    isSuperAdmin: Boolean(row.is_super_admin),
  };
}

async function resolveUserId(
  supabase: ReturnType<typeof resolveSupabase>,
  email: string,
  fallbackUserId?: string | null,
) {
  if (fallbackUserId) return fallbackUserId;
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw error;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = data?.users?.find(user => (user.email ?? "").toLowerCase() === normalizedEmail);
  if (!existing) {
    throw new Error("Unable to determine invited user id");
  }
  return existing.id;
}

async function handleInvite(
  supabase: ReturnType<typeof resolveSupabase>,
  payload: Record<string, unknown>,
) {
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const fullName = typeof payload.fullName === "string" ? payload.fullName.trim() : "";
  const role = typeof payload.role === "string" ? (payload.role.toLowerCase() as Role) : undefined;

  if (!email || !fullName || !role || !ROLE_VALUES.includes(role)) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "fullName, email, and a valid role are required" }),
    } satisfies HandlerResponse;
  }

  const { data: inviteResult, error: inviteError } = await supabase.auth.admin.inviteUserByEmail({
    email,
    data: { full_name: fullName },
  });

  if (inviteError) {
    console.error("Failed to invite user", inviteError);
    return {
      statusCode: inviteError.status ?? 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: inviteError.message }),
    } satisfies HandlerResponse;
  }

  const userId = await resolveUserId(supabase, email, inviteResult?.user?.id);

  const { data: upserted, error: upsertError } = await supabase
    .from("profiles")
    .upsert(
      [
        {
          user_id: userId,
          email,
          full_name: fullName,
          role,
          employment_status: "active",
          is_super_admin: false,
          last_login: null,
        },
      ] as unknown as Record<string, unknown>[],
      { onConflict: "user_id" },
    )
    .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin")
    .single();

  if (upsertError) {
    console.error("Failed to upsert profile", upsertError);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to persist user profile" }),
    } satisfies HandlerResponse;
  }

  return {
    statusCode: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ user: mapProfile(upserted as Record<string, unknown>) }),
  } satisfies HandlerResponse;
}

async function handlePatch(
  supabase: ReturnType<typeof resolveSupabase>,
  payload: Record<string, unknown>,
) {
  const userId = typeof payload.userId === "string" ? payload.userId : "";
  const action = typeof payload.action === "string" ? payload.action : "";

  if (!userId || !action) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "userId and action are required" }),
    } satisfies HandlerResponse;
  }

  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile", profileError);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to load profile" }),
    } satisfies HandlerResponse;
  }

  if (!existingProfile) {
    return {
      statusCode: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "User not found" }),
    } satisfies HandlerResponse;
  }

  if (existingProfile.is_super_admin) {
    return {
      statusCode: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Super admin settings are locked" }),
    } satisfies HandlerResponse;
  }

  if (action === "role") {
    const nextRole = typeof payload.role === "string" ? (payload.role.toLowerCase() as Role) : undefined;
    if (!nextRole || !ROLE_VALUES.includes(nextRole)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid role" }),
      } satisfies HandlerResponse;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ role: nextRole } as unknown as Record<string, unknown>)
      .eq("user_id", userId)
      .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin")
      .single();

    if (error) {
      console.error("Failed to update role", error);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to update role" }),
      } satisfies HandlerResponse;
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ user: mapProfile(data as Record<string, unknown>) }),
    } satisfies HandlerResponse;
  }

  if (action === "employment_status") {
    const nextStatus = typeof payload.employmentStatus === "string"
      ? (payload.employmentStatus.toLowerCase() as EmploymentStatus)
      : undefined;

    if (!nextStatus || !STATUS_VALUES.includes(nextStatus)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid employment status" }),
      } satisfies HandlerResponse;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ employment_status: nextStatus } as unknown as Record<string, unknown>)
      .eq("user_id", userId)
      .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin")
      .single();

    if (error) {
      console.error("Failed to update employment status", error);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to update employment status" }),
      } satisfies HandlerResponse;
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ user: mapProfile(data as Record<string, unknown>) }),
    } satisfies HandlerResponse;
  }

  return {
    statusCode: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Unsupported action" }),
  } satisfies HandlerResponse;
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "POST" && event.httpMethod !== "PATCH") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const supabase = resolveSupabase();
    const payload = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};

    if (event.httpMethod === "POST") {
      return await handleInvite(supabase, payload);
    }

    return await handlePatch(supabase, payload);
  } catch (error) {
    console.error("users-admin error", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
    };
  }
};
