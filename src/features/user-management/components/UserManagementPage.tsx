import { useState } from "react";
import { AddUserDialog } from "./AddUserDialog";
import { UserManagementTable } from "./UserManagementTable";
import { InvitationsTable } from "./InvitationsTable";
import { Separator } from "@/shared/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { useReadOnly } from "@/hooks/useUserPermissions";

export default function UserManagement() {
  const [refreshKey, setRefreshKey] = useState(0);
  const isReadOnly = useReadOnly();
  const readOnlyMessage = "Your account is read-only. Ask an admin to upgrade your access.";

  const handleUserAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const addUserButton = (
    <AddUserDialog onUserAdded={handleUserAdded} disabled={isReadOnly} />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        {isReadOnly ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex cursor-not-allowed">{addUserButton}</div>
              </TooltipTrigger>
              <TooltipContent>{readOnlyMessage}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          addUserButton
        )}
      </div>

      {/* Invitations Table */}
      <InvitationsTable refreshKey={refreshKey} />
      
      <Separator />
      
      {/* User Management Table */}
      <UserManagementTable key={refreshKey} />
    </div>
  );
}