"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AdminHeader } from "@/components/AdminHeader";
import { reportAdminNextScreenView } from "@/lib/rollout-telemetry";
import { apiNotificationsUnreadCount } from "@/lib/notifications-api";
import {
  ADMIN_NAV_GROUPS,
  type AdminNavGroup,
  findActiveGroup,
  GROUP_MENU_PERMISSION,
  SIDEBAR_TABLER_ICON,
} from "@/lib/admin-nav-config";
import {
  canAccessNotificationsNav,
  canAccessSuperAdminOnlyPlatformNav,
  userHasModuleAccess,
  userHasPermission,
  userHasSellerServiceType,
} from "@/lib/access";

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
  const { user, token } = useAdminAuth();
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  // 2026-06-10 — pendingUsersCount removed. It was permanently 0 (never wired to
  // a real endpoint), and the "users_pending" badgeSource it fed has been dropped
  // from the nav config, so no sidebar group consumed it.
  const lastScreenPing = useRef<{ path: string; t: number } | null>(null);
  const lastPathname = useRef<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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

  // Initial unread fetch + 60s polling — feeds the sidebar group badge (and the
  // AdminHeader bell dot, via the unreadCount prop below).
  useEffect(() => {
    if (!token || !showNotifications) return;
    void refreshUnreadCount();
    const id = window.setInterval(() => {
      void refreshUnreadCount();
    }, 60000);
    return () => window.clearInterval(id);
  }, [token, showNotifications, refreshUnreadCount]);

  // Tabs flagged superAdminOnly stay hidden from scoped platform admins.
  const showSuperAdminOnlyPlatform = canAccessSuperAdminOnlyPlatformNav(user);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <AdminHeader
        sidebarOpen={sidebarOpen}
        unreadCount={unreadCount}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleMobileDrawer={() => setMobileDrawerOpen((v) => !v)}
      />
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
            // Sidebar group visibility is now driven SOLELY by the per-group
            // `menu.<group>.view` permission (RBAC #2 Part Ա). Super admins are
            // unrestricted; everyone else sees a group iff their role grants its
            // menu permission, so toggling it in Settings → Permissions →
            // "Left menu" changes the operator/agent sidebar live (~5s via /me sync).
            const isGroupVisible = (g: AdminNavGroup): boolean => {
              if (user?.is_super_admin) return true;
              const menuPerm = GROUP_MENU_PERMISSION[g.key];
              // Defensive: a group with no mapped menu permission stays hidden
              // for non-super users (every current group is mapped).
              return menuPerm ? userHasPermission(user, menuPerm) : false;
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
                g.badgeSource === "notifications_unread" ? unreadCount : 0;
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
                  <i
                    className={`ti ${SIDEBAR_TABLER_ICON[g.key] ?? "ti-point"} shrink-0 text-[18px]`}
                    aria-hidden
                  />
                  {sidebarOpen && <span className="flex-1 truncate">{label}</span>}
                  {showBadge ? (
                    <span
                      className="ml-auto rounded-full px-[7px] py-[1px] text-[10px] font-semibold text-white"
                      style={{ backgroundColor: badgeBg }}
                      aria-label={`${badgeValue} unread`}
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
