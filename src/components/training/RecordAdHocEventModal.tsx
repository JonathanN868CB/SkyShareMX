import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog"
import { Label } from "@/shared/ui/label"
import { Button } from "@/shared/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import { useAuth } from "@/features/auth"
import { mxlms } from "@/lib/supabase-mxlms"
import type { MxlmsTechnician, MxlmsAdHocInsert, AdHocEventType } from "@/entities/mxlms"

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES: { value: AdHocEventType; label: string }[] = [
  { value: "general",              label: "General" },
  { value: "safety-observation",   label: "Safety Observation" },
  { value: "procedure-refresher",  label: "Procedure Refresher" },
  { value: "tooling-equipment",    label: "Tooling / Equipment" },
  { value: "regulatory-briefing",  label: "Regulatory Briefing" },
  { value: "ojt-mentorship",       label: "OJT / Mentorship" },
]

// ─── Field components ─────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label
      className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block"
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {children}
    </Label>
  )
}

function FieldInput({
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none transition-colors"
      style={{
        background: "hsl(0 0% 10%)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
      onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)" }}
      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
    />
  )
}

function FieldTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none resize-none transition-colors"
      style={{
        background: "hsl(0 0% 10%)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
      onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)" }}
      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
    />
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  techs: MxlmsTechnician[]
}

export function RecordAdHocEventModal({ open, onClose, onSuccess, techs }: Props) {
  const { profile } = useAuth()

  // Form state
  const [techId,      setTechId]      = useState<string>("")
  const [eventType,   setEventType]   = useState<AdHocEventType>("general")
  const [title,       setTitle]       = useState("")
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [duration,    setDuration]    = useState("")
  const [description, setDescription] = useState("")
  const [corrective,  setCorrective]  = useState("")
  const [severity,    setSeverity]    = useState<"low" | "medium" | "high" | "">("")
  const [requiresAck, setRequiresAck] = useState(true)
  const [notes,       setNotes]       = useState("")
  const [submitting,  setSubmitting]  = useState(false)

  function reset() {
    setTechId("")
    setEventType("general")
    setTitle("")
    setDate(new Date().toISOString().slice(0, 10))
    setDuration("")
    setDescription("")
    setCorrective("")
    setSeverity("")
    setRequiresAck(true)
    setNotes("")
    setSubmitting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  const canSubmit =
    !!techId &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    corrective.trim().length > 0 &&
    date.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || submitting) return

    const selectedTech = techs.find(t => t.id === Number(techId))

    const payload: MxlmsAdHocInsert = {
      technician_id:           Number(techId),
      name:                    title.trim(),
      category:                EVENT_TYPES.find(e => e.value === eventType)?.label ?? null,
      completed_date:          date,
      event_type:              eventType,
      description:             description.trim() || null,
      corrective_action:       corrective.trim() || null,
      severity:                eventType === "safety-observation" && severity ? severity : null,
      initiated_by_user_id:    profile?.id ?? null,
      initiated_by_name:       profile?.full_name ?? null,
      requires_acknowledgment: requiresAck,
      status:                  requiresAck ? "pending_acknowledgment" : "archived",
      notes:                   [
        duration ? `Duration: ${duration} min` : "",
        notes.trim(),
      ].filter(Boolean).join("\n") || null,
    }

    setSubmitting(true)
    try {
      const { error } = await mxlms.from("ad_hoc_completions").insert(payload)
      if (error) throw error

      toast.success(
        requiresAck
          ? `Ad hoc event recorded — ${selectedTech?.name ?? "Tech"} will see it in My Training`
          : `Ad hoc event recorded for ${selectedTech?.name ?? "Tech"}`
      )
      onSuccess()
      handleClose()
    } catch (err: any) {
      toast.error(err.message ?? "Failed to record event")
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
          height: "3px",
          background: "linear-gradient(90deg,#c10230 0%,#012e45 100%)",
          borderRadius: "8px 8px 0 0",
          marginTop: "-1px",
          marginLeft: "-25px",
          marginRight: "-25px",
          position: "relative",
          top: "-24px",
          marginBottom: "-20px",
        }} />

        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
            Record Ad Hoc Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">

          {/* Technician */}
          <div>
            <FieldLabel>Technician *</FieldLabel>
            <Select value={techId} onValueChange={setTechId}>
              <SelectTrigger
                className="w-full text-sm border-white/10"
                style={{ background: "hsl(0 0% 10%)", color: techId ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)" }}
              >
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

          {/* Severity — only for safety-observation */}
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
            <FieldInput
              value={title}
              onChange={setTitle}
              placeholder="Brief name for this event"
              required
            />
          </div>

          {/* Date + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Date *</FieldLabel>
              <FieldInput type="date" value={date} onChange={setDate} />
            </div>
            <div>
              <FieldLabel>Duration (min)</FieldLabel>
              <FieldInput
                type="number"
                value={duration}
                onChange={setDuration}
                placeholder="e.g. 30"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Description / What Happened *</FieldLabel>
            <FieldTextarea
              value={description}
              onChange={setDescription}
              placeholder="Describe the event, observation, or situation…"
              rows={3}
            />
          </div>

          {/* Corrective action */}
          <div>
            <FieldLabel>Corrective Action / Training Delivered *</FieldLabel>
            <FieldTextarea
              value={corrective}
              onChange={setCorrective}
              placeholder="What training was delivered or corrective action was taken…"
              rows={3}
            />
          </div>

          {/* Notes */}
          <div>
            <FieldLabel>Additional Notes</FieldLabel>
            <FieldTextarea
              value={notes}
              onChange={setNotes}
              placeholder="Optional — any other relevant details"
              rows={2}
            />
          </div>

          {/* Requires acknowledgment */}
          <div className="flex items-start gap-3 rounded px-3 py-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <input
              id="requires-ack"
              type="checkbox"
              checked={requiresAck}
              onChange={e => setRequiresAck(e.target.checked)}
              className="mt-0.5 shrink-0 accent-[var(--skyshare-gold)]"
              style={{ width: 14, height: 14 }}
            />
            <div>
              <label htmlFor="requires-ack" className="text-xs text-white/70 cursor-pointer select-none">
                Requires technician acknowledgment
              </label>
              <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>
                When checked, the event will appear in the tech's My Training page until they acknowledge it.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={submitting}
              className="text-white/40 hover:text-white/60"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              style={{
                background: canSubmit && !submitting ? "var(--skyshare-gold)" : "rgba(212,160,23,0.3)",
                color: canSubmit && !submitting ? "hsl(0 0% 8%)" : "rgba(0,0,0,0.4)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.1em",
              }}
            >
              {submitting ? "Recording…" : "Record Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
