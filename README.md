# ZULU Admin (Next.js 15)

The operator / agent / platform-admin surface for ZULU. Production deploys
to Vercel (`admin.zulu.am`) on every push to `main`.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript strict-ish (some `any` left in legacy code — see roadmap E4)
- Tailwind 4 + custom design tokens (ZULU primary purple, Quest CRM patterns)
- Self-hosted UI design system at `components/ui/*` (Button / Card / Input
  / Select / Table / Modal / Drawer / Tabs / Pagination / PageHeader /
  StatusPill / ActiveFiltersChips)
- Sanctum token auth (Bearer) — token stored in localStorage by
  AdminAuthContext

## Local setup

```bash
# 1. Clone + install
git clone git@github.com:arshakbabayan-sudo/zulu-admin-next.git
cd zulu-admin-next
npm install

# 2. Env
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL — usually unset for local dev so the
# `/api/proxy/*` Next rewrite hits 127.0.0.1:8008 (Laravel)

# 3. Serve
npm run dev
# Open http://localhost:3000
```

The backend must be running at `http://127.0.0.1:8008` for `/api/proxy/*`
rewrites to work. See `next.config.mjs` for the rewrite rules.

## Daily commands

```bash
npm run dev            # dev server with hot reload
npm run build          # production build (must pass before merging)
npm run start          # serve the production build locally
npm run lint           # ESLint
npx tsc --noEmit       # type-check (run frequently — Vercel CI is strict)
```

## Project structure

```
app/
  (admin)/                  ← all authenticated admin pages
    bucket3/                ← Bucket-3 modules (cases, customers, payroll, etc.)
    operator/               ← Operator-only screens (hotels, excursions, transfers)
    platform/               ← Super-admin / platform-admin screens
    support/                ← Support tickets workspace
    localization/           ← UI translation editor
    layout.tsx              ← admin shell (sidebar, header, lang switcher)
  login/                    ← public auth pages
  register/operator/
  register/agent/
  forgot-password/
  reset-password/
  2fa/
  api/proxy/                ← Next rewrite proxy → Laravel API (dev only)
components/
  ui/                       ← design system primitives (one-stop import)
  ForbiddenNotice.tsx
  PlatformAdminGuard.tsx
contexts/                   ← AdminAuthContext, LanguageContext
hooks/                      ← useDebounce, useExcursionWizardStepper
lib/                        ← api-client, api-base, access, zulu-lang, etc.
public/                     ← static assets (logo, favicons, brand SVGs)
```

## Conventions

- All API calls go through `lib/api-client.ts` (`apiFetchJson` or `apiDownloadFile`).
- Auth state lives in `AdminAuthContext` — read with `useAdminAuth()`.
- Access checks: `canAccessSupportNav(user)`, `canAccessPlatformAdminNav(user)`, etc. from `lib/access`.
- Forbidden surfaces render `<ForbiddenNotice />` instead of crashing.
- Pages import from `@/components/ui` (barrel), never individual files.
- Status / priority chips: `<StatusPill status="success">...</StatusPill>`; tones: `neutral | info | success | warning | danger`.
- Modal vs Drawer: modal for short forms (< 5 fields); Drawer for detail views with multiple sections.
- Active filters above a list: `<ActiveFiltersChips filters={[...]} onClearAll={...} />`.
- Search inputs: debounce 300ms via `useDebounce(draft, 300)`, never Enter-to-search.

## Deploy

`main` auto-deploys to Vercel (`admin.zulu.am`) on every push. Pre-deploy
hooks run lint + build; a broken build blocks deploy.

**Vercel ESLint silent-fail gotcha:** if `next.config.mjs` has
`eslint: { ignoreDuringBuilds: true }`, lint failures don't block deploy.
Make sure that flag is `false` (or removed) on `main`.

## Documentation

- `../docs/decisions/ADR-*.md` — architecture decisions
- `../docs/design/specs/zulu-*.md` — Figma specs cached for offline reference
- `../docs/roadmaps/zulu-roadmap-2026-05-20.md` — what's still on the burn-down

## Adding a new admin page

1. Pick the route family: `app/(admin)/<family>/<name>/page.tsx`.
2. Use `useAdminAuth()` to read token + user.
3. Guard with the right `canAccess*` helper; render `<ForbiddenNotice />` if denied.
4. Use `apiFetchJson` for data fetches.
5. Use `<PageHeader title="..." subtitle="..." />` + UI primitives.
6. If the page surfaces a new sidebar entry, register a `moduleKey` in
   `lib/access.ts` and add nav-translation seed row backend-side.

## Adding a new translation key

Don't hand-edit `ui_translations` — instead:
```bash
cd ../backend
php artisan localization:import-csv path/to/keys.csv
php artisan cache:forget ui_translations_<lang>
```

Or, add via the admin UI at `/localization/ui-translations`.
