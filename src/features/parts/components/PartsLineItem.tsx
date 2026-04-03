import { Trash2 } from "lucide-react"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select"
import { CONDITIONS } from "../constants"

export interface LineItemData {
  part_number: string
  alternate_pn: string
  description: string
  quantity: number
  condition: string
}

export const EMPTY_LINE: LineItemData = {
  part_number: "",
  alternate_pn: "",
  description: "",
  quantity: 1,
  condition: "new_overhaul",
}

interface Props {
  index: number
  data: LineItemData
  onChange: (index: number, data: LineItemData) => void
  onRemove: (index: number) => void
  canRemove: boolean
  errors?: Partial<Record<keyof LineItemData, string>>
}

export function PartsLineItem({ index, data, onChange, onRemove, canRemove, errors }: Props) {
  function update(field: keyof LineItemData, value: string | number) {
    onChange(index, { ...data, [field]: value })
  }

  return (
    <div
      className="rounded-lg border p-4 space-y-3"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      {/* Line header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
        >
          Part #{index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="p-1 rounded transition-colors"
            style={{ color: "rgba(255,100,100,0.5)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,100,100,0.9)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,100,100,0.5)")}
            title="Remove part line"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Row 1: P/N, Alt P/N, Qty, Condition */}
      <div className="grid grid-cols-12 gap-3">
        {/* Part Number */}
        <div className="col-span-4">
          <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            Part Number <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span>
          </label>
          <input
            type="text"
            value={data.part_number}
            onChange={e => update("part_number", e.target.value)}
            placeholder=""
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: errors?.part_number ? "1px solid rgba(255,100,100,0.5)" : "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.9)",
            }}
          />
          {errors?.part_number && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,100,100,0.8)" }}>{errors.part_number}</p>
          )}
        </div>

        {/* Alternate P/N */}
        <div className="col-span-3">
          <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            Alternate P/N
          </label>
          <input
            type="text"
            value={data.alternate_pn}
            onChange={e => update("alternate_pn", e.target.value)}
            placeholder=""
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.9)",
            }}
          />
        </div>

        {/* Qty */}
        <div className="col-span-2">
          <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            Qty <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span>
          </label>
          <input
            type="number"
            min={1}
            value={data.quantity}
            onChange={e => update("quantity", Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: errors?.quantity ? "1px solid rgba(255,100,100,0.5)" : "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.9)",
            }}
          />
        </div>

        {/* Condition */}
        <div className="col-span-3">
          <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            Condition <span style={{ color: "rgba(255,100,100,0.7)" }}>*</span>
          </label>
          <Select value={data.condition} onValueChange={v => update("condition", v)}>
            <SelectTrigger
              className="w-full rounded-md px-3 py-2 text-sm h-auto"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Description */}
      <div>
        <label className="block text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          Description
        </label>
        <input
          type="text"
          value={data.description}
          onChange={e => update("description", e.target.value)}
          placeholder=""
          className="w-full rounded-md px-3 py-2 text-sm"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.9)",
          }}
        />
      </div>
    </div>
  )
}
