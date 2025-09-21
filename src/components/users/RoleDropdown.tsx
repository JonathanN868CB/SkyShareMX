import { Loader2, Check } from "lucide-react";

import type { Role } from "@/lib/types/users";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

const roleLabels: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  technician: "Technician",
  viewer: "Viewer",
};

interface RoleDropdownProps {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  options?: Role[];
}

export function RoleDropdown({ value, onChange, disabled = false, loading = false, id, options }: RoleDropdownProps) {
  const availableRoles = options && options.length > 0 ? options : (Object.keys(roleLabels) as Role[]);

  return (
    <Select value={value} onValueChange={next => onChange(next as Role)} disabled={disabled || loading}>
      <SelectTrigger
        id={id}
        className={cn(
          "h-10 w-[160px] rounded-full border border-transparent bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-slate-200",
          disabled && "opacity-60",
        )}
        aria-disabled={disabled || loading}
      >
        <SelectValue placeholder="Select" />
        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-slate-400" aria-hidden />}
      </SelectTrigger>
      <SelectContent className="w-[180px]">
        {availableRoles.map(option => (
          <SelectItem
            key={option}
            value={option}
            className="flex cursor-pointer items-center justify-between text-sm"
          >
            <span>{roleLabels[option]}</span>
            {value === option && <Check className="h-4 w-4 text-primary" aria-hidden />}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
