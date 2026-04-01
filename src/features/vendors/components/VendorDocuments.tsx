import { useState, useRef } from "react"
import {
  FileText, Upload, Download, Trash2, CheckCircle2,
  AlertTriangle, Clock, X, Shield,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { GOLD } from "../constants"
import type { VendorDocument, VendorLane } from "../types"

const LANE_LABELS: Record<VendorLane, { label: string; color: string }> = {
  shared: { label: "Shared",     color: "#6b7280" },
  nine:   { label: "9-or-Less",  color: "#2563eb" },
  ten:    { label: "10-or-More", color: "#7c3aed" },
}

const DOC_TYPE_LABELS: Record<string, string> = {
  insurance_cert:      "Insurance Certificate",
  w9:                  "W-9",
  ap_license_copy:     "AP License Copy",
  rts_evidence:        "RTS Evidence",
  air_agency_cert:     "Air Agency Certificate",
  drug_alcohol_program: "Drug & Alcohol Program",
  argus_report:        "ARGUS Report",
  isbao_report:        "IS-BAO Report",
  gmm_approval_form:   "GMM Approval Form",
  gom_form:            "GOM Form",
  other:               "Other",
}

const LANE_DOC_TYPES: Record<VendorLane, string[]> = {
  shared: ["insurance_cert", "w9", "other"],
  nine:   ["ap_license_copy", "rts_evidence", "other"],
  ten:    ["air_agency_cert", "drug_alcohol_program", "argus_report", "isbao_report", "gmm_approval_form", "gom_form", "other"],
}

function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const diff = new Date(expiresAt + "T00:00:00").getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function VendorDocuments({ vendorId, documents, canEditNine, canEditTen, isAdmin, onRefresh }: {
  vendorId: string
  documents: VendorDocument[]
  canEditNine: boolean
  canEditTen: boolean
  isAdmin: boolean
  onRefresh: () => void
}) {
  const { profile } = useAuth()
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)
  const canUploadAny = canEditNine || canEditTen

  const expiredDocs = documents.filter(d => { const days = daysUntilExpiry(d.expires_at); return days !== null && days <= 0 })
  const expiringDocs = documents.filter(d => { const days = daysUntilExpiry(d.expires_at); return days !== null && days > 0 && days <= 30 })

  async function handleDownload(doc: VendorDocument) {
    const { data } = await supabase.storage.from("vendor-documents").createSignedUrl(doc.file_path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, "_blank")
  }

  async function handleVerify(doc: VendorDocument) {
    setVerifying(doc.id)
    await supabase.from("vendor_documents").update({
      verified: !doc.verified,
      verified_by: doc.verified ? null : profile?.user_id ?? null,
      verified_at: doc.verified ? null : new Date().toISOString(),
    }).eq("id", doc.id)
    setVerifying(null)
    onRefresh()
  }

  async function handleDelete(doc: VendorDocument) {
    setDeleting(doc.id)
    await supabase.storage.from("vendor-documents").remove([doc.file_path])
    await supabase.from("vendor_documents").delete().eq("id", doc.id)
    setDeleting(null)
    onRefresh()
  }

  return (
    <div className="rounded-md overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Documents</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
            {documents.length}
          </span>
          {expiredDocs.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: "#dc262615", color: "#dc2626" }}>
              {expiredDocs.length} expired
            </span>
          )}
          {expiringDocs.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: "#d9770615", color: "#d97706" }}>
              {expiringDocs.length} expiring
            </span>
          )}
        </div>
        {canUploadAny && (
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-sm"
            style={{ background: `${GOLD}18`, color: GOLD }}>
            <Upload className="w-3 h-3" /> Upload
          </button>
        )}
      </div>

      {documents.length === 0 && !showUpload ? (
        <div className="px-4 py-8 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-20" />
          <p className="text-xs text-muted-foreground opacity-50 italic">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
          {documents.map(doc => {
            const days = daysUntilExpiry(doc.expires_at)
            const expired = days !== null && days <= 0
            const expiring = days !== null && days > 0 && days <= 30
            const laneCfg = LANE_LABELS[doc.lane as VendorLane] ?? LANE_LABELS.shared

            return (
              <div key={doc.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm"
                      style={{ background: `${laneCfg.color}15`, color: laneCfg.color }}>
                      {laneCfg.label}
                    </span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm"
                      style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
                      {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                    </span>
                  </div>
                  <p className="text-xs font-semibold truncate">{doc.document_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.file_size && <span className="text-[10px] text-muted-foreground">{formatFileSize(doc.file_size)}</span>}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Expiry indicator */}
                {doc.expires_at && (
                  <div className="flex items-center gap-1 shrink-0">
                    {expired ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                        style={{ background: "#dc262615", color: "#dc2626" }}>
                        <AlertTriangle className="w-3 h-3" /> Expired
                      </span>
                    ) : expiring ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm"
                        style={{ background: "#d9770615", color: "#d97706" }}>
                        <Clock className="w-3 h-3" /> {days}d
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground opacity-60">
                        Exp {new Date(doc.expires_at + "T00:00:00").toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}

                {/* Verified badge */}
                <div className="shrink-0">
                  {doc.verified ? (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground opacity-40">
                      <Shield className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleDownload(doc)} title="Download"
                    className="p-1 rounded-sm hover:bg-muted/50 transition-colors">
                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => handleVerify(doc)} disabled={verifying === doc.id} title={doc.verified ? "Unverify" : "Verify"}
                      className="p-1 rounded-sm hover:bg-muted/50 transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" style={{ color: doc.verified ? "#16a34a" : "hsl(var(--muted-foreground))" }} />
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => handleDelete(doc)} disabled={deleting === doc.id} title="Delete"
                      className="p-1 rounded-sm hover:bg-muted/50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showUpload && (
        <UploadForm
          vendorId={vendorId}
          canEditNine={canEditNine}
          canEditTen={canEditTen}
          uploading={uploading}
          setUploading={setUploading}
          onDone={() => { setShowUpload(false); onRefresh() }}
          onCancel={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}

// ── Upload form ────────────────────────────────────────────────────────────

function UploadForm({ vendorId, canEditNine, canEditTen, uploading, setUploading, onDone, onCancel }: {
  vendorId: string
  canEditNine: boolean
  canEditTen: boolean
  uploading: boolean
  setUploading: (v: boolean) => void
  onDone: () => void
  onCancel: () => void
}) {
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [lane, setLane] = useState<VendorLane>("shared")
  const [docType, setDocType] = useState("other")
  const [docName, setDocName] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!docName) setDocName(f.name.replace(/\.[^.]+$/, ""))
  }

  async function handleUpload() {
    if (!file || !docName.trim()) return
    setError("")
    setUploading(true)

    const ext = file.name.split(".").pop() ?? "bin"
    const storagePath = `${vendorId}/${lane}/${Date.now()}_${docName.trim().replace(/\s+/g, "_")}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from("vendor-documents")
      .upload(storagePath, file)

    if (uploadErr) {
      setError(uploadErr.message)
      setUploading(false)
      return
    }

    const { error: insertErr } = await supabase.from("vendor_documents").insert({
      vendor_id: vendorId,
      lane,
      document_type: docType,
      document_name: docName.trim(),
      file_path: storagePath,
      file_size: file.size,
      expires_at: expiresAt || null,
      uploaded_by: profile?.user_id ?? null,
      notes: notes.trim() || null,
    })

    if (insertErr) {
      setError(insertErr.message)
      setUploading(false)
      return
    }

    setUploading(false)
    onDone()
  }

  const docTypes = LANE_DOC_TYPES[lane]

  return (
    <div className="px-4 py-3 space-y-2.5" style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--accent)/0.3)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>Upload Document</p>
        <button onClick={onCancel}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
      </div>

      {/* Lane selector */}
      <div className="flex gap-1">
        {(Object.keys(LANE_LABELS) as VendorLane[]).map(l => {
          const cfg = LANE_LABELS[l]
          const active = lane === l
          const allowed = l === "shared" ? (canEditNine || canEditTen)
            : l === "nine" ? canEditNine
            : canEditTen
          return (
            <button key={l} onClick={() => allowed && (setLane(l), setDocType("other"))}
              disabled={!allowed}
              className="text-[9px] font-bold px-2 py-1 rounded-sm border transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              style={{
                borderColor: active ? cfg.color : "hsl(var(--border))",
                color: active ? cfg.color : "hsl(var(--muted-foreground))",
                background: active ? `${cfg.color}15` : "transparent",
              }}>
              {cfg.label}{!allowed && " (Admin)"}
            </button>
          )
        })}
      </div>

      {/* Document type */}
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">Document Type</label>
        <select className="form-input" value={docType} onChange={e => setDocType(e.target.value)}>
          {docTypes.map(t => (
            <option key={t} value={t}>{DOC_TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
      </div>

      {/* Document name */}
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">Document Name</label>
        <input className="form-input" value={docName} onChange={e => setDocName(e.target.value)} placeholder="e.g. Insurance Certificate 2026" />
      </div>

      {/* Expiry date */}
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">Expiry Date (optional)</label>
        <input className="form-input" type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">Notes (optional)</label>
        <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
      </div>

      {/* File picker */}
      <div>
        <label className="block text-[10px] text-muted-foreground mb-1">File</label>
        <input ref={fileRef} type="file" onChange={handleFileChange}
          className="text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-sm file:border-0 file:text-xs file:font-semibold file:cursor-pointer"
          style={{ fontSize: "0.75rem" }}
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
        />
        {file && <p className="text-[10px] text-muted-foreground mt-0.5">{formatFileSize(file.size)}</p>}
      </div>

      {error && <p className="text-[10px] font-semibold" style={{ color: "#dc2626" }}>{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-1.5 text-xs rounded-sm text-muted-foreground"
          style={{ border: "1px solid hsl(var(--border))" }}>Cancel</button>
        <button onClick={handleUpload}
          disabled={uploading || !file || !docName.trim()}
          className="flex-1 py-1.5 text-xs rounded-sm text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
          style={{ background: GOLD }}>
          <Upload className="w-3 h-3" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </div>
  )
}
