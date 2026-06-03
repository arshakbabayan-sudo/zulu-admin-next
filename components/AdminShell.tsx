"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageMeta } from "@/lib/zulu-lang";
import { reportAdminNextScreenView } from "@/lib/rollout-telemetry";
import {
  apiNotificationsPaginated,
  apiNotificationsUnreadCount,
  type NotificationRow,
} from "@/lib/notifications-api";
import {
  ADMIN_NAV_GROUPS,
  type AdminNavGroup,
  findActiveGroup,
  resolveAdminPageTitle,
} from "@/lib/admin-nav-config";
import {
  canAccessAgentToolsNav,
  canAccessBookingsSection,
  canAccessChatSection,
  canAccessCrmSection,
  canAccessDashboardSection,
  canAccessFinanceSection,
  canAccessInventoryOversightNav,
  canAccessInventorySection,
  canAccessLocalizationSectionNav,
  canAccessMarketplaceOpsSection,
  canAccessMyCompanySection,
  canSeeOwnCompanyNav,
  canAccessNotificationsNav,
  canAccessOperatorToolsNav,
  canAccessPlatformAdminNav,
  canAccessSalesWorkspaceSection,
  canAccessSettingsSection,
  canAccessSuperAdminOnlyPlatformNav,
  userHasModuleAccess,
  userHasPermission,
  userHasSellerServiceType,
} from "@/lib/access";

function TopIconButton({
  label,
  onClick,
  children,
  badge,
  dot,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  badge?: number;
  /** v2 admin-redesign — render a small red dot indicator instead of a
   *  numeric badge. Used by the notifications bell per v2 spec. */
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
    >
      {children}
      {dot ? (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 inline-block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
        />
      ) : badge && badge > 0 ? (
        <span
          className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
          aria-label={`${badge} unread`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

const FRONTEND_PUBLIC_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FRONTEND_URL) ||
  "https://zulu.am";

const ZULU_ADMIN_THEME_KEY = "zulu_admin_theme";

type AdminTheme = "light" | "dark";

function readStoredAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(ZULU_ADMIN_THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore
  }
  // System preference fallback
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function applyAdminTheme(theme: AdminTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

// Legacy per-link sidebar items + collapsible group header were removed
// when the sidebar moved to the grouped model (ADMIN_NAV_GROUPS). The
// component now renders one Link per group inline in <AdminShell/>.

/**
 * Figma layout reference: Quest CRM Copy template
 *   - Sidebar Open & Collapse: 4042:3863
 *   - Mobile drawer (admin):    10243:30233
 *   - Dashboard layout pattern:  9350:15768
 * File: https://www.figma.com/design/bEqM5rja1g3DjRugNRPjJr/Quest-CRM-Design--Copy-?node-id=4042-3863
 * Brand tokens: ZULU purple primary (--admin-primary, see globals.css). Template's blue is NOT applied.
 * Mobile rule: <md (under 960px) → drawer overlay; ≥md → persistent sidebar with collapse-to-icon.
 * Last synced: 2026-05-03
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, token, logout } = useAdminAuth();
  const { lang, setLang, languageOptions, t } = useLanguage();
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationRow[]>([]);
  // v2 admin-redesign (2026-05-24) — pending-verification user count for Users
  // sidebar badge. TODO: wire to /api/admin/users/pending-count once that
  // endpoint exists (backend follow-up). For now stays at 0 so badge is hidden.
  const [pendingUsersCount] = useState(0);
  const [appsOpen, setAppsOpen] = useState(false);
  const appsRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const lastScreenPing = useRef<{ path: string; t: number } | null>(null);
  const lastPathname = useRef<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [adminTheme, setAdminTheme] = useState<AdminTheme>("light");

  useEffect(() => {
    if (!token || !pathname) return;
    const now = Date.now();
    const prev = lastScreenPing.current;
    if (prev && prev.path === pathname && now - prev.t < 2000) return;
    lastScreenPing.current = { path: pathname, t: now };
    reportAdminNextScreenView(token, pathname);
  }, [token, pathname]);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Initialize admin theme from localStorage / system preference, then keep <html> in sync.
  useEffect(() => {
    const initial = readStoredAdminTheme();
    setAdminTheme(initial);
    applyAdminTheme(initial);
  }, []);

  const toggleAdminTheme = () => {
    setAdminTheme((prev) => {
      const next: AdminTheme = prev === "dark" ? "light" : "dark";
      applyAdminTheme(next);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(ZULU_ADMIN_THEME_KEY, next);
        }
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileDrawerOpen]);

  // Lightweight navigation indicator: turns on when pathname changes and
  // turns off right after the next paint (no API coupling, no design changes).
  useEffect(() => {
    if (!pathname) return;
    const prev = lastPathname.current;
    lastPathname.current = pathname;
    if (prev === null) return; // initial mount: don't flash the indicator

    setIsNavigating(true);
    let cancelled = false;
    const raf1 = window.requestAnimationFrame(() => {
      const raf2 = window.requestAnimationFrame(() => {
        if (!cancelled) setIsNavigating(false);
      });
      // ensure raf2 can be cancelled
      void raf2;
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
    };
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (languageRef.current && !languageRef.current.contains(target)) {
        setLanguageOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (appsRef.current && !appsRef.current.contains(target)) {
        setAppsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const showNotifications = canAccessNotificationsNav(user);

  const refreshUnreadCount = useCallback(async () => {
    if (!token || !showNotifications) return;
    try {
      const res = await apiNotificationsUnreadCount(token);
      setUnreadCount(res.data.unread_count ?? 0);
    } catch {
      // silent — admin shell shouldn't break on a counter request
    }
  }, [token, showNotifications]);

  const loadRecentNotifications = useCallback(async () => {
    if (!token || !showNotifications) return;
    try {
      const res = await apiNotificationsPaginated(token, { page: 1, per_page: 5 });
      setRecentNotifications(res.data ?? []);
    } catch {
      setRecentNotifications([]);
    }
  }, [token, showNotifications]);

  // Initial unread fetch + 60s polling.
  useEffect(() => {
    if (!token || !showNotifications) return;
    void refreshUnreadCount();
    const id = window.setInterval(() => {
      void refreshUnreadCount();
    }, 60000);
    return () => window.clearInterval(id);
  }, [token, showNotifications, refreshUnreadCount]);

  // Lazy-load the dropdown content the first time the user opens it.
  useEffect(() => {
    if (notificationsOpen) {
      void loadRecentNotifications();
      void refreshUnreadCount();
    }
  }, [notificationsOpen, loadRecentNotifications, refreshUnreadCount]);

  const showPlatform = canAccessPlatformAdminNav(user);
  const showOperatorTools = canAccessOperatorToolsNav(user);
  const showSuperAdminOnlyPlatform = canAccessSuperAdminOnlyPlatformNav(user);
  const showInventory = canAccessInventoryOversightNav(user);
  const showLocalization = canAccessLocalizationSectionNav(user);
  const showAgentTools = canAccessAgentToolsNav(user);

  const pageTitle = pathname ? resolveAdminPageTitle(pathname, t) : t("admin.nav.dashboard");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b px-4 text-slate-800" style={{ backgroundColor: "var(--admin-header-bg)", borderColor: "var(--admin-border)" }}>
        <div className="flex items-center">
          <div className={`hidden md:flex items-center gap-2 border-r pr-4 ${sidebarOpen ? "md:w-[260px]" : "md:w-16 md:justify-center md:pr-0"}`} style={{ borderColor: "var(--admin-border)" }}>
            <Link href="/dashboard" aria-label={t("admin.nav.dashboard")} title={t("admin.nav.dashboard")} className="inline-flex items-center transition hover:opacity-80">
              {sidebarOpen ? (
                /* Expanded sidebar: full ZULU wordmark from Figma Zulu_1 */
                <img src="/branding/logo-zulu.svg" alt="ZULU" className="h-7 w-auto" />
              ) : (
                /* Collapsed sidebar: icon mark (the dot of "i" from the wordmark) */
                <img src="/branding/brand-icon.svg" alt="ZULU" className="h-5 w-5" />
              )}
            </Link>
          </div>
          <Link href="/dashboard" aria-label={t("admin.nav.dashboard")} title={t("admin.nav.dashboard")} className="md:hidden">
            <img src="/branding/logo-zulu.svg" alt="ZULU" className="h-6 w-auto" />
          </Link>
          <button
            type="button"
            aria-label={t("admin.header.toggle_sidebar")}
            title={t("admin.header.toggle_sidebar")}
            onClick={() => {
              if (typeof window !== "undefined" && window.matchMedia("(min-width: 960px)").matches) {
                setSidebarOpen((v) => !v);
              } else {
                setMobileDrawerOpen((v) => !v);
              }
            }}
            className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 transition hover:bg-black/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 8h14M5 12h10M5 16h14" />
            </svg>
          </button>
          <div className="ml-3 text-sm font-semibold tracking-wide text-slate-800">{pageTitle}</div>
        </div>
        {/* Center — global search (Phase 2 admin-redesign 2026-05-24).
            Currently visual-only; wiring up the search backend is a separate
            task. Hidden on mobile to avoid crowding the header. */}
        <div className="hidden lg:flex flex-1 items-center justify-center px-6">
          <div className="relative w-full max-w-[400px]">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 fill-none stroke-slate-400"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder={t("admin.header.search_placeholder") !== "admin.header.search_placeholder" ? t("admin.header.search_placeholder") : "Որոնում..."}
              className="h-9 w-full rounded-lg border bg-slate-50 pl-10 pr-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-[color:var(--admin-primary)] focus:bg-white focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
              style={{ borderColor: "var(--admin-border)" }}
              aria-label={t("admin.header.search_placeholder") !== "admin.header.search_placeholder" ? t("admin.header.search_placeholder") : "Որոնում"}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Single language switcher — controls admin chrome.
              For catalog content preview language, see ContentLanguagePill on each list page. */}
          <div ref={languageRef} className="relative flex items-center">
            <button
              type="button"
              aria-label={t("common.language")}
              title={t("common.language")}
              onClick={() => setLanguageOpen((o) => !o)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-slate-700 transition hover:bg-black/5"
            >
              {lang === "en" ? (
                <Image
                  src="/flags/gb.svg"
                  alt=""
                  width={20}
                  height={14}
                  className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover"
                />
              ) : lang === "hy" ? (
                <Image
                  src="/flags/am.svg"
                  alt=""
                  width={20}
                  height={14}
                  className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover"
                />
              ) : lang === "ru" ? (
                <Image
                  src="/flags/ru.svg"
                  alt=""
                  width={20}
                  height={14}
                  className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover"
                />
              ) : (
                <span className="text-sm leading-none" aria-hidden>
                  {getLanguageMeta(lang, languageOptions).flag ?? "🌐"}
                </span>
              )}
              <span className="text-xs font-semibold uppercase">
                {getLanguageMeta(lang, languageOptions).code ?? lang}
              </span>
            </button>
            {languageOpen ? (
              <div
                className="absolute right-0 top-full z-[100] mt-1 min-w-[160px] overflow-hidden rounded-md border bg-white py-1 shadow-lg"
                style={{ borderColor: "var(--admin-border)" }}
              >
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      setLang(option.code);
                      setLanguageOpen(false);
                    }}
                  >
                    {option.code === "en" ? (
                      <Image src="/flags/gb.svg" alt="" width={20} height={14} className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover" />
                    ) : option.code === "hy" ? (
                      <Image src="/flags/am.svg" alt="" width={20} height={14} className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover" />
                    ) : option.code === "ru" ? (
                      <Image src="/flags/ru.svg" alt="" width={20} height={14} className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover" />
                    ) : (
                      <span className="text-sm leading-none" aria-hidden>{option.flag ?? "🌐"}</span>
                    )}
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {/* Open frontend website in new browser tab — carries the admin's
              Sanctum token through web's /sso handoff so the user lands
              already logged in instead of having to sign in again. */}
          <a
            href={
              token
                ? `${FRONTEND_PUBLIC_URL}/sso?${new URLSearchParams({ token, next: "/" }).toString()}`
                : FRONTEND_PUBLIC_URL
            }
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open ZULU website"
            title="Open ZULU website"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-black/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            </svg>
          </a>
          <TopIconButton
            label={adminTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleAdminTheme}
          >
            {adminTheme === "dark" ? (
              // Sun icon (currently dark, click to go light)
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              // Moon icon (currently light, click to go dark)
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
                <path d="M12 3a7 7 0 1 0 7 7 6 6 0 0 1-7-7Z" />
              </svg>
            )}
          </TopIconButton>
          {/* Notifications */}
          {showNotifications && (
            <div ref={notificationsRef} className="relative flex items-center">
              <TopIconButton
                label={t("admin.nav.notifications")}
                onClick={() => setNotificationsOpen((o) => !o)}
                dot={unreadCount > 0}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                  <path d="M9 17a3 3 0 0 0 6 0" />
                </svg>
              </TopIconButton>
              {notificationsOpen ? (
                <div
                  className="absolute right-0 top-full z-[100] mt-1 w-[340px] overflow-hidden rounded-md border bg-white shadow-lg"
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--admin-border)" }}>
                    <p className="text-sm font-semibold text-slate-800">
                      {t("admin.nav.notifications")}
                      {unreadCount > 0 ? (
                        <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>
                      ) : null}
                    </p>
                    <Link
                      href="/notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs font-medium hover:underline"
                      style={{ color: "var(--admin-primary)" }}
                    >
                      {t("common.see_all") !== "common.see_all" ? t("common.see_all") : "See all"}
                    </Link>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {recentNotifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-slate-500">
                        {t("admin.notifications.empty") !== "admin.notifications.empty" ? t("admin.notifications.empty") : "No notifications yet"}
                      </p>
                    ) : (
                      <ul className="divide-y" style={{ borderColor: "var(--admin-border)" }}>
                        {recentNotifications.map((n) => (
                          <li key={n.id}>
                            <Link
                              href="/notifications"
                              onClick={() => setNotificationsOpen(false)}
                              className={`block px-4 py-2.5 transition hover:bg-slate-50 ${n.status !== "read" ? "bg-slate-50/50" : ""}`}
                            >
                              <p className="text-xs font-semibold text-slate-800 line-clamp-1">{n.title}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">{n.message}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Apps grid — quick links to common admin sections */}
          <div ref={appsRef} className="relative flex items-center">
            <TopIconButton
              label={t("admin.header.apps")}
              onClick={() => setAppsOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <circle cx="6" cy="6" r="1.8" />
                <circle cx="12" cy="6" r="1.8" />
                <circle cx="18" cy="6" r="1.8" />
                <circle cx="6" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="18" cy="12" r="1.8" />
                <circle cx="6" cy="18" r="1.8" />
                <circle cx="12" cy="18" r="1.8" />
                <circle cx="18" cy="18" r="1.8" />
              </svg>
            </TopIconButton>
            {appsOpen ? (
              <div
                className="absolute right-0 top-full z-[100] mt-1 w-[280px] overflow-hidden rounded-md border bg-white p-2 shadow-lg"
                style={{ borderColor: "var(--admin-border)" }}
              >
                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.header.apps")}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { href: "/dashboard", label: t("admin.nav.dashboard"), icon: "/icons/menu/dashboard.svg" },
                    { href: "/platform/users", label: t("admin.nav.users"), icon: "/icons/menu/users.svg" },
                    { href: "/platform/bookings", label: t("admin.nav.bookings"), icon: "/icons/menu/booking.svg" },
                    { href: "/platform/companies", label: t("admin.nav.platform_companies"), icon: "/icons/menu/company.svg" },
                    { href: "/platform/finance", label: t("admin.nav.finance"), icon: "/icons/menu/finance.svg" },
                    { href: "/platform/settings", label: t("admin.nav.settings"), icon: "/icons/menu/settings.svg" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAppsOpen(false)}
                      className="flex flex-col items-center gap-1 rounded-md p-2 text-center transition hover:bg-slate-50"
                    >
                      <img src={item.icon} alt="" aria-hidden className="h-5 w-5 opacity-70" />
                      <span className="text-[10px] font-medium leading-tight text-slate-700 line-clamp-2">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mx-1 h-6 w-px" style={{ backgroundColor: "var(--admin-border)" }} />

          {/* User avatar — dropdown with profile / settings / logout */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-left transition hover:bg-black/5"
              aria-label={user?.name ?? t("admin.user.fallback_name")}
              aria-expanded={userMenuOpen}
            >
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" }}
              >
                {(user?.name ?? t("admin.user.fallback_initial")).slice(0, 1).toUpperCase()}
              </span>
              {/* v2 admin-redesign — name on top, role label below */}
              <div className="hidden max-w-[160px] flex-col text-left leading-tight md:flex">
                <span className="truncate text-[13px] font-medium" style={{ color: "var(--admin-text-primary)" }}>
                  {user?.name ?? t("admin.user.fallback_name")}
                </span>
                {user?.context?.world ? (
                  <span className="truncate text-[11px]" style={{ color: "var(--admin-text-secondary)" }}>
                    {user.context.world}
                  </span>
                ) : null}
              </div>
              <svg viewBox="0 0 24 24" className={`h-3 w-3 fill-none stroke-current text-slate-500 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {userMenuOpen ? (
              <div
                className="absolute right-0 top-full z-[100] mt-1 w-[260px] overflow-hidden rounded-md border bg-white shadow-lg"
                style={{ borderColor: "var(--admin-border)" }}
              >
                {user ? (
                  <div className="border-b px-4 py-3" style={{ borderColor: "var(--admin-border)" }}>
                    <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--admin-primary)" }}>
                      {user.context.world}
                      {user.context.is_statistics_elevated_only ? t("admin.user.stats_scope_suffix") : ""}
                    </p>
                  </div>
                ) : null}
                <div className="py-1">
                  {!token ? (
                    <Link
                      href="/login"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current text-slate-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      {t("admin.shell.login") !== "admin.shell.login" ? t("admin.shell.login") : "Log in"}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void logout().then(() => (window.location.href = "/login"));
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      {t("admin.shell.logout")}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1" style={{ backgroundColor: "var(--background)" }}>
      {mobileDrawerOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-14 z-20 bg-black/40 md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`overflow-y-auto border-r bg-white fixed inset-y-0 left-0 top-14 z-30 w-72 transition-transform duration-200 ${
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        } md:static md:top-0 md:z-auto md:min-h-0 md:shrink-0 md:translate-x-0 md:transition-[width] ${
          sidebarOpen ? "md:w-[260px]" : "md:w-16"
        }`}
        style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-surface)" }}
      >
        {/* v2 admin-redesign — sidebar brand block (logo + ZULU label +
            "Admin panel" subtitle). Per docs/zulu-admin-v2.html lines 234-241.
            Hidden when sidebar collapsed to icon-only on desktop. */}
        {sidebarOpen ? (
          <div
            className="flex items-center gap-2.5 border-b px-3 py-3"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] font-bold text-white"
              style={{ backgroundColor: "var(--admin-primary)" }}
              aria-hidden
            >
              Z
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold leading-tight" style={{ color: "var(--admin-text-primary)" }}>
                ZULU
              </div>
              <div className="text-[11px] leading-tight" style={{ color: "var(--admin-text-secondary)" }}>
                {t("admin.shell.brand_subtitle") !== "admin.shell.brand_subtitle"
                  ? t("admin.shell.brand_subtitle")
                  : "Admin panel"}
              </div>
            </div>
          </div>
        ) : null}
        <nav className="flex flex-col gap-1.5 px-3 py-3 text-sm">
          {(() => {
            const isGroupVisible = (g: AdminNavGroup): boolean => {
              switch (g.visibility) {
                // legacy keys (still used by any leftover importer)
                case "always":
                  return true;
                case "platform_admin":
                  return showPlatform;
                case "operator_tools":
                  return showOperatorTools;
                case "inventory_oversight":
                  return showInventory;
                case "localization":
                  return showLocalization;
                case "super_admin":
                  return showSuperAdminOnlyPlatform;
                case "bucket3":
                  return showPlatform;
                case "agent_tools":
                  return showAgentTools;
                // 2026-05-24 — 8-section IA keys
                case "section_dashboard":
                  return canAccessDashboardSection(user);
                case "section_inventory":
                  return canAccessInventorySection(user);
                case "section_bookings":
                  return canAccessBookingsSection(user);
                case "section_crm":
                  return canAccessCrmSection(user);
                case "section_chat":
                  return canAccessChatSection(user);
                case "section_sales_workspace":
                  return canAccessSalesWorkspaceSection(user);
                case "section_finance":
                  return canAccessFinanceSection(user);
                case "section_my_company":
                  return canAccessMyCompanySection(user);
                case "section_own_company":
                  return canSeeOwnCompanyNav(user);
                case "section_marketplace_ops":
                  return canAccessMarketplaceOpsSection(user);
                case "section_settings":
                  return canAccessSettingsSection(user);
                default:
                  return false;
              }
            };

            const isTabVisible = (
              tab: {
                superAdminOnly?: boolean;
                perm?: string;
                serviceType?: import("@/lib/auth-types").SellerServiceType;
                moduleKey?: string;
              },
            ): boolean => {
              if (tab.superAdminOnly && !showSuperAdminOnlyPlatform && !user?.is_super_admin) return false;
              if (tab.perm && !userHasPermission(user, tab.perm)) return false;
              if (tab.serviceType && !userHasSellerServiceType(user, tab.serviceType)) return false;
              // Phase 6A — per-company admin module visibility (default-allow).
              if (tab.moduleKey && !userHasModuleAccess(user, tab.moduleKey)) return false;
              return true;
            };

            const visibleGroups = ADMIN_NAV_GROUPS.filter((g) => {
              if (!isGroupVisible(g)) return false;
              // Group with tabs is only visible if at least one tab is visible.
              if (g.tabs.length === 0) return true;
              return g.tabs.some(isTabVisible);
            });

            if (visibleGroups.length === 0) {
              return (
                <p className="px-3 text-xs text-slate-500">
                  {t("admin.shell.no_navigation")}
                </p>
              );
            }

            const activeGroup = findActiveGroup(pathname ?? "");

            return visibleGroups.map((g) => {
              // Sidebar link points at the first visible tab (or defaultHref if no tabs).
              const firstVisibleTab = g.tabs.find(isTabVisible);
              const href = firstVisibleTab?.href ?? g.defaultHref;
              const active = activeGroup?.key === g.key;
              // Fallback label kicks in when the translation row is not yet
              // seeded (t() returns the key itself). Keeps the new section
              // names readable until the ui_translations rows ship.
              const rawLabel = t(g.labelKey);
              const label = rawLabel === g.labelKey && g.labelFallback ? g.labelFallback : rawLabel;
              // v2 admin-redesign (2026-05-24) — sidebar badge resolution
              const badgeValue =
                g.badgeSource === "notifications_unread"
                  ? unreadCount
                  : g.badgeSource === "users_pending"
                  ? pendingUsersCount
                  : 0;
              const showBadge = sidebarOpen && badgeValue > 0;
              const badgeBg =
                g.badgeKind === "warn"
                  ? "var(--warning, #FFA000)"
                  : "var(--admin-primary)";
              return (
                <Link
                  key={g.key}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  // v2 admin-redesign — visual tuning to match
                  // docs/zulu-admin-v2.html .sidebar-item:
                  //   font 13px, gap 12px (gap-3), inactive text-secondary,
                  //   hover bg slate-50, active uses primary-soft bg +
                  //   primary text + medium weight.
                  className={`flex items-center rounded-lg px-3 py-2 text-[13px] transition ${
                    active
                      ? "font-medium"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  } ${sidebarOpen ? "gap-3" : "justify-center"}`}
                  title={label}
                  style={
                    active
                      ? { backgroundColor: "var(--admin-primary-soft)", color: "var(--admin-primary)" }
                      : undefined
                  }
                >
                  <img src={g.icon} alt="" aria-hidden className="h-[18px] w-[18px] shrink-0 opacity-80" />
                  {sidebarOpen && <span className="flex-1 truncate">{label}</span>}
                  {showBadge ? (
                    <span
                      className="ml-auto rounded-full px-[7px] py-[1px] text-[10px] font-semibold text-white"
                      style={{ backgroundColor: badgeBg }}
                      aria-label={`${badgeValue} ${g.badgeSource === "notifications_unread" ? "unread" : "pending"}`}
                    >
                      {badgeValue > 99 ? "99+" : badgeValue}
                    </span>
                  ) : null}
                </Link>
              );
            });
          })()}
        </nav>

      </aside>
      <main id="main-content" className="admin-content min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      {/* Navigation progress hint (subtle, header-attached) */}
      <div
        aria-hidden
        className={`h-[2px] w-full transition-opacity duration-150 ${isNavigating ? "opacity-100" : "opacity-0"}`}
        style={{
          background:
            "linear-gradient(90deg, var(--admin-primary) 0%, var(--admin-primary-soft) 45%, var(--admin-primary) 100%)",
        }}
      />
    </div>
  );
}
