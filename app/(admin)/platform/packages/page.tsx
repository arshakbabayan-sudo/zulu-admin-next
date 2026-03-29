"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiDeactivatePlatformPackage,
  apiPlatformPackages,
  type PlatformGovernancePackageRow,
} from "@/lib/platform-admin-api";
import { useCallback, useEffect, useState } from "react";

export default function PlatformPackagesGovernancePage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<PlatformGovernancePackageRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [companyIdDraft, setCompanyIdDraft] = useState("");
  const [companyId, setCompanyId] = useState<number | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiPlatformPackages(token, {
        page,
        per_page: 20,
        status: statusFilter || undefined,
        company_id: companyId,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load packages");
    }
  }, [token, allowed, page, statusFilter, companyId]);

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

  async function deactivate(pkg: PlatformGovernancePackageRow) {
    if (!token) return;
    const reason = window.prompt(
      `Optional reason for force-deactivating “${pkg.package_title}” (package #${pkg.id})`,
      ""
    );
    if (reason === null) return;
    setBusyId(pkg.id);
    try {
      await apiDeactivatePlatformPackage(token, pkg.id, reason.trim() || undefined);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Deactivate failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Packages</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Packages</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Packages governance</h1>
      <p className="mt-1 text-sm text-zinc-500">
        GET /api/platform-admin/packages — POST …/packages/{"{id}"}/deactivate
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm text-zinc-600">
          Status
          <input
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            placeholder="package status"
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
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Public / bookable</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className="px-3 py-2 tabular-nums">{r.id}</td>
                <td className="px-3 py-2">{r.package_title}</td>
                <td className="px-3 py-2 text-xs">{r.package_type}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-xs">
                  {r.company ? r.company.name : `— (${r.company_id})`}
                </td>
                <td className="px-3 py-2 text-xs tabular-nums">
                  {r.is_public ? "yes" : "no"} / {r.is_bookable ? "yes" : "no"}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => deactivate(r)}
                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    {busyId === r.id ? "…" : "Force deactivate"}
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
