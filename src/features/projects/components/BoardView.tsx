import { useState } from "react"
import { ArrowLeft, Plus, Users, Palette, Settings } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { useBoard, useGroupMutations } from "../hooks/useBoard"
import { GroupSection } from "./GroupSection"
import { TaskDetailDrawer } from "./TaskDetailDrawer"
import { BoardMembersPanel } from "./BoardMembersPanel"
import { StatusEditor } from "./StatusEditor"
import { PM_BOARD_COLORS } from "@/entities/supabase"
import type { PmTaskWithRelations } from "@/entities/supabase"

interface BoardViewProps {
  boardId:    string
  onBack:     () => void
}

export function BoardView({ boardId, onBack }: BoardViewProps) {
  const { data: board, isLoading } = useBoard(boardId)
  const { createGroup } = useGroupMutations(boardId)

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Always derive from live board data so the drawer reflects mutations instantly
  const allTasks = board?.groups.flatMap(g =>
    g.tasks.flatMap(t => [t, ...t.subtasks])
  ) ?? []
  const selectedTask = selectedTaskId
    ? allTasks.find(t => t.id === selectedTaskId) ?? null
    : null
  const [showMembers,    setShowMembers]    = useState(false)
  const [showStatuses,   setShowStatuses]   = useState(false)
  const [addingGroup,    setAddingGroup]    = useState(false)
  const [newGroupName,   setNewGroupName]   = useState("")
  const [newGroupColor,  setNewGroupColor]  = useState(PM_BOARD_COLORS[1].value)

  async function handleCreateGroup() {
    if (!newGroupName.trim()) { setAddingGroup(false); return }
    await createGroup.mutateAsync({ name: newGroupName.trim(), color: newGroupColor })
    setNewGroupName(""); setNewGroupColor(PM_BOARD_COLORS[1].value); setAddingGroup(false)
  }

  if (isLoading || !board) {
    return (
      <div style={{ padding: "32px 40px" }}>
        <div className="skeleton-gold" style={{ height: 40, width: 200, borderRadius: 6, marginBottom: 24 }} />
        {[1, 2].map(i => (
          <div key={i} className="skeleton-gold" style={{ height: 120, borderRadius: 8, marginBottom: 16 }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: 0 }}
          className="hover:text-white"
        >
          <ArrowLeft size={14} /> Boards
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: board.color }} />
          <h1
            style={{
              fontFamily:    "var(--font-display)",
              fontSize:      28,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color:         "#fff",
              margin:        0,
            }}
          >
            {board.name}
          </h1>
        </div>

        {/* Board actions */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowStatuses(true)}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "var(--font-heading)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 5 }}
            className="hover:border-[rgba(212,160,23,0.4)] hover:text-white"
          >
            <Palette size={12} /> Statuses
          </button>
          <button
            onClick={() => setShowMembers(true)}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "var(--font-heading)", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 5 }}
            className="hover:border-[rgba(212,160,23,0.4)] hover:text-white"
          >
            <Users size={12} /> Members ({board.members.length})
          </button>
          <Button
            onClick={() => setAddingGroup(true)}
            size="sm"
            style={{ background: "#D4A017", color: "#000", fontFamily: "var(--font-heading)", letterSpacing: "0.1em", fontSize: 11 }}
          >
            <Plus size={13} className="mr-1" /> New Group
          </Button>
        </div>
      </div>

      {board.description && (
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 20, marginTop: -12 }}>
          {board.description}
        </p>
      )}

      {/* Gold divider */}
      <div style={{ height: 1, background: "var(--skyshare-gold)", width: "3.5rem", marginBottom: 16 }} />

      {/* Single sticky column header — shared across all groups */}
      <div
        style={{
          position:            "sticky",
          top:                 0,
          zIndex:              10,
          display:             "grid",
          gridTemplateColumns: "36px 32px 1fr 180px 160px 120px 72px",
          alignItems:          "center",
          padding:             "8px 0",
          background:          "hsl(0 0% 12%)",
          borderTop:           "1px solid rgba(255,255,255,0.07)",
          borderBottom:        "1px solid rgba(255,255,255,0.07)",
          marginBottom:        16,
        }}
      >
        <div /><div />
        <div style={{ padding: "0 12px", fontSize: 10, fontFamily: "var(--font-heading)", letterSpacing: "0.15em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Task</div>
        <div style={{ padding: "0 10px", fontSize: 10, fontFamily: "var(--font-heading)", letterSpacing: "0.15em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Assigned</div>
        <div style={{ padding: "0 10px", fontSize: 10, fontFamily: "var(--font-heading)", letterSpacing: "0.15em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Status</div>
        <div style={{ padding: "0 10px", fontSize: 10, fontFamily: "var(--font-heading)", letterSpacing: "0.15em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Due Date</div>
        <div />
      </div>

      {/* New group form */}
      {addingGroup && (
        <div
          style={{
            background:   "hsl(0 0% 16%)",
            border:       "1px solid rgba(212,160,23,0.3)",
            borderRadius: 8,
            padding:      "14px 20px",
            marginBottom: 16,
            display:      "flex",
            alignItems:   "center",
            gap:          12,
          }}
        >
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="Group name…"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") handleCreateGroup(); if (e.key === "Escape") { setNewGroupName(""); setAddingGroup(false) } }}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#fff", fontFamily: "var(--font-body)" }}
          />
          {/* Color picker */}
          <div style={{ display: "flex", gap: 4 }}>
            {PM_BOARD_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setNewGroupColor(c.value)}
                style={{
                  width: 16, height: 16, borderRadius: "50%", background: c.value,
                  border: newGroupColor === c.value ? "2px solid #D4A017" : "2px solid transparent",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
          <button onClick={handleCreateGroup} style={{ background: "#D4A017", border: "none", borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontFamily: "var(--font-heading)", color: "#000" }}>
            Create
          </button>
          <button onClick={() => { setNewGroupName(""); setAddingGroup(false) }} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            Cancel
          </button>
        </div>
      )}

      {/* Groups */}
      {board.groups.length === 0 && !addingGroup ? (
        <div
          style={{
            border:       "1px dashed rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding:      "60px 32px",
            textAlign:    "center",
            color:        "rgba(255,255,255,0.3)",
          }}
        >
          <p style={{ fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>No groups yet</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Add a group to start organizing work.</p>
          <Button
            onClick={() => setAddingGroup(true)}
            size="sm"
            style={{ marginTop: 12, background: "#D4A017", color: "#000", fontFamily: "var(--font-heading)", letterSpacing: "0.1em", fontSize: 11 }}
          >
            <Plus size={13} className="mr-1" /> New Group
          </Button>
        </div>
      ) : (
        board.groups.map(group => (
          <GroupSection
            key={group.id}
            group={group}
            statuses={board.statuses}
            boardId={boardId}
            members={board.members.map(m => m.profile)}
            onOpenDetail={(t) => setSelectedTaskId(t.id)}
          />
        ))
      )}

      {/* Task detail drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          statuses={board.statuses}
          members={board.members}
          boardId={boardId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Board members panel */}
      {showMembers && (
        <BoardMembersPanel
          boardId={boardId}
          members={board.members}
          createdBy={board.created_by}
          onClose={() => setShowMembers(false)}
        />
      )}

      {/* Status editor */}
      {showStatuses && (
        <StatusEditor
          boardId={boardId}
          statuses={board.statuses}
          onClose={() => setShowStatuses(false)}
        />
      )}
    </div>
  )
}
