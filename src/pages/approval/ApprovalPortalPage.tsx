// Customer approval public portal — NO AUTH REQUIRED
// Loaded via /approval/:token — outside the ProtectedRoute wrapper.
//
// Renders a tokenized quote or change-order approval request. The customer
// reviews each line item, toggles accept / decline, draws their signature,
// and submits. All state is in this single component; the state machine
// mirrors ExternalResponsePage (loading → form → submitting → submitted).

import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { CheckCircle2, AlertCircle, Clock, Check, X } from "lucide-react"
import { SignatureCanvas, type SignatureCanvasHandle } from "@/components/approvals/SignatureCanvas"

const BASE = "/.netlify/functions"

type PageState =
  | "loading"
  | "form"
  | "submitting"
  | "submitted"
  | "already_submitted"
  | "expired"
  | "revoked"
  | "not_found"
  | "error"

type PdfItem = {
  itemNumber:          number
  category:            string
  discrepancy:         string
  correctiveAction:    string
  discrepancyType?:    "airworthy" | "recommendation" | null
  sourceInspection?:   string | null
  estimatedHours:      number
  laborRate:           number
  partsTotal:          number
  shippingCost:        number
  outsideServicesCost: number
  lineTotal:           number
  attachmentIds?:      string[]
}

type Snapshot = {
  documentNumber:       string
  aircraftRegistration: string
  aircraftSerial?:      string | null
  description?:         string | null
  parentWoNumber?:      string | null
  items:                PdfItem[]
}

type LoadedPayload = {
  state:    "ready" | "already_submitted" | "expired" | "revoked"
  kind:     "quote" | "change_order"
  snapshot: Snapshot
  total:    number
  recipient: { name: string; email: string }
}

type ItemDecision = "pending" | "approved" | "declined"

function currency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

export default function ApprovalPortalPage() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>("loading")
  const [payload, setPayload]     = useState<LoadedPayload | null>(null)

  // Note: the server holds wo_item_id in the authed DB but the public snapshot
  // only carries itemNumber. The submit function matches by itemNumber; we
  // send a synthetic woItemId that the public function looks up server-side.
  // For now decisions are keyed by itemNumber.
  const [decisions, setDecisions] = useState<Record<number, ItemDecision>>({})

  const [signerName,  setSignerName]  = useState("")
  const [signerEmail, setSignerEmail] = useState("")
  const [signerTitle, setSignerTitle] = useState("")
  const [hasInk, setHasInk] = useState(false)
  const signatureRef = useRef<SignatureCanvasHandle | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setPageState("not_found"); return }
    void loadRequest(token)
  }, [token])

  async function loadRequest(t: string) {
    try {
      const res = await fetch(`${BASE}/bb-approval-public?token=${encodeURIComponent(t)}`)
      const data = await res.json()
      if (!res.ok) { setPageState("not_found"); return }

      if (data.state === "expired")           { setPageState("expired"); return }
      if (data.state === "revoked")           { setPageState("revoked"); return }
      if (data.state === "already_submitted") { setPageState("already_submitted"); return }

      setPayload(data as LoadedPayload)
      setSignerName(data.recipient?.name ?? "")
      setSignerEmail(data.recipient?.email ?? "")
      // Default every item to pending
      const initial: Record<number, ItemDecision> = {}
      for (const it of (data.snapshot?.items ?? []) as PdfItem[]) initial[it.itemNumber] = "pending"
      setDecisions(initial)
      setPageState("form")
    } catch {
      setPageState("error")
    }
  }

  function setDecision(itemNumber: number, d: ItemDecision) {
    setDecisions(prev => ({ ...prev, [itemNumber]: d }))
  }

  function setAll(d: ItemDecision) {
    if (!payload) return
    const next: Record<number, ItemDecision> = {}
    for (const it of payload.snapshot.items) next[it.itemNumber] = d
    setDecisions(next)
  }

  const canSubmit =
    payload !== null &&
    signerName.trim().length > 0 &&
    signerEmail.trim().length > 0 &&
    hasInk &&
    Object.values(decisions).every(d => d === "approved" || d === "declined")

  async function handleSubmit() {
    if (!token || !payload || !canSubmit || !signatureRef.current) return
    setErrorMsg(null)
    setPageState("submitting")

    const signatureImageDataUrl = signatureRef.current.toPNGDataUrl()
    // The submit function resolves woItemId from the stored snapshot by
    // itemNumber — the portal only knows the display numbers.
    const submitDecisions = payload.snapshot.items.map(it => ({
      itemNumber: it.itemNumber,
      decision:   decisions[it.itemNumber],
    }))

    try {
      const res = await fetch(`${BASE}/bb-approval-submit`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signerName:            signerName.trim(),
          signerEmail:           signerEmail.trim().toLowerCase(),
          signerTitle:           signerTitle.trim() || null,
          signatureImageDataUrl,
          decisions:             submitDecisions,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409) { setPageState("already_submitted"); return }
      if (res.status === 410) { setPageState("expired"); return }
      if (!res.ok) throw new Error(data.error ?? "Submit failed")
      setPageState("submitted")
    } catch (err) {
      setErrorMsg((err as Error).message)
      setPageState("form")
    }
  }

  // ── Derived totals ────────────────────────────────────────────────────────

  const approvedTotal = payload
    ? payload.snapshot.items
        .filter(it => decisions[it.itemNumber] === "approved")
        .reduce((a, it) => a + it.lineTotal, 0)
    : 0
  const declinedTotal = payload
    ? payload.snapshot.items
        .filter(it => decisions[it.itemNumber] === "declined")
        .reduce((a, it) => a + it.lineTotal, 0)
    : 0

  // ── Render states ─────────────────────────────────────────────────────────

  if (pageState === "loading") return <Shell><LoadingCard /></Shell>

  if (pageState === "not_found" || pageState === "error") {
    return <Shell><StatusCard icon={<AlertCircle className="w-8 h-8 text-red-400" />} title="Not Found" message="This approval link doesn't exist or has been removed." /></Shell>
  }
  if (pageState === "expired") {
    return <Shell><StatusCard icon={<Clock className="w-8 h-8" style={{ color: "#d4a017" }} />} title="Link Expired" message="This approval link has expired. Please contact the sender for a new one." /></Shell>
  }
  if (pageState === "revoked") {
    return <Shell><StatusCard icon={<AlertCircle className="w-8 h-8 text-red-400" />} title="Revoked" message="This approval has been revoked." /></Shell>
  }
  if (pageState === "already_submitted") {
    return <Shell><StatusCard icon={<CheckCircle2 className="w-8 h-8 text-green-400" />} title="Already Signed" message="A response has already been submitted. You can close this window." /></Shell>
  }
  if (pageState === "submitted") {
    return <Shell><StatusCard icon={<CheckCircle2 className="w-8 h-8 text-green-400" />} title="Thank You" message="Your response has been recorded. A signed copy will be sent to you shortly." accent /></Shell>
  }
  if (!payload) return null

  const isSubmitting = pageState === "submitting"
  const label = payload.kind === "change_order" ? "Change Order" : "Quote"

  return (
    <Shell>
      <div className="rounded-lg overflow-hidden w-full" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ height: "4px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />
        <div className="p-6 space-y-6" style={{ background: "#1a1a1a" }}>
          {/* Brand */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: "#d4a017", borderBottom: "1px solid #d4a017", paddingBottom: "2px" }}>SKYSHARE MX</span>
              <span className="ml-2 text-[10px] tracking-[0.18em] uppercase" style={{ color: "rgba(255,255,255,0.28)" }}>Maintenance Portal</span>
            </div>
            <div className="text-right">
              <div className="text-[9px] tracking-[0.2em] uppercase font-bold" style={{ color: "#d4a017" }}>{label}</div>
              <div className="text-sm font-bold tracking-[0.1em]" style={{ color: "#fff" }}>{payload.snapshot.documentNumber}</div>
            </div>
          </div>

          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-normal italic" style={{ fontFamily: "Georgia, serif", color: "#fff", lineHeight: 1.2 }}>
              Hi {payload.recipient.name},
            </h1>
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              Please review each item and accept or decline, then sign at the bottom.
            </p>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-3 gap-3">
            <MetaCell label="Aircraft" value={`${payload.snapshot.aircraftRegistration}${payload.snapshot.aircraftSerial ? ` · ${payload.snapshot.aircraftSerial}` : ""}`} />
            {payload.snapshot.parentWoNumber
              ? <MetaCell label="Parent WO" value={payload.snapshot.parentWoNumber} />
              : <MetaCell label="Items" value={String(payload.snapshot.items.length)} />}
            <MetaCell label="Total" value={currency(payload.total)} highlight />
          </div>

          {payload.snapshot.description && (
            <p className="text-sm pl-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)", borderLeft: "2px solid rgba(212,160,23,0.35)" }}>
              {payload.snapshot.description}
            </p>
          )}

          {/* Select all */}
          <div className="flex items-center justify-between">
            <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>Line Items</div>
            <div className="flex items-center gap-3">
              <button onClick={() => setAll("approved")} className="text-[10px] uppercase tracking-widest hover:opacity-80" style={{ color: "#10b981" }}>Accept All</button>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
              <button onClick={() => setAll("declined")} className="text-[10px] uppercase tracking-widest hover:opacity-80" style={{ color: "#c10230" }}>Decline All</button>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {payload.snapshot.items.map(it => (
              <ItemRow
                key={it.itemNumber}
                item={it}
                token={token!}
                decision={decisions[it.itemNumber] ?? "pending"}
                onDecide={(d) => setDecision(it.itemNumber, d)}
                disabled={isSubmitting}
              />
            ))}
          </div>

          {/* Running totals */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <TotalCell label="Approved" value={currency(approvedTotal)} color="#10b981" />
            <TotalCell label="Declined" value={currency(declinedTotal)} color="#c10230" />
            <TotalCell label="Net" value={currency(approvedTotal)} color="#d4a017" emphasis />
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

          {/* Signer fields */}
          <div className="space-y-3">
            <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.35)" }}>Your Details</div>
            <Input value={signerName}  onChange={setSignerName}  placeholder="Full Name" disabled={isSubmitting} />
            <Input value={signerEmail} onChange={setSignerEmail} placeholder="Email"     disabled={isSubmitting} type="email" />
            <Input value={signerTitle} onChange={setSignerTitle} placeholder="Title (optional)" disabled={isSubmitting} />
          </div>

          {/* Signature */}
          <SignatureCanvas
            onReady={(h) => { signatureRef.current = h }}
            onChange={setHasInk}
            height={180}
          />

          {errorMsg && (
            <div className="text-xs text-red-400">{errorMsg}</div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="w-full rounded-md py-3.5 text-sm font-bold uppercase tracking-widest transition-opacity disabled:opacity-40"
            style={{ background: "#d4a017", color: "#111", fontFamily: "Montserrat, Arial, sans-serif", letterSpacing: "0.15em" }}
          >
            {isSubmitting ? "Submitting…" : "Sign & Submit →"}
          </button>

          <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} SkyShare · Maintenance Portal
          </p>
        </div>
      </div>
    </Shell>
  )
}

// ─── Item row ──────────────────────────────────────────────────────────────

function ItemRow({
  item,
  token,
  decision,
  onDecide,
  disabled,
}: {
  item: PdfItem
  token: string
  decision: ItemDecision
  onDecide: (d: ItemDecision) => void
  disabled: boolean
}) {
  const accepted = decision === "approved"
  const declined = decision === "declined"
  const borderColor =
    accepted ? "rgba(16,185,129,0.45)"
    : declined ? "rgba(193,2,48,0.45)"
    : "rgba(255,255,255,0.1)"

  return (
    <div className="rounded-md p-4" style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${borderColor}` }}>
      <div className="flex items-start gap-3">
        <div className="text-[10px] font-mono font-bold mt-0.5" style={{ color: "rgba(212,160,23,0.7)", minWidth: 22 }}>
          #{item.itemNumber}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>
                {item.category}
              </div>
              {item.discrepancyType && (
                <div
                  className="inline-block mt-1 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                  style={{
                    color: item.discrepancyType === "airworthy" ? "#c10230" : "#d4a017",
                    background: item.discrepancyType === "airworthy" ? "rgba(193,2,48,0.12)" : "rgba(212,160,23,0.12)",
                  }}
                >
                  {item.discrepancyType === "airworthy" ? "Airworthy" : "Recommendation"}
                </div>
              )}
              <div className="text-sm text-white mt-1">{item.discrepancy || "—"}</div>
              {item.correctiveAction && (
                <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Action: {item.correctiveAction}
                </div>
              )}
              {item.sourceInspection && (
                <div className="text-[10px] italic mt-1" style={{ color: "rgba(212,160,23,0.55)" }}>
                  From inspection: {item.sourceInspection}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold" style={{ color: "#fff" }}>{currency(item.lineTotal)}</div>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                {item.estimatedHours.toFixed(1)}h × {currency(item.laborRate)}
              </div>
            </div>
          </div>

          {item.attachmentIds && item.attachmentIds.length > 0 && (
            <PhotoStrip token={token} attachmentIds={item.attachmentIds} />
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              disabled={disabled}
              onClick={() => onDecide("approved")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40"
              style={{
                background: accepted ? "#10b981" : "rgba(16,185,129,0.1)",
                color:      accepted ? "#111"    : "#10b981",
                border:     `1px solid ${accepted ? "#10b981" : "rgba(16,185,129,0.3)"}`,
              }}
            >
              <Check className="h-3 w-3" />
              Accept
            </button>
            <button
              disabled={disabled}
              onClick={() => onDecide("declined")}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40"
              style={{
                background: declined ? "#c10230" : "rgba(193,2,48,0.1)",
                color:      declined ? "#fff"    : "#ff8594",
                border:     `1px solid ${declined ? "#c10230" : "rgba(193,2,48,0.35)"}`,
              }}
            >
              <X className="h-3 w-3" />
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Photo strip ───────────────────────────────────────────────────────────

function PhotoStrip({ token, attachmentIds }: { token: string; attachmentIds: string[] }) {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const results: Record<string, string | null> = {}
      await Promise.all(
        attachmentIds.map(async (id) => {
          try {
            const res = await fetch(
              `${BASE}/bb-wo-attachment-public-url?token=${encodeURIComponent(token)}&attachmentId=${encodeURIComponent(id)}`
            )
            if (res.ok) {
              const data = await res.json()
              results[id] = data.url ?? null
            } else {
              results[id] = null
            }
          } catch {
            results[id] = null
          }
        })
      )
      if (!cancelled) setUrls(results)
    }
    void load()
    return () => { cancelled = true }
  }, [token, attachmentIds.join(",")])

  const loaded = attachmentIds.filter(id => urls[id])
  if (attachmentIds.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-1">
        {attachmentIds.map(id => {
          const url = urls[id]
          if (url === undefined) {
            // still loading
            return (
              <div
                key={id}
                className="rounded"
                style={{ width: 64, height: 64, background: "rgba(255,255,255,0.06)", animation: "pulse 1.5s ease-in-out infinite" }}
              />
            )
          }
          if (!url) return null
          return (
            <button
              key={id}
              type="button"
              onClick={() => setLightbox(url)}
              className="rounded overflow-hidden transition-opacity hover:opacity-80"
              style={{ width: 64, height: 64, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}
            >
              <img src={url} alt="discrepancy photo" className="w-full h-full object-cover" />
            </button>
          )
        })}
        {loaded.length > 0 && (
          <div className="self-end text-[9px] tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>
            {loaded.length} photo{loaded.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.88)" }}
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="discrepancy photo"
            className="max-w-full max-h-full rounded-lg"
            style={{ boxShadow: "0 0 40px rgba(0,0,0,0.8)" }}
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl leading-none"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

// ─── Small building blocks ─────────────────────────────────────────────────

function MetaCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded px-3 py-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[9px] uppercase tracking-widest" style={{ color: "#d4a017" }}>{label}</div>
      <div className="text-sm mt-1" style={{ color: highlight ? "#d4a017" : "rgba(255,255,255,0.85)", fontWeight: highlight ? 700 : 500 }}>
        {value}
      </div>
    </div>
  )
}

function TotalCell({ label, value, color, emphasis }: { label: string; value: string; color: string; emphasis?: boolean }) {
  return (
    <div className="rounded px-3 py-2" style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${color}33` }}>
      <div className="text-[9px] uppercase tracking-widest" style={{ color: `${color}cc` }}>{label}</div>
      <div className="mt-1" style={{ color, fontWeight: emphasis ? 800 : 700, fontSize: emphasis ? "15px" : "13px" }}>
        {value}
      </div>
    </div>
  )
}

function Input({
  value, onChange, placeholder, disabled, type = "text",
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled: boolean
  type?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      type={type}
      className="w-full rounded-md px-3 py-2.5 text-sm outline-none disabled:opacity-50"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.9)",
      }}
    />
  )
}

// ─── Layout wrappers ───────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-start justify-center px-4 py-8" style={{ background: "#111111" }}>
      <div className="w-full max-w-xl">{children}</div>
    </div>
  )
}

function StatusCard({
  icon, title, message, accent,
}: {
  icon: React.ReactNode
  title: string
  message: string
  accent?: boolean
}) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ height: "4px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />
      <div className="p-8 flex flex-col items-center text-center space-y-4" style={{ background: "#1a1a1a" }}>
        {icon}
        <h2 className="text-xl font-normal italic" style={{ fontFamily: "Georgia, serif", color: "#fff" }}>{title}</h2>
        <p className="text-sm max-w-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{message}</p>
        {accent && <div style={{ height: 1, width: 40, background: "#d4a017" }} />}
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>
          © {new Date().getFullYear()} SkyShare · Maintenance Portal
        </p>
      </div>
    </div>
  )
}

function LoadingCard() {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <div style={{ height: "4px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />
      <div className="p-8 flex items-center justify-center" style={{ background: "#1a1a1a" }}>
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#d4a017", borderTopColor: "transparent" }} />
      </div>
    </div>
  )
}
