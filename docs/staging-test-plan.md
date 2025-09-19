# Staging launch checklist

Use this runbook to validate the SkyShare-hosted staging experience **before** sending any production traffic. Every step should pass in a single test session using a clean browser profile.

## 1. Pre-checks
1. Confirm the staging site is deployed and accessible at the Netlify preview domain (e.g. `https://skyshare-maintenance.netlify.app`) and that it no longer redirects to any `lovable.app` host.
2. Verify you have access to the shared Google Workspace account that can complete an OAuth sign-in in staging.
3. Open the Supabase project dashboard in a separate tab so you can inspect auth sessions, invitation records, and function logs without disturbing the test flow.

## 2. Authentication flow in staging
1. Load `/login` directly in the staging site.
2. The app should immediately navigate to `/auth/start`. Watch the browser URL bar (or DevTools Network panel) to confirm the 302 to `/auth/start` fires.
3. Click **Continue with Google** and complete the Google OAuth flow using the designated staging account.
4. When Google redirects back to the portal, confirm the app resolves to `/` and the authenticated layout loads (header + dashboard tiles). This indicates the Supabase session cookie was stored correctly.
5. In Supabase → Authentication → Users, confirm the staging user shows a recent sign-in timestamp matching your test.

## 3. Invitation email flow
1. In the portal UI (or via REST call), trigger an invitation for `test@skyshare.com` using the “send invitation” feature. Record the timestamp.
2. Open the Supabase dashboard → Table editor → `user_invitations` to verify a new row was created with status `Pending` or `Sent` and the email address you used.
3. Check delivery:
   - Preferred: Log in to the `test@skyshare.com` mailbox and confirm the invitation email arrives from `SkyShare Maintenance Portal <jonathan@skyshare.com>` with the automated footer text.
   - Alternate: In Netlify → Functions → **send-user-invitation**, confirm the most recent invocation shows a successful response and records the message ID for the mailbox you invited.
4. If delivery fails entirely, review the Netlify function logs and the `user_invitations` row before retrying.

## 4. Troubleshooting & observability
- **SMTP credentials**: In Netlify → Site settings → Environment, confirm `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` match the SkyShare mailbox configuration.
- **Netlify function logs**: Run `netlify functions:tail send-user-invitation` from the repo root (requires the Netlify CLI) to inspect runtime errors. Logs include the Supabase `invitation_id` and SMTP message ID when sends succeed.
- **Supabase invitation records**: If the function returned `email_sent: false`, use the stored payload in the `user_invitations` row to replay the request once SMTP credentials are corrected.
- **Auth redirect issues**: If the app never reaches `/`, open the browser DevTools console to check for blocked third-party cookies. Clear storage for the active Netlify origin (preview or `https://skysharemx.com`) and try again.

## 5. Sign-off
Capture screenshots of:
- The staging site showing the authenticated dashboard at `/`.
- The invitation email as received (showing the automated footer).
- Relevant Netlify function or Supabase logs when troubleshooting was required.

Share the evidence in the team channel and obtain a 👍 from both engineering and ops leads before enabling production traffic.
