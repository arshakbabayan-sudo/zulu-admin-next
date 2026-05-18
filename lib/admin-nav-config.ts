/** Sidebar / title: translation keys resolved with {@link useLanguage}.t */

import type { SellerServiceType } from "./auth-types";

// ─── Legacy flat shapes (still used by AdminShell + page-title resolver) ────
// New code should consume ADMIN_NAV_GROUPS instead. These arrays remain for
// resolveAdminPageTitle() back-compat and any direct importer.

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

export type AdminOperatorNavLink = {
  href: string;
  labelKey: string;
  serviceType?: SellerServiceType;
};

// ─── New grouped nav model ─────────────────────────────────────────────────
// Sidebar shows ONE item per group. Pages inside the group render a
// horizontal tab bar via <AdminGroupTabs/>. Existing routes keep working.

export type AdminNavTab = {
  href: string;
  labelKey: string;
  superAdminOnly?: boolean;
  perm?: string;
  serviceType?: SellerServiceType;
};

export type AdminNavGroup = {
  key: string;
  labelKey: string;
  icon: string;
  /** Sidebar link points here. Usually the first tab. */
  defaultHref: string;
  tabs: AdminNavTab[];
  /** Visibility predicate name — wired in AdminShell.tsx. */
  visibility:
    | "always"
    | "platform_admin"
    | "operator_tools"
    | "inventory_oversight"
    | "localization"
    | "super_admin"
    | "bucket3";
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: "dashboard",
    labelKey: "admin.nav.dashboard",
    icon: "/icons/menu/dashboard.svg",
    defaultHref: "/dashboard",
    tabs: [],
    visibility: "always",
  },
  {
    key: "companies_access",
    labelKey: "admin.nav.group.companies_access",
    icon: "/icons/menu/company.svg",
    defaultHref: "/platform/companies",
    tabs: [
      { href: "/platform/companies", labelKey: "admin.nav.tab.active_companies" },
      { href: "/platform/company-applications", labelKey: "admin.nav.tab.applications" },
      { href: "/platform/seller-applications", labelKey: "admin.nav.tab.seller_applications" },
      { href: "/platform/users", labelKey: "admin.nav.tab.users" },
      { href: "/platform/contracts", labelKey: "admin.nav.tab.contracts" },
      { href: "/platform/contract-templates", labelKey: "admin.nav.tab.contract_templates" },
    ],
    visibility: "platform_admin",
  },
  {
    key: "reviews_approvals",
    labelKey: "admin.nav.group.reviews_approvals",
    icon: "/icons/menu/checklist.svg",
    defaultHref: "/platform/pending-review",
    tabs: [
      { href: "/platform/pending-review", labelKey: "admin.nav.tab.pending_offers", superAdminOnly: true },
      { href: "/platform/approvals", labelKey: "admin.nav.tab.generic_approvals" },
    ],
    visibility: "platform_admin",
  },
  {
    key: "inventory_oversight",
    labelKey: "admin.nav.group.inventory_oversight",
    icon: "/icons/menu/flight.svg",
    defaultHref: "/inventory/flights",
    tabs: [
      { href: "/inventory/flights", labelKey: "admin.nav.tab.flights", perm: "flights.view" },
      { href: "/inventory/hotels", labelKey: "admin.nav.tab.hotels", perm: "hotels.view" },
      { href: "/inventory/transfers", labelKey: "admin.nav.tab.transfers", perm: "transfers.view" },
      { href: "/inventory/cars", labelKey: "admin.nav.tab.cars", perm: "cars.view" },
      { href: "/inventory/excursions", labelKey: "admin.nav.tab.excursions", perm: "excursions.view" },
    ],
    visibility: "inventory_oversight",
  },
  {
    key: "my_inventory",
    labelKey: "admin.nav.group.my_inventory",
    icon: "/icons/menu/hotel.svg",
    defaultHref: "/operator/hotels",
    tabs: [
      { href: "/operator/hotels", labelKey: "admin.nav.tab.hotels", serviceType: "hotel" },
      { href: "/operator/flights", labelKey: "admin.nav.tab.flights", serviceType: "flight" },
      { href: "/operator/transfers", labelKey: "admin.nav.tab.transfers", serviceType: "transfer" },
      { href: "/operator/cars", labelKey: "admin.nav.tab.cars", serviceType: "car" },
      { href: "/operator/excursions", labelKey: "admin.nav.tab.excursions", serviceType: "excursion" },
      { href: "/operator/visas", labelKey: "admin.nav.tab.visas", serviceType: "visa" },
      { href: "/operator/packages", labelKey: "admin.nav.tab.packages", serviceType: "package" },
      { href: "/operator/offers", labelKey: "admin.nav.tab.offers" },
      { href: "/operator/contracts", labelKey: "admin.nav.tab.contracts" },
    ],
    visibility: "operator_tools",
  },
  {
    key: "bookings",
    labelKey: "admin.nav.group.bookings",
    icon: "/icons/menu/booking.svg",
    defaultHref: "/platform/bookings",
    tabs: [
      { href: "/platform/bookings", labelKey: "admin.nav.tab.all_bookings" },
      { href: "/platform/package-orders", labelKey: "admin.nav.tab.package_orders" },
    ],
    visibility: "platform_admin",
  },
  {
    key: "finance",
    labelKey: "admin.nav.group.finance",
    icon: "/icons/menu/finance.svg",
    defaultHref: "/platform/finance-summary",
    tabs: [
      { href: "/platform/finance-summary", labelKey: "admin.nav.tab.finance_summary" },
      { href: "/platform/invoices", labelKey: "admin.nav.tab.invoices" },
      { href: "/platform/payments", labelKey: "admin.nav.tab.payments" },
      { href: "/platform/commissions", labelKey: "admin.nav.tab.commissions" },
      { href: "/platform/finance", labelKey: "admin.nav.tab.transactions" },
    ],
    visibility: "platform_admin",
  },
  {
    key: "content",
    labelKey: "admin.nav.group.content",
    icon: "/icons/menu/banner.svg",
    defaultHref: "/platform/banners",
    tabs: [
      { href: "/platform/banners", labelKey: "admin.nav.tab.banners", superAdminOnly: true },
      { href: "/pages", labelKey: "admin.nav.tab.cms_pages" },
      { href: "/platform/notifications", labelKey: "admin.nav.tab.system_notifications" },
      { href: "/platform/newsletter", labelKey: "admin.nav.tab.newsletter" },
      { href: "/localization/templates", labelKey: "admin.nav.tab.email_templates" },
    ],
    visibility: "platform_admin",
  },
  {
    key: "localization",
    labelKey: "admin.nav.group.localization",
    icon: "/icons/menu/translation.svg",
    defaultHref: "/localization/ui-translations",
    tabs: [
      { href: "/localization/ui-translations", labelKey: "admin.nav.tab.ui_strings", superAdminOnly: true },
      { href: "/localization/translations", labelKey: "admin.nav.tab.content_translations" },
      { href: "/localization/languages", labelKey: "admin.nav.tab.languages" },
    ],
    visibility: "localization",
  },
  {
    key: "operations",
    labelKey: "admin.nav.group.operations",
    icon: "/icons/menu/connection.svg",
    defaultHref: "/connections",
    tabs: [
      { href: "/connections", labelKey: "admin.nav.tab.connections" },
      { href: "/support/tickets", labelKey: "admin.nav.tab.support" },
      { href: "/platform/reviews", labelKey: "admin.nav.tab.reviews" },
      { href: "/statistics", labelKey: "admin.nav.tab.statistics" },
    ],
    visibility: "platform_admin",
  },
  {
    key: "loyalty_promo",
    labelKey: "admin.nav.group.loyalty_promo",
    icon: "/icons/menu/loyalty.svg",
    defaultHref: "/platform/loyalty",
    tabs: [
      { href: "/platform/loyalty", labelKey: "admin.nav.tab.loyalty_programs" },
    ],
    visibility: "platform_admin",
  },
  {
    key: "bucket3",
    labelKey: "admin.nav.group.bucket3",
    icon: "/icons/menu/banner.svg",
    defaultHref: "/bucket3/customers",
    tabs: [
      { href: "/bucket3/customers", labelKey: "admin.nav.tab.bucket3.customers" },
      { href: "/bucket3/block-dates", labelKey: "admin.nav.tab.bucket3.block_dates" },
      { href: "/bucket3/per-x-invoicing", labelKey: "admin.nav.tab.bucket3.per_x_invoicing" },
      { href: "/bucket3/custom-fields", labelKey: "admin.nav.tab.bucket3.custom_fields" },
      { href: "/bucket3/employees", labelKey: "admin.nav.tab.bucket3.employees" },
      { href: "/bucket3/bulk-notifications", labelKey: "admin.nav.tab.bucket3.bulk_notifications" },
      { href: "/bucket3/requests", labelKey: "admin.nav.tab.bucket3.requests" },
      { href: "/bucket3/unverified-accounts", labelKey: "admin.nav.tab.bucket3.unverified_accounts" },
      { href: "/bucket3/service-logs", labelKey: "admin.nav.tab.bucket3.service_logs" },
      { href: "/bucket3/cases", labelKey: "admin.nav.tab.bucket3.cases" },
      { href: "/bucket3/subscriptions", labelKey: "admin.nav.tab.bucket3.subscriptions" },
      { href: "/bucket3/service-catalog", labelKey: "admin.nav.tab.bucket3.service_catalog" },
      { href: "/bucket3/non-service-hours", labelKey: "admin.nav.tab.bucket3.non_service_hours" },
      { href: "/bucket3/pin-settings", labelKey: "admin.nav.tab.bucket3.pin_settings" },
      { href: "/bucket3/payroll", labelKey: "admin.nav.tab.bucket3.payroll" },
    ],
    visibility: "bucket3",
  },
  {
    key: "system",
    labelKey: "admin.nav.group.system",
    icon: "/icons/menu/settings.svg",
    defaultHref: "/platform/rbac",
    tabs: [
      { href: "/platform/rbac", labelKey: "admin.nav.tab.rbac" },
      { href: "/platform/security", labelKey: "admin.nav.tab.security" },
      { href: "/platform/webhooks", labelKey: "admin.nav.tab.webhooks" },
      { href: "/platform/locations", labelKey: "admin.nav.tab.locations", superAdminOnly: true },
      { href: "/platform/audit-logs", labelKey: "admin.nav.tab.audit_logs" },
      { href: "/platform/api-docs", labelKey: "admin.nav.tab.api_docs" },
      { href: "/platform/settings/brand", labelKey: "admin.nav.tab.brand_settings" },
      { href: "/platform/settings/header-menu", labelKey: "admin.nav.tab.header_menu" },
      { href: "/platform/settings/footer", labelKey: "admin.nav.tab.footer" },
    ],
    visibility: "super_admin",
  },
];

// ─── Legacy flat exports (kept for back-compat with importers that still
// reference the old arrays — resolveAdminPageTitle, page guards, etc.) ─────

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

// ─── Page-title resolver: pathname → group label > tab label > fallback ───
export function resolveAdminPageTitle(pathname: string, t: (key: string) => string): string {
  // 1) Match by tab href first — gives the most-specific label
  for (const group of ADMIN_NAV_GROUPS) {
    for (const tab of group.tabs) {
      if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) {
        return t(tab.labelKey);
      }
    }
    if (pathname === group.defaultHref || pathname.startsWith(`${group.defaultHref}/`)) {
      return t(group.labelKey);
    }
  }

  // 2) Legacy fallthrough (handles routes that haven't been mapped into the
  //    grouped model yet, e.g. /notifications, /statistics aliases).
  const legacyAll = [
    ...ADMIN_PLATFORM_LINKS.map(({ href, labelKey }) => ({ href, labelKey })),
    ...ADMIN_OPERATOR_LINKS,
    ...ADMIN_INVENTORY_LINKS,
    ...ADMIN_LOCALIZATION_LINKS,
    ...ADMIN_EXTRA_PAGE_TITLE_LINKS,
  ].sort((a, b) => b.href.length - a.href.length);

  for (const l of legacyAll) {
    if (pathname === l.href || pathname.startsWith(`${l.href}/`)) {
      return t(l.labelKey);
    }
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return t("admin.nav.dashboard");
  return parts.map((p) => p.replace(/-/g, " ")).join(" / ");
}

// ─── Helper: find the active group for a pathname ──────────────────────────
export function findActiveGroup(pathname: string): AdminNavGroup | null {
  // Prefer most-specific match (longest defaultHref or tab.href that
  // prefixes the pathname).
  let best: { group: AdminNavGroup; len: number } | null = null;
  for (const group of ADMIN_NAV_GROUPS) {
    const candidates = [group.defaultHref, ...group.tabs.map((t) => t.href)];
    for (const href of candidates) {
      if (pathname === href || pathname.startsWith(`${href}/`)) {
        if (!best || href.length > best.len) {
          best = { group, len: href.length };
        }
      }
    }
  }
  return best?.group ?? null;
}
