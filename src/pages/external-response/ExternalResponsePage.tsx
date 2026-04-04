// Public response portal — NO AUTH REQUIRED
// Loaded via /r/:token — completely outside the ProtectedRoute wrapper.

import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { CheckCircle2, AlertCircle, Clock } from "lucide-react"
import { ResponseFormRenderer, type FieldValue } from "@/components/external-requests/ResponseFormRenderer"
import type { FieldDef } from "@/entities/supabase"

type RequestData = {
  id: string
  title: string
  instructions: string | null
  fieldSchema: FieldDef[]
  recipientName: string
  status: string
  expiresAt: string | null
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done"; fileName: string; storagePath: string; mimeType: string; fileSizeBytes: number }
  | { status: "error"; message: string }

type PageState = "loading" | "form" | "submitting" | "submitted" | "already_submitted" | "expired" | "not_found" | "error"

const BASE = "/.netlify/functions"

export default function ExternalResponsePage() {
  const { token } = useParams<{ token: string }>()
  const [pageState, setPageState] = useState<PageState>("loading")
  const [request, setRequest] = useState<RequestData | null>(null)
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({})
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!token) {
      setPageState("not_found")
      return
    }
    loadRequest(token)
  }, [token])

  async function loadRequest(t: string) {
    try {
      const res = await fetch(`${BASE}/external-request-public?token=${encodeURIComponent(t)}`)
      const data = await res.json()
      if (res.status === 409) { setPageState("already_submitted"); return }
      if (res.status === 410) { setPageState("expired"); return }
      if (!res.ok) { setPageState("not_found"); return }
      setRequest(data)
      setPageState("form")
    } catch {
      setPageState("error")
    }
  }

  function handleValueChange(fieldId: string, value: FieldValue) {
    setValues(prev => ({ ...prev, [fieldId]: value }))
  }

  async function handleFileSelect(fieldId: string, file: File) {
    if (!token) return
    setUploadStates(prev => ({ ...prev, [fieldId]: { status: "uploading" } }))
    try {
      const urlRes = await fetch(`${BASE}/external-upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fileName: file.name, mimeType: file.type }),
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlData.error ?? "Failed to get upload URL")

      // Upload directly to Supabase Storage — raw binary, no compression
      const uploadRes = await fetch(urlData.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!uploadRes.ok) throw new Error("Upload failed")

      setUploadStates(prev => ({
        ...prev,
        [fieldId]: { status: "done", fileName: file.name, storagePath: urlData.storagePath, mimeType: file.type, fileSizeBytes: file.size },
      }))
    } catch (err) {
      setUploadStates(prev => ({
        ...prev,
        [fieldId]: { status: "error", message: (err as Error).message },
      }))
    }
  }

  function handleFileClear(fieldId: string) {
    setUploadStates(prev => ({ ...prev, [fieldId]: { status: "idle" } }))
  }

  function canSubmit(): boolean {
    if (!request) return false
    for (const field of request.fieldSchema) {
      if (field.required) {
        if (field.type === "photo" || field.type === "file") {
          const us = uploadStates[field.id]
          if (!us || us.status !== "done") return false
        } else {
          const val = values[field.id]
          if (val === null || val === undefined || val === "") return false
        }
      }
      if (field.type === "photo" || field.type === "file") {
        const us = uploadStates[field.id]
        if (us && us.status === "uploading") return false
      }
    }
    return true
  }

  async function handleSubmit() {
    if (!token || !request) return
    setPageState("submitting")

    const attachments = request.fieldSchema
      .filter(f => f.type === "photo" || f.type === "file")
      .map(f => uploadStates[f.id])
      .filter((us): us is Extract<UploadState, { status: "done" }> => us?.status === "done")
      .map(us => ({
        fieldId: "",
        fileName: us.fileName,
        storagePath: us.storagePath,
        mimeType: us.mimeType,
        fileSizeBytes: us.fileSizeBytes,
      }))

    try {
      const res = await fetch(`${BASE}/external-submission-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fieldValues: values, notes: notes || null, attachments }),
      })
      if (res.status === 409) { setPageState("already_submitted"); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Submission failed")
      setPageState("submitted")
    } catch {
      setPageState("form")
      // Show inline error — simple approach
      alert("Something went wrong. Please try again.")
    }
  }

  // ─── Render states ────────────────────────────────────────────────────────

  if (pageState === "loading") {
    return <Shell><LoadingCard /></Shell>
  }

  if (pageState === "not_found" || pageState === "error") {
    return (
      <Shell>
        <StatusCard
          icon={<AlertCircle className="w-8 h-8 text-red-400" />}
          title="Not Found"
          message="This request link doesn't exist or has been removed."
        />
      </Shell>
    )
  }

  if (pageState === "expired") {
    return (
      <Shell>
        <StatusCard
          icon={<Clock className="w-8 h-8" style={{ color: "#d4a017" }} />}
          title="Link Expired"
          message="This request link has expired. Please contact the person who sent it."
        />
      </Shell>
    )
  }

  if (pageState === "already_submitted") {
    return (
      <Shell>
        <StatusCard
          icon={<CheckCircle2 className="w-8 h-8 text-green-400" />}
          title="Already Submitted"
          message="A response has already been submitted for this request."
        />
      </Shell>
    )
  }

  if (pageState === "submitted") {
    return (
      <Shell>
        <StatusCard
          icon={<CheckCircle2 className="w-8 h-8 text-green-400" />}
          title="Response Submitted"
          message="Thank you — your response has been received. You can close this window."
          accent
        />
      </Shell>
    )
  }

  if (!request) return null

  const isSubmitting = pageState === "submitting"

  return (
    <Shell>
      <div
        className="rounded-lg overflow-hidden w-full"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header stripe */}
        <div style={{ height: "4px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />

        {/* Card */}
        <div className="p-6 space-y-6" style={{ background: "#1a1a1a" }}>
          {/* Branding */}
          <div className="flex items-center justify-between">
            <div>
              <span
                className="text-[10px] font-bold tracking-[0.25em] uppercase"
                style={{ color: "#d4a017", borderBottom: "1px solid #d4a017", paddingBottom: "2px" }}
              >
                SKYSHARE MX
              </span>
              <span
                className="ml-2 text-[10px] tracking-[0.18em] uppercase"
                style={{ color: "rgba(255,255,255,0.28)" }}
              >
                Maintenance Portal
              </span>
            </div>
          </div>

          {/* Greeting */}
          <div>
            <h1
              className="text-2xl font-normal italic"
              style={{ fontFamily: "Georgia, serif", color: "#fff", lineHeight: 1.2 }}
            >
              Hi {request.recipientName},
            </h1>
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
              You've received a request for information.
            </p>
          </div>

          {/* Request title */}
          <div
            className="rounded px-4 py-3"
            style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.2)" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: "rgba(212,160,23,0.7)" }}
            >
              Request
            </p>
            <p className="text-sm font-medium text-white">{request.title}</p>
          </div>

          {/* Instructions */}
          {request.instructions && (
            <div
              className="text-sm leading-relaxed pl-4"
              style={{
                color: "rgba(255,255,255,0.65)",
                borderLeft: "2px solid rgba(212,160,23,0.35)",
              }}
            >
              {request.instructions.split("\n").map((line, i) => (
                <p key={i} className={i > 0 ? "mt-2" : ""}>{line}</p>
              ))}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

          {/* Form fields */}
          <ResponseFormRenderer
            fields={request.fieldSchema}
            values={values}
            uploadStates={uploadStates}
            onValueChange={handleValueChange}
            onFileSelect={handleFileSelect}
            onFileClear={handleFileClear}
            disabled={isSubmitting}
          />

          {/* Additional notes */}
          <div className="space-y-2">
            <label
              className="block text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              Additional Notes <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              placeholder="Anything else you'd like to add…"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.9)",
              }}
            />
          </div>

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting}
            className="w-full rounded-md py-3.5 text-sm font-bold uppercase tracking-widest transition-opacity disabled:opacity-40"
            style={{
              background: "#d4a017",
              color: "#111",
              fontFamily: "Montserrat, Arial, sans-serif",
              letterSpacing: "0.15em",
            }}
          >
            {isSubmitting ? "Submitting…" : "Submit Response →"}
          </button>

          {/* Footer */}
          <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} SkyShare · Maintenance Portal
          </p>
        </div>
      </div>
    </Shell>
  )
}

// ─── Layout wrapper ───────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex items-start justify-center px-4 py-8"
      style={{ background: "#111111" }}
    >
      <div className="w-full max-w-lg">
        {children}
      </div>
    </div>
  )
}

// ─── Status card ────────────────────────────────────────────────────���─────────

function StatusCard({
  icon,
  title,
  message,
  accent,
}: {
  icon: React.ReactNode
  title: string
  message: string
  accent?: boolean
}) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div style={{ height: "4px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />
      <div
        className="p-8 flex flex-col items-center text-center space-y-4"
        style={{ background: "#1a1a1a" }}
      >
        {icon}
        <h2
          className="text-xl font-normal italic"
          style={{ fontFamily: "Georgia, serif", color: "#fff" }}
        >
          {title}
        </h2>
        <p className="text-sm max-w-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          {message}
        </p>
        {accent && (
          <div style={{ height: "1px", width: "40px", background: "#d4a017" }} />
        )}
        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.18)" }}>
          © {new Date().getFullYear()} SkyShare · Maintenance Portal
        </p>
      </div>
    </div>
  )
}

function LoadingCard() {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div style={{ height: "4px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />
      <div className="p-8 flex items-center justify-center" style={{ background: "#1a1a1a" }}>
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#d4a017", borderTopColor: "transparent" }} />
      </div>
    </div>
  )
}
