"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { userHasPermission } from "@/lib/access";
import type { ApiListMeta } from "@/lib/api-envelope";
import { ApiRequestError } from "@/lib/api-client";
import type { OperatorInventorySegment } from "@/lib/operator-inventory-api";
import { apiOperatorInventoryList } from "@/lib/operator-inventory-api";
import { useCallback, useEffect, useMemo, useState } from "react";

export type InventoryColumn = {
  header: string;
  getCell: (row: Record<string, unknown>) => string;
};

type Props = {
  title: string;
  apiHint?: string;
  segment: OperatorInventorySegment;
  permission: string;
  columns: InventoryColumn[];
  /** Merged into the list request (e.g. company_id, city). Omit empty values. */
  queryParams: Record<string, string | number | boolean | undefined>;
  filterBar?: React.ReactNode;
};

export function InventoryOversightList({
  title,
  segment,
  permission,
  columns,
  queryParams,
  filterBar,
}: Props) {
  const { token, user } = useAdminAuth();
  const allowed = userHasPermission(user, permission);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const filterSig = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  useEffect(() => {
    setPage(1);
  }, [filterSig]);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    setIsLoading(true);
    try {
      const res = await apiOperatorInventoryList(token, segment, page, queryParams);
      setRows(res.data.map((r) => (typeof r === "object" && r !== null ? (r as Record<string, unknown>) : {})));
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else if (e instanceof ApiRequestError && (e.status === 404 || e.message === "Not found")) {
        // Treat backend "Not found" as empty list, not as an error
        setRows([]);
        setMeta(null);
      } else {
        setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
        setRows([]);
        setMeta(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, allowed, segment, page, queryParams]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{title}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice messageKey="admin.forbidden.inventory_oversight" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="admin-page-title">{title}</h1>
          {meta && (
            <p className="mt-1 text-sm text-fg-t6">
              {meta.total} total · page {meta.current_page} of {meta.last_page}
            </p>
          )}
        </div>
      </header>

      {filterBar ? (
        <div className="admin-card p-4">
          <div className="flex flex-wrap items-end gap-3">{filterBar}</div>
        </div>
      ) : null}

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      <div className={`admin-card overflow-hidden transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs font-medium uppercase tracking-wide text-fg-t6">
            <tr>
              {columns.map((c, idx) => (
                <th key={`h-${idx}-${c.header}`} className="px-4 py-3">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !isLoading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-fg-t6">
                  No items found.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const key = typeof r.id === "number" || typeof r.id === "string" ? String(r.id) : `row-${i}`;
              return (
                <tr key={key} className="border-b border-default last:border-0 hover:bg-figma-bg-1">
                  {columns.map((c, ci) => (
                    <td key={`c-${key}-${ci}`} className="max-w-[280px] truncate px-4 py-3">
                      {c.getCell(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
