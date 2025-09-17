import { Bell, User } from "lucide-react";

export function Topbar() {
  return (
    <header className="h-16 bg-topbar-bg border-b border-topbar-border flex items-center justify-between px-6">
      <div className="flex-1">
        {/* Breadcrumb or page title could go here */}
      </div>

      {/* Right side - notifications and user */}
      <div className="flex items-center space-x-4">
        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-sm">
            <p className="font-medium">SkyShare Maintenance Portal</p>
            <p className="text-muted-foreground">Engineer</p>
          </div>
        </div>
      </div>
    </header>
  );
}