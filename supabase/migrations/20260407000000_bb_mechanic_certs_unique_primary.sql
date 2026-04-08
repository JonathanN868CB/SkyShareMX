-- ============================================================
-- Prevent duplicate primary certs per technician.
-- A mechanic can only have one is_primary = true cert at a time.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_bb_mechanic_certs_one_primary
  ON public.bb_mechanic_certs (profile_id)
  WHERE is_primary = true;
