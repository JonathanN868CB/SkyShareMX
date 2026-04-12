import { useEffect, useState } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/ui/sheet"

type ChunkRow = {
  id:            string
  page_number:   number | null
  chunk_index:   number
  chunk_text:    string
  char_length:   number
  dilution_flag: DilutionFlag | null
}

type DilutionFlag = {
  reason: "repeated_chars" | "low_unique_words"
  score:  number
}

interface Props {
  open:             boolean
  onOpenChange:     (open: boolean) => void
  recordSourceId:   string | null
  filename:         string | null
}

// ─── Dilution heuristics ──────────────────────────────────────────────────────
// Flags chunks that look like OCR noise / repeated form boilerplate / multi-
// language column dumps that would poison RAG retrieval. Both heuristics run
// in the browser — the chunk rows already include the text.

function detectDilution(text: string): DilutionFlag | null {
  const t = text.trim()
  if (t.length < 40) return null

  // 1. Repeated character sequences: any run of the same char longer than
  //    60% of the chunk signals garbage OCR (e.g. "........." or "-----").
  //    Cheap pass: longest run divided by total length.
  let maxRun = 1
  let currentRun = 1
  for (let i = 1; i < t.length; i++) {
    if (t[i] === t[i - 1]) {
      currentRun++
      if (currentRun > maxRun) maxRun = currentRun
    } else {
      currentRun = 1
    }
  }
  const repeatedRatio = maxRun / t.length
  if (repeatedRatio > 0.6) {
    return { reason: "repeated_chars", score: repeatedRatio }
  }

  // 2. Unique word ratio: if fewer than 40% of words are distinct, the chunk
  //    is almost certainly a column dump — the same header repeated across a
  //    form in multiple languages, for example. This is what broke Dwight's
  //    recall on the Swiss multilingual cover sheet.
  const words = t
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}<>/\\"'`]+/)
    .filter((w) => w.length >= 3)
  if (words.length >= 10) {
    const unique = new Set(words).size
    const uniqueRatio = unique / words.length
    if (uniqueRatio < 0.4) {
      return { reason: "low_unique_words", score: uniqueRatio }
    }
  }

  return null
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export function ChunkInspectorDrawer({ open, onOpenChange, recordSourceId, filename }: Props) {
  const [chunks, setChunks]   = useState<ChunkRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !recordSourceId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        // rv_page_chunks has chunk_text + a page_id reference; we join to
        // rv_pages to resolve page_number for display.
        const { data, error: qErr } = await supabase
          .from("rv_page_chunks")
          .select("id, chunk_index, chunk_text, rv_pages!inner(page_number)")
          .eq("record_source_id", recordSourceId)
          .order("chunk_index", { ascending: true })
          .limit(500)
        if (qErr) throw qErr
        if (cancelled) return

        const rows: ChunkRow[] = (data ?? []).map((r) => {
          const text = (r.chunk_text ?? "") as string
          // Supabase returns the joined row as an object or an array depending
          // on the relationship cardinality. rv_pages is a parent, so it's an
          // object here — but we guard both shapes.
          const pages = (r as { rv_pages?: unknown }).rv_pages
          const pageNumber = Array.isArray(pages)
            ? (pages[0] as { page_number?: number })?.page_number ?? null
            : (pages as { page_number?: number } | null)?.page_number ?? null
          return {
            id:            r.id as string,
            page_number:   pageNumber,
            chunk_index:   r.chunk_index as number,
            chunk_text:    text,
            char_length:   text.length,
            dilution_flag: detectDilution(text),
          }
        })
        setChunks(rows)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [open, recordSourceId])

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dilutedCount = chunks.filter((c) => c.dilution_flag !== null).length
  const avgLen = chunks.length > 0
    ? Math.round(chunks.reduce((n, c) => n + c.char_length, 0) / chunks.length)
    : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle
            style={{
              fontFamily: "var(--font-heading)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontSize: "14px",
            }}
          >
            Chunk Inspector
          </SheetTitle>
          <SheetDescription className="text-xs truncate">
            {filename ?? "—"}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && chunks.length === 0 && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            No chunks yet for this source.
          </p>
        )}

        {!loading && !error && chunks.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile label="Chunks" value={chunks.length} />
              <StatTile label="Avg chars" value={avgLen} />
              <StatTile
                label="Diluted"
                value={dilutedCount}
                accent={dilutedCount > 0 ? "amber" : undefined}
              />
            </div>

            <div className="mt-4 space-y-2">
              {chunks.map((c) => {
                const isOpen = expanded.has(c.id)
                const preview = c.chunk_text.slice(0, 160)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleExpanded(c.id)}
                    className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                      c.dilution_flag
                        ? "border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                      <span>p{c.page_number ?? "?"}</span>
                      <span>·</span>
                      <span>#{c.chunk_index}</span>
                      <span>·</span>
                      <span>{c.char_length} chars</span>
                      {c.dilution_flag && (
                        <span className="ml-auto inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          {c.dilution_flag.reason === "repeated_chars"
                            ? `repeated chars (${Math.round(c.dilution_flag.score * 100)}%)`
                            : `low unique words (${Math.round(c.dilution_flag.score * 100)}%)`}
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-xs text-foreground/90 ${
                        isOpen ? "whitespace-pre-wrap" : "line-clamp-2"
                      }`}
                    >
                      {isOpen ? c.chunk_text : preview}
                    </p>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: "amber"
}) {
  const accentColor =
    accent === "amber" ? "text-amber-600 dark:text-amber-400" : "text-foreground"
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p
        className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${accentColor}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}
