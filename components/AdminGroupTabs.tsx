"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { findActiveGroup } from "@/lib/admin-nav-config";
import {
  canAccessSuperAdminOnlyPlatformNav,
  isSuperAdminRole,
  userHasModuleAccess,
  userHasPermission,
  userHasSellerServiceType,
} from "@/lib/access";

/**
 * Horizontal tab bar that renders at the top of every grouped admin
 * page. Auto-detects which group owns the current pathname and shows
 * one Link per tab.
 *
 * - Hides tabs the current user can't access (superAdminOnly / perm /
 *   serviceType / moduleKey filters mirror the sidebar logic).
 * - Active tab pulled out in ZULU purple to match the sidebar pattern.
 * - For the Inventory section, renders an InventoryScopeToggle above
 *   the tabs (super admins only) that flips the URL between
 *   /operator/* (mine) and /inventory/* (all-companies oversight).
 * - Renders nothing for groups with zero tabs (Dashboard).
 */
export function AdminGroupTabs() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user } = useAdminAuth();
  const { t } = useLanguage();

  const group = findActiveGroup(pathname);
  if (!group || group.tabs.length === 0) {
    return null;
  }

  const isSuperAdminAccess = canAccessSuperAdminOnlyPlatformNav(user);
  const isSuper = isSuperAdminRole(user);

  // Inventory section: tabs are stored as /operator/* but super admins can
  // view the oversight (all-companies) tree at /inventory/*. We rewrite
  // tab hrefs when the current URL is under /inventory/* so the active
  // pill follows the user as they navigate within the oversight scope.
  const isInventorySection = group.key === "inventory";
  const onOversightScope = isInventorySection && pathname.startsWith("/inventory/");
  const rewriteInventoryHref = (href: string): string => {
    if (!isInventorySection) return href;
    if (!onOversightScope) return href;
    // Rewrite /operator/foo → /inventory/foo for the matching tabs.
    if (href.startsWith("/operator/")) {
      const slug = href.slice("/operator/".length);
      // Only the five oversight-mirrored resources exist under /inventory.
      const oversightSlugs = ["flights", "hotels", "transfers", "cars", "excursions"];
      if (oversightSlugs.includes(slug)) {
        return `/inventory/${slug}`;
      }
    }
    return href;
  };

  const visibleTabs = group.tabs.filter((tab) => {
    if (tab.superAdminOnly && !isSuperAdminAccess && !user?.is_super_admin) return false;
    if (tab.perm && !userHasPermission(user, tab.perm)) return false;
    if (tab.serviceType && !userHasSellerServiceType(user, tab.serviceType)) return false;
    if (tab.moduleKey && !userHasModuleAccess(user, tab.moduleKey)) return false;
    return true;
  });

  // Inventory scope toggle (super admin only) lives above the tab bar.
  const scopeToggle = isInventorySection && isSuper ? (
    <div className="mb-2 flex items-center gap-1 text-xs">
      <span className="text-slate-500 mr-1">
        {t("admin.inventory.scope_label") !== "admin.inventory.scope_label"
          ? t("admin.inventory.scope_label")
          : "Scope:"}
      </span>
      <button
        type="button"
        onClick={() => {
          // Toggle to "mine": map /inventory/<slug> → /operator/<slug>
          const target = pathname.startsWith("/inventory/")
            ? pathname.replace(/^\/inventory\//, "/operator/")
            : pathname.startsWith("/operator/")
            ? pathname
            : "/operator/hotels";
          router.push(target);
        }}
        className={`rounded-md border px-2 py-1 transition ${
          !onOversightScope
            ? "border-transparent bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]"
            : "border-[var(--admin-border)] text-slate-600 hover:bg-slate-50"
        }`}
        aria-pressed={!onOversightScope}
      >
        {t("admin.inventory.scope_mine") !== "admin.inventory.scope_mine"
          ? t("admin.inventory.scope_mine")
          : "Mine"}
      </button>
      <button
        type="button"
        onClick={() => {
          // Toggle to "all": map /operator/<slug> → /inventory/<slug> when
          // an oversight mirror exists; otherwise fall back to hotels.
          const oversightSlugs = ["flights", "hotels", "transfers", "cars", "excursions"];
          let target = pathname;
          if (pathname.startsWith("/operator/")) {
            const slug = pathname.split("/")[2] ?? "hotels";
            target = oversightSlugs.includes(slug) ? `/inventory/${slug}` : "/inventory/hotels";
          } else if (!pathname.startsWith("/inventory/")) {
            target = "/inventory/hotels";
          }
          router.push(target);
        }}
        className={`rounded-md border px-2 py-1 transition ${
          onOversightScope
            ? "border-transparent bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]"
            : "border-[var(--admin-border)] text-slate-600 hover:bg-slate-50"
        }`}
        aria-pressed={onOversightScope}
      >
        {t("admin.inventory.scope_all") !== "admin.inventory.scope_all"
          ? t("admin.inventory.scope_all")
          : "All companies"}
      </button>
    </div>
  ) : null;

  if (visibleTabs.length < 2 && !scopeToggle) {
    // One-tab groups don't need the bar.
    return null;
  }

  return (
    <div
      className="mb-4 -mx-6 -mt-6 border-b px-6 pt-4"
      style={{
        borderColor: "var(--admin-border)",
        backgroundColor: "var(--admin-header-bg, var(--bg-2))",
      }}
    >
      {scopeToggle}
      <nav
        aria-label={t(group.labelKey)}
        className="flex flex-wrap items-center gap-1 overflow-x-auto"
      >
        {visibleTabs.map((tab) => {
          const href = rewriteInventoryHref(tab.href);
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.href}
              href={href}
              className={`relative inline-flex items-center whitespace-nowrap px-3 py-2 text-sm font-medium transition ${
                active
                  ? ""
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
              }`}
              style={
                active
                  ? {
                      color: "var(--admin-primary)",
                    }
                  : undefined
              }
            >
              {t(tab.labelKey)}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-t"
                  style={{ backgroundColor: "var(--admin-primary)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
