import { useMemo, useState, useRef } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Upload, CheckCircle2, Clock, ExternalLink, X, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/shared/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog"
import { Label } from "@/shared/ui/label"
import { supabase } from "@/lib/supabase"
import { mxlms } from "@/lib/supabase-mxlms"
import type { MxlmsTechnicianTraining, MxlmsPendingInsert } from "@/entities/mxlms"

// ─── Due-date helpers ─────────────────────────────────────────────────────────

type Urgency = "overdue" | "soon" | "normal" | "far" | "none"

function getUrgency(dueDateStr: string | null): Urgency {
  if (!dueDateStr?.trim()) return "none"
  const due  = new Date(dueDateStr)
  if (isNaN(due.getTime())) return "none"
  const diff = Math.floor((due.getTime() - Date.now()) / 86_400_000)
  if (diff < 0)  return "overdue"
  if (diff <= 7) return "soon"
  if (diff <= 30) return "normal"
  return "far"
}

function getDueDiff(dueDateStr: string | null): number {
  if (!dueDateStr?.trim()) return Infinity
  const due = new Date(dueDateStr)
  if (isNaN(due.getTime())) return Infinity
  return Math.floor((due.getTime() - Date.now()) / 86_400_000)
}

function formatDate(str: string | null): string {
  if (!str?.trim()) return "—"
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function DueBadge({ dueDateStr }: { dueDateStr: string | null }) {
  const urgency = getUrgency(dueDateStr)
  const diff    = getDueDiff(dueDateStr)

  if (urgency === "none") return <span style={{ color: "hsl(var(--muted-foreground))" }}>—</span>

  if (urgency === "overdue") {
    const days = Math.abs(diff)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
        style={{ background: "rgba(193,2,48,0.15)", color: "#e05070", border: "1px solid rgba(193,2,48,0.25)", fontFamily: "var(--font-heading)" }}>
        <AlertTriangle size={9} />
        {days === 1 ? "1 day overdue" : `${days}d overdue`}
      </span>
    )
  }

  if (urgency === "soon") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
        style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", fontFamily: "var(--font-heading)" }}>
        {diff === 0 ? "Due today" : `${diff}d left`}
      </span>
    )
  }

  return (
    <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
      {formatDate(dueDateStr)}
    </span>
  )
}

function Pill({ label }: { label: string | null }) {
  if (!label?.trim()) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tracking-wider"
      style={{ background: "rgba(255,255,255,0.06)", color: "hsl(var(--muted-foreground))", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-heading)" }}>
      {label}
    </span>
  )
}

// ─── Upload Completion Modal ──────────────────────────────────────────────────

function UploadModal({
  assignment,
  techId,
  open,
  onClose,
  onSuccess,
}: {
  assignment: MxlmsTechnicianTraining | null
  techId: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  function reset() {
    setFile(null)
    setUploading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleUpload() {
    if (!file || !assignment) return
    setUploading(true)
    try {
      // Build a clean storage path: {techId}/{timestamp}-{filename}
      const timestamp = Date.now()
      const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${techId}/${timestamp}-${safeName}`

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("training-docs")
        .upload(storagePath, file, { upsert: false })
      if (uploadErr) throw uploadErr

      // Get a signed URL (valid 10 years — Jonathan downloads from MX-LMS anyway)
      const { data: signedData, error: signErr } = await supabase.storage
        .from("training-docs")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10)
      if (signErr) throw signErr

      // Insert pending_completions row
      const payload: MxlmsPendingInsert = {
        technician_id: techId,
        storage_path:  storagePath,
        storage_url:   signedData.signedUrl,
        file_name:     file.name,
        status:        "pending",
      }
      const { error: insertErr } = await mxlms.from("pending_completions").insert(payload)
      if (insertErr) throw insertErr

      toast.success("Submitted for review — your manager will be notified")
      onSuccess()
      handleClose()
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const isDragging = false

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        className="max-w-md"
        style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)", borderRadius: "4px 4px 0 0", marginTop: "-1px", marginLeft: "-1px", marginRight: "-1px", position: "relative", top: "-24px", marginBottom: "-20px" }} />

        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            Submit Completion Doc
          </DialogTitle>
        </DialogHeader>

        {assignment && (
          <div className="rounded px-3 py-2.5 mb-1"
            style={{ background: "rgba(212,160,23,0.07)", border: "1px solid rgba(212,160,23,0.18)" }}>
            <p className="text-[10px] uppercase tracking-wider text-[var(--skyshare-gold)] opacity-70 mb-0.5" style={{ fontFamily: "var(--font-heading)" }}>Training Item</p>
            <p className="text-sm text-white/85">{assignment.training_item?.name ?? `Assignment #${assignment.id}`}</p>
            {assignment.training_item?.category && (
              <p className="text-[11px] text-white/40 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>{assignment.training_item.category}</p>
            )}
          </div>
        )}

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-2 block" style={{ fontFamily: "var(--font-heading)" }}>
              Completion Document
            </Label>

            {file ? (
              <div className="flex items-center justify-between rounded px-3 py-2.5 gap-3"
                style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--skyshare-gold)" }} />
                  <span className="text-sm text-white/80 truncate">{file.name}</span>
                  <span className="text-[11px] text-white/30 shrink-0">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
                <button onClick={() => setFile(null)} className="text-white/30 hover:text-white/60 shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded px-4 py-6 flex flex-col items-center gap-2 transition-colors hover:border-white/20"
                style={{ background: "hsl(0 0% 10%)", border: "2px dashed rgba(255,255,255,0.1)" }}
              >
                <Upload className="h-5 w-5 text-white/25" />
                <span className="text-xs text-white/35" style={{ fontFamily: "var(--font-heading)" }}>
                  Click to select a file
                </span>
                <span className="text-[10px] text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
                  PDF · JPG · PNG · HEIC — max 50 MB
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <p className="text-[11px] text-white/30 leading-relaxed" style={{ fontFamily: "var(--font-heading)" }}>
            Your manager will review the document in MX-LMS and mark the training complete.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={uploading} className="text-white/40 hover:text-white/60">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="gap-2"
            style={{
              background: file && !uploading ? "var(--skyshare-gold)" : "rgba(212,160,23,0.3)",
              color: file && !uploading ? "hsl(0 0% 8%)" : "rgba(0,0,0,0.4)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.1em",
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Assignment row ───────────────────────────────────────────────────────────

function AssignmentRow({
  row,
  techId,
  onUploadSuccess,
}: {
  row: MxlmsTechnicianTraining
  techId: number
  onUploadSuccess: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const item      = row.training_item
  const hasExpand = !!item?.description?.trim() || !!item?.material_url?.trim()
  const isDone    = row.status === "completed"

  return (
    <>
      <tr className="transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {/* Expand chevron */}
        <td className="pl-4 pr-1 py-3 w-6">
          {hasExpand ? (
            <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : (
            <span className="w-[13px] block" />
          )}
        </td>

        {/* Training item name + category */}
        <td className="px-3 py-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {isDone && <CheckCircle2 size={13} className="shrink-0" style={{ color: "var(--skyshare-success, #10b981)" }} />}
              <span className="text-sm font-medium" style={{ color: isDone ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))" }}>
                {item?.name ?? `Assignment #${row.id}`}
              </span>
            </div>
            {item?.category && <Pill label={item.category} />}
          </div>
        </td>

        {/* Due date */}
        <td className="px-3 py-3 whitespace-nowrap">
          {isDone ? (
            <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              {formatDate(row.completed_date)}
            </span>
          ) : (
            <DueBadge dueDateStr={row.due_date} />
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-3">
          <Pill label={row.status} />
        </td>

        {/* Upload button */}
        <td className="px-3 py-3 pr-4">
          {!isDone && (
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-all hover:opacity-80"
              style={{ background: "var(--skyshare-gold)", color: "#111", fontFamily: "var(--font-heading)" }}
            >
              <Upload size={9} />
              Submit Doc
            </button>
          )}
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && hasExpand && (
        <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <td />
          <td colSpan={4} className="px-3 py-3">
            <div className="flex flex-col gap-2">
              {item?.description?.trim() && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] uppercase tracking-wider mt-0.5 shrink-0"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)", minWidth: 80 }}>
                    Description
                  </span>
                  <span className="text-xs leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {item.description}
                  </span>
                </div>
              )}
              {item?.material_url?.trim() && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider shrink-0"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)", minWidth: 80 }}>
                    Material
                  </span>
                  <a href={item.material_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs inline-flex items-center gap-1 hover:opacity-80"
                    style={{ color: "var(--skyshare-gold)" }}>
                    Open Reference <ExternalLink size={10} />
                  </a>
                </div>
              )}
              {row.due_date && !isDone && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider shrink-0"
                    style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5, fontFamily: "var(--font-heading)", minWidth: 80 }}>
                    Assigned
                  </span>
                  <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {formatDate(row.created_at)}
                  </span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      <UploadModal
        assignment={row}
        techId={techId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={onUploadSuccess}
      />
    </>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

interface Props {
  assignments:    MxlmsTechnicianTraining[]
  loading:        boolean
  techId:         number
  onRefresh:      () => void
}

export default function TrainingDashboard({ assignments, loading, techId, onRefresh }: Props) {
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter,   setStatusFilter]   = useState("open")

  const categories = useMemo(() => {
    const vals = [...new Set(assignments.map(r => r.training_item?.category).filter(Boolean))].sort() as string[]
    return vals
  }, [assignments])

  const filtered = useMemo(() => {
    return assignments
      .filter(r => categoryFilter === "all" || r.training_item?.category === categoryFilter)
      .filter(r => {
        if (statusFilter === "all")  return true
        if (statusFilter === "open") return r.status !== "completed"
        return r.status === statusFilter
      })
      .sort((a, b) => {
        const ua = getUrgency(a.due_date)
        const ub = getUrgency(b.due_date)
        if (ua === "overdue" && ub !== "overdue") return -1
        if (ub === "overdue" && ua !== "overdue") return  1
        return getDueDiff(a.due_date) - getDueDiff(b.due_date)
      })
  }, [assignments, categoryFilter, statusFilter])

  const overdueCount = useMemo(() =>
    assignments.filter(r => r.status !== "completed" && getUrgency(r.due_date) === "overdue").length,
  [assignments])

  return (
    <div className="flex flex-col gap-0">
      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 px-5 py-3"
          style={{ background: "rgba(193,2,48,0.1)", borderBottom: "1px solid rgba(193,2,48,0.2)" }}>
          <AlertTriangle size={13} style={{ color: "#e05070" }} />
          <span className="text-xs" style={{ color: "#e05070" }}>
            {overdueCount} overdue assignment{overdueCount !== 1 ? "s" : ""} — submit your completion docs to clear them.
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-5 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-1.5">
          {loading && <Clock size={12} className="animate-pulse shrink-0" style={{ color: "var(--skyshare-gold)" }} />}
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))", opacity: loading ? 1 : 0.4 }}>
            {loading ? "Loading…" : `${assignments.length} assignment${assignments.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-7 text-xs w-36 border-white/10 bg-white/4">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 text-xs w-32 border-white/10 bg-white/4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <CheckCircle2 size={24} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.2 }} />
          <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}>
            {assignments.length === 0
              ? "No training assignments yet."
              : "No assignments match your current filters."}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th className="w-6 pl-4" />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}>
                  Assignment
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}>
                  Due / Completed
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}>
                  Status
                </th>
                <th className="px-3 py-2.5 pr-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <AssignmentRow key={row.id} row={row} techId={techId} onUploadSuccess={onRefresh} />
              ))}
            </tbody>
          </table>

          <div className="px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
              {filtered.length} assignment{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== assignments.length ? ` (filtered from ${assignments.length})` : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
