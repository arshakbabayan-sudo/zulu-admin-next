"use client";

/**
 * Settings left rail — vertical, collapsible 8-group navigation.
 *
 * Rebuilds the design mock `docs/admin_designe/new-admin-designe/11_settings.html`
 * (`.set-rail` / `.set-group` / `.set-item`) as a route-driven React component.
 * Replaces the horizontal <SettingsSubgroupTabs> strip on settings pages.
 *
 * Groups + item hrefs come from SETTINGS_SUBGROUPS (lib/admin-nav-config) so the
 * structure stays single-sourced; labels reuse DEFAULT_TAB_LABELS. Each group
 * has a Tabler-equivalent lucide icon. The group holding the active route is
 * expanded on mount; any group can be collapsed/expanded by clicking its head.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Coins,
  ShieldCheck,
  Languages,
  Palette,
  Megaphone,
  Server,
  type LucideIcon,
} from "lucide-react";
import { SETTINGS_SUBGROUPS } from "@/lib/admin-nav-config";
import { DEFAULT_TAB_LABELS } from "@/components/settings/SettingsSubgroupTabs";

/** Group label → lucide icon (mirrors the mock's Tabler `gico` per group).
 *  2026-06-13 redesign — 6 clusters (Layout folded into Content & CMS, Support
 *  deleted), so the old LayoutGrid / LifeBuoy entries are gone. */
const GROUP_ICON: Record<string, LucideIcon> = {
  Money: Coins,
  Permissions: ShieldCheck,
  Localization: Languages,
  "Content & CMS": Palette,
  Marketing: Megaphone,
  System: Server,
};

function humaniseSlug(href: string): string {
  const last = href.split("/").filter(Boolean).pop() || "";
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

type Props = {
  /** Href of the currently-open settings pane (e.g. "/platform/rbac"). */
  activeHref: string;
  /** Optional per-href label overrides. */
  labels?: Record<string, string>;
};

export function SettingsRail({ activeHref, labels = {} }: Props) {
  const pathname = usePathname();

  // Collapse state: a group is collapsed when its label is in the set. The
  // group that owns the active route starts expanded; all others also start
  // expanded (the mock shows every group open) but can be toggled shut.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <aside
      className="rounded-xl border p-2 lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto"
      style={{
        background: "var(--admin-surface, #fff)",
        borderColor: "var(--admin-border)",
      }}
      aria-label="Settings navigation"
    >
      {SETTINGS_SUBGROUPS.map((group) => {
        const Icon = GROUP_ICON[group.label] ?? Coins;
        const isCollapsed = collapsed.has(group.label);
        return (
          <div key={group.label} className="mb-1">
            <button
              type="button"
              onClick={() => toggle(group.label)}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.4px",
                textTransform: "uppercase",
                color: "var(--admin-text-tertiary)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              aria-expanded={!isCollapsed}
            >
              <Icon className="h-4 w-4" style={{ color: "var(--admin-text-secondary)" }} />
              <span className="flex-1">{group.label}</span>
              <ChevronDown
                className="h-[15px] w-[15px] transition-transform"
                style={{ transform: isCollapsed ? "rotate(-90deg)" : "none" }}
              />
            </button>

            {!isCollapsed && (
              <div className="flex flex-col gap-px pb-1">
                {group.hrefs.map((href) => {
                  const active = href === activeHref || isActive(pathname, href);
                  const label =
                    labels[href] ?? DEFAULT_TAB_LABELS[href] ?? humaniseSlug(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center rounded-md py-[7px] pl-[38px] pr-3 text-[13px] transition-colors"
                      style={{
                        color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                        background: active ? "var(--admin-primary-soft)" : "transparent",
                        fontWeight: active ? 500 : 400,
                      }}
                      aria-current={active ? "page" : undefined}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
