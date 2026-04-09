import { useState } from "react"
import { toast } from "sonner"
import { localToday } from "@/shared/lib/dates"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog"
import { Label } from "@/shared/ui/label"
import { Button } from "@/shared/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { useAuth } from "@/features/auth"
import { mxlms } from "@/lib/supabase-mxlms"
import { computeSignatureHash } from "@/components/training/SignaturePanel"
import type { Profile } from "@/entities/supabase"
import type { MxlmsTechnician, MxlmsAdHocInsert, AdHocEventType, AdHocStatus } from "@/entities/mxlms"

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES: { value: AdHocEventType; label: string }[] = [
  { value: "general",              label: "General" },
  { value: "safety-observation",   label: "Safety Observation" },
  { value: "procedure-refresher",  label: "Procedure Refresher" },
  { value: "tooling-equipment",    label: "Tooling / Equipment" },
  { value: "regulatory-briefing",  label: "Regulatory Briefing" },
  { value: "ojt-mentorship",       label: "OJT / Mentorship" },
]

const MANAGER_ROLES = new Set(["Super Admin", "Admin", "Manager"])

// ─── Field helpers ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block"
      style={{ fontFamily: "var(--font-heading)" }}>
      {children}
    </Label>
  )
}

function FieldInput({
  value, onChange, placeholder, type = "text",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none transition-colors"
      style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.1)" }}
      onFocus={e  => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)" }}
      onBlur={e   => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
    />
  )
}

function FieldTextarea({
  value, onChange, placeholder, rows = 3,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none resize-none transition-colors"
      style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.1)" }}
      onFocus={e  => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)" }}
      onBlur={e   => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
    />
  )
}

// ─── Manager signature preview strip ─────────────────────────────────────────

function ManagerSignaturePreview({ name, email }: { name: string; email: string }) {
  return (
    <div className="rounded-lg px-4 py-3"
      style={{ background: "rgba(212,160,23,0.04)", border: "1px solid rgba(212,160,23,0.18)" }}>
      <p className="text-[9px] uppercase tracking-widest mb-2"
        style={{ color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)", opacity: 0.7 }}>
        Recorded & Signed by Manager
      </p>
      <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: "1.4rem", color: "var(--skyshare-gold)", lineHeight: 1.2 }}>
        {name}
      </div>
      <p className="text-[11px] text-white/35 mt-1" style={{ fontFamily: "var(--font-heading)" }}>
        {email} · Signature captured on submit
      </p>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  open:      boolean
  onClose:   () => void
  onSuccess: () => void
  techs:     MxlmsTechnician[]
  profiles:  Profile[]
}

export function RecordAdHocEventModal({ open, onClose, onSuccess, techs, profiles }: Props) {
  const { profile } = useAuth()

  const witnessOptions = profiles.filter(
    p => MANAGER_ROLES.has(p.role) && p.id !== profile?.id && p.status === "Active"
  )

  // Form state
  const [techId,      setTechId]      = useState<string>("")
  const [eventType,   setEventType]   = useState<AdHocEventType>("general")
  const [title,       setTitle]       = useState("")
  const [date,        setDate]        = useState(localToday())
  const [duration,    setDuration]    = useState("")
  const [description, setDescription] = useState("")
  const [corrective,  setCorrective]  = useState("")
  const [severity,    setSeverity]    = useState<"low" | "medium" | "high" | "">("")
  const [requiresAck, setRequiresAck] = useState(true)
  const [witnessId,   setWitnessId]   = useState<string>("none")
  const [notes,       setNotes]       = useState("")
  const [submitting,  setSubmitting]  = useState(false)

  function reset() {
    setTechId(""); setEventType("general"); setTitle("")
    setDate(localToday())
    setDuration(""); setDescription(""); setCorrective("")
    setSeverity(""); setRequiresAck(true); setWitnessId("none")
    setNotes(""); setSubmitting(false)
  }

  function handleClose() { reset(); onClose() }

  const canSubmit =
    !!techId &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    corrective.trim().length > 0

  // Derive the initial status from the form state
  function deriveStatus(): AdHocStatus {
    if (requiresAck) return "pending_tech_ack"
    if (witnessId && witnessId !== "none") return "pending_witness_ack"
    return "complete"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || submitting || !profile) return

    const now       = new Date().toISOString()
    const selectedWitness = witnessId !== "none"
      ? witnessOptions.find(p => p.id === witnessId) ?? null
      : null

    // Will be set after insert (need the record id for the hash)
    // Insert first, then compute hash and update — or compute optimistically.
    // We use a placeholder recordId=0 and patch immediately after insert.
    const status = deriveStatus()

    const payload: Omit<MxlmsAdHocInsert, "manager_signature_hash"> & { manager_signature_hash?: string } = {
      technician_id:           Number(techId),
      name:                    title.trim(),
      category:                EVENT_TYPES.find(e => e.value === eventType)?.label ?? null,
      completed_date:          date,
      event_type:              eventType,
      description:             description.trim() || null,
      corrective_action:       corrective.trim() || null,
      severity:                eventType === "safety-observation" && severity ? severity : null,
      requires_acknowledgment: requiresAck,
      status,
      // Manager identity
      initiated_by_user_id:  profile.user_id,
      initiated_by_name:     profile.full_name ?? null,
      initiated_by_email:    profile.email,
      manager_signed_at:     now,
      // Witness designation
      witness_user_id:  selectedWitness?.user_id ?? null,
      witness_name:     selectedWitness?.full_name ?? null,
      witness_email:    selectedWitness?.email ?? null,
      // Notes (combines duration + freeform)
      notes: [
        duration ? `Duration: ${duration} min` : "",
        notes.trim(),
      ].filter(Boolean).join("\n") || null,
    }

    setSubmitting(true)
    try {
      // Insert the record
      const { data: inserted, error: insertErr } = await mxlms
        .from("ad_hoc_completions")
        .insert(payload)
        .select("id")
        .single()
      if (insertErr || !inserted) throw insertErr ?? new Error("Insert returned no data")

      // Compute manager signature hash now that we have the record id
      const hash = await computeSignatureHash(profile.id, inserted.id, now)
      await mxlms
        .from("ad_hoc_completions")
        .update({ manager_signature_hash: hash })
        .eq("id", inserted.id)
      // Non-fatal if this update fails — identity is still captured in the other fields

      const techName = techs.find(t => t.id === Number(techId))?.name ?? "tech"
      const nextStep = status === "pending_tech_ack"
        ? `Card is live in ${techName}'s My Training`
        : status === "pending_witness_ack"
        ? `Waiting for ${selectedWitness?.full_name ?? "witness"} to sign`
        : "Recorded — MX-LMS will archive to Drive"

      toast.success(`Event recorded & signed — ${nextStep}`)
      onSuccess()
      handleClose()
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to record event")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: "hsl(0 0% 13%)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Crimson stripe */}
        <div style={{
          height: "3px", background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)",
          borderRadius: "8px 8px 0 0", marginTop: "-1px", marginLeft: "-25px", marginRight: "-25px",
          position: "relative", top: "-24px", marginBottom: "-20px",
        }} />

        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            Record Ad Hoc Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">

          {/* Manager signature preview — always shown */}
          {profile && (
            <ManagerSignaturePreview
              name={profile.full_name ?? profile.email}
              email={profile.email}
            />
          )}

          {/* Technician */}
          <div>
            <FieldLabel>Technician *</FieldLabel>
            <Select value={techId} onValueChange={setTechId}>
              <SelectTrigger className="w-full text-sm border-white/10"
                style={{ background: "hsl(0 0% 10%)", color: techId ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)" }}>
                <SelectValue placeholder="Select technician…" />
              </SelectTrigger>
              <SelectContent>
                {techs.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}{t.tech_code ? ` [${t.tech_code}]` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Event type */}
          <div>
            <FieldLabel>Event Type *</FieldLabel>
            <Select value={eventType} onValueChange={v => setEventType(v as AdHocEventType)}>
              <SelectTrigger className="w-full text-sm border-white/10" style={{ background: "hsl(0 0% 10%)" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map(e => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity — safety only */}
          {eventType === "safety-observation" && (
            <div>
              <FieldLabel>Severity</FieldLabel>
              <Select value={severity} onValueChange={v => setSeverity(v as "low" | "medium" | "high")}>
                <SelectTrigger className="w-full text-sm border-white/10" style={{ background: "hsl(0 0% 10%)" }}>
                  <SelectValue placeholder="Select severity…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div>
            <FieldLabel>Event Title *</FieldLabel>
            <FieldInput value={title} onChange={setTitle} placeholder="Brief name for this event" />
          </div>

          {/* Date + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Date *</FieldLabel>
              <FieldInput type="date" value={date} onChange={setDate} />
            </div>
            <div>
              <FieldLabel>Duration (min)</FieldLabel>
              <FieldInput type="number" value={duration} onChange={setDuration} placeholder="e.g. 30" />
            </div>
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description / What Happened *</FieldLabel>
            <FieldTextarea value={description} onChange={setDescription}
              placeholder="Describe the event, observation, or situation…" rows={3} />
          </div>

          {/* Corrective action */}
          <div>
            <FieldLabel>Corrective Action / Training Delivered *</FieldLabel>
            <FieldTextarea value={corrective} onChange={setCorrective}
              placeholder="What training was delivered or corrective action was taken…" rows={3} />
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Additional Notes</FieldLabel>
            <FieldTextarea value={notes} onChange={setNotes}
              placeholder="Optional — any other relevant details" rows={2} />
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)" }} />

          {/* Requires tech acknowledgment */}
          <div className="flex items-start gap-3 rounded px-3 py-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <input
              id="requires-ack"
              type="checkbox"
              checked={requiresAck}
              onChange={e => setRequiresAck(e.target.checked)}
              className="mt-0.5 shrink-0"
              style={{ width: 14, height: 14, accentColor: "var(--skyshare-gold)" }}
            />
            <div>
              <label htmlFor="requires-ack" className="text-xs text-white/70 cursor-pointer select-none font-medium">
                Requires technician acknowledgment
              </label>
              <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
                When checked, the card appears in the tech's My Training for their signature before moving on.
              </p>
            </div>
          </div>

          {/* Witness */}
          <div>
            <FieldLabel>Witness / Second Manager (optional)</FieldLabel>
            <Select value={witnessId} onValueChange={setWitnessId}>
              <SelectTrigger className="w-full text-sm border-white/10" style={{ background: "hsl(0 0% 10%)" }}>
                <SelectValue placeholder="No witness" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No witness required</SelectItem>
                {witnessOptions.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.email} · {p.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {witnessId && witnessId !== "none" && (
              <p className="text-[11px] text-white/30 mt-1.5" style={{ fontFamily: "var(--font-heading)" }}>
                After the tech signs, the card will route to {witnessOptions.find(p => p.id === witnessId)?.full_name ?? "witness"} for a second sign-off.
              </p>
            )}
          </div>

          {/* Flow preview */}
          <div className="flex items-center gap-2 text-[10px] text-white/25 flex-wrap"
            style={{ fontFamily: "var(--font-heading)" }}>
            <span style={{ color: "var(--skyshare-gold)" }}>You →</span>
            {requiresAck && <><span className="text-white/20">→</span><span>Tech signs</span></>}
            {witnessId && witnessId !== "none" && <><span className="text-white/20">→</span><span>Witness signs</span></>}
            <span className="text-white/20">→</span>
            <span>Archived to Drive</span>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}
              className="text-white/40 hover:text-white/60">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                background: canSubmit && !submitting ? "var(--skyshare-gold)" : "rgba(212,160,23,0.3)",
                color: canSubmit && !submitting ? "hsl(0 0% 8%)" : "rgba(0,0,0,0.4)",
                fontFamily: "var(--font-heading)", letterSpacing: "0.1em",
              }}
            >
              {submitting ? "Recording…" : "Sign & Record Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
