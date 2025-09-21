import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/shared/ui/sidebar";
import { useReadOnlyReminder } from "@/hooks/useReadOnlyReminder";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";

export function Layout() {
  useReadOnlyReminder();

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
          <main className="flex-1 p-6 bg-background">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}