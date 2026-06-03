/**
 * v2 admin-redesign — SuperAdminTag pill
 *
 * Renders the small "Super admin" shield-lock chip that sits inline next to the
 * page title on super-only pages (Management group + platform settings).
 *
 * Source: docs/admin_designe/6_management.html line 362 (.page-title .super-tag).
 * Pass as the `titleBadge` prop on PageHeader.
 */

import type { ReactNode } from "react";

export function SuperAdminTag({
  label = "Super admin",
  icon,
}: {
  label?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[8px] px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.3px]"
      style={{
        backgroundColor: "var(--admin-primary-light)",
        color: "var(--admin-primary-dark)",
      }}
    >
      {icon ?? <i className="ti ti-shield-lock" style={{ fontSize: "13px" }} aria-hidden />}
      {label}
    </span>
  );
}
