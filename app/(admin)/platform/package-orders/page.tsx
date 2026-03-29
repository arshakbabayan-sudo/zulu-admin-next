"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiPlatformPackageOrders,
  type PlatformPackageOrderRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function PlatformPackageOrdersPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformPackageOrderRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [companyIdDraft, setCompanyIdDraft] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformPackageOrders(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        payment_status: paymentStatusFilter || undefined,
        company_id: companyId,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load package orders");
    }
  }, [token, allowed, page, statusFilter, paymentStatusFilter, companyId]);

  useEffect(() => {
    load();
  }, [load]);

  function applyCompanyFilter() {
    const t = companyIdDraft.trim();
    if (!t) {
      setCompanyId(undefined);
      setPage(1);
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Company ID must be a positive number");
      return;
    }
    setErr(null);
    setCompanyId(n);
    setPage(1);
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Package orders</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Package orders</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Platform package orders</h1>
      <p className="mt-1 text-sm text-zinc-500">GET /api/platform-admin/package-orders</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-zinc-600">
          Status
          <input
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder="order status"
            className="ml-2 rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-zinc-600">
          Payment status
          <input
            value={paymentStatusFilter}
            onChange={(e) => {
              setPage(1);
              setPaymentStatusFilter(e.target.value);
            }}
            placeholder="payment status"
            className="ml-2 rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-zinc-600">
          Company ID
          <input
            value={companyIdDraft}
            onChange={(e) => setCompanyIdDraft(e.target.value)}
            placeholder="optional"
            className="ml-2 w-24 rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums"
          />
        </label>
        <button
          type="button"
          onClick={applyCompanyFilter}
          className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm hover:bg-zinc-50"
        >
          Apply company
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Order #</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Package</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Buyer</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.order_number}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.payment_status}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.final_total_snapshot} {r.currency}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-700">
                  {r.package
                    ? `${r.package.package_title} (#${r.package.id})`
                    : `#${r.package_id}`}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.company ? r.company.name : `— (${r.company_id})`}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.user ? `${r.user.name}` : `— (${r.user_id})`}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">{r.created_at ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
