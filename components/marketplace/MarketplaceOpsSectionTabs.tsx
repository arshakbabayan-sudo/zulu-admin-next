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
  // Tabler icons match docs/admin_designe/6_management.html section-tabs spec.
  // 2026-06-04 — service-logs sibling absorbed into /platform/audit-logs; no
  // alias remap needed.
  return (
    <SectionTabs
      activeHref={activeHref}
      items={[
        {
          href: "/platform/companies",
          label: "Companies",
          count: counts?.companies,
          icon: <i className="ti ti-building-community" aria-hidden />,
        },
        {
          href: "/platform/seller-applications",
          label: "Seller applications",
          count: counts?.sellerApplications,
          icon: <i className="ti ti-user-check" aria-hidden />,
        },
        // Phase 2C / 4A (2026-05-31) — Users tab removed from Management.
        // /platform/users now lives under the Directory sidebar group.
        {
          href: "/platform/contracts",
          label: "Contracts",
          count: counts?.contracts,
          icon: <i className="ti ti-file-text" aria-hidden />,
        },
        {
          href: "/platform/contract-templates",
          label: "Contract templates",
          count: counts?.contractTemplates,
          icon: <i className="ti ti-template" aria-hidden />,
        },
        {
          href: "/platform/audit-logs",
          label: "Logs",
          icon: <i className="ti ti-history" aria-hidden />,
        },
      ]}
    />
  );
}

// 2026-06-04 admin v3 — LogsInnerTabs (Audit / Services inner-tab strip)
// removed. Both views shared the same backend endpoint differing only by
// a category filter, so the strip duplicated UI. The Logs page now uses
// its existing Category dropdown filter. Per spec
// `docs/blueprints/html-handoff/Management_tab.md` TAB 5.
