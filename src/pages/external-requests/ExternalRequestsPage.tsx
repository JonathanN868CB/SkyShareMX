import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Send, Plus, Mail, CheckCircle2 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { RequestStatusBadge } from "@/components/external-requests/RequestStatusBadge"
import { CreateRequestModal } from "@/components/external-requests/CreateRequestModal"
import { useExternalRequests } from "@/hooks/useExternalRequests"
import type { ExternalRequest } from "@/entities/supabase"

export default function ExternalRequestsPage() {
  const navigate = useNavigate()
  const { data: requests, isLoading, error } = useExternalRequests()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5" style={{ color: "var(--skyshare-gold)" }} />
          <div>
            <h1
              className="text-2xl font-bold tracking-wide"
              style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
            >
              External Requests
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              Send structured requests to external contacts
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 text-xs"
          style={{ background: "var(--skyshare-gold)", color: "#111" }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Request
        </Button>
      </div>

      {/* Content */}
      <div>
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--skyshare-gold)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 py-4">Failed to load requests.</div>
        )}

        {!isLoading && !error && (!requests || requests.length === 0) && (
          <EmptyState onNew={() => setCreateOpen(true)} />
        )}

        {!isLoading && requests && requests.length > 0 && (
          <div className="space-y-2">
            {requests.map((req) => (
              <RequestRow
                key={req.id}
                request={req}
                onClick={() => navigate(`/app/external-requests/${req.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function RequestRow({ request, onClick }: { request: ExternalRequest; onClick: () => void }) {
  const fieldCount = request.field_schema?.length ?? 0
  const hasAttachmentFields = request.field_schema?.some(
    f => f.type === "photo" || f.type === "file"
  ) ?? false

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md px-4 py-3.5 transition-colors group"
      style={{
        background: "hsl(0 0% 11%)",
        border: "1px solid hsl(0 0% 16%)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(212,160,23,0.25)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "hsl(0 0% 16%)")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-sm font-medium truncate"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              {request.title}
            </span>
            {request.parent_label && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                style={{
                  background: "rgba(212,160,23,0.1)",
                  color: "rgba(212,160,23,0.7)",
                  border: "1px solid rgba(212,160,23,0.2)",
                }}
              >
                {request.parent_label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              To: {request.recipient_name}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {fieldCount} field{fieldCount !== 1 ? "s" : ""}
              {hasAttachmentFields ? " · photo/file" : ""}
            </span>
            {request.sent_at && (
              <>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                <span className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <Mail className="w-3 h-3" />
                  {new Date(request.sent_at).toLocaleDateString()}
                </span>
              </>
            )}
            {request.submitted_at && (
              <>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                <span className="text-xs flex items-center gap-1 text-green-400 opacity-70">
                  <CheckCircle2 className="w-3 h-3" />
                  {new Date(request.submitted_at).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          <RequestStatusBadge status={request.status} />
        </div>
      </div>
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Send className="w-10 h-10 mb-4 opacity-20" style={{ color: "var(--skyshare-gold)" }} />
      <h3
        className="text-sm font-semibold mb-2"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        No external requests yet
      </h3>
      <p className="text-xs mb-5 max-w-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
        Send a structured request to a pilot, vendor, or mechanic. They respond via a link — no login required.
      </p>
      <Button
        size="sm"
        onClick={onNew}
        className="gap-1.5 text-xs"
        style={{ background: "var(--skyshare-gold)", color: "#111" }}
      >
        <Plus className="w-3.5 h-3.5" />
        Create First Request
      </Button>
    </div>
  )
}
