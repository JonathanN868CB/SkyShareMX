import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  Clock, CalendarCheck, AlertTriangle, CheckCircle2, FileText,
} from "lucide-react"
import { GOLD } from "../constants"
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

// ── 9-or-less lane panel ────────────────────────────────────────────────────

export function NineLanePanel({ data }: { data: VendorLaneNine | null }) {
  if (!data) {
    return <EmptyLane lane="9-or-Less" description="No compliance record exists for this lane yet." />
  }

  const statusCfg = NINE_STATUS_CONFIG[data.status]
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex flex-col h-full">
      {/* Lane header */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">9-or-Less Lane</p>
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4" style={{ color: statusCfg.color }} />
          <span className="text-sm font-bold px-2.5 py-0.5 rounded-sm"
            style={{ background: statusCfg.bg, color: statusCfg.color }}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Lane details */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Capability scope */}
        <LaneField label="Capability Scope" value={data.capability_scope} />

        {/* AP Certificate */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">AP Certificate</p>
          <div className="flex items-center gap-2">
            {data.ap_certificate_verified ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="text-xs">
              {data.ap_certificate_verified ? "Verified" : "Not verified"}
            </span>
            {data.ap_certificate_number && (
              <span className="text-[10px] font-mono text-muted-foreground ml-1">#{data.ap_certificate_number}</span>
            )}
          </div>
        </div>

        {/* Review dates */}
        <div className="grid grid-cols-2 gap-3">
          <LaneDateField label="Last Review" value={data.last_review_date} />
          <LaneDateField label="Next Review Due" value={data.next_review_due} fallback="N/A" />
        </div>

        {/* Approval */}
        {data.approved_at && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Approved</p>
            <p className="text-xs text-muted-foreground">
              {new Date(data.approved_at).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Warnings */}
        {data.warnings.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "#dc2626" }}>Warnings</p>
            {data.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
                <p className="text-xs text-muted-foreground">{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <LaneField label="Lane Notes" value={data.notes} />
      </div>
    </div>
  )
}

// ── 10-or-more lane panel ───────────────────────────────────────────────────

export function TenLanePanel({ data }: { data: VendorLaneTen | null }) {
  if (!data) {
    return <EmptyLane lane="10-or-More" description="No provider governance record exists for this lane yet." />
  }

  const statusCfg = TEN_STATUS_CONFIG[data.status]
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex flex-col h-full">
      {/* Lane header */}
      <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1.5">10-or-More Lane</p>
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4" style={{ color: statusCfg.color }} />
          <span className="text-sm font-bold px-2.5 py-0.5 rounded-sm"
            style={{ background: statusCfg.bg, color: statusCfg.color }}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Lane details */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Authorization scope */}
        <LaneField label="Authorization Scope" value={data.authorization_scope} />

        {/* CRS Number */}
        <LaneField label="CRS Number" value={data.crs_number} />

        {/* Compliance checks */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">Compliance Checks</p>
          <div className="space-y-1.5">
            <ComplianceCheck label="Drug Abatement Program" verified={data.drug_abatement_verified} />
            <ComplianceCheck label="Insurance Verified" verified={data.insurance_verified} />
            <ComplianceCheck label="GMM Form Complete" verified={data.gmm_form_complete} />
          </div>
        </div>

        {/* Ratings */}
        {(data.argus_rating || data.isbao_rating) && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Ratings</p>
            <div className="flex gap-3">
              {data.argus_rating && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm"
                  style={{ background: `${GOLD}15`, color: GOLD }}>
                  ARGUS: {data.argus_rating}
                </span>
              )}
              {data.isbao_rating && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm"
                  style={{ background: `${GOLD}15`, color: GOLD }}>
                  IS-BAO: {data.isbao_rating}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Audit / oversight dates */}
        <div className="grid grid-cols-2 gap-3">
          <LaneDateField label="Last Audit" value={data.last_audit_date} />
          <LaneDateField label="Next Audit Due" value={data.next_audit_due} fallback="N/A" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <LaneDateField label="Last Oversight Review" value={data.last_oversight_review} />
          <LaneDateField label="Next Oversight Due" value={data.next_oversight_review_due} fallback="N/A" />
        </div>

        {/* Approval */}
        {data.approved_at && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Approved</p>
            <p className="text-xs text-muted-foreground">
              {new Date(data.approved_at).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Warnings */}
        {data.warnings.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "#dc2626" }}>Warnings</p>
            {data.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 mb-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} />
                <p className="text-xs text-muted-foreground">{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <LaneField label="Lane Notes" value={data.notes} />
      </div>
    </div>
  )
}

// ── Shared sub-components ───────────────────────────────────────────────────

function EmptyLane({ lane, description }: { lane: string; description: string }) {
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
          <p className="text-xs text-muted-foreground opacity-60">{description}</p>
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
          {value ? new Date(value).toLocaleDateString() : <span className="italic opacity-50">{fallback}</span>}
        </p>
      </div>
    </div>
  )
}

function ComplianceCheck({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {verified ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
      )}
      <span className="text-xs">{label}</span>
    </div>
  )
}
