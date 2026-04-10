import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Search, ShoppingCart, Archive, Trash2, RotateCcw, AlertTriangle, ArchiveX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/shared/ui/button"
import { getPurchaseOrders, archivePO, restorePO, deletePO } from "../../services/purchaseOrders"
import type { PurchaseOrder } from "../../types"
import { POStatusBadge } from "../../shared/StatusBadge"
import { cn } from "@/shared/lib/utils"

// ─── Delete confirmation dialog ─────────────────────────────────────────────

function DeleteConfirmDialog({
  po,
  onConfirm,
  onCancel,
}: {
  po: PurchaseOrder
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="rounded-xl w-full max-w-sm p-6 space-y-4" style={{ background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 22%)" }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-900/30 border border-red-800/40">
            <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm mb-1">Delete {po.poNumber}?</h3>
            <p className="text-white/50 text-xs leading-relaxed">
              This permanently deletes the PO and all associated lines, receiving records, invoices, and activity. This cannot be undone.
            </p>
            <p className="text-white/35 text-xs mt-2">
              Consider archiving instead if you may need this record later.
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded-md text-xs font-medium text-white/60 hover:text-white transition-colors border border-white/10 hover:border-white/20 bg-white/[0.04] hover:bg-white/[0.08]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-2 rounded-md text-xs font-semibold text-white transition-colors bg-red-900/40 border border-red-800/50 hover:bg-red-900/70 hover:border-red-700/60"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Row action menu ─────────────────────────────────────────────────────────

function RowActions({
  po,
  showArchived,
  onArchive,
  onRestore,
  onDelete,
}: {
  po: PurchaseOrder
  showArchived: boolean
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen(o => !o)
  }

  return (
    <div onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 w-7 h-7 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.08] border border-transparent hover:border-white/10 transition-all text-lg leading-none"
        title="Actions"
      >
        ···
      </button>
      {open && (
        <div
          ref={menuRef}
          className="rounded-lg py-1 min-w-[160px] shadow-xl"
          style={{
            position: "fixed",
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 50,
            background: "hsl(0 0% 13%)",
            border: "1px solid hsl(0 0% 24%)",
          }}
        >
          {showArchived ? (
            <button
              onClick={() => { setOpen(false); onRestore() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400/70" /> Restore to active
            </button>
          ) : (
            <button
              onClick={() => { setOpen(false); onArchive() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Archive className="w-3.5 h-3.5 text-white/40" /> Archive
            </button>
          )}
          <div style={{ borderTop: "1px solid hsl(0 0% 20%)" }} className="my-1" />
          <button
            onClick={() => { setOpen(false); onDelete() }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400/80 hover:text-red-300 hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete permanently
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function PODashboard() {
  const navigate = useNavigate()
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null)
  const [actioning, setActioning] = useState<string | null>(null) // PO id being acted on

  async function load(archived: boolean) {
    setLoading(true)
    try {
      const data = await getPurchaseOrders({ showArchived: archived })
      setPos(data)
    } catch (err) {
      console.error("Failed to load purchase orders:", err)
      toast.error("Failed to load purchase orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(showArchived) }, [showArchived])

  const filtered = useMemo(() => {
    if (!search.trim()) return pos
    const q = search.toLowerCase()
    return pos.filter(p =>
      p.poNumber.toLowerCase().includes(q) ||
      p.vendorName.toLowerCase().includes(q)
    )
  }, [pos, search])

  const draft    = pos.filter(p => p.status === "draft").length
  const open     = pos.filter(p => p.status === "sent" || p.status === "partial").length
  const received = pos.filter(p => p.status === "received").length
  const totalValue = pos.reduce((s, p) => s + p.lines.reduce((ls, l) => ls + l.qtyOrdered * l.unitCost, 0), 0)

  async function handleArchive(po: PurchaseOrder) {
    setActioning(po.id)
    try {
      await archivePO(po.id)
      setPos(prev => prev.filter(p => p.id !== po.id))
      toast.success(`${po.poNumber} archived`)
    } catch {
      toast.error("Failed to archive PO")
    } finally {
      setActioning(null)
    }
  }

  async function handleRestore(po: PurchaseOrder) {
    setActioning(po.id)
    try {
      await restorePO(po.id)
      setPos(prev => prev.filter(p => p.id !== po.id))
      toast.success(`${po.poNumber} restored to active`)
    } catch {
      toast.error("Failed to restore PO")
    } finally {
      setActioning(null)
    }
  }

  async function handleDelete(po: PurchaseOrder) {
    setActioning(po.id)
    setDeleteTarget(null)
    try {
      await deletePO(po.id)
      setPos(prev => prev.filter(p => p.id !== po.id))
      toast.success(`${po.poNumber} deleted`)
    } catch {
      toast.error("Failed to delete PO")
    } finally {
      setActioning(null)
    }
  }

  return (
    <div className="min-h-screen">
      {deleteTarget && (
        <DeleteConfirmDialog
          po={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="hero-area px-8 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white mb-1" style={{ fontFamily: "var(--font-display)", fontSize: "28px", letterSpacing: "0.05em" }}>
              Purchase Orders
            </h1>
            <p className="text-white/45 text-sm">
              {loading ? "Loading..." : `${pos.length} ${showArchived ? "archived" : "active"} purchase order${pos.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                showArchived
                  ? "bg-amber-900/20 border-amber-800/40 text-amber-400 hover:bg-amber-900/35"
                  : "bg-white/[0.05] border-white/10 text-white/45 hover:bg-white/[0.09] hover:text-white/70 hover:border-white/20"
              )}
            >
              {showArchived
                ? <><ArchiveX className="w-3.5 h-3.5" /> Show Active</>
                : <><Archive className="w-3.5 h-3.5" /> Archived</>
              }
            </button>
            {!showArchived && (
              <Button
                size="sm"
                onClick={() => navigate("/app/beet-box/purchase-orders/new")}
                style={{ background: "var(--skyshare-gold)", color: "#000" }}
                className="font-semibold text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New PO
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="stripe-divider" />

      <div className="px-8 py-6 space-y-6">

        {/* Stats — only meaningful for active POs */}
        {!showArchived && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Draft",          value: draft,    color: "text-zinc-400"    },
              { label: "Open / Partial", value: open,     color: "text-blue-400"    },
              { label: "Received",       value: received, color: "text-emerald-400" },
              { label: "Total Value",    value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-white" },
            ].map(s => (
              <div key={s.label} className="card-elevated rounded-lg p-4">
                <p className="text-white/40 text-xs tracking-wide uppercase mb-1" style={{ fontFamily: "var(--font-heading)" }}>{s.label}</p>
                <p className={`text-3xl font-bold ${s.color}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Archived banner */}
        {showArchived && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <Archive className="w-4 h-4 text-amber-400/70 flex-shrink-0" />
            <p className="text-amber-300/70 text-xs">
              Archived POs are hidden from the active list. You can restore any PO to bring it back, or delete it permanently.
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={showArchived ? "Search archived POs..." : "Search by PO number or vendor..."}
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white/85 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
          />
        </div>

        {/* PO table */}
        <div className="card-elevated rounded-lg overflow-hidden">
          {loading ? (
            <div className="px-4 py-16 text-center text-white/30 text-sm">Loading purchase orders...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid hsl(0 0% 20%)" }}>
                  {["PO #", "Vendor", "Lines", "Total", "Status", "Created", showArchived ? "Archived" : "Expected", ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-white/35 text-xs uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((po, idx) => {
                  const totalCost = po.lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0)
                  const isActioning = actioning === po.id
                  return (
                    <tr
                      key={po.id}
                      onClick={() => !showArchived && navigate(`/app/beet-box/purchase-orders/${po.id}`)}
                      className={cn(
                        "group/row transition-colors",
                        showArchived ? "cursor-default opacity-80" : "cursor-pointer hover:bg-white/[0.04]",
                        isActioning && "opacity-40 pointer-events-none"
                      )}
                      style={{ borderBottom: idx < filtered.length - 1 ? "1px solid hsl(0 0% 16%)" : "none" }}
                    >
                      <td className="px-4 py-3 font-mono text-white/70 text-xs font-semibold">{po.poNumber}</td>
                      <td className="px-4 py-3 text-white/80 text-sm">{po.vendorName}</td>
                      <td className="px-4 py-3 text-white/60 text-sm">{po.lines.length}</td>
                      <td className="px-4 py-3 text-white/65 text-sm">${totalCost.toFixed(2)}</td>
                      <td className="px-4 py-3"><POStatusBadge status={po.status} /></td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {new Date(po.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {showArchived
                          ? po.archivedAt
                            ? new Date(po.archivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : <span className="text-white/20">—</span>
                          : po.expectedDelivery
                            ? new Date(po.expectedDelivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : <span className="text-white/20">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 w-10">
                        <RowActions
                          po={po}
                          showArchived={showArchived}
                          onArchive={() => handleArchive(po)}
                          onRestore={() => handleRestore(po)}
                          onDelete={() => setDeleteTarget(po)}
                        />
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      {showArchived
                        ? <><Archive className="w-10 h-10 text-white/10 mx-auto mb-3" /><p className="text-white/25 text-sm">No archived purchase orders.</p></>
                        : <><ShoppingCart className="w-10 h-10 text-white/10 mx-auto mb-3" /><p className="text-white/25 text-sm">{pos.length === 0 ? "No purchase orders yet." : "No POs match your search."}</p></>
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
