import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { TOOLS } from "../../data/mockData"
import { ToolStatusBadge } from "../../shared/StatusBadge"
import { cn } from "@/shared/lib/utils"

export default function ToolDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tool = TOOLS.find(t => t.id === id)

  if (!tool) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">Tool not found.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/beet-box/tool-calibration")} className="text-white/50">
          ← Back to Tool Calibration
        </Button>
      </div>
    )
  }

  const nextDue   = new Date(tool.nextCalibrationDue)
  const today     = new Date()
  const daysUntil = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const isOverdue = daysUntil < 0
  const isDueSoon = !isOverdue && daysUntil <= 30

  return (
    <div className="min-h-screen">
      <div className="hero-area px-8 py-7">
        <button
          onClick={() => navigate("/app/beet-box/tool-calibration")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tool Calibration
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white font-mono" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
                {tool.toolNumber}
              </h1>
              <ToolStatusBadge status={tool.status} />
            </div>
            <p className="text-white/70 text-base">{tool.description}</p>
            <p className="text-white/40 text-sm mt-1">{tool.manufacturer} · S/N {tool.serialNumber}</p>
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Status alert */}
        {isOverdue && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm font-semibold">Calibration Overdue by {Math.abs(daysUntil)} days</p>
              <p className="text-red-400/70 text-xs mt-0.5">This tool must be removed from service and sent for calibration before use on any aircraft.</p>
            </div>
          </div>
        )}
        {isDueSoon && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-800/40">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm">Calibration due in {daysUntil} days — schedule calibration soon</p>
          </div>
        )}
        {!isOverdue && !isDueSoon && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-300 text-sm">Calibration current — next due {new Date(tool.nextCalibrationDue).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
        )}

        {/* Details */}
        <div className="grid grid-cols-2 gap-6">
          <div className="card-elevated rounded-lg p-5 space-y-3">
            <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Tool Details</p>
            {[
              ["Tool Number",          tool.toolNumber],
              ["Description",          tool.description],
              ["Serial Number",        tool.serialNumber],
              ["Manufacturer",         tool.manufacturer],
              ["Location",             tool.location],
              ["Calibration Interval", `${tool.calibrationIntervalDays} days`],
              ["Calibration Vendor",   tool.calibrationVendor],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-white/35 text-xs flex-shrink-0">{label}</span>
                <span className="text-white/75 text-xs text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="card-elevated rounded-lg p-5 space-y-3">
            <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Calibration Status</p>
            {[
              ["Last Calibrated",   new Date(tool.lastCalibratedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })],
              ["Next Due",          new Date(tool.nextCalibrationDue).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })],
              ["Days Until Due",    isOverdue ? `${Math.abs(daysUntil)} days OVERDUE` : `${daysUntil} days`],
              ["Status",            tool.status.replace("_", " ")],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-white/35 text-xs flex-shrink-0">{label}</span>
                <span className={cn(
                  "text-xs text-right",
                  label === "Days Until Due" && isOverdue ? "text-red-400 font-semibold" :
                  label === "Days Until Due" && isDueSoon ? "text-amber-400 font-semibold" :
                  "text-white/75"
                )}>{value}</span>
              </div>
            ))}
            <div className="pt-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-white/40 border border-white/10 hover:border-white/25 hover:text-white/70 w-full"
                onClick={() => alert("Demo: Would open calibration upload form — upload certificate PDF, enter cert number, set new calibration date.")}
              >
                Record New Calibration
              </Button>
            </div>
          </div>
        </div>

        {/* Calibration history */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
            <span className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Calibration History</span>
          </div>
          {tool.history.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/25 text-sm">No calibration history recorded.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                  {["Calibrated", "Calibrated By", "Next Due", "Certificate #", "Notes"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tool.history.map((rec, idx) => (
                  <tr key={rec.id} style={{ borderBottom: idx < tool.history.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                    <td className="px-4 py-3 text-white/70 text-xs font-mono">{rec.calibratedAt}</td>
                    <td className="px-4 py-3 text-white/70 text-sm">{rec.calibratedBy}</td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">{rec.nextDue}</td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">{rec.certificateNumber}</td>
                    <td className="px-4 py-3 text-white/40 text-xs">{rec.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
