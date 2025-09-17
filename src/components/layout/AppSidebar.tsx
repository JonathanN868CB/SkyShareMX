import { NavLink, useLocation } from "react-router-dom";
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
  FolderOpen
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
} from "@/components/ui/sidebar";

const sidebarSections = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", path: "/", icon: Home },
      { name: "Aircraft Info", path: "/under-construction", icon: Plane },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Aircraft Conformity", path: "/under-construction", icon: CheckSquare },
      { name: "14-Day Check", path: "/under-construction", icon: Calendar },
      { name: "Maintenance Planning", path: "/under-construction", icon: ClipboardList },
      { name: "Ten or More", path: "/under-construction", icon: Wrench },
      { name: "Maintenance Control", path: "/under-construction", icon: Settings },
      { name: "Projects", path: "/under-construction", icon: FolderOpen },
      { name: "Training", path: "/under-construction", icon: BookOpen },
      { name: "Docs and Links", path: "/under-construction", icon: FileText },
    ],
  },
  {
    title: "Administration",
    items: [
      { name: "Alerts & Notifications", path: "/under-construction", icon: Bell },
      { name: "Users", path: "/under-construction", icon: Users },
      { name: "Settings", path: "/under-construction", icon: Settings },
    ],
  },
  {
    title: "Development",
    items: [
      { name: "Style Guide", path: "/under-construction", icon: Palette },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-active text-white font-medium" 
      : "text-sidebar-foreground hover:bg-sidebar-hover";

  return (
    <Sidebar className="bg-sidebar-bg border-r border-sidebar-hover">
      <SidebarContent>
        {/* Logo Area */}
        <div className="px-4 py-4 border-b border-sidebar-hover">
          <div className="flex items-center">
            {state !== "collapsed" ? (
              <>
                <img 
                  src="/src/assets/skyshare-logo.png" 
                  alt="SkyShare Maintenance Portal" 
                  className="h-6 w-auto object-contain select-none"
                  draggable={false}
                />
                <span className="sr-only">SkyShare Maintenance Portal</span>
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
        {sidebarSections.map((section) => {
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