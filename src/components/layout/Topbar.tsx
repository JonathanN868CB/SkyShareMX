import { Bell } from "lucide-react";
import UserMenu from "@/components/auth/UserMenu";

export function Topbar() {
  return (
    <div className="flex items-center justify-between flex-1">
      <div className="flex-1">
        {/* Breadcrumb or page title could go here */}
      </div>

      {/* Right side - notifications and user */}
      <div className="flex items-center space-x-4">
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        
        <UserMenu />
      </div>
    </div>
  );
}