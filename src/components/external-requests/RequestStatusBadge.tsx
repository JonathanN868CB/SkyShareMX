import { cn } from "@/shared/lib/utils"

type Status = "draft" | "sent" | "submitted" | "reviewed"

const CONFIG: Record<Status, { label: string; bg: string; border: string; color: string }> = {
  draft:     { label: "Draft",     bg: "rgba(255,255,255,0.05)",  border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" },
  sent:      { label: "Sent",      bg: "rgba(59,130,246,0.12)",   border: "rgba(59,130,246,0.3)",   color: "#93c5fd" },
  submitted: { label: "Submitted", bg: "rgba(212,160,23,0.12)",   border: "rgba(212,160,23,0.3)",   color: "#d4a017" },
  reviewed:  { label: "Reviewed",  bg: "rgba(34,197,94,0.12)",    border: "rgba(34,197,94,0.3)",    color: "#86efac" },
}

type Props = {
  status: Status
  className?: string
}

export function RequestStatusBadge({ status, className }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.draft
  return (
    <span
      className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider", className)}
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}
