-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('Super Admin', 'Admin', 'Manager', 'Technician', 'Read-Only');

-- Create user status enum  
CREATE TYPE public.user_status AS ENUM ('Active', 'Inactive', 'Suspended', 'Pending');

-- Create section permissions enum
CREATE TYPE public.app_section AS ENUM ('Overview', 'Operations', 'Administration', 'Development');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role app_role NOT NULL DEFAULT 'Read-Only',
    status user_status NOT NULL DEFAULT 'Pending',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create user permissions table
CREATE TABLE public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    section app_section NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, section)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Create security definer functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.has_role(user_uuid UUID, required_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE  
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = user_uuid 
        AND role = required_role
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(user_uuid UUID, required_section app_section)
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
        AND role IN ('Admin', 'Super Admin')
    );
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles if admin/super admin"
    ON public.profiles FOR SELECT
    USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT  
    USING (user_id = auth.uid());

CREATE POLICY "Admins can update profiles"
    ON public.profiles FOR UPDATE
    USING (
        public.is_admin_or_super(auth.uid()) 
        AND NOT (email = 'jonathan@skyshare.com' AND auth.uid() != user_id)
    );

CREATE POLICY "Admins can insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (public.is_admin_or_super(auth.uid()));

-- RLS Policies for user_permissions  
CREATE POLICY "Users can view all permissions if admin/super admin"
    ON public.user_permissions FOR SELECT
    USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "Users can view own permissions"
    ON public.user_permissions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage permissions"
    ON public.user_permissions FOR ALL
    USING (public.is_admin_or_super(auth.uid()));

-- Create function to auto-create profile and default permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    user_role app_role;
BEGIN
    -- Set Super Admin for jonathan@skyshare.com, Read-Only for others
    IF NEW.email = 'jonathan@skyshare.com' THEN
        user_role := 'Super Admin';
    ELSE
        user_role := 'Read-Only';
    END IF;

    -- Insert profile
    INSERT INTO public.profiles (user_id, email, role, status)
    VALUES (NEW.id, NEW.email, user_role, 'Active');

    -- Grant default permissions based on role
    IF user_role = 'Super Admin' THEN
        -- Super Admin gets all sections
        INSERT INTO public.user_permissions (user_id, section)
        VALUES 
            (NEW.id, 'Overview'),
            (NEW.id, 'Operations'), 
            (NEW.id, 'Administration'),
            (NEW.id, 'Development');
    ELSE
        -- Read-Only users get Overview section only
        INSERT INTO public.user_permissions (user_id, section)
        VALUES (NEW.id, 'Overview');
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();