import { Suspense, lazy } from "react"
import { createBrowserRouter, type RouteObject } from "react-router-dom"
import { ProtectedRoute } from "@/features/auth"
import { AppErrorBoundary } from "./ErrorBoundary"
import ComingSoon from "@/pages/ComingSoon"
import AccessDenied from "@/pages/AccessDenied"

const Layout = lazy(() => import("./layout/Layout").then(m => ({ default: m.Layout })))
const Login = lazy(() => import("@/pages/Login"))
const AuthCallback = lazy(() => import("@/pages/AuthCallback"))
const RequestAccess = lazy(() => import("@/pages/RequestAccess"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const AdminUsers     = lazy(() => import("@/pages/admin/Users"))
const AdminTraining  = lazy(() => import("@/pages/admin/AdminTraining"))
const PermissionsIndex = lazy(() => import("@/pages/admin/PermissionsIndex"))
const AccessRestricted = lazy(() => import("@/pages/AccessRestricted"))
const AircraftInfo = lazy(() => import("@/pages/AircraftInfo"))
const MyTraining   = lazy(() => import("@/pages/training/MyTraining"))
const MyJourney    = lazy(() => import("@/pages/training/MyJourney"))
const AiAssistant  = lazy(() => import("@/pages/AiAssistant"))
const VendorMap    = lazy(() => import("@/pages/VendorMap"))
const Compliance   = lazy(() => import("@/pages/Compliance"))
const SafetyHouse  = lazy(() => import("@/pages/SafetyHouse"))
const NotFound = lazy(() => import("@/pages/NotFound"))

const fallback = (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-muted-foreground text-sm">Loading…</div>
  </div>
)

function wrap(element: React.ReactNode) {
  return (
    <AppErrorBoundary>
      <Suspense fallback={fallback}>{element}</Suspense>
    </AppErrorBoundary>
  )
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: wrap(<Login />),
  },
  {
    path: "/auth/callback",
    element: wrap(<AuthCallback />),
  },
  {
    path: "/request-access",
    element: wrap(<RequestAccess />),
  },
  {
    path: "/app",
    element: (
      <AppErrorBoundary>
        <ProtectedRoute>
          <Suspense fallback={fallback}>
            <Layout />
          </Suspense>
        </ProtectedRoute>
      </AppErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: wrap(<Dashboard />),
      },
      { path: "aircraft",    element: wrap(<AircraftInfo />) },
      { path: "vendor-map",  element: wrap(<VendorMap />) },
      { path: "dev/access-denied", element: wrap(<AccessDenied name="Aircraft Conformity" />) },
      { path: "ai-assistant", element: wrap(<AiAssistant />) },
      { path: "conformity",  element: wrap(<ComingSoon name="Aircraft Conformity" />) },
      { path: "14-day-check", element: wrap(<ComingSoon name="14-Day Check" />) },
      { path: "planning",    element: wrap(<ComingSoon name="Maintenance Planning" />) },
      { path: "ten-or-more", element: wrap(<ComingSoon name="Ten or More" />) },
      { path: "terminal-ogd", element: wrap(<ComingSoon name="Terminal-OGD" />) },
      { path: "projects",    element: wrap(<ComingSoon name="Projects" />) },
      { path: "compliance",   element: wrap(<Compliance />) },
      { path: "safety",       element: wrap(<SafetyHouse />) },
      { path: "training",    element: wrap(<MyTraining />) },
      { path: "journey",     element: wrap(<MyJourney />) },
      { path: "docs",        element: wrap(<ComingSoon name="Docs & Links" />) },
      {
        path: "admin/users",
        element: wrap(<AdminUsers />),
      },
      {
        path: "admin/training",
        element: wrap(<AdminTraining />),
      },
      {
        path: "admin/permissions",
        element: wrap(<PermissionsIndex />),
      },
      {
        path: "access-restricted",
        element: wrap(<AccessRestricted />),
      },
      {
        path: "*",
        element: wrap(<NotFound />),
      },
    ],
  },
  {
    path: "*",
    element: wrap(<NotFound />),
  },
]

export const router = createBrowserRouter(routes)
