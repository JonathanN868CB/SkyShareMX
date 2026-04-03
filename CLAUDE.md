# SkyShare MX — Claude Code Instructions

---

## Git Workflow

- **Never commit directly to `main`**
- Always create a feature branch, commit there, push, and open a PR for Jonathan to review and merge
- Branch naming: `feature/`, `fix/`, `chore/` prefixes
- PR descriptions should summarize what changed and why

---

## Design System — Locked Rules

These rules are finalized and must be applied consistently to all new pages, components, and UI additions. Do not deviate without explicit instruction from Jonathan.

### Color Tokens (source of truth: `src/shared/styles/index.css`)

**Dark mode surfaces:**
- Page background: `#1e1e1e` (`hsl(0 0% 12%)`)
- Card / panel background: `#2e2e2e` (`hsl(0 0% 18%)`)
- Topbar background: `#242424` (`hsl(0 0% 14%)`)
- Sidebar background: `hsl(0 0% 9%)` — always dark in BOTH modes, never changes

**Light mode surfaces:**
- Page background: `#F5F3EE` (warm cream)
- Card / panel background: `#FFFFFF` (pure white, pops against cream)
- Topbar background: `#FFFFFF`

**Brand colors (same in both modes):**
- Gold accent: `#D4A017` (`var(--skyshare-gold)`) — primary accent, buttons, active states, rules
- Gold light: `#E8B830` (`var(--skyshare-gold-light)`)
- SkyShare Red: `#C10230` (`var(--skyshare-red)`)
- Crimson: `#8B1A1A` (`var(--skyshare-crimson)`) — used in gradient dividers
- Navy: `#012E45` (`var(--skyshare-navy)`) — used in gradient dividers
- Blue-mid: `#466481` (`var(--skyshare-blue-mid)`)
- Success green: `#10B981` (`var(--skyshare-success)`)

### Typography

- **Display / H1 headings**: `'Bebas Neue'` via `var(--font-display)` — large, uppercase, `letter-spacing: 0.05em`
- **Section labels / card titles / UI labels**: `'Montserrat'` via `var(--font-heading)` — uppercase, `letter-spacing: 0.15em` (card titles) or `letter-spacing: 0.2em` (sidebar section labels at 10px)
- **Body text**: `'Inter'` via `var(--font-body)` — regular weight, normal tracking
- **Page H1s**: Always use Bebas Neue + uppercase. Follow with a 1px gold `#D4A017` horizontal rule (width ~3.5rem), then a subtitle in Montserrat at `letter-spacing: 0.1em`

### Cards & Panels

All new cards must use the `card-elevated` CSS class, which applies:
- **Dark mode**: `background: hsl(0 0% 18%)`, `box-shadow: 0 0 0 1px rgba(255,255,255,0.07), inset 0 0 0 1px rgba(212,160,23,0.15)`, `border-color: transparent`
- **Light mode**: `background: #ffffff`, `box-shadow: 0 4px 24px rgba(0,0,0,0.08)`, `border-color: transparent`

Clickable/interactive cards also get `card-hoverable`:
- `cursor: pointer`, `transition: transform 0.15s ease`
- On hover: `translateY(-1px)`, deeper shadow

**Colored top or left border accents on cards:**
- Stat/KPI cards: colored left border (`3px solid <accent-color>`)
- Content/activity cards: gold top border (`2px solid var(--skyshare-gold)`)
- Card header divider: `1px solid hsl(var(--border))`

**Text inside cards:**
- Card titles: `text-foreground` (white in dark, near-black in light), Montserrat, uppercase, `letter-spacing: 0.15em`
- Subtitles / descriptions: `text-muted-foreground` (~`#888`)
- Empty state messages: `rgba(255,255,255,0.35)` in dark mode

**Icon containers inside cards:**
- Rounded square (`rounded`), colored background at 0.15 opacity of the icon's accent color
- Example: gold icon → `rgba(212,160,23,0.15)` bg; red icon → `rgba(220,50,50,0.15)` bg

### Sidebar

- Background: always `hsl(0 0% 9%)` — dark in BOTH light and dark modes
- Logo area: centered, large logo (`h-10`), "MAINTENANCE" label in gold Montserrat 9px `tracking-[0.3em]`, followed by a 1px gold rule (`width: 2rem`, 50% opacity)
- Below logo: crimson→navy gradient stripe divider (`.stripe-divider`)
- Section labels: gold, Montserrat, 10px, `letter-spacing: 0.2em`, 55% opacity
- Nav items: `text-white/45`, hover → `text-white/80` + gold underline animates in
- Active nav item: gold left bar (3px) + `linear-gradient(to right, rgba(212,160,23,0.15), transparent)` bg + gold icon + white text
- Footer: version string in `hsl(0 0% 28%)`, Montserrat

### Dividers

- **Section stripe divider**: `.stripe-divider` — `2px`, `linear-gradient(90deg, #8B1A1A 0%, #012E45 100%)`
- Use between major dashboard sections (e.g. between KPI cards and activity cards)

### Search Bar

- Underline-only style (no box): use `.search-underline` CSS class on `<Input>`
- Bottom border animates to gold on focus

### Skeleton Loaders

- All skeletons use `.skeleton-gold` class: `rgba(212,160,23,0.18)` background with custom pulse

### Backgrounds

- **Dark mode page**: `#1e1e1e` + subtle CSS noise grain overlay (2.5% opacity, `body::after`)
- **Light mode page**: `#F5F3EE` warm cream — no patterns, no stripes
- **Hero area only**: `.hero-area` class adds faint 1px diagonal line pattern (4% opacity gold) — only on the heading section of a page, not full page

### Interaction / Cursor Rules

- All sidebar nav links: `cursor: pointer`
- Static display numbers / text: `cursor: default`
- Clickable cards: `cursor: pointer` via `card-hoverable`
- No pointer on informational-only elements

---

## Component Patterns

When building new pages, follow this structure:

```tsx
// Page hero
<div className="hero-area">
  <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
    PAGE TITLE
  </h1>
  <div style={{ height: "1px", background: "var(--skyshare-gold)", width: "3.5rem" }} />
  <p style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.1em" }}>
    Subtitle text
  </p>
</div>

// Stat card
<Card className="card-elevated card-hoverable border-0" style={{ borderLeft: "3px solid <accent>" }}>
  <CardHeader>
    <CardTitle style={{ fontFamily: "var(--font-heading)", fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase" }}>
      Label
    </CardTitle>
  </CardHeader>
</Card>

// Content card
<Card className="card-elevated card-hoverable border-0" style={{ borderTop: "2px solid var(--skyshare-gold)" }}>
  ...
</Card>

// Section divider
<div className="stripe-divider" />
```

---

## Data Architecture — Interconnected by Design

This is a maintenance portal for a specific fleet of aircraft. The fleet is the nucleus — nearly every feature (discrepancies, parts, compliance, training, documentation) relates back to individual tail numbers and their configurations. These modules are separated in the UI for human usability, but they share data and cross-reference each other throughout the database. When changing aircraft data, engine models, document references, or any fleet-level information, check for downstream impact in related modules. A single aircraft change can ripple across compliance audits, discrepancy records, parts history, and detail cards.

---

## Database & Supabase Rules

- All user-scoped tables must have a `user_id UUID` referencing `auth.users(id) ON DELETE CASCADE` — not `profiles.id`
- RLS must be enabled on every new table before any data is inserted
- Always write explicit, scoped RLS policies — `USING (true)` or `WITH CHECK (true)` on write operations is not acceptable
- Use the existing DB helpers (`has_role`, `has_permission`, `is_admin_or_super`) for role checks in policies — do not re-implement inline
- Sensitive mutations (role changes, status changes, permission grants/revokes) go through Netlify functions using the service role — not direct client-side Supabase calls
- After any schema change, regenerate and update `src/entities/supabase.ts`
- `access_requests` is the only table that permits unauthenticated inserts — all others require auth
