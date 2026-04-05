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

  const filterSig = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  useEffect(() => {
    setPage(1);
  }, [filterSig]);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiOperatorInventoryList(token, segment, page, queryParams);
      setRows(res.data.map((r) => (typeof r === "object" && r !== null ? (r as Record<string, unknown>) : {})));
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
      setRows([]);
      setMeta(null);
    }
  }, [token, allowed, segment, page, queryParams]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed || forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="mt-4">
          <ForbiddenNotice message="This inventory list requires the matching commerce view permission (e.g. flights.view). Super admins have full access. A 403 means your token is valid but not authorized for this resource." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {filterBar ? <div className="mt-4 flex flex-wrap items-end gap-3">{filterBar}</div> : null}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-700">
            <tr>
              {columns.map((c, idx) => (
                <th key={`h-${idx}-${c.header}`} className="px-3 py-2">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const key = typeof r.id === "number" || typeof r.id === "string" ? String(r.id) : `row-${i}`;
              return (
                <tr key={key} className="border-b border-slate-100">
                  {columns.map((c, ci) => (
                    <td key={`c-${key}-${ci}`} className="max-w-[280px] truncate px-3 py-2">
                      {c.getCell(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
