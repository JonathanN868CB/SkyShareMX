import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Save, Plus, Loader2, ChevronRight, ExternalLink } from "lucide-react"
import {
  useSourceDocuments,
  useUpsertSourceDocument,
  useAircraftDocLinks,
  useToggleApplicability,
} from "./useMmAuditData"
import type { MmSourceDocument } from "./types"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

interface Props {
  onClose: () => void
}

export default function MmSourceDocManager({ onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const { data: docs, isLoading, refetch } = useSourceDocuments()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 220)
  }, [onClose])

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 55,
        background: "#0f0f1a",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1) translateY(0)" : "scale(0.97) translateY(14px)",
        transition: "opacity 0.2s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${rgba(0.1)}`, background: "#0f0f1a" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: C, fontFamily: "var(--font-heading)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>|</span>
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-heading)" }}
          >
            Source Document Management
          </span>
        </div>

        <button
          onClick={() => { setShowAdd(true); setEditingId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
          style={{ background: rgba(0.1), color: C, border: `1px solid ${rgba(0.2)}`, fontFamily: "var(--font-heading)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Document
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: C }} />
          </div>
        )}

        {showAdd && (
          <DocEditRow
            doc={null}
            onSave={() => { setShowAdd(false); refetch() }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {(docs ?? []).map(doc => (
          <div key={doc.id}>
            {editingId === doc.id ? (
              <DocEditRow
                doc={doc}
                onSave={() => { setEditingId(null); refetch() }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <DocDisplayRow
                doc={doc}
                expanded={expandedId === doc.id}
                onToggleExpand={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                onEdit={() => setEditingId(doc.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Display Row ────────────────────────────────────────────────────────────

function DocDisplayRow({
  doc,
  expanded,
  onToggleExpand,
  onEdit,
}: {
  doc: MmSourceDocument
  expanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
}) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${rgba(0.1)}` }}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: rgba(0.03) }}
        onClick={onToggleExpand}
        onMouseEnter={e => (e.currentTarget.style.background = rgba(0.06))}
        onMouseLeave={e => (e.currentTarget.style.background = rgba(0.03))}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
            style={{ color: C, transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-heading)" }}>
                {doc.document_name}
              </span>
              <span className="text-[11px] flex-shrink-0" style={{ color: C }}>
                Rev {doc.current_revision}
              </span>
              {doc.current_rev_date && (
                <span className="text-[11px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                  ({doc.current_rev_date})
                </span>
              )}
            </div>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {doc.document_number}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {doc.document_url && (
            <a
              href={doc.document_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="transition-opacity hover:opacity-80"
            >
              <ExternalLink className="h-3.5 w-3.5" style={{ color: rgba(0.5) }} />
            </a>
          )}
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
            style={{ background: rgba(0.08), color: rgba(0.6), fontFamily: "var(--font-heading)" }}
          >
            Edit
          </button>
        </div>
      </div>

      {expanded && <DocLinkedAircraft sourceDocumentId={doc.id} />}
    </div>
  )
}

// ─── Edit Row ───────────────────────────────────────────────────────────────

function DocEditRow({
  doc,
  onSave,
  onCancel,
}: {
  doc: MmSourceDocument | null
  onSave: () => void
  onCancel: () => void
}) {
  const upsert = useUpsertSourceDocument()
  const [form, setForm] = useState({
    document_number: doc?.document_number ?? "",
    document_name: doc?.document_name ?? "",
    document_url: doc?.document_url ?? "",
    current_revision: doc?.current_revision ?? "",
    current_rev_date: doc?.current_rev_date ?? "",
    notes: doc?.notes ?? "",
  })

  const handleSubmit = () => {
    upsert.mutate(
      {
        id: doc?.id,
        document_number: form.document_number,
        document_name: form.document_name,
        document_url: form.document_url || null,
        current_revision: form.current_revision,
        current_rev_date: form.current_rev_date || null,
        notes: form.notes || null,
      },
      { onSuccess: onSave }
    )
  }

  const inputStyle = {
    background: rgba(0.06),
    border: `1px solid ${rgba(0.15)}`,
    color: "rgba(255,255,255,0.8)",
  }

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ background: rgba(0.04), border: `1px solid ${rgba(0.15)}` }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
            Document Number
          </label>
          <input
            value={form.document_number}
            onChange={e => setForm(f => ({ ...f, document_number: e.target.value }))}
            className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
            disabled={!!doc}
          />
        </div>
        <div>
          <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
            Document Name
          </label>
          <input
            value={form.document_name}
            onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))}
            className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
            Current Revision
          </label>
          <input
            value={form.current_revision}
            onChange={e => setForm(f => ({ ...f, current_revision: e.target.value }))}
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
            value={form.current_rev_date}
            onChange={e => setForm(f => ({ ...f, current_rev_date: e.target.value }))}
            className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
        <div className="col-span-2">
          <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
            Document URL
          </label>
          <input
            value={form.document_url}
            onChange={e => setForm(f => ({ ...f, document_url: e.target.value }))}
            placeholder="https://..."
            className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
        <div className="col-span-2">
          <label className="block mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
            Notes
          </label>
          <input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full rounded px-2.5 py-1.5 text-xs outline-none"
            style={inputStyle}
          />
        </div>
      </div>

      {upsert.isError && (
        <div className="text-xs" style={{ color: "#f87171" }}>Save failed. Please try again.</div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={upsert.isPending || !form.document_number || !form.document_name || !form.current_revision}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "#10b981", color: "#fff", fontFamily: "var(--font-heading)" }}
        >
          {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
        <button
          onClick={onCancel}
          disabled={upsert.isPending}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
          style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Linked Aircraft (per source doc) ───────────────────────────────────────

function DocLinkedAircraft({ sourceDocumentId }: { sourceDocumentId: string }) {
  const { data: links, isLoading } = useAircraftDocLinks(sourceDocumentId)
  const toggleMut = useToggleApplicability()

  return (
    <div className="px-4 pb-3 pt-1">
      {isLoading && (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: C }} />
          <span className="text-xs" style={{ color: rgba(0.5) }}>Loading…</span>
        </div>
      )}

      {!isLoading && (!links || links.length === 0) && (
        <div className="text-xs py-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          No aircraft linked to this document.
        </div>
      )}

      {!isLoading && links && links.length > 0 && (
        <table className="w-full text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${rgba(0.1)}` }}>
              {["Aircraft", "Assembly", "Req Type", "Section", "Detail", "Applicable"].map(h => (
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
            {links.map(link => (
              <tr key={link.id} style={{ borderBottom: `1px solid ${rgba(0.05)}` }}>
                <td className="py-1.5 pr-3 font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>{link.registration}</td>
                <td className="py-1.5 pr-3 capitalize">{link.assembly_type}</td>
                <td className="py-1.5 pr-3">{link.requirement_type === "awl" ? "AWL" : "Sched Mx"}</td>
                <td className="py-1.5 pr-3">{link.section ?? "—"}</td>
                <td className="py-1.5 pr-3">{link.assembly_detail ?? "—"}</td>
                <td className="py-1.5 pr-3">
                  <button
                    onClick={() => toggleMut.mutate({ id: link.id, is_applicable: !link.is_applicable })}
                    disabled={toggleMut.isPending}
                    className="w-8 h-4 rounded-full transition-colors relative"
                    style={{ background: link.is_applicable ? "#10b981" : "rgba(255,255,255,0.1)" }}
                  >
                    <span
                      className="absolute top-0.5 h-3 w-3 rounded-full transition-transform"
                      style={{
                        background: "#fff",
                        left: link.is_applicable ? "calc(100% - 14px)" : "2px",
                      }}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
