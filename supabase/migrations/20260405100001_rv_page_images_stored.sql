-- Add page_images_stored counter to rv_record_sources
-- Tracks how many pages had pre-rendered images stored during ingestion.
-- When > 0, the viewer uses image-based rendering for those pages (bypasses PDF.js codec issues).

ALTER TABLE rv_record_sources
  ADD COLUMN IF NOT EXISTS page_images_stored INT DEFAULT 0;

COMMENT ON COLUMN rv_record_sources.page_images_stored IS
  'Number of pages with pre-rendered images stored during ingestion. Image-based rendering bypasses JBIG2/CCITTFax codec issues in PDF.js.';
