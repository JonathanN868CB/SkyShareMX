import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft, Save, Building2, Phone, Mail, ShieldCheck,
  FileText, Calendar, Package, Clock, DollarSign,
} from "lucide-react"
import {
  getSupplierById, updateSupplier, createSupplier,
  getSupplierPerformance, deactivateSupplier,
} from "../../services/suppliers"
import type { PartsSupplier, SupplierType, SupplierApprovalStatus } from "../../types"
import type { SupplierPerformance } from "../../services/suppliers"

const TYPE_OPTIONS: { value: SupplierType; label: string }[] = [
  { value: "oem", label: "OEM" },
  { value: "distributor", label: "Distributor" },
  { value: "repair_station", label: "Repair Station" },
  { value: "broker", label: "Broker" },
]

const STATUS_OPTIONS: { value: SupplierApprovalStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "conditional", label: "Conditional" },
  { value: "suspended", label: "Suspended" },
  { value: "revoked", label: "Revoked" },
]

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === "new"

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [perf, setPerf] = useState<SupplierPerformance | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [vendorType, setVendorType] = useState<SupplierType>("distributor")
  const [approvalStatus, setApprovalStatus] = useState<SupplierApprovalStatus>("pending")
  const [approvalDate, setApprovalDate] = useState("")
  const [certificateType, setCertificateType] = useState("")
  const [certificateNumber, setCertificateNumber] = useState("")
  const [traceabilityVerified, setTraceabilityVerified] = useState(false)
  const [lastAuditDate, setLastAuditDate] = useState("")
  const [contactName, setContactName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [website, setWebsite] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (isNew) return

    async function load() {
      try {
        const [supplier, perfData] = await Promise.all([
          getSupplierById(id!),
          getSupplierPerformance(id!),
        ])
        if (!supplier) { navigate("/app/beet-box/suppliers"); return }

        setName(supplier.name)
        setVendorType(supplier.vendorType)
        setApprovalStatus(supplier.approvalStatus)
        setApprovalDate(supplier.approvalDate ?? "")
        setCertificateType(supplier.certificateType ?? "")
        setCertificateNumber(supplier.certificateNumber ?? "")
        setTraceabilityVerified(supplier.traceabilityVerified)
        setLastAuditDate(supplier.lastAuditDate ?? "")
        setContactName(supplier.contactName ?? "")
        setPhone(supplier.phone ?? "")
        setEmail(supplier.email ?? "")
        setAccountNumber(supplier.accountNumber ?? "")
        setWebsite(supplier.website ?? "")
        setNotes(supplier.notes ?? "")
        setPerf(perfData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isNew, navigate])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const input = {
        name: name.trim(),
        vendorType,
        approvalStatus,
        approvalDate: approvalDate || undefined,
        certificateType: certificateType || undefined,
        certificateNumber: certificateNumber || undefined,
        traceabilityVerified,
        lastAuditDate: lastAuditDate || undefined,
        contactName: contactName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        accountNumber: accountNumber || undefined,
        website: website || undefined,
        notes: notes || undefined,
      }

      if (isNew) {
        const created = await createSupplier(input)
        navigate(`/app/beet-box/suppliers/${created.id}`, { replace: true })
      } else {
        await updateSupplier(id!, input)
        navigate("/app/beet-box/suppliers")
      }
    } catch (err) {
      console.error("Save failed:", err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!confirm("Deactivate this supplier? They will no longer appear in PO dropdowns.")) return
    await deactivateSupplier(id!)
    navigate("/app/beet-box/suppliers")
  }

  if (loading) {
    return <div className="py-20 text-center text-white/30 text-sm">Loading supplier...</div>
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/app/beet-box/suppliers")}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1
                className="text-white mb-1"
                style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
              >
                {isNew ? "New Supplier" : name}
              </h1>
              <p className="text-white/45 text-sm">
                {isNew ? "Add a new parts supplier to the AVL" : "Edit supplier details"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isNew && (
              <button
                onClick={handleDeactivate}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-colors"
              >
                Deactivate
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--skyshare-gold), #b8860b)", color: "#000" }}
            >
              <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Left: form fields (2 cols) */}
          <div className="col-span-2 space-y-6">
            {/* Identity */}
            <Section title="Identity">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Supplier Name" required>
                  <input value={name} onChange={e => setName(e.target.value)} className="form-input" placeholder="e.g. Duncan Aviation" />
                </Field>
                <Field label="Type">
                  <select value={vendorType} onChange={e => setVendorType(e.target.value as SupplierType)} className="form-input">
                    {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>)}
                  </select>
                </Field>
              </div>
            </Section>

            {/* Approval & Certification */}
            <Section title="Approval & Certification">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Approval Status">
                  <select value={approvalStatus} onChange={e => setApprovalStatus(e.target.value as SupplierApprovalStatus)} className="form-input">
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Approval Date">
                  <input type="date" value={approvalDate} onChange={e => setApprovalDate(e.target.value)} className="form-input" />
                </Field>
                <Field label="Certificate Type">
                  <input value={certificateType} onChange={e => setCertificateType(e.target.value)} className="form-input" placeholder="e.g. FAA Repair Station" />
                </Field>
                <Field label="Certificate #">
                  <input value={certificateNumber} onChange={e => setCertificateNumber(e.target.value)} className="form-input" placeholder="Certificate number" />
                </Field>
                <Field label="Traceability Verified">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      checked={traceabilityVerified}
                      onChange={e => setTraceabilityVerified(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5"
                    />
                    <span className="text-white/60 text-sm">Can provide 8130-3 / trace documentation</span>
                  </label>
                </Field>
                <Field label="Last Audit Date">
                  <input type="date" value={lastAuditDate} onChange={e => setLastAuditDate(e.target.value)} className="form-input" />
                </Field>
              </div>
            </Section>

            {/* Contact */}
            <Section title="Contact Information">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Contact Name">
                  <input value={contactName} onChange={e => setContactName(e.target.value)} className="form-input" placeholder="e.g. Parts Department" />
                </Field>
                <Field label="Phone">
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="form-input" placeholder="e.g. 800-555-1234" />
                </Field>
                <Field label="Email">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="form-input" placeholder="parts@example.com" />
                </Field>
                <Field label="Account #">
                  <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="form-input" placeholder="Your account number" />
                </Field>
                <Field label="Website" span2>
                  <input value={website} onChange={e => setWebsite(e.target.value)} className="form-input" placeholder="https://..." />
                </Field>
              </div>
            </Section>

            {/* Notes */}
            <Section title="Notes">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="form-input w-full resize-none"
                placeholder="Internal notes about this supplier..."
              />
            </Section>
          </div>

          {/* Right: Performance sidebar (1 col) */}
          <div className="space-y-4">
            {!isNew && perf && (
              <div className="card-elevated rounded-lg p-5 space-y-4">
                <h3
                  className="text-white/50 text-xs uppercase tracking-widest"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Purchase History
                </h3>
                <PerfRow icon={Package} label="Total POs" value={String(perf.totalPOs)} />
                <PerfRow
                  icon={DollarSign}
                  label="Total Spend"
                  value={perf.totalSpend > 0 ? `$${perf.totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                />
                <PerfRow
                  icon={ShieldCheck}
                  label="Fill Rate"
                  value={perf.fillRate !== null ? `${perf.fillRate}%` : "—"}
                  valueColor={perf.fillRate !== null ? (perf.fillRate >= 90 ? "text-emerald-400" : perf.fillRate >= 50 ? "text-amber-400" : "text-red-400") : undefined}
                />
                <PerfRow
                  icon={Clock}
                  label="Avg Lead Time"
                  value={perf.avgLeadTimeDays !== null ? `${perf.avgLeadTimeDays} days` : "—"}
                />
                <PerfRow
                  icon={Calendar}
                  label="Last Used"
                  value={perf.lastUsedDate ? new Date(perf.lastUsedDate).toLocaleDateString("en-US") : "Never"}
                />
              </div>
            )}

            {isNew && (
              <div className="card-elevated rounded-lg p-5">
                <p className="text-white/30 text-sm text-center">
                  Purchase history will appear here after the supplier is used in POs.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline styles for form inputs */}
      <style>{`
        .form-input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 0.5rem;
          color: rgba(255,255,255,0.85);
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          border-color: rgba(255,255,255,0.25);
        }
        .form-input::placeholder {
          color: rgba(255,255,255,0.25);
        }
        .form-input option {
          background: #1a1a1a;
        }
      `}</style>
    </div>
  )
}

// ─── Sub-components ────���─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-elevated rounded-lg p-5">
      <h3
        className="text-white/50 text-xs uppercase tracking-widest mb-4"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, required, span2, children }: { label: string; required?: boolean; span2?: boolean; children: React.ReactNode }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-white/40 text-xs mb-1.5 tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>
        {label}{required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function PerfRow({ icon: Icon, label, value, valueColor }: { icon: typeof Package; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-white/40 text-xs">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className={`text-sm font-semibold ${valueColor ?? "text-white/70"}`}>{value}</span>
    </div>
  )
}
