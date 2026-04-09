import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Users, UserPlus, CheckCircle, XCircle, Settings,
  Shield, Clock, AlertTriangle, Mail, Trash2, Send, RefreshCw, LogOut, Link2,
  ChevronUp, ChevronDown, ChevronsUpDown, Search,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { supabase } from "@/lib/supabase"
import { mxlms } from "@/lib/supabase-mxlms"
import { APP_ROLES, APP_SECTIONS, type Profile, type AppRole, type UserStatus, type AppSection } from "@/entities/supabase"
import type { MxlmsTechnician } from "@/entities/mxlms"
import { useAuth } from "@/features/auth"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { Switch } from "@/shared/ui/switch"
import { Label } from "@/shared/ui/label"
import { Textarea } from "@/shared/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip"

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
    "Guest":       "bg-white/8 text-white/40 border-white/10",
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


async function fetchUserPermissions(userId: string) {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("section")
    .eq("user_id", userId)
  if (error) throw error
  return (data ?? []).map(r => r.section as AppSection)
}

// ─── Permissions Dialog ───────────────────────────────────────────────────────

/**
 * PERMISSION_GROUPS — UI grouping for module access assignment
 *
 * SYNC REQUIREMENT: Keep these in sync with:
 * • sidebarSections in app/layout/AppSidebar.tsx
 * • APP_SECTIONS in entities/supabase.ts
 * • HARDCODED_RULES in pages/admin/PermissionsIndex.tsx
 *
 * When adding a new section, update all four places.
 */
const PERMISSION_GROUPS: { label: string; items: AppSection[] }[] = [
  {
    label: "Overview",
    items: ["Dashboard", "Aircraft Info", "AI Assistant"],
  },
  {
    label: "Operations",
    items: [
      "Discrepancy Intelligence",
      "Records Vault",
      "Work Orders",
      "My Journey",
      "My Team",
      "Training",
      "Vendor Map",
      "14-Day Check",
      "Projects",
      "Compliance",
      "Safety",
    ],
  },
  {
    label: "Island of Misfit Toys",
    items: [
      "External Requests",
    ],
  },
  {
    label: "Pending Cert.",
    items: [
      "Aircraft Conformity",
      "Maintenance Planning",
      "Ten or More",
      "Terminal-OGD",
      "Docs & Links",
    ],
  },
]

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

  const { data: permData, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: () => fetchUserPermissions(user!.id),
    enabled: open && !!user,
  })

  useEffect(() => {
    if (permData) { setGrants(permData); setLoaded(true) }
  }, [permData])

  useEffect(() => {
    if (!open) setLoaded(false)
  }, [open])

  const toggle = (section: AppSection) => {
    setGrants(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    )
  }

  const toggleGroup = (items: AppSection[]) => {
    const allOn = items.every(s => grants.includes(s))
    setGrants(prev =>
      allOn
        ? prev.filter(s => !items.includes(s))
        : [...new Set([...prev, ...items])]
    )
  }

  const save = async () => {
    if (!user) return
    setSaving(true)
    try {
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

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Gold stripe */}
        <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)", borderRadius: "8px 8px 0 0", marginTop: "-1px", marginLeft: "-25px", marginRight: "-25px", position: "relative", top: "-24px", marginBottom: "-20px" }} />

        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            Module Access
          </DialogTitle>
          <DialogDescription className="text-white/35" style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.08em" }}>
            {user?.full_name ?? user?.email}
            <span className="mx-2 opacity-30">·</span>
            {user?.role}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !loaded ? (
          <div className="py-10 text-center text-white/25 text-sm">Loading permissions…</div>
        ) : (
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            {PERMISSION_GROUPS.map(group => {
              const allOn = group.items.every(s => grants.includes(s))
              const someOn = group.items.some(s => grants.includes(s))
              return (
                <div key={group.label}>
                  {/* Group header with select-all toggle */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "var(--skyshare-gold)",
                        opacity: 0.7,
                      }}
                    >
                      {group.label}
                    </span>
                    <button
                      onClick={() => toggleGroup(group.items)}
                      className="text-[10px] transition-colors"
                      style={{
                        fontFamily: "var(--font-heading)",
                        letterSpacing: "0.1em",
                        color: allOn ? "rgba(255,255,255,0.3)" : someOn ? "var(--skyshare-gold)" : "rgba(255,255,255,0.25)",
                      }}
                    >
                      {allOn ? "DESELECT ALL" : "SELECT ALL"}
                    </button>
                  </div>

                  {/* Items */}
                  <div className="space-y-1.5">
                    {group.items.map(section => (
                      <div
                        key={section}
                        className="flex items-center justify-between gap-4 rounded px-3 py-2.5 transition-colors"
                        style={{
                          background: grants.includes(section)
                            ? "rgba(212,160,23,0.07)"
                            : "hsl(0 0% 11%)",
                          border: grants.includes(section)
                            ? "1px solid rgba(212,160,23,0.18)"
                            : "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <Label
                          htmlFor={`perm-${section}`}
                          className="cursor-pointer text-sm"
                          style={{
                            fontFamily: "var(--font-heading)",
                            letterSpacing: "0.04em",
                            color: grants.includes(section) ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
                            fontSize: "12px",
                          }}
                        >
                          {section}
                        </Label>
                        <Switch
                          id={`perm-${section}`}
                          checked={grants.includes(section)}
                          onCheckedChange={() => toggle(section)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={onClose} className="text-white/40 hover:text-white/60">
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || isLoading}
            style={{
              background: "var(--skyshare-gold)",
              color: "hsl(0 0% 8%)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.1em",
            }}
          >
            {saving ? "Saving…" : "Save Permissions"}
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
  const qc = useQueryClient()
  const [raw, setRaw] = useState("")
  const [role, setRole] = useState<AppRole>("Guest")
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) { setRaw(""); setRole("Guest") }
  }, [open])

  const emails = parseEmails(raw)
  const invalid = emails.filter(e => !e.endsWith(`@${ALLOWED_DOMAIN}`))
  const valid   = emails.filter(e => e.endsWith(`@${ALLOWED_DOMAIN}`))
  const canSend = valid.length > 0 && invalid.length === 0 && !sending

  const send = async () => {
    if (!canSend) return
    const { data: { session: freshSession } } = await supabase.auth.getSession()
    if (!freshSession?.access_token) return
    setSending(true)
    let failed = 0
    for (const email of valid) {
      try {
        const res = await fetch("/.netlify/functions/send-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${freshSession.access_token}`,
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
      qc.invalidateQueries({ queryKey: ["admin-users"] })
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
        <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)", borderRadius: "8px 8px 0 0", marginTop: "-1px", marginLeft: "-25px", marginRight: "-25px", position: "relative", top: "-24px", marginBottom: "-20px" }} />

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
    if (!user) return
    const { data: { session: freshSession } } = await supabase.auth.getSession()
    if (!freshSession?.access_token) return
    setRemoving(true)
    try {
      const res = await fetch(`/.netlify/functions/users-admin?id=${user.user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${freshSession.access_token}` },
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

// ─── MX-LMS Link / Unlink Dialog ─────────────────────────────────────────────
// No dropdown in the happy path — auto-matches by email, shows a confirm only.
// Falls back to a small picker only when there's no email match.
// Unlinking your OWN profile requires a two-step confirm.

async function fetchMxlmsTechnicians(): Promise<MxlmsTechnician[]> {
  const { data, error } = await mxlms
    .from("technicians")
    .select("id,name,tech_code,role,status,email")
    .eq("status", "active")
    .order("name")
  if (error) throw error
  return (data ?? []) as MxlmsTechnician[]
}

function MxlmsLinkDialog({
  user,
  isSelf,
  technicians,
  open,
  onClose,
}: {
  user: Profile | null
  isSelf: boolean
  technicians: MxlmsTechnician[]
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isLinked = user?.mxlms_technician_id != null
  const action   = isLinked ? "unlink" : "link"

  // Auto-match by email; null = no match found (fallback to picker)
  const autoMatch = !isLinked
    ? technicians.find(t => t.email?.toLowerCase() === user?.email?.toLowerCase()) ?? null
    : null

  const currentTech = isLinked
    ? technicians.find(t => t.id === user?.mxlms_technician_id) ?? null
    : null

  // Picker fallback state (used only when auto-match fails)
  const [pickedId, setPickedId] = useState<string>("__none__")
  const [step, setStep]         = useState<1 | 2>(1)   // step 2 = extra confirm for self-unlink
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (open) { setStep(1); setPickedId("__none__") }
  }, [open, user])

  const resolvedTech = action === "link"
    ? (autoMatch ?? technicians.find(t => String(t.id) === pickedId) ?? null)
    : currentTech

  const canConfirm = action === "unlink" || resolvedTech != null

  async function doSave() {
    if (!user) return
    setSaving(true)
    try {
      const newValue = action === "link" ? resolvedTech!.id : null
      const { error } = await supabase
        .from("profiles")
        .update({ mxlms_technician_id: newValue })
        .eq("id", user.id)
      if (error) throw error
      toast.success(action === "link" ? `Linked to MX-LMS` : "MX-LMS link removed")
      qc.invalidateQueries({ queryKey: ["admin-users"] })
      onClose()
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  function handleConfirm() {
    if (action === "unlink" && isSelf && step === 1) {
      setStep(2)
      return
    }
    doSave()
  }

  if (!user) return null

  const displayName = user.full_name ?? user.email

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-sm"
        style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)", borderRadius: "8px 8px 0 0", marginTop: "-1px", marginLeft: "-25px", marginRight: "-25px", position: "relative", top: "-24px", marginBottom: "-20px" }} />

        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            {action === "link" ? "Enable MX-LMS Access" : step === 2 ? "Are You Sure?" : "Remove MX-LMS Access"}
          </DialogTitle>
          <DialogDescription className="text-white/35" style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.08em" }}>
            {displayName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">

          {/* ── LINK flow ── */}
          {action === "link" && (
            <>
              {autoMatch ? (
                // Happy path: show the match, just confirm
                <div className="rounded-lg px-4 py-3.5 space-y-1"
                  style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.2)" }}>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--skyshare-gold)] opacity-60" style={{ fontFamily: "var(--font-heading)" }}>
                    Matched by email
                  </p>
                  <p className="text-base font-semibold text-white/90">{autoMatch.name}</p>
                  <p className="text-[11px] text-white/35" style={{ fontFamily: "var(--font-heading)" }}>
                    {autoMatch.tech_code && `[${autoMatch.tech_code}]`}
                    {autoMatch.role && ` · ${autoMatch.role}`}
                  </p>
                </div>
              ) : (
                // No email match — data fix needed in MX-LMS
                <div className="rounded px-4 py-3.5 space-y-1.5"
                  style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)" }}>
                  <p className="text-[10px] uppercase tracking-wider text-amber-400 opacity-70" style={{ fontFamily: "var(--font-heading)" }}>
                    No match found
                  </p>
                  <p className="text-sm text-white/70">
                    No MX-LMS technician matched <strong className="text-white/85">{user?.email}</strong>.
                  </p>
                  <p className="text-xs text-white/35 leading-relaxed mt-1" style={{ fontFamily: "var(--font-heading)" }}>
                    Update the technician&apos;s email in MX-LMS to match, then try again.
                  </p>
                </div>
              )}
              {autoMatch && (
                <p className="text-xs text-white/30 leading-relaxed" style={{ fontFamily: "var(--font-heading)" }}>
                  This enables My Training and My Journey for {displayName}.
                </p>
              )}
            </>
          )}

          {/* ── UNLINK flow — step 1 ── */}
          {action === "unlink" && step === 1 && (
            <>
              {currentTech && (
                <div className="rounded-lg px-4 py-3 space-y-0.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-sm text-white/60">Currently linked to</p>
                  <p className="text-base font-semibold text-white/85">{currentTech.name}</p>
                </div>
              )}
              {isSelf && (
                <div className="rounded px-3 py-2.5 text-xs text-red-400"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  You are modifying <strong>your own profile</strong>. Removing this link will disable
                  your My Training and My Journey tabs.
                </div>
              )}
              <p className="text-xs text-white/30 leading-relaxed" style={{ fontFamily: "var(--font-heading)" }}>
                My Training and My Journey will show a "not connected" state until re-linked.
              </p>
            </>
          )}

          {/* ── UNLINK flow — step 2 (self only) ── */}
          {action === "unlink" && step === 2 && (
            <div className="space-y-3">
              <div className="rounded px-4 py-3.5 text-sm text-red-300 leading-relaxed"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <strong className="block mb-1">Final confirmation</strong>
                This will remove your own MX-LMS connection. You will lose access to
                My Training and My Journey until an admin re-links your profile.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}
            className="text-white/40 hover:text-white/60">
            {action === "link" && !autoMatch ? "Close" : "Cancel"}
          </Button>
          {(action === "unlink" || autoMatch) && (
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              style={{
                background: action === "unlink"
                  ? (step === 2 ? "rgba(239,68,68,0.8)" : "rgba(239,68,68,0.15)")
                  : "var(--skyshare-gold)",
                color: action === "unlink"
                  ? (step === 2 ? "#fff" : "#f87171")
                  : "hsl(0 0% 8%)",
                border: action === "unlink" ? `1px solid rgba(239,68,68,${step === 2 ? 0.5 : 0.3})` : "none",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.1em",
              }}
            >
              {saving ? "Saving…" : action === "link"
                ? "Enable Access"
                : step === 1 && isSelf
                  ? "Remove My Link →"
                  : "Yes, Remove Link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { profile: me } = useAuth()
  const qc = useQueryClient()

  const [permTarget, setPermTarget]   = useState<Profile | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null)
  const [linkTarget, setLinkTarget]   = useState<Profile | null>(null)
  const [inviteOpen, setInviteOpen]     = useState(false)
  const [lastSeenSort, setLastSeenSort] = useState<"asc" | "desc" | null>(null)
  const [pendingSearch, setPendingSearch] = useState("")
  const [userSearch, setUserSearch]       = useState("")

  const isAdmin = me?.role === "Super Admin" || me?.role === "Admin"

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchProfiles,
    enabled: isAdmin,
  })

  const { data: mxlmsTechs = [] } = useQuery({
    queryKey: ["mxlms-technicians"],
    queryFn: fetchMxlmsTechnicians,
    enabled: isAdmin,
    staleTime: 60_000,
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
    mutationFn: async ({ userId, status, userEmail, userName }: {
      userId: string; status: UserStatus; userEmail: string; userName: string
    }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", userId)
      if (error) throw error
      // Fire-and-forget status notification email — don't block on failure
      if (["Active", "Inactive", "Suspended"].includes(status)) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return
          fetch("/.netlify/functions/send-status-notification", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              userEmail,
              userName,
              newStatus: status,
              siteUrl: window.location.origin,
            }),
          }).catch(() => { /* silent */ })
        })
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`User ${vars.status.toLowerCase()}`)
      qc.invalidateQueries({ queryKey: ["admin-users"] })
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update status"),
  })

  const isSuperAdmin = me?.role === "Super Admin"

  const forceSignOut = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")
      const res = await fetch("/.netlify/functions/force-signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error ?? "Failed to sign out user")
      }
    },
    onSuccess: () => toast.success("User has been signed out"),
    onError: (e: any) => toast.error(e.message ?? "Failed to sign out user"),
  })

  const pendingInvites = profiles.filter(p => p.status === "Pending")
  const filteredPending = pendingSearch.trim()
    ? pendingInvites
        .map(p => {
          const q = pendingSearch.toLowerCase()
          const nameScore  = (p.full_name ?? "").toLowerCase().includes(q) ? 2 : 0
          const emailScore = p.email.toLowerCase().includes(q) ? 1 : 0
          return { p, score: nameScore + emailScore }
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ p }) => p)
    : pendingInvites

  const sortedProfiles = lastSeenSort === null ? profiles : [...profiles].sort((a, b) => {
    const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
    const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0
    return lastSeenSort === "desc" ? tb - ta : ta - tb
  })

  const filteredProfiles = userSearch.trim()
    ? sortedProfiles.filter(p => {
        const q = userSearch.toLowerCase()
        return (p.full_name ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
      })
    : sortedProfiles

  async function resendInvite(user: Profile) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const res = await fetch("/.netlify/functions/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          email: user.email,
          role: user.role,
          invitedByName: me?.full_name ?? me?.email ?? "A SkyShare admin",
          siteUrl: window.location.origin,
        }),
      })
      if (res.ok) toast.success(`Invite resent to ${user.email}`)
      else toast.error("Failed to resend invite")
    } catch {
      toast.error("Failed to resend invite")
    }
  }

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
  const statCards = [
    { label: "Total Members",   value: profiles.length,       accent: "var(--skyshare-gold)",     iconBg: "rgba(212,160,23,0.15)",  icon: Users       },
    { label: "Active",          value: active,                accent: "var(--skyshare-success)",  iconBg: "rgba(16,185,129,0.15)",  icon: CheckCircle },
    { label: "Suspended",       value: suspended,             accent: "hsl(0 72% 51%)",           iconBg: "rgba(220,38,38,0.15)",   icon: AlertTriangle },
    { label: "Pending Invites", value: pendingInvites.length, accent: "var(--skyshare-blue-mid)", iconBg: "rgba(70,100,129,0.2)",   icon: Send        },
  ]

  return (
    <TooltipProvider delayDuration={400}>
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
              Pending Invites
              {pendingInvites.length > 0 && (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--skyshare-gold)", color: "hsl(0 0% 8%)" }}>
                  {pendingInvites.length}
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
            {/* Search */}
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }} />
                <input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full h-10 pl-10 pr-10 rounded-lg text-sm text-white focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: userSearch ? "1px solid var(--skyshare-gold)" : "1px solid rgba(255,255,255,0.15)",
                    boxShadow: userSearch ? "0 0 0 2px rgba(212,160,23,0.1)" : "none",
                  }}
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {loadingProfiles ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                {userSearch ? `No users matching "${userSearch}"` : "No users found"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.07] hover:bg-transparent">
                    {["User", "Role", "Status", "Last Seen", "MX-LMS", ""].map(h => (
                      <TableHead key={h} className="text-white/40" style={{ fontFamily: "var(--font-heading)", fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                        {h === "Last Seen" ? (
                          <button
                            onClick={() => setLastSeenSort(s => s === "desc" ? "asc" : "desc")}
                            className="flex items-center gap-1 hover:text-white/70 transition-colors"
                          >
                            Last Seen
                            {lastSeenSort === "desc" ? <ChevronDown className="h-3 w-3" /> : lastSeenSort === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3 opacity-50" />}
                          </button>
                        ) : h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map(user => (
                    <TableRow key={user.id} className="border-white/[0.05] hover:bg-white/[0.03]">

                      {/* User */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-[34px] w-[34px]">
                            <AvatarImage src={user.avatar_url ?? undefined} className="object-cover" />
                            <AvatarFallback className="text-xs font-bold" style={{ background: user.avatar_color ?? "var(--skyshare-gold)", color: "hsl(0 0% 8%)", fontFamily: "var(--font-heading)" }}>
                              {getInitials(user.display_name ?? user.full_name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-foreground">{user.display_name ?? user.full_name ?? "—"}</p>
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

                      {/* Last Seen */}
                      <TableCell className="text-xs text-muted-foreground">
                        {user.last_seen_at
                          ? formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true })
                          : "Never"}
                      </TableCell>

                      {/* MX-LMS linked indicator */}
                      <TableCell>
                        {user.mxlms_technician_id ? (
                          <button
                            onClick={() => setLinkTarget(user)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wider uppercase transition-colors hover:border-[rgba(212,160,23,0.4)]"
                            style={{
                              fontFamily: "var(--font-heading)",
                              background: "rgba(212,160,23,0.08)",
                              border: "1px solid rgba(212,160,23,0.2)",
                              color: "var(--skyshare-gold)",
                            }}
                            title="Edit MX-LMS link"
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            Linked
                          </button>
                        ) : (
                          <button
                            onClick={() => setLinkTarget(user)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border tracking-wider uppercase transition-colors hover:border-white/20 hover:text-white/50"
                            style={{
                              fontFamily: "var(--font-heading)",
                              background: "transparent",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "rgba(255,255,255,0.2)",
                            }}
                            title="Link to MX-LMS"
                          >
                            —
                          </button>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {user.id !== me?.id && user.role !== "Super Admin" && (
                          <div className="flex items-center gap-0.5">
                            {/* Permissions button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-white/30 hover:text-blue-400 hover:bg-blue-500/10"
                                  onClick={() => setPermTarget(user)}
                                >
                                  <Shield className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Manage Permissions</TooltipContent>
                            </Tooltip>

                            {/* Settings cogwheel */}
                            <DropdownMenu>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white/70">
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>User Settings</TooltipContent>
                              </Tooltip>
                              <DropdownMenuContent align="end" className="bg-[hsl(0_0%_14%)] border-white/10 text-white/80">
                                {user.status === "Pending" && (
                                  <DropdownMenuItem
                                    className="focus:bg-white/10 cursor-pointer gap-2 text-[var(--skyshare-gold)]"
                                    onClick={() => resendInvite(user)}
                                  >
                                    <Send className="h-3.5 w-3.5" /> Re-send Invite
                                  </DropdownMenuItem>
                                )}
                                {user.status === "Pending" && <DropdownMenuSeparator className="bg-white/10" />}
                                {user.status !== "Active" && (
                                  <DropdownMenuItem
                                    className="focus:bg-white/10 cursor-pointer text-emerald-400"
                                    onClick={() => updateStatus.mutate({ userId: user.id, status: "Active", userEmail: user.email, userName: user.first_name ?? user.full_name ?? "" })}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 mr-2" /> Activate
                                  </DropdownMenuItem>
                                )}
                                {user.status === "Active" && (
                                  <DropdownMenuItem
                                    className="focus:bg-white/10 cursor-pointer text-amber-400"
                                    onClick={() => updateStatus.mutate({ userId: user.id, status: "Suspended", userEmail: user.email, userName: user.first_name ?? user.full_name ?? "" })}
                                  >
                                    <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Suspend
                                  </DropdownMenuItem>
                                )}
                                {user.status !== "Inactive" && (
                                  <DropdownMenuItem
                                    className="focus:bg-white/10 cursor-pointer text-red-400"
                                    onClick={() => updateStatus.mutate({ userId: user.id, status: "Inactive", userEmail: user.email, userName: user.first_name ?? user.full_name ?? "" })}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-2" /> Deactivate
                                  </DropdownMenuItem>
                                )}
                                {isSuperAdmin && (
                                  <DropdownMenuItem
                                    className="focus:bg-amber-500/10 cursor-pointer text-amber-400 gap-2"
                                    onClick={() => forceSignOut.mutate(user.user_id)}
                                  >
                                    <LogOut className="h-3.5 w-3.5" /> Force Sign Out
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

        {/* Pending Invites Tab */}
        <TabsContent value="requests">
          <Card className="card-elevated border-0">
            {/* Search */}
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }} />
                <input
                  value={pendingSearch}
                  onChange={e => setPendingSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full h-10 pl-10 pr-4 rounded-lg text-sm text-white focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: pendingSearch ? "1px solid var(--skyshare-gold)" : "1px solid rgba(255,255,255,0.15)",
                    boxShadow: pendingSearch ? "0 0 0 2px rgba(212,160,23,0.1)" : "none",
                  }}
                />
                {pendingSearch && (
                  <button
                    onClick={() => setPendingSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {loadingProfiles ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
            ) : pendingInvites.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">No pending invites</div>
            ) : filteredPending.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">No matches for "{pendingSearch}"</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.07] hover:bg-transparent">
                    {["Invited User", "Role", "Invited", ""].map(h => (
                      <TableHead key={h} className="text-white/40" style={{ fontFamily: "var(--font-heading)", fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPending.map(user => (
                    <TableRow key={user.id} className="border-white/[0.05] hover:bg-white/[0.03]">

                      {/* User */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-[34px] w-[34px]">
                            <AvatarFallback className="text-xs font-bold" style={{ background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
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
                      <TableCell><RoleBadge role={user.role} /></TableCell>

                      {/* Invited date */}
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1.5 text-[var(--skyshare-gold)] hover:bg-[rgba(212,160,23,0.1)]"
                            style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}
                            onClick={() => resendInvite(user)}
                          >
                            <Send className="h-3 w-3" /> Resend
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => setRemoveTarget(user)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Remove
                          </Button>
                        </div>
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
      <PermissionsDialog
        user={permTarget}
        open={!!permTarget}
        onClose={() => setPermTarget(null)}
      />
      <MxlmsLinkDialog
        user={linkTarget}
        isSelf={linkTarget?.id === me?.id}
        technicians={mxlmsTechs}
        open={!!linkTarget}
        onClose={() => setLinkTarget(null)}
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
    </TooltipProvider>
  )
}
