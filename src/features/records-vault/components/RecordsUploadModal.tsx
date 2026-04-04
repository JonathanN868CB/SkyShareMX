import { useState, useRef, useCallback } from "react"
import { Upload, X, File, FileArchive, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { unzipSync } from "fflate"
import { useQueryClient } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Textarea } from "@/shared/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { SOURCE_CATEGORIES, SOURCE_CATEGORY_LABELS } from "../constants"
import type { SourceCategory } from "../types"
import type { AircraftBase } from "@/pages/aircraft/fleetData"

// ─── Types ────────────────────────────────────────────────────────────────────

type FileStatus = "queued" | "uploading" | "processing" | "done" | "failed"

interface QueuedFile {
  key: string              // unique key for React rendering
  name: string             // display filename
  bytes: Uint8Array        // raw PDF bytes
  sizeBytes: number
  importBatch: string | null  // set when extracted from a zip
  status: FileStatus
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Extract all PDFs from a ZIP file using fflate. Returns one entry per PDF found. */
function extractPdfsFromZip(
  zipBytes: Uint8Array,
  zipName: string
): Array<{ name: string; bytes: Uint8Array; importBatch: string }> {
  const importBatch = zipName.replace(/\.zip$/i, "")
  const unzipped = unzipSync(zipBytes)

  return Object.entries(unzipped)
    .filter(([path]) => {
      const lower = path.toLowerCase()
      return (
        lower.endsWith(".pdf") &&
        !lower.startsWith("__macosx/") &&
        !lower.includes("/.") // skip hidden files
      )
    })
    .map(([path, bytes]) => ({
      name: path.split("/").pop() ?? path,  // strip folder path, keep filename
      bytes,
      importBatch,
    }))
}

// Upload concurrency — process this many files at once
const CONCURRENCY = 3

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  aircraft: AircraftBase[]
  defaultAircraftId?: string | null
}

export function RecordsUploadModal({ open, onClose, aircraft, defaultAircraftId }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Shared metadata (applies to all files in the batch)
  const [aircraftId, setAircraftId] = useState(defaultAircraftId ?? "")
  const [category, setCategory] = useState<SourceCategory>("logbook")
  const [observedReg, setObservedReg] = useState("")
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")
  const [notes, setNotes] = useState("")

  // File queue
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [running, setRunning] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const doneCount = queue.filter((f) => f.status === "done").length
  const failedCount = queue.filter((f) => f.status === "failed").length
  const totalCount = queue.length
  const allDone = totalCount > 0 && doneCount + failedCount === totalCount

  function reset() {
    setAircraftId(defaultAircraftId ?? "")
    setCategory("logbook")
    setObservedReg("")
    setDateStart("")
    setDateEnd("")
    setNotes("")
    setQueue([])
    setRunning(false)
    setExtracting(false)
  }

  function handleClose() {
    if (running) return
    reset()
    onClose()
  }

  // ─── File picker / drop ───────────────────────────────────────────────────

  async function addFiles(files: FileList | File[]) {
    setExtracting(true)
    const arr = Array.from(files)
    const newEntries: QueuedFile[] = []

    for (const file of arr) {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        newEntries.push({
          key: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          bytes,
          sizeBytes: file.size,
          importBatch: null,
          status: "queued",
        })
      } else if (
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed" ||
        file.name.toLowerCase().endsWith(".zip")
      ) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer())
          const extracted = extractPdfsFromZip(bytes, file.name)
          if (extracted.length === 0) {
            toast({ title: `${file.name}: no PDFs found inside zip`, variant: "destructive" })
            continue
          }
          for (const pdf of extracted) {
            newEntries.push({
              key: `${pdf.importBatch}-${pdf.name}-${Math.random()}`,
              name: pdf.name,
              bytes: pdf.bytes,
              sizeBytes: pdf.bytes.length,
              importBatch: pdf.importBatch,
              status: "queued",
            })
          }
        } catch (err) {
          toast({
            title: `Failed to extract ${file.name}`,
            description: err instanceof Error ? err.message : "Zip extraction failed",
            variant: "destructive",
          })
        }
      } else {
        toast({ title: `${file.name}: only PDFs and ZIPs are accepted`, variant: "destructive" })
      }
    }

    setQueue((prev) => [...prev, ...newEntries])
    setExtracting(false)
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files)
    e.target.value = ""  // reset so same file can be re-added
  }

  function removeFile(key: string) {
    setQueue((prev) => prev.filter((f) => f.key !== key))
  }

  // ─── Drag and drop ───────────────────────────────────────────────────────

  const [dragging, setDragging] = useState(false)

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ─── Upload single file ───────────────────────────────────────────────────

  async function uploadFile(
    file: QueuedFile,
    token: string,
  ): Promise<void> {
    setQueue((prev) =>
      prev.map((f) => f.key === file.key ? { ...f, status: "uploading" } : f)
    )

    try {
      const fileHash = await sha256Hex(file.bytes)
      const safeName = sanitizeFileName(file.name)

      // Step 1: get signed upload URL
      const urlResp = await fetch("/.netlify/functions/records-vault-upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: safeName,
          mimeType: "application/pdf",
          aircraftId,
        }),
      })
      if (!urlResp.ok) {
        const err = await urlResp.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? "Failed to get upload URL")
      }
      const { signedUrl, storagePath } = await urlResp.json()

      // Step 2: upload directly to Supabase Storage
      const uploadResp = await fetch(signedUrl, {
        method: "PUT",
        body: file.bytes,
        headers: { "Content-Type": "application/pdf" },
      })
      if (!uploadResp.ok) {
        throw new Error("Storage upload failed")
      }

      // Step 3: register source + trigger OCR
      setQueue((prev) =>
        prev.map((f) => f.key === file.key ? { ...f, status: "processing" } : f)
      )

      const regResp = await fetch("/.netlify/functions/records-vault-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storagePath,
          originalFilename: file.name,
          fileHash,
          fileSizeBytes: file.sizeBytes,
          aircraftId,
          sourceCategory: category,
          observedRegistration: observedReg || null,
          dateRangeStart: dateStart || null,
          dateRangeEnd: dateEnd || null,
          notes: notes || null,
          importBatch: file.importBatch,
        }),
      })
      if (!regResp.ok) {
        const err = await regResp.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? "Failed to register record")
      }

      setQueue((prev) =>
        prev.map((f) => f.key === file.key ? { ...f, status: "done" } : f)
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      setQueue((prev) =>
        prev.map((f) => f.key === file.key ? { ...f, status: "failed", error: msg } : f)
      )
    }
  }

  // ─── Run upload queue with concurrency limit ──────────────────────────────

  async function startUpload() {
    if (!aircraftId) {
      toast({ title: "Select an aircraft first", variant: "destructive" })
      return
    }
    if (queue.length === 0) {
      toast({ title: "Add at least one file", variant: "destructive" })
      return
    }

    setRunning(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast({ title: "Not authenticated", variant: "destructive" })
      setRunning(false)
      return
    }

    const token = session.access_token
    const pending = queue.filter((f) => f.status === "queued")

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map((f) => uploadFile(f, token)))
    }

    await queryClient.invalidateQueries({ queryKey: ["record-sources"] })
    setRunning(false)

    const failed = queue.filter((f) => f.status === "failed").length
    if (failed === 0) {
      toast({
        title: `${pending.length} file${pending.length !== 1 ? "s" : ""} uploaded`,
        description: "OCR processing has started. Records will appear in search once complete.",
      })
    } else {
      toast({
        title: `${pending.length - failed} uploaded, ${failed} failed`,
        description: "Check the failed files below.",
        variant: "destructive",
      })
    }
  }

  // ─── Status icon ─────────────────────────────────────────────────────────

  function StatusIcon({ status }: { status: FileStatus }) {
    if (status === "done") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
    if (status === "failed") return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
    if (status === "uploading" || status === "processing")
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
    return <File className="h-4 w-4 text-muted-foreground shrink-0" />
  }

  function statusLabel(status: FileStatus): string {
    return { queued: "Queued", uploading: "Uploading…", processing: "Registering…", done: "Done", failed: "Failed" }[status]
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle>Upload Records</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-6 p-6">

            {/* Left — shared metadata */}
            <div className="w-56 shrink-0 space-y-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Applied to all files
              </p>

              <div className="space-y-1.5">
                <Label>Aircraft <span className="text-destructive">*</span></Label>
                <Select value={aircraftId} onValueChange={setAircraftId} disabled={running}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {aircraft.map((ac) => (
                      <SelectItem key={ac.id} value={ac.id}>
                        {ac.tailNumber} — {ac.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select value={category} onValueChange={(v) => setCategory(v as SourceCategory)} disabled={running}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {SOURCE_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="flex flex-col gap-0.5 text-sm">
                  Tail on Document
                  <span className="text-xs font-normal text-muted-foreground">Provenance only</span>
                </Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="N477KR"
                  value={observedReg}
                  onChange={(e) => setObservedReg(e.target.value)}
                  disabled={running}
                  maxLength={20}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Records From</Label>
                <Input className="h-8 text-sm" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} disabled={running} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Records To</Label>
                <Input className="h-8 text-sm" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} disabled={running} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  placeholder="Optional"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  disabled={running}
                  maxLength={500}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Right — file queue */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Files
                {totalCount > 0 && (
                  <span className="ml-2 text-foreground">
                    {doneCount}/{totalCount} done
                    {failedCount > 0 && ` · ${failedCount} failed`}
                  </span>
                )}
              </p>

              {/* Drop zone */}
              <div
                className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
                onClick={() => !running && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.zip,application/pdf,application/zip,application/x-zip-compressed"
                  multiple
                  className="hidden"
                  onChange={onFileInputChange}
                  disabled={running}
                />
                <div className="flex flex-col items-center gap-1">
                  {extracting ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="flex gap-2 justify-center">
                      <File className="h-5 w-5 text-muted-foreground" />
                      <FileArchive className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {extracting
                      ? "Extracting ZIP…"
                      : "Drop PDFs or ZIPs here, or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    ZIPs are extracted automatically — each PDF uploaded separately
                  </p>
                </div>
              </div>

              {/* File list */}
              {queue.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {queue.map((file) => (
                    <div
                      key={file.key}
                      className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs"
                    >
                      <StatusIcon status={file.status} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-foreground">{file.name}</p>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>{formatBytes(file.sizeBytes)}</span>
                          {file.importBatch && (
                            <>
                              <span>·</span>
                              <span className="truncate">{file.importBatch}</span>
                            </>
                          )}
                          {file.status !== "queued" && (
                            <>
                              <span>·</span>
                              <span className={file.status === "failed" ? "text-destructive" : ""}>
                                {statusLabel(file.status)}
                              </span>
                            </>
                          )}
                        </div>
                        {file.error && (
                          <p className="text-destructive mt-0.5">{file.error}</p>
                        )}
                      </div>
                      {!running && file.status === "queued" && (
                        <button
                          onClick={() => removeFile(file.key)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={running}>
            {allDone ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={startUpload}
            disabled={running || queue.length === 0 || !aircraftId || allDone}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading {doneCount + failedCount}/{totalCount}…
              </>
            ) : allDone ? (
              `Done — ${doneCount} uploaded`
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {queue.length > 0 ? `${queue.length} file${queue.length !== 1 ? "s" : ""}` : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
