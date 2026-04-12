import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { FileText, Activity, Archive, Upload } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/features/auth"
import { useRecordsVaultCtx } from "./RecordsVaultApp"
import { MANAGER_ROLES } from "./constants"
import { SuggestionWidget } from "@/features/site-suggestions"
import type { SearchAircraftGroup } from "./RecordsVaultApp"

const SIDEBAR_AIRCRAFT_LIMIT = 10

function SearchAircraftList({
  groups,
  selectedId,
  onSelect,
}: {
  groups: SearchAircraftGroup[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible  = expanded ? groups : groups.slice(0, SIDEBAR_AIRCRAFT_LIMIT)
  const overflow = groups.length - SIDEBAR_AIRCRAFT_LIMIT
  const totalHits = groups.reduce((sum, g) => sum + g.count, 0)

  return (
    <>
      {/* Section label */}
      <p
        className="px-3 pt-4 mb-2"
        style={{
          fontFamily:    "var(--font-heading)",
          fontSize:      "10px",
          fontWeight:    700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color:         "var(--skyshare-gold)",
          opacity:       0.55,
        }}
      >
        In Results
      </p>

      <ul className="space-y-0.5">
        {/* All row */}
        <li>
          <button
            onClick={() => onSelect(null)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-sm text-sm transition-all duration-150",
              !selectedId
                ? "text-white font-medium"
                : "text-white/45 hover:text-white/80 font-normal"
            )}
            style={
              !selectedId
                ? {
                    background:  "linear-gradient(to right, rgba(212,160,23,0.15), transparent)",
                    borderLeft:  "3px solid var(--skyshare-gold)",
                    fontFamily:  "var(--font-heading)",
                    letterSpacing: "0.02em",
                  }
                : { borderLeft: "3px solid transparent" }
            }
          >
            <span>All</span>
            <span
              className="text-xs tabular-nums"
              style={{ color: !selectedId ? "var(--skyshare-gold)" : "rgba(255,255,255,0.25)" }}
            >
              {totalHits}
            </span>
          </button>
        </li>

        {/* Per-aircraft rows */}
        {visible.map((ac) => {
          const isSelected = selectedId === ac.id
          return (
            <li key={ac.id}>
              <button
                onClick={() => onSelect(ac.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-sm transition-all duration-150",
                  isSelected
                    ? "text-white font-medium"
                    : "text-white/45 hover:text-white/80 font-normal"
                )}
                style={
                  isSelected
                    ? {
                        background:    "linear-gradient(to right, rgba(212,160,23,0.15), transparent)",
                        borderLeft:    "3px solid var(--skyshare-gold)",
                        fontFamily:    "var(--font-heading)",
                        letterSpacing: "0.02em",
                      }
                    : { borderLeft: "3px solid transparent" }
                }
              >
                <div className="flex flex-col items-start min-w-0">
                  <span
                    className="leading-tight truncate"
                    style={{
                      fontFamily:    "var(--font-heading)",
                      fontSize:      "13px",
                      letterSpacing: "0.02em",
                      color:         isSelected ? "var(--skyshare-gold)" : undefined,
                    }}
                  >
                    {ac.tailNumber}
                  </span>
                  <span
                    className="font-mono leading-tight"
                    style={{
                      fontSize: "9px",
                      color:    isSelected ? "rgba(212,160,23,0.55)" : "rgba(255,255,255,0.22)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {ac.serialNumber}
                  </span>
                </div>
                <span
                  className="text-xs tabular-nums shrink-0 ml-2"
                  style={{ color: isSelected ? "var(--skyshare-gold)" : "rgba(255,255,255,0.25)" }}
                >
                  {ac.count}
                </span>
              </button>
            </li>
          )
        })}

        {/* "and N more…" expander */}
        {!expanded && overflow > 0 && (
          <li>
            <button
              onClick={() => setExpanded(true)}
              className="w-full text-left px-3 py-1.5 transition-colors"
              style={{
                fontFamily:    "var(--font-heading)",
                fontSize:      "10px",
                letterSpacing: "0.05em",
                color:         "rgba(255,255,255,0.28)",
                borderLeft:    "3px solid transparent",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.55)" }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.28)" }}
            >
              and {overflow} more…
            </button>
          </li>
        )}
      </ul>
    </>
  )
}

const NAV_ITEMS = [
  { label: "Records",  path: "/app/records-vault/search",   icon: FileText   },
  { label: "Pipeline", path: "/app/records-vault/pipeline", icon: Activity   },
]

export function RecordsVaultSidebar() {
  const navigate = useNavigate()
  const [portalHovered, setPortalHovered] = useState(false)
  const { profile } = useAuth()
  const {
    selectedAircraftId, setSelectedAircraftId, allAircraft, fleetLoading, openUpload,
    searchAircraftGroups, selectedAircraftFilter, setSelectedAircraftFilter,
  } = useRecordsVaultCtx()

  const isManager = MANAGER_ROLES.includes(profile?.role as typeof MANAGER_ROLES[number])

  return (
    <aside
      className="flex flex-col h-screen w-64 flex-shrink-0"
      style={{ background: "hsl(0 0% 9%)", borderRight: "1px solid hsl(0 0% 14%)" }}
    >
      {/* Header — brand + nav buttons, stacked and centered */}
      <div
        className="flex flex-col items-center pt-5 pb-4"
        style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
      >
        {/* Brand: icon + text centered as a unit */}
        <div className="flex items-center gap-3">
          <Archive
            className="w-8 h-8 flex-shrink-0"
            style={{ color: "var(--skyshare-gold)" }}
          />
          <div className="flex flex-col">
            <span
              className="text-white/90 uppercase leading-tight whitespace-nowrap"
              style={{ fontFamily: "var(--font-display)", fontSize: "18.5px", letterSpacing: "0.08em" }}
            >
              Records Vault
            </span>
            <span
              className="uppercase whitespace-nowrap"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "10.5px",
                color: "var(--skyshare-gold)",
                opacity: 0.65,
                letterSpacing: "0.25em",
              }}
            >
              SkyShare MX
            </span>
          </div>
        </div>

        {/* Back to portal + suggestions — centered pair below brand */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <SuggestionWidget variant="sidebar" />
          <button
            onClick={() => navigate("/app")}
            onMouseEnter={() => setPortalHovered(true)}
            onMouseLeave={() => setPortalHovered(false)}
            title="Back to Portal"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm"
            style={{
              border: portalHovered
                ? "1px solid rgba(212,160,23,0.65)"
                : "1px solid rgba(212,160,23,0.2)",
              background: portalHovered
                ? "linear-gradient(135deg, rgba(212,160,23,0.18) 0%, rgba(212,160,23,0.06) 100%)"
                : "linear-gradient(135deg, rgba(212,160,23,0.07) 0%, rgba(0,0,0,0) 100%)",
              boxShadow: portalHovered
                ? "0 0 0 1px rgba(212,160,23,0.1), 0 2px 14px rgba(212,160,23,0.2)"
                : "none",
              transition: "border 0.2s ease, background 0.2s ease, box-shadow 0.25s ease",
            }}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{
                color: portalHovered ? "var(--skyshare-gold)" : "rgba(212,160,23,0.6)",
                transform: portalHovered ? "translateX(-2px)" : "translateX(0)",
                transition: "color 0.2s ease, transform 0.2s ease",
                flexShrink: 0,
              }}
            >
              <path
                d="M5 1.5L2 4L5 6.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="leading-none"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "10.5px",
                letterSpacing: portalHovered ? "0.03em" : "0.01em",
                color: portalHovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.62)",
                transition: "color 0.2s ease, letter-spacing 0.2s ease",
              }}
            >
              SkyShare MX
            </span>
          </button>
        </div>
      </div>

      <div className="stripe-divider" />

      {/* Navigation */}
      <nav className="shrink-0 py-4 px-3">

        {/* Aircraft scope */}
        <p
          className="px-3 mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--skyshare-gold)",
            opacity: 0.55,
          }}
        >
          Aircraft
        </p>
        <div className="px-1 mb-5">
          <select
            value={selectedAircraftId ?? "fleet"}
            onChange={(e) =>
              setSelectedAircraftId(e.target.value === "fleet" ? null : e.target.value)
            }
            disabled={fleetLoading}
            className="w-full rounded-sm px-2.5 py-1.5 text-xs outline-none"
            style={{
              background: "hsl(0 0% 13%)",
              border: "1px solid hsl(0 0% 20%)",
              color: "rgba(255,255,255,0.75)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.03em",
              cursor: "pointer",
            }}
          >
            <option value="fleet">All Aircraft</option>
            {allAircraft.map((ac) => (
              <option key={ac.id} value={ac.id}>
                {ac.tailNumber} — {ac.model}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="mx-3 mb-4" style={{ height: "1px", background: "hsl(0 0% 16%)" }} />

        {/* Records nav */}
        <p
          className="px-3 mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--skyshare-gold)",
            opacity: 0.55,
          }}
        >
          Records
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150",
                    isActive
                      ? "text-white font-medium"
                      : "text-white/45 hover:text-white/80 font-normal"
                  )
                }
                style={({ isActive }) =>
                  isActive
                    ? {
                        background:
                          "linear-gradient(to right, rgba(212,160,23,0.15), transparent)",
                        fontFamily: "var(--font-heading)",
                        letterSpacing: "0.02em",
                      }
                    : {}
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className="w-[17px] h-[17px] flex-shrink-0"
                      style={isActive ? { color: "var(--skyshare-gold)" } : {}}
                    />
                    <span className="truncate tracking-wide">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

      </nav>

      {/* Search result aircraft filter */}
      {searchAircraftGroups.length > 0 && (
        <>
          <div className="stripe-divider" />
          <div className="shrink-0 overflow-y-auto" style={{ maxHeight: "45vh" }}>
            <SearchAircraftList
              groups={searchAircraftGroups}
              selectedId={selectedAircraftFilter}
              onSelect={setSelectedAircraftFilter}
            />
          </div>
        </>
      )}

      {/* Spacer — pushes footer to bottom */}
      <div className="flex-1" />

      {/* Footer — Upload + label */}
      <div
        className="px-4 py-4 flex flex-col gap-3"
        style={{ borderTop: "1px solid hsl(0 0% 14%)" }}
      >
        {isManager && (
          <button
            onClick={openUpload}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-sm text-xs font-medium transition-all duration-150"
            style={{
              background: "linear-gradient(135deg, rgba(212,160,23,0.18) 0%, rgba(212,160,23,0.06) 100%)",
              border: "1px solid rgba(212,160,23,0.3)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.06em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(212,160,23,0.6)"
              e.currentTarget.style.background =
                "linear-gradient(135deg, rgba(212,160,23,0.28) 0%, rgba(212,160,23,0.1) 100%)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(212,160,23,0.3)"
              e.currentTarget.style.background =
                "linear-gradient(135deg, rgba(212,160,23,0.18) 0%, rgba(212,160,23,0.06) 100%)"
            }}
          >
            <Upload className="w-3.5 h-3.5" style={{ color: "var(--skyshare-gold)" }} />
            Upload Records
          </button>
        )}
        <p
          className="text-[9px] tracking-[0.2em] uppercase"
          style={{ color: "hsl(0 0% 28%)", fontFamily: "var(--font-heading)" }}
        >
          Records Vault · Phase 1
        </p>
      </div>
    </aside>
  )
}
