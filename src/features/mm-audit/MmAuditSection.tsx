import { useState, useMemo } from "react"
import { Shield, ChevronRight, Loader2, ClipboardList, Plus, FileText, X, History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { useAuth } from "@/features/auth"
import { useMmFleetOverview, useMmCampaigns, useCreateCampaign, useBackdateCampaign, useSourceDocuments } from "./useMmAuditData"
import MmCampaignCard from "./MmCampaignCard"
import MmProfileGroup from "./MmProfileGroup"
import MmAuditWorkspace from "./MmAuditWorkspace"
import MmRevisionAlerts from "./MmRevisionAlerts"
import MmSourceDocManager from "./MmSourceDocManager"
import MmMelSection from "./MmMelSection"
import MmPdfExportButton from "./MmPdfExportButton"
import type { AuditStatus } from "./types"

// Match Compliance.tsx accent
const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

const statusColors: Record<AuditStatus, string> = {
  current: "#10b981",
  due_soon: "#f59e0b",
  overdue: "#f87171",
  never_audited: "rgba(255,255,255,0.4)",
}

export default function MmAuditSection() {
  const { profile } = useAuth()
  const canEdit = profile?.role === "Super Admin" || profile?.role === "Admin" || profile?.role === "Manager"
  const isSuperAdmin = profile?.role === "Super Admin"

  const [open, setOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<"audits" | "mel">("audits")
  const [showWorkspace, setShowWorkspace] = useState(false)
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [showBackdate, setShowBackdate] = useState(false)
  const [showSourceDocs, setShowSourceDocs] = useState(false)
  const fleet = useMmFleetOverview()
  const campaigns = useMmCampaigns()
  const createCampaign = useCreateCampaign()

  const isLoading = fleet.isLoading || campaigns.isLoading
  const isError = fleet.isError || campaigns.isError

  // Summary counts from fleet data
  const summaries = fleet.data?.summaries ?? []
  const overdue = summaries.filter(s => s.status === "overdue").length
  const dueSoon = summaries.filter(s => s.status === "due_soon").length
  const neverAudited = summaries.filter(s => s.status === "never_audited").length
  const current = summaries.filter(s => s.status === "current").length

  const activeCampaign = (campaigns.data ?? []).find(c => c.status === "open")
  const pastCampaigns = (campaigns.data ?? []).filter(c => c.status === "closed" || c.status === "cancelled")
  const profiles = fleet.data?.profiles ?? []

  // Determine suggested quarter from most recent campaign or current date
  const suggestedQuarter = useMemo(() => {
    const closedCampaigns = (campaigns.data ?? []).filter(c => c.status === "closed")
    if (closedCampaigns.length > 0) {
      // Parse the most recent closed campaign name to suggest the next quarter
      const last = closedCampaigns[0] // already sorted by period_start desc
      const match = last.name.match(/Q(\d)\s+(\d{4})/)
      if (match) {
        const lastQ = parseInt(match[1])
        const lastY = parseInt(match[2])
        const nextQ = lastQ === 4 ? 1 : lastQ + 1
        const nextY = lastQ === 4 ? lastY + 1 : lastY
        return { quarter: nextQ, year: nextY }
      }
    }
    // Fallback: current quarter
    const now = new Date()
    return { quarter: Math.ceil((now.getMonth() + 1) / 3), year: now.getFullYear() }
  }, [campaigns.data])

  return (
    <>
      <Card className="card-elevated border-0" style={{ borderLeft: `3px solid ${C}` }}>
        {/* Collapsible Header — matches Compliance.tsx ColHeader pattern */}
        <CardHeader
          className="cursor-pointer select-none"
          style={{ paddingBottom: open ? "0.75rem" : "1rem" }}
          onClick={() => setOpen(o => !o)}
          onMouseEnter={e => (e.currentTarget.style.background = rgba(0.04))}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: rgba(0.1) }}>
                <Shield className="h-4 w-4" style={{ color: C }} />
              </div>
              <CardTitle style={{ fontFamily: "var(--font-heading)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C }}>
                MM Revision &amp; Audit Tracking
              </CardTitle>

              {/* Inline summary badges (visible even when collapsed) */}
              {!isLoading && summaries.length > 0 && (
                <div className="flex items-center gap-2 ml-2">
                  {overdue > 0 && (
                    <span className="text-[11px] font-bold" style={{ color: "#f87171" }}>
                      {overdue} overdue
                    </span>
                  )}
                  {dueSoon > 0 && (
                    <span className="text-[11px] font-bold" style={{ color: "#f59e0b" }}>
                      {dueSoon} due soon
                    </span>
                  )}
                  {neverAudited > 0 && (
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {neverAudited} never audited
                    </span>
                  )}
                </div>
              )}
            </div>
            <ChevronRight
              className="h-4 w-4 transition-transform duration-200 flex-shrink-0"
              style={{ color: C, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            />
          </div>
        </CardHeader>

        {open && (
          <CardContent className="pt-0 space-y-6">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: C }} />
                <span className="ml-2 text-xs" style={{ color: rgba(0.6) }}>Loading audit data…</span>
              </div>
            )}

            {isError && (
              <div className="text-center py-6 text-xs" style={{ color: "#f87171" }}>
                Failed to load audit data. Please refresh.
              </div>
            )}

            {!isLoading && !isError && (
              <>
                {/* ── Tab Switcher ────────────────────────────────────────── */}
                <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: rgba(0.04) }}>
                  {([
                    { key: "audits" as const, label: "Source Document Audits" },
                    { key: "mel" as const, label: "MEL / Policy Letters" },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={(e) => { e.stopPropagation(); setActiveTab(tab.key) }}
                      className="flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all"
                      style={{
                        fontFamily: "var(--font-heading)",
                        background: activeTab === tab.key ? rgba(0.12) : "transparent",
                        color: activeTab === tab.key ? C : "rgba(255,255,255,0.35)",
                        border: activeTab === tab.key ? `1px solid ${rgba(0.2)}` : "1px solid transparent",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── MEL Tab ─────────────────────────────────────────────── */}
                {activeTab === "mel" && <MmMelSection />}

                {/* ── Audits Tab ──────────────────────────────────────────── */}
                {activeTab === "audits" && <>

                {/* ── Summary Bar ─────────────────────────────────────────── */}
                <div
                  className="flex items-center gap-4 rounded-lg px-4 py-3"
                  style={{ background: rgba(0.04), border: `1px solid ${rgba(0.1)}` }}
                >
                  {[
                    { count: current, label: "Current", color: statusColors.current },
                    { count: dueSoon, label: "Due within 30d", color: statusColors.due_soon },
                    { count: overdue, label: "Overdue", color: statusColors.overdue },
                    { count: neverAudited, label: "Never Audited", color: statusColors.never_audited },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className="text-sm font-bold" style={{ color: item.color, fontFamily: "var(--font-heading)" }}>
                        {item.count}
                      </span>
                      <span className="text-[11px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-heading)" }}>
                        {item.label}
                      </span>
                    </div>
                  ))}

                  <div className="ml-auto flex items-center gap-2">
                    <MmPdfExportButton campaign={activeCampaign ?? null} />
                    {isSuperAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowSourceDocs(true) }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
                        style={{ background: rgba(0.08), color: rgba(0.6), border: `1px solid ${rgba(0.12)}`, fontFamily: "var(--font-heading)" }}
                      >
                        <FileText className="h-3 w-3" />
                        Manage Docs
                      </button>
                    )}
                    <span className="text-[11px]" style={{ color: rgba(0.5) }}>
                      {summaries.length} aircraft · {fleet.data?.rows.length ?? 0} document links
                    </span>
                  </div>
                </div>

                {/* ── Revision Alerts ─────────────────────────────────────── */}
                <MmRevisionAlerts
                  campaignId={activeCampaign?.id ?? null}
                  onOpenWorkspace={() => setShowWorkspace(true)}
                />

                {/* ── Active Campaign ─────────────────────────────────────── */}
                {activeCampaign ? (
                  <div>
                    <SectionLabel label="Active Campaign" />
                    <MmCampaignCard
                      campaign={activeCampaign}
                      onOpenWorkspace={() => setShowWorkspace(true)}
                    />
                  </div>
                ) : canEdit ? (
                  <div>
                    <SectionLabel label="No Active Campaign" />
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowNewCampaign(true) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
                        style={{ background: rgba(0.1), color: C, border: `1px solid ${rgba(0.2)}`, fontFamily: "var(--font-heading)" }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Start New Campaign
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowWorkspace(true) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
                        style={{ background: rgba(0.06), color: rgba(0.6), border: `1px solid ${rgba(0.12)}`, fontFamily: "var(--font-heading)" }}
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        Ad-hoc Workspace
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowBackdate(true) }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
                          style={{ background: rgba(0.04), color: rgba(0.4), border: `1px solid ${rgba(0.08)}`, fontFamily: "var(--font-heading)" }}
                        >
                          <History className="h-3.5 w-3.5" />
                          Backfill History
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* ── Past Campaigns ──────────────────────────────────────── */}
                {pastCampaigns.length > 0 && (
                  <div>
                    <SectionLabel label="Past Campaigns" />
                    <div className="space-y-2">
                      {pastCampaigns.slice(0, 3).map(c => (
                        <MmCampaignCard key={c.id} campaign={c} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Fleet Audit Profiles ────────────────────────────────── */}
                <div>
                  <SectionLabel label={`Fleet Audit Profiles (${profiles.length} groups)`} />
                  <div className="space-y-2">
                    {profiles.map(group => (
                      <MmProfileGroup key={group.fingerprint} group={group} />
                    ))}
                  </div>
                </div>

                </>}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Full-screen Workspace Overlay ──────────────────────────────── */}
      {showWorkspace && (
        <MmAuditWorkspace
          campaignId={activeCampaign?.id ?? null}
          campaignName={activeCampaign?.name ?? "Ad-hoc Review"}
          onClose={() => setShowWorkspace(false)}
        />
      )}

      {/* ── Source Document Manager Overlay ─────────────────────────────── */}
      {showSourceDocs && (
        <MmSourceDocManager onClose={() => setShowSourceDocs(false)} />
      )}

      {/* ── New Campaign Dialog ────────────────────────────────────────── */}
      {showNewCampaign && (
        <NewCampaignDialog
          suggestedQuarter={suggestedQuarter.quarter}
          suggestedYear={suggestedQuarter.year}
          existingNames={(campaigns.data ?? []).map(c => c.name)}
          onConfirm={(name, start, end) => {
            createCampaign.mutate({ name, period_start: start, period_end: end }, {
              onSuccess: () => setShowNewCampaign(false),
            })
          }}
          isPending={createCampaign.isPending}
          onClose={() => setShowNewCampaign(false)}
        />
      )}

      {/* ── Backdate History Dialog ────────────────────────────────────── */}
      {showBackdate && (
        <BackdateAuditDialog
          existingNames={(campaigns.data ?? []).map(c => c.name)}
          onClose={() => setShowBackdate(false)}
        />
      )}
    </>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span style={{ fontFamily: "var(--font-heading)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: rgba(0.7) }}>
        {label}
      </span>
    </div>
  )
}

// ─── New Campaign Dialog ───────────────────────────────────────────────────

function NewCampaignDialog({
  suggestedQuarter,
  suggestedYear,
  existingNames,
  onConfirm,
  isPending,
  onClose,
}: {
  suggestedQuarter: number
  suggestedYear: number
  existingNames: string[]
  onConfirm: (name: string, start: string, end: string) => void
  isPending: boolean
  onClose: () => void
}) {
  const [quarter, setQuarter] = useState(suggestedQuarter)
  const [year, setYear] = useState(suggestedYear)
  const [customName, setCustomName] = useState("")

  const name = customName.trim() || `Q${quarter} ${year}`
  const qStart = new Date(year, (quarter - 1) * 3, 1)
  const qEnd = new Date(year, quarter * 3, 0)
  const startStr = qStart.toISOString().slice(0, 10)
  const endStr = qEnd.toISOString().slice(0, 10)

  const isDuplicate = existingNames.includes(name)

  const startLabel = qStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const endLabel = qEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 space-y-5 w-full max-w-md shadow-2xl"
        style={{ background: "#1a1a2e", border: `1px solid ${rgba(0.2)}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.9)" }}>
            Start New Campaign
          </span>
          <button onClick={onClose} className="transition-opacity hover:opacity-80" style={{ color: "rgba(255,255,255,0.4)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quarter selector */}
        <div>
          <label className="block mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: rgba(0.6), fontFamily: "var(--font-heading)" }}>
            Quarter
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(q => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: quarter === q ? rgba(0.15) : rgba(0.04),
                  border: quarter === q ? `1px solid ${rgba(0.3)}` : `1px solid ${rgba(0.1)}`,
                  color: quarter === q ? C : "rgba(255,255,255,0.4)",
                }}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>

        {/* Year selector */}
        <div>
          <label className="block mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: rgba(0.6), fontFamily: "var(--font-heading)" }}>
            Year
          </label>
          <div className="flex items-center gap-2">
            {[year - 1, year, year + 1].map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wider transition-all"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: year === y ? rgba(0.15) : rgba(0.04),
                  border: year === y ? `1px solid ${rgba(0.3)}` : `1px solid ${rgba(0.1)}`,
                  color: year === y ? C : "rgba(255,255,255,0.4)",
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign preview */}
        <div className="rounded-lg px-4 py-3" style={{ background: rgba(0.06), border: `1px solid ${rgba(0.12)}` }}>
          <div className="text-sm font-bold" style={{ color: C, fontFamily: "var(--font-heading)" }}>
            {name}
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {startLabel} — {endLabel}
          </div>
        </div>

        {/* Custom name override */}
        <div>
          <label className="block mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
            Custom Name (optional)
          </label>
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder={`Q${quarter} ${year}`}
            className="w-full rounded-lg px-3 py-2 text-xs outline-none"
            style={{ background: rgba(0.06), border: `1px solid ${rgba(0.15)}`, color: "rgba(255,255,255,0.8)" }}
          />
        </div>

        {/* Duplicate warning */}
        {isDuplicate && (
          <div className="text-[11px]" style={{ color: "#f87171" }}>
            A campaign named "{name}" already exists.
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(name, startStr, endStr)}
            disabled={isPending || isDuplicate}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: C, color: "#fff" }}
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating…
              </span>
            ) : (
              `Create ${name}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Backdate Audit Dialog ─────────────────────────────────────────────────

function BackdateAuditDialog({
  existingNames,
  onClose,
}: {
  existingNames: string[]
  onClose: () => void
}) {
  const now = new Date()
  const currentQ = Math.ceil((now.getMonth() + 1) / 3)
  const currentY = now.getFullYear()
  // Default to previous quarter
  const defaultQ = currentQ === 1 ? 4 : currentQ - 1
  const defaultY = currentQ === 1 ? currentY - 1 : currentY

  const [quarter, setQuarter] = useState(defaultQ)
  const [year, setYear] = useState(defaultY)
  const [showRevOverrides, setShowRevOverrides] = useState(false)
  const [revOverrides, setRevOverrides] = useState<Record<string, string>>({})

  const backdateMut = useBackdateCampaign()
  const sourceDocs = useSourceDocuments()

  const name = `Q${quarter} ${year}`
  const qStart = new Date(year, (quarter - 1) * 3, 1)
  const qEnd = new Date(year, quarter * 3, 0)
  const startStr = qStart.toISOString().slice(0, 10)
  const endStr = qEnd.toISOString().slice(0, 10)
  const auditDate = endStr // Stamp at end of quarter

  const isDuplicate = existingNames.includes(name)
  const startLabel = qStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const endLabel = qEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const docs = sourceDocs.data ?? []
  const overrideCount = Object.keys(revOverrides).filter(k => revOverrides[k] && revOverrides[k] !== docs.find(d => d.id === k)?.current_revision).length

  const handleConfirm = () => {
    backdateMut.mutate(
      {
        name,
        period_start: startStr,
        period_end: endStr,
        audit_date: auditDate,
        revisionOverrides: revOverrides,
      },
      { onSuccess: () => onClose() }
    )
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 space-y-5 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ background: "#1a1a2e", border: `1px solid ${rgba(0.2)}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" style={{ color: C }} />
            <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)", color: "rgba(255,255,255,0.9)" }}>
              Backfill Audit History
            </span>
          </div>
          <button onClick={onClose} className="transition-opacity hover:opacity-80" style={{ color: "rgba(255,255,255,0.4)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
          Create a completed campaign for a past quarter. All aircraft will be stamped as reviewed at the specified revisions.
          Super Admin only.
        </div>

        {/* Quarter selector */}
        <div>
          <label className="block mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: rgba(0.6), fontFamily: "var(--font-heading)" }}>
            Quarter
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(q => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: quarter === q ? rgba(0.15) : rgba(0.04),
                  border: quarter === q ? `1px solid ${rgba(0.3)}` : `1px solid ${rgba(0.1)}`,
                  color: quarter === q ? C : "rgba(255,255,255,0.4)",
                }}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>

        {/* Year selector — show more past years */}
        <div>
          <label className="block mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: rgba(0.6), fontFamily: "var(--font-heading)" }}>
            Year
          </label>
          <div className="flex items-center gap-2">
            {[currentY - 2, currentY - 1, currentY].map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="flex-1 py-2 rounded-lg text-xs font-bold tracking-wider transition-all"
                style={{
                  fontFamily: "var(--font-heading)",
                  background: year === y ? rgba(0.15) : rgba(0.04),
                  border: year === y ? `1px solid ${rgba(0.3)}` : `1px solid ${rgba(0.1)}`,
                  color: year === y ? C : "rgba(255,255,255,0.4)",
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg px-4 py-3" style={{ background: rgba(0.06), border: `1px solid ${rgba(0.12)}` }}>
          <div className="text-sm font-bold" style={{ color: C, fontFamily: "var(--font-heading)" }}>
            {name}
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            {startLabel} — {endLabel} · Audit date: {endLabel}
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Will be created as a <strong style={{ color: "#10b981" }}>completed</strong> campaign with full dual approval.
          </div>
        </div>

        {/* Revision overrides (expandable) */}
        <div>
          <button
            onClick={() => setShowRevOverrides(o => !o)}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
            style={{ color: rgba(0.5), fontFamily: "var(--font-heading)" }}
          >
            <ChevronRight
              className="h-3 w-3 transition-transform"
              style={{ color: rgba(0.4), transform: showRevOverrides ? "rotate(90deg)" : "rotate(0deg)" }}
            />
            Adjust Revisions ({overrideCount > 0 ? `${overrideCount} changed` : "all at current rev"})
          </button>

          {showRevOverrides && (
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
              <div className="text-[10px] mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                If a document was at a different revision during this quarter, override it below. Leave blank to use the current revision.
              </div>
              {docs.map(doc => (
                <div key={doc.id} className="flex items-center gap-2">
                  <span className="text-[11px] flex-1 truncate" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {doc.document_name}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: rgba(0.4) }}>
                    Current: {doc.current_revision}
                  </span>
                  <input
                    value={revOverrides[doc.id] ?? ""}
                    onChange={e => setRevOverrides(prev => ({ ...prev, [doc.id]: e.target.value }))}
                    placeholder={doc.current_revision}
                    className="w-16 rounded px-2 py-1 text-[11px] outline-none text-center"
                    style={{ background: rgba(0.06), border: `1px solid ${rgba(0.12)}`, color: "rgba(255,255,255,0.8)" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Warnings */}
        {isDuplicate && (
          <div className="text-[11px]" style={{ color: "#f87171" }}>
            A campaign named "{name}" already exists. Delete or rename it first.
          </div>
        )}

        {backdateMut.isError && (
          <div className="text-[11px]" style={{ color: "#f87171" }}>
            Failed to create backdated campaign. Please try again.
          </div>
        )}

        {/* Success */}
        {backdateMut.isSuccess && (
          <div className="text-xs font-bold" style={{ color: "#10b981" }}>
            Created {name} with {(backdateMut.data as any)?.recordCount ?? 0} audit records.
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={backdateMut.isPending}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}
          >
            {backdateMut.isSuccess ? "Done" : "Cancel"}
          </button>
          {!backdateMut.isSuccess && (
            <button
              onClick={handleConfirm}
              disabled={backdateMut.isPending || isDuplicate}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: C, color: "#fff" }}
            >
              {backdateMut.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating…
                </span>
              ) : (
                `Backfill ${name}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
