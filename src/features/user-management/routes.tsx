import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

import { SuperAdminRoute } from "@/features/auth/index";

const UsersPage = lazy(() => import("@/pages/admin/Users"));
const RoleDefaultsPage = lazy(() => import("@/pages/admin/RoleDefaults"));

export const userManagementRoute: RouteObject = {
  path: "admin/users",
  element: (
    <SuperAdminRoute>
      <UsersPage />
    </SuperAdminRoute>
  ),
};

const roleDefaultsRoute: RouteObject = {
  path: "users/role-defaults",
  element: (
    <SuperAdminRoute>
      <RoleDefaultsPage />
    </SuperAdminRoute>
  ),
};

export const userManagementRoutes: RouteObject[] = [userManagementRoute, roleDefaultsRoute];
