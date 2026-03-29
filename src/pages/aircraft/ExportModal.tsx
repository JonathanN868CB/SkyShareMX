import { useState } from "react"
import { AlertTriangle, FileDown, Shield } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Checkbox } from "@/shared/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog"
import { useAuth } from "@/features/auth"
import type { AircraftBase, AircraftDetailData } from "./fleetData"
import { generateAircraftPrintHTML } from "./AircraftPrintGenerator"

interface Props {
  aircraft: AircraftBase
  detail: AircraftDetailData
  onClose: () => void
}

interface SectionOption {
  id: string
  label: string
  description: string
  checked: boolean
  available: boolean
}

export default function ExportModal({ aircraft, detail, onClose }: Props) {
  const { profile } = useAuth()

  const hasAvionics  = detail.avionics.length > 0 || detail.navSubscriptions.length > 0
  const hasCMMs      = detail.cmms.length > 0
  const hasSensitive = detail.avionics.some(s => s.fields.some(f => f.sensitive || f.name === "Username" || f.name === "Account #"))
    || detail.navSubscriptions.length > 0

  const [sections, setSections] = useState<SectionOption[]>([
    { id: "identity",      label: "Identity",                description: "Operating certificate, hangar, keys, aircraft variant", checked: true,     available: true },
    { id: "powerplant",    label: "Powerplant & APU",        description: "Engine(s), propeller, APU serial numbers and models",   checked: true,     available: true },
    { id: "programs",      label: "Programs",                description: "Engine, airframe, and APU program enrollment status",   checked: true,     available: true },
    { id: "avionics",      label: "Avionics & Connectivity", description: "Installed systems and services (credentials excluded)", checked: true,     available: hasAvionics },
    { id: "documentation", label: "Documentation & Manuals", description: "AFM, airframe, engine, and propeller manual references", checked: true,    available: true },
    { id: "cmms",          label: "CMM Library",             description: "Component maintenance manual index for this aircraft",  checked: hasCMMs,  available: hasCMMs },
  ])

  const [includeCredentials, setIncludeCredentials] = useState(false)
  const [credConfirmed, setCredConfirmed]           = useState(false)
  const [showCredConfirm, setShowCredConfirm]       = useState(false)

  const enabledCount = sections.filter(s => s.checked && s.available).length
  const totalAvail   = sections.filter(s => s.available).length

  function toggleSection(id: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s))
  }

  function handleCredentialToggle() {
    if (!includeCredentials) {
      setShowCredConfirm(true)
    } else {
      setIncludeCredentials(false)
      setCredConfirmed(false)
    }
  }

  function confirmCredentials() {
    setIncludeCredentials(true)
    setCredConfirmed(true)
    setShowCredConfirm(false)
  }

  function handleGenerate() {
    const selectedSections = sections.filter(s => s.checked && s.available).map(s => s.id)
    const generatedBy = profile
      ? `${profile.full_name || profile.email} · ${profile.role}`
      : "SkyShare MX"

    const html = generateAircraftPrintHTML({
      aircraft,
      detail,
      sections: selectedSections,
      includeCredentials,
      generatedBy,
    })

    const win = window.open("", "_blank")
    if (win) {
      win.document.write(html)
      win.document.close()
    }
    onClose()
  }

  // ─── Credential confirmation step ─────────────────────────────────────────
  if (showCredConfirm) {
    return (
      <Dialog open onOpenChange={() => setShowCredConfirm(false)}>
        <DialogContent className="max-w-[420px] bg-[hsl(0_0%_10%)] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Sensitive Credential Data
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-white/65 leading-relaxed">
            <p>
              You are about to include <strong className="text-white">nav database usernames, passwords,
              and account numbers</strong> in the exported document.
            </p>
            <p>
              These credentials will appear in plain text on the printed sheet. By proceeding,
              you accept responsibility for the secure distribution of this document.
            </p>
            <div className="rounded border border-amber-500/30 bg-amber-500/8 px-3 py-2.5">
              <p className="text-amber-400 text-xs font-semibold tracking-wide">
                "SENSITIVE — DISTRIBUTION RESTRICTED" will be printed on the document footer.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              className="flex-1 text-white/50 hover:text-white hover:bg-white/8"
              onClick={() => setShowCredConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
              onClick={confirmCredentials}
            >
              I Understand — Include Credentials
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // ─── Main modal ────────────────────────────────────────────────────────────
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[440px] bg-[hsl(0_0%_10%)] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-sm font-semibold">
            Export Aircraft Information
          </DialogTitle>
          <p className="text-xs text-white/40 mt-0.5">
            {aircraft.tailNumber} &nbsp;·&nbsp; {aircraft.model}
          </p>
        </DialogHeader>

        {/* Section toggles */}
        <div>
          <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">
            Sections to include
          </p>
          <div className="space-y-0.5">
            {sections.map(section => (
              <label
                key={section.id}
                className={[
                  "flex items-start gap-3 px-2.5 py-2 rounded cursor-pointer",
                  "transition-colors hover:bg-white/5",
                  !section.available ? "opacity-35 pointer-events-none" : "",
                ].join(" ")}
              >
                <Checkbox
                  checked={section.checked && section.available}
                  onCheckedChange={() => section.available && toggleSection(section.id)}
                  disabled={!section.available}
                  className="mt-0.5 border-white/25 data-[state=checked]:bg-[#d4a017] data-[state=checked]:border-[#d4a017]"
                />
                <div className="min-w-0">
                  <div className="text-white/85 font-medium text-sm leading-tight">
                    {section.label}
                    {!section.available && (
                      <span className="ml-1.5 text-[9px] text-white/30 font-normal">no data</span>
                    )}
                  </div>
                  <div className="text-white/35 text-[10px] mt-0.5">{section.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Sensitive credentials */}
        {hasSensitive && (
          <>
            <div className="h-px bg-white/8" />
            <div>
              <p className="text-[10px] text-amber-500/60 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> Sensitive Data
              </p>
              <label className="flex items-start gap-3 px-2.5 py-2 rounded cursor-pointer transition-colors hover:bg-white/5 border border-amber-500/15 rounded-md">
                <Checkbox
                  checked={includeCredentials}
                  onCheckedChange={handleCredentialToggle}
                  className="mt-0.5 border-amber-500/35 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                />
                <div>
                  <div className="text-amber-400/85 font-medium text-sm leading-tight">
                    Nav Database Credentials
                  </div>
                  <div className="text-white/35 text-[10px] mt-0.5">
                    {credConfirmed
                      ? "Usernames, passwords, and account numbers will be printed in plain text"
                      : "Usernames, passwords, and account numbers — excluded by default"}
                  </div>
                </div>
              </label>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-white/25">
            {enabledCount} of {totalAvail} section{totalAvail !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/45 hover:text-white hover:bg-white/8"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-[#d4a017] hover:bg-[#c4901a] text-[#111] font-semibold"
              onClick={handleGenerate}
              disabled={enabledCount === 0}
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Generate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
