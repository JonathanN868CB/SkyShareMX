-- ─── Records Vault — Full-text page search + bounding box columns ────────────
--
-- Adds:
--   rv_search_pages()       — page-level full-text search RPC with fleet scope
--   GIN index               — on rv_pages.raw_ocr_text for fast ts_vector search
--   page_image_path         — optional cached page image path in storage
--   page_dimensions         — width/height/dpi from OCR (for highlight overlay positioning)
--   word_positions          — block-level bounding boxes from OCR (for search highlighting)
--
-- The search function supports:
--   - Aircraft-scoped or fleet-wide queries (p_aircraft_id = NULL → all aircraft)
--   - Category and source document filtering
--   - Relevance or date-descending sort
--   - ts_headline excerpt generation with <b></b> markers
--   - Pagination via LIMIT/OFFSET
--
-- Also supports raw substring matching for part numbers, serial numbers,
-- work order numbers, and other identifiers that PostgreSQL's english
-- text-search parser might not tokenize correctly (e.g. "31556", "PC-12/47E").

-- ─── 1. GIN index for full-text search on OCR text ──────────────────────────

CREATE INDEX IF NOT EXISTS rv_pages_ocr_search_idx
  ON rv_pages USING GIN(to_tsvector('simple', COALESCE(raw_ocr_text, '')));

-- ─── 2. New columns for page rendering and highlight overlays ───────────────

ALTER TABLE rv_pages
  ADD COLUMN IF NOT EXISTS page_image_path  TEXT,
  ADD COLUMN IF NOT EXISTS page_dimensions  JSONB,
  ADD COLUMN IF NOT EXISTS word_positions   JSONB;

COMMENT ON COLUMN rv_pages.page_image_path IS 'Storage path to cached page image (e.g. page-images/{sourceId}/{pageNum}.webp)';
COMMENT ON COLUMN rv_pages.page_dimensions IS '{"width": N, "height": N, "dpi": N} — page dimensions from OCR for scaling highlight overlays';
COMMENT ON COLUMN rv_pages.word_positions  IS 'Array of {text, bbox: {x, y, w, h}} objects from OCR — block-level bounding boxes for search highlighting';

-- ─── 3. rv_search_pages — the core search RPC ──────────────────────────────

CREATE OR REPLACE FUNCTION rv_search_pages(
  p_query       TEXT,
  p_aircraft_id UUID    DEFAULT NULL,
  p_category    TEXT    DEFAULT NULL,
  p_source_id   UUID    DEFAULT NULL,
  p_sort_by     TEXT    DEFAULT 'relevance',
  p_limit       INT     DEFAULT 25,
  p_offset      INT     DEFAULT 0
)
RETURNS TABLE (
  page_id               UUID,
  record_source_id      UUID,
  aircraft_id           UUID,
  page_number           INT,
  original_filename     TEXT,
  source_category       TEXT,
  observed_registration TEXT,
  date_range_start      DATE,
  date_range_end        DATE,
  ocr_excerpt           TEXT,
  rank                  FLOAT4
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tsquery  TSQUERY;
  v_like_pat TEXT;
BEGIN
  -- Build the tsquery using 'simple' config to preserve part numbers / identifiers
  v_tsquery := websearch_to_tsquery('simple', p_query);

  -- Also build a case-insensitive LIKE pattern for substring fallback
  -- This catches identifiers that FTS tokenizes oddly (e.g. "31556" inside "W/O: 31556")
  v_like_pat := '%' || p_query || '%';

  RETURN QUERY
  SELECT
    p.id                    AS page_id,
    rs.id                   AS record_source_id,
    rs.aircraft_id,
    p.page_number,
    rs.original_filename,
    rs.source_category,
    rs.observed_registration,
    rs.date_range_start,
    rs.date_range_end,
    ts_headline(
      'simple',
      COALESCE(p.raw_ocr_text, ''),
      v_tsquery,
      'StartSel=<b>, StopSel=</b>, MaxWords=30, MinWords=12, MaxFragments=2, FragmentDelimiter= … '
    )                       AS ocr_excerpt,
    COALESCE(
      ts_rank(to_tsvector('simple', COALESCE(p.raw_ocr_text, '')), v_tsquery),
      0.0
    )::FLOAT4               AS rank
  FROM rv_pages p
  JOIN rv_record_sources rs ON rs.id = p.record_source_id
  WHERE
    -- Match: full-text OR substring fallback
    (
      to_tsvector('simple', COALESCE(p.raw_ocr_text, '')) @@ v_tsquery
      OR p.raw_ocr_text ILIKE v_like_pat
    )
    -- Scope filters
    AND (p_aircraft_id IS NULL OR rs.aircraft_id = p_aircraft_id)
    AND (p_category    IS NULL OR rs.source_category = p_category)
    AND (p_source_id   IS NULL OR rs.id = p_source_id)
    -- Only search indexed documents
    AND rs.ingestion_status = 'indexed'
  ORDER BY
    CASE WHEN p_sort_by = 'relevance'
      THEN COALESCE(ts_rank(to_tsvector('simple', COALESCE(p.raw_ocr_text, '')), v_tsquery), 0)
      ELSE 0
    END DESC,
    CASE WHEN p_sort_by = 'date_desc'
      THEN rs.date_range_end
      ELSE NULL
    END DESC NULLS LAST,
    p.page_number ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION rv_search_pages IS 'Full-text page search across Records Vault. Supports fleet-wide (p_aircraft_id=NULL) or aircraft-scoped queries. Uses simple tokenizer to preserve part numbers and identifiers. Falls back to ILIKE for substring matches.';
