"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import type { ApiListMeta } from "@/lib/api-envelope";

export function PaginationBar({
  meta,
  onPage,
}: {
  meta: ApiListMeta;
  onPage: (p: number) => void;
}) {
  const { t } = useLanguage();
  const { current_page, last_page, total, per_page } = meta;
  const summary = `${t("admin.pagination.page")} ${current_page} ${t("admin.pagination.of")} ${last_page} · ${total} ${t("admin.pagination.total")} · ${per_page} ${t("admin.pagination.per_page")}`;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>{summary}</span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={current_page <= 1}
          onClick={() => onPage(current_page - 1)}
          className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40"
        >
          {t("common.prev")}
        </button>
        <button
          type="button"
          disabled={current_page >= last_page}
          onClick={() => onPage(current_page + 1)}
          className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40"
        >
          {t("common.next")}
        </button>
      </div>
    </div>
  );
}
