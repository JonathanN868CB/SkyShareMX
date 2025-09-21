import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/shared/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import { useReadOnly } from "@/hooks/useUserPermissions";

export function Layout() {
  const isReadOnly = useReadOnly();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 bg-topbar-bg border-b border-topbar-border flex items-center px-6">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1">
              <Topbar />
            </div>
          </header>
          {isReadOnly && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-900">
              Your account is set to Viewer access. Ask an admin to upgrade your permissions.
            </div>
          )}
          <main className="flex-1 p-6 bg-background">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}