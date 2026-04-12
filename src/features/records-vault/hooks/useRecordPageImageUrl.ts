import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

/**
 * Fetches a signed URL for a pre-rendered page image (uploaded during ingestion).
 * Returns null if no image exists for this page (404 from the server).
 * When an image IS available, the viewer uses <img> instead of PDF.js —
 * guaranteeing correct rendering regardless of PDF compression format.
 */
async function fetchPageImageUrl(
  recordSourceId: string,
  pageNumber: number,
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const resp = await fetch("/.netlify/functions/records-vault-page-image-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ recordSourceId, pageNumber }),
  })

  if (!resp.ok) return null // No image available — fall back to PDF.js

  const { signedUrl } = await resp.json()
  return (signedUrl as string) ?? null
}

// Exponential backoff schedule for rasterization polling. Capped so a single
// viewer session fires at most a few dozen polls instead of hundreds on a
// stuck document. Early ticks are fast for the common case (rasterization
// finishes in seconds), later ticks stretch out so a stalled document doesn't
// burn a poll every 5 seconds forever.
const POLL_SCHEDULE_MS = [2_000, 2_000, 5_000, 5_000, 10_000, 10_000, 15_000, 20_000]
const POLL_TIMEOUT_MS  = 2 * 60_000 // stop polling after 2 minutes of nothing

export function useRecordPageImageUrl(
  recordSourceId: string | null,
  pageNumber: number,
  options?: { pollWhileMissing?: boolean },
) {
  return useQuery({
    queryKey: ["record-page-image-url", recordSourceId, pageNumber],
    queryFn: () => fetchPageImageUrl(recordSourceId!, pageNumber),
    enabled: !!recordSourceId,
    staleTime: 55 * 60 * 1000, // 55 min (images don't change)
    retry: false, // Don't retry 404s
    // For S3-ingested docs the image may not exist yet because the
    // rasterize-background function is still running. Back off on each tick
    // and stop entirely after POLL_TIMEOUT_MS so a stuck job doesn't trigger
    // an endless polling storm against the functions endpoint.
    refetchInterval: (query) => {
      if (!options?.pollWhileMissing) return false
      if (query.state.data) return false
      const firstFetchAt = query.state.dataUpdatedAt || query.state.errorUpdatedAt || Date.now()
      const elapsed = Date.now() - firstFetchAt
      if (elapsed > POLL_TIMEOUT_MS) return false
      const fetchCount = query.state.fetchFailureCount + (query.state.data === null ? 1 : 0)
      const idx = Math.min(fetchCount, POLL_SCHEDULE_MS.length - 1)
      return POLL_SCHEDULE_MS[idx]
    },
  })
}
