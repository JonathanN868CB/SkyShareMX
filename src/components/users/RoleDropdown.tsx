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
}

export function RoleDropdown({ value, onChange, disabled = false, loading = false, id }: RoleDropdownProps) {
  return (
    <Select value={value} onValueChange={next => onChange(next as Role)} disabled={disabled || loading}>
      <SelectTrigger
        id={id}
        className={cn(
          "w-[130px] h-9 rounded-md border-slate-200 bg-white text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/60",
          disabled && "opacity-60",
        )}
        aria-disabled={disabled || loading}
      >
        <SelectValue placeholder="Select" />
        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-slate-400" aria-hidden />}
      </SelectTrigger>
      <SelectContent className="w-[180px]">
        {(Object.keys(roleLabels) as Role[]).map(option => (
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
