import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft, AlertTriangle, Package, Link2, Truck, ClipboardList,
  Pencil, Check, X, Plus, Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { getCatalogEntryById, updateCatalogEntry, removeCatalogVendor, removeRelationship } from "../../services/catalog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select"
import type { CatalogEntry, PartClassification } from "../../types"
import { cn } from "@/shared/lib/utils"

const TYPE_LABELS: Record<string, string> = {
  oem: "OEM", pma: "PMA", tso: "TSO",
  standard_hardware: "Std Hardware", consumable: "Consumable", raw_material: "Raw Material",
}

const TYPE_COLORS: Record<string, string> = {
  oem: "bg-blue-900/30 text-blue-400 border border-blue-800/40",
  pma: "bg-purple-900/30 text-purple-400 border border-purple-800/40",
  tso: "bg-emerald-900/30 text-emerald-400 border border-emerald-800/40",
  standard_hardware: "bg-amber-900/30 text-amber-400 border border-amber-800/40",
  consumable: "bg-slate-800/30 text-slate-400 border border-slate-700/40",
  raw_material: "bg-orange-900/30 text-orange-400 border border-orange-800/40",
}

const PART_TYPES: { value: PartClassification; label: string }[] = [
  { value: "oem", label: "OEM" }, { value: "pma", label: "PMA" }, { value: "tso", label: "TSO" },
  { value: "standard_hardware", label: "Standard Hardware" },
  { value: "consumable", label: "Consumable" }, { value: "raw_material", label: "Raw Material" },
]

export default function CatalogDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<CatalogEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  // Edit form state
  const [editDesc, setEditDesc] = useState("")
  const [editAta, setEditAta] = useState("")
  const [editType, setEditType] = useState<PartClassification | "">("")
  const [editMfg, setEditMfg] = useState("")
  const [editSerialized, setEditSerialized] = useState(false)
  const [editShelfLife, setEditShelfLife] = useState(false)
  const [editRotable, setEditRotable] = useState(false)
  const [editNotes, setEditNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    setLoading(true)
    try {
      const data = await getCatalogEntryById(id!)
      setEntry(data)
      if (data) populateEditForm(data)
    } catch (err) {
      console.error("Failed to load catalog entry:", err)
    } finally {
      setLoading(false)
    }
  }

  function populateEditForm(e: CatalogEntry) {
    setEditDesc(e.description ?? "")
    setEditAta(e.ataChapter ?? "")
    setEditType((e.partType ?? "") as PartClassification | "")
    setEditMfg(e.manufacturer ?? "")
    setEditSerialized(e.isSerialized)
    setEditShelfLife(e.isShelfLife)
    setEditRotable(e.isRotable)
    setEditNotes(e.notes ?? "")
  }

  async function handleSave() {
    if (!entry) return
    setSaving(true)
    try {
      await updateCatalogEntry(entry.id, {
        description: editDesc.trim() || null,
        ataChapter: editAta.trim() || null,
        partType: editType || null,
        manufacturer: editMfg.trim() || null,
        isSerialized: editSerialized,
        isShelfLife: editShelfLife,
        isRotable: editRotable,
        notes: editNotes.trim() || null,
      })
      toast.success("Catalog entry updated")
      setEditing(false)
      load()
    } catch (err: unknown) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveVendor(vendorLinkId: string) {
    try {
      await removeCatalogVendor(vendorLinkId)
      toast.success("Vendor unlinked")
      load()
    } catch (err: unknown) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  async function handleRemoveRelationship(relId: string) {
    try {
      await removeRelationship(relId)
      toast.success("Relationship removed")
      load()
    } catch (err: unknown) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.9)",
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 text-sm">Catalog entry not found.</p>
        <button
          onClick={() => navigate("/app/beet-box/catalog")}
          className="text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          Back to Catalog
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="hero-area px-8 py-7">
        <button
          onClick={() => navigate("/app/beet-box/catalog")}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Catalog
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-white font-mono mb-1"
              style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.04em" }}
            >
              {entry.partNumber}
            </h1>
            <p className="text-white/50 text-sm">{entry.description || "No description"}</p>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setEditing(false); populateEditForm(entry) }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ background: "var(--skyshare-gold)", color: "#111" }}
                >
                  <Check className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* ── Info Card ──────────────────────────────────────────────────── */}
        <div className="card-elevated rounded-lg p-5 space-y-4">
          <h3
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
          >
            Part Information
          </h3>

          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1 text-white/50">Description</label>
                <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1 text-white/50">ATA Chapter</label>
                <input value={editAta} onChange={e => setEditAta(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1 text-white/50">Part Type</label>
                <Select value={editType} onValueChange={v => setEditType(v as PartClassification)}>
                  <SelectTrigger className="w-full rounded-md px-3 py-2 text-sm h-auto" style={inputStyle}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PART_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs mb-1 text-white/50">Manufacturer</label>
                <input value={editMfg} onChange={e => setEditMfg(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm" style={inputStyle} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs mb-1 text-white/50">Notes</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="w-full rounded-md px-3 py-2 text-sm resize-none" style={inputStyle} />
              </div>
              <div className="col-span-2 flex gap-5">
                {[
                  { label: "Serialized", value: editSerialized, set: setEditSerialized },
                  { label: "Shelf Life", value: editShelfLife, set: setEditShelfLife },
                  { label: "Rotable", value: editRotable, set: setEditRotable },
                ].map(f => (
                  <label key={f.label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={f.value} onChange={e => f.set(e.target.checked)} className="rounded border-white/20" />
                    <span className="text-xs text-white/60">{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-8 gap-y-3">
              <InfoField label="ATA Chapter" value={entry.ataChapter} />
              <InfoField label="Part Type">
                {entry.partType ? (
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide", TYPE_COLORS[entry.partType] ?? "")}>
                    {TYPE_LABELS[entry.partType] ?? entry.partType}
                  </span>
                ) : (
                  <span className="text-white/25">—</span>
                )}
              </InfoField>
              <InfoField label="Manufacturer" value={entry.manufacturer} />
              <InfoField label="Unit of Measure" value={entry.unitOfMeasure} />
              <InfoField label="On Hand (total)" value={String(entry.inventoryOnHand ?? 0)} />
              <InfoField label="Flags">
                <div className="flex gap-2">
                  {entry.isSerialized && <FlagBadge label="Serialized" />}
                  {entry.isShelfLife && <FlagBadge label="Shelf Life" />}
                  {entry.isRotable && <FlagBadge label="Rotable" />}
                  {!entry.isSerialized && !entry.isShelfLife && !entry.isRotable && (
                    <span className="text-white/25 text-xs">None</span>
                  )}
                </div>
              </InfoField>
              {entry.notes && (
                <div className="col-span-3">
                  <InfoField label="Notes" value={entry.notes} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Preferred Vendors ───────────────────────────────────────────── */}
        <div className="card-elevated rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-xs font-semibold tracking-widest uppercase flex items-center gap-2"
              style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
            >
              <Truck className="w-3.5 h-3.5" />
              Preferred Vendors
            </h3>
          </div>

          {(!entry.vendors || entry.vendors.length === 0) ? (
            <p className="text-white/25 text-sm py-4 text-center">No vendors linked yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                  {["Vendor", "Lead Time", "Last Cost", "Preferred", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.vendors.map((v, idx) => (
                  <tr key={v.id} style={{ borderBottom: idx < entry.vendors!.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}>
                    <td className="px-3 py-2.5 text-white/80">{v.vendorName}</td>
                    <td className="px-3 py-2.5 text-white/50">{v.leadTimeDays ? `${v.leadTimeDays} days` : "—"}</td>
                    <td className="px-3 py-2.5 text-white/50">{v.lastUnitCost ? `$${Number(v.lastUnitCost).toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-2.5">
                      {v.isPreferred && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 uppercase tracking-wide">
                          Preferred
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleRemoveVendor(v.id)}
                        className="text-white/20 hover:text-red-400 transition-colors"
                        title="Unlink vendor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Related Parts ───────────────────────────────────────────────── */}
        <div className="card-elevated rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-xs font-semibold tracking-widest uppercase flex items-center gap-2"
              style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
            >
              <Link2 className="w-3.5 h-3.5" />
              Related Parts
            </h3>
          </div>

          {(!entry.relationships || entry.relationships.length === 0) ? (
            <p className="text-white/25 text-sm py-4 text-center">No related parts.</p>
          ) : (
            <div className="space-y-2">
              {entry.relationships.map(rel => (
                <div
                  key={rel.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-md"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide bg-white/5 text-white/40 border border-white/10"
                    >
                      {rel.relationshipType === "supersedes"
                        ? (rel.direction === "outgoing" ? "Supersedes" : "Superseded by")
                        : "Interchanges with"}
                    </span>
                    <button
                      onClick={() => navigate(`/app/beet-box/catalog/${rel.relatedPartId}`)}
                      className="font-mono text-sm text-white/80 hover:text-white transition-colors"
                    >
                      {rel.relatedPartNumber}
                    </button>
                    {rel.relatedDescription && (
                      <span className="text-white/35 text-xs">{rel.relatedDescription}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveRelationship(rel.id)}
                    className="text-white/20 hover:text-red-400 transition-colors"
                    title="Remove relationship"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Inventory ───────────────────────────────────────────────────── */}
        <div className="card-elevated rounded-lg p-5 space-y-3">
          <h3
            className="text-xs font-semibold tracking-widest uppercase flex items-center gap-2"
            style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
          >
            <Package className="w-3.5 h-3.5" />
            Inventory
          </h3>
          <p className="text-white/25 text-sm py-4 text-center">
            {(entry.inventoryOnHand ?? 0) > 0
              ? `${entry.inventoryOnHand} on hand`
              : "No inventory records for this part."}
          </p>
        </div>

        {/* ── Request History ─────────────────────────────────────────────── */}
        <div className="card-elevated rounded-lg p-5 space-y-3">
          <h3
            className="text-xs font-semibold tracking-widest uppercase flex items-center gap-2"
            style={{ color: "var(--skyshare-gold)", opacity: 0.7, fontFamily: "var(--font-heading)" }}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Request History
          </h3>
          <RequestHistory catalogId={entry.id} />
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoField({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-white/35 text-[10px] uppercase tracking-widest mb-0.5" style={{ fontFamily: "var(--font-heading)" }}>
        {label}
      </p>
      {children ?? <p className="text-white/75 text-sm">{value || "—"}</p>}
    </div>
  )
}

function FlagBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 uppercase tracking-wide">
      {label}
    </span>
  )
}

function RequestHistory({ catalogId }: { catalogId: string }) {
  const navigate = useNavigate()
  const [lines, setLines] = useState<Array<{
    id: string; request_id: string; line_number: number; part_number: string
    quantity: number; line_status: string; created_at: string
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { supabase } = await import("@/lib/supabase")
      const { data } = await supabase
        .from("parts_request_lines")
        .select("id, request_id, line_number, part_number, quantity, line_status, created_at")
        .eq("catalog_id", catalogId)
        .order("created_at", { ascending: false })
        .limit(20)
      setLines(data ?? [])
      setLoading(false)
    }
    load()
  }, [catalogId])

  if (loading) return <p className="text-white/25 text-sm py-4 text-center">Loading...</p>
  if (lines.length === 0) return <p className="text-white/25 text-sm py-4 text-center">No requests for this part.</p>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
          {["Date", "Qty", "Status"].map(h => (
            <th key={h} className="px-3 py-2 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {lines.map((l, idx) => (
          <tr
            key={l.id}
            onClick={() => navigate(`/app/beet-box/parts/${l.request_id}`)}
            className="cursor-pointer hover:bg-white/[0.04] transition-colors"
            style={{ borderBottom: idx < lines.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
          >
            <td className="px-3 py-2.5 text-white/50 text-xs">
              {new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </td>
            <td className="px-3 py-2.5 text-white/70 font-mono">{l.quantity}</td>
            <td className="px-3 py-2.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 uppercase tracking-wide">
                {l.line_status.replace(/_/g, " ")}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
