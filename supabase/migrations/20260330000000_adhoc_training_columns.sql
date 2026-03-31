-- ============================================================
-- Ad Hoc Training Event columns + RLS
-- Apply manually via Supabase SQL editor or supabase db push
-- ============================================================

-- 1. Add new columns to mxlms.ad_hoc_completions
ALTER TABLE mxlms.ad_hoc_completions
  ADD COLUMN IF NOT EXISTS event_type              TEXT NOT NULL DEFAULT 'general'
    CHECK (event_type IN (
      'safety-observation',
      'procedure-refresher',
      'tooling-equipment',
      'regulatory-briefing',
      'ojt-mentorship',
      'general'
    )),
  ADD COLUMN IF NOT EXISTS description             TEXT,
  ADD COLUMN IF NOT EXISTS corrective_action       TEXT,
  ADD COLUMN IF NOT EXISTS severity                TEXT
    CHECK (severity IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS initiated_by_user_id    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS initiated_by_name       TEXT,
  ADD COLUMN IF NOT EXISTS requires_acknowledgment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS acknowledged_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS drive_url               TEXT,
  ADD COLUMN IF NOT EXISTS status                  TEXT NOT NULL DEFAULT 'pending_acknowledgment'
    CHECK (status IN (
      'pending_acknowledgment',
      'acknowledged',
      'archived'
    ));

-- 2. Backfill: pre-existing rows are historical completions — archive them
--    (acknowledged_at IS NULL because the column was just added)
UPDATE mxlms.ad_hoc_completions
SET
  status                  = 'archived',
  requires_acknowledgment = false
WHERE
  status = 'pending_acknowledgment'
  AND acknowledged_at IS NULL;

-- 3. Enable RLS (idempotent)
ALTER TABLE mxlms.ad_hoc_completions ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies so this migration is idempotent
DROP POLICY IF EXISTS "tech_select_own_adhoc"  ON mxlms.ad_hoc_completions;
DROP POLICY IF EXISTS "tech_update_ack_adhoc"  ON mxlms.ad_hoc_completions;
DROP POLICY IF EXISTS "manager_all_adhoc"      ON mxlms.ad_hoc_completions;

-- 5a. Technician: SELECT own rows only
CREATE POLICY "tech_select_own_adhoc"
ON mxlms.ad_hoc_completions
FOR SELECT
TO authenticated
USING (
  technician_id = mxlms.my_tech_id()
);

-- 5b. Technician: UPDATE own rows (for acknowledgment)
--     Column-level restriction is enforced in app logic; RLS allows the row.
CREATE POLICY "tech_update_ack_adhoc"
ON mxlms.ad_hoc_completions
FOR UPDATE
TO authenticated
USING  (technician_id = mxlms.my_tech_id())
WITH CHECK (technician_id = mxlms.my_tech_id());

-- 5c. Manager / Admin / Super Admin: full access
--     Role is read from public.profiles using the authenticated user's auth.uid().
CREATE POLICY "manager_all_adhoc"
ON mxlms.ad_hoc_completions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('Super Admin', 'Admin', 'Manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('Super Admin', 'Admin', 'Manager')
  )
);
