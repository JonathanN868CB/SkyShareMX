import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { WordGeometry } from "../types"

export interface PageGeometryData {
  page_image_path:  string | null
  word_geometry:    WordGeometry[] | null
  page_dimensions:  { width: number; height: number } | null
  raw_ocr_text:     string | null   // kept for search excerpt fallback
}

/**
 * Fetches the geometry and rendering data for a single rv_pages row.
 *
 * word_geometry is populated by the Textract pipeline. For Mistral-indexed
 * documents it will be null — the viewer falls back to plain image rendering
 * with no text overlay.
 *
 * page_image_path is populated by either pipeline when a page image is stored
 * in Supabase Storage. When null the viewer falls back to PdfPageRenderer.
 */
export function usePageGeometry(
  recordSourceId: string | null,
  pageNumber: number,
) {
  return useQuery<PageGeometryData | null>({
    queryKey: ["page-geometry", recordSourceId, pageNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rv_pages")
        .select("page_image_path, word_geometry, page_dimensions, raw_ocr_text")
        .eq("record_source_id", recordSourceId!)
        .eq("page_number", pageNumber)
        .single()

      if (error || !data) return null
      return data as PageGeometryData
    },
    enabled: !!recordSourceId && pageNumber > 0,
    staleTime: Infinity,
  })
}
