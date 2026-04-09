import { useRef } from "react"
import { Calendar } from "lucide-react"
import type { PmTaskWithRelations, PmStatus } from "@/entities/supabase"
import { Avatar } from "./Avatar"
import { StatusPill } from "./StatusPill"
import { useTaskMutations } from "../hooks/useTaskMutations"

// Matches TaskRow grid: grip | expand | name | assigned | status | due | meta
// Subtasks collapse grip+expand into one indent block
const GRID = "68px 1fr 180px 160px 120px 72px"
const ROW_H = 44

interface SubtaskRowProps {
  task:         PmTaskWithRelations
  statuses:     PmStatus[]
  boardId:      string
  onOpenDetail: (task: PmTaskWithRelations) => void
}

export function SubtaskRow({ task, statuses, boardId, onOpenDetail }: SubtaskRowProps) {
  const { updateTask } = useTaskMutations(boardId)
  const dateInputRef = useRef<HTMLInputElement>(null)

  function openDatePicker(e: React.MouseEvent) {
    e.stopPropagation()
    try { dateInputRef.current?.showPicker() } catch { dateInputRef.current?.click() }
  }

  const dateStr = task.due_date
    ? new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null
  const isOverdue = task.due_date && new Date(task.due_date + "T00:00:00") < new Date() && task.status?.label !== "Done"

  return (
    <div
      style={{
        display:             "grid",
        gridTemplateColumns: GRID,
        alignItems:          "center",
        borderBottom:        "1px solid rgba(255,255,255,0.05)",
        minHeight:           ROW_H,
        background:          "rgba(0,0,0,0.15)",
      }}
      className="group/sub hover:bg-white/[0.02]"
    >
      {/* Indent with connector line */}
      <div style={{ display: "flex", alignItems: "center", paddingLeft: 44 }}>
        <div style={{ width: 18, height: 1, background: "rgba(255,255,255,0.15)", marginRight: 6, flexShrink: 0 }} />
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
      </div>

      {/* Name */}
      <div
        onClick={() => onOpenDetail(task)}
        style={{
          padding:      "0 12px",
          cursor:       "pointer",
          overflow:     "hidden",
          whiteSpace:   "nowrap",
          textOverflow: "ellipsis",
          fontSize:     13,
          color:        "rgba(255,255,255,0.75)",
        }}
        className="hover:text-[#D4A017] transition-colors"
      >
        {task.name}
      </div>

      {/* Assigned */}
      <div
        style={{ padding: "0 10px", display: "flex", alignItems: "center", gap: 6 }}
        onClick={() => onOpenDetail(task)}
      >
        {task.champion ? (
          <>
            <Avatar profile={task.champion} size="sm" />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
              {task.champion.display_name ?? task.champion.full_name}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
            —
          </span>
        )}
      </div>

      {/* Status */}
      <div style={{ padding: "0 10px" }}>
        <StatusPill
          status={task.status}
          statuses={statuses}
          onSelect={statusId => updateTask.mutate({ id: task.id, status_id: statusId })}
        />
      </div>

      {/* Due */}
      <div style={{ padding: "0 10px" }}>
        <button
          onClick={openDatePicker}
          style={{
            display:      "inline-flex",
            alignItems:   "center",
            gap:          4,
            fontSize:     12,
            color:        isOverdue ? "#f87171" : dateStr ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)",
            background:   isOverdue ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.03)",
            border:       `1px ${dateStr ? "solid" : "dashed"} ${isOverdue ? "rgba(248,113,113,0.25)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 4,
            padding:      "3px 7px",
            cursor:       "pointer",
            transition:   "border-color 0.12s, background 0.12s, color 0.12s",
          }}
          className="hover:border-[rgba(212,160,23,0.5)] hover:bg-[rgba(212,160,23,0.07)] hover:text-[rgba(212,160,23,0.85)]"
        >
          <Calendar size={11} />
          {dateStr
            ? new Date(task.due_date! + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "Date"}
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={task.due_date ?? ""}
          onChange={e => updateTask.mutate({ id: task.id, due_date: e.target.value || null })}
          style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        />
      </div>

      {/* Meta */}
      <div />
    </div>
  )
}
