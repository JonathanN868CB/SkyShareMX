import type { ReactNode } from "react";
import { Suspense, lazy } from "react";
import { createBrowserRouter, type RouteObject } from "react-router-dom";

import { AppErrorBoundary } from "./ErrorBoundary";
import { ProtectedRoute } from "@/features/auth";
import { userManagementRoutes } from "@/features/user-management";
import { TimedFallback } from "./TimedFallback";

const AppLayout = lazy(() => import("./layout/Layout").then(module => ({ default: module.Layout })));

const LandingPage = lazy(() => import("@/pages/Landing"));
const AuthCallbackPage = lazy(() => import("@/pages/AuthCallback"));
const DashboardPage = lazy(() => import("@/pages/Dashboard"));
const AIAssistantLanding = lazy(() => import("@/pages/AIAssistantLanding"));
const UnderConstructionPage = lazy(() => import("@/pages/UnderConstructionPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFound"));

const suspenseFallback = <TimedFallback>Loading…</TimedFallback>;

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
    element: withBoundary(<LandingPage />),
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
      {
        path: "ai-assistant",
        element: withSuspense(<AIAssistantLanding />),
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
