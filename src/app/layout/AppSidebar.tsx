import { NavLink, useLocation, useNavigate } from "react-router-dom"
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
  Kanban,
  MessageSquare,
  Building,
  ShieldCheck,
  GraduationCap,
  Compass,
  Lock,
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
import type { AppSection } from "@/entities/supabase"

type SidebarItem = {
  name: string
  path: string
  icon: React.ElementType
  exact?: boolean
  section: AppSection
  superAdminOnly?: boolean
}

const sidebarSections: { title: string; adminOnly?: boolean; items: SidebarItem[] }[] = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard",    path: "/app",              icon: Home,          exact: true, section: "Dashboard"    },
      { name: "Aircraft Info", path: "/app/aircraft",    icon: Plane,                      section: "Aircraft Info" },
      { name: "AI Assistant",  path: "/app/ai-assistant", icon: MessageSquare,             section: "AI Assistant"  },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Aircraft Conformity",  path: "/app/conformity",    icon: CheckSquare,  section: "Aircraft Conformity"  },
      { name: "14-Day Check",         path: "/app/14-day-check",  icon: CalendarClock, section: "14-Day Check"        },
      { name: "Maintenance Planning", path: "/app/planning",      icon: ClipboardList, section: "Maintenance Planning" },
      { name: "Ten or More",          path: "/app/ten-or-more",   icon: ShieldCheck,   section: "Ten or More"         },
      { name: "Terminal-OGD",         path: "/app/terminal-ogd",  icon: Building,      section: "Terminal-OGD"        },
      { name: "Projects",             path: "/app/projects",      icon: Kanban,        section: "Projects"            },
      { name: "Docs & Links",         path: "/app/docs",          icon: FileText,      section: "Docs & Links"        },
      { name: "My Training",          path: "/app/training",      icon: GraduationCap, section: "Training"            },
      { name: "My Journey™",          path: "/app/journey",       icon: Compass,       section: "My Journey"          },
    ],
  },
  {
    title: "Administration",
    adminOnly: true,
    items: [
      { name: "Users",                  path: "/app/admin/users",       icon: Users,       section: "Dashboard" },
      { name: "Team Training & Journey", path: "/app/admin/training",    icon: GraduationCap, section: "Dashboard", superAdminOnly: true },
      { name: "Alerts & Notifications", path: "/app/admin/alerts",      icon: Bell,       section: "Dashboard" },
      { name: "Settings",               path: "/app/admin/settings",    icon: Settings,   section: "Dashboard" },
      { name: "Permissions Index",      path: "/app/admin/permissions", icon: ShieldCheck, section: "Dashboard", superAdminOnly: true },
    ],
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, permissions } = useAuth()
  const collapsed = state === "collapsed"

  const isAdmin = profile?.role === "Super Admin" || profile?.role === "Admin"
  const isSuperAdmin = profile?.role === "Super Admin"
  const visibleSections = sidebarSections.filter(s => !s.adminOnly || isAdmin)

  function hasAccess(section: AppSection) {
    if (isAdmin) return true
    return permissions.includes(section)
  }

  function handleLockedClick(itemName: string) {
    navigate(`/app/access-restricted?feature=${encodeURIComponent(itemName)}`)
  }

  return (
    <Sidebar
      className="border-r-0"
      style={{ background: "hsl(0 0% 9%)" }}
    >
      <SidebarContent className="gap-0">

        {/* Logo block */}
        <div
          className="flex flex-col items-center justify-center pt-6 pb-4 px-4 gap-2"
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
            <>
              <span
                className="text-[9px] font-semibold tracking-[0.3em] uppercase"
                style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}
              >
                Maintenance
              </span>
              {/* Gold rule under MAINTENANCE label */}
              <div
                className="w-8 mt-0.5"
                style={{ height: "1px", background: "var(--skyshare-gold)", opacity: 0.5 }}
              />
            </>
          )}
        </div>

        {/* Crimson→navy stripe */}
        <div className="stripe-divider" />

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-3">
          {visibleSections.map((section, idx) => (
            <SidebarGroup key={section.title} className={cn("px-2", idx > 0 && "mt-4")}>
              {!collapsed && (
                <p
                  className="px-3 mb-1.5"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--skyshare-gold)",
                    opacity: 0.55,
                  }}
                >
                  {section.title}
                </p>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {section.items.filter(item => !item.superAdminOnly || isSuperAdmin).map(item => {
                    const isActive = item.exact
                      ? location.pathname === item.path
                      : location.pathname.startsWith(item.path)
                    const accessible = hasAccess(item.section)

                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild tooltip={collapsed ? item.name : undefined}>
                          {accessible ? (
                            <NavLink
                              to={item.path}
                              end={Boolean(item.exact)}
                              className={cn(
                                "sidebar-nav-link flex items-center gap-3 rounded-sm text-sm transition-all duration-150",
                                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                                isActive
                                  ? "active text-white font-medium"
                                  : "text-white/45 hover:text-white/80 font-normal"
                              )}
                              style={isActive ? {
                                background: "linear-gradient(to right, rgba(212,160,23,0.15), transparent)",
                                fontFamily: "var(--font-heading)",
                                letterSpacing: "0.02em",
                              } : {}}
                            >
                              <item.icon
                                className={cn("flex-shrink-0", collapsed ? "w-[22px] h-[22px]" : "w-[17px] h-[17px]")}
                                style={isActive ? { color: "var(--skyshare-gold)" } : {}}
                              />
                              {!collapsed && <span className="truncate tracking-wide">{item.name}</span>}
                            </NavLink>
                          ) : (
                            <button
                              onClick={() => handleLockedClick(item.name)}
                              className={cn(
                                "sidebar-nav-link flex items-center gap-3 rounded-sm text-sm transition-all duration-150 w-full",
                                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                                "text-white/25 hover:text-white/40 font-normal cursor-pointer"
                              )}
                            >
                              <item.icon
                                className={cn("flex-shrink-0", collapsed ? "w-[22px] h-[22px]" : "w-[17px] h-[17px]")}
                              />
                              {!collapsed && (
                                <span className="truncate tracking-wide flex-1 text-left">{item.name}</span>
                              )}
                              {!collapsed && (
                                <Lock className="w-[11px] h-[11px] flex-shrink-0 opacity-40" />
                              )}
                            </button>
                          )}
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
