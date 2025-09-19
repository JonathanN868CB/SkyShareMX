import { NavLink } from "react-router-dom";
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

export function Sidebar() {
  return (
    <div className="w-64 bg-sidebar-bg text-sidebar-foreground flex flex-col h-full">
      {/* Logo Area */}
      <div className="p-6 border-b border-sidebar-hover">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="font-heading font-semibold text-lg">SkyShare</h1>
            <p className="text-xs text-sidebar-foreground/60">Maintenance Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wide mb-3">
              {section.title}
            </h2>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-sidebar-active text-white"
                          : "text-sidebar-foreground hover:bg-sidebar-hover"
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}