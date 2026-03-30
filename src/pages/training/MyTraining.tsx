import { useQuery } from "@tanstack/react-query"
import { GraduationCap, Unlink } from "lucide-react"
import { Card } from "@/shared/ui/card"
import { useAuth } from "@/features/auth"
import { mxlms } from "@/lib/supabase-mxlms"
import type { MxlmsTechnicianTraining, MxlmsTrainingCompletion, MxlmsAdHocCompletion } from "@/entities/mxlms"
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
              onRefresh={() => refetchAssignments()}
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
