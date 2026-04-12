-- Add source_text column to dw1ght_playbook_suggestions
-- Required for the new "replace_text" change_type: stores the verbatim passage
-- being replaced so the Workbench can do a surgical find-and-replace in the section.

ALTER TABLE dw1ght_playbook_suggestions
  ADD COLUMN IF NOT EXISTS source_text text;
