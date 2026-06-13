"use client";

/**
 * admin v3 — unified Settings surface. 1:1 port of
 * docs/admin_designe/11_settings.html: a two-level (cluster → page) navigation
 * over ~24 settings sub-pages, rendered in the same self-contained chrome as
 * the Management page (sidebar + header reused from MgmtPage).
 *
 * Incremental migration (mirrors how Company applications joined Management):
 * a page is either rendered IN-PAGE (new design, wired to its real backend) or,
 * until migrated, its pill NAVIGATES to the existing working route. As each page
 * is migrated, its pill flips from navigate-out to an in-page pane and its route
 * is added to MGMT_PREFIXES so it renders this chrome.
 *
 * Migrated so far: Exchange rates (Money cluster).
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import "../platform/management/management.css";
import { Sidebar, Header } from "../platform/management/MgmtPage";
import { settingsStrings, type SettingsKey } from "./settings-i18n";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessNotificationsNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import {
  apiExchangeRatesList,
  apiExchangeRateCreate,
  apiExchangeRateUpdate,
  apiExchangeRateDeactivate,
  type ExchangeRateRow,
  type FxRateSource,
} from "@/lib/exchange-rates-api";
import {
  apiPricingRulesList,
  apiPricingRuleCreate,
  apiPricingRuleUpdate,
  apiPricingRuleDelete,
  apiPricingRuleTest,
  type PricingRuleRow,
  type PricingRuleCreate,
  type PricingRuleScope,
  type PricingRuleMarkupType,
  type PricingRuleServiceCategory,
  type PricingRuleTestResult,
} from "@/lib/pricing-rules-api";
import {
  apiMoneyFlowTermsList,
  apiMoneyFlowTermCreate,
  apiMoneyFlowTermUpdate,
  apiMoneyFlowTermDelete,
  type MoneyFlowTermRow,
  type MoneyFlowTermCreate,
  type MoneyFlowScope,
  type CollectionModel,
  type InvoicingPeriod,
} from "@/lib/money-flow-terms-api";
import {
  apiPlatformReviews,
  apiModerateReview,
  apiPlatformBanners,
  apiCreatePlatformBanner,
  apiUpdatePlatformBanner,
  apiDeletePlatformBanner,
  apiReorderBanners,
  apiBulkDeleteBanners,
  apiNewsletterSubscriptions,
  apiNewsletterStats,
  apiDeleteNewsletterSubscription,
  apiPlatformNotifications,
  apiPlatformNotificationStats,
  apiAdminNotices,
  apiAdminNoticeCreate,
  apiAdminNoticeUpdate,
  apiAdminNoticeSend,
  apiAdminNoticeDelete,
  type AdminNoticeRow,
  type AdminNoticePayload,
  type PlatformReviewRow,
  type PlatformBannerRow,
  type NewsletterSubscriptionRow,
  type NewsletterStats,
  type PlatformNotificationRow,
  type PlatformNotificationStats,
  apiAdminHeaderMenu,
  apiSyncHeaderMenu,
  apiAdminFooter,
  apiSyncFooter,
  apiBrandSettings,
  apiPatchBrandSettings,
  BRAND_SOCIAL_PLATFORMS,
  type HeaderMenuAdminRow,
  type FooterColumnAdminRow,
  type FooterLinkAdminRow,
  type FooterSyncColumnPayload,
  type BrandSettings,
  type BrandCustomField,
  apiLoyaltyAccounts,
  apiLoyaltyStats,
  apiLoyaltyTransactions,
  apiLoyaltyAdjust,
  type LoyaltyAccountRow,
  type LoyaltyAccountDetail,
  type LoyaltyStats,
  apiPlatformSettings,
  apiPatchPlatformSetting,
  apiSecurityTwoFactor,
  apiSecurityStats,
  apiSecurityForceDisable2fa,
  apiSecurityForceLogout,
  type PlatformSettingRow,
  type SecurityTwoFactorRow,
  type SecurityStats,
  apiWebhookStats,
  apiWebhookSubscriptions,
  apiWebhookDeliveries,
  apiWebhookReplay,
  apiWebhookEvents,
  apiWebhookSubCreate,
  apiWebhookSubUpdate,
  apiWebhookSubDelete,
  type WebhookStats,
  type WebhookSubscriptionRow,
  type WebhookDeliveryRow,
  apiRbacStats,
  apiRbacRoles,
  apiRbacPermissions,
  apiRbacCreateRole,
  apiRbacUpdateRole,
  apiRbacDeleteRole,
  type RbacStatsData,
  type RbacRoleRow,
  type RbacRoleScope,
} from "@/lib/platform-admin-api";
import {
  apiAdminPages,
  apiCreateAdminPage,
  apiPatchAdminPageStatus,
  apiDeleteAdminPage,
  type AdminPageRow,
} from "@/lib/pages-api";
import { ImageUploadField } from "@/components/ImageUploadField";
import { getApiPublicOrigin, getApiBaseUrl } from "@/lib/api-base";
import { exportRowsAsCsv } from "@/lib/export-csv";
import {
  apiSupportTickets,
  apiSupportTicket,
  apiSupportTicketReply,
  type SupportTicketListRow,
  type SupportTicketDetail,
} from "@/lib/support-api";
import {
  apiAdminLanguages,
  apiLocalizationCreateLanguage,
  apiLocalizationDeleteLanguage,
  apiSetDefaultLanguage,
  apiEditLanguage,
  apiLocalizationScan,
  apiUiTranslationsGetAdmin,
  apiUiTranslationsSave,
  apiLocalizationTranslationsGet,
  apiLocalizationTranslationsSet,
  apiLocalizationTemplateGet,
  apiLocalizationTemplatePatch,
  LOCALIZATION_ENTITY_TYPES,
  LOCALIZATION_TRANSLATABLE_FIELDS,
  NOTIFICATION_TEMPLATE_EVENTS,
  type LocalizationLanguageRow,
  type UiTranslationRow,
} from "@/lib/localization-api";
import {
  apiLocationCountries,
  apiLocationCountryCreate,
  apiLocationCountryUpdate,
  apiLocationCountryDelete,
  apiLocationRegions,
  apiLocationRegionCreate,
  apiLocationRegionUpdate,
  apiLocationRegionDelete,
  apiLocationCities,
  apiLocationCityCreate,
  apiLocationCityUpdate,
  apiLocationCityDelete,
  type LocationCountryRow,
  type LocationRegionRow,
  type LocationCityRow,
} from "@/lib/locations-api";
import {
  apiConnectionsList,
  apiConnectionCreate,
  apiConnectionAccept,
  apiConnectionReject,
  apiConnectionCancel,
  apiCompanyClients,
  CONNECTION_SOURCE_TYPES,
  CONNECTION_TARGET_TYPES,
  type ConnectionRow,
  type ConnectionCreateBody,
  type CompanyClientOption,
} from "@/lib/connections-api";
import { RbacMenuTree } from "@/components/rbac/RbacMenuTree";
import { PinPromptDialog } from "@/components/PinPromptDialog";

// ── Page catalogue ──────────────────────────────────────────────
export type SettingsPageKey =
  | "pricing-rules" | "money-flow" | "exchange-rates"
  | "rbac"
  | "languages" | "ui-strings" | "content-tr" | "email-tpl"
  | "cms-pages" | "banners" | "sys-notif" | "newsletter"
  | "header-menu" | "footer" | "brand"
  | "loyalty"
  | "security" | "webhooks" | "locations" | "api-docs" | "connections" | "platform-settings"
  | "support-tickets" | "reviews";

type ClusterKey =
  | "money" | "permissions" | "localization" | "content" | "layout" | "marketing" | "system" | "support";

type PageMeta = {
  cluster: ClusterKey;
  labelKey: SettingsKey;
  subKey?: SettingsKey;
  super: boolean;
  // When set, the page renders in-page; otherwise clicking the pill navigates here.
  inPage?: boolean;
  href?: string;
  // 2026-06-13 redesign — page relocated OUT of Settings (→ Inbox / CRM). Hidden
  // from the Settings nav; its pane + route stay reachable until the target
  // section is rebuilt and absorbs it (see docs/admin_redesign_cleanup_checklist.md).
  moved?: boolean;
};

const PAGES: Record<SettingsPageKey, PageMeta> = {
  "pricing-rules":     { cluster: "money", labelKey: "pgPricingRules", subKey: "subPricingRules", super: true, inPage: true, href: "/settings/pricing-rules" },
  "money-flow":        { cluster: "money", labelKey: "pgMoneyFlow", subKey: "subMoneyFlow", super: true, inPage: true, href: "/settings/money-flow" },
  "exchange-rates":    { cluster: "money", labelKey: "pgExchangeRates", subKey: "subExchangeRates", super: true, inPage: true, href: "/settings/exchange-rates" },
  "rbac":              { cluster: "permissions", labelKey: "pgRbac", subKey: "subRbac", super: true, inPage: true, href: "/platform/rbac" },
  "languages":         { cluster: "localization", labelKey: "pgLanguages", subKey: "subLanguages", super: true, inPage: true, href: "/localization/languages" },
  "ui-strings":        { cluster: "localization", labelKey: "pgUiStrings", subKey: "subUiStrings", super: true, inPage: true, href: "/localization/ui-translations" },
  "content-tr":        { cluster: "localization", labelKey: "pgContentTr", subKey: "subContentTr", super: false, inPage: true, href: "/localization/translations" },
  // moved → Inbox (hidden from Settings nav, pane/route kept until Inbox rebuild)
  "email-tpl":         { cluster: "localization", labelKey: "pgEmailTpl", subKey: "subEmailTpl", super: false, inPage: true, href: "/localization/templates", moved: true },
  "cms-pages":         { cluster: "content", labelKey: "pgCmsPages", subKey: "subCmsPages", super: true, inPage: true, href: "/pages" },
  "banners":           { cluster: "content", labelKey: "pgBanners", subKey: "subBanners", super: true, inPage: true, href: "/platform/banners" },
  // moved → Inbox
  "sys-notif":         { cluster: "content", labelKey: "pgSysNotif", subKey: "subSysNotif", super: true, inPage: true, href: "/platform/notifications", moved: true },
  // 2026-06-13 redesign — Newsletter moved into the Marketing cluster (with Loyalty).
  "newsletter":        { cluster: "marketing", labelKey: "pgNewsletter", subKey: "subNewsletter", super: false, inPage: true, href: "/platform/newsletter" },
  // 2026-06-13 redesign — the old "Layout" cluster is gone; these fold into Content & CMS.
  "header-menu":       { cluster: "content", labelKey: "pgHeaderMenu", subKey: "subHeaderMenu", super: true, inPage: true, href: "/platform/settings/header-menu" },
  "footer":            { cluster: "content", labelKey: "pgFooter", subKey: "subFooter", super: true, inPage: true, href: "/platform/settings/footer" },
  "brand":             { cluster: "content", labelKey: "pgBrand", subKey: "subBrand", super: true, inPage: true, href: "/platform/settings/brand" },
  "loyalty":           { cluster: "marketing", labelKey: "pgLoyalty", subKey: "subLoyalty", super: false, inPage: true, href: "/platform/loyalty" },
  "security":          { cluster: "system", labelKey: "pgSecurity", subKey: "subSecurity", super: true, inPage: true, href: "/platform/security" },
  "webhooks":          { cluster: "system", labelKey: "pgWebhooks", subKey: "subWebhooks", super: true, inPage: true, href: "/platform/webhooks" },
  "locations":         { cluster: "system", labelKey: "pgLocations", subKey: "subLocations", super: true, inPage: true, href: "/platform/locations" },
  "api-docs":          { cluster: "system", labelKey: "pgApiDocs", subKey: "subApiDocs", super: true, inPage: true, href: "/platform/api-docs" },
  // moved → CRM
  "connections":       { cluster: "system", labelKey: "pgConnections", subKey: "subConnections", super: false, inPage: true, href: "/connections", moved: true },
  "platform-settings": { cluster: "system", labelKey: "pgPlatformSettings", subKey: "subPlatformSettings", super: true, inPage: true, href: "/platform/settings" },
  // moved → Inbox
  "support-tickets":   { cluster: "support", labelKey: "pgSupportTickets", subKey: "subSupportTickets", super: false, inPage: true, href: "/support/tickets", moved: true },
  "reviews":           { cluster: "support", labelKey: "pgReviews", subKey: "subReviews", super: true, inPage: true, href: "/platform/reviews", moved: true },
};

// 2026-06-13 redesign — 6 clusters (was 8). "Layout" folded into Content & CMS;
// "Support" removed (Reviews + Support tickets relocated to Inbox). Icons match
// the settings.html mock (docs/admin_designe/files/settings.html).
const CLUSTERS: Array<{ key: ClusterKey; labelKey: SettingsKey; icon: string }> = [
  { key: "money", labelKey: "clMoney", icon: "ti-coin" },
  { key: "permissions", labelKey: "clPermissions", icon: "ti-shield-lock" },
  { key: "localization", labelKey: "clLocalization", icon: "ti-language" },
  { key: "content", labelKey: "clContent", icon: "ti-layout-grid" },
  { key: "marketing", labelKey: "clMarketing", icon: "ti-speakerphone" },
  { key: "system", labelKey: "clSystem", icon: "ti-server-cog" },
];

const PAGES_BY_CLUSTER: Record<ClusterKey, SettingsPageKey[]> = (() => {
  const m = {} as Record<ClusterKey, SettingsPageKey[]>;
  for (const c of CLUSTERS) m[c.key] = [];
  (Object.keys(PAGES) as SettingsPageKey[]).forEach((k) => {
    const meta = PAGES[k];
    if (meta.moved) return; // relocated out of Settings → not shown in the nav
    if (m[meta.cluster]) m[meta.cluster].push(k); // skip any cluster no longer in the strip
  });
  return m;
})();

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const FX_SOURCE_TONE: Record<FxRateSource, string> = {
  manual: "badge-primary",
  cba: "badge-info",
  ecb: "badge-info",
  exchangerate_api: "badge-gray",
  partner_override: "badge-warning",
};

// ════════════════════════════════════════════════════════════════
export function SettingsPage({ initialPage = "exchange-rates" }: { initialPage?: SettingsPageKey }) {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();
  const s = settingsStrings(lang);

  const [page, setPage] = useState<SettingsPageKey>(initialPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);
  useEffect(() => {
    if (!token || !canAccessNotificationsNav(user)) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiNotificationsUnreadCount(token);
        if (!cancelled) setUnreadCount(res.data.unread_count ?? 0);
      } catch {
        /* badge is non-critical chrome */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  const meta = PAGES[page];
  const activeCluster = meta.cluster;

  // Navigate to a page: in-page → swap pane + sync URL; otherwise router.push.
  const showPage = useCallback(
    (key: SettingsPageKey) => {
      const m = PAGES[key];
      if (m.inPage) {
        setPage(key);
        if (typeof window !== "undefined" && m.href) {
          window.history.replaceState(window.history.state, "", m.href);
        }
        // `.main` is the scroll container (window is locked); reset it, not window.
        document.querySelector(".mgmt-page .main")?.scrollTo({ top: 0, behavior: "smooth" });
      } else if (m.href) {
        router.push(m.href);
      }
    },
    [router]
  );

  const goCluster = useCallback(
    (c: ClusterKey) => {
      const first = PAGES_BY_CLUSTER[c][0];
      if (first) showPage(first);
    },
    [showPage]
  );

  const title = s[meta.labelKey];
  const subtitle = meta.subKey ? s[meta.subKey] : "";
  // A relocated ("moved") page opened via its own route can carry a cluster that
  // is no longer in the 6-cluster strip — degrade gracefully instead of crashing.
  const activeClusterMeta = CLUSTERS.find((c) => c.key === activeCluster) ?? null;
  const activePills = PAGES_BY_CLUSTER[activeCluster] ?? [];

  return (
    <div className="mgmt-page mgmt-page-host">
      <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={() => setSidebarCollapsed((v) => !v)}
            user={user ?? null}
            token={token}
            lang={lang}
            languageOptions={languageOptions}
            onSetLang={setLang}
            unreadCount={unreadCount}
            onLogout={() => void logout().then(() => router.push("/login"))}
            onNavigate={(href) => router.push(href)}
          />
          <div className="page">
            <div className="page-header">
              <div>
                <div className="breadcrumb">
                  <a onClick={() => router.push("/dashboard")}>{s.breadcrumbHome}</a>
                  <i className="ti ti-chevron-right" />
                  {activeClusterMeta ? (
                    <>
                      <span>{s[activeClusterMeta.labelKey]}</span>
                      <i className="ti ti-chevron-right" />
                    </>
                  ) : null}
                  <span className="breadcrumb-current">{title}</span>
                </div>
                <h1 className="page-title">
                  <span>{title}</span>
                  {meta.super && (
                    <span className="super-tag">
                      <i className="ti ti-shield-lock" style={{ fontSize: 13 }} />
                      {s.superAdmin}
                    </span>
                  )}
                </h1>
                {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }} id="action-slot" />
            </div>

            {/* Level 1 — cluster strip */}
            <div className="section-tabs">
              {CLUSTERS.map((c) => (
                <button
                  key={c.key}
                  className={`section-tab ${c.key === activeCluster ? "active" : ""}`}
                  onClick={() => goCluster(c.key)}
                >
                  <i className={`ti ${c.icon}`} />
                  {s[c.labelKey]}
                </button>
              ))}
            </div>

            {/* Level 2 — page pills for the active cluster */}
            <div className="pills-row">
              {activePills.map((k) => (
                <button
                  key={k}
                  className={`sub-tab ${k === page ? "active" : ""}`}
                  onClick={() => showPage(k)}
                >
                  {s[PAGES[k].labelKey]}
                </button>
              ))}
            </div>

            {/* In-page panes */}
            {page === "pricing-rules" && <PricingRulesPane token={token} lang={lang} />}
            {page === "money-flow" && <MoneyFlowPane token={token} lang={lang} />}
            {page === "exchange-rates" && <ExchangeRatesPane token={token} lang={lang} />}
            {page === "reviews" && <ReviewsPane token={token} lang={lang} />}
            {page === "support-tickets" && <SupportTicketsPane token={token} lang={lang} />}
            {page === "locations" && <LocationsPane token={token} lang={lang} />}
            {page === "languages" && <LanguagesPane token={token} lang={lang} />}
            {page === "ui-strings" && <UiStringsPane token={token} lang={lang} />}
            {page === "content-tr" && <ContentTrPane token={token} lang={lang} />}
            {page === "email-tpl" && <EmailTplPane token={token} lang={lang} />}
            {page === "cms-pages" && <CmsPagesPane token={token} lang={lang} />}
            {page === "banners" && <BannersPane token={token} lang={lang} />}
            {page === "sys-notif" && <SysNotifPane token={token} lang={lang} />}
            {page === "newsletter" && <NewsletterPane token={token} lang={lang} />}
            {page === "header-menu" && <HeaderMenuPane token={token} lang={lang} />}
            {page === "footer" && <FooterPane token={token} lang={lang} />}
            {page === "brand" && <BrandPane token={token} lang={lang} />}
            {page === "loyalty" && <LoyaltyPane token={token} lang={lang} />}
            {page === "security" && <SecurityPane token={token} lang={lang} />}
            {page === "platform-settings" && <PlatformSettingsPane token={token} lang={lang} />}
            {page === "webhooks" && <WebhooksPane token={token} lang={lang} />}
            {page === "connections" && <ConnectionsPane token={token} lang={lang} />}
            {page === "rbac" && <RbacPane token={token} lang={lang} />}
            {page === "api-docs" && <ApiDocsPane token={token} lang={lang} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Exchange rates pane (Money cluster) — full CRUD
// ════════════════════════════════════════════════════════════════

type FxModalState = { mode: "create" } | { mode: "edit"; row: ExchangeRateRow } | null;

function ExchangeRatesPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<ExchangeRateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pair, setPair] = useState("");
  const [source, setSource] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [modal, setModal] = useState<FxModalState>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiExchangeRatesList(token, {
        pair: pair.trim() || undefined,
        source: (source || undefined) as FxRateSource | undefined,
        is_active: activeFilter === "" ? undefined : activeFilter === "1",
        per_page: 100,
      });
      setRows(res.data);
    } catch (e) {
      console.error("exchange rates load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, pair, source, activeFilter]);
  useEffect(() => {
    void load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deactivate(row: ExchangeRateRow) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDelete)) return;
    try {
      await apiExchangeRateDeactivate(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function reactivate(row: ExchangeRateRow) {
    if (!token) return;
    try {
      await apiExchangeRateUpdate(token, row.id, { is_active: true });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function save(input: { source_currency: string; target_currency: string; rate: string; is_active: boolean }) {
    if (!token) return;
    setBusy(true);
    try {
      if (modal?.mode === "edit") {
        await apiExchangeRateUpdate(token, modal.row.id, { rate: input.rate, is_active: input.is_active });
      } else {
        await apiExchangeRateCreate(token, {
          source_currency: input.source_currency.toUpperCase(),
          target_currency: input.target_currency.toUpperCase(),
          rate: input.rate,
          is_active: input.is_active,
        });
      }
      setModal(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const sourceLabel = (src: FxRateSource): string =>
    src === "manual" ? s.fxSrcManual
      : src === "cba" ? s.fxSrcCba
      : src === "ecb" ? s.fxSrcEcb
      : src === "partner_override" ? s.fxSrcPartner
      : s.fxSrcApi;

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.fxColPair}</span>
          <input
            type="search"
            placeholder="USD AMD"
            style={{ textTransform: "uppercase" }}
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void load()}
          />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.fxColSource}</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">{s.all}</option>
            <option value="manual">{s.fxSrcManual}</option>
            <option value="cba">{s.fxSrcCba}</option>
            <option value="ecb">{s.fxSrcEcb}</option>
            <option value="exchangerate_api">{s.fxSrcApi}</option>
            <option value="partner_override">{s.fxSrcPartner}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            <option value="">{s.all}</option>
            <option value="1">{s.statusActive}</option>
            <option value="0">{s.statusInactive}</option>
          </select>
        </div>
        <button className="btn" onClick={() => void load()}>
          <i className="ti ti-filter" />
          {s.apply}
        </button>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}>
          <i className="ti ti-plus" />
          {s.fxNewRate}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.fxColPair}</th>
                <th>{s.fxColRate}</th>
                <th>{s.fxColSource}</th>
                <th>{s.fxColFetched}</th>
                <th>{s.status}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.fxEmpty}</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono">{r.source_currency} → {r.target_currency}</td>
                    <td className="num-cell font-mono">{r.rate}</td>
                    <td><span className={`badge ${FX_SOURCE_TONE[r.source] ?? "badge-gray"}`}>{sourceLabel(r.source)}</span></td>
                    <td className="cell-muted">{fmtDateTime(r.fetched_at)}</td>
                    <td>
                      <span className={`badge ${r.is_active ? "badge-success" : "badge-gray"}`}>
                        {r.is_active ? s.statusActive : s.statusInactive}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button className="icon-btn" title={s.edit} onClick={() => setModal({ mode: "edit", row: r })}>
                          <i className="ti ti-edit" />
                        </button>
                        {r.is_active ? (
                          <button className="icon-btn danger" title={s.fxDeactivate} onClick={() => void deactivate(r)}>
                            <i className="ti ti-trash" />
                          </button>
                        ) : (
                          <button className="icon-btn" title={s.fxReactivate} onClick={() => void reactivate(r)}>
                            <i className="ti ti-power" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExchangeRateModal
        state={modal}
        busy={busy}
        lang={lang}
        onClose={() => setModal(null)}
        onSave={(input) => void save(input)}
      />
    </div>
  );
}

function ExchangeRateModal({
  state,
  busy,
  lang,
  onClose,
  onSave,
}: {
  state: FxModalState;
  busy: boolean;
  lang: string;
  onClose: () => void;
  onSave: (input: { source_currency: string; target_currency: string; rate: string; is_active: boolean }) => void;
}) {
  const s = settingsStrings(lang);
  const isEdit = state?.mode === "edit";
  const [src, setSrc] = useState("");
  const [tgt, setTgt] = useState("");
  const [rate, setRate] = useState("");
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setSrc(state.row.source_currency);
      setTgt(state.row.target_currency);
      setRate(state.row.rate);
      setActive(state.row.is_active);
    } else {
      setSrc("");
      setTgt("");
      setRate("");
      setActive(true);
    }
  }, [state]);

  const valid = isEdit
    ? rate.trim() !== "" && Number(rate) > 0
    : src.trim().length === 3 && tgt.trim().length === 3 && rate.trim() !== "" && Number(rate) > 0;

  return (
    <div
      className={`modal-overlay ${state ? "open" : ""}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? s.edit : s.fxNewRate}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fld">
              <label className="fld-label">{s.fxFldSource}</label>
              <input
                value={src}
                maxLength={3}
                disabled={isEdit}
                placeholder="USD"
                style={{ textTransform: "uppercase" }}
                onChange={(e) => setSrc(e.target.value)}
              />
            </div>
            <div className="fld">
              <label className="fld-label">{s.fxFldTarget}</label>
              <input
                value={tgt}
                maxLength={3}
                disabled={isEdit}
                placeholder="AMD"
                style={{ textTransform: "uppercase" }}
                onChange={(e) => setTgt(e.target.value)}
              />
            </div>
            <div className="fld">
              <label className="fld-label">{s.fxFldRate}</label>
              <input type="number" step="0.0001" value={rate} placeholder="398.50" onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="fld" style={{ justifyContent: "flex-end" }}>
              <label className="switch-row" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                {s.active}
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button
            className="btn btn-primary"
            disabled={busy || !valid}
            onClick={() => onSave({ source_currency: src, target_currency: tgt, rate, is_active: active })}
          >
            <i className="ti ti-device-floppy" />
            {isEdit ? s.save : s.create}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Pricing rules pane (Money cluster) — list + filters + test panel + CRUD
// ════════════════════════════════════════════════════════════════

const CURRENCIES = ["AMD", "USD", "EUR", "RUB", "GBP"];

type PrForm = {
  scope_type: PricingRuleScope;
  operator_id: string;
  agent_id: string;
  service_category: PricingRuleServiceCategory | "";
  markup_type: PricingRuleMarkupType;
  markup_value: string;
  min_sell_amount: string;
  max_sell_amount: string;
  currency: string;
  effective_from: string;
  effective_until: string;
  priority: string;
  is_active: boolean;
  reason: string;
};

const blankPr: PrForm = {
  scope_type: "global",
  operator_id: "",
  agent_id: "",
  service_category: "",
  markup_type: "percentage",
  markup_value: "15",
  min_sell_amount: "",
  max_sell_amount: "",
  currency: "AMD",
  effective_from: "",
  effective_until: "",
  priority: "100",
  is_active: true,
  reason: "",
};

function PricingRulesPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<PricingRuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fScope, setFScope] = useState("");
  const [fCurrency, setFCurrency] = useState("");
  const [fActive, setFActive] = useState("");
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; row: PricingRuleRow } | null>(null);
  const [busy, setBusy] = useState(false);

  // Test panel
  const [tOffer, setTOffer] = useState("");
  const [tQty, setTQty] = useState("1");
  const [tAgent, setTAgent] = useState("");
  const [tDest, setTDest] = useState("");
  const [tOverride, setTOverride] = useState("");
  const [tResult, setTResult] = useState<PricingRuleTestResult | null>(null);
  const [tErr, setTErr] = useState<string | null>(null);
  const [tBusy, setTBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiPricingRulesList(token, {
        scope_type: (fScope || undefined) as PricingRuleScope | undefined,
        currency: fCurrency || undefined,
        is_active: fActive === "" ? undefined : fActive === "1",
        per_page: 100,
      });
      setRows(res.data ?? []);
    } catch (e) {
      console.error("pricing rules load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, fScope, fCurrency, fActive]);
  useEffect(() => {
    void load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function del(row: PricingRuleRow) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDelete)) return;
    try {
      await apiPricingRuleDelete(token, row.id, "Deleted via admin UI");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function save(form: PrForm) {
    if (!token) return;
    setBusy(true);
    const payload: PricingRuleCreate = {
      scope_type: form.scope_type,
      markup_type: form.markup_type,
      markup_value: Number(form.markup_value),
      currency: form.currency.toUpperCase(),
      effective_from: form.effective_from ? new Date(form.effective_from).toISOString() : new Date().toISOString(),
      priority: form.priority ? Number(form.priority) : 100,
      is_active: form.is_active,
    };
    if (form.operator_id) payload.operator_id = Number(form.operator_id);
    if (form.agent_id) payload.agent_id = Number(form.agent_id);
    if (form.service_category) payload.service_category = form.service_category;
    if (form.min_sell_amount) payload.min_sell_amount = Number(form.min_sell_amount);
    if (form.max_sell_amount) payload.max_sell_amount = Number(form.max_sell_amount);
    if (form.effective_until) payload.effective_until = new Date(form.effective_until).toISOString();
    if (form.reason.trim()) payload.reason = form.reason.trim();
    try {
      if (modal?.mode === "edit") await apiPricingRuleUpdate(token, modal.row.id, payload);
      else await apiPricingRuleCreate(token, payload);
      setModal(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    if (!token || !tOffer) {
      setTErr(s.prTestErr);
      return;
    }
    setTBusy(true);
    setTErr(null);
    setTResult(null);
    try {
      const res = await apiPricingRuleTest(token, {
        offer_id: Number(tOffer),
        quantity: tQty ? Number(tQty) : 1,
        agent_id: tAgent ? Number(tAgent) : undefined,
        destination_id: tDest ? Number(tDest) : undefined,
        price_override: tOverride ? Number(tOverride) : undefined,
      });
      setTResult(res.data);
    } catch (e) {
      setTErr(e instanceof ApiRequestError ? e.message : s.prTestErr);
    } finally {
      setTBusy(false);
    }
  }

  const scopeLabel = (sc: PricingRuleScope): string =>
    sc === "global" ? s.prScopeGlobal : sc === "category" ? s.prScopeCategory : sc === "operator" ? s.prScopeOperator : s.prScopePartnership;
  const scopeName = (r: PricingRuleRow): string => {
    if (r.scope_type === "operator") return r.operator_name ?? `#${r.operator_id}`;
    if (r.scope_type === "partnership") return `${r.operator_name ?? `#${r.operator_id}`} → ${r.agent_name ?? `#${r.agent_id}`}`;
    if (r.scope_type === "category") return r.service_category ? s[("svc" + r.service_category.charAt(0).toUpperCase() + r.service_category.slice(1)) as SettingsKey] ?? r.service_category : "";
    return "";
  };

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.prFilterScope}</span>
          <select value={fScope} onChange={(e) => setFScope(e.target.value)}>
            <option value="">{s.prAllScopes}</option>
            <option value="global">{s.prScopeGlobal}</option>
            <option value="category">{s.prScopeCategory}</option>
            <option value="operator">{s.prScopeOperator}</option>
            <option value="partnership">{s.prScopePartnership}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.prFilterCurrency}</span>
          <select value={fCurrency} onChange={(e) => setFCurrency(e.target.value)}>
            <option value="">{s.all}</option>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={fActive} onChange={(e) => setFActive(e.target.value)}>
            <option value="">{s.all}</option>
            <option value="1">{s.statusActive}</option>
            <option value="0">{s.statusInactive}</option>
          </select>
        </div>
        <button className="btn" onClick={() => void load()}><i className="ti ti-filter" />{s.apply}</button>
        <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}><i className="ti ti-plus" />{s.prNewRule}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.prColScope}</th>
                <th>{s.prColMarkup}</th>
                <th>{s.prColBounds}</th>
                <th>{s.prColCurrency}</th>
                <th>{s.prColPriority}</th>
                <th>{s.status}</th>
                <th>{s.prColEffective}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.prEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => setModal({ mode: "edit", row: r })} style={{ cursor: "pointer" }}>
                    <td><span className="type-badge">{scopeLabel(r.scope_type)}</span> {scopeName(r)}</td>
                    <td>
                      {r.markup_type === "percentage" ? `+${r.markup_value}%` : `+${r.markup_value}`}{" "}
                      <span className="cell-muted">({r.markup_type === "percentage" ? s.prMarkupPercent : s.prMarkupFixed})</span>
                    </td>
                    <td className="num-cell">
                      {r.min_sell_amount ?? "—"} / {r.max_sell_amount ?? "—"}
                    </td>
                    <td>{r.currency}</td>
                    <td className="num-cell">{r.priority}</td>
                    <td><span className={`badge ${r.is_active ? "badge-success" : "badge-gray"}`}>{r.is_active ? s.statusActive : s.statusInactive}</span></td>
                    <td className="cell-muted">{fmtDateTime(r.effective_from).slice(0, 10)}{r.effective_until ? ` — ${fmtDateTime(r.effective_until).slice(0, 10)}` : ""}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button className="icon-btn" title={s.edit} onClick={() => setModal({ mode: "edit", row: r })}><i className="ti ti-edit" /></button>
                        <button className="icon-btn danger" title={s.delete} onClick={() => void del(r)}><i className="ti ti-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test panel */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><i className="ti ti-flask" style={{ fontSize: 15, color: "var(--primary)" }} /> {s.prTestTitle}</div>
            <div className="card-subtitle">{s.prTestSub}</div>
          </div>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.prTestOfferId}</label><input value={tOffer} onChange={(e) => setTOffer(e.target.value)} placeholder="10482" /></div>
            <div className="fld"><label className="fld-label">{s.prTestQuantity}</label><input type="number" value={tQty} onChange={(e) => setTQty(e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.prTestAgent}</label><input value={tAgent} onChange={(e) => setTAgent(e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.prTestDestination}</label><input value={tDest} onChange={(e) => setTDest(e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.prTestPriceOverride}</label><input value={tOverride} onChange={(e) => setTOverride(e.target.value)} /></div>
            <div className="fld" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-primary" disabled={tBusy || !tOffer} onClick={() => void runTest()}><i className="ti ti-player-play" />{s.prTestRun}</button>
            </div>
          </div>
          {tErr && <div className="approve-note" style={{ background: "var(--danger-light)", borderColor: "var(--danger)", color: "var(--danger-dark)", marginTop: 12 }}><i className="ti ti-alert-triangle" /><div>{tErr}</div></div>}
          {tResult && (
            <div className="test-out">
              <div className="info-row"><span className="info-label">{s.prTestSupplierNet}</span><span className="info-value font-mono">{tResult.supplier_net.toFixed(2)} {tResult.currency}</span></div>
              <div className="info-row"><span className="info-label">{s.prTestCustomerPrice}</span><span className="info-value font-mono">{tResult.customer_price.toFixed(2)} {tResult.currency}</span></div>
              <div className="info-row"><span className="info-label">{s.prTestLineTotal}</span><span className="info-value font-mono">{tResult.line_total.toFixed(2)} {tResult.currency}</span></div>
              <div className="info-row" style={{ borderBottom: "none" }}><span className="info-label">{s.prTestRuleApplied}</span><span className="info-value">{tResult.rule_id_applied ?? s.prTestNoRule}</span></div>
            </div>
          )}
        </div>
      </div>

      <PricingRuleModal state={modal} busy={busy} lang={lang} onClose={() => setModal(null)} onSave={(f) => void save(f)} />
    </div>
  );
}

function PricingRuleModal({
  state,
  busy,
  lang,
  onClose,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; row: PricingRuleRow } | null;
  busy: boolean;
  lang: string;
  onClose: () => void;
  onSave: (f: PrForm) => void;
}) {
  const s = settingsStrings(lang);
  const isEdit = state?.mode === "edit";
  const [f, setF] = useState<PrForm>(blankPr);
  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      const r = state.row;
      setF({
        scope_type: r.scope_type,
        operator_id: r.operator_id?.toString() ?? "",
        agent_id: r.agent_id?.toString() ?? "",
        service_category: r.service_category ?? "",
        markup_type: r.markup_type,
        markup_value: r.markup_value.toString(),
        min_sell_amount: r.min_sell_amount?.toString() ?? "",
        max_sell_amount: r.max_sell_amount?.toString() ?? "",
        currency: r.currency,
        effective_from: r.effective_from.slice(0, 16),
        effective_until: r.effective_until?.slice(0, 16) ?? "",
        priority: r.priority.toString(),
        is_active: r.is_active,
        reason: "",
      });
    } else {
      setF(blankPr);
    }
  }, [state]);
  const set = (patch: Partial<PrForm>) => setF((p) => ({ ...p, ...patch }));
  const valid = f.markup_value.trim() !== "" && (f.scope_type !== "operator" || f.operator_id.trim() !== "") && (f.scope_type !== "partnership" || (f.operator_id.trim() !== "" && f.agent_id.trim() !== ""));

  return (
    <div className={`modal-overlay ${state ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal lg">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? s.prEditRule : s.prNewRule}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fld">
              <label className="fld-label">{s.prColScope}</label>
              <select value={f.scope_type} onChange={(e) => set({ scope_type: e.target.value as PricingRuleScope })}>
                <option value="global">{s.prScopeGlobal}</option>
                <option value="category">{s.prScopeCategory}</option>
                <option value="operator">{s.prScopeOperator}</option>
                <option value="partnership">{s.prScopePartnership}</option>
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.prFldServiceCat}</label>
              <select value={f.service_category} onChange={(e) => set({ service_category: e.target.value as PricingRuleServiceCategory | "" })}>
                <option value="">{s.svcAny}</option>
                <option value="hotel">{s.svcHotel}</option>
                <option value="flight">{s.svcFlight}</option>
                <option value="transfer">{s.svcTransfer}</option>
                <option value="car">{s.svcCar}</option>
                <option value="excursion">{s.svcExcursion}</option>
                <option value="package">{s.svcPackage}</option>
                <option value="visa">{s.svcVisa}</option>
              </select>
            </div>
            {(f.scope_type === "operator" || f.scope_type === "partnership") && (
              <div className="fld"><label className="fld-label">{s.prFldOperatorId}</label><input type="number" value={f.operator_id} onChange={(e) => set({ operator_id: e.target.value })} /></div>
            )}
            {f.scope_type === "partnership" && (
              <div className="fld"><label className="fld-label">{s.prFldAgentId}</label><input type="number" value={f.agent_id} onChange={(e) => set({ agent_id: e.target.value })} /></div>
            )}
            <div className="fld">
              <label className="fld-label">{s.prFldMarkupType}</label>
              <select value={f.markup_type} onChange={(e) => set({ markup_type: e.target.value as PricingRuleMarkupType })}>
                <option value="percentage">{s.prMarkupTypePercent}</option>
                <option value="fixed">{s.prMarkupTypeFixed}</option>
              </select>
            </div>
            <div className="fld"><label className="fld-label">{s.prFldMarkupValue}</label><input type="number" step="0.0001" value={f.markup_value} onChange={(e) => set({ markup_value: e.target.value })} /></div>
            <div className="fld">
              <label className="fld-label">{s.prFldCurrency}</label>
              <select value={f.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="fld"><label className="fld-label">{s.prFldPriority}</label><input type="number" value={f.priority} onChange={(e) => set({ priority: e.target.value })} /></div>
            <div className="fld"><label className="fld-label">{s.prFldMinSell}</label><input type="number" value={f.min_sell_amount} onChange={(e) => set({ min_sell_amount: e.target.value })} /></div>
            <div className="fld"><label className="fld-label">{s.prFldMaxSell}</label><input type="number" value={f.max_sell_amount} onChange={(e) => set({ max_sell_amount: e.target.value })} /></div>
            <div className="fld"><label className="fld-label">{s.prFldEffectiveFrom}</label><input type="datetime-local" value={f.effective_from} onChange={(e) => set({ effective_from: e.target.value })} /></div>
            <div className="fld"><label className="fld-label">{s.prFldEffectiveUntil}</label><input type="datetime-local" value={f.effective_until} onChange={(e) => set({ effective_until: e.target.value })} /></div>
            <div className="fld span-2"><label className="fld-label">{s.prFldReason}</label><input value={f.reason} maxLength={500} onChange={(e) => set({ reason: e.target.value })} /></div>
            <div className="fld" style={{ justifyContent: "flex-end" }}>
              <label className="switch-row" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={f.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
                {s.active}
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => onSave(f)}><i className="ti ti-device-floppy" />{isEdit ? s.save : s.create}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Money flow terms pane (Money cluster) — list + CRUD
// ════════════════════════════════════════════════════════════════

type MfForm = {
  scope_type: MoneyFlowScope;
  operator_id: string;
  agent_id: string;
  collection_model: CollectionModel;
  remittance_days: string;
  invoicing_period: InvoicingPeriod | "";
  is_active: boolean;
  effective_from: string;
  reason: string;
};

const blankMf: MfForm = {
  scope_type: "global",
  operator_id: "",
  agent_id: "",
  collection_model: "zulu_collects",
  remittance_days: "15",
  invoicing_period: "",
  is_active: true,
  effective_from: "",
  reason: "",
};

function MoneyFlowPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<MoneyFlowTermRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; row: MoneyFlowTermRow } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiMoneyFlowTermsList(token, { per_page: 100 });
      setRows(res.data ?? []);
    } catch (e) {
      console.error("money flow load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  async function del(row: MoneyFlowTermRow) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDelete)) return;
    try {
      await apiMoneyFlowTermDelete(token, row.id, "Deleted via admin UI");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function save(form: MfForm) {
    if (!token) return;
    setBusy(true);
    const payload: MoneyFlowTermCreate = {
      scope_type: form.scope_type,
      collection_model: form.collection_model,
      is_active: form.is_active,
      effective_from: form.effective_from ? new Date(form.effective_from).toISOString() : new Date().toISOString(),
    };
    if (form.operator_id) payload.operator_id = Number(form.operator_id);
    if (form.agent_id) payload.agent_id = Number(form.agent_id);
    if (form.collection_model === "zulu_collects" && form.remittance_days) payload.remittance_days = Number(form.remittance_days);
    if (form.collection_model === "operator_collects" && form.invoicing_period) payload.invoicing_period = form.invoicing_period;
    if (form.reason.trim()) payload.reason = form.reason.trim();
    try {
      if (modal?.mode === "edit") await apiMoneyFlowTermUpdate(token, modal.row.id, payload);
      else await apiMoneyFlowTermCreate(token, payload);
      setModal(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const scopeName = (r: MoneyFlowTermRow): string => {
    if (r.scope_type === "operator") return r.operator_name ?? `#${r.operator_id}`;
    if (r.scope_type === "partnership") return `${r.operator_name ?? `#${r.operator_id}`} → ${r.agent_name ?? `#${r.agent_id}`}`;
    return "";
  };
  const modelLabel = (r: MoneyFlowTermRow): string => {
    if (r.collection_model === "zulu_collects") return `${s.mfModelZulu}${r.remittance_days != null ? ` · ${s.mfRemittance} ${r.remittance_days} ${s.mfDays}` : ""}`;
    if (r.collection_model === "operator_collects") return `${s.mfModelOperator}${r.invoicing_period ? ` · ${s.mfInvoicing} ${r.invoicing_period === "weekly" ? s.mfPeriodWeekly : s.mfPeriodMonthly}` : ""}`;
    return s.mfModelAgent;
  };

  return (
    <div>
      <div className="alert"><i className="ti ti-info-circle" /><div>{s.mfNote}</div></div>
      <div className="filter-card">
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}><i className="ti ti-plus" />{s.mfNewTerm}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.mfColScope}</th>
                <th>{s.mfColModel}</th>
                <th>{s.status}</th>
                <th>{s.mfColEffective}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.mfEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => setModal({ mode: "edit", row: r })} style={{ cursor: "pointer" }}>
                    <td>
                      <span className="type-badge">
                        {r.scope_type === "global" ? s.prScopeGlobal : r.scope_type === "operator" ? s.prScopeOperator : s.prScopePartnership}
                      </span> {scopeName(r)}
                    </td>
                    <td>{modelLabel(r)}</td>
                    <td><span className={`badge ${r.is_active ? "badge-success" : "badge-gray"}`}>{r.is_active ? s.statusActive : s.statusInactive}</span></td>
                    <td className="cell-muted">{fmtDateTime(r.effective_from).slice(0, 10)}{r.effective_until ? ` — ${fmtDateTime(r.effective_until).slice(0, 10)}` : ""}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button className="icon-btn" title={s.edit} onClick={() => setModal({ mode: "edit", row: r })}><i className="ti ti-edit" /></button>
                        <button className="icon-btn danger" title={s.delete} onClick={() => void del(r)}><i className="ti ti-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MoneyFlowModal state={modal} busy={busy} lang={lang} onClose={() => setModal(null)} onSave={(f) => void save(f)} />
    </div>
  );
}

function MoneyFlowModal({
  state,
  busy,
  lang,
  onClose,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; row: MoneyFlowTermRow } | null;
  busy: boolean;
  lang: string;
  onClose: () => void;
  onSave: (f: MfForm) => void;
}) {
  const s = settingsStrings(lang);
  const isEdit = state?.mode === "edit";
  const [f, setF] = useState<MfForm>(blankMf);
  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      const r = state.row;
      setF({
        scope_type: r.scope_type,
        operator_id: r.operator_id?.toString() ?? "",
        agent_id: r.agent_id?.toString() ?? "",
        collection_model: r.collection_model,
        remittance_days: r.remittance_days?.toString() ?? "",
        invoicing_period: r.invoicing_period ?? "",
        is_active: r.is_active,
        effective_from: r.effective_from.slice(0, 16),
        reason: "",
      });
    } else {
      setF(blankMf);
    }
  }, [state]);
  const set = (patch: Partial<MfForm>) => setF((p) => ({ ...p, ...patch }));
  const valid = (f.scope_type !== "operator" || f.operator_id.trim() !== "") && (f.scope_type !== "partnership" || (f.operator_id.trim() !== "" && f.agent_id.trim() !== ""));

  return (
    <div className={`modal-overlay ${state ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? s.mfEditTerm : s.mfNewTerm}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fld">
              <label className="fld-label">{s.mfColScope}</label>
              <select value={f.scope_type} onChange={(e) => set({ scope_type: e.target.value as MoneyFlowScope })}>
                <option value="global">{s.prScopeGlobal}</option>
                <option value="operator">{s.prScopeOperator}</option>
                <option value="partnership">{s.prScopePartnership}</option>
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.mfFldModel}</label>
              <select value={f.collection_model} onChange={(e) => set({ collection_model: e.target.value as CollectionModel })}>
                <option value="zulu_collects">{s.mfModelZulu}</option>
                <option value="operator_collects">{s.mfModelOperator}</option>
                <option value="agent_collects">{s.mfModelAgent}</option>
              </select>
            </div>
            {(f.scope_type === "operator" || f.scope_type === "partnership") && (
              <div className="fld"><label className="fld-label">{s.mfFldOperatorId}</label><input type="number" value={f.operator_id} onChange={(e) => set({ operator_id: e.target.value })} /></div>
            )}
            {f.scope_type === "partnership" && (
              <div className="fld"><label className="fld-label">{s.mfFldAgentId}</label><input type="number" value={f.agent_id} onChange={(e) => set({ agent_id: e.target.value })} /></div>
            )}
            {f.collection_model === "zulu_collects" && (
              <div className="fld"><label className="fld-label">{s.mfFldRemittanceDays}</label><input type="number" value={f.remittance_days} onChange={(e) => set({ remittance_days: e.target.value })} /></div>
            )}
            {f.collection_model === "operator_collects" && (
              <div className="fld">
                <label className="fld-label">{s.mfFldInvoicingPeriod}</label>
                <select value={f.invoicing_period} onChange={(e) => set({ invoicing_period: e.target.value as InvoicingPeriod | "" })}>
                  <option value="">—</option>
                  <option value="weekly">{s.mfPeriodWeekly}</option>
                  <option value="monthly">{s.mfPeriodMonthly}</option>
                </select>
              </div>
            )}
            <div className="fld"><label className="fld-label">{s.mfFldEffectiveFrom}</label><input type="datetime-local" value={f.effective_from} onChange={(e) => set({ effective_from: e.target.value })} /></div>
            <div className="fld" style={{ justifyContent: "flex-end" }}>
              <label className="switch-row" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={f.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
                {s.active}
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => onSave(f)}><i className="ti ti-device-floppy" />{isEdit ? s.save : s.create}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Reviews pane (Support cluster) — list + filters + moderate
// ════════════════════════════════════════════════════════════════

function ReviewsPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<PlatformReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fStatus, setFStatus] = useState("");
  const [search, setSearch] = useState("");
  const [moderate, setModerate] = useState<PlatformReviewRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiPlatformReviews(token, { per_page: 100, status: fStatus || undefined });
      setRows(res.data ?? []);
    } catch (e) {
      console.error("reviews load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, fStatus]);
  useEffect(() => {
    void load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitModeration(status: "published" | "hidden" | "rejected", notes: string) {
    if (!token || !moderate) return;
    setBusy(true);
    try {
      await apiModerateReview(token, moderate.id, { status, notes: notes.trim() || null });
      setModerate(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const statusTone = (st: string): string =>
    st === "published" ? "badge-success" : st === "hidden" ? "badge-warning" : st === "rejected" ? "badge-danger" : "badge-gray";
  const statusLabel = (st: string): string =>
    st === "published" ? s.rvStatusPublished : st === "hidden" ? s.rvStatusHidden : st === "rejected" ? s.rvStatusRejected : st;

  const visible = rows.filter((r) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!`${r.user?.name ?? ""} ${r.review_text ?? ""} ${r.target_entity_type} ${r.target_entity_id}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">{s.all}</option>
            <option value="published">{s.rvStatusPublished}</option>
            <option value="hidden">{s.rvStatusHidden}</option>
            <option value="rejected">{s.rvStatusRejected}</option>
          </select>
        </div>
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input type="search" placeholder={s.rvSearchPh} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void load()} />
        </div>
        <button className="btn" onClick={() => void load()}><i className="ti ti-filter" />{s.apply}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{s.rvCardTitle}</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.rvColRating}</th>
                <th>{s.rvColUser}</th>
                <th>{s.rvColEntity}</th>
                <th>{s.rvColText}</th>
                <th>{s.status}</th>
                <th>{s.rvColCreated}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.rvEmpty}</td></tr>
              ) : (
                visible.map((r) => {
                  const rating = Math.max(0, Math.min(5, Math.round(r.rating)));
                  return (
                    <tr key={r.id}>
                      <td><span className="stars">{"★".repeat(rating)}<span className="off">{"★".repeat(5 - rating)}</span></span></td>
                      <td>{r.user?.name ?? "—"}</td>
                      <td className="cell-muted">{r.target_entity_type} #{r.target_entity_id}</td>
                      <td className="text-sm" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.review_text ?? "—"}</td>
                      <td><span className={`badge ${statusTone(r.status)}`}>{statusLabel(r.status)}</span></td>
                      <td className="cell-muted">{fmtDateTime(r.created_at).slice(0, 10)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-sm" onClick={() => setModerate(r)}><i className="ti ti-gavel" />{s.rvModerate}</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ModerateModal review={moderate} busy={busy} lang={lang} onClose={() => setModerate(null)} onSave={(st, notes) => void submitModeration(st, notes)} />
    </div>
  );
}

function ModerateModal({
  review,
  busy,
  lang,
  onClose,
  onSave,
}: {
  review: PlatformReviewRow | null;
  busy: boolean;
  lang: string;
  onClose: () => void;
  onSave: (status: "published" | "hidden" | "rejected", notes: string) => void;
}) {
  const s = settingsStrings(lang);
  const [status, setStatus] = useState<"published" | "hidden" | "rejected">("published");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (review) {
      setStatus(review.status === "hidden" || review.status === "rejected" ? review.status : "published");
      setNotes(review.moderation_notes ?? "");
    }
  }, [review]);
  return (
    <div className={`modal-overlay ${review ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{s.rvModerateTitle}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          {review && (
            <div className="info-grid" style={{ marginBottom: 14 }}>
              <div className="info-row"><span className="info-label">{s.rvColRating}</span><span className="info-value">{review.rating} / 5</span></div>
              <div className="info-row"><span className="info-label">{s.rvColText}</span><span className="info-value">{review.review_text ?? "—"}</span></div>
            </div>
          )}
          <div className="fld" style={{ marginBottom: 12 }}>
            <label className="fld-label">{s.rvModerateStatus}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "published" | "hidden" | "rejected")}>
              <option value="published">{s.rvStatusPublished}</option>
              <option value="hidden">{s.rvStatusHidden}</option>
              <option value="rejected">{s.rvStatusRejected}</option>
            </select>
          </div>
          <div className="fld">
            <label className="fld-label">{s.rvModerateNotes}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => onSave(status, notes)}><i className="ti ti-gavel" />{s.rvModerate}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Support tickets pane (Support cluster) — list + read drawer + reply
// ════════════════════════════════════════════════════════════════

function SupportTicketsPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<SupportTicketListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [search, setSearch] = useState("");
  const [drawerId, setDrawerId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiSupportTickets(token, {
        per_page: 100,
        status: fStatus || undefined,
        priority: fPriority || undefined,
        search: search.trim() || undefined,
      });
      setRows(res.data ?? []);
    } catch (e) {
      console.error("support tickets load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, fStatus, fPriority, search]);
  useEffect(() => {
    void load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const prTone = (p: string): string => (p === "high" ? "badge-danger" : p === "medium" ? "badge-info" : "badge-gray");
  const prLabel = (p: string): string => (p === "high" ? s.stPriorityHigh : p === "medium" ? s.stPriorityMedium : p === "low" ? s.stPriorityLow : p);
  const stTone = (st: string): string => (st === "open" ? "badge-warning" : st === "pending" ? "badge-info" : st === "resolved" ? "badge-success" : "badge-gray");
  const stLabel = (st: string): string => (st === "open" ? s.stStatusOpen : st === "pending" ? s.stStatusPending : st === "resolved" ? s.stStatusResolved : st === "closed" ? s.stStatusClosed : st);

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">{s.all}</option>
            <option value="open">{s.stStatusOpen}</option>
            <option value="pending">{s.stStatusPending}</option>
            <option value="resolved">{s.stStatusResolved}</option>
            <option value="closed">{s.stStatusClosed}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.stFilterPriority}</span>
          <select value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
            <option value="">{s.all}</option>
            <option value="low">{s.stPriorityLow}</option>
            <option value="medium">{s.stPriorityMedium}</option>
            <option value="high">{s.stPriorityHigh}</option>
          </select>
        </div>
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input type="search" placeholder={s.stSearchPh} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void load()} />
        </div>
        <button className="btn" onClick={() => void load()}><i className="ti ti-filter" />{s.apply}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{s.stCardTitle}</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.stColId}</th>
                <th>{s.stColTitle}</th>
                <th>{s.stColUser}</th>
                <th>{s.stColPriority}</th>
                <th>{s.status}</th>
                <th>{s.stColCreated}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.stEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => setDrawerId(r.id)} style={{ cursor: "pointer" }}>
                    <td className="font-mono">TK-{String(r.id).padStart(4, "0")}</td>
                    <td>{r.subject}</td>
                    <td className="cell-muted">{r.user?.name ?? "—"}</td>
                    <td><span className={`badge ${prTone(r.priority)}`}>{prLabel(r.priority)}</span></td>
                    <td><span className={`badge ${stTone(r.status)}`}>{stLabel(r.status)}</span></td>
                    <td className="cell-muted">{fmtDateTime(r.created_at).slice(0, 10)}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <button className="icon-btn" onClick={() => setDrawerId(r.id)}><i className="ti ti-eye" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <TicketDrawer token={token} ticketId={drawerId} lang={lang} onClose={() => setDrawerId(null)} prTone={prTone} prLabel={prLabel} stTone={stTone} stLabel={stLabel} />
    </div>
  );
}

function TicketDrawer({
  token,
  ticketId,
  lang,
  onClose,
  prTone,
  prLabel,
  stTone,
  stLabel,
}: {
  token: string | null;
  ticketId: number | null;
  lang: string;
  onClose: () => void;
  prTone: (p: string) => string;
  prLabel: (p: string) => string;
  stTone: (st: string) => string;
  stLabel: (st: string) => string;
}) {
  const s = settingsStrings(lang);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!token || ticketId == null) return;
    setLoading(true);
    try {
      const res = await apiSupportTicket(token, ticketId);
      setDetail(res.data);
    } catch (e) {
      console.error("ticket detail failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, ticketId]);
  useEffect(() => {
    if (ticketId == null) {
      setDetail(null);
      setReply("");
      return;
    }
    void fetchDetail();
  }, [ticketId, fetchDetail]);

  async function sendReply() {
    if (!token || ticketId == null || !reply.trim()) return;
    setSending(true);
    try {
      await apiSupportTicketReply(token, ticketId, reply.trim());
      setReply("");
      await fetchDetail();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSending(false);
    }
  }

  const open = ticketId != null;
  return (
    <>
      <div className={`drawer-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer ${open ? "open" : ""}`}>
        <div className="drawer-header">
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {s.stDrawerTitle} {ticketId != null ? `TK-${String(ticketId).padStart(4, "0")}` : ""}
          </div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          {loading && !detail ? (
            <p className="cell-muted">{s.loading}</p>
          ) : detail ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{detail.subject}</div>
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.stColUser}</span><span className="info-value">{detail.user?.name ?? "—"}{detail.user?.email ? ` · ${detail.user.email}` : ""}</span></div>
                <div className="info-row"><span className="info-label">{s.stColPriority}</span><span className="info-value"><span className={`badge ${prTone(detail.priority)}`}>{prLabel(detail.priority)}</span></span></div>
                <div className="info-row"><span className="info-label">{s.status}</span><span className="info-value"><span className={`badge ${stTone(detail.status)}`}>{stLabel(detail.status)}</span></span></div>
                <div className="info-row"><span className="info-label">{s.stColCreated}</span><span className="info-value">{fmtDateTime(detail.created_at)}</span></div>
              </div>
              <div className="drawer-section">{s.stMessages}</div>
              {detail.messages.length === 0 ? (
                <p className="cell-muted text-sm">{s.stNoMessages}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {detail.messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        background: m.is_admin_reply ? "var(--primary-soft)" : "var(--bg-secondary)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        padding: "10px 12px",
                      }}
                    >
                      <div className="text-sm" style={{ fontWeight: 600, marginBottom: 3 }}>{m.is_admin_reply ? s.stSupport : (m.user?.name ?? s.stCustomer)}</div>
                      <div className="text-sm" style={{ whiteSpace: "pre-wrap" }}>{m.message}</div>
                      <div className="text-sm" style={{ color: "var(--text-tertiary)", marginTop: 4 }}>{fmtDateTime(m.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
        <div className="drawer-footer" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <textarea
            placeholder={s.stReplyPh}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            style={{ width: "100%", minHeight: 56, padding: "9px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", fontFamily: "inherit", fontSize: 13, resize: "vertical", outline: "none", color: "var(--text-primary)", background: "var(--bg-primary)" }}
          />
          <button className="btn btn-primary" disabled={sending || !reply.trim()} onClick={() => void sendReply()} style={{ alignSelf: "flex-end" }}>
            <i className="ti ti-send" />
            {s.stReply}
          </button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// Locations pane (System cluster) — countries → regions → cities cascade
// ════════════════════════════════════════════════════════════════

type LocModalState =
  | { kind: "country"; mode: "create" }
  | { kind: "country"; mode: "edit"; row: LocationCountryRow }
  | { kind: "region"; mode: "create"; countryId: number }
  | { kind: "region"; mode: "edit"; row: LocationRegionRow }
  | { kind: "city"; mode: "create"; regionId: number; countryId: number }
  | { kind: "city"; mode: "edit"; row: LocationCityRow }
  | null;

function LocationsPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [countries, setCountries] = useState<LocationCountryRow[]>([]);
  const [regions, setRegions] = useState<LocationRegionRow[]>([]);
  const [cities, setCities] = useState<LocationCityRow[]>([]);
  const [selCountry, setSelCountry] = useState<number | null>(null);
  const [selRegion, setSelRegion] = useState<number | null>(null);
  const [modal, setModal] = useState<LocModalState>(null);
  const [busy, setBusy] = useState(false);

  const loadCountries = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiLocationCountries(token);
      setCountries(res.data ?? []);
    } catch (e) {
      console.error("countries load failed", e);
    }
  }, [token]);
  useEffect(() => {
    void loadCountries();
  }, [loadCountries]);

  const loadRegions = useCallback(async (countryId: number) => {
    if (!token) return;
    try {
      const res = await apiLocationRegions(token, countryId);
      setRegions(res.data ?? []);
    } catch {
      setRegions([]);
    }
  }, [token]);

  const loadCities = useCallback(async (regionId: number) => {
    if (!token) return;
    try {
      const res = await apiLocationCities(token, regionId);
      setCities(res.data ?? []);
    } catch {
      setCities([]);
    }
  }, [token]);

  useEffect(() => {
    if (selCountry == null) {
      setRegions([]);
      setSelRegion(null);
      setCities([]);
      return;
    }
    setSelRegion(null);
    setCities([]);
    void loadRegions(selCountry);
  }, [selCountry, loadRegions]);

  useEffect(() => {
    if (selRegion == null) {
      setCities([]);
      return;
    }
    void loadCities(selRegion);
  }, [selRegion, loadCities]);

  async function del(kind: "country" | "region" | "city", id: number) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDelete)) return;
    try {
      if (kind === "country") {
        await apiLocationCountryDelete(token, id);
        if (selCountry === id) setSelCountry(null);
        await loadCountries();
      } else if (kind === "region") {
        await apiLocationRegionDelete(token, id);
        if (selRegion === id) setSelRegion(null);
        if (selCountry != null) await loadRegions(selCountry);
      } else {
        await apiLocationCityDelete(token, id);
        if (selRegion != null) await loadCities(selRegion);
      }
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }

  async function save(input: { name: string; code: string; flag: string; lat: string; lng: string; is_active: boolean }) {
    if (!token || !modal) return;
    setBusy(true);
    try {
      if (modal.kind === "country") {
        if (modal.mode === "create") await apiLocationCountryCreate(token, { name: input.name, code: input.code.toUpperCase(), flag_emoji: input.flag || null, is_active: input.is_active });
        else await apiLocationCountryUpdate(token, { id: modal.row.id, name: input.name, code: input.code.toUpperCase(), flag_emoji: input.flag || null, is_active: input.is_active });
        await loadCountries();
      } else if (modal.kind === "region") {
        const countryId = modal.mode === "create" ? modal.countryId : modal.row.country_id;
        if (modal.mode === "create") await apiLocationRegionCreate(token, { country_id: countryId, name: input.name, code: input.code || null, is_active: input.is_active });
        else await apiLocationRegionUpdate(token, { id: modal.row.id, name: input.name, code: input.code || null, is_active: input.is_active });
        await loadRegions(countryId);
      } else {
        if (modal.mode === "create") await apiLocationCityCreate(token, { region_id: modal.regionId, country_id: modal.countryId, name: input.name, latitude: input.lat ? Number(input.lat) : null, longitude: input.lng ? Number(input.lng) : null, is_active: input.is_active });
        else await apiLocationCityUpdate(token, { id: modal.row.id, name: input.name, latitude: input.lat ? Number(input.lat) : null, longitude: input.lng ? Number(input.lng) : null, is_active: input.is_active });
        if (selRegion != null) await loadCities(selRegion);
      }
      setModal(null);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const selCountryName = countries.find((c) => c.id === selCountry)?.name ?? "";
  const selRegionName = regions.find((r) => r.id === selRegion)?.name ?? "";

  return (
    <div>
      <div className="tri-col">
        {/* Countries */}
        <div className="tri-pane">
          <div className="tri-head">
            <span>{s.locCountries}</span>
            <button className="icon-btn" title={s.locAddCountry} onClick={() => setModal({ kind: "country", mode: "create" })}><i className="ti ti-plus" /></button>
          </div>
          <div className="tri-list">
            {countries.length === 0 ? <div className="tri-empty">—</div> : countries.map((c) => (
              <div key={c.id} className={`tri-row ${selCountry === c.id ? "sel" : ""}`} onClick={() => setSelCountry(c.id)}>
                <span>{c.flag_emoji ? `${c.flag_emoji} ` : ""}{c.name}<span className="tri-sub">{c.code}</span></span>
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => setModal({ kind: "country", mode: "edit", row: c })}><i className="ti ti-edit" /></button>
                  <button className="icon-btn danger" onClick={() => void del("country", c.id)}><i className="ti ti-trash" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Regions */}
        <div className="tri-pane">
          <div className="tri-head">
            <span>{s.locRegions}{selCountryName ? <span className="cell-muted" style={{ fontWeight: 400 }}> · {selCountryName}</span> : null}</span>
            {selCountry != null && <button className="icon-btn" title={s.locAddRegion} onClick={() => setModal({ kind: "region", mode: "create", countryId: selCountry })}><i className="ti ti-plus" /></button>}
          </div>
          <div className="tri-list">
            {selCountry == null ? <div className="tri-empty">{s.locPickCountry}</div> : regions.length === 0 ? <div className="tri-empty">{s.locNoRegions}</div> : regions.map((r) => (
              <div key={r.id} className={`tri-row ${selRegion === r.id ? "sel" : ""}`} onClick={() => setSelRegion(r.id)}>
                <span>{r.name}{r.code ? <span className="tri-sub">{r.code}</span> : null}</span>
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => setModal({ kind: "region", mode: "edit", row: r })}><i className="ti ti-edit" /></button>
                  <button className="icon-btn danger" onClick={() => void del("region", r.id)}><i className="ti ti-trash" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Cities */}
        <div className="tri-pane">
          <div className="tri-head">
            <span>{s.locCities}{selRegionName ? <span className="cell-muted" style={{ fontWeight: 400 }}> · {selRegionName}</span> : null}</span>
            {selRegion != null && selCountry != null && <button className="icon-btn" title={s.locAddCity} onClick={() => setModal({ kind: "city", mode: "create", regionId: selRegion, countryId: selCountry })}><i className="ti ti-plus" /></button>}
          </div>
          <div className="tri-list">
            {selRegion == null ? <div className="tri-empty">{s.locPickRegion}</div> : cities.length === 0 ? <div className="tri-empty">{s.locNoCities}</div> : cities.map((c) => (
              <div key={c.id} className="tri-row">
                <span>{c.name}{c.latitude != null && c.longitude != null ? <span className="tri-sub">{c.latitude}, {c.longitude}</span> : null}</span>
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => setModal({ kind: "city", mode: "edit", row: c })}><i className="ti ti-edit" /></button>
                  <button className="icon-btn danger" onClick={() => void del("city", c.id)}><i className="ti ti-trash" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <LocationModal state={modal} busy={busy} lang={lang} onClose={() => setModal(null)} onSave={(input) => void save(input)} />
    </div>
  );
}

function LocationModal({
  state,
  busy,
  lang,
  onClose,
  onSave,
}: {
  state: LocModalState;
  busy: boolean;
  lang: string;
  onClose: () => void;
  onSave: (input: { name: string; code: string; flag: string; lat: string; lng: string; is_active: boolean }) => void;
}) {
  const s = settingsStrings(lang);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [flag, setFlag] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [active, setActive] = useState(true);
  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setName(state.row.name);
      setActive(state.row.is_active !== false);
      if (state.kind === "country") {
        setCode(state.row.code);
        setFlag(state.row.flag_emoji ?? "");
        setLat("");
        setLng("");
      } else if (state.kind === "region") {
        setCode(state.row.code ?? "");
        setFlag("");
        setLat("");
        setLng("");
      } else {
        setCode("");
        setFlag("");
        setLat(state.row.latitude != null ? String(state.row.latitude) : "");
        setLng(state.row.longitude != null ? String(state.row.longitude) : "");
      }
    } else {
      setName("");
      setCode("");
      setFlag("");
      setLat("");
      setLng("");
      setActive(true);
    }
  }, [state]);

  const kind = state?.kind;
  const title = !state
    ? ""
    : state.mode === "create"
    ? (kind === "country" ? s.locAddCountry : kind === "region" ? s.locAddRegion : s.locAddCity)
    : (kind === "country" ? s.locEditCountry : kind === "region" ? s.locEditRegion : s.locEditCity);
  const valid = name.trim() !== "" && (kind !== "country" || code.trim().length >= 2);

  return (
    <div className={`modal-overlay ${state ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fld span-2"><label className="fld-label">{s.locFldName}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            {(kind === "country" || kind === "region") && (
              <div className="fld"><label className="fld-label">{s.locFldCode}</label><input value={code} onChange={(e) => setCode(e.target.value)} style={kind === "country" ? { textTransform: "uppercase" } : undefined} /></div>
            )}
            {kind === "country" && (
              <div className="fld"><label className="fld-label">{s.locFldFlag}</label><input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="🇦🇲" /></div>
            )}
            {kind === "city" && (
              <>
                <div className="fld"><label className="fld-label">{s.locFldLat}</label><input type="number" step="0.000001" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
                <div className="fld"><label className="fld-label">{s.locFldLng}</label><input type="number" step="0.000001" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
              </>
            )}
            <div className="fld" style={{ justifyContent: "flex-end" }}>
              <label className="switch-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{s.active}</label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => onSave({ name, code, flag, lat, lng, is_active: active })}><i className="ti ti-device-floppy" />{state?.mode === "edit" ? s.save : s.create}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Languages pane (Localization cluster) — list + CRUD + set-default + scan
// ════════════════════════════════════════════════════════════════

const LANG_FLAG: Record<string, string> = {
  en: "🇬🇧", hy: "🇦🇲", ru: "🇷🇺", fr: "🇫🇷", de: "🇩🇪", es: "🇪🇸", it: "🇮🇹",
  ar: "🇸🇦", zh: "🇨🇳", ka: "🇬🇪", tr: "🇹🇷", fa: "🇮🇷", uk: "🇺🇦", pt: "🇵🇹", pl: "🇵🇱",
};

function LanguagesPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<LocalizationLanguageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; row: LocalizationLanguageRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiAdminLanguages(token);
      setRows((res.data ?? []).slice().sort((a, b) => a.sort_order - b.sort_order));
    } catch (e) {
      console.error("languages load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  async function setDefault(row: LocalizationLanguageRow) {
    if (!token || row.is_default) return;
    try {
      await apiSetDefaultLanguage(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }
  async function del(row: LocalizationLanguageRow) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDelete)) return;
    try {
      await apiLocalizationDeleteLanguage(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }
  async function scan() {
    if (!token) return;
    setScanning(true);
    try {
      await apiLocalizationScan(token, {});
      alert(s.lgScanDone);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setScanning(false);
    }
  }
  async function save(input: { code: string; name: string; name_en: string; rtl: boolean }) {
    if (!token || !modal) return;
    setBusy(true);
    try {
      if (modal.mode === "create") await apiLocalizationCreateLanguage(token, { code: input.code.toLowerCase(), name: input.name, name_en: input.name_en });
      else await apiEditLanguage(token, modal.row.id, { name: input.name, name_en: input.name_en, rtl: input.rtl });
      setModal(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">{s.lgCardTitle}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" disabled={scanning} onClick={() => void scan()}><i className="ti ti-radar-2" />{s.lgScan}</button>
            <button className="btn btn-sm btn-primary" onClick={() => setModal({ mode: "create" })}><i className="ti ti-plus" />{s.lgNewLang}</button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.lgColFlag}</th>
                <th>{s.lgColCode}</th>
                <th>{s.lgColName}</th>
                <th>{s.lgColDefault}</th>
                <th>{s.status}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.lgEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 18 }}>{LANG_FLAG[r.code] ?? "🌐"}</td>
                    <td className="font-mono">{r.code}</td>
                    <td>{r.name}{r.name_en && r.name_en !== r.name ? <span className="cell-muted"> · {r.name_en}</span> : null}</td>
                    <td>
                      <label className="switch" style={{ cursor: r.is_default ? "default" : "pointer" }}>
                        <input type="checkbox" checked={r.is_default} disabled={r.is_default} onChange={() => void setDefault(r)} />
                        <span className="switch-slider" />
                      </label>
                    </td>
                    <td><span className={`badge ${r.is_enabled !== false ? "badge-success" : "badge-gray"}`}>{r.is_enabled !== false ? s.statusActive : s.statusInactive}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button className="icon-btn" title={s.edit} onClick={() => setModal({ mode: "edit", row: r })}><i className="ti ti-edit" /></button>
                        <button className="icon-btn danger" title={s.delete} disabled={r.is_default} onClick={() => void del(r)}><i className="ti ti-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <LanguageModal state={modal} busy={busy} lang={lang} onClose={() => setModal(null)} onSave={(input) => void save(input)} />
    </div>
  );
}

function LanguageModal({
  state,
  busy,
  lang,
  onClose,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; row: LocalizationLanguageRow } | null;
  busy: boolean;
  lang: string;
  onClose: () => void;
  onSave: (input: { code: string; name: string; name_en: string; rtl: boolean }) => void;
}) {
  const s = settingsStrings(lang);
  const isEdit = state?.mode === "edit";
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [rtl, setRtl] = useState(false);
  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setCode(state.row.code);
      setName(state.row.name);
      setNameEn(state.row.name_en ?? "");
      setRtl(state.row.rtl === true);
    } else {
      setCode("");
      setName("");
      setNameEn("");
      setRtl(false);
    }
  }, [state]);
  const valid = name.trim() !== "" && nameEn.trim() !== "" && (isEdit || code.trim().length >= 2);
  return (
    <div className={`modal-overlay ${state ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? s.lgEditTitle : s.lgAddTitle}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.lgFldCode}</label><input value={code} maxLength={5} disabled={isEdit} onChange={(e) => setCode(e.target.value)} style={{ textTransform: "lowercase" }} /></div>
            <div className="fld"><label className="fld-label">{s.lgFldName}</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.lgFldNameEn}</label><input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
            <div className="fld" style={{ justifyContent: "flex-end" }}>
              <label className="switch-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={rtl} onChange={(e) => setRtl(e.target.checked)} />{s.lgFldRtl}</label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => onSave({ code, name, name_en: nameEn, rtl })}><i className="ti ti-device-floppy" />{isEdit ? s.save : s.create}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// UI strings pane (Localization cluster) — paginated key/value editor
// ════════════════════════════════════════════════════════════════

function UiStringsPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [langs, setLangs] = useState<LocalizationLanguageRow[]>([]);
  const [selLang, setSelLang] = useState("en");
  const [rows, setRows] = useState<UiTranslationRow[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; per_page: number; current_page: number; last_page: number } | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    void apiAdminLanguages(token)
      .then((r) => setLangs((r.data ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)))
      .catch(() => {});
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiUiTranslationsGetAdmin(token, { lang: selLang, page, per_page: 50, search: search.trim() || undefined });
      setRows(res.data.data);
      setMeta({ total: res.data.total, per_page: res.data.per_page, current_page: res.data.current_page, last_page: res.data.last_page });
    } catch (e) {
      console.error("ui strings load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, selLang, page, search]);
  useEffect(() => {
    setEdited({});
  }, [selLang]);
  useEffect(() => {
    void load();
  }, [token, selLang, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAll() {
    if (!token || Object.keys(edited).length === 0) return;
    setSaving(true);
    try {
      await apiUiTranslationsSave(token, { language_code: selLang, translations: edited });
      setEdited({});
      alert(s.uiSaved);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  const dirty = Object.keys(edited).length;

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.uiLanguage}</span>
          <select value={selLang} onChange={(e) => { setPage(1); setSelLang(e.target.value); }}>
            {langs.length === 0 ? <option value="en">English (en)</option> : langs.map((l) => <option key={l.id} value={l.code}>{l.name} ({l.code})</option>)}
          </select>
        </div>
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input type="search" placeholder={s.uiSearchPh} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(); } }} />
        </div>
        <button className="btn" onClick={() => { setPage(1); void load(); }}><i className="ti ti-filter" />{s.apply}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">{s.uiCardTitle}</div>
          <button className="btn btn-sm btn-primary" disabled={saving || dirty === 0} onClick={() => void saveAll()}><i className="ti ti-device-floppy" />{s.uiSaveAll}{dirty > 0 ? ` (${dirty})` : ""}</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>{s.uiColKey}</th>
                <th>{s.uiColTranslation}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={2} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={2} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.uiEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.key}>
                    <td className="font-mono text-sm">{r.key}</td>
                    <td>
                      <input
                        value={edited[r.key] ?? r.value}
                        onChange={(e) => setEdited((prev) => ({ ...prev, [r.key]: e.target.value }))}
                        style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", fontFamily: "inherit", fontSize: 13, outline: "none", color: "var(--text-primary)", background: "var(--bg-primary)" }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <div className="pagination-info">{(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} / {meta.total}</div>
            <div className="pagination-controls">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="ti ti-chevron-left" /></button>
              <button className="icon-btn" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Content translations pane (Localization cluster) — load entity → edit fields
// ════════════════════════════════════════════════════════════════

function ContentTrPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [langs, setLangs] = useState<LocalizationLanguageRow[]>([]);
  const [entityType, setEntityType] = useState<string>("package");
  const [entityId, setEntityId] = useState("");
  const [selLang, setSelLang] = useState("hy");
  const [fields, setFields] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    void apiAdminLanguages(token).then((r) => setLangs((r.data ?? []).slice().sort((a, b) => a.sort_order - b.sort_order))).catch(() => {});
  }, [token]);

  const entLabel = (t: string): string => {
    const map: Record<string, SettingsKey> = { hotel: "svcHotel", flight: "svcFlight", transfer: "svcTransfer", car: "svcCar", excursion: "svcExcursion", visa: "svcVisa", package: "svcPackage", offer: "ctEntOffer", company: "ctEntCompany" };
    return map[t] ? s[map[t]] : t;
  };

  async function load() {
    if (!token || !entityId.trim()) return;
    setLoading(true);
    try {
      const res = await apiLocalizationTranslationsGet(token, { entity_type: entityType, entity_id: Number(entityId), lang: selLang, fields: LOCALIZATION_TRANSLATABLE_FIELDS });
      const t: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.data.translations ?? {})) t[k] = v ?? "";
      setFields(t);
    } catch (e) {
      // 404 = no translations saved yet for this entity/lang → start blank (create-new).
      if (!(e instanceof ApiRequestError && e.status === 404)) console.error("content-tr load failed", e);
      setFields({});
    } finally {
      setLoading(false);
    }
  }
  async function save() {
    if (!token || !fields) return;
    setSaving(true);
    try {
      await apiLocalizationTranslationsSet(token, { entity_type: entityType, entity_id: Number(entityId), language_code: selLang, translations: fields });
      alert(s.ctSaved);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.ctEntityType}</span>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            {LOCALIZATION_ENTITY_TYPES.map((t) => <option key={t} value={t}>{entLabel(t)}</option>)}
          </select>
        </div>
        <div className="filter-field"><span className="filter-label">{s.ctEntityId}</span><input type="number" value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="10482" /></div>
        <div className="filter-field">
          <span className="filter-label">{s.uiLanguage}</span>
          <select value={selLang} onChange={(e) => setSelLang(e.target.value)}>
            {langs.length === 0 ? <option value="hy">Հայերեն (hy)</option> : langs.map((l) => <option key={l.id} value={l.code}>{l.name} ({l.code})</option>)}
          </select>
        </div>
        <button className="btn btn-primary" disabled={!entityId.trim() || loading} onClick={() => void load()}><i className="ti ti-arrow-down-circle" />{s.loadBtn}</button>
      </div>
      {fields === null ? (
        <div className="card"><div className="empty-state"><i className="ti ti-language" />{s.ctLoadPrompt}</div></div>
      ) : (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">{entLabel(entityType)} #{entityId} · {selLang}</div></div>
          <div className="card-body">
            <div className="form-grid">
              {Object.keys(fields).length === 0 ? (
                <div className="cell-muted" style={{ gridColumn: "1 / -1" }}>—</div>
              ) : Object.entries(fields).map(([k, v]) => (
                <div key={k} className="fld span-2">
                  <label className="fld-label">{k}</label>
                  {k.includes("description") || k.includes("highlights") || k.includes("summary") || k.includes("notes") ? (
                    <textarea value={v} onChange={(e) => setFields((p) => ({ ...(p ?? {}), [k]: e.target.value }))} />
                  ) : (
                    <input value={v} onChange={(e) => setFields((p) => ({ ...(p ?? {}), [k]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="card-foot">
            <button className="btn btn-primary" disabled={saving} onClick={() => void save()}><i className="ti ti-device-floppy" />{s.save}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Email templates pane (Localization cluster) — event/channel/lang → title/body
// ════════════════════════════════════════════════════════════════

const EMAIL_CHANNELS = ["email", "in_app", "sms"];

function EmailTplPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [langs, setLangs] = useState<LocalizationLanguageRow[]>([]);
  const [event, setEvent] = useState<string>(NOTIFICATION_TEMPLATE_EVENTS[0]);
  const [channel, setChannel] = useState("email");
  const [selLang, setSelLang] = useState("en");
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    void apiAdminLanguages(token).then((r) => setLangs((r.data ?? []).slice().sort((a, b) => a.sort_order - b.sort_order))).catch(() => {});
  }, [token]);

  const chLabel = (c: string): string => (c === "email" ? s.etChEmail : c === "in_app" ? s.etChInApp : c === "sms" ? s.etChSms : c);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiLocalizationTemplateGet(token, event, { lang: selLang, channel });
      setTitle(res.data.title_template ?? "");
      setBody(res.data.body_template ?? "");
      setActive(res.data.is_active !== false);
      setLoaded(true);
    } catch (e) {
      // 404 = no template saved yet for this event/channel/lang → start blank (create-new).
      if (!(e instanceof ApiRequestError && e.status === 404)) console.error("template load failed", e);
      setTitle("");
      setBody("");
      setActive(true);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }
  async function save() {
    if (!token) return;
    setSaving(true);
    try {
      await apiLocalizationTemplatePatch(token, event, { lang: selLang, channel, title_template: title, body_template: body, is_active: active });
      alert(s.etSaved);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.etEvent}</span>
          <select value={event} onChange={(e) => setEvent(e.target.value)}>{NOTIFICATION_TEMPLATE_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}</select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.etChannel}</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>{EMAIL_CHANNELS.map((c) => <option key={c} value={c}>{chLabel(c)}</option>)}</select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.uiLanguage}</span>
          <select value={selLang} onChange={(e) => setSelLang(e.target.value)}>{langs.length === 0 ? <option value="en">English (en)</option> : langs.map((l) => <option key={l.id} value={l.code}>{l.name} ({l.code})</option>)}</select>
        </div>
        <button className="btn btn-primary" disabled={loading} onClick={() => void load()}><i className="ti ti-arrow-down-circle" />{s.loadBtn}</button>
      </div>
      {!loaded ? (
        <div className="card"><div className="empty-state"><i className="ti ti-mail" />{s.etLoadPrompt}</div></div>
      ) : (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">{event} · {chLabel(channel)} · {selLang}</div></div>
          <div className="card-body">
            <div className="form-grid">
              <div className="fld span-2"><label className="fld-label">{s.etFldTitle}</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="fld span-2"><label className="fld-label">{s.etFldBody}</label><textarea value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 140 }} /></div>
              <div className="fld span-2"><label className="switch-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{s.etFldActive}</label></div>
            </div>
          </div>
          <div className="card-foot">
            <button className="btn btn-primary" disabled={saving} onClick={() => void save()}><i className="ti ti-device-floppy" />{s.save}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CMS pages pane (Content cluster) — list + create modal + status toggle
// ════════════════════════════════════════════════════════════════

function slugifyPage(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function CmsPagesPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const router = useRouter();
  const [rows, setRows] = useState<AdminPageRow[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; per_page: number; total: number; last_page: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modal, setModal] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiAdminPages(token, { page });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      console.error("cms pages load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, page]);
  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(row: AdminPageRow) {
    if (!token) return;
    setBusyId(row.id);
    try {
      await apiPatchAdminPageStatus(token, { page_id: row.id, status: row.status === 1 ? 0 : 1 });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusyId(null);
    }
  }
  async function del(row: AdminPageRow) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDelete)) return;
    setBusyId(row.id);
    try {
      await apiDeleteAdminPage(token, row.id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="filter-card">
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={rows.length === 0} onClick={() => exportRowsAsCsv("cms-pages", rows, [
          ["id", (r) => r.id],
          ["page_name", (r) => r.page_name],
          ["page_slug", (r) => r.page_slug],
          ["status", (r) => r.status],
          ["created_at", (r) => r.created_at ?? ""],
        ])}><i className="ti ti-download" />{s.exportBtn}</button>
        <button className="btn btn-primary" onClick={() => setModal(true)}><i className="ti ti-plus" />{s.cmNewPage}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{s.cmCardTitle}</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.cmColName}</th>
                <th>{s.cmColSlug}</th>
                <th>{s.status}</th>
                <th>{s.cmColCreated}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.cmEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.page_name}</td>
                    <td className="font-mono cell-muted">/{r.page_slug}</td>
                    <td>
                      <label className="switch" style={{ cursor: "pointer" }}>
                        <input type="checkbox" checked={r.status === 1} disabled={busyId === r.id} onChange={() => void toggleStatus(r)} />
                        <span className="switch-slider" />
                      </label>
                    </td>
                    <td className="cell-muted">{fmtDateTime(r.created_at).slice(0, 10)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button className="icon-btn" title={s.cmView} onClick={() => router.push(`/pages/${r.id}/edit?mode=view`)}><i className="ti ti-eye" /></button>
                        <button className="icon-btn" title={s.edit} onClick={() => router.push(`/pages/${r.id}/edit`)}><i className="ti ti-edit" /></button>
                        <button className="icon-btn danger" title={s.delete} disabled={busyId === r.id} onClick={() => void del(r)}><i className="ti ti-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <div className="pagination-info">{(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} / {meta.total}</div>
            <div className="pagination-controls">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="ti ti-chevron-left" /></button>
              <button className="icon-btn" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>
      <CmsPageModal open={modal} token={token} lang={lang} onClose={() => setModal(false)} onCreated={() => { setModal(false); setPage(1); void load(); }} />
    </div>
  );
}

function CmsPageModal({
  open,
  token,
  lang,
  onClose,
  onCreated,
}: {
  open: boolean;
  token: string | null;
  lang: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const s = settingsStrings(lang);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setSlugTouched(false);
      setBusy(false);
    }
  }, [open]);
  useEffect(() => {
    if (!slugTouched) setSlug(slugifyPage(name));
  }, [name, slugTouched]);

  async function submit() {
    if (!token || !name.trim() || !slug.trim()) return;
    setBusy(true);
    try {
      await apiCreateAdminPage(token, { page_name: name.trim(), page_slug: slug.trim() });
      onCreated();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`modal-overlay ${open ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{s.cmAddTitle}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fld span-2"><label className="fld-label">{s.cmFldName}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Home Page" /></div>
            <div className="fld span-2"><label className="fld-label">{s.cmFldSlug}</label><input className="font-mono" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugifyPage(e.target.value)); }} placeholder="home-page" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || !name.trim() || !slug.trim()} onClick={() => void submit()}><i className="ti ti-device-floppy" />{s.create}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Banners pane (Content cluster) — list + image CRUD + reorder + bulk delete
// ════════════════════════════════════════════════════════════════

function resolveBannerSrc(u?: string | null): string | null {
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const origin = getApiPublicOrigin().replace(/\/$/, "");
  return u.startsWith("/") ? `${origin}${u}` : `${origin}/${u}`;
}

type BannerModalState = { mode: "create" } | { mode: "edit"; row: PlatformBannerRow } | null;

function BannersPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<PlatformBannerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [modal, setModal] = useState<BannerModalState>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiPlatformBanners(token);
      setRows(res.data ?? []);
    } catch (e) {
      console.error("banners load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(input: { file: File | null; title_en: string; title_ru: string; title_hy: string; link: string; sort: string }) {
    if (!token) return;
    const fd = new FormData();
    if (input.file) fd.append("image", input.file);
    fd.append("title_en", input.title_en);
    fd.append("title_ru", input.title_ru);
    fd.append("title_hy", input.title_hy);
    if (input.link.trim()) fd.append("link_url", input.link.trim());
    fd.append("sort_order", String(parseInt(input.sort, 10) || 0));
    try {
      if (modal?.mode === "edit") await apiUpdatePlatformBanner(token, modal.row.id, fd);
      else await apiCreatePlatformBanner(token, fd);
      setModal(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    }
  }
  async function del(id: number) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.confirmDelete)) return;
    setBusyId(id);
    try {
      await apiDeletePlatformBanner(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusyId(null);
    }
  }
  async function move(id: number, dir: "up" | "down") {
    if (!token) return;
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= rows.length) return;
    const next = rows.slice();
    const a = next[idx];
    const b = next[swap];
    if (!a || !b) return;
    next[idx] = b;
    next[swap] = a;
    setRows(next);
    try {
      await apiReorderBanners(token, next.map((r) => r.id));
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
      await load();
    }
  }
  function toggleSel(id: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const all = rows.map((r) => r.id);
      return all.every((id) => prev.has(id)) ? new Set<number>() : new Set(all);
    });
  }
  async function bulkDelete() {
    if (!token || selected.size === 0) return;
    if (typeof window !== "undefined" && !window.confirm(s.bnConfirmBulk)) return;
    setBulkBusy(true);
    try {
      await apiBulkDeleteBanners(token, Array.from(selected));
      setSelected(new Set());
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div>
      <div className="filter-card">
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={rows.length === 0} onClick={() => exportRowsAsCsv("banners", rows, [
          ["id", (r) => r.id],
          ["sort_order", (r) => r.sort_order],
          ["is_active", (r) => (r.is_active ? "1" : "0")],
          ["title_en", (r) => r.title_en ?? ""],
          ["title_ru", (r) => r.title_ru ?? ""],
          ["title_hy", (r) => r.title_hy ?? ""],
          ["link_url", (r) => r.link_url ?? ""],
        ])}><i className="ti ti-download" />{s.exportBtn}</button>
        {selected.size > 0 && (
          <button className="btn btn-danger" disabled={bulkBusy} onClick={() => void bulkDelete()}>
            <i className="ti ti-trash" />{s.bnBulkDelete.replace("{n}", String(selected.size))}
          </button>
        )}
        <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}><i className="ti ti-plus" />{s.bnNewBanner}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{s.bnCardTitle}</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}><input type="checkbox" aria-label={s.all} checked={rows.length > 0 && rows.every((r) => selected.has(r.id))} onChange={toggleAll} /></th>
                <th>{s.bnColPreview}</th>
                <th>{s.bnColTitles}</th>
                <th>{s.bnColLink}</th>
                <th>{s.bnColSort}</th>
                <th>{s.status}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.bnEmpty}</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const src = resolveBannerSrc(r.image_url);
                  return (
                    <tr key={r.id}>
                      <td><input type="checkbox" aria-label={`#${r.id}`} checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <button className="icon-btn" title={s.bnMoveUp} disabled={idx === 0} onClick={() => void move(r.id, "up")} style={{ height: 18, width: 18 }}><i className="ti ti-chevron-up" style={{ fontSize: 13 }} /></button>
                            <button className="icon-btn" title={s.bnMoveDown} disabled={idx === rows.length - 1} onClick={() => void move(r.id, "down")} style={{ height: 18, width: 18 }}><i className="ti ti-chevron-down" style={{ fontSize: 13 }} /></button>
                          </div>
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt={r.title_en ?? `#${r.id}`} style={{ height: 40, width: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border-color)" }} />
                          ) : (
                            <span className="cell-muted">—</span>
                          )}
                        </div>
                      </td>
                      <td className="text-sm">
                        <div>EN: {r.title_en ?? "—"}</div>
                        <div className="cell-muted">RU: {r.title_ru ?? "—"} · HY: {r.title_hy ?? "—"}</div>
                      </td>
                      <td className="cell-muted text-sm" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.link_url ?? "—"}</td>
                      <td className="num-cell">{r.sort_order}</td>
                      <td><span className={`badge ${r.is_active ? "badge-success" : "badge-gray"}`}>{r.is_active ? s.statusActive : s.statusInactive}</span></td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions">
                          <button className="icon-btn" title={s.edit} onClick={() => setModal({ mode: "edit", row: r })}><i className="ti ti-edit" /></button>
                          <button className="icon-btn danger" title={s.delete} disabled={busyId === r.id} onClick={() => void del(r.id)}><i className="ti ti-trash" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <BannerModal state={modal} lang={lang} onClose={() => setModal(null)} onSave={(input) => void save(input)} />
    </div>
  );
}

function BannerModal({
  state,
  lang,
  onClose,
  onSave,
}: {
  state: BannerModalState;
  lang: string;
  onClose: () => void;
  onSave: (input: { file: File | null; title_en: string; title_ru: string; title_hy: string; link: string; sort: string }) => void;
}) {
  const s = settingsStrings(lang);
  const isEdit = state?.mode === "edit";
  const [file, setFile] = useState<File | null>(null);
  const [en, setEn] = useState("");
  const [ru, setRu] = useState("");
  const [hy, setHy] = useState("");
  const [link, setLink] = useState("");
  const [sort, setSort] = useState("0");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!state) return;
    setFile(null);
    setBusy(false);
    if (state.mode === "edit") {
      setEn(state.row.title_en ?? "");
      setRu(state.row.title_ru ?? "");
      setHy(state.row.title_hy ?? "");
      setLink(state.row.link_url ?? "");
      setSort(String(state.row.sort_order ?? 0));
    } else {
      setEn("");
      setRu("");
      setHy("");
      setLink("");
      setSort("0");
    }
  }, [state]);

  const valid = isEdit || file != null;
  const previewSrc = isEdit && state?.mode === "edit" ? resolveBannerSrc(state.row.image_url) : null;
  async function submit() {
    setBusy(true);
    await onSave({ file, title_en: en, title_ru: ru, title_hy: hy, link, sort });
    setBusy(false);
  }

  return (
    <div className={`modal-overlay ${state ? "open" : ""}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? s.bnEditTitle : s.bnCreateTitle}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fld span-2">
              <label className="fld-label">{isEdit ? s.bnFldImageOpt : s.bnFldImageReq}</label>
              <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {previewSrc && !file ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewSrc} alt="" style={{ marginTop: 8, height: 56, borderRadius: 6, border: "1px solid var(--border-color)" }} />
              ) : null}
            </div>
            <div className="fld"><label className="fld-label">{s.bnFldTitleEn}</label><input value={en} onChange={(e) => setEn(e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.bnFldTitleRu}</label><input value={ru} onChange={(e) => setRu(e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.bnFldTitleHy}</label><input value={hy} onChange={(e) => setHy(e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.bnFldSort}</label><input type="number" value={sort} onChange={(e) => setSort(e.target.value)} /></div>
            <div className="fld span-2"><label className="fld-label">{s.bnFldLink}</label><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => void submit()}><i className="ti ti-device-floppy" />{isEdit ? s.save : s.create}</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// System notifications pane (Content cluster) — read-only registry
// ════════════════════════════════════════════════════════════════

const NOTIF_EVENT_TYPES = [
  "package_order.created", "package_order.paid", "package_order.confirmed",
  "package_order.partially_confirmed", "package_order.partially_failed", "package_order.cancelled",
  "order.confirmed", "order.cancelled", "order.paid", "order.fulfilled",
  "payment.succeeded", "payment.failed", "voucher.issued", "voucher.voided", "voucher.reissued",
  "account.welcome", "account.password_reset",
];
const NOTIF_PRIORITIES = ["low", "normal", "high", "critical"];
const NOTIF_STATUSES = ["unread", "read"];

// ── Admin notices (Settings → System notifications CUD, roadmap §4) ──────
type NoticeDraft = {
  id: number | null;
  title: string;
  message: string;
  type: AdminNoticeRow["type"];
  audience: AdminNoticeRow["audience"];
  company_id: string;
  channels: string[];
  priority: AdminNoticeRow["priority"];
  scheduled_for: string;
};

const EMPTY_NOTICE: NoticeDraft = {
  id: null,
  title: "",
  message: "",
  type: "announcement",
  audience: "everyone",
  company_id: "",
  channels: ["in_app"],
  priority: "normal",
  scheduled_for: "",
};

/** ISO timestamp → the local-time string a datetime-local input expects. */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NoticesSection({ token, lang }: { token: string; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<AdminNoticeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoticeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiAdminNotices(token);
      setRows(res.data ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const typeTone = (t: string): string =>
    t === "maintenance" ? "badge-warning" : t === "announcement" ? "badge-info" : "badge-gray";
  const typeLabel = (t: string): string =>
    t === "maintenance" ? s.snTypeMaintenance : t === "announcement" ? s.snTypeAnnouncement : s.snTypeInfo;
  const audLabel = (n: AdminNoticeRow): string =>
    n.audience === "everyone" ? s.snAudEveryone
      : n.audience === "all_b2c" ? s.snAudB2c
        : n.audience === "all_staff" ? s.snAudStaff
          : n.company ? n.company.name : s.snAudCompany;
  const statusTone = (st: string): string =>
    st === "sent" ? "badge-success" : st === "scheduled" ? "badge-info" : st === "paused" ? "badge-warning" : "badge-gray";
  const statusLabel = (st: string): string =>
    st === "sent" ? s.snStSent : st === "scheduled" ? s.snStScheduled : st === "paused" ? s.snStPaused : s.snStDraft;

  const openCreate = () => setDraft({ ...EMPTY_NOTICE });
  const openEdit = (n: AdminNoticeRow) =>
    setDraft({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      audience: n.audience,
      company_id: n.company ? String(n.company.id) : "",
      channels: n.channels,
      priority: n.priority,
      scheduled_for: n.scheduled_for ? isoToLocalInput(n.scheduled_for) : "",
    });

  const draftPayload = (d: NoticeDraft, sendNow: boolean): AdminNoticePayload => ({
    title: d.title.trim(),
    message: d.message.trim(),
    type: d.type,
    audience: d.audience,
    company_id: d.audience === "by_company" && d.company_id.trim() !== "" ? Number(d.company_id) : null,
    channels: d.channels.length > 0 ? d.channels : ["in_app"],
    priority: d.priority,
    // datetime-local is the ADMIN'S local wall-clock — send a real ISO
    // timestamp so the backend doesn't read 10:00 Yerevan as 10:00 UTC.
    scheduled_for: d.scheduled_for.trim() !== "" ? new Date(d.scheduled_for).toISOString() : null,
    ...(sendNow ? { send_now: true } : {}),
  });

  const save = async (sendNow: boolean) => {
    if (!draft) return;
    setSaving(true);
    setErr(null);
    try {
      if (draft.id != null) {
        await apiAdminNoticeUpdate(token, draft.id, draftPayload(draft, false));
        if (sendNow) await apiAdminNoticeSend(token, draft.id);
      } else {
        await apiAdminNoticeCreate(token, draftPayload(draft, sendNow));
      }
      flash(sendNow ? s.snNoticeSentToast : s.snNoticeSavedToast);
      setDraft(null);
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const sendRow = async (n: AdminNoticeRow) => {
    if (!window.confirm(s.snConfirmSendNotice)) return;
    setBusyId(n.id);
    setErr(null);
    try {
      await apiAdminNoticeSend(token, n.id);
      flash(s.snNoticeSentToast);
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (n: AdminNoticeRow) => {
    setBusyId(n.id);
    setErr(null);
    try {
      await apiAdminNoticeUpdate(token, n.id, { is_active: !n.is_active });
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const removeRow = async (n: AdminNoticeRow) => {
    if (!window.confirm(s.snConfirmDeleteNotice)) return;
    setBusyId(n.id);
    setErr(null);
    try {
      await apiAdminNoticeDelete(token, n.id);
      flash(s.snNoticeDeletedToast);
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleChannel = (ch: string) => {
    setDraft((d) => {
      if (!d) return d;
      const has = d.channels.includes(ch);
      return { ...d, channels: has ? d.channels.filter((c) => c !== ch) : [...d.channels, ch] };
    });
  };

  const CHANNEL_OPTIONS: { value: string; label: string }[] = [
    { value: "in_app", label: s.snChInApp },
    { value: "email", label: s.snChEmail },
    { value: "sms", label: s.snChSms },
    { value: "push", label: s.snChPush },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{s.snNoticesTitle}</div>
          <div className="card-subtitle">{s.snNoticesSub}</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <i className="ti ti-plus" />{s.snNewNotice}
        </button>
      </div>
      {toast ? <div className="alert" style={{ margin: "0 16px" }}><i className="ti ti-check" /><div>{toast}</div></div> : null}
      {err ? <div style={{ color: "var(--danger)", padding: "8px 16px" }}>{err}</div> : null}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{s.snColMessage}</th>
              <th>{s.snColType}</th>
              <th>{s.snColAudience}</th>
              <th>{s.status}</th>
              <th>{s.snColActive}</th>
              <th>{s.snColScheduled}</th>
              <th style={{ textAlign: "right" }}>{s.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 24 }}>{s.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 24 }}>{s.snNoticesEmpty}</td></tr>
            ) : (
              rows.map((n) => (
                <tr key={n.id}>
                  <td className="font-semibold" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={n.title}>{n.title}</td>
                  <td><span className={`badge ${typeTone(n.type)}`}>{typeLabel(n.type)}</span></td>
                  <td className="cell-muted">{audLabel(n)}</td>
                  <td>
                    <span className={`badge ${statusTone(n.status)}`}>{statusLabel(n.status)}</span>
                    {n.status === "sent" && n.sent_count != null ? <span className="cell-muted text-sm" style={{ marginLeft: 6 }}>{n.sent_count}</span> : null}
                  </td>
                  <td>
                    <label className="switch-row">
                      <input
                        type="checkbox"
                        checked={n.is_active}
                        disabled={n.status === "sent" || busyId === n.id}
                        onChange={() => void toggleActive(n)}
                      />
                    </label>
                  </td>
                  <td className="cell-muted">{n.scheduled_for ? fmtDateTime(n.scheduled_for) : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                      {n.status !== "sent" ? (
                        <>
                          <button className="icon-btn" title={s.snEditNotice} disabled={busyId === n.id} onClick={() => openEdit(n)}><i className="ti ti-edit" /></button>
                          <button className="icon-btn" title={s.snSendNow} disabled={busyId === n.id} onClick={() => void sendRow(n)}><i className="ti ti-send" /></button>
                        </>
                      ) : null}
                      <button className="icon-btn danger" title={s.delete} disabled={busyId === n.id} onClick={() => void removeRow(n)}><i className="ti ti-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={`drawer-overlay ${draft ? "open" : ""}`} onClick={() => setDraft(null)} />
      <div className={`drawer ${draft ? "open" : ""}`}>
        <div className="drawer-header">
          <div style={{ fontSize: 16, fontWeight: 600 }}>{draft?.id != null ? s.snEditNotice : s.snNewNotice}</div>
          <button className="icon-btn" onClick={() => setDraft(null)}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          {draft && (
            <>
              <div className="fld" style={{ marginBottom: 12 }}>
                <label>{s.snFldTitle}</label>
                <input value={draft.title} maxLength={255} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="fld" style={{ marginBottom: 12 }}>
                <label>{s.snFldMessage}</label>
                <textarea rows={5} maxLength={5000} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="fld">
                  <label>{s.snColType}</label>
                  <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as NoticeDraft["type"] })}>
                    <option value="announcement">{s.snTypeAnnouncement}</option>
                    <option value="maintenance">{s.snTypeMaintenance}</option>
                    <option value="info">{s.snTypeInfo}</option>
                  </select>
                </div>
                <div className="fld">
                  <label>{s.snColPriority}</label>
                  <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as NoticeDraft["priority"] })}>
                    <option value="low">{s.snPriLow}</option>
                    <option value="normal">{s.snPriNormal}</option>
                    <option value="high">{s.snPriHigh}</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: draft.audience === "by_company" ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 12 }}>
                <div className="fld">
                  <label>{s.snColAudience}</label>
                  <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as NoticeDraft["audience"] })}>
                    <option value="everyone">{s.snAudEveryone}</option>
                    <option value="all_b2c">{s.snAudB2c}</option>
                    <option value="all_staff">{s.snAudStaff}</option>
                    <option value="by_company">{s.snAudCompany}</option>
                  </select>
                </div>
                {draft.audience === "by_company" ? (
                  <div className="fld">
                    <label>{s.snFldCompanyId}</label>
                    <input type="number" min={1} value={draft.company_id} onChange={(e) => setDraft({ ...draft, company_id: e.target.value })} />
                  </div>
                ) : null}
              </div>
              <div className="fld" style={{ marginBottom: 12 }}>
                <label>{s.snFldChannels}</label>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", paddingTop: 4 }}>
                  {CHANNEL_OPTIONS.map((c) => (
                    <label key={c.value} className="switch-row" style={{ gap: 6 }}>
                      <input type="checkbox" checked={draft.channels.includes(c.value)} onChange={() => toggleChannel(c.value)} />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="fld" style={{ marginBottom: 16 }}>
                <label>{s.snFldSchedule}</label>
                <input type="datetime-local" value={draft.scheduled_for} onChange={(e) => setDraft({ ...draft, scheduled_for: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn" disabled={saving} onClick={() => setDraft(null)}>{s.cancel}</button>
                <button className="btn" disabled={saving || draft.title.trim() === "" || draft.message.trim() === ""} onClick={() => void save(false)}>
                  <i className="ti ti-device-floppy" />{s.save}
                </button>
                <button className="btn btn-primary" disabled={saving || draft.title.trim() === "" || draft.message.trim() === ""} onClick={() => void save(true)}>
                  <i className="ti ti-send" />{s.snSendNow}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SysNotifPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const router = useRouter();
  // 2026-06-10 (roadmap §1) — bulk broadcast lives on its own super-only page
  // (/bucket3/bulk-notifications); this pane is its discoverable home.
  const { user } = useAdminAuth();
  const [rows, setRows] = useState<PlatformNotificationRow[]>([]);
  const [stats, setStats] = useState<PlatformNotificationStats | null>(null);
  const [meta, setMeta] = useState<{ current_page: number; per_page: number; total: number; last_page: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fUser, setFUser] = useState("");
  const [fEvent, setFEvent] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PlatformNotificationRow | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        apiPlatformNotifications(token, {
          page,
          per_page: 50,
          user_id: fUser.trim() || undefined,
          event_type: fEvent || undefined,
          status: fStatus || undefined,
          priority: fPriority || undefined,
          q: q.trim() || undefined,
        }),
        apiPlatformNotificationStats(token).catch(() => null),
      ]);
      setRows(list.data ?? []);
      setMeta(list.meta);
      if (st) setStats(st.data);
    } catch (e) {
      console.error("notifications load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, page, fUser, fEvent, fStatus, fPriority, q]);
  useEffect(() => {
    void load();
  }, [token, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const priTone = (p: string): string => (p === "critical" ? "badge-danger" : p === "high" ? "badge-warning" : p === "normal" ? "badge-info" : "badge-gray");
  const priLabel = (p: string): string => (p === "critical" ? s.snPriCritical : p === "high" ? s.snPriHigh : p === "normal" ? s.snPriNormal : p === "low" ? s.snPriLow : p);
  const stTone = (st: string): string => (st === "read" ? "badge-success" : st === "unread" ? "badge-warning" : "badge-gray");
  const stLabel = (st: string): string => (st === "read" ? s.snStRead : st === "unread" ? s.snStUnread : st);

  return (
    <div>
      {user?.is_super_admin && token ? <NoticesSection token={token} lang={lang} /> : null}
      {stats && (
        <div className="stat-grid">
          <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-bell" /></div><div className="stat-value">{stats.total}</div><div className="stat-label">{s.snStatTotal}</div></div>
          <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-mail-opened" /></div><div className="stat-value">{stats.unread}</div><div className="stat-label">{s.snStatUnread}</div></div>
          <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-checks" /></div><div className="stat-value">{stats.read}</div><div className="stat-label">{s.snStatRead}</div></div>
          <div className="stat-card c-danger"><div className="stat-header"><i className="ti ti-alert-triangle" /></div><div className="stat-value">{stats.by_priority?.critical ?? 0}</div><div className="stat-label">{s.snStatCritical}</div></div>
        </div>
      )}
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.snFilterUser}</span>
          <input value={fUser} onChange={(e) => setFUser(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(); } }} />
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.snFilterEvent}</span>
          <select value={fEvent} onChange={(e) => setFEvent(e.target.value)}>
            <option value="">{s.snAllEvents}</option>
            {NOTIF_EVENT_TYPES.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">{s.all}</option>
            {NOTIF_STATUSES.map((st) => <option key={st} value={st}>{stLabel(st)}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.snColPriority}</span>
          <select value={fPriority} onChange={(e) => setFPriority(e.target.value)}>
            <option value="">{s.all}</option>
            {NOTIF_PRIORITIES.map((p) => <option key={p} value={p}>{priLabel(p)}</option>)}
          </select>
        </div>
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input type="search" placeholder={s.snSearchPh} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(); } }} />
        </div>
        <button className="btn" onClick={() => { setPage(1); void load(); }}><i className="ti ti-filter" />{s.apply}</button>
        {user?.is_super_admin && (
          <button className="btn btn-primary" onClick={() => router.push("/bucket3/bulk-notifications")}>
            <i className="ti ti-send" />{s.snBulkSend}
          </button>
        )}
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{s.snCardTitle}</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.snColWhen}</th>
                <th>{s.snColUser}</th>
                <th>{s.snColEvent}</th>
                <th>{s.snColTitle}</th>
                <th>{s.snColPriority}</th>
                <th>{s.status}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.snEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r)} style={{ cursor: "pointer" }}>
                    <td className="cell-muted text-sm" title={r.created_at}>{fmtDateTime(r.created_at)}</td>
                    <td>{r.user?.name ?? `#${r.user_id}`}{r.user?.email ? <div className="cell-muted text-sm">{r.user.email}</div> : null}</td>
                    <td>{r.event_type ? <span className="type-badge">{r.event_type}</span> : <span className="cell-muted">—</span>}</td>
                    <td className="text-sm" style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</td>
                    <td><span className={`badge ${priTone(r.priority)}`}>{priLabel(r.priority)}</span></td>
                    <td><span className={`badge ${stTone(r.status)}`}>{stLabel(r.status)}</span></td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <button className="icon-btn" title={s.cmView} onClick={() => setSelected(r)}><i className="ti ti-eye" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <div className="pagination-info">{(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} / {meta.total}</div>
            <div className="pagination-controls">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="ti ti-chevron-left" /></button>
              <button className="icon-btn" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>

      <div className={`drawer-overlay ${selected ? "open" : ""}`} onClick={() => setSelected(null)} />
      <div className={`drawer ${selected ? "open" : ""}`}>
        <div className="drawer-header">
          <div style={{ fontSize: 16, fontWeight: 600 }}>{selected?.title ?? ""}</div>
          <button className="icon-btn" onClick={() => setSelected(null)}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          {selected && (
            <>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <span className={`badge ${priTone(selected.priority)}`}>{priLabel(selected.priority)}</span>
                <span className={`badge ${stTone(selected.status)}`}>{stLabel(selected.status)}</span>
              </div>
              <div className="alert" style={{ whiteSpace: "pre-wrap" }}><i className="ti ti-message" /><div>{selected.message}</div></div>
              <div className="info-grid" style={{ marginTop: 14 }}>
                <div className="info-row"><span className="info-label">{s.snColUser}</span><span className="info-value">{selected.user ? `${selected.user.name} · ${selected.user.email}` : `#${selected.user_id}`}</span></div>
                <div className="info-row"><span className="info-label">{s.snColWhen}</span><span className="info-value">{fmtDateTime(selected.created_at)}</span></div>
                <div className="info-row"><span className="info-label">{s.snDrawerType}</span><span className="info-value">{selected.type}</span></div>
                <div className="info-row"><span className="info-label">{s.snColEvent}</span><span className="info-value">{selected.event_type ?? "—"}</span></div>
                <div className="info-row"><span className="info-label">{s.snDrawerSubject}</span><span className="info-value">{selected.subject_type ? `${selected.subject_type}${selected.subject_id ? ` #${selected.subject_id}` : ""}` : "—"}</span></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Newsletter pane (Content cluster) — subscribers + stats + unsubscribe
// ════════════════════════════════════════════════════════════════

const NL_SOURCES = ["", "home", "footer", "newsletter-block", "other"];
const NL_LANGS = ["", "en", "ru", "hy"];

function NewsletterPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<NewsletterSubscriptionRow[]>([]);
  const [stats, setStats] = useState<NewsletterStats | null>(null);
  const [meta, setMeta] = useState<{ current_page: number; per_page: number; total: number; last_page: number } | null>(null);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState("");
  const [flang, setFlang] = useState("");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        apiNewsletterSubscriptions(token, {
          page,
          per_page: 25,
          source: source || undefined,
          lang: flang || undefined,
          search: search.trim() || undefined,
          active_only: activeOnly,
        }),
        apiNewsletterStats(token).catch(() => null),
      ]);
      setRows(list.data ?? []);
      setMeta(list.meta);
      if (st) setStats(st.data);
    } catch (e) {
      console.error("newsletter load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, page, source, flang, search, activeOnly]);
  useEffect(() => {
    void load();
  }, [token, page, source, flang, activeOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  async function unsubscribe(id: number) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.nlConfirmUnsub)) return;
    setBusyId(id);
    try {
      await apiDeleteNewsletterSubscription(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    if (!token) return;
    const p = new URLSearchParams();
    if (source) p.set("source", source);
    if (flang) p.set("lang", flang);
    p.set("active_only", activeOnly ? "1" : "0");
    const base = getApiBaseUrl().replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/platform-admin/newsletter/subscriptions/export.csv?${p.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/csv" },
      });
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      alert(s.errGeneric);
    }
  }

  return (
    <div>
      {stats && (
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-users" /></div><div className="stat-value">{stats.total_active}</div><div className="stat-label">{s.nlStatActive}</div></div>
          <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-language" /></div><div className="stat-value text-sm" style={{ fontSize: 13, fontWeight: 500 }}>{Object.entries(stats.by_lang).map(([k, v]) => `${k}: ${v}`).join("  ·  ") || "—"}</div><div className="stat-label">{s.nlStatByLang}</div></div>
          <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-tag" /></div><div className="stat-value text-sm" style={{ fontSize: 13, fontWeight: 500 }}>{Object.entries(stats.by_source).map(([k, v]) => `${k || "—"}: ${v}`).join("  ·  ") || "—"}</div><div className="stat-label">{s.nlStatBySource}</div></div>
        </div>
      )}
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.nlFilterSource}</span>
          <select value={source} onChange={(e) => { setPage(1); setSource(e.target.value); }}>
            {NL_SOURCES.map((x) => <option key={x} value={x}>{x || s.nlAllSources}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.nlFilterLang}</span>
          <select value={flang} onChange={(e) => { setPage(1); setFlang(e.target.value); }}>
            {NL_LANGS.map((x) => <option key={x} value={x}>{x || s.all}</option>)}
          </select>
        </div>
        <div className="filter-field" style={{ flex: 2 }}>
          <span className="filter-label">{s.search}</span>
          <input type="search" placeholder={s.nlSearchPh} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(); } }} />
        </div>
        <label className="switch-row" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={activeOnly} onChange={(e) => { setPage(1); setActiveOnly(e.target.checked); }} />
          {s.nlActiveOnly}
        </label>
        <button className="btn" onClick={() => { setPage(1); void load(); }}><i className="ti ti-filter" />{s.apply}</button>
        <button className="btn" onClick={() => void exportCsv()}><i className="ti ti-download" />{s.nlExportCsv}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{s.nlCardTitle}</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.nlColEmail}</th>
                <th>{s.nlColLang}</th>
                <th>{s.nlColSource}</th>
                <th>{s.nlColSubscribed}</th>
                <th>{s.status}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.nlEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.email}</td>
                    <td>{r.lang ? <span className="type-badge">{r.lang}</span> : <span className="cell-muted">—</span>}</td>
                    <td>{r.source ? <span className="type-badge">{r.source}</span> : <span className="cell-muted">—</span>}</td>
                    <td className="cell-muted text-sm">{fmtDateTime(r.subscribed_at).slice(0, 10)}</td>
                    <td>
                      {r.unsubscribed_at ? (
                        <span className="badge badge-danger">{s.nlStatusUnsub}</span>
                      ) : (
                        <span className="badge badge-success">{s.nlStatusActive}</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {!r.unsubscribed_at && (
                        <button className="icon-btn danger" title={s.nlUnsubscribe} disabled={busyId === r.id} onClick={() => void unsubscribe(r.id)}><i className="ti ti-trash" /></button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <div className="pagination-info">{(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} / {meta.total}</div>
            <div className="pagination-controls">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="ti ti-chevron-left" /></button>
              <button className="icon-btn" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Layout cluster — header menu / footer builders + brand form
// ════════════════════════════════════════════════════════════════

function builderTempId(): string {
  return `new-${Math.random().toString(36).slice(2, 9)}`;
}

type HmEditRow = HeaderMenuAdminRow & { _tempId?: string };

function HeaderMenuPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [items, setItems] = useState<HmEditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiAdminHeaderMenu(token);
      setItems(res.data.items.map((it) => ({ ...it })));
    } catch (e) {
      console.error("header menu load failed", e);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  const rowKeyOf = (r: HmEditRow): number | string => r.id || r._tempId || 0;
  const topLevel = items.filter((i) => i.parent_id == null).sort((a, b) => a.position - b.position);

  function updateRow(rowKey: number | string, patch: Partial<HmEditRow>) {
    setItems((prev) => prev.map((r) => (rowKeyOf(r) === rowKey ? { ...r, ...patch } : r)));
  }
  function addRootItem() {
    setItems((prev) => [
      ...prev,
      { id: 0, _tempId: builderTempId(), parent_id: null, label_en: "", label_ru: null, label_hy: null, url: "/", position: prev.filter((i) => i.parent_id == null).length + 1, is_visible: true, icon: null, open_in_new_tab: false },
    ]);
    setSaved(false);
  }
  function addChild(parentKey: number | string) {
    setItems((prev) => {
      const parent = prev.find((p) => rowKeyOf(p) === parentKey);
      if (!parent) return prev;
      const siblingCount = prev.filter((i) => i.parent_id === parent.id).length;
      return [
        ...prev,
        { id: 0, _tempId: builderTempId(), parent_id: parent.id || -999, label_en: "", label_ru: null, label_hy: null, url: "/", position: siblingCount + 1, is_visible: true, icon: null, open_in_new_tab: false },
      ];
    });
    setSaved(false);
  }
  function removeRow(rowKey: number | string) {
    setItems((prev) => prev.filter((r) => rowKeyOf(r) !== rowKey));
    setSaved(false);
  }
  function moveRow(rowKey: number | string, delta: -1 | 1) {
    setItems((prev) => {
      const target = prev.find((r) => rowKeyOf(r) === rowKey);
      if (!target) return prev;
      const siblings = prev.filter((r) => r.parent_id === target.parent_id).sort((a, b) => a.position - b.position);
      const idx = siblings.findIndex((r) => rowKeyOf(r) === rowKey);
      const swapIdx = idx + delta;
      if (swapIdx < 0 || swapIdx >= siblings.length) return prev;
      const a = siblings[idx];
      const b = siblings[swapIdx];
      if (!a || !b) return prev;
      const tmp = a.position;
      return prev.map((r) => {
        const k = rowKeyOf(r);
        if (k === rowKeyOf(a)) return { ...r, position: b.position };
        if (k === rowKeyOf(b)) return { ...r, position: tmp };
        return r;
      });
    });
  }
  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      const tempToNeg = new Map<string, number>();
      let counter = -1;
      for (const r of items) if (r._tempId && !tempToNeg.has(r._tempId)) tempToNeg.set(r._tempId, counter--);
      const payload = items.map((r) => ({
        id: r.id && r.id > 0 ? r.id : r._tempId ? tempToNeg.get(r._tempId)! : null,
        parent_id: r.parent_id,
        label_en: r.label_en, label_ru: r.label_ru, label_hy: r.label_hy,
        url: r.url, position: r.position, is_visible: r.is_visible, icon: r.icon, open_in_new_tab: r.open_in_new_tab,
      }));
      const res = await apiSyncHeaderMenu(token, payload);
      setItems(res.data.items.map((it) => ({ ...it })));
      setSaved(true);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="filter-card">
        <div style={{ flex: 1 }} />
        {saved && <span className="badge badge-success">{s.lySaved}</span>}
        <button className="btn" onClick={addRootItem}><i className="ti ti-plus" />{s.hmAddItem}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}><i className="ti ti-device-floppy" />{saving ? s.loading : s.lySaveAll}</button>
      </div>
      {topLevel.length === 0 ? (
        <div className="card"><div className="empty-state"><i className="ti ti-menu-2" />{s.hmEmpty}</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {topLevel.map((parent, parentIdx) => {
            const pKey = rowKeyOf(parent);
            const children = items.filter((c) => c.parent_id === parent.id || c.parent_id === -999).sort((a, b) => a.position - b.position);
            return (
              <div key={pKey} className="card" style={{ marginBottom: 0 }}>
                <div className="card-body">
                  <HmItemFields row={parent} rowKey={pKey} isFirst={parentIdx === 0} isLast={parentIdx === topLevel.length - 1} s={s} onChange={updateRow} onMove={moveRow} onRemove={removeRow} />
                  {children.length > 0 && (
                    <div style={{ marginTop: 12, marginLeft: 16, borderLeft: "2px solid var(--primary)", paddingLeft: 12 }}>
                      <div className="text-sm cell-muted" style={{ marginBottom: 8 }}>{s.hmChildren}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {children.map((child, childIdx) => (
                          <HmItemFields key={rowKeyOf(child)} row={child} rowKey={rowKeyOf(child)} isFirst={childIdx === 0} isLast={childIdx === children.length - 1} s={s} onChange={updateRow} onMove={moveRow} onRemove={removeRow} isChild />
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 10, textAlign: "right" }}>
                    <button className="btn btn-sm" onClick={() => addChild(pKey)}><i className="ti ti-plus" />{s.hmAddChild}</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HmItemFields({
  row, rowKey, isFirst, isLast, s, onChange, onMove, onRemove, isChild,
}: {
  row: HmEditRow;
  rowKey: number | string;
  isFirst: boolean;
  isLast: boolean;
  s: Record<SettingsKey, string>;
  onChange: (rowKey: number | string, patch: Partial<HmEditRow>) => void;
  onMove: (rowKey: number | string, delta: -1 | 1) => void;
  onRemove: (rowKey: number | string) => void;
  isChild?: boolean;
}) {
  return (
    <div style={isChild ? { background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: 10 } : undefined}>
      <div className="form-grid">
        <div className="fld"><label className="fld-label">{s.lyLabelEn}</label><input value={row.label_en} onChange={(e) => onChange(rowKey, { label_en: e.target.value })} /></div>
        <div className="fld"><label className="fld-label">{s.lyLabelRu}</label><input value={row.label_ru ?? ""} onChange={(e) => onChange(rowKey, { label_ru: e.target.value === "" ? null : e.target.value })} /></div>
        <div className="fld"><label className="fld-label">{s.lyLabelHy}</label><input value={row.label_hy ?? ""} onChange={(e) => onChange(rowKey, { label_hy: e.target.value === "" ? null : e.target.value })} /></div>
        <div className="fld span-2"><label className="fld-label">{s.lyUrl}</label><input className="font-mono" value={row.url} onChange={(e) => onChange(rowKey, { url: e.target.value })} placeholder="/path" /></div>
        <div className="fld"><label className="fld-label">{s.hmIcon}</label><input className="font-mono" value={row.icon ?? ""} onChange={(e) => onChange(rowKey, { icon: e.target.value === "" ? null : e.target.value })} placeholder="ti-home" /></div>
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <label className="switch-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={row.is_visible} onChange={(e) => onChange(rowKey, { is_visible: e.target.checked })} />{s.lyVisible}</label>
          <label className="switch-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={row.open_in_new_tab} onChange={(e) => onChange(rowKey, { open_in_new_tab: e.target.checked })} />{s.lyNewTab}</label>
        </div>
        <div className="row-actions">
          <button className="icon-btn" title={s.bnMoveUp} disabled={isFirst} onClick={() => onMove(rowKey, -1)}><i className="ti ti-chevron-up" /></button>
          <button className="icon-btn" title={s.bnMoveDown} disabled={isLast} onClick={() => onMove(rowKey, 1)}><i className="ti ti-chevron-down" /></button>
          <button className="icon-btn danger" title={s.lyRemove} onClick={() => onRemove(rowKey)}><i className="ti ti-trash" /></button>
        </div>
      </div>
    </div>
  );
}

type FtEditLink = FooterLinkAdminRow & { _tempId?: string };
type FtEditCol = Omit<FooterColumnAdminRow, "links"> & { links: FtEditLink[]; _tempId?: string };

function FooterPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [columns, setColumns] = useState<FtEditCol[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiAdminFooter(token);
      setColumns(res.data.columns.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })) })));
    } catch (e) {
      console.error("footer load failed", e);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  function updateColumn(idx: number, patch: Partial<FtEditCol>) {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    setSaved(false);
  }
  function updateLink(colIdx: number, linkIdx: number, patch: Partial<FtEditLink>) {
    setColumns((prev) => prev.map((c, i) => (i === colIdx ? { ...c, links: c.links.map((l, j) => (j === linkIdx ? { ...l, ...patch } : l)) } : c)));
    setSaved(false);
  }
  function addColumn() {
    setColumns((prev) => [...prev, { id: 0, _tempId: builderTempId(), slug: "", title_en: "", title_ru: null, title_hy: null, position: prev.length + 1, is_visible: true, links: [] }]);
    setSaved(false);
  }
  function removeColumn(idx: number) {
    setColumns((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }
  function moveColumn(idx: number, delta: -1 | 1) {
    setColumns((prev) => {
      const newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx]!;
      copy[idx] = copy[newIdx]!;
      copy[newIdx] = tmp;
      return copy.map((c, i) => ({ ...c, position: i + 1 }));
    });
  }
  function addLink(colIdx: number) {
    setColumns((prev) => prev.map((c, i) => (i === colIdx ? { ...c, links: [...c.links, { id: 0, _tempId: builderTempId(), column_id: c.id, label_en: "", label_ru: null, label_hy: null, url: "/", position: c.links.length + 1, is_visible: true, open_in_new_tab: false }] } : c)));
    setSaved(false);
  }
  function removeLink(colIdx: number, linkIdx: number) {
    setColumns((prev) => prev.map((c, i) => (i === colIdx ? { ...c, links: c.links.filter((_, j) => j !== linkIdx) } : c)));
    setSaved(false);
  }
  function moveLink(colIdx: number, linkIdx: number, delta: -1 | 1) {
    setColumns((prev) => prev.map((c, i) => {
      if (i !== colIdx) return c;
      const newIdx = linkIdx + delta;
      if (newIdx < 0 || newIdx >= c.links.length) return c;
      const copy = [...c.links];
      const tmp = copy[linkIdx]!;
      copy[linkIdx] = copy[newIdx]!;
      copy[newIdx] = tmp;
      return { ...c, links: copy.map((l, k) => ({ ...l, position: k + 1 })) };
    }));
  }
  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      const payload: FooterSyncColumnPayload[] = columns.map((c) => ({
        id: c.id && c.id > 0 ? c.id : null,
        slug: c.slug || null,
        title_en: c.title_en, title_ru: c.title_ru, title_hy: c.title_hy,
        position: c.position, is_visible: c.is_visible,
        links: c.links.map((l) => ({
          id: l.id && l.id > 0 ? l.id : null,
          label_en: l.label_en, label_ru: l.label_ru, label_hy: l.label_hy,
          url: l.url, position: l.position, is_visible: l.is_visible, open_in_new_tab: l.open_in_new_tab,
        })),
      }));
      const res = await apiSyncFooter(token, payload);
      setColumns(res.data.columns.map((c) => ({ ...c, links: c.links.map((l) => ({ ...l })) })));
      setSaved(true);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="filter-card">
        <div style={{ flex: 1 }} />
        {saved && <span className="badge badge-success">{s.lySaved}</span>}
        <button className="btn" onClick={addColumn}><i className="ti ti-plus" />{s.ftAddColumn}</button>
        <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}><i className="ti ti-device-floppy" />{saving ? s.loading : s.lySaveAll}</button>
      </div>
      {columns.length === 0 ? (
        <div className="card"><div className="empty-state"><i className="ti ti-columns" />{s.ftEmpty}</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {columns.map((col, colIdx) => (
            <div key={col.id || col._tempId} className="card" style={{ marginBottom: 0 }}>
              <div className="card-body">
                <div className="form-grid">
                  <div className="fld"><label className="fld-label">{s.ftColTitleEn}</label><input value={col.title_en} onChange={(e) => updateColumn(colIdx, { title_en: e.target.value })} /></div>
                  <div className="fld"><label className="fld-label">{s.ftColTitleRu}</label><input value={col.title_ru ?? ""} onChange={(e) => updateColumn(colIdx, { title_ru: e.target.value === "" ? null : e.target.value })} /></div>
                  <div className="fld"><label className="fld-label">{s.ftColTitleHy}</label><input value={col.title_hy ?? ""} onChange={(e) => updateColumn(colIdx, { title_hy: e.target.value === "" ? null : e.target.value })} /></div>
                  <div className="fld"><label className="fld-label">{s.ftSlug}</label><input className="font-mono" value={col.slug ?? ""} onChange={(e) => updateColumn(colIdx, { slug: e.target.value })} /></div>
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <label className="switch-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={col.is_visible} onChange={(e) => updateColumn(colIdx, { is_visible: e.target.checked })} />{s.lyVisible}</label>
                  <div className="row-actions">
                    <button className="icon-btn" title={s.bnMoveUp} disabled={colIdx === 0} onClick={() => moveColumn(colIdx, -1)}><i className="ti ti-chevron-up" /></button>
                    <button className="icon-btn" title={s.bnMoveDown} disabled={colIdx === columns.length - 1} onClick={() => moveColumn(colIdx, 1)}><i className="ti ti-chevron-down" /></button>
                    <button className="icon-btn danger" title={s.ftRemoveColumn} onClick={() => removeColumn(colIdx)}><i className="ti ti-trash" /></button>
                  </div>
                </div>
                <div style={{ marginTop: 12, borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div className="text-sm" style={{ fontWeight: 600 }}>{s.ftLinks}</div>
                    <button className="btn btn-sm" onClick={() => addLink(colIdx)}><i className="ti ti-plus" />{s.ftAddLink}</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {col.links.map((link, linkIdx) => (
                      <div key={link.id || link._tempId} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: 10 }}>
                        <div className="form-grid">
                          <div className="fld"><label className="fld-label">{s.lyLabelEn}</label><input value={link.label_en} onChange={(e) => updateLink(colIdx, linkIdx, { label_en: e.target.value })} /></div>
                          <div className="fld"><label className="fld-label">{s.lyLabelRu}</label><input value={link.label_ru ?? ""} onChange={(e) => updateLink(colIdx, linkIdx, { label_ru: e.target.value === "" ? null : e.target.value })} /></div>
                          <div className="fld"><label className="fld-label">{s.lyLabelHy}</label><input value={link.label_hy ?? ""} onChange={(e) => updateLink(colIdx, linkIdx, { label_hy: e.target.value === "" ? null : e.target.value })} /></div>
                          <div className="fld span-2"><label className="fld-label">{s.lyUrl}</label><input className="font-mono" value={link.url} onChange={(e) => updateLink(colIdx, linkIdx, { url: e.target.value })} placeholder="/path" /></div>
                        </div>
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                            <label className="switch-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={link.is_visible} onChange={(e) => updateLink(colIdx, linkIdx, { is_visible: e.target.checked })} />{s.lyVisible}</label>
                            <label className="switch-row" style={{ cursor: "pointer" }}><input type="checkbox" checked={link.open_in_new_tab} onChange={(e) => updateLink(colIdx, linkIdx, { open_in_new_tab: e.target.checked })} />{s.lyNewTab}</label>
                          </div>
                          <div className="row-actions">
                            <button className="icon-btn" title={s.bnMoveUp} disabled={linkIdx === 0} onClick={() => moveLink(colIdx, linkIdx, -1)}><i className="ti ti-chevron-up" /></button>
                            <button className="icon-btn" title={s.bnMoveDown} disabled={linkIdx === col.links.length - 1} onClick={() => moveLink(colIdx, linkIdx, 1)}><i className="ti ti-chevron-down" /></button>
                            <button className="icon-btn danger" title={s.lyRemove} onClick={() => removeLink(colIdx, linkIdx)}><i className="ti ti-trash" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const BRAND_CF_TYPES: BrandCustomField["type"][] = ["text", "url", "email", "phone", "image", "tel"];

function BrandPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [data, setData] = useState<BrandSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiBrandSettings();
      setData(res.data);
    } catch (e) {
      console.error("brand settings load failed", e);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function updateField<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }
  function updateSocial(k: string, value: string) {
    setData((prev) => (prev ? { ...prev, social_links: { ...prev.social_links, [k]: value === "" ? null : value } } : prev));
    setSaved(false);
  }
  function updateCustom(i: number, patch: Partial<BrandCustomField>) {
    setData((prev) => (prev ? { ...prev, custom_fields: prev.custom_fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) } : prev));
    setSaved(false);
  }
  function addCustom() {
    setData((prev) => (prev ? { ...prev, custom_fields: [...prev.custom_fields, { key: "", label: "", type: "text", value: "" }] } : prev));
    setSaved(false);
  }
  function removeCustom(i: number) {
    setData((prev) => (prev ? { ...prev, custom_fields: prev.custom_fields.filter((_, j) => j !== i) } : prev));
    setSaved(false);
  }
  async function handleSave() {
    if (!token || !data) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiPatchBrandSettings(token, data);
      setData(res.data);
      setSaved(true);
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return <div className="card"><div className="empty-state"><i className="ti ti-palette" />{s.brLoadPrompt}</div></div>;
  }

  return (
    <div>
      <div className="filter-card">
        <div style={{ flex: 1 }} />
        {saved && <span className="badge badge-success">{s.lySaved}</span>}
        <button className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}><i className="ti ti-device-floppy" />{saving ? s.loading : s.save}</button>
      </div>

      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.brImagery}</div><div className="card-subtitle">{s.brImageryHint}</div></div></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <ImageUploadField value={data.logo_url ?? ""} onChange={(v) => updateField("logo_url", v === "" ? null : v)} section="banners" label={s.brLogo} altText="ZULU logo" />
            <ImageUploadField value={data.emblem_url ?? ""} onChange={(v) => updateField("emblem_url", v === "" ? null : v)} section="banners" label={s.brEmblem} altText="ZULU emblem" />
            <ImageUploadField value={data.favicon_url ?? ""} onChange={(v) => updateField("favicon_url", v === "" ? null : v)} section="banners" label={s.brFavicon} altText="Favicon" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">{s.brContact}</div></div>
        <div className="card-body">
          <div className="form-grid">
            <div className="fld"><label className="fld-label">{s.brPhone}</label><input value={data.phone ?? ""} onChange={(e) => updateField("phone", e.target.value === "" ? null : e.target.value)} placeholder="+374 11 123 456" /></div>
            <div className="fld"><label className="fld-label">{s.brEmail}</label><input type="email" value={data.email ?? ""} onChange={(e) => updateField("email", e.target.value === "" ? null : e.target.value)} placeholder="info@zulu.am" /></div>
            <div className="fld span-2"><label className="fld-label">{s.brAddress}</label><input value={data.address ?? ""} onChange={(e) => updateField("address", e.target.value === "" ? null : e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.brCity}</label><input value={data.address_city ?? ""} onChange={(e) => updateField("address_city", e.target.value === "" ? null : e.target.value)} /></div>
            <div className="fld"><label className="fld-label">{s.brCountry}</label><input value={data.address_country ?? ""} onChange={(e) => updateField("address_country", e.target.value === "" ? null : e.target.value)} /></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div><div className="card-title">{s.brSocial}</div><div className="card-subtitle">{s.brSocialHint}</div></div></div>
        <div className="card-body">
          <div className="form-grid">
            {BRAND_SOCIAL_PLATFORMS.map((p) => (
              <div key={p.key} className="fld"><label className="fld-label">{p.label}</label><input type="url" value={data.social_links?.[p.key] ?? ""} onChange={(e) => updateSocial(p.key, e.target.value)} placeholder="https://…" /></div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div><div className="card-title">{s.brCustom}</div><div className="card-subtitle">{s.brCustomHint}</div></div>
          <button className="btn btn-sm" onClick={addCustom}><i className="ti ti-plus" />{s.brAddField}</button>
        </div>
        <div className="card-body">
          {data.custom_fields.length === 0 ? (
            <div className="cell-muted text-sm">{s.brEmptyCustom}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.custom_fields.map((f, i) => (
                <div key={i} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: 10 }}>
                  <div className="form-grid">
                    <div className="fld"><label className="fld-label">{s.brCfKey}</label><input className="font-mono" value={f.key} onChange={(e) => updateCustom(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="office_hours" /></div>
                    <div className="fld"><label className="fld-label">{s.brCfLabel}</label><input value={f.label} onChange={(e) => updateCustom(i, { label: e.target.value })} /></div>
                    <div className="fld"><label className="fld-label">{s.brCfType}</label><select value={f.type} onChange={(e) => updateCustom(i, { type: e.target.value as BrandCustomField["type"] })}>{BRAND_CF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                    <div className="fld"><label className="fld-label">{s.brCfValue}</label><input value={f.value ?? ""} onChange={(e) => updateCustom(i, { value: e.target.value })} /></div>
                  </div>
                  <div style={{ marginTop: 8, textAlign: "right" }}>
                    <button className="icon-btn danger" title={s.lyRemove} onClick={() => removeCustom(i)}><i className="ti ti-trash" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Loyalty pane (Marketing cluster) — accounts + stats + manual adjust
// ════════════════════════════════════════════════════════════════

const LOYALTY_TIERS = ["bronze", "silver", "gold", "platinum"];

function LoyaltyPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [accounts, setAccounts] = useState<LoyaltyAccountRow[]>([]);
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tier, setTier] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<LoyaltyAccountDetail | null>(null);
  const [adjPoints, setAdjPoints] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        apiLoyaltyAccounts(token, { page, per_page: 25, tier: tier || undefined }),
        apiLoyaltyStats(token).catch(() => null),
      ]);
      setAccounts(list.data ?? []);
      setLastPage(list.last_page ?? 1);
      setTotal(list.total ?? 0);
      if (st) setStats(st.data);
    } catch (e) {
      console.error("loyalty load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, page, tier]);
  useEffect(() => {
    void load();
  }, [token, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openDetail(acct: LoyaltyAccountRow) {
    if (!token) return;
    setDetail({ ...acct });
    setAdjPoints("");
    setAdjReason("");
    try {
      const res = await apiLoyaltyTransactions(token, acct.user_id);
      setDetail({ ...res.data, user: acct.user });
    } catch (e) {
      console.error("loyalty detail failed", e);
    }
  }

  async function submitAdjust() {
    if (!token || !detail) return;
    const points = parseInt(adjPoints, 10);
    if (Number.isNaN(points) || points === 0) {
      alert(s.loAdjustErrZero);
      return;
    }
    if (!adjReason.trim()) {
      alert(s.loAdjustErrReason);
      return;
    }
    const confirmMsg = s.loAdjustConfirm
      .replace("{points}", `${points > 0 ? "+" : ""}${points}`)
      .replace("{user}", detail.user?.name ?? `#${detail.user_id}`);
    if (typeof window !== "undefined" && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await apiLoyaltyAdjust(token, detail.user_id, { points, reason: adjReason.trim() });
      const res = await apiLoyaltyTransactions(token, detail.user_id);
      setDetail({ ...res.data, user: detail.user });
      setAdjPoints("");
      setAdjReason("");
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  const tierLabel = (tn: string): string =>
    tn === "bronze" ? s.loTierBronze : tn === "silver" ? s.loTierSilver : tn === "gold" ? s.loTierGold : tn === "platinum" ? s.loTierPlatinum : tn;
  const tierTone = (tn: string): string => (tn === "platinum" ? "badge-info" : tn === "gold" ? "badge-warning" : "badge-gray");

  return (
    <div>
      {stats && (
        <>
          <div className="stat-grid">
            <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-users" /></div><div className="stat-value">{stats.total_accounts.toLocaleString()}</div><div className="stat-label">{s.loStatAccounts}</div></div>
            <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-coins" /></div><div className="stat-value">{stats.total_points_outstanding.toLocaleString()}</div><div className="stat-label">{s.loStatOutstanding}</div></div>
            <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-trophy" /></div><div className="stat-value">{stats.total_lifetime_points.toLocaleString()}</div><div className="stat-label">{s.loStatLifetime}</div></div>
            <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-crown" /></div><div className="stat-value">{(stats.by_tier?.gold ?? 0) + (stats.by_tier?.platinum ?? 0)}</div><div className="stat-label">{s.loStatGoldPlat}</div></div>
          </div>
          <div className="stat-grid">
            {LOYALTY_TIERS.map((tn) => (
              <div key={tn} className="stat-card"><div className="stat-label" style={{ textTransform: "uppercase", marginTop: 0 }}>{tierLabel(tn)}</div><div className="stat-value" style={{ fontSize: 18 }}>{(stats.by_tier?.[tn] ?? 0).toLocaleString()}</div></div>
            ))}
          </div>
        </>
      )}
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.loTier}</span>
          <select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">{s.all}</option>
            {LOYALTY_TIERS.map((tn) => <option key={tn} value={tn}>{tierLabel(tn)}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => { setPage(1); void load(); }}><i className="ti ti-filter" />{s.apply}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header"><div className="card-title">{s.loCardTitle}</div></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.loColUser}</th>
                <th>{s.loTier}</th>
                <th className="num-cell">{s.loColBalance}</th>
                <th className="num-cell">{s.loColLifetime}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && accounts.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loEmpty}</td></tr>
              ) : (
                accounts.map((a) => (
                  <tr key={a.id} onClick={() => void openDetail(a)} style={{ cursor: "pointer" }}>
                    <td>{a.user?.name ?? `#${a.user_id}`}{a.user?.email ? <div className="cell-muted text-sm">{a.user.email}</div> : null}</td>
                    <td><span className={`badge ${tierTone(a.tier)}`}>{tierLabel(a.tier)}</span></td>
                    <td className="num-cell font-mono">{a.points_balance.toLocaleString()}</td>
                    <td className="num-cell cell-muted">{a.lifetime_points.toLocaleString()}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <button className="icon-btn" title={s.loManage} onClick={() => void openDetail(a)}><i className="ti ti-eye" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {lastPage > 1 && (
          <div className="pagination">
            <div className="pagination-info">{page} / {lastPage} · {total.toLocaleString()}</div>
            <div className="pagination-controls">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="ti ti-chevron-left" /></button>
              <button className="icon-btn" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>

      <div className={`drawer-overlay ${detail ? "open" : ""}`} onClick={() => setDetail(null)} />
      <div className={`drawer ${detail ? "open" : ""}`}>
        <div className="drawer-header">
          <div style={{ fontSize: 16, fontWeight: 600 }}>{detail?.user?.name ?? (detail ? `#${detail.user_id}` : "")}</div>
          <button className="icon-btn" onClick={() => setDetail(null)}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          {detail && (
            <>
              {detail.user?.email ? <div className="cell-muted text-sm" style={{ marginBottom: 12 }}>{detail.user.email}</div> : null}
              <div className="info-grid">
                <div className="info-row"><span className="info-label">{s.loTier}</span><span className="info-value"><span className={`badge ${tierTone(detail.tier)}`}>{tierLabel(detail.tier)}</span></span></div>
                <div className="info-row"><span className="info-label">{s.loDrawerBalance}</span><span className="info-value font-mono">{detail.points_balance.toLocaleString()}</span></div>
                <div className="info-row"><span className="info-label">{s.loDrawerLifetime}</span><span className="info-value font-mono">{detail.lifetime_points.toLocaleString()}</span></div>
              </div>
              <div className="drawer-section">{s.loAdjustTitle}</div>
              <div className="cell-muted text-sm" style={{ marginBottom: 10 }}>{s.loAdjustHelp}</div>
              <div className="form-grid">
                <div className="fld"><label className="fld-label">{s.loAdjustPoints}</label><input type="number" value={adjPoints} onChange={(e) => setAdjPoints(e.target.value)} /></div>
                <div className="fld span-2"><label className="fld-label">{s.loAdjustReason}</label><input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} /></div>
              </div>
              <div style={{ marginTop: 10, textAlign: "right" }}>
                <button className="btn btn-primary" disabled={busy || !adjPoints || !adjReason.trim()} onClick={() => void submitAdjust()}><i className="ti ti-adjustments" />{s.loAdjustApply}</button>
              </div>
              <div className="drawer-section">{s.loTransactions}{detail.transactions ? ` (${detail.transactions.length})` : ""}</div>
              {!detail.transactions || detail.transactions.length === 0 ? (
                <div className="cell-muted text-sm">{s.loNoTransactions}</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>{s.loTxWhen}</th><th>{s.loTxType}</th><th className="num-cell">{s.loTxPoints}</th><th>{s.loTxReason}</th></tr></thead>
                    <tbody>
                      {detail.transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="cell-muted text-sm">{fmtDateTime(tx.created_at)}</td>
                          <td className="text-sm">{tx.type}</td>
                          <td className="num-cell font-mono" style={{ color: tx.points > 0 ? "var(--success)" : "var(--danger)" }}>{tx.points > 0 ? "+" : ""}{tx.points.toLocaleString()}</td>
                          <td className="text-sm">{tx.reason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Security pane (System cluster) — 2FA coverage + incident actions
// ════════════════════════════════════════════════════════════════

function SecurityPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<SecurityTwoFactorRow[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [meta, setMeta] = useState<{ current_page: number; per_page: number; total: number; last_page: number } | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceId, setForceId] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        apiSecurityTwoFactor(token, { page, per_page: 50, q: q.trim() || undefined }),
        apiSecurityStats(token).catch(() => null),
      ]);
      setRows(list.data ?? []);
      setMeta(list.meta);
      if (st) setStats(st.data);
    } catch (e) {
      console.error("security load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, page, q]);
  useEffect(() => {
    void load();
  }, [token, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function forceLogout(userId: number, name?: string) {
    if (!token) return;
    const target = name ?? `#${userId}`;
    if (typeof window !== "undefined" && !window.confirm(s.scConfirmLogout.replace("{target}", target))) return;
    setActionBusy(`logout-${userId}`);
    try {
      const res = await apiSecurityForceLogout(token, userId);
      alert(s.scDoneLogout.replace("{count}", String(res.data?.tokens_revoked ?? 0)).replace("{id}", String(userId)));
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setActionBusy(null);
    }
  }
  async function forceDisable(row: SecurityTwoFactorRow) {
    if (!token) return;
    const target = row.user?.name ?? `#${row.user_id}`;
    if (typeof window !== "undefined" && !window.confirm(s.scConfirmDisable.replace("{target}", target))) return;
    setActionBusy(`disable-${row.user_id}`);
    try {
      await apiSecurityForceDisable2fa(token, row.user_id);
      alert(s.scDone2faOff.replace("{id}", String(row.user_id)));
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setActionBusy(null);
    }
  }
  async function submitForceLogout() {
    const id = parseInt(forceId.trim(), 10);
    if (Number.isNaN(id) || id <= 0) {
      alert(s.scErrUserId);
      return;
    }
    await forceLogout(id);
    setForceId("");
  }

  return (
    <div>
      {stats && (
        <div className="stat-grid">
          <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-users" /></div><div className="stat-value">{stats.total_users.toLocaleString()}</div><div className="stat-label">{s.scStatUsers}</div></div>
          <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-shield-check" /></div><div className="stat-value">{stats.two_factor_confirmed.toLocaleString()}</div><div className="stat-label">{s.scStat2faOn}</div></div>
          <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-shield-x" /></div><div className="stat-value">{stats.two_factor_pending.toLocaleString()}</div><div className="stat-label">{s.scStat2faPending}</div></div>
          <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-percentage" /></div><div className="stat-value">{stats.two_factor_coverage_pct}%</div><div className="stat-label">{s.scStatCoverage}</div></div>
        </div>
      )}
      <div className="card">
        <div className="card-header"><div><div className="card-title" style={{ color: "var(--danger)" }}><i className="ti ti-alert-triangle" style={{ fontSize: 15 }} /> {s.scIncidentTitle}</div><div className="card-subtitle">{s.scIncidentHelp}</div></div></div>
        <div className="card-body">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="fld" style={{ maxWidth: 220 }}><label className="fld-label">{s.scUserIdPh}</label><input type="number" value={forceId} onChange={(e) => setForceId(e.target.value)} /></div>
            <button className="btn btn-danger" disabled={!forceId.trim() || actionBusy !== null} onClick={() => void submitForceLogout()}><i className="ti ti-logout" />{s.scForceLogout}</button>
          </div>
        </div>
      </div>
      <div className="filter-card">
        <div className="filter-field" style={{ flex: 2 }}><span className="filter-label">{s.search}</span><input type="search" placeholder={s.scSearchPh} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(); } }} /></div>
        <button className="btn" onClick={() => { setPage(1); void load(); }}><i className="ti ti-filter" />{s.apply}</button>
      </div>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.scColUser}</th>
                <th>{s.scColRole}</th>
                <th>{s.scColConfirmed}</th>
                <th>{s.scColLastVerified}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.scEmpty}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user?.name ?? `#${r.user_id}`}{r.user?.email ? <div className="cell-muted text-sm">{r.user.email}</div> : null}</td>
                    <td>{r.user?.is_super_admin ? <span className="badge badge-warning">{s.scRoleSuper}</span> : r.user?.role ? <span className="type-badge">{r.user.role}</span> : <span className="cell-muted">—</span>}</td>
                    <td className="cell-muted text-sm">{fmtDateTime(r.confirmed_at)}</td>
                    <td className="cell-muted text-sm">{r.last_verified_at ? fmtDateTime(r.last_verified_at) : s.scNever}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        <button className="btn btn-sm" disabled={actionBusy !== null} onClick={() => void forceLogout(r.user_id, r.user?.name)}><i className="ti ti-logout" />{s.scForceLogout}</button>
                        <button className="btn btn-sm btn-danger" disabled={actionBusy !== null} onClick={() => void forceDisable(r)}><i className="ti ti-shield-off" />{s.scDisable2fa}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <div className="pagination-info">{(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} / {meta.total}</div>
            <div className="pagination-controls">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="ti ti-chevron-left" /></button>
              <button className="icon-btn" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Platform settings pane (System cluster) — grouped key/value editor
// ════════════════════════════════════════════════════════════════

function categoryOfSetting(key: string): string {
  return key.split(/[._-]/)[0]?.toLowerCase() ?? "general";
}
function humanizeKey(str: string): string {
  return str.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function isShortSetting(value: string, type: string): boolean {
  if (type === "boolean" || type === "bool" || type === "number" || type === "integer") return true;
  return value.length <= 80 && !value.includes("\n");
}

function PlatformSettingsPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [rows, setRows] = useState<PlatformSettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeCat, setActiveCat] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiPlatformSettings(token);
      setRows(res.data ?? []);
      const d: Record<string, string> = {};
      for (const r of res.data ?? []) d[r.key] = r.value;
      setDrafts(d);
    } catch (e) {
      console.error("platform settings load failed", e);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  const grouped = (() => {
    const map = new Map<string, PlatformSettingRow[]>();
    for (const r of rows) {
      const cat = categoryOfSetting(r.key);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();
  const categories = grouped.map(([c]) => c);
  const effectiveCat = activeCat || categories[0] || "";
  const visibleRows = grouped.find(([c]) => c === effectiveCat)?.[1] ?? [];

  async function save(key: string) {
    if (!token) return;
    const value = drafts[key];
    if (value === undefined) return;
    setBusyKey(key);
    try {
      await apiPatchPlatformSetting(token, key, value);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusyKey(null);
    }
  }

  if (rows.length === 0) {
    return <div className="card"><div className="empty-state"><i className="ti ti-server-cog" />{s.psEmpty}</div></div>;
  }

  return (
    <div>
      <div className="alert" style={{ marginBottom: 14 }}><i className="ti ti-info-circle" /><div>{s.psSubtitle}</div></div>
      <div className="pills-row">
        {categories.map((c) => (
          <button key={c} className={`sub-tab ${c === effectiveCat ? "active" : ""}`} onClick={() => setActiveCat(c)}>
            {humanizeKey(c)} ({grouped.find(([k]) => k === c)?.[1].length ?? 0})
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleRows.map((r) => {
          const draft = drafts[r.key] ?? r.value;
          const dirty = draft !== r.value;
          const useShort = isShortSetting(draft, r.type);
          return (
            <div key={r.id} className="card" style={{ marginBottom: 0 }}>
              <div className="card-body">
                <div style={{ minWidth: 0 }}>
                  <div className="font-mono text-sm" style={{ fontWeight: 600 }}>{r.key}</div>
                  {r.description ? <div className="cell-muted text-sm" style={{ marginTop: 2 }}>{r.description}</div> : null}
                  <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="type-badge">{s.psType}: {r.type}</span>
                    {dirty && <span className="badge badge-warning">{s.psUnsaved}</span>}
                  </div>
                </div>
                <div className="fld" style={{ marginTop: 10 }}>
                  {useShort ? (
                    <input className="font-mono" value={draft} onChange={(e) => setDrafts((p) => ({ ...p, [r.key]: e.target.value }))} />
                  ) : (
                    <textarea className="font-mono" value={draft} rows={Math.min(8, Math.max(3, draft.split("\n").length))} onChange={(e) => setDrafts((p) => ({ ...p, [r.key]: e.target.value }))} />
                  )}
                </div>
                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  {dirty && <button className="btn btn-sm" onClick={() => setDrafts((p) => ({ ...p, [r.key]: r.value }))}>{s.psReset}</button>}
                  <button className="btn btn-sm btn-primary" disabled={busyKey === r.key || !dirty} onClick={() => void save(r.key)}><i className="ti ti-device-floppy" />{busyKey === r.key ? s.loading : s.save}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Webhooks pane (System cluster) — subscriptions + delivery attempts
// ════════════════════════════════════════════════════════════════

type WebhookSubDraft = {
  id: number | null;
  company_id: string;
  target_url: string;
  description: string;
  events: string[];
  active: boolean;
};

function WebhooksPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [subs, setSubs] = useState<WebhookSubscriptionRow[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRow[]>([]);
  const [tab, setTab] = useState<"deliveries" | "subscriptions">("deliveries");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [replayBusy, setReplayBusy] = useState<number | null>(null);
  // Subscription CUD (roadmap §4, 2026-06-12)
  const [eventCatalog, setEventCatalog] = useState<string[]>([]);
  const [subDraft, setSubDraft] = useState<WebhookSubDraft | null>(null);
  const [subSaving, setSubSaving] = useState(false);
  const [subErr, setSubErr] = useState<string | null>(null);
  const [subBusyId, setSubBusyId] = useState<number | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [subToast, setSubToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setSubToast(msg);
    window.setTimeout(() => setSubToast(null), 3500);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [st, sub, del] = await Promise.all([
        apiWebhookStats(token).catch(() => null),
        apiWebhookSubscriptions(token).catch(() => null),
        apiWebhookDeliveries(token, { status: statusFilter || undefined }),
      ]);
      if (st) setStats(st.data);
      if (sub) setSubs(sub.data ?? []);
      setDeliveries(del.data ?? []);
    } catch (e) {
      console.error("webhooks load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);
  useEffect(() => {
    void load();
  }, [token, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function replay(deliveryId: number) {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.whConfirmReplay)) return;
    setReplayBusy(deliveryId);
    try {
      await apiWebhookReplay(token, deliveryId);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setReplayBusy(null);
    }
  }

  // Event catalog for the subscription form (server-defined, fetched once).
  useEffect(() => {
    if (!token) return;
    apiWebhookEvents(token).then((res) => setEventCatalog(res.data ?? [])).catch(() => setEventCatalog([]));
  }, [token]);

  const openSubCreate = () => { setNewSecret(null); setSubErr(null); setSubDraft({ id: null, company_id: "", target_url: "", description: "", events: [], active: true }); };
  const openSubEdit = (r: WebhookSubscriptionRow) => {
    setNewSecret(null);
    setSubErr(null);
    setSubDraft({
      id: r.id,
      company_id: String(r.company_id),
      target_url: r.target_url,
      description: r.description ?? "",
      events: r.events,
      active: r.active,
    });
  };

  const saveSub = async () => {
    if (!token || !subDraft) return;
    setSubSaving(true);
    setSubErr(null);
    try {
      if (subDraft.id != null) {
        await apiWebhookSubUpdate(token, subDraft.id, {
          target_url: subDraft.target_url.trim(),
          events: subDraft.events,
          description: subDraft.description.trim() || null,
          active: subDraft.active,
        });
        setSubDraft(null);
        flash(s.whSubSavedToast);
      } else {
        const res = await apiWebhookSubCreate(token, {
          company_id: Number(subDraft.company_id),
          target_url: subDraft.target_url.trim(),
          events: subDraft.events,
          description: subDraft.description.trim() || null,
          active: subDraft.active,
        });
        // Keep the drawer open to show the one-time signing secret.
        setNewSecret(res.data.secret ?? null);
        setSubDraft(null);
        flash(s.whSubSavedToast);
      }
      await load();
    } catch (e) {
      setSubErr(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSubSaving(false);
    }
  };

  const toggleSubActive = async (r: WebhookSubscriptionRow) => {
    if (!token) return;
    setSubBusyId(r.id);
    try {
      await apiWebhookSubUpdate(token, r.id, { active: !r.active });
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSubBusyId(null);
    }
  };

  const removeSub = async (r: WebhookSubscriptionRow) => {
    if (!token) return;
    if (typeof window !== "undefined" && !window.confirm(s.whConfirmDeleteSub)) return;
    setSubBusyId(r.id);
    try {
      await apiWebhookSubDelete(token, r.id);
      flash(s.whSubDeletedToast);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setSubBusyId(null);
    }
  };

  const delTone = (st: string): string => (st === "success" ? "badge-success" : st === "pending" ? "badge-warning" : st === "failed" ? "badge-danger" : "badge-gray");
  const delLabel = (st: string): string => (st === "success" ? s.whStSuccess : st === "pending" ? s.whStPending : st === "failed" ? s.whStFailed : st);
  const httpTone = (code: number): string => (code >= 200 && code < 300 ? "badge-success" : code >= 300 && code < 400 ? "badge-info" : code >= 400 && code < 500 ? "badge-warning" : code >= 500 ? "badge-danger" : "badge-gray");

  return (
    <div>
      {stats && (
        <div className="stat-grid">
          <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-webhook" /></div><div className="stat-value">{stats.active_subscriptions} / {stats.total_subscriptions}</div><div className="stat-label">{s.whStatSubs} · {s.whActiveTotal}</div></div>
          <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-send" /></div><div className="stat-value">{stats.deliveries_total.toLocaleString()}</div><div className="stat-label">{s.whStatDeliveries}</div></div>
          <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-circle-check" /></div><div className="stat-value">{stats.success_rate !== null ? `${stats.success_rate}%` : "—"}</div><div className="stat-label">{s.whStatSuccessRate}</div></div>
          <div className="stat-card c-danger"><div className="stat-header"><i className="ti ti-alert-circle" /></div><div className="stat-value">{stats.deliveries_failed.toLocaleString()}</div><div className="stat-label">{s.whStatFailed}</div></div>
        </div>
      )}
      <div className="pills-row">
        <button className={`sub-tab ${tab === "deliveries" ? "active" : ""}`} onClick={() => setTab("deliveries")}>{s.whTabDeliveries}</button>
        <button className={`sub-tab ${tab === "subscriptions" ? "active" : ""}`} onClick={() => setTab("subscriptions")}>{s.whTabSubscriptions}</button>
      </div>

      {tab === "deliveries" ? (
        <>
          <div className="filter-card">
            <div className="filter-field">
              <span className="filter-label">{s.status}</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{s.all}</option>
                <option value="pending">{s.whStPending}</option>
                <option value="success">{s.whStSuccess}</option>
                <option value="failed">{s.whStFailed}</option>
              </select>
            </div>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => void load()}><i className="ti ti-refresh" />{s.whRefresh}</button>
          </div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{s.stColId}</th>
                    <th>{s.whColEvent}</th>
                    <th>{s.status}</th>
                    <th>{s.whColUrl}</th>
                    <th className="num-cell">{s.whColAttempts}</th>
                    <th>{s.whColHttp}</th>
                    <th>{s.whColLastAttempt}</th>
                    <th style={{ textAlign: "right" }}>{s.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && deliveries.length === 0 ? (
                    <tr><td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
                  ) : deliveries.length === 0 ? (
                    <tr><td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.whEmptyDeliveries}</td></tr>
                  ) : (
                    deliveries.map((d) => (
                      <tr key={d.id}>
                        <td className="font-mono cell-muted">#{d.id}</td>
                        <td><span className="type-badge">{d.event}</span></td>
                        <td><span className={`badge ${delTone(d.status)}`}>{delLabel(d.status)}</span></td>
                        <td className="cell-muted text-sm" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.subscription?.url ?? ""}>{d.subscription?.url ?? "—"}</td>
                        <td className="num-cell">{d.attempt_count}</td>
                        <td>{d.last_response_status != null ? <span className={`badge ${httpTone(d.last_response_status)} font-mono`}>{d.last_response_status}</span> : <span className="cell-muted">—</span>}</td>
                        <td className="cell-muted text-sm">{fmtDateTime(d.last_attempt_at)}</td>
                        <td style={{ textAlign: "right" }}>
                          {d.status === "failed" && (
                            <button className="btn btn-sm" disabled={replayBusy === d.id} onClick={() => void replay(d.id)}><i className="ti ti-refresh-dot" />{replayBusy === d.id ? "…" : s.whReplay}</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">{s.whTabSubscriptions}</div>
            <button className="btn btn-primary" onClick={openSubCreate}>
              <i className="ti ti-plus" />{s.whNewSub}
            </button>
          </div>
          {subToast ? <div className="alert" style={{ margin: "0 16px" }}><i className="ti ti-check" /><div>{subToast}</div></div> : null}
          {newSecret ? (
            <div className="alert" style={{ margin: "0 16px 12px" }}>
              <i className="ti ti-key" />
              <div>
                <div style={{ fontWeight: 600 }}>{s.whSecretTitle}</div>
                <div className="font-mono" style={{ wordBreak: "break-all", margin: "4px 0" }}>{newSecret}</div>
                <div className="cell-muted text-sm">{s.whSecretOnce}</div>
              </div>
            </div>
          ) : null}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{s.stColId}</th>
                  <th>{s.whColCompany}</th>
                  <th>{s.whColUrl}</th>
                  <th>{s.whColEvents}</th>
                  <th>{s.status}</th>
                  <th>{s.whColCreated}</th>
                  <th style={{ textAlign: "right" }}>{s.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {loading && subs.length === 0 ? (
                  <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
                ) : subs.length === 0 ? (
                  <tr><td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.whEmptySubscriptions}</td></tr>
                ) : (
                  subs.map((sub) => (
                    <tr key={sub.id}>
                      <td className="font-mono cell-muted">#{sub.id}</td>
                      <td>{sub.company?.name ?? `#${sub.company_id}`}</td>
                      <td className="cell-muted text-sm" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sub.target_url}>{sub.target_url}</td>
                      <td className="cell-muted text-sm" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sub.events.join(", ")}>{sub.events.join(", ")}</td>
                      <td><span className={`badge ${sub.active ? "badge-success" : "badge-warning"}`}>{sub.active ? s.whSubActive : s.whSubPaused}</span></td>
                      <td className="cell-muted text-sm">{sub.created_at ? fmtDateTime(sub.created_at) : "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                          <button className="icon-btn" title={s.whEditSub} disabled={subBusyId === sub.id} onClick={() => openSubEdit(sub)}><i className="ti ti-edit" /></button>
                          <button
                            className="icon-btn"
                            title={sub.active ? s.whActPause : s.whActResume}
                            disabled={subBusyId === sub.id}
                            onClick={() => void toggleSubActive(sub)}
                          >
                            <i className={sub.active ? "ti ti-player-pause" : "ti ti-player-play"} />
                          </button>
                          <button className="icon-btn danger" title={s.delete} disabled={subBusyId === sub.id} onClick={() => void removeSub(sub)}><i className="ti ti-trash" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={`drawer-overlay ${subDraft ? "open" : ""}`} onClick={() => setSubDraft(null)} />
      <div className={`drawer ${subDraft ? "open" : ""}`}>
        <div className="drawer-header">
          <div style={{ fontSize: 16, fontWeight: 600 }}>{subDraft?.id != null ? s.whEditSub : s.whNewSub}</div>
          <button className="icon-btn" onClick={() => setSubDraft(null)}><i className="ti ti-x" /></button>
        </div>
        <div className="drawer-body">
          {subDraft && (
            <>
              {subErr ? <div style={{ color: "var(--danger)", marginBottom: 10 }}>{subErr}</div> : null}
              {subDraft.id == null ? (
                <div className="fld" style={{ marginBottom: 12 }}>
                  <label>{s.snFldCompanyId}</label>
                  <input type="number" min={1} value={subDraft.company_id} onChange={(e) => setSubDraft({ ...subDraft, company_id: e.target.value })} />
                </div>
              ) : null}
              <div className="fld" style={{ marginBottom: 12 }}>
                <label>{s.whFldUrl}</label>
                <input type="url" placeholder="https://" value={subDraft.target_url} onChange={(e) => setSubDraft({ ...subDraft, target_url: e.target.value })} />
              </div>
              <div className="fld" style={{ marginBottom: 12 }}>
                <label>{s.whFldDescription}</label>
                <input maxLength={255} value={subDraft.description} onChange={(e) => setSubDraft({ ...subDraft, description: e.target.value })} />
              </div>
              <div className="fld" style={{ marginBottom: 12 }}>
                <label>{s.whFldEvents}</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, paddingTop: 4 }}>
                  {eventCatalog.map((ev) => (
                    <label key={ev} className="switch-row" style={{ gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={subDraft.events.includes(ev)}
                        onChange={() =>
                          setSubDraft((d) => d && ({
                            ...d,
                            events: d.events.includes(ev) ? d.events.filter((x) => x !== ev) : [...d.events, ev],
                          }))
                        }
                      />
                      <span className="font-mono text-sm">{ev}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="switch-row" style={{ gap: 8, marginBottom: 16 }}>
                <input type="checkbox" checked={subDraft.active} onChange={(e) => setSubDraft({ ...subDraft, active: e.target.checked })} />
                <span>{s.whFldActive}</span>
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn" disabled={subSaving} onClick={() => setSubDraft(null)}>{s.cancel}</button>
                <button
                  className="btn btn-primary"
                  disabled={
                    subSaving
                    || subDraft.target_url.trim() === ""
                    || subDraft.events.length === 0
                    || (subDraft.id == null && subDraft.company_id.trim() === "")
                  }
                  onClick={() => void saveSub()}
                >
                  <i className="ti ti-device-floppy" />{s.save}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Connections pane (System cluster) — service connections between
// inventory items (flight/hotel/transfer) + per-client targeting;
// operators/agents propose, the counterparty accepts / rejects.
// ════════════════════════════════════════════════════════════════

const CONN_STATUS_TONE: Record<string, string> = {
  accepted: "badge-success",
  pending: "badge-warning",
  rejected: "badge-danger",
  canceled: "badge-danger",
};

function ConnectionsPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const { user } = useAdminAuth();
  const isSuper = user?.is_super_admin === true;
  const canCreate = (user?.companies?.length ?? 0) > 0;
  const actorCompanyId = user?.companies?.[0]?.id ?? null;

  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; per_page: number; total: number; last_page: number } | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [companyIdFilter, setCompanyIdFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const companyIdNum = companyIdFilter.trim() === "" ? undefined : Number(companyIdFilter);
  const companyIdParam =
    isSuper && companyIdNum !== undefined && Number.isFinite(companyIdNum) && companyIdNum > 0
      ? companyIdNum
      : undefined;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiConnectionsList(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        source_type: sourceTypeFilter || undefined,
        target_type: targetTypeFilter || undefined,
        company_id: companyIdParam,
      });
      setRows(res.data ?? []);
      setMeta(res.meta);
    } catch (e) {
      console.error("connections load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, sourceTypeFilter, targetTypeFilter, companyIdParam]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: number, action: "accept" | "reject" | "cancel") {
    if (!token) return;
    setBusyId(id);
    try {
      if (action === "accept") {
        await apiConnectionAccept(token, id);
      } else if (action === "reject") {
        const notes = typeof window !== "undefined" ? window.prompt(s.cnRejectReason) : null;
        if (notes === null) {
          setBusyId(null);
          return;
        }
        if (notes.trim().length < 3) {
          alert(s.cnRejectReason);
          setBusyId(null);
          return;
        }
        await apiConnectionReject(token, id, notes.trim());
      } else {
        const notes = typeof window !== "undefined" ? window.prompt(s.cnCancelReasonOptional) : null;
        if (notes === null) {
          setBusyId(null);
          return;
        }
        try {
          await apiConnectionCancel(token, id, notes.trim() || undefined);
        } catch (e) {
          if (e instanceof ApiRequestError && e.status === 422 && e.message.toLowerCase().includes("notes")) {
            const retry = typeof window !== "undefined" ? window.prompt(s.cnCancelReasonRequired) : null;
            if (retry === null || retry.trim().length < 3) {
              setBusyId(null);
              return;
            }
            await apiConnectionCancel(token, id, retry.trim());
          } else {
            throw e;
          }
        }
      }
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusyId(null);
    }
  }

  const entityLabel = (type?: string, id?: number) => (!type || id == null ? "—" : `${type} #${id}`);
  const companyName = (c: ConnectionRow) => c.company?.name ?? (c.company_id != null ? `#${c.company_id}` : "—");
  const stLabel = (st: string) =>
    st === "pending" ? s.cnStPending : st === "accepted" ? s.cnStAccepted : st === "rejected" ? s.cnStRejected : st === "canceled" ? s.cnStCanceled : st;
  const connTypeLabel = (ct: string) => (ct === "both" ? s.cnConnBoth : ct === "only" ? s.cnConnOnly : ct);

  return (
    <div>
      <div className="filter-card">
        <div className="filter-field">
          <span className="filter-label">{s.status}</span>
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}>
            <option value="">{s.all}</option>
            <option value="pending">{s.cnStPending}</option>
            <option value="accepted">{s.cnStAccepted}</option>
            <option value="rejected">{s.cnStRejected}</option>
            <option value="canceled">{s.cnStCanceled}</option>
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.cnSourceType}</span>
          <select value={sourceTypeFilter} onChange={(e) => { setPage(1); setSourceTypeFilter(e.target.value); }}>
            <option value="">{s.all}</option>
            {CONNECTION_SOURCE_TYPES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
          </select>
        </div>
        <div className="filter-field">
          <span className="filter-label">{s.cnTargetType}</span>
          <select value={targetTypeFilter} onChange={(e) => { setPage(1); setTargetTypeFilter(e.target.value); }}>
            <option value="">{s.all}</option>
            {CONNECTION_TARGET_TYPES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
          </select>
        </div>
        {isSuper && (
          <div className="filter-field">
            <span className="filter-label">{s.cnCompanyId}</span>
            <input
              type="number"
              min={1}
              placeholder={s.cnOptional}
              value={companyIdFilter}
              onChange={(e) => { setPage(1); setCompanyIdFilter(e.target.value); }}
              style={{ width: 120 }}
            />
          </div>
        )}
        <button
          className="btn"
          onClick={() => { setPage(1); setStatusFilter(""); setSourceTypeFilter(""); setTargetTypeFilter(""); setCompanyIdFilter(""); }}
        >
          <i className="ti ti-rotate" />{s.cnReset}
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="btn"
          disabled={rows.length === 0}
          onClick={() =>
            exportRowsAsCsv("connections", rows, [
              ["id", (r) => r.id],
              ["source_type", (r) => r.source_type],
              ["source_id", (r) => r.source_id],
              ["target_type", (r) => r.target_type],
              ["target_id", (r) => r.target_id],
              ["connection_type", (r) => r.connection_type],
              ["status", (r) => r.status],
              ["client_targeting", (r) => r.client_targeting ?? ""],
            ])
          }
        >
          <i className="ti ti-download" />{s.cnExport}
        </button>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <i className="ti ti-plus" />{s.cnNew}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.stColId}</th>
                <th>{s.cnSource}</th>
                <th>{s.cnTarget}</th>
                <th>{s.cnColType}</th>
                <th>{s.status}</th>
                <th>{s.cnCompany}</th>
                <th>{s.cnTargeting}</th>
                <th>{s.cnCreated}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={9} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.cnEmpty}</td></tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono cell-muted">#{c.id}</td>
                    <td className="font-mono text-sm">{entityLabel(c.source_type, c.source_id)}</td>
                    <td className="font-mono text-sm">{entityLabel(c.target_type, c.target_id)}</td>
                    <td>{c.connection_type ? <span className="type-badge">{connTypeLabel(c.connection_type)}</span> : <span className="cell-muted">—</span>}</td>
                    <td>{c.status ? <span className={`badge ${CONN_STATUS_TONE[c.status] ?? "badge-gray"}`}>{stLabel(c.status)}</span> : <span className="cell-muted">—</span>}</td>
                    <td className="cell-muted text-sm">{companyName(c)}</td>
                    <td className="cell-muted text-sm">{c.client_targeting === "selected" ? s.cnTargetingSelected : s.cnTargetingAll}</td>
                    <td className="cell-muted text-sm">{fmtDateTime(c.created_at).slice(0, 10)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        {c.status === "pending" && (
                          <>
                            <button className="btn btn-sm" disabled={busyId === c.id} onClick={() => void act(c.id, "accept")}>{s.cnAccept}</button>
                            <button className="btn btn-sm btn-danger" disabled={busyId === c.id} onClick={() => void act(c.id, "reject")}>{s.cnReject}</button>
                          </>
                        )}
                        {(c.status === "pending" || c.status === "accepted") && (
                          <button className="btn btn-sm" disabled={busyId === c.id} onClick={() => void act(c.id, "cancel")}>{s.cnCancel}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {meta && meta.last_page > 1 && (
          <div className="pagination">
            <div className="pagination-info">{(meta.current_page - 1) * meta.per_page + 1}–{Math.min(meta.current_page * meta.per_page, meta.total)} / {meta.total}</div>
            <div className="pagination-controls">
              <button className="icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="ti ti-chevron-left" /></button>
              <button className="icon-btn" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}><i className="ti ti-chevron-right" /></button>
            </div>
          </div>
        )}
      </div>

      <p className="cell-muted text-sm" style={{ marginTop: 12 }}>{s.cnHelp}</p>

      {createOpen && actorCompanyId != null && (
        <ConnectionCreateModal
          token={token}
          lang={lang}
          companyId={actorCompanyId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); setPage(1); void load(); }}
        />
      )}
    </div>
  );
}

function ConnectionCreateModal({
  token,
  lang,
  companyId,
  onClose,
  onCreated,
}: {
  token: string | null;
  lang: string;
  companyId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const s = settingsStrings(lang);
  const [f, setF] = useState<ConnectionCreateBody>({
    source_type: "flight",
    source_id: 0,
    target_type: "hotel",
    target_id: 0,
    connection_type: "only",
    client_targeting: "all",
    selected_client_ids: [],
    notes: "",
  });
  const [clients, setClients] = useState<CompanyClientOption[]>([]);
  const [clientsBusy, setClientsBusy] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    setClientsBusy(true);
    apiCompanyClients(token, companyId)
      .then((res) => setClients(res.data ?? []))
      .catch(() => setClients([]))
      .finally(() => setClientsBusy(false));
  }, [token, companyId]);

  const set = (patch: Partial<ConnectionCreateBody>) => setF((p) => ({ ...p, ...patch }));
  const toggleClient = (id: number, checked: boolean) =>
    setF((p) => {
      const prev = new Set(p.selected_client_ids ?? []);
      if (checked) prev.add(id);
      else prev.delete(id);
      return { ...p, selected_client_ids: Array.from(prev) };
    });

  async function submit() {
    if (!token) return;
    const body: ConnectionCreateBody = {
      source_type: f.source_type,
      source_id: Number(f.source_id),
      target_type: f.target_type,
      target_id: Number(f.target_id),
      connection_type: f.connection_type,
      targeting: {
        mode: f.client_targeting ?? "all",
        client_ids:
          f.client_targeting === "selected"
            ? Array.from(new Set((f.selected_client_ids ?? []).filter((id) => id > 0)))
            : undefined,
      },
      notes: f.notes?.trim() ? f.notes.trim() : undefined,
    };
    if (!body.source_id || !body.target_id) {
      alert(s.errGeneric);
      return;
    }
    if (body.targeting?.mode === "selected" && (body.targeting.client_ids?.length ?? 0) === 0) {
      alert(s.cnSelectClientRequired);
      return;
    }
    setBusy(true);
    try {
      await apiConnectionCreate(token, body);
      onCreated();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{s.cnNew}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="fld">
              <label className="fld-label">{s.cnSourceType}</label>
              <select value={f.source_type} onChange={(e) => set({ source_type: e.target.value })}>
                {CONNECTION_SOURCE_TYPES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.cnSourceId}</label>
              <input type="number" min={1} value={f.source_id || ""} onChange={(e) => set({ source_id: Number(e.target.value) })} />
            </div>
            <div className="fld">
              <label className="fld-label">{s.cnTargetType}</label>
              <select value={f.target_type} onChange={(e) => set({ target_type: e.target.value })}>
                {CONNECTION_TARGET_TYPES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.cnTargetId}</label>
              <input type="number" min={1} value={f.target_id || ""} onChange={(e) => set({ target_id: Number(e.target.value) })} />
            </div>
            <div className="fld">
              <label className="fld-label">{s.cnConnType}</label>
              <select value={f.connection_type} onChange={(e) => set({ connection_type: e.target.value as ConnectionCreateBody["connection_type"] })}>
                <option value="only">{s.cnConnOnly}</option>
                <option value="both">{s.cnConnBoth}</option>
              </select>
            </div>
            <div className="fld">
              <label className="fld-label">{s.cnTargeting}</label>
              <select
                value={f.client_targeting ?? "all"}
                onChange={(e) =>
                  set({
                    client_targeting: e.target.value as "all" | "selected",
                    selected_client_ids: e.target.value === "selected" ? f.selected_client_ids ?? [] : [],
                  })
                }
              >
                <option value="all">{s.cnTargetingAll}</option>
                <option value="selected">{s.cnTargetingSelected}</option>
              </select>
            </div>
          </div>

          {f.client_targeting === "selected" && (
            <div className="fld" style={{ marginTop: 12 }}>
              <label className="fld-label">{s.cnSelectedClients}</label>
              <input type="search" placeholder={s.cnSearchClients} value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} style={{ marginBottom: 8 }} />
              {clientsBusy ? (
                <p className="cell-muted text-sm">{s.cnLoadingClients}</p>
              ) : clients.length === 0 ? (
                <p className="cell-muted text-sm">{s.cnEmptyClients}</p>
              ) : (
                <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: 8 }}>
                  {clients
                    .filter((c) => {
                      const q = clientQuery.trim().toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                    })
                    .map((c) => (
                      <label key={c.id} className="switch-row" style={{ cursor: "pointer", justifyContent: "space-between", padding: "4px 0" }}>
                        <span className="text-sm">{c.name} <span className="cell-muted">({c.email})</span></span>
                        <input type="checkbox" checked={(f.selected_client_ids ?? []).includes(c.id)} onChange={(e) => toggleClient(c.id, e.target.checked)} />
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="fld" style={{ marginTop: 12 }}>
            <label className="fld-label">{s.cnNotes}</label>
            <input value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            <i className="ti ti-device-floppy" />{busy ? s.cnCreating : s.cnSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// RBAC pane (Permissions cluster) — role overview (stats + table +
// create/edit modal + PIN-gated delete) above the embedded
// RbacMenuTree permission editor for the selected role. Reuses the
// self-contained RbacMenuTree + PinPromptDialog exactly as the
// standalone /platform/rbac page did (Card 2 was always that tree).
// ════════════════════════════════════════════════════════════════

function rbBadgeTone(name: string): string {
  const n = name.toLowerCase();
  if (n === "super_admin" || n === "super admin") return "badge-danger";
  if (n === "platform_admin" || n === "platform admin") return "badge-primary";
  if (n === "operator_admin" || n === "operator" || n === "operator admin" || n === "company_manager") return "badge-info";
  if (n === "company_admin" || n === "company admin" || n === "admin" || n === "owner") return "badge-primary";
  if (n === "agent" || n === "booker") return "badge-success";
  return "badge-gray";
}
function rbPretty(name: string): string {
  return name.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());
}

/** Clear, translated display name for the known roles (Arshak's 3-concept model);
 *  falls back to the prettified raw name for any other role. Internal role names
 *  are unchanged — this is display only. */
function rbRoleLabel(role: { name: string; display_name?: string | null }, s: ReturnType<typeof settingsStrings>): string {
  // Arshak's editable display name wins; otherwise the localized default label.
  if (role.display_name && role.display_name.trim() !== "") return role.display_name.trim();
  switch (role.name.toLowerCase()) {
    case "super_admin": return s.rbRoleSuper;
    case "platform_admin": return s.rbRoleStaff;
    case "company_admin": return s.rbRoleOwner;
    case "operator_admin": return s.rbRoleManager;
    case "company_manager": return s.rbRoleManager;
    case "company_operator": return s.rbRoleOperatorStaff;
    case "company_viewer": return s.rbRoleViewer;
    case "agent": return s.rbRoleAgent;
    default: return rbPretty(role.name);
  }
}

type RbForm = { name: string; display_name: string; description: string; scope: RbacRoleScope };

function RbacPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const { user } = useAdminAuth();
  const isSuper = user?.is_super_admin === true;

  const [stats, setStats] = useState<RbacStatsData | null>(null);
  const [roles, setRoles] = useState<RbacRoleRow[]>([]);
  const [permTotal, setPermTotal] = useState(0);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ mode: "create" } | { mode: "edit"; role: RbacRoleRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinRole, setPinRole] = useState<RbacRoleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [st, rl, pm] = await Promise.all([
        apiRbacStats(token).catch(() => null),
        apiRbacRoles(token),
        apiRbacPermissions(token).catch(() => null),
      ]);
      if (st) setStats(st.data);
      if (pm) setPermTotal(pm.data?.length ?? 0);
      const list = rl.data ?? [];
      setRoles(list);
      setSelectedRoleId((curr) => (curr != null && list.some((r) => r.id === curr) ? curr : list[0]?.id ?? null));
    } catch (e) {
      console.error("rbac load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  const visibleRoles = isSuper ? roles : roles.filter((r) => r.scope === "company");
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const canEditRole = (r: RbacRoleRow) => !(r.scope === "platform" && !isSuper);
  const canDeleteRole = (r: RbacRoleRow) =>
    r.name.toLowerCase() !== "super_admin" && !(r.scope === "platform" && !isSuper);

  async function save(form: RbForm) {
    if (!token || !modal) return;
    setBusy(true);
    try {
      if (modal.mode === "edit") {
        await apiRbacUpdateRole(token, modal.role.id, {
          display_name: form.display_name.trim() || null,
          description: form.description.trim(),
          scope: form.scope,
        });
      } else {
        const created = await apiRbacCreateRole(token, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          scope: form.scope,
        });
        if (created.data) setSelectedRoleId(created.data.id);
      }
      setModal(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!token || !pinRole) return;
    setDeleting(true);
    try {
      await apiRbacDeleteRole(token, pinRole.id);
      if (selectedRoleId === pinRole.id) setSelectedRoleId(null);
      setPinRole(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : s.errGeneric);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {stats && (
        <div className="stat-grid">
          <div className="stat-card c-primary"><div className="stat-header"><i className="ti ti-shield-lock" /></div><div className="stat-value">{stats.total_roles}</div><div className="stat-label">{s.rbStatRoles}</div></div>
          <div className="stat-card c-info"><div className="stat-header"><i className="ti ti-key" /></div><div className="stat-value">{stats.total_permissions}</div><div className="stat-label">{s.rbStatPermissions}</div></div>
          <div className="stat-card c-success"><div className="stat-header"><i className="ti ti-users" /></div><div className="stat-value">{stats.total_memberships}</div><div className="stat-label">{s.rbStatMemberships}</div></div>
          <div className="stat-card c-warning"><div className="stat-header"><i className="ti ti-lock-access" /></div><div className="stat-value">{stats.super_admins}</div><div className="stat-label">{s.rbStatSuperAdmins}</div></div>
        </div>
      )}

      <div className="filter-card">
        <div className="cell-muted text-sm">{s.rbRoleOverview}</div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => setModal({ mode: "create" })}><i className="ti ti-plus" />{s.rbNewRole}</button>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{s.rbColRole}</th>
                <th>{s.rbColDescription}</th>
                <th className="num-cell">{s.rbColMembers}</th>
                <th className="num-cell">{s.rbColPermissions}</th>
                <th style={{ textAlign: "right" }}>{s.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {loading && visibleRoles.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.loading}</td></tr>
              ) : visibleRoles.length === 0 ? (
                <tr><td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: 30 }}>{s.rbEmpty}</td></tr>
              ) : (
                visibleRoles.map((r) => (
                  <tr key={r.id} onClick={() => setSelectedRoleId(r.id)} style={{ cursor: "pointer", background: selectedRoleId === r.id ? "var(--bg-secondary)" : undefined }}>
                    <td><span className={`badge ${rbBadgeTone(r.name)}`}>{rbRoleLabel(r, s)}</span></td>
                    <td className="cell-muted text-sm">{r.description || "—"}</td>
                    <td className="num-cell">{r.memberships_count}</td>
                    <td className="num-cell cell-muted">{r.permissions.length} / {permTotal}</td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        {canEditRole(r) && <button className="icon-btn" title={s.edit} onClick={() => setModal({ mode: "edit", role: r })}><i className="ti ti-edit" /></button>}
                        {canDeleteRole(r) && <button className="icon-btn danger" title={s.delete} onClick={() => setPinRole(r)}><i className="ti ti-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card 2 — the menu-mirror permission tree for the selected role
          (self-contained component, reused as-is). */}
      <div style={{ marginTop: 16 }}>
        {token ? (
          <RbacMenuTree
            token={token}
            roleId={selectedRoleId}
            roleName={selectedRole ? rbRoleLabel(selectedRole, s) : undefined}
            roleScope={selectedRole?.scope ?? null}
            canEdit={isSuper}
          />
        ) : null}
      </div>

      {modal && (
        <RbacRoleModal
          state={modal}
          busy={busy}
          lang={lang}
          isSuper={isSuper}
          onClose={() => setModal(null)}
          onSave={(f) => void save(f)}
        />
      )}

      <PinPromptDialog
        isOpen={pinRole !== null}
        title={s.rbDeleteTitle}
        description={
          pinRole ? (
            <>
              {s.rbPinGate} <strong>{rbRoleLabel(pinRole, s)}</strong>.
              {pinRole.memberships_count > 0 ? (
                <span style={{ display: "block", marginTop: 8 }}>{s.rbDeleteBlocked}</span>
              ) : null}
            </>
          ) : undefined
        }
        onCancel={() => (deleting ? undefined : setPinRole(null))}
        onConfirm={async () => {
          await doDelete();
        }}
      />
    </div>
  );
}

function RbacRoleModal({
  state,
  busy,
  lang,
  isSuper,
  onClose,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; role: RbacRoleRow };
  busy: boolean;
  lang: string;
  isSuper: boolean;
  onClose: () => void;
  onSave: (f: RbForm) => void;
}) {
  const s = settingsStrings(lang);
  const isEdit = state.mode === "edit";
  const [f, setF] = useState<RbForm>(
    isEdit
      ? { name: state.role.name, display_name: state.role.display_name ?? "", description: state.role.description ?? "", scope: state.role.scope }
      : { name: "", display_name: "", description: "", scope: "company" }
  );
  useEffect(() => {
    if (state.mode === "edit") {
      setF({ name: state.role.name, display_name: state.role.display_name ?? "", description: state.role.description ?? "", scope: state.role.scope });
    } else {
      setF({ name: "", display_name: "", description: "", scope: "company" });
    }
  }, [state]);
  const set = (patch: Partial<RbForm>) => setF((p) => ({ ...p, ...patch }));
  const valid = isEdit || f.name.trim() !== "";

  return (
    <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? s.rbEditTitle : s.rbCreateTitle}</div>
          <button className="icon-btn" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            {isEdit ? (
              <>
                <div className="fld" style={{ gridColumn: "1 / -1" }}>
                  <label className="fld-label">{s.rbFldDisplayName}</label>
                  <input
                    value={f.display_name}
                    placeholder={rbRoleLabel({ name: state.role.name, display_name: null }, s)}
                    onChange={(e) => set({ display_name: e.target.value })}
                  />
                  <span className="cell-muted text-sm" style={{ marginTop: 4 }}>{s.rbFldDisplayNameHelp}</span>
                </div>
                <div className="fld" style={{ gridColumn: "1 / -1" }}>
                  <label className="fld-label">{s.rbFldSlug}</label>
                  <input value={f.name} disabled />
                  <span className="cell-muted text-sm" style={{ marginTop: 4 }}>{s.rbFldNameLocked}</span>
                </div>
              </>
            ) : (
              <div className="fld" style={{ gridColumn: "1 / -1" }}>
                <label className="fld-label">{s.rbFldName}</label>
                <input value={f.name} placeholder="operator_admin" onChange={(e) => set({ name: e.target.value })} />
                <span className="cell-muted text-sm" style={{ marginTop: 4 }}>{s.rbFldNameHelp}</span>
              </div>
            )}
            <div className="fld" style={{ gridColumn: "1 / -1" }}>
              <label className="fld-label">{s.rbFldDescription}</label>
              <input value={f.description} placeholder={s.rbFldDescriptionPh} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="fld" style={{ gridColumn: "1 / -1" }}>
              <label className="fld-label">{s.rbFldScope}</label>
              <select value={f.scope} disabled={!isSuper} onChange={(e) => set({ scope: e.target.value as RbacRoleScope })}>
                <option value="company">{s.rbScopeCompany}</option>
                <option value="platform">{s.rbScopePlatform}</option>
              </select>
              <span className="cell-muted text-sm" style={{ marginTop: 4 }}>{s.rbFldScopeHelp}</span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{s.cancel}</button>
          <button className="btn btn-primary" disabled={busy || !valid} onClick={() => onSave(f)}>
            <i className="ti ti-device-floppy" />{busy ? "…" : isEdit ? s.save : s.create}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// API docs pane (System cluster) — Swagger UI viewer in the unified
// chrome. Injects the swagger-ui-dist CDN bundle once and mounts it
// to #swagger-ui-root, auth'ing each request with the admin bearer
// token (same behaviour as the retired standalone page).
// ════════════════════════════════════════════════════════════════

type SwaggerBundle = ((cfg: Record<string, unknown>) => void) & { presets: { apis: unknown } };

function ApiDocsPane({ token, lang }: { token: string | null; lang: string }) {
  const s = settingsStrings(lang);
  const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://api.zulu.am";

  useEffect(() => {
    if (!token) return;
    const cssId = "swagger-ui-css";
    if (!document.getElementById(cssId)) {
      const cssEl = document.createElement("link");
      cssEl.id = cssId;
      cssEl.rel = "stylesheet";
      cssEl.href = "https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css";
      document.head.appendChild(cssEl);
    }

    const initSwagger = () => {
      const SwaggerUIBundle = (window as unknown as { SwaggerUIBundle?: SwaggerBundle }).SwaggerUIBundle;
      if (!SwaggerUIBundle) return;
      SwaggerUIBundle({
        url: `${baseURL}/platform-admin/openapi.json`,
        dom_id: "#swagger-ui-root",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
        requestInterceptor: (req: { headers: Record<string, string> }) => {
          req.headers["Authorization"] = `Bearer ${token}`;
          req.headers["Accept"] = "application/json";
          return req;
        },
      });
    };

    const jsId = "swagger-ui-js";
    const jsEl = document.getElementById(jsId) as HTMLScriptElement | null;
    if (!jsEl) {
      const el = document.createElement("script");
      el.id = jsId;
      el.src = "https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js";
      el.async = true;
      el.onload = initSwagger;
      document.body.appendChild(el);
    } else {
      initSwagger();
    }
  }, [token, baseURL]);

  return (
    <div>
      <div className="alert"><i className="ti ti-info-circle" /><div>{s.adNote}</div></div>
      <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
        <div id="swagger-ui-root" style={{ background: "#fff" }} />
      </div>
    </div>
  );
}
