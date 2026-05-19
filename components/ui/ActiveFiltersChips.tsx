"use client";

/**
 * Renders active filters as removable chips above a list view. Hidden when
 * no filters are active. Pair with a "Clear all" button passed in via the
 * `onClearAll` prop.
 *
 * Usage:
 *   <ActiveFiltersChips
 *     filters={[
 *       { key: "status", label: "Status", value: statusFilter, onRemove: () => setStatusFilter("") },
 *       { key: "priority", label: "Priority", value: priorityFilter, onRemove: () => setPriorityFilter("") },
 *       { key: "search", label: "Search", value: search, onRemove: () => setSearch("") },
 *     ]}
 *     onClearAll={() => { setStatusFilter(""); setPriorityFilter(""); setSearch(""); }}
 *   />
 */

import { Button } from "./Button";

export type FilterChip = {
  key: string;
  label: string;
  value: string | number | null | undefined;
  onRemove: () => void;
};

export function ActiveFiltersChips({
  filters,
  onClearAll,
  className,
}: {
  filters: FilterChip[];
  onClearAll?: () => void;
  className?: string;
}) {
  const active = filters.filter(
    (f) => f.value !== null && f.value !== undefined && f.value !== ""
  );
  if (active.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs font-medium text-fg-t6">Active filters:</span>
      {active.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={f.onRemove}
          className="group inline-flex items-center gap-1 rounded-full border border-default bg-figma-bg-1 px-2 py-0.5 text-xs text-fg-t7 hover:border-error-200 hover:bg-error-50 hover:text-error-700"
          title={`Remove ${f.label} filter`}
        >
          <span className="font-medium">{f.label}:</span>
          <span>{String(f.value)}</span>
          <span aria-hidden className="ml-1 text-fg-t5 group-hover:text-error-600">
            ✕
          </span>
        </button>
      ))}
      {active.length > 1 && onClearAll && (
        <Button size="sm" variant="ghost" onClick={onClearAll}>
          Clear all
        </Button>
      )}
    </div>
  );
}
