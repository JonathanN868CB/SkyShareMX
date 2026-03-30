import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GraduationCap, Unlink, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/shared/ui/card"
import { useAuth } from "@/features/auth"
import { supabase } from "@/lib/supabase"
import { mxlms } from "@/lib/supabase-mxlms"
import type { MxlmsTechnicianTraining, MxlmsTrainingCompletion, MxlmsAdHocCompletion, MxlmsPendingCompletion } from "@/entities/mxlms"
import TrainingDashboard, { DueBadge } from "./TrainingDashboard"

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAssignments(): Promise<MxlmsTechnicianTraining[]> {
  const { data, error } = await mxlms
    .from("technician_training")
    .select("*, training_item:training_items(id,name,category,type,description,material_url,recurrence_interval)")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsTechnicianTraining[]
}

async function fetchCompletions(): Promise<MxlmsTrainingCompletion[]> {
  const { data, error } = await mxlms
    .from("training_completions")
    .select("*, training_item:training_items(id,name,category)")
    .order("completed_date", { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as MxlmsTrainingCompletion[]
}

async function fetchAdHoc(): Promise<MxlmsAdHocCompletion[]> {
  const { data, error } = await mxlms
    .from("ad_hoc_completions")
    .select("*")
    .order("completed_date", { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as MxlmsAdHocCompletion[]
}

async function fetchPending(): Promise<MxlmsPendingCompletion[]> {
  const { data, error } = await mxlms
    .from("pending_completions")
    .select("id,technician_id,matched_training_item_id,status,review_notes,file_name,detected_at,storage_path")
    .in("status", ["pending", "rejected"])
    .order("detected_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsPendingCompletion[]
}

// ─── Not-linked placeholder ───────────────────────────────────────────────────

function NotLinked() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="h-14 w-14 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Unlink className="h-6 w-6" style={{ color: "rgba(255,255,255,0.2)" }} />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-white/60">Training profile not connected</p>
        <p className="text-xs text-white/30 max-w-xs leading-relaxed" style={{ fontFamily: "var(--font-heading)" }}>
          Your manager links your account to MX-LMS from User Administration.
          Once connected, your assignments and completion history will appear here.
        </p>
      </div>
    </div>
  )
}

// ─── Completion History ───────────────────────────────────────────────────────

function formatDate(str: string | null): string {
  if (!str?.trim()) return "—"
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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

function CompletionHistory({
  completions,
  adHoc,
  loading,
}: {
  completions: MxlmsTrainingCompletion[]
  adHoc: MxlmsAdHocCompletion[]
  loading: boolean
}) {
  type HistoryRow = {
    key: string
    name: string
    category: string | null
    date: string | null
    source: "assigned" | "ad-hoc"
    docUrl: string | null
  }

  const rows: HistoryRow[] = [
    ...completions.filter(c => !c.superseded).map(c => ({
      key: `c-${c.id}`,
      name: c.training_item?.name ?? `Item #${c.training_item_id}`,
      category: c.training_item?.category ?? null,
      date: c.completed_date,
      source: "assigned" as const,
      docUrl: c.drive_url,
    })),
    ...adHoc.map(a => ({
      key: `a-${a.id}`,
      name: a.name,
      category: a.category,
      date: a.completed_date,
      source: "ad-hoc" as const,
      docUrl: null,
    })),
  ].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  if (loading) {
    return (
      <div className="py-10 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
        Loading history…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-xs text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
        No completion records yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {["Training / Certification", "Category", "Completed", "Type", ""].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-heading)", opacity: 0.6 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key} className="transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <td className="px-4 py-3">
                <span className="text-sm text-white/75">{row.name}</span>
              </td>
              <td className="px-4 py-3">
                <Pill label={row.category} />
              </td>
              <td className="px-4 py-3 text-xs text-white/45">
                {formatDate(row.date)}
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] tracking-wider"
                  style={{
                    background: row.source === "assigned" ? "rgba(70,100,129,0.15)" : "rgba(255,255,255,0.05)",
                    color: row.source === "assigned" ? "var(--skyshare-blue-mid, #4e7fa0)" : "rgba(255,255,255,0.3)",
                    border: `1px solid ${row.source === "assigned" ? "rgba(70,100,129,0.25)" : "rgba(255,255,255,0.08)"}`,
                    fontFamily: "var(--font-heading)",
                  }}>
                  {row.source === "assigned" ? "Assigned" : "Ad Hoc"}
                </span>
              </td>
              <td className="px-4 py-3 pr-5">
                {row.docUrl && (
                  <a href={row.docUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] uppercase tracking-wider transition-opacity hover:opacity-70"
                    style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
                    View Doc →
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }}>
          {rows.length} record{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <h2 className="text-sm font-semibold text-white/80" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}>
        {title}
      </h2>
      {sub && (
        <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>{sub}</p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyTraining() {
  const { profile } = useAuth()
  const techId = profile?.mxlms_technician_id ?? null

  const {
    data: assignments = [],
    isLoading: loadingAssignments,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["my-training-assignments", techId],
    queryFn: fetchAssignments,
    enabled: !!techId,
  })

  const {
    data: completions = [],
    isLoading: loadingCompletions,
  } = useQuery({
    queryKey: ["my-training-completions", techId],
    queryFn: fetchCompletions,
    enabled: !!techId,
  })

  const {
    data: adHoc = [],
    isLoading: loadingAdHoc,
  } = useQuery({
    queryKey: ["my-training-adhoc", techId],
    queryFn: fetchAdHoc,
    enabled: !!techId,
  })

  const {
    data: pending = [],
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["my-training-pending", techId],
    queryFn: fetchPending,
    enabled: !!techId,
  })

  const qc = useQueryClient()

  // Build submission map: training_item_id → most recent submission (pending beats rejected)
  const submissionsByItemId = new Map<number, MxlmsPendingCompletion>()
  for (const p of pending.filter(p => p.status === "pending" && p.matched_training_item_id != null)) {
    if (!submissionsByItemId.has(p.matched_training_item_id!)) {
      submissionsByItemId.set(p.matched_training_item_id!, p)
    }
  }
  for (const p of pending.filter(p => p.status === "rejected" && p.matched_training_item_id != null)) {
    if (!submissionsByItemId.has(p.matched_training_item_id!)) {
      submissionsByItemId.set(p.matched_training_item_id!, p)
    }
  }

  // Unlinked rejections (no matched_training_item_id) — shown in banner
  const unlinkedRejections = pending.filter(p => p.status === "rejected" && p.matched_training_item_id == null)

  async function handleCancelSubmission(id: number): Promise<void> {
    // Get the row first so we can clean up the storage file
    const { data: row, error: fetchErr } = await mxlms
      .from("pending_completions")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle()
    if (fetchErr) {
      toast.error(fetchErr.message ?? "Failed to retract submission")
      return
    }

    // Delete the file from Supabase Storage if present
    if (row?.storage_path) {
      await supabase.storage.from("training-docs").remove([row.storage_path])
      // Non-fatal — proceed even if storage delete fails
    }

    // Hard-delete the pending_completions record
    const { error: deleteErr } = await mxlms
      .from("pending_completions")
      .delete()
      .eq("id", id)
    if (deleteErr) {
      toast.error(deleteErr.message ?? "Failed to retract submission")
      return
    }

    toast.success("Submission retracted")
    qc.invalidateQueries({ queryKey: ["my-training-pending", techId] })
  }

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="hero-area">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8" style={{ color: "var(--skyshare-gold)" }} />
          <div>
            <h1 className="text-[2.6rem] leading-none text-foreground"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
              MY TRAINING
            </h1>
            <div className="mt-1.5" style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }} />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground"
          style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          Assignments, completion docs, and your training record
        </p>
      </div>

      {!techId ? (
        <Card className="card-elevated border-0">
          <NotLinked />
        </Card>
      ) : (
        <>
          {/* Unlinked rejection banner — for submissions we can't attach to a specific row */}
          {unlinkedRejections.length > 0 && (
            <div className="rounded-lg px-5 py-4 flex items-start gap-3"
              style={{ background: "rgba(193,2,48,0.08)", border: "1px solid rgba(193,2,48,0.2)" }}>
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#e05070" }} />
              <div className="flex-1">
                <p className="text-sm font-medium mb-1.5" style={{ color: "#e05070" }}>
                  {unlinkedRejections.length === 1 ? "A document was rejected" : `${unlinkedRejections.length} documents were rejected`}
                </p>
                <div className="space-y-2">
                  {unlinkedRejections.map(p => (
                    <div key={p.id} className="flex items-start justify-between gap-4">
                      <div>
                        {p.file_name && (
                          <p className="text-xs text-white/60" style={{ fontFamily: "var(--font-heading)" }}>{p.file_name}</p>
                        )}
                        <p className="text-xs text-white/40 italic">
                          {p.review_notes ?? "Rejected — please resubmit the correct document."}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCancelSubmission(p.id)}
                        className="text-[10px] uppercase tracking-wider text-white/30 hover:text-white/50 transition-colors shrink-0"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-2 text-white/35" style={{ fontFamily: "var(--font-heading)" }}>
                  Find the relevant assignment below and use Submit Doc to upload a corrected document.
                </p>
              </div>
            </div>
          )}

          {/* Active Assignments */}
          <Card className="card-elevated border-0 overflow-hidden">
            <SectionHeader
              title="Active Assignments"
              sub="Training assigned to you by your manager"
            />
            <TrainingDashboard
              assignments={assignments}
              loading={loadingAssignments}
              techId={techId}
              submissionsByItemId={submissionsByItemId}
              onCancelSubmission={handleCancelSubmission}
              onRefresh={() => { refetchAssignments(); refetchPending() }}
            />
          </Card>

          {/* Completion History */}
          <Card className="card-elevated border-0 overflow-hidden">
            <SectionHeader
              title="Completion History"
              sub="Verified completions and ad-hoc training records"
            />
            <CompletionHistory
              completions={completions}
              adHoc={adHoc}
              loading={loadingCompletions || loadingAdHoc}
            />
          </Card>
        </>
      )}
    </div>
  )
}
