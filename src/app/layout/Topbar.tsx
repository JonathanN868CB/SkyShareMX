import { useRef, useState, useEffect } from "react"
import { AlertTriangle, Award, Bell, Camera, Check, LogOut, Moon, Search, Settings, Sun, Trash2, User, UserPlus, Users } from "lucide-react"
import { getMechanicCerts, upsertMechanicCert } from "@/features/beet-box/services/mechanics"
import type { MechanicCert } from "@/features/beet-box/types"
import { SuggestionWidget } from "@/features/site-suggestions"
import { useNavigate } from "react-router-dom"
import { useTheme } from "next-themes"
import { useAuth } from "@/features/auth"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback } from "@/shared/ui/avatar"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog"
import { useNotifications } from "@/hooks/useNotifications"
import type { AppNotification } from "@/hooks/useNotifications"
import type { AppSection } from "@/entities/supabase"

// ─── Constants ───────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { name: "Gold",      value: "#d4a017" },
  { name: "Navy",      value: "#012e45" },
  { name: "Crimson",   value: "#c10230" },
  { name: "Slate",     value: "#64748b" },
  { name: "Emerald",   value: "#059669" },
  { name: "Violet",    value: "#7c3aed" },
  { name: "Sky",       value: "#0ea5e9" },
  { name: "Amber",     value: "#d97706" },
  { name: "Rose",      value: "#e11d48" },
  { name: "Teal",      value: "#0d9488" },
]

const ALL_SECTIONS: AppSection[] = [
  "Dashboard", "Aircraft Info", "AI Assistant", "Aircraft Conformity",
  "14-Day Check", "Maintenance Planning", "Ten or More", "Terminal-OGD",
  "Projects", "Training", "Docs & Links", "My Journey", "Vendor Map",
  "Compliance", "Safety", "Discrepancy Intelligence", "Parts",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return "just now"
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function NotifIcon({ type }: { type: string }) {
  const style: React.CSSProperties = {
    width: 28, height: 28, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  }
  if (type === "new_user") {
    return (
      <div style={{ ...style, background: "rgba(212,160,23,0.15)", color: "var(--skyshare-gold)" }}>
        <UserPlus size={13} />
      </div>
    )
  }
  return (
    <div style={{ ...style, background: "rgba(255,255,255,0.06)", color: "hsl(var(--muted-foreground))" }}>
      <Bell size={13} />
    </div>
  )
}

function NotificationRow({
  notif,
  onRead,
}: {
  notif: AppNotification
  onRead: (id: string) => void
}) {
  return (
    <button
      onClick={() => { if (!notif.read) onRead(notif.id) }}
      className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: notif.read ? "default" : "pointer" }}
    >
      <NotifIcon type={notif.type} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: notif.read ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))" }}
          >
            {notif.title}
          </span>
          {!notif.read && (
            <span
              className="shrink-0 w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--skyshare-gold)" }}
            />
          )}
        </div>
        <p
          className="text-xs mt-0.5 leading-snug"
          style={{ color: "hsl(var(--muted-foreground))", opacity: notif.read ? 0.55 : 0.85 }}
        >
          {notif.message}
        </p>
        <span className="text-[10px] mt-1 block" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
          {timeAgo(notif.created_at)}
        </span>
      </div>
    </button>
  )
}

// ─── Profile Settings Dialog ─────────────────────────────────────────────────
function ProfileSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { profile, user, permissions, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "")
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color ?? "#d4a017")
  const [avatarInitials, setAvatarInitials] = useState(profile?.avatar_initials ?? "")
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(profile?.avatar_url ?? "")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Mechanic cert state ────────────────────────────────────────────────────
  const [existingCert, setExistingCert]   = useState<MechanicCert | null>(null)
  const [certType, setCertType]           = useState<MechanicCert["certType"]>("A&P")
  const [certNumber, setCertNumber]       = useState("")
  const [certSaving, setCertSaving]       = useState(false)
  const [certSaved, setCertSaved]         = useState(false)

  const certChanged = certType !== (existingCert?.certType ?? "A&P") || certNumber !== (existingCert?.certNumber ?? "")

  async function loadCert(profileId: string) {
    const certs = await getMechanicCerts(profileId)
    const primary = certs.find(c => c.isPrimary) ?? certs[0] ?? null
    setExistingCert(primary)
    setCertType(primary?.certType ?? "A&P")
    setCertNumber(primary?.certNumber ?? "")
  }

  async function handleSaveCert() {
    if (!profile || !certNumber.trim()) return
    setCertSaving(true)
    await upsertMechanicCert({
      id: existingCert?.id,
      profileId: profile.id,
      certType,
      certNumber: certNumber.trim(),
      issuedDate: existingCert?.issuedDate ?? null,
      isPrimary: true,
      notes: existingCert?.notes ?? null,
    })
    await loadCert(profile.id)
    setCertSaving(false)
    setCertSaved(true)
    setTimeout(() => setCertSaved(false), 2000)
  }

  // Reset local state when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v && profile) {
      setDisplayName(profile.display_name ?? "")
      setAvatarColor(profile.avatar_color ?? "#d4a017")
      setAvatarInitials(profile.avatar_initials ?? "")
      setAvatarPreviewUrl(profile.avatar_url ?? "")
      setSaved(false)
      loadCert(profile.id)
    }
    onOpenChange(v)
  }

  const initials = avatarInitials || getInitials(displayName || profile?.full_name || profile?.email || "")

  const hasChanges =
    (displayName || "") !== (profile?.display_name ?? "") ||
    (avatarColor || "#d4a017") !== (profile?.avatar_color ?? "#d4a017") ||
    (avatarInitials || "") !== (profile?.avatar_initials ?? "") ||
    (avatarPreviewUrl || "") !== (profile?.avatar_url ?? "")

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file
    if (!file.type.startsWith("image/")) return
    if (file.size > 2 * 1024 * 1024) return // 2MB max

    setUploading(true)
    const ext = file.name.split(".").pop() || "jpg"
    const path = `${user.id}/avatar.${ext}`

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true })

    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
      // Add cache-bust so the browser picks up the new image
      setAvatarPreviewUrl(`${urlData.publicUrl}?t=${Date.now()}`)
    }
    setUploading(false)
    // Clear input so re-uploading the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleRemoveAvatar() {
    setAvatarPreviewUrl("")
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_color: avatarColor,
        avatar_initials: avatarInitials.trim().toUpperCase().slice(0, 3) || null,
        avatar_url: avatarPreviewUrl || null,
      })
      .eq("id", profile.id)
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" style={{ background: "hsl(0 0% 9%)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <Settings size={16} style={{ color: "var(--skyshare-gold)" }} />
            Profile Settings
          </DialogTitle>
          <DialogDescription className="text-xs">
            Customize how you appear in the portal. Your identity and access are managed by your administrator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">

          {/* ── Avatar preview + upload ── */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                {avatarPreviewUrl ? (
                  <img
                    src={avatarPreviewUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover rounded-full"
                  />
                ) : (
                  <AvatarFallback
                    className="text-lg font-bold"
                    style={{
                      background: avatarColor,
                      color: "#111",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              {/* Edit overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.6)" }}
                title="Upload photo"
              >
                <Camera size={18} style={{ color: "#fff" }} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{displayName || profile?.full_name || "—"}</p>
              <p className="text-[10px] tracking-wider uppercase mt-0.5" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
                {profile?.role}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-white/10"
                  style={{ color: "var(--skyshare-gold)", border: "1px solid rgba(212,160,23,0.3)" }}
                >
                  {uploading ? "Uploading..." : "Upload Photo"}
                </button>
                {avatarPreviewUrl && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="text-[10px] px-2 py-1 rounded transition-colors hover:bg-white/10 flex items-center gap-1"
                    style={{ color: "hsl(var(--muted-foreground))", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <Trash2 size={10} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Display Name ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
              Display Name
            </label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={profile?.full_name ?? "Enter a display name"}
              className="h-9 text-sm bg-white/5 border-white/10"
            />
            <p className="text-[10px] mt-1.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
              This is cosmetic only. Your account identity remains {profile?.full_name} ({profile?.email}).
            </p>
          </div>

          {/* ── Custom Initials ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
              Custom Initials
            </label>
            <Input
              value={avatarInitials}
              onChange={e => setAvatarInitials(e.target.value.toUpperCase().slice(0, 3))}
              placeholder={getInitials(profile?.full_name || profile?.email || "")}
              maxLength={3}
              className="h-9 text-sm bg-white/5 border-white/10 w-24 uppercase tracking-widest text-center font-bold"
            />
            <p className="text-[10px] mt-1.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
              Up to 3 characters. Shown when no profile photo is set.
            </p>
          </div>

          {/* ── Avatar Color ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
              Avatar Color
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setAvatarColor(c.value)}
                  title={c.name}
                  className="relative w-8 h-8 rounded-full transition-all hover:scale-110 focus:outline-none"
                  style={{
                    background: c.value,
                    boxShadow: avatarColor === c.value ? `0 0 0 2px hsl(0 0% 9%), 0 0 0 4px ${c.value}` : "none",
                  }}
                >
                  {avatarColor === c.value && (
                    <Check size={14} className="absolute inset-0 m-auto" style={{ color: "#111" }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Mechanic Certificate ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 block" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
              <Award size={11} style={{ color: "var(--skyshare-gold)" }} />
              Mechanic Certificate
            </label>
            <div className="rounded-md p-3 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Cert type */}
              <div>
                <p className="text-[10px] mb-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>Certificate Type</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(["A&P", "IA", "A&P/IA", "Avionics", "Other"] as MechanicCert["certType"][]).map(t => (
                    <button
                      key={t}
                      onClick={() => setCertType(t)}
                      className="px-3 py-1 rounded text-xs font-semibold transition-all"
                      style={{
                        background: certType === t ? "var(--skyshare-gold)" : "rgba(255,255,255,0.05)",
                        color: certType === t ? "#111" : "rgba(255,255,255,0.5)",
                        border: certType === t ? "1px solid transparent" : "1px solid rgba(255,255,255,0.08)",
                        fontFamily: "var(--font-heading)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* Cert number */}
              <div>
                <p className="text-[10px] mb-1" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.6 }}>Certificate Number</p>
                <div className="flex gap-2 items-center">
                  <Input
                    value={certNumber}
                    onChange={e => setCertNumber(e.target.value)}
                    placeholder="e.g. 3444980"
                    className="h-9 text-sm bg-white/5 border-white/10 font-mono flex-1"
                  />
                  <Button
                    onClick={handleSaveCert}
                    disabled={!certChanged || certSaving || !certNumber.trim()}
                    className="h-9 px-4 text-xs font-bold uppercase tracking-wider shrink-0"
                    style={{
                      background: certChanged && certNumber.trim() ? "var(--skyshare-gold)" : "rgba(255,255,255,0.06)",
                      color: certChanged && certNumber.trim() ? "#111" : "hsl(var(--muted-foreground))",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {certSaved ? <Check size={14} /> : certSaving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
              {/* Preview */}
              {existingCert && (
                <p className="text-[10px]" style={{ color: "rgba(52,211,153,0.7)" }}>
                  ✓ Certificate on file: {existingCert.certType} {existingCert.certNumber}
                  {" — "}will appear on logbook entries you sign
                </p>
              )}
              {!existingCert && (
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                  No certificate on file yet. This populates the signature block on logbook entries.
                </p>
              )}
            </div>
          </div>

          {/* ── Account Info (read-only) ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
              Account
            </label>
            <div className="space-y-1.5 rounded-md p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-between text-xs">
                <span style={{ color: "hsl(var(--muted-foreground))" }}>Full Name</span>
                <span className="font-medium">{profile?.full_name ?? "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "hsl(var(--muted-foreground))" }}>Email</span>
                <span className="font-medium">{profile?.email ?? "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "hsl(var(--muted-foreground))" }}>Role</span>
                <span className="font-medium" style={{ color: "var(--skyshare-gold)" }}>{profile?.role ?? "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "hsl(var(--muted-foreground))" }}>Status</span>
                <span className="font-medium">{profile?.status ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* ── Module Access ── */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)" }}>
              Module Access
            </label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {ALL_SECTIONS.map(section => {
                const hasAccess = permissions.includes(section)
                return (
                  <div key={section} className="flex items-center gap-1.5 text-[11px] py-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: hasAccess ? "#059669" : "rgba(255,255,255,0.12)" }}
                    />
                    <span style={{ color: hasAccess ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))", opacity: hasAccess ? 1 : 0.4 }}>
                      {section}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>
              Module access is managed by your administrator.
            </p>
          </div>

          {/* ── Save ── */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="h-8 px-5 text-xs font-bold uppercase tracking-wider"
              style={{
                background: hasChanges ? "var(--skyshare-gold)" : "rgba(255,255,255,0.06)",
                color: hasChanges ? "#111" : "hsl(var(--muted-foreground))",
                fontFamily: "var(--font-heading)",
              }}
            >
              {saved ? "Saved" : saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
export function Topbar() {
  const { profile, user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [profileOpen, setProfileOpen] = useState(false)
  const [aogCount, setAogCount] = useState(0)
  const navigate = useNavigate()

  // Poll for active AOG parts requests
  useEffect(() => {
    async function checkAog() {
      const { count } = await supabase
        .from("parts_requests")
        .select("id", { count: "exact", head: true })
        .eq("aog", true)
        .not("status", "in", '("received","closed")')
      setAogCount(count ?? 0)
    }
    checkAog()
    const interval = setInterval(checkAog, 60_000) // refresh every minute
    return () => clearInterval(interval)
  }, [])

  const displayName = profile?.display_name ?? profile?.full_name ?? profile?.email ?? user?.email ?? "User"
  const initials = profile?.avatar_initials || getInitials(displayName)
  const avatarColor = profile?.avatar_color ?? "#d4a017"
  const avatarUrl = profile?.avatar_url

  return (
    <div className="flex items-center gap-4 flex-1">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search aircraft, checks, docs..."
          className="search-underline pl-9 text-sm focus-visible:ring-0"
        />
      </div>

      <div className="flex items-center gap-1 ml-auto">

        {/* AOG indicator */}
        {aogCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5 hover:bg-accent"
            onClick={() => navigate("/app/parts")}
            title={`${aogCount} active AOG request${aogCount > 1 ? "s" : ""}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: "rgba(255,80,80,0.9)" }} />
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "rgba(255,100,100,0.9)" }}
            >
              AOG {aogCount > 1 ? `(${aogCount})` : ""}
            </span>
          </Button>
        )}

        {/* Notifications bell */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent relative"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full text-[9px] font-bold leading-none"
                  style={{
                    minWidth: 14, height: 14, padding: "0 3px",
                    background: "#c10230",
                    color: "#fff",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            sideOffset={8}
            className="p-0 w-80 border-white/10"
            style={{ background: "hsl(0 0% 11%)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))" }}
                >
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(193,2,48,0.2)", color: "#e05070", fontFamily: "var(--font-heading)" }}
                  >
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] transition-colors"
                  style={{ color: "var(--skyshare-gold)", letterSpacing: "0.04em" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Bell size={18} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.3 }} />
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
                    No notifications yet
                  </span>
                </div>
              ) : (
                notifications.map(n => (
                  <NotificationRow key={n.id} notif={n} onRead={markRead} />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div
                className="px-4 py-2.5 flex items-center justify-center"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <a
                  href="/app/admin/users"
                  className="text-[10px] flex items-center gap-1.5 transition-opacity hover:opacity-70"
                  style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.06em", textDecoration: "none" }}
                >
                  <Users size={11} /> Open User Management
                </a>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Suggestion widget */}
        <SuggestionWidget variant="topbar" />

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-accent transition-colors outline-none">
              <Avatar className="h-7 w-7">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback
                    className="text-xs font-bold"
                    style={{
                      background: avatarColor,
                      color: "hsl(0 0% 8%)",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-xs font-medium text-foreground max-w-[140px] truncate">
                  {displayName}
                </span>
                {profile?.role && (
                  <span
                    className="text-[10px] tracking-wider uppercase mt-0.5"
                    style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", opacity: 0.8 }}
                  >
                    {profile.role}
                  </span>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{displayName}</p>
              {profile?.role && (
                <p
                  className="text-[10px] tracking-wider uppercase mt-0.5"
                  style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
                >
                  {profile.role}
                </p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => setProfileOpen(true)}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile settings dialog */}
        <ProfileSettingsDialog open={profileOpen} onOpenChange={setProfileOpen} />

      </div>
    </div>
  )
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return "?"
}
