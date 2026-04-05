/**
 * OcrTextPane — Companion text panel showing Mistral OCR output
 *
 * Displays the raw_ocr_text for the current page in a scrollable,
 * selectable format. Search query matches are highlighted in gold.
 * Auto-scrolls to the first match when a search query is active.
 *
 * This replaces the Tesseract.js text overlay approach — Mistral is
 * the sole source of truth for OCR text.
 */

import { useRef, useEffect, useMemo } from "react"
import { FileText } from "lucide-react"

interface OcrTextPaneProps {
  ocrText: string
  pageNumber: number
  searchQuery?: string
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function OcrTextPane({ ocrText, pageNumber, searchQuery }: OcrTextPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Highlight search matches in the OCR text
  const rendered = useMemo(() => {
    if (!searchQuery?.trim()) {
      return <span>{ocrText}</span>
    }

    const pattern = new RegExp(`(${escapeRegex(searchQuery)})`, "gi")
    const parts = ocrText.split(pattern)

    return (
      <>
        {parts.map((part, i) =>
          pattern.test(part) ? (
            <mark
              key={i}
              className="bg-yellow-200 dark:bg-yellow-700/60 text-foreground font-semibold px-0.5 rounded-sm"
            >
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </>
    )
  }, [ocrText, searchQuery])

  // Auto-scroll to first match when search query or page changes
  useEffect(() => {
    if (!searchQuery?.trim() || !containerRef.current) return
    const mark = containerRef.current.querySelector("mark")
    if (mark) {
      mark.scrollIntoView({ block: "center", behavior: "smooth" })
    }
  }, [searchQuery, pageNumber, ocrText])

  // Reset scroll to top when page changes (non-search case)
  useEffect(() => {
    if (containerRef.current && !searchQuery?.trim()) {
      containerRef.current.scrollTop = 0
    }
  }, [pageNumber, searchQuery])

  if (!ocrText.trim()) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-neutral-800/50 text-muted-foreground">
        <FileText className="h-6 w-6 mb-2 opacity-30" />
        <p className="text-xs opacity-50">No OCR text available for this page</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-neutral-800/50 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
        <span
          className="text-[9px] font-semibold text-muted-foreground uppercase"
          style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.15em" }}
        >
          OCR Text — Page {pageNumber}
        </span>
      </div>

      {/* Scrollable text */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3"
      >
        <pre
          className="whitespace-pre-wrap text-sm text-neutral-200 leading-relaxed select-text"
          style={{ fontFamily: "var(--font-body)", cursor: "text" }}
        >
          {rendered}
        </pre>
      </div>
    </div>
  )
}
