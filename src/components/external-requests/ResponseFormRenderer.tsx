// ResponseFormRenderer — renders a FieldDef[] as interactive form inputs.
// Used in the public response portal. No auth required.

import { useRef } from "react"
import { Camera, FileUp, X, CheckCircle2 } from "lucide-react"
import type { FieldDef } from "@/entities/supabase"

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress?: number }
  | { status: "done"; fileName: string; storagePath: string }
  | { status: "error"; message: string }

export type FieldValue = string | number | null

type Props = {
  fields: FieldDef[]
  values: Record<string, FieldValue>
  uploadStates: Record<string, UploadState>
  onValueChange: (fieldId: string, value: FieldValue) => void
  onFileSelect: (fieldId: string, file: File) => void
  onFileClear: (fieldId: string) => void
  disabled?: boolean
}

export function ResponseFormRenderer({
  fields,
  values,
  uploadStates,
  onValueChange,
  onFileSelect,
  onFileClear,
  disabled,
}: Props) {
  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.id] ?? null}
          uploadState={uploadStates[field.id] ?? { status: "idle" }}
          onChange={(v) => onValueChange(field.id, v)}
          onFileSelect={(f) => onFileSelect(field.id, f)}
          onFileClear={() => onFileClear(field.id)}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

type FieldInputProps = {
  field: FieldDef
  value: FieldValue
  uploadState: UploadState
  onChange: (v: FieldValue) => void
  onFileSelect: (f: File) => void
  onFileClear: () => void
  disabled?: boolean
}

function FieldInput({ field, value, uploadState, onChange, onFileSelect, onFileClear, disabled }: FieldInputProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <label className="block">
        <span
          className="text-sm font-medium"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          {field.label}
          {field.required && <span style={{ color: "#d4a017" }} className="ml-1">*</span>}
        </span>
        {field.hint && (
          <span className="block text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {field.hint}
          </span>
        )}
      </label>

      {field.type === "text" && (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md px-3 py-2.5 text-sm outline-none focus:ring-1 disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.9)",
          }}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={4}
          className="w-full rounded-md px-3 py-2.5 text-sm outline-none resize-none focus:ring-1 disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.9)",
          }}
        />
      )}

      {field.type === "number" && (
        <input
          type="number"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          disabled={disabled}
          className="w-full rounded-md px-3 py-2.5 text-sm outline-none focus:ring-1 disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.9)",
          }}
        />
      )}

      {(field.type === "photo" || field.type === "file") && (
        <FileField
          type={field.type}
          uploadState={uploadState}
          disabled={disabled}
          fileRef={fileRef}
          onFileSelect={onFileSelect}
          onFileClear={onFileClear}
        />
      )}
    </div>
  )
}

type FileFieldProps = {
  type: "photo" | "file"
  uploadState: UploadState
  disabled?: boolean
  fileRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (f: File) => void
  onFileClear: () => void
}

function FileField({ type, uploadState, disabled, fileRef, onFileSelect, onFileClear }: FileFieldProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
    e.target.value = ""
  }

  if (uploadState.status === "done") {
    return (
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
    )
  }

  if (uploadState.status === "uploading") {
    return (
      <div
        className="flex items-center gap-2 rounded-md px-3 py-2.5"
        style={{ background: "rgba(212,160,23,0.08)", border: "1px solid rgba(212,160,23,0.2)" }}
      >
        <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#d4a017", borderTopColor: "transparent" }} />
        <span className="text-sm" style={{ color: "rgba(212,160,23,0.8)" }}>Uploading…</span>
      </div>
    )
  }

  // idle or error — always render the hidden input here, just once
  return (
    <div className="space-y-2">
      {uploadState.status === "error" && (
        <div
          className="rounded-md px-3 py-2.5 text-sm text-red-400"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          Upload failed: {uploadState.message}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={type === "photo" ? "image/*" : undefined}
        onChange={handleChange}
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
        {type === "photo" ? <Camera className="w-4 h-4" /> : <FileUp className="w-4 h-4" />}
        {uploadState.status === "error"
          ? "Try Again"
          : type === "photo"
          ? "Take Photo or Choose Image"
          : "Choose File"}
      </button>
    </div>
  )
}
