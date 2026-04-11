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
    // rasterize-background function is still running. Poll every 5s until
    // it appears so the viewer flips from "Processing" to the real page
    // automatically as soon as rasterization finishes.
    refetchInterval: (query) =>
      options?.pollWhileMissing && !query.state.data ? 5_000 : false,
  })
}
