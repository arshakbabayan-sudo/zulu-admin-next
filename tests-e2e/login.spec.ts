import { test, expect } from "@playwright/test";

/**
 * Smoke tests for the public-facing auth pages of the admin app.
 *
 * These don't authenticate — they just verify the pages render without
 * runtime errors, the form fields exist, and links between the pages
 * work. Authenticated flows require seeded test fixtures which is a
 * separate setup (see `tests-e2e/README.md`).
 */

test.describe("admin /login", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/login|sign in|ZULU/i);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
  });

  test("shows the OAuth buttons (Google + Facebook)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /facebook/i })).toBeVisible();
  });

  test("has a 'forgot password' link", async ({ page }) => {
    await page.goto("/login");
    const link = page.getByRole("link", { name: /forgot|reset/i });
    await expect(link).toBeVisible();
  });

  test("has no console errors on first paint", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});

test.describe("admin /forgot-password", () => {
  test("renders the email reset form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send|submit|reset/i })).toBeVisible();
  });
});

test.describe("admin protected routes redirect anon to /login", () => {
  test("/operator/hotels (anon) redirects to login", async ({ page }) => {
    await page.goto("/operator/hotels");
    // Next router uses client-side redirects for protected routes — wait
    // for either the URL change or the login form to appear.
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("/bucket3/cases (anon) redirects to login", async ({ page }) => {
    await page.goto("/bucket3/cases");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
