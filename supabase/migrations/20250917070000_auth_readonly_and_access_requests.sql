-- Ensure UUID generation extension is available
create extension if not exists "pgcrypto";

-- Rename legacy role column to retain enum values alongside new text role column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'role'
    ) THEN
        ALTER TABLE public.profiles
            RENAME COLUMN role TO role_enum;
    END IF;
END $$;

-- Mark the enum column as deprecated for future removal
COMMENT ON COLUMN public.profiles.role_enum IS 'Deprecated: use role (text) and is_readonly (boolean) columns';

-- Add new profile metadata columns with sensible defaults
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email text,
    ADD COLUMN IF NOT EXISTS full_name text,
    ADD COLUMN IF NOT EXISTS role text CHECK (role IN ('admin', 'technician', 'qc', 'viewer')) DEFAULT 'viewer',
    ADD COLUMN IF NOT EXISTS is_readonly boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Ensure profile emails remain unique for lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND conname = 'profiles_email_key'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_email_key UNIQUE (email);
    END IF;
END $$;

-- Backfill full_name from existing first/last name values when available
UPDATE public.profiles
SET full_name = NULLIF(TRIM(BOTH ' ' FROM CONCAT_WS(' ', first_name, last_name)), '')
WHERE full_name IS NULL
  AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- Normalize legacy enum roles into new role/is_readonly columns
UPDATE public.profiles
SET role = CASE role_enum
        WHEN 'Super Admin' THEN 'admin'
        WHEN 'Admin' THEN 'admin'
        WHEN 'Technician' THEN 'technician'
        WHEN 'Manager' THEN 'qc'
        ELSE 'viewer'
    END,
    is_readonly = CASE role_enum
        WHEN 'Super Admin' THEN false
        WHEN 'Admin' THEN false
        WHEN 'Technician' THEN false
        WHEN 'Manager' THEN false
        ELSE true
    END
WHERE role IS DISTINCT FROM CASE role_enum
        WHEN 'Super Admin' THEN 'admin'
        WHEN 'Admin' THEN 'admin'
        WHEN 'Technician' THEN 'technician'
        WHEN 'Manager' THEN 'qc'
        ELSE 'viewer'
    END
   OR is_readonly IS DISTINCT FROM CASE role_enum
        WHEN 'Super Admin' THEN false
        WHEN 'Admin' THEN false
        WHEN 'Technician' THEN false
        WHEN 'Manager' THEN false
        ELSE true
    END;

-- Ensure timestamp metadata is populated
UPDATE public.profiles
SET created_at = COALESCE(created_at, now()),
    updated_at = now()
WHERE created_at IS NULL
   OR updated_at IS NULL;

-- Refresh helper functions to reference renamed enum column
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role_enum FROM public.profiles WHERE user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.has_role(user_uuid UUID, required_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = user_uuid
          AND role_enum = required_role
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(user_uuid UUID, required_section public.app_section)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = user_uuid
          AND section = required_section
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(user_uuid UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = user_uuid
          AND role_enum IN ('Admin', 'Super Admin')
    );
$$;

-- Update trigger to keep enum + new text fields in sync for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    user_role_enum public.app_role := 'Read-Only';
    user_role text := 'viewer';
    read_only boolean := true;
    full_name text := NULL;
BEGIN
    IF NEW.email = 'jonathan@skyshare.com' THEN
        user_role_enum := 'Super Admin';
        user_role := 'admin';
        read_only := false;
    END IF;

    full_name := NULLIF(TRIM(BOTH ' ' FROM COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        CONCAT_WS(' ', NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')
    )), '');

    INSERT INTO public.profiles AS p (
        user_id,
        email,
        role_enum,
        role,
        is_readonly,
        status,
        full_name,
        last_login,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        user_role_enum,
        user_role,
        read_only,
        'Active',
        full_name,
        now(),
        now(),
        now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        role_enum = EXCLUDED.role_enum,
        role = EXCLUDED.role,
        is_readonly = EXCLUDED.is_readonly,
        status = EXCLUDED.status,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        last_login = EXCLUDED.last_login,
        updated_at = EXCLUDED.updated_at;

    IF user_role_enum IN ('Super Admin', 'Admin') THEN
        INSERT INTO public.user_permissions (user_id, section)
        VALUES
            (NEW.id, 'Overview'),
            (NEW.id, 'Operations'),
            (NEW.id, 'Administration'),
            (NEW.id, 'Development')
        ON CONFLICT (user_id, section) DO NOTHING;
    ELSE
        INSERT INTO public.user_permissions (user_id, section)
        VALUES (NEW.id, 'Overview')
        ON CONFLICT (user_id, section) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Ensure updated_at trigger persists after function replacement
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for capturing access requests from prospective users
CREATE TABLE IF NOT EXISTS public.access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    full_name text,
    company text,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'rejected', 'closed'))
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit access request"
    ON public.access_requests FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "service role can manage requests"
    ON public.access_requests FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
