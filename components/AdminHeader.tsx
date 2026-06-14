"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { GlobalSearchBox } from "@/components/GlobalSearchBox";
import { getLanguageMeta } from "@/lib/zulu-lang";
import {
  apiNotificationsPaginated,
  type NotificationRow,
} from "@/lib/notifications-api";
import { canAccessNotificationsNav } from "@/lib/access";

/**
 * Admin top header — the SINGLE source of truth for the admin chrome's top bar
 * (roadmap 2026-06-13 §1). Extracted out of AdminShell so the two shells stop
 * drifting:
 *   - AdminShell renders it in normal flow (default).
 *   - MgmtPage's `Header` (used by Management / CRM / Settings) renders it with
 *     `fixed` so it slots into the existing `.mgmt-page .layout { padding-top:56px }`
 *     model exactly as the old `.header { position:fixed }` did — no mgmt CSS change.
 *
 * `unreadCount` is supplied by the host (each shell already fetches it for its
 * sidebar badge) to avoid a duplicate poll; recent notifications are lazy-loaded
 * here the first time the bell dropdown opens.
 */

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

export function AdminHeader({
  sidebarOpen,
  onToggleSidebar,
  onToggleMobileDrawer,
  unreadCount = 0,
  fixed = false,
}: {
  /** Whether the host sidebar is expanded — drives the left brand block width
   *  (260px when open, icon-only 64px when collapsed). */
  sidebarOpen: boolean;
  /** Desktop (≥960px) hamburger action — toggles the persistent sidebar. */
  onToggleSidebar: () => void;
  /** Mobile (<960px) hamburger action — toggles the drawer overlay. */
  onToggleMobileDrawer: () => void;
  /** Unread notification count for the bell dot — owned by the host shell. */
  unreadCount?: number;
  /** When true the header is `position:fixed` full-width at top (mgmt shells,
   *  which reserve 56px via `.layout { padding-top:56px }`). Default flow. */
  fixed?: boolean;
}) {
  const { user, token, logout } = useAdminAuth();
  const { lang, setLang, languageOptions, t } = useLanguage();
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [recentNotifications, setRecentNotifications] = useState<NotificationRow[]>([]);
  const [appsOpen, setAppsOpen] = useState(false);
  const appsRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [adminTheme, setAdminTheme] = useState<AdminTheme>("light");
  // Mobile search — the inline GlobalSearchBox is hidden below `lg`; this slides
  // a full-width search bar down under the header (ports dashboard.html's
  // .header-search-btn / toggleSearch() so search is reachable on phones/tablets).
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Escape closes the mobile search bar (mockup parity).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const showNotifications = canAccessNotificationsNav(user);

  const loadRecentNotifications = useCallback(async () => {
    if (!token || !showNotifications) return;
    try {
      const res = await apiNotificationsPaginated(token, { page: 1, per_page: 5 });
      setRecentNotifications(res.data ?? []);
    } catch {
      setRecentNotifications([]);
    }
  }, [token, showNotifications]);

  // Lazy-load the dropdown content the first time the user opens it.
  useEffect(() => {
    if (notificationsOpen) {
      void loadRecentNotifications();
    }
  }, [notificationsOpen, loadRecentNotifications]);

  const searchLabel =
    t("admin.header.search_placeholder") !== "admin.header.search_placeholder"
      ? t("admin.header.search_placeholder")
      : "Որոնում";

  return (
    <header
      className={`z-20 flex h-14 shrink-0 items-center justify-between border-b px-4 text-slate-800 ${
        fixed ? "fixed left-0 right-0 top-0" : "relative"
      }`}
      style={{ backgroundColor: "var(--admin-header-bg)", borderColor: "var(--admin-border)" }}
    >
      <div className="flex items-center">
        <div className={`hidden md:flex items-center gap-2 border-r pr-4 ${sidebarOpen ? "md:w-[260px]" : "md:w-16 md:justify-center md:pr-0"}`} style={{ borderColor: "var(--admin-border)" }}>
          <Link href="/dashboard" aria-label={t("admin.nav.dashboard")} title={t("admin.nav.dashboard")} className="inline-flex items-center transition hover:opacity-80">
            {sidebarOpen ? (
              /* Expanded sidebar: full ZULU SPIN wordmark — dominant asset
                 public/logo_1.png (Arshak 2026-06-04) */
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo_1.png" alt="ZULU" className="h-7 w-auto" />
            ) : (
              /* Collapsed sidebar: icon mark — dominant asset public/logo_icon.png
                 (the old /branding/brand-icon.svg never existed → broken) */
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/logo_icon.png" alt="ZULU" className="h-5 w-5" />
            )}
          </Link>
        </div>
        <Link href="/dashboard" aria-label={t("admin.nav.dashboard")} title={t("admin.nav.dashboard")} className="md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_1.png" alt="ZULU" className="h-6 w-auto" />
        </Link>
        <button
          type="button"
          aria-label={t("admin.header.toggle_sidebar")}
          title={t("admin.header.toggle_sidebar")}
          onClick={() => {
            if (typeof window !== "undefined" && window.matchMedia("(min-width: 960px)").matches) {
              onToggleSidebar();
            } else {
              onToggleMobileDrawer();
            }
          }}
          className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 transition hover:bg-black/5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 8h14M5 12h10M5 16h14" />
          </svg>
        </button>
      </div>
      {/* Center — global search (Phase 2 admin-redesign 2026-05-24).
          Wired to GET /platform-admin/search (cross-entity typeahead:
          companies / users / bookings). Enter keeps the legacy interim
          behavior (Companies list filtered by the query). Hidden on mobile
          to avoid crowding the header. */}
      <div className="hidden lg:flex flex-1 items-center justify-center px-6">
        <GlobalSearchBox />
      </div>
      <div className="flex items-center gap-1.5">
        {/* Mobile search toggle — only below `lg` (where the inline
            GlobalSearchBox is hidden). Tapping it slides a full-width search bar
            down under the header; outside-click / Escape close it. Ports
            dashboard.html .header-search-btn + .header.search-open .header-search.
            NOT positioned itself (the panel anchors to the relative/fixed header). */}
        <div ref={searchRef} className="flex items-center lg:hidden">
          <TopIconButton
            label={searchLabel}
            onClick={() => {
              setSearchOpen((o) => {
                const next = !o;
                if (next) {
                  setTimeout(() => {
                    searchRef.current?.querySelector<HTMLInputElement>("input")?.focus();
                  }, 60);
                }
                return next;
              });
            }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </TopIconButton>
          <div
            className={`absolute left-0 right-0 top-full z-30 border-b px-3 py-2 shadow-sm transition-all duration-150 ${
              searchOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
            }`}
            style={{ backgroundColor: "var(--admin-header-bg)", borderColor: "var(--admin-border)" }}
          >
            <div className="mx-auto w-full max-w-[480px]">
              <GlobalSearchBox />
            </div>
          </div>
        </div>
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
                src="/flags/GB.png"
                alt=""
                width={20}
                height={14}
                className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover"
              />
            ) : lang === "hy" ? (
              <Image
                src="/flags/AM.png"
                alt=""
                width={20}
                height={14}
                className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover"
              />
            ) : lang === "ru" ? (
              <Image
                src="/flags/RU.png"
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
                    <Image src="/flags/GB.png" alt="" width={20} height={14} className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover" />
                  ) : option.code === "hy" ? (
                    <Image src="/flags/AM.png" alt="" width={20} height={14} className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover" />
                  ) : option.code === "ru" ? (
                    <Image src="/flags/RU.png" alt="" width={20} height={14} className="h-3.5 w-[1.25rem] shrink-0 rounded-[2px] object-cover" />
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
                  { href: "/dashboard", label: t("admin.nav.dashboard"), icon: "ti-dashboard" },
                  // 2026-06-10 — Users tile repointed /platform/users →
                  // /platform/b2c-customers (the old /platform/users page is a
                  // deprecated redirect stub; b2c-customers is its real default home).
                  { href: "/platform/b2c-customers", label: t("admin.nav.users"), icon: "ti-id-badge-2" },
                  { href: "/platform/bookings", label: t("admin.nav.bookings"), icon: "ti-calendar-event" },
                  { href: "/platform/companies", label: t("admin.nav.platform_companies"), icon: "ti-building" },
                  { href: "/platform/finance", label: t("admin.nav.finance"), icon: "ti-coin" },
                  { href: "/platform/settings", label: t("admin.nav.settings"), icon: "ti-settings" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAppsOpen(false)}
                    className="flex flex-col items-center gap-1 rounded-md p-2 text-center transition hover:bg-slate-50"
                  >
                    <i className={`ti ${item.icon} text-[20px] text-slate-500`} aria-hidden />
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
              className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-semibold"
              style={{ backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" }}
            >
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                (user?.name ?? t("admin.user.fallback_initial")).slice(0, 1).toUpperCase()
              )}
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
  );
}
