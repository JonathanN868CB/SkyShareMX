import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

import { SuperAdminRoute } from "@/features/auth/index";

const UsersPage = lazy(() => import("@/pages/admin/Users"));

export const userManagementRoute: RouteObject = {
  path: "admin/users",
  element: (
    <SuperAdminRoute>
      <UsersPage />
    </SuperAdminRoute>
  ),
};

export const userManagementRoutes: RouteObject[] = [userManagementRoute];
