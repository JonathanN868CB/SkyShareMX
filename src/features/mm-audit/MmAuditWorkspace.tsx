import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, CheckCircle2, ChevronRight, AlertTriangle, ExternalLink, History, Loader2, Filter, Link, Pencil, Save, X, Undo2 } from "lucide-react"
import { useAuth } from "@/features/auth"
import { useMmWorkspaceData, useStageRevisionChange, useRevertStagedRevision, useUpsertSourceDocument, type WorkspaceDocGroup, type WorkspaceItem } from "./useMmAuditData"
import MmBatchReviewDialog from "./MmBatchReviewDialog"
import MmAuditHistory from "./MmAuditHistory"
import type { AuditStatus } from "./types"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

const statusStyle: Record<AuditStatus, { bg: string; color: string; label: string }> = {
  current:       { bg: "rgba(16,185,129,0.1)",  color: "#10b981", label: "Current" },
  due_soon:      { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", label: "Due Soon" },
  overdue:       { bg: "rgba(239,68,68,0.1)",   color: "#f87171", label: "Overdue" },
  never_audited: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", label: "Never Audited" },
}

interface Props {
  campaignId: string | null
  campaignName: string
  onClose: () => void
}

export default function MmAuditWorkspace({ campaignId, campaignName, onClose }: Props) {
  const { profile } = useAuth()
  const canEdit = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"
  const isSuperAdmin = profile?.role === "Super Admin"
  const { data: groups, isLoading, refetch } = useMmWorkspaceData(campaignId)

  const [visible, setVisible] = useState(false)
  const [statusFilter, setStatusFilter] = useState<AuditStatus | "all">("all")
  const [familyFilter, setFamilyFilter] = useState<string>("all")
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [batchGroups, setBatchGroups] = useState<WorkspaceDocGroup[] | null>(null)
  const [historyItem, setHistoryItem] = useState<{ id: string; registration: string; docName: string } | null>(null)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    setTimeout(onClose, 220)
  }, [onClose])

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Filter groups
  const allFamilies = [...new Set((groups ?? []).flatMap(g => g.items.map(i => i.model_family)))]
  const filteredGroups = (groups ?? []).filter(g => {
    if (statusFilter !== "all") {
      const hasMatchingStatus = g.items.some(i => i.status === statusFilter)
      if (!hasMatchingStatus) return false
    }
    if (familyFilter !== "all") {
      const hasFamily = g.items.some(i => i.model_family === familyFilter)
      if (!hasFamily) return false
    }
    return true
  })

  // Summary stats
  const allItems = (groups ?? []).flatMap(g => g.items)
  const totalItems = allItems.length
  const reviewedItems = allItems.filter(i => i.status === "current").length
  const overdueItems = allItems.filter(i => i.status === "overdue").length
  const progressPct = totalItems > 0 ? Math.round((reviewedItems / totalItems) * 100) : 0

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
      {/* ── Sticky Header ──────────────────────────────────────────────── */}
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
            Audit Workspace{campaignName ? ` — ${campaignName}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          <span><strong style={{ color: "#10b981" }}>{reviewedItems}</strong> / {totalItems} reviewed ({progressPct}%)</span>
          {overdueItems > 0 && <span style={{ color: "#f87171" }}>{overdueItems} overdue</span>}
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-6 py-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${rgba(0.06)}`, background: rgba(0.02) }}
      >
        <Filter className="h-3.5 w-3.5" style={{ color: rgba(0.4) }} />

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as AuditStatus | "all")}
          className="rounded px-2 py-1 text-xs outline-none cursor-pointer"
          style={{ background: rgba(0.06), border: `1px solid ${rgba(0.12)}`, color: "rgba(255,255,255,0.7)" }}
        >
          <option value="all">All Statuses</option>
          <option value="never_audited">Never Audited</option>
          <option value="overdue">Overdue</option>
          <option value="due_soon">Due Soon</option>
          <option value="current">Current</option>
        </select>

        <select
          value={familyFilter}
          onChange={e => setFamilyFilter(e.target.value)}
          className="rounded px-2 py-1 text-xs outline-none cursor-pointer"
          style={{ background: rgba(0.06), border: `1px solid ${rgba(0.12)}`, color: "rgba(255,255,255,0.7)" }}
        >
          <option value="all">All Aircraft Types</option>
          {allFamilies.sort().map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: C }} />
            <span className="ml-2 text-xs" style={{ color: rgba(0.5) }}>Loading workspace…</span>
          </div>
        )}

        {!isLoading && filteredGroups.length === 0 && (
          <div className="text-center py-16 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            No matching items.
          </div>
        )}

        {!isLoading && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", alignItems: "start" }}>
            {filteredGroups.map(group => (
              <DocGroupCard
                key={group.source_document_id}
                group={group}
                campaignId={campaignId}
                expanded={expandedGroups.has(group.source_document_id)}
                onToggle={() => toggleGroup(group.source_document_id)}
                canEdit={canEdit}
                isSuperAdmin={isSuperAdmin}
                onBatchReview={() => setBatchGroups([group])}
                onShowHistory={(item) => setHistoryItem({ id: item.aircraft_document_id, registration: item.registration, docName: group.document_name })}
                onRevisionUpdated={refetch}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Batch Review Dialog ─────────────────────────────────────────── */}
      {batchGroups && (
        <MmBatchReviewDialog
          groups={batchGroups}
          campaignId={campaignId}
          onClose={() => setBatchGroups(null)}
          onSuccess={() => { setBatchGroups(null); refetch() }}
        />
      )}

      {/* ── History Drawer ──────────────────────────────────────────────── */}
      {historyItem && (
        <div
          className="fixed inset-0 flex items-center justify-end"
          style={{ zIndex: 60, background: "rgba(0,0,0,0.4)" }}
          onClick={() => setHistoryItem(null)}
        >
          <div
            className="h-full w-full max-w-md p-6 overflow-y-auto"
            style={{ background: "#1a1a2e", borderLeft: `1px solid ${rgba(0.15)}` }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setHistoryItem(null)}
              className="text-xs mb-4 transition-opacity hover:opacity-80"
              style={{ color: C }}
            >
              ← Close
            </button>
            <MmAuditHistory
              aircraftDocumentId={historyItem.id}
              registration={historyItem.registration}
              documentName={historyItem.docName}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Document Group Card ────────────────────────────────────────────────────

function DocGroupCard({
  group,
  campaignId,
  expanded,
  onToggle,
  canEdit,
  isSuperAdmin,
  onBatchReview,
  onShowHistory,
  onRevisionUpdated,
}: {
  group: WorkspaceDocGroup
  campaignId: string | null
  expanded: boolean
  onToggle: () => void
  canEdit: boolean
  isSuperAdmin: boolean
  onBatchReview: () => void
  onShowHistory: (item: WorkspaceItem) => void
  onRevisionUpdated: () => void
}) {
  const [editingRev, setEditingRev] = useState(false)
  const [newRev, setNewRev] = useState(group.current_revision)
  const [showRevConfirm, setShowRevConfirm] = useState(false)
  const [showRevertConfirm, setShowRevertConfirm] = useState(false)
  const [editingUrl, setEditingUrl] = useState(false)
  const [newUrl, setNewUrl] = useState(group.document_url ?? "")
  const stageMut   = useStageRevisionChange()
  const revertMut  = useRevertStagedRevision()
  const upsertMut  = useUpsertSourceDocument()

  function handleSaveUrl(e: React.MouseEvent) {
    e.stopPropagation()
    upsertMut.mutate(
      {
        id: group.source_document_id,
        document_number: group.document_number,
        document_name: group.document_name,
        document_url: newUrl.trim() || null,
        current_revision: group.current_revision,
        current_rev_date: group.current_rev_date,
      },
      {
        onSuccess: () => {
          setEditingUrl(false)
          onRevisionUpdated()
        },
      }
    )
  }

  const reviewedCount = group.items.filter(i => i.status === "current").length
  const totalCount = group.items.length
  const pendingCount = totalCount - reviewedCount
  const oldRev = group.current_revision // what it is right now in the DB

  const handleRevert = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!campaignId || !group.is_staged) return
    revertMut.mutate(
      { campaign_id: campaignId, source_document_id: group.source_document_id },
      {
        onSuccess: () => {
          setShowRevertConfirm(false)
          onRevisionUpdated()
        },
      }
    )
  }

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNewRev(group.current_revision)
    setEditingRev(true)
    setShowRevConfirm(false)
  }

  const handlePrepareRevChange = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    const trimmed = newRev.trim()
    if (!trimmed || trimmed === oldRev) {
      setEditingRev(false)
      return
    }
    // Show confirmation with diff
    setShowRevConfirm(true)
  }

  const handleConfirmRevChange = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!campaignId) return
    stageMut.mutate(
      {
        campaign_id: campaignId,
        source_document_id: group.source_document_id,
        old_revision: group.is_staged ? (group.previous_revision ?? oldRev) : oldRev,
        new_revision: newRev.trim(),
      },
      {
        onSuccess: () => {
          setEditingRev(false)
          setShowRevConfirm(false)
          onRevisionUpdated()
        },
      }
    )
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingRev(false)
    setShowRevConfirm(false)
    setNewRev(group.current_revision)
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${rgba(0.1)}` }}>
      {/* ── Group Header ──────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: rgba(0.03) }}
        onClick={onToggle}
        onMouseEnter={e => (e.currentTarget.style.background = rgba(0.06))}
        onMouseLeave={e => (e.currentTarget.style.background = rgba(0.03))}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronRight
            className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
            style={{ color: C, transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          <div className="min-w-0">
            <span className="text-xs font-semibold truncate block" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-heading)" }}>
              {group.document_name}
            </span>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                {group.document_number} · {totalCount} aircraft
              </span>
              {group.document_url ? (
                <a
                  href={group.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1 flex-shrink-0 transition-opacity hover:opacity-80"
                  style={{ color: C, fontSize: "10px", fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}
                >
                  <ExternalLink className="h-3 w-3" /> Open ↗
                </a>
              ) : canEdit ? (
                <button
                  onClick={e => { e.stopPropagation(); setNewUrl(""); setEditingUrl(true) }}
                  className="flex items-center gap-1 flex-shrink-0 transition-opacity hover:opacity-80"
                  style={{ color: rgba(0.45), fontSize: "10px", fontFamily: "var(--font-heading)", letterSpacing: "0.04em", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <Link className="h-3 w-3" /> Add URL
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {canEdit && !expanded && !editingRev && (
            <button
              onClick={e => { e.stopPropagation(); onToggle(); handleStartEdit(e) }}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
              style={{ background: rgba(0.08), border: `1px solid ${rgba(0.18)}`, color: C, fontFamily: "var(--font-heading)" }}
            >
              <Pencil className="h-3 w-3" /> Rev
            </button>
          )}
          {group.all_reviewed ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontFamily: "var(--font-heading)" }}
            >
              <CheckCircle2 className="h-3 w-3" />
              {group.has_revision_change
                ? `Updated Rev ${group.previous_revision} → ${group.current_revision}`
                : `No Changes — Rev ${group.current_revision}`
              }
            </span>
          ) : (
            <>
              {group.has_revision_change && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", color: "#f59e0b", fontFamily: "var(--font-heading)" }}>
                  <AlertTriangle className="h-3 w-3" />
                  Rev {group.previous_revision} → {group.current_revision}
                </span>
              )}
              <span className="text-[11px] font-bold" style={{ color: rgba(0.4) }}>
                {reviewedCount}/{totalCount}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Expanded Detail ───────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-3">

          {/* ── Current Revision Bar ─────────────────────────────────── */}
          <div
            className="flex items-center justify-between rounded-lg px-4 py-2.5"
            style={{ background: rgba(0.06), border: `1px solid ${rgba(0.12)}` }}
          >
            <div className="flex items-center gap-3">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}
              >
                Current Revision
              </span>

              {editingRev ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Rev {oldRev} →
                  </span>
                  <input
                    value={newRev}
                    onChange={e => { setNewRev(e.target.value); setShowRevConfirm(false) }}
                    className="rounded px-2 py-1 text-sm font-bold outline-none w-24"
                    style={{ background: rgba(0.1), border: `1px solid ${C}`, color: "#fff" }}
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handlePrepareRevChange(e); if (e.key === "Escape") handleCancelEdit(e as any) }}
                  />
                  {!showRevConfirm && (
                    <>
                      <button
                        onClick={handlePrepareRevChange}
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                        style={{ background: rgba(0.1), color: C, fontFamily: "var(--font-heading)" }}
                      >
                        Preview
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 rounded transition-opacity hover:opacity-80"
                        style={{ color: "rgba(255,255,255,0.4)" }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold" style={{ color: C }}>
                    Rev {group.current_revision}
                  </span>
                  {group.is_staged && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", fontFamily: "var(--font-heading)" }}
                    >
                      Staged
                    </span>
                  )}
                  {group.current_rev_date && (
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      ({group.current_rev_date})
                    </span>
                  )}
                  {canEdit && (
                    <button
                      onClick={handleStartEdit}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                      style={{ background: rgba(0.08), border: `1px solid ${rgba(0.15)}`, color: rgba(0.6), fontFamily: "var(--font-heading)" }}
                    >
                      <Pencil className="h-3 w-3" />
                      Update Rev
                    </button>
                  )}
                  {isSuperAdmin && group.is_staged && group.previous_revision && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowRevertConfirm(true) }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", color: "#f59e0b", fontFamily: "var(--font-heading)" }}
                    >
                      <Undo2 className="h-3 w-3" />
                      Revert to Rev {group.previous_revision}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Batch review button */}
            {canEdit && !group.all_reviewed && !editingRev && (
              <button
                onClick={(e) => { e.stopPropagation(); onBatchReview() }}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
                style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", fontFamily: "var(--font-heading)" }}
              >
                <CheckCircle2 className="h-3 w-3" />
                {group.has_revision_change
                  ? `Mark All · Rev ${group.previous_revision}→${group.current_revision} (${pendingCount})`
                  : `Mark All · No Changes (${pendingCount})`
                }
              </button>
            )}
          </div>

          {/* ── Document URL ─────────────────────────────────────────── */}
          {canEdit && (
            <div
              className="flex items-center justify-between rounded-lg px-4 py-2.5"
              style={{ background: rgba(0.04), border: `1px solid ${rgba(0.08)}` }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider flex-shrink-0"
                  style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
                  Document URL
                </span>
                {editingUrl ? (
                  <input
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder="https://..."
                    autoFocus
                    className="flex-1 rounded px-2 py-1 text-xs outline-none"
                    style={{ background: rgba(0.1), border: `1px solid ${C}`, color: "#fff", fontFamily: "'Courier Prime','Courier New',monospace", minWidth: 0 }}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveUrl(e as any); if (e.key === "Escape") setEditingUrl(false) }}
                  />
                ) : (
                  group.document_url ? (
                    <a href={group.document_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs truncate transition-opacity hover:opacity-80"
                      style={{ color: C, fontFamily: "'Courier Prime','Courier New',monospace" }}>
                      {group.document_url}
                    </a>
                  ) : (
                    <span className="text-xs italic" style={{ color: rgba(0.3) }}>No URL set</span>
                  )
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {editingUrl ? (
                  <>
                    <button
                      onClick={handleSaveUrl}
                      disabled={upsertMut.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                      style={{ background: rgba(0.15), color: C, fontFamily: "var(--font-heading)", border: `1px solid ${rgba(0.2)}` }}
                    >
                      <Save className="h-3 w-3" /> {upsertMut.isPending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditingUrl(false)} className="p-1 rounded transition-opacity hover:opacity-80" style={{ color: rgba(0.4) }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setNewUrl(group.document_url ?? ""); setEditingUrl(true) }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                    style={{ background: rgba(0.08), border: `1px solid ${rgba(0.15)}`, color: rgba(0.6), fontFamily: "var(--font-heading)" }}
                  >
                    <Link className="h-3 w-3" /> {group.document_url ? "Edit URL" : "Add URL"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Revision Change Confirmation ──────────────────────────── */}
          {showRevConfirm && newRev.trim() !== oldRev && (
            <div
              className="rounded-lg px-4 py-3 space-y-3"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "#f59e0b" }} />
                <span className="text-xs font-bold" style={{ color: "#f59e0b" }}>
                  Confirm Revision Update
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Rev {oldRev}</span>
                <span className="text-base font-bold" style={{ color: "#f59e0b" }}>→</span>
                <span className="font-bold" style={{ color: C }}>Rev {newRev.trim()}</span>
              </div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                This will <strong style={{ color: "rgba(255,255,255,0.8)" }}>stage</strong> a revision change for <strong style={{ color: "rgba(255,255,255,0.8)" }}>{group.document_name}</strong>.
                The change will only apply to the permanent database when the campaign is finalized.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirmRevChange}
                  disabled={stageMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#f59e0b", color: "#fff", fontFamily: "var(--font-heading)" }}
                >
                  {stageMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Stage Rev {oldRev} → {newRev.trim()}
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={stageMut.isPending}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Revert Confirmation ────────────────────────────────── */}
          {showRevertConfirm && group.previous_revision && (
            <div
              className="rounded-lg px-4 py-3 space-y-3"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <Undo2 className="h-4 w-4 flex-shrink-0" style={{ color: "#f59e0b" }} />
                <span className="text-xs font-bold" style={{ color: "#f59e0b" }}>
                  Revert Revision Change
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Rev {group.current_revision}</span>
                <span className="text-base font-bold" style={{ color: "#f59e0b" }}>→</span>
                <span className="font-bold" style={{ color: C }}>Rev {group.previous_revision}</span>
              </div>
              <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                This will restore <strong style={{ color: "rgba(255,255,255,0.8)" }}>{group.document_name}</strong> back
                to Rev {group.previous_revision}. Aircraft audit statuses will update accordingly.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRevert}
                  disabled={revertMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#f59e0b", color: "#fff", fontFamily: "var(--font-heading)" }}
                >
                  {revertMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                  Revert Rev {group.current_revision} → {group.previous_revision}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRevertConfirm(false) }}
                  disabled={revertMut.isPending}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Revision Change Banner (existing mismatch) ────────────── */}
          {!showRevConfirm && group.has_revision_change && (
            <div
              className="rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs"
              style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", color: "#f59e0b" }}
            >
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Revision changed from <strong>{group.previous_revision}</strong> → <strong>{group.current_revision}</strong> since last audit.
                Aircraft below were last reviewed at an older revision.
              </span>
            </div>
          )}

          {/* ── Aircraft Table (simplified) ───────────────────────────── */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${rgba(0.1)}` }}>
                  {["Aircraft", "Last Audited", "Audited Rev", "Status", ""].map(h => (
                    <th
                      key={h}
                      className="text-left py-1.5 pr-4"
                      style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: rgba(0.5) }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...group.items].sort((a, b) => a.registration.localeCompare(b.registration, undefined, { numeric: true, sensitivity: "base" })).map(item => {
                  const s = statusStyle[item.status]
                  const auditedRev = item.latest_audit?.audited_revision ?? null
                  const revMatches = auditedRev === group.current_revision
                  const hasAudit = !!auditedRev

                  return (
                    <tr key={item.aircraft_document_id} style={{ borderBottom: `1px solid ${rgba(0.05)}` }}>
                      {/* Registration */}
                      <td className="py-2 pr-4">
                        <span className="font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
                          {item.registration}
                        </span>
                        <span className="ml-2 text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {item.model_family}
                        </span>
                      </td>

                      {/* Last audit date */}
                      <td className="py-2 pr-4">
                        {item.latest_audit?.audit_date ?? <span style={{ color: "rgba(255,255,255,0.25)" }}>Never</span>}
                      </td>

                      {/* Audited Rev — with match/mismatch indicator */}
                      <td className="py-2 pr-4">
                        {hasAudit ? (
                          revMatches ? (
                            <span className="flex items-center gap-1.5">
                              <span style={{ color: "#10b981" }}>Rev {auditedRev}</span>
                              <CheckCircle2 className="h-3 w-3" style={{ color: "#10b981" }} />
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span style={{ color: "#f59e0b" }}>Rev {auditedRev}</span>
                              <span style={{ color: "#f59e0b" }}>→</span>
                              <span className="font-bold" style={{ color: C }}>Rev {group.current_revision}</span>
                            </span>
                          )
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.25)" }}>—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="py-2 pr-4">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase"
                          style={{ background: s.bg, color: s.color, fontFamily: "var(--font-heading)" }}
                        >
                          {s.label}
                        </span>
                      </td>

                      {/* History button */}
                      <td className="py-2">
                        <button
                          onClick={() => onShowHistory(item)}
                          className="transition-opacity hover:opacity-80"
                          title="View audit history"
                        >
                          <History className="h-3.5 w-3.5" style={{ color: rgba(0.4) }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
