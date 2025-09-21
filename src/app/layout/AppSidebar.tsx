import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import logoAsset from "@/shared/assets/skyshare-logo.png";
import { isDevBypassActive } from "@/shared/lib/env";
import {
  Home,
  Plane,
  CheckSquare,
  Calendar,
  ClipboardList,
  Settings,
  Users,
  Bell,
  Palette,
  FileText,
  Wrench,
  BookOpen,
  FolderOpen,
  MessageSquare,
  Building,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/sidebar";

const sidebarSections = [
  {
    title: "Overview",
    permission: "Overview" as const,
    items: [
      { name: "Dashboard", path: "/app", icon: Home, exact: true },
      { name: "Aircraft Info", path: "/app/under-construction", icon: Plane },
      { name: "AI Assistant", path: "/app/ai-assistant", icon: MessageSquare },
    ],
  },
  {
    title: "Operations",
    permission: "Operations" as const,
    items: [
      { name: "Aircraft Conformity", path: "/app/under-construction", icon: CheckSquare },
      { name: "14-Day Check", path: "/app/under-construction", icon: Calendar },
      { name: "Maintenance Planning", path: "/app/under-construction", icon: ClipboardList },
      { name: "Ten or More", path: "/app/under-construction", icon: Wrench },
      { name: "Terminal-OGD", path: "/app/terminal-ogd", icon: Building },
      { name: "Maintenance Control", path: "/app/under-construction", icon: Settings },
      { name: "Projects", path: "/app/under-construction", icon: FolderOpen },
      { name: "Training", path: "/app/under-construction", icon: BookOpen },
      { name: "Docs and Links", path: "/app/under-construction", icon: FileText },
    ],
  },
  {
    title: "Administration",
    permission: "Administration" as const,
    items: [
      { name: "Alerts & Notifications", path: "/app/under-construction", icon: Bell },
      { name: "Users", path: "/app/admin/users", icon: Users },
      { name: "Settings", path: "/app/under-construction", icon: Settings },
    ],
  },
  {
    title: "Development",
    permission: "Development" as const,
    items: [
      { name: "Style Guide", path: "/app/under-construction", icon: Palette },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { hasPermission, loading } = useUserPermissions();
  const devBypassActive = isDevBypassActive();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!devBypassActive && localStorage.getItem("dev-bypass")) {
      localStorage.removeItem("dev-bypass");
    }
  }, [devBypassActive]);

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-active text-white font-medium"
      : "text-sidebar-foreground hover:bg-sidebar-hover";

  const shouldShowSection = (section: typeof sidebarSections[0]) => {
    if (loading) return true; // don't hide while loading
    if (devBypassActive) return true; // show everything when dev bypass is on
    if (section.permission === 'Overview') return true; // always show Overview
    return hasPermission(section.permission);
  };
  return (
    <Sidebar className="bg-sidebar-bg border-r border-sidebar-hover">
      <SidebarContent>
        {/* Logo Area */}
        <div className="px-4 py-4 border-b border-sidebar-hover">
          <div className="flex items-center">
            {state !== "collapsed" ? (
              <>
                <img
                  src={logoAsset}
                  alt="SkyShare Maintenance Portal" 
                  className="h-6 w-auto object-contain select-none filter brightness-0 invert"
                  draggable={false}
                  onError={(e) => {
                    // Fallback to text if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling!.classList.remove('sr-only');
                  }}
                />
                <span className="sr-only font-heading font-bold text-sidebar-foreground">SkyShare Maintenance Portal</span>
              </>
            ) : (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">S</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 p-4 space-y-6">
        {sidebarSections.filter(shouldShowSection).map((section) => {
            return (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wide">
                  {section.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.path}
                            className={getNavCls}
                            end={Boolean(item.exact)}
                          >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            {state !== "collapsed" && (
                              <span className="truncate">{item.name}</span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}