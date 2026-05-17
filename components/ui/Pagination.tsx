"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Quest CRM Figma 10293:21246 — Previous / numbers (1 2 3 … 8 9 10) / Next.
 * Active page in primary-500.
 *
 * New shared replacement for `components/PaginationBar.tsx` (kept around for
 * legacy callers — both routes the same API).
 */

export type PaginationProps = {
  page: number;
  lastPage: number;
  onPage: (page: number) => void;
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
};

function buildPageList(page: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, last - 1, last, page - 1, page, page + 1]);
  const out: (number | "…")[] = [];
  let prev = 0;
  Array.from(set)
    .filter((n) => n >= 1 && n <= last)
    .sort((a, b) => a - b)
    .forEach((n) => {
      if (n - prev > 1) out.push("…");
      out.push(n);
      prev = n;
    });
  return out;
}

export function Pagination({
  page,
  lastPage,
  onPage,
  className,
  prevLabel = "Previous",
  nextLabel = "Next",
}: PaginationProps) {
  if (lastPage <= 1) return null;
  const pages = buildPageList(page, lastPage);
  const canPrev = page > 1;
  const canNext = page < lastPage;

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-4 px-2 py-3", className)}
    >
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => canPrev && onPage(page - 1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-fg-t7 hover:text-fg-t8 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{prevLabel}</span>
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-2 text-sm text-fg-t6">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={cn(
                "min-w-8 rounded-md px-2 py-1 text-sm transition-colors",
                p === page
                  ? "bg-primary-500/10 text-primary-500 font-semibold"
                  : "text-fg-t7 hover:bg-figma-bg-1 hover:text-fg-t8"
              )}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => canNext && onPage(page + 1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-fg-t7 hover:text-fg-t8 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="hidden sm:inline">{nextLabel}</span>
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
