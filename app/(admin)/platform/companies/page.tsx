"use client";

/**
 * /platform/companies — admin v3 (2026-06-04).
 *
 * The Companies route is rendered by the unified Management page (1:1 port
 * of `docs/admin_designe/6_management.html`). The page picks the right
 * top-level tab based on the `initialTab` prop. Pre-2026-06-04 chrome (the
 * old `V2PageHeader` + `MarketplaceOpsSectionTabs` + per-page tables) lived
 * in this file and is now gone; everything is rendered inside MgmtPage.
 */
import { MgmtPage } from "../management/MgmtPage";

export default function PlatformCompaniesPage() {
  return <MgmtPage initialTab="companies" />;
}
