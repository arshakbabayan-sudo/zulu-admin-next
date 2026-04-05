"use client";

import type { ApiListMeta } from "@/lib/api-envelope";

export function PaginationBar({
  meta,
  onPage,
}: {
  meta: ApiListMeta;
  onPage: (p: number) => void;
}) {
  const { current_page, last_page, total, per_page } = meta;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>
        Page {current_page} of {last_page} · {total} total · {per_page} per page
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={current_page <= 1}
          onClick={() => onPage(current_page - 1)}
          className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={current_page >= last_page}
          onClick={() => onPage(current_page + 1)}
          className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
