import { RouterProvider } from "react-router-dom";
import { PermissionProvider } from "@/hooks/useUserPermissions";
import { Toaster } from "@/shared/ui/toaster";
import { Toaster as Sonner } from "@/shared/ui/sonner";

import { router } from "./routes";

export function App() {
  return (
    <PermissionProvider>
      <Toaster />
      <Sonner />
      <RouterProvider router={router} />
    </PermissionProvider>
  );
}

export default App;
