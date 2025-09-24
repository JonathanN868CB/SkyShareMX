import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../src/entities/supabase";

type AppSection = Database["public"]["Enums"]["app_section"];
type AppRole = Database["public"]["Enums"]["app_role"];

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

interface HandlerEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
}

interface HandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

interface PromotePayload {
  userId?: string;
  email?: string | null;
  fullName?: string | null;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MASTER_ADMIN_EMAIL = "jonathan@skyshare.com";
const NON_VIEWER_SECTIONS: AppSection[] = ["Operations", "Administration", "Development"];
const REQUIRED_SECTIONS: AppSection[] = ["Overview", ...NON_VIEWER_SECTIONS];

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

function normalizeEmail(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
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

function resolveAllowListedEmails(): string[] {
  const candidates = [
    process.env.ADMIN_EMAILS,
    process.env.ALLOWLISTED_ADMINS,
    process.env.VITE_ADMIN_EMAILS,
  ];

  const normalized = candidates
    .flatMap(value => (value ? value.split(",") : []))
    .map(candidate => normalizeEmail(candidate))
    .filter(Boolean);

  return Array.from(new Set([MASTER_ADMIN_EMAIL, ...normalized]));
}

function resolveRoleEnum(email: string, existingEnum?: AppRole | null): AppRole {
  if (existingEnum === "Super Admin") {
    return existingEnum;
  }

  if (email === MASTER_ADMIN_EMAIL) {
    return "Super Admin";
  }

  return "Admin";
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders } satisfies HandlerResponse;
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const token = getAccessToken(event);
    if (!token) {
      return jsonResponse(401, { error: "Authentication required" });
    }

    const authClient = resolveSupabaseAuthClient();
    const { data, error: authError } = await authClient.auth.getUser(token);

    if (authError || !data?.user) {
      const status = authError?.status ?? 401;
      return jsonResponse(status === 404 ? 401 : status, { error: "Invalid or expired session" });
    }

    const authUser = data.user;
    const userId = authUser.id;
    const email = normalizeEmail(authUser.email);

    const allowListedEmails = resolveAllowListedEmails();
    if (!allowListedEmails.includes(email)) {
      return jsonResponse(403, { error: "Forbidden" });
    }

    if (!event.body) {
      return jsonResponse(400, { error: "Missing request payload" });
    }

    let payload: PromotePayload;
    try {
      payload = JSON.parse(event.body) as PromotePayload;
    } catch (error) {
      console.error("promote-allowlisted-user: failed to parse payload", error);
      return jsonResponse(400, { error: "Invalid JSON payload" });
    }

    if (payload.userId && payload.userId !== userId) {
      return jsonResponse(403, { error: "User mismatch" });
    }

    const supabase = resolveSupabase();

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, email, role_enum, status, is_readonly, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("promote-allowlisted-user: failed to load profile", profileError);
      return jsonResponse(500, { error: "Unable to load profile" });
    }

    const nowIso = new Date().toISOString();
    const fullName = typeof payload.fullName === "string" && payload.fullName.trim().length > 0
      ? payload.fullName.trim()
      : existingProfile?.full_name ?? authUser.email ?? email;

    const roleEnum = resolveRoleEnum(email, existingProfile?.role_enum as AppRole | undefined);

    const profilePayload = {
      user_id: userId,
      email: authUser.email ?? existingProfile?.email ?? email,
      full_name: fullName,
      role: "admin",
      role_enum: roleEnum,
      is_readonly: false,
      status: (existingProfile?.status ?? "Active") as ProfileRow["status"],
      last_login: nowIso,
      updated_at: nowIso,
    } satisfies Partial<ProfileRow> & { user_id: string };

    const { data: upsertedProfile, error: upsertError } = await supabase
      .from("profiles")
      .upsert([profilePayload as Record<string, unknown>], { onConflict: "user_id" })
      .select("user_id, email, full_name, role, role_enum, is_readonly, status, last_login, updated_at")
      .single();

    if (upsertError) {
      console.error("promote-allowlisted-user: failed to upsert profile", upsertError);
      return jsonResponse(500, { error: "Unable to update profile" });
    }

    const { data: existingPermissions, error: permissionsError } = await supabase
      .from("user_permissions")
      .select("section")
      .eq("user_id", userId);

    if (permissionsError) {
      console.error("promote-allowlisted-user: failed to load permissions", permissionsError);
      return jsonResponse(500, { error: "Unable to load permissions" });
    }

    const existingSections = new Set((existingPermissions ?? []).map(permission => permission.section as AppSection));
    const sectionsToInsert = REQUIRED_SECTIONS.filter(section => !existingSections.has(section));

    if (sectionsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("user_permissions")
        .insert(sectionsToInsert.map(section => ({ user_id: userId, section })) as Record<string, unknown>[]);

      if (insertError) {
        console.error("promote-allowlisted-user: failed to grant permissions", insertError);
        return jsonResponse(500, { error: "Unable to grant permissions" });
      }

      sectionsToInsert.forEach(section => existingSections.add(section));
    }

    const finalSections = Array.from(existingSections);

    return jsonResponse(200, {
      profile: upsertedProfile,
      grantedSections: finalSections,
    });
  } catch (error) {
    console.error("promote-allowlisted-user: unexpected error", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse(500, { error: message });
  }
};

export default handler;
