import { Lock } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";

interface LockedBadgeProps {
  className?: string;
}

export function LockedBadge({ className }: LockedBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600",
              className,
            )}
          >
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Locked
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs text-slate-600">
          Super admin settings locked
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
