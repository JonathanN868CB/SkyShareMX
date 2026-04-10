-- ============================================================================
-- Customer Work Quotes — Schema Support
-- ============================================================================
-- Adds a "quote" mode to bb_work_orders. Quotes reuse the entire work order
-- schema (items, parts, labor, status_history, audit_trail) and are
-- discriminated via the existing wo_type column.
--
-- Key decisions:
--   * One table, wo_type = 'work_order' | 'quote' discriminator
--   * Separate bb_quote_status enum (quotes don't use WO statuses)
--   * Separate Q-YY-NNNN numbering via bb_quote_number_seq
--   * Bidirectional link: quote.converted_to_wo_id <-> wo.source_quote_id
-- ============================================================================

-- 1. Quote-specific status enum
CREATE TYPE bb_quote_status AS ENUM (
  'draft',
  'sent',
  'approved',
  'declined',
  'expired',
  'converted'
);

-- 2. Add quote-related columns to bb_work_orders
ALTER TABLE bb_work_orders
  ADD COLUMN quote_status       bb_quote_status,
  ADD COLUMN quote_sent_at      timestamptz,
  ADD COLUMN quote_expires_at   timestamptz,
  ADD COLUMN source_quote_id    uuid REFERENCES bb_work_orders(id) ON DELETE SET NULL,
  ADD COLUMN converted_to_wo_id uuid REFERENCES bb_work_orders(id) ON DELETE SET NULL;

-- 3. Normalize existing wo_type values (currently stores "—" placeholder)
UPDATE bb_work_orders
   SET wo_type = 'work_order'
 WHERE wo_type IS NULL OR wo_type = '—' OR wo_type = '';

-- 4. Constrain wo_type to known values + make NOT NULL with default
ALTER TABLE bb_work_orders
  ADD CONSTRAINT bb_work_orders_wo_type_check
  CHECK (wo_type IN ('work_order', 'quote'));

ALTER TABLE bb_work_orders
  ALTER COLUMN wo_type SET DEFAULT 'work_order',
  ALTER COLUMN wo_type SET NOT NULL;

-- 5. Quote-specific data integrity rules
--    When wo_type='quote', quote_status must be set.
--    When wo_type='work_order', quote_status must be NULL (unless converted later
--    and we want to clear it — here we allow it both ways to keep updates simple).
ALTER TABLE bb_work_orders
  ADD CONSTRAINT bb_work_orders_quote_status_check
  CHECK (
    (wo_type = 'quote' AND quote_status IS NOT NULL)
    OR wo_type = 'work_order'
  );

-- 6. Separate sequence for quote numbering (Q-YY-NNNN)
CREATE SEQUENCE IF NOT EXISTS bb_quote_number_seq;

-- 7. Index to speed up type-filtered dashboard queries
CREATE INDEX IF NOT EXISTS idx_bb_work_orders_wo_type_opened
  ON bb_work_orders (wo_type, opened_at DESC);

-- 8. Index on back-reference for fast "show linked WO from quote" lookups
CREATE INDEX IF NOT EXISTS idx_bb_work_orders_source_quote_id
  ON bb_work_orders (source_quote_id)
  WHERE source_quote_id IS NOT NULL;
