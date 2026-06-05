"use client";

import { AdminShell } from "@/components/AdminShell";
import { AutoDocumentTitle } from "@/components/AutoDocumentTitle";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 2026-06-04 admin v3 — list of route prefixes that opt OUT of AdminShell.
 * The Management routes render their OWN full 1:1 chrome (sidebar + header
 * + page) from `docs/admin_designe/6_management.html` so the AdminShell
 * (older paint) would visually double-up. Add a route prefix here when a
 * page needs to control its own outer chrome.
 */
const MGMT_PREFIXES = [
  "/platform/companies",
  "/platform/seller-applications",
  "/platform/contracts",
  "/platform/contract-templates",
  "/platform/audit-logs",
  // 2026-06-04 — Directory deletion: B2C customers + Unverified accounts moved
  // under Management and reuse its self-contained 1:1 chrome.
  "/platform/b2c-customers",
  "/platform/unverified",
  // 2026-06-05 — Settings consolidation (11_settings.html). Migrated settings
  // pages render the unified SettingsPage chrome; add each route here as it is
  // moved in-page (un-migrated settings pages keep AdminShell).
  "/settings/exchange-rates",
  "/settings/pricing-rules",
  "/settings/money-flow",
  "/platform/reviews",
  "/support/tickets",
  "/platform/locations",
  "/localization/languages",
  "/localization/ui-translations",
  "/localization/translations",
  "/localization/templates",
  // 2026-06-05 pt3 — Content cluster migration. Banners / system notifications /
  // newsletter have NO sub-routes, so they are safe as startsWith prefixes.
  // CMS pages (/pages) is handled by MGMT_EXACT instead: a bare "/pages" prefix
  // would also swallow the /pages/[id]/edit editor, which must keep AdminShell.
  "/platform/banners",
  "/platform/notifications",
  "/platform/newsletter",
  // 2026-06-05 pt3 — Layout cluster migration (header-menu / footer / brand).
  // Exact sub-paths under /platform/settings/*; they have no deeper routes and
  // do NOT collide with the (still-unmigrated) /platform/settings page itself.
  "/platform/settings/header-menu",
  "/platform/settings/footer",
  "/platform/settings/brand",
  // 2026-06-05 pt3 — Marketing cluster migration (loyalty).
  "/platform/loyalty",
  // 2026-06-05 pt3 — System cluster (part 1): security + platform settings.
  // "/platform/settings" also covers the already-listed header-menu/footer/brand
  // sub-routes (all in-page), so they stay consistent.
  "/platform/security",
  "/platform/settings",
  // 2026-06-05 pt3 — System cluster (part 2): webhooks.
  "/platform/webhooks",
  // 2026-06-05 pt3 — System cluster (part 3): connections (agent↔operator
  // service connections). Operator/agent-visible (super:false), so it renders
  // the unified Settings chrome for non-super users too.
  "/connections",
  // 2026-06-05 pt4 — Permissions cluster: RBAC (role overview + permission tree).
  "/platform/rbac",
  // 2026-06-05 pt4 — System cluster: API docs (Swagger UI viewer wrapped in the
  // unified chrome). With this, all 24 Settings sub-pages render in-page.
  "/platform/api-docs",
];

/** Routes that render the unified chrome ONLY on an exact path match (their
 *  sub-routes must keep AdminShell). */
const MGMT_EXACT = ["/pages"];

/**
 * v2 admin-redesign (2026-05-24) — AdminGroupTabs removed.
 *
 * The old shell-level <AdminGroupTabs /> was rendering BEFORE the page's
 * own <V2PageHeader />, putting section-tabs ABOVE the page title. v2
 * mockup has tabs BELOW the title. Every migrated page (Phase Դ + Ե)
 * has its own in-page V2 <SectionTabs /> rendered after V2PageHeader.
 *
 * Unmigrated pages (if any remain) lose their section-tab navigation
 * temporarily until they're migrated — acceptable trade-off so that the
 * 95+ already-migrated pages render in the correct v2 order.
 */
export default function AdminSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, bootstrapped } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (bootstrapped && !token) {
      router.replace("/login");
    }
  }, [bootstrapped, token, router]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-figma-bg-1 text-sm text-fg-t6">
        Loading session…
      </div>
    );
  }

  if (!token) {
    return null;
  }

  // Management routes render their own 1:1 chrome; bypass AdminShell.
  const skipShell =
    !!pathname &&
    (MGMT_EXACT.includes(pathname) || MGMT_PREFIXES.some((p) => pathname.startsWith(p)));
  if (skipShell) {
    return (
      <>
        <AutoDocumentTitle />
        {children}
      </>
    );
  }

  return (
    <AdminShell>
      <AutoDocumentTitle />
      {children}
    </AdminShell>
  );
}
