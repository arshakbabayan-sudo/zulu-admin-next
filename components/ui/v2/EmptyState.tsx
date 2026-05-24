/**
 * v2 admin-redesign — EmptyState component
 *
 * Source: docs/zulu-admin-v2.html lines 225-229, .empty-state pattern.
 * Centered card content for "no data yet" / "no results" surfaces.
 *
 * Usage:
 *   <EmptyState
 *     icon={<i className="ti ti-inbox" />}
 *     title="No bookings yet"
 *     subtitle="Bookings will appear here once customers place orders."
 *     action={<button className="...">Create test booking</button>}
 *   />
 */

import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-[60px] text-center">
      {icon ? (
        <div
          className="mx-auto mb-3 inline-flex h-[60px] w-[60px] items-center justify-center rounded-full text-[28px]"
          style={{
            backgroundColor: "var(--admin-bg-tertiary)",
            color: "var(--admin-text-tertiary)",
          }}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <div
        className="text-[14px] font-semibold"
        style={{ color: "var(--admin-text-primary)" }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          className="mb-4 mt-1 text-[12px]"
          style={{ color: "var(--admin-text-secondary)" }}
        >
          {subtitle}
        </div>
      ) : null}
      {action}
    </div>
  );
}
