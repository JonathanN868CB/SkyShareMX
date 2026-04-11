-- Records Vault — AWS Textract geometry and structured-output columns
--
-- Phase A of the Textract migration adds three new JSONB columns to rv_pages
-- that store the richer structured data Textract returns beyond plain text:
--
--   word_geometry      — WORD-level bounding boxes + confidence scores.
--                        Each word includes normalized coordinates (0.0–1.0)
--                        relative to the page image. The Phase B viewer uses
--                        these to project a transparent selectable text layer
--                        onto the scanned page image (Blue Tail style).
--
--   tables_extracted   — TABLE/CELL block structures. Each table is stored as
--                        a row/column grid of cells. Phase C extraction uses
--                        these to map tabular logbook rows directly to
--                        rv_maintenance_events without LLM involvement.
--
--   forms_extracted    — KEY_VALUE_SET pairs from Textract AnalyzeForms.
--                        Pre-printed form fields (e.g. "Total Airframe Hours"
--                        → "12,847.3") come back labeled. Phase C extraction
--                        maps known field names directly to event columns.
--
-- rv_record_sources gets two tracking columns for the S3/Textract pipeline:
--
--   s3_key             — The S3 object key that was submitted to Textract.
--                        Format: records-vault/{tail}/{doc-type}/{filename}
--                        Stored so the viewer and pipeline can reference the
--                        canonical source location independent of storage_path.
--
--   textract_job_id    — The Textract async job ID (from StartDocumentAnalysis).
--                        Stored so the completion webhook can match the job
--                        back to the rv_record_sources row without a DB scan.
--
-- ─── rv_pages: Textract geometry columns ─────────────────────────────────────

ALTER TABLE rv_pages
  ADD COLUMN IF NOT EXISTS word_geometry    JSONB,
  ADD COLUMN IF NOT EXISTS tables_extracted JSONB,
  ADD COLUMN IF NOT EXISTS forms_extracted  JSONB;

COMMENT ON COLUMN rv_pages.word_geometry IS
  'Array of {text, confidence, geometry: {left, top, width, height}} objects — '
  'one entry per Textract WORD block. Normalized coordinates (0.0–1.0) relative '
  'to the page image. Used by the viewer to overlay a selectable text layer.';

COMMENT ON COLUMN rv_pages.tables_extracted IS
  'Array of table objects extracted by Textract AnalyzeTables. Each table has '
  '{ tableIndex, rows, cols, cells: [{row, col, rowSpan, colSpan, text, confidence}] }. '
  'Used by Phase C extraction to map logbook entry rows directly to maintenance events.';

COMMENT ON COLUMN rv_pages.forms_extracted IS
  'Array of key/value pairs from Textract AnalyzeForms. Each entry has '
  '{ key, value, keyConfidence, valueConfidence }. '
  'Used by Phase C extraction to populate maintenance event fields from pre-printed form labels.';

-- ─── rv_record_sources: S3 and Textract tracking columns ─────────────────────

ALTER TABLE rv_record_sources
  ADD COLUMN IF NOT EXISTS s3_key          TEXT,
  ADD COLUMN IF NOT EXISTS textract_job_id TEXT;

COMMENT ON COLUMN rv_record_sources.s3_key IS
  'S3 object key submitted to Textract. Format: records-vault/{tail}/{doc-type}/{filename}. '
  'Canonical document location in the S3 bucket, independent of Supabase storage_path.';

COMMENT ON COLUMN rv_record_sources.textract_job_id IS
  'Textract async job ID from StartDocumentAnalysis. Used by the SNS completion webhook '
  'to locate the correct rv_record_sources row without a key scan.';

-- Index on textract_job_id so the completion webhook lookup is fast
CREATE INDEX IF NOT EXISTS rv_record_sources_textract_job_idx
  ON rv_record_sources (textract_job_id)
  WHERE textract_job_id IS NOT NULL;
