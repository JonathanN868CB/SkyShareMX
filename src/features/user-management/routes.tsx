import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const UserManagementPage = lazy(() => import("./components/UserManagementPage"));

export const userManagementRoute: RouteObject = {
  path: "admin/users",
  element: <UserManagementPage />,
};

export const userManagementRoutes: RouteObject[] = [userManagementRoute];
