/**
 * v2 admin-redesign — Avatar pill
 *
 * Source: docs/admin_designe/6_management.html .avatar (32px) / .avatar.sm
 * (24px) + tone variants (.avatar-teal, .avatar-amber, .avatar-blue).
 * Used in table cells (company / person initial), drawer headers, etc.
 *
 * Usage:
 *   <V2Avatar label="ZULU Travel" />
 *   <V2Avatar label="Anna Khachatryan" tone="amber" size="sm" />
 */

export type V2AvatarTone = "default" | "teal" | "amber" | "blue";

const AVATAR_TONE: Record<V2AvatarTone, { bg: string; fg: string }> = {
  default: { bg: "var(--admin-primary-light)", fg: "var(--admin-primary-dark)" },
  teal: { bg: "var(--admin-success-light)", fg: "var(--admin-success-dark)" },
  amber: { bg: "var(--admin-warning-light)", fg: "var(--admin-warning-dark)" },
  blue: { bg: "var(--admin-info-light)", fg: "var(--admin-info-dark)" },
};

export function V2Avatar({
  label,
  tone = "default",
  size = "md",
  className = "",
}: {
  label: string;
  tone?: V2AvatarTone;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = AVATAR_TONE[tone];
  const dim = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[12px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dim} ${className}`.trim()}
      style={{ backgroundColor: s.bg, color: s.fg }}
      aria-hidden
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}
