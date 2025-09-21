# AGENTS Instructions

## Tooling & required checks
- Install dependencies with `npm install`, use `npm run dev` while iterating, and rely on `npm run build` for production parity builds.
- Before you commit, run `npm run lint` and `npm run build`; these are the canonical checks wired into Netlify’s build pipeline.

## Source layout & module boundaries
- Follow the documented structure: reusable UI lives in `src/components/ui`, layouts in `src/components/layout`, pages in `src/pages`, and routing updates flow through `src/App.tsx`. Keep design-token changes in `src/index.css` and Tailwind tweaks in `tailwind.config.ts`.
- When adding a feature package under `src/features`, expose its public surface via `index.ts` and route objects from `routes.tsx` so other modules import through the feature API rather than deep paths.

## Environment variables & secrets
- Keep Netlify and local environment variables in sync with the tables in the deployment section of the README; update the doc whenever you add or rename a variable.
- Treat `.env.example` as the authoritative template for local setup—mirror any new secrets there and avoid committing real credentials.
- User-administration features require the Supabase keys listed in `docs/users.md`; ensure both the doc and the Netlify configuration stay aligned.
- Invitation mailers and access-request flows depend on the SMTP and Resend settings captured in `docs/email-invites.md` and the auth environment checklist in `docs/auth-flow.md`; keep those references current when modifying related code.

## Netlify functions & Supabase integration
- All serverless logic resides in `netlify/functions/`, including the invitation mailer and the users directory handlers described in the docs—review these references before making changes so behavior stays consistent.
- After editing any function, redeploy the bundle so the new environment and schema assumptions take effect; the users guide and email-invite doc outline the required Netlify CLI steps and post-deploy bootstrap checks.

## Database schema & generated types
- Supabase schema changes belong in versioned migrations under `supabase/migrations/` and must continue to satisfy the constraints captured in the users documentation.
- Regenerate and commit `src/entities/supabase.ts` whenever the database shifts so TypeScript consumers reflect the latest tables, enums, and relationships.

## QA & documentation expectations
- Align feature behavior with the staging launch checklist before sign-off; it details the authentication and invitation flows that must succeed end-to-end in staging.
- When changing authentication, invitation, or access-request logic, verify the manual QA steps in `docs/auth-flow.md` remain accurate and update them alongside your code.
