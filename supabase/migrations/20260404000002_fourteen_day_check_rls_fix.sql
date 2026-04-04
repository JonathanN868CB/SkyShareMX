-- ============================================================================
-- 14-Day Check — RLS Fix
-- Expand write access to Manager+. Restrict hard deletes to Super Admin only.
-- ============================================================================

-- ============================================================================
-- inspection_card_templates
-- ============================================================================

DROP POLICY IF EXISTS "ict_insert" ON public.inspection_card_templates;
DROP POLICY IF EXISTS "ict_update" ON public.inspection_card_templates;
DROP POLICY IF EXISTS "ict_delete" ON public.inspection_card_templates;

CREATE POLICY "ict_insert" ON public.inspection_card_templates
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid()) OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "ict_update" ON public.inspection_card_templates
  FOR UPDATE USING (
    is_admin_or_super(auth.uid()) OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "ict_delete" ON public.inspection_card_templates
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ============================================================================
-- fourteen_day_check_tokens
-- ============================================================================

DROP POLICY IF EXISTS "fdct_insert" ON public.fourteen_day_check_tokens;
DROP POLICY IF EXISTS "fdct_update" ON public.fourteen_day_check_tokens;
DROP POLICY IF EXISTS "fdct_delete" ON public.fourteen_day_check_tokens;

CREATE POLICY "fdct_insert" ON public.fourteen_day_check_tokens
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid()) OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "fdct_update" ON public.fourteen_day_check_tokens
  FOR UPDATE USING (
    is_admin_or_super(auth.uid()) OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "fdct_delete" ON public.fourteen_day_check_tokens
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ============================================================================
-- fourteen_day_check_submissions
-- Writes are handled by Netlify functions (service role) for mechanic submissions.
-- Managers need UPDATE to set review_status / review_notes / reviewed_by / reviewed_at.
-- Hard deletes (purging history) are Super Admin only.
-- ============================================================================

DROP POLICY IF EXISTS "fdcs_update" ON public.fourteen_day_check_submissions;
DROP POLICY IF EXISTS "fdcs_delete" ON public.fourteen_day_check_submissions;

CREATE POLICY "fdcs_update" ON public.fourteen_day_check_submissions
  FOR UPDATE USING (
    is_admin_or_super(auth.uid()) OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "fdcs_delete" ON public.fourteen_day_check_submissions
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ============================================================================
-- fourteen_day_check_attachments
-- Reads open to authenticated. Hard deletes Super Admin only.
-- ============================================================================

DROP POLICY IF EXISTS "fdca_delete" ON public.fourteen_day_check_attachments;

CREATE POLICY "fdca_delete" ON public.fourteen_day_check_attachments
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ============================================================================
-- fourteen_day_check_dispatches
-- ============================================================================

DROP POLICY IF EXISTS "fdcd_insert" ON public.fourteen_day_check_dispatches;
DROP POLICY IF EXISTS "fdcd_delete" ON public.fourteen_day_check_dispatches;

CREATE POLICY "fdcd_insert" ON public.fourteen_day_check_dispatches
  FOR INSERT WITH CHECK (
    is_admin_or_super(auth.uid()) OR get_user_role(auth.uid()) = 'Manager'
  );

CREATE POLICY "fdcd_delete" ON public.fourteen_day_check_dispatches
  FOR DELETE USING (is_super_admin(auth.uid()));
