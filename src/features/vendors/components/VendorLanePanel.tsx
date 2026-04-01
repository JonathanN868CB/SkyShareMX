import { useState } from "react"
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  Clock, CalendarCheck, AlertTriangle, CheckCircle2, FileText,
  Pencil, X, Plus, Save,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { GOLD } from "../constants"
import { Field } from "./Field"
import type { VendorLaneNine, VendorLaneTen, NineLaneStatus, TenLaneStatus } from "../types"

// ── Status display config ───────────────────────────────────────────────────

const NINE_STATUS_CONFIG: Record<NineLaneStatus, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  not_evaluated:  { label: "Not Evaluated",  color: "#6b7280", bg: "#6b728015", icon: ShieldQuestion },
  usable:         { label: "Usable",         color: "#16a34a", bg: "#16a34a15", icon: ShieldCheck },
  pending_review: { label: "Pending Review", color: "#d97706", bg: "#d9770615", icon: Clock },
  restricted:     { label: "Restricted",     color: "#dc2626", bg: "#dc262615", icon: ShieldAlert },
  not_applicable: { label: "N/A",            color: "#9ca3af", bg: "#9ca3af15", icon: Shield },
}

const TEN_STATUS_CONFIG: Record<TenLaneStatus, { label: string; color: string; bg: string; icon: typeof ShieldCheck }> = {
  not_evaluated:      { label: "Not Evaluated",      color: "#6b7280", bg: "#6b728015", icon: ShieldQuestion },
  recurring_approved: { label: "Recurring Approved", color: "#16a34a", bg: "#16a34a15", icon: ShieldCheck },
  ad_hoc_only:        { label: "Ad Hoc Only",        color: "#2563eb", bg: "#2563eb15", icon: Shield },
  pending_review:     { label: "Pending Review",     color: "#d97706", bg: "#d9770615", icon: Clock },
  expired:            { label: "Expired",            color: "#dc2626", bg: "#dc262615", icon: ShieldX },
  restricted:         { label: "Restricted",         color: "#dc2626", bg: "#dc262615", icon: ShieldAlert },
  inactive:           { label: "Inactive",           color: "#9ca3af", bg: "#9ca3af15", icon: Shield },
}

const NINE_STATUSES: NineLaneStatus[] = ["not_evaluated", "usable", "pending_review", "restricted", "not_applicable"]
const TEN_STATUSES: TenLaneStatus[] = ["not_evaluated", "recurring_approved", "ad_hoc_only", "pending_review", "expired", "restricted", "inactive"]

// ── Audit trail helper ──────────────────────────────────────────────────────

async function logHistory(vendorId: string, lane: string, field: string, oldVal: string | null, newVal: string | null, reason: string | null) {
  if (oldVal === newVal) return
  await supabase.from("vendor_status_history").insert({
    vendor_id: vendorId,
    lane,
    field_changed: field,
    old_value: oldVal,
    new_value: newVal,
    reason,
  })
}

// ── 9-or-less lane panel ────────────────────────────────────────────────────

export function NineLanePanel({ data, vendorId, canEdit, onRefresh }: {
  data: VendorLaneNine | null; vendorId: string; canEdit: boolean; onRefresh: () => void
}) {
  const { profile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!data) {
    return (
      <EmptyLane
        lane="9-or-Less"
        description="No compliance record exists for this lane yet."
        canInit={canEdit}
        onInit={async () => {
          await supabase.from("vendor_lane_nine").insert({
            vendor_id: vendorId,
            status: "not_evaluated",
            updated_by: profile?.user_id,
          })
          await logHistory(vendorId, "nine", "status", null, "not_evaluated", "Lane initialized")
          onRefresh()
        }}
      />
    )
  }

  if (editing) {
    return (
      <NineEditMode
        data={data}
        vendorId={vendorId}
        onSave={() => { setEditing(false); onRefresh() }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const statusCfg = NINE_STATUS_CONFIG[data.status]
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">9-or-Less Lane</p>
          <div className="flex items-center gap-2">
            <StatusIcon className="w-4 h-4" style={{ color: statusCfg.color }} />
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-sm"
              style={{ background: statusCfg.bg, color: statusCfg.color }}>
              {statusCfg.label}
            </span>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-sm"
            style={{ background: `${GOLD}18`, color: GOLD }}>
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <LaneField label="Capability Scope" value={data.capability_scope} />
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">AP Certificate</p>
          <div className="flex items-center gap-2">
            <ComplianceIcon verified={data.ap_certificate_verified} />
            <span className="text-xs">{data.ap_certificate_verified ? "Verified" : "Not verified"}</span>
            {data.ap_certificate_number && <span className="text-[10px] font-mono text-muted-foreground ml-1">#{data.ap_certificate_number}</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <LaneDateField label="Last Review" value={data.last_review_date} />
          <LaneDateField label="Next Review Due" value={data.next_review_due} fallback="N/A" />
        </div>
        {data.approved_at && (
          <LaneDateField label="Approved" value={data.approved_at} />
        )}
        <Warnings warnings={data.warnings} />
        <LaneField label="Lane Notes" value={data.notes} />
      </div>
    </div>
  )
}

// ── 10-or-more lane panel ───────────────────────────────────────────────────

export function TenLanePanel({ data, vendorId, canEdit, onRefresh }: {
  data: VendorLaneTen | null; vendorId: string; canEdit: boolean; onRefresh: () => void
}) {
  const { profile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!data) {
    return (
      <EmptyLane
        lane="10-or-More"
        description="No provider governance record exists for this lane yet."
        canInit={canEdit}
        onInit={async () => {
          await supabase.from("vendor_lane_ten").insert({
            vendor_id: vendorId,
            status: "not_evaluated",
            updated_by: profile?.user_id,
          })
          await logHistory(vendorId, "ten", "status", null, "not_evaluated", "Lane initialized")
          onRefresh()
        }}
      />
    )
  }

  if (editing) {
    return (
      <TenEditMode
        data={data}
        vendorId={vendorId}
        onSave={() => { setEditing(false); onRefresh() }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const statusCfg = TEN_STATUS_CONFIG[data.status]
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">10-or-More Lane</p>
          <div className="flex items-center gap-2">
            <StatusIcon className="w-4 h-4" style={{ color: statusCfg.color }} />
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-sm"
              style={{ background: statusCfg.bg, color: statusCfg.color }}>
              {statusCfg.label}
            </span>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-sm"
            style={{ background: `${GOLD}18`, color: GOLD }}>
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <LaneField label="Authorization Scope" value={data.authorization_scope} />
        <LaneField label="CRS Number" value={data.crs_number} />
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">Compliance Checks</p>
          <div className="space-y-1.5">
            <ComplianceCheck label="Drug Abatement Program" verified={data.drug_abatement_verified} />
            <ComplianceCheck label="Insurance Verified" verified={data.insurance_verified} />
            <ComplianceCheck label="GMM Form Complete" verified={data.gmm_form_complete} />
          </div>
        </div>
        {(data.argus_rating || data.isbao_rating) && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Ratings</p>
            <div className="flex gap-3">
              {data.argus_rating && <RatingBadge label="ARGUS" value={data.argus_rating} />}
              {data.isbao_rating && <RatingBadge label="IS-BAO" value={data.isbao_rating} />}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <LaneDateField label="Last Audit" value={data.last_audit_date} />
          <LaneDateField label="Next Audit Due" value={data.next_audit_due} fallback="N/A" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <LaneDateField label="Last Oversight Review" value={data.last_oversight_review} />
          <LaneDateField label="Next Oversight Due" value={data.next_oversight_review_due} fallback="N/A" />
        </div>
        {data.approved_at && <LaneDateField label="Approved" value={data.approved_at} />}
        <Warnings warnings={data.warnings} />
        <LaneField label="Lane Notes" value={data.notes} />
      </div>
    </div>
  )
}

// ── 9-or-less edit mode ─────────────────────────────────────────────────────

function NineEditMode({ data, vendorId, onSave, onCancel }: {
  data: VendorLaneNine; vendorId: string; onSave: () => void; onCancel: () => void
}) {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState("")
  const [form, setForm] = useState({
    status: data.status as NineLaneStatus,
    capability_scope: data.capability_scope ?? "",
    ap_certificate_verified: data.ap_certificate_verified,
    ap_certificate_number: data.ap_certificate_number ?? "",
    last_review_date: data.last_review_date ?? "",
    next_review_due: data.next_review_due ?? "",
    notes: data.notes ?? "",
  })

  async function handleSave() {
    setSaving(true)
    const now = new Date().toISOString()
    const payload: any = {
      status: form.status,
      capability_scope: form.capability_scope.trim() || null,
      ap_certificate_verified: form.ap_certificate_verified,
      ap_certificate_number: form.ap_certificate_number.trim() || null,
      last_review_date: form.last_review_date || null,
      next_review_due: form.next_review_due || null,
      notes: form.notes.trim() || null,
      updated_by: profile?.user_id,
    }

    // If status changed to usable and wasn't before, set approval
    if (form.status === "usable" && data.status !== "usable") {
      payload.approved_by = profile?.user_id
      payload.approved_at = now
    }

    await supabase.from("vendor_lane_nine").update(payload).eq("id", data.id)

    // Log status change
    if (form.status !== data.status) {
      await logHistory(vendorId, "nine", "status", data.status, form.status, reason.trim() || null)
    }
    // Log key field changes
    if (form.ap_certificate_verified !== data.ap_certificate_verified) {
      await logHistory(vendorId, "nine", "ap_certificate_verified",
        String(data.ap_certificate_verified), String(form.ap_certificate_verified), reason.trim() || null)
    }

    setSaving(false)
    onSave()
  }

  const statusChanged = form.status !== data.status

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>Edit · 9-or-Less Lane</p>
        <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <Field label="Status">
          <select className="form-input" value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as NineLaneStatus }))}>
            {NINE_STATUSES.map(s => (
              <option key={s} value={s}>{NINE_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Capability Scope">
          <textarea className="form-input resize-none" rows={2} value={form.capability_scope}
            onChange={e => setForm(f => ({ ...f, capability_scope: e.target.value }))}
            placeholder="What work is this vendor authorized for?" />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.ap_certificate_verified}
            onChange={e => setForm(f => ({ ...f, ap_certificate_verified: e.target.checked }))} />
          <span className="text-xs">AP Certificate Verified</span>
        </label>
        <Field label="AP Certificate Number">
          <input className="form-input font-mono" value={form.ap_certificate_number}
            onChange={e => setForm(f => ({ ...f, ap_certificate_number: e.target.value }))}
            placeholder="Certificate #" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Last Review">
            <input className="form-input" type="date" value={form.last_review_date}
              onChange={e => setForm(f => ({ ...f, last_review_date: e.target.value }))} />
          </Field>
          <Field label="Next Review Due">
            <input className="form-input" type="date" value={form.next_review_due}
              onChange={e => setForm(f => ({ ...f, next_review_due: e.target.value }))} />
          </Field>
        </div>
        <Field label="Lane Notes">
          <textarea className="form-input resize-none" rows={2} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes specific to this lane" />
        </Field>
        {statusChanged && (
          <Field label="Reason for status change">
            <input className="form-input" value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Required for audit trail" />
          </Field>
        )}
      </div>
      <div className="flex gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid hsl(var(--border))" }}>
        <button onClick={onCancel} className="flex-1 py-1.5 text-xs rounded-sm text-muted-foreground"
          style={{ border: "1px solid hsl(var(--border))" }}>Cancel</button>
        <button onClick={handleSave}
          disabled={saving || (statusChanged && !reason.trim())}
          className="flex-1 py-1.5 text-xs rounded-sm text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
          style={{ background: GOLD }}>
          <Save className="w-3 h-3" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}

// ── 10-or-more edit mode ────────────────────────────────────────────────────

function TenEditMode({ data, vendorId, onSave, onCancel }: {
  data: VendorLaneTen; vendorId: string; onSave: () => void; onCancel: () => void
}) {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState("")
  const [form, setForm] = useState({
    status: data.status as TenLaneStatus,
    crs_number: data.crs_number ?? "",
    drug_abatement_verified: data.drug_abatement_verified,
    insurance_verified: data.insurance_verified,
    authorization_scope: data.authorization_scope ?? "",
    last_audit_date: data.last_audit_date ?? "",
    next_audit_due: data.next_audit_due ?? "",
    last_oversight_review: data.last_oversight_review ?? "",
    next_oversight_review_due: data.next_oversight_review_due ?? "",
    gmm_form_complete: data.gmm_form_complete,
    isbao_rating: data.isbao_rating ?? "",
    argus_rating: data.argus_rating ?? "",
    notes: data.notes ?? "",
  })

  async function handleSave() {
    setSaving(true)
    const now = new Date().toISOString()
    const payload: any = {
      status: form.status,
      crs_number: form.crs_number.trim() || null,
      drug_abatement_verified: form.drug_abatement_verified,
      insurance_verified: form.insurance_verified,
      authorization_scope: form.authorization_scope.trim() || null,
      last_audit_date: form.last_audit_date || null,
      next_audit_due: form.next_audit_due || null,
      last_oversight_review: form.last_oversight_review || null,
      next_oversight_review_due: form.next_oversight_review_due || null,
      gmm_form_complete: form.gmm_form_complete,
      isbao_rating: form.isbao_rating.trim() || null,
      argus_rating: form.argus_rating.trim() || null,
      notes: form.notes.trim() || null,
      updated_by: profile?.user_id,
    }

    // If status changed to recurring_approved and wasn't before, set approval
    if (form.status === "recurring_approved" && data.status !== "recurring_approved") {
      payload.approved_by = profile?.user_id
      payload.approved_at = now
    }

    await supabase.from("vendor_lane_ten").update(payload).eq("id", data.id)

    // Log status change
    if (form.status !== data.status) {
      await logHistory(vendorId, "ten", "status", data.status, form.status, reason.trim() || null)
    }
    // Log key compliance field changes
    if (form.drug_abatement_verified !== data.drug_abatement_verified) {
      await logHistory(vendorId, "ten", "drug_abatement_verified",
        String(data.drug_abatement_verified), String(form.drug_abatement_verified), reason.trim() || null)
    }
    if (form.insurance_verified !== data.insurance_verified) {
      await logHistory(vendorId, "ten", "insurance_verified",
        String(data.insurance_verified), String(form.insurance_verified), reason.trim() || null)
    }
    if (form.gmm_form_complete !== data.gmm_form_complete) {
      await logHistory(vendorId, "ten", "gmm_form_complete",
        String(data.gmm_form_complete), String(form.gmm_form_complete), reason.trim() || null)
    }

    setSaving(false)
    onSave()
  }

  const statusChanged = form.status !== data.status

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: GOLD }}>Edit · 10-or-More Lane</p>
        <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <Field label="Status">
          <select className="form-input" value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as TenLaneStatus }))}>
            {TEN_STATUSES.map(s => (
              <option key={s} value={s}>{TEN_STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Authorization Scope">
          <textarea className="form-input resize-none" rows={2} value={form.authorization_scope}
            onChange={e => setForm(f => ({ ...f, authorization_scope: e.target.value }))}
            placeholder="What work is this provider authorized for?" />
        </Field>
        <Field label="CRS Number">
          <input className="form-input font-mono" value={form.crs_number}
            onChange={e => setForm(f => ({ ...f, crs_number: e.target.value }))}
            placeholder="FAA Repair Station Certificate #" />
        </Field>
        <div className="space-y-1.5">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Compliance Checks</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.drug_abatement_verified}
              onChange={e => setForm(f => ({ ...f, drug_abatement_verified: e.target.checked }))} />
            <span className="text-xs">Drug Abatement Program Verified</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.insurance_verified}
              onChange={e => setForm(f => ({ ...f, insurance_verified: e.target.checked }))} />
            <span className="text-xs">Insurance Verified</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.gmm_form_complete}
              onChange={e => setForm(f => ({ ...f, gmm_form_complete: e.target.checked }))} />
            <span className="text-xs">GMM Approval Form Complete</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="ARGUS Rating">
            <input className="form-input" value={form.argus_rating}
              onChange={e => setForm(f => ({ ...f, argus_rating: e.target.value }))} placeholder="e.g. Gold" />
          </Field>
          <Field label="IS-BAO Rating">
            <input className="form-input" value={form.isbao_rating}
              onChange={e => setForm(f => ({ ...f, isbao_rating: e.target.value }))} placeholder="e.g. Stage 3" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Last Audit">
            <input className="form-input" type="date" value={form.last_audit_date}
              onChange={e => setForm(f => ({ ...f, last_audit_date: e.target.value }))} />
          </Field>
          <Field label="Next Audit Due">
            <input className="form-input" type="date" value={form.next_audit_due}
              onChange={e => setForm(f => ({ ...f, next_audit_due: e.target.value }))} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Last Oversight Review">
            <input className="form-input" type="date" value={form.last_oversight_review}
              onChange={e => setForm(f => ({ ...f, last_oversight_review: e.target.value }))} />
          </Field>
          <Field label="Next Oversight Due">
            <input className="form-input" type="date" value={form.next_oversight_review_due}
              onChange={e => setForm(f => ({ ...f, next_oversight_review_due: e.target.value }))} />
          </Field>
        </div>
        <Field label="Lane Notes">
          <textarea className="form-input resize-none" rows={2} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes specific to this lane" />
        </Field>
        {statusChanged && (
          <Field label="Reason for status change">
            <input className="form-input" value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Required for audit trail" />
          </Field>
        )}
      </div>
      <div className="flex gap-2 px-4 py-3 flex-shrink-0" style={{ borderTop: "1px solid hsl(var(--border))" }}>
        <button onClick={onCancel} className="flex-1 py-1.5 text-xs rounded-sm text-muted-foreground"
          style={{ border: "1px solid hsl(var(--border))" }}>Cancel</button>
        <button onClick={handleSave}
          disabled={saving || (statusChanged && !reason.trim())}
          className="flex-1 py-1.5 text-xs rounded-sm text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
          style={{ background: GOLD }}>
          <Save className="w-3 h-3" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}

// ── Shared sub-components ───────────────────────────────────────────────────

function EmptyLane({ lane, description, canInit, onInit }: {
  lane: string; description: string; canInit: boolean; onInit: () => void
}) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">{lane} Lane</p>
        <div className="flex items-center gap-2">
          <ShieldQuestion className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold px-2.5 py-0.5 rounded-sm"
            style={{ background: "#6b728015", color: "#6b7280" }}>
            Not Evaluated
          </span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-xs text-muted-foreground opacity-60 mb-3">{description}</p>
          {canInit && (
            <button
              onClick={async () => { setLoading(true); await onInit(); setLoading(false) }}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm text-white mx-auto disabled:opacity-50"
              style={{ background: GOLD }}>
              <Plus className="w-3.5 h-3.5" />
              {loading ? "Creating…" : "Begin Evaluation"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function LaneField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{label}</p>
      <p className="text-xs text-muted-foreground" style={{ whiteSpace: "pre-wrap" }}>
        {value || <span className="italic opacity-50">—</span>}
      </p>
    </div>
  )
}

function LaneDateField({ label, value, fallback = "Not set" }: { label: string; value: string | null; fallback?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <CalendarCheck className="w-3 h-3 text-muted-foreground opacity-50" />
        <p className="text-xs text-muted-foreground">
          {value ? new Date(value + (value.length === 10 ? "T00:00:00" : "")).toLocaleDateString() : <span className="italic opacity-50">{fallback}</span>}
        </p>
      </div>
    </div>
  )
}

function ComplianceIcon({ verified }: { verified: boolean }) {
  return verified
    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
    : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
}

function ComplianceCheck({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <ComplianceIcon verified={verified} />
      <span className="text-xs">{label}</span>
    </div>
  )
}

function RatingBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm"
      style={{ background: `${GOLD}15`, color: GOLD }}>
      {label}: {value}
    </span>
  )
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "#dc2626" }}>Warnings</p>
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-1.5 mb-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
          <p className="text-xs text-muted-foreground">{w}</p>
        </div>
      ))}
    </div>
  )
}
