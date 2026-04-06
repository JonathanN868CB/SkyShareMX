import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
import { PM_BOARD_COLORS } from "@/entities/supabase"
import { useCreateBoard } from "../hooks/useBoards"

interface CreateBoardModalProps {
  open: boolean
  onClose: () => void
}

export function CreateBoardModal({ open, onClose }: CreateBoardModalProps) {
  const [name,  setName]  = useState("")
  const [color, setColor] = useState(PM_BOARD_COLORS[0].value)
  const [desc,  setDesc]  = useState("")
  const { mutateAsync: createBoard, isPending } = useCreateBoard()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createBoard({ name: name.trim(), color, description: desc.trim() || undefined })
    setName(""); setColor(PM_BOARD_COLORS[0].value); setDesc("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent
        style={{ background: "hsl(0 0% 14%)", border: "1px solid rgba(255,255,255,0.08)", maxWidth: 440 }}
      >
        <DialogHeader>
          <DialogTitle
            style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: "0.05em", color: "#fff" }}
          >
            NEW BOARD
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <label
              style={{ fontFamily: "var(--font-heading)", fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", display: "block", marginBottom: 6 }}
            >
              Board Name
            </label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Fleet Onboarding, Q2 Projects…"
              autoFocus
              style={{ background: "hsl(0 0% 18%)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>

          <div>
            <label
              style={{ fontFamily: "var(--font-heading)", fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", display: "block", marginBottom: 8 }}
            >
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PM_BOARD_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  style={{
                    width:        28,
                    height:       28,
                    borderRadius: "50%",
                    background:   c.value,
                    border:       color === c.value ? "2px solid #D4A017" : "2px solid transparent",
                    cursor:       "pointer",
                    transition:   "transform 0.1s",
                    outline:      "none",
                  }}
                  className="hover:scale-110"
                />
              ))}
            </div>
          </div>

          <div>
            <label
              style={{ fontFamily: "var(--font-heading)", fontSize: 10, letterSpacing: "0.15em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", display: "block", marginBottom: 6 }}
            >
              Description <span style={{ opacity: 0.5 }}>(optional)</span>
            </label>
            <Input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What is this board for?"
              style={{ background: "hsl(0 0% 18%)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isPending}
              style={{ background: "#D4A017", color: "#000", fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}
            >
              {isPending ? "Creating…" : "Create Board"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
