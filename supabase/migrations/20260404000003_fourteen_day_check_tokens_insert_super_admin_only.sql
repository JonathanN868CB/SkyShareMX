-- Adding aircraft to the 14-day check (inserting tokens) is Super Admin only.
-- Managers and Admins can update token config but cannot enroll new aircraft.

DROP POLICY IF EXISTS "fdct_insert" ON public.fourteen_day_check_tokens;

CREATE POLICY "fdct_insert" ON public.fourteen_day_check_tokens
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));
