import type { ReactNode } from "react";
import { Suspense, lazy } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { AppErrorBoundary } from "./ErrorBoundary";
import { ProtectedRoute } from "@/features/auth";
import { userManagementRoutes } from "@/features/user-management";

const PublicLayout = lazy(() => import("./layout/PublicLayout").then(module => ({ default: module.PublicLayout })));
const AppLayout = lazy(() => import("./layout/Layout").then(module => ({ default: module.Layout })));

const IndexPage = lazy(() => import("@/pages/Index"));
const RequestAccessPage = lazy(() => import("@/pages/RequestAccess"));
const LoginPage = lazy(() => import("@/pages/Login"));
const AuthCallbackPage = lazy(() => import("@/pages/AuthCallback"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const UnderConstructionPage = lazy(() => import("@/pages/UnderConstructionPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFound"));

const suspenseFallback = <div>Loading…</div>;

const withSuspense = (element: ReactNode) => <Suspense fallback={suspenseFallback}>{element}</Suspense>;

const withBoundary = (element: ReactNode) => (
  <AppErrorBoundary>
    {withSuspense(element)}
  </AppErrorBoundary>
);

const featureChildren: RouteObject[] = userManagementRoutes.map(route => ({
  ...route,
  element: withBoundary(route.element),
}));

const routes: RouteObject[] = [
  {
    path: "/",
    element: withBoundary(<PublicLayout />),
    children: [
      {
        index: true,
        element: withSuspense(<IndexPage />),
      },
      {
        path: "request-access",
        element: withSuspense(<RequestAccessPage />),
      },
    ],
  },
  {
    path: "/login",
    element: withBoundary(<LoginPage />),
  },
  {
    path: "/auth/callback",
    element: withBoundary(<AuthCallbackPage />),
  },
  {
    path: "/app",
    element: (
      <AppErrorBoundary>
        <ProtectedRoute>
          {withSuspense(<AppLayout />)}
        </ProtectedRoute>
      </AppErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: withSuspense(<DashboardPage />),
      },
      ...featureChildren,
      {
        path: "under-construction",
        element: withSuspense(<UnderConstructionPage />),
      },
      {
        path: "*",
        element: withBoundary(<NotFoundPage />),
      },
    ],
  },
  {
    path: "*",
    element: withBoundary(<NotFoundPage />),
  },
];

export const router = createBrowserRouter(routes);
