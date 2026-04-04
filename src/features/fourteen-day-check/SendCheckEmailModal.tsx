// SendCheckEmailModal — sends the permanent 14-day check link to a mechanic's email.

import { useState } from "react"
import { X, Mail, Check, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Props = {
  registration: string
  encodedToken: string
  onClose: () => void
}

export function SendCheckEmailModal({ registration, encodedToken, onClose }: Props) {
  const [recipientName, setRecipientName]   = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [sending, setSending]               = useState(false)
  const [sent, setSent]                     = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  async function handleSend() {
    if (!recipientName.trim() || !recipientEmail.trim()) return
    setError(null)
    setSending(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")

      const res = await fetch("/.netlify/functions/fourteen-day-check-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ encodedToken, recipientName, recipientEmail }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to send email")

      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative rounded-xl overflow-hidden w-full max-w-sm"
          style={{
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: "rgba(212,160,23,0.7)" }}>
                14-Day Check · {registration}
              </p>
              <p className="text-base font-semibold mt-0.5" style={{ color: "#fff" }}>
                {sent ? "Link Sent" : "Send Check Link"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md"
              style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {sent ? (
            /* Success state */
            <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#fff" }}>
                  Check link sent to {recipientName}
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {recipientEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-md text-sm font-medium mt-2"
                style={{
                  background: "rgba(212,160,23,0.12)",
                  border: "1px solid rgba(212,160,23,0.3)",
                  color: "#d4a017",
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* Form */
            <div className="px-5 py-5 space-y-4">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                The mechanic will receive the permanent checklist link by email. No login required on their end.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Mechanic name <span style={{ color: "#d4a017" }}>*</span>
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="John Martinez"
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                  onKeyDown={e => { if (e.key === "Enter") handleSend() }}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Email address <span style={{ color: "#d4a017" }}>*</span>
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="mechanic@example.com"
                  className="w-full rounded-md px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                  onKeyDown={e => { if (e.key === "Enter") handleSend() }}
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-md text-sm transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!recipientName.trim() || !recipientEmail.trim() || sending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all disabled:opacity-40"
                  style={{
                    background: "rgba(212,160,23,0.15)",
                    border: "1px solid rgba(212,160,23,0.35)",
                    color: "#d4a017",
                  }}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  {sending ? "Sending…" : "Send Link"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={onClose}
      />
    </>
  )
}
