/**
 * Bookings group — shared section tabs (v2 admin-redesign).
 *
 * Used by /platform/bookings (All bookings) and /platform/package-orders.
 * Mirrors components/finance/FinanceSectionTabs.tsx. The `counts` prop
 * is optional and per-tab — pages that haven't fetched their list yet may
 * omit the corresponding key.
 */

import { SectionTabs } from "@/components/ui/v2";

export type BookingsCounts = Partial<{
  bookings: number;
  packageOrders: number;
}>;

type Props = {
  activeHref: string;
  counts?: BookingsCounts;
};

export function BookingsSectionTabs({ activeHref, counts }: Props) {
  return (
    <SectionTabs
      activeHref={activeHref}
      items={[
        { href: "/platform/bookings", label: "All bookings", count: counts?.bookings },
        {
          href: "/platform/package-orders",
          label: "Package orders",
          count: counts?.packageOrders,
        },
      ]}
    />
  );
}
