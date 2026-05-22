"use client";

/**
 * Phase A4 — sync a state record to the URL query string so refresh /
 * back-navigate preserve filters. Re-hydrates from URL on mount, writes
 * to URL on every change via `router.replace` (no history pollution).
 *
 * Usage:
 *
 *   const [filters, setFilters] = useUrlState({
 *     search: "",
 *     status: "",
 *     type: "",
 *   });
 *
 * Only string values are persisted (numbers/booleans cast via stringify).
 * Empty strings are dropped from the URL so it stays compact.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function useUrlState<T extends Record<string, string>>(
  defaults: T,
): [T, (next: Partial<T>) => void, () => void] {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize from URL once on mount, falling back to defaults.
  const [state, setState] = useState<T>(() => {
    const next: Record<string, string> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = searchParams?.get(key);
      if (value !== null && value !== undefined) {
        next[key] = value;
      }
    }
    return next as T;
  });

  // Write to URL whenever state changes.
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (value !== "" && value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    // Only update URL if it actually changed (avoid noisy router pings).
    if (newUrl !== window.location.pathname + window.location.search) {
      router.replace(newUrl, { scroll: false });
    }
  }, [state, router]);

  const update = useCallback(
    (next: Partial<T>) => {
      setState((prev) => ({ ...prev, ...next }));
    },
    [],
  );

  const reset = useCallback(() => {
    setState(defaults);
  }, [defaults]);

  return [state, update, reset];
}
