"use client";

/**
 * Settings sub-group tab strip — Phase 2D (2026-05-31).
 *
 * Replaces the flat ~20-tab horizontal strip every settings page renders
 * with a strip that has visible sub-group labels between clusters:
 *
 *   [ Money ] Pricing rules · Money flow · Exchange rates
 *   [ Permissions ] RBAC
 *   [ Localization ] Languages · UI strings · Content · Email templates
 *   …
 *
 * The cluster definition lives in lib/admin-nav-config.ts → SETTINGS_SUBGROUPS
 * so all settings pages render the SAME structure. Pages pass only
 * `activeHref`; the component does the rest.
 *
 * Sub-group filtering: pages can pass `visibleSubgroups` to render a
 * subset (e.g. a Localization-only landing). When omitted, all groups
 * show.
 *
 * Visibility per tab: superAdminOnly + module checks are intentionally NOT
 * enforced here. Page-level guards already 403 on click for users without
 * access, and rendering the labels keeps the navigation structure
 * predictable. (Phase Զ.7 cleanup also removed the visible-but-403 traps
 * that motivated stripping inaccessible tabs from earlier UIs.)
 */

import Link from "next/link";
import { SETTINGS_SUBGROUPS, type SettingsSubgroup } from "@/lib/admin-nav-config";

/**
 * Canonical English labels for every settings tab. Pages don't need to
 * repeat this map — they just pass `activeHref` and these are used as
 * fallbacks. `labels` prop on the component still overrides per page
 * (e.g. when a setting needs a localized inline override).
 */
export const DEFAULT_TAB_LABELS: Record<string, string> = {
  "/settings/pricing-rules": "Pricing rules",
  "/settings/money-flow": "Money flow",
  "/settings/exchange-rates": "Exchange rates",
  "/platform/rbac": "Roles & permissions",
  "/localization/languages": "Languages",
  "/localization/ui-translations": "UI strings",
  "/localization/translations": "Content",
  "/localization/templates": "Email templates",
  "/pages": "CMS pages",
  "/platform/widgets": "Widgets",
  "/platform/banners": "Banners",
  "/platform/notifications": "System notifications",
  "/platform/newsletter": "Newsletter",
  "/platform/settings/header-menu": "Header",
  "/platform/settings/footer": "Footer",
  "/platform/settings/brand": "Brand",
  "/platform/loyalty": "Loyalty",
  "/platform/security": "Security",
  "/platform/webhooks": "Webhooks",
  "/platform/locations": "Locations",
  "/platform/api-docs": "API docs",
  "/connections": "Connections",
  "/support/tickets": "Tickets",
  "/platform/reviews": "Reviews",
};

type Props = {
  activeHref: string;
  /** Optional whitelist of sub-group labels to render. Default: all. */
  visibleSubgroups?: string[];
  /** Optional per-href labels — falls back to a humanised slug otherwise. */
  labels?: Record<string, string>;
  /** Optional per-href badge counts. */
  counts?: Record<string, number | undefined>;
};

function humaniseSlug(href: string): string {
  const last = href.split("/").filter(Boolean).pop() || "";
  return last
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SettingsSubgroupTabs({
  activeHref,
  visibleSubgroups,
  labels = {},
  counts = {},
}: Props) {
  const groups: SettingsSubgroup[] = visibleSubgroups
    ? SETTINGS_SUBGROUPS.filter((g) => visibleSubgroups.includes(g.label))
    : SETTINGS_SUBGROUPS;

  return (
    <div
      className="mb-5 flex flex-wrap items-center gap-x-1 gap-y-2 border-b pb-1"
      style={{ borderColor: "var(--admin-border)" }}
      role="tablist"
      aria-label="Settings sub-groups"
    >
      {groups.map((group, gi) => (
        <div key={group.label} className="flex flex-wrap items-center gap-1">
          {/* Sub-group label */}
          <span
            className="ml-3 mr-1 first:ml-0 inline-flex h-[28px] items-center rounded-md px-2 text-[10px] font-semibold uppercase tracking-[0.6px]"
            style={{
              backgroundColor: "var(--admin-bg-tertiary)",
              color: "var(--admin-text-secondary)",
            }}
          >
            {group.label}
          </span>
          {group.hrefs.map((href) => {
            const active = href === activeHref;
            const label = labels[href] ?? DEFAULT_TAB_LABELS[href] ?? humaniseSlug(href);
            const count = counts[href];
            return (
              <Link
                key={href}
                href={href}
                role="tab"
                aria-selected={active}
                className="inline-flex h-[28px] items-center whitespace-nowrap rounded-md px-2.5 text-[12px] font-medium transition"
                style={{
                  color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                  backgroundColor: active ? "var(--admin-primary-soft)" : "transparent",
                }}
              >
                {label}
                {count !== undefined ? (
                  <span
                    className="ml-1.5 inline-flex items-center rounded-full px-[6px] py-[1px] text-[10px] font-medium"
                    style={{
                      backgroundColor: active ? "var(--admin-primary-light)" : "var(--admin-bg-tertiary)",
                      color: active ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                    }}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
          {gi < groups.length - 1 ? (
            <span
              className="mx-2 h-4 w-px"
              style={{ backgroundColor: "var(--admin-border)" }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
