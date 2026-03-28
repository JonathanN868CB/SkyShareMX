import { Suspense, lazy } from "react"
import { createBrowserRouter, type RouteObject } from "react-router-dom"
import { ProtectedRoute } from "@/features/auth"
import { AppErrorBoundary } from "./ErrorBoundary"

const Layout = lazy(() => import("./layout/Layout").then(m => ({ default: m.Layout })))
const Login = lazy(() => import("@/pages/Login"))
const AuthCallback = lazy(() => import("@/pages/AuthCallback"))
const RequestAccess = lazy(() => import("@/pages/RequestAccess"))
const Dashboard = lazy(() => import("@/pages/Dashboard"))
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
