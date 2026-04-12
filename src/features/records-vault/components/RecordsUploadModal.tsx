import { useState, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Upload, X, File, FileArchive, Image, CheckCircle2, AlertCircle, Loader2, MonitorCog } from "lucide-react"
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
import { pdfHasProblematicCodec, renderPdfPages, type RenderedPage, type RenderProgress } from "../lib/renderPdfPages"

// ─── Types ────────────────────────────────────────────────────────────────────

type FileStatus =
  | "queued"
  | "rendering"
  | "uploading"
  | "verifying"
  | "awaiting_register"
  | "processing"
  | "done"
  | "failed"

interface QueuedFile {
  key: string              // unique key for React rendering
  name: string             // display filename
  bytes: Uint8Array        // raw PDF bytes
  sizeBytes: number
  importBatch: string | null  // set when extracted from a zip
  status: FileStatus
  error?: string
  // Byte-progress during the storage PUT (0..sizeBytes)
  uploadedBytes?: number
  // JBIG2/CCITTFax rendering
  needsRendering?: boolean          // true if problematic codec detected
  detectedCodec?: string | null     // "JBIG2Decode" | "CCITTFaxDecode"
  renderedPages?: RenderedPage[]    // JPEG page images from PDFium
  renderProgress?: RenderProgress   // live rendering progress
}

/** Result of phase-A storage upload, consumed by phase-B register. */
type PutResult = {
  storagePath: string
  fileHash:    string
}

// Phase A: how many files to PUT to Supabase Storage in parallel. Cheap at
// the storage layer, and the client's uplink is the bottleneck anyway.
const PUT_CONCURRENCY = 4

// Phase B: gap between register() calls. Each register fires a Textract
// start-job, so staggering avoids the provisioned-throughput stampede we
// saw in the N477KR batch test.
const REGISTER_STAGGER_MS = 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

// Accepted image extensions for record uploads (scanned pages, handwritten notes, photos)
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".tiff", ".tif", ".webp", ".bmp"]
const ACCEPTED_EXTENSIONS = [".pdf", ...IMAGE_EXTENSIONS]

function isAcceptedFile(name: string): boolean {
  const lower = name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function isImageFile(name: string): boolean {
  const lower = name.toLowerCase()
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function getMimeType(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".tiff") || lower.endsWith(".tif")) return "image/tiff"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".bmp")) return "image/bmp"
  return "application/octet-stream"
}

/** Extract accepted files (PDFs + images) from a ZIP. */
function extractFilesFromZip(
  zipBytes: Uint8Array,
  zipName: string
): Array<{ name: string; bytes: Uint8Array; importBatch: string }> {
  const importBatch = zipName.replace(/\.zip$/i, "")
  const unzipped = unzipSync(zipBytes)

  return Object.entries(unzipped)
    .filter(([path]) => {
      const lower = path.toLowerCase()
      return (
        isAcceptedFile(lower) &&
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

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  aircraft: AircraftBase[]
  defaultAircraftId?: string | null
}

export function RecordsUploadModal({ open, onClose, aircraft, defaultAircraftId }: Props) {
  const { toast } = useToast()
  const navigate = useNavigate()
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
  const renderingCount = queue.filter((f) => f.status === "rendering").length
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
    if (running || renderingCount > 0) return
    reset()
    onClose()
  }

  // ─── File picker / drop ───────────────────────────────────────────────────

  async function addFiles(files: FileList | File[]) {
    setExtracting(true)
    const arr = Array.from(files)
    const newEntries: QueuedFile[] = []

    for (const file of arr) {
      const lower = file.name.toLowerCase()

      if (isAcceptedFile(lower)) {
        // PDF or image file — add directly
        const bytes = new Uint8Array(await file.arrayBuffer())
        // Detect problematic codecs (JBIG2/CCITTFax) in PDFs
        const isPdf = lower.endsWith(".pdf")
        const codec = isPdf ? pdfHasProblematicCodec(bytes) : { found: false, codec: null }
        newEntries.push({
          key: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          bytes,
          sizeBytes: file.size,
          importBatch: null,
          status: codec.found ? "rendering" : "queued",
          needsRendering: codec.found,
          detectedCodec: codec.codec,
        })
      } else if (
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed" ||
        lower.endsWith(".zip")
      ) {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer())
          const extracted = extractFilesFromZip(bytes, file.name)
          if (extracted.length === 0) {
            toast({ title: `${file.name}: no accepted files found inside zip`, variant: "destructive" })
            continue
          }
          for (const entry of extracted) {
            newEntries.push({
              key: `${entry.importBatch}-${entry.name}-${Math.random()}`,
              name: entry.name,
              bytes: entry.bytes,
              sizeBytes: entry.bytes.length,
              importBatch: entry.importBatch,
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
        toast({ title: `${file.name}: accepted formats are PDF, JPG, PNG, TIFF, or ZIP`, variant: "destructive" })
      }
    }

    setQueue((prev) => [...prev, ...newEntries])
    setExtracting(false)

    // Start PDFium rendering for any JBIG2/CCITTFax files
    for (const entry of newEntries) {
      if (entry.needsRendering) {
        startRendering(entry.key, entry.bytes)
      }
    }
  }

  /** Render all pages of a JBIG2 PDF to JPEG via PDFium WASM */
  async function startRendering(fileKey: string, pdfBytes: Uint8Array) {
    try {
      const bytesCopy = new Uint8Array(pdfBytes)
      const pages = await renderPdfPages(bytesCopy, 150, (progress) => {
        setQueue((prev) =>
          prev.map((f) =>
            f.key === fileKey ? { ...f, renderProgress: progress } : f,
          ),
        )
      })

      setQueue((prev) =>
        prev.map((f) =>
          f.key === fileKey
            ? { ...f, status: "queued", renderedPages: pages, renderProgress: undefined }
            : f,
        ),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Page rendering failed"
      console.warn(`[RecordsUpload] PDFium rendering failed for ${fileKey}:`, msg)
      // Fall back to queued without rendered pages — the document will be
      // processed by the Textract pipeline after S3 upload.
      setQueue((prev) =>
        prev.map((f) =>
          f.key === fileKey
            ? { ...f, status: "queued", needsRendering: false, renderProgress: undefined }
            : f,
        ),
      )
      toast({
        title: "Page pre-rendering failed",
        description: `${msg}. The file will still upload — server will handle image extraction.`,
        variant: "destructive",
      })
    }
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

  // ─── Phase A — PUT file to Supabase Storage (with byte progress) ──────────

  /**
   * Issues a direct XHR PUT against the Supabase Storage signed upload URL so
   * the browser gives us real byte-progress events. The supabase-js SDK's
   * `uploadToSignedUrl` wraps fetch() and doesn't surface progress at all,
   * which is why we're hand-rolling this.
   */
  async function putFileToStorage(
    file: QueuedFile,
    token: string,
  ): Promise<PutResult> {
    setQueue((prev) =>
      prev.map((f) => f.key === file.key ? { ...f, status: "uploading", uploadedBytes: 0 } : f)
    )

    const fileHash     = await sha256Hex(file.bytes)
    const safeName     = sanitizeFileName(file.name)
    const fileMimeType = getMimeType(file.name)

    // Step 1: get signed upload URL
    const urlResp = await fetch("/.netlify/functions/records-vault-upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: safeName,
        mimeType: fileMimeType,
        aircraftId,
      }),
    })
    if (!urlResp.ok) {
      const err = await urlResp.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? "Failed to get upload URL")
    }
    const { signedUrl, storagePath } = await urlResp.json() as {
      signedUrl:   string
      storagePath: string
    }

    // Step 2: XHR PUT with progress events.
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", signedUrl, true)
      xhr.setRequestHeader("Content-Type", fileMimeType)
      xhr.setRequestHeader("x-upsert", "false")

      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable) return
        setQueue((prev) =>
          prev.map((f) =>
            f.key === file.key ? { ...f, uploadedBytes: e.loaded } : f
          )
        )
      })

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Storage PUT failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`))
        }
      }
      xhr.onerror = () => reject(new Error("Network error during storage upload"))
      xhr.onabort = () => reject(new Error("Storage upload aborted"))

      // Wrap the raw bytes in a Blob so XHR reports length-computable progress.
      xhr.send(new Blob([file.bytes], { type: fileMimeType }))
    })

    // Step 3: ask the server to HEAD the object to confirm it landed. This
    // catches the rare case where the XHR reports 200 OK but the storage
    // write was dropped (browser tab closed mid-flight, body truncation, etc).
    setQueue((prev) =>
      prev.map((f) => f.key === file.key ? { ...f, status: "verifying" } : f)
    )
    const verifyResp = await fetch("/.netlify/functions/records-vault-verify-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ storagePath }),
    })
    if (!verifyResp.ok) {
      const err = await verifyResp.json().catch(() => ({}))
      throw new Error(
        (err as { error?: string }).error
          ?? `Upload verification failed (${verifyResp.status})`
      )
    }

    return { storagePath, fileHash }
  }

  // ─── Phase B — register source + pre-rendered page images ─────────────────

  async function registerSource(
    file: QueuedFile,
    putResult: PutResult,
    token: string,
  ): Promise<{ recordSourceId: string }> {
    setQueue((prev) =>
      prev.map((f) => f.key === file.key ? { ...f, status: "processing" } : f)
    )

    const pageImages = file.renderedPages ?? []

    const regResp = await fetch("/.netlify/functions/records-vault-register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        storagePath:          putResult.storagePath,
        originalFilename:     file.name,
        fileHash:             putResult.fileHash,
        fileSizeBytes:        file.sizeBytes,
        aircraftId,
        sourceCategory:       category,
        observedRegistration: observedReg || null,
        dateRangeStart:       dateStart || null,
        dateRangeEnd:         dateEnd || null,
        notes:                notes || null,
        importBatch:          file.importBatch,
        pageImagesPreRendered: pageImages.length,
      }),
    })
    if (!regResp.ok) {
      const err = await regResp.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? "Failed to register record")
    }

    const { recordSourceId } = await regResp.json() as { recordSourceId: string }

    // Step 4: upload pre-rendered page images (JBIG2/CCITTFax docs only)
    if (pageImages.length > 0 && recordSourceId) {
      const urlsResp = await fetch("/.netlify/functions/records-vault-page-image-urls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recordSourceId,
          pageCount: pageImages.length,
        }),
      })

      if (urlsResp.ok) {
        const { urls } = await urlsResp.json() as {
          urls: Array<{ pageNumber: number; token: string; uploadPath: string }>
        }

        const IMG_CONCURRENCY = 10
        for (let i = 0; i < urls.length; i += IMG_CONCURRENCY) {
          const batch = urls.slice(i, i + IMG_CONCURRENCY)
          await Promise.all(
            batch.map(async (urlInfo) => {
              const page = pageImages.find((p) => p.pageNumber === urlInfo.pageNumber)
              if (!page) return
              await supabase.storage
                .from("records-vault")
                .uploadToSignedUrl(urlInfo.uploadPath, urlInfo.token, page.jpeg, {
                  contentType: "image/jpeg",
                  upsert: true,
                })
            }),
          )
        }
      }
    }

    setQueue((prev) =>
      prev.map((f) => f.key === file.key ? { ...f, status: "done" } : f)
    )

    return { recordSourceId }
  }

  // ─── Two-phase upload queue ───────────────────────────────────────────────

  async function runInParallel<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    let cursor = 0
    const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (true) {
        const idx = cursor++
        if (idx >= items.length) return
        await worker(items[idx])
      }
    })
    await Promise.all(runners)
  }

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

    const pending = queue.filter((f) =>
      f.status === "queued"
      && (!f.needsRendering || (f.renderedPages && f.renderedPages.length > 0))
    )

    // Phase A — PUT files to Supabase Storage in parallel.
    const putResults = new Map<string, PutResult>()
    await runInParallel(pending, PUT_CONCURRENCY, async (file) => {
      try {
        const res = await putFileToStorage(file, token)
        putResults.set(file.key, res)
        setQueue((prev) =>
          prev.map((f) => f.key === file.key ? { ...f, status: "awaiting_register" } : f)
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed"
        setQueue((prev) =>
          prev.map((f) => f.key === file.key ? { ...f, status: "failed", error: msg } : f)
        )
      }
    })

    // Phase B — register each successfully-uploaded file, serialized with a
    // stagger so Textract start-job calls don't all fire at once.
    let firstRegistered: string | null = null
    let isFirst = true
    for (const file of pending) {
      const putResult = putResults.get(file.key)
      if (!putResult) continue  // failed phase A
      if (!isFirst) await sleep(REGISTER_STAGGER_MS)
      isFirst = false
      try {
        const { recordSourceId } = await registerSource(file, putResult, token)
        if (!firstRegistered) firstRegistered = recordSourceId
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Register failed"
        setQueue((prev) =>
          prev.map((f) => f.key === file.key ? { ...f, status: "failed", error: msg } : f)
        )
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["record-sources"] })
    setRunning(false)

    // Re-read the latest queue state via a functional callback so the counts
    // reflect any failures flipped by the phase handlers above.
    let successCount = 0
    let failureCount = 0
    setQueue((prev) => {
      successCount = prev.filter((f) => f.status === "done").length
      failureCount = prev.filter((f) => f.status === "failed").length
      return prev
    })

    if (failureCount === 0 && successCount > 0) {
      toast({
        title: `${successCount} file${successCount !== 1 ? "s" : ""} uploaded`,
        description: "Pipeline processing has started. Opening Pipeline view…",
      })
      // Hand off to the Pipeline Operations Panel so the user can watch the
      // stage rows flip from pending → running → green. If register produced
      // at least one recordSourceId, deep-link to it via the URL hash so the
      // Pipeline page can scroll/highlight that row in the future.
      reset()
      onClose()
      if (firstRegistered) {
        navigate(`/app/records-vault/pipeline#${firstRegistered}`)
      } else {
        navigate("/app/records-vault/pipeline")
      }
    } else if (failureCount > 0 && successCount > 0) {
      toast({
        title: `${successCount} uploaded, ${failureCount} failed`,
        description: "Check the failed files below — successful uploads are in Pipeline.",
        variant: "destructive",
      })
    } else if (failureCount > 0) {
      toast({
        title: `${failureCount} file${failureCount !== 1 ? "s" : ""} failed`,
        description: "Check the failed files below.",
        variant: "destructive",
      })
    }
  }

  // ─── Status icon ─────────────────────────────────────────────────────────

  function StatusIcon({ status }: { status: FileStatus }) {
    if (status === "done") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
    if (status === "failed") return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
    if (status === "rendering")
      return <MonitorCog className="h-4 w-4 animate-pulse text-amber-500 shrink-0" />
    if (status === "uploading" || status === "processing" || status === "verifying" || status === "awaiting_register")
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
    return <File className="h-4 w-4 text-muted-foreground shrink-0" />
  }

  function statusLabel(status: FileStatus, file?: QueuedFile): string {
    if (status === "rendering" && file?.renderProgress) {
      const p = file.renderProgress
      if (p.totalPages > 0) {
        return `Rendering ${p.pagesRendered}/${p.totalPages}…`
      }
      return "Loading PDFium…"
    }
    if (status === "uploading" && file && file.uploadedBytes != null && file.sizeBytes > 0) {
      const pct = Math.min(100, Math.round((file.uploadedBytes / file.sizeBytes) * 100))
      return `Uploading ${pct}%`
    }
    return ({
      queued:             "Queued",
      rendering:          "Rendering…",
      uploading:          "Uploading…",
      verifying:          "Verifying…",
      awaiting_register:  "Waiting to register…",
      processing:         "Registering…",
      done:               "Done",
      failed:             "Failed",
    })[status]
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
                  accept=".pdf,.zip,.jpg,.jpeg,.png,.tiff,.tif,.webp,.bmp,application/pdf,application/zip,application/x-zip-compressed,image/*"
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
                      <Image className="h-5 w-5 text-muted-foreground" />
                      <FileArchive className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {extracting
                      ? "Extracting ZIP…"
                      : "Drop PDFs, images, or ZIPs here — or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Accepts PDF, JPG, PNG, TIFF. ZIPs extracted automatically.
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
                              <span className={file.status === "failed" ? "text-destructive" : file.status === "rendering" ? "text-amber-500" : ""}>
                                {statusLabel(file.status, file)}
                              </span>
                            </>
                          )}
                          {file.needsRendering && file.status === "queued" && file.renderedPages && (
                            <>
                              <span>·</span>
                              <span className="text-amber-500">{file.renderedPages.length} pages rendered</span>
                            </>
                          )}
                        </div>
                        {file.status === "uploading" && file.sizeBytes > 0 && (
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-blue-500 transition-[width] duration-150"
                              style={{
                                width: `${Math.min(100, Math.round(((file.uploadedBytes ?? 0) / file.sizeBytes) * 100))}%`,
                              }}
                            />
                          </div>
                        )}
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
            disabled={running || queue.length === 0 || !aircraftId || allDone || renderingCount > 0}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Uploading {doneCount + failedCount}/{totalCount}…
              </>
            ) : renderingCount > 0 ? (
              <>
                <MonitorCog className="h-4 w-4 animate-pulse mr-2" />
                Rendering pages ({renderingCount} file{renderingCount !== 1 ? "s" : ""})…
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
