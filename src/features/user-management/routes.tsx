import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const UsersPage = lazy(() => import("@/pages/admin/Users"));

export const userManagementRoute: RouteObject = {
  path: "admin/users",
  element: <UsersPage />,
};

export const userManagementRoutes: RouteObject[] = [userManagementRoute];
