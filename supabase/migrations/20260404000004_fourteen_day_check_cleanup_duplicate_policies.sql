-- Remove stale Admin-only update policy (superseded by fdcs_update which covers Manager+)
DROP POLICY IF EXISTS "Admin can update submissions" ON public.fourteen_day_check_submissions;

-- Remove duplicate Super Admin delete policy (fdcs_delete already covers this)
DROP POLICY IF EXISTS "Super Admin can delete submissions" ON public.fourteen_day_check_submissions;
