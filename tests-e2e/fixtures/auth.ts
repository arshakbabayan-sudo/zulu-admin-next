import { test as base, expect, type Page } from "@playwright/test";

/**
 * Authenticated session fixture for admin E2E tests.
 *
 * Usage:
 *   import { test } from "../fixtures/auth";
 *   test("dashboard renders for super admin", async ({ adminPage }) => {
 *     await adminPage.goto("/dashboard");
 *     ...
 *   });
 *
 * Default credentials come from env (set in CI / .env.local for dev):
 *   PLAYWRIGHT_ADMIN_EMAIL    (default: arshakbabayan@gmail.com)
 *   PLAYWRIGHT_ADMIN_PASSWORD (required — never default for safety)
 *
 * Token is cached in localStorage between specs in the same worker so
 * the login form only runs once. Each new worker re-logs in.
 */
export const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ page }, use) => {
    const email = process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "arshakbabayan@gmail.com";
    const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
    if (!password) {
      throw new Error(
        "PLAYWRIGHT_ADMIN_PASSWORD env var required for authenticated specs"
      );
    }

    await page.goto("/login");

    // The admin login is a simple email/password form. Fill it.
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // After successful login, the app redirects to /dashboard.
    await page.waitForURL(/\/dashboard|\/operator|\/platform|\/agent/, {
      timeout: 15_000,
    });

    await use(page);
  },
});

export { expect };
