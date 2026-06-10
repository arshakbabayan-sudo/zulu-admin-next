/**
 * Finance group — shared section tabs (v2 admin-redesign).
 *
 * Used by all 6 Finance pages (Finance summary, Invoices, Payments, Commissions,
 * Transactions, Vouchers) per docs/admin_designe/finance_group_implementation_prompt.md
 * "Reusable component" section. The list ordering + labels match
 * docs/admin_designe/finance_group_mocks.html.
 *
 * The `counts` prop is optional — when present, each tab shows a pill with
 * the live count. Pages that haven't fetched their list yet can omit it,
 * the tab will just render without a pill.
 *
 *   <FinanceSectionTabs
 *     activeHref="/platform/invoices"
 *     counts={{ invoices: meta.total }}
 *   />
 */

import { SectionTabs } from "@/components/ui/v2";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Local i18n shim — returns `fallback` when the server translation row for
 * `key` hasn't been seeded yet (t() echoes the key on a miss), so tabs never
 * render a raw dotted key.
 */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

export type FinanceCounts = Partial<{
  invoices: number;
  payments: number;
  commissions: number;
  vouchers: number;
  transactions: number;
}>;

type Props = {
  activeHref: string;
  counts?: FinanceCounts;
};

export function FinanceSectionTabs({ activeHref, counts }: Props) {
  // 2026-06-10 (roadmap §1 hidden pages) — Per-X invoicing is a super-admin
  // governance tool (invoice aggregates/statements); it joins the Finance
  // strip only for super admins so operators/agents never see a 403 tab.
  const { user } = useAdminAuth();
  const { t } = useLanguage();
  const items = [
    { href: "/platform/finance-summary", label: tx(t, "admin.nav.tab.finance_summary", "Finance summary") },
    { href: "/platform/invoices", label: tx(t, "admin.nav.tab.invoices", "Invoices"), count: counts?.invoices },
    { href: "/platform/payments", label: tx(t, "admin.nav.tab.payments", "Payments"), count: counts?.payments },
    {
      href: "/platform/commissions",
      label: tx(t, "admin.nav.tab.commissions", "Commissions"),
      count: counts?.commissions,
    },
    { href: "/platform/finance", label: tx(t, "admin.nav.tab.transactions", "Transactions"), count: counts?.transactions },
    { href: "/platform/vouchers", label: tx(t, "admin.nav.tab.vouchers", "Vouchers"), count: counts?.vouchers },
  ];
  if (user?.is_super_admin) {
    items.push({
      href: "/bucket3/per-x-invoicing",
      label: tx(t, "admin.nav.tab.bucket3.per_x_invoicing", "Per-X invoicing"),
    });
  }
  return <SectionTabs activeHref={activeHref} items={items} />;
}
