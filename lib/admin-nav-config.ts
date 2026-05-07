/** Sidebar / title: translation keys resolved with {@link useLanguage}.t */

export type AdminPlatformNavLink = {
  href: string;
  labelKey: string;
  superAdminOnly?: boolean;
};

export type AdminInventoryNavLink = {
  href: string;
  labelKey: string;
  perm: string;
};

export const ADMIN_PLATFORM_LINKS: AdminPlatformNavLink[] = [
  { href: "/dashboard", labelKey: "admin.nav.dashboard" },
  { href: "/platform/company-applications", labelKey: "admin.nav.company_applications" },
  { href: "/platform/companies", labelKey: "admin.nav.platform_companies" },
  { href: "/platform/approvals", labelKey: "admin.nav.approvals" },
  { href: "/platform/pending-review", labelKey: "admin.nav.pending_review", superAdminOnly: true },
  { href: "/platform/users", labelKey: "admin.nav.users" },
  { href: "/platform/seller-applications", labelKey: "admin.nav.seller_applications" },
  { href: "/platform/bookings", labelKey: "admin.nav.bookings" },
  { href: "/platform/invoices", labelKey: "admin.nav.invoices" },
  { href: "/platform/commissions", labelKey: "admin.nav.commissions" },
  { href: "/platform/finance", labelKey: "admin.nav.finance" },
  { href: "/platform/payments", labelKey: "admin.nav.payments" },
  { href: "/platform/package-orders", labelKey: "admin.nav.package_orders" },
  { href: "/platform/finance-summary", labelKey: "admin.nav.finance_summary" },
  { href: "/platform/packages", labelKey: "admin.nav.packages" },
  { href: "/platform/reviews", labelKey: "admin.nav.reviews" },
  { href: "/platform/connections", labelKey: "admin.nav.platform_connections" },
  { href: "/platform/banners", labelKey: "admin.nav.banners", superAdminOnly: true },
  { href: "/platform/settings", labelKey: "admin.nav.settings" },
  { href: "/platform/locations", labelKey: "admin.nav.locations", superAdminOnly: true },
];

import type { SellerServiceType } from "./auth-types";

export type AdminOperatorNavLink = {
  href: string;
  labelKey: string;
  /** When set, link is shown only if the user's active company has this seller service type enabled. Super admin sees all. */
  serviceType?: SellerServiceType;
};

export const ADMIN_OPERATOR_LINKS: AdminOperatorNavLink[] = [
  { href: "/operator/flights", labelKey: "admin.nav.operator_flights", serviceType: "flight" },
  { href: "/operator/hotels", labelKey: "admin.nav.operator_hotels", serviceType: "hotel" },
  { href: "/operator/transfers", labelKey: "admin.nav.operator_transfers", serviceType: "transfer" },
  { href: "/operator/cars", labelKey: "admin.nav.operator_cars", serviceType: "car" },
  { href: "/operator/excursions", labelKey: "admin.nav.operator_excursions", serviceType: "excursion" },
  { href: "/operator/visas", labelKey: "admin.nav.operator_visas", serviceType: "visa" },
  { href: "/operator/packages", labelKey: "admin.nav.operator_packages", serviceType: "package" },
  { href: "/operator/offers", labelKey: "admin.nav.operator_offers" },
];

export const ADMIN_INVENTORY_LINKS: AdminInventoryNavLink[] = [
  { href: "/inventory/flights", labelKey: "admin.nav.inventory_flights", perm: "flights.view" },
  { href: "/inventory/hotels", labelKey: "admin.nav.inventory_hotels", perm: "hotels.view" },
  { href: "/inventory/transfers", labelKey: "admin.nav.inventory_transfers", perm: "transfers.view" },
  { href: "/inventory/cars", labelKey: "admin.nav.inventory_cars", perm: "cars.view" },
  { href: "/inventory/excursions", labelKey: "admin.nav.inventory_excursions", perm: "excursions.view" },
];

export const ADMIN_LOCALIZATION_LINKS: { href: string; labelKey: string }[] = [
  { href: "/localization/languages", labelKey: "admin.nav.localization_languages" },
  { href: "/localization/ui-translations", labelKey: "admin.nav.localization_ui_translations" },
  { href: "/localization/translations", labelKey: "admin.nav.localization_content_translations" },
  { href: "/localization/templates", labelKey: "admin.nav.localization_templates" },
];

const ADMIN_EXTRA_PAGE_TITLE_LINKS: { href: string; labelKey: string }[] = [
  { href: "/support/tickets", labelKey: "admin.nav.support_tickets" },
  { href: "/connections", labelKey: "admin.nav.service_connections" },
  { href: "/notifications", labelKey: "admin.nav.notifications" },
  { href: "/statistics", labelKey: "admin.nav.operator_statistics" },
];

/** Longest href first so nested routes resolve to the parent section title. */
export function resolveAdminPageTitle(pathname: string, t: (key: string) => string): string {
  const all = [
    ...ADMIN_PLATFORM_LINKS.map(({ href, labelKey }) => ({ href, labelKey })),
    ...ADMIN_OPERATOR_LINKS,
    ...ADMIN_INVENTORY_LINKS,
    ...ADMIN_LOCALIZATION_LINKS,
    ...ADMIN_EXTRA_PAGE_TITLE_LINKS,
  ].sort((a, b) => b.href.length - a.href.length);

  for (const l of all) {
    if (pathname === l.href || pathname.startsWith(`${l.href}/`)) {
      return t(l.labelKey);
    }
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return t("admin.nav.dashboard");
  return parts.map((p) => p.replace(/-/g, " ")).join(" / ");
}
