import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { ChevronRight, Plus, GripVertical, MessageSquare, Paperclip, UserPlus, Calendar, SquarePen, X } from "lucide-react"
import type { PmTaskWithRelations, PmStatus, PmProfile } from "@/entities/supabase"
import { Avatar } from "./Avatar"
import { StatusPill } from "./StatusPill"
import { SubtaskRow } from "./SubtaskRow"
import { useTaskMutations } from "../hooks/useTaskMutations"

interface TaskRowProps {
  task:             PmTaskWithRelations
  statuses:         PmStatus[]
  boardId:          string
  members:          PmProfile[]
  isDragging?:      boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
  onOpenDetail:     (task: PmTaskWithRelations) => void
}

// grid: grip | expand | name | assigned | status | due | meta
const GRID = "36px 32px 1fr 180px 160px 120px 72px"
const ROW_H = 52

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function TaskRow({
  task,
  statuses,
  boardId,
  members,
  isDragging,
  dragHandleProps,
  onOpenDetail,
}: TaskRowProps) {
  const [expanded,        setExpanded]        = useState(false)
  const [addingSubtask,   setAddingSubtask]   = useState(false)
  const [newSubtaskName,  setNewSubtaskName]  = useState("")
  const subtaskInputRef  = useRef<HTMLInputElement>(null)
  const dateInputRef     = useRef<HTMLInputElement>(null)
  const assignTriggerRef = useRef<HTMLDivElement>(null)
  const [assignOpen,   setAssignOpen]   = useState(false)
  const [assignCoords, setAssignCoords] = useState<{ top: number; left: number } | null>(null)
  const [assignSearch, setAssignSearch] = useState("")
  const { updateTask, createTask } = useTaskMutations(boardId)

  // Close assignment dropdown on outside click
  useEffect(() => {
    if (!assignOpen) return
    function handler(e: MouseEvent) {
      const portal = document.getElementById("assign-pill-portal")
      const trigger = assignTriggerRef.current
      const t = e.target as Node
      if (trigger && !trigger.contains(t) && (!portal || !portal.contains(t))) {
        setAssignOpen(false)
        setAssignSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [assignOpen])

  function openAssign(e: React.MouseEvent) {
    e.stopPropagation()
    if (!assignTriggerRef.current) return
    const rect = assignTriggerRef.current.getBoundingClientRect()
    setAssignCoords({ top: rect.bottom + 4, left: rect.left })
    setAssignOpen(o => !o)
    setAssignSearch("")
  }

  function openDatePicker(e: React.MouseEvent) {
    e.stopPropagation()
    try { dateInputRef.current?.showPicker() } catch { dateInputRef.current?.click() }
  }

  const filteredMembers = members.filter(m =>
    (m.display_name ?? m.full_name ?? "").toLowerCase().includes(assignSearch.toLowerCase())
  )

  useEffect(() => {
    if (addingSubtask) subtaskInputRef.current?.focus()
  }, [addingSubtask])

  async function handleAddSubtask() {
    if (!newSubtaskName.trim()) { setAddingSubtask(false); return }
    await createTask.mutateAsync({ groupId: task.group_id ?? "", parentTaskId: task.id, name: newSubtaskName.trim() })
    setNewSubtaskName("")
    setAddingSubtask(false)
    setExpanded(true)
  }

  const hasSubtasks = task.subtasks.length > 0
  const dateStr = formatDate(task.due_date)
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status?.label !== "Done"

  return (
    <div>
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: GRID,
          alignItems:          "center",
          borderBottom:        "1px solid rgba(255,255,255,0.06)",
          background:          isDragging ? "rgba(212,160,23,0.08)" : "hsl(0 0% 15%)",
          minHeight:           ROW_H,
          transition:          "background 0.1s",
        }}
        className="group/row hover:bg-white/[0.04]"
      >
        {/* ── Drag handle ─────────────────────────────────────── */}
        <div
          {...dragHandleProps}
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            height:         ROW_H,
            cursor:         "grab",
            color:          "rgba(255,255,255,0.25)",
            opacity:        0,
            transition:     "opacity 0.15s",
          }}
          className="group-hover/row:opacity-100"
        >
          <GripVertical size={16} />
        </div>

        {/* ── Expand toggle ────────────────────────────────────── */}
        <div
          onClick={() => hasSubtasks && setExpanded(e => !e)}
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            height:         ROW_H,
            cursor:         hasSubtasks ? "pointer" : "default",
            color:          "rgba(255,255,255,0.35)",
          }}
        >
          {hasSubtasks && (
            <ChevronRight size={15} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          )}
        </div>

        {/* ── Task name + open-detail button ───────────────────── */}
        <div
          style={{
            padding:  "0 8px 0 12px",
            display:  "flex",
            alignItems: "center",
            gap:      6,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              flex:         1,
              overflow:     "hidden",
              whiteSpace:   "nowrap",
              textOverflow: "ellipsis",
              fontSize:     14,
              fontWeight:   500,
              color:        "#fff",
            }}
          >
            {task.name}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onOpenDetail(task) }}
            title="Open task detail"
            style={{
              flexShrink:  0,
              display:     "flex",
              alignItems:  "center",
              background:  "transparent",
              border:      "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4,
              padding:     "2px 5px",
              cursor:      "pointer",
              color:       "rgba(255,255,255,0.35)",
              opacity:     0,
              transition:  "opacity 0.15s, border-color 0.12s, color 0.12s",
            }}
            className="group-hover/row:opacity-100 hover:!border-[rgba(212,160,23,0.5)] hover:!text-[#D4A017]"
          >
            <SquarePen size={12} />
          </button>
        </div>

        {/* ── Assigned ─────────────────────────────────────────── */}
        <div style={{ padding: "0 10px" }}>
          <div
            style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: 164 }}
            className="group/assign"
          >
            <div
              ref={assignTriggerRef}
              onClick={openAssign}
              style={{
                display:      "inline-flex",
                alignItems:   "center",
                gap:          7,
                padding:      "4px 8px",
                borderRadius: 6,
                border:       task.champion
                  ? "1px solid rgba(255,255,255,0.12)"
                  : "1px dashed rgba(255,255,255,0.15)",
                background:   task.champion ? "rgba(255,255,255,0.04)" : "transparent",
                cursor:       "pointer",
                transition:   "border-color 0.12s, background 0.12s",
                overflow:     "hidden",
              }}
              className="hover:border-[rgba(212,160,23,0.5)] hover:bg-[rgba(212,160,23,0.07)]"
            >
            {task.champion ? (
              <>
                <Avatar profile={task.champion} size="sm" />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {task.champion.display_name ?? task.champion.full_name}
                </span>
              </>
            ) : (
              <>
                <UserPlus size={13} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
                  Assign
                </span>
              </>
            )}
            </div>

            {/* × to unassign — visible on row hover when champion is set */}
            {task.champion && (
              <button
                onClick={e => { e.stopPropagation(); updateTask.mutate({ id: task.id, champion_id: null }) }}
                title="Unassign"
                style={{
                  background:  "transparent",
                  border:      "none",
                  cursor:      "pointer",
                  color:       "rgba(255,255,255,0.3)",
                  padding:     "2px 3px",
                  display:     "flex",
                  borderRadius: 3,
                  opacity:     0,
                  transition:  "opacity 0.15s, color 0.12s",
                  flexShrink:  0,
                }}
                className="group-hover/assign:opacity-100 hover:!text-red-400"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Contributors overflow */}
          {task.contributors.length > 0 && (
            <div style={{ display: "inline-flex", marginLeft: 4 }}>
              {task.contributors.slice(0, 2).map((c, i) => (
                <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 2 - i }}>
                  <Avatar profile={c} size="sm" />
                </div>
              ))}
              {task.contributors.length > 2 && (
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: -6 }}>
                  +{task.contributors.length - 2}
                </div>
              )}
            </div>
          )}

          {/* Assignment dropdown portal */}
          {assignOpen && assignCoords && createPortal(
            <div
              id="assign-pill-portal"
              style={{
                position:     "fixed",
                top:          assignCoords.top,
                left:         assignCoords.left,
                zIndex:       9999,
                background:   "hsl(0 0% 13%)",
                border:       "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                width:        220,
                boxShadow:    "0 12px 32px rgba(0,0,0,0.65)",
                overflow:     "hidden",
              }}
            >
              {/* Search */}
              <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <input
                  autoFocus
                  value={assignSearch}
                  onChange={e => setAssignSearch(e.target.value)}
                  placeholder="Search members…"
                  onKeyDown={e => { if (e.key === "Escape") { setAssignOpen(false); setAssignSearch("") } }}
                  style={{
                    width: "100%", background: "hsl(0 0% 18%)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5,
                    padding: "5px 8px", fontSize: 12, color: "#fff", outline: "none",
                    fontFamily: "var(--font-body)",
                  }}
                />
              </div>
              {/* Unassign option */}
              {task.champion && (
                <button
                  onClick={() => { updateTask.mutate({ id: task.id, champion_id: null }); setAssignOpen(false) }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "7px 12px", background: "transparent", border: "none",
                    cursor: "pointer", fontSize: 11, fontFamily: "var(--font-heading)",
                    letterSpacing: "0.06em", color: "rgba(255,255,255,0.35)",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                  className="hover:bg-white/5 hover:text-white"
                >
                  Unassign
                </button>
              )}
              {/* Member list */}
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {filteredMembers.length === 0 ? (
                  <p style={{ padding: "10px 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>No results</p>
                ) : filteredMembers.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { updateTask.mutate({ id: task.id, champion_id: m.id }); setAssignOpen(false); setAssignSearch("") }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "8px 12px", background: m.id === task.champion?.id ? "rgba(212,160,23,0.1)" : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                    }}
                    className="hover:bg-white/[0.06]"
                  >
                    <Avatar profile={m} size="sm" />
                    <span style={{ fontSize: 13, color: m.id === task.champion?.id ? "#D4A017" : "rgba(255,255,255,0.85)" }}>
                      {m.display_name ?? m.full_name}
                    </span>
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* ── Status ───────────────────────────────────────────── */}
        <div style={{ padding: "0 10px" }}>
          <StatusPill
            status={task.status}
            statuses={statuses}
            onSelect={statusId => updateTask.mutate({ id: task.id, status_id: statusId })}
          />
        </div>

        {/* ── Due date ─────────────────────────────────────────── */}
        <div style={{ padding: "0 10px" }}>
          <button
            onClick={openDatePicker}
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          5,
              fontSize:     dateStr ? 13 : 12,
              fontWeight:   dateStr ? 500 : 400,
              color:        isOverdue ? "#f87171" : dateStr ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
              background:   isOverdue ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)",
              border:       `1px ${dateStr ? "solid" : "dashed"} ${isOverdue ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.14)"}`,
              borderRadius: 5,
              padding:      "4px 9px",
              cursor:       "pointer",
              transition:   "border-color 0.12s, background 0.12s, color 0.12s",
            }}
            className="hover:border-[rgba(212,160,23,0.5)] hover:bg-[rgba(212,160,23,0.07)] hover:text-[rgba(212,160,23,0.9)]"
          >
            <Calendar size={12} />
            {dateStr ?? "Set date"}
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={task.due_date ?? ""}
            onChange={e => updateTask.mutate({ id: task.id, due_date: e.target.value || null })}
            style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
          />
        </div>

        {/* ── Meta ─────────────────────────────────────────────── */}
        <div style={{ padding: "0 8px", display: "flex", alignItems: "center", gap: 6 }}>
          {task.comment_count > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              <MessageSquare size={11} />
              {task.comment_count}
            </span>
          )}
          {task.attachment_count > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              <Paperclip size={11} />
              {task.attachment_count}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); setAddingSubtask(true); setExpanded(true) }}
            title="Add subtask"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.2)", padding: 0, display: "flex",
              alignItems: "center", opacity: 0, transition: "opacity 0.15s",
            }}
            className="group-hover/row:opacity-100 hover:!text-[#D4A017]"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {expanded && (
        <>
          {task.subtasks.map(sub => (
            <SubtaskRow key={sub.id} task={sub} statuses={statuses} boardId={boardId} onOpenDetail={onOpenDetail} />
          ))}
          {addingSubtask && (
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "68px 1fr auto",
                alignItems:          "center",
                borderBottom:        "1px solid rgba(255,255,255,0.05)",
                minHeight:           44,
                background:          "rgba(0,0,0,0.15)",
              }}
            >
              {/* Indent */}
              <div style={{ display: "flex", alignItems: "center", paddingLeft: 44 }}>
                <div style={{ width: 18, height: 1, background: "rgba(255,255,255,0.15)", marginRight: 6 }} />
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(212,160,23,0.5)" }} />
              </div>
              <input
                ref={subtaskInputRef}
                value={newSubtaskName}
                onChange={e => setNewSubtaskName(e.target.value)}
                placeholder="Subtask name…"
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddSubtask()
                  if (e.key === "Escape") { setNewSubtaskName(""); setAddingSubtask(false) }
                }}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  fontSize: 13, color: "#fff", fontFamily: "var(--font-body)",
                  padding: "0 12px",
                }}
              />
              <div style={{ display: "flex", gap: 6, padding: "0 12px" }}>
                <button
                  onClick={handleAddSubtask}
                  style={{ background: "#D4A017", border: "none", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "var(--font-heading)", color: "#000" }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setNewSubtaskName(""); setAddingSubtask(false) }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 11 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
