/**
 * Badge — handoff-aligned status/label chip.
 *
 * Mockup reference: ZuluSpin admin-mockup.html (`.badge.badge-{tone}` block).
 * Pattern: rounded-md (8px), uppercase, letter-spacing 0.3px, font-weight 600,
 * 11px text, no border, soft-tint background + dark text matching the tone.
 *
 * Six tones: primary | success | warning | danger | info | gray
 *
 * Use Badge for "category / type / status word" labels on the dashboard
 * and similar surfaces. Existing pages keep using {@link StatusPill}
 * (rounded-full + bordered) — both coexist on purpose so the Phase 1
 * visual refresh stays scoped to the dashboard.
 *
 * Usage:
 *   <Badge tone="success">Active</Badge>
 *   <Badge tone="warning">Pending</Badge>
 *   <Badge tone="primary">Admin</Badge>
 */

import type { ReactNode } from "react";

export type BadgeTone = "primary" | "success" | "warning" | "danger" | "info" | "gray";

const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: "bg-primary-50 text-primary-900",
  success: "bg-success-50 text-success-900",
  warning: "bg-warning-50 text-warning-900",
  danger: "bg-error-50 text-error-900",
  info: "bg-info-50 text-info-900",
  gray: "bg-figma-bg-1 text-fg-t6",
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "gray", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-zulu px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.3px] ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * StatusDot — colored dot + label, mockup `.status-dot` pattern.
 * Use when a badge is too heavy; this is a single-line inline indicator
 * with a tiny colored circle on the left.
 */
const DOT_TONE_CLASSES: Record<BadgeTone, string> = {
  primary: "before:bg-primary-600",
  success: "before:bg-success-700",
  warning: "before:bg-warning-700",
  danger: "before:bg-error-700",
  info: "before:bg-info-700",
  gray: "before:bg-[var(--color-text-tertiary)]",
};

export function StatusDot({
  tone = "success",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-fg-t7 before:inline-block before:size-1.5 before:rounded-full ${DOT_TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
