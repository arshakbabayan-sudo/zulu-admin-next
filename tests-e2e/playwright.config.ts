import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the ZULU admin E2E suite.
 *
 * Tests live in `tests-e2e/*.spec.ts`. Run with `npm run test:e2e` or
 * `npm run test:e2e:ui` for the interactive UI.
 *
 * To install Playwright + browsers (one-time setup):
 *   npm install --save-dev @playwright/test
 *   npx playwright install --with-deps chromium
 *
 * In CI, set BASE_URL to the staging/preview URL. Locally, the default
 * assumes `npm run dev` is running on http://localhost:3002.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3002",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // For local dev: spin up `npm run dev` automatically. CI should already
  // have the server running, so skip there.
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        port: 3002,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
