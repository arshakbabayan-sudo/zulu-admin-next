"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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
  canAccessSupportNav,
  userHasPermission,
} from "@/lib/access";

const platformLinks = [
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
  { href: "/platform/banners", label: "Banners" },
  { href: "/platform/settings", label: "Settings" },
  { href: "/platform/locations", label: "Locations" },
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

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1.5 hover:bg-zinc-100 ${active ? "bg-zinc-100 font-medium" : ""}`}
    >
      {label}
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, token, logout } = useAdminAuth();
  const lastScreenPing = useRef<{ path: string; t: number } | null>(null);

  useEffect(() => {
    if (!token || !pathname) return;
    const now = Date.now();
    const prev = lastScreenPing.current;
    if (prev && prev.path === pathname && now - prev.t < 2000) return;
    lastScreenPing.current = { path: pathname, t: now };
    reportAdminNextScreenView(token, pathname);
  }, [token, pathname]);

  const showPlatform = canAccessPlatformAdminNav(user);
  const showSupport = canAccessSupportNav(user);
  const showConnections = canAccessConnectionsNav(user);
  const showNotifications = canAccessNotificationsNav(user);
  const showStats = canAccessOperatorStatisticsNav(user);
  const showInventory = canAccessInventoryOversightNav(user);
  const showLocalization = canAccessLocalizationSectionNav(user);

  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <aside className="w-60 shrink-0 border-r border-zinc-200 bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white px-3 pt-4 pb-2 z-10 border-b border-zinc-100">
          <div className="text-sm font-semibold tracking-tight text-zinc-800">Zulu admin</div>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-3 text-sm">
          {showPlatform && (
            <>
              <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Platform</div>
              {platformLinks.map((l) => <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} />)}
            </>
          )}

          {showPlatform && (
            <>
              <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Operator tools</div>
              {operatorLinks.map((l) => <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} />)}
            </>
          )}

          {showInventory && (
            <>
              <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Inventory oversight</div>
              {inventoryLinks.map((l) => {
                if (!userHasPermission(user, l.perm)) return null;
                return <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} />;
              })}
            </>
          )}

          {showLocalization && (
            <>
              <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Localization</div>
              {localizationLinks.map((l) => {
                if (l.href === "/localization/languages" && !canAccessLocalizationLanguagesNav(user)) return null;
                if (l.href === "/localization/templates" && !canAccessLocalizationTemplatesNav(user)) return null;
                if (l.href === "/localization/translations" && !canAccessLocalizationTranslationsNav(user)) return null;
                return <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} />;
              })}
            </>
          )}

          {showSupport && (
            <>
              <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Support</div>
              <NavLink href="/support/tickets" label="Support tickets" pathname={pathname} />
            </>
          )}

          {(showConnections || showNotifications || showStats) && (
            <>
              <div className="mt-3 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Other</div>
              {showConnections && <NavLink href="/connections" label="Service connections" pathname={pathname} />}
              {showNotifications && <NavLink href="/notifications" label="Notifications" pathname={pathname} />}
              {showStats && <NavLink href="/statistics" label="Operator statistics" pathname={pathname} />}
            </>
          )}

          {!showPlatform && !showSupport && !showConnections && !showNotifications && !showStats && !showInventory && !showLocalization && (
            <p className="px-2 text-xs text-zinc-500">
              No navigation available. Platform tools require super admin; inventory requires view permissions.
            </p>
          )}
        </nav>

        <div className="sticky bottom-0 bg-white border-t border-zinc-100 px-3 py-3 text-xs text-zinc-500">
          {user && (
            <div className="mb-3 px-2">
              <div className="font-medium text-zinc-800">{user.name}</div>
              <div className="truncate">{user.email}</div>
              <div className="mt-1 text-[10px] uppercase text-zinc-400">
                {user.context.world}{user.context.is_statistics_elevated_only ? " · stats scope" : ""}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => logout().then(() => (window.location.href = "/login"))}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
