import { useState } from "react"
import { toast } from "sonner"
import { Send } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Textarea } from "@/shared/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { FieldBuilder } from "./FieldBuilder"
import { createExternalRequest, sendExternalRequest } from "@/hooks/useExternalRequestActions"
import { useInvalidateExternalRequests } from "@/hooks/useExternalRequests"
import type { FieldDef } from "@/entities/supabase"

export type CreateRequestOptions = {
  parentType?: string
  parentId?: string
  parentLabel?: string
  prefill?: {
    recipientName?: string
    recipientEmail?: string
    title?: string
  }
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  options?: CreateRequestOptions
}

export function CreateRequestModal({ open, onClose, onSuccess, options }: Props) {
  const invalidate = useInvalidateExternalRequests()

  const [title, setTitle] = useState(options?.prefill?.title ?? "")
  const [instructions, setInstructions] = useState("")
  const [recipientName, setRecipientName] = useState(options?.prefill?.recipientName ?? "")
  const [recipientEmail, setRecipientEmail] = useState(options?.prefill?.recipientEmail ?? "")
  const [expiresAt, setExpiresAt] = useState("")
  const [fields, setFields] = useState<FieldDef[]>([])
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitle(options?.prefill?.title ?? "")
    setInstructions("")
    setRecipientName(options?.prefill?.recipientName ?? "")
    setRecipientEmail(options?.prefill?.recipientEmail ?? "")
    setExpiresAt("")
    setFields([])
    setSaving(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSend() {
    if (!title.trim()) return toast.error("Title is required")
    if (!recipientName.trim()) return toast.error("Recipient name is required")
    if (!recipientEmail.trim() || !recipientEmail.includes("@")) return toast.error("Valid email is required")
    if (fields.length === 0) return toast.error("Add at least one field")
    if (fields.some(f => !f.label.trim())) return toast.error("All fields must have a label")

    setSaving(true)
    try {
      const { id } = await createExternalRequest({
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        fieldSchema: fields,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        expiresAt: expiresAt || undefined,
        parentType: options?.parentType,
        parentId: options?.parentId,
        parentLabel: options?.parentLabel,
      })
      await sendExternalRequest(id)
      toast.success("Request sent successfully")
      invalidate()
      reset()
      onSuccess?.()
      onClose()
    } catch (err) {
      toast.error((err as Error).message || "Failed to send request")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent
        className="max-w-xl max-h-[90vh] overflow-y-auto"
        style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="w-4 h-4" style={{ color: "var(--skyshare-gold)" }} />
            New External Request
            {options?.parentLabel && (
              <span
                className="ml-2 text-xs font-normal px-2 py-0.5 rounded"
                style={{ background: "rgba(212,160,23,0.1)", color: "rgba(212,160,23,0.8)", border: "1px solid rgba(212,160,23,0.2)" }}
              >
                {options.parentLabel}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Recipient */}
          <div
            className="rounded-md p-3 space-y-3"
            style={{ background: "hsl(0 0% 9%)", border: "1px solid hsl(0 0% 16%)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }}>
              Recipient
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="John Smith"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Request details */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Request Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Aircraft Status Check — N863CB"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instructions <span className="opacity-40">(optional)</span></Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Additional context or instructions for the recipient…"
                rows={3}
                className="text-xs resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date <span className="opacity-40">(optional)</span></Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="h-8 text-xs w-44"
              />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }}>
              Request Fields
            </p>
            <FieldBuilder fields={fields} onChange={setFields} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1 border-t" style={{ borderColor: "hsl(0 0% 16%)" }}>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={saving}
              className="gap-1.5"
              style={{ background: "var(--skyshare-gold)", color: "#111" }}
            >
              <Send className="w-3.5 h-3.5" />
              {saving ? "Sending…" : "Send Request"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
