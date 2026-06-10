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
  const items = [
    { href: "/platform/finance-summary", label: "Finance summary" },
    { href: "/platform/invoices", label: "Invoices", count: counts?.invoices },
    { href: "/platform/payments", label: "Payments", count: counts?.payments },
    { href: "/platform/commissions", label: "Commissions", count: counts?.commissions },
    { href: "/platform/finance", label: "Transactions", count: counts?.transactions },
    { href: "/platform/vouchers", label: "Vouchers", count: counts?.vouchers },
  ];
  if (user?.is_super_admin) {
    items.push({ href: "/bucket3/per-x-invoicing", label: "Per-X invoicing" });
  }
  return <SectionTabs activeHref={activeHref} items={items} />;
}
