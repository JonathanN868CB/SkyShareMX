import { useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog"
import { Label } from "@/shared/ui/label"
import { Button } from "@/shared/ui/button"
import { useAuth } from "@/features/auth"
import { mxlms } from "@/lib/supabase-mxlms"
import type { MxlmsPendingTrainingInsert } from "@/entities/mxlms"

// ── Taxonomy (mirrors MX-LMS) ─────────────────────────────────────────────────

const CATEGORIES = [
  "Regulatory & Compliance",
  "Safety & Human Factors",
  "Technical — Airframe",
  "Technical — Powerplant",
  "Technical — Avionics / Electrical",
  "OEM / Supplier",
  "Company Policy & Procedures",
  "Professional Development",
]

const SUBCATEGORIES: Record<string, string[]> = {
  "Regulatory & Compliance":          ["14 CFR / FARs", "Airworthiness Directives", "Service Bulletins / STCs", "OSHA / Safety Regs"],
  "Safety & Human Factors":           ["Human Factors / CRM", "FOD Prevention & Control", "Hazmat / HAZWOPER", "General Safety"],
  "Technical — Airframe":             ["Structures & Composites", "Hydraulics & Landing Gear", "Environmental Systems", "Fuel Systems"],
  "Technical — Powerplant":           ["Engine Run & Ground Ops", "Turbine Systems", "APU Systems", "Fuel & Ignition"],
  "Technical — Avionics / Electrical":["Electrical Systems", "Avionics / Navigation", "Communications"],
  "OEM / Supplier":                   ["Bombardier / Learjet", "Pratt & Whitney", "Honeywell", "Collins Aerospace", "Other OEM"],
  "Company Policy & Procedures":      ["Documentation & Records", "Quality & Inspection", "Maintenance Control"],
  "Professional Development":         ["Leadership & Management", "Career Advancement", "Certifications & Licenses"],
}

// ── Shared field components ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 block"
      style={{ fontFamily: "var(--font-heading)" }}>
      {children}
    </Label>
  )
}

function FieldInput({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none transition-colors"
      style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.1)" }}
      onFocus={e  => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)" }}
      onBlur={e   => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
    />
  )
}

function FieldSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded px-3 py-2 text-sm text-white/80 outline-none transition-colors"
      style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.1)" }}
      onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)" }}
      onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}>
      {children}
    </select>
  )
}

function FieldTextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      className="w-full rounded px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none transition-colors resize-none"
      style={{ background: "hsl(0 0% 10%)", border: "1px solid rgba(255,255,255,0.1)" }}
      onFocus={e => { e.currentTarget.style.borderColor = "rgba(212,160,23,0.4)" }}
      onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
    />
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ProposeTrainingItemModal({ open, onClose, onSuccess }: Props) {
  const { profile } = useAuth()

  const [name,             setName]            = useState("")
  const [category,         setCategory]        = useState("")
  const [subcategory,      setSubcategory]     = useState("")
  const [authority,        setAuthority]       = useState("company")
  const [priority,         setPriority]        = useState("standard")
  const [type,             setType]            = useState("recurring")
  const [recurrence,       setRecurrence]      = useState("365")
  const [regulatoryBasis,  setRegulatoryBasis] = useState("")
  const [description,      setDescription]     = useState("")
  const [objectives,       setObjectives]      = useState("")
  const [saving,           setSaving]          = useState(false)

  const subcategoryOptions = category ? (SUBCATEGORIES[category] ?? []) : []

  function reset() {
    setName(""); setCategory(""); setSubcategory(""); setAuthority("company")
    setPriority("standard"); setType("recurring"); setRecurrence("365")
    setRegulatoryBasis(""); setDescription(""); setObjectives("")
  }

  async function handleSubmit() {
    if (!name.trim() || !category) return
    setSaving(true)
    try {
      const payload: MxlmsPendingTrainingInsert = {
        name:               name.trim(),
        category,
        subcategory:        subcategory      || null,
        training_authority: authority,
        priority,
        type,
        recurrence_interval: type === "one-time" ? 0 : parseInt(recurrence),
        regulatory_basis:   regulatoryBasis  || null,
        description:        description      || null,
        objectives:         objectives       || null,
        proposed_by_user_id: profile?.id,
        proposed_by_name:   profile?.full_name ?? profile?.email ?? "Unknown",
      }
      const { error } = await mxlms.from("pending_training_items").insert(payload)
      if (error) throw error
      toast.success("Training item proposed — Jonathan will review it in MX-LMS.")
      reset()
      onSuccess()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as Record<string,unknown>)?.message as string ?? String(err)
      toast.error(`Failed to submit: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="max-w-2xl" style={{ background: "hsl(0 0% 7%)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.85)", fontSize: "1rem" }}>
            Propose Training Item
          </DialogTitle>
          <p className="text-xs text-white/30 mt-0.5">
            Jonathan will review this in MX-LMS before it's added to the library.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-5 gap-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">

          {/* Name */}
          <div className="col-span-2">
            <FieldLabel>Training Name *</FieldLabel>
            <FieldInput value={name} onChange={setName} placeholder="e.g. Hydraulic Systems Inspection" />
          </div>

          {/* Category + Subcategory */}
          <div>
            <FieldLabel>Category *</FieldLabel>
            <FieldSelect value={category} onChange={(v) => { setCategory(v); setSubcategory("") }}>
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </FieldSelect>
          </div>

          <div>
            <FieldLabel>Subcategory</FieldLabel>
            {subcategoryOptions.length > 0 ? (
              <FieldSelect value={subcategory} onChange={setSubcategory}>
                <option value="">None</option>
                {subcategoryOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </FieldSelect>
            ) : (
              <FieldInput value={subcategory} onChange={setSubcategory} placeholder="Optional" />
            )}
          </div>

          {/* Authority + Priority */}
          <div>
            <FieldLabel>Authority</FieldLabel>
            <FieldSelect value={authority} onChange={setAuthority}>
              <option value="company">Company</option>
              <option value="regulatory">Regulatory</option>
              <option value="oem">OEM / Supplier</option>
              <option value="best-practice">Best Practice</option>
            </FieldSelect>
          </div>

          <div>
            <FieldLabel>Priority</FieldLabel>
            <FieldSelect value={priority} onChange={setPriority}>
              <option value="standard">Standard</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </FieldSelect>
          </div>

          {/* Type + Recurrence */}
          <div>
            <FieldLabel>Type</FieldLabel>
            <FieldSelect value={type} onChange={setType}>
              <option value="recurring">Recurring</option>
              <option value="one-time">One-Time</option>
            </FieldSelect>
          </div>

          {type === "recurring" && (
            <div>
              <FieldLabel>Recurrence</FieldLabel>
              <FieldSelect value={recurrence} onChange={setRecurrence}>
                <option value="180">Every 6 Months</option>
                <option value="365">Annual</option>
                <option value="730">Every 2 Years</option>
              </FieldSelect>
            </div>
          )}

          {/* Regulatory Basis */}
          <div className="col-span-2">
            <FieldLabel>Regulatory Basis</FieldLabel>
            <FieldInput value={regulatoryBasis} onChange={setRegulatoryBasis}
              placeholder="e.g. 14 CFR 65.83, Part 145.163, AD 2024-12-05" />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <FieldLabel>Description</FieldLabel>
            <FieldTextarea value={description} onChange={setDescription}
              placeholder="Brief overview of what this training covers…" rows={2} />
          </div>

          {/* Objectives */}
          <div className="col-span-2">
            <FieldLabel>Learning Objectives</FieldLabel>
            <FieldTextarea value={objectives} onChange={setObjectives}
              placeholder="What should the technician know or be able to do after completing this?" rows={3} />
          </div>

        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => { reset(); onClose() }}
            style={{ color: "rgba(255,255,255,0.4)" }} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim() || !category}
            style={{ background: "rgba(212,160,23,0.85)", color: "white", border: "none" }}>
            {saving ? "Submitting…" : "Submit Proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
