import { test, expect } from "@playwright/test";

/**
 * F1 — Admin hotel CRUD smoke test.
 *
 * Critical flow: operator logs in → operator/hotels list loads →
 * "+ Add hotel" wizard opens.
 *
 * The CRUD is not run end-to-end against the prod DB (would leave
 * test rows). The test stops at the first step that would mutate
 * data; it verifies that the *path* to mutation is unbroken.
 *
 * Skips if E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD aren't set so the
 * suite stays green for contributors without test creds.
 */

test.describe("Admin hotel CRUD smoke", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD) {
      test.skip(true, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing");
      return;
    }
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL);
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in|login|մուտք/i }).click();
    await page.waitForURL(/\/platform|\/operator/, { timeout: 15_000 });
  });

  test("operator/hotels list loads and exposes Add-Hotel CTA", async ({ page }) => {
    await page.goto("/operator/hotels");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // Heading present.
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // Either a table of hotels or an empty-state. Either way, the
    // "+Add" CTA should be visible because operator/hotels is a CRUD
    // landing page.
    const addCta = page.getByRole("button", { name: /add|նոր|новый|create/i });
    await expect(addCta.first()).toBeVisible({ timeout: 10_000 });
  });

  test("platform/companies list loads (super-admin sanity check)", async ({ page }) => {
    await page.goto("/platform/companies");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("platform/bookings list loads", async ({ page }) => {
    await page.goto("/platform/bookings");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
