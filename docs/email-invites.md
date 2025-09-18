# Email invitations via Resend

SkyShare Maintenance Portal sends invitation emails from the Supabase Edge Function at [`supabase/functions/send-user-invitation/index.ts`](../supabase/functions/send-user-invitation/index.ts). The function calls Resend's transactional email API so that all invites are delivered from the `@skyshare.com` domain once it is verified.

## Configure the sender domain in Resend

1. Sign in to the [Resend dashboard](https://resend.com/).
2. Navigate to **Domains** and add `skyshare.com` as a new domain.
3. Add the DNS records shown below to the `skyshare.com` DNS zone. These are the exact records Resend requires to authenticate the domain.
4. Wait for Resend to report that SPF, DKIM, and Return-Path are verified.
5. When editing the invitation template or Resend settings, keep the `from` address on a mailbox that exists on the verified `@skyshare.com` domain (the Edge Function currently uses `Jonathan @ SkyShare <jonathan@skyshare.com>`).

| Purpose      | Type | Name / Host                         | Value / Target                  |
| ------------ | ---- | ----------------------------------- | ------------------------------- |
| SPF          | TXT  | `@` (root)                          | `v=spf1 include:resend.com ~all` |
| DKIM key 1   | CNAME| `resend._domainkey`                 | `resend.dkim.resend.com`        |
| DKIM key 2   | CNAME| `resend1._domainkey`                | `resend1.dkim.resend.com`       |
| DKIM key 3   | CNAME| `resend2._domainkey`                | `resend2.dkim.resend.com`       |
| Return-Path  | CNAME| `pm-bounces`                        | `pm.mtasv.net`                  |

> ⚠️ **Important:** The invitation Edge Function falls back to `onboarding@resend.dev` if the `skyshare.com` domain is not yet verified. Confirm that the verified domain stays active so we can keep sending from a recognizable `@skyshare.com` address.

## Supabase Edge Function environment variables

The invitation Edge Function reads several secrets at runtime. After updating DNS or changing email content, double-check that these environment variables are set for the deployment target (Supabase dashboard → **Project Settings → Functions → Secrets**, or via the Supabase CLI):

- `RESEND_API_KEY` – Resend API key for the verified `skyshare.com` sender domain.
- `SITE_URL` – Public base URL used in invitation links (e.g. `https://app.skyshare.com`).
- `SUPABASE_URL` – Project REST endpoint.
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key that lets the function insert invitation records.

Example CLI update:

```bash
supabase functions secrets set \
  RESEND_API_KEY="your-resend-api-key" \
  SITE_URL="https://app.skyshare.com" \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="service-role-key"

# Deploy any pending changes after secrets are updated
supabase functions deploy send-user-invitation
```

> ⚠️ **Before deploying changes:** confirm the `from` field in [`supabase/functions/send-user-invitation/index.ts`](../supabase/functions/send-user-invitation/index.ts) is still scoped to the verified `@skyshare.com` domain. Using an address outside the verified domain will cause Resend to reject the send or fall back to the generic `resend.dev` sender.
