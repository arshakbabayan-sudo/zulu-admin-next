"use client";

/**
 * Phase A4 — show currently-active filter values as removable chips above
 * a list. Each chip displays "Label: Value ✕" — clicking ✕ clears that
 * single filter (caller decides what "clear" means via the onClear cb).
 *
 * Skips chips for empty values, so a row of filters where only "status"
 * is set renders exactly one chip.
 */

import React from "react";

export type FilterChip = {
  /** Key into the filter state (e.g. "status", "search"). */
  key: string;
  /** Human-readable label shown in the chip, e.g. "Status". */
  label: string;
  /** Current value. If empty/null/undefined, the chip is hidden. */
  value: string | null | undefined;
  /** Optional formatter for the displayed value (e.g. lookup a label for a code). */
  displayValue?: (value: string) => string;
};

type Props = {
  chips: FilterChip[];
  onClear: (key: string) => void;
  onClearAll?: () => void;
  clearAllLabel?: string;
  className?: string;
};

export function ActiveFiltersChips({
  chips,
  onClear,
  onClearAll,
  clearAllLabel = "Clear all",
  className,
}: Props) {
  const visible = chips.filter(
    (c) => c.value !== null && c.value !== undefined && c.value !== "",
  );
  if (visible.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {visible.map((chip) => {
        const display = chip.displayValue ? chip.displayValue(chip.value as string) : chip.value;
        return (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700"
          >
            <span className="text-fg-t6">{chip.label}:</span>
            <span>{display}</span>
            <button
              type="button"
              onClick={() => onClear(chip.key)}
              className="ml-0.5 -mr-1 rounded-full p-0.5 text-primary-600 transition hover:bg-primary-100 hover:text-primary-800"
              aria-label={`Clear filter ${chip.label}`}
            >
              ✕
            </button>
          </span>
        );
      })}
      {onClearAll && visible.length > 1 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-fg-t6 underline transition hover:text-primary"
        >
          {clearAllLabel}
        </button>
      ) : null}
    </div>
  );
}
