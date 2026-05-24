/**
 * v2 admin-redesign — FilterCard component
 *
 * Source: docs/zulu-admin-v2.html lines 183-187, .filter-card pattern.
 * Horizontal filter bar with labeled fields + optional Apply/Reset buttons.
 *
 * Usage:
 *   <FilterCard>
 *     <FilterField label="Search" minWidth={240}>
 *       <input type="search" placeholder="Search..." />
 *     </FilterField>
 *     <FilterField label="Status">
 *       <select>...</select>
 *     </FilterField>
 *     <button className="btn btn-ghost btn-sm">Reset</button>
 *     <button className="btn btn-primary btn-sm">Apply</button>
 *   </FilterCard>
 */

import type { ReactNode } from "react";

export function FilterCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-end gap-2.5 rounded-[12px] border bg-white p-[14px_16px] ${className}`.trim()}
      style={{ borderColor: "var(--admin-border)" }}
    >
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
  minWidth = 140,
}: {
  label: ReactNode;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="flex flex-col gap-1" style={{ minWidth }}>
      <span
        className="text-[11px] font-medium"
        style={{ color: "var(--admin-text-secondary)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
