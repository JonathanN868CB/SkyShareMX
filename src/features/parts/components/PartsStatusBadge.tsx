import { STATUS_CONFIG, LINE_STATUS_CONFIG, type RequestStatus, type LineStatus } from "../constants"

interface Props {
  status: RequestStatus | LineStatus
  variant?: "request" | "line"
  size?: "sm" | "md"
}

export function PartsStatusBadge({ status, variant = "request", size = "sm" }: Props) {
  const config = variant === "request"
    ? STATUS_CONFIG[status as RequestStatus]
    : LINE_STATUS_CONFIG[status as LineStatus]

  if (!config) return null

  return (
    <span
      className={`inline-flex items-center rounded font-semibold tracking-wider uppercase whitespace-nowrap ${
        size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1"
      }`}
      style={{ background: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  )
}
