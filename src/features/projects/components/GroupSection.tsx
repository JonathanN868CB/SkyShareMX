import { useState, useRef, useCallback } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import type { PmGroupWithTasks, PmStatus, PmTaskWithRelations, PmProfile } from "@/entities/supabase"
import { TaskRow } from "./TaskRow"
import { useTaskMutations } from "../hooks/useTaskMutations"
import { useGroupMutations } from "../hooks/useBoard"
import { Input } from "@/shared/ui/input"

interface GroupSectionProps {
  group:        PmGroupWithTasks
  statuses:     PmStatus[]
  boardId:      string
  members:      PmProfile[]
  onOpenDetail: (task: PmTaskWithRelations) => void
}

// ─── Drag-and-drop helpers ────────────────────────────────────────────────────
function reorder<T>(list: T[], fromIdx: number, toIdx: number): T[] {
  const result = [...list]
  const [item] = result.splice(fromIdx, 1)
  result.splice(toIdx, 0, item)
  return result
}

export function GroupSection({ group, statuses, boardId, members, onOpenDetail }: GroupSectionProps) {
  const [collapsed,    setCollapsed]    = useState(false)
  const [addingTask,   setAddingTask]   = useState(false)
  const [newTaskName,  setNewTaskName]  = useState("")
  const [editingName,  setEditingName]  = useState(false)
  const [nameValue,    setNameValue]    = useState(group.name)
  const [localTasks,   setLocalTasks]   = useState<PmTaskWithRelations[]>(group.tasks)

  // Keep local tasks in sync with incoming prop when not dragging.
  // Compare IDs + mutable fields so status/assignment/date changes propagate.
  const draggingRef = useRef(false)
  const incomingSig = JSON.stringify(group.tasks.map(t => `${t.id}|${t.status?.id ?? ""}|${t.champion?.id ?? ""}|${t.due_date ?? ""}`))
  const localSig    = JSON.stringify(localTasks.map(t => `${t.id}|${t.status?.id ?? ""}|${t.champion?.id ?? ""}|${t.due_date ?? ""}`))
  if (!draggingRef.current && incomingSig !== localSig) {
    setLocalTasks(group.tasks)
  }

  const { createTask, reorderTasks } = useTaskMutations(boardId)
  const { updateGroup, deleteGroup }  = useGroupMutations(boardId)

  // ─── Drag state ───────────────────────────────────────────────────────────
  const dragState = useRef<{
    active:  boolean
    id:      string
    startY:  number
    offsetY: number
  } | null>(null)
  const rowEls   = useRef<Map<string, HTMLDivElement>>(new Map())
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const gapId    = useRef<string | null>(null)

  const onDragStart = useCallback((taskId: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true

    const el = rowEls.current.get(taskId)
    const rect = el?.getBoundingClientRect()

    dragState.current = {
      active:  true,
      id:      taskId,
      startY:  e.clientY,
      offsetY: rect ? e.clientY - rect.top : 0,
    }

    // Create ghost
    const ghost = document.createElement("div")
    ghost.style.cssText = `
      position:fixed; pointer-events:none; z-index:9999;
      background:hsl(0 0% 22%); border:1px solid rgba(212,160,23,0.4);
      border-radius:4px; width:${rect?.width ?? 600}px; height:${rect?.height ?? 40}px;
      opacity:0.85; box-shadow:0 8px 24px rgba(0,0,0,0.5);
      left:${rect?.left ?? 0}px; top:${(rect?.top ?? e.clientY) - 0}px;
    `
    document.body.appendChild(ghost)
    ghostRef.current = ghost
  }, [])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current?.active || !ghostRef.current) return
    const y = e.clientY - dragState.current.offsetY
    ghostRef.current.style.top = `${y}px`

    // Find insertion target
    let nearest: string | null = null
    let nearestDist = Infinity
    rowEls.current.forEach((el, id) => {
      if (id === dragState.current!.id) return
      const rect = el.getBoundingClientRect()
      const mid  = rect.top + rect.height / 2
      const dist = Math.abs(e.clientY - mid)
      if (dist < nearestDist) { nearestDist = dist; nearest = id }
    })
    gapId.current = nearest
  }, [])

  const onDragEnd = useCallback(() => {
    if (!dragState.current?.active) return
    const { id: dragId } = dragState.current
    dragState.current = null
    draggingRef.current = false

    ghostRef.current?.remove()
    ghostRef.current = null

    if (gapId.current && gapId.current !== dragId) {
      const fromIdx = localTasks.findIndex(t => t.id === dragId)
      const toIdx   = localTasks.findIndex(t => t.id === gapId.current)
      if (fromIdx >= 0 && toIdx >= 0) {
        const reordered = reorder(localTasks, fromIdx, toIdx)
        setLocalTasks(reordered)
        reorderTasks.mutate(reordered.map(t => t.id))
      }
    }
    gapId.current = null
  }, [localTasks, reorderTasks])

  // ─── Add task ─────────────────────────────────────────────────────────────
  async function handleAddTask() {
    if (!newTaskName.trim()) { setAddingTask(false); return }
    await createTask.mutateAsync({ groupId: group.id, name: newTaskName.trim() })
    setNewTaskName("")
    setAddingTask(false)
  }

  // ─── Rename group ─────────────────────────────────────────────────────────
  async function handleRename() {
    if (nameValue.trim() && nameValue !== group.name) {
      await updateGroup.mutate({ id: group.id, name: nameValue.trim() })
    }
    setEditingName(false)
  }

  const taskCount = group.tasks.length

  return (
    <div
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
      style={{
        marginBottom: 24,
        borderRadius: 8,
        overflow:     "hidden",
        border:       `1px solid rgba(255,255,255,0.09)`,
        borderLeft:   `4px solid ${group.color}`,
        boxShadow:    `0 0 0 0 transparent, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Group header */}
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          8,
          padding:      "11px 0 11px 16px",
          background:   "hsl(0 0% 16%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          position:     "relative",
        }}
        className="group/header"
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 0, display: "flex" }}
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <ChevronDown size={14} />
          }
        </button>

        {/* Group name */}
        {editingName ? (
          <Input
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setNameValue(group.name); setEditingName(false) } }}
            autoFocus
            style={{ height: 24, fontSize: 12, fontFamily: "var(--font-heading)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "hsl(0 0% 18%)", border: "1px solid rgba(212,160,23,0.4)", color: "#fff", padding: "0 6px", width: 200 }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditingName(true)}
            style={{
              fontFamily:    "var(--font-heading)",
              fontSize:      14,
              fontWeight:    700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color:         "#fff",
              cursor:        "default",
            }}
          >
            {group.name}
          </span>
        )}

        {taskCount > 0 && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-heading)", background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "1px 7px" }}>
            {taskCount}
          </span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity pr-4">
          <button
            onClick={() => { setAddingTask(true); setCollapsed(false) }}
            title="Add task"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: "2px 4px", display: "flex", alignItems: "center", gap: 3, fontSize: 10, fontFamily: "var(--font-heading)" }}
            className="hover:text-[#D4A017]"
          >
            <Plus size={12} /> Task
          </button>
          <button
            onClick={() => deleteGroup.mutate(group.id)}
            title="Delete group"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: "2px 4px", display: "flex" }}
            className="hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Task rows */}
          {localTasks.map(task => (
            <div
              key={task.id}
              ref={el => { if (el) rowEls.current.set(task.id, el); else rowEls.current.delete(task.id) }}
            >
              <TaskRow
                task={task}
                statuses={statuses}
                boardId={boardId}
                members={members}
                dragHandleProps={{
                  onPointerDown: e => onDragStart(task.id, e),
                }}
                onOpenDetail={onOpenDetail}
              />
            </div>
          ))}

          {/* Add task inline or empty state prompt */}
          {addingTask ? (
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "36px 32px 1fr 180px 160px 120px 72px",
                alignItems:          "center",
                borderBottom:        "1px solid rgba(255,255,255,0.05)",
                minHeight:           52,
                background:          "rgba(212,160,23,0.03)",
              }}
            >
              <div /><div />
              <div style={{ padding: "0 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <Input
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  placeholder="Task name…"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleAddTask(); if (e.key === "Escape") { setNewTaskName(""); setAddingTask(false) } }}
                  style={{ height: 34, fontSize: 13, background: "hsl(0 0% 20%)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                />
                <button onClick={handleAddTask} style={{ background: "#D4A017", border: "none", borderRadius: 5, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontFamily: "var(--font-heading)", color: "#000", letterSpacing: "0.06em" }}>
                  Add
                </button>
                <button onClick={() => { setNewTaskName(""); setAddingTask(false) }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : localTasks.length === 0 ? (
            // Empty group — inviting prompt
            <div
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        10,
                padding:    "14px 0 14px 68px",
              }}
            >
              <button
                onClick={() => setAddingTask(true)}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          6,
                  background:   "rgba(212,160,23,0.07)",
                  border:       "1px dashed rgba(212,160,23,0.25)",
                  borderRadius: 5,
                  cursor:       "pointer",
                  fontSize:     11,
                  color:        "rgba(212,160,23,0.6)",
                  fontFamily:   "var(--font-heading)",
                  letterSpacing: "0.08em",
                  padding:      "6px 14px",
                }}
                className="hover:bg-[rgba(212,160,23,0.12)] hover:text-[rgba(212,160,23,0.9)]"
              >
                <Plus size={13} /> Add first task
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingTask(true)}
              style={{
                display:     "flex",
                alignItems:  "center",
                gap:         6,
                padding:     "7px 0 7px 68px",
                width:       "100%",
                background:  "transparent",
                border:      "none",
                cursor:      "pointer",
                fontSize:    11,
                color:       "rgba(255,255,255,0.2)",
                fontFamily:  "var(--font-body)",
              }}
              className="hover:text-[#D4A017]/60"
            >
              <Plus size={12} /> Add task
            </button>
          )}
        </>
      )}
    </div>
  )
}
