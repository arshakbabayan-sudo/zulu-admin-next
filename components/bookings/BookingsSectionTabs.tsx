/**
 * Bookings group — shared section tabs (v2 admin-redesign).
 *
 * Used by /platform/bookings (All bookings) and /platform/package-orders.
 * Mirrors components/finance/FinanceSectionTabs.tsx. The `counts` prop
 * is optional and per-tab — pages that haven't fetched their list yet may
 * omit the corresponding key.
 */

import { SectionTabs } from "@/components/ui/v2";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Local i18n shim — returns `fallback` when the server translation row for
 * `key` hasn't been seeded yet (t() echoes the key on a miss).
 */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

export type BookingsCounts = Partial<{
  bookings: number;
  packageOrders: number;
}>;

type Props = {
  activeHref: string;
  counts?: BookingsCounts;
};

export function BookingsSectionTabs({ activeHref, counts }: Props) {
  const { t } = useLanguage();
  return (
    <SectionTabs
      activeHref={activeHref}
      items={[
        {
          href: "/platform/bookings",
          label: tx(t, "admin.nav.tab.all_bookings", "All bookings"),
          count: counts?.bookings,
        },
        {
          href: "/platform/package-orders",
          label: tx(t, "admin.nav.tab.package_orders", "Package orders"),
          count: counts?.packageOrders,
        },
      ]}
    />
  );
}
