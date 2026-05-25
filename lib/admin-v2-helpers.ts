/**
 * v2 admin-redesign — shared helpers that were copy-pasted across ~30 list
 * pages (per session_phase_z_15_16_zero_placeholders_2026_05_25.md follow-up
 * #1). Centralised here so the Finance group migration and future v2 pages
 * import from a single place.
 *
 *   import { formatRelativeTime, pickAvatarTone, avatarToneClass, statusBadgeStyle } from "@/lib/admin-v2-helpers";
 */

import type { CSSProperties } from "react";

/** "2h ago" / "Yesterday" / "5 days ago" / locale date for older entries. */
export function formatRelativeTime(input: string | number | Date | null | undefined): string {
  if (input == null || input === "") return "—";
  const t = typeof input === "object" ? input.getTime() : new Date(input).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(input).toLocaleDateString();
}

/** Deterministic avatar tone — same input always returns the same colour. */
export type AvatarTone = "purple" | "teal" | "amber" | "blue";

const AVATAR_TONES: AvatarTone[] = ["purple", "teal", "amber", "blue"];

export function pickAvatarTone(key: string | number | null | undefined): AvatarTone {
  if (key == null) return "purple";
  const s = String(key);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

export function avatarInitials(name: string | null | undefined): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const TONE_STYLE: Record<AvatarTone, CSSProperties> = {
  purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
  teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
  amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
  blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
};

export function avatarStyle(tone: AvatarTone): CSSProperties {
  return TONE_STYLE[tone];
}

/**
 * Status badge palette used across Finance group + many other list pages.
 * Returns inline style; semantics:
 *   - success: paid / settled / active / completed / issued (vouchers)
 *   - warning: pending / awaiting / overdue-soft
 *   - info:    processing / used (voucher) / draft-link
 *   - danger:  failed / cancelled / overdue / void / expired
 *   - gray:    draft / refunded / inactive
 *   - primary: misc emphasis (fixed-rate, etc.)
 */
export type StatusTone = "success" | "warning" | "info" | "danger" | "gray" | "primary";

const STATUS_STYLE: Record<StatusTone, CSSProperties> = {
  success: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
  warning: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
  info: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  danger: { backgroundColor: "var(--admin-danger-light)", color: "var(--admin-danger-dark)" },
  gray: { backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" },
  primary: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
};

export function statusBadgeStyle(tone: StatusTone): CSSProperties {
  return STATUS_STYLE[tone];
}

/** Standard pill className that pairs with `statusBadgeStyle()`. */
export const STATUS_BADGE_CLASS =
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]";
