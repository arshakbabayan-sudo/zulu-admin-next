/**
 * v2 admin-redesign — Card primitives
 *
 * Source: docs/zulu-admin-v2.html lines 117-122, .card / .card-header /
 * .card-title / .card-subtitle / .card-body pattern.
 *
 * Usage:
 *   <V2Card>
 *     <V2CardHeader title="Recent activity" action={<a>View all →</a>} />
 *     <V2CardBody>...content...</V2CardBody>
 *   </V2Card>
 *
 *   {/* Card without padded body, e.g. wrapping a Table: *\/}
 *   <V2Card>
 *     <V2CardHeader title="Hotels" />
 *     <table>...</table>
 *   </V2Card>
 */

import type { ReactNode } from "react";

export function V2Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[12px] border bg-white ${className}`.trim()}
      style={{ borderColor: "var(--admin-border)" }}
    >
      {children}
    </div>
  );
}

export function V2CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5"
      style={{
        borderColor: "var(--admin-border)",
        backgroundColor: "var(--admin-bg-secondary)",
      }}
    >
      <div className="min-w-0">
        <div
          className="text-[14px] font-semibold leading-tight"
          style={{ color: "var(--admin-text-primary)" }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            className="mt-[2px] text-[11px]"
            style={{ color: "var(--admin-text-secondary)" }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function V2CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`.trim()}>{children}</div>;
}
