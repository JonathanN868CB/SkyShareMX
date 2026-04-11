-- Allow Manager+ to delete individual WO items (discrepancy lines, etc.)
-- Parts, labor, and attachments cascade automatically via FK ON DELETE CASCADE.

CREATE POLICY "bb_wo_items_delete"
  ON public.bb_work_order_items
  FOR DELETE TO authenticated
  USING (
    is_admin_or_super(auth.uid()) OR get_user_role(auth.uid()) = 'Manager'
  );
