# Staging launch checklist

Use this runbook to validate the SkyShare-hosted staging experience **before** sending any production traffic. Every step should pass in a single test session using a clean browser profile.

## 1. Pre-checks
1. Confirm the staging site is deployed and accessible at `https://maintenance.skyshare.com`.
2. Verify you have access to the shared Google Workspace account that can complete an OAuth sign-in in staging.
3. Open the Supabase project dashboard in a separate tab so you can inspect auth sessions, invitation records, and Edge Function logs without disturbing the test flow.

## 2. Authentication flow in staging
1. Load `/login` directly in the staging site.
2. The app should immediately navigate to `/auth/start`. Watch the browser URL bar (or DevTools Network panel) to confirm the 302 to `/auth/start` fires.
3. Click **Continue with Google** and complete the Google OAuth flow using the designated staging account.
4. When Google redirects back to the portal, confirm the app resolves to `/` and the authenticated layout loads (header + dashboard tiles). This indicates the Supabase session cookie was stored correctly.
5. In Supabase → Authentication → Users, confirm the staging user shows a recent sign-in timestamp matching your test.

## 3. Invitation email flow
1. In the portal UI (or via REST call), trigger an invitation for `test@skyshare.com` using the "send invitation" feature. Record the timestamp.
2. Open the Supabase dashboard → Table editor → `user_invitations` to verify a new row was created with status `Pending` or `Sent` and the email address you used.
3. Check delivery:
   - Preferred: Log in to the `test@skyshare.com` mailbox and confirm the invitation email arrives with the SkyShare sender branding.
   - Alternate: In the Resend dashboard, open **Email Logs** and look for the message ID linked to `test@skyshare.com`. Confirm the status is **Delivered**.
4. If the log shows `domain is not verified`, Resend will automatically retry using the fallback sender `onboarding@resend.dev`. Confirm the fallback message is delivered or the `user_invitations.status` updates to `Sent`.
5. If delivery fails entirely, update the test run as blocked and proceed with the troubleshooting section before attempting again.

## 4. Troubleshooting & observability
- **Resend domain / DNS status**: In Resend → Domains, confirm `skyshare.com` records are verified. If they are `Pending`, re-run DNS validation in Cloudflare/registrar and wait for propagation before retrying the invitation.
- **Supabase Edge Function logs**: Run `supabase functions logs send-user-invitation --project-ref <project-ref>` from the repo root (requires the Supabase CLI to be logged in) to inspect any runtime errors thrown by the invitation function.
- **Function replays**: If the function returned `email_sent: false`, use the stored payload in the `user_invitations` row to replay the request via `curl` or the Supabase HTTP tester once DNS is fixed.
- **Auth redirect issues**: If the app never reaches `/`, open the browser DevTools console to check for blocked third-party cookies. Clear storage for `maintenance.skyshare.com` and try again.

## 5. Sign-off
Capture screenshots of:
- The staging site showing the authenticated dashboard at `/`.
- The invitation email as received (primary or fallback sender).
- Relevant Resend or Supabase logs when troubleshooting was required.

Share the evidence in the team channel and obtain a 👍 from both engineering and ops leads before enabling production traffic.
