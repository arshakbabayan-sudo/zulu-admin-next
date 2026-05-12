"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { findActiveGroup } from "@/lib/admin-nav-config";
import {
  canAccessSuperAdminOnlyPlatformNav,
  userHasPermission,
  userHasSellerServiceType,
} from "@/lib/access";

/**
 * Horizontal tab bar that renders at the top of every grouped admin
 * page. Auto-detects which group owns the current pathname and shows
 * one Link per tab.
 *
 * - Hides tabs the current user can't access (superAdminOnly / perm /
 *   serviceType filters mirror the sidebar logic).
 * - Active tab pulled out in ZULU purple to match the sidebar pattern.
 * - Renders nothing for groups with zero tabs (Dashboard, CMS pages).
 */
export function AdminGroupTabs() {
  const pathname = usePathname() ?? "";
  const { user } = useAdminAuth();
  const { t } = useLanguage();

  const group = findActiveGroup(pathname);
  if (!group || group.tabs.length === 0) {
    return null;
  }

  const isSuperAdminAccess = canAccessSuperAdminOnlyPlatformNav(user);
  const visibleTabs = group.tabs.filter((tab) => {
    if (tab.superAdminOnly && !isSuperAdminAccess && !user?.is_super_admin) return false;
    if (tab.perm && !userHasPermission(user, tab.perm)) return false;
    if (tab.serviceType && !userHasSellerServiceType(user, tab.serviceType)) return false;
    return true;
  });

  if (visibleTabs.length < 2) {
    // One-tab groups don't need the bar (Loyalty & Promo today is a
    // single-tab group; show nothing rather than a lone pill).
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
      <nav
        aria-label={t(group.labelKey)}
        className="flex flex-wrap items-center gap-1 overflow-x-auto"
      >
        {visibleTabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
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
