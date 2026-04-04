import { useNavigate } from "react-router-dom"
import { INVOICES } from "../../data/mockData"
import { InvoiceStatusBadge } from "../../shared/StatusBadge"

export default function InvoiceDashboard() {
  const navigate = useNavigate()

  const draft  = INVOICES.filter(i => i.status === "draft").length
  const sent   = INVOICES.filter(i => i.status === "sent").length
  const paid   = INVOICES.filter(i => i.status === "paid").length
  const totalOutstanding = INVOICES.filter(i => i.status === "sent").reduce((s, i) => s + i.grandTotal, 0)
  const totalPaid        = INVOICES.filter(i => i.status === "paid").reduce((s, i) => s + i.grandTotal, 0)

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
          Invoicing
        </h1>
        <p className="text-white/45 text-sm">{INVOICES.length} invoices</p>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Draft",        value: `${draft}`,                color: "text-zinc-400"    },
            { label: "Outstanding",  value: `$${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-amber-400" },
            { label: "Paid (MTD)",   value: `$${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,        color: "text-emerald-400" },
            { label: "Open Invoices",value: `${sent}`,                 color: "text-blue-400"    },
          ].map(s => (
            <div key={s.label} className="card-elevated rounded-lg p-4">
              <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Invoice table */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                {["Invoice #", "Aircraft", "Customer", "WO Ref", "Status", "Issued", "Due", "Grand Total"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((inv, idx) => (
                <tr
                  key={inv.id}
                  onClick={() => navigate(`/app/beet-box/invoicing/${inv.id}`)}
                  className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                  style={{ borderBottom: idx < INVOICES.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                >
                  <td className="px-4 py-3 font-mono text-white/70 text-xs font-semibold">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(212,160,23,0.1)", color: "var(--skyshare-gold)", fontFamily: "var(--font-heading)" }}>
                      {inv.aircraftReg}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-sm">{inv.customerName}</td>
                  <td className="px-4 py-3 text-white/40 text-xs font-mono">{inv.woNumber ?? "—"}</td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-white/45 text-xs">{new Date(inv.issuedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-white font-bold text-sm">${inv.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
