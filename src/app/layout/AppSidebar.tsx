import { NavLink, useLocation } from "react-router-dom"
import {
  Home,
  Plane,
  CheckSquare,
  CalendarClock,
  ClipboardList,
  Settings,
  Users,
  Bell,
  FileText,
  BookOpen,
  Kanban,
  MessageSquare,
  Building,
  ShieldCheck,
  GraduationCap,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/sidebar"
import { useAuth } from "@/features/auth"
import { cn } from "@/shared/lib/utils"
import logoAsset from "@/shared/assets/skyshare-logo.png"

const sidebarSections = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", path: "/app", icon: Home, exact: true },
      { name: "Aircraft Info", path: "/app/aircraft", icon: Plane },
      { name: "AI Assistant", path: "/app/ai-assistant", icon: MessageSquare },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Aircraft Conformity", path: "/app/conformity", icon: CheckSquare },
      { name: "14-Day Check", path: "/app/14-day-check", icon: CalendarClock },
      { name: "Maintenance Planning", path: "/app/planning", icon: ClipboardList },
      { name: "Ten or More", path: "/app/ten-or-more", icon: ShieldCheck },
      { name: "Terminal-OGD", path: "/app/terminal-ogd", icon: Building },
      { name: "Projects", path: "/app/projects", icon: Kanban },
      { name: "Training", path: "/app/training", icon: GraduationCap },
      { name: "Docs & Links", path: "/app/docs", icon: FileText },
    ],
  },
  {
    title: "Administration",
    adminOnly: true,
    items: [
      { name: "Users", path: "/app/admin/users", icon: Users },
      { name: "Alerts & Notifications", path: "/app/admin/alerts", icon: Bell },
      { name: "Settings", path: "/app/admin/settings", icon: Settings },
    ],
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const { profile } = useAuth()
  const collapsed = state === "collapsed"

  const isAdmin = profile?.role === "Super Admin" || profile?.role === "Admin"
  const visibleSections = sidebarSections.filter(s => !s.adminOnly || isAdmin)

  return (
    <Sidebar
      className="border-r-0"
      style={{ background: "hsl(0 0% 9%)" }}
    >
      <SidebarContent className="gap-0">

        {/* Logo block */}
        <div
          className="flex flex-col items-center justify-center py-6 px-4 gap-2"
          style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
        >
          <img
            src={logoAsset}
            alt="SkyShare"
            className={cn(
              "object-contain select-none brightness-0 invert opacity-85",
              collapsed ? "h-6 w-auto" : "h-10 w-auto"
            )}
            draggable={false}
          />
          {!collapsed && (
            <span
              className="text-[9px] font-semibold tracking-[0.3em] uppercase"
              style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
            >
              Maintenance
            </span>
          )}
        </div>

        {/* Stripe divider */}
        <div className="stripe-divider" />

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto py-3">
          {visibleSections.map((section, sectionIdx) => (
            <SidebarGroup key={section.title} className={cn("px-2", sectionIdx > 0 && "mt-4")}>

              {/* Section label */}
              {!collapsed && (
                <p
                  className="text-[9px] font-bold tracking-[0.25em] uppercase px-3 mb-1.5"
                  style={{
                    color: "var(--skyshare-gold)",
                    fontFamily: "var(--font-heading)",
                    opacity: 0.6,
                  }}
                >
                  {section.title}
                </p>
              )}

              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {section.items.map(item => {
                    const isActive = item.exact
                      ? location.pathname === item.path
                      : location.pathname.startsWith(item.path)

                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild tooltip={collapsed ? item.name : undefined}>
                          <NavLink
                            to={item.path}
                            end={Boolean(item.exact)}
                            className={cn(
                              "sidebar-link-active flex items-center gap-3 rounded-sm text-sm transition-all duration-150",
                              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                              isActive
                                ? "text-white bg-[rgba(212,160,23,0.1)] font-medium"
                                : "text-white/45 hover:text-white/80 hover:bg-white/[0.04] font-normal"
                            )}
                            style={isActive ? { fontFamily: "var(--font-heading)", letterSpacing: "0.02em" } : {}}
                          >
                            <item.icon
                              className={cn(
                                "flex-shrink-0",
                                collapsed ? "w-[22px] h-[22px]" : "w-[17px] h-[17px]",
                                isActive ? "text-[var(--skyshare-gold)]" : ""
                              )}
                            />
                            {!collapsed && (
                              <span className="truncate tracking-wide">{item.name}</span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter
        className="px-4 py-3"
        style={{ borderTop: "1px solid hsl(0 0% 14%)" }}
      >
        {!collapsed && (
          <p
            className="text-[9px] tracking-[0.2em] uppercase"
            style={{ color: "hsl(0 0% 28%)", fontFamily: "var(--font-heading)" }}
          >
            SkyShare MX · v1.0
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
