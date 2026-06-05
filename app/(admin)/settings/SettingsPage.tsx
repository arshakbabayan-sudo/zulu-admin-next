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
  type PlatformReviewRow,
} from "@/lib/platform-admin-api";
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
};

const PAGES: Record<SettingsPageKey, PageMeta> = {
  "pricing-rules":     { cluster: "money", labelKey: "pgPricingRules", subKey: "subPricingRules", super: true, inPage: true, href: "/settings/pricing-rules" },
  "money-flow":        { cluster: "money", labelKey: "pgMoneyFlow", subKey: "subMoneyFlow", super: true, inPage: true, href: "/settings/money-flow" },
  "exchange-rates":    { cluster: "money", labelKey: "pgExchangeRates", subKey: "subExchangeRates", super: true, inPage: true, href: "/settings/exchange-rates" },
  "rbac":              { cluster: "permissions", labelKey: "pgRbac", super: true, href: "/platform/rbac" },
  "languages":         { cluster: "localization", labelKey: "pgLanguages", super: true, inPage: true, href: "/localization/languages" },
  "ui-strings":        { cluster: "localization", labelKey: "pgUiStrings", super: true, inPage: true, href: "/localization/ui-translations" },
  "content-tr":        { cluster: "localization", labelKey: "pgContentTr", super: false, href: "/localization/translations" },
  "email-tpl":         { cluster: "localization", labelKey: "pgEmailTpl", super: false, href: "/localization/templates" },
  "cms-pages":         { cluster: "content", labelKey: "pgCmsPages", super: true, href: "/pages" },
  "banners":           { cluster: "content", labelKey: "pgBanners", super: true, href: "/platform/banners" },
  "sys-notif":         { cluster: "content", labelKey: "pgSysNotif", super: true, href: "/platform/notifications" },
  "newsletter":        { cluster: "content", labelKey: "pgNewsletter", super: false, href: "/platform/newsletter" },
  "header-menu":       { cluster: "layout", labelKey: "pgHeaderMenu", super: true, href: "/platform/settings/header-menu" },
  "footer":            { cluster: "layout", labelKey: "pgFooter", super: true, href: "/platform/settings/footer" },
  "brand":             { cluster: "layout", labelKey: "pgBrand", super: true, href: "/platform/settings/brand" },
  "loyalty":           { cluster: "marketing", labelKey: "pgLoyalty", super: false, href: "/platform/loyalty" },
  "security":          { cluster: "system", labelKey: "pgSecurity", super: true, href: "/platform/security" },
  "webhooks":          { cluster: "system", labelKey: "pgWebhooks", super: true, href: "/platform/webhooks" },
  "locations":         { cluster: "system", labelKey: "pgLocations", super: true, inPage: true, href: "/platform/locations" },
  "api-docs":          { cluster: "system", labelKey: "pgApiDocs", super: true, href: "/platform/api-docs" },
  "connections":       { cluster: "system", labelKey: "pgConnections", super: false, href: "/connections" },
  "platform-settings": { cluster: "system", labelKey: "pgPlatformSettings", super: true, href: "/platform/settings" },
  "support-tickets":   { cluster: "support", labelKey: "pgSupportTickets", super: false, inPage: true, href: "/support/tickets" },
  "reviews":           { cluster: "support", labelKey: "pgReviews", super: true, inPage: true, href: "/platform/reviews" },
};

const CLUSTERS: Array<{ key: ClusterKey; labelKey: SettingsKey; icon: string }> = [
  { key: "money", labelKey: "clMoney", icon: "ti-coin" },
  { key: "permissions", labelKey: "clPermissions", icon: "ti-lock-access" },
  { key: "localization", labelKey: "clLocalization", icon: "ti-language" },
  { key: "content", labelKey: "clContent", icon: "ti-article" },
  { key: "layout", labelKey: "clLayout", icon: "ti-layout-2" },
  { key: "marketing", labelKey: "clMarketing", icon: "ti-speakerphone" },
  { key: "system", labelKey: "clSystem", icon: "ti-server-cog" },
  { key: "support", labelKey: "clSupport", icon: "ti-lifebuoy" },
];

const PAGES_BY_CLUSTER: Record<ClusterKey, SettingsPageKey[]> = (() => {
  const m = {} as Record<ClusterKey, SettingsPageKey[]>;
  for (const c of CLUSTERS) m[c.key] = [];
  (Object.keys(PAGES) as SettingsPageKey[]).forEach((k) => m[PAGES[k].cluster].push(k));
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
        window.scrollTo({ top: 0, behavior: "smooth" });
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

  return (
    <div className="mgmt-page mgmt-page-host">
      <div className={`layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={() => setSidebarCollapsed((v) => !v)}
            title={`${s.sectionSettings} · ${title}`}
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
                  <span>{s[CLUSTERS.find((c) => c.key === activeCluster)!.labelKey]}</span>
                  <i className="ti ti-chevron-right" />
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
              {PAGES_BY_CLUSTER[activeCluster].map((k) => (
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
