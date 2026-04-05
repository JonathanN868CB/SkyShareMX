-- Rename the app_role enum value "Read-Only" to "Guest".
-- Postgres 10+ supports RENAME VALUE directly on an enum type.
-- Existing profile rows and constraints are updated automatically.

ALTER TYPE public.app_role RENAME VALUE 'Read-Only' TO 'Guest';

-- Update the role_default_permissions table if any rows still reference the old label.
UPDATE public.role_default_permissions
SET role = 'Guest'
WHERE role = 'Read-Only';

-- Seed default permissions for the Guest role:
-- Dashboard, Aircraft Info, and AI Assistant.
-- This is advisory data used by the admin UI; per-user rows live in user_permissions.
INSERT INTO public.role_default_permissions (role, section, level)
VALUES
  ('Guest', 'Dashboard',     'read'),
  ('Guest', 'Aircraft Info', 'read'),
  ('Guest', 'AI Assistant',  'read')
ON CONFLICT (role, section) DO NOTHING;
