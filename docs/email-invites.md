# Email invitations via SMTP

SkyShare Maintenance Portal sends invitation emails from the Netlify serverless function at [`netlify/functions/send-user-invitation.ts`](../netlify/functions/send-user-invitation.ts). The function uses Nodemailer to relay messages through `jonathan@skyshare.com`, so every invite originates from the SkyShare-owned mailbox.

## Configure the sender mailbox

1. Generate an app password for `jonathan@skyshare.com` in the SkyShare mail provider (Google Workspace or Microsoft 365).
2. Note the SMTP host and port (for example `smtp.gmail.com` with port `587` for STARTTLS).
3. Verify the credentials can authenticate through the provider’s SMTP endpoint before updating production secrets.

## Environment variables

Set these variables in Netlify (Site settings → Build & deploy → Environment → Environment variables) and in `.env.local` when testing locally:

- `SUPABASE_URL` – Supabase project REST endpoint.
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key used to insert invitation rows.
- `SITE_URL` – Public base URL used in the invitation link (e.g. `https://skysharemx.com`).
- `SMTP_HOST` – SMTP host for the SkyShare mailbox.
- `SMTP_PORT` – Port accepted by the SMTP host (usually `587`).
- `SMTP_USER` – Authenticated mailbox (`jonathan@skyshare.com`).
- `SMTP_PASS` – App password for the mailbox.
- `SMTP_FROM` – Friendly display name, e.g. `SkyShare Maintenance Portal <jonathan@skyshare.com>`.

Optional development overrides:

- `VITE_INVITE_FUNCTION_URL` – Alternate endpoint for the invite function (set to `http://localhost:8888/.netlify/functions/send-user-invitation` when running `netlify dev`).

## Deploying updates

1. Commit code changes and deploy through Netlify.
2. Update Netlify environment variables via the UI or `netlify env:set` before promoting to production.
3. Confirm the Netlify deploy log shows the `send-user-invitation` function was bundled.

## Local testing

1. Copy `.env.example` to `.env.local` and fill in SMTP and Supabase values.
2. Run `netlify dev` so requests to `/.netlify/functions/send-user-invitation` proxy to the local function bundle.
3. Use the “Invite New User” dialog to send a test invite. Verify the email arrives from `jonathan@skyshare.com` and that it ends with the footer “This is an automated email from the SkyShare Maintenance Portal.”
