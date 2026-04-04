import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, Download, Trash2, CheckCircle2,
  Mail, FileText, Image, AlertCircle,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Textarea } from "@/shared/ui/textarea"
import { RequestStatusBadge } from "@/components/external-requests/RequestStatusBadge"
import {
  useExternalRequest,
  useExternalSubmission,
  useExternalAttachments,
  useInvalidateExternalRequests,
} from "@/hooks/useExternalRequests"
import {
  deleteExternalRequest,
  markExternalRequestReviewed,
  saveReviewNotes,
  getDownloadUrl,
} from "@/hooks/useExternalRequestActions"
import type { FieldDef, ExternalSubmissionAttachment } from "@/entities/supabase"
import { encodeToken } from "@/shared/lib/tokenEncoder"

export default function ExternalRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const invalidate = useInvalidateExternalRequests()

  const { data: request, isLoading, error } = useExternalRequest(id)
  const { data: submission } = useExternalSubmission(id)
  const { data: attachments } = useExternalAttachments(submission?.id)

  const [reviewNotes, setReviewNotes] = useState("")
  const [notesInitialized, setNotesInitialized] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [marking, setMarking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Initialize review notes from loaded data
  if (request && !notesInitialized) {
    setReviewNotes(request.review_notes ?? "")
    setNotesInitialized(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--skyshare-gold)", borderTopColor: "transparent" }}
        />
      </div>
    )
  }

  if (error || !request) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Request not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/external-requests")}>
          Back to requests
        </Button>
      </div>
    )
  }

  async function handleSaveNotes() {
    if (!request) return
    setSavingNotes(true)
    try {
      await saveReviewNotes(request.id, reviewNotes)
      toast.success("Notes saved")
      invalidate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleMarkReviewed() {
    if (!request) return
    setMarking(true)
    try {
      await markExternalRequestReviewed(request.id, reviewNotes)
      toast.success("Marked as reviewed")
      invalidate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setMarking(false)
    }
  }

  async function handleDelete() {
    if (!request) return
    if (!confirm(`Delete "${request.title}"? This will also remove all uploaded files and cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteExternalRequest(request.id)
      toast.success("Request deleted")
      invalidate()
      navigate("/app/external-requests")
    } catch (err) {
      toast.error((err as Error).message)
      setDeleting(false)
    }
  }

  async function handleDownload(attachment: ExternalSubmissionAttachment) {
    setDownloadingId(attachment.id)
    try {
      const url = await getDownloadUrl(attachment.storage_path)
      // Use _blank — a.download is blocked on cross-origin URLs (Supabase Storage)
      const a = document.createElement("a")
      a.href = url
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      a.click()
    } catch {
      toast.error("Could not generate download link")
    } finally {
      setDownloadingId(null)
    }
  }

  const fields: FieldDef[] = request.field_schema ?? []
  const fieldValues = submission?.field_values ?? {}
  const siteUrl = window.location.origin

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app/external-requests")}
            className="opacity-50 hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.9)" }}
            >
              {request.title}
            </span>
            {request.parent_label && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(212,160,23,0.1)",
                  color: "rgba(212,160,23,0.7)",
                  border: "1px solid rgba(212,160,23,0.2)",
                }}
              >
                {request.parent_label}
              </span>
            )}
            <RequestStatusBadge status={request.status} />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="gap-1.5 text-xs text-red-400 hover:text-red-300"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </div>

      {/* Content */}
      <div className="space-y-5">

        {/* Meta */}
        <div
          className="rounded-md p-4 grid grid-cols-2 gap-x-6 gap-y-3"
          style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 16%)" }}
        >
          <MetaRow label="Recipient" value={`${request.recipient_name} <${request.recipient_email}>`} />
          {request.sent_at && (
            <MetaRow label="Sent" value={new Date(request.sent_at).toLocaleString()} />
          )}
          {request.submitted_at && (
            <MetaRow label="Submitted" value={new Date(request.submitted_at).toLocaleString()} />
          )}
          {request.expires_at && (
            <MetaRow label="Expires" value={new Date(request.expires_at).toLocaleDateString()} />
          )}
          {request.status === "sent" && (
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                Response Link
              </p>
              <a
                href={`${siteUrl}/r/${encodeToken(request.token)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs break-all"
                style={{ color: "rgba(212,160,23,0.7)" }}
              >
                {siteUrl}/r/{encodeToken(request.token)}
              </a>
            </div>
          )}
        </div>

        {/* Instructions */}
        {request.instructions && (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "rgba(255,255,255,0.3)" }}>
              Instructions
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
              {request.instructions}
            </p>
          </div>
        )}

        {/* Submission */}
        {submission ? (
          <div className="space-y-3">
            <p
              className="text-xs uppercase tracking-wider font-semibold"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Response
            </p>

            {fields.map(field => {
              const val = fieldValues[field.id]
              const isFile = field.type === "photo" || field.type === "file"
              const fieldAttachments = (attachments ?? []).filter(
                a => a.storage_path.includes(request.token)
              )

              if (isFile) {
                // For now show all attachments grouped — V2 can correlate by fieldId
                return null
              }

              return (
                <div
                  key={field.id}
                  className="rounded-md p-3"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 16%)" }}
                >
                  <p
                    className="text-[10px] uppercase tracking-wider mb-1"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {field.label}
                    {field.required && <span className="ml-1" style={{ color: "rgba(212,160,23,0.5)" }}>*</span>}
                  </p>
                  <p className="text-sm" style={{ color: val != null ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)" }}>
                    {val != null && val !== "" ? String(val) : "—"}
                  </p>
                </div>
              )
            })}

            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <div className="space-y-2">
                <p
                  className="text-xs uppercase tracking-wider font-semibold"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Attachments ({attachments.length})
                </p>
                {attachments.map(att => (
                  <AttachmentRow
                    key={att.id}
                    attachment={att}
                    loading={downloadingId === att.id}
                    onDownload={() => handleDownload(att)}
                  />
                ))}
              </div>
            )}

            {/* Submitter notes */}
            {submission.notes && (
              <div
                className="rounded-md p-3"
                style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 16%)" }}
              >
                <p
                  className="text-[10px] uppercase tracking-wider mb-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  Submitter Notes
                </p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {submission.notes}
                </p>
              </div>
            )}
          </div>
        ) : request.status === "sent" ? (
          <div
            className="rounded-md p-4 flex items-center gap-3"
            style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}
          >
            <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-300">Waiting for the recipient to respond.</p>
          </div>
        ) : null}

        {/* Review panel */}
        {(request.status === "submitted" || request.status === "reviewed") && (
          <div
            className="rounded-md p-4 space-y-3"
            style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 16%)" }}
          >
            <p
              className="text-xs uppercase tracking-wider font-semibold"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Review Notes
            </p>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add internal notes about this response…"
              rows={3}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="text-xs"
              >
                {savingNotes ? "Saving…" : "Save Notes"}
              </Button>
              {request.status !== "reviewed" && (
                <Button
                  size="sm"
                  onClick={handleMarkReviewed}
                  disabled={marking}
                  className="gap-1.5 text-xs"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {marking ? "Marking…" : "Mark Reviewed"}
                </Button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
        {label}
      </p>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>{value}</p>
    </div>
  )
}

function AttachmentRow({
  attachment,
  loading,
  onDownload,
}: {
  attachment: ExternalSubmissionAttachment
  loading: boolean
  onDownload: () => void
}) {
  const isImage = attachment.mime_type?.startsWith("image/") ?? false
  const sizeKb = attachment.file_size_bytes ? Math.round(attachment.file_size_bytes / 1024) : null

  return (
    <div
      className="flex items-center justify-between rounded-md px-3 py-2.5"
      style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {isImage ? (
          <ImageThumbnail storagePath={attachment.storage_path} />
        ) : (
          <div
            className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.15)" }}
          >
            <FileText className="w-4 h-4" style={{ color: "rgba(212,160,23,0.6)" }} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
            {attachment.file_name}
          </p>
          {sizeKb && (
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              {sizeKb.toLocaleString()} KB
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDownload}
        disabled={loading}
        className="gap-1.5 text-xs flex-shrink-0 ml-2"
        style={{ color: "rgba(212,160,23,0.8)" }}
      >
        <Download className="w-3.5 h-3.5" />
        {loading ? "…" : "Download"}
      </Button>
    </div>
  )
}

function ImageThumbnail({ storagePath }: { storagePath: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    getDownloadUrl(storagePath).then(setSrc).catch(() => {})
  }, [storagePath])

  if (!src) {
    return (
      <div
        className="w-10 h-10 rounded flex-shrink-0 animate-pulse"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />
    )
  }

  return (
    <img
      src={src}
      alt=""
      className="w-10 h-10 rounded object-cover flex-shrink-0"
      style={{ border: "1px solid rgba(255,255,255,0.1)" }}
    />
  )
}
