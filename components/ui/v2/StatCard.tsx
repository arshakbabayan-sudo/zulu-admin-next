/**
 * v2 admin-redesign — StatCard component
 *
 * Source: docs/zulu-admin-v2.html lines 124-139, .stat-card pattern.
 * Two layouts:
 *   - Plain (default): white card with text-primary value
 *   - Colored: purple/green/amber/info solid bg with white text
 *
 * Usage:
 *   <StatCard tone="purple" icon={<i className="ti ti-calendar"/>}
 *             value="1,612" label="Total bookings"
 *             badge="+12%" footer="Bookings legacy: 842" />
 *
 *   <StatCard label="Total users" value="1,284" />  // plain variant
 *
 * StatGrid wraps multiple cards in a responsive grid (3 or 4 cols).
 */

import type { ReactNode } from "react";

export type StatCardTone = "plain" | "purple" | "green" | "amber" | "info";

const TONE_BG: Record<StatCardTone, string> = {
  plain: "var(--bg-primary, #ffffff)",
  purple: "var(--admin-primary)",
  green: "var(--admin-success)",
  amber: "var(--admin-warning)",
  info: "var(--admin-info)",
};

type Props = {
  tone?: StatCardTone;
  icon?: ReactNode;
  value: ReactNode;
  label: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
};

export function StatCard({ tone = "plain", icon, value, label, badge, footer }: Props) {
  const isColored = tone !== "plain";
  return (
    <div
      className="rounded-[12px] border p-[18px]"
      style={{
        backgroundColor: TONE_BG[tone],
        borderColor: isColored ? TONE_BG[tone] : "var(--admin-border)",
        color: isColored ? "white" : "var(--admin-text-primary)",
      }}
    >
      {icon || badge ? (
        <div className="mb-3 flex items-start justify-between">
          {icon ? (
            <span className="text-[22px]" style={{ opacity: isColored ? 0.75 : 1 }}>
              {icon}
            </span>
          ) : (
            <span />
          )}
          {badge ? (
            <span
              className="rounded-md px-2 py-[2px] text-[10px] font-semibold"
              style={{
                backgroundColor: isColored ? "rgba(255,255,255,0.2)" : "var(--admin-success-light)",
                color: isColored ? "white" : "var(--admin-success)",
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="text-[24px] font-semibold leading-tight">{value}</div>
      <div
        className="mt-[2px] text-[12px]"
        style={{ opacity: isColored ? 0.85 : 1, color: isColored ? "white" : "var(--admin-text-secondary)" }}
      >
        {label}
      </div>
      {footer ? (
        <div
          className="mt-3 text-[11px]"
          style={{ opacity: isColored ? 0.75 : 1, color: isColored ? "white" : "var(--admin-text-secondary)" }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * StatGrid — responsive grid wrapper for StatCard.
 * Defaults to 3 columns ≥md, 2 columns 640-768, 1 column below 640.
 */
export function StatGrid({
  children,
  cols = 3,
  className = "",
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const colClass = cols === 4 ? "lg:grid-cols-4" : cols === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${colClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
