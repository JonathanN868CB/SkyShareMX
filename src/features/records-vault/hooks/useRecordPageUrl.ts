import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

// Returns a 60-minute signed URL for the source PDF.
// Used as the src of an <iframe> so the browser's native PDF renderer
// handles all compression formats (JBIG2, CCITTFax, JPEG, etc.).
async function fetchPdfUrl(recordSourceId: string): Promise<string> {
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

export function useRecordPageUrl(recordSourceId: string | null) {
  return useQuery({
    queryKey: ["record-page-url", recordSourceId],
    queryFn: () => fetchPdfUrl(recordSourceId!),
    enabled: !!recordSourceId,
    staleTime: 55 * 60 * 1000,
    retry: 1,
  })
}
