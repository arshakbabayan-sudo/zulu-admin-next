/**
 * Management group (renamed from "Marketplace ops" in Phase 1 2026-05-31)
 * — shared section tabs at the top of every Management list page.
 *
 * Phase 1 / Phase 2 trim (2026-05-31):
 *   - Approval queue tab REMOVED. The page never owned its approve/reject
 *     actions (they happen on Companies / Reviews / Offer pages) — it was a
 *     decorative inbox. Stripped here so the user doesn't see a tab from
 *     the page they just landed on.
 *   - Audit logs + Service logs merged under a single "Logs" entry that
 *     lands on /platform/audit-logs. The two views live as tabs INSIDE the
 *     Logs feature (rendered by LogsInnerTabs below).
 *
 * Mirrors components/finance/FinanceSectionTabs.tsx — `counts` prop is
 * optional and per-tab; pages that haven't fetched their list yet may
 * omit the corresponding key.
 */

import { SectionTabs } from "@/components/ui/v2";

export type MarketplaceOpsCounts = Partial<{
  companies: number;
  sellerApplications: number;
  contracts: number;
  contractTemplates: number;
  unverifiedAccounts: number;
}>;

type Props = {
  activeHref: string;
  counts?: MarketplaceOpsCounts;
};

export function MarketplaceOpsSectionTabs({ activeHref, counts }: Props) {
  // Both Logs views (audit + services) highlight the same "Logs" outer tab.
  const logsActiveHref =
    activeHref === "/bucket3/service-logs" ? "/platform/audit-logs" : activeHref;
  return (
    <SectionTabs
      activeHref={logsActiveHref}
      items={[
        { href: "/platform/companies", label: "Companies", count: counts?.companies },
        {
          href: "/platform/seller-applications",
          label: "Seller applications",
          count: counts?.sellerApplications,
        },
        // Phase 2C / 4A (2026-05-31) — Users tab removed from Management.
        // /platform/users now lives under the Directory sidebar group.
        { href: "/platform/contracts", label: "Contracts", count: counts?.contracts },
        {
          href: "/platform/contract-templates",
          label: "Contract templates",
          count: counts?.contractTemplates,
        },
        { href: "/platform/audit-logs", label: "Logs" },
      ]}
    />
  );
}

/**
 * Inner Logs feature tabs — rendered ABOVE the page body on both
 * /platform/audit-logs and /bucket3/service-logs. Visually groups the two
 * data views (Audit / Services) as facets of one Logs feature.
 */
export function LogsInnerTabs({ activeHref }: { activeHref: string }) {
  return (
    <SectionTabs
      activeHref={activeHref}
      items={[
        { href: "/platform/audit-logs", label: "Audit" },
        { href: "/bucket3/service-logs", label: "Services" },
      ]}
    />
  );
}
