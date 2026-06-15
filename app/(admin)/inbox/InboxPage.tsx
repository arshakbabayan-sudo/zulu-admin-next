"use client";

/**
 * admin v3 — unified Inbox surface. 1:1 port of
 * docs/admin_designe/8_Inbox/inbox.html.
 *
 * ONE page, a single-level `.section-tabs` strip over 7 tabs (My notifications ·
 * Requests · Cases · System notifications · Email templates · Reviews · Support
 * tickets), in the same mgmt chrome as Inventory / Bookings / Finance. Four tabs
 * reuse the panes already built inside SettingsPage (relocated from Settings →
 * Inbox per the IA cleanup); the three native panes (My notifications, Requests,
 * Cases) are local. All pane bodies render inside a `.inbox-page` wrapper so the
 * inbox `.composer` (textarea) never collides with the chat `.composer`.
 *
 * Role scoping is server-side (INTEGRATION §4); each pane gates itself and shows
 * a forbidden/empty state to users who can't reach it.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import "../platform/management/management.css";
import { Sidebar, Header } from "../platform/management/MgmtPage";
import { useMgmtMobileNav } from "@/lib/use-mgmt-mobile-nav";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { canAccessNotificationsNav, canAccessPlatformAdminNav } from "@/lib/access";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import { inboxStrings, type InboxKey } from "./inbox-i18n";
import { MyNotificationsPane } from "./panes/MyNotificationsPane";
import { RequestsPane } from "./panes/RequestsPane";
import { CasesPane } from "./panes/CasesPane";
import { ReviewsPane, SupportTicketsPane, EmailTplPane, SysNotifPane } from "../settings/SettingsPage";

export type InboxTab =
  | "my-notif"
  | "requests"
  | "cases"
  | "sys-notif"
  | "email-tpl"
  | "reviews"
  | "support-tickets";

const TABS: Array<{ key: InboxTab; icon: string; labelKey: InboxKey; subKey: InboxKey }> = [
  { key: "my-notif", icon: "ti-bell", labelKey: "tabMyNotif", subKey: "subMyNotif" },
  { key: "requests", icon: "ti-arrows-exchange", labelKey: "tabRequests", subKey: "subRequests" },
  { key: "cases", icon: "ti-folder-open", labelKey: "tabCases", subKey: "subCases" },
  { key: "sys-notif", icon: "ti-broadcast", labelKey: "tabSysNotif", subKey: "subSysNotif" },
  { key: "email-tpl", icon: "ti-mail-cog", labelKey: "tabEmailTpl", subKey: "subEmailTpl" },
  { key: "reviews", icon: "ti-star", labelKey: "tabReviews", subKey: "subReviews" },
  { key: "support-tickets", icon: "ti-lifebuoy", labelKey: "tabSupport", subKey: "subSupport" },
];

const TAB_HREF: Record<InboxTab, string> = {
  "my-notif": "/admin-redesign/notifications",
  requests: "/bucket3/requests",
  cases: "/bucket3/cases",
  "sys-notif": "/platform/notifications",
  "email-tpl": "/localization/templates",
  reviews: "/platform/reviews",
  "support-tickets": "/support/tickets",
};

export function InboxPage({ initialTab = "my-notif" }: { initialTab?: InboxTab }) {
  const router = useRouter();
  const { token, user, logout } = useAdminAuth();
  const { lang, setLang, languageOptions } = useLanguage();
  const s = inboxStrings(lang);

  const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
  const isSuper = !!(user?.is_super_admin || canAccessPlatformAdminNav(user));
  const [tab, setTab] = useState<InboxTab>(initialTab);
  const [unreadCount, setUnreadCount] = useState(0);

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

  const showTab = useCallback(
    (key: InboxTab) => {
      if (key === tab) return;
      setTab(key);
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", TAB_HREF[key]);
      }
      document.querySelector(".mgmt-page .main")?.scrollTo({ top: 0, behavior: "smooth" });
    },
    [tab],
  );

  const active = TABS.find((t) => t.key === tab)!;
  const title = s[active.labelKey];
  const subtitle = s[active.subKey];

  const reusedProps = { token, lang };
  const body = (() => {
    switch (tab) {
      case "my-notif": return <MyNotificationsPane />;
      case "requests": return <RequestsPane />;
      case "cases": return <CasesPane />;
      case "sys-notif": return <SysNotifPane {...reusedProps} />;
      case "email-tpl": return <EmailTplPane {...reusedProps} />;
      case "reviews": return <ReviewsPane {...reusedProps} />;
      case "support-tickets": return <SupportTicketsPane {...reusedProps} />;
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
                  <a onClick={() => showTab("my-notif")}>{s.inbox}</a>
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
            </div>

            {/* single-level 7-tab strip */}
            <div className="section-tabs">
              {TABS.map((tdef) => (
                <button
                  key={tdef.key}
                  className={`section-tab ${tdef.key === tab ? "active" : ""}`}
                  onClick={() => showTab(tdef.key)}
                >
                  <i className={`ti ${tdef.icon}`} />
                  {s[tdef.labelKey]}
                  {tdef.key === "my-notif" && unreadCount > 0 && <span className="count">{unreadCount}</span>}
                </button>
              ))}
            </div>

            {/* active pane — wrapped in .inbox-page so inbox CSS is scoped here */}
            <div className="inbox-page">{body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
