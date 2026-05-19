# Admin E2E tests

Playwright-based end-to-end tests for the ZULU admin app.

## One-time setup

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

## Running

```bash
# Local (auto-starts npm run dev in the background)
npm run test:e2e

# Interactive UI mode (great for debugging)
npm run test:e2e:ui

# Single test file
npx playwright test tests-e2e/login.spec.ts

# Against a staging URL
BASE_URL=https://admin-preview.zulu.am npm run test:e2e
```

## What's covered today

| File | Tests | What |
|---|---|---|
| `login.spec.ts` | 5 | Login + forgot-password page rendering, OAuth buttons visible, no console errors, protected-route anon redirect |

## What's planned (roadmap §F1)

- Authenticated session helper (login once, reuse storage state)
- Hotel creation flow (operator persona)
- Booking creation flow (customer persona, on the frontend repo)
- Case create + reply (super-admin persona)
- Payroll create → finalize → mark paid (operator persona)
- Bulk-notification send (super-admin)

Each authenticated flow needs:
1. Seeded test users in the DB (via Laravel `tinker` setup script or
   factories accessible via `.test.zulu.am` subdomain — TBD)
2. A `loginAs(role)` helper that authenticates once per worker
3. The actual flow assertions

## CI integration (planned)

GitHub Actions workflow `e2e.yml` runs on every push to `main` and PRs:

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
- name: Build app
  run: npm run build
- name: Start app
  run: npm run start &
- name: Wait for app
  run: npx wait-on http://localhost:3002
- name: Run E2E tests
  run: npm run test:e2e
  env:
    CI: "true"
```

The workflow file is not in this commit — it'll land when the auth helper
+ at least 5 flow tests are ready (so the first CI run doesn't immediately
fail and become annoying to deal with).

## Why Playwright and not Cypress?

- Free, no SaaS lock-in
- Built-in trace viewer (great for "what happened on this CI failure?")
- Parallel by default
- Better TypeScript support
- Already used in Claude Code's MCP integration locally
