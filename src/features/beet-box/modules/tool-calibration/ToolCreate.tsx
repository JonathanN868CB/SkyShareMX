import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Save, Wrench, ShieldCheck, DollarSign } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { useAuth } from "@/features/auth"
import type { ToolType } from "../../types"

const MANAGER_ROLES = ["Super Admin", "Admin", "Manager", "Director of Maintenance"]

interface FormData {
  toolNumber: string
  description: string
  details: string
  make: string
  model: string
  serialNumber: string
  toolType: ToolType
  location: string
  locationNotes: string
  vendor: string
  toolCost: string
  purchaseDate: string
  calibrationIntervalDays: string
  calibrationCost: string
  calibrationNotes: string
  lastCalibratedAt: string
  nextCalibrationDue: string
}

const EMPTY: FormData = {
  toolNumber: "", description: "", details: "", make: "", model: "",
  serialNumber: "", toolType: "Cert", location: "", locationNotes: "",
  vendor: "", toolCost: "0", purchaseDate: "", calibrationIntervalDays: "365",
  calibrationCost: "0", calibrationNotes: "", lastCalibratedAt: "", nextCalibrationDue: "",
}

export default function ToolCreate() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isManager = MANAGER_ROLES.includes(profile?.role ?? "")
  const [form, setForm] = useState<FormData>(EMPTY)
  const [saving, setSaving] = useState(false)

  if (!isManager) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-white/40 text-sm">You do not have permission to add tools.</p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/beet-box/tool-calibration")} className="text-white/50">
          ← Back
        </Button>
      </div>
    )
  }

  function set(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))
  }

  function handleSave() {
    if (!form.toolNumber || !form.description) return
    setSaving(true)
    // In production this would call createTool() service
    // For now, navigate back with success
    setTimeout(() => {
      navigate("/app/beet-box/tool-calibration")
    }, 500)
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>
      {children}
    </label>
  )

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <button
          onClick={() => navigate("/app/beet-box/tool-calibration")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tool Calibration
        </button>
        <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
          ADD NEW TOOL
        </h1>
        <div style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }} className="mb-2" />
        <p className="text-white/45 text-sm" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
          Register a new tool in the calibration tracking system
        </p>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Tool Info */}
          <div className="card-elevated rounded-lg p-5 space-y-4" style={{ borderTop: "2px solid var(--skyshare-gold)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-[#D4A017] opacity-60" />
              <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Tool Information</p>
            </div>
            <div>
              <Label>Tool Number *</Label>
              <Input className="text-xs h-8" value={form.toolNumber} onChange={set("toolNumber")} placeholder="e.g. 134 Torque Wrench" />
            </div>
            <div>
              <Label>Description *</Label>
              <Input className="text-xs h-8" value={form.description} onChange={set("description")} placeholder="Tool description" />
            </div>
            <div>
              <Label>Tool Type</Label>
              <select
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 h-8"
                value={form.toolType}
                onChange={set("toolType")}
              >
                <option value="Cert">Certified (Requires Calibration)</option>
                <option value="Ref">Reference Only</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Make</Label>
                <Input className="text-xs h-8" value={form.make} onChange={set("make")} />
              </div>
              <div>
                <Label>Model</Label>
                <Input className="text-xs h-8" value={form.model} onChange={set("model")} />
              </div>
            </div>
            <div>
              <Label>Serial Number</Label>
              <Input className="text-xs h-8" value={form.serialNumber} onChange={set("serialNumber")} />
            </div>
            <div>
              <Label>Details</Label>
              <textarea
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 resize-none h-16"
                value={form.details}
                onChange={set("details")}
              />
            </div>
          </div>

          {/* Calibration */}
          <div className="card-elevated rounded-lg p-5 space-y-4" style={{ borderTop: "2px solid #10b981" }}>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 opacity-60" />
              <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Calibration</p>
            </div>
            <div>
              <Label>Calibration Interval (Days)</Label>
              <Input type="number" className="text-xs h-8" value={form.calibrationIntervalDays} onChange={set("calibrationIntervalDays")} />
            </div>
            <div>
              <Label>Last Calibrated</Label>
              <Input type="date" className="text-xs h-8" value={form.lastCalibratedAt} onChange={set("lastCalibratedAt")} />
            </div>
            <div>
              <Label>Next Calibration Due</Label>
              <Input type="date" className="text-xs h-8" value={form.nextCalibrationDue} onChange={set("nextCalibrationDue")} />
            </div>
            <div>
              <Label>Calibration Cost ($)</Label>
              <Input type="number" step="0.01" className="text-xs h-8" value={form.calibrationCost} onChange={set("calibrationCost")} />
            </div>
            <div>
              <Label>Calibration Notes</Label>
              <textarea
                className="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 resize-none h-16"
                value={form.calibrationNotes}
                onChange={set("calibrationNotes")}
              />
            </div>
          </div>

          {/* Logistics */}
          <div className="card-elevated rounded-lg p-5 space-y-4" style={{ borderTop: "2px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-white/40 opacity-60" />
              <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Logistics & Cost</p>
            </div>
            <div>
              <Label>Location</Label>
              <Input className="text-xs h-8" value={form.location} onChange={set("location")} placeholder="e.g. Calibrated Tool Cabinet" />
            </div>
            <div>
              <Label>Location Notes</Label>
              <Input className="text-xs h-8" value={form.locationNotes} onChange={set("locationNotes")} />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input className="text-xs h-8" value={form.vendor} onChange={set("vendor")} />
            </div>
            <div>
              <Label>Tool Cost ($)</Label>
              <Input type="number" step="0.01" className="text-xs h-8" value={form.toolCost} onChange={set("toolCost")} />
            </div>
            <div>
              <Label>Purchase Date</Label>
              <Input type="date" className="text-xs h-8" value={form.purchaseDate} onChange={set("purchaseDate")} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" size="sm" className="text-xs text-white/40" onClick={() => navigate("/app/beet-box/tool-calibration")}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5 px-6"
            style={{ background: "var(--skyshare-gold)", color: "#1e1e1e" }}
            disabled={!form.toolNumber || !form.description || saving}
            onClick={handleSave}
          >
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Add Tool"}
          </Button>
        </div>
      </div>
    </div>
  )
}
