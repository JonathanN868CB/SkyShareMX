-- Phase D: SELECTION_ELEMENT checkbox data from Textract
ALTER TABLE rv_pages
  ADD COLUMN IF NOT EXISTS checkboxes_extracted JSONB DEFAULT NULL;

COMMENT ON COLUMN rv_pages.checkboxes_extracted IS
  'Array of CheckboxElement objects — SELECTION_ELEMENT blocks from Textract. '
  'Each entry: { selected, confidence, geometry:{left,top,width,height}, label, context }. '
  'context is "form" (VALUE of a KEY_VALUE_SET), "table" (cell child), or "inline".';
