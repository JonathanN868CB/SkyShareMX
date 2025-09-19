# SkyShareMX auth & access flow

## Domain-gated login
- Authentication flows through Supabase. After every auth state change we confirm the signed-in email ends with
  `@skyshare.com`.
- Any other domain is immediately signed out and redirected to `/login`. We stash the message
  “Only @skyshare.com addresses can sign in. Please use ‘Request access’ to ask for permission.” in session storage so it
  surfaces on the next visit to the login screen.
- The login screen also links to the request access form for visitors who were rejected by the domain gate.

## Default profile roles & read-only behavior
- Supabase `profiles` rows now include `role` (text) and `is_readonly` (boolean) alongside the legacy `role_enum` column.
- First-time SkyShare crew members are inserted as `role='viewer'` and `is_readonly=true`. The UI surfaces a banner and
  disables mutating actions for read-only accounts.
- Emails listed in `VITE_ADMIN_EMAILS` are promoted to `role='admin'` with `is_readonly=false` during the upsert. Update
  the comma-separated environment variable (all lowercase) to maintain the allow-list.

## Access request intake
- Non-skyshare visitors can submit the form at `/request-access`. Submissions insert into `public.access_requests`
  (`email`, `full_name`, `company`, `reason`, `status`). Row Level Security allows anonymous inserts but restricts all
  other access to the service role.
- After a successful insert we call the Netlify function `/.netlify/functions/send-access-request`, which emails the
  team via Resend. Ensure `RESEND_API_KEY`, `ACCESS_NOTIF_FROM`, and `ACCESS_NOTIF_TO` are configured in Netlify.
- Review pending requests directly in Supabase with:
  ```sql
  select *
    from access_requests
   order by created_at desc;
  ```
  Update `status` as you progress the request (`new`, `approved`, `rejected`, `closed`).

## Promoting a user from read-only
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
- `VITE_ADMIN_EMAILS`: Comma-separated admin allow-list (used in the browser and Netlify builds).
- `VITE_ACCESS_REQUEST_FUNCTION_URL` (optional): Override the Netlify function location if the default path changes.
- `RESEND_API_KEY`: Server-side secret for Resend.
- `ACCESS_NOTIF_FROM`: Verified sender for access notifications (e.g. `noreply@skysharemx.com`).
- `ACCESS_NOTIF_TO`: Distribution list for access requests (e.g. `jonathan@skyshare.com`).
- `SITE_URL` / `VITE_SITE_URL` / `VITE_PUBLIC_SITE_URL`: Ensure OAuth callbacks and email links resolve to the deployed domain.

## Manual QA playbook
1. **SkyShare login** – Sign in with an `@skyshare.com` account, confirm the profile is auto-created as a read-only viewer
   and the dashboard banner/tooltips appear. If the email is in `VITE_ADMIN_EMAILS`, verify full access (no banner) after
   refreshing the session.
2. **Non-SkyShare login** – Attempt to sign in with a non-skyshare domain. Confirm the app signs out, redirects back to
   `/login`, and displays the gated message.
3. **Request access flow** – Submit the public form with a non-skyshare email. Confirm the success toast appears, the row
   lands in `access_requests`, and the notification email is delivered to the configured address.
