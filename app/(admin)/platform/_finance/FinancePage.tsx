"use client";

/**
 * admin v3 — unified Finance surface. 1:1 port of
 * docs/admin_designe/6_Finance/finance.html.
 *
 * ONE page, a single-level `.section-tabs` strip over 7 tabs (Finance summary ·
 * Invoices · Payments · Commissions · Transactions · Vouchers · Per-X invoicing),
 * rendered in the same self-contained mgmt chrome as Inventory / Bookings / CRM /
 * Settings (Sidebar + Header reused from MgmtPage, management.css, off-canvas
 * mobile nav). Each tab is an in-page pane. Per-X is SUPER-ADMIN ONLY — the tab
 * and pane are absent for non-super users.
 *
 * Role scoping (INTEGRATION.md §2) is enforced server-side; the whole section is
 * gated by canAccessFinanceSection. Every shell/common string routes through
 * finance-i18n.ts so the language toggle swaps the page.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import "../management/management.css";
import { Sidebar, Header } from "../management/MgmtPage";
import { useMgmtMobileNav } from "@/lib/use-mgmt-mobile-nav";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  canAccessFinanceSection,
  canAccessNotificationsNav,
  canAccessPlatformAdminNav,
} from "@/lib/access";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import { financeStrings, type FinanceKey } from "./finance-i18n";
import type { FinanceTab } from "./types";
import { SummaryPane } from "./panes/SummaryPane";
import { InvoicesPane } from "./panes/InvoicesPane";
import { PaymentsPane } from "./panes/PaymentsPane";
import { CommissionsPane } from "./panes/CommissionsPane";
import { TransactionsPane } from "./panes/TransactionsPane";
import { VouchersPane } from "./panes/VouchersPane";
import { PerxPane } from "./panes/PerxPane";

const TAB_HREF: Record<FinanceTab, string> = {
  summary: "/platform/finance-summary",
  invoices: "/platform/invoices",
  payments: "/platform/payments",
  commissions: "/platform/commissions",
  transactions: "/platform/finance",
  vouchers: "/platform/vouchers",
  perx: "/bucket3/per-x-invoicing",
};

const TABS: Array<{ key: FinanceTab; icon: string; labelKey: FinanceKey; subKey: FinanceKey; superOnly?: boolean }> = [
  { key: "summary", icon: "ti-chart-pie", labelKey: "tabSummary", subKey: "subSummary" },
  { key: "invoices", icon: "ti-file-invoice", labelKey: "tabInvoices", subKey: "subInvoices" },
  { key: "payments", icon: "ti-credit-card", labelKey: "tabPayments", subKey: "subPayments" },
  { key: "commissions", icon: "ti-percentage", labelKey: "tabCommissions", subKey: "subCommissions" },
  { key: "transactions", icon: "ti-arrows-exchange", labelKey: "tabTransactions", subKey: "subTransactions" },
  { key: "vouchers", icon: "ti-ticket", labelKey: "tabVouchers", subKey: "subVouchers" },
  { key: "perx", icon: "ti-table", labelKey: "tabPerx", subKey: "subPerx", superOnly: true },
];

export function FinancePage({ initialTab = "summary" }: { initialTab?: FinanceTab }) {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();
  const s = financeStrings(lang);

  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const isSuper = !!(user?.is_super_admin || canAccessPlatformAdminNav(user));
  const allowed = canAccessFinanceSection(user);

  const visibleTabs = TABS.filter((t) => !t.superOnly || isSuper);
  const [tab, setTab] = useState<FinanceTab>(initialTab);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionNode, setActionNode] = useState<ReactNode>(null);
  const [counts, setCounts] = useState<Partial<Record<FinanceTab, number>>>({});
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);

  const showToast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    // a non-super landing on the perx route falls back to summary
    const wanted = TABS.find((t) => t.key === initialTab);
    setTab(wanted && (!wanted.superOnly || isSuper) ? initialTab : "summary");
  }, [initialTab, isSuper]);

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
    return () => { cancelled = true; };
  }, [token, user]);

  const showTab = useCallback(
    (key: FinanceTab) => {
      if (key === tab) return;
      setActionNode(null);
      setTab(key);
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", TAB_HREF[key]);
      }
      document.querySelector(".mgmt-page .main")?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [tab],
  );

  const reportCount = useCallback(
    (n: number | undefined) => {
      setCounts((prev) => (prev[tab] === n ? prev : { ...prev, [tab]: n }));
    },
    [tab],
  );

  const active = visibleTabs.find((t) => t.key === tab) ?? visibleTabs[0]!;
  const title = s[active.labelKey];
  const subtitle = s[active.subKey];

  const paneProps = {
    token,
    user: user ?? null,
    lang,
    isSuper,
    registerAction: setActionNode,
    reportCount,
    showToast,
  };

  const body = (() => {
    if (!allowed) {
      return (
        <div className="empty-state">
          <div className="es-icon"><i className="ti ti-lock" /></div>
          <div className="es-title">{s.forbidden}</div>
        </div>
      );
    }
    switch (tab) {
      case "summary": return <SummaryPane {...paneProps} />;
      case "invoices": return <InvoicesPane {...paneProps} />;
      case "payments": return <PaymentsPane {...paneProps} />;
      case "commissions": return <CommissionsPane {...paneProps} />;
      case "transactions": return <TransactionsPane {...paneProps} />;
      case "vouchers": return <VouchersPane {...paneProps} />;
      case "perx": return isSuper ? <PerxPane {...paneProps} /> : <div className="empty-state"><div className="es-icon"><i className="ti ti-lock" /></div><div className="es-title">{s.perxSuperOnly}</div></div>;
      default: return null;
    }
  })();

  return (
    <div className="mgmt-page mgmt-page-host">
      <div className={layoutClass}>
        <Sidebar collapsed={sidebarCollapsed} unreadCount={unreadCount} />
        <div className="nav-overlay" onClick={closeNav} />
        <div className="main">
          <Header
            collapsed={sidebarCollapsed}
            onHamburger={onHamburger}
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
                  <a onClick={() => showTab("summary")}>{s.finance}</a>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">{title}</span>
                </div>
                <h1 className="page-title">
                  <span>{title}</span>
                  {isSuper && (
                    <span className="super-tag">
                      <i className="ti ti-shield-lock" style={{ fontSize: 13 }} />
                      {s.superAdmin}
                    </span>
                  )}
                </h1>
                <div className="page-subtitle">{subtitle}</div>
              </div>
              <div className="operator-cta" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {actionNode}
              </div>
            </div>

            {/* one-level section tabs */}
            <div className="section-tabs">
              {visibleTabs.map((tdef) => (
                <button
                  key={tdef.key}
                  className={`section-tab ${tdef.key === tab ? "active" : ""}`}
                  onClick={() => showTab(tdef.key)}
                >
                  <i className={`ti ${tdef.icon}`} />
                  {s[tdef.labelKey]}
                  {counts[tdef.key] != null && <span className="count">{counts[tdef.key]}</span>}
                </button>
              ))}
            </div>

            {body}
          </div>
        </div>
      </div>

      {/* Toast host */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast show" key={t.id}>
            <i className="ti ti-circle-check" />
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
