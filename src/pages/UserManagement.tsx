import { useState } from "react";
import { AddUserDialog } from "@/components/users/AddUserDialog";
import { UserManagementTable } from "@/components/users/UserManagementTable";
import { InvitationsTable } from "@/components/users/InvitationsTable";
import { Separator } from "@/components/ui/separator";

export default function UserManagement() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUserAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <AddUserDialog onUserAdded={handleUserAdded} />
      </div>

      {/* Invitations Table */}
      <InvitationsTable refreshKey={refreshKey} />
      
      <Separator />
      
      {/* User Management Table */}
      <UserManagementTable key={refreshKey} />
    </div>
  );
}