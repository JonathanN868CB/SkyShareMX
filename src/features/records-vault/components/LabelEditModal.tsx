import { useState } from "react"
import { X, Loader2, Sparkles } from "lucide-react"
import { useLabelMutation } from "../hooks/useLabelMutation"
import type { DisplayLabel, LogbookComponent, RecordSource } from "../types"

interface Props {
  source:    RecordSource
  onClose:   () => void
  aircraftId: string | null
}

const COMPONENT_OPTIONS: Array<{ value: LogbookComponent | ""; label: string }> = [
  { value: "",          label: "— Not set —" },
  { value: "airframe",  label: "Airframe" },
  { value: "engine",    label: "Engine" },
  { value: "propeller", label: "Propeller" },
]

export function LabelEditModal({ source, onClose, aircraftId }: Props) {
  const initial: DisplayLabel = source.display_label ?? {
    registration:   source.observed_registration,
    serial:         null,
    component:      null,
    logbook_number: null,
    date_start:     source.date_range_start,
    date_end:       source.date_range_end,
  }

  const [label, setLabel] = useState<DisplayLabel>(initial)
  const mutation = useLabelMutation(aircraftId)

  function update<K extends keyof DisplayLabel>(key: K, value: DisplayLabel[K]) {
    setLabel((l) => ({ ...l, [key]: value }))
  }

  async function handleSave() {
    await mutation.mutateAsync({
      recordSourceId: source.id,
      action:         "save",
      label,
    })
    onClose()
  }

  async function handleRegenerate() {
    const result = await mutation.mutateAsync({
      recordSourceId: source.id,
      action:         "generate",
    })
    if (result.label) setLabel(result.label)
  }

  const isBusy = mutation.isPending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-lg card-elevated border-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2
            className="text-sm uppercase text-foreground"
            style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.15em" }}
          >
            Edit Label
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            disabled={isBusy}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-[11px] text-muted-foreground truncate" title={source.original_filename}>
            {source.original_filename}
          </p>

          <Field label="Registration">
            <input
              type="text"
              value={label.registration ?? ""}
              onChange={(e) => update("registration", e.target.value || null)}
              placeholder="e.g. N123AB"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              disabled={isBusy}
            />
          </Field>

          <Field label="Serial Number">
            <input
              type="text"
              value={label.serial ?? ""}
              onChange={(e) => update("serial", e.target.value || null)}
              placeholder="e.g. 525-0042"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              disabled={isBusy}
            />
          </Field>

          <Field label="Component">
            <select
              value={label.component ?? ""}
              onChange={(e) => {
                const v = e.target.value as LogbookComponent | ""
                update("component", v === "" ? null : v)
              }}
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              disabled={isBusy}
            >
              {COMPONENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Logbook Number">
            <input
              type="text"
              value={label.logbook_number ?? ""}
              onChange={(e) => update("logbook_number", e.target.value || null)}
              placeholder="e.g. Logbook One"
              className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              disabled={isBusy}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date Start">
              <input
                type="date"
                value={label.date_start ?? ""}
                onChange={(e) => update("date_start", e.target.value || null)}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                disabled={isBusy}
              />
            </Field>
            <Field label="Date End">
              <input
                type="date"
                value={label.date_end ?? ""}
                onChange={(e) => update("date_end", e.target.value || null)}
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                disabled={isBusy}
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-muted/20">
          <button
            onClick={handleRegenerate}
            disabled={isBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Ask Haiku to regenerate"
          >
            {isBusy
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
            Regenerate
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isBusy}
              className="px-3 py-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isBusy}
              className="px-3 py-1.5 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {isBusy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {mutation.isError && (
          <p className="px-5 pb-3 text-[11px] text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label
        className="block text-[10px] uppercase text-muted-foreground"
        style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.12em" }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
