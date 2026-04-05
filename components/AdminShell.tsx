"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { reportAdminNextScreenView } from "@/lib/rollout-telemetry";
import {
  canAccessInventoryOversightNav,
  canAccessLocalizationLanguagesNav,
  canAccessLocalizationSectionNav,
  canAccessLocalizationTemplatesNav,
  canAccessLocalizationTranslationsNav,
  canAccessConnectionsNav,
  canAccessNotificationsNav,
  canAccessOperatorStatisticsNav,
  canAccessPlatformAdminNav,
  canAccessSuperAdminOnlyPlatformNav,
  canAccessSupportNav,
  userHasPermission,
} from "@/lib/access";

const platformLinks: { href: string; label: string; superAdminOnly?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/platform/company-applications", label: "Company applications" },
  { href: "/platform/companies", label: "Platform companies" },
  { href: "/platform/approvals", label: "Approvals" },
  { href: "/platform/users", label: "Users" },
  { href: "/platform/seller-applications", label: "Seller applications" },
  { href: "/platform/bookings", label: "Bookings" },
  { href: "/platform/invoices", label: "Invoices" },
  { href: "/platform/commissions", label: "Commissions" },
  { href: "/platform/finance", label: "Finance" },
  { href: "/platform/payments", label: "Payments" },
  { href: "/platform/package-orders", label: "Package orders" },
  { href: "/platform/finance-summary", label: "Finance summary" },
  { href: "/platform/packages", label: "Packages" },
  { href: "/platform/reviews", label: "Reviews" },
  { href: "/platform/banners", label: "Banners", superAdminOnly: true },
  { href: "/platform/settings", label: "Settings" },
  { href: "/platform/locations", label: "Locations", superAdminOnly: true },
];

const inventoryLinks: { href: string; label: string; perm: string }[] = [
  { href: "/inventory/flights", label: "Flights inventory", perm: "flights.view" },
  { href: "/inventory/hotels", label: "Hotels inventory", perm: "hotels.view" },
  { href: "/inventory/transfers", label: "Transfers inventory", perm: "transfers.view" },
  { href: "/inventory/cars", label: "Cars inventory", perm: "cars.view" },
  { href: "/inventory/excursions", label: "Excursions inventory", perm: "excursions.view" },
];

const operatorLinks = [
  { href: "/operator/flights", label: "Flights CRUD" },
  { href: "/operator/hotels", label: "Hotels CRUD" },
  { href: "/operator/transfers", label: "Transfers CRUD" },
  { href: "/operator/cars", label: "Cars CRUD" },
  { href: "/operator/excursions", label: "Excursions CRUD" },
  { href: "/operator/visas", label: "Visas CRUD" },
  { href: "/operator/packages", label: "Packages CRUD" },
  { href: "/operator/offers", label: "Offers" },
];

const localizationLinks: { href: string; label: string }[] = [
  { href: "/localization/languages", label: "Languages" },
  { href: "/localization/translations", label: "Translations" },
  { href: "/localization/templates", label: "Templates" },
];

function TopIconButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-black/5"
    >
      {children}
    </button>
  );
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

    "/localization/languages": "/icons/menu/language.svg",
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
}: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
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
          className="h-3 w-3 cursor-pointer accent-sky-600"
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, token, logout } = useAdminAuth();
  const lastScreenPing = useRef<{ path: string; t: number } | null>(null);
  const lastPathname = useRef<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const showPlatform = canAccessPlatformAdminNav(user);
  const showSuperAdminOnlyPlatform = canAccessSuperAdminOnlyPlatformNav(user);
  const showSupport = canAccessSupportNav(user);
  const showConnections = canAccessConnectionsNav(user);
  const showNotifications = canAccessNotificationsNav(user);
  const showStats = canAccessOperatorStatisticsNav(user);
  const showInventory = canAccessInventoryOversightNav(user);
  const showLocalization = canAccessLocalizationSectionNav(user);

  const pageTitle = pathname === "/dashboard"
    ? "Dashboard"
    : pathname
      .split("/")
      .filter(Boolean)
      .map((p) => p.replace(/-/g, " "))
      .join(" / ");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b px-4 text-slate-800" style={{ backgroundColor: "var(--admin-header-bg)", borderColor: "var(--admin-border)" }}>
        <div className="flex items-center">
          <div className={`flex items-center gap-2 border-r pr-4 ${sidebarOpen ? "w-72" : "w-20 justify-center pr-0"}`} style={{ borderColor: "var(--admin-border)" }}>
            {sidebarOpen && (
              <>
                <img src="/branding/brand-icon.svg" alt="Brand icon" className="h-6 w-6" />
              </>
            )}
            {!sidebarOpen && (
              <img src="/branding/brand-icon.svg" alt="Brand icon" className="h-5 w-5" />
            )}
          </div>
          <button
            type="button"
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
            onClick={() => setSidebarOpen((v) => !v)}
            className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 transition hover:bg-black/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
              <path d="M5 8h14M5 12h10M5 16h14" />
            </svg>
          </button>
          <div className="ml-3 text-sm font-semibold tracking-wide text-slate-800">{pageTitle}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <TopIconButton label="Language">
            <span className="text-sm">🇬🇧</span>
          </TopIconButton>
          <TopIconButton label="Theme">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
              <path d="M12 3a7 7 0 1 0 7 7 6 6 0 0 1-7-7Z" />
            </svg>
          </TopIconButton>
          <TopIconButton label="Notifications">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
              <path d="M9 17a3 3 0 0 0 6 0" />
            </svg>
          </TopIconButton>
          <TopIconButton label="Apps">
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
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-left transition hover:bg-white/20"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-semibold text-sky-600">
              {(user?.name ?? "U").slice(0, 1).toUpperCase()}
            </span>
              <span className="hidden max-w-[160px] truncate text-xs font-medium text-slate-700 md:block">
              {user?.name ?? "User"}
            </span>
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1" style={{ backgroundColor: "var(--background)" }}>
      <aside
        className={`min-h-0 shrink-0 overflow-y-auto border-r bg-white transition-[width] duration-200 ${
          sidebarOpen ? "w-72" : "w-20"
        }`}
        style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-surface)" }}
      >
        <nav className="flex flex-col gap-1.5 px-3 py-3 text-sm">
          {showPlatform && (
            <>
              {sidebarOpen && (
                <GroupHeader
                  label="Platform"
                  isOpen={groupOpen.platform}
                  onToggle={() => setGroupOpen((v) => ({ ...v, platform: !v.platform }))}
                />
              )}
              {(!sidebarOpen || groupOpen.platform) && platformLinks.map((l) => {
                if (l.superAdminOnly && !showSuperAdminOnlyPlatform) return null;
                return <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} collapsed={!sidebarOpen} />;
              })}
            </>
          )}

          {showPlatform && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label="Operator tools"
                  isOpen={groupOpen.operator}
                  onToggle={() => setGroupOpen((v) => ({ ...v, operator: !v.operator }))}
                />
              )}
              {(!sidebarOpen || groupOpen.operator) && operatorLinks.map((l) => <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} collapsed={!sidebarOpen} />)}
            </>
          )}

          {showInventory && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label="Inventory oversight"
                  isOpen={groupOpen.inventory}
                  onToggle={() => setGroupOpen((v) => ({ ...v, inventory: !v.inventory }))}
                />
              )}
              {(!sidebarOpen || groupOpen.inventory) && inventoryLinks.map((l) => {
                if (!userHasPermission(user, l.perm)) return null;
                return <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} collapsed={!sidebarOpen} />;
              })}
            </>
          )}

          {showLocalization && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label="Localization"
                  isOpen={groupOpen.localization}
                  onToggle={() => setGroupOpen((v) => ({ ...v, localization: !v.localization }))}
                />
              )}
              {(!sidebarOpen || groupOpen.localization) && localizationLinks.map((l) => {
                if (l.href === "/localization/languages" && !canAccessLocalizationLanguagesNav(user)) return null;
                if (l.href === "/localization/templates" && !canAccessLocalizationTemplatesNav(user)) return null;
                if (l.href === "/localization/translations" && !canAccessLocalizationTranslationsNav(user)) return null;
                return <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} collapsed={!sidebarOpen} />;
              })}
            </>
          )}

          {showSupport && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label="Support"
                  isOpen={groupOpen.support}
                  onToggle={() => setGroupOpen((v) => ({ ...v, support: !v.support }))}
                />
              )}
              {(!sidebarOpen || groupOpen.support) && <NavLink href="/support/tickets" label="Support tickets" pathname={pathname} collapsed={!sidebarOpen} />}
            </>
          )}

          {(showConnections || showNotifications || showStats) && (
            <>
              {!sidebarOpen && <div className="my-1 border-t" style={{ borderColor: "var(--admin-border)" }} />}
              {sidebarOpen && (
                <GroupHeader
                  label="Other"
                  isOpen={groupOpen.other}
                  onToggle={() => setGroupOpen((v) => ({ ...v, other: !v.other }))}
                />
              )}
              {(!sidebarOpen || groupOpen.other) && (
                <>
                  {showConnections && <NavLink href="/connections" label="Service connections" pathname={pathname} collapsed={!sidebarOpen} />}
                  {showNotifications && <NavLink href="/notifications" label="Notifications" pathname={pathname} collapsed={!sidebarOpen} />}
                  {showStats && <NavLink href="/statistics" label="Operator statistics" pathname={pathname} collapsed={!sidebarOpen} />}
                </>
              )}
            </>
          )}

          {!showPlatform && !showSupport && !showConnections && !showNotifications && !showStats && !showInventory && !showLocalization && (
            <p className="px-3 text-xs text-slate-500">
              No navigation available. Platform tools require super admin; inventory requires view permissions.
            </p>
          )}
        </nav>

        <div className="sticky bottom-0 border-t bg-white px-3 py-3 text-xs text-slate-500" style={{ borderColor: "var(--admin-border)", backgroundColor: "var(--admin-surface)" }}>
          {user && (
            <div className={`mb-3 rounded-lg bg-slate-50 px-3 py-2 ${sidebarOpen ? "" : "text-center"}`}>
              <div className="font-medium text-slate-800">{sidebarOpen ? user.name : (user.name?.slice(0, 1).toUpperCase() ?? "U")}</div>
              {sidebarOpen && <div className="truncate">{user.email}</div>}
              {sidebarOpen && <div className="mt-1 text-[10px] uppercase text-slate-400">
                {user.context.world}{user.context.is_statistics_elevated_only ? " · stats scope" : ""}
              </div>}
            </div>
          )}
          <button
            type="button"
            onClick={() => logout().then(() => (window.location.href = "/login"))}
            className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 ${sidebarOpen ? "text-left" : "text-center"}`}
          >
            {sidebarOpen ? "Log out" : "↩"}
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
            "linear-gradient(90deg, var(--admin-primary) 0%, rgba(2,132,199,0.15) 45%, var(--admin-primary) 100%)",
        }}
      />
    </div>
  );
}
