"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { StatusPill } from "@/components/ui/StatusPill";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiPlatformPayments, type PlatformPaymentRow } from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function PlatformPaymentsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformPaymentRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformPayments(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load payments");
    }
  }, [token, allowed, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed) {
    return (
      <div>
        <h1 className="admin-page-title">Payments</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="admin-page-title">Payments</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="admin-page-title">Platform payments</h1>
      <div className="mt-4">
        <label className="text-sm text-fg-t6">
          Status
          <input
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder="e.g. completed"
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          />
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Currency</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Paid at</th>
              <th className="px-3 py-2">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2 tabular-nums">{r.amount}</td>
                <td className="px-3 py-2">{r.currency}</td>
                <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2">{r.payment_method ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-fg-t6">{r.paid_at ?? "-"}</td>
                <td className="px-3 py-2 text-xs">
                  {r.invoice
                    ? `#${r.invoice.id} ${r.invoice.unique_booking_reference ?? ""}`
                    : r.invoice_id ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
