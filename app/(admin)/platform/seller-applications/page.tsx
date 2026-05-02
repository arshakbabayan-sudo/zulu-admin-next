"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiApproveSellerApplication,
  apiRejectSellerApplication,
  apiSellerApplications,
  type SellerApplicationRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function SellerApplicationsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<SellerApplicationRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  /** Empty = backend default (pending + under_review). Set to explicit status or "__all__" for no filter - backend needs status for all; we use common statuses */
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiSellerApplications(token, {
        page,
        per_page: 20,
        status: statusFilter === "" ? undefined : statusFilter,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed, page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: number) {
    if (!token) return;
    const notes = window.prompt("Optional notes") ?? "";
    setBusyId(id);
    try {
      await apiApproveSellerApplication(token, id, notes || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    if (!token) return;
    const rejection_reason = window.prompt("Rejection reason (required)") ?? "";
    if (!rejection_reason.trim()) {
      alert("Rejection reason is required by the API.");
      return;
    }
    setBusyId(id);
    try {
      await apiRejectSellerApplication(token, id, rejection_reason.trim());
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Seller applications</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Seller applications</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Seller applications</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-fg-t6">
          Status filter
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm"
          >
            <option value="">Default queue (pending / under review)</option>
            <option value="pending">pending</option>
            <option value="under_review">under_review</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Applied</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.company_name ?? r.company_id}</td>
                <td className="px-3 py-2">{r.service_type}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-xs text-fg-t6">{r.applied_at ?? "-"}</td>
                <td className="space-x-2 px-3 py-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => approve(r.id)}
                    className="text-xs text-emerald-700 underline disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => reject(r.id)}
                    className="text-xs text-error-700 underline disabled:opacity-40"
                  >
                    Reject
                  </button>
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
