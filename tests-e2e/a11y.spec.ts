import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * G3 — WCAG accessibility baseline for the admin shell.
 *
 * Admin is authenticated; these tests assume the existing login.spec
 * pattern (env-driven test credentials) is wired up. If not, gate them
 * by environment variable so they don't fail the suite when creds are
 * missing.
 */

const AUTH_PAGES: { name: string; path: string }[] = [
  { name: "Dashboard", path: "/platform/dashboard" },
  { name: "Companies list", path: "/platform/companies" },
  { name: "Bookings list", path: "/platform/bookings" },
  { name: "Users list", path: "/platform/users" },
  { name: "Operator hotels list", path: "/operator/hotels" },
];

test.describe("Admin a11y baseline", () => {
  test.beforeEach(async ({ page, context: _context }) => {
    if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD) {
      test.skip(
        true,
        "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing — skipping authed a11y suite",
      );
      return;
    }
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in|login|մուտք/i }).click();
    await page.waitForURL(/\/platform|\/operator/, { timeout: 15_000 });
  });

  for (const { name, path } of AUTH_PAGES) {
    test(`${name} — no serious/critical a11y violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle", { timeout: 15_000 });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );

      if (blocking.length > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `\n=== ${name} (${path}) — ${blocking.length} blocking violation(s) ===`,
        );
        for (const v of blocking) {
          // eslint-disable-next-line no-console
          console.log(
            `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`,
          );
        }
      }

      expect(blocking, `${name}: ${blocking.length} blocking violations`).toEqual([]);
    });
  }
});
