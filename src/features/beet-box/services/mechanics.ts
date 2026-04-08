import { supabase } from "@/lib/supabase"
import type { Mechanic, MechanicCert } from "../types"

// All users with Beet Box module access, with their primary cert.
// Pass laborOnly=true (default) to only return labor-eligible members.
// Pass laborOnly=false to get everyone (used by the Team settings tab).
export async function getTechnicians(laborOnly = true): Promise<Mechanic[]> {
  const { data: perms, error: pErr } = await supabase
    .from("user_permissions")
    .select("user_id")
    .eq("section", "Beet Box")

  if (pErr) throw pErr

  const profileIds = (perms ?? []).map(p => p.user_id)
  if (!profileIds.length) return []

  let profileQuery = supabase
    .from("profiles")
    .select("id, full_name, display_name, email, bb_labor_eligible")
    .in("id", profileIds)
    .order("full_name")

  if (laborOnly) {
    profileQuery = profileQuery.eq("bb_labor_eligible", true)
  }

  const [{ data: profiles, error: prErr }, { data: certs, error: cErr }] =
    await Promise.all([
      profileQuery,
      supabase
        .from("bb_mechanic_certs")
        .select("profile_id, cert_type, cert_number, is_primary")
        .eq("is_primary", true),
    ])

  if (prErr) throw prErr
  if (cErr) throw cErr

  const certMap = new Map(
    (certs ?? []).map((c) => [c.profile_id, c])
  )

  return (profiles ?? []).map((p) => {
    const cert = certMap.get(p.id)
    return {
      id: p.id,
      name: p.full_name ?? p.display_name ?? p.email,
      email: p.email,
      certType: (cert?.cert_type as Mechanic["certType"]) ?? null,
      certNumber: cert?.cert_number ?? null,
      laborEligible: p.bb_labor_eligible ?? true,
    }
  })
}

export async function setBbLaborEligible(profileId: string, eligible: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_bb_labor_eligible", {
    target_profile_id: profileId,
    eligible,
  })
  if (error) throw error
}

export async function getTechnicianById(id: string): Promise<Mechanic | null> {
  const [{ data: profile, error: pErr }, { data: cert, error: cErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, display_name, email")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("bb_mechanic_certs")
        .select("cert_type, cert_number")
        .eq("profile_id", id)
        .eq("is_primary", true)
        .maybeSingle(),
    ])

  if (pErr) throw pErr
  if (cErr) throw cErr
  if (!profile) return null

  return {
    id: profile.id,
    name: profile.full_name ?? profile.display_name ?? profile.email,
    email: profile.email,
    certType: (cert?.cert_type as Mechanic["certType"]) ?? null,
    certNumber: cert?.cert_number ?? null,
  }
}

export async function getMechanicCerts(profileId: string): Promise<MechanicCert[]> {
  const { data, error } = await supabase
    .from("bb_mechanic_certs")
    .select("*")
    .eq("profile_id", profileId)
    .order("is_primary", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    certType: row.cert_type as MechanicCert["certType"],
    certNumber: row.cert_number,
    issuedDate: row.issued_date,
    isPrimary: row.is_primary,
    notes: row.notes,
  }))
}

export async function upsertMechanicCert(
  cert: Omit<MechanicCert, "id"> & { id?: string }
): Promise<MechanicCert> {
  const payload = {
    profile_id: cert.profileId,
    cert_type: cert.certType,
    cert_number: cert.certNumber,
    issued_date: cert.issuedDate,
    is_primary: cert.isPrimary,
    notes: cert.notes,
  }

  let targetId = cert.id

  if (!targetId) {
    // No ID supplied — find any existing primary cert for this profile to avoid creating duplicates
    const { data: existing } = await supabase
      .from("bb_mechanic_certs")
      .select("id")
      .eq("profile_id", cert.profileId)
      .eq("is_primary", true)
      .maybeSingle()
    targetId = existing?.id
  }

  const { data, error } = targetId
    ? await supabase.from("bb_mechanic_certs").update(payload).eq("id", targetId).select().single()
    : await supabase.from("bb_mechanic_certs").insert(payload).select().single()

  if (error) throw error

  return {
    id: data.id,
    profileId: data.profile_id,
    certType: data.cert_type as MechanicCert["certType"],
    certNumber: data.cert_number,
    issuedDate: data.issued_date,
    isPrimary: data.is_primary,
    notes: data.notes,
  }
}
