import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/entities/supabase";
import type { EmploymentStatus, Role, UserSummary } from "../../src/lib/types/users";

/**
 * create table if not exists public.profiles (
 *   user_id uuid primary key references auth.users(id) on delete cascade,
 *   full_name text not null,
 *   email text not null unique,
 *   role text not null check (role in ('admin','manager','technician','viewer')),
 *   employment_status text not null default 'active' check (employment_status in ('active','inactive')),
 *   last_login timestamptz,
 *   is_super_admin boolean not null default false,
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now()
 * );
 * alter table public.profiles enable row level security;
 * create trigger set_profiles_updated_at before update on public.profiles
 *   for each row execute procedure moddatetime (updated_at);
 * create or replace function prevent_super_admin_change() returns trigger language plpgsql as $$
 * begin
 *   if old.is_super_admin then
 *     if tg_op = 'DELETE' then
 *       raise exception 'Cannot delete super admin';
 *     end if;
 *     if tg_op = 'UPDATE' and (old.role is distinct from new.role or old.employment_status is distinct from new.employment_status) then
 *       raise exception 'Cannot modify super admin role or employment status';
 *     end if;
 *   end if;
 *   return new;
 * end;
 * $$;
 * drop trigger if exists protect_super_admin on public.profiles;
 * create trigger protect_super_admin
 *   before update or delete on public.profiles
 *   for each row execute procedure prevent_super_admin_change();
 * -- TODO: align RLS policies with existing security posture.
 */

interface HandlerEvent {
  httpMethod: string;
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

const DEFAULT_MASTER_ADMIN_EMAIL = "jonathan@skyshare.com";
const DEFAULT_MASTER_ADMIN_NAME = "Jonathan Schaedig";

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
    role: (row.role ?? "admin") as Role,
    employmentStatus: (row.employment_status ?? "active") as EmploymentStatus,
    lastLogin: row.last_login ? String(row.last_login) : null,
    isSuperAdmin: Boolean(row.is_super_admin),
  };
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const supabase = resolveSupabase();
    const targetEmail = (process.env.MASTER_ADMIN_EMAIL ?? DEFAULT_MASTER_ADMIN_EMAIL).trim().toLowerCase();
    const targetName = (process.env.MASTER_ADMIN_NAME ?? DEFAULT_MASTER_ADMIN_NAME).trim();

    const { data: listedUsers, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      throw listError;
    }

    let authUser = listedUsers?.users?.find(user => (user.email ?? "").toLowerCase() === targetEmail) ?? null;
    let invited = false;

    if (!authUser) {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail({
        email: targetEmail,
        data: { full_name: targetName },
      });

      if (inviteError) {
        throw inviteError;
      }

      invited = true;
      authUser = inviteData?.user ?? null;

      if (!authUser) {
        const { data: refreshedUsers } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        authUser = refreshedUsers?.users?.find(user => (user.email ?? "").toLowerCase() === targetEmail) ?? null;
      }
    }

    if (!authUser) {
      throw new Error("Failed to locate or create super admin account");
    }

    const lastLogin = authUser.last_sign_in_at ?? null;

    const { data: upsertedProfile, error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        [
          {
            user_id: authUser.id,
            email: targetEmail,
            full_name: targetName,
            role: "admin",
            employment_status: "active",
            is_super_admin: true,
            last_login: lastLogin,
          },
        ] as unknown as Record<string, unknown>[],
        { onConflict: "user_id" },
      )
      .select("user_id, full_name, email, role, employment_status, last_login, is_super_admin")
      .single();

    if (upsertError) {
      throw upsertError;
    }

    const response = {
      invited,
      profile: mapProfile(upsertedProfile as Record<string, unknown>),
    };

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("bootstrap-super-admin error", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
    };
  }
};
