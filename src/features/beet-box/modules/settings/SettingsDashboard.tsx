import { useState, useEffect } from "react"
import {
  Shield, Users, Settings, ChevronRight, Check, X,
  Lock, UserCheck, AlertTriangle, Building2, User,
  Pencil, Plus, Loader2, BadgeCheck,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/button"
import { getMyProfile, getTechnicians } from "../../services"
import type { Mechanic } from "../../types"
import type { Permission } from "../../data/mockData"
import { supabase } from "@/lib/supabase"

// ─── Local role data (demo — not yet persisted to DB) ────────────────────────

interface RoleData {
  id: string
  name: string
  color: string
  description: string
  isSystem: boolean
  permissions: Permission[]
}

const ALL_PERMS: Permission[] = [
  "wo.view","wo.create","wo.edit_items","wo.advance_status","wo.assign_mechanics","wo.delete","wo.void",
  "labor.log_own","labor.log_others","labor.delete",
  "parts.add","parts.remove","parts.order",
  "signoff.perform","signoff.undo",
  "logbook.view","logbook.create","logbook.sign_lock","logbook.edit_locked",
  "invoicing.view","invoicing.create","invoicing.edit","invoicing.void",
  "inventory.view","inventory.adjust_qty","inventory.add_items",
  "po.view","po.create","po.receive",
  "tools.view","tools.edit",
  "settings.view","settings.edit",
]

const DEFAULT_ROLES: RoleData[] = [
  {
    id: "role-admin", name: "Admin", color: "#f43f5e",
    description: "Full access to all modules, users, and settings. Cannot be restricted.",
    isSystem: true, permissions: ALL_PERMS,
  },
  {
    id: "role-manager", name: "Manager", color: "#d4a017",
    description: "Full operational control. Can view and edit settings but cannot modify admin accounts.",
    isSystem: true,
    permissions: ALL_PERMS.filter(p => p !== "settings.edit"),
  },
  {
    id: "role-ia", name: "IA Mechanic", color: "#a78bfa",
    description: "Inspection Authorization holder. Can sign, lock, and edit logbook entries.",
    isSystem: true,
    permissions: [
      "wo.view","wo.create","wo.edit_items","wo.advance_status","wo.assign_mechanics",
      "labor.log_own","labor.log_others","labor.delete",
      "parts.add","parts.remove","parts.order",
      "signoff.perform","signoff.undo",
      "logbook.view","logbook.create","logbook.sign_lock","logbook.edit_locked",
      "invoicing.view",
      "inventory.view","inventory.adjust_qty",
      "po.view","po.create","po.receive",
      "tools.view","tools.edit",
      "settings.view",
    ],
  },
  {
    id: "role-ap", name: "A&P Mechanic", color: "#60a5fa",
    description: "Airframe & Powerplant certificate holder. Can perform and sign work items.",
    isSystem: true,
    permissions: [
      "wo.view","wo.create","wo.edit_items","wo.advance_status",
      "labor.log_own","labor.delete",
      "parts.add","parts.remove",
      "signoff.perform",
      "logbook.view","logbook.create","logbook.sign_lock",
      "invoicing.view",
      "inventory.view",
      "po.view",
      "tools.view",
      "settings.view",
    ],
  },
  {
    id: "role-apprentice", name: "Apprentice", color: "#34d399",
    description: "Student technician under supervision. Can log time but cannot sign off work.",
    isSystem: false,
    permissions: [
      "wo.view","wo.edit_items",
      "labor.log_own",
      "parts.add",
      "logbook.view",
      "inventory.view",
      "tools.view",
      "settings.view",
    ],
  },
  {
    id: "role-readonly", name: "Read-Only", color: "#94a3b8",
    description: "View-only access across all modules. Cannot create, edit, or delete anything.",
    isSystem: false,
    permissions: [
      "wo.view","logbook.view","invoicing.view","inventory.view",
      "po.view","tools.view","settings.view",
    ],
  },
]

const PERM_GROUPS: { label: string; color: string; perms: { id: Permission; label: string; description: string }[] }[] = [
  { label: "Work Orders", color: "#d4a017", perms: [
    { id: "wo.view",             label: "View",             description: "See WO list and detail pages" },
    { id: "wo.create",           label: "Create",           description: "Open a new work order" },
    { id: "wo.edit_items",       label: "Edit Items",       description: "Add/edit work items, discrepancy, corrective action" },
    { id: "wo.advance_status",   label: "Advance Status",   description: "Move WO through the status pipeline" },
    { id: "wo.assign_mechanics", label: "Assign Mechanics", description: "Assign or unassign mechanics to a WO" },
    { id: "wo.delete",           label: "Delete",           description: "Permanently delete a draft work order" },
    { id: "wo.void",             label: "Void",             description: "Void a work order (cannot be undone)" },
  ]},
  { label: "Labor & Time", color: "#60a5fa", perms: [
    { id: "labor.log_own",    label: "Log Own Time",     description: "Clock time against a WO item for yourself" },
    { id: "labor.log_others", label: "Log Others' Time", description: "Log time on behalf of another mechanic" },
    { id: "labor.delete",     label: "Delete Entries",   description: "Remove a labor entry from a WO item" },
  ]},
  { label: "Parts & Ordering", color: "#fbbf24", perms: [
    { id: "parts.add",    label: "Add Parts",    description: "Add parts to a WO item or pull from inventory" },
    { id: "parts.remove", label: "Remove Parts", description: "Remove a part from a WO item" },
    { id: "parts.order",  label: "Order Parts",  description: "Create a purchase order from a WO" },
  ]},
  { label: "Sign-offs", color: "#34d399", perms: [
    { id: "signoff.perform", label: "Perform Sign-off", description: "Sign off a completed work item" },
    { id: "signoff.undo",    label: "Undo Sign-off",    description: "Reverse a sign-off (IA / Admin only)" },
  ]},
  { label: "Logbook", color: "#a78bfa", perms: [
    { id: "logbook.view",        label: "View",        description: "Browse and read logbook entries" },
    { id: "logbook.create",      label: "Create",      description: "Generate a new logbook entry" },
    { id: "logbook.sign_lock",   label: "Sign & Lock", description: "Sign and lock a logbook entry for record" },
    { id: "logbook.edit_locked", label: "Edit Locked", description: "Edit a locked entry (IA / Admin only)" },
  ]},
  { label: "Invoicing", color: "#10b981", perms: [
    { id: "invoicing.view",   label: "View",   description: "See invoice list and details" },
    { id: "invoicing.create", label: "Create", description: "Generate a new invoice" },
    { id: "invoicing.edit",   label: "Edit",   description: "Modify a draft or sent invoice" },
    { id: "invoicing.void",   label: "Void",   description: "Void an invoice" },
  ]},
  { label: "Inventory", color: "#fb923c", perms: [
    { id: "inventory.view",       label: "View",          description: "Browse parts catalog and stock levels" },
    { id: "inventory.adjust_qty", label: "Adjust Qty",    description: "Issue / receipt / adjustment transactions" },
    { id: "inventory.add_items",  label: "Add New Parts", description: "Add new part numbers to the catalog" },
  ]},
  { label: "Purchase Orders", color: "#38bdf8", perms: [
    { id: "po.view",    label: "View",    description: "See PO list and details" },
    { id: "po.create",  label: "Create",  description: "Create a new purchase order" },
    { id: "po.receive", label: "Receive", description: "Mark PO lines as received" },
  ]},
  { label: "Tools & Calibration", color: "#94a3b8", perms: [
    { id: "tools.view", label: "View",       description: "Browse tools and calibration status" },
    { id: "tools.edit", label: "Edit / Add", description: "Update calibration dates, add tools" },
  ]},
  { label: "Settings & Admin", color: "#f43f5e", perms: [
    { id: "settings.view", label: "View Settings", description: "View the settings and permissions pages" },
    { id: "settings.edit", label: "Edit Settings",  description: "Modify roles, add/remove users, change permissions" },
  ]},
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function PermToggle({ on, locked, onChange }: { on: boolean; locked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      disabled={locked}
      onClick={() => onChange?.(!on)}
      className={cn("w-11 h-6 rounded-full transition-all flex-shrink-0 relative", on ? "bg-emerald-600" : "bg-white/[0.1]", locked && "opacity-50 cursor-default")}
    >
      <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  )
}

function CertBadge({ certType }: { certType: string | null }) {
  if (!certType) return null
  const colors: Record<string, string> = {
    "A&P/IA": "#a78bfa", "IA": "#c084fc", "A&P": "#60a5fa", "Avionics": "#34d399",
  }
  const color = colors[certType] ?? "#94a3b8"
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}>
      {certType}
    </span>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type Tab = "profile" | "team" | "roles" | "shop"

export default function SettingsDashboard() {
  const [tab, setTab] = useState<Tab>("profile")

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<{ id: string; name: string; email: string; certType: string | null; certNumber: string | null } | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    getMyProfile()
      .then(p => {
        setProfile(p)
        setNameInput(p?.name ?? "")
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
  }, [])

  async function saveName() {
    if (!profile || !nameInput.trim()) return
    setNameSaving(true)
    setNameError(null)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: nameInput.trim() })
        .eq("id", profile.id)
      if (error) throw error
      setProfile(p => p ? { ...p, name: nameInput.trim() } : p)
      setEditingName(false)
    } catch (err: any) {
      setNameError(err.message ?? "Failed to save")
    } finally {
      setNameSaving(false)
    }
  }

  // ── Team state ─────────────────────────────────────────────────────────────
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamLoaded, setTeamLoaded] = useState(false)

  useEffect(() => {
    if (tab === "team" && !teamLoaded) {
      setTeamLoading(true)
      getTechnicians()
        .then(m => { setMechanics(m); setTeamLoaded(true) })
        .catch(() => {})
        .finally(() => setTeamLoading(false))
    }
  }, [tab, teamLoaded])

  // ── Roles state (local demo) ───────────────────────────────────────────────
  const [roles, setRoles] = useState<RoleData[]>(DEFAULT_ROLES)
  const [selectedRoleId, setSelectedRoleId] = useState("role-admin")
  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? roles[0]
  const isAdminRole = selectedRole.id === "role-admin"

  function togglePerm(roleId: string, perm: Permission, on: boolean) {
    setRoles(prev => prev.map(r =>
      r.id === roleId
        ? { ...r, permissions: on ? [...r.permissions, perm] : r.permissions.filter(p => p !== perm) }
        : r
    ))
  }

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: "My Profile",         icon: User      },
    { id: "team",    label: "Team",                icon: Users     },
    { id: "roles",   label: "Roles & Permissions", icon: Shield    },
    { id: "shop",    label: "Shop",                icon: Building2 },
  ]

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <div className="hero-area px-8 pt-6 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Settings className="w-6 h-6" style={{ color: "var(--skyshare-gold)" }} />
          <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
            Settings
          </h1>
        </div>
        <p className="text-white/40 text-sm">Profile, team, roles, and shop configuration</p>
      </div>

      <div className="stripe-divider" />

      {/* Tab bar */}
      <div className="px-8 flex items-center gap-1 flex-shrink-0"
        style={{ background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,18%)" }}>
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all rounded-t-md border-b-2 -mb-px",
                active ? "text-white border-[var(--skyshare-gold)]" : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.04]"
              )}
              style={active ? { background: "linear-gradient(to bottom, rgba(212,160,23,0.08), transparent)" } : {}}
            >
              <Icon className={cn("w-4 h-4", active && "text-[var(--skyshare-gold)]")} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">

        {/* ── MY PROFILE ────────────────────────────────────────────────────── */}
        {tab === "profile" && (
          <div className="p-8 max-w-xl">
            {profileLoading ? (
              <div className="flex items-center gap-3 text-white/30">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading profile…</span>
              </div>
            ) : !profile ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-red-300 text-sm">Could not load profile. Make sure you're logged in.</span>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Avatar + name */}
                <div className="flex items-center gap-5 px-6 py-5 rounded-xl" style={{ background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,20%)" }}>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
                    style={{ background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)", border: "2px solid rgba(212,160,23,0.3)" }}>
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={nameInput}
                          onChange={e => setNameInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false) }}
                          className="flex-1 bg-white/[0.07] border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-white/35"
                        />
                        <button onClick={saveName} disabled={nameSaving}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-900/20 transition-colors disabled:opacity-50">
                          {nameSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { setEditingName(false); setNameInput(profile.name) }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-white/60 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-lg truncate">{profile.name}</span>
                        <button onClick={() => setEditingName(true)}
                          className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
                    <p className="text-white/45 text-sm mt-0.5">{profile.email}</p>
                  </div>
                </div>

                {/* Certification */}
                <div className="px-5 py-4 rounded-xl space-y-3" style={{ background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,20%)" }}>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
                    Certification
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-xs mb-1">Certificate Type</p>
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="w-4 h-4 text-white/25" />
                        {profile.certType
                          ? <CertBadge certType={profile.certType} />
                          : <span className="text-white/25 text-sm">Not on file</span>
                        }
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-xs mb-1">Certificate #</p>
                      <span className="text-white/70 text-sm font-mono">{profile.certNumber ?? "—"}</span>
                    </div>
                  </div>
                  <p className="text-white/25 text-xs">To update your certification, contact an Admin.</p>
                </div>

                {/* Account */}
                <div className="px-5 py-4 rounded-xl" style={{ background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,20%)" }}>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3" style={{ fontFamily: "var(--font-heading)" }}>
                    Account
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/85 text-sm">Password</p>
                      <p className="text-white/35 text-xs">Managed through your SSO provider</p>
                    </div>
                    <span className="text-white/20 text-xs">••••••••</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TEAM ──────────────────────────────────────────────────────────── */}
        {tab === "team" && (
          <div className="p-8 max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <p className="text-white/40 text-sm">
                {teamLoading ? "Loading…" : `${mechanics.length} mechanic${mechanics.length !== 1 ? "s" : ""} on file`}
              </p>
              <Button size="sm" style={{ background: "var(--skyshare-gold)", color: "#000" }}
                className="font-bold text-sm h-9 px-5"
                onClick={() => alert("Invite flow coming soon")}>
                <Plus className="w-4 h-4 mr-1.5" /> Invite
              </Button>
            </div>

            {teamLoading ? (
              <div className="flex items-center gap-3 text-white/30">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Loading team…</span>
              </div>
            ) : mechanics.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No mechanics on file yet.</p>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,20%)" }}>
                <div className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white/35"
                  style={{ background: "hsl(0,0%,13%)", borderBottom: "1px solid hsl(0,0%,20%)" }}>
                  <span className="col-span-4">Name</span>
                  <span className="col-span-4">Email</span>
                  <span className="col-span-2">Cert</span>
                  <span className="col-span-2">Cert #</span>
                </div>
                {mechanics.map((m, idx) => (
                  <div key={m.id}
                    className={cn("grid grid-cols-12 gap-3 px-5 py-4 items-center", idx > 0 && "border-t")}
                    style={{ borderColor: "hsl(0,0%,17%)", background: "hsl(0,0%,11%)" }}>
                    <div className="col-span-4 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: "rgba(212,160,23,0.12)", color: "var(--skyshare-gold)" }}>
                        {m.name.charAt(0)}
                      </div>
                      <span className="text-white/85 text-sm font-medium truncate">{m.name}</span>
                    </div>
                    <span className="col-span-4 text-white/40 text-sm truncate">{m.email}</span>
                    <div className="col-span-2">
                      <CertBadge certType={m.certType} />
                    </div>
                    <span className="col-span-2 text-white/40 text-xs font-mono">{m.certNumber ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ROLES & PERMISSIONS ────────────────────────────────────────────── */}
        {tab === "roles" && (
          <div className="flex h-full overflow-hidden" style={{ minHeight: "calc(100vh - 160px)" }}>

            {/* Role list */}
            <div className="w-68 flex-shrink-0 overflow-y-auto"
              style={{ width: "272px", background: "hsl(0,0%,10.5%)", borderRight: "1px solid hsl(0,0%,18%)" }}>
              <div className="px-4 pt-4 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--skyshare-gold)", opacity: 0.65 }}>
                  Roles
                </span>
                <p className="text-white/25 text-xs mt-1">Demo only — changes are not persisted.</p>
              </div>
              {roles.map(role => {
                const isSelected = selectedRoleId === role.id
                return (
                  <button key={role.id} onClick={() => setSelectedRoleId(role.id)}
                    className="w-full text-left px-4 py-3.5 flex items-start gap-3 transition-all border-l-[3px]"
                    style={isSelected ? {
                      background: `linear-gradient(to right, ${role.color}18, rgba(0,0,0,0))`,
                      borderLeft: `3px solid ${role.color}`,
                    } : { borderLeft: "3px solid transparent" }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "" }}
                  >
                    <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: role.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium", isSelected ? "text-white" : "text-white/65")}>{role.name}</span>
                        {role.isSystem && <Lock className="w-3 h-3 text-white/20 flex-shrink-0" />}
                      </div>
                      <p className="text-white/30 text-xs mt-0.5">{role.permissions.length} permissions</p>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: role.color }} />}
                  </button>
                )
              })}
            </div>

            {/* Permission matrix */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: selectedRole.color }} />
                    <h2 className="text-white text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                      {selectedRole.name}
                    </h2>
                    {selectedRole.isSystem && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                        <Lock className="w-3 h-3" /> System role
                      </span>
                    )}
                  </div>
                  <p className="text-white/45 text-sm max-w-lg">{selectedRole.description}</p>
                </div>
                {isAdminRole && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm flex-shrink-0"
                    style={{ background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.25)", color: "#f87171" }}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    All permissions always on
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {PERM_GROUPS.map(group => (
                  <div key={group.label} className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,20%)" }}>
                    <div className="px-5 py-3 flex items-center gap-2"
                      style={{ background: `linear-gradient(to right, ${group.color}14, hsl(0,0%,12%))`, borderBottom: "1px solid hsl(0,0%,18%)", borderLeft: `3px solid ${group.color}` }}>
                      <span className="text-sm font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</span>
                    </div>
                    {group.perms.map((perm, idx) => {
                      const isOn = isAdminRole || selectedRole.permissions.includes(perm.id)
                      return (
                        <div key={perm.id}
                          className={cn("flex items-center gap-4 px-5 py-3.5", idx > 0 && "border-t")}
                          style={{ borderColor: "hsl(0,0%,17%)", background: isOn && !isAdminRole ? "rgba(255,255,255,0.02)" : "hsl(0,0%,11%)" }}>
                          <div className="flex-1">
                            <p className={cn("text-sm font-medium", isOn ? "text-white/90" : "text-white/35")}>{perm.label}</p>
                            <p className="text-white/30 text-xs mt-0.5">{perm.description}</p>
                          </div>
                          <PermToggle on={isOn} locked={isAdminRole} onChange={v => togglePerm(selectedRole.id, perm.id, v)} />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="h-12" />
            </div>
          </div>
        )}

        {/* ── SHOP ──────────────────────────────────────────────────────────── */}
        {tab === "shop" && (
          <div className="p-8 max-w-2xl">
            <div className="space-y-4">
              {[
                { section: "Facility", fields: [
                  { label: "Facility Name",       value: "CB Aviation, Inc.",      note: "" },
                  { label: "FAA Repair Station #", value: "CBAV-MXR-001",          note: "Certificate number" },
                  { label: "Primary Address",     value: "123 Ramp Road, Suite A", note: "" },
                  { label: "City / State / Zip",  value: "Hangar City, TX 77001",  note: "" },
                  { label: "Phone",               value: "(555) 820-0041",          note: "" },
                ]},
                { section: "Billing Defaults", fields: [
                  { label: "Default Labor Rate",   value: "$125.00 / hr", note: "Applied to new work orders" },
                  { label: "Tax Rate",             value: "0.00%",        note: "Applied to labor & parts on invoices" },
                  { label: "Shop Supplies Rate",   value: "5%",           note: "Percentage of labor, auto-added to invoices" },
                ]},
              ].map(({ section, fields }) => (
                <div key={section}>
                  <p className="text-white/35 text-xs font-bold uppercase tracking-widest mb-3 px-1" style={{ fontFamily: "var(--font-heading)" }}>
                    {section}
                  </p>
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,20%)" }}>
                    {fields.map((field, idx) => (
                      <div key={field.label}
                        className={cn("flex items-center justify-between px-5 py-4", idx > 0 && "border-t")}
                        style={{ borderColor: "hsl(0,0%,17%)", background: "hsl(0,0%,11%)" }}>
                        <div>
                          <p className="text-white/85 text-sm font-medium">{field.label}</p>
                          {field.note && <p className="text-white/30 text-xs mt-0.5">{field.note}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-white/55 text-sm font-mono">{field.value}</span>
                          <button className="text-white/20 hover:text-white/55 transition-colors"
                            onClick={() => alert("Shop settings editing coming soon")}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 px-5 py-4 rounded-xl flex items-start gap-3"
              style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.2)" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(212,160,23,0.7)" }} />
              <p className="text-white/45 text-sm leading-relaxed">
                Shop settings are display-only in this build. A <code className="text-white/60 text-xs bg-white/[0.06] px-1.5 py-0.5 rounded">bb_shop_settings</code> table will store these when the full settings module ships.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
