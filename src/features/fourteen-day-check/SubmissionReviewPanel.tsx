// SubmissionReviewPanel — MC review of a single 14-day check submission.
// Shows checklist results, photos inline, notes, and flag/archive actions.

import { useState, useEffect } from "react"
import { X, CheckCircle2, XCircle, AlertTriangle, Archive, Flag, ImageOff, Loader2 } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import type { FourteenDayCheckSubmission, FourteenDayCheckAttachment, FieldDef } from "@/entities/supabase"
import {
  useCheckAttachments,
  getCheckPhotoUrl,
  updateSubmissionStatus,
  saveReviewNotes,
  useInvalidateChecks,
} from "@/hooks/useFourteenDayChecks"

type Props = {
  submission: FourteenDayCheckSubmission
  registration: string
  fieldSchema: FieldDef[]
  onClose: () => void
}

export function SubmissionReviewPanel({ submission, registration, fieldSchema, onClose }: Props) {
  const { data: attachments = [] } = useCheckAttachments(submission.id)
  const invalidate = useInvalidateChecks()
  const [notes, setNotes] = useState(submission.review_notes ?? "")
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const isArchived = submission.review_status === "archived"

  // Load signed URLs for all photos
  useEffect(() => {
    if (!attachments.length) return
    const load = async () => {
      const entries = await Promise.all(
        attachments.map(async (a) => {
          try {
            const url = await getCheckPhotoUrl(a.storage_path)
            return [a.id, url] as const
          } catch {
            return [a.id, ""] as const
          }
        })
      )
      setPhotoUrls(Object.fromEntries(entries))
    }
    load()
  }, [attachments])

  async function handleNotesBlur() {
    if (isArchived) return
    try {
      setSaving(true)
      await saveReviewNotes(submission.id, notes)
    } finally {
      setSaving(false)
    }
  }

  async function handleAction(status: FourteenDayCheckSubmission["review_status"]) {
    if (acting) return
    try {
      setActing(true)
      await updateSubmissionStatus(submission.id, status, notes)
      invalidate()
      onClose()
    } finally {
      setActing(false)
    }
  }

  // Build a map of field_id → attachment for photo display
  const attachmentByField = new Map<string, FourteenDayCheckAttachment>()
  for (const a of attachments) {
    attachmentByField.set(a.field_id, a)
  }

  // Visible fields only (skip sections)
  const inputFields = fieldSchema.filter(f => f.type !== "section")
  const photoFields = fieldSchema.filter(f => f.type === "photo")

  return (
    <>
      {/* Slide-out panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex flex-col"
        style={{
          width: "min(640px, 100vw)",
          background: "#161616",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-lg font-bold tracking-wider"
                style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
              >
                {registration}
              </span>
              <ReviewStatusBadge status={submission.review_status} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {submission.submitter_name} ·{" "}
              {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
              {" · "}
              {format(new Date(submission.submitted_at), "MMM d, yyyy h:mm a")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: "rgba(255,255,255,0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">

          {/* Checklist results */}
          <section>
            <SectionLabel>Checklist</SectionLabel>
            <div className="space-y-2 mt-3">
              {inputFields
                .filter(f => f.type === "checkbox")
                .map(field => {
                  const val = submission.field_values[field.id]
                  const checked = val === true
                  return (
                    <div key={field.id} className="flex items-start gap-2.5">
                      {checked
                        ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      }
                      <span className="text-sm" style={{ color: checked ? "rgba(255,255,255,0.8)" : "rgba(255,100,100,0.9)" }}>
                        {field.label}
                      </span>
                    </div>
                  )
                })}
            </div>
          </section>

          {/* Text / textarea responses */}
          {inputFields
            .filter(f => f.type === "text" || f.type === "textarea")
            .map(field => {
              const val = submission.field_values[field.id]
              if (!val && !field.required) return null
              return (
                <section key={field.id}>
                  <SectionLabel>{field.label}</SectionLabel>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: val ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.25)" }}
                  >
                    {val ? String(val) : "No response"}
                  </p>
                </section>
              )
            })}

          {/* Photos */}
          {photoFields.length > 0 && (
            <section>
              <SectionLabel>Photos ({attachments.length}/{photoFields.length})</SectionLabel>
              <div className="grid grid-cols-2 gap-3 mt-3">
                {photoFields.map(field => {
                  const attachment = attachmentByField.get(field.id)
                  const url = attachment ? photoUrls[attachment.id] : ""

                  return (
                    <div key={field.id}>
                      <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5"
                        style={{ color: "rgba(212,160,23,0.6)" }}>
                        {field.label}
                      </p>
                      {attachment && url ? (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="w-full overflow-hidden rounded-md transition-opacity hover:opacity-80"
                          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <img
                            src={url}
                            alt={field.label}
                            className="w-full object-cover"
                            style={{ height: "130px" }}
                          />
                        </button>
                      ) : (
                        <div
                          className="w-full rounded-md flex flex-col items-center justify-center gap-1.5"
                          style={{
                            height: "130px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px dashed rgba(255,255,255,0.1)",
                          }}
                        >
                          {attachment && !url
                            ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "rgba(255,255,255,0.2)" }} />
                            : <ImageOff className="w-4 h-4" style={{ color: "rgba(255,255,255,0.15)" }} />
                          }
                          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                            {attachment && !url ? "Loading…" : "No photo"}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Notes from mechanic */}
          {submission.notes && (
            <section>
              <SectionLabel>Mechanic Notes</SectionLabel>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                {submission.notes}
              </p>
            </section>
          )}

          {/* MC Review notes */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Review Notes</SectionLabel>
              {saving && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Saving…</span>}
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              disabled={isArchived}
              rows={3}
              placeholder={isArchived ? "No notes recorded." : "Add review notes…"}
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.85)",
              }}
            />
          </section>

        </div>

        {/* Action footer */}
        {!isArchived && (
          <div
            className="flex-shrink-0 px-6 py-4 flex items-center gap-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <button
              type="button"
              onClick={() => handleAction("flagged")}
              disabled={acting || submission.review_status === "flagged"}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40"
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.12)")}
            >
              <Flag className="w-3.5 h-3.5" />
              Flag
            </button>

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => handleAction("archived")}
              disabled={acting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40"
              style={{
                background: "rgba(212,160,23,0.12)",
                border: "1px solid rgba(212,160,23,0.3)",
                color: "#d4a017",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(212,160,23,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(212,160,23,0.12)")}
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>

            <button
              type="button"
              onClick={() => handleAction("cleared")}
              disabled={acting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40"
              style={{
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "#4ade80",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(34,197,94,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(34,197,94,0.12)")}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Clear & Archive
            </button>

            {acting && <Loader2 className="w-4 h-4 animate-spin ml-1" style={{ color: "rgba(255,255,255,0.3)" }} />}
          </div>
        )}

        {isArchived && (
          <div
            className="flex-shrink-0 px-6 py-3 text-center text-xs"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}
          >
            Archived{submission.reviewed_at
              ? ` · ${format(new Date(submission.reviewed_at), "MMM d, yyyy")}`
              : ""}
          </div>
        )}
      </div>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Photo"
            className="max-w-full max-h-full object-contain rounded-md"
            style={{ boxShadow: "0 0 40px rgba(0,0,0,0.8)" }}
          />
          <button
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[10px] font-bold tracking-[0.2em] uppercase"
      style={{ color: "rgba(212,160,23,0.6)", fontFamily: "var(--font-heading)" }}
    >
      {children}
    </p>
  )
}

export function ReviewStatusBadge({ status }: { status: FourteenDayCheckSubmission["review_status"] }) {
  const config = {
    pending:  { label: "Pending Review", bg: "rgba(212,160,23,0.15)",  border: "rgba(212,160,23,0.35)",  color: "#d4a017"  },
    flagged:  { label: "Flagged",         bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.3)",    color: "#f87171"  },
    cleared:  { label: "Cleared",         bg: "rgba(34,197,94,0.1)",    border: "rgba(34,197,94,0.25)",   color: "#4ade80"  },
    archived: { label: "Archived",        bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" },
  }
  const c = config[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      {status === "flagged" && <AlertTriangle className="w-2.5 h-2.5 mr-1" />}
      {c.label}
    </span>
  )
}
