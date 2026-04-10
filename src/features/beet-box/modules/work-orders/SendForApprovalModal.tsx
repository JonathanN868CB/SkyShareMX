import { useState } from "react"
import { Mail, Loader2, AlertTriangle, Send } from "lucide-react"
import {
  sendQuoteForApproval,
  sendChangeOrderForApproval,
  type SendForApprovalPayload,
} from "../../services/quoteApprovals"
import type { ApprovalKind } from "../../types"

interface Props {
  open:        boolean
  onClose:     () => void
  onSent:      () => void
  workOrderId: string
  workOrderNumber: string
  kind:        ApprovalKind
  defaultRecipientName?:  string
  defaultRecipientEmail?: string
}

export function SendForApprovalModal({
  open,
  onClose,
  onSent,
  workOrderId,
  workOrderNumber,
  kind,
  defaultRecipientName,
  defaultRecipientEmail,
}: Props) {
  const [recipientName,  setRecipientName]  = useState(defaultRecipientName  ?? "")
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail ?? "")
  const [expiresIn,      setExpiresIn]      = useState<"none" | "7" | "14" | "30">("30")
  const [message,        setMessage]        = useState("")
  const [sending,        setSending]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  if (!open) return null

  const docLabel  = kind === "quote" ? "Quote" : "Change Order"
  const accentHex = kind === "quote" ? "#a78bfa" : "#fbbf24"

  const canSend =
    recipientName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()) &&
    !sending

  async function handleSend() {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      const expiresAt = (() => {
        if (expiresIn === "none") return undefined
        const days = Number(expiresIn)
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      })()

      const payload: Omit<SendForApprovalPayload, "kind"> = {
        workOrderId,
        recipientName:  recipientName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        expiresAt,
        message: message.trim() || undefined,
      }

      if (kind === "quote") await sendQuoteForApproval(payload)
      else                  await sendChangeOrderForApproval(payload)

      onSent()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send for approval")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }}>
      <div
        className="rounded-2xl p-7 max-w-md w-full mx-4 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ background: "hsl(0,0%,12%)", border: `1px solid ${accentHex}55` }}
      >
        <div>
          <h3
            className="text-white text-xl font-bold mb-1 flex items-center gap-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <Mail className="w-5 h-5" style={{ color: accentHex }} />
            Send {docLabel} for Approval
          </h3>
          <p className="text-white/45 text-sm leading-relaxed">
            A secure link will be emailed to the recipient. They can accept or decline each item and sign to finalize.
          </p>
          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/35">
            {docLabel} {workOrderNumber}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
              Recipient Name
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,22%)" }}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
              Recipient Email
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              placeholder="customer@company.com"
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,22%)" }}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
              Link Expires
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                { v: "7",    l: "7 days"  },
                { v: "14",   l: "14 days" },
                { v: "30",   l: "30 days" },
                { v: "none", l: "Never"   },
              ] as const).map(opt => {
                const active = expiresIn === opt.v
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setExpiresIn(opt.v)}
                    className="py-2 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: active ? `${accentHex}22` : "hsl(0,0%,9%)",
                      border:     `1px solid ${active ? accentHex + "66" : "hsl(0,0%,22%)"}`,
                      color:      active ? accentHex : "rgba(255,255,255,0.55)",
                    }}
                  >
                    {opt.l}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a short note that will appear in the email body…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
              style={{ background: "hsl(0,0%,9%)", border: "1px solid hsl(0,0%,22%)" }}
            />
          </div>
        </div>

        {error && (
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: canSend ? `${accentHex}22` : "hsl(0,0%,14%)",
              border:     `1px solid ${canSend ? accentHex + "66" : "hsl(0,0%,20%)"}`,
              color:      canSend ? accentHex : "rgba(255,255,255,0.3)",
              cursor:     canSend ? "pointer" : "not-allowed",
            }}
          >
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              : <><Send className="w-4 h-4" /> Send for Approval</>}
          </button>
          <button
            onClick={onClose}
            disabled={sending}
            className="px-5 py-2.5 rounded-xl text-sm text-white/45 hover:text-white/70 transition-colors"
            style={{ border: "1px solid hsl(0,0%,26%)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default SendForApprovalModal
