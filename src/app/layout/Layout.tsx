import { Outlet } from "react-router-dom"
import { SidebarProvider, SidebarTrigger } from "@/shared/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { Topbar } from "./Topbar"
import { ExternalRequestModalProvider } from "@/features/external-requests/ExternalRequestModalContext"

export function Layout() {
  return (
    <ExternalRequestModalProvider>
      <SidebarProvider>
        <div className="min-h-svh flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header
              className="h-14 flex items-center px-4 gap-3 flex-shrink-0 topbar-stripe"
              style={{ background: "hsl(var(--topbar-bg))" }}
            >
              <SidebarTrigger className="text-white/40 hover:text-white/80 transition-colors" />
              <Topbar />
            </header>
            <main className="flex-1 p-6">
              <div className="max-w-7xl mx-auto">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ExternalRequestModalProvider>
  )
}
