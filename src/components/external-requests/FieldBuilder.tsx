import { useState } from "react"
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select"
import type { FieldDef, FieldType } from "@/entities/supabase"

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text:     "Short Text",
  textarea: "Long Text",
  number:   "Number",
  photo:    "Photo (camera)",
  file:     "File / Document",
}

type Props = {
  fields: FieldDef[]
  onChange: (fields: FieldDef[]) => void
}

function makeField(): FieldDef {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "text",
    required: false,
    hint: "",
  }
}

export function FieldBuilder({ fields, onChange }: Props) {
  function addField() {
    onChange([...fields, makeField()])
  }

  function removeField(id: string) {
    onChange(fields.filter(f => f.id !== id))
  }

  function updateField(id: string, patch: Partial<FieldDef>) {
    onChange(fields.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...fields]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  function moveDown(index: number) {
    if (index === fields.length - 1) return
    const next = [...fields]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {fields.length === 0 && (
        <p className="text-xs py-3 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
          No fields yet — add at least one.
        </p>
      )}

      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="rounded-md p-3 space-y-2"
          style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)" }}
        >
          {/* Row 1: type + move + delete */}
          <div className="flex items-center gap-2">
            <Select
              value={field.type}
              onValueChange={(v) => updateField(field.id, { type: v as FieldType })}
            >
              <SelectTrigger className="h-7 text-xs w-40 flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([type, label]) => (
                  <SelectItem key={type} value={type} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="p-1 rounded opacity-40 hover:opacity-80 disabled:opacity-15 transition-opacity"
              >
                <ChevronUp className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.7)" }} />
              </button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                disabled={idx === fields.length - 1}
                className="p-1 rounded opacity-40 hover:opacity-80 disabled:opacity-15 transition-opacity"
              >
                <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.7)" }} />
              </button>
              <button
                type="button"
                onClick={() => removeField(field.id)}
                className="p-1 rounded opacity-40 hover:opacity-80 transition-opacity ml-1"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </div>

          {/* Row 2: label */}
          <div>
            <Input
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              placeholder="Field label (e.g. Current city / airport)"
              className="h-7 text-xs"
            />
          </div>

          {/* Row 3: hint + required */}
          <div className="flex items-center gap-2">
            <Input
              value={field.hint ?? ""}
              onChange={(e) => updateField(field.id, { hint: e.target.value })}
              placeholder="Hint (optional)"
              className="h-7 text-xs flex-1"
            />
            <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => updateField(field.id, { required: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Required</span>
            </label>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addField}
        className="w-full h-8 text-xs gap-1.5 mt-1"
        style={{ borderStyle: "dashed", borderColor: "rgba(212,160,23,0.3)", color: "rgba(212,160,23,0.7)" }}
      >
        <Plus className="w-3.5 h-3.5" />
        Add Field
      </Button>
    </div>
  )
}
