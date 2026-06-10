"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  apiGlobalSearch,
  type GlobalSearchItem,
  type GlobalSearchResults,
} from "@/lib/platform-admin-api";

/**
 * Local i18n shim — returns `fallback` when the server translation row for
 * `key` hasn't been seeded yet (t() echoes the key on a miss). Mirrors the
 * platform/invoices pattern so new labels are i18n-overridable but never
 * render a raw dotted key.
 */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

const EMPTY_RESULTS: GlobalSearchResults = { companies: [], users: [], bookings: [] };

/** Minimum query length the backend searches on — below it returns empty arrays. */
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 400;

/**
 * Header "Search anything" box — wired to GET /platform-admin/search (cross-
 * entity global search: companies, users, bookings). Debounced typeahead with
 * a grouped dropdown; Enter keeps the legacy interim behavior of routing to
 * the Companies list filtered by the query.
 */
export function GlobalSearchBox() {
  const router = useRouter();
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const rootRef = useRef<HTMLFormElement>(null);
  // Monotonic request id — discards out-of-order responses when the user
  // keeps typing while an earlier fetch is still in flight.
  const requestSeq = useRef(0);

  const trimmed = q.trim();

  // Debounced fetch once the query is long enough.
  useEffect(() => {
    if (!token || trimmed.length < MIN_QUERY_LENGTH) {
      requestSeq.current += 1; // invalidate any in-flight response
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++requestSeq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await apiGlobalSearch(token, trimmed);
          if (seq !== requestSeq.current) return; // stale — a newer query won
          setResults(res.data ?? EMPTY_RESULTS);
        } catch {
          if (seq === requestSeq.current) setResults(EMPTY_RESULTS);
        } finally {
          if (seq === requestSeq.current) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [token, trimmed]);

  // Esc + outside-click close the dropdown.
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const groups: Array<{ key: string; header: string; items: GlobalSearchItem[] }> = [
    {
      key: "companies",
      header: tx(t, "admin.search.group_companies", "Companies"),
      items: results.companies,
    },
    {
      key: "users",
      header: tx(t, "admin.search.group_users", "Users"),
      items: results.users,
    },
    {
      key: "bookings",
      header: tx(t, "admin.search.group_bookings", "Bookings"),
      items: results.bookings,
    },
  ];
  const hasAny = groups.some((g) => g.items.length > 0);
  const showDropdown = open && trimmed.length >= MIN_QUERY_LENGTH;

  const goTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const placeholder =
    t("admin.header.search_placeholder") !== "admin.header.search_placeholder"
      ? t("admin.header.search_placeholder")
      : "Որոնում...";

  return (
    <form
      ref={rootRef}
      className="relative w-full max-w-[400px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed) return;
        // Interim fallback behavior (GROUP D): Enter routes to the Companies
        // list filtered by the query.
        goTo(`/platform/companies?q=${encodeURIComponent(trimmed)}`);
      }}
      role="search"
    >
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 fill-none stroke-slate-400"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(e.target.value.trim().length >= MIN_QUERY_LENGTH);
        }}
        onFocus={() => {
          if (trimmed.length >= MIN_QUERY_LENGTH) setOpen(true);
        }}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border bg-slate-50 pl-10 pr-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-[color:var(--admin-primary)] focus:bg-white focus:ring-2 focus:ring-[color:var(--admin-primary-soft)]"
        style={{ borderColor: "var(--admin-border)" }}
        aria-label={placeholder}
      />
      {showDropdown ? (
        <div
          className="absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-md border bg-white shadow-lg"
          style={{ borderColor: "var(--admin-border)" }}
        >
          <div className="max-h-[400px] overflow-y-auto py-1">
            {hasAny ? (
              groups
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.key}>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {g.header}
                    </p>
                    {g.items.map((item) => (
                      <button
                        key={`${g.key}-${item.id}`}
                        type="button"
                        onClick={() => goTo(item.href)}
                        className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 transition hover:bg-slate-50"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))
            ) : (
              <p className="px-4 py-3 text-center text-xs text-slate-500">
                {loading
                  ? tx(t, "admin.search.searching", "Searching…")
                  : tx(t, "admin.search.no_results", "No results")}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </form>
  );
}
