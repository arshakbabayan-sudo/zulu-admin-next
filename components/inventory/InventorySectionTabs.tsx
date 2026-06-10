/**
 * Inventory group — shared section tabs (v2 admin-redesign).
 *
 * Used by all 8 operator inventory pages (Hotels, Flights, Transfers, Cars,
 * Excursions, Visas, Packages, Offers). Mirrors
 * components/finance/FinanceSectionTabs.tsx. Labels come from the seeded
 * ui_translations rows (admin.nav.tab.*) so the strip follows the admin UI
 * language; `tx` falls back to English when a row is missing.
 *
 * `activeCount` is optional — when present, a count pill renders on the
 * ACTIVE tab only (matches the previous per-page inline strips, which only
 * passed `meta?.total` for their own tab).
 *
 *   <InventorySectionTabs activeHref="/operator/hotels" activeCount={meta?.total} />
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

type Props = {
  activeHref: string;
  activeCount?: number;
};

export function InventorySectionTabs({ activeHref, activeCount }: Props) {
  const { t } = useLanguage();
  const defs: Array<{ href: string; key: string; fallback: string }> = [
    { href: "/operator/hotels", key: "admin.nav.tab.hotels", fallback: "Hotels" },
    { href: "/operator/flights", key: "admin.nav.tab.flights", fallback: "Flights" },
    { href: "/operator/transfers", key: "admin.nav.tab.transfers", fallback: "Transfers" },
    { href: "/operator/cars", key: "admin.nav.tab.cars", fallback: "Cars" },
    { href: "/operator/excursions", key: "admin.nav.tab.excursions", fallback: "Excursions" },
    { href: "/operator/visas", key: "admin.nav.tab.visas", fallback: "Visas" },
    { href: "/operator/packages", key: "admin.nav.tab.packages", fallback: "Packages" },
    { href: "/operator/offers", key: "admin.nav.tab.offers", fallback: "Offers" },
  ];
  return (
    <SectionTabs
      activeHref={activeHref}
      items={defs.map((d) => ({
        href: d.href,
        label: tx(t, d.key, d.fallback),
        count: d.href === activeHref ? activeCount : undefined,
      }))}
    />
  );
}
