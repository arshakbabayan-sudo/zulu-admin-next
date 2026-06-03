/**
 * v2 admin-redesign — SectionTabs component
 *
 * Source: docs/zulu-admin-v2.html lines 94-100, .section-tabs pattern.
 * Underline-style horizontal tabs with optional count pills.
 * Replaces the existing pill-style AdminGroupTabs for v2 pages.
 *
 * Usage:
 *   <SectionTabs
 *     activeHref="/operator/hotels"
 *     items={[
 *       { href: "/operator/hotels", label: "Hotels", count: 84 },
 *       { href: "/operator/flights", label: "Flights", count: 142 },
 *       { href: "/operator/transfers", label: "Transfers" },
 *     ]}
 *   />
 */

import type { ReactNode } from "react";
import Link from "next/link";

export type SectionTabItem = {
  href: string;
  label: string;
  count?: number | string;
  /**
   * Optional leading icon. Pass any ReactNode — admin v3 (Management redesign
   * 2026-06-03+) passes a Tabler icon `<i className="ti ti-..."/>`; earlier
   * callers may omit it for label-only tabs.
   */
  icon?: ReactNode;
};

type Props = {
  items: SectionTabItem[];
  activeHref: string;
  className?: string;
};

export function SectionTabs({ items, activeHref, className = "" }: Props) {
  return (
    <div
      className={`mb-5 flex flex-wrap gap-1 overflow-x-auto border-b ${className}`.trim()}
      style={{ borderColor: "var(--admin-border)" }}
      role="tablist"
    >
      {items.map((item) => {
        const isActive = activeHref === item.href || activeHref.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={isActive}
            className="-mb-px inline-flex h-[40px] items-center gap-1.5 whitespace-nowrap border-b-2 px-[14px] text-[13px] font-medium transition"
            style={{
              color: isActive ? "var(--admin-primary)" : "var(--admin-text-secondary)",
              borderBottomColor: isActive ? "var(--admin-primary)" : "transparent",
            }}
          >
            {item.icon ? (
              <span className="text-[16px] leading-none" aria-hidden>
                {item.icon}
              </span>
            ) : null}
            {item.label}
            {item.count !== undefined ? (
              <span
                className="ml-1 inline-flex items-center justify-center rounded-full px-[7px] py-[1px] text-[11px] font-medium"
                style={{
                  backgroundColor: isActive ? "var(--admin-primary-light)" : "var(--admin-bg-tertiary)",
                  color: isActive ? "var(--admin-primary)" : "var(--admin-text-secondary)",
                }}
              >
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
