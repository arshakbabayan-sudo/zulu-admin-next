/**
 * Marketplace ops group — shared section tabs (v2 admin-redesign).
 *
 * Used by all 9 Marketplace ops list pages per
 * docs/admin_designe/marketplace_ops/marketplace_ops_implementation_prompt.md
 * "Reusable component" section. List ordering matches
 * docs/admin_designe/marketplace_ops/marketplace_ops_mocks.html.
 *
 * Mirrors components/finance/FinanceSectionTabs.tsx — `counts` prop is
 * optional and per-tab; pages that haven't fetched their list yet may
 * omit the corresponding key.
 */

import { SectionTabs } from "@/components/ui/v2";

export type MarketplaceOpsCounts = Partial<{
  approvals: number;
  companies: number;
  sellerApplications: number;
  users: number;
  contracts: number;
  contractTemplates: number;
  unverifiedAccounts: number;
}>;

type Props = {
  activeHref: string;
  counts?: MarketplaceOpsCounts;
};

export function MarketplaceOpsSectionTabs({ activeHref, counts }: Props) {
  return (
    <SectionTabs
      activeHref={activeHref}
      items={[
        { href: "/platform/approvals", label: "Approval queue", count: counts?.approvals },
        { href: "/platform/companies", label: "Companies", count: counts?.companies },
        {
          href: "/platform/seller-applications",
          label: "Seller applications",
          count: counts?.sellerApplications,
        },
        { href: "/platform/users", label: "Users", count: counts?.users },
        { href: "/platform/contracts", label: "Contracts", count: counts?.contracts },
        {
          href: "/platform/contract-templates",
          label: "Contract templates",
          count: counts?.contractTemplates,
        },
        { href: "/platform/audit-logs", label: "Audit logs" },
        { href: "/bucket3/service-logs", label: "Service logs" },
        // Phase Ա.6 — Unverified accounts moved into /platform/users?type=unverified;
        // tab removed here to match the sidebar.
      ]}
    />
  );
}
