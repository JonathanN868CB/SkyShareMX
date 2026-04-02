import { useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GraduationCap, Unlink, XCircle, Bell, ShieldAlert, Plus, Upload, FileText, X, CalendarIcon } from "lucide-react"
import { SignaturePanel, SignatureBlock, type SignatureData } from "@/components/training/SignaturePanel"
import { ProposeTrainingItemModal } from "@/components/training/ProposeTrainingItemModal"
import { Button } from "@/shared/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import { Calendar } from "@/shared/ui/calendar"
import { Label } from "@/shared/ui/label"
import { Input } from "@/shared/ui/input"
import { toast } from "sonner"
import { Card } from "@/shared/ui/card"
import { useAuth } from "@/features/auth"
import { supabase } from "@/lib/supabase"
import { mxlms } from "@/lib/supabase-mxlms"
import { useViewAsTech } from "@/hooks/useViewAsTech"
import { ViewAsBar } from "@/components/training/ViewAsBar"
import type { MxlmsTechnicianTraining, MxlmsTrainingCompletion, MxlmsAdHocCompletion, MxlmsPendingCompletion, MxlmsPendingInsert } from "@/entities/mxlms"
import TrainingDashboard, { DueBadge } from "./TrainingDashboard"

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAssignments(techId: number): Promise<MxlmsTechnicianTraining[]> {
  const { data, error } = await mxlms
    .from("technician_training")
    .select("*, training_item:training_items(id,name,category,type,description,material_url,recurrence_interval)")
    .eq("technician_id", techId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsTechnicianTraining[]
}

async function fetchCompletions(techId: number): Promise<MxlmsTrainingCompletion[]> {
  const { data, error } = await mxlms
    .from("training_completions")
    .select("*, training_item:training_items(id,name,category)")
    .eq("technician_id", techId)
    .order("completed_date", { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as MxlmsTrainingCompletion[]
}

async function fetchAdHoc(techId: number): Promise<MxlmsAdHocCompletion[]> {
  const { data, error } = await mxlms
    .from("ad_hoc_completions")
    .select("*")
    .eq("technician_id", techId)
    .in("status", ["complete", "archived"])
    .order("completed_date", { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as MxlmsAdHocCompletion[]
}

async function fetchPending(techId: number): Promise<MxlmsPendingCompletion[]> {
  const { data, error } = await mxlms
    .from("pending_completions")
    .select("id,technician_id,matched_training_item_id,status,review_notes,file_name,detected_at,storage_path,submitter_note")
    .eq("technician_id", techId)
    .in("status", ["pending", "rejected"])
    .order("detected_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsPendingCompletion[]
}

async function fetchHistoricalSubmissions(techId: number): Promise<MxlmsPendingCompletion[]> {
  const { data, error } = await mxlms
    .from("pending_completions")
    .select("id,technician_id,matched_training_item_id,status,review_notes,file_name,detected_at,storage_path,submitter_note,reviewed_at")
    .eq("technician_id", techId)
    .is("matched_training_item_id", null)
    .not("submitter_note", "is", null)
    .not("status", "eq", "cleared")
    .order("detected_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as MxlmsPendingCompletion[]
}

async function fetchPendingAcknowledgments(techId: number): Promise<MxlmsAdHocCompletion[]> {
  const { data, error } = await mxlms
    .from("ad_hoc_completions")
    .select("*")
    .eq("technician_id", techId)
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

// ─── Submitted Proposals Panel ───────────────────────────────────────────────

async function fetchMyProposals(userId: string) {
  const { data, error } = await mxlms
    .from("pending_training_items")
    .select("id,name,category,priority,status,proposed_at,review_notes")
    .eq("proposed_by_user_id", userId)
    .order("proposed_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  proposed: { color: "rgba(212,160,23,0.85)",  label: "Pending Review" },
  accepted: { color: "#10b981",                label: "Accepted" },
  rejected: { color: "#e05070",                label: "Rejected" },
}

function SubmittedProposalsPanel({ userId }: { userId: string }) {
  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["my-proposals", userId],
    queryFn: () => fetchMyProposals(userId),
    enabled: !!userId,
  })

  if (isLoading) return (
    <div className="px-5 py-6 text-xs text-white/30 text-center">Loading…</div>
  )
  if (proposals.length === 0) return (
    <div className="px-5 py-6 text-xs text-white/30 text-center">No proposals submitted yet.</div>
  )

  return (
    <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      {proposals.map((p: { id: number; name: string; category: string; priority: string; status: string; proposed_at: string; review_notes: string | null }) => {
        const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.proposed
        return (
          <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-white/80 truncate">{p.name}</p>
              <p className="text-[11px] text-white/35 mt-0.5"
                style={{ fontFamily: "var(--font-heading)" }}>
                {p.category} · {new Date(p.proposed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              {p.status === "rejected" && p.review_notes && (
                <p className="text-[11px] mt-1" style={{ color: "#e05070" }}>Note: {p.review_notes}</p>
              )}
            </div>
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: `${s.color}18`, color: s.color, fontFamily: "var(--font-heading)", border: `1px solid ${s.color}40` }}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Historical Training Upload Modal ────────────────────────────────────────

function parseSubmitterNote(note: string | null): Record<string, string> {
  const result: Record<string, string> = {}
  if (!note) return result
  for (const part of note.split(" | ")) {
    const idx = part.indexOf(": ")
    if (idx > 0) result[part.slice(0, idx)] = part.slice(idx + 2)
  }
  return result
}

function HistoricalUploadModal({
  techId,
  open,
  onClose,
  onSuccess,
  editRecord,
}: {
  techId: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editRecord?: MxlmsPendingCompletion | null
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const parsed = editRecord ? parseSubmitterNote(editRecord.submitter_note) : null
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState(parsed?.["Name"] ?? "")
  const [category, setCategory] = useState(parsed?.["Category"] ?? "")
  const [completionDate, setCompletionDate] = useState(parsed?.["Completed"] ?? "")
  const [notes, setNotes] = useState(parsed?.["Notes"] ?? "")
  const [uploading, setUploading] = useState(false)

  // Re-populate when editRecord changes or dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      const p = editRecord ? parseSubmitterNote(editRecord.submitter_note) : null
      setName(p?.["Name"] ?? "")
      setCategory(p?.["Category"] ?? "")
      setCompletionDate(p?.["Completed"] ?? "")
      setNotes(p?.["Notes"] ?? "")
      setFile(null)
      setUploading(false)
    }
    if (!v) onClose()
  }

  // For edits: file is optional (keep existing), for new: required
  const isEdit = !!editRecord
  const canSubmit = name.trim() && completionDate && (file || isEdit) && !uploading

  function handleClose() {
    setFile(null)
    setName("")
    setCategory("")
    setCompletionDate("")
    setNotes("")
    setUploading(false)
    onClose()
  }

  async function handleUpload() {
    if (!name.trim() || !completionDate) return
    if (!file && !isEdit) return
    setUploading(true)
    try {
      let storagePath = editRecord?.storage_path ?? ""
      let storageUrl = ""

      if (file) {
        // Upload new file
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        storagePath = `${techId}/${timestamp}-${safeName}`

        const { error: uploadErr } = await supabase.storage
          .from("training-docs")
          .upload(storagePath, file, { upsert: false })
        if (uploadErr) throw uploadErr

        const { data: signedData, error: signErr } = await supabase.storage
          .from("training-docs")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10)
        if (signErr) throw signErr
        storageUrl = signedData.signedUrl

        // Clean up old file if replacing
        if (isEdit && editRecord.storage_path) {
          await supabase.storage.from("training-docs").remove([editRecord.storage_path])
        }
      }

      // Build submitter_note
      const noteParts = [
        `Name: ${name.trim()}`,
        category.trim() ? `Category: ${category.trim()}` : null,
        `Completed: ${completionDate}`,
        notes.trim() ? `Notes: ${notes.trim()}` : null,
      ].filter(Boolean)

      if (isEdit) {
        // Update existing record back to pending
        const updatePayload: Record<string, unknown> = {
          status: "pending",
          submitter_note: noteParts.join(" | "),
          review_notes: null,
          reviewed_at: null,
        }
        if (file) {
          updatePayload.storage_path = storagePath
          updatePayload.storage_url = storageUrl
          updatePayload.file_name = file.name
        }
        const { error: updateErr } = await mxlms
          .from("pending_completions")
          .update(updatePayload)
          .eq("id", editRecord.id)
        if (updateErr) throw updateErr
        toast.success("Record resubmitted — pending manager review")
      } else {
        // Insert new record
        const payload: MxlmsPendingInsert = {
          technician_id: techId,
          storage_path: storagePath,
          storage_url: storageUrl,
          file_name: file!.name,
          status: "pending",
          matched_training_item_id: null,
          submitter_note: noteParts.join(" | "),
        }
        const { error: insertErr } = await mxlms.from("pending_completions").insert(payload)
        if (insertErr) throw insertErr
        toast.success("Historical record submitted — pending manager review")
      }

      onSuccess()
      handleClose()
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div style={{ height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)", borderRadius: "8px 8px 0 0", marginTop: "-1px", marginLeft: "-25px", marginRight: "-25px", position: "relative", top: "-24px", marginBottom: "-20px" }} />

        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            {isEdit ? "Edit & Resubmit" : "Add Historical Training Record"}
          </DialogTitle>
        </DialogHeader>

        {isEdit && editRecord.review_notes && (
          <div className="rounded px-3 py-2.5 -mt-1 mb-1"
            style={{ background: "rgba(193,2,48,0.08)", border: "1px solid rgba(193,2,48,0.2)" }}>
            <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "#e05070", fontFamily: "var(--font-heading)" }}>Rejection Note</p>
            <p className="text-xs text-white/60 italic">{editRecord.review_notes}</p>
          </div>
        )}
        <p className="text-[11px] text-white/35 -mt-1 leading-relaxed" style={{ fontFamily: "var(--font-heading)" }}>
          {isEdit
            ? "Update the details below and resubmit. You can optionally upload a new document."
            : "Upload a certificate, completion record, or training document from your history. Your manager will review and match it to the training catalog."}
        </p>

        <div className="space-y-4 py-1">

          {/* Training Name */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block" style={{ fontFamily: "var(--font-heading)" }}>
              Training Name <span style={{ color: "#e05070" }}>*</span>
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Airbus A320 Factory Training"
              className="h-9 text-sm bg-white/5 border-white/10"
            />
          </div>

          {/* Category */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block" style={{ fontFamily: "var(--font-heading)" }}>
              Category <span className="text-white/20 normal-case tracking-normal">(optional)</span>
            </Label>
            <Input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Airframe, Powerplant, Avionics…"
              className="h-9 text-sm bg-white/5 border-white/10"
            />
          </div>

          {/* Completion Date */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block" style={{ fontFamily: "var(--font-heading)" }}>
              Completion Date <span style={{ color: "#e05070" }}>*</span>
            </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-2 h-9 px-3 rounded-md text-sm w-52 border transition-colors hover:border-white/20"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderColor: "rgba(255,255,255,0.1)",
                    color: completionDate ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
                  }}
                >
                  <CalendarIcon className="h-3.5 w-3.5 shrink-0" style={{ opacity: 0.5 }} />
                  {completionDate
                    ? new Date(completionDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Select a date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Calendar
                  mode="single"
                  selected={completionDate ? new Date(completionDate + "T12:00:00") : undefined}
                  onSelect={day => {
                    if (day) {
                      const y = day.getFullYear()
                      const m = String(day.getMonth() + 1).padStart(2, "0")
                      const d = String(day.getDate()).padStart(2, "0")
                      setCompletionDate(`${y}-${m}-${d}`)
                      setCalendarOpen(false)
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Document upload */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block" style={{ fontFamily: "var(--font-heading)" }}>
              Document {isEdit
                ? <span className="text-white/20 normal-case tracking-normal">(upload new to replace)</span>
                : <span style={{ color: "#e05070" }}>*</span>}
            </Label>
            {isEdit && !file && editRecord.file_name && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                <span className="text-xs text-white/40 truncate">Current: {editRecord.file_name}</span>
              </div>
            )}

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

          {/* Notes */}
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block" style={{ fontFamily: "var(--font-heading)" }}>
              Notes <span className="text-white/20 normal-case tracking-normal">(optional)</span>
            </Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. 3-week factory course, pre-hire — applicable to current ops"
              rows={3}
              className="w-full text-sm rounded-md px-3 py-2 bg-white/5 border border-white/10 text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={uploading} className="text-white/40 hover:text-white/60">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!canSubmit}
            className="gap-2"
            style={{
              background: canSubmit ? "var(--skyshare-gold)" : "rgba(212,160,23,0.3)",
              color: canSubmit ? "hsl(0 0% 8%)" : "rgba(0,0,0,0.4)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.1em",
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : isEdit ? "Resubmit" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { effectiveTechId, isViewingOther } = useViewAsTech()
  const techId = effectiveTechId

  const {
    data: assignments = [],
    isLoading: loadingAssignments,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["my-training-assignments", techId],
    queryFn: () => fetchAssignments(techId!),
    enabled: !!techId,
  })

  const {
    data: completions = [],
    isLoading: loadingCompletions,
  } = useQuery({
    queryKey: ["my-training-completions", techId],
    queryFn: () => fetchCompletions(techId!),
    enabled: !!techId,
  })

  const {
    data: adHoc = [],
    isLoading: loadingAdHoc,
  } = useQuery({
    queryKey: ["my-training-adhoc", techId],
    queryFn: () => fetchAdHoc(techId!),
    enabled: !!techId,
  })

  const {
    data: pending = [],
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["my-training-pending", techId],
    queryFn: () => fetchPending(techId!),
    enabled: !!techId,
  })

  const {
    data: historicalSubs = [],
    refetch: refetchHistorical,
  } = useQuery({
    queryKey: ["my-historical-submissions", techId],
    queryFn: () => fetchHistoricalSubmissions(techId!),
    enabled: !!techId,
  })

  const {
    data: pendingAck = [],
    isLoading: loadingAck,
    refetch: refetchAck,
  } = useQuery({
    queryKey: ["my-training-pending-ack", techId],
    queryFn: () => fetchPendingAcknowledgments(techId!),
    enabled: !!techId,
  })

  const {
    data: pendingWitness = [],
    isLoading: loadingWitness,
    refetch: refetchWitness,
  } = useQuery({
    queryKey: ["my-training-pending-witness", profile?.user_id],
    queryFn: () => fetchPendingWitness(profile!.user_id),
    enabled: !!profile?.user_id,
  })

  const [signingId,        setSigningId]        = useState<number | null>(null)
  const [proposeModalOpen, setProposeModalOpen] = useState(false)
  const [historicalOpen,   setHistoricalOpen]   = useState(false)
  const [editingRecord,    setEditingRecord]    = useState<MxlmsPendingCompletion | null>(null)

  const canProposeTraining = profile?.role === "Super Admin" || profile?.role === "Admin"

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

  async function handleTechSign(item: MxlmsAdHocCompletion, sig: SignatureData): Promise<void> {
    setSigningId(item.id)
    const nextStatus = item.witness_user_id ? "pending_witness_ack" : "complete"
    try {
      const { error } = await mxlms
        .from("ad_hoc_completions")
        .update({
          acknowledged_at:      sig.timestamp,
          tech_signed_by_name:  sig.name,
          tech_signed_by_email: sig.email,
          tech_signature_hash:  sig.hash,
          status:               nextStatus,
        })
        .eq("id", item.id)
      if (error) throw error

      toast.success(
        nextStatus === "complete"
          ? "Signed — record complete, MX-LMS will archive to Drive"
          : `Signed — routing to ${item.witness_name ?? "witness"} for sign-off`
      )
      refetchAck()
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

      toast.success("Witness signature applied — record complete, MX-LMS will archive to Drive")
      refetchWitness()
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
    qc.invalidateQueries({ queryKey: ["my-historical-submissions", techId] })
  }

  async function handleDismissHistorical(id: number): Promise<void> {
    const { error } = await mxlms
      .from("pending_completions")
      .update({ status: "cleared" })
      .eq("id", id)
    if (error) {
      toast.error(error.message ?? "Failed to clear record")
      return
    }
    toast.success("Record cleared")
    refetchHistorical()
  }

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div className="hero-area">
        <div className="flex items-start justify-between gap-4">
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
          <div className="flex items-center gap-2 mt-1 shrink-0">
            {techId && !isViewingOther && (
              <Button
                onClick={() => setHistoricalOpen(true)}
                variant="outline"
                className="gap-2"
                style={{
                  borderColor: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "0.08em",
                  background: "transparent",
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                Add Historical Record
              </Button>
            )}
            {canProposeTraining && (
              <Button
                onClick={() => setProposeModalOpen(true)}
                variant="outline"
                className="gap-2"
                style={{
                  borderColor: "rgba(212,160,23,0.4)",
                  color: "rgba(212,160,23,0.85)",
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "0.08em",
                  background: "transparent",
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Propose Training
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground"
          style={{ letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>
          Assignments, completion docs, and your training record
        </p>
      </div>

      <ProposeTrainingItemModal
        open={proposeModalOpen}
        onClose={() => setProposeModalOpen(false)}
        onSuccess={() => {}}
      />

      {techId && (
        <HistoricalUploadModal
          techId={techId}
          open={historicalOpen || !!editingRecord}
          onClose={() => { setHistoricalOpen(false); setEditingRecord(null) }}
          onSuccess={() => {
            refetchPending()
            refetchHistorical()
          }}
          editRecord={editingRecord}
        />
      )}

      {/* View As bar — Super Admin only */}
      <ViewAsBar page="training" />

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

          {/* Pending Acknowledgments — Super Admins can sign on behalf of the viewed tech */}
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
              readOnly={isViewingOther}
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

          {/* Submitted Historical Records */}
          {historicalSubs.length > 0 && (
            <Card className="card-elevated border-0 overflow-hidden">
              <SectionHeader
                title="Submitted Historical Records"
                sub="Training documents you've uploaded for review"
              />
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {historicalSubs.map(sub => {
                  const statusStyle =
                    sub.status === "pending"  ? { color: "rgba(212,160,23,0.85)", label: "Pending Review", bg: "rgba(212,160,23,0.12)" } :
                    sub.status === "approved" ? { color: "#10b981", label: "Accepted", bg: "rgba(16,185,129,0.12)" } :
                    sub.status === "rejected" ? { color: "#e05070", label: "Rejected", bg: "rgba(193,2,48,0.12)" } :
                                                { color: "rgba(255,255,255,0.3)", label: sub.status, bg: "rgba(255,255,255,0.05)" }

                  // Parse submitter_note for display
                  const noteParts: Record<string, string> = {}
                  if (sub.submitter_note) {
                    for (const part of sub.submitter_note.split(" | ")) {
                      const idx = part.indexOf(": ")
                      if (idx > 0) noteParts[part.slice(0, idx)] = part.slice(idx + 2)
                    }
                  }

                  return (
                    <div key={sub.id} className="px-5 py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/80 truncate">{noteParts["Name"] || sub.file_name || "Historical Record"}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {noteParts["Category"] && (
                            <span className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                              {noteParts["Category"]}
                            </span>
                          )}
                          {noteParts["Completed"] && (
                            <span className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-heading)" }}>
                              {noteParts["Category"] ? "·" : ""} Completed {noteParts["Completed"]}
                            </span>
                          )}
                          <span className="text-[10px] text-white/20" style={{ fontFamily: "var(--font-heading)" }}>
                            · Submitted {new Date(sub.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        {sub.status === "rejected" && sub.review_notes && (
                          <p className="text-[11px] mt-1" style={{ color: "#e05070" }}>Note: {sub.review_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: statusStyle.bg, color: statusStyle.color, fontFamily: "var(--font-heading)", border: `1px solid ${statusStyle.color}40` }}>
                          {statusStyle.label}
                        </span>
                        {sub.status === "rejected" && (
                          <button
                            onClick={() => setEditingRecord(sub)}
                            className="text-[10px] uppercase tracking-wider transition-colors px-2 py-0.5 rounded"
                            style={{ color: "var(--skyshare-gold)", border: "1px solid rgba(212,160,23,0.3)", fontFamily: "var(--font-heading)" }}
                          >
                            Edit & Resubmit
                          </button>
                        )}
                        {sub.status === "approved" && (
                          <button
                            onClick={() => handleDismissHistorical(sub.id)}
                            className="text-[10px] uppercase tracking-wider text-white/25 hover:text-white/50 transition-colors"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            Clear
                          </button>
                        )}
                        {sub.status === "pending" && (
                          <button
                            onClick={() => handleCancelSubmission(sub.id)}
                            className="text-[10px] uppercase tracking-wider text-white/25 hover:text-white/50 transition-colors"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Submitted Training Proposals — Admin / Manager only */}
          {(profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager") && profile?.id && (
            <Card className="card-elevated border-0 overflow-hidden">
              <SectionHeader
                title="Submitted Training Proposals"
                sub="Training items you've proposed for Jonathan's review"
              />
              <SubmittedProposalsPanel userId={profile.id} />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
