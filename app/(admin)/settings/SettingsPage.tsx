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
  "pricing-rules":     { cluster: "money", labelKey: "pgPricingRules", subKey: "subPricingRules", super: true, href: "/settings/pricing-rules" },
  "money-flow":        { cluster: "money", labelKey: "pgMoneyFlow", subKey: "subMoneyFlow", super: true, href: "/settings/money-flow" },
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
  "reviews":           { cluster: "support", labelKey: "pgReviews", super: true, href: "/platform/reviews" },
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
            {page === "exchange-rates" && <ExchangeRatesPane token={token} lang={lang} />}
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
