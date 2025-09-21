# Staging launch checklist

Use this runbook to validate the SkyShare-hosted staging experience **before** sending any production traffic. Every step should pass in a single test session using a clean browser profile.

## 1. Pre-checks
1. Confirm the staging site is deployed and accessible at the Netlify preview domain (e.g. `https://skyshare-maintenance.netlify.app`) and that every navigation stays on the SkyShare-controlled host (no cross-domain redirects).
2. Verify you have access to the shared Google Workspace account that can complete an OAuth sign-in in staging.
3. Open the Supabase project dashboard in a separate tab so you can inspect auth sessions and function logs without disturbing the test flow.

## 2. Authentication flow in staging
1. Load `/login` directly in the staging site.
2. The app should immediately navigate to `/auth/start`. Watch the browser URL bar (or DevTools Network panel) to confirm the 302 to `/auth/start` fires.
3. Click **Continue with Google** and complete the Google OAuth flow using the designated staging account.
4. When Google redirects back to the portal, confirm the app resolves to `/` and the authenticated layout loads (header + dashboard tiles). This indicates the Supabase session cookie was stored correctly.
5. In Supabase → Authentication → Users, confirm the staging user shows a recent sign-in timestamp matching your test.

## 3. User management smoke test
1. Open the Users page after signing in. Confirm your staging account appears with Viewer access (banner present, write controls disabled).
2. Verify `jonathan@skyshare.com` remains locked with the Admin badge and no delete control.
3. Delete a disposable test user with the skull button. Confirm the row disappears, Supabase → Authentication → Users no longer lists the account, and re-signing in recreates them as a Viewer.

## 4. Troubleshooting & observability
- **users-admin function logs**: Run `netlify functions:tail users-admin` to inspect role or deletion failures. Expect 403s when targeting the protected admin account.
- **Supabase profiles**: Use the Table editor to confirm Viewer rows are recreated on login and that deletions remove both Auth and `profiles` entries.
- **Auth redirect issues**: If the app never reaches `/`, open the browser DevTools console to check for blocked third-party cookies. Clear storage for the active Netlify origin (preview or `https://skysharemx.com`) and try again.

## 5. Sign-off
Capture screenshots of:
- The staging site showing the authenticated dashboard at `/`.
- The Users page after deleting and re-adding a test account (shows Viewer status).
- Relevant Netlify function or Supabase logs when troubleshooting was required.

Share the evidence in the team channel and obtain a 👍 from both engineering and ops leads before enabling production traffic.
