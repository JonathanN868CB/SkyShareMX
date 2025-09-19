import { Loader2 } from "lucide-react";

import type { EmploymentStatus } from "@/lib/types/users";
import { cn } from "@/shared/lib/utils";

interface StatusPillProps {
  value: EmploymentStatus;
  onChange: (status: EmploymentStatus) => void;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
}

const statusOptions: { value: EmploymentStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export function StatusPill({ value, onChange, disabled = false, loading = false, id }: StatusPillProps) {
  const isDisabled = disabled || loading;

  return (
    <div
      id={id}
      role="group"
      aria-label="Employment status"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-slate-100 px-1 py-1",
        isDisabled && "opacity-60",
      )}
    >
      {statusOptions.map(option => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "relative inline-flex h-11 min-w-[96px] items-center justify-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/70",
              isActive
                ? "bg-primary text-white shadow-sm"
                : "bg-transparent text-slate-600 hover:bg-white",
            )}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            disabled={isDisabled}
          >
            {option.label}
          </button>
        );
      })}
      {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-slate-400" aria-hidden />}
    </div>
  );
}
