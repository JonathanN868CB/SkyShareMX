-- ─────────────────────────────────────────────────────────────────────────────
-- DW1GHT Playbook Overrides — expand from 3 to 6 editable sections
-- Adds: allowed_context, output_definition, post_processing
-- Keeps: instructions, decision_logic, tone_calibration (unchanged)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE dw1ght_playbook_overrides
  ADD COLUMN IF NOT EXISTS allowed_context   text,
  ADD COLUMN IF NOT EXISTS output_definition text,
  ADD COLUMN IF NOT EXISTS post_processing   text;
