# Users directory & administration

The Users page surfaces a complete list of profiles with inline role and employment-status controls. It depends on three Netlify
functions and a Supabase table. This document captures the operational details you need when deploying or maintaining the
feature.

## Environment variables

Configure the following variables for any environment that needs live data:

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | ✅ | Supabase project URL. |
| `SUPABASE_ANON_KEY` | ✅ | Anonymous client key used by the browser. |
| `SUPABASE_SERVICE_ROLE` | ✅ | Service-role key used by Netlify functions. Falls back to `SUPABASE_SERVICE_ROLE_KEY` for backward compatibility. |
| `MASTER_ADMIN_EMAIL` | ➖ | Optional override for the bootstrap script. Defaults to `jonathan@skyshare.com`. |
| `MASTER_ADMIN_NAME` | ➖ | Optional override for the bootstrap script. Defaults to `Jonathan Schaedig`. |

## Netlify functions

### `users-list`

* **Purpose:** Fetches paginated user summaries from `public.profiles` and returns `{ data, total, page, perPage }`.
* **Supported filters:** `search` (matches name/email/role), `role`, `status`, `page`, `perPage`.
* **Side effects:** Best-effort sync of `last_login` based on `auth.users.last_sign_in_at`.

### `users-admin`

* **POST:** Invites a new user (`{ email, fullName, role }`), upserts `profiles` with `employment_status='active'` and `is_super_admin=false`.
* **PATCH:** Mutates either `role` or `employment_status`. Super-admin rows return `403`.

### `bootstrap-super-admin`

* Ensures the configured master admin exists in Supabase Auth and the `profiles` table with `is_super_admin = true`.
* Safe to run multiple times; returns `{ invited: boolean, profile }`.

## Database schema

The Supabase table must match the schema enforced in `bootstrap-super-admin.ts`:

```
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin','manager','technician','viewer')),
  employment_status text not null default 'active' check (employment_status in ('active','inactive')),
  last_login timestamptz,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure moddatetime (updated_at);
create or replace function prevent_super_admin_change() returns trigger language plpgsql as $$
begin
  if old.is_super_admin then
    if tg_op = 'DELETE' then
      raise exception 'Cannot delete super admin';
    end if;
    if tg_op = 'UPDATE' and (old.role is distinct from new.role or old.employment_status is distinct from new.employment_status) then
      raise exception 'Cannot modify super admin role or employment status';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_super_admin on public.profiles;
create trigger protect_super_admin
  before update or delete on public.profiles
  for each row execute procedure prevent_super_admin_change();
-- TODO: align RLS policies with existing security posture.
```

## Pagination & filters

* The UI requests up to 50 rows per page (`perPage=50`).
* All filters reset the page to `1`.
* The mock-mode helper mirrors the same pagination so local development behaves like production.

## Mock mode

If the API call fails (missing env vars, network issues, etc.) the client swaps to seeded mock data:

* A banner warns that updates are not persisted.
* Inline role/status edits only update local state and surface a toast.
* You can trigger `Retry connection` from the banner to re-attempt the live fetch.

## Deployment checklist

1. Configure the environment variables listed above.
2. Deploy the Netlify functions (`users-list`, `users-admin`, `bootstrap-super-admin`).
3. Ensure the Supabase schema matches the snippet above (especially the `employment_status` and `is_super_admin` columns and
   triggers).
4. Run `/.netlify/functions/bootstrap-super-admin` (via `netlify functions:invoke` or a browser) after provisioning to seed the
   master admin profile.
