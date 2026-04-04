import { Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { INGESTION_STATUS_COLORS, INGESTION_STATUS_LABELS } from "../constants"
import type { IngestionStatus } from "../types"

interface Props {
  status: IngestionStatus
  className?: string
}

export function IngestionStatusBadge({ status, className }: Props) {
  const isProcessing = status === "extracting" || status === "pending"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        INGESTION_STATUS_COLORS[status],
        className
      )}
    >
      {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
      {INGESTION_STATUS_LABELS[status]}
    </span>
  )
}
