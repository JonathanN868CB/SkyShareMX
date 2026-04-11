import { useNavigate } from "react-router-dom"
import { X, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { useBeetBoxTabs } from "./BeetBoxTabsContext"

const MAX_VISIBLE = 5

export function BeetBoxTabBar() {
  const { tabs, activeTabPath, closeTab, closeAll, headerLabel } = useBeetBoxTabs()
  const navigate = useNavigate()

  if (tabs.length === 0) return null

  const visibleTabs = tabs.slice(0, MAX_VISIBLE)
  const overflowTabs = tabs.slice(MAX_VISIBLE)

  return (
    <>
      {/* WO# zone — fixed between collapsed sidebar edge (56px) and tab bar start (256px) */}
      {headerLabel && (
        <div
          className="flex items-center justify-center"
          style={{
            position: "fixed",
            top: 0,
            left: "56px",
            width: "200px",
            height: "32px",
            zIndex: 41,
            background: "hsl(0 0% 10%)",
            borderBottom: "1px solid hsl(0 0% 14%)",
          }}
        >
          <span
            className="leading-none"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "24px",
              letterSpacing: "0.05em",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            {headerLabel}
          </span>
        </div>
      )}

      {/* Tab strip — fixed, starts after the sidebar */}
      <div
        className="flex items-center px-3 gap-1"
        style={{
          position: "fixed",
          top: 0,
          left: "256px",
          right: 0,
          height: "32px",
          zIndex: 40,
          background: "hsl(0 0% 10%)",
          borderBottom: "1px solid hsl(0 0% 14%)",
        }}
      >
      {visibleTabs.map(tab => {
        const isActive = tab.path === activeTabPath
        return (
          <Tab
            key={tab.path}
            label={tab.label}
            isActive={isActive}
            onClick={() => navigate(tab.path)}
            onClose={e => { e.stopPropagation(); closeTab(tab.path) }}
          />
        )
      })}

      {overflowTabs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center px-2 h-full transition-colors"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "11px",
                letterSpacing: "0.03em",
                color: "rgba(255,255,255,0.4)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.65)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)" }}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span className="ml-1 text-[10px]">{overflowTabs.length}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[160px]"
            style={{ background: "hsl(0 0% 13%)", border: "1px solid hsl(0 0% 18%)" }}
          >
            {overflowTabs.map(tab => (
              <DropdownMenuItem
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex items-center justify-between gap-3 cursor-pointer"
                style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.03em" }}
              >
                <span className="truncate">{tab.label}</span>
                <button
                  onClick={e => { e.stopPropagation(); closeTab(tab.path) }}
                  className="ml-auto flex-shrink-0 opacity-30 hover:opacity-80 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator style={{ background: "hsl(0 0% 20%)" }} />
            <DropdownMenuItem
              onClick={closeAll}
              className="cursor-pointer"
              style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.03em", color: "#f87171" }}
            >
              Close All Tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </div>
    </>
  )
}

interface TabProps {
  label: string
  isActive: boolean
  onClick: () => void
  onClose: (e: React.MouseEvent) => void
}

function Tab({ label, isActive, onClick, onClose }: TabProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-0.5 my-auto transition-all group relative flex-shrink-0 rounded-full"
      style={{
        fontFamily: "var(--font-heading)",
        fontSize: "11px",
        letterSpacing: "0.03em",
        cursor: "pointer",
        whiteSpace: "nowrap",
        ...(isActive ? {
          color: "rgba(216,180,254,0.95)",
          background: "rgba(168,85,247,0.15)",
          border: "1px solid rgba(168,85,247,0.6)",
          boxShadow: "0 0 8px rgba(168,85,247,0.2)",
        } : {
          color: "rgba(255,255,255,0.4)",
          background: "transparent",
          border: "1px solid transparent",
        }),
      }}
      onMouseEnter={e => {
        if (!isActive) {
          const el = e.currentTarget as HTMLElement
          el.style.color = "rgba(255,255,255,0.65)"
          el.style.background = "rgba(255,255,255,0.05)"
          el.style.border = "1px solid rgba(168,85,247,0.25)"
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          const el = e.currentTarget as HTMLElement
          el.style.color = "rgba(255,255,255,0.4)"
          el.style.background = "transparent"
          el.style.border = "1px solid transparent"
        }
      }}
    >
      <span>{label}</span>
      <span
        onClick={onClose}
        className="flex items-center justify-center transition-colors"
        style={{
          width: "14px",
          height: "14px",
          color: isActive ? "rgba(216,180,254,0.35)" : "rgba(255,255,255,0.25)",
          lineHeight: 1,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isActive ? "rgba(216,180,254,0.35)" : "rgba(255,255,255,0.25)" }}
      >
        <X className="w-2.5 h-2.5" />
      </span>
    </button>
  )
}
