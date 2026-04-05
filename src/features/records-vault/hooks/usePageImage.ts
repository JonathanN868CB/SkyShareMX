import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

// Returns a signed URL for a pre-rendered page image stored in Supabase Storage.
// These images are generated during OCR ingestion (include_image_base64: true)
// so the browser never has to decode the raw PDF compression (JBIG2, CCITTFax).
//
// Returns null (not an error) if the image hasn't been stored yet for this page,
// allowing the caller to fall back to react-pdf rendering.

async function fetchPageImageUrl(
  recordSourceId: string,
  pageNumber: number,
): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("Not authenticated")

  const resp = await fetch("/.netlify/functions/records-vault-page-image-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ recordSourceId, pageNumber }),
  })

  // 404 = image not stored yet — not an error, caller falls back to react-pdf
  if (resp.status === 404) return null

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "Failed to get page image URL")
  }

  const { signedUrl } = await resp.json()
  return signedUrl as string
}

export function usePageImage(recordSourceId: string | null, pageNumber: number) {
  return useQuery({
    queryKey: ["page-image", recordSourceId, pageNumber],
    queryFn: () => fetchPageImageUrl(recordSourceId!, pageNumber),
    enabled: !!recordSourceId && pageNumber > 0,
    staleTime: 50 * 60 * 1000, // 50 min — under the 60 min signed URL expiry
    retry: false,               // don't retry 404s or auth errors
  })
}
