import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ChevronLeft, Phone, Globe, MapPin, ExternalLink,
  Star, Truck, FileText, History,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/features/auth"
import { GOLD, TYPE_CONFIG, type Vendor, type VendorContact } from "@/features/vendors/constants"
import { NineLanePanel, TenLanePanel } from "@/features/vendors/components/VendorLanePanel"
import type { VendorLaneNine, VendorLaneTen, VendorOperationalStatus } from "@/features/vendors/types"

const STATUS_DISPLAY: Record<VendorOperationalStatus, { label: string; color: string; bg: string }> = {
  discovered:  { label: "Discovered",  color: "#6b7280", bg: "#6b728015" },
  pending:     { label: "Pending",     color: "#d97706", bg: "#d9770615" },
  approved:    { label: "Approved",    color: "#16a34a", bg: "#16a34a15" },
  restricted:  { label: "Restricted",  color: "#dc2626", bg: "#dc262615" },
  inactive:    { label: "Inactive",    color: "#9ca3af", bg: "#9ca3af15" },
  archived:    { label: "Archived",    color: "#6b7280", bg: "#6b728015" },
}

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"

  const [vendor, setVendor] = useState<(Vendor & { operational_status: VendorOperationalStatus; tags: string[] }) | null>(null)
  const [contacts, setContacts] = useState<VendorContact[]>([])
  const [laneNine, setLaneNine] = useState<VendorLaneNine | null>(null)
  const [laneTen, setLaneTen] = useState<VendorLaneTen | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    loadAll(id)
  }, [id])

  async function loadAll(vendorId: string) {
    setLoading(true)
    const [vendorRes, contactsRes, nineRes, tenRes] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", vendorId).single(),
      supabase.from("vendor_contacts").select("*").eq("vendor_id", vendorId)
        .order("is_primary", { ascending: false }).order("created_at"),
      supabase.from("vendor_lane_nine").select("*").eq("vendor_id", vendorId).maybeSingle(),
      supabase.from("vendor_lane_ten").select("*").eq("vendor_id", vendorId).maybeSingle(),
    ])
    if (vendorRes.data) setVendor(vendorRes.data as any)
    setContacts(contactsRes.data ?? [])
    setLaneNine(nineRes.data as VendorLaneNine | null)
    setLaneTen(tenRes.data as VendorLaneTen | null)
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
          Back to Map
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
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Map
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm"
            style={{ background: opStatus.bg, color: opStatus.color }}>
            {opStatus.label}
          </span>
        </div>
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
              <NineLanePanel data={laneNine} />
            </div>

            {/* 10-or-more */}
            <div className="rounded-md overflow-hidden" style={{ border: "1px solid hsl(var(--border))", minHeight: 280 }}>
              <TenLanePanel data={laneTen} />
            </div>
          </div>

          {/* ── Compliance Explainer (placeholder) ────────────────────── */}
          <div className="rounded-md p-4" style={{ border: "1px solid hsl(var(--border))", background: "hsl(var(--accent))" }}>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Compliance Summary</p>
            <ComplianceExplainer laneNine={laneNine} laneTen={laneTen} />
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

          {/* ── Documents placeholder ─────────────────────────────────── */}
          <div className="rounded-md p-4" style={{ border: "1px dashed hsl(var(--border))" }}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground opacity-40" />
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Documents</p>
            </div>
            <p className="text-xs text-muted-foreground opacity-50 italic">
              Document upload and management will be available in a future update.
            </p>
          </div>

          {/* ── Activity History placeholder ───────────────────────────── */}
          <div className="rounded-md p-4 mb-6" style={{ border: "1px dashed hsl(var(--border))" }}>
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-muted-foreground opacity-40" />
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Activity History</p>
            </div>
            <p className="text-xs text-muted-foreground opacity-50 italic">
              Status change history and audit trail will be available in a future update.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Compliance explainer ────────────────────────────────────────────────────

function ComplianceExplainer({
  laneNine, laneTen,
}: {
  laneNine: VendorLaneNine | null
  laneTen: VendorLaneTen | null
}) {
  const issues: string[] = []

  // 9-or-less checks
  if (!laneNine) {
    issues.push("9-or-less lane has not been evaluated.")
  } else {
    if (laneNine.status === "pending_review") issues.push("9-or-less lane is pending review.")
    if (laneNine.status === "restricted") issues.push("9-or-less lane is restricted — check warnings.")
    if (!laneNine.ap_certificate_verified) issues.push("AP certificate has not been verified for 9-or-less work.")
  }

  // 10-or-more checks
  if (!laneTen) {
    issues.push("10-or-more lane has not been evaluated.")
  } else {
    if (laneTen.status === "pending_review") issues.push("10-or-more lane is pending review.")
    if (laneTen.status === "expired") issues.push("10-or-more authorization has expired.")
    if (laneTen.status === "restricted") issues.push("10-or-more lane is restricted — check warnings.")
    if (!laneTen.drug_abatement_verified) issues.push("Drug abatement program not verified for 10-or-more work.")
    if (!laneTen.insurance_verified) issues.push("Insurance not verified for 10-or-more work.")
    if (!laneTen.gmm_form_complete) issues.push("GMM approval form is not complete.")
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-green-500 font-semibold">All compliance checks satisfied.</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {issues.map((issue, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-amber-500 text-xs mt-0.5">•</span>
          <p className="text-xs text-muted-foreground">{issue}</p>
        </div>
      ))}
    </div>
  )
}
