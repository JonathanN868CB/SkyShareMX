import { Bell } from "lucide-react";
import { UserMenu } from "@/features/auth";
import { useReadOnly } from "@/hooks/useUserPermissions";
import { Badge } from "@/shared/ui/badge";

export function Topbar() {
  const isReadOnly = useReadOnly();

  return (
    <div className="flex items-center justify-between flex-1">
      <div className="flex-1">
        {/* Breadcrumb or page title could go here */}
      </div>

      {/* Right side - notifications and user */}
      <div className="flex items-center space-x-4">
        {isReadOnly && (
          <Badge className="bg-amber-50 text-amber-700 border-amber-300" variant="outline">
            Read-only
          </Badge>
        )}
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <UserMenu />
      </div>
    </div>
  );
}