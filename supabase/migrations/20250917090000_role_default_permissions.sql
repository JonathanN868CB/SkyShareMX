-- Create table for storing default role permissions
CREATE TABLE IF NOT EXISTS public.role_default_permissions (
    role TEXT PRIMARY KEY,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Enable row level security
ALTER TABLE public.role_default_permissions ENABLE ROW LEVEL SECURITY;

-- Allow admins and super admins to read saved defaults
CREATE POLICY "Admins can read role defaults"
    ON public.role_default_permissions
    FOR SELECT
    TO authenticated
    USING (public.is_admin_or_super(auth.uid()));

-- Allow admins and super admins to manage saved defaults
CREATE POLICY "Admins can manage role defaults"
    ON public.role_default_permissions
    FOR ALL
    TO authenticated
    USING (public.is_admin_or_super(auth.uid()))
    WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Keep timestamps up to date
CREATE TRIGGER update_role_default_permissions_updated_at
    BEFORE UPDATE ON public.role_default_permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
