import { UserManagementTable } from "./UserManagementTable";
import { useReadOnly } from "@/hooks/useUserPermissions";

export default function UserManagement() {
  const isReadOnly = useReadOnly();
  const viewerMessage = "Your account is limited to Viewer access. Ask an admin to upgrade your permissions.";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-base text-muted-foreground">
          Review viewer defaults and adjust elevated roles for the SkyShare team.
        </p>
        {isReadOnly && <p className="text-sm text-muted-foreground">{viewerMessage}</p>}
      </div>

      <UserManagementTable />
    </div>
  );
}