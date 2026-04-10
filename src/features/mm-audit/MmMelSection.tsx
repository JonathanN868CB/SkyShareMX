import { useState } from "react"
import { Loader2, Save, Plus, X } from "lucide-react"
import { useAuth } from "@/features/auth"
import { useMelTracking, useUpsertMelTracking } from "./useMmAuditData"
import type { MmMelTracking } from "./types"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

export default function MmMelSection() {
  const { profile } = useAuth()
  const canEdit = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"
  const { data: rows, isLoading, refetch } = useMelTracking()
  const [editingRow, setEditingRow] = useState<MmMelTracking | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: C }} />
      </div>
    )
  }

  // Group by model_family
  const grouped = new Map<string, MmMelTracking[]>()
  for (const row of rows ?? []) {
    const list = grouped.get(row.model_family) ?? []
    list.push(row)
    grouped.set(row.model_family, list)
  }

  const families = [...grouped.keys()].sort()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: rgba(0.7), fontFamily: "var(--font-heading)" }}
        >
          MEL / Policy Letters ({rows?.length ?? 0} items across {families.length} type groups)
        </span>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
            style={{ background: rgba(0.1), color: C, border: `1px solid ${rgba(0.2)}`, fontFamily: "var(--font-heading)" }}
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {/* Add/Edit dialog */}
      {(showAdd || editingRow) && (
        <MelEditDialog
          row={editingRow}
          onClose={() => { setEditingRow(null); setShowAdd(false) }}
          onSuccess={() => { setEditingRow(null); setShowAdd(false); refetch() }}
        />
      )}

      {families.map(family => {
        const items = grouped.get(family)!
        const hasUpdateNeeded = items.some(r => r.update_needed)

        return (
          <div key={family} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${rgba(0.1)}` }}>
            {/* Family header */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ background: rgba(0.03) }}
            >
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "var(--font-heading)" }}>
                {family}
              </span>
              {hasUpdateNeeded && (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
                  style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontFamily: "var(--font-heading)" }}
                >
                  Update Needed
                </span>
              )}
            </div>

            {/* Items table */}
            <div className="px-4 pb-3 overflow-x-auto">
              <table className="w-full text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${rgba(0.1)}` }}>
                    {["Type", "Document", "Revision", "Rev Date", "Review Date", "Next Due", "Status", ""].map(h => (
                      <th
                        key={h}
                        className="text-left py-1.5 pr-3"
                        style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(row => {
                    const isOverdue = row.next_due_date && new Date(row.next_due_date) < new Date()
                    const isDueSoon = row.next_due_date && !isOverdue && (new Date(row.next_due_date).getTime() - Date.now()) < 30 * 86_400_000

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: `1px solid ${rgba(0.05)}`,
                          background: row.update_needed ? "rgba(245,158,11,0.03)" : undefined,
                        }}
                      >
                        <td className="py-1.5 pr-3">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
                            style={{
                              fontFamily: "var(--font-heading)",
                              background: row.document_type === "mmel" ? rgba(0.08) : "rgba(96,165,250,0.08)",
                              color: row.document_type === "mmel" ? C : "#60a5fa",
                            }}
                          >
                            {row.document_type === "mmel" ? "MMEL" : "PL"}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3" style={{ color: "rgba(255,255,255,0.85)" }}>{row.document_number}</td>
                        <td className="py-1.5 pr-3" style={{ color: C }}>{row.revision_number ?? "—"}</td>
                        <td className="py-1.5 pr-3">{row.revision_date ?? "—"}</td>
                        <td className="py-1.5 pr-3">{row.review_date ?? "—"}</td>
                        <td className="py-1.5 pr-3">{row.next_due_date ?? "—"}</td>
                        <td className="py-1.5 pr-3">
                          {row.update_needed ? (
                            <span className="text-[10px] font-bold uppercase" style={{ color: "#f59e0b" }}>Update Needed</span>
                          ) : isOverdue ? (
                            <span className="text-[10px] font-bold uppercase" style={{ color: "#f87171" }}>Overdue</span>
                          ) : isDueSoon ? (
                            <span className="text-[10px] font-bold uppercase" style={{ color: "#f59e0b" }}>Due Soon</span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase" style={{ color: "#10b981" }}>Current</span>
                          )}
                        </td>
                        <td className="py-1.5">
                          {canEdit && (
                            <button
                              onClick={() => setEditingRow(row)}
                              className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                              style={{ background: rgba(0.08), color: rgba(0.6), fontFamily: "var(--font-heading)" }}
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Edit Dialog ────────────────────────────────────────────────────────────

function MelEditDialog({
  row,
  onClose,
  onSuccess,
}: {
  row: MmMelTracking | null
  onClose: () => void
  onSuccess: () => void
}) {
  const upsert = useUpsertMelTracking()
  const [form, setForm] = useState({
    model_family: row?.model_family ?? "",
    document_type: row?.document_type ?? "mmel" as "mmel" | "policy_letter",
    document_number: row?.document_number ?? "",
    revision_number: row?.revision_number ?? "",
    revision_date: row?.revision_date ?? "",
    review_date: row?.review_date ?? "",
    next_due_date: row?.next_due_date ?? "",
    update_needed: row?.update_needed ?? false,
  })

  const handleSubmit = () => {
    upsert.mutate(
      {
        id: row?.id,
        model_family: form.model_family,
        document_type: form.document_type,
        document_number: form.document_number,
        revision_number: form.revision_number || null,
        revision_date: form.revision_date || null,
        review_date: form.review_date || null,
        next_due_date: form.next_due_date || null,
        update_needed: form.update_needed,
      },
      { onSuccess }
    )
  }

  const inputStyle = {
    background: rgba(0.06),
    border: `1px solid ${rgba(0.15)}`,
    color: "rgba(255,255,255,0.8)",
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 space-y-4 w-full max-w-md shadow-2xl"
        style={{ background: "#1a1a2e", border: `1px solid ${rgba(0.2)}` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.9)" }}>
            {row ? "Edit MEL/PL Entry" : "Add MEL/PL Entry"}
          </span>
          <button onClick={onClose} className="transition-opacity hover:opacity-80">
            <X className="h-4 w-4" style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
              Model Family
            </label>
            <input
              value={form.model_family}
              onChange={e => setForm(f => ({ ...f, model_family: e.target.value }))}
              className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
              style={inputStyle}
              disabled={!!row}
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
              Type
            </label>
            <select
              value={form.document_type}
              onChange={e => setForm(f => ({ ...f, document_type: e.target.value as "mmel" | "policy_letter" }))}
              className="w-full rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer [&>option]:bg-[#1e1e2e] [&>option]:text-white"
              style={inputStyle}
              disabled={!!row}
            >
              <option value="mmel">MMEL</option>
              <option value="policy_letter">Policy Letter</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
              Document Number
            </label>
            <input
              value={form.document_number}
              onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))}
              className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
              style={inputStyle}
              disabled={!!row}
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
              Revision
            </label>
            <input
              value={form.revision_number}
              onChange={e => setForm(f => ({ ...f, revision_number: e.target.value }))}
              className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
              Revision Date
            </label>
            <input
              type="date"
              value={form.revision_date}
              onChange={e => setForm(f => ({ ...f, revision_date: e.target.value }))}
              className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
              Review Date
            </label>
            <input
              type="date"
              value={form.review_date}
              onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))}
              className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
              Next Due Date
            </label>
            <input
              type="date"
              value={form.next_due_date}
              onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))}
              className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
              style={inputStyle}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.update_needed}
                onChange={e => setForm(f => ({ ...f, update_needed: e.target.checked }))}
                className="rounded"
              />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: form.update_needed ? "#f59e0b" : rgba(0.5), fontFamily: "var(--font-heading)" }}>
                Update Needed
              </span>
            </label>
          </div>
        </div>

        {upsert.isError && (
          <div className="text-xs" style={{ color: "#f87171" }}>Save failed. Please try again.</div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={upsert.isPending || !form.model_family || !form.document_number}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "#10b981", color: "#fff", fontFamily: "var(--font-heading)" }}
          >
            {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            onClick={onClose}
            disabled={upsert.isPending}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
