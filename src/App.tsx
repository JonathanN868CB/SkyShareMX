import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { PermissionProvider } from "./hooks/useUserPermissions";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import UserManagement from "./pages/UserManagement";
import UnderConstructionPage from "./pages/UnderConstructionPage";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Index from "./pages/Index";
import RequestAccess from "./pages/RequestAccess";
import { PublicLayout } from "./components/public/PublicLayout";



const App = () => {
  return (
      <PermissionProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<Index />} />
              <Route path="request-access" element={<RequestAccess />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="admin/users" element={<UserManagement />} />
              <Route path="under-construction" element={<UnderConstructionPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PermissionProvider>
  );
};

export default App;