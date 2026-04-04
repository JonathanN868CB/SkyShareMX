-- Dispatch notifications can be cleared by Manager+, not just Super Admin
DROP POLICY IF EXISTS "fdcd_delete" ON public.fourteen_day_check_dispatches;

CREATE POLICY "fdcd_delete" ON public.fourteen_day_check_dispatches
  FOR DELETE USING (
    is_admin_or_super(auth.uid()) OR get_user_role(auth.uid()) = 'Manager'
  );
