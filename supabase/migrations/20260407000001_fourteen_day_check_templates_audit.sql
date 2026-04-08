-- ============================================================================
-- 14-Day Check — Add updated_at/updated_by columns + audit table
-- The hook layer already writes these fields; the columns were missing from
-- the original migration, causing template create/edit to fail silently.
-- ============================================================================

ALTER TABLE public.inspection_card_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id);

-- ============================================================================
-- inspection_card_template_audit — change log for template mutations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inspection_card_template_audit (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid        NOT NULL REFERENCES public.inspection_card_templates(id) ON DELETE CASCADE,
  action      text        NOT NULL,   -- created | renamed | copied_from | fields_updated | aircraft_assigned
  actor_id    uuid        REFERENCES public.profiles(id),
  actor_name  text,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icta_template ON public.inspection_card_template_audit(template_id);

ALTER TABLE public.inspection_card_template_audit ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read the audit log
CREATE POLICY "icta_select" ON public.inspection_card_template_audit
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Manager+ can insert audit entries (mutations go through hooks, not direct client writes,
-- but we scope insert permission to admin-or-super to match the template policies)
CREATE POLICY "icta_insert" ON public.inspection_card_template_audit
  FOR INSERT WITH CHECK (is_admin_or_super(auth.uid()));

-- Super Admin only can delete individual audit entries
CREATE POLICY "icta_delete" ON public.inspection_card_template_audit
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'Super Admin'
    )
  );
