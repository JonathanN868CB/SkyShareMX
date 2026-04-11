import { Outlet, Navigate } from "react-router-dom"
import { BeetBoxSidebar } from "./BeetBoxSidebar"
import { BeetBoxTabsProvider, useBeetBoxTabs } from "./BeetBoxTabsContext"
import { BeetBoxTabBar } from "./BeetBoxTabBar"

function BeetBoxInner() {
  const { tabs } = useBeetBoxTabs()
  return (
    <div
      className="flex h-screen w-screen overflow-hidden animate-in fade-in duration-200"
      style={{ background: "hsl(0 0% 12%)" }}
    >
      <BeetBoxSidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed tab bar — always anchored at left: 256px regardless of sidebar state */}
        <BeetBoxTabBar />
        {/* Spacer so content doesn't hide behind the fixed tab bar */}
        {tabs.length > 0 && <div style={{ height: "32px", flexShrink: 0 }} />}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export function BeetBoxApp() {
  return (
    <BeetBoxTabsProvider>
      <BeetBoxInner />
    </BeetBoxTabsProvider>
  )
}

export function BeetBoxRedirect() {
  return <Navigate to="/app/beet-box/work-orders" replace />
}
