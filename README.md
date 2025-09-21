# SkyShare Maintenance Portal

A React-based maintenance portal shell for SkyShare aircraft operations.

> **Onboarding:** Team members sign in with Google using their @skyshare.com email; no invitation pipeline is required.

> **Branding note:** Favicon and meta assets live in `/public` (`favicon.svg`, `skyshare-logo.png`, and `site.webmanifest`). Update those files if the SkyShareMX branding package changes.

## Project Structure

This is a clean shell implementation built with:
- **React** + **TypeScript** + **Vite**
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Lucide React** for icons

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Adding New Components

### UI Components
Place reusable UI components in `/src/components/ui/`. These are typically design system components that can be used across pages.

### Page Components
Add new pages in `/src/pages/` and register them in `/src/app/routes.tsx`.

### Layout Components
Layout-related components (sidebars, headers, etc.) go in `/src/components/layout/`.

## Code Integration

### From Figma/Builder Tools
When copying code from design tools:

1. **Component code** → `/src/components/ui/[ComponentName].tsx`
2. **Page layouts** → `/src/pages/[PageName].tsx`
3. **Update routing** in `/src/App.tsx` if adding new pages

### Design System
- All colors and design tokens are defined in `/src/index.css`
- Tailwind configuration in `/tailwind.config.ts`
- Use semantic color tokens instead of hardcoded values

## Current Routes

- `/` - Landing page with Google SSO entry
- `/app` - Authenticated dashboard shell
- `/app/under-construction` - Placeholder for incomplete features

## Architecture

```
src/
├── components/
│   ├── layout/          # Layout components (Sidebar, Topbar)
│   ├── ui/              # Reusable UI components
│   └── UnderConstruction.tsx
├── pages/               # Page components
│   ├── AuthCallback.tsx
│   ├── Dashboard.tsx
│   ├── Landing.tsx
│   └── UnderConstructionPage.tsx
└── app/
    └── routes.tsx      # Main routing configuration
```

## Sidebar Navigation

The sidebar includes organized sections:
- **Overview**: Dashboard, Aircraft Info
- **Operations**: Maintenance tools and planning
- **Administration**: User and system management  
- **Development**: Style guide and dev tools

All operations/admin routes currently redirect to the under-construction page.

## Deployment

When deploying to Netlify, configure environment variables per context so OAuth redirects and deep links resolve to the correct domain:

- **Deploy Preview builds**: leave `VITE_SITE_URL` unset so the client falls back to the preview origin. Optionally set `VITE_PUBLIC_SITE_URL=${DEPLOY_PRIME_URL}` if you need the URL baked in at build time for Supabase redirects.
- **Production builds**: set `VITE_SITE_URL=https://skysharemx.com` so Supabase OAuth redirects always land on the custom domain.

| Variable               | Example value (redacted)         | Where to set in Netlify                               |
| ---------------------- | -------------------------------- | ----------------------------------------------------- |
| `VITE_SITE_URL`        | `https://skysharemx.com`         | Site settings → Build & deploy → Environment (Prod)   |
| `VITE_PUBLIC_SITE_URL` | `${DEPLOY_PRIME_URL}` (preview)  | Site settings → Build & deploy → Environment (Preview) |
| `VITE_SUPABASE_URL`    | `https://<project>.supabase.co`  | Site settings → Build & deploy → Environment          |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…` | Site settings → Build & deploy → Environment          |

Add the following secrets so Netlify functions can reach Supabase:

| Variable                     | Example value                                | Where to set in Netlify                |
| ---------------------------- | -------------------------------------------- | -------------------------------------- |
| `SUPABASE_URL`               | `https://<project>.supabase.co`              | Site settings → Build & deploy → Environment   |
| `SUPABASE_SERVICE_ROLE_KEY`  | `<service-role-key>`                         | Site settings → Build & deploy → Environment   |
| `SITE_URL`                   | `https://skysharemx.com`                     | Site settings → Build & deploy → Environment   |
Secrets can be managed securely either through the Netlify UI (the Environment variables panel above) or via the CLI with `netlify env:set <NAME> <VALUE>` so they never live in source control. Ensure the Supabase keys belong to the same project referenced by `SUPABASE_URL`; mismatches will break both invitations and Google OAuth redirect flows.
