import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { FileText, Activity, Archive, Upload, Clock } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/features/auth"
import { useRecordsVaultCtx } from "./RecordsVaultApp"
import { MANAGER_ROLES } from "./constants"

const NAV_ITEMS = [
  { label: "Records",  path: "/app/records-vault/search",   icon: FileText   },
  { label: "Timeline", path: "/app/records-vault/timeline", icon: Clock      },
  { label: "Pipeline", path: "/app/records-vault/pipeline", icon: Activity   },
]

export function RecordsVaultSidebar() {
  const navigate = useNavigate()
  const [portalHovered, setPortalHovered] = useState(false)
  const { profile } = useAuth()
  const { selectedAircraftId, setSelectedAircraftId, allAircraft, fleetLoading, openUpload } =
    useRecordsVaultCtx()

  const isManager = MANAGER_ROLES.includes(profile?.role as typeof MANAGER_ROLES[number])

  return (
    <aside
      className="flex flex-col h-screen w-64 flex-shrink-0"
      style={{ background: "hsl(0 0% 9%)", borderRight: "1px solid hsl(0 0% 14%)" }}
    >
      {/* Back to portal strip */}
      <div className="flex justify-end px-3 pt-3 pb-2">
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

      {/* Brand row */}
      <div
        className="flex items-start gap-3 px-4 pb-4"
        style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
      >
        <Archive
          className="w-7 h-7 flex-shrink-0 mt-0.5"
          style={{ color: "var(--skyshare-gold)" }}
        />
        <div className="flex flex-col">
          <span
            className="text-white/90 uppercase leading-tight whitespace-nowrap"
            style={{ fontFamily: "var(--font-display)", fontSize: "16px", letterSpacing: "0.08em" }}
          >
            Records Vault
          </span>
          <span
            className="uppercase whitespace-nowrap"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "9px",
              color: "var(--skyshare-gold)",
              opacity: 0.65,
              letterSpacing: "0.25em",
            }}
          >
            SkyShare MX
          </span>
        </div>
      </div>

      <div className="stripe-divider" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">

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
