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
  /**
   * 2026-06-04 — plain-English fallback rendered when t(labelKey) returns the
   * raw key (translation row not yet seeded into ui_translations). Mirrors the
   * existing `AdminNavGroup.labelFallback` field so newly-added tabs do not
   * flash a `admin.nav.tab.…` key in the AdminShell header before their DB
   * row ships.
   */
  labelFallback?: string;
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
  /** Sidebar link points here. Usually the first tab. */
  defaultHref: string;
  tabs: AdminNavTab[];
  /**
   * v2 admin-redesign (2026-05-24) — when present, the sidebar item renders
   * a small pill badge after the label. Source identifier resolved at runtime
   * in AdminShell.tsx (currently only "notifications_unread").
   * No badge when omitted.
   *
   * 2026-06-10 — "users_pending" removed: its count source in AdminShell was
   * permanently 0 (never wired to a real endpoint), so no group ever showed it.
   */
  badgeSource?: "notifications_unread";
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
    defaultHref: "/crm/pipeline",
    tabs: [
      { href: "/crm/pipeline", labelKey: "admin.nav.tab.crm.pipeline" },
      { href: "/crm/leads", labelKey: "admin.nav.tab.crm.leads" },
      { href: "/crm/deals", labelKey: "admin.nav.tab.crm.deals" },
      { href: "/crm/customers", labelKey: "admin.nav.tab.crm.customers" },
      { href: "/crm/activities", labelKey: "admin.nav.tab.crm.activities" },
      { href: "/crm/segments", labelKey: "admin.nav.tab.crm.segments" },
      { href: "/crm/team", labelKey: "admin.nav.tab.crm.team" },
      // 2026-06-06 (Arshak) — "/crm/staff" REMOVED (it listed all companies'
      // owners platform-wide as "staff" — wrong; operators/agents are companies
      // in Management). The per-company employee view is "Team" (scoped).
      // 2026-06-13 redesign — Connections MOVED here from Settings. Service
      // connections between agents/operators are a CRM "Work" surface (it sits
      // in the CRM page's Work cluster, next to Contracts/Files). Listed just
      // before Options so the sidebar highlights CRM on /connections.
      { href: "/connections", labelKey: "admin.nav.tab.connections", moduleKey: "ops.connections" },
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
    defaultHref: "/platform/finance-summary",
    tabs: [
      { href: "/platform/finance-summary", labelKey: "admin.nav.tab.finance_summary", moduleKey: "ops.finance" },
      { href: "/platform/invoices", labelKey: "admin.nav.tab.invoices", moduleKey: "ops.finance" },
      { href: "/platform/payments", labelKey: "admin.nav.tab.payments", moduleKey: "ops.finance" },
      { href: "/platform/commissions", labelKey: "admin.nav.tab.commissions_ledger", moduleKey: "ops.finance" },
      { href: "/platform/finance", labelKey: "admin.nav.tab.transactions", moduleKey: "ops.finance" },
      { href: "/platform/vouchers", labelKey: "admin.nav.tab.vouchers", moduleKey: "ops.finance" },
      // 2026-06-10 (roadmap §1) — Per-X invoicing moved here from Management:
      // it's invoice ANALYTICS (finance), not company governance. Super-only;
      // FinanceSectionTabs appends its tab for super admins only.
      { href: "/bucket3/per-x-invoicing", labelKey: "admin.nav.tab.bucket3.per_x_invoicing", superAdminOnly: true },
      // NOTE: /operator/commission-settings intentionally removed from
      // Finance → moved under Settings → Pricing rules (8-IA spec).
    ],
    visibility: "section_finance",
  },

  // 6 ── My company — GROUP DISSOLVED 2026-06-10 ───────────────────────
  //
  // The standalone "My company" sidebar group (4 tabs) is gone:
  //   • Seller status + Payments  → rebuilt inside CRM → My profile →
  //     "My company" pill (MyCompanyPane reuses SellerStatusCard +
  //     StripeConnectCard). The old /bucket3/seller-status + /bucket3/payments
  //     pages are now thin redirects to /crm/my-company (bookmarks still work).
  //   • Subscriptions + Per-X invoicing  → MOVED into the Management group
  //     above (super-admin-only governance), keeping their own page chrome.
  // GROUP_MENU_PERMISSION["my_company"], SIDEBAR_TABLER_ICON["my_company"],
  // the `section_own_company` visibility predicate, and canSeeOwnCompanyNav()
  // were removed alongside this group. The backend `my_company.view`
  // permission string is left intact.

  // 6b ── HR — REMOVED as a separate group 2026-06-06 (#4 CRM consolidation).
  // Work hours (/bucket3/non-service-hours) + Payroll (/bucket3/payroll) now
  // live UNDER CRM (Work cluster) — they're part of the company workspace.
  // Reached via the CRM section-tab strip; sidebar highlights CRM via the
  // SECTION_ALIAS_PREFIXES entries below.

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
    defaultHref: "/platform/companies",
    tabs: [
      { href: "/platform/companies", labelKey: "admin.nav.tab.companies_access" },
      // 2026-06-04 (Arshak) — company REGISTRATION applications (B2B join requests)
      // had no menu link: the page existed at /platform/company-applications but was
      // only in the legacy flat list, so super-admin couldn't find pending registrations
      // to approve. Surfaced here in Management next to Companies. NOTE: distinct from
      // "Seller applications" below (an existing company asking to sell a service type).
      { href: "/platform/company-applications", labelKey: "admin.nav.tab.company_applications", labelFallback: "Company applications" },
      { href: "/platform/seller-applications", labelKey: "admin.nav.tab.seller_applications" },
      // 2026-06-04 (Arshak) — Directory group DELETED. Its B2C customers +
      // Unverified accounts views fold into Management here so super-admin's
      // governance section owns every cross-tenant people lookup. Staff
      // (operator/agent/admin employees) moved to CRM → Staff. People
      // detail page stays at /platform/users/{id} (linked from both tabs).
      { href: "/platform/b2c-customers", labelKey: "admin.nav.tab.b2c_customers", labelFallback: "B2C customers" },
      { href: "/platform/unverified", labelKey: "admin.nav.tab.unverified_accounts", labelFallback: "Unverified accounts" },
      // 2026-06-06 (#4) — Contracts (instances) MOVED to CRM → Work. Only the
      // contract TEMPLATES stay here (super governs templates; instances are the
      // operators'/agents' own, shown role-scoped under CRM).
      { href: "/platform/contract-templates", labelKey: "admin.nav.tab.contract_templates", moduleKey: "ops.contracts" },
      { href: "/platform/audit-logs", labelKey: "admin.nav.tab.audit_logs" },
      // 2026-06-04 admin v3 — `/bucket3/service-logs` page + tab removed.
      // Was a duplicate-data view of the audit-logs endpoint filtered by
      // category; absorbed into /platform/audit-logs via its Category
      // dropdown. Spec `Management_tab.md` TAB 5.
      // 2026-06-10 — "My company" group DISSOLVED. Subscriptions (plan
      // governance) moved here into Management; Per-X invoicing moved to the
      // Finance group above (it's invoice analytics). The own-company
      // self-service surfaces (Seller status + Payments) instead live under
      // CRM → My profile → "My company" pill; their standalone /bucket3 pages
      // are now thin redirects to /crm/my-company.
      { href: "/bucket3/subscriptions", labelKey: "admin.nav.tab.bucket3.subscriptions" },
      // 2026-06-10 (roadmap §1) — Pending review (offer moderation) finally
      // surfaced: MgmtPage's strip links to it via MGMT_LINK_TABS, and this
      // entry keeps the sidebar highlight + page title resolving.
      { href: "/platform/pending-review", labelKey: "admin.nav.tab.pending_review", labelFallback: "Pending review", superAdminOnly: true },
    ],
    visibility: "section_marketplace_ops",
  },

  // 2026-06-04 (Arshak) — Directory sidebar group DELETED.
  //
  // Was: People (B2C customers / Staff / Unverified chips on /platform/users).
  // Reason: the chips were really three separate views with different audiences
  // and actions, hidden behind one page. Arshak's reorganisation:
  //   • B2C customers + Unverified → Management (super-admin governance).
  //   • Staff (operator/agent/admin employees) → CRM → Staff (workspace).
  // The detail route /platform/users/{id} still exists; the list route
  // /platform/users redirects to /platform/b2c-customers by default.

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

  // File manager — REMOVED as a separate group 2026-06-06 (#4 CRM consolidation).
  // Files (/admin-redesign/files) now lives UNDER CRM (Work cluster) — operators/
  // agents store their contracts + customer payment receipts there. Reached via
  // the CRM section-tab strip; sidebar highlights CRM via SECTION_ALIAS_PREFIXES.
  // My profile — REMOVED as a separate sidebar group 2026-06-10. "My profile"
  // now lives INSIDE CRM as its own cluster (Account · My company · My team ·
  // My agents) — see app/(admin)/crm/CrmPage.tsx + MyProfilePanes.tsx. The old
  // standalone /admin-redesign/profile route is now a redirect to /crm/account.
  // Phase 4F (2026-05-31) — Inbox group: renamed from "Notifications" and
  // expanded to host the three pending-action surfaces that previously lived
  // in three different spots (Notifications group + My company tabs).
  //   • My notifications  /admin-redesign/notifications  (was the standalone
  //                        Notifications sidebar group's defaultHref)
  //   • Requests          /bucket3/requests             (was a My company tab)
  //   • Cases             /bucket3/cases                (was a My company tab)
  // Each page now also renders a per-page Inbox-strip with the siblings,
  // so the group switch is one click regardless of which page you land on.
  //
  // 2026-06-13 redesign — Inbox absorbs four pages relocated OUT of Settings:
  //   System notifications (/platform/notifications), Email templates
  //   (/localization/templates), Reviews (/platform/reviews) and Support
  //   tickets (/support/tickets). They join the existing My notifications /
  //   Requests / Cases trio for the full 7-tab "things that arrive / need a
  //   reply" surface. The pages still render via SettingsPage panes (routes
  //   unchanged); listing them here as Inbox tabs makes the sidebar highlight
  //   Inbox (findActiveGroup matches the explicit tab.href) instead of Settings.
  {
    key: "notifications_v2",
    labelKey: "admin.nav.section.inbox",
    labelFallback: "Inbox",
    defaultHref: "/admin-redesign/notifications",
    tabs: [
      { href: "/admin-redesign/notifications", labelKey: "admin.nav.tab.my_notifications" },
      { href: "/bucket3/requests", labelKey: "admin.nav.tab.bucket3.requests" },
      { href: "/bucket3/cases", labelKey: "admin.nav.tab.bucket3.cases" },
      { href: "/platform/notifications", labelKey: "admin.nav.tab.system_notifications" },
      { href: "/localization/templates", labelKey: "admin.nav.tab.email_templates" },
      { href: "/platform/reviews", labelKey: "admin.nav.tab.reviews", moduleKey: "ops.reviews" },
      { href: "/support/tickets", labelKey: "admin.nav.tab.support" },
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
    defaultHref: "/settings/pricing-rules",
    // 2026-06-13 redesign (docs/blueprints/html-handoff/Settings_tab.md) —
    // Settings cleaned to exactly 6 clusters / 19 pages. Five pages relocated
    // OUT of Settings: System notifications, Email templates, Reviews, Support
    // tickets → Inbox; Connections → CRM. The old "Layout" cluster folded into
    // Content & CMS (header-menu / footer / brand); the old "Support" cluster
    // is gone. Newsletter joined Marketing (with Loyalty). Order below is what
    // the sidebar renders top-down, cluster by cluster.
    tabs: [
      // ── Money ─────────────────────────────────────────────────────────
      { href: "/settings/pricing-rules", labelKey: "admin.nav.tab.pricing_rules" },
      { href: "/settings/money-flow", labelKey: "admin.nav.tab.money_flow", superAdminOnly: true },
      { href: "/settings/exchange-rates", labelKey: "admin.nav.tab.exchange_rates" },
      // B2b — seller FX rate (operator bank rate + absolute margin). NOT
      // superAdminOnly: every role (operator/agent self, super for platform/any)
      // configures their own FX setting here; SellerFxPane picks the endpoint by
      // role. labelFallback keeps it readable until the ui_translations row ships.
      { href: "/settings/currency", labelKey: "admin.nav.tab.seller_fx", labelFallback: "Currency / FX rate" },

      // ── Permissions ───────────────────────────────────────────────────
      // UI-level filter for company-scoped roles (see /platform/rbac/page.tsx).
      { href: "/platform/rbac", labelKey: "admin.nav.tab.rbac" },

      // ── Localization ──────────────────────────────────────────────────
      { href: "/localization/languages", labelKey: "admin.nav.tab.languages", superAdminOnly: true },
      { href: "/localization/ui-translations", labelKey: "admin.nav.tab.ui_strings", superAdminOnly: true },
      { href: "/localization/translations", labelKey: "admin.nav.tab.content_translations" },

      // ── Content & CMS ─────────────────────────────────────────────────
      // (folds in the former "Layout" cluster: Header menu / Footer / Brand)
      { href: "/pages", labelKey: "admin.nav.tab.cms_pages" },
      { href: "/platform/banners", labelKey: "admin.nav.tab.banners", superAdminOnly: true },
      // 2026-06-18 — FAQ editor (customer help questions). Content surface, so
      // it sits in the Content & CMS cluster. New label key — labelFallback
      // keeps it readable until the ui_translations row ships.
      { href: "/platform/faqs", labelKey: "admin.nav.tab.faqs", labelFallback: "FAQ", superAdminOnly: true },
      { href: "/platform/settings/header-menu", labelKey: "admin.nav.tab.header_menu", superAdminOnly: true },
      { href: "/platform/settings/footer", labelKey: "admin.nav.tab.footer", superAdminOnly: true },
      { href: "/platform/settings/brand", labelKey: "admin.nav.tab.brand_settings", superAdminOnly: true },

      // ── Marketing ─────────────────────────────────────────────────────
      { href: "/platform/loyalty", labelKey: "admin.nav.tab.loyalty_programs", moduleKey: "ops.loyalty" },
      { href: "/platform/newsletter", labelKey: "admin.nav.tab.newsletter", moduleKey: "ops.newsletter" },

      // Phase 2 (2026-05-31) — Inventory configuration tabs MOVED OUT of
      // Settings into the Inventory section. Block dates / Custom fields /
      // Service catalog are now listed under the Inventory group above.

      // ── System (integrations, security, geography, platform settings) ──
      { href: "/platform/security", labelKey: "admin.nav.tab.security", superAdminOnly: true },
      { href: "/platform/locations", labelKey: "admin.nav.tab.locations", superAdminOnly: true },
      // 2026-06-18 — Integrations (Google Drive connection). System cluster.
      { href: "/platform/integrations", labelKey: "admin.nav.tab.integrations", labelFallback: "Integrations", superAdminOnly: true },
      { href: "/platform/webhooks", labelKey: "admin.nav.tab.webhooks", superAdminOnly: true },
      { href: "/platform/api-docs", labelKey: "admin.nav.tab.api_docs", superAdminOnly: true },
      {
        href: "/platform/settings",
        labelKey: "admin.nav.tab.platform_settings",
        labelFallback: "Platform settings",
        superAdminOnly: true,
      },
    ],
    visibility: "section_settings",
  },
];

// ─── Sidebar icons (admin v3, 2026-06-04) ──────────────────────────────────
// The v3 chrome uses Tabler webfont glyphs (`<i class="ti ti-*"/>`, loaded in
// app/layout.tsx) instead of per-file PNG/SVG images. This map keys each nav
// group to its Tabler class so AdminShell and the Management MgmtPage render
// the SAME icon. (Supersedes the old AdminNavGroup.icon `/icons/menu/*.svg`
// paths, whose files were removed in the SVG→webfont migration.)
export const SIDEBAR_TABLER_ICON: Record<string, string> = {
  dashboard: "ti-dashboard",
  inventory: "ti-building-store",
  bookings: "ti-calendar-event",
  crm: "ti-users",
  chat: "ti-message-2",
  finance: "ti-coin",
  // 2026-06-10 — `my_company` group dissolved; 2026-06-06 — `hr` + `file_manager`
  // groups folded into CRM; 2026-06-04 — `directory` group deleted. None of these
  // group keys exist in ADMIN_NAV_GROUPS anymore, so their icons are unreferenced.
  marketplace_ops: "ti-shield-check",
  notifications_v2: "ti-inbox",
  settings: "ti-settings",
};

// ─── Section view/access gate (RBAC #2 redo — 2026-06-06) ───────────────────
// Each sidebar group maps to its menu section's single `<section>.view` gate.
// A non-super user sees the group IFF they hold that permission, and the SAME
// gate guards the section's pages + server routes — so revoking it removes
// access by EVERY route (menu hidden, direct URL forbidden, API 403). Super
// admins are unrestricted (handled in AdminShell). The gate is the FIRST item
// ("Show & access") of the matching section in the RBAC permission tree — there
// is no separate "Left menu" list. Keyed by AdminNavGroup.key.
// Backend mirror: AdminRbacController::PERMISSION_TREE section "access" items +
// the 2026_06_06_000040 section-view migration.
export const GROUP_MENU_PERMISSION: Record<string, string> = {
  dashboard: "dashboard.view",
  inventory: "inventory.view",
  bookings: "bookings.view",
  crm: "crm.view",
  chat: "chat.view",
  finance: "finance.view",
  // 2026-06-10 — `my_company` group dissolved (Subscriptions/Per-X → Management;
  // Seller status/Payments → CRM → My profile). 2026-06-06 (#4) — `hr` +
  // `file_manager` groups removed (folded into CRM, gate on crm.view). The
  // backend `my_company.view` permission string is kept; only the dead frontend
  // nav wiring is removed here.
  marketplace_ops: "management.view",
  notifications_v2: "inbox.view",
  settings: "settings.view",
};

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

// 2026-06-13 redesign — exactly 6 clusters / 19 hrefs (was 8 clusters). Matches
// the Settings tabs[] above and SettingsPage.tsx's own PAGES/CLUSTERS config.
// "Layout" folded into Content & CMS; "Support" deleted; Newsletter → Marketing;
// the 5 relocated pages (notifications/templates/reviews/support tickets →
// Inbox; connections → CRM) are NOT listed here.
export const SETTINGS_SUBGROUPS: SettingsSubgroup[] = [
  {
    label: "Money",
    hrefs: ["/settings/pricing-rules", "/settings/money-flow", "/settings/exchange-rates", "/settings/currency"],
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
    ],
  },
  {
    label: "Content & CMS",
    hrefs: [
      "/pages",
      "/platform/banners",
      "/platform/faqs",
      "/platform/settings/header-menu",
      "/platform/settings/footer",
      "/platform/settings/brand",
    ],
  },
  {
    label: "Marketing",
    hrefs: ["/platform/loyalty", "/platform/newsletter"],
  },
  {
    label: "System",
    hrefs: [
      "/platform/security",
      "/platform/locations",
      "/platform/integrations",
      "/platform/webhooks",
      "/platform/api-docs",
      "/platform/settings",
    ],
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
        const raw = t(tab.labelKey);
        // 2026-06-04 — honour tab.labelFallback when the i18n row hasn't been
        // seeded yet (raw key returned). Mirrors the group fallback below.
        return raw === tab.labelKey && tab.labelFallback ? tab.labelFallback : raw;
      }
    }
    if (pathname === group.defaultHref || pathname.startsWith(`${group.defaultHref}/`)) {
      const raw = t(group.labelKey);
      return raw === group.labelKey && group.labelFallback ? group.labelFallback : raw;
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
  // 2026-06-06 (#4) — Contracts (role-scoped) + HR + Files moved INTO CRM, so
  // the sidebar highlights CRM when on those pages. NOTE: /platform/contracts
  // does NOT match /platform/contract-templates (templates stay in Management).
  { prefix: "/platform/contracts", groupKey: "crm" },
  { prefix: "/operator/contracts", groupKey: "crm" },
  { prefix: "/agent/contracts", groupKey: "crm" },
  { prefix: "/bucket3/non-service-hours", groupKey: "crm" },
  { prefix: "/bucket3/payroll", groupKey: "crm" },
  { prefix: "/admin-redesign/files", groupKey: "crm" },
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
