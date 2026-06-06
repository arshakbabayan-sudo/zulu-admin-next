/**
 * CRM group — shared section tabs rendered at the top of every CRM page.
 *
 * Mirrors components/marketplace/MarketplaceOpsSectionTabs.tsx. The `counts`
 * prop is optional and per-tab; pages that haven't fetched their list yet may
 * omit the corresponding key.
 *
 * Source design: docs/admin_designe/new-admin-designe/files/crm.html
 * (Pipeline · Leads · Deals · Contacts → "Customers" · Activities · Segments)
 * plus the Arshak-requested "Team" tab (per-employee sales performance).
 *
 * Labels are kept in English to match every other admin SectionTabs strip
 * (Companies / Seller applications / Contracts / …). The sidebar entry itself
 * is translated via the admin.nav.section.crm i18n key.
 */

import { SectionTabs } from "@/components/ui/v2";

export type CrmCounts = Partial<{
  leads: number;
  deals: number;
  customers: number;
  activities: number;
}>;

type Props = {
  activeHref: string;
  counts?: CrmCounts;
};

export function CrmSectionTabs({ activeHref, counts }: Props) {
  return (
    <SectionTabs
      activeHref={activeHref}
      items={[
        { href: "/crm/pipeline", label: "Pipeline" },
        { href: "/crm/leads", label: "Leads", count: counts?.leads },
        { href: "/crm/deals", label: "Deals", count: counts?.deals },
        { href: "/crm/customers", label: "Customers", count: counts?.customers },
        { href: "/crm/activities", label: "Activities", count: counts?.activities },
        { href: "/crm/segments", label: "Segments" },
        // 2026-06-06 (Arshak) — "Staff" tab REMOVED. It listed ALL companies'
        // owners platform-wide (apiPlatformUsers) mislabelled as "staff", which
        // is wrong — operators/agents are COMPANIES (Management → Companies), not
        // staff. The per-company employee view is "Team" (company-scoped, with
        // owner-side Add-employee). One tab, correctly scoped.
        { href: "/crm/team", label: "Team" },
        { href: "/crm/options", label: "Options" },
      ]}
    />
  );
}
