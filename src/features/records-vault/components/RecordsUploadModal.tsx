import { useState, useRef } from "react"
import { Upload, X, File } from "lucide-react"
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

interface Props {
  open: boolean
  onClose: () => void
  aircraft: AircraftBase[]
  defaultAircraftId?: string | null
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function RecordsUploadModal({ open, onClose, aircraft, defaultAircraftId }: Props) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [aircraftId, setAircraftId] = useState(defaultAircraftId ?? "")
  const [category, setCategory] = useState<SourceCategory>("logbook")
  const [observedReg, setObservedReg] = useState("")
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setAircraftId(defaultAircraftId ?? "")
    setCategory("logbook")
    setObservedReg("")
    setDateStart("")
    setDateEnd("")
    setNotes("")
    setFile(null)
    setUploading(false)
  }

  function handleClose() {
    if (!uploading) {
      reset()
      onClose()
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f && f.type !== "application/pdf") {
      toast({ title: "Only PDF files are accepted", variant: "destructive" })
      return
    }
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!aircraftId) {
      toast({ title: "Select an aircraft", variant: "destructive" })
      return
    }
    if (!file) {
      toast({ title: "Select a PDF file", variant: "destructive" })
      return
    }

    setUploading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error("Not authenticated")

      const token = session.access_token
      const fileHash = await sha256Hex(file)

      // Step 1: get signed upload URL
      const urlResp = await fetch("/.netlify/functions/records-vault-upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
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
        body: file,
        headers: { "Content-Type": "application/pdf" },
      })
      if (!uploadResp.ok) {
        throw new Error("File upload to storage failed")
      }

      // Step 3: register the source + trigger OCR
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
          fileSizeBytes: file.size,
          aircraftId,
          sourceCategory: category,
          observedRegistration: observedReg || null,
          dateRangeStart: dateStart || null,
          dateRangeEnd: dateEnd || null,
          notes: notes || null,
        }),
      })
      if (!regResp.ok) {
        const err = await regResp.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? "Failed to register record")
      }

      toast({
        title: "Record uploaded",
        description: "OCR processing has started. The record will appear in search once complete.",
      })

      // Invalidate source list so the new row appears immediately
      await queryClient.invalidateQueries({ queryKey: ["record-sources"] })
      reset()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed"
      toast({ title: "Upload failed", description: msg, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Record</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Aircraft */}
          <div className="space-y-1.5">
            <Label>Aircraft <span className="text-destructive">*</span></Label>
            <Select value={aircraftId} onValueChange={setAircraftId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select aircraft…" />
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

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Record Category <span className="text-destructive">*</span></Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SourceCategory)}>
              <SelectTrigger>
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

          {/* Observed registration */}
          <div className="space-y-1.5">
            <Label className="flex flex-col gap-0.5">
              Tail Number on Document
              <span className="text-xs font-normal text-muted-foreground">
                As printed on the scanned records (provenance, not identity)
              </span>
            </Label>
            <Input
              placeholder="e.g. N863CB"
              value={observedReg}
              onChange={(e) => setObservedReg(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Records From</Label>
              <Input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Records To</Label>
              <Input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional — describe what's in this file"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          {/* File picker */}
          <div className="space-y-1.5">
            <Label>PDF File <span className="text-destructive">*</span></Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              type="button"
              className="w-full flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/30 p-4 hover:bg-muted/50 transition-colors text-left"
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <>
                  <File className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm text-foreground truncate">{file.name}</span>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Click to select a PDF…</span>
                </>
              )}
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !file || !aircraftId}>
              {uploading ? "Uploading…" : "Upload & Process"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
