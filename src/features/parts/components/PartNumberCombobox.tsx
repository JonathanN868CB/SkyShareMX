import { useState, useEffect, useRef } from "react"
import { Package } from "lucide-react"
import { searchCatalog, type CatalogSearchResult } from "@/features/beet-box/services/catalog"

interface Props {
  value: string
  onChange: (partNumber: string, catalogId: string | null, description: string | null) => void
  hasError?: boolean
}

export function PartNumberCombobox({ value, onChange, hasError }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<CatalogSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Sync external value changes
  useEffect(() => { setQuery(value) }, [value])

  // Search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchCatalog(query.trim())
        setResults(data)
        setSelectedIndex(-1)
      } catch {
        setResults([])
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return

    const totalItems = results.length + (query.trim() ? 1 : 0) // +1 for "use raw" option

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % totalItems)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex])
      } else if (selectedIndex === results.length || results.length === 0) {
        handleUseRaw()
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
          // If user clears or edits, reset catalog link
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
          className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border overflow-hidden shadow-xl"
          style={{
            background: "hsl(0 0% 13%)",
            borderColor: "hsl(0 0% 22%)",
            maxHeight: "280px",
            overflowY: "auto",
          }}
        >
          {loading && (
            <div className="px-3 py-2.5 text-xs text-white/30">Searching catalog...</div>
          )}

          {!loading && results.length > 0 && results.map((r, idx) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
              style={{
                background: selectedIndex === idx ? "rgba(212,160,23,0.12)" : "transparent",
                borderBottom: "1px solid hsl(0 0% 16%)",
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="flex-1 min-w-0">
                <span className="font-mono text-sm font-semibold text-white/85">{r.partNumber}</span>
                {r.description && (
                  <span className="text-xs text-white/35 ml-2 truncate">{r.description}</span>
                )}
              </div>
              {r.inventoryOnHand > 0 ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 flex-shrink-0">
                  <Package className="w-3 h-3" />
                  {r.inventoryOnHand} on hand
                </span>
              ) : (
                <span className="text-[10px] text-white/20 flex-shrink-0">0 on hand</span>
              )}
            </button>
          ))}

          {/* "Use as-is" fallback when query doesn't match */}
          {!loading && query.trim() && (
            <button
              type="button"
              onClick={handleUseRaw}
              className="w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors"
              style={{
                background: selectedIndex === results.length ? "rgba(212,160,23,0.12)" : "transparent",
              }}
              onMouseEnter={() => setSelectedIndex(results.length)}
            >
              <span className="text-xs text-white/40">
                Use "<span className="font-mono text-white/60">{query.trim()}</span>"
                {results.length > 0 ? " (not in catalog)" : ""}
              </span>
            </button>
          )}

          {!loading && results.length === 0 && !query.trim() && (
            <div className="px-3 py-4 text-xs text-white/25 text-center">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  )
}
