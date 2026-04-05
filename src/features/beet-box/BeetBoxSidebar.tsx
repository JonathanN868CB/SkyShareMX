import { useState, useEffect } from "react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import {
  ClipboardList, Package, ShoppingCart, Wrench,
  FileText, BookOpen, BookMarked, GraduationCap,
  PanelLeftOpen, PanelLeftClose, Settings, Boxes,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { BeetIcon } from "./shared/BeetIcon"
import { SuggestionWidget } from "@/features/site-suggestions"

const OPS_ITEMS = [
  { label: "Work Orders",      path: "/app/beet-box/work-orders",     icon: ClipboardList },
  { label: "Logbook",          path: "/app/beet-box/logbook",          icon: BookOpen      },
  { label: "Invoicing",        path: "/app/beet-box/invoicing",        icon: FileText      },
  { label: "Inventory",        path: "/app/beet-box/inventory",        icon: Package       },
  { label: "Parts",            path: "/app/beet-box/parts",            icon: Boxes         },
  { label: "Purchase Orders",  path: "/app/beet-box/purchase-orders",  icon: ShoppingCart  },
  { label: "Tool Calibration", path: "/app/beet-box/tool-calibration", icon: Wrench        },
  { label: "Settings",         path: "/app/beet-box/settings",         icon: Settings      },
]

const KNOWLEDGE_ITEMS = [
  { label: "SOP Library", path: "/app/beet-box/sop-library", icon: BookMarked    },
  { label: "Training",    path: "/app/beet-box/training",    icon: GraduationCap },
]

// Shared style for both toggle buttons (sidebar + WO rail) — exported so WorkOrderDetail can match
export const TOGGLE_BTN = {
  base: "flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all select-none",
  style: {
    border: "1px solid hsl(0,0%,26%)",
    background: "hsl(0,0%,15%)",
  } as React.CSSProperties,
  hoverStyle: {
    border: "1px solid hsl(0,0%,34%)",
    background: "hsl(0,0%,20%)",
  } as React.CSSProperties,
}

export function BeetBoxSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [portalHovered, setPortalHovered] = useState(false)
  const [toggleHovered, setToggleHovered] = useState(false)

  const onWODetail = /\/app\/beet-box\/work-orders\/.+/.test(location.pathname)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(onWODetail)
  }, [onWODetail])

  const narrow = onWODetail && collapsed

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden"
      style={{
        width: narrow ? "56px" : "256px",
        transition: "width 0.22s ease",
        background: "hsl(0 0% 9%)",
        borderRight: "1px solid hsl(0 0% 14%)",
      }}
    >
      {/* ── Header — two completely different layouts ──────────────────────── */}
      {narrow ? (
        /* Narrow: stacked icon + expand button */
        <div
          className="flex flex-col items-center gap-2.5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
        >
          <BeetIcon className="w-7 h-7" style={{ color: "var(--skyshare-gold)" }} />
          <button
            onClick={() => setCollapsed(false)}
            onMouseEnter={() => setToggleHovered(true)}
            onMouseLeave={() => setToggleHovered(false)}
            title="Expand navigation"
            className={cn(TOGGLE_BTN.base, "w-10 h-10 flex-shrink-0 text-white/60 hover:text-white")}
            style={toggleHovered ? TOGGLE_BTN.hoverStyle : TOGGLE_BTN.style}
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        </div>
      ) : (
        /* Wide: full header row — unchanged from original */
        <div
          className="flex items-start gap-3 px-4 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}
        >
          <BeetIcon
            className="w-8 h-8 flex-shrink-0 mt-0.5"
            style={{ color: "var(--skyshare-gold)" }}
          />
          <div className="flex flex-col flex-shrink-0">
            <span
              className="text-white/90 uppercase leading-tight whitespace-nowrap"
              style={{ fontFamily: "var(--font-display)", fontSize: "18px", letterSpacing: "0.1em" }}
            >
              Beet Box
            </span>
            <span
              className="uppercase whitespace-nowrap"
              style={{ fontFamily: "var(--font-heading)", fontSize: "9px", color: "var(--skyshare-gold)", opacity: 0.65, letterSpacing: "0.25em" }}
            >
              MX Suite
            </span>
          </div>

          <div className="flex-1" />

          {/* Back to Portal + Suggestion widget stacked */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0 mr-1">

          {/* Back to Portal */}
          <button
            onClick={() => navigate("/app")}
            onMouseEnter={() => setPortalHovered(true)}
            onMouseLeave={() => setPortalHovered(false)}
            title="Back to Portal"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm"
            style={{
              border:     portalHovered ? "1px solid rgba(212,160,23,0.65)" : "1px solid rgba(212,160,23,0.2)",
              background: portalHovered
                ? "linear-gradient(135deg, rgba(212,160,23,0.18) 0%, rgba(212,160,23,0.06) 100%)"
                : "linear-gradient(135deg, rgba(212,160,23,0.07) 0%, rgba(0,0,0,0) 100%)",
              boxShadow:  portalHovered ? "0 0 0 1px rgba(212,160,23,0.1), 0 2px 14px rgba(212,160,23,0.2)" : "none",
              transition: "border 0.2s ease, background 0.2s ease, box-shadow 0.25s ease",
            }}
          >
            <svg
              width="8" height="8" viewBox="0 0 8 8" fill="none"
              style={{
                color:      portalHovered ? "var(--skyshare-gold)" : "rgba(212,160,23,0.6)",
                transform:  portalHovered ? "translateX(-2px)" : "translateX(0)",
                transition: "color 0.2s ease, transform 0.2s ease",
                flexShrink: 0,
              }}
            >
              <path d="M5 1.5L2 4L5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span
              className="leading-none"
              style={{
                fontFamily:    "var(--font-heading)",
                fontSize:      "10.5px",
                letterSpacing: portalHovered ? "0.03em" : "0.01em",
                color:         portalHovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.62)",
                transition:    "color 0.2s ease, letter-spacing 0.2s ease",
              }}
            >
              SkyShareMX
            </span>
          </button>

          {/* Suggestion widget */}
          <SuggestionWidget variant="sidebar" />

          </div>{/* end stacked group */}

          {/* Collapse toggle — only on WO detail */}
          {onWODetail && (
            <button
              onClick={() => setCollapsed(true)}
              onMouseEnter={() => setToggleHovered(true)}
              onMouseLeave={() => setToggleHovered(false)}
              title="Collapse navigation"
              className={cn(TOGGLE_BTN.base, "h-8 px-2.5 text-xs text-white/60 hover:text-white flex-shrink-0")}
              style={toggleHovered ? TOGGLE_BTN.hoverStyle : TOGGLE_BTN.style}
            >
              <PanelLeftClose className="w-4 h-4 flex-shrink-0" />
              <span>Hide</span>
            </button>
          )}
        </div>
      )}

      {/* Stripe divider */}
      <div className="stripe-divider flex-shrink-0" />

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3">

        {!narrow && (
          <p
            className="px-3 mb-2"
            style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--skyshare-gold)", opacity: 0.55 }}
          >
            Operations
          </p>
        )}

        <ul className="space-y-0.5 mb-5">
          {OPS_ITEMS.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                title={narrow ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center py-2 rounded-sm text-sm transition-all duration-150",
                    narrow ? "justify-center px-1" : "gap-3 px-3",
                    isActive ? "text-white font-medium" : "text-white/45 hover:text-white/80 font-normal"
                  )
                }
                style={({ isActive }) =>
                  isActive ? {
                    background: narrow ? "rgba(212,160,23,0.15)" : "linear-gradient(to right, rgba(212,160,23,0.15), transparent)",
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "0.02em",
                  } : {}
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="w-[17px] h-[17px] flex-shrink-0" style={isActive ? { color: "var(--skyshare-gold)" } : {}} />
                    {!narrow && <span className="truncate tracking-wide">{item.label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mx-3 mb-4" style={{ height: "1px", background: "hsl(0 0% 16%)" }} />

        {!narrow && (
          <p
            className="px-3 mb-2"
            style={{ fontFamily: "var(--font-heading)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--skyshare-gold)", opacity: 0.55 }}
          >
            Knowledge
          </p>
        )}

        <ul className="space-y-0.5">
          {KNOWLEDGE_ITEMS.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                title={narrow ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center py-2 rounded-sm text-sm transition-all duration-150",
                    narrow ? "justify-center px-1" : "gap-3 px-3",
                    isActive ? "text-white font-medium" : "text-white/45 hover:text-white/80 font-normal"
                  )
                }
                style={({ isActive }) =>
                  isActive ? {
                    background: narrow ? "rgba(212,160,23,0.15)" : "linear-gradient(to right, rgba(212,160,23,0.15), transparent)",
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "0.02em",
                  } : {}
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="w-[17px] h-[17px] flex-shrink-0" style={isActive ? { color: "var(--skyshare-gold)" } : {}} />
                    {!narrow && <span className="truncate tracking-wide">{item.label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 flex-shrink-0">
        {narrow ? (
          <button
            onClick={() => navigate("/app")}
            title="Back to SkyShareMX"
            className="w-full flex justify-center items-center py-1 text-white/30 hover:text-white/70 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 8 8" fill="none">
              <path d="M5 1.5L2 4L5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <p
            className="text-[9px] tracking-[0.2em] uppercase"
            style={{ color: "hsl(0 0% 28%)", fontFamily: "var(--font-heading)" }}
          >
            Beet Box · Demo Mode
          </p>
        )}
      </div>
    </aside>
  )
}
