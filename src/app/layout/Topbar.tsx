import { Bell, LogOut, Moon, Search, Sun, User, UserPlus, Users } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/features/auth"
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
import { useNotifications } from "@/hooks/useNotifications"
import type { AppNotification } from "@/hooks/useNotifications"

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

// ─── Topbar ───────────────────────────────────────────────────────────────────
export function Topbar() {
  const { profile, user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

  const displayName = profile?.full_name ?? profile?.email ?? user?.email ?? "User"
  const initials = getInitials(profile?.full_name ?? profile?.email ?? "")

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
                <AvatarFallback
                  className="text-xs font-bold"
                  style={{
                    background: "var(--skyshare-gold)",
                    color: "hsl(0 0% 8%)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {initials}
                </AvatarFallback>
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
            <DropdownMenuItem disabled>
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
