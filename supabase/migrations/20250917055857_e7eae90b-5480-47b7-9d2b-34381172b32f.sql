-- Create enum for invitation status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN
    CREATE TYPE invite_status AS ENUM ('Pending', 'Sent', 'Failed', 'Accepted', 'Expired');
  END IF;
END $$;

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role app_role NOT NULL DEFAULT 'Read-Only',
  status invite_status NOT NULL DEFAULT 'Pending',
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Policies: Admins can view/insert/update invitations
CREATE POLICY "Admins can view invitations"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert invitations"
ON public.user_invitations
FOR INSERT
TO authenticated
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update invitations"
ON public.user_invitations
FOR UPDATE
TO authenticated
USING (is_admin_or_super(auth.uid()));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_invitations_created_at ON public.user_invitations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON public.user_invitations (status);
