-- ─── Records Vault Phase 3 — RAG Embeddings + Page Images ────────────────────
--
-- Adds:
--   pgvector extension
--   rv_pages: page_image_path, ocr_bbox_data
--   rv_record_sources: chunk_status, chunks_generated
--   rv_page_chunks — one row per text chunk with vector(1024) embedding
--   rv_match_chunks() — cosine similarity search RPC

-- ─── 1. pgvector extension ────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 2. Columns on rv_pages ───────────────────────────────────────────────────

ALTER TABLE rv_pages
  ADD COLUMN IF NOT EXISTS page_image_path TEXT,
  ADD COLUMN IF NOT EXISTS ocr_bbox_data   JSONB;

-- ─── 3. Columns on rv_record_sources ─────────────────────────────────────────

ALTER TABLE rv_record_sources
  ADD COLUMN IF NOT EXISTS chunk_status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (chunk_status IN ('pending','chunking','chunked','failed')),
  ADD COLUMN IF NOT EXISTS chunks_generated  INTEGER NOT NULL DEFAULT 0;

-- ─── 4. rv_page_chunks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rv_page_chunks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id           UUID        NOT NULL REFERENCES rv_pages(id) ON DELETE CASCADE,
  aircraft_id       UUID        NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
  record_source_id  UUID        NOT NULL REFERENCES rv_record_sources(id) ON DELETE CASCADE,
  chunk_index       INTEGER     NOT NULL,
  chunk_text        TEXT        NOT NULL,
  embedding         vector(1024),
  created_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE (page_id, chunk_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS rv_chunks_page_idx     ON rv_page_chunks(page_id);
CREATE INDEX IF NOT EXISTS rv_chunks_source_idx   ON rv_page_chunks(record_source_id);
CREATE INDEX IF NOT EXISTS rv_chunks_aircraft_idx ON rv_page_chunks(aircraft_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS rv_chunks_embedding_idx ON rv_page_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─── 5. rv_match_chunks — vector similarity search RPC ───────────────────────

CREATE OR REPLACE FUNCTION rv_match_chunks(
  query_embedding   vector(1024),
  p_aircraft_id     UUID    DEFAULT NULL,
  p_limit           INT     DEFAULT 10,
  p_threshold       FLOAT   DEFAULT 0.4
)
RETURNS TABLE (
  chunk_id          UUID,
  page_id           UUID,
  record_source_id  UUID,
  aircraft_id       UUID,
  chunk_index       INT,
  chunk_text        TEXT,
  original_filename TEXT,
  source_category   TEXT,
  page_number       INT,
  page_image_path   TEXT,
  similarity        FLOAT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    c.id                AS chunk_id,
    c.page_id,
    c.record_source_id,
    c.aircraft_id,
    c.chunk_index,
    c.chunk_text,
    rs.original_filename,
    rs.source_category,
    p.page_number,
    p.page_image_path,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM rv_page_chunks c
  JOIN rv_pages p           ON p.id  = c.page_id
  JOIN rv_record_sources rs ON rs.id = c.record_source_id
  WHERE
    (p_aircraft_id IS NULL OR c.aircraft_id = p_aircraft_id)
    AND 1 - (c.embedding <=> query_embedding) >= p_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT p_limit;
$$;

-- ─── 6. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE rv_page_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rv_chunks_select" ON rv_page_chunks
  FOR SELECT USING (has_permission('Records Vault'::app_section, auth.uid()));

CREATE POLICY "rv_chunks_service_insert" ON rv_page_chunks
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "rv_chunks_service_update" ON rv_page_chunks
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "rv_chunks_service_delete" ON rv_page_chunks
  FOR DELETE USING (auth.role() = 'service_role');
