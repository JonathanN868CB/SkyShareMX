import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search, Plus, Building2, Star, ShieldCheck,
  Phone, Mail, ArrowUpDown, Filter,
} from "lucide-react"
import { getSuppliers } from "../../services/suppliers"
import type { PartsSupplier, SupplierType, SupplierApprovalStatus } from "../../types"

type SortKey = "name" | "vendorType" | "approvalStatus"

const TYPE_LABELS: Record<SupplierType, string> = {
  oem: "OEM",
  distributor: "Distributor",
  repair_station: "Repair Station",
  broker: "Broker",
}

export default function SuppliersList() {
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState<PartsSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<SupplierType | "">("")
  const [statusFilter, setStatusFilter] = useState<SupplierApprovalStatus | "">("")
  const [sortBy, setSortBy] = useState<SortKey>("name")
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    getSuppliers({ active: true })
      .then(setSuppliers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = suppliers
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.contactName ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.accountNumber ?? "").toLowerCase().includes(q)
      )
    }
    if (typeFilter) result = result.filter(s => s.vendorType === typeFilter)
    if (statusFilter) result = result.filter(s => s.approvalStatus === statusFilter)

    result.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case "name": cmp = a.name.localeCompare(b.name); break
        case "vendorType": cmp = a.vendorType.localeCompare(b.vendorType); break
        case "approvalStatus": cmp = a.approvalStatus.localeCompare(b.approvalStatus); break
      }
      return sortAsc ? cmp : -cmp
    })
    return result
  }, [suppliers, search, typeFilter, statusFilter, sortBy, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(true) }
  }

  // Stats
  const oems = suppliers.filter(s => s.vendorType === "oem").length
  const distributors = suppliers.filter(s => s.vendorType === "distributor").length
  const repairStations = suppliers.filter(s => s.vendorType === "repair_station").length
  const verified = suppliers.filter(s => s.traceabilityVerified).length

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-white mb-1"
              style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}
            >
              Parts Suppliers
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : `${suppliers.length} approved suppliers · Approved Vendor List (AVL)`}
            </p>
          </div>
          <button
            onClick={() => navigate("/app/beet-box/suppliers/new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, var(--skyshare-gold), #b8860b)",
              color: "#000",
            }}
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">
        {loading ? (
          <div className="py-20 text-center text-white/30 text-sm">Loading suppliers...</div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Suppliers" value={suppliers.length} icon={Building2} color="text-white" />
              <StatCard label="OEMs" value={oems} icon={Star} color="text-amber-400" />
              <StatCard label="Distributors" value={distributors} icon={Building2} color="text-blue-400" />
              <StatCard label="Traceability Verified" value={verified} icon={ShieldCheck} color="text-emerald-400" />
            </div>

            {/* Search + Filters */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, contact, email, or account #..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white/85 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
                />
              </div>
              <FilterSelect
                value={typeFilter}
                onChange={v => setTypeFilter(v as SupplierType | "")}
                options={[
                  { value: "", label: "All Types" },
                  { value: "oem", label: "OEM" },
                  { value: "distributor", label: "Distributor" },
                  { value: "repair_station", label: "Repair Station" },
                  { value: "broker", label: "Broker" },
                ]}
                icon={Filter}
              />
              <FilterSelect
                value={statusFilter}
                onChange={v => setStatusFilter(v as SupplierApprovalStatus | "")}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "approved", label: "Approved" },
                  { value: "pending", label: "Pending" },
                  { value: "conditional", label: "Conditional" },
                  { value: "suspended", label: "Suspended" },
                ]}
                icon={ShieldCheck}
              />
            </div>

            {/* Table */}
            <div className="card-elevated rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                    {([
                      { key: "name" as SortKey, label: "Supplier" },
                      { key: "vendorType" as SortKey, label: "Type" },
                      { key: null, label: "Contact" },
                      { key: null, label: "Phone" },
                      { key: null, label: "Email" },
                      { key: null, label: "Account #" },
                      { key: null, label: "Traceability" },
                      { key: "approvalStatus" as SortKey, label: "Status" },
                    ] as const).map(col => (
                      <th
                        key={col.label}
                        onClick={col.key ? () => toggleSort(col.key!) : undefined}
                        className={`px-4 py-3 text-left text-white/30 text-xs uppercase tracking-widest ${col.key ? "cursor-pointer hover:text-white/50 select-none" : ""}`}
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {col.key && sortBy === col.key && <ArrowUpDown className="w-3 h-3" />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/app/beet-box/suppliers/${s.id}`)}
                      className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      style={{ borderBottom: idx < filtered.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                    >
                      <td className="px-4 py-3">
                        <span className="text-white/80 text-sm font-medium">{s.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={s.vendorType} />
                      </td>
                      <td className="px-4 py-3 text-white/55 text-xs">{s.contactName ?? "—"}</td>
                      <td className="px-4 py-3">
                        {s.phone ? (
                          <span className="flex items-center gap-1 text-white/45 text-xs">
                            <Phone className="w-3 h-3" /> {s.phone}
                          </span>
                        ) : <span className="text-white/15 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {s.email ? (
                          <span className="flex items-center gap-1 text-blue-400/60 text-xs">
                            <Mail className="w-3 h-3" /> {s.email}
                          </span>
                        ) : <span className="text-white/15 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-white/45 text-xs font-mono">
                        {s.accountNumber ?? <span className="text-white/15">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.traceabilityVerified ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-white/15 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ApprovalBadge status={s.approvalStatus} />
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <Building2 className="w-10 h-10 text-white/10 mx-auto mb-3" />
                        <p className="text-white/25 text-sm">
                          {suppliers.length === 0 ? "No suppliers found" : "No suppliers match your search"}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ─────��────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Building2; color: string }) {
  return (
    <div className="card-elevated rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/40 text-xs tracking-wide uppercase" style={{ fontFamily: "var(--font-heading)" }}>{label}</p>
        <Icon className={`w-4 h-4 ${color} opacity-50`} />
      </div>
      <p className={`text-2xl font-bold ${color}`} style={{ fontFamily: "var(--font-display)" }}>{value}</p>
    </div>
  )
}

function TypeBadge({ type }: { type: SupplierType }) {
  const cfg: Record<SupplierType, { bg: string; text: string }> = {
    oem:            { bg: "bg-amber-600/20", text: "text-amber-300" },
    distributor:    { bg: "bg-blue-600/20", text: "text-blue-300" },
    repair_station: { bg: "bg-purple-600/20", text: "text-purple-300" },
    broker:         { bg: "bg-zinc-600/20", text: "text-zinc-300" },
  }
  const c = cfg[type]
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      {TYPE_LABELS[type]}
    </span>
  )
}

function ApprovalBadge({ status }: { status: SupplierApprovalStatus }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    approved:    { bg: "bg-emerald-600/20", text: "text-emerald-300" },
    pending:     { bg: "bg-amber-600/20", text: "text-amber-300" },
    conditional: { bg: "bg-blue-600/20", text: "text-blue-300" },
    suspended:   { bg: "bg-red-600/20", text: "text-red-300" },
    revoked:     { bg: "bg-red-600/30", text: "text-red-300" },
  }
  const c = cfg[status] ?? { bg: "bg-zinc-600/20", text: "text-zinc-300" }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      {status}
    </span>
  )
}

function FilterSelect({ value, onChange, options, icon: Icon }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  icon: typeof Filter
}) {
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-9 pr-8 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white/70 text-sm appearance-none cursor-pointer focus:outline-none focus:border-white/25 transition-colors"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
        ))}
      </select>
    </div>
  )
}
