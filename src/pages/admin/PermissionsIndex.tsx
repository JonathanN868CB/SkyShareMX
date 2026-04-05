import { useQuery } from "@tanstack/react-query"
import { Navigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { APP_ROLES, APP_SECTIONS } from "@/entities/supabase"
import type { AppRole, AppSection, Profile } from "@/entities/supabase"

// ─── Hard-coded permission rules (live in source code, not in Supabase) ────────
const HARDCODED_RULES: {
  feature: string
  detail: string
  source: string
  roles: AppRole[]
}[] = [
  {
    feature: "Aircraft Detail — Edit Cards",
    detail: "Identity, Avionics, Programs, Propulsion, Documentation, Notes",
    source: "AircraftDetailOverlay.tsx:1921",
    roles: ["Manager", "Admin", "Super Admin"],
  },
  {
    feature: "Aircraft Detail — Delete CMM Docs",
    detail: "Remove CMM records from an aircraft",
    source: "AircraftDetailOverlay.tsx:1922",
    roles: ["Admin", "Super Admin"],
  },
  {
    feature: "Administration Sidebar Section",
    detail: "Users, Alerts & Notifications, Settings nav items",
    source: "AppSidebar.tsx:67",
    roles: ["Admin", "Super Admin"],
  },
  {
    feature: "Permissions Index (this page)",
    detail: "View all system permission rules",
    source: "AppSidebar.tsx",
    roles: ["Super Admin"],
  },
  {
    feature: "Parts — Edit Orders & Update Status",
    detail: "Inline-edit vendor, PO#, cost, tracking, ETA; change request/line status",
    source: "PartsDetailView.tsx",
    roles: ["Manager", "Admin", "Super Admin"],
  },
  {
    feature: "Parts — Approval Config",
    detail: "Enable/disable approvals, configure which roles require approval",
    source: "Parts.tsx (gear icon)",
    roles: ["Admin", "Super Admin"],
  },
  {
    feature: "Parts — Cancel Own Request",
    detail: "Requester can cancel (archive or delete) their own parts request",
    source: "PartsDetailView.tsx",
    roles: ["Technician", "Manager", "Admin", "Super Admin"],
  },
]

const ROLE_ORDER: AppRole[] = ["Super Admin", "Admin", "Manager", "Technician", "Guest"]

const ROLE_COLORS: Record<AppRole, { bg: string; text: string; border: string }> = {
  "Super Admin": { bg: "rgba(212,160,23,0.12)", text: "var(--skyshare-gold)",       border: "rgba(212,160,23,0.3)"  },
  "Admin":       { bg: "rgba(70,100,129,0.18)", text: "hsl(210 50% 65%)",           border: "rgba(70,100,129,0.35)" },
  "Manager":     { bg: "rgba(52,211,153,0.1)",  text: "rgb(52,211,153)",            border: "rgba(52,211,153,0.25)" },
  "Technician":  { bg: "rgba(96,165,250,0.1)",  text: "rgb(96,165,250)",            border: "rgba(96,165,250,0.25)" },
  "Guest":       { bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.35)",    border: "rgba(255,255,255,0.1)" },
}

function RolePill({ role }: { role: AppRole }) {
  const c = ROLE_COLORS[role]
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 3,
      fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
      fontFamily: "var(--font-heading)",
      background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
    }}>
      {role}
    </span>
  )
}

// ─── Queries ──────────────────────────────────────────────────────────────────

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("role", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function fetchAllUserPermissions(): Promise<{ user_id: string; section: AppSection }[]> {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("user_id, section")
  if (error) throw error
  return data ?? []
}

async function fetchRoleDefaults(): Promise<{ role: string; permissions: unknown }[]> {
  const { data, error } = await supabase
    .from("role_default_permissions")
    .select("role, permissions")
  if (error) throw error
  return data ?? []
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-3">
        <div style={{ height: 1, width: 20, background: "rgba(212,160,23,0.4)" }} />
        <span style={{
          fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
          fontFamily: "var(--font-heading)", color: "var(--skyshare-gold)",
        }}>
          {title}
        </span>
      </div>
      {subtitle && (
        <p style={{ fontSize: "0.72rem", color: "hsl(var(--muted-foreground))", marginTop: 4, paddingLeft: 35, fontFamily: "var(--font-body)", opacity: 0.7 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ─── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "0.5px solid rgba(212,160,23,0.18)",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      {children}
    </div>
  )
}

// ─── 1. Hard-coded rules table ─────────────────────────────────────────────────
function HardcodedRulesTable() {
  return (
    <div className="flex flex-col gap-2">
      {HARDCODED_RULES.map((rule, i) => (
        <div key={i} style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 16px",
          padding: "12px 16px",
          borderBottom: i < HARDCODED_RULES.length - 1 ? "0.5px solid rgba(212,160,23,0.08)" : "none",
        }}>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "hsl(var(--foreground))", fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
              {rule.feature}
            </div>
            <div style={{ fontSize: "0.7rem", color: "hsl(var(--muted-foreground))", opacity: 0.65, marginTop: 2, fontFamily: "var(--font-body)" }}>
              {rule.detail}
            </div>
            <div style={{ fontSize: "0.6rem", color: "hsl(var(--muted-foreground))", opacity: 0.4, marginTop: 3, fontFamily: "var(--font-body)", letterSpacing: "0.04em" }}>
              📄 {rule.source}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 items-start content-start">
            {ROLE_ORDER.map(role => {
              const granted = rule.roles.includes(role)
              return granted ? (
                <RolePill key={role} role={role} />
              ) : null
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 2. Role defaults matrix ───────────────────────────────────────────────────
function RoleDefaultsMatrix({ data }: { data: { role: string; permissions: unknown }[] }) {
  // Build a map: role → section → level
  const matrix: Record<string, Record<string, string>> = {}
  for (const row of data) {
    const perms = row.permissions
    if (perms && typeof perms === "object" && !Array.isArray(perms)) {
      matrix[row.role] = perms as Record<string, string>
    } else if (Array.isArray(perms)) {
      // If stored as array of granted sections, treat as "granted" vs not
      matrix[row.role] = Object.fromEntries((perms as string[]).map(s => [s, "granted"]))
    }
  }

  const rolesToShow = ROLE_ORDER.filter(r => matrix[r])
  if (rolesToShow.length === 0) {
    return (
      <div style={{ padding: "24px 16px", textAlign: "center", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
        No role default data found in Supabase. Table may be empty.
      </div>
    )
  }

  // Gather all section keys present
  const allSections = APP_SECTIONS

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid rgba(212,160,23,0.2)" }}>
            <th style={{ padding: "8px 14px", textAlign: "left", fontFamily: "var(--font-heading)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", opacity: 0.6, whiteSpace: "nowrap" }}>
              Section
            </th>
            {rolesToShow.map(role => (
              <th key={role} style={{ padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                <RolePill role={role} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allSections.map((section, i) => (
            <tr key={section} style={{ borderBottom: i < allSections.length - 1 ? "0.5px solid rgba(255,255,255,0.04)" : "none" }}>
              <td style={{ padding: "7px 14px", color: "hsl(var(--foreground))", fontFamily: "var(--font-body)", opacity: 0.85, whiteSpace: "nowrap" }}>
                {section}
              </td>
              {rolesToShow.map(role => {
                const level = matrix[role]?.[section]
                return (
                  <td key={role} style={{ padding: "7px 10px", textAlign: "center" }}>
                    <PermLevel level={level} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PermLevel({ level }: { level?: string }) {
  if (!level || level === "none" || level === "—") {
    return <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.65rem" }}>—</span>
  }
  if (level === "granted" || level === "read") {
    return <span style={{ color: "rgb(52,211,153)", fontSize: "0.7rem", fontWeight: 600 }}>✓</span>
  }
  if (level === "write") {
    return (
      <span style={{ color: "var(--skyshare-gold)", fontSize: "0.65rem", fontWeight: 600, fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
        WRITE
      </span>
    )
  }
  // Unknown value — display raw
  return <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "0.65rem" }}>{level}</span>
}

// ─── 3. User access map ────────────────────────────────────────────────────────
function UserAccessMap({
  profiles,
  userPerms,
}: {
  profiles: Profile[]
  userPerms: { user_id: string; section: AppSection }[]
}) {
  // Build map user_id → Set<section>
  const permMap: Record<string, Set<AppSection>> = {}
  for (const row of userPerms) {
    if (!permMap[row.user_id]) permMap[row.user_id] = new Set()
    permMap[row.user_id].add(row.section)
  }

  const sortedProfiles = [...profiles].sort((a, b) => {
    return ROLE_ORDER.indexOf(a.role as AppRole) - ROLE_ORDER.indexOf(b.role as AppRole)
  })

  if (sortedProfiles.length === 0) {
    return (
      <div style={{ padding: "24px 16px", textAlign: "center", fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
        No users found.
      </div>
    )
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid rgba(212,160,23,0.2)" }}>
            <th style={{ padding: "8px 14px", textAlign: "left", fontFamily: "var(--font-heading)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", opacity: 0.6, whiteSpace: "nowrap", minWidth: 170 }}>
              User
            </th>
            <th style={{ padding: "8px 10px", textAlign: "left", fontFamily: "var(--font-heading)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", opacity: 0.6, whiteSpace: "nowrap" }}>
              Role
            </th>
            <th style={{ padding: "8px 14px", textAlign: "left", fontFamily: "var(--font-heading)", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>
              Individual Section Grants (overrides on top of role defaults)
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedProfiles.map((p, i) => {
            const grants = permMap[p.user_id]
            const hasGrants = grants && grants.size > 0
            const isAdminRole = p.role === "Super Admin" || p.role === "Admin"

            return (
              <tr key={p.user_id} style={{ borderBottom: i < sortedProfiles.length - 1 ? "0.5px solid rgba(255,255,255,0.04)" : "none" }}>
                <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                  <div style={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-body)", opacity: 0.85 }}>
                    {p.full_name ?? p.email}
                  </div>
                  {p.full_name && (
                    <div style={{ fontSize: "0.65rem", color: "hsl(var(--muted-foreground))", opacity: 0.45 }}>
                      {p.email}
                    </div>
                  )}
                </td>
                <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                  <RolePill role={p.role as AppRole} />
                  {p.is_readonly && (
                    <div style={{ marginTop: 3, fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
                      READ-ONLY FLAG
                    </div>
                  )}
                </td>
                <td style={{ padding: "8px 14px" }}>
                  {isAdminRole ? (
                    <span style={{ fontSize: "0.68rem", color: "hsl(var(--muted-foreground))", opacity: 0.45, fontStyle: "italic", fontFamily: "var(--font-body)" }}>
                      All sections (role grants full access)
                    </span>
                  ) : hasGrants ? (
                    <div className="flex flex-wrap gap-1">
                      {APP_SECTIONS.map(section => grants.has(section) ? (
                        <span key={section} style={{
                          fontSize: "0.63rem", padding: "1px 6px", borderRadius: 3,
                          background: "rgba(52,211,153,0.08)", color: "rgb(52,211,153)",
                          border: "0.5px solid rgba(52,211,153,0.2)", fontFamily: "var(--font-body)",
                        }}>
                          {section}
                        </span>
                      ) : null)}
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>
                      No individual grants — role defaults only
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PermissionsIndex() {
  const { profile } = useAuth()

  // Super Admin only
  if (profile && profile.role !== "Super Admin") {
    return <Navigate to="/app/access-restricted?feature=Permissions Index" replace />
  }

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["perm-index-profiles"],
    queryFn: fetchProfiles,
  })

  const { data: userPerms = [], isLoading: loadingPerms } = useQuery({
    queryKey: ["perm-index-user-perms"],
    queryFn: fetchAllUserPermissions,
  })

  const { data: roleDefaults = [], isLoading: loadingDefaults } = useQuery({
    queryKey: ["perm-index-role-defaults"],
    queryFn: fetchRoleDefaults,
  })

  const loading = loadingProfiles || loadingPerms || loadingDefaults

  return (
    <div className="flex flex-col gap-8 pb-12">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{
            fontSize: "1.35rem", fontWeight: 700, letterSpacing: "0.04em",
            fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))",
          }}>
            Permissions Index
          </h1>
          <p style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", marginTop: 4, opacity: 0.65, fontFamily: "var(--font-body)" }}>
            Read-only reference for all system permission rules and user access grants.
          </p>
        </div>
        <span style={{
          fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
          fontFamily: "var(--font-heading)", padding: "4px 10px", borderRadius: 4,
          background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)",
          border: "0.5px solid rgba(212,160,23,0.3)", flexShrink: 0, alignSelf: "center",
        }}>
          Super Admin Only
        </span>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "hsl(var(--muted-foreground))", fontSize: "0.8rem", opacity: 0.5 }}>
          Loading…
        </div>
      )}

      {!loading && (
        <>
          {/* Section 1 — Hard-coded source-code rules */}
          <div>
            <SectionHeader
              title="Hard-Coded Feature Rules"
              subtitle="These rules live in source code, not in Supabase. They cannot be changed via the admin UI."
            />
            <Card>
              <div style={{ padding: "0 0 2px 0" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  padding: "6px 16px 6px",
                  borderBottom: "0.5px solid rgba(212,160,23,0.15)",
                  background: "rgba(212,160,23,0.04)",
                }}>
                  <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-heading)", letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", opacity: 0.55 }}>Feature</span>
                  <span style={{ fontSize: "0.6rem", fontFamily: "var(--font-heading)", letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", opacity: 0.55 }}>Roles With Access</span>
                </div>
                <HardcodedRulesTable />
              </div>
            </Card>
          </div>

          {/* Section 2 — Role defaults from Supabase */}
          <div>
            <SectionHeader
              title="Role Default Permissions"
              subtitle="Stored in the role_default_permissions table. Defines which sections each role can access by default."
            />
            <Card>
              <RoleDefaultsMatrix data={roleDefaults} />
            </Card>
          </div>

          {/* Section 3 — Per-user grants */}
          <div>
            <SectionHeader
              title="User Access Map"
              subtitle={`${profiles.length} user${profiles.length !== 1 ? "s" : ""} — individual section grants shown. Admin/Super Admin roles bypass section grants entirely.`}
            />
            <Card>
              <UserAccessMap profiles={profiles} userPerms={userPerms} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
