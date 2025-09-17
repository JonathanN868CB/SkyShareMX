-- Add DELETE policy for invitations
CREATE POLICY IF NOT EXISTS "Admins can delete invitations"
ON public.user_invitations
FOR DELETE
TO authenticated
USING (is_admin_or_super(auth.uid()));