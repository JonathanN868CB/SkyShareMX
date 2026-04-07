import { useState, useEffect } from "react"
import { Plus, Trash2, BookText, Search, X, Check, Loader2, AlertTriangle, Pencil } from "lucide-react"
import { getCorrectiveActions, upsertCorrectiveAction, deleteCorrectiveAction } from "../../services"
import type { LibCorrectiveAction } from "../../services/library"

type EditForm = { aircraftModel: string; refCode: string; correctiveActionText: string }
const EMPTY_FORM: EditForm = { aircraftModel: "", refCode: "", correctiveActionText: "" }

function rowToForm(r: LibCorrectiveAction): EditForm {
  return { aircraftModel: r.aircraftModel, refCode: r.refCode, correctiveActionText: r.correctiveActionText }
}

export default function CannedActionsManager() {
  const [rows, setRows]             = useState<LibCorrectiveAction[]>([])
  const [loading, setLoading]       = useState(true)
  const [query, setQuery]           = useState("")

  // Add state
  const [adding, setAdding]         = useState(false)
  const [addForm, setAddForm]       = useState<EditForm>(EMPTY_FORM)
  const [addSaving, setAddSaving]   = useState(false)

  // Edit state
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editForm, setEditForm]     = useState<EditForm>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    getCorrectiveActions().then(setRows).finally(() => setLoading(false))
  }, [])

  const filtered = rows.filter(r => {
    const q = query.toLowerCase()
    return !q || r.aircraftModel.toLowerCase().includes(q) || r.refCode.toLowerCase().includes(q) || r.correctiveActionText.toLowerCase().includes(q)
  })

  async function handleAdd() {
    if (!addForm.aircraftModel.trim() || !addForm.refCode.trim() || !addForm.correctiveActionText.trim()) return
    setAddSaving(true)
    try {
      await upsertCorrectiveAction({
        aircraftModel:        addForm.aircraftModel.trim(),
        refCode:              addForm.refCode.trim(),
        correctiveActionText: addForm.correctiveActionText.trim(),
        createdByName:        "Manager",
      })
      setRows(await getCorrectiveActions())
      setAdding(false)
      setAddForm(EMPTY_FORM)
    } finally {
      setAddSaving(false)
    }
  }

  async function handleEditSave() {
    if (!editingId || !editForm.aircraftModel.trim() || !editForm.refCode.trim() || !editForm.correctiveActionText.trim()) return
    setEditSaving(true)
    try {
      await upsertCorrectiveAction({
        aircraftModel:        editForm.aircraftModel.trim(),
        refCode:              editForm.refCode.trim(),
        correctiveActionText: editForm.correctiveActionText.trim(),
        createdByName:        "Manager",
      })
      setRows(await getCorrectiveActions())
      setEditingId(null)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteCorrectiveAction(id)
      setRows(r => r.filter(x => x.id !== id))
      if (editingId === id) setEditingId(null)
    } finally {
      setDeletingId(null)
    }
  }

  function startEdit(row: LibCorrectiveAction) {
    setEditingId(row.id)
    setEditForm(rowToForm(row))
    setAdding(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY_FORM)
  }

  const fieldCls = "px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 w-full"
  const fieldStyle = { background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,28%)" }

  function InlineEditForm({ form, setForm, onSave, onCancel, saving }: {
    form: EditForm
    setForm: (f: EditForm) => void
    onSave: () => void
    onCancel: () => void
    saving: boolean
  }) {
    return (
      <div
        className="px-5 py-4 flex flex-col gap-3"
        style={{ background: "hsl(0,0%,10.5%)", borderTop: "2px solid rgba(212,160,23,0.4)", borderBottom: "1px solid hsl(0,0%,20%)" }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Aircraft Model *</label>
            <input
              value={form.aircraftModel}
              onChange={e => setForm({ ...form, aircraftModel: e.target.value })}
              placeholder="e.g. Citation CJ2 (525A)"
              className={fieldCls}
              style={fieldStyle}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Ref / Task Code *</label>
            <input
              value={form.refCode}
              onChange={e => setForm({ ...form, refCode: e.target.value })}
              placeholder="e.g. ATA 34 — 34-11-00"
              className={`${fieldCls} font-mono`}
              style={fieldStyle}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Corrective Action Text *</label>
          <textarea
            value={form.correctiveActionText}
            onChange={e => setForm({ ...form, correctiveActionText: e.target.value })}
            rows={5}
            placeholder="Performed inspection per AMM 34-11-00 section 1.A. Replaced…"
            className={`${fieldCls} resize-y`}
            style={{ ...fieldStyle, minHeight: "100px" }}
          />
          <p className="text-[10px] text-white/25 mt-0.5">{form.correctiveActionText.length} characters</p>
        </div>
        <div className="flex items-center gap-2 justify-end pt-1">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs text-white/45 hover:text-white/70 transition-colors"
            style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,24%)" }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.aircraftModel.trim() || !form.refCode.trim() || !form.correctiveActionText.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: "rgba(212,160,23,0.9)", color: "#000" }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(0,0%,12%)" }}>

      {/* Header */}
      <div className="hero-area px-8 pt-14 pb-7">
        <div className="flex items-center gap-3 mb-1">
          <BookText className="w-7 h-7 flex-shrink-0" style={{ color: "var(--skyshare-gold)", opacity: 0.75 }} />
          <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
            Canned Corrective Actions
          </h1>
        </div>
        <p className="text-white/40 text-sm">Pre-written corrective action text by aircraft model and ref code</p>
      </div>
      <div className="stripe-divider" />

      {/* Info banner */}
      <div className="px-8 pt-5 pb-1">
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.18)" }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "rgba(212,160,23,0.7)" }} />
          <p className="text-xs leading-relaxed" style={{ color: "rgba(212,160,23,0.65)" }}>
            Entries are matched by <strong>Aircraft Model</strong> and <strong>Ref / Task Code</strong> — both must match exactly.
            Text is written into the Corrective Action field of each matched work order item at WO creation.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-5 flex flex-col gap-4">

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search model, ref code, or text…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg text-white placeholder:text-white/25 focus:outline-none"
              style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,22%)" }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <span className="text-white/25 text-xs font-mono ml-auto">{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</span>
          <button
            onClick={() => { setAdding(a => !a); setEditingId(null) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: adding ? "rgba(212,160,23,0.18)" : "hsl(0,0%,17%)",
              border:     adding ? "1px solid rgba(212,160,23,0.45)" : "1px solid hsl(0,0%,26%)",
              color:      adding ? "var(--skyshare-gold)" : "rgba(255,255,255,0.6)",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Entry
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(212,160,23,0.3)" }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(212,160,23,0.1)", borderBottom: "1px solid rgba(212,160,23,0.2)" }}>
              <Plus className="w-3.5 h-3.5" style={{ color: "var(--skyshare-gold)" }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--skyshare-gold)", opacity: 0.8 }}>New Canned Corrective Action</span>
            </div>
            <InlineEditForm
              form={addForm}
              setForm={setAddForm}
              onSave={handleAdd}
              onCancel={() => { setAdding(false); setAddForm(EMPTY_FORM) }}
              saving={addSaving}
            />
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-white/30">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <BookText className="w-10 h-10 text-white/10" />
            <p className="text-white/30 text-sm">{query ? "No entries match your search" : "No canned actions in library yet"}</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,18%)" }}>
            {/* Column header */}
            <div
              className="grid text-[10px] font-semibold uppercase tracking-widest text-white/30 px-4 py-2.5"
              style={{ gridTemplateColumns: "180px 200px 1fr 80px", background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,18%)" }}
            >
              <span>Aircraft Model</span>
              <span>Ref / Task Code</span>
              <span>Corrective Action Text</span>
              <span className="text-center">Actions</span>
            </div>

            {filtered.map((row, idx) => (
              <div key={row.id}>
                {/* Data row */}
                <div
                  className="grid items-start px-4 py-3 gap-3"
                  style={{
                    gridTemplateColumns: "180px 200px 1fr 80px",
                    background: editingId === row.id
                      ? "hsl(0,0%,13%)"
                      : idx % 2 === 0 ? "hsl(0,0%,11%)" : "hsl(0,0%,10.5%)",
                    borderTop: idx > 0 ? "1px solid hsl(0,0%,15%)" : undefined,
                    transition: "background 0.15s",
                  }}
                >
                  <span className="text-sm text-white/85 truncate pt-0.5">{row.aircraftModel}</span>
                  <span className="text-xs font-mono text-white/55 truncate pt-0.5">{row.refCode}</span>
                  <span className="text-xs text-white/60 leading-relaxed line-clamp-3">{row.correctiveActionText}</span>

                  {/* Actions — always visible */}
                  <div className="flex items-start gap-1.5 justify-end pt-0.5">
                    <button
                      onClick={() => editingId === row.id ? cancelEdit() : startEdit(row)}
                      title={editingId === row.id ? "Cancel edit" : "Edit this entry"}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0"
                      style={editingId === row.id ? {
                        background: "rgba(212,160,23,0.18)",
                        border: "1px solid rgba(212,160,23,0.45)",
                        color: "var(--skyshare-gold)",
                      } : {
                        background: "hsl(0,0%,16%)",
                        border: "1px solid hsl(0,0%,26%)",
                        color: "rgba(255,255,255,0.55)",
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={deletingId === row.id}
                      title="Delete this entry"
                      className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-white/30 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-40 flex-shrink-0"
                    >
                      {deletingId === row.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                </div>

                {/* Inline edit form — expands below the row */}
                {editingId === row.id && (
                  <InlineEditForm
                    form={editForm}
                    setForm={setEditForm}
                    onSave={handleEditSave}
                    onCancel={cancelEdit}
                    saving={editSaving}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
