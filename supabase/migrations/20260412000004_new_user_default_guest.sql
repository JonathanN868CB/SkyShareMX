-- ─────────────────────────────────────────────────────────────────────────────
-- New User Default: Guest role + Dashboard, Aircraft Info, AI Assistant
--
-- Changes:
--   1. Non-super-admin new users are assigned the 'Guest' role (was 'Technician')
--   2. AI Assistant is added to the default seeded permissions on signup
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_profile_id   uuid;
  new_role         app_role;
  admin_profile_id uuid;
  display_name     text;
BEGIN
  new_role := CASE
    WHEN NEW.email = 'jonathan@skyshare.com' THEN 'Super Admin'::app_role
    ELSE 'Guest'::app_role
  END;

  INSERT INTO public.profiles (user_id, email, first_name, last_name, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'given_name',
    NEW.raw_user_meta_data->>'family_name',
    NEW.raw_user_meta_data->>'full_name',
    new_role,
    CASE WHEN NEW.email ILIKE '%@skyshare.com' THEN 'Active'::user_status ELSE 'Pending'::user_status END
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO new_profile_id;

  IF new_profile_id IS NOT NULL AND new_role != 'Super Admin'::app_role THEN

    -- Seed default module access: Dashboard, Aircraft Info, AI Assistant
    INSERT INTO public.user_permissions (user_id, section)
    VALUES
      (new_profile_id, 'Dashboard'),
      (new_profile_id, 'Aircraft Info'),
      (new_profile_id, 'AI Assistant')
    ON CONFLICT (user_id, section) DO NOTHING;

    -- Notify the Super Admin
    SELECT id INTO admin_profile_id
    FROM public.profiles
    WHERE role = 'Super Admin'::app_role
    LIMIT 1;

    IF admin_profile_id IS NOT NULL THEN
      display_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NEW.email
      );

      INSERT INTO public.notifications
        (recipient_profile_id, type, title, message, metadata)
      VALUES (
        admin_profile_id,
        'new_user',
        'New User Joined',
        display_name || ' has joined SkyShare MX.',
        jsonb_build_object(
          'userEmail',  NEW.email,
          'userName',   COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), ''),
          'profileId',  new_profile_id
        )
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
