-- ============================================================
-- Ad Hoc Training — Signature fields + status state machine
-- Apply AFTER 20260330000000_adhoc_training_columns.sql
-- ============================================================

-- 1. Migrate status values from migration 1 to state-machine values
UPDATE mxlms.ad_hoc_completions
SET status = 'pending_tech_ack'
WHERE status = 'pending_acknowledgment';

UPDATE mxlms.ad_hoc_completions
SET status = 'archived'
WHERE status = 'acknowledged';

-- 2. Replace status CHECK constraint with state-machine values
ALTER TABLE mxlms.ad_hoc_completions
  DROP CONSTRAINT IF EXISTS ad_hoc_completions_status_check;

ALTER TABLE mxlms.ad_hoc_completions
  ADD CONSTRAINT ad_hoc_completions_status_check
  CHECK (status IN (
    'pending_tech_ack',      -- waiting for tech signature
    'pending_witness_ack',   -- tech signed (or skipped), waiting for witness
    'complete',              -- all required sigs collected, ready to archive
    'archived'               -- PDF in Drive, drive_url set
  ));

-- 3. Manager signature fields (captured at time of creation)
ALTER TABLE mxlms.ad_hoc_completions
  ADD COLUMN IF NOT EXISTS initiated_by_email       TEXT,
  ADD COLUMN IF NOT EXISTS manager_signed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_signature_hash   TEXT;

-- 4. Technician signature fields (captured when tech acknowledges)
ALTER TABLE mxlms.ad_hoc_completions
  ADD COLUMN IF NOT EXISTS tech_signed_by_name      TEXT,
  ADD COLUMN IF NOT EXISTS tech_signed_by_email     TEXT,
  ADD COLUMN IF NOT EXISTS tech_signature_hash      TEXT;
-- Note: acknowledged_at (from migration 1) serves as tech_signed_at

-- 5. Witness / second manager fields
ALTER TABLE mxlms.ad_hoc_completions
  ADD COLUMN IF NOT EXISTS witness_user_id          UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS witness_name             TEXT,
  ADD COLUMN IF NOT EXISTS witness_email            TEXT,
  ADD COLUMN IF NOT EXISTS witness_signed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS witness_signature_hash   TEXT;

-- 6. Update RLS: witnesses need SELECT + UPDATE on their assigned records.
--    Manager policy already covers manager-role witnesses (they get ALL),
--    but add an explicit witness policy for completeness and future-proofing.
DROP POLICY IF EXISTS "witness_select_update_adhoc" ON mxlms.ad_hoc_completions;

CREATE POLICY "witness_select_update_adhoc"
ON mxlms.ad_hoc_completions
FOR ALL
TO authenticated
USING  (witness_user_id = auth.uid())
WITH CHECK (witness_user_id = auth.uid());
