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
  "languages":         { cluster: "localization", labelKey: "pgLanguages", super: true, href: "/localization/languages" },
  "ui-strings":        { cluster: "localization", labelKey: "pgUiStrings", super: true, href: "/localization/ui-translations" },
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
  "locations":         { cluster: "system", labelKey: "pgLocations", super: true, href: "/platform/locations" },
  "api-docs":          { cluster: "system", labelKey: "pgApiDocs", super: true, href: "/platform/api-docs" },
  "connections":       { cluster: "system", labelKey: "pgConnections", super: false, href: "/connections" },
  "platform-settings": { cluster: "system", labelKey: "pgPlatformSettings", super: true, href: "/platform/settings" },
  "support-tickets":   { cluster: "support", labelKey: "pgSupportTickets", super: false, href: "/support/tickets" },
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
