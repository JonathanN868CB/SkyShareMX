# SkyShareMX auth & access flow

## Domain-gated login
- Authentication flows through Supabase. After every auth state change we confirm the signed-in email ends with
  `@skyshare.com`.
- Any other domain is immediately signed out and redirected to `/`. We stash the message
  “Google account must be @skyshare.com.” in session storage so it
  surfaces on the next visit to the landing screen.
- The landing screen is the only public entry point for authentication.

## Default profile roles & Viewer behavior
- Supabase `profiles` rows include `role` (text) and `is_readonly` (boolean) alongside the legacy `role_enum` column.
- First-time SkyShare crew members are inserted as `role='viewer'` and `is_readonly=true`. The UI surfaces a banner and
  disables mutating actions for Viewer accounts.
- `jonathan@skyshare.com` is promoted to `role='admin'` with `is_readonly=false` during the upsert. Every other `@skyshare.com` account remains a Viewer until an admin elevates them manually.

## Promoting a Viewer
Run the SQL below in Supabase (service role) to elevate a profile. Adjust the email filter to the target user.

```sql
update profiles
   set role = 'technician',
       role_enum = 'Technician',
       is_readonly = false
 where email = 'tech@skyshare.com';
```

Other role mappings:

```sql
-- Promote to quality control
update profiles
   set role = 'qc',
       role_enum = 'Manager',
       is_readonly = false
 where email = 'qc@skyshare.com';

-- Promote to admin
update profiles
   set role = 'admin',
       role_enum = 'Admin',
       is_readonly = false
 where email = 'lead@skyshare.com';
```

## Environment configuration checklist
- `SITE_URL` / `VITE_SITE_URL` / `VITE_PUBLIC_SITE_URL`: Ensure OAuth callbacks and email links resolve to the deployed domain.

## Manual QA playbook
1. **SkyShare login** – Sign in with an `@skyshare.com` account, confirm the profile is auto-created as a Viewer and the dashboard banner/tooltips appear. Only `jonathan@skyshare.com` should have Admin access (no banner).
2. **Non-SkyShare login** – Attempt to sign in with a non-skyshare domain. Confirm the app signs out, redirects back to
   `/`, and displays the gated message.
