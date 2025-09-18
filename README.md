# SkyShare Maintenance Portal

A React-based maintenance portal shell for SkyShare aircraft operations.

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
Add new pages in `/src/pages/` and register them in `/src/App.tsx` routes.

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

- `/` - Dashboard (welcome page)
- `/login` - Authentication page with Google login placeholder
- `/under-construction` - Placeholder for incomplete features

## Architecture

```
src/
├── components/
│   ├── layout/          # Layout components (Sidebar, Topbar)
│   ├── ui/              # Reusable UI components
│   └── UnderConstruction.tsx
├── pages/               # Page components
│   ├── Dashboard.tsx
│   ├── Login.tsx
│   └── UnderConstructionPage.tsx
└── App.tsx             # Main routing configuration
```

## Sidebar Navigation

The sidebar includes organized sections:
- **Overview**: Dashboard, Aircraft Info
- **Operations**: Maintenance tools and planning
- **Administration**: User and system management  
- **Development**: Style guide and dev tools

All operations/admin routes currently redirect to the under-construction page.

## Deployment

When deploying to Netlify, configure environment variables per context to keep
authentication redirects in the correct environment:

- **Deploy Preview builds**: either leave `VITE_PUBLIC_SITE_URL` unset or set it
  to Netlify's `${DEPLOY_PRIME_URL}` so `getPublicSiteUrl()` resolves to the
  preview origin instead of the production domain.
- **Production builds**: explicitly set `VITE_PUBLIC_SITE_URL` to the canonical
  production domain so Supabase redirects always land back in production.

| Variable                  | Example value (redacted)                | Where to set in Netlify                                    |
| ------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `VITE_PUBLIC_SITE_URL`    | `https://staging--<site>.netlify.app`   | Site settings → Build & deploy → Environment → Environment variables |
| `VITE_SUPABASE_URL`       | `https://<project>.supabase.co`         | Site settings → Build & deploy → Environment → Environment variables |
| `VITE_SUPABASE_ANON_KEY`  | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…<redacted>` | Site settings → Build & deploy → Environment → Environment variables |

Secrets can be managed securely either through the Netlify UI (the Environment
variables panel above) or via the CLI with `netlify env:set <NAME> <VALUE>` so
they never live in source control. Ensure the Supabase anon key belongs to the
same Supabase project referenced by `VITE_SUPABASE_URL`; mismatches will break
Google OAuth redirect flows.
