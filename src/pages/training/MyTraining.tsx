import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GraduationCap, Unlink, XCircle, Bell, ShieldAlert } from "lucide-react"
import { SignaturePanel, SignatureBlock, type SignatureData } from "@/components/training/SignaturePanel"
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
    .in("status", ["acknowledged", "archived"])
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

async function fetchPendingAcknowledgments(): Promise<MxlmsAdHocCompletion[]> {
  const { data, error } = await mxlms
    .from("ad_hoc_completions")
    .select("*")
    .eq("status", "pending_tech_ack")
    .order("completed_date", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsAdHocCompletion[]
}

async function fetchPendingWitness(userId: string): Promise<MxlmsAdHocCompletion[]> {
  const { data, error } = await mxlms
    .from("ad_hoc_completions")
    .select("*")
    .eq("status", "pending_witness_ack")
    .eq("witness_user_id", userId)
    .order("completed_date", { ascending: false })
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
    eventType?: string | null
    severity?: string | null
  }

  const EVENT_TYPE_SHORT: Record<string, string> = {
    "safety-observation":  "Safety",
    "procedure-refresher": "Procedure",
    "tooling-equipment":   "Tooling",
    "regulatory-briefing": "Regulatory",
    "ojt-mentorship":      "OJT",
    "general":             "General",
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
      docUrl: a.drive_url,
      eventType: a.event_type ?? null,
      severity: a.severity ?? null,
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
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-white/75">{row.name}</span>
                  {row.source === "ad-hoc" && row.eventType && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "var(--font-heading)" }}>
                        {EVENT_TYPE_SHORT[row.eventType] ?? row.eventType}
                      </span>
                      {row.severity && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase"
                          style={{
                            background: row.severity === "high" ? "rgba(193,2,48,0.12)" : row.severity === "medium" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.08)",
                            color:      row.severity === "high" ? "#e05070"              : row.severity === "medium" ? "#f59e0b"              : "#10b981",
                            border:     `1px solid ${row.severity === "high" ? "rgba(193,2,48,0.2)" : row.severity === "medium" ? "rgba(245,158,11,0.18)" : "rgba(16,185,129,0.15)"}`,
                            fontFamily: "var(--font-heading)",
                          }}>
                          {row.severity}
                        </span>
                      )}
                    </div>
                  )}
                </div>
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

// ─── Shared event card helpers ────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  "safety-observation":  "Safety Observation",
  "procedure-refresher": "Procedure Refresher",
  "tooling-equipment":   "Tooling / Equipment",
  "regulatory-briefing": "Regulatory Briefing",
  "ojt-mentorship":      "OJT / Mentorship",
  "general":             "General",
}

const SEVERITY_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  low:    { bg: "rgba(16,185,129,0.1)",  color: "#10b981", border: "rgba(16,185,129,0.2)" },
  medium: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
  high:   { bg: "rgba(193,2,48,0.12)",   color: "#e05070", border: "rgba(193,2,48,0.25)" },
}

function EventCardHeader({ item }: { item: MxlmsAdHocCompletion }) {
  const eventLabel = EVENT_TYPE_LABELS[item.event_type] ?? item.event_type
  const sevStyle   = item.severity ? SEVERITY_STYLES[item.severity] : null

  return (
    <div className="px-5 py-3.5 flex items-center gap-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(212,160,23,0.04)" }}>
      <Bell className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--skyshare-gold)" }} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white/85">{item.name}</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "var(--font-heading)" }}>
            {eventLabel}
          </span>
          {sevStyle && item.severity && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] tracking-wider uppercase"
              style={{ background: sevStyle.bg, color: sevStyle.color, border: `1px solid ${sevStyle.border}`, fontFamily: "var(--font-heading)" }}>
              <ShieldAlert className="h-2.5 w-2.5" />
              {item.severity}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[11px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
            {formatDate(item.completed_date)}
          </span>
          {item.initiated_by_name && (
            <span className="text-[11px] text-white/25" style={{ fontFamily: "var(--font-heading)" }}>
              Recorded by {item.initiated_by_name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function EventCardBody({ item }: { item: MxlmsAdHocCompletion }) {
  return (
    <div className="px-5 py-4 space-y-3">
      {item.description && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
            What Happened
          </p>
          <p className="text-sm text-white/60 leading-relaxed">{item.description}</p>
        </div>
      )}
      {item.corrective_action && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
            Training Delivered / Corrective Action
          </p>
          <p className="text-sm text-white/60 leading-relaxed">{item.corrective_action}</p>
        </div>
      )}
      {item.notes && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
            Notes
          </p>
          <p className="text-sm text-white/45 leading-relaxed">{item.notes}</p>
        </div>
      )}
    </div>
  )
}

// ─── Tech Acknowledgment Card ─────────────────────────────────────────────────

function TechAcknowledgmentCard({
  item,
  profile,
  onSign,
  signing,
}: {
  item:    MxlmsAdHocCompletion
  profile: { id: string; full_name: string | null; email: string }
  onSign:  (item: MxlmsAdHocCompletion, data: SignatureData) => void
  signing: boolean
}) {
  return (
    <div className="rounded-lg overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,160,23,0.2)" }}>
      <EventCardHeader item={item} />
      <EventCardBody item={item} />

      {/* Manager signature (already on the card) */}
      {item.manager_signed_at && (
        <div className="px-5 pb-3">
          <SignatureBlock
            name={item.initiated_by_name}
            email={item.initiated_by_email}
            timestamp={item.manager_signed_at}
            hash={item.manager_signature_hash}
            role="Manager"
          />
        </div>
      )}

      {/* Witness pending indicator */}
      {item.witness_name && (
        <div className="px-5 pb-3">
          <div className="rounded px-3 py-2 flex items-center gap-2"
            style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)" }}>
            <span className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
              After you sign, this card routes to{" "}
              <span style={{ color: "#10b981" }}>{item.witness_name}</span> for witness sign-off.
            </span>
          </div>
        </div>
      )}

      {/* Tech signing panel */}
      <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.08)" }}>
        <p className="text-[10px] uppercase tracking-wider text-white/20 mb-3" style={{ fontFamily: "var(--font-heading)" }}>
          Your Signature Required
        </p>
        <SignaturePanel
          userId={profile.id}
          name={profile.full_name ?? profile.email}
          email={profile.email}
          recordId={item.id}
          role="Technician"
          confirmText={`I, ${profile.full_name ?? profile.email}, confirm that I have received and understood the training described in this record.`}
          onSign={data => onSign(item, data)}
          signing={signing}
        />
      </div>
    </div>
  )
}

function PendingAcknowledgments({
  items,
  loading,
  profile,
  onSign,
  signingId,
}: {
  items:     MxlmsAdHocCompletion[]
  loading:   boolean
  profile:   { id: string; full_name: string | null; email: string }
  onSign:    (item: MxlmsAdHocCompletion, data: SignatureData) => void
  signingId: number | null
}) {
  if (loading || items.length === 0) return null

  return (
    <div className="rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(212,160,23,0.3)", background: "rgba(212,160,23,0.03)" }}>
      <div className="px-5 py-3.5 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(212,160,23,0.15)", background: "rgba(212,160,23,0.06)" }}>
        <Bell className="h-4 w-4 shrink-0" style={{ color: "var(--skyshare-gold)" }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
            PENDING ACKNOWLEDGMENTS
          </p>
          <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
            {items.length} event{items.length !== 1 ? "s" : ""} awaiting your signature
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {items.map(item => (
          <TechAcknowledgmentCard
            key={item.id}
            item={item}
            profile={profile}
            onSign={onSign}
            signing={signingId === item.id}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Witness Acknowledgment Section ──────────────────────────────────────────

function WitnessAcknowledgmentCard({
  item,
  profile,
  onSign,
  signing,
}: {
  item:    MxlmsAdHocCompletion
  profile: { id: string; full_name: string | null; email: string }
  onSign:  (item: MxlmsAdHocCompletion, data: SignatureData) => void
  signing: boolean
}) {
  return (
    <div className="rounded-lg overflow-hidden"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(16,185,129,0.2)" }}>
      <EventCardHeader item={item} />
      <EventCardBody item={item} />

      {/* Manager signature */}
      {item.manager_signed_at && (
        <div className="px-5 pb-3">
          <SignatureBlock
            name={item.initiated_by_name}
            email={item.initiated_by_email}
            timestamp={item.manager_signed_at}
            hash={item.manager_signature_hash}
            role="Manager"
          />
        </div>
      )}

      {/* Tech signature */}
      {item.acknowledged_at && (
        <div className="px-5 pb-3">
          <SignatureBlock
            name={item.tech_signed_by_name}
            email={item.tech_signed_by_email}
            timestamp={item.acknowledged_at}
            hash={item.tech_signature_hash}
            role="Technician"
          />
        </div>
      )}

      {/* Witness signing panel */}
      <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.08)" }}>
        <p className="text-[10px] uppercase tracking-wider text-white/20 mb-3" style={{ fontFamily: "var(--font-heading)" }}>
          Witness Sign-Off Required
        </p>
        <SignaturePanel
          userId={profile.id}
          name={profile.full_name ?? profile.email}
          email={profile.email}
          recordId={item.id}
          role="Witness"
          confirmText={`I, ${profile.full_name ?? profile.email}, confirm I have witnessed and verified this training event record.`}
          onSign={data => onSign(item, data)}
          signing={signing}
        />
      </div>
    </div>
  )
}

function PendingWitnessSection({
  items,
  loading,
  profile,
  onSign,
  signingId,
}: {
  items:     MxlmsAdHocCompletion[]
  loading:   boolean
  profile:   { id: string; full_name: string | null; email: string }
  onSign:    (item: MxlmsAdHocCompletion, data: SignatureData) => void
  signingId: number | null
}) {
  if (loading || items.length === 0) return null

  return (
    <div className="rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.02)" }}>
      <div className="px-5 py-3.5 flex items-center gap-3"
        style={{ borderBottom: "1px solid rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.05)" }}>
        <Bell className="h-4 w-4 shrink-0" style={{ color: "#10b981" }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: "#10b981", fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>
            PENDING WITNESS SIGN-OFF
          </p>
          <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
            {items.length} record{items.length !== 1 ? "s" : ""} awaiting your witness signature
          </p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {items.map(item => (
          <WitnessAcknowledgmentCard
            key={item.id}
            item={item}
            profile={profile}
            onSign={onSign}
            signing={signingId === item.id}
          />
        ))}
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

  const {
    data: pendingAck = [],
    isLoading: loadingAck,
    refetch: refetchAck,
  } = useQuery({
    queryKey: ["my-training-pending-ack", techId],
    queryFn: fetchPendingAcknowledgments,
    enabled: !!techId,
  })

  const {
    data: pendingWitness = [],
    isLoading: loadingWitness,
    refetch: refetchWitness,
  } = useQuery({
    queryKey: ["my-training-pending-witness", profile?.id],
    queryFn: () => fetchPendingWitness(profile!.id),
    enabled: !!profile?.id,
  })

  const [signingId, setSigningId] = useState<number | null>(null)

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

  function fireArchive(adHocId: number) {
    fetch("/.netlify/functions/adhoc-drive-archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adHocId, technicianId: techId }),
    }).catch(() => {})
  }

  async function handleTechSign(item: MxlmsAdHocCompletion, sig: SignatureData): Promise<void> {
    setSigningId(item.id)
    const nextStatus = item.witness_user_id ? "pending_witness_ack" : "complete"
    try {
      const { error } = await mxlms
        .from("ad_hoc_completions")
        .update({
          acknowledged_at:     sig.timestamp,
          tech_signed_by_name:  sig.name,
          tech_signed_by_email: sig.email,
          tech_signature_hash:  sig.hash,
          status:               nextStatus,
        })
        .eq("id", item.id)
      if (error) throw error

      toast.success(
        nextStatus === "complete"
          ? "Signed — archiving to Drive…"
          : `Signed — routing to ${item.witness_name ?? "witness"} for sign-off`
      )
      refetchAck()
      if (nextStatus === "complete") fireArchive(item.id)
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to sign")
    } finally {
      setSigningId(null)
    }
  }

  async function handleWitnessSign(item: MxlmsAdHocCompletion, sig: SignatureData): Promise<void> {
    setSigningId(item.id)
    try {
      const { error } = await mxlms
        .from("ad_hoc_completions")
        .update({
          witness_signed_at:      sig.timestamp,
          witness_signature_hash: sig.hash,
          status:                 "complete",
        })
        .eq("id", item.id)
      if (error) throw error

      toast.success("Witness signature applied — archiving to Drive…")
      refetchWitness()
      fireArchive(item.id)
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to sign")
    } finally {
      setSigningId(null)
    }
  }

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

      {/* Witness sign-off — visible to any user designated as witness, regardless of tech link */}
      {profile && (
        <PendingWitnessSection
          items={pendingWitness}
          loading={loadingWitness}
          profile={profile}
          onSign={handleWitnessSign}
          signingId={signingId}
        />
      )}

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

          {/* Pending Acknowledgments */}
          {profile && (
            <PendingAcknowledgments
              items={pendingAck}
              loading={loadingAck}
              profile={profile}
              onSign={handleTechSign}
              signingId={signingId}
            />
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
