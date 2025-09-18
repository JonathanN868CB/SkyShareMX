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

## Email invitations

- Invitation emails are sent by the Supabase Edge Function at
  [`supabase/functions/send-user-invitation/index.ts`](supabase/functions/send-user-invitation/index.ts).
- The function delivers messages through Resend so invites come from the verified
  `@skyshare.com` domain.
- See [`docs/email-invites.md`](docs/email-invites.md) for DNS records, Resend domain setup,
  and the environment variables the function expects.

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
