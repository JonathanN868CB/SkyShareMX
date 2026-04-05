import { useState } from "react"
import {
  Shield, Users, Settings, ChevronRight, Check, X,
  Plus, Lock, Pencil, UserCheck, AlertTriangle,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/button"
import {
  ROLES, SYSTEM_USERS, ALL_PERMISSIONS,
  type MXRole, type SystemUser, type Permission,
} from "../../data/mockData"

// ─── Permission display config ────────────────────────────────────────────────
const PERM_GROUPS: {
  label: string
  color: string
  perms: { id: Permission; label: string; description: string }[]
}[] = [
  {
    label: "Work Orders", color: "#d4a017",
    perms: [
      { id: "wo.view",             label: "View",              description: "See the WO list and detail pages" },
      { id: "wo.create",           label: "Create",            description: "Open a new work order" },
      { id: "wo.edit_items",       label: "Edit Items",        description: "Add/edit work items, discrepancy, corrective action" },
      { id: "wo.advance_status",   label: "Advance Status",    description: "Move WO through the status pipeline" },
      { id: "wo.assign_mechanics", label: "Assign Mechanics",  description: "Assign or unassign mechanics to a WO" },
      { id: "wo.delete",           label: "Delete",            description: "Permanently delete a draft work order" },
      { id: "wo.void",             label: "Void",              description: "Void a work order (cannot be undone)" },
    ],
  },
  {
    label: "Labor & Time", color: "#60a5fa",
    perms: [
      { id: "labor.log_own",    label: "Log Own Time",    description: "Clock time against a WO item for yourself" },
      { id: "labor.log_others", label: "Log Others' Time", description: "Log time on behalf of another mechanic" },
      { id: "labor.delete",     label: "Delete Entries",  description: "Remove a labor entry from a WO item" },
    ],
  },
  {
    label: "Parts & Ordering", color: "#fbbf24",
    perms: [
      { id: "parts.add",    label: "Add Parts",    description: "Add parts to a WO item or pull from inventory" },
      { id: "parts.remove", label: "Remove Parts", description: "Remove a part from a WO item" },
      { id: "parts.order",  label: "Order Parts",  description: "Create a purchase order from a WO" },
    ],
  },
  {
    label: "Sign-offs", color: "#34d399",
    perms: [
      { id: "signoff.perform", label: "Perform Sign-off", description: "Sign off a completed work item" },
      { id: "signoff.undo",    label: "Undo Sign-off",    description: "Reverse a sign-off (IA / Admin only)" },
    ],
  },
  {
    label: "Logbook", color: "#a78bfa",
    perms: [
      { id: "logbook.view",        label: "View",         description: "Browse and read logbook entries" },
      { id: "logbook.create",      label: "Create",       description: "Generate a new logbook entry" },
      { id: "logbook.sign_lock",   label: "Sign & Lock",  description: "Sign and lock a logbook entry for record" },
      { id: "logbook.edit_locked", label: "Edit Locked",  description: "Edit a locked entry (IA / Admin only — use sparingly)" },
    ],
  },
  {
    label: "Invoicing", color: "#10b981",
    perms: [
      { id: "invoicing.view",   label: "View",   description: "See invoice list and details" },
      { id: "invoicing.create", label: "Create", description: "Generate a new invoice" },
      { id: "invoicing.edit",   label: "Edit",   description: "Modify a draft or sent invoice" },
      { id: "invoicing.void",   label: "Void",   description: "Void an invoice" },
    ],
  },
  {
    label: "Inventory", color: "#fb923c",
    perms: [
      { id: "inventory.view",       label: "View",         description: "Browse parts catalog and stock levels" },
      { id: "inventory.adjust_qty", label: "Adjust Qty",   description: "Adjust on-hand quantities (issue / receipt / adjustment)" },
      { id: "inventory.add_items",  label: "Add New Parts", description: "Add new part numbers to the catalog" },
    ],
  },
  {
    label: "Purchase Orders", color: "#38bdf8",
    perms: [
      { id: "po.view",    label: "View",    description: "See PO list and details" },
      { id: "po.create",  label: "Create",  description: "Create a new purchase order" },
      { id: "po.receive", label: "Receive", description: "Mark PO lines as received" },
    ],
  },
  {
    label: "Tools & Calibration", color: "#94a3b8",
    perms: [
      { id: "tools.view", label: "View",        description: "Browse tools and calibration status" },
      { id: "tools.edit", label: "Edit / Add",  description: "Update calibration dates, add tools, mark out-of-service" },
    ],
  },
  {
    label: "Settings & Admin", color: "#f43f5e",
    perms: [
      { id: "settings.view", label: "View Settings", description: "View the settings and permissions pages" },
      { id: "settings.edit", label: "Edit Settings",  description: "Modify roles, add/remove users, change permissions" },
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────
function RoleBadge({ role, size = "md" }: { role: MXRole; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded uppercase tracking-wider",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      )}
      style={{ background: role.color + "22", color: role.color, border: `1px solid ${role.color}44` }}
    >
      {role.name}
    </span>
  )
}

function PermToggle({
  on, locked, onChange,
}: { on: boolean; locked: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      disabled={locked}
      onClick={() => onChange?.(!on)}
      className={cn(
        "w-11 h-6 rounded-full transition-all flex-shrink-0 relative",
        on ? "bg-emerald-600" : "bg-white/[0.1]",
        locked && "opacity-50 cursor-default"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
          on ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
type Tab = "users" | "roles" | "facility"

export default function SettingsDashboard() {
  const [tab, setTab] = useState<Tab>("roles")
  const [roles, setRoles] = useState<MXRole[]>(ROLES)
  const [users, setUsers] = useState<SystemUser[]>(SYSTEM_USERS)
  const [selectedRoleId, setSelectedRoleId] = useState<string>(ROLES[0].id)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)

  const selectedRole = roles.find(r => r.id === selectedRoleId) ?? roles[0]
  const isAdmin = selectedRole.id === "role-admin"

  function togglePermission(roleId: string, perm: Permission, on: boolean) {
    setRoles(prev => prev.map(r =>
      r.id === roleId
        ? { ...r, permissions: on ? [...r.permissions, perm] : r.permissions.filter(p => p !== perm) }
        : r
    ))
  }

  function setUserRole(userId: string, roleId: string) {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, roleId } : u))
  }

  function toggleUserStatus(userId: string) {
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u
    ))
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "roles",    label: "Roles & Permissions", icon: Shield  },
    { id: "users",    label: "Users",               icon: Users   },
    { id: "facility", label: "Facility",            icon: Settings },
  ]

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <div className="hero-area px-8 pt-6 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="w-6 h-6" style={{ color: "var(--skyshare-gold)" }} />
          <h1
            className="text-white"
            style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}
          >
            Settings
          </h1>
        </div>
        <p className="text-white/40 text-sm">User roles, permissions, and facility configuration</p>
      </div>

      <div className="stripe-divider" />

      {/* Tab bar */}
      <div
        className="px-8 flex items-center gap-1 flex-shrink-0"
        style={{ background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,18%)" }}
      >
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all rounded-t-md border-b-2 -mb-px",
                active
                  ? "text-white border-[var(--skyshare-gold)]"
                  : "text-white/40 border-transparent hover:text-white/70 hover:bg-white/[0.04]"
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
      <div className="flex-1 overflow-hidden">

        {/* ── ROLES & PERMISSIONS ─────────────────────────────────────────── */}
        {tab === "roles" && (
          <div className="flex h-full overflow-hidden">

            {/* Role list */}
            <div
              className="w-72 flex-shrink-0 overflow-y-auto"
              style={{ background: "hsl(0,0%,10.5%)", borderRight: "1px solid hsl(0,0%,18%)" }}
            >
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--skyshare-gold)", opacity: 0.65 }}
                >
                  Roles
                </span>
                <button
                  className="flex items-center gap-1 text-xs text-white/35 hover:text-white/70 transition-colors px-2 py-1 rounded"
                  onClick={() => alert("Add role — demo only")}
                >
                  <Plus className="w-3.5 h-3.5" /> New
                </button>
              </div>

              {roles.map(role => {
                const userCount = users.filter(u => u.roleId === role.id).length
                const isSelected = selectedRoleId === role.id
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={cn(
                      "w-full text-left px-4 py-3.5 flex items-start gap-3 transition-all border-l-[3px]",
                      isSelected ? "border-l-transparent" : "border-l-transparent hover:bg-white/[0.04]"
                    )}
                    style={isSelected ? {
                      background: `linear-gradient(to right, ${role.color}18, rgba(0,0,0,0))`,
                      borderLeft: `3px solid ${role.color}`,
                    } : {}}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                      style={{ background: role.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium", isSelected ? "text-white" : "text-white/65")}>
                          {role.name}
                        </span>
                        {role.isSystem && (
                          <Lock className="w-3 h-3 text-white/25 flex-shrink-0" title="System role — cannot be deleted" />
                        )}
                      </div>
                      <p className="text-white/35 text-xs mt-0.5">
                        {userCount} user{userCount !== 1 ? "s" : ""} · {role.permissions.length} permissions
                      </p>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: role.color }} />}
                  </button>
                )
              })}
            </div>

            {/* Permission matrix */}
            <div className="flex-1 overflow-y-auto p-8">

              {/* Role header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: selectedRole.color }} />
                    <h2
                      className="text-white text-xl font-bold"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {selectedRole.name}
                    </h2>
                    {selectedRole.isSystem && (
                      <span
                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}
                      >
                        <Lock className="w-3 h-3" /> System role
                      </span>
                    )}
                  </div>
                  <p className="text-white/45 text-sm max-w-lg">{selectedRole.description}</p>
                </div>
                {isAdmin && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                    style={{ background: "rgba(225,29,72,0.1)", border: "1px solid rgba(225,29,72,0.25)", color: "#f87171" }}
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    All permissions always on — cannot be restricted
                  </div>
                )}
              </div>

              {/* Users assigned to this role */}
              {(() => {
                const roleUsers = users.filter(u => u.roleId === selectedRole.id && u.status === "active")
                if (roleUsers.length === 0) return null
                return (
                  <div className="mb-6 flex flex-wrap gap-2">
                    {roleUsers.map(u => (
                      <span
                        key={u.id}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                        style={{ background: selectedRole.color + "18", color: selectedRole.color, border: `1px solid ${selectedRole.color}33` }}
                      >
                        <UserCheck className="w-3 h-3" />
                        {u.name}
                        {u.certType && <span style={{ opacity: 0.65 }}>· {u.certType}</span>}
                      </span>
                    ))}
                  </div>
                )
              })()}

              {/* Permission groups */}
              <div className="space-y-6">
                {PERM_GROUPS.map(group => (
                  <div
                    key={group.label}
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid hsl(0,0%,20%)" }}
                  >
                    {/* Group header */}
                    <div
                      className="px-5 py-3 flex items-center gap-2"
                      style={{
                        background: `linear-gradient(to right, ${group.color}14, hsl(0,0%,12%))`,
                        borderBottom: "1px solid hsl(0,0%,18%)",
                        borderLeft: `3px solid ${group.color}`,
                      }}
                    >
                      <span className="text-sm font-bold uppercase tracking-wider" style={{ color: group.color }}>
                        {group.label}
                      </span>
                    </div>

                    {/* Permission rows */}
                    {group.perms.map((perm, idx) => {
                      const isOn = selectedRole.permissions.includes(perm.id)
                      return (
                        <div
                          key={perm.id}
                          className={cn(
                            "flex items-center gap-4 px-5 py-3.5",
                            idx > 0 && "border-t"
                          )}
                          style={{
                            borderColor: "hsl(0,0%,17%)",
                            background: isOn && !isAdmin ? "rgba(255,255,255,0.02)" : "hsl(0,0%,11%)",
                          }}
                        >
                          <div className="flex-1">
                            <p className={cn("text-sm font-medium", isOn ? "text-white/90" : "text-white/35")}>
                              {perm.label}
                            </p>
                            <p className="text-white/30 text-xs mt-0.5">{perm.description}</p>
                          </div>
                          <PermToggle
                            on={isOn}
                            locked={isAdmin}
                            onChange={v => togglePermission(selectedRole.id, perm.id, v)}
                          />
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

        {/* ── USERS ────────────────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="p-8 max-w-4xl">

            <div className="flex items-center justify-between mb-6">
              <p className="text-white/40 text-sm">{users.filter(u => u.status === "active").length} active · {users.filter(u => u.status === "inactive").length} inactive</p>
              <Button
                size="sm"
                style={{ background: "var(--skyshare-gold)", color: "#000" }}
                className="font-bold text-sm h-9 px-5"
                onClick={() => alert("Invite user — demo only")}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Invite User
              </Button>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,20%)" }}>
              {/* Table header */}
              <div
                className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white/35"
                style={{ background: "hsl(0,0%,13%)", borderBottom: "1px solid hsl(0,0%,20%)" }}
              >
                <span className="col-span-3">Name</span>
                <span className="col-span-3">Email</span>
                <span className="col-span-3">Role</span>
                <span className="col-span-2">Cert</span>
                <span className="col-span-1 text-right">Status</span>
              </div>

              {users.map((user, idx) => {
                const role = roles.find(r => r.id === user.roleId)
                return (
                  <div
                    key={user.id}
                    className={cn("grid grid-cols-12 gap-3 px-5 py-4 items-center", idx > 0 && "border-t")}
                    style={{ borderColor: "hsl(0,0%,17%)", background: "hsl(0,0%,11%)" }}
                  >
                    {/* Name */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: (role?.color ?? "#6b7280") + "22", color: role?.color ?? "#6b7280" }}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <span className={cn("text-sm font-medium", user.status === "inactive" ? "text-white/35" : "text-white/90")}>
                          {user.name}
                        </span>
                      </div>
                    </div>

                    {/* Email */}
                    <span className="col-span-3 text-sm text-white/40 truncate">{user.email}</span>

                    {/* Role selector */}
                    <div className="col-span-3">
                      <select
                        className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/25"
                        value={user.roleId}
                        onChange={e => setUserRole(user.id, e.target.value)}
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Cert */}
                    <div className="col-span-2">
                      {user.certType ? (
                        <div>
                          <span className="text-xs font-mono text-white/60">{user.certType}</span>
                          {user.certNumber && <p className="text-white/30 text-[10px] font-mono">{user.certNumber}</p>}
                        </div>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </div>

                    {/* Status toggle */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        title={user.status === "active" ? "Deactivate user" : "Activate user"}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                          user.status === "active"
                            ? "text-emerald-400 hover:bg-red-900/20 hover:text-red-400"
                            : "text-white/20 hover:bg-emerald-900/20 hover:text-emerald-400"
                        )}
                      >
                        {user.status === "active" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── FACILITY ──────────────────────────────────────────────────────── */}
        {tab === "facility" && (
          <div className="p-8 max-w-2xl">
            <div className="space-y-5">
              {[
                { label: "Facility Name",    value: "CB Aviation, Inc.",       note: "" },
                { label: "FAA Repair Station", value: "CBAV-MXR-001",          note: "Certificate number" },
                { label: "Primary Address",  value: "123 Ramp Road, Suite A",  note: "" },
                { label: "City / State / Zip", value: "Hangar City, TX 77001", note: "" },
                { label: "Phone",            value: "(555) 820-0041",           note: "" },
                { label: "Default Labor Rate", value: "$125.00 / hr",          note: "Applied to new work orders" },
                { label: "Tax Rate",         value: "0.00%",                   note: "Labor & parts" },
                { label: "Shop Supplies Rate", value: "5%",                    note: "Percentage of labor, auto-applied to invoices" },
              ].map(field => (
                <div
                  key={field.label}
                  className="flex items-center justify-between px-5 py-4 rounded-xl"
                  style={{ background: "hsl(0,0%,12%)", border: "1px solid hsl(0,0%,20%)" }}
                >
                  <div>
                    <p className="text-white/90 text-sm font-medium">{field.label}</p>
                    {field.note && <p className="text-white/30 text-xs mt-0.5">{field.note}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/60 text-sm font-mono">{field.value}</span>
                    <button
                      className="text-white/25 hover:text-white/60 transition-colors"
                      onClick={() => alert("Edit — demo only")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-8 px-5 py-4 rounded-xl flex items-start gap-3"
              style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.2)" }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "rgba(212,160,23,0.7)" }} />
              <p className="text-white/50 text-sm leading-relaxed">
                This is demo data. In production, facility settings would be stored in Supabase and editable by System Admins only.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
