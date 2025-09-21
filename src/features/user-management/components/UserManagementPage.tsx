import { useReadOnly } from "@/hooks/useUserPermissions";
import { READ_ONLY_REMINDER_MESSAGE } from "@/shared/lib/read-only-reminder";
import { UserManagementTable } from "./UserManagementTable";

export default function UserManagement() {
  const isReadOnly = useReadOnly();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-base text-muted-foreground">
          Review viewer defaults and adjust elevated roles for the SkyShare team.
        </p>
        {isReadOnly && <p className="text-sm text-muted-foreground">{READ_ONLY_REMINDER_MESSAGE}</p>}
      </div>

      <UserManagementTable />
    </div>
  );
}