import { RouterProvider } from "react-router-dom";
import { PermissionProvider } from "@/hooks/useUserPermissions";
import { AccessDeniedDialogProvider } from "@/shared/ui/access-denied-dialog";
import { Toaster } from "@/shared/ui/toaster";
import { Toaster as Sonner } from "@/shared/ui/sonner";

import { router } from "./routes";

export function App() {
  return (
    <PermissionProvider>
      <AccessDeniedDialogProvider>
        <Toaster />
        <Sonner />
        <RouterProvider router={router} />
      </AccessDeniedDialogProvider>
    </PermissionProvider>
  );
}

export default App;
