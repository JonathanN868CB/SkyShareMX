import { useState, useEffect } from "react"
import { Plus, Trash2, Library, Zap, BookText, Search, X, Check, AlertTriangle, Loader2 } from "lucide-react"
import {
  getFlatRates, getCorrectiveActions,
  upsertFlatRate, upsertCorrectiveAction,
  deleteFlatRate, deleteCorrectiveAction,
} from "../../services"
import type { LibFlatRate, LibCorrectiveAction } from "../../services/library"
import { cn } from "@/shared/lib/utils"

// ─── Sub-tab type ─────────────────────────────────────────────────────────────
type Tab = "flat-rates" | "canned-actions"

// ─── Shared empty state ───────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Library className="w-10 h-10 text-white/10" />
      <p className="text-white/30 text-sm">{label}</p>
    </div>
  )
}

// ─── Flat Rates tab ───────────────────────────────────────────────────────────
function FlatRatesTab() {
  const [rows, setRows]         = useState<LibFlatRate[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState("")
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    aircraftModel: "", refCode: "", hours: "", laborRate: "125", description: "",
  })

  useEffect(() => {
    getFlatRates().then(setRows).finally(() => setLoading(false))
  }, [])

  const filtered = rows.filter(r => {
    const q = query.toLowerCase()
    return !q || r.aircraftModel.toLowerCase().includes(q) || r.refCode.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q)
  })

  async function handleSave() {
    if (!form.aircraftModel.trim() || !form.refCode.trim() || !form.hours) return
    setSaving(true)
    try {
      await upsertFlatRate({
        aircraftModel:  form.aircraftModel.trim(),
        refCode:        form.refCode.trim(),
        hours:          Number(form.hours),
        laborRate:      Number(form.laborRate) || 125,
        description:    form.description.trim() || null,
        createdByName:  "Manager",
      })
      const updated = await getFlatRates()
      setRows(updated)
      setAdding(false)
      setForm({ aircraftModel: "", refCode: "", hours: "", laborRate: "125", description: "" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteFlatRate(id)
      setRows(r => r.filter(x => x.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-white/30">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search model or ref code…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
            style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,22%)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-white/25 text-xs font-mono ml-auto">{filtered.length} entries</span>
        <button
          onClick={() => setAdding(a => !a)}
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
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: "hsl(0,0%,12%)", border: "1px solid rgba(212,160,23,0.25)" }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }}>
            New Flat Rate Entry
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 uppercase tracking-widest">Aircraft Model *</label>
              <input
                value={form.aircraftModel}
                onChange={e => setForm(f => ({ ...f, aircraftModel: e.target.value }))}
                placeholder="e.g. Citation CJ2 (525A)"
                className="px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none"
                style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,26%)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 uppercase tracking-widest">Ref / Task Code *</label>
              <input
                value={form.refCode}
                onChange={e => setForm(f => ({ ...f, refCode: e.target.value }))}
                placeholder="e.g. ATA 34 — 34-11-00"
                className="px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none font-mono"
                style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,26%)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 uppercase tracking-widest">Hours *</label>
              <input
                value={form.hours}
                onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                type="number" min="0" step="0.5"
                placeholder="e.g. 1.5"
                className="px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none font-mono"
                style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,26%)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 uppercase tracking-widest">Labor Rate ($/hr)</label>
              <input
                value={form.laborRate}
                onChange={e => setForm(f => ({ ...f, laborRate: e.target.value }))}
                type="number" min="0" step="5"
                className="px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none font-mono"
                style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,26%)" }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Description (optional)</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short note about this task…"
              className="px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none"
              style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,26%)" }}
            />
          </div>
          <div className="flex items-center gap-2 justify-end pt-1">
            <button
              onClick={() => { setAdding(false); setForm({ aircraftModel: "", refCode: "", hours: "", laborRate: "125", description: "" }) }}
              className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 transition-colors"
              style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,22%)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.aircraftModel.trim() || !form.refCode.trim() || !form.hours}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: "rgba(212,160,23,0.85)", color: "#000" }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState label={query ? "No entries match your search" : "No flat rates in library yet"} />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,18%)" }}>
          {/* Header */}
          <div
            className="grid text-[10px] font-semibold uppercase tracking-widest text-white/30 px-4 py-2"
            style={{ gridTemplateColumns: "1fr 1fr 80px 80px 1fr 32px", background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,18%)" }}
          >
            <span>Aircraft Model</span>
            <span>Ref / Task Code</span>
            <span>Hours</span>
            <span>Rate</span>
            <span>Description</span>
            <span />
          </div>
          {filtered.map((row, idx) => (
            <div
              key={row.id}
              className="grid items-center px-4 py-3 gap-3 group"
              style={{
                gridTemplateColumns: "1fr 1fr 80px 80px 1fr 32px",
                background: idx % 2 === 0 ? "hsl(0,0%,11%)" : "hsl(0,0%,10.5%)",
                borderTop: idx > 0 ? "1px solid hsl(0,0%,15%)" : undefined,
              }}
            >
              <span className="text-sm text-white/80 truncate">{row.aircraftModel}</span>
              <span className="text-xs font-mono text-white/55 truncate">{row.refCode}</span>
              <span className="text-sm font-mono text-white/80">{row.hours.toFixed(1)} hr</span>
              <span className="text-sm font-mono text-white/55">${row.laborRate}/hr</span>
              <span className="text-xs text-white/35 truncate">{row.description ?? "—"}</span>
              <button
                onClick={() => handleDelete(row.id)}
                disabled={deletingId === row.id}
                className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all text-white/25 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-40"
              >
                {deletingId === row.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Canned Actions tab ───────────────────────────────────────────────────────
function CannedActionsTab() {
  const [rows, setRows]         = useState<LibCorrectiveAction[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState("")
  const [adding, setAdding]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({ aircraftModel: "", refCode: "", correctiveActionText: "" })

  useEffect(() => {
    getCorrectiveActions().then(setRows).finally(() => setLoading(false))
  }, [])

  const filtered = rows.filter(r => {
    const q = query.toLowerCase()
    return !q || r.aircraftModel.toLowerCase().includes(q) || r.refCode.toLowerCase().includes(q) || r.correctiveActionText.toLowerCase().includes(q)
  })

  async function handleSave() {
    if (!form.aircraftModel.trim() || !form.refCode.trim() || !form.correctiveActionText.trim()) return
    setSaving(true)
    try {
      await upsertCorrectiveAction({
        aircraftModel:        form.aircraftModel.trim(),
        refCode:              form.refCode.trim(),
        correctiveActionText: form.correctiveActionText.trim(),
        createdByName:        "Manager",
      })
      const updated = await getCorrectiveActions()
      setRows(updated)
      setAdding(false)
      setForm({ aircraftModel: "", refCode: "", correctiveActionText: "" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteCorrectiveAction(id)
      setRows(r => r.filter(x => x.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-white/30">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search model, ref code, or text…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
            style={{ background: "hsl(0,0%,14%)", border: "1px solid hsl(0,0%,22%)" }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-white/25 text-xs font-mono ml-auto">{filtered.length} entries</span>
        <button
          onClick={() => setAdding(a => !a)}
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
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: "hsl(0,0%,12%)", border: "1px solid rgba(212,160,23,0.25)" }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--skyshare-gold)", opacity: 0.7 }}>
            New Canned Corrective Action
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 uppercase tracking-widest">Aircraft Model *</label>
              <input
                value={form.aircraftModel}
                onChange={e => setForm(f => ({ ...f, aircraftModel: e.target.value }))}
                placeholder="e.g. Citation CJ2 (525A)"
                className="px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none"
                style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,26%)" }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white/40 uppercase tracking-widest">Ref / Task Code *</label>
              <input
                value={form.refCode}
                onChange={e => setForm(f => ({ ...f, refCode: e.target.value }))}
                placeholder="e.g. ATA 34 — 34-11-00"
                className="px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none font-mono"
                style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,26%)" }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Corrective Action Text *</label>
            <textarea
              value={form.correctiveActionText}
              onChange={e => setForm(f => ({ ...f, correctiveActionText: e.target.value }))}
              rows={4}
              placeholder="Performed inspection per AMM 34-11-00 section 1.A. Replaced…"
              className="px-3 py-2 text-sm rounded-lg text-white placeholder:text-white/20 focus:outline-none resize-none"
              style={{ background: "hsl(0,0%,16%)", border: "1px solid hsl(0,0%,26%)" }}
            />
          </div>
          <div className="flex items-center gap-2 justify-end pt-1">
            <button
              onClick={() => { setAdding(false); setForm({ aircraftModel: "", refCode: "", correctiveActionText: "" }) }}
              className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 transition-colors"
              style={{ background: "hsl(0,0%,15%)", border: "1px solid hsl(0,0%,22%)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.aircraftModel.trim() || !form.refCode.trim() || !form.correctiveActionText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: "rgba(212,160,23,0.85)", color: "#000" }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState label={query ? "No entries match your search" : "No canned actions in library yet"} />
      ) : (
        <div className="flex flex-col gap-0 rounded-xl overflow-hidden" style={{ border: "1px solid hsl(0,0%,18%)" }}>
          {/* Header */}
          <div
            className="grid text-[10px] font-semibold uppercase tracking-widest text-white/30 px-4 py-2"
            style={{ gridTemplateColumns: "160px 180px 1fr 32px", background: "hsl(0,0%,10%)", borderBottom: "1px solid hsl(0,0%,18%)" }}
          >
            <span>Aircraft Model</span>
            <span>Ref / Task Code</span>
            <span>Corrective Action Text</span>
            <span />
          </div>
          {filtered.map((row, idx) => (
            <div
              key={row.id}
              className="grid items-start px-4 py-3 gap-3 group"
              style={{
                gridTemplateColumns: "160px 180px 1fr 32px",
                background: idx % 2 === 0 ? "hsl(0,0%,11%)" : "hsl(0,0%,10.5%)",
                borderTop: idx > 0 ? "1px solid hsl(0,0%,15%)" : undefined,
              }}
            >
              <span className="text-sm text-white/80 truncate pt-0.5">{row.aircraftModel}</span>
              <span className="text-xs font-mono text-white/55 truncate pt-0.5">{row.refCode}</span>
              <span className="text-xs text-white/60 leading-relaxed line-clamp-3">{row.correctiveActionText}</span>
              <button
                onClick={() => handleDelete(row.id)}
                disabled={deletingId === row.id}
                className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-all text-white/25 hover:text-red-400 hover:bg-red-900/20 disabled:opacity-40 mt-0.5"
              >
                {deletingId === row.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ManagersDashboard() {
  const [tab, setTab] = useState<Tab>("flat-rates")

  const tabs: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
    { id: "flat-rates",     label: "Flat Rates",              icon: Zap,      desc: "Pre-set labor hours and rates by aircraft model and ref code" },
    { id: "canned-actions", label: "Canned Corrective Actions", icon: BookText, desc: "Pre-written corrective action text by aircraft model and ref code" },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(0,0%,12%)" }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="hero-area px-8 pt-14 pb-7">
        <div className="flex items-center gap-3 mb-1">
          <Library className="w-7 h-7" style={{ color: "var(--skyshare-gold)", opacity: 0.75 }} />
          <h1 className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
            Managers
          </h1>
        </div>
        <p className="text-white/40 text-sm">MX library management — flat rates and canned corrective actions</p>
      </div>
      <div className="stripe-divider" />

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-end gap-1 px-8 pt-5 pb-0"
        style={{ borderBottom: "1px solid hsl(0,0%,18%)" }}
      >
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px",
                active
                  ? "text-white border-[var(--skyshare-gold)]"
                  : "text-white/35 border-transparent hover:text-white/60"
              )}
              style={active ? { background: "rgba(212,160,23,0.06)" } : {}}
            >
              <Icon className="w-4 h-4" style={active ? { color: "var(--skyshare-gold)" } : {}} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab description ──────────────────────────────────────────────────── */}
      <div className="px-8 pt-4 pb-1">
        <p className="text-white/30 text-xs">{tabs.find(t => t.id === tab)?.desc}</p>
        <div
          className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg"
          style={{ background: "rgba(212,160,23,0.06)", border: "1px solid rgba(212,160,23,0.18)" }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "rgba(212,160,23,0.7)" }} />
          <p className="text-xs leading-relaxed" style={{ color: "rgba(212,160,23,0.65)" }}>
            Entries are matched by <strong>Aircraft Model</strong> and <strong>Ref / Task Code</strong> — both must match exactly when applying to a work order.
            If an aircraft model or code is not in this library, the row will show "Not Found" during WO creation.
          </p>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-8 py-6">
        {tab === "flat-rates"     && <FlatRatesTab />}
        {tab === "canned-actions" && <CannedActionsTab />}
      </div>

    </div>
  )
}
