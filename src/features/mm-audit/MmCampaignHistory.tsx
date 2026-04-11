import { useState } from "react"
import { ArrowLeft, Archive, ChevronDown, Loader2 } from "lucide-react"
import type { CampaignSummary } from "./types"

const C = "#a78bfa"
const rgba = (a: number) => `rgba(167,139,250,${a})`

interface Props {
  campaigns: CampaignSummary[]
  onClose: () => void
}

type SortKey = "date" | "name"
type SortDir = "asc" | "desc"

export default function MmCampaignHistory({ campaigns, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [statusFilter, setStatusFilter] = useState<"all" | "closed" | "cancelled">("all")

  // Trigger animation on mount
  setTimeout(() => setVisible(true), 0)

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  // Filter campaigns
  const filtered = campaigns.filter(c => {
    if (statusFilter === "all") return true
    return c.status === statusFilter
  })

  // Sort campaigns
  const sorted = [...filtered].sort((a, b) => {
    let aVal: string | number
    let bVal: string | number

    if (sortKey === "date") {
      aVal = new Date(a.period_start).getTime()
      bVal = new Date(b.period_start).getTime()
    } else {
      aVal = a.name.toLowerCase()
      bVal = b.name.toLowerCase()
    }

    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return sortDir === "asc" ? cmp : -cmp
  })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        background: "#0f0f1a",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1) translateY(0)" : "scale(0.97) translateY(14px)",
        transition: "opacity 0.2s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
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
        </div>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "13px", fontWeight: 600, letterSpacing: "0.1em", color: "rgba(255,255,255,0.9)" }}>
          CAMPAIGN HISTORY
        </h2>
        <div style={{ width: "120px" }} />
      </div>

      {/* Filter & Sort Bar */}
      <div
        className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${rgba(0.1)}`, background: rgba(0.02) }}
      >
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label style={{ fontSize: "11px", color: rgba(0.5), fontFamily: "var(--font-heading)" }}>
            Status:
          </label>
          {(["all", "closed", "cancelled"] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all"
              style={{
                fontFamily: "var(--font-heading)",
                background: statusFilter === status ? rgba(0.15) : rgba(0.04),
                border: statusFilter === status ? `1px solid ${rgba(0.3)}` : `1px solid ${rgba(0.1)}`,
                color: statusFilter === status ? C : "rgba(255,255,255,0.4)",
              }}
            >
              {status === "all" ? "All" : status === "closed" ? "Completed" : "Cancelled"}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Sort Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleSort("date")}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1"
              style={{
                fontFamily: "var(--font-heading)",
                background: sortKey === "date" ? rgba(0.12) : rgba(0.04),
                border: `1px solid ${rgba(0.1)}`,
                color: sortKey === "date" ? C : "rgba(255,255,255,0.4)",
              }}
            >
              Date
              <ChevronDown
                className="h-3 w-3"
                style={{ transform: sortKey === "date" && sortDir === "asc" ? "rotate(180deg)" : "" }}
              />
            </button>
            <button
              onClick={() => toggleSort("name")}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1"
              style={{
                fontFamily: "var(--font-heading)",
                background: sortKey === "name" ? rgba(0.12) : rgba(0.04),
                border: `1px solid ${rgba(0.1)}`,
                color: sortKey === "name" ? C : "rgba(255,255,255,0.4)",
              }}
            >
              Name
              <ChevronDown
                className="h-3 w-3"
                style={{ transform: sortKey === "name" && sortDir === "asc" ? "rotate(180deg)" : "" }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Campaign List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.5rem",
        }}
      >
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: "2rem", color: "rgba(255,255,255,0.4)" }}>
            <p style={{ fontSize: "13px" }}>No campaigns found</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
            {sorted.map(campaign => (
              <div
                key={campaign.id}
                className="rounded-lg p-4 transition-all hover:bg-opacity-80"
                style={{
                  background: rgba(0.04),
                  border: `1px solid ${rgba(0.12)}`,
                }}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.9)",
                        fontFamily: "var(--font-heading)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {campaign.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "0.25rem" }}>
                      {campaign.period_start} — {campaign.period_end}
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background: campaign.status === "closed" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                      color: campaign.status === "closed" ? "#10b981" : "#f87171",
                    }}
                  >
                    {campaign.status === "closed" ? "Completed" : "Cancelled"}
                  </span>
                </div>

                {/* Progress & Stats */}
                <div className="space-y-2">
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: rgba(0.1) }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${campaign.progress_pct}%`,
                        background: campaign.progress_pct === 100 ? "#10b981" : C,
                      }}
                    />
                  </div>

                  {/* Stats row */}
                  <div
                    style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.5)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{campaign.audited_items} of {campaign.total_items} reviewed — {campaign.progress_pct}%</span>
                    {campaign.staged_revision_count > 0 && (
                      <span style={{ color: "#f59e0b" }}>
                        {campaign.staged_revision_count} revision change{campaign.staged_revision_count > 1 ? "s" : ""} staged
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
