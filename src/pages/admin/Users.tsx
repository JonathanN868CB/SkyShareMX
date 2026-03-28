import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Users, UserPlus, CheckCircle, XCircle, MoreHorizontal,
  Shield, Clock, AlertTriangle, Mail, Trash2, Send, RefreshCw,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { supabase } from "@/lib/supabase"
import { APP_ROLES, APP_SECTIONS, type Profile, type AccessRequest, type AppRole, type UserStatus, type AppSection } from "@/entities/supabase"
import { useAuth } from "@/features/auth"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { Avatar, AvatarFallback } from "@/shared/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { Switch } from "@/shared/ui/switch"
import { Label } from "@/shared/ui/label"
import { Textarea } from "@/shared/ui/textarea"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    Active:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    Pending:   "bg-amber-500/15 text-amber-400 border-amber-500/20",
    Inactive:  "bg-white/10 text-white/40 border-white/10",
    Suspended: "bg-red-500/15 text-red-400 border-red-500/20",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wider uppercase ${styles[status]}`}
      style={{ fontFamily: "var(--font-heading)" }}>
      {status}
    </span>
  )
}

function RoleBadge({ role }: { role: AppRole }) {
  const styles: Record<AppRole, string> = {
    "Super Admin": "bg-[rgba(212,160,23,0.15)] text-[var(--skyshare-gold)] border-[rgba(212,160,23,0.25)]",
    "Admin":       "bg-[rgba(70,100,129,0.2)] text-[var(--skyshare-blue-mid)] border-[rgba(70,100,129,0.3)]",
    "Manager":     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "Technician":  "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "Read-Only":   "bg-white/8 text-white/40 border-white/10",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wider uppercase ${styles[role]}`}
      style={{ fontFamily: "var(--font-heading)" }}>
      {role}
    </span>
  )
}

// ─── Queries ─────────────────────────────────────────────────────────────────

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

async function fetchAccessRequests(): Promise<AccessRequest[]> {
  const { data, error } = await supabase
    .from("access_requests")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

async function fetchUserPermissions(userId: string) {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("section")
    .eq("user_id", userId)
  if (error) throw error
  return (data ?? []).map(r => r.section as AppSection)
}

// ─── Permissions Dialog ───────────────────────────────────────────────────────

function PermissionsDialog({
  user,
  open,
  onClose,
}: {
  user: Profile | null
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [grants, setGrants] = useState<AppSection[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load current permissions when dialog opens
  const { data: permData, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: () => fetchUserPermissions(user!.id),
    enabled: open && !!user,
  })

  useEffect(() => {
    if (permData) { setGrants(permData); setLoaded(true) }
  }, [permData])

  const toggle = (section: AppSection) => {
    setGrants(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    )
  }

  const save = async () => {
    if (!user) return
    setSaving(true)
    try {
      // Delete existing and re-insert
      const { error: delErr } = await supabase
        .from("user_permissions")
        .delete()
        .eq("user_id", user.id)
      if (delErr) throw delErr

      if (grants.length > 0) {
        const { error: insErr } = await supabase
          .from("user_permissions")
          .insert(grants.map(section => ({ user_id: user.id, section })))
        if (insErr) throw insErr
      }

      toast.success("Permissions saved")
      qc.invalidateQueries({ queryKey: ["user-permissions", user.id] })
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save permissions")
    } finally {
      setSaving(false)
    }
  }

  const sectionDescriptions: Record<AppSection, string> = {
    Overview:       "Dashboard, Aircraft Info, AI Assistant",
    Operations:     "Conformity, Checks, Planning, Ten or More, Terminal, Projects, Training, Docs",
    Administration: "Users, Alerts & Notifications, Settings",
    Development:    "Style guide and developer tools",
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" style={{ background: "hsl(0 0% 16%)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            Module Access
          </DialogTitle>
          <DialogDescription className="text-white/40">
            {user?.full_name ?? user?.email} — {user?.role}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !loaded ? (
          <div className="py-8 text-center text-white/30 text-sm">Loading…</div>
        ) : (
          <div className="space-y-3 py-2">
            {APP_SECTIONS.map(section => (
              <div
                key={section}
                className="flex items-start justify-between gap-4 rounded p-3"
                style={{ background: "hsl(0 0% 12%)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>
                  <Label
                    className="text-sm font-medium text-white/80 cursor-pointer"
                    style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}
                    htmlFor={`perm-${section}`}
                  >
                    {section}
                  </Label>
                  <p className="text-xs text-white/30 mt-0.5">{sectionDescriptions[section]}</p>
                </div>
                <Switch
                  id={`perm-${section}`}
                  checked={grants.includes(section)}
                  onCheckedChange={() => toggle(section)}
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/40 hover:text-white/60">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || isLoading}
            style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}
          >
            {saving ? "Saving…" : "Save Permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Approve Dialog ───────────────────────────────────────────────────────────

function ApproveDialog({
  request,
  open,
  onClose,
}: {
  request: AccessRequest | null
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [role, setRole] = useState<AppRole>("Technician")
  const [saving, setSaving] = useState(false)

  const approve = async () => {
    if (!request) return
    setSaving(true)
    try {
      // Update request status
      const { error: reqErr } = await supabase
        .from("access_requests")
        .update({ status: "approved" })
        .eq("id", request.id)
      if (reqErr) throw reqErr

      // If profile exists for this email, activate it with the chosen role
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", request.email)
        .single()

      if (profile) {
        await supabase
          .from("profiles")
          .update({ status: "Active", role })
          .eq("id", profile.id)
        toast.success(`${request.full_name ?? request.email} is now active as ${role}`)
      } else {
        toast.success(`Request approved — ${request.email} will be activated on next sign-in`)
      }

      qc.invalidateQueries({ queryKey: ["access-requests"] })
      qc.invalidateQueries({ queryKey: ["admin-users"] })
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to approve request")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm" style={{ background: "hsl(0 0% 16%)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            Approve Access
          </DialogTitle>
          <DialogDescription className="text-white/40">
            Assign a role for {request?.full_name ?? request?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <Label className="text-xs text-white/50 uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>
            Role
          </Label>
          <Select value={role} onValueChange={v => setRole(v as AppRole)}>
            <SelectTrigger className="bg-[hsl(0_0%_12%)] border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[hsl(0_0%_14%)] border-white/10">
              {APP_ROLES.filter(r => r !== "Super Admin").map(r => (
                <SelectItem key={r} value={r} className="text-white/80 focus:bg-white/10 focus:text-white">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/40 hover:text-white/60">
            Cancel
          </Button>
          <Button
            onClick={approve}
            disabled={saving}
            style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}
          >
            {saving ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Invite Dialog ────────────────────────────────────────────────────────────

const ALLOWED_DOMAIN = "skyshare.com"

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0)
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile: me, session } = useAuth()
  const [raw, setRaw] = useState("")
  const [role, setRole] = useState<AppRole>("Technician")
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) { setRaw(""); setRole("Technician") }
  }, [open])

  const emails = parseEmails(raw)
  const invalid = emails.filter(e => !e.endsWith(`@${ALLOWED_DOMAIN}`))
  const valid   = emails.filter(e => e.endsWith(`@${ALLOWED_DOMAIN}`))
  const canSend = valid.length > 0 && invalid.length === 0 && !sending

  const send = async () => {
    if (!canSend || !session?.access_token) return
    setSending(true)
    let failed = 0
    for (const email of valid) {
      try {
        const res = await fetch("/.netlify/functions/send-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email,
            role,
            invitedByName: me?.full_name ?? me?.email ?? "A SkyShare admin",
            siteUrl: window.location.origin,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error("Invite failed for", email, body)
          failed++
        }
      } catch (e) {
        console.error("Invite error for", email, e)
        failed++
      }
    }
    setSending(false)
    if (failed === 0) {
      toast.success(valid.length === 1
        ? `Invite sent to ${valid[0]}`
        : `${valid.length} invites sent`)
      onClose()
    } else {
      toast.error(`${failed} of ${valid.length} invites failed — check console`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Gold stripe top */}
        <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)", borderRadius: "4px 4px 0 0", marginTop: "-1px", marginLeft: "-1px", marginRight: "-1px", position: "relative", top: "-24px", marginBottom: "-20px" }} />

        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            Invite Team Members
          </DialogTitle>
          <DialogDescription className="text-white/40 text-xs" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
            Only @{ALLOWED_DOMAIN} addresses are permitted
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Email input */}
          <div className="space-y-1.5">
            <Label
              className="text-[10px] uppercase tracking-widest text-white/40"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Email Addresses
            </Label>
            <Textarea
              ref={textareaRef}
              placeholder={`name@${ALLOWED_DOMAIN}\nname2@${ALLOWED_DOMAIN}`}
              value={raw}
              onChange={e => setRaw(e.target.value)}
              rows={4}
              className="resize-none text-sm text-white/80 placeholder:text-white/20"
              style={{
                background: "hsl(0 0% 10%)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontFamily: "var(--font-body)",
              }}
            />
            <p className="text-[11px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
              Paste one or multiple emails, separated by comma or newline
            </p>
          </div>

          {/* Validation feedback */}
          {invalid.length > 0 && (
            <div
              className="rounded px-3 py-2 text-xs text-red-400 space-y-0.5"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <p className="font-semibold uppercase tracking-wider text-[10px]" style={{ fontFamily: "var(--font-heading)" }}>
                Invalid — not @{ALLOWED_DOMAIN}:
              </p>
              {invalid.map(e => <p key={e}>{e}</p>)}
            </div>
          )}

          {valid.length > 0 && invalid.length === 0 && (
            <div
              className="rounded px-3 py-2 text-xs text-emerald-400 space-y-0.5"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <p className="font-semibold uppercase tracking-wider text-[10px]" style={{ fontFamily: "var(--font-heading)" }}>
                {valid.length} valid {valid.length === 1 ? "address" : "addresses"}:
              </p>
              {valid.map(e => <p key={e}>{e}</p>)}
            </div>
          )}

          {/* Role selector */}
          <div className="space-y-1.5">
            <Label
              className="text-[10px] uppercase tracking-widest text-white/40"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Assign Role
            </Label>
            <Select value={role} onValueChange={v => setRole(v as AppRole)}>
              <SelectTrigger
                className="text-sm text-white/80"
                style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent style={{ background: "hsl(0 0% 14%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {APP_ROLES.filter(r => r !== "Super Admin").map(r => (
                  <SelectItem key={r} value={r} className="text-white/80 focus:bg-white/10 focus:text-white">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/40 hover:text-white/60">
            Cancel
          </Button>
          <Button
            onClick={send}
            disabled={!canSend}
            className="gap-2"
            style={{
              background: canSend ? "var(--skyshare-gold)" : "rgba(212,160,23,0.3)",
              color: canSend ? "hsl(0 0% 8%)" : "rgba(0,0,0,0.4)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.1em",
            }}
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : `Send ${valid.length > 1 ? `${valid.length} Invites` : "Invite"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Remove User Dialog ───────────────────────────────────────────────────────

function RemoveUserDialog({
  user,
  open,
  onClose,
}: {
  user: Profile | null
  open: boolean
  onClose: () => void
}) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [removing, setRemoving] = useState(false)

  const remove = async () => {
    if (!user || !session?.access_token) return
    setRemoving(true)
    try {
      const res = await fetch(`/.netlify/functions/users-admin?id=${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to remove user")
      }
      toast.success(`${user.full_name ?? user.email} has been removed`)
      qc.invalidateQueries({ queryKey: ["admin-users"] })
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove user")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-sm"
        style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(239,68,68,0.2)" }}
      >
        <DialogHeader>
          <DialogTitle
            className="text-red-400"
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}
          >
            Remove User
          </DialogTitle>
          <DialogDescription className="text-white/40">
            This will permanently delete <strong className="text-white/70">{user?.full_name ?? user?.email}</strong> from the system. They will lose all access immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-white/40 hover:text-white/60">
            Cancel
          </Button>
          <Button
            onClick={remove}
            disabled={removing}
            className="gap-2"
            style={{
              background: "rgba(239,68,68,0.15)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.3)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.1em",
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {removing ? "Removing…" : "Remove User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { profile: me } = useAuth()
  const qc = useQueryClient()

  const [approveTarget, setApproveTarget] = useState<AccessRequest | null>(null)
  const [permTarget, setPermTarget] = useState<Profile | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const isAdmin = me?.role === "Super Admin" || me?.role === "Admin"

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchProfiles,
    enabled: isAdmin,
  })

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ["access-requests"],
    queryFn: fetchAccessRequests,
    enabled: isAdmin,
  })

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", userId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Role updated")
      qc.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update role"),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: UserStatus }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", userId)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      toast.success(`User ${vars.status.toLowerCase()}`)
      qc.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update status"),
  })

  const rejectRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("access_requests").update({ status: "rejected" }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Request rejected")
      qc.invalidateQueries({ queryKey: ["access-requests"] })
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to reject request"),
  })

  if (!isAdmin) {
    return (
      <div className="hero-area">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm">You don't have permission to manage users.</p>
        </div>
      </div>
    )
  }

  // Stats
  const active    = profiles.filter(p => p.status === "Active").length
  const pending   = profiles.filter(p => p.status === "Pending").length
  const suspended = profiles.filter(p => p.status === "Suspended" || p.status === "Inactive").length
  const newRequests = requests.filter(r => r.status === "new").length

  const statCards = [
    { label: "Total Members", value: profiles.length, accent: "var(--skyshare-gold)", iconBg: "rgba(212,160,23,0.15)", icon: Users },
    { label: "Active",        value: active,           accent: "var(--skyshare-success)", iconBg: "rgba(16,185,129,0.15)", icon: CheckCircle },
    { label: "Pending",       value: pending,          accent: "var(--skyshare-warning)", iconBg: "rgba(212,160,23,0.15)", icon: Clock },
    { label: "Access Requests", value: newRequests,    accent: "var(--skyshare-blue-mid)", iconBg: "rgba(70,100,129,0.2)", icon: UserPlus },
  ]

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="hero-area">
        <h1
          className="text-[2.6rem] leading-none text-foreground"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}
        >
          USER MANAGEMENT
        </h1>
        <div className="mt-2 mb-2" style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }} />
        <p className="text-sm text-muted-foreground" style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          Invite, manage roles, and control access
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(card => (
          <Card key={card.label} className="card-elevated border-0" style={{ borderLeft: `3px solid ${card.accent}` }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle style={{ fontFamily: "var(--font-heading)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase" }} className="text-muted-foreground">
                {card.label}
              </CardTitle>
              <div className="h-8 w-8 rounded flex items-center justify-center" style={{ background: card.iconBg }}>
                <card.icon className="h-4 w-4" style={{ color: card.accent }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)", cursor: "default" }}>
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-card border border-white/[0.07]">
            <TabsTrigger value="team" className="data-[state=active]:bg-[rgba(212,160,23,0.12)] data-[state=active]:text-[var(--skyshare-gold)]">
              Team Members
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-[rgba(212,160,23,0.12)] data-[state=active]:text-[var(--skyshare-gold)]">
              Access Requests
              {newRequests > 0 && (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)" }}>
                  {newRequests}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <Button
            size="sm"
            className="gap-2 text-xs uppercase tracking-wider border-0"
            style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", fontFamily: "var(--font-heading)" }}
            onClick={() => setInviteOpen(true)}
          >
            <Mail className="h-3.5 w-3.5" />
            Invite Member
          </Button>
        </div>

        {/* Team Members Tab */}
        <TabsContent value="team">
          <Card className="card-elevated border-0">
            {loadingProfiles ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
            ) : profiles.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">No users found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.07] hover:bg-transparent">
                    {["User", "Role", "Status", "Last Login", ""].map(h => (
                      <TableHead key={h} className="text-white/40" style={{ fontFamily: "var(--font-heading)", fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map(user => (
                    <TableRow key={user.id} className="border-white/[0.05] hover:bg-white/[0.03]">

                      {/* User */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs font-bold" style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", fontFamily: "var(--font-heading)" }}>
                              {getInitials(user.full_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">{user.full_name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell>
                        {user.role === "Super Admin" || user.id === me?.id ? (
                          <RoleBadge role={user.role} />
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={v => updateRole.mutate({ userId: user.id, role: v as AppRole })}
                          >
                            <SelectTrigger className="h-7 w-36 text-xs bg-transparent border-white/10 hover:border-white/20 focus:ring-0 p-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[hsl(0_0%_14%)] border-white/10">
                              {APP_ROLES.filter(r => r !== "Super Admin").map(r => (
                                <SelectItem key={r} value={r} className="text-white/80 focus:bg-white/10 focus:text-white text-xs">
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={user.status} />
                      </TableCell>

                      {/* Last Login */}
                      <TableCell className="text-xs text-muted-foreground">
                        {user.last_login
                          ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
                          : "Never"}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {user.id !== me?.id && user.role !== "Super Admin" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white/70">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[hsl(0_0%_14%)] border-white/10 text-white/80">
                              <DropdownMenuItem
                                className="focus:bg-white/10 cursor-pointer gap-2"
                                onClick={() => setPermTarget(user)}
                              >
                                <Shield className="h-3.5 w-3.5" /> Manage Permissions
                              </DropdownMenuItem>
                              {user.status === "Pending" && (
                                <DropdownMenuItem
                                  className="focus:bg-white/10 cursor-pointer gap-2 text-[var(--skyshare-gold)]"
                                  onClick={() => setInviteOpen(true)}
                                >
                                  <Send className="h-3.5 w-3.5" /> Re-send Invite
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-white/10" />
                              {user.status !== "Active" && (
                                <DropdownMenuItem
                                  className="focus:bg-white/10 cursor-pointer text-emerald-400"
                                  onClick={() => updateStatus.mutate({ userId: user.id, status: "Active" })}
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-2" /> Activate
                                </DropdownMenuItem>
                              )}
                              {user.status === "Active" && (
                                <DropdownMenuItem
                                  className="focus:bg-white/10 cursor-pointer text-amber-400"
                                  onClick={() => updateStatus.mutate({ userId: user.id, status: "Suspended" })}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Suspend
                                </DropdownMenuItem>
                              )}
                              {user.status !== "Inactive" && (
                                <DropdownMenuItem
                                  className="focus:bg-white/10 cursor-pointer text-red-400"
                                  onClick={() => updateStatus.mutate({ userId: user.id, status: "Inactive" })}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-2" /> Deactivate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem
                                className="focus:bg-red-500/10 cursor-pointer text-red-400 gap-2"
                                onClick={() => setRemoveTarget(user)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Remove User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Access Requests Tab */}
        <TabsContent value="requests">
          <Card className="card-elevated border-0">
            {loadingRequests ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
            ) : requests.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">No access requests</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.07] hover:bg-transparent">
                    {["Applicant", "Company", "Reason", "Status", "Submitted", ""].map(h => (
                      <TableHead key={h} className="text-white/40" style={{ fontFamily: "var(--font-heading)", fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id} className="border-white/[0.05] hover:bg-white/[0.03]">

                      {/* Applicant */}
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{req.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{req.email}</p>
                      </TableCell>

                      {/* Company */}
                      <TableCell className="text-sm text-muted-foreground">{req.company ?? "—"}</TableCell>

                      {/* Reason */}
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{req.reason ?? "—"}</TableCell>

                      {/* Status */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wider uppercase ${
                            req.status === "new"      ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                            req.status === "approved" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                            "bg-white/8 text-white/40 border-white/10"
                          }`}
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          {req.status}
                        </span>
                      </TableCell>

                      {/* Submitted */}
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {req.status === "new" && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1 border-0"
                              style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)", fontFamily: "var(--font-heading)" }}
                              onClick={() => setApproveTarget(req)}
                            >
                              <CheckCircle className="h-3 w-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => rejectRequest.mutate(req.id)}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ApproveDialog
        request={approveTarget}
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
      />
      <PermissionsDialog
        user={permTarget}
        open={!!permTarget}
        onClose={() => setPermTarget(null)}
      />
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
      <RemoveUserDialog
        user={removeTarget}
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  )
}
