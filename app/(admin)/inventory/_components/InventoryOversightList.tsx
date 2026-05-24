"use client";

/**
 * Phase-2 migration to shared @/components/ui primitives. Single migration
 * here cascades to all 5 inventory pages (hotels/flights/cars/excursions/transfers).
 */

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { userHasPermission } from "@/lib/access";
import type { ApiListMeta } from "@/lib/api-envelope";
import { ApiRequestError } from "@/lib/api-client";
import type { OperatorInventorySegment } from "@/lib/operator-inventory-api";
import { apiOperatorInventoryList } from "@/lib/operator-inventory-api";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pagination,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  SectionTabs,
  FilterCard,
  V2Card,
} from "@/components/ui/v2";

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
    void load();
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

  const segmentLabel = (s: OperatorInventorySegment): string => {
    switch (s) {
      case "hotels": return "Hotels";
      case "flights": return "Flights";
      case "transfers": return "Transfers";
      case "cars": return "Cars";
      case "excursions": return "Excursions";
      default: return s;
    }
  };

  return (
    <div>
      {/* v2 admin-redesign — Inventory oversight (super-admin). 5-tab list. */}
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Inventory", href: "/inventory/hotels" },
          { label: segmentLabel(segment) },
        ]}
        title={title}
        subtitle={meta ? `${meta.total} total · page ${meta.current_page} of ${meta.last_page}` : undefined}
      />

      <SectionTabs
        activeHref={`/inventory/${segment}`}
        items={[
          { href: "/inventory/hotels", label: "Hotels" },
          { href: "/inventory/flights", label: "Flights" },
          { href: "/inventory/transfers", label: "Transfers" },
          { href: "/inventory/cars", label: "Cars" },
          { href: "/inventory/excursions", label: "Excursions" },
        ]}
      />

      {filterBar ? (
        <FilterCard>{filterBar}</FilterCard>
      ) : null}

      {err ? (
        <div className="mb-4 rounded-md border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      ) : null}

      <V2Card>
      <div className={`transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        <Table>
          <THead>
            <TR>
              {columns.map((c, idx) => (
                <TH key={`h-${idx}-${c.header}`}>{c.header}</TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.length === 0 && !isLoading ? (
              <TEmpty colSpan={columns.length}>No items found.</TEmpty>
            ) : null}
            {rows.map((r, i) => {
              const key = typeof r.id === "number" || typeof r.id === "string" ? String(r.id) : `row-${i}`;
              return (
                <TR key={key}>
                  {columns.map((c, ci) => (
                    <TD key={`c-${key}-${ci}`} className="max-w-[280px] truncate">
                      {c.getCell(r)}
                    </TD>
                  ))}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
      </V2Card>

      {meta && meta.last_page > 1 ? (
        <Pagination page={meta.current_page} lastPage={meta.last_page} onPage={setPage} />
      ) : null}
    </div>
  );
}
