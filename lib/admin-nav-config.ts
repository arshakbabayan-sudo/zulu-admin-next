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
  /**
   * Phase 6A — admin module key (e.g. "inventory.hotels", "ops.bookings").
   * When set, the tab is hidden if the user's active company has an explicit
   * is_allowed=false row for this module. Super admins are never restricted.
   */
  moduleKey?: string;
};

export type AdminNavTabScope = "all" | "mine";

export type AdminNavGroup = {
  key: string;
  labelKey: string;
  /**
   * Plain-English fallback shown when t(labelKey) returns the key itself
   * (translation row not yet seeded). The 8-section IA introduces new
   * label keys (admin.nav.section.*) that need DB seeding — fallbacks
   * keep the sidebar readable in the meantime.
   */
  labelFallback?: string;
  icon: string;
  /** Sidebar link points here. Usually the first tab. */
  defaultHref: string;
  tabs: AdminNavTab[];
  /**
   * v2 admin-redesign (2026-05-24) — when present, the sidebar item renders
   * a small pill badge after the label. Source identifier resolved at runtime
   * in AdminShell.tsx (e.g. "notifications_unread", "users_pending").
   * No badge when omitted.
   */
  badgeSource?: "notifications_unread" | "users_pending";
  /** Badge color variant — `primary` (purple) or `warn` (amber). Defaults to primary. */
  badgeKind?: "primary" | "warn";
  /** Visibility predicate name — wired in AdminShell.tsx. */
  visibility:
    // legacy keys kept for back-compat with any external importer:
    | "always"
    | "platform_admin"
    | "operator_tools"
    | "inventory_oversight"
    | "localization"
    | "super_admin"
    | "bucket3"
    | "agent_tools"
    // 2026-05-24 — 8-section IA section-level predicates:
    | "section_dashboard"
    | "section_inventory"
    | "section_bookings"
    | "section_sales_workspace"
    | "section_finance"
    | "section_my_company"
    | "section_marketplace_ops"
    | "section_settings"
    // 2026-05-31 — CRM as its own top-level section
    | "section_crm"
    // 2026-06-01 — internal chat
    | "section_chat";
};

// ─── 8-section IA — 2026-05-24 ─────────────────────────────────────────────
// Replaces the prior 14-group sidebar with role-aware sections per the
// product spec. Page files stay where they are (Option B / pragmatic):
// only the sidebar config + access predicates change. URL routes are
// preserved so bookmarks, deep links from Telegram, and breadcrumbs
// continue to work.
//
// Role visibility matrix (also enforced section-by-section in lib/access.ts):
//   Dashboard         super ✓ / operator ✓ / agent ✓
//   Inventory         super ✓ / operator ✓ / agent —
//   Bookings          super ✓ / operator ✓ / agent ✓
//   Sales workspace   super — / operator — / agent ✓
//   Finance           super ✓ / operator ✓ / agent ✓
//   My company        super ✓ / operator ✓ / agent ✓
//   Marketplace ops   super ✓ / operator — / agent —
//   Settings          super ✓ / operator ✓ / agent ✓  (tabs filter further)

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  // 1 ── Dashboard ──────────────────────────────────────────────────────
  {
    key: "dashboard",
    labelKey: "admin.nav.section.dashboard",
    labelFallback: "Dashboard",
    icon: "/icons/menu/dashboard.svg",
    defaultHref: "/dashboard",
    // Phase Ա.9 (2026-05-28) — Detailed stats is surfaced as a super-admin
    // header button on the Dashboard page (the admin no longer renders
    // group-config tabs since 2026-05-24, so listing tabs here only broke the
    // page title with an untranslated key). Keep tabs empty.
    tabs: [],
    visibility: "section_dashboard",
  },

  // 2 ── Inventory ─────────────────────────────────────────────────────
  // Operator-side tabs are the canonical set (most inventory users are
  // operators). For super_admin viewers, the InventoryScopeToggle (rendered
  // by AdminGroupTabs) flips the URL between /operator/* (mine) and
  // /inventory/* (all-companies oversight). Agents do not see this section.
  {
    key: "inventory",
    labelKey: "admin.nav.section.inventory",
    labelFallback: "Inventory",
    icon: "/icons/menu/hotel.svg",
    defaultHref: "/operator/hotels",
    tabs: [
      { href: "/operator/hotels", labelKey: "admin.nav.tab.hotels", serviceType: "hotel", moduleKey: "inventory.hotels" },
      { href: "/operator/flights", labelKey: "admin.nav.tab.flights", serviceType: "flight", moduleKey: "inventory.flights" },
      { href: "/operator/transfers", labelKey: "admin.nav.tab.transfers", serviceType: "transfer", moduleKey: "inventory.transfers" },
      { href: "/operator/cars", labelKey: "admin.nav.tab.cars", serviceType: "car", moduleKey: "inventory.cars" },
      { href: "/operator/excursions", labelKey: "admin.nav.tab.excursions", serviceType: "excursion", moduleKey: "inventory.excursions" },
      { href: "/operator/visas", labelKey: "admin.nav.tab.visas", serviceType: "visa", moduleKey: "inventory.visas" },
      { href: "/operator/packages", labelKey: "admin.nav.tab.packages", serviceType: "package", moduleKey: "inventory.packages" },
      { href: "/operator/offers", labelKey: "admin.nav.tab.offers", moduleKey: "inventory.offers" },
      // Phase Ա.1 (2026-05-28) — the former `/platform/packages` extra tab
      // was removed because the Inventory scope toggle (AdminGroupTabs) now
      // routes super-admin Packages oversight via `/inventory/packages` (matches
      // the Hotels/Flights/etc. pattern). Old `/platform/packages` URL still
      // works as a redirect.

      // Phase 2 (2026-05-31) — Configuration sub-group moved from Settings.
      // Block dates / Custom fields / Service catalog are inventory-adjacent
      // workflows; operator users find them faster next to listings than
      // buried in Settings. Page-level SectionTabs on each of the 3 pages
      // is updated to show only this Configuration trio (was the full ~18-tab
      // Settings strip — confusing context).
      { href: "/bucket3/block-dates", labelKey: "admin.nav.tab.bucket3.block_dates" },
      { href: "/bucket3/custom-fields", labelKey: "admin.nav.tab.bucket3.custom_fields" },
      { href: "/bucket3/service-catalog", labelKey: "admin.nav.tab.bucket3.service_catalog" },
    ],
    visibility: "section_inventory",
  },

  // 3 ── Bookings ──────────────────────────────────────────────────────
  {
    key: "bookings",
    labelKey: "admin.nav.section.bookings",
    labelFallback: "Bookings",
    icon: "/icons/menu/booking.svg",
    defaultHref: "/platform/bookings",
    tabs: [
      { href: "/platform/bookings", labelKey: "admin.nav.tab.all_bookings", moduleKey: "ops.bookings" },
      { href: "/platform/package-orders", labelKey: "admin.nav.tab.package_orders", moduleKey: "ops.bookings" },
    ],
    visibility: "section_bookings",
  },

  // 3b ── CRM (2026-05-31) — separate sales / customer-relationship section ─
  // Arshak's decision: CRM gets its own top-level sidebar entry (not folded
  // into Directory, which stays as-is for companies + plain users). Tabs
  // mirror docs/admin_designe/new-admin-designe/files/crm.html:
  //   Pipeline · Leads · Deals · Customers · Activities · Segments · Team.
  // Customers is the only data-backed tab today; the rest land as their own
  // pages and fill in as their backends ship (deals/leads/activities tables,
  // employee-sales rollup for Team). The bare /crm path redirects to
  // /crm/pipeline so the sidebar highlight + breadcrumb resolve cleanly.
  {
    key: "crm",
    labelKey: "admin.nav.section.crm",
    labelFallback: "CRM",
    icon: "/icons/menu/crm.svg",
    defaultHref: "/crm/pipeline",
    tabs: [
      { href: "/crm/pipeline", labelKey: "admin.nav.tab.crm.pipeline" },
      { href: "/crm/leads", labelKey: "admin.nav.tab.crm.leads" },
      { href: "/crm/deals", labelKey: "admin.nav.tab.crm.deals" },
      { href: "/crm/customers", labelKey: "admin.nav.tab.crm.customers" },
      { href: "/crm/activities", labelKey: "admin.nav.tab.crm.activities" },
      { href: "/crm/segments", labelKey: "admin.nav.tab.crm.segments" },
      { href: "/crm/team", labelKey: "admin.nav.tab.crm.team" },
      { href: "/crm/options", labelKey: "admin.nav.tab.crm.options" },
    ],
    visibility: "section_crm",
  },

  // 3c ── Chat (2026-06-01) — internal company messaging ─────────────────
  // Separate top-level entry (Arshak's choice). Single page, no inner tabs.
  // Visible to anyone in a company (colleagues message each other, option Բ).
  {
    key: "chat",
    labelKey: "admin.nav.section.chat",
    labelFallback: "Chat",
    icon: "/icons/menu/chat.svg",
    defaultHref: "/chat",
    tabs: [],
    visibility: "section_chat",
  },

  // 4 ── Sales workspace — REMOVED 2026-05-28 (Phase Ա.2)
  // Per xlsx audit Row 15, the agent's My contracts page is the same data
  // as Marketplace ops > Partnership agreements (just the other party's view).
  // The Sales workspace sidebar group is hidden; agents see their pending-sign
  // contracts through the unified /platform/contracts page with a "pending mine"
  // filter (Phase Բ.5 will open /platform/contracts to agent role and add the
  // redirect from /agent/contracts).

  // 5 ── Finance (reporting only — Commission settings moved to Settings) ─
  {
    key: "finance",
    labelKey: "admin.nav.section.finance",
    labelFallback: "Finance",
    icon: "/icons/menu/finance.svg",
    defaultHref: "/platform/finance-summary",
    tabs: [
      { href: "/platform/finance-summary", labelKey: "admin.nav.tab.finance_summary", moduleKey: "ops.finance" },
      { href: "/platform/invoices", labelKey: "admin.nav.tab.invoices", moduleKey: "ops.finance" },
      { href: "/platform/payments", labelKey: "admin.nav.tab.payments", moduleKey: "ops.finance" },
      { href: "/platform/commissions", labelKey: "admin.nav.tab.commissions_ledger", moduleKey: "ops.finance" },
      { href: "/platform/finance", labelKey: "admin.nav.tab.transactions", moduleKey: "ops.finance" },
      { href: "/platform/vouchers", labelKey: "admin.nav.tab.vouchers", moduleKey: "ops.finance" },
      // NOTE: /operator/commission-settings intentionally removed from
      // Finance → moved under Settings → Pricing rules (8-IA spec).
    ],
    visibility: "section_finance",
  },

  // 6 ── My company (per-company internal CRM, from Bucket3) ───────────
  //
  // Phase 4E (2026-05-31) — Payroll and Non-service hours moved to the new
  // top-level HR group below. Employees + Customers (redirect) + Subscriptions
  // + Per-X invoicing stay here for now (Phase 4 follow-ups will consolidate
  // them further into Directory + Finance).
  {
    key: "my_company",
    labelKey: "admin.nav.section.my_company",
    labelFallback: "My company",
    icon: "/icons/menu/company.svg",
    defaultHref: "/bucket3/employees",
    tabs: [
      { href: "/bucket3/employees", labelKey: "admin.nav.tab.bucket3.employees" },
      // Phase 4F (2026-05-31) — Requests + Cases moved to the new Inbox group.
      // Phase Ա.3 (2026-05-28) — bulk-notifications moved to Notifications group below
      // Phase Ա.4 (2026-05-28) — pin-settings merged under My profile > Security
      // Phase 4C (2026-05-31) — /bucket3/customers redirects to Directory now,
      //   but the My company tab is kept here for super-admins who want the
      //   pre-redirect bookmark to still light up the group.
      { href: "/bucket3/customers", labelKey: "admin.nav.tab.bucket3.customers" },
      { href: "/bucket3/subscriptions", labelKey: "admin.nav.tab.bucket3.subscriptions" },
      { href: "/bucket3/per-x-invoicing", labelKey: "admin.nav.tab.bucket3.per_x_invoicing" },
      // P0-1 step 1.1 (2026-06-01) — operator/agent's own Stripe Connect onboarding.
      { href: "/bucket3/payments", labelKey: "admin.nav.tab.bucket3.payments" },
      // P0-3 (2026-06-02) — operator/agent's own seller status + become-a-seller.
      { href: "/bucket3/seller-status", labelKey: "admin.nav.tab.bucket3.seller_status" },
    ],
    visibility: "section_my_company",
  },

  // 6b ── HR (Phase 4E, 2026-05-31) ─────────────────────────────────────
  //
  // Top-level HR group hosting the two time-and-pay pages that used to be
  // My-company tabs:
  //   • Non-service hours  /bucket3/non-service-hours  (shifts + time off)
  //   • Payroll            /bucket3/payroll            (monthly ledger,
  //                                                     finalize, bank batch)
  // Operator HR / company-admin / accountant is the audience. The page
  // bodies are unchanged — only the parent group and the per-page strip
  // are new (same pattern as the Inbox group in Phase 4F).
  {
    key: "hr",
    labelKey: "admin.nav.section.hr",
    labelFallback: "HR",
    icon: "/icons/menu/profile.svg",
    defaultHref: "/bucket3/non-service-hours",
    tabs: [
      { href: "/bucket3/non-service-hours", labelKey: "admin.nav.tab.bucket3.non_service_hours" },
      { href: "/bucket3/payroll", labelKey: "admin.nav.tab.bucket3.payroll" },
    ],
    visibility: "section_my_company",
  },

  // 7 ── Management (super_admin only) — renamed from "Marketplace ops" ──
  // Phase 1 of new menu architecture (2026-05-31):
  //   • Renamed group label "Marketplace ops" → "Management" per product decision
  //   • Approval queue tab REMOVED — the page never actually owned approve/reject
  //     actions (those happen on Companies, Reviews, Offer pages themselves).
  //     Was visually present but functionally useless → confusing UI.
  //   • defaultHref retargeted from /platform/approvals to /platform/companies
  //   • Subscriptions tab will be added in Phase 4 once moved from My company.
  //   • Logs merge (audit + service) is Phase 2.
  {
    key: "marketplace_ops",
    labelKey: "admin.nav.section.management",
    labelFallback: "Management",
    icon: "/icons/menu/checklist.svg",
    defaultHref: "/platform/companies",
    tabs: [
      { href: "/platform/companies", labelKey: "admin.nav.tab.companies_access" },
      { href: "/platform/seller-applications", labelKey: "admin.nav.tab.seller_applications" },
      // Phase 2C (2026-05-31) — /platform/users tab removed from Management;
      // the Directory sidebar group is its canonical home now.
      { href: "/platform/contracts", labelKey: "admin.nav.tab.partnership_agreements", moduleKey: "ops.contracts" },
      { href: "/platform/contract-templates", labelKey: "admin.nav.tab.contract_templates", moduleKey: "ops.contracts" },
      { href: "/platform/audit-logs", labelKey: "admin.nav.tab.audit_logs" },
      { href: "/bucket3/service-logs", labelKey: "admin.nav.tab.bucket3.service_logs" },
    ],
    visibility: "section_marketplace_ops",
  },

  // Phase 4A (2026-05-31) — Directory (People + Companies tabs)
  //
  // New top-level group that consolidates the people-and-companies lookup
  // surfaces. Replaces three previously-separate sidebar entries:
  //   - Customers (/bucket3/customers)
  //   - Employees subset of My company
  //   - Users (under Management)
  //
  // Currently lands on the existing /platform/users page (which already
  // supports the type filter for All / Customers / Staff / Unverified).
  // The page-level chip strip lands as part of the same Phase 4A patch.
  // Companies tab (/platform/companies) is part of the same Directory in
  // the spec — kept under Management for the moment because its page is
  // still wired with the Management section tabs; Phase 4B will move it.
  {
    key: "directory",
    labelKey: "admin.nav.section.directory",
    labelFallback: "Directory",
    icon: "/icons/menu/users.svg",
    defaultHref: "/platform/users",
    tabs: [
      // Phase 4D (2026-05-31) — Directory exposes two tabs: People (users
      // table with type chips) and Companies (organizations registry).
      // Different entities, different columns, but the same "find any party
      // on the platform" mental model. /platform/companies is shared with
      // the Management group (still listed there for governance discovery).
      { href: "/platform/users", labelKey: "admin.nav.tab.directory.people" },
      { href: "/platform/companies", labelKey: "admin.nav.tab.directory.companies" },
    ],
    visibility: "platform_admin",
  },

  // ── 8–12 ── v2 redesign new groups (2026-05-24, ordered per zulu-admin-v2.html) ──
  // Users / Roles / Files / Profile come AFTER Marketplace ops and BEFORE Settings
  // to match the v2 spec sidebar. Settings (#13) is the final group — moved from
  // its earlier position #8. Pages live under /admin-redesign/<slug> (or existing
  // routes once the v2 layout is built on top of them).
  //
  // Phase Ա.10 (2026-05-28) — `users_v2` group removed. The same /platform/users
  // page is already reachable via Marketplace ops > Users for super-admins;
  // operator/agent didn't have backend access to /platform/users (403 on click),
  // so the extra top-level sidebar entry was a 403 trap (GAP-010 per Phase 0 audit).
  // ── Roles & permissions sidebar group REMOVED 2026-05-31 (Phase 1) ──
  // The /platform/rbac page is reached via Settings → Permissions → RBAC
  // (already listed in Settings tabs below). Having a separate top-level
  // sidebar entry was a duplicate. Page itself remains at the same URL.

  {
    key: "file_manager",
    labelKey: "admin.nav.section.file_manager",
    labelFallback: "File manager",
    icon: "/icons/menu/folder.svg",
    defaultHref: "/admin-redesign/files",
    tabs: [],
    visibility: "always",
  },
  {
    key: "my_profile",
    labelKey: "admin.nav.section.my_profile",
    labelFallback: "My profile",
    icon: "/icons/menu/profile.svg",
    defaultHref: "/admin-redesign/profile",
    tabs: [],
    visibility: "always",
  },
  // Phase 4F (2026-05-31) — Inbox group: renamed from "Notifications" and
  // expanded to host the three pending-action surfaces that previously lived
  // in three different spots (Notifications group + My company tabs).
  //   • My notifications  /admin-redesign/notifications  (was the standalone
  //                        Notifications sidebar group's defaultHref)
  //   • Requests          /bucket3/requests             (was a My company tab)
  //   • Cases             /bucket3/cases                (was a My company tab)
  // Each page now also renders a per-page Inbox-strip with the three siblings,
  // so the group switch is one click regardless of which page you land on.
  {
    key: "notifications_v2",
    labelKey: "admin.nav.section.inbox",
    labelFallback: "Inbox",
    icon: "/icons/menu/bell.svg",
    defaultHref: "/admin-redesign/notifications",
    tabs: [
      { href: "/admin-redesign/notifications", labelKey: "admin.nav.tab.my_notifications" },
      { href: "/bucket3/requests", labelKey: "admin.nav.tab.bucket3.requests" },
      { href: "/bucket3/cases", labelKey: "admin.nav.tab.bucket3.cases" },
    ],
    visibility: "always",
    badgeSource: "notifications_unread",
    badgeKind: "warn",
  },

  // 13 ── Settings (moved from #8 to last per v2 spec, 2026-05-24) ──────
  {
    key: "settings",
    labelKey: "admin.nav.section.settings",
    labelFallback: "Settings",
    icon: "/icons/menu/settings.svg",
    defaultHref: "/settings/pricing-rules",
    // Tabs grouped logically per Bucket B audit: Pricing & money → Permissions
    // → Localization → Content/CMS → Layout → Promotions → Inventory config →
    // System integrations → Support. Order is what the sidebar renders top-down.
    tabs: [
      // ── Pricing & money ───────────────────────────────────────────────
      { href: "/settings/pricing-rules", labelKey: "admin.nav.tab.pricing_rules" },
      { href: "/settings/money-flow", labelKey: "admin.nav.tab.money_flow", superAdminOnly: true },
      { href: "/settings/exchange-rates", labelKey: "admin.nav.tab.exchange_rates" },

      // ── Permissions ───────────────────────────────────────────────────
      // UI-level filter for company-scoped roles (see /platform/rbac/page.tsx).
      { href: "/platform/rbac", labelKey: "admin.nav.tab.rbac" },

      // ── Localization ──────────────────────────────────────────────────
      { href: "/localization/languages", labelKey: "admin.nav.tab.languages", superAdminOnly: true },
      { href: "/localization/ui-translations", labelKey: "admin.nav.tab.ui_strings", superAdminOnly: true },
      { href: "/localization/translations", labelKey: "admin.nav.tab.content_translations" },
      { href: "/localization/templates", labelKey: "admin.nav.tab.email_templates" },

      // ── Content & CMS ─────────────────────────────────────────────────
      { href: "/pages", labelKey: "admin.nav.tab.cms_pages" },
      { href: "/platform/banners", labelKey: "admin.nav.tab.banners", superAdminOnly: true },
      { href: "/platform/notifications", labelKey: "admin.nav.tab.system_notifications" },
      { href: "/platform/newsletter", labelKey: "admin.nav.tab.newsletter", moduleKey: "ops.newsletter" },

      // ── Layout (storefront chrome) ────────────────────────────────────
      { href: "/platform/settings/header-menu", labelKey: "admin.nav.tab.header_menu", superAdminOnly: true },
      { href: "/platform/settings/footer", labelKey: "admin.nav.tab.footer", superAdminOnly: true },
      { href: "/platform/settings/brand", labelKey: "admin.nav.tab.brand_settings", superAdminOnly: true },

      // ── Promotions ────────────────────────────────────────────────────
      { href: "/platform/loyalty", labelKey: "admin.nav.tab.loyalty_programs", moduleKey: "ops.loyalty" },

      // Phase 2 (2026-05-31) — Inventory configuration tabs MOVED OUT of
      // Settings into the Inventory section. Block dates / Custom fields /
      // Service catalog are now listed under the Inventory group above.

      // ── System (integrations, security, geography) ────────────────────
      { href: "/platform/security", labelKey: "admin.nav.tab.security", superAdminOnly: true },
      { href: "/platform/webhooks", labelKey: "admin.nav.tab.webhooks", superAdminOnly: true },
      { href: "/platform/locations", labelKey: "admin.nav.tab.locations", superAdminOnly: true },
      { href: "/platform/api-docs", labelKey: "admin.nav.tab.api_docs", superAdminOnly: true },
      { href: "/connections", labelKey: "admin.nav.tab.connections", moduleKey: "ops.connections" },

      // ── Support & feedback ────────────────────────────────────────────
      { href: "/support/tickets", labelKey: "admin.nav.tab.support" },
      { href: "/platform/reviews", labelKey: "admin.nav.tab.reviews", moduleKey: "ops.reviews" },
    ],
    visibility: "section_settings",
  },
];

// ─── Settings sub-group structure (Phase 2D — 2026-05-31) ────────────────
//
// The Settings group's flat tab list is logically grouped per the Bucket B
// audit; the comments inside the tabs[] array above call these out as
// "── Pricing & money ──" etc. The same grouping is exported here as a
// structured shape so a SettingsSubgroupTabs component can render visible
// labels between tab clusters — turns a flat 20-tab strip into nine
// titled clusters that an operator can scan at a glance.

export type SettingsSubgroup = {
  /** Plain-English label rendered as the sub-group divider. */
  label: string;
  /**
   * URLs in this sub-group, in the order they should render. Each must
   * match a real tab.href in ADMIN_NAV_GROUPS["settings"].tabs above.
   */
  hrefs: string[];
};

export const SETTINGS_SUBGROUPS: SettingsSubgroup[] = [
  {
    label: "Money",
    hrefs: ["/settings/pricing-rules", "/settings/money-flow", "/settings/exchange-rates"],
  },
  {
    label: "Permissions",
    hrefs: ["/platform/rbac"],
  },
  {
    label: "Localization",
    hrefs: [
      "/localization/languages",
      "/localization/ui-translations",
      "/localization/translations",
      "/localization/templates",
    ],
  },
  {
    label: "Content & CMS",
    hrefs: [
      "/pages",
      "/platform/banners",
      "/platform/notifications",
      "/platform/newsletter",
    ],
  },
  {
    label: "Layout",
    hrefs: [
      "/platform/settings/header-menu",
      "/platform/settings/footer",
      "/platform/settings/brand",
    ],
  },
  {
    label: "Marketing",
    hrefs: ["/platform/loyalty"],
  },
  {
    label: "System",
    hrefs: [
      "/platform/security",
      "/platform/webhooks",
      "/platform/locations",
      "/platform/api-docs",
      "/connections",
    ],
  },
  {
    label: "Support",
    hrefs: ["/support/tickets", "/platform/reviews"],
  },
];

/**
 * Map a settings tab href to its sub-group label. Returns null when the
 * href is not in any sub-group (e.g. legacy / removed tabs).
 */
export function settingsSubgroupFor(href: string): string | null {
  for (const sg of SETTINGS_SUBGROUPS) {
    if (sg.hrefs.includes(href)) return sg.label;
  }
  return null;
}

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

// ─── Alias prefixes for the 8-section IA ──────────────────────────────────
// Routes that belong to a section but aren't listed as a tab. Keeps the
// sidebar active-highlight working when:
//   - Super admin switches Inventory scope to "all" (/inventory/*)
//   - A user lands on a Settings sub-page (e.g. /settings/foo)
//   - Bucket3 routes still in the My Company / Settings sections
const SECTION_ALIAS_PREFIXES: Array<{ prefix: string; groupKey: string }> = [
  { prefix: "/inventory/", groupKey: "inventory" },
  { prefix: "/operator/commission-settings", groupKey: "settings" },
  { prefix: "/settings/", groupKey: "settings" },
  // CRM (2026-05-31) — bare /crm + any /crm/* sub-page maps to the crm group
  // (defaultHref is /crm/pipeline, so the literal /crm needs an alias too).
  { prefix: "/crm", groupKey: "crm" },
  // Chat (2026-06-01)
  { prefix: "/chat", groupKey: "chat" },
];

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
  if (best) return best.group;

  // Fall back to alias prefix lookup (8-section IA).
  for (const alias of SECTION_ALIAS_PREFIXES) {
    if (pathname === alias.prefix.replace(/\/$/, "") || pathname.startsWith(alias.prefix)) {
      const group = ADMIN_NAV_GROUPS.find((g) => g.key === alias.groupKey);
      if (group) return group;
    }
  }
  return null;
}
