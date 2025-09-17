import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserManagementTable } from "@/components/users/UserManagementTable";

export default function UserManagement() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <Button className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add User</span>
        </Button>
      </div>

      {/* User Management Table */}
      <UserManagementTable />
    </div>
  );
}