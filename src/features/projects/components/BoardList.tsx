import { useState } from "react"
import { Plus, Layers, Users, FolderOpen } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Card, CardContent } from "@/shared/ui/card"
import { useBoards } from "../hooks/useBoards"
import { CreateBoardModal } from "./CreateBoardModal"
import type { BoardCard } from "../hooks/useBoards"

interface BoardListProps {
  onSelectBoard: (boardId: string) => void
}

function BoardCardItem({ board, onSelect }: { board: BoardCard; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className="card-elevated card-hoverable border-0"
      style={{
        borderTop:    `3px solid ${board.color}`,
        borderRadius: 8,
        padding:      "16px 20px",
        cursor:       "pointer",
        display:      "flex",
        flexDirection:"column",
        gap:          8,
      }}
    >
      {/* Color dot + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: board.color, flexShrink: 0 }} />
        <span
          style={{
            fontFamily:    "var(--font-heading)",
            fontSize:      13,
            fontWeight:    700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color:         "#fff",
          }}
        >
          {board.name}
        </span>
      </div>

      {board.description && (
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0, lineHeight: 1.4 }}>
          {board.description}
        </p>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          <Layers size={11} />
          {board.group_count} {board.group_count === 1 ? "group" : "groups"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          <Users size={11} />
          {board.member_count} {board.member_count === 1 ? "member" : "members"}
        </span>
      </div>
    </div>
  )
}

export function BoardList({ onSelectBoard }: BoardListProps) {
  const [showCreate, setShowCreate] = useState(false)
  const { data: boards, isLoading } = useBoards()

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Hero */}
      <div className="hero-area" style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, letterSpacing: "0.05em", textTransform: "uppercase", margin: 0 }}>
          PROJECTS
        </h1>
        <div style={{ height: 1, background: "var(--skyshare-gold)", width: "3.5rem", margin: "8px 0" }} />
        <p style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em", fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", margin: 0 }}>
          Boards &amp; Project Coordination
        </p>
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 10, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
          {boards?.length ?? 0} {boards?.length === 1 ? "board" : "boards"}
        </span>
        <Button
          onClick={() => setShowCreate(true)}
          style={{ background: "#D4A017", color: "#000", fontFamily: "var(--font-heading)", letterSpacing: "0.1em", fontSize: 11 }}
          size="sm"
        >
          <Plus size={14} className="mr-1" />
          New Board
        </Button>
      </div>

      {/* Board grid */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-gold" style={{ height: 100, borderRadius: 8 }} />
          ))}
        </div>
      ) : boards && boards.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {boards.map(b => (
            <BoardCardItem key={b.id} board={b} onSelect={() => onSelectBoard(b.id)} />
          ))}
        </div>
      ) : (
        <div
          style={{
            border:       "1px dashed rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding:      "60px 32px",
            textAlign:    "center",
            color:        "rgba(255,255,255,0.35)",
          }}
        >
          <FolderOpen size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <p style={{ fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            No boards yet
          </p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Create your first board to start organizing work.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            style={{ marginTop: 16, background: "#D4A017", color: "#000", fontFamily: "var(--font-heading)", letterSpacing: "0.1em", fontSize: 11 }}
            size="sm"
          >
            <Plus size={14} className="mr-1" />
            New Board
          </Button>
        </div>
      )}

      <CreateBoardModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
