// Public 14-Day Check form — NO AUTH REQUIRED
// Loaded via /check/:token — outside the ProtectedRoute wrapper.
// Permanent standing URL: same link every 14-day cycle, always accepts new submissions.

import { useState, useEffect, useRef } from "react"
import { useParams } from "react-router-dom"
import { Camera, CheckCircle2, AlertCircle, X } from "lucide-react"
import type { FieldDef } from "@/entities/supabase"

type CheckData = {
  tokenId: string
  registration: string
  aircraftId: string
  fieldSchema: FieldDef[]
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done"; fileName: string; storagePath: string; mimeType: string; fileSizeBytes: number }
  | { status: "error"; message: string }

type FieldValue = string | boolean | null

type PageState = "loading" | "form" | "submitting" | "submitted" | "not_found" | "error"

const BASE = "/.netlify/functions"

export default function FourteenDayCheckResponse() {
  const { token } = useParams<{ token: string }>()
  // ?for=Name pre-populated when dispatched via email. Blank when opened from QR.
  const prefilledName = new URLSearchParams(window.location.search).get("for") ?? ""
  const [pageState, setPageState] = useState<PageState>("loading")
  const [check, setCheck] = useState<CheckData | null>(null)
  const [submitterName, setSubmitterName] = useState(prefilledName)
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setPageState("not_found"); return }
    loadCheck(token)
  }, [token])

  async function loadCheck(t: string) {
    try {
      const res = await fetch(`${BASE}/fourteen-day-check-public?token=${encodeURIComponent(t)}`)
      const data = await res.json()
      if (!res.ok) { setPageState("not_found"); return }
      setCheck(data)
      setPageState("form")
    } catch {
      setPageState("error")
    }
  }

  function interpolate(label: string): string {
    return label.replace(/\[REGISTRATION\]/g, check?.registration ?? "")
  }

  function handleValueChange(fieldId: string, value: FieldValue) {
    setValues(prev => ({ ...prev, [fieldId]: value }))
  }

  async function handleFileSelect(fieldId: string, file: File) {
    if (!token) return
    setUploadStates(prev => ({ ...prev, [fieldId]: { status: "uploading" } }))
    try {
      const urlRes = await fetch(`${BASE}/fourteen-day-check-upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fieldId, fileName: file.name, mimeType: file.type }),
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlData.error ?? "Failed to get upload URL")

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
    if (!check || !submitterName.trim()) return false
    for (const field of check.fieldSchema) {
      if (field.type === "section") continue
      if (!field.required) continue
      if (field.type === "photo") {
        const us = uploadStates[field.id]
        if (!us || us.status !== "done") return false
        if (us.status === "uploading") return false
      } else if (field.type === "checkbox") {
        if (values[field.id] !== true) return false
      } else {
        const val = values[field.id]
        if (val === null || val === undefined || val === "") return false
      }
    }
    // Block if any upload is in progress
    for (const us of Object.values(uploadStates)) {
      if (us.status === "uploading") return false
    }
    return true
  }

  async function handleSubmit() {
    if (!token || !check) return
    setSubmitError(null)
    setPageState("submitting")

    const attachments = check.fieldSchema
      .filter(f => f.type === "photo")
      .map(f => {
        const us = uploadStates[f.id]
        if (us?.status !== "done") return null
        return { fieldId: f.id, fileName: us.fileName, storagePath: us.storagePath, mimeType: us.mimeType, fileSizeBytes: us.fileSizeBytes }
      })
      .filter(Boolean)

    try {
      const res = await fetch(`${BASE}/fourteen-day-check-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          submitterName: submitterName.trim(),
          aircraftId: check.aircraftId,
          fieldValues: values,
          notes: null,
          attachments,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Submission failed")
      setPageState("submitted")
    } catch (err) {
      setSubmitError((err as Error).message)
      setPageState("form")
    }
  }

  // ─── Render states ─────────────────────────────────────────────────────────

  if (pageState === "loading") {
    return <Shell><LoadingCard /></Shell>
  }

  if (pageState === "not_found" || pageState === "error") {
    return (
      <Shell>
        <StatusCard
          icon={<AlertCircle className="w-8 h-8 text-red-400" />}
          title="Not Found"
          message="This check link doesn't exist or has been removed. Contact Maintenance Control."
        />
      </Shell>
    )
  }

  if (pageState === "submitted") {
    return (
      <Shell>
        <StatusCard
          icon={<CheckCircle2 className="w-8 h-8 text-green-400" />}
          title={`Check Submitted — ${check?.registration}`}
          message="Your 14-day check has been recorded. Maintenance Control will review shortly."
          accent
        />
      </Shell>
    )
  }

  if (!check) return null
  const isSubmitting = pageState === "submitting"

  return (
    <Shell>
      <div
        className="rounded-lg overflow-hidden w-full"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header stripe */}
        <div style={{ height: "4px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)" }} />

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

          {/* Title */}
          <div>
            <h1
              className="text-2xl font-normal"
              style={{ fontFamily: "var(--font-heading)", color: "#fff", letterSpacing: "0.04em" }}
            >
              14-Day Check
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-sm font-bold tracking-widest"
                style={{ color: "#d4a017", fontFamily: "var(--font-heading)" }}
              >
                {check.registration}
              </span>
            </div>
          </div>

          {/* Submitter name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
                Your name <span style={{ color: "#d4a017" }}>*</span>
              </label>
              {prefilledName && (
                <span className="text-[10px]" style={{ color: "rgba(212,160,23,0.55)" }}>
                  pre-filled from dispatch
                </span>
              )}
            </div>
            <input
              type="text"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              disabled={isSubmitting}
              placeholder="First and last name"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none disabled:opacity-50"
              style={{
                background: prefilledName ? "rgba(212,160,23,0.06)" : "rgba(255,255,255,0.06)",
                border: prefilledName ? "1px solid rgba(212,160,23,0.25)" : "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.9)",
              }}
            />
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

          {/* Field schema */}
          <div className="space-y-5">
            {check.fieldSchema.map((field) => (
              <CheckField
                key={field.id}
                field={field}
                value={values[field.id] ?? null}
                uploadState={uploadStates[field.id] ?? { status: "idle" }}
                registration={check.registration}
                disabled={isSubmitting}
                onValueChange={(v) => handleValueChange(field.id, v)}
                onFileSelect={(f) => handleFileSelect(field.id, f)}
                onFileClear={() => handleFileClear(field.id)}
                interpolate={interpolate}
              />
            ))}
          </div>

          {/* Error message */}
          {submitError && (
            <div
              className="rounded-md px-3 py-2.5 text-sm text-red-400"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              {submitError} — please try again.
            </div>
          )}

          {/* Submit */}
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
            {isSubmitting ? "Submitting…" : "Submit Check →"}
          </button>

          <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            © {new Date().getFullYear()} SkyShare · Maintenance Portal
          </p>
        </div>
      </div>
    </Shell>
  )
}

// ─── Field renderer ───────────────────────────────────────────────────────────

type CheckFieldProps = {
  field: FieldDef
  value: string | boolean | null
  uploadState: UploadState
  registration: string
  disabled?: boolean
  onValueChange: (v: string | boolean | null) => void
  onFileSelect: (f: File) => void
  onFileClear: () => void
  interpolate: (label: string) => string
}

function CheckField({ field, value, uploadState, disabled, onValueChange, onFileSelect, onFileClear, interpolate }: CheckFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const label = interpolate(field.label)

  // Section header — visual separator, no input
  if (field.type === "section") {
    return (
      <div className="pt-2">
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-bold tracking-[0.2em] uppercase"
            style={{ color: "rgba(212,160,23,0.7)", fontFamily: "var(--font-heading)" }}
          >
            {label}
          </span>
          <div className="flex-1" style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />
        </div>
      </div>
    )
  }

  // Checkbox — confirmation + cabin items
  if (field.type === "checkbox") {
    const checked = value === true
    return (
      <button
        type="button"
        onClick={() => !disabled && onValueChange(!checked)}
        disabled={disabled}
        className="w-full text-left rounded-md px-4 py-3 transition-all duration-150 disabled:opacity-60"
        style={{
          background: checked ? "rgba(212,160,23,0.1)" : "rgba(255,255,255,0.04)",
          border: checked ? "1px solid rgba(212,160,23,0.4)" : "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex items-start gap-3">
          {/* Custom checkbox */}
          <div
            className="flex-shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-all duration-150"
            style={{
              background: checked ? "#d4a017" : "rgba(255,255,255,0.08)",
              border: checked ? "none" : "1.5px solid rgba(255,255,255,0.25)",
            }}
          >
            {checked && (
              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                <path d="M1 4L4 7L10 1" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <span
              className="text-sm font-medium leading-snug"
              style={{ color: checked ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)" }}
            >
              {label}
              {field.required && !checked && (
                <span style={{ color: "#d4a017" }} className="ml-1">*</span>
              )}
            </span>
            {field.hint && (
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                {field.hint}
              </p>
            )}
          </div>
        </div>
      </button>
    )
  }

  // Textarea
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <label className="block">
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
            {label}
            {field.required && <span style={{ color: "#d4a017" }} className="ml-1">*</span>}
          </span>
          {field.hint && (
            <span className="block text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {field.hint}
            </span>
          )}
        </label>
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.9)",
          }}
        />
      </div>
    )
  }

  // Text
  if (field.type === "text") {
    return (
      <div className="space-y-1.5">
        <label className="block">
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
            {label}
            {field.required && <span style={{ color: "#d4a017" }} className="ml-1">*</span>}
          </span>
          {field.hint && (
            <span className="block text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {field.hint}
            </span>
          )}
        </label>
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md px-3 py-2.5 text-sm outline-none disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.9)",
          }}
        />
      </div>
    )
  }

  // Photo
  if (field.type === "photo") {
    return (
      <div className="space-y-1.5">
        <div>
          <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.9)" }}>
            {label}
            {field.required && <span style={{ color: "#d4a017" }} className="ml-1">*</span>}
          </span>
          {field.hint && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {field.hint}
            </p>
          )}
        </div>

        {uploadState.status === "done" && (
          <div
            className="flex items-center justify-between rounded-md px-3 py-2.5"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-300 truncate max-w-[200px]">{uploadState.fileName}</span>
            </div>
            {!disabled && (
              <button type="button" onClick={onFileClear} className="ml-2 opacity-50 hover:opacity-80">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            )}
          </div>
        )}

        {uploadState.status === "uploading" && (
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2.5"
            style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.2)" }}
          >
            <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#d4a017", borderTopColor: "transparent" }} />
            <span className="text-sm" style={{ color: "rgba(212,160,23,0.8)" }}>Uploading…</span>
          </div>
        )}

        {uploadState.status === "error" && (
          <div
            className="rounded-md px-3 py-2 text-sm text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            Upload failed: {uploadState.message}
          </div>
        )}

        {(uploadState.status === "idle" || uploadState.status === "error") && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onFileSelect(file)
                e.target.value = ""
              }}
              disabled={disabled}
              className="hidden"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full rounded-md px-3 py-3 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.5)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              <Camera className="w-4 h-4" />
              {uploadState.status === "error" ? "Try Again" : "Take Photo or Choose Image"}
            </button>
          </>
        )}
      </div>
    )
  }

  return null
}

// ─── Shell & Status cards ─────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full flex items-start justify-center px-4 py-8"
      style={{ background: "#111111" }}
    >
      <div className="w-full max-w-lg">{children}</div>
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
        <h2 className="text-xl font-normal italic" style={{ fontFamily: "Georgia, serif", color: "#fff" }}>
          {title}
        </h2>
        <p className="text-sm max-w-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{message}</p>
        {accent && <div style={{ height: "1px", width: "40px", background: "#d4a017" }} />}
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
