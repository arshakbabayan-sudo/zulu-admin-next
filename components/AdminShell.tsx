"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageMeta } from "@/lib/zulu-lang";
import { reportAdminNextScreenView } from "@/lib/rollout-telemetry";
import {
  ADMIN_INVENTORY_LINKS,
  ADMIN_LOCALIZATION_LINKS,
  ADMIN_OPERATOR_LINKS,
  ADMIN_PLATFORM_LINKS,
  resolveAdminPageTitle,
} from "@/lib/admin-nav-config";
import {
  canAccessInventoryOversightNav,
  canAccessLocalizationLanguagesNav,
  canAccessLocalizationSectionNav,
  canAccessLocalizationTemplatesNav,
  canAccessLocalizationTranslationsNav,
  canAccessConnectionsNav,
  canAccessNotificationsNav,
  canAccessOperatorStatisticsNav,
  canAccessOperatorToolsNav,
  canAccessPlatformAdminNav,
  canAccessSuperAdminOnlyPlatformNav,
  canAccessSupportNav,
  userHasPermission,
  userHasSellerServiceType,
} from "@/lib/access";

function TopIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-black/5"
    >
      {children}
    </button>
  );
}

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

function NavLink({
  href,
  label,
  pathname,
  collapsed,
}: {
  href: string;
  label: string;
  pathname: string;
  collapsed: boolean;
}) {
  const active = href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  const iconByHref: Record<string, string> = {
    "/dashboard": "/icons/menu/dashboard.svg",
    "/platform/company-applications": "/icons/menu/application.svg",
    "/platform/companies": "/icons/menu/company.svg",
    "/platform/approvals": "/icons/menu/checklist.svg",
    "/platform/users": "/icons/menu/users.svg",
    "/platform/seller-applications": "/icons/menu/seller.svg",
    "/platform/bookings": "/icons/menu/booking.svg",
    "/platform/invoices": "/icons/menu/invoice.svg",
    "/platform/commissions": "/icons/menu/commission.svg",
    "/platform/finance": "/icons/menu/finance.svg",
    "/platform/payments": "/icons/menu/payment.svg",
    "/platform/package-orders": "/icons/menu/package.svg",
    "/platform/finance-summary": "/icons/menu/finance-summary.svg",
    "/platform/packages": "/icons/menu/package.svg",
    "/platform/reviews": "/icons/menu/review.svg",
    "/platform/banners": "/icons/menu/banner.svg",
    "/platform/settings": "/icons/menu/settings.svg",
    "/platform/locations": "/icons/menu/location.svg",

    "/operator/flights": "/icons/menu/flight.svg",
    "/operator/hotels": "/icons/menu/hotel.svg",
    "/operator/transfers": "/icons/menu/transfer.svg",
    "/operator/cars": "/icons/menu/car.svg",
    "/operator/excursions": "/icons/menu/excursion.svg",
    "/operator/visas": "/icons/menu/visa.svg",
    "/operator/packages": "/icons/menu/package.svg",
    "/operator/offers": "/icons/menu/offer.svg",

    "/inventory/flights": "/icons/menu/flight.svg",
    "/inventory/hotels": "/icons/menu/hotel.svg",
    "/inventory/transfers": "/icons/menu/transfer.svg",
    "/inventory/cars": "/icons/menu/car.svg",
    "/inventory/excursions": "/icons/menu/excursion.svg",
    "/pages": "/icons/menu/template.svg",

    "/localization/languages": "/icons/menu/language.svg",
    "/localization/ui-translations": "/icons/menu/translation.svg",
    "/localization/translations": "/icons/menu/translation.svg",
    "/localization/templates": "/icons/menu/template.svg",

    "/support/tickets": "/icons/menu/support.svg",
    "/connections": "/icons/menu/connection.svg",
    "/notifications": "/icons/menu/notification.svg",
    "/statistics": "/icons/menu/statistics.svg",
  };
  const icon = iconByHref[href] ?? "/icons/menu/settings.svg";

  return (
    <Link
      href={href}
      className={`flex items-center rounded-lg px-3 py-2 transition ${
        active
          ? "shadow-sm"
          : "text-slate-700 hover:bg-slate-100"
      } ${collapsed ? "justify-center" : "gap-2"}`}
      title={label}
      style={active ? { backgroundColor: "var(--admin-primary-soft)", color: "var(--admin-primary)" } : undefined}
    >
      <img src={icon} alt="" aria-hidden className="h-4 w-4 shrink-0 opacity-80" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function GroupHeader({
  label,
  isOpen,
  onToggle,
  title,
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      className="mt-3 flex w-full items-center justify-between rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition hover:bg-slate-100"
      style={{ color: "var(--admin-text-muted)" }}
      aria-expanded={isOpen}
    >
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isOpen}
          readOnly
          aria-hidden
          className="h-3 w-3 cursor-pointer"
          style={{ accentColor: "var(--admin-primary)" }}
        />
        <span>{label}</span>
      </span>
      <svg
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : "rotate-0"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

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
  const lastScreenPing = useRef<{ path: string; t: number } | null>(null);
  const lastPathname = useRef<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [adminTheme, setAdminTheme] = useState<AdminTheme>("light");
  const [groupOpen, setGroupOpen] = useState({
    platform: true,
    operator: true,
    inventory: true,
    localization: true,
    support: true,
    other: true,
  });

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
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const showPlatform = canAccessPlatformAdminNav(user);
  const showOperatorTools = canAccessOperatorToolsNav(user);
  const showSuperAdminOnlyPlatform = canAccessSuperAdminOnlyPlatformNav(user);
  const showSupport = canAccessSupportNav(user);
  const showConnections = canAccessConnectionsNav(user);
  const showNotifications = canAccessNotificationsNav(user);
  const showStats = canAccessOperatorStatisticsNav(user);
  const showInventory = canAccessInventoryOversightNav(user);
  const showLocalization = canAccessLocalizationSectionNav(user);

  const pageTitle = pathname ? resolveAdminPageTitle(pathname, t) : t("admin.nav.dashboard");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b px-4 text-slate-800" style={{ backgroundColor: "var(--admin-header-bg)", borderColor: "var(--admin-border)" }}>
        <div className="flex items-center">
          <div className={`hidden md:flex items-center gap-2 border-r pr-4 ${sidebarOpen ? "md:w-72" : "md:w-20 md:justify-center md:pr-0"}`} style={{ borderColor: "var(--admin-border)" }}>
            {sidebarOpen ? (
              /* Expanded sidebar: full ZULU wordmark from Figma Zulu_1 */
              <img src="/branding/logo-zulu.svg" alt="ZULU" className="h-7 w-auto" />
            ) : (
              /* Collapsed sidebar: icon mark (the dot of "i" from the wordmark) */
              <img src="/branding/brand-icon.svg" alt="ZULU" className="h-5 w-5" />
            )}
          </div>
          <img src="/branding/logo-zulu.svg" alt="ZULU" className="h-6 w-auto md:hidden" />
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
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
              <path d="M5 8h14M5 12h10M5 16h14" />
            </svg>
          </button>
          <div className="ml-3 text-sm font-semibold tracking-wide text-slate-800">{pageTitle}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <div ref={languageRef} className="relative flex items-center">
            <button
              type="button"
              aria-label={t("common.language")}
              title={t("common.language")}
              onClick={() => setLanguageOpen((o) => !o)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-black/5"
            >
              <span className="text-sm leading-none">
                {getLanguageMeta(lang, languageOptions).flag ?? "🌐"}
              </span>
            </button>
            {languageOpen ? (
              <div
                className="absolute right-0 top-full z-[100] mt-1 min-w-[140px] overflow-hidden rounded-md border bg-white py-1 shadow-lg"
                style={{ borderColor: "var(--admin-border)" }}
              >
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      setLang(option.code);
                      setLanguageOpen(false);
                    }}
                  >
                    <span className="mr-2" aria-hidden>
                      {option.flag ?? "🌐"}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <TopIconButton
            label={adminTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggleAdminTheme}
          >
            {adminTheme === "dark" ? (
              // Sun icon (currently dark, click to go light)
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              // Moon icon (currently light, click to go dark)
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
                <path d="M12 3a7 7 0 1 0 7 7 6 6 0 0 1-7-7Z" />
              </svg>
            )}
          </TopIconButton>
          <TopIconButton label="Notifications (coming soon)">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          </TopIconButton>
          <TopIconButton label={`${t("admin.header.apps")} (coming soon)`}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <circle cx="6" cy="6" r="1.8" />
              <circle cx="12" cy="6" r="1.8" />
              <circle cx="18" cy="6" r="1.8" />
              <circle cx="6" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="18" cy="12" r="1.8" />
            </svg>
          </TopIconButton>
          <div className="mx-1 h-6 w-px" style={{ backgroundColor: "var(--admin-border)" }} />
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-left transition hover:bg-black/5"
          >
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: "var(--admin-primary)" }}
            >
              {(user?.name ?? t("admin.user.fallback_initial")).slice(0, 1).toUpperCase()}
            </span>
              <span className="hidden max-w-[160px] truncate text-xs font-medium text-slate-700 md:block">
              {user?.name ?? t("admin.user.fallback_name")}
            </span>
          </button>
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
          sidebarOpen ? "md:w-72" : "md:w-20"
        }`}
        style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-surface)" }}
      >
        <nav className="flex flex-col gap-1.5 px-3 py-3 text-sm">
          {showPlatform && (
            <>
              {sidebarOpen && (
                <GroupHeader
                  label={t("admin.nav.group.platform")}
                  isOpen={groupOpen.platform}
                  onToggle={() => setGroupOpen((v) => ({ ...v, platform: !v.platform }))}
                />
              )}
              {(!sidebarOpen || groupOpen.platform) && ADMIN_PLATFORM_LINKS.map((l) => {
                if (l.superAdminOnly && !showSuperAdminOnlyPlatform) return null;
                return <NavLink key={l.href} href={l.href} label={t(l.labelKey)} pathname={pathname} collapsed={!sidebarOpen} />;
              })}
            </>
          )}

          {showOperatorTools && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label={t("admin.nav.group.operator_tools")}
                  isOpen={groupOpen.operator}
                  onToggle={() => setGroupOpen((v) => ({ ...v, operator: !v.operator }))}
                  title={t("admin.nav.group.operator_tools_hint")}
                />
              )}
              {(!sidebarOpen || groupOpen.operator) && ADMIN_OPERATOR_LINKS.map((l) => {
                if (l.serviceType && !userHasSellerServiceType(user, l.serviceType)) return null;
                return <NavLink key={l.href} href={l.href} label={t(l.labelKey)} pathname={pathname} collapsed={!sidebarOpen} />;
              })}
            </>
          )}

          {showInventory && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label={t("admin.nav.group.inventory_oversight")}
                  isOpen={groupOpen.inventory}
                  onToggle={() => setGroupOpen((v) => ({ ...v, inventory: !v.inventory }))}
                  title={t("admin.nav.group.inventory_oversight_hint")}
                />
              )}
              {(!sidebarOpen || groupOpen.inventory) && ADMIN_INVENTORY_LINKS.map((l) => {
                if (!userHasPermission(user, l.perm)) return null;
                return <NavLink key={l.href} href={l.href} label={t(l.labelKey)} pathname={pathname} collapsed={!sidebarOpen} />;
              })}
            </>
          )}

          {showPlatform && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              <NavLink href="/pages" label="Pages" pathname={pathname} collapsed={!sidebarOpen} />
            </>
          )}

          {showLocalization && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label={t("admin.nav.group.localization")}
                  isOpen={groupOpen.localization}
                  onToggle={() => setGroupOpen((v) => ({ ...v, localization: !v.localization }))}
                />
              )}
              {(!sidebarOpen || groupOpen.localization) && ADMIN_LOCALIZATION_LINKS.map((l) => {
                if (l.href === "/localization/languages" && !canAccessLocalizationLanguagesNav(user)) return null;
                if (l.href === "/localization/templates" && !canAccessLocalizationTemplatesNav(user)) return null;
                if (l.href === "/localization/translations" && !canAccessLocalizationTranslationsNav(user)) return null;
                if (l.href === "/localization/ui-translations" && !user?.is_super_admin) return null;
                return <NavLink key={l.href} href={l.href} label={t(l.labelKey)} pathname={pathname} collapsed={!sidebarOpen} />;
              })}
            </>
          )}

          {showSupport && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label={t("admin.nav.group.support")}
                  isOpen={groupOpen.support}
                  onToggle={() => setGroupOpen((v) => ({ ...v, support: !v.support }))}
                />
              )}
              {(!sidebarOpen || groupOpen.support) && (
                <NavLink href="/support/tickets" label={t("admin.nav.support_tickets")} pathname={pathname} collapsed={!sidebarOpen} />
              )}
            </>
          )}

          {(showConnections || showNotifications || showStats) && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label={t("admin.nav.group.other")}
                  isOpen={groupOpen.other}
                  onToggle={() => setGroupOpen((v) => ({ ...v, other: !v.other }))}
                />
              )}
              {(!sidebarOpen || groupOpen.other) && (
                <>
                  {showConnections && (
                    <NavLink href="/connections" label={t("admin.nav.service_connections")} pathname={pathname} collapsed={!sidebarOpen} />
                  )}
                  {showNotifications && (
                    <NavLink href="/notifications" label={t("admin.nav.notifications")} pathname={pathname} collapsed={!sidebarOpen} />
                  )}
                  {showStats && (
                    <NavLink href="/statistics" label={t("admin.nav.operator_statistics")} pathname={pathname} collapsed={!sidebarOpen} />
                  )}
                </>
              )}
            </>
          )}

          {!showPlatform && !showOperatorTools && !showSupport && !showConnections && !showNotifications && !showStats && !showInventory && !showLocalization && (
            <p className="px-3 text-xs text-slate-500">
              {t("admin.shell.no_navigation")}
            </p>
          )}
        </nav>

        <div className="sticky bottom-0 border-t bg-white px-3 py-3 text-xs text-slate-500" style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-surface)" }}>
          {user && (
            <div className={`mb-3 rounded-lg bg-slate-50 px-3 py-2 ${sidebarOpen ? "" : "text-center"}`}>
              <div className="font-medium text-slate-800">{sidebarOpen ? user.name : (user.name?.slice(0, 1).toUpperCase() ?? t("admin.user.fallback_initial"))}</div>
              {sidebarOpen && <div className="truncate">{user.email}</div>}
              {sidebarOpen && <div className="mt-1 text-[10px] uppercase text-slate-400">
                {user.context.world}
                {user.context.is_statistics_elevated_only ? t("admin.user.stats_scope_suffix") : ""}
              </div>}
            </div>
          )}
          <button
            type="button"
            onClick={() => logout().then(() => (window.location.href = "/login"))}
            className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 ${sidebarOpen ? "text-left" : "text-center"}`}
          >
            {sidebarOpen ? t("admin.shell.logout") : "↩"}
          </button>
        </div>
      </aside>
      <main className="admin-content min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
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
