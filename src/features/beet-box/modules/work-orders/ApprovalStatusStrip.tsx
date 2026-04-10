import { useEffect, useState } from "react"
import {
  CheckCircle2, XCircle, Clock, Download, Loader2, Mail, AlertTriangle,
} from "lucide-react"
import {
  getLatestApprovalForWorkOrder,
  getApprovalPdfUrl,
  type ApprovalBundle,
} from "../../services/quoteApprovals"

interface Props {
  workOrderId: string
  /** Bumped by parent when a new approval is sent so the strip reloads. */
  refreshKey?: number
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    })
  } catch { return iso }
}

export function ApprovalStatusStrip({ workOrderId, refreshKey = 0 }: Props) {
  const [bundle,  setBundle]  = useState<ApprovalBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState<"unsigned" | "signed" | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getLatestApprovalForWorkOrder(workOrderId)
      .then(res => { if (!cancelled) setBundle(res) })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load approval") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [workOrderId, refreshKey])

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 px-5 py-2.5"
        style={{ background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,17%)" }}
      >
        <Loader2 className="w-3.5 h-3.5 text-white/35 animate-spin" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">Loading approval…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="flex items-center gap-2 px-5 py-2.5"
        style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.25)" }}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-red-300/80">{error}</span>
      </div>
    )
  }

  if (!bundle) return null

  const { request, submission, decisions } = bundle
  const approvedCount = decisions.filter(d => d.decision === "approved").length
  const declinedCount = decisions.filter(d => d.decision === "declined").length
  const signed        = submission != null
  const expired       = request.expiresAt ? new Date(request.expiresAt) < new Date() : false

  // Color accent based on state
  let accent = "#a78bfa"
  let label  = "Awaiting Customer"
  let Icon   = Clock
  if (request.status === "revoked") {
    accent = "#a1a1aa"; label = "Revoked"; Icon = XCircle
  } else if (expired && request.status !== "submitted") {
    accent = "#fcd34d"; label = "Expired"; Icon = AlertTriangle
  } else if (signed) {
    if (declinedCount > 0 && approvedCount === 0) {
      accent = "#fca5a5"; label = "All Declined"; Icon = XCircle
    } else if (declinedCount > 0) {
      accent = "#6ee7b7"; label = "Partially Approved"; Icon = CheckCircle2
    } else {
      accent = "#6ee7b7"; label = "Customer Approved"; Icon = CheckCircle2
    }
  }

  async function openPdf(variant: "unsigned" | "signed") {
    setPdfLoading(variant)
    try {
      const url = await getApprovalPdfUrl(request.id, variant)
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      console.error("Failed to fetch approval PDF:", err)
    } finally {
      setPdfLoading(null)
    }
  }

  return (
    <div
      className="flex-shrink-0 flex items-stretch"
      style={{
        background: `linear-gradient(to right, ${accent}10, ${accent}05)`,
        borderBottom: `1px solid ${accent}33`,
      }}
    >
      <div
        className="px-5 py-2.5 flex items-center gap-2 flex-shrink-0"
        style={{ borderRight: `1px solid ${accent}22` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>

      <div className="flex-1 flex items-center gap-5 px-5 py-2.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Mail className="w-3 h-3 text-white/35" />
          <span className="text-[10px] uppercase tracking-wider text-white/40">Sent to</span>
          <span className="text-xs font-medium text-white/80">{request.recipientName}</span>
          <span className="text-[10px] text-white/35">({request.recipientEmail})</span>
        </div>

        <div className="w-px h-4 self-center" style={{ background: "rgba(255,255,255,0.08)" }} />

        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-white/40">Sent</span>
          <span className="text-xs font-medium text-white/70">{formatDate(request.sentAt)}</span>
        </div>

        {signed && submission && (
          <>
            <div className="w-px h-4 self-center" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/40">Signed</span>
              <span className="text-xs font-medium text-white/80">{submission.signerName}</span>
              <span className="text-[10px] text-white/35">· {formatDate(submission.submittedAt)}</span>
            </div>
          </>
        )}

        {signed && (approvedCount > 0 || declinedCount > 0) && (
          <>
            <div className="w-px h-4 self-center" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-xs font-bold tabular-nums text-emerald-300">{approvedCount}</span>
                <span className="text-[10px] text-white/40">approved</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-400" />
                <span className="text-xs font-bold tabular-nums text-red-300">{declinedCount}</span>
                <span className="text-[10px] text-white/40">declined</span>
              </div>
            </div>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => openPdf("unsigned")}
            disabled={pdfLoading !== null}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] uppercase tracking-[0.15em] font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border:     "1px solid rgba(255,255,255,0.12)",
              color:      "rgba(255,255,255,0.65)",
            }}
          >
            {pdfLoading === "unsigned"
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Download className="w-3 h-3" />}
            Unsigned PDF
          </button>
          {signed && submission?.signedPdfPath && (
            <button
              type="button"
              onClick={() => openPdf("signed")}
              disabled={pdfLoading !== null}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] uppercase tracking-[0.15em] font-semibold transition-all"
              style={{
                background: `${accent}18`,
                border:     `1px solid ${accent}55`,
                color:      accent,
              }}
            >
              {pdfLoading === "signed"
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Download className="w-3 h-3" />}
              Signed PDF
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ApprovalStatusStrip
