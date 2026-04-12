import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

/**
 * Fetches signed URLs for a set of page images in one round trip.
 *
 * The viewer's thumbnail strip calls this once per visible window instead of
 * firing N individual requests. Null values mean the page isn't rasterized
 * yet — render a skeleton and let the hook re-fetch on the next window shift.
 */
async function fetchBatch(
  recordSourceId: string,
  pageNumbers: number[],
): Promise<Record<number, string | null>> {
  if (pageNumbers.length === 0) return {}

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}

  const resp = await fetch("/.netlify/functions/records-vault-page-image-urls-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ recordSourceId, pageNumbers }),
  })

  if (!resp.ok) return {}

  const { urls } = await resp.json()
  return (urls as Record<number, string | null>) ?? {}
}

// Poll while any entry is null (rasterization in flight). Exponential backoff
// stops hammering the endpoint on a stuck document.
const BATCH_POLL_SCHEDULE_MS = [4_000, 6_000, 10_000, 15_000, 20_000]
const BATCH_POLL_TIMEOUT_MS  = 3 * 60_000

export function useRecordPageImageUrlBatch(
  recordSourceId: string | null,
  pageNumbers: number[],
) {
  // Stable key — sort so ordering changes in the caller don't bust the cache.
  const sorted = [...pageNumbers].sort((a, b) => a - b)
  const key = sorted.join(",")

  return useQuery({
    queryKey: ["record-page-image-urls-batch", recordSourceId, key],
    queryFn: () => fetchBatch(recordSourceId!, sorted),
    enabled: !!recordSourceId && sorted.length > 0,
    staleTime: 55 * 60 * 1000,
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data as Record<number, string | null> | undefined
      if (!data) return false
      const anyMissing = sorted.some((p) => !data[p])
      if (!anyMissing) return false
      const firstFetchAt = query.state.dataUpdatedAt || Date.now()
      const elapsed = Date.now() - firstFetchAt
      if (elapsed > BATCH_POLL_TIMEOUT_MS) return false
      const idx = Math.min(query.state.fetchFailureCount, BATCH_POLL_SCHEDULE_MS.length - 1)
      return BATCH_POLL_SCHEDULE_MS[idx]
    },
  })
}
