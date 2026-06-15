"use client";

/**
 * admin v3 — unified Inventory surface. 1:1 port of
 * docs/admin_designe/2_Inventory/inventory.html.
 *
 * ONE page, a single-level `.section-tabs` strip over the 9 verticals
 * (Hotels · Flights · Transfers · Cars · Excursions · Visas · Packages ·
 * Offers · External API), rendered in the same self-contained mgmt chrome as
 * CRM / Settings / Dashboard (Sidebar + Header reused from MgmtPage,
 * management.css, off-canvas mobile nav). Each tab is an in-page pane that
 * swaps the list ↔ in-pane detail/form without navigating away.
 *
 * Role scoping (INTEGRATION.md §2):
 *   operator    → the 9 tabs, own company only, full CRUD.
 *   super_admin → same 9 tabs + a header scope toggle (Operator | Oversight);
 *                 oversight is cross-company read-only (handled per-pane).
 *   agent       → no Inventory at all (gated upstream by `inventory.view`).
 *
 * Every user-facing string is routed through inventory-i18n.ts
 * (inventoryStrings(lang)) so the language toggle swaps the whole page.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import "../../platform/management/management.css";
import { Sidebar, Header } from "../../platform/management/MgmtPage";
import { useMgmtMobileNav } from "@/lib/use-mgmt-mobile-nav";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessNotificationsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import { inventoryStrings, type InventoryKey } from "./inventory-i18n";
import type { InventoryScope, InventoryTab } from "./types";
import { HotelsPane } from "./panes/HotelsPane";
import { FlightsPane } from "./panes/FlightsPane";
import { TransfersPane } from "./panes/TransfersPane";
import { CarsPane } from "./panes/CarsPane";
import { ExcursionsPane } from "./panes/ExcursionsPane";
import { VisasPane } from "./panes/VisasPane";
import { PackagesPane } from "./panes/PackagesPane";
import { OffersPane } from "./panes/OffersPane";
import { ExternalApiPane } from "./panes/ExternalApiPane";

const TABS: Array<{ key: InventoryTab; icon: string; labelKey: InventoryKey; subKey: InventoryKey }> = [
  { key: "hotels", icon: "ti-building-skyscraper", labelKey: "tabHotels", subKey: "subHotels" },
  { key: "flights", icon: "ti-plane-tilt", labelKey: "tabFlights", subKey: "subFlights" },
  { key: "transfers", icon: "ti-car", labelKey: "tabTransfers", subKey: "subTransfers" },
  { key: "cars", icon: "ti-steering-wheel", labelKey: "tabCars", subKey: "subCars" },
  { key: "excursions", icon: "ti-map-2", labelKey: "tabExcursions", subKey: "subExcursions" },
  { key: "visas", icon: "ti-id-badge-2", labelKey: "tabVisas", subKey: "subVisas" },
  { key: "packages", icon: "ti-package", labelKey: "tabPackages", subKey: "subPackages" },
  { key: "offers", icon: "ti-tag", labelKey: "tabOffers", subKey: "subOffers" },
  { key: "external-api", icon: "ti-plug-connected", labelKey: "tabExternalApi", subKey: "subExternalApi" },
];

export function InventoryPage({ initialTab = "hotels" }: { initialTab?: InventoryTab }) {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();
  const s = inventoryStrings(lang);

  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const [tab, setTab] = useState<InventoryTab>(initialTab);
  const [scope, setScope] = useState<InventoryScope>("operator");
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionNode, setActionNode] = useState<ReactNode>(null);
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
    (key: InventoryTab) => {
      if (key === tab) return;
      setActionNode(null);
      setTab(key);
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", `/operator/${key}`);
      }
      document.querySelector(".mgmt-page .main")?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [tab]
  );

  const active = TABS.find((t) => t.key === tab)!;
  const title = s[active.labelKey];
  const subtitle = s[active.subKey];

  const paneProps = {
    token,
    user: user ?? null,
    lang,
    scope: isSuper ? scope : ("operator" as InventoryScope),
    isSuper,
    registerAction: setActionNode,
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
          <div className={`page${isSuper && scope === "oversight" ? " oversight" : ""}`}>
            <div className="page-header">
              <div>
                <div className="breadcrumb">
                  <a onClick={() => router.push("/dashboard")}>{s.breadcrumbHome}</a>
                  <i className="ti ti-chevron-right" />
                  <span>{s.inventory}</span>
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
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {isSuper && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: ".4px",
                      }}
                    >
                      {s.scope}
                    </span>
                    <div className="lang-seg">
                      <button
                        className={scope === "operator" ? "active" : ""}
                        onClick={() => setScope("operator")}
                      >
                        {s.scopeOperator}
                      </button>
                      <button
                        className={scope === "oversight" ? "active" : ""}
                        onClick={() => setScope("oversight")}
                      >
                        {s.scopeOversight}
                      </button>
                    </div>
                  </div>
                )}
                <div className="operator-cta" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {actionNode}
                </div>
              </div>
            </div>

            {/* one-level section tabs — the 9 verticals, fixed order */}
            <div className="section-tabs">
              {TABS.map((tdef) => (
                <button
                  key={tdef.key}
                  className={`section-tab ${tdef.key === tab ? "active" : ""}`}
                  onClick={() => showTab(tdef.key)}
                >
                  <i className={`ti ${tdef.icon}`} />
                  {s[tdef.labelKey]}
                </button>
              ))}
            </div>

            {/* active pane */}
            {tab === "hotels" && <HotelsPane {...paneProps} />}
            {tab === "flights" && <FlightsPane {...paneProps} />}
            {tab === "transfers" && <TransfersPane {...paneProps} />}
            {tab === "cars" && <CarsPane {...paneProps} />}
            {tab === "excursions" && <ExcursionsPane {...paneProps} />}
            {tab === "visas" && <VisasPane {...paneProps} />}
            {tab === "packages" && <PackagesPane {...paneProps} />}
            {tab === "offers" && <OffersPane {...paneProps} />}
            {tab === "external-api" && <ExternalApiPane {...paneProps} />}
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
