import { test, expect } from "./fixtures/auth";

/**
 * Visual regression baselines for the admin (Bucket C foundation).
 *
 * Requires authenticated session — see `fixtures/auth.ts`. Set
 * PLAYWRIGHT_ADMIN_PASSWORD env var before running.
 *
 * First run: `npm run test:e2e:update-snapshots` to generate baselines.
 * Subsequent runs: `npm run test:e2e` compares against the committed
 * PNGs under `tests-e2e/visual.spec.ts-snapshots/`.
 *
 * The 60+ admin pages aren't all covered yet — this baseline covers the
 * highest-traffic surfaces. Add new specs here as pages are touched.
 */

const VIEWPORT = { width: 1440, height: 900 };

const SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.001,
  fullPage: false,
  animations: "disabled" as const,
};

test.describe("Admin visual regression — Bucket C foundation", () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.setViewportSize(VIEWPORT);
  });

  test("dashboard renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/dashboard");
    await adminPage.waitForLoadState("networkidle");
    // Mask any dynamic content (timestamps, "1 hour ago" labels, charts
    // with live data) before screenshot so the baseline is stable.
    await expect(adminPage).toHaveScreenshot("dashboard.png", SCREENSHOT_OPTIONS);
  });

  test("operator hotels list renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/operator/hotels");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("operator-hotels.png", SCREENSHOT_OPTIONS);
  });

  test("bucket3 cases list renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/bucket3/cases");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("bucket3-cases.png", SCREENSHOT_OPTIONS);
  });

  test("bucket3 payroll list renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/bucket3/payroll");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("bucket3-payroll.png", SCREENSHOT_OPTIONS);
  });

  test("bucket3 non-service-hours renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/bucket3/non-service-hours");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("bucket3-non-service-hours.png", SCREENSHOT_OPTIONS);
  });

  test("bucket3 subscriptions renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/bucket3/subscriptions");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("bucket3-subscriptions.png", SCREENSHOT_OPTIONS);
  });

  test("platform companies renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/platform/companies");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("platform-companies.png", SCREENSHOT_OPTIONS);
  });

  test("platform finance renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/platform/finance");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("platform-finance.png", SCREENSHOT_OPTIONS);
  });

  test("platform audit logs renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/platform/audit-logs");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("platform-audit-logs.png", SCREENSHOT_OPTIONS);
  });

  test("localization ui translations renders to baseline", async ({ adminPage }) => {
    await adminPage.goto("/localization/ui-translations");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage).toHaveScreenshot("localization-ui-translations.png", SCREENSHOT_OPTIONS);
  });
});
