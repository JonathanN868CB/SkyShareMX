-- Allow managers and admins to delete parts requests (cascade handles child rows)
CREATE POLICY "Managers and admins can delete parts_requests"
  ON parts_requests FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('Super Admin', 'Admin', 'Manager')
    )
    OR requested_by = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );
