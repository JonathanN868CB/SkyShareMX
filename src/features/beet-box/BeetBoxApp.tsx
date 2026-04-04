import { Outlet, Navigate } from "react-router-dom"
import { BeetBoxSidebar } from "./BeetBoxSidebar"

export function BeetBoxApp() {
  return (
    <div
      className="flex h-screen w-screen overflow-hidden animate-in fade-in duration-200"
      style={{ background: "hsl(0 0% 12%)" }}
    >
      <BeetBoxSidebar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

export function BeetBoxRedirect() {
  return <Navigate to="/app/beet-box/work-orders" replace />
}
