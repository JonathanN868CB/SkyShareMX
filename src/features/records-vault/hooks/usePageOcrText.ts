import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export interface PageOcrData {
  raw_ocr_text: string | null
  page_dimensions: { width: number; height: number } | null
}

/**
 * Fetches Mistral OCR text and page dimensions for a specific page.
 * Used by the OCR text companion pane to display clean, selectable text
 * alongside the page image — with search highlighting.
 */
export function usePageOcrText(
  recordSourceId: string | null,
  pageNumber: number,
  enabled = true,
) {
  return useQuery<PageOcrData | null>({
    queryKey: ["page-ocr-text", recordSourceId, pageNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_pages")
        .select("raw_ocr_text, page_dimensions")
        .eq("record_source_id", recordSourceId!)
        .eq("page_number", pageNumber)
        .single()

      if (error || !data) return null
      return data as PageOcrData
    },
    enabled: !!recordSourceId && enabled,
    staleTime: Infinity,
  })
}
