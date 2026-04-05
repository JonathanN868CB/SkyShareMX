import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

// Returns a signed URL for a single page PDF (fast, ~200 KB) or the full PDF as fallback.
// pageNumber: 1-based. When provided, the Netlify function extracts and caches
// the single page from the full document — subsequent loads of the same page are instant.
async function fetchPdfUrl(recordSourceId: string, pageNumber?: number): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Not authenticated")

  const resp = await fetch("/.netlify/functions/records-vault-page-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ recordSourceId, pageNumber }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "Failed to get PDF URL")
  }

  const { signedUrl } = await resp.json()
  return signedUrl as string
}

export function useRecordPageUrl(recordSourceId: string | null, pageNumber?: number) {
  return useQuery({
    queryKey: ["record-page-url", recordSourceId, pageNumber ?? "full"],
    queryFn: () => fetchPdfUrl(recordSourceId!, pageNumber),
    enabled: !!recordSourceId,
    staleTime: 55 * 60 * 1000,
    retry: 1,
  })
}
