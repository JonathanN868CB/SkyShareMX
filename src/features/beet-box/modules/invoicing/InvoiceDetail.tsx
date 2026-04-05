import { useRef, useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, AlertTriangle, Download, Loader2 } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { INVOICES, WORK_ORDERS, AIRCRAFT } from "../../data/mockData"
import { BeetIcon } from "../../shared/BeetIcon"
import { exportInvoicePDF } from "./exportInvoicePDF"

// ─── Financial helpers (duplicated locally so this file is self-contained) ───
function laborTotal(hours: number, rate: number) { return hours * rate }
function partsTotal(parts: { qty: number; unitPrice: number }[]) { return parts.reduce((s, p) => s + p.qty * p.unitPrice, 0) }
function itemTotal(hours: number, rate: number, parts: { qty: number; unitPrice: number }[], ship: number, outside: number) {
  return laborTotal(hours, rate) + partsTotal(parts) + ship + outside
}

const SHOP_SUPPLIES_RATE = 0.05

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromWO = searchParams.get("from")
  const captureRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const inv = INVOICES.find(i => i.id === id)

  async function handleExport() {
    if (!captureRef.current || !inv) return
    setExporting(true)
    try { await exportInvoicePDF(captureRef.current, inv) }
    finally { setExporting(false) }
  }

  if (!inv) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">Invoice not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(fromWO ?? "/app/beet-box/invoicing")} className="text-white/50">
          {fromWO ? "← Back to Work Order" : "← Back to Invoicing"}
        </Button>
      </div>
    )
  }

  const aircraft = AIRCRAFT.find(a => a.id === inv.aircraftId)
  const wo        = inv.woId ? WORK_ORDERS.find(w => w.id === inv.woId) : undefined
  const woItems   = wo?.items ?? []

  // Totals derived from WO items (or invoice lines as fallback)
  const totalShopLabor = woItems.length > 0
    ? woItems.reduce((s, i) => s + laborTotal(i.hours, i.laborRate), 0)
    : inv.subtotalLabor
  const totalParts     = woItems.length > 0
    ? woItems.reduce((s, i) => s + partsTotal(i.parts), 0)
    : inv.subtotalParts
  const totalShipping  = woItems.length > 0
    ? woItems.reduce((s, i) => s + i.shippingCost, 0)
    : 0
  const totalOutside   = woItems.length > 0
    ? woItems.reduce((s, i) => s + i.outsideServicesCost, 0)
    : inv.subtotalMisc
  const shopSupplies   = totalShopLabor * SHOP_SUPPLIES_RATE
  const subtotal       = totalShopLabor + totalParts + totalShipping + totalOutside + shopSupplies
  const tax            = inv.taxAmount
  const amountCharged  = subtotal + tax
  const amountPaid     = inv.status === "paid" ? amountCharged : 0
  const amountDue      = amountCharged - amountPaid

  const isVoid = inv.status === "void"

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
  }

  return (
    <div className="min-h-screen">

      {/* Beet Box page chrome — stays dark */}
      <div className="hero-area px-8 py-5 flex items-center justify-between">
        <button
          onClick={() => navigate(fromWO ?? "/app/beet-box/invoicing")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {fromWO ? "Back to Work Order" : "Invoicing"}
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleExport}
          disabled={exporting}
          className="text-white/50 border border-white/10 hover:border-white/25 hover:text-white/80 text-xs gap-1.5"
        >
          {exporting
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
            : <><Download className="w-3.5 h-3.5" /> Export PDF</>
          }
        </Button>
      </div>

      <div className="stripe-divider" />

      {/* Invoice document — white card, matches real EBIS invoice */}
      <div className="px-8 py-6">
        <div
          ref={captureRef}
          className={`bg-white text-gray-900 rounded shadow-2xl max-w-4xl mx-auto text-sm ${isVoid ? "opacity-60" : ""}`}
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="flex justify-between items-start px-6 pt-6 pb-4" style={{ borderBottom: "2px solid #222" }}>

            {/* Left: Company */}
            <div className="flex items-start gap-3">
              <BeetIcon className="w-10 h-10 flex-shrink-0 mt-0.5" style={{ color: "#8B2020" }} />
              <div className="leading-tight">
                <p className="font-bold text-base text-gray-900">CB Aviation, Inc.</p>
                <p className="text-gray-600 text-xs">dba SkyShare</p>
                <p className="text-gray-500 text-xs mt-1">3715 Airport Rd.</p>
                <p className="text-gray-500 text-xs">Ogden, UT 84116</p>
                <p className="text-gray-500 text-xs mt-1">jstorey@skyshare.com</p>
                <p className="text-gray-500 text-xs">801-621-0326</p>
                <p className="text-gray-400 text-xs">skyshare.com</p>
              </div>
            </div>

            {/* Right: Invoice meta */}
            <div className="text-right space-y-0.5">
              <p className="text-xl font-bold text-gray-900">Customer Invoice: {inv.invoiceNumber}</p>
              {isVoid && <p className="text-red-600 font-bold text-sm tracking-widest">VOID</p>}
              <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                <p><span className="font-semibold text-gray-700">Date:</span> {fmtDate(inv.issuedDate)}</p>
                {inv.dueDate && <p><span className="font-semibold text-gray-700">Due Date:</span> {fmtDate(inv.dueDate)}</p>}
                {aircraft && (
                  <>
                    <p><span className="font-semibold text-gray-700">Reg. No.:</span> {aircraft.registration} ({aircraft.make} {aircraft.model})</p>
                    <p><span className="font-semibold text-gray-700">A/C Serial:</span> {aircraft.serial}</p>
                    <p><span className="font-semibold text-gray-700">A/C TT:</span> {wo?.meterAtOpen?.toFixed(1) ?? aircraft.totalTime.toFixed(1)}</p>
                  </>
                )}
                {inv.woNumber && <p><span className="font-semibold text-gray-700">Work Order:</span> {inv.woNumber}</p>}
              </div>
              <div className="mt-3 text-xs">
                <p className="font-bold text-gray-700">Bill To:</p>
                <p className="text-gray-800 font-semibold">{inv.customerName}</p>
              </div>
            </div>
          </div>

          {/* ── Item blocks (from linked WO) ─────────────────────────────── */}
          {woItems.length > 0 ? woItems.map((item, idx) => {
            const labor   = laborTotal(item.hours, item.laborRate)
            const parts   = partsTotal(item.parts)
            const total   = itemTotal(item.hours, item.laborRate, item.parts, item.shippingCost, item.outsideServicesCost)

            return (
              <div key={item.id} style={{ borderBottom: "1px solid #d1d5db" }}>

                {/* Item header — gray band */}
                <div
                  className="flex items-center justify-between px-4 py-1.5"
                  style={{ background: "#e5e7eb", borderBottom: "1px solid #d1d5db" }}
                >
                  <span className="font-bold text-xs text-gray-700">
                    Item: {idx + 1} — {item.category}
                    {item.taskNumber && <span className="font-normal text-gray-500 ml-2">({item.taskNumber})</span>}
                  </span>
                  <span className="text-xs text-gray-500">{item.logbookSection}</span>
                </div>

                {/* Discrepancy + Hours/Subtotal */}
                <div className="flex px-4 py-3 gap-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <div className="flex-1 text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {item.discrepancy || <span className="text-gray-400 italic">No discrepancy entered.</span>}
                  </div>
                  <div className="flex gap-6 flex-shrink-0 text-right text-xs">
                    <div>
                      <p className="font-semibold text-gray-500 mb-1">Hours</p>
                      <p className="font-mono text-gray-800">{item.hours.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-500 mb-1">Subtotal</p>
                      <p className="font-mono text-gray-800">${labor.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Parts list (if any) */}
                {item.parts.length > 0 && (
                  <div className="px-4 py-2" style={{ borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                    <p className="font-bold text-xs text-gray-600 mb-1.5">Parts Used:</p>
                    <div className="space-y-0.5">
                      {item.parts.map(p => (
                        <div key={p.id} className="flex items-center gap-4 text-xs">
                          <span className="font-mono text-gray-600 w-32 flex-shrink-0">{p.partNumber}</span>
                          <span className="text-gray-700 flex-1">{p.description}</span>
                          <span className="text-gray-500 w-8 text-center">{p.qty}</span>
                          <span className="font-mono text-gray-600 w-16 text-right">${p.unitPrice.toFixed(2)}</span>
                          <span className="font-mono text-gray-800 w-16 text-right font-semibold">${(p.qty * p.unitPrice).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Corrective Action */}
                <div className="px-4 py-3" style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <p className="font-bold text-xs text-gray-600 mb-1">Corrective Action:</p>
                  <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {item.correctiveAction || <span className="text-gray-400 italic">Corrective action not yet recorded.</span>}
                  </p>
                </div>

                {/* Item Summary */}
                <div className="flex items-center gap-6 px-4 py-2 text-xs text-gray-600" style={{ background: "#f9fafb" }}>
                  <span>Labor: <span className="font-mono font-semibold text-gray-800">${labor.toFixed(2)}</span></span>
                  <span className="text-gray-300">|</span>
                  <span>Parts: <span className="font-mono font-semibold text-gray-800">${parts.toFixed(2)}</span></span>
                  <span className="text-gray-300">|</span>
                  <span>Shipping: <span className="font-mono font-semibold text-gray-800">${item.shippingCost.toFixed(2)}</span></span>
                  {item.outsideServicesCost > 0 && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span>Outside Svcs: <span className="font-mono font-semibold text-gray-800">${item.outsideServicesCost.toFixed(2)}</span></span>
                    </>
                  )}
                  <span className="ml-auto font-bold text-gray-900">
                    Item Subtotal: <span className="font-mono">${total.toFixed(2)}</span>
                  </span>
                </div>

              </div>
            )
          }) : (
            /* Fallback: no WO linked — show invoice lines as a simple table */
            <div>
              <div className="px-4 py-2" style={{ background: "#e5e7eb", borderBottom: "1px solid #d1d5db" }}>
                <span className="font-bold text-xs text-gray-700">Invoice Lines</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid #d1d5db", background: "#f9fafb" }}>
                    {["Type", "Description", "Qty", "Unit Price", "Extended"].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((line, idx) => (
                    <tr key={line.id} style={{ borderBottom: idx < inv.lines.length - 1 ? "1px solid #e5e7eb" : "none", background: idx % 2 ? "#fafafa" : "#fff" }}>
                      <td className="px-4 py-2 text-gray-600 capitalize">{line.type.replace("_", " ")}</td>
                      <td className="px-4 py-2 text-gray-800">{line.description}</td>
                      <td className="px-4 py-2 text-gray-600 text-center">{line.qty}</td>
                      <td className="px-4 py-2 font-mono text-gray-600">${line.unitPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 font-mono font-semibold text-gray-800">${line.extended.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Totals ───────────────────────────────────────────────────── */}
          <div className="flex justify-between items-start px-6 py-5" style={{ borderBottom: "1px solid #d1d5db" }}>

            {/* Left: Shop Supplies detail */}
            <div className="text-xs text-gray-600 space-y-1">
              <p className="font-bold text-gray-700">Shop Supplies ({(SHOP_SUPPLIES_RATE * 100).toFixed(0)}%)</p>
              <p className="font-mono">${shopSupplies.toFixed(2)}</p>
              {tax > 0 && (
                <div className="mt-2">
                  <p className="font-bold text-gray-700">Tax Breakdown</p>
                  <p>Shop Supplies = ${shopSupplies.toFixed(2)}</p>
                  <p>Tax Rate = 8.25%</p>
                </div>
              )}
              {inv.notes && (
                <div className="mt-4 max-w-xs">
                  <p className="font-bold text-gray-700 mb-0.5">Notes</p>
                  <p className="text-gray-600 leading-relaxed">{inv.notes}</p>
                </div>
              )}
            </div>

            {/* Right: Aligned totals */}
            <div className="text-xs space-y-1 min-w-[260px]">
              {[
                { label: "Total Shop Labor",      value: totalShopLabor, show: true },
                { label: "Total Parts",            value: totalParts,     show: true },
                { label: "Total Shipping",         value: totalShipping,  show: true },
                { label: "Additional Charges",     value: totalOutside,   show: true },
                { label: "Shop Supplies",          value: shopSupplies,   show: true },
                { label: "Tax",                    value: tax,            show: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-8">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="font-mono text-gray-800">${row.value.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-8 pt-1" style={{ borderTop: "1px solid #9ca3af" }}>
                <span className="font-semibold text-gray-700">Amount Charged</span>
                <span className="font-mono font-semibold text-gray-800">${amountCharged.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-mono text-gray-800">${amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-8 pt-1" style={{ borderTop: "2px solid #111" }}>
                <span className="font-bold text-base text-gray-900">Amount Due</span>
                <span className="font-mono font-bold text-base text-gray-900">${amountDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ── Important Information ─────────────────────────────────────── */}
          <div className="px-6 py-3 text-xs text-gray-600" style={{ borderBottom: "1px solid #d1d5db" }}>
            <p className="font-bold text-gray-700 mb-1">Important Information</p>
            <p>Core fees may apply and are the responsibility of the customer.</p>
            <p>Credit card convenience fee of 3.5% applies to all invoices $1,000.00 or more.</p>
          </div>

          {/* ── Signature & Date ─────────────────────────────────────────── */}
          <div className="px-6 py-4">
            <p className="font-bold text-xs text-gray-700 mb-4">Signature &amp; Date</p>
            <div className="w-80 mt-6" style={{ borderBottom: "1px solid #6b7280" }} />
          </div>

          {/* ── Page footer ──────────────────────────────────────────────── */}
          <div
            className="px-6 py-2 flex justify-between text-xs text-gray-400"
            style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}
          >
            <span>Customer Invoice: {inv.invoiceNumber}</span>
            <span>Printed by Beet Box · CB Aviation MX Suite</span>
          </div>

        </div>
      </div>
    </div>
  )
}
