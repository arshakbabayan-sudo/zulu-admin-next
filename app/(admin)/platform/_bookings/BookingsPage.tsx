"use client";

/**
 * admin v3 — unified Bookings surface. 1:1 port of
 * docs/admin_designe/3_Bookings/bookings.html.
 *
 * ONE page, a single-level `.section-tabs` strip over the two tabs
 * (All bookings · Package orders), rendered in the same self-contained mgmt
 * chrome as CRM / Settings / Dashboard / Inventory (Sidebar + Header reused
 * from MgmtPage, management.css, off-canvas mobile nav). All bookings toggles a
 * full-page IN-PANE detail; Package orders opens a read-only drawer. Both tabs
 * carry a count pill from their stats endpoint.
 *
 * Role scoping (INTEGRATION.md §3) is enforced server-side: super sees every
 * company (+ a `Super admin` pill); operator/agent/employee are tenant-scoped.
 * Every user-facing string is routed through bookings-i18n.ts so the language
 * toggle swaps the whole page.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import "../management/management.css";
import { Sidebar, Header } from "../management/MgmtPage";
import { useMgmtMobileNav } from "@/lib/use-mgmt-mobile-nav";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessNotificationsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import { bookingsStrings, type BookingsKey } from "./bookings-i18n";
import type { BookingsTab } from "./types";
import { AllBookingsPane } from "./panes/AllBookingsPane";
import { PackageOrdersPane } from "./panes/PackageOrdersPane";

const TABS: Array<{ key: BookingsTab; icon: string; labelKey: BookingsKey; subKey: BookingsKey }> = [
  { key: "bookings", icon: "ti-calendar-event", labelKey: "tabAllBookings", subKey: "subAllBookings" },
  { key: "packages", icon: "ti-package", labelKey: "tabPackageOrders", subKey: "subPackageOrders" },
];

export function BookingsPage({
  initialTab = "bookings",
  initialBookingId,
}: {
  initialTab?: BookingsTab;
  initialBookingId?: string;
}) {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();
  const s = bookingsStrings(lang);

  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const [tab, setTab] = useState<BookingsTab>(initialTab);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionNode, setActionNode] = useState<ReactNode>(null);
  const [crumbOverride, setCrumbOverride] = useState<string | null>(null);
  const [counts, setCounts] = useState<Partial<Record<BookingsTab, number>>>({});
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string }>>([]);

  const showToast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  useEffect(() => { setTab(initialTab); }, [initialTab]);

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

  const isSuper = !!(user?.is_super_admin || canAccessPlatformAdminNav(user));

  const showTab = useCallback(
    (key: BookingsTab) => {
      if (key === tab) return;
      setActionNode(null);
      setCrumbOverride(null);
      setTab(key);
      if (typeof window !== "undefined") {
        const href = key === "packages" ? "/platform/package-orders" : "/platform/bookings";
        window.history.replaceState(window.history.state, "", href);
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

  const active = TABS.find((t) => t.key === tab)!;
  const title = s[active.labelKey];
  const subtitle = s[active.subKey];

  const paneProps = {
    token,
    user: user ?? null,
    lang,
    isSuper,
    registerAction: setActionNode,
    reportCount,
    setCrumbOverride,
    showToast,
  };

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
                  <a onClick={() => showTab("bookings")}>{s.bookings}</a>
                  <i className="ti ti-chevron-right" />
                  <span className="breadcrumb-current">{crumbOverride ?? title}</span>
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

            {/* one-level section tabs — the 2 surfaces, fixed order */}
            <div className="section-tabs">
              {TABS.map((tdef) => (
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

            {/* active pane */}
            {tab === "bookings" && <AllBookingsPane {...paneProps} initialBookingId={initialBookingId} />}
            {tab === "packages" && <PackageOrdersPane {...paneProps} />}
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
