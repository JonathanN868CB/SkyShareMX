import { createClient } from "@supabase/supabase-js"

interface HandlerEvent {
  httpMethod: string
  headers?: Record<string, string | undefined>
  body?: string | null
}

interface HandlerResponse {
  statusCode: number
  headers?: Record<string, string>
  body?: string
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(statusCode: number, payload: Record<string, unknown>): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }
}

export const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders }
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" })

  const supabaseUrl     = process.env.SUPABASE_URL
  const serviceRole     = process.env.SUPABASE_SERVICE_ROLE
  const anonKey         = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRole || !anonKey) {
    return json(500, { error: "Server misconfiguration" })
  }

  // ── Verify caller is authenticated ──────────────────────────────────────────
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization ?? ""
  const token = authHeader.replace(/^bearer\s+/i, "").trim()
  if (!token) return json(401, { error: "Authentication required" })

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user: caller }, error: callerErr } = await anonClient.auth.getUser(token)
  if (callerErr || !caller) return json(401, { error: "Invalid or expired session" })

  // ── Verify caller is Super Admin ─────────────────────────────────────────────
  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: callerProfile, error: profileErr } = await adminClient
    .from("profiles")
    .select("role, is_super_admin")
    .eq("user_id", caller.id)
    .maybeSingle()

  if (profileErr || !callerProfile) return json(403, { error: "Forbidden" })

  const isSuperAdmin =
    callerProfile.is_super_admin === true || callerProfile.role === "Super Admin"

  if (!isSuperAdmin) return json(403, { error: "Forbidden — Super Admin only" })

  // ── Parse target user ID ─────────────────────────────────────────────────────
  let targetUserId: string | undefined
  try {
    const body = JSON.parse(event.body ?? "{}")
    targetUserId = typeof body.userId === "string" ? body.userId.trim() : undefined
  } catch {
    return json(400, { error: "Invalid request body" })
  }

  if (!targetUserId) return json(400, { error: "userId is required" })

  // ── Prevent self-signout ─────────────────────────────────────────────────────
  if (targetUserId === caller.id) {
    return json(400, { error: "Cannot force sign out yourself" })
  }

  // ── Verify target is not another Super Admin ─────────────────────────────────
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("role, is_super_admin")
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (
    targetProfile?.is_super_admin === true ||
    targetProfile?.role === "Super Admin"
  ) {
    return json(403, { error: "Cannot force sign out another Super Admin" })
  }

  // ── Sign out all sessions for the target user ────────────────────────────────
  const { error: signOutErr } = await adminClient.auth.admin.signOut(targetUserId, "global")
  if (signOutErr) {
    console.error("force-signout error:", signOutErr)
    return json(500, { error: "Failed to sign out user" })
  }

  return json(200, { success: true })
}
