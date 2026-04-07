import { useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft, AlertTriangle, CheckCircle, Clock, Edit2, Save, X,
  Download, History, MapPin, DollarSign, Calendar, Wrench, ShieldCheck,
  FileText, Bell,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { useAuth } from "@/features/auth"
import { TOOL_INVENTORY } from "../../data/toolInventory"
import { ToolStatusBadge } from "../../shared/StatusBadge"
import { exportToolCalibrationPDF } from "./exportToolsPDF"
import type { Tool, ToolStatus } from "../../types"
import { cn } from "@/shared/lib/utils"

const MANAGER_ROLES = ["Super Admin", "Admin", "Manager", "Director of Maintenance"]

function getDaysUntilDue(tool: Tool): number | null {
  if (!tool.nextCalibrationDue) return null
  return Math.ceil((new Date(tool.nextCalibrationDue).getTime() - Date.now()) / 86400000)
}

function computeStatus(tool: Tool): ToolStatus {
  if (tool.inactive) return "retired"
  const days = getDaysUntilDue(tool)
  if (days === null) return tool.toolType === "Ref" ? "active" : "out_of_service"
  if (days < 0) return "overdue"
  if (days <= 30) return "due_soon"
  return "active"
}

function fmtDate(d: string | null, style: "short" | "long" = "long") {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US",
    style === "short"
      ? { month: "short", day: "numeric", year: "2-digit" }
      : { month: "long", day: "numeric", year: "numeric" }
  )
}

function fmtCurrency(n: number) {
  return n > 0 ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"
}

export default function ToolDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isManager = MANAGER_ROLES.includes(profile?.role ?? "")

  const baseTool = TOOL_INVENTORY.find(t => t.id === id)
  const [tool, setTool] = useState<Tool | null>(baseTool ? { ...baseTool, status: computeStatus(baseTool) } : null)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Partial<Tool>>({})
  const [showCalForm, setShowCalForm] = useState(false)
  const [calForm, setCalForm] = useState({ calibratedAt: "", nextDue: "", certNumber: "", vendor: "", cost: "", notes: "" })

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

  const days = getDaysUntilDue(tool)
  const isOverdue = days !== null && days < 0
  const isDueSoon = days !== null && !isOverdue && days <= 30

  function startEdit() {
    setEditData({
      description: tool!.description,
      make: tool!.make,
      model: tool!.model,
      serialNumber: tool!.serialNumber,
      location: tool!.location,
      locationNotes: tool!.locationNotes,
      vendor: tool!.vendor,
      toolCost: tool!.toolCost,
      calibrationIntervalDays: tool!.calibrationIntervalDays,
      calibrationCost: tool!.calibrationCost,
      calibrationNotes: tool!.calibrationNotes,
    })
    setEditMode(true)
  }

  function saveEdit() {
    setTool(prev => prev ? { ...prev, ...editData, updatedAt: new Date().toISOString() } : prev)
    setEditMode(false)
  }

  function recordCalibration() {
    if (!calForm.calibratedAt || !calForm.nextDue) return
    const newRecord = {
      id: `cal-${Date.now()}`,
      toolId: tool!.id,
      calibratedBy: profile?.id ?? null,
      calibratedByName: profile?.full_name ?? "Unknown",
      calibratedAt: calForm.calibratedAt,
      nextDue: calForm.nextDue,
      certificateNumber: calForm.certNumber || null,
      vendor: calForm.vendor || null,
      cost: parseFloat(calForm.cost) || 0,
      notes: calForm.notes || null,
      createdAt: new Date().toISOString(),
    }

    const newDays = Math.ceil((new Date(calForm.nextDue).getTime() - Date.now()) / 86400000)
    const newStatus: ToolStatus = newDays < 0 ? "overdue" : newDays <= 30 ? "due_soon" : "active"

    setTool(prev => prev ? {
      ...prev,
      lastCalibratedAt: calForm.calibratedAt,
      nextCalibrationDue: calForm.nextDue,
      status: newStatus,
      history: [newRecord, ...prev.history],
      updatedAt: new Date().toISOString(),
    } : prev)

    setCalForm({ calibratedAt: "", nextDue: "", certNumber: "", vendor: "", cost: "", notes: "" })
    setShowCalForm(false)
  }

  const DetailRow = ({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) => (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-white/35 text-xs flex-shrink-0">{label}</span>
      <span className={cn("text-xs text-right", className ?? "text-white/75")}>{value || "—"}</span>
    </div>
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
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "24px", letterSpacing: "0.05em" }}>
                {tool.toolNumber}
              </h1>
              <ToolStatusBadge status={tool.status} />
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                tool.toolType === "Cert" ? "bg-[#D4A017]/15 text-[#D4A017]" : "bg-zinc-700/50 text-zinc-400"
              }`}>
                {tool.toolTypeFull || tool.toolType}
              </span>
            </div>
            <p className="text-white/70 text-base">{tool.description}</p>
            <p className="text-white/40 text-sm mt-1">
              {[tool.make, tool.model].filter(Boolean).join(" · ")}
              {tool.serialNumber && ` · S/N ${tool.serialNumber}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/50 hover:text-white/80 border border-white/10 hover:border-white/25 text-xs gap-1.5"
              onClick={() => exportToolCalibrationPDF([tool], `Tool ${tool.toolNumber} Report`)}
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>
            {isManager && !editMode && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white/50 hover:text-white/80 border border-white/10 hover:border-white/25 text-xs gap-1.5"
                onClick={startEdit}
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Status Alerts */}
        {isOverdue && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-red-900/20 border border-red-800/40">
            <Bell className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-red-300 text-sm font-semibold">Calibration OVERDUE by {Math.abs(days!)} days</p>
              <p className="text-red-400/70 text-xs mt-0.5">This tool must be removed from service and recalibrated before use on any certificated aircraft. Per 14 CFR §145.109.</p>
            </div>
          </div>
        )}
        {isDueSoon && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-800/40">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm">Calibration due in <strong>{days}</strong> days — schedule calibration soon</p>
          </div>
        )}
        {!isOverdue && !isDueSoon && tool.toolType === "Cert" && tool.nextCalibrationDue && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-900/20 border border-emerald-800/40">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-300 text-sm">Calibration current — next due {fmtDate(tool.nextCalibrationDue)}</p>
          </div>
        )}

        {/* Edit Mode Banner */}
        {editMode && (
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#D4A017]/10 border border-[#D4A017]/30">
            <p className="text-[#D4A017] text-sm font-semibold flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Editing tool details
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="text-xs text-white/50" onClick={() => setEditMode(false)}>
                <X className="w-3.5 h-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="text-xs" style={{ background: "var(--skyshare-gold)", color: "#1e1e1e" }} onClick={saveEdit}>
                <Save className="w-3.5 h-3.5 mr-1" /> Save Changes
              </Button>
            </div>
          </div>
        )}

        {/* Detail Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Tool Details */}
          <div className="card-elevated rounded-lg p-5 space-y-2" style={{ borderTop: "2px solid var(--skyshare-gold)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-[#D4A017] opacity-60" />
              <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Tool Details</p>
            </div>
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Description</label>
                  <Input className="text-xs h-8" value={editData.description ?? ""} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Make</label>
                    <Input className="text-xs h-8" value={editData.make ?? ""} onChange={e => setEditData(p => ({ ...p, make: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Model</label>
                    <Input className="text-xs h-8" value={editData.model ?? ""} onChange={e => setEditData(p => ({ ...p, model: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Serial Number</label>
                  <Input className="text-xs h-8" value={editData.serialNumber ?? ""} onChange={e => setEditData(p => ({ ...p, serialNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Location</label>
                  <Input className="text-xs h-8" value={editData.location ?? ""} onChange={e => setEditData(p => ({ ...p, location: e.target.value }))} />
                </div>
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Vendor</label>
                  <Input className="text-xs h-8" value={editData.vendor ?? ""} onChange={e => setEditData(p => ({ ...p, vendor: e.target.value }))} />
                </div>
              </div>
            ) : (
              <>
                <DetailRow label="Tool Number" value={tool.toolNumber} />
                <DetailRow label="Description" value={tool.description} />
                <DetailRow label="Make" value={tool.make} />
                <DetailRow label="Model" value={tool.model} />
                <DetailRow label="Serial Number" value={tool.serialNumber} />
                <DetailRow label="Tool Type" value={tool.toolTypeFull || tool.toolType} />
                <DetailRow label="Tool Room" value={tool.toolRoom} />
              </>
            )}
          </div>

          {/* Calibration Status */}
          <div className="card-elevated rounded-lg p-5 space-y-2" style={{ borderTop: `2px solid ${isOverdue ? "#dc2626" : isDueSoon ? "#f59e0b" : "#10b981"}` }}>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className={`w-4 h-4 opacity-60 ${isOverdue ? "text-red-400" : isDueSoon ? "text-amber-400" : "text-emerald-400"}`} />
              <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Calibration Status</p>
            </div>
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Cal. Interval (Days)</label>
                  <Input className="text-xs h-8" type="number" value={editData.calibrationIntervalDays ?? 0} onChange={e => setEditData(p => ({ ...p, calibrationIntervalDays: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Cal. Cost ($)</label>
                  <Input className="text-xs h-8" type="number" step="0.01" value={editData.calibrationCost ?? 0} onChange={e => setEditData(p => ({ ...p, calibrationCost: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Notes</label>
                  <textarea
                    className="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white/70 resize-none h-20"
                    value={editData.calibrationNotes ?? ""}
                    onChange={e => setEditData(p => ({ ...p, calibrationNotes: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <>
                <DetailRow label="Last Calibrated" value={fmtDate(tool.lastCalibratedAt)} />
                <DetailRow label="Next Due" value={fmtDate(tool.nextCalibrationDue)}
                  className={isOverdue ? "text-red-400 font-semibold" : isDueSoon ? "text-amber-400 font-semibold" : "text-white/75"} />
                <DetailRow label="Days Until Due" value={
                  days === null ? "N/A" : days < 0 ? `${Math.abs(days)} days OVERDUE` : `${days} days`
                } className={isOverdue ? "text-red-400 font-semibold" : isDueSoon ? "text-amber-400 font-semibold" : "text-white/75"} />
                <DetailRow label="Interval" value={tool.calibrationIntervalDays ? `${tool.calibrationIntervalDays} days` : "—"} />
                <DetailRow label="Calibration Cost" value={fmtCurrency(tool.calibrationCost)} />
                {tool.calibrationNotes && (
                  <div className="pt-2 mt-2" style={{ borderTop: "1px solid hsl(0 0% 18%)" }}>
                    <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: "var(--font-heading)" }}>Notes</p>
                    <p className="text-white/50 text-xs whitespace-pre-line">{tool.calibrationNotes}</p>
                  </div>
                )}
              </>
            )}

            {!editMode && isManager && tool.toolType === "Cert" && (
              <div className="pt-3">
                <Button
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  style={{ background: isOverdue ? "#dc2626" : "var(--skyshare-gold)", color: isOverdue ? "#fff" : "#1e1e1e" }}
                  onClick={() => setShowCalForm(true)}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isOverdue ? "Record Calibration (URGENT)" : "Record New Calibration"}
                </Button>
              </div>
            )}
          </div>

          {/* Logistics & Cost */}
          <div className="card-elevated rounded-lg p-5 space-y-2" style={{ borderTop: "2px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-white/40 opacity-60" />
              <p className="text-white/50 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>Logistics & Cost</p>
            </div>
            {editMode ? (
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Tool Cost ($)</label>
                <Input className="text-xs h-8" type="number" step="0.01" value={editData.toolCost ?? 0} onChange={e => setEditData(p => ({ ...p, toolCost: parseFloat(e.target.value) || 0 }))} />
              </div>
            ) : (
              <>
                <DetailRow label="Location" value={tool.location} />
                <DetailRow label="Location Notes" value={tool.locationNotes} />
                <DetailRow label="Vendor" value={tool.vendor} />
                <DetailRow label="Tool Cost" value={fmtCurrency(tool.toolCost)} />
                <DetailRow label="Purchase Date" value={fmtDate(tool.purchaseDate)} />
                <DetailRow label="Label Date" value={fmtDate(tool.labelDate)} />
                <DetailRow label="Requires Approval" value={tool.requiresApproval ? "Yes" : "No"} />
              </>
            )}
          </div>
        </div>

        {/* Record Calibration Form */}
        {showCalForm && (
          <div className="card-elevated rounded-lg p-5" style={{ borderTop: "2px solid var(--skyshare-gold)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D4A017]" />
                <p className="text-white/70 text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)" }}>Record Calibration</p>
              </div>
              <button onClick={() => setShowCalForm(false)} className="text-white/30 hover:text-white/60">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Calibrated Date *</label>
                <Input type="date" className="text-xs h-8" value={calForm.calibratedAt} onChange={e => setCalForm(p => ({ ...p, calibratedAt: e.target.value }))} />
              </div>
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Next Due Date *</label>
                <Input type="date" className="text-xs h-8" value={calForm.nextDue} onChange={e => setCalForm(p => ({ ...p, nextDue: e.target.value }))} />
              </div>
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Certificate #</label>
                <Input className="text-xs h-8" value={calForm.certNumber} onChange={e => setCalForm(p => ({ ...p, certNumber: e.target.value }))} placeholder="Cal cert number" />
              </div>
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Vendor</label>
                <Input className="text-xs h-8" value={calForm.vendor} onChange={e => setCalForm(p => ({ ...p, vendor: e.target.value }))} placeholder="Calibration vendor" />
              </div>
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Cost ($)</label>
                <Input type="number" step="0.01" className="text-xs h-8" value={calForm.cost} onChange={e => setCalForm(p => ({ ...p, cost: e.target.value }))} />
              </div>
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-widest mb-1 block" style={{ fontFamily: "var(--font-heading)" }}>Notes</label>
                <Input className="text-xs h-8" value={calForm.notes} onChange={e => setCalForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" size="sm" className="text-xs text-white/40" onClick={() => setShowCalForm(false)}>Cancel</Button>
              <Button
                size="sm"
                className="text-xs gap-1.5"
                style={{ background: "var(--skyshare-gold)", color: "#1e1e1e" }}
                disabled={!calForm.calibratedAt || !calForm.nextDue}
                onClick={recordCalibration}
              >
                <Save className="w-3.5 h-3.5" /> Save Calibration Record
              </Button>
            </div>
          </div>
        )}

        {/* Calibration History */}
        <div className="card-elevated rounded-lg overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
            <History className="w-4 h-4 text-white/30" />
            <span className="text-white/60 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
              Calibration History
            </span>
            <span className="text-white/25 text-xs ml-auto">{tool.history.length} record{tool.history.length !== 1 ? "s" : ""}</span>
          </div>
          {tool.history.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <FileText className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-white/25 text-sm">No calibration history recorded yet.</p>
              {isManager && tool.toolType === "Cert" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#D4A017] mt-2"
                  onClick={() => setShowCalForm(true)}
                >
                  Record first calibration →
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 18%)" }}>
                  {["Calibrated", "Calibrated By", "Next Due", "Certificate #", "Vendor", "Cost", "Notes"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tool.history.map((rec, idx) => (
                  <tr key={rec.id} style={{ borderBottom: idx < tool.history.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                    <td className="px-4 py-3 text-white/70 text-xs font-mono">{fmtDate(rec.calibratedAt, "short")}</td>
                    <td className="px-4 py-3 text-white/70 text-sm">{rec.calibratedByName}</td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">{fmtDate(rec.nextDue, "short")}</td>
                    <td className="px-4 py-3 text-white/50 text-xs font-mono">{rec.certificateNumber || "—"}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{rec.vendor || "—"}</td>
                    <td className="px-4 py-3 text-white/50 text-xs">{rec.cost > 0 ? fmtCurrency(rec.cost) : "—"}</td>
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
