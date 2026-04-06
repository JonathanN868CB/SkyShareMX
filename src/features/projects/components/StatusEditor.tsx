import { useState } from "react"
import { X, Plus, Trash2, GripVertical, Check } from "lucide-react"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
import type { PmStatus } from "@/entities/supabase"
import { useStatusMutations } from "../hooks/useBoard"

const STATUS_COLORS = [
  "#6b7280","#3b82f6","#8b5cf6","#ec4899","#f59e0b","#ef4444","#10b981","#06b6d4","#f97316","#84cc16",
]

interface StatusEditorProps {
  boardId:  string
  statuses: PmStatus[]
  onClose:  () => void
}

export function StatusEditor({ boardId, statuses, onClose }: StatusEditorProps) {
  const { createStatus, updateStatus, deleteStatus } = useStatusMutations(boardId)
  const [newLabel, setNewLabel] = useState("")
  const [newColor, setNewColor] = useState(STATUS_COLORS[0])
  const [editing,  setEditing]  = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")

  async function handleCreate() {
    if (!newLabel.trim()) return
    await createStatus.mutateAsync({ label: newLabel.trim(), color: newColor })
    setNewLabel(""); setNewColor(STATUS_COLORS[0])
  }

  function startEdit(s: PmStatus) {
    setEditing(s.id); setEditLabel(s.label)
  }

  async function saveEdit(s: PmStatus) {
    if (editLabel.trim() && editLabel !== s.label) {
      await updateStatus.mutateAsync({ id: s.id, label: editLabel.trim() })
    }
    setEditing(null)
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{
        position: "relative", zIndex: 501,
        background: "hsl(0 0% 14%)", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, width: 380, maxHeight: "70vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
      }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#fff" }}>
            Customize Statuses
          </span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {statuses.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              {editing === s.id ? (
                <Input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onBlur={() => saveEdit(s)}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(s); if (e.key === "Escape") setEditing(null) }}
                  autoFocus
                  style={{ flex: 1, height: 28, fontSize: 12, background: "hsl(0 0% 18%)", border: "1px solid rgba(212,160,23,0.3)", color: "#fff" }}
                />
              ) : (
                <span
                  onDoubleClick={() => startEdit(s)}
                  style={{ flex: 1, fontSize: 12, color: "#fff", cursor: "default" }}
                >
                  {s.label}
                </span>
              )}
              {/* Color swatches for editing */}
              <div style={{ display: "flex", gap: 3 }}>
                {STATUS_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => updateStatus.mutate({ id: s.id, color: c })}
                    style={{
                      width: 12, height: 12, borderRadius: "50%", background: c, border: s.color === c ? "1.5px solid #D4A017" : "1.5px solid transparent",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => deleteStatus.mutate(s.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: 2 }}
                className="hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Add new status */}
        <div style={{ padding: "12px 24px 20px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ fontFamily: "var(--font-heading)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 8px" }}>
            Add Status
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Label…"
              onKeyDown={e => { if (e.key === "Enter") handleCreate() }}
              style={{ flex: 1, height: 30, fontSize: 12, background: "hsl(0 0% 16%)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
            <div style={{ display: "flex", gap: 3 }}>
              {STATUS_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 14, height: 14, borderRadius: "50%", background: c,
                    border: newColor === c ? "1.5px solid #D4A017" : "1.5px solid transparent",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
            <button
              onClick={handleCreate}
              disabled={!newLabel.trim() || createStatus.isPending}
              style={{ background: "#D4A017", border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer", color: "#000", fontFamily: "var(--font-heading)", fontSize: 10, letterSpacing: "0.1em" }}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
