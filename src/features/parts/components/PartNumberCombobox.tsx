import { useState, useEffect, useRef } from "react"
import { Package } from "lucide-react"
import {
  searchCatalog,
  searchCatalogFamily,
  type CatalogSearchResult,
} from "@/features/beet-box/services/catalog"

interface Props {
  value: string
  onChange: (partNumber: string, catalogId: string | null, description: string | null) => void
  hasError?: boolean
}

export function PartNumberCombobox({ value, onChange, hasError }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<CatalogSearchResult[]>([])
  const [familyResults, setFamilyResults] = useState<CatalogSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [dropUp, setDropUp] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Sync external value changes
  useEffect(() => { setQuery(value) }, [value])

  // Detect drop direction when panel opens
  useEffect(() => {
    if (!open || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDropUp(window.innerHeight - rect.bottom < 320)
  }, [open])

  // Search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim() || query.length < 2) {
      setResults([])
      setFamilyResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const primary = await searchCatalog(query.trim())
        setResults(primary)
        setSelectedIndex(-1)

        // Family search: only worth running when there's a dash in the query
        if (query.includes("-")) {
          const family = await searchCatalogFamily(query.trim(), primary.map(r => r.id))
          setFamilyResults(family)
        } else {
          setFamilyResults([])
        }
      } catch {
        setResults([])
        setFamilyResults([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelect(result: CatalogSearchResult) {
    setQuery(result.partNumber)
    onChange(result.partNumber, result.id, result.description)
    setOpen(false)
  }

  function handleUseRaw() {
    onChange(query.trim(), null, null)
    setOpen(false)
  }

  const allResults = [...results, ...familyResults]
  const totalItems = allResults.length + (query.trim() ? 1 : 0) // +1 for "use raw"

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % totalItems)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < allResults.length) {
        handleSelect(allResults[selectedIndex])
      } else if (selectedIndex === allResults.length || allResults.length === 0) {
        handleUseRaw()
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const showDropdown = open && query.trim().length >= 2

  const panelStyle: React.CSSProperties = {
    background: "hsl(0 0% 13%)",
    borderColor: "hsl(0 0% 22%)",
    maxHeight: "320px",
    overflowY: "auto",
    ...(dropUp
      ? { bottom: "calc(100% + 4px)", top: "auto" }
      : { top: "calc(100% + 4px)", bottom: "auto" }),
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
          onChange(e.target.value, null, null)
        }}
        onFocus={() => { if (query.trim().length >= 2) setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder="Type part number..."
        className="w-full rounded-md px-3 py-2 text-sm font-mono"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: hasError ? "1px solid rgba(255,100,100,0.5)" : "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.9)",
        }}
      />

      {showDropdown && (
        <div
          className="absolute z-50 left-0 right-0 rounded-lg border overflow-hidden shadow-xl"
          style={panelStyle}
        >
          {loading && (
            <div className="px-3 py-2.5 text-xs text-white/30">Searching catalog...</div>
          )}

          {/* ── Primary matches ── */}
          {!loading && results.length > 0 && (
            <>
              {results.map((r, idx) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  isSelected={selectedIndex === idx}
                  onSelect={handleSelect}
                  onHover={() => setSelectedIndex(idx)}
                  showBorder
                />
              ))}
            </>
          )}

          {/* ── Similar / family numbers ── */}
          {!loading && familyResults.length > 0 && (
            <>
              <div
                className="px-3 py-1.5 flex items-center gap-2"
                style={{ background: "hsl(0 0% 11%)", borderTop: "1px solid hsl(0 0% 19%)" }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "rgba(212,160,23,0.55)", fontFamily: "var(--font-heading)" }}
                >
                  Similar numbers
                </span>
              </div>
              {familyResults.map((r, idx) => {
                const globalIdx = results.length + idx
                return (
                  <ResultRow
                    key={r.id}
                    result={r}
                    isSelected={selectedIndex === globalIdx}
                    onSelect={handleSelect}
                    onHover={() => setSelectedIndex(globalIdx)}
                    showBorder
                    dimmed
                  />
                )
              })}
            </>
          )}

          {/* ── "Use as-is" fallback ── */}
          {!loading && query.trim() && (
            <button
              type="button"
              onClick={handleUseRaw}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors"
              style={{
                background: selectedIndex === allResults.length ? "rgba(212,160,23,0.12)" : "transparent",
                borderTop: allResults.length > 0 ? "1px solid hsl(0 0% 19%)" : "none",
              }}
              onMouseEnter={() => setSelectedIndex(allResults.length)}
            >
              <span className="text-xs text-white/40">
                Use "<span className="font-mono text-white/60">{query.trim()}</span>"
                {allResults.length > 0 ? " (not in catalog)" : ""}
              </span>
            </button>
          )}

          {!loading && results.length === 0 && familyResults.length === 0 && !query.trim() && (
            <div className="px-3 py-4 text-xs text-white/25 text-center">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared row component ─────────────────────────────────────────────────────

function ResultRow({
  result,
  isSelected,
  onSelect,
  onHover,
  showBorder,
  dimmed,
}: {
  result: CatalogSearchResult
  isSelected: boolean
  onSelect: (r: CatalogSearchResult) => void
  onHover: () => void
  showBorder?: boolean
  dimmed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(result)}
      className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
      style={{
        background: isSelected ? "rgba(212,160,23,0.12)" : "transparent",
        borderBottom: showBorder ? "1px solid hsl(0 0% 16%)" : "none",
      }}
      onMouseEnter={onHover}
    >
      <div className="flex-1 min-w-0">
        <span
          className="font-mono text-sm font-semibold"
          style={{ color: dimmed ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.85)" }}
        >
          {result.partNumber}
        </span>
        {result.description && (
          <span className="text-xs text-white/35 ml-2 truncate">{result.description}</span>
        )}
      </div>
      {result.inventoryOnHand > 0 ? (
        <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 flex-shrink-0">
          <Package className="w-3 h-3" />
          {result.inventoryOnHand} on hand
        </span>
      ) : (
        <span className="text-[10px] text-white/20 flex-shrink-0">0 on hand</span>
      )}
    </button>
  )
}
