/**
 * v2 admin-redesign — Badge pill
 *
 * Source: docs/admin_designe/6_management.html .badge-{success|warning|danger|
 * info|gray|primary}. Uppercase 11px label, soft tonal background.
 *
 * Usage:
 *   <V2Badge tone="success">Active</V2Badge>
 *   <V2Badge tone="warning" icon={<i className="ti ti-clock"/>}>Pending</V2Badge>
 */

import type { ReactNode } from "react";

export type V2BadgeTone = "success" | "warning" | "danger" | "info" | "gray" | "primary";

const BADGE_TONE: Record<V2BadgeTone, { bg: string; fg: string }> = {
  success: { bg: "var(--admin-success-light)", fg: "var(--admin-success-dark)" },
  warning: { bg: "var(--admin-warning-light)", fg: "var(--admin-warning-dark)" },
  danger: { bg: "var(--admin-danger-light)", fg: "var(--admin-danger-dark)" },
  info: { bg: "var(--admin-info-light)", fg: "var(--admin-info-dark)" },
  gray: { bg: "var(--admin-bg-tertiary)", fg: "var(--admin-text-secondary)" },
  primary: { bg: "var(--admin-primary-light)", fg: "var(--admin-primary-dark)" },
};

export function V2Badge({
  tone = "gray",
  icon,
  children,
  className = "",
}: {
  tone?: V2BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const s = BADGE_TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[8px] px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.3px] ${className}`.trim()}
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {icon}
      {children}
    </span>
  );
}
