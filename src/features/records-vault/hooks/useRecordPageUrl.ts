import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

async function fetchPageUrl(recordSourceId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Not authenticated")

  const resp = await fetch("/.netlify/functions/records-vault-page-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ recordSourceId }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "Failed to get PDF URL")
  }

  const { signedUrl } = await resp.json()
  return signedUrl as string
}

// Fetches a 60-min signed URL for a source PDF.
// Only enabled when a recordSourceId is provided.
// The signed URL is cached for 55 minutes (slightly under expiry).
export function useRecordPageUrl(recordSourceId: string | null) {
  return useQuery({
    queryKey: ["record-page-url", recordSourceId],
    queryFn: () => fetchPageUrl(recordSourceId!),
    enabled: !!recordSourceId,
    staleTime: 55 * 60 * 1000,
    retry: 1,
  })
}
