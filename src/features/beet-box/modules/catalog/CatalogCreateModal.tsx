import { useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import { createCatalogEntry } from "../../services/catalog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select"
import type { PartClassification } from "../../types"

const PART_TYPES: { value: PartClassification; label: string }[] = [
  { value: "oem", label: "OEM" },
  { value: "pma", label: "PMA" },
  { value: "tso", label: "TSO" },
  { value: "standard_hardware", label: "Standard Hardware" },
  { value: "consumable", label: "Consumable" },
  { value: "raw_material", label: "Raw Material" },
]

interface Props {
  onClose: () => void
  onCreated: () => void
  initialPartNumber?: string
  initialDescription?: string
}

export function CatalogCreateModal({ onClose, onCreated, initialPartNumber, initialDescription }: Props) {
  const [partNumber, setPartNumber] = useState(initialPartNumber ?? "")
  const [description, setDescription] = useState(initialDescription ?? "")
  const [ataChapter, setAtaChapter] = useState("")
  const [partType, setPartType] = useState<PartClassification | "">("")
  const [manufacturer, setManufacturer] = useState("")
  const [uom, setUom] = useState("EA")
  const [isSerialized, setIsSerialized] = useState(false)
  const [isShelfLife, setIsShelfLife] = useState(false)
  const [isRotable, setIsRotable] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partNumber.trim()) {
      toast.error("Part number is required")
      return
    }

    setSubmitting(true)
    try {
      await createCatalogEntry({
        partNumber: partNumber.trim(),
        description: description.trim() || null,
        ataChapter: ataChapter.trim() || null,
        partType: partType || null,
        unitOfMeasure: uom.trim() || "EA",
        manufacturer: manufacturer.trim() || null,
        isSerialized,
        isShelfLife,
        isRotable,
      })
      toast.success(`${partNumber.trim()} added to catalog`)
      onCreated()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("This part number already exists in the catalog")
      } else {
        toast.error(`Failed to create: ${msg}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.9)",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl p-6 space-y-5"
        style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 20%)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-white text-lg"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}
          >
            Add to Catalog
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Part Number */}
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              Part Number <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span>
            </label>
            <input
              type="text"
              value={partNumber}
              onChange={e => setPartNumber(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm font-mono"
              style={inputStyle}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>

          {/* Row: Type + ATA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Part Type</label>
              <Select value={partType} onValueChange={v => setPartType(v as PartClassification)}>
                <SelectTrigger className="w-full rounded-md px-3 py-2 text-sm h-auto" style={inputStyle}>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {PART_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>ATA Chapter</label>
              <input
                type="text"
                value={ataChapter}
                onChange={e => setAtaChapter(e.target.value)}
                placeholder="e.g. 32"
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row: Manufacturer + UOM */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={e => setManufacturer(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Unit of Measure</label>
              <input
                type="text"
                value={uom}
                onChange={e => setUom(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Flags */}
          <div className="flex items-center gap-5">
            {[
              { label: "Serialized", value: isSerialized, set: setIsSerialized },
              { label: "Shelf Life", value: isShelfLife, set: setIsShelfLife },
              { label: "Rotable", value: isRotable, set: setIsRotable },
            ].map(flag => (
              <label key={flag.label} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flag.value}
                  onChange={e => flag.set(e.target.checked)}
                  className="rounded border-white/20"
                />
                <span className="text-xs text-white/60">{flag.label}</span>
              </label>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm transition-colors text-white/50 hover:text-white/80"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: "var(--skyshare-gold)", color: "#111" }}
            >
              {submitting ? "Adding..." : "Add to Catalog"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
