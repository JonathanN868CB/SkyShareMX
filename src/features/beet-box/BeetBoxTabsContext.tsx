import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

export type BeetTab = { path: string; label: string }

interface BeetBoxTabsContextValue {
  tabs: BeetTab[]
  activeTabPath: string | null
  closeTab: (path: string) => void
  closeAll: () => void
  headerLabel: string | null
  setHeaderLabel: (label: string | null) => void
}

const BeetBoxTabsContext = createContext<BeetBoxTabsContextValue | null>(null)

const STORAGE_KEY = "beet-tabs"
const FALLBACK_PATH = "/app/beet-box/work-orders"

const ROUTE_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\/work-orders\/new$/,        label: "New Work Order" },
  { pattern: /\/work-orders\/[^/]+$/,      label: "Work Order" },
  { pattern: /\/work-orders$/,             label: "Work Orders" },
  { pattern: /\/purchase-orders\/new$/,    label: "New PO" },
  { pattern: /\/purchase-orders\/[^/]+$/, label: "Purchase Order" },
  { pattern: /\/purchase-orders$/,         label: "Purchase Orders" },
  { pattern: /\/inventory\/[^/]+$/,        label: "Inventory Item" },
  { pattern: /\/inventory$/,               label: "Inventory" },
  { pattern: /\/tool-calibration\/new$/,   label: "New Tool" },
  { pattern: /\/tool-calibration\/[^/]+$/, label: "Tool" },
  { pattern: /\/tool-calibration$/,        label: "Tool Calibration" },
  { pattern: /\/invoicing\/[^/]+$/,        label: "Invoice" },
  { pattern: /\/invoicing$/,               label: "Invoicing" },
  { pattern: /\/sop-library\/[^/]+$/,      label: "SOP" },
  { pattern: /\/sop-library$/,             label: "SOP Library" },
  { pattern: /\/training\/[^/]+$/,         label: "Training" },
  { pattern: /\/training$/,               label: "Training" },
  { pattern: /\/parts\/new$/,              label: "New Part" },
  { pattern: /\/parts\/[^/]+$/,           label: "Part" },
  { pattern: /\/parts$/,                   label: "Parts Requests" },
  { pattern: /\/catalog\/[^/]+$/,         label: "Catalog Item" },
  { pattern: /\/catalog$/,                label: "Parts Catalog" },
  { pattern: /\/parts-overview$/,         label: "Parts Overview" },
  { pattern: /\/reports$/,                label: "Reports" },
  { pattern: /\/compliance$/,             label: "Compliance" },
  { pattern: /\/suppliers\/[^/]+$/,       label: "Supplier" },
  { pattern: /\/suppliers$/,              label: "Suppliers" },
  { pattern: /\/flat-rates$/,             label: "Flat Rates" },
  { pattern: /\/canned-actions$/,         label: "Canned Actions" },
  { pattern: /\/settings$/,               label: "Settings" },
]

function getLabel(path: string): string {
  for (const { pattern, label } of ROUTE_LABELS) {
    if (pattern.test(path)) return label
  }
  return "Page"
}

function loadTabs(): BeetTab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as BeetTab[]
  } catch {
    // ignore
  }
  return []
}

function saveTabs(tabs: BeetTab[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
  } catch {
    // ignore
  }
}

export function BeetBoxTabsProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [tabs, setTabs] = useState<BeetTab[]>(() => loadTabs())
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [headerLabel, setHeaderLabel] = useState<string | null>(null)

  // Sync tabs when location changes
  useEffect(() => {
    const path = location.pathname
    setActiveTabPath(path)
    setTabs(prev => {
      const exists = prev.some(t => t.path === path)
      const next = exists ? prev : [...prev, { path, label: getLabel(path) }]
      saveTabs(next)
      return next
    })
  }, [location.pathname])

  // Clear headerLabel when navigating away from a page that set it
  useEffect(() => {
    setHeaderLabel(null)
  }, [location.pathname])

  const closeTab = useCallback((path: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.path === path)
      if (idx === -1) return prev
      const next = prev.filter(t => t.path !== path)
      saveTabs(next)
      if (path === location.pathname) {
        const sibling = next[idx - 1] ?? next[idx] ?? null
        navigate(sibling ? sibling.path : FALLBACK_PATH)
      }
      return next
    })
  }, [location.pathname, navigate])

  const closeAll = useCallback(() => {
    setTabs([])
    saveTabs([])
    navigate(FALLBACK_PATH)
  }, [navigate])

  return (
    <BeetBoxTabsContext.Provider value={{ tabs, activeTabPath, closeTab, closeAll, headerLabel, setHeaderLabel }}>
      {children}
    </BeetBoxTabsContext.Provider>
  )
}

export function useBeetBoxTabs() {
  const ctx = useContext(BeetBoxTabsContext)
  if (!ctx) throw new Error("useBeetBoxTabs must be used within BeetBoxTabsProvider")
  return ctx
}
