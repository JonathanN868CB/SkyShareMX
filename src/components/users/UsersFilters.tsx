import { useMemo } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import type { EmploymentStatus, Role } from "@/lib/types/users";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

interface UsersFiltersProps {
  search: string;
  role?: Role;
  status?: EmploymentStatus;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: Role | undefined) => void;
  onStatusChange: (value: EmploymentStatus | undefined) => void;
  disabled?: boolean;
}

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  technician: "Technician",
  viewer: "Viewer",
};

const statusLabels: Record<EmploymentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export function UsersFilters({
  search,
  role,
  status,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  disabled = false,
}: UsersFiltersProps) {
  const roleChipLabel = useMemo(() => role ? roleLabels[role] : "All Roles", [role]);
  const statusChipLabel = useMemo(() => status ? statusLabels[status] : "All Status", [status]);

  const renderRoleItems = () => (
    <DropdownMenuContent align="start" className="w-48">
      <DropdownMenuItem
        onSelect={event => {
          event.preventDefault();
          onRoleChange(undefined);
        }}
        className="flex items-center justify-between"
      >
        <span>All Roles</span>
        {!role && <Check className="h-4 w-4" />}
      </DropdownMenuItem>
      {Object.entries(roleLabels).map(([value, label]) => (
        <DropdownMenuItem
          key={value}
          onSelect={event => {
            event.preventDefault();
            onRoleChange(value as Role);
          }}
          className="flex items-center justify-between"
        >
          <span>{label}</span>
          {role === value && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );

  const renderStatusItems = () => (
    <DropdownMenuContent align="start" className="w-40">
      <DropdownMenuItem
        onSelect={event => {
          event.preventDefault();
          onStatusChange(undefined);
        }}
        className="flex items-center justify-between"
      >
        <span>All Status</span>
        {!status && <Check className="h-4 w-4" />}
      </DropdownMenuItem>
      {Object.entries(statusLabels).map(([value, label]) => (
        <DropdownMenuItem
          key={value}
          onSelect={event => {
            event.preventDefault();
            onStatusChange(value as EmploymentStatus);
          }}
          className="flex items-center justify-between"
        >
          <span>{label}</span>
          {status === value && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative flex-1 min-w-[220px] max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search users…"
          className="h-11 rounded-md border-slate-200 pl-10 text-sm"
          disabled={disabled}
          aria-label="Search users"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-7 rounded-full border-slate-200 px-3 text-sm font-medium text-slate-600 shadow-none",
              disabled && "opacity-50"
            )}
            disabled={disabled}
          >
            <span>{roleChipLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        {renderRoleItems()}
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-7 rounded-full border-slate-200 px-3 text-sm font-medium text-slate-600 shadow-none",
              disabled && "opacity-50"
            )}
            disabled={disabled}
          >
            <span>{statusChipLabel}</span>
            <ChevronDown className="ml-2 h-4 w-4 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        {renderStatusItems()}
      </DropdownMenu>
    </div>
  );
}
