import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ChevronLeft, Phone, Globe, MapPin, ExternalLink,
  Star, Truck, FileText, History, ChevronDown,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { GOLD, STATUS_DISPLAY, TYPE_CONFIG, type Vendor, type VendorContact, type VendorOperationalStatus } from "@/features/vendors/constants"
import { NineLanePanel, TenLanePanel } from "@/features/vendors/components/VendorLanePanel"
import { VendorDocuments } from "@/features/vendors/components/VendorDocuments"
import { VendorReviews } from "@/features/vendors/components/VendorReviews"
import type { VendorDocument, VendorLaneNine, VendorLaneTen, VendorReviewEvent, VendorStatusHistory } from "@/features/vendors/types"

const OP_STATUS_ORDER: VendorOperationalStatus[] = ["discovered", "pending", "approved", "restricted", "inactive", "archived"]

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === "Super Admin" || profile?.role === "Admin"
  const canEditNine = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"
  const canEditTen = isAdmin

  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [contacts, setContacts] = useState<VendorContact[]>([])
  const [laneNine, setLaneNine] = useState<VendorLaneNine | null>(null)
  const [laneTen, setLaneTen] = useState<VendorLaneTen | null>(null)
  const [documents, setDocuments] = useState<VendorDocument[]>([])
  const [reviews, setReviews] = useState<VendorReviewEvent[]>([])
  const [history, setHistory] = useState<VendorStatusHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    loadAll(id)
  }, [id])

  async function loadAll(vendorId: string) {
    setLoading(true)
    const [vendorRes, contactsRes, nineRes, tenRes, docsRes, reviewsRes, histRes] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", vendorId).single(),
      supabase.from("vendor_contacts").select("*").eq("vendor_id", vendorId)
        .order("is_primary", { ascending: false }).order("created_at"),
      supabase.from("vendor_lane_nine").select("*").eq("vendor_id", vendorId).maybeSingle(),
      supabase.from("vendor_lane_ten").select("*").eq("vendor_id", vendorId).maybeSingle(),
      supabase.from("vendor_documents").select("*").eq("vendor_id", vendorId)
        .order("uploaded_at", { ascending: false }),
      supabase.from("vendor_review_events").select("*").eq("vendor_id", vendorId)
        .order("review_date", { ascending: false }),
      supabase.from("vendor_status_history").select("*").eq("vendor_id", vendorId)
        .order("changed_at", { ascending: false }).limit(20),
    ])
    if (vendorRes.data) setVendor(vendorRes.data as any)
    setContacts(contactsRes.data ?? [])
    setLaneNine(nineRes.data as VendorLaneNine | null)
    setLaneTen(tenRes.data as VendorLaneTen | null)
    setDocuments((docsRes.data ?? []) as VendorDocument[])
    setReviews((reviewsRes.data ?? []) as VendorReviewEvent[])
    setHistory((histRes.data ?? []) as VendorStatusHistory[])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading vendor…</p>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm text-muted-foreground">Vendor not found.</p>
        <button onClick={() => navigate("/app/vendor-map")}
          className="text-xs px-3 py-1.5 rounded-sm" style={{ background: GOLD, color: "white" }}>
          Back to Vendors
        </button>
      </div>
    )
  }

  const typeCfg = TYPE_CONFIG[vendor.vendor_type as keyof typeof TYPE_CONFIG]
  const opStatus = STATUS_DISPLAY[vendor.operational_status] ?? STATUS_DISPLAY.discovered

  return (
    <div className="flex flex-col h-full" style={{ margin: "-1.5rem", height: "calc(100vh - 3.5rem)", background: "hsl(var(--background))", overflow: "hidden" }}>

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <button onClick={() => navigate("/app/vendor-map")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Vendors
        </button>
        <OperationalStatusControl
          vendor={vendor}
          canEdit={canEditNine}
          isAdmin={isAdmin}
          onChanged={async (newStatus) => {
            await supabase.from("vendor_status_history").insert({
              vendor_id: vendor.id,
              lane: "shared",
              field_changed: "operational_status",
              old_value: vendor.operational_status,
              new_value: newStatus,
              reason: null,
            })
            await supabase.from("vendors").update({
              operational_status: newStatus,
              updated_by: profile?.user_id ?? null,
            }).eq("id", vendor.id)
            await loadAll(vendor.id)
          }}
        />
      </div>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

          {/* ── Vendor header ─────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {typeCfg && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm"
                  style={{ background: `${typeCfg.color}20`, color: typeCfg.color }}>
                  {typeCfg.sym} {typeCfg.label}
                </span>
              )}
              {vendor.preferred && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1"
                  style={{ background: `${GOLD}20`, color: GOLD }}>
                  <Star className="w-2.5 h-2.5" fill={GOLD} /> Preferred
                </span>
              )}
              {vendor.is_mrt && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1"
                  style={{ background: `${GOLD}15`, color: GOLD }}>
                  <Truck className="w-2.5 h-2.5" /> MRT
                </span>
              )}
              {vendor.tags?.map(tag => (
                <span key={tag} className="text-[9px] font-semibold px-2 py-0.5 rounded-sm"
                  style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-xl font-bold tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>
              {vendor.name}
            </h1>
            {(vendor.city || vendor.airport_code) && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                {vendor.airport_code && <span className="font-mono font-bold mr-1">{vendor.airport_code}</span>}
                {vendor.city}{vendor.state ? `, ${vendor.state}` : ""}
                {vendor.country && vendor.country !== "USA" && ` · ${vendor.country}`}
              </p>
            )}
          </div>

          {/* ── Contact + specialties row ──────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact info */}
            <div className="rounded-md p-4" style={{ border: "1px solid hsl(var(--border))" }}>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Contact</p>
              <div className="space-y-2">
                {vendor.phone ? (
                  <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-sm font-medium hover:underline" style={{ color: GOLD }}>
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />{vendor.phone}
                  </a>
                ) : <p className="text-xs text-muted-foreground italic">No phone on file</p>}
                {vendor.email && (
                  <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:underline">
                    <span className="text-sm">✉</span>{vendor.email}
                  </a>
                )}
                {vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:underline">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{vendor.website.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                  </a>
                )}
                {vendor.lat && vendor.lng && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${vendor.lat},${vendor.lng}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:underline mt-2">
                    <MapPin className="w-3.5 h-3.5" />View on Google Maps
                    <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
                )}
              </div>
            </div>

            {/* Key contacts */}
            <div className="rounded-md p-4" style={{ border: "1px solid hsl(var(--border))" }}>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Key Contacts</p>
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic opacity-50">No contacts on file.</p>
              ) : (
                <div className="space-y-2">
                  {contacts.map(c => (
                    <div key={c.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight">{c.name}</p>
                        {c.title && <p className="text-[10px] text-muted-foreground">{c.title}</p>}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-[10px] hover:underline" style={{ color: GOLD }}>{c.phone}</a>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {c.is_primary && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: `${GOLD}20`, color: GOLD }}>PRIMARY</span>
                        )}
                        {c.role && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>{c.role}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── DUAL LANE PANELS ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 9-or-less */}
            <div className="rounded-md overflow-hidden" style={{ border: "1px solid hsl(var(--border))", minHeight: 280 }}>
              <NineLanePanel data={laneNine} vendorId={vendor.id} canEdit={canEditNine} onRefresh={() => loadAll(vendor.id)} />
            </div>

            {/* 10-or-more */}
            <div className="rounded-md overflow-hidden" style={{ border: "1px solid hsl(var(--border))", minHeight: 280 }}>
              <TenLanePanel data={laneTen} vendorId={vendor.id} canEdit={canEditTen} onRefresh={() => loadAll(vendor.id)} />
            </div>
          </div>

          {/* ── Compliance Summary ─────────────────────────────────────── */}
          <div className="rounded-md p-4" style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--accent))" }}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Compliance Summary</p>
            <ComplianceExplainer
              laneNine={laneNine} laneTen={laneTen}
              documents={documents} reviews={reviews}
              operationalStatus={vendor.operational_status}
            />
          </div>

          {/* ── Notes ─────────────────────────────────────────────────── */}
          <div className="rounded-md p-4" style={{ border: "1px solid hsl(var(--border))" }}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Notes</p>
            <p className="text-xs text-muted-foreground leading-relaxed" style={{ whiteSpace: "pre-wrap" }}>
              {vendor.notes || <span className="italic opacity-50">No notes yet.</span>}
            </p>
          </div>

          {/* ── Specialties ───────────────────────────────────────────── */}
          {vendor.specialties && vendor.specialties.length > 0 && (
            <div className="rounded-md p-4" style={{ border: "1px solid hsl(var(--border))" }}>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Specialties</p>
              <div className="flex flex-wrap gap-1.5">
                {vendor.specialties.map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-sm font-semibold"
                    style={{ background: typeCfg ? `${typeCfg.color}15` : "hsl(var(--accent))", color: typeCfg?.color ?? "hsl(var(--muted-foreground))" }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Documents ─────────────────────────────────────────────── */}
          <VendorDocuments
            vendorId={vendor.id}
            documents={documents}
            canEditNine={canEditNine}
            canEditTen={canEditTen}
            isAdmin={isAdmin}
            onRefresh={() => loadAll(vendor.id)}
          />

          {/* ── Reviews & Audits ─────────────────────────────────────── */}
          <VendorReviews
            vendorId={vendor.id}
            reviews={reviews}
            canEditNine={canEditNine}
            canEditTen={canEditTen}
            onRefresh={() => loadAll(vendor.id)}
          />

          {/* ── Activity History ─────────────────────────────────────── */}
          <div className="rounded-md p-4 mb-6" style={{ border: "1px solid hsl(var(--border))" }}>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-muted-foreground" />
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Activity History</p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
                {history.length}
              </span>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground opacity-50 italic">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => {
                  const laneLabel = h.lane === "shared" ? "Shared" : h.lane === "nine" ? "9-or-Less" : "10-or-More"
                  return (
                    <div key={h.id} className="flex items-start gap-3 text-xs">
                      <span className="text-[10px] text-muted-foreground opacity-60 shrink-0 w-[100px] pt-0.5">
                        {new Date(h.changed_at).toLocaleDateString()}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0"
                        style={{ background: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}>
                        {laneLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{h.field_changed}</span>
                          {h.old_value && <>{" "}<span className="line-through opacity-50">{h.old_value}</span></>}
                          {" → "}<span className="font-semibold">{h.new_value}</span>
                        </span>
                        {h.reason && <p className="text-[10px] text-muted-foreground opacity-60 mt-0.5 italic">{h.reason}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .form-input {
          width: 100%;
          padding: 0.35rem 0.6rem;
          border-radius: 0.25rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 0.8rem;
          outline: none;
        }
        .form-input:focus { border-color: ${GOLD}; }
      `}</style>
    </div>
  )
}

// ── Operational status control ──────────────────────────────────────────────

// Statuses that require Admin+ to set (governance-critical transitions)
const ADMIN_ONLY_STATUSES: VendorOperationalStatus[] = ["approved", "restricted", "archived"]

function OperationalStatusControl({ vendor, canEdit, isAdmin, onChanged }: {
  vendor: Vendor
  canEdit: boolean
  isAdmin: boolean
  onChanged: (status: VendorOperationalStatus) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const current = STATUS_DISPLAY[vendor.operational_status] ?? STATUS_DISPLAY.discovered

  async function handleChange(status: VendorOperationalStatus) {
    if (status === vendor.operational_status) { setOpen(false); return }
    setSaving(true)
    await onChanged(status)
    setSaving(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => canEdit && setOpen(o => !o)}
        disabled={saving}
        className="flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-1 rounded-sm transition-colors"
        style={{ background: current.bg, color: current.color, cursor: canEdit ? "pointer" : "default" }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: current.color }} />
        {saving ? "Saving…" : current.label}
        {canEdit && <ChevronDown className="w-3 h-3 opacity-60" />}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 rounded-sm shadow-xl z-50 overflow-hidden min-w-[160px]"
          style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}>
          {OP_STATUS_ORDER.map(s => {
            const cfg = STATUS_DISPLAY[s]
            const active = s === vendor.operational_status
            const needsAdmin = ADMIN_ONLY_STATUSES.includes(s)
            const locked = needsAdmin && !isAdmin
            return (
              <button key={s}
                onClick={() => !locked && handleChange(s)}
                disabled={locked}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                style={{
                  color: cfg.color,
                  background: active ? cfg.bg : "transparent",
                }}
                onMouseEnter={e => { if (!active && !locked) e.currentTarget.style.background = "hsl(var(--accent))" }}
                onMouseLeave={e => { if (!active && !locked) e.currentTarget.style.background = "transparent" }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                {cfg.label}
                {active && <span className="ml-auto text-[9px] opacity-50">current</span>}
                {locked && <span className="ml-auto text-[8px] opacity-40">Admin</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Compliance explainer ────────────────────────────────────────────────────

type Issue = { text: string; severity: "error" | "warn" | "info" }

function ComplianceExplainer({
  laneNine, laneTen, documents, reviews, operationalStatus,
}: {
  laneNine: VendorLaneNine | null
  laneTen: VendorLaneTen | null
  documents: VendorDocument[]
  reviews: VendorReviewEvent[]
  operationalStatus: string
}) {
  const issues: Issue[] = []

  // Operational status check
  if (operationalStatus === "discovered") {
    issues.push({ text: "Vendor is in Discovered state — not yet evaluated for use.", severity: "info" })
  } else if (operationalStatus === "restricted") {
    issues.push({ text: "Vendor is Restricted — check lane details for conditions.", severity: "error" })
  }

  // 9-or-less checks
  if (!laneNine) {
    issues.push({ text: "9-or-less lane has not been evaluated.", severity: "info" })
  } else {
    if (laneNine.status === "pending_review") issues.push({ text: "9-or-less lane is pending review.", severity: "warn" })
    if (laneNine.status === "restricted") issues.push({ text: "9-or-less lane is restricted — check warnings.", severity: "error" })
    if (!laneNine.ap_certificate_verified) issues.push({ text: "AP certificate has not been verified for 9-or-less work.", severity: "warn" })
    if (laneNine.next_review_due) {
      const days = Math.ceil((new Date(laneNine.next_review_due + "T00:00:00").getTime() - Date.now()) / 86400000)
      if (days <= 0) issues.push({ text: `9-or-less review is overdue (was due ${new Date(laneNine.next_review_due + "T00:00:00").toLocaleDateString()}).`, severity: "error" })
      else if (days <= 30) issues.push({ text: `9-or-less review due in ${days} days.`, severity: "warn" })
    }
  }

  // 10-or-more checks
  if (!laneTen) {
    issues.push({ text: "10-or-more lane has not been evaluated.", severity: "info" })
  } else {
    if (laneTen.status === "pending_review") issues.push({ text: "10-or-more lane is pending review.", severity: "warn" })
    if (laneTen.status === "expired") issues.push({ text: "10-or-more authorization has expired.", severity: "error" })
    if (laneTen.status === "restricted") issues.push({ text: "10-or-more lane is restricted — check warnings.", severity: "error" })
    if (!laneTen.drug_abatement_verified) issues.push({ text: "Drug abatement program not verified for 10-or-more work.", severity: "warn" })
    if (!laneTen.insurance_verified) issues.push({ text: "Insurance not verified for 10-or-more work.", severity: "warn" })
    if (!laneTen.gmm_form_complete) issues.push({ text: "GMM approval form is not complete.", severity: "warn" })
    if (laneTen.next_audit_due) {
      const days = Math.ceil((new Date(laneTen.next_audit_due + "T00:00:00").getTime() - Date.now()) / 86400000)
      if (days <= 0) issues.push({ text: `10-or-more audit is overdue (was due ${new Date(laneTen.next_audit_due + "T00:00:00").toLocaleDateString()}).`, severity: "error" })
      else if (days <= 30) issues.push({ text: `10-or-more audit due in ${days} days.`, severity: "warn" })
    }
    if (laneTen.next_oversight_review_due) {
      const days = Math.ceil((new Date(laneTen.next_oversight_review_due + "T00:00:00").getTime() - Date.now()) / 86400000)
      if (days <= 0) issues.push({ text: `10-or-more oversight review is overdue.`, severity: "error" })
      else if (days <= 30) issues.push({ text: `10-or-more oversight review due in ${days} days.`, severity: "warn" })
    }
  }

  // Document expiry checks
  const expiredDocs = documents.filter(d => {
    if (!d.expires_at) return false
    return new Date(d.expires_at + "T00:00:00").getTime() < Date.now()
  })
  const expiringDocs = documents.filter(d => {
    if (!d.expires_at) return false
    const days = Math.ceil((new Date(d.expires_at + "T00:00:00").getTime() - Date.now()) / 86400000)
    return days > 0 && days <= 30
  })
  if (expiredDocs.length > 0) {
    issues.push({ text: `${expiredDocs.length} document${expiredDocs.length > 1 ? "s have" : " has"} expired.`, severity: "error" })
  }
  if (expiringDocs.length > 0) {
    issues.push({ text: `${expiringDocs.length} document${expiringDocs.length > 1 ? "s" : ""} expiring within 30 days.`, severity: "warn" })
  }

  // Unverified document check
  const unverified = documents.filter(d => !d.verified)
  if (unverified.length > 0) {
    issues.push({ text: `${unverified.length} document${unverified.length > 1 ? "s" : ""} not yet verified.`, severity: "info" })
  }

  // Review with failed outcome
  const failedReviews = reviews.filter(r => r.outcome === "failed")
  if (failedReviews.length > 0) {
    issues.push({ text: `${failedReviews.length} review${failedReviews.length > 1 ? "s" : ""} with Failed outcome.`, severity: "error" })
  }

  const SEVERITY_COLORS = {
    error: "#dc2626",
    warn:  "#d97706",
    info:  "#6b7280",
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-green-500 font-semibold">All compliance checks satisfied.</span>
      </div>
    )
  }

  // Sort: errors first, then warnings, then info
  const sorted = [...issues].sort((a, b) => {
    const order = { error: 0, warn: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })

  return (
    <div className="space-y-1.5">
      {sorted.map((issue, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-xs mt-0.5" style={{ color: SEVERITY_COLORS[issue.severity] }}>
            {issue.severity === "error" ? "●" : issue.severity === "warn" ? "▲" : "○"}
          </span>
          <p className="text-xs text-muted-foreground">{issue.text}</p>
        </div>
      ))}
    </div>
  )
}
