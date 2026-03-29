"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiCommissions, apiCommissionRecords, apiDeactivateCommission,
  type CommissionPolicyRow, type CommissionRecordRow,
} from "@/lib/commissions-api";
import { useCallback, useEffect, useState } from "react";

type Tab = "policies" | "records";

export default function CommissionsPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [tab, setTab] = useState<Tab>("policies");

  const [policies, setPolicies] = useState<CommissionPolicyRow[]>([]);
  const [policiesMeta, setPoliciesMeta] = useState<ApiListMeta | null>(null);
  const [policiesPage, setPoliciesPage] = useState(1);

  const [records, setRecords] = useState<CommissionRecordRow[]>([]);
  const [recordsMeta, setRecordsMeta] = useState<ApiListMeta | null>(null);
  const [recordsPage, setRecordsPage] = useState(1);

  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadPolicies = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiCommissions(token, { page: policiesPage, per_page: 20 });
      setPolicies(res.data); setPoliciesMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, allowed, policiesPage]);

  const loadRecords = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiCommissionRecords(token, { page: recordsPage, per_page: 20 });
      setRecords(res.data); setRecordsMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, allowed, recordsPage]);

  useEffect(() => { if (tab === "policies") loadPolicies(); }, [tab, loadPolicies]);
  useEffect(() => { if (tab === "records") loadRecords(); }, [tab, loadRecords]);

  async function handleDeactivate(id: number) {
    if (!token || !window.confirm("Deactivate this commission policy?")) return;
    setBusyId(id);
    try { await apiDeactivateCommission(token, id); await loadPolicies(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) return (
    <div><h1 className="text-xl font-semibold">Commissions</h1><div className="mt-4"><ForbiddenNotice /></div></div>
  );

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700"}`;

  return (
    <div>
      <h1 className="text-xl font-semibold">Commissions</h1>
      <p className="mt-1 text-sm text-zinc-500">GET /api/commissions · /api/commission-records</p>

      <div className="mt-4 flex gap-0 border-b border-zinc-200">
        <button type="button" className={tabCls("policies")} onClick={() => setTab("policies")}>Policies</button>
        <button type="button" className={tabCls("records")} onClick={() => setTab("records")}>Records</button>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {tab === "policies" && (
        <>
          <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">No policies found</td></tr>
                )}
                {policies.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.id}</td>
                    <td className="px-3 py-2">{r.name ?? "—"}</td>
                    <td className="px-3 py-2">{r.type}</td>
                    <td className="px-3 py-2 tabular-nums">{r.rate}%</td>
                    <td className="px-3 py-2">{r.service_type ?? "all"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "active" ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "active" && (
                        <button type="button" disabled={busyId === r.id} onClick={() => void handleDeactivate(r.id)}
                          className="text-xs text-red-600 underline disabled:opacity-40">Deactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {policiesMeta && <PaginationBar meta={policiesMeta} onPage={setPoliciesPage} />}
        </>
      )}

      {tab === "records" && (
        <>
          <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Booking ID</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No records found</td></tr>
                )}
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.id}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{r.currency} {Number(r.amount).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "paid" ? "bg-green-100 text-green-800" :
                        r.status === "pending" ? "bg-amber-100 text-amber-800" :
                        "bg-zinc-100 text-zinc-700"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.company?.name ?? r.company_id ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.booking_id ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recordsMeta && <PaginationBar meta={recordsMeta} onPage={setRecordsPage} />}
        </>
      )}
    </div>
  );
}
