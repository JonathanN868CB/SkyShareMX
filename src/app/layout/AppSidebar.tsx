import { useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { NavLink } from "react-router-dom";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useIsSuperAdmin } from "@/features/auth";
import logoAsset from "@/shared/assets/skyshare-logo.png";
import { isDevBypassActive } from "@/shared/lib/env";
import { cn } from "@/shared/lib/utils";
import { showAccessDenied } from "@/shared/ui/access-denied-dialog";
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
  SidebarMenuSkeleton,
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

const SAFE_SECTION_PERMISSIONS = new Set<
  (typeof sidebarSections)[number]["permission"]
>(["Overview"]);

type SidebarSection = (typeof sidebarSections)[number];
type SidebarItem = SidebarSection["items"][number];
type SectionPermissionState = "granted" | "denied" | "loading";
type SidebarSectionWithAccess = SidebarSection & {
  items: Array<SidebarItem & { canNavigate: boolean }>;
  permissionState: SectionPermissionState;
};

export function AppSidebar() {
  const { state } = useSidebar();
  const { hasPermission, loading } = useUserPermissions();
  const { isSuper: isSuperAdmin } = useIsSuperAdmin();
  const devBypassActive = isDevBypassActive();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!devBypassActive && localStorage.getItem("dev-bypass")) {
      localStorage.removeItem("dev-bypass");
    }
  }, [devBypassActive]);

  const getNavCls = (isActive: boolean, canNavigate: boolean) =>
    cn(
      isActive
        ? "bg-sidebar-active text-white font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-hover",
      !canNavigate && "text-sidebar-foreground/50 hover:bg-transparent cursor-not-allowed",
    );

  const handleDeniedNavigation = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    canNavigate: boolean,
  ) => {
    if (canNavigate) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    showAccessDenied();
  };

  const getSectionPermissionState = (
    section: SidebarSection,
  ): SectionPermissionState => {
    if (devBypassActive) return "granted";
    if (SAFE_SECTION_PERMISSIONS.has(section.permission)) return "granted";
    if (loading) return "loading";
    return hasPermission(section.permission) ? "granted" : "denied";
  };

  const processedSections: SidebarSectionWithAccess[] = sidebarSections
    .map(section => {
      const permissionState = getSectionPermissionState(section);

      const itemsWithAccess = section.items.map(item => {
        const requiresSuperAdmin = item.path === "/app/admin/users";
        const canNavigate =
          devBypassActive ||
          SAFE_SECTION_PERMISSIONS.has(section.permission) ||
          (permissionState === "granted" && (!requiresSuperAdmin || isSuperAdmin));

        return { ...item, canNavigate };
      });

      return {
        ...section,
        items: itemsWithAccess,
        permissionState,
      };
    })
    .filter(section => section.items.length > 0);

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
          {processedSections.map(section => {
            const showSkeleton =
              section.permissionState === "loading" &&
              !SAFE_SECTION_PERMISSIONS.has(section.permission);

            return (
              <SidebarGroup key={section.title}>
                <SidebarGroupLabel className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wide">
                  {section.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {showSkeleton
                      ? section.items.map((_, index) => (
                          <SidebarMenuItem key={`${section.title}-skeleton-${index}`}>
                            <SidebarMenuSkeleton showIcon aria-hidden="true" />
                          </SidebarMenuItem>
                        ))
                      : section.items.map(item => (
                          <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton asChild>
                              <NavLink
                                to={item.path}
                                className={({ isActive }) =>
                                  getNavCls(isActive, item.canNavigate)
                                }
                                end={Boolean(item.exact)}
                                aria-disabled={!item.canNavigate}
                                data-disabled={item.canNavigate ? undefined : true}
                                onClick={event =>
                                  handleDeniedNavigation(event, item.canNavigate)
                                }
                                onAuxClick={event =>
                                  handleDeniedNavigation(event, item.canNavigate)
                                }
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