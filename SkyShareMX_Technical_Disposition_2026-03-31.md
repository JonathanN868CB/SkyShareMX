# SkyShare MX — Technical Disposition Report

**Document type:** Technical briefing / context document
**Date:** 2026-03-31
**Status:** Active system, in production
**Confidentiality:** Internal use only
**Primary audience:** Human collaborators and AI planning tools

---

## How to use this document

This file is the canonical baseline context document for the SkyShare MX system. It is intended to be pasted directly into AI planning sessions (Claude, ChatGPT, Gemini, etc.) or shared with human collaborators as a starting point for design, engineering, or product discussions. It reflects the system state as of 2026-03-31 following the merge of PR #10.

---

## 1. System Purpose

SkyShare MX is an **internal maintenance operations portal** for SkyShare, a regional aviation company. It is a role-gated, multi-section web application — not a public-facing product.

Its primary users are:
- **Maintenance technicians** — track training, log career development, browse aircraft
- **Managers** — oversee technician training, sign off on events, manage their team
- **Admins / Super Admins** — manage users, permissions, roles, and system configuration

Core capabilities:
- Training assignment tracking and completion history
- Ad hoc training event recording with a 3-party e-signature chain
- Technician career development (goals, action items, sessions, journal)
- Fleet aircraft browser with detailed records and export
- Maintenance vendor directory with map
- Compliance and safety documentation hub (partially built)
- Embedded AI assistant ("Dw1ght") powered by Anthropic Claude
- User onboarding, invitation, and permission management

---

## 2. Architecture

### Pattern
Single-Page Application (SPA) with serverless backend. The React frontend runs in the browser. All privileged operations (role changes, user management, AI proxying, email) route through Netlify Functions using a Supabase service-role key — never the client anon key.

### High-Level Diagram

```
[ Browser — React SPA ]
        | HTTPS
[ Netlify CDN + Serverless Functions ]
        |
[ Supabase — PostgreSQL ]
  ├── public schema   (auth, users, permissions)
  └── mxlms schema    (training, LMS, career data)
        |
[ External APIs ]
  ├── Anthropic Claude API    (AI assistant)
  ├── Google OAuth 2.0        (authentication)
  ├── Google Maps API         (vendor map)
  ├── Resend                  (transactional email)
  └── Google Drive            (training archive)
```

### Two Supabase Clients

| Client file | Schema | Key used | Purpose |
|---|---|---|---|
| `src/lib/supabase.ts` | `public` | anon (client) | Auth, profiles, permissions |
| `src/lib/supabase-mxlms.ts` | `mxlms` | anon (client) | LMS reads (training, career) |
| Netlify Functions | both | service role | Privileged writes |

---

## 3. Software Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 18.3.1 |
| Language | TypeScript | ~5.x |
| Build tool | Vite | 5.4.19 |
| Routing | React Router DOM | 6.30.1 |
| Server state / cache | TanStack React Query | 5.83.0 |
| UI primitives | Radix UI + shadcn/ui | 16 primitives, 61 components |
| Styling | Tailwind CSS | 3.4.17 |
| Forms | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| Charts | Recharts | 2.15.4 |
| Maps | @react-google-maps/api | 1.8.1 |
| Toast / notifications | Sonner | — |
| Icons | Lucide React | — |
| Database client | Supabase JS | 2.57.4 |
| AI SDK | Anthropic SDK | 0.80.0 |
| Email | Resend + Nodemailer | 4.8.0 / 6.10.1 |
| Serverless runtime | Netlify Functions (Node.js) | — |
| Testing | Vitest + React Testing Library + MSW | — |

**Fonts:** Bebas Neue (display/H1), Montserrat (labels/card titles), Inter (body), DM Sans

---

## 4. Platforms and External Services

| Service | Role |
|---|---|
| **Netlify** | Frontend hosting, CDN, serverless function execution, CI/CD from GitHub |
| **Supabase** | Managed PostgreSQL + Auth (Google OAuth via PKCE) |
| **Anthropic** | Claude API — powers the Dw1ght AI assistant (claude-sonnet model) |
| **Google** | OAuth 2.0 login, Maps API (vendor map), Drive (training archive) |
| **Resend** | Transactional email (invitations, access requests, notifications) |
| **GitHub** | Source control; pushes to main trigger Netlify production deploys |

---

## 5. Database Structure

### 5a. `public` schema — App-owned tables

| Table | Purpose |
|---|---|
| `profiles` | User records: name, email, role, status, linked mxlms technician ID |
| `access_requests` | Unauthenticated access request submissions (only table allowing unauthed inserts) |
| `user_permissions` | Per-user granted sections beyond role defaults |
| `role_default_permissions` | JSON array of default sections by role |

**Enums:**

- `app_role`: `Super Admin`, `Admin`, `Manager`, `Technician`, `Read-Only`
- `app_section` (13 values): `Dashboard`, `Aircraft Info`, `Training`, `My Journey`, `Vendor Map`, `AI Assistant`, `Aircraft Conformity`, `14-Day Check`, `Maintenance Planning`, `Ten or More`, `Terminal-OGD`, `Projects`, `Docs & Links`
- `user_status`: `Active`, `Inactive`, `Suspended`, `Pending`

**DB helper functions:**

- `has_role(required_role, user_uuid)` → boolean
- `has_permission(required_section, user_uuid)` → boolean
- `is_admin_or_super(user_uuid)` → boolean
- `get_user_role(user_uuid)` → app_role

### 5b. `mxlms` schema — LMS data

| Table | Purpose |
|---|---|
| `technician_training` | Training assignments with due dates |
| `training_completions` | Historical completion records |
| `ad_hoc_completions` | Ad hoc training events with full signature chain |
| `pending_completions` | File-detected trainings awaiting technician review |
| `pending_training_items` | Proposed new training items |
| `technician_journal` | Technician journal entries |
| `sessions` | Performance review sessions |
| `goals` | Career development goals |
| `action_items` | Assigned tasks with due dates |
| `career_interests` | Skills and leadership path preferences |

**RLS:** Enabled on all mxlms write-capable tables. Technicians: own rows only. Managers/Admins: full access.

### 5c. Recent migrations (2026-03-30)

1. Ad hoc training event type classification (6 types) + severity levels (low / medium / high)
2. 3-party signature chain on `ad_hoc_completions`: manager → technician → witness, with SHA-256 hash + timestamps
3. `is_mrt` boolean flag added to vendors table
4. `vendor_contacts` table created (1:many with vendors, primary contact flag)

---

## 6. Authentication and Authorization

### Auth flow

1. User visits `/` → Login page → "Sign in with Google"
2. Supabase initiates Google OAuth with PKCE
3. Google redirects to `/auth/callback`
4. `AuthContext` fetches `profiles` row + `user_permissions` rows for the session
5. No profile → routed to `/request-access`
6. `ProtectedRoute` checks role and permissions on every guarded route
7. Sensitive mutations → Netlify Functions → Supabase service role key (never client)

### Roles

| Role | Access level |
|---|---|
| Super Admin | Full access, including permissions management and super-admin-only admin pages |
| Admin | User management, team training, most admin features |
| Manager | Operational access + can sign training completions |
| Technician | Training, My Journey, aircraft browsing |
| Read-Only | View-only across permitted sections |

---

## 7. Netlify Serverless Functions

13 functions at `/.netlify/functions/<name>`:

| Function | Method | Purpose |
|---|---|---|
| `users-list` | GET | Paginated, filtered user list |
| `users-admin` | PATCH / DELETE | Change user role, status, or delete user |
| `send-invite` | POST | Email invitation via Resend |
| `send-access-request` | POST | Notify admin of access request |
| `send-status-notification` | POST | General notification service |
| `notify-admin-new-user` | POST | Alert admin on new user signup |
| `promote-allowlisted-user` | POST | Auto-promote allowlisted users |
| `bootstrap-super-admin` | POST | One-time super admin initialization |
| `force-signout` | POST | Force-terminate a user session |
| `adhoc-drive-archive` | POST | Archive ad hoc training records to Google Drive |
| `dw1ght-chat` | POST | Claude API proxy for AI assistant |
| `_dw1ght-config` | (config module) | System prompt + model config for Dw1ght |
| `role-defaults` | GET | Role-to-section default permission mapping |

---

## 8. Pages and Routes

### Public (no auth required)

| Route | Page | Purpose |
|---|---|---|
| `/` | Login | Google OAuth sign-in |
| `/auth/callback` | AuthCallback | OAuth redirect handler |
| `/request-access` | RequestAccess | Access request submission form |

### Protected (auth + permissions required)

| Route | Page | Status |
|---|---|---|
| `/app` | Dashboard | Live |
| `/app/aircraft` | Aircraft Info | Live |
| `/app/vendor-map` | MX Vendor Map | Live |
| `/app/ai-assistant` | AI Assistant (Dw1ght) | Live |
| `/app/journey` | My Journey | Live |
| `/app/training` | My Training | Live |
| `/app/compliance` | Compliance | Partial |
| `/app/safety` | Safety's House | Partial |
| `/app/docs` | Docs & Links | Coming Soon |
| `/app/conformity` | Aircraft Conformity | Coming Soon |
| `/app/14-day-check` | 14-Day Check | Coming Soon |
| `/app/planning` | Maintenance Planning | Coming Soon |
| `/app/ten-or-more` | Ten or More | Coming Soon |
| `/app/terminal-ogd` | Terminal-OGD | Coming Soon |
| `/app/projects` | Projects | Coming Soon |

### Admin (Admin+ role required)

| Route | Page | Access |
|---|---|---|
| `/app/admin/users` | User Management | Admin+ |
| `/app/admin/training` | Team Training & Journey | Super Admin |
| `/app/admin/permissions` | Permissions Index | Super Admin |
| `/app/admin/alerts` | Alerts & Notifications | Admin+ |
| `/app/admin/settings` | Settings | Admin+ |

---

## 9. Feature Inventory

### Fully operational

**User onboarding**
Google OAuth → profile auto-created or access request submitted → admin email alert → admin invites/promotes → user receives invitation email.

**User management (Admin)**
View all users with role, status, last login. Change role. Activate/suspend/deactivate. Send email invitations.

**Permission management (Super Admin)**
Per-user section grants beyond role defaults. Full permissions matrix view.

**Aircraft Info**
Fleet browser grouped by manufacturer → model → aircraft. Detail overlay with 5 tabs: Identity, Propulsion, Avionics, Programs, Documentation. PDF export and CSV/JSON data export.

**My Training (Technician)**
Assigned training with due dates and status. Completion history. Ad hoc event recording (type, severity, description). 3-party signature chain (manager → technician → witness). Propose new training items. Pending file-detected training review (approve/reject).

**My Journey (Technician)**
Performance sessions log. Career goals with target dates. Assigned action items. Career interests and leadership path preferences. Personal journal with public/private visibility toggle.

**MX Vendor Map**
Google Maps with vendor pins. Vendor detail cards. Contact information. MRT flag.

**AI Assistant — Dw1ght**
Claude-powered chat. Proxied through Netlify Function (API key never client-side). System prompt configured server-side.

**Dashboard**
Core values carousel. Bulletins and newswire (currently hardcoded). Department directory. Recent documents (currently hardcoded).

**Safety's House**
Safety metrics (currently hardcoded). Safety newswire (currently hardcoded). Document category browser (SOPs, MELs, Certs, Manuals, Regulations). Department contacts.

### Partial / in progress

**Compliance** — Page shell exists; no data model or live data yet.

---

## 10. Sidebar Navigation Structure

```
OVERVIEW
  ├── Dashboard
  ├── Aircraft Info
  └── AI Assistant

OPERATIONS
  ├── My Journey
  ├── My Training
  ├── MX Vendor Map
  ├── Compliance
  └── Safety's House

PENDING CERT. GROUP  [collapsible — Coming Soon]
  ├── Aircraft Conformity
  ├── 14-Day Check
  ├── Maintenance Planning
  ├── Ten or More
  ├── Terminal-OGD
  ├── Projects
  └── Docs & Links

ADMINISTRATION  [Admin+ only]
  ├── Users
  ├── Team Training & Journey  [Super Admin only]
  ├── Alerts & Notifications
  ├── Settings
  └── Permissions Index  [Super Admin only]
```

Locked sections show a lock icon. Clicking routes to the access-restricted page.

---

## 11. Key Components

| Component | Location | Purpose |
|---|---|---|
| `AppSidebar` | `src/app/layout/` | Main navigation sidebar |
| `Topbar` | `src/app/layout/` | Top navigation bar |
| `Layout` | `src/app/layout/` | Root layout wrapper |
| `AuthContext` | `src/features/auth/` | Global auth state, session, permissions |
| `ProtectedRoute` | `src/features/auth/` | Route-level auth + permission guard |
| `Dw1ght` | `src/shared/ui/` | Claude AI chat interface component |
| `SignaturePanel` | `src/components/training/` | Canvas-based e-signature capture with SHA-256 hash |
| `ProposeTrainingItemModal` | `src/components/training/` | New training item proposal dialog |
| `RecordAdHocEventModal` | `src/components/training/` | Ad hoc training event creation with signature chain |
| shadcn/ui library | `src/shared/ui/` | 61 shared UI primitives (Radix UI based) |

---

## 12. Design System Summary

| Token | Value |
|---|---|
| Gold accent | `#D4A017` (`var(--skyshare-gold)`) |
| SkyShare Red | `#C10230` |
| Crimson | `#8B1A1A` |
| Navy | `#012E45` |
| Dark page bg | `#1e1e1e` |
| Dark card bg | `#2e2e2e` |
| Dark sidebar bg | `hsl(0 0% 9%)` — always dark, both modes |
| Light page bg | `#F5F3EE` (warm cream) |
| Light card bg | `#FFFFFF` |
| Display font | Bebas Neue — H1s, uppercase, `letter-spacing: 0.05em` |
| Heading font | Montserrat — labels, card titles, uppercase |
| Body font | Inter |

All cards use `.card-elevated` CSS class. Clickable cards also use `.card-hoverable`. Sidebar is always dark regardless of light/dark mode toggle.

---

## 13. Known Gaps and Placeholder Areas

| Area | Current state | Notes |
|---|---|---|
| Dashboard bulletins / newswire | Hardcoded strings | No DB table yet |
| Safety metrics | Hardcoded numbers | No live data source |
| Safety documents | Static list | No file storage integration |
| Compliance page | Shell only | No data model defined |
| 7 Pending Cert. Group routes | "Coming Soon" | Requirements not yet defined |
| ERP / PRISM integration | Not started | Referenced as future goal |
| Analytics / usage tracking | Not present | — |
| Admin Alerts & Notifications | Page exists | Functionality incomplete |
| Admin Settings | Page exists | Content unclear |
| Admin Team Training & Journey | Page exists | Scope not fully defined |
| Aircraft fleet data | Partially static | `fleetData.ts` static file — may need DB migration |
| Audit logging | Not present | No trail for role changes, permission grants |

---

## 14. Next Logical Development Considerations

1. **Database-drive the Dashboard** — Replace hardcoded bulletins, newswire, and recent documents with Supabase-backed tables.
2. **Compliance data model** — Define compliance record schema and build UI.
3. **Safety's House live data** — Connect metrics and documents to real sources; add file storage for SOPs/MELs/Certs.
4. **Aircraft data persistence** — Audit whether fleet data is fully DB-driven or partially from `fleetData.ts`; migrate if needed.
5. **Pending Cert. Group features** — Define requirements for 7 locked sections.
6. **ERP / PRISM integration** — Live maintenance planning and aircraft status data.
7. **Notification center** — Hooks already exist (`useNotifications`, Netlify function); surface a front-end inbox.
8. **Dw1ght context enrichment** — Give the AI assistant access to real-time fleet, training, or compliance data.
9. **Google Drive expansion** — `adhoc-drive-archive.ts` already exists; extend for broader document storage.
10. **Audit logging** — Add audit trail table for sensitive admin actions (role changes, permission grants).

---

## 15. Repository and Infrastructure Facts

| Property | Value |
|---|---|
| Primary repo | GitHub (JonathanN868CB/SkyShareMX) |
| Main branch | `main` |
| Branch naming | `feature/`, `fix/`, `chore/` prefixes |
| Deploy trigger | Push to `main` → Netlify auto-deploy |
| Build command | `npm run build` |
| Build output | `dist/` |
| Functions directory | `netlify/functions/` |
| Dev server | Vite on port 5173, Netlify dev on port 8889 |
| Supabase project URL | `https://xzcrkzvonjyznzxdbpjj.supabase.co` |
| Production URL | `https://skysharemx.com` |
| Current version | v1.0 (displayed in sidebar footer) |
| Last major merge | PR #10 — Ad hoc training, Compliance, Safety's House, sidebar polish (2026-03-28) |

---

*Report generated 2026-03-31. Reflects main branch state after PR #10 merge.*
*SkyShare MX — Confidential Internal Document*
