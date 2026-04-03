import { supabase } from "@/lib/supabase"

// ─── Approval check ─────────────────────────────────────────────────────────

interface ApprovalRules {
  enabled: boolean
  require_approval_roles: string[]
  approver_chain: string[]
}

export async function shouldRequireApproval(userRole: string): Promise<boolean> {
  const { data } = await supabase
    .from("parts_config")
    .select("value")
    .eq("key", "approval_rules")
    .single()

  if (!data?.value) return false
  const rules = data.value as ApprovalRules
  if (!rules.enabled) return false
  return rules.require_approval_roles.includes(userRole)
}

// ─── Notifications ──────────────────────────────────────────────────────────

interface NotifyOptions {
  recipientProfileId: string
  type: string
  title: string
  message: string
  metadata?: Record<string, string>
}

export async function sendNotification(opts: NotifyOptions) {
  await supabase.from("notifications").insert({
    recipient_profile_id: opts.recipientProfileId,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    metadata: opts.metadata ?? {},
  })
}

export async function notifyByRoles(
  roles: string[],
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, string>,
  excludeProfileId?: string
) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role")
    .in("role", roles)
    .eq("status", "active")

  if (!profiles) return

  const recipients = excludeProfileId
    ? profiles.filter(p => p.id !== excludeProfileId)
    : profiles

  const inserts = recipients.map(p => ({
    recipient_profile_id: p.id,
    type,
    title,
    message,
    metadata: metadata ?? {},
  }))

  if (inserts.length > 0) {
    await supabase.from("notifications").insert(inserts)
  }
}

export async function notifyProfileIds(
  profileIds: string[],
  type: string,
  title: string,
  message: string,
  metadata?: Record<string, string>
) {
  if (profileIds.length === 0) return

  const inserts = profileIds.map(id => ({
    recipient_profile_id: id,
    type,
    title,
    message,
    metadata: metadata ?? {},
  }))

  await supabase.from("notifications").insert(inserts)
}

// ─── Get approver chain profile IDs ─────────────────────────────────────────

export async function getApproverProfileIds(): Promise<string[]> {
  const { data: config } = await supabase
    .from("parts_config")
    .select("value")
    .eq("key", "approval_rules")
    .single()

  if (!config?.value) return []
  const rules = config.value as ApprovalRules
  if (!rules.approver_chain.length) return []

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", rules.approver_chain)
    .eq("status", "active")

  return profiles?.map(p => p.id) ?? []
}
