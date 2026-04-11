-- AI-generated display label for Records Vault document cards.
--
-- Structure is a JSONB blob so the four fields can evolve without requiring
-- follow-up migrations. Shape:
--   { registration, serial, component, date_start, date_end }
--
-- Populated by records-vault-label.ts (Claude Haiku) after a document's
-- Textract pipeline completes. Nullable — the UI falls back to
-- original_filename when absent. Editable via the card's pencil icon.

ALTER TABLE rv_record_sources
  ADD COLUMN IF NOT EXISTS display_label JSONB DEFAULT NULL;

COMMENT ON COLUMN rv_record_sources.display_label IS
  'AI-generated display label. JSONB shape: '
  '{ registration:text|null, serial:text|null, component:text|null, date_start:text|null, date_end:text|null }. '
  'component is one of: airframe, engine, propeller.';
