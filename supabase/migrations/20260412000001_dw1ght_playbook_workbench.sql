-- ─────────────────────────────────────────────────────────────────────────────
-- DW1GHT Playbook Workbench
-- Adds:
--   1. playbook_slug + review_status columns to dw1ght_learnings
--   2. dw1ght_playbook_overrides table (editable instruction text per playbook)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend dw1ght_learnings
ALTER TABLE dw1ght_learnings
  ADD COLUMN IF NOT EXISTS playbook_slug  text,
  ADD COLUMN IF NOT EXISTS review_status  text NOT NULL DEFAULT 'active';
  -- review_status values: 'inbox' | 'active' | 'rejected'
  -- 'inbox'    — AI-generated, awaiting admin review, NOT injected into prompts
  -- 'active'   — approved and eligible for injection (default for all existing rows)
  -- 'rejected' — reviewed and discarded

-- 2. Backfill playbook_slug from existing context column (no rows deleted)
UPDATE dw1ght_learnings
  SET playbook_slug = 'mechanic-interview'
  WHERE context = 'interview' AND playbook_slug IS NULL;

UPDATE dw1ght_learnings
  SET playbook_slug = 'intel-chat'
  WHERE context = 'intel_chat' AND playbook_slug IS NULL;

-- review_status already defaults to 'active' for all existing rows — no update needed.
-- All backfilled rows are already managed/active learnings.

-- 3. Create dw1ght_playbook_overrides table
CREATE TABLE IF NOT EXISTS dw1ght_playbook_overrides (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_slug    text        UNIQUE NOT NULL,   -- e.g. 'mechanic-interview'
  instructions     text,                          -- override for operating instructions section
  decision_logic   text,                          -- override for decision logic section
  tone_calibration text,                          -- override for tone/personality section
  version          integer     NOT NULL DEFAULT 1,
  updated_by       uuid        REFERENCES profiles(id),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dw1ght_playbook_overrides ENABLE ROW LEVEL SECURITY;

-- Managers, Admins, and Super Admins can read overrides
-- Note: has_role signature is has_role(required_role app_role, user_uuid uuid)
CREATE POLICY "playbook_overrides_select"
  ON dw1ght_playbook_overrides
  FOR SELECT
  TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    OR has_role('Manager'::app_role, auth.uid())
  );

-- Admins and Super Admins can insert/update/delete overrides
CREATE POLICY "playbook_overrides_write"
  ON dw1ght_playbook_overrides
  FOR ALL
  TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()));

-- Service role always has full access (used by Netlify functions)
CREATE POLICY "playbook_overrides_service_role"
  ON dw1ght_playbook_overrides
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for slug lookups (fast upsert/select by slug)
CREATE UNIQUE INDEX IF NOT EXISTS dw1ght_playbook_overrides_slug_idx
  ON dw1ght_playbook_overrides (playbook_slug);
