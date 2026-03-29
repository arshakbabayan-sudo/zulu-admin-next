"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiFinanceSummary, apiFinanceEntitlements, apiFinanceSettlements,
  apiMarkEntitlementsPayable, apiUpdateSettlementStatus,
  type FinanceEntitlementRow, type FinanceSettlementRow, type CompanyFinanceSummary,
} from "@/lib/finance-api";
import { useCallback, useEffect, useState } from "react";

type Tab = "summary" | "entitlements" | "settlements";

export default function FinancePage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [tab, setTab] = useState<Tab>("summary");

  const [summary, setSummary] = useState<CompanyFinanceSummary | null>(null);
  const [entitlements, setEntitlements] = useState<FinanceEntitlementRow[]>([]);
  const [entMeta, setEntMeta] = useState<ApiListMeta | null>(null);
  const [entPage, setEntPage] = useState(1);
  const [settlements, setSettlements] = useState<FinanceSettlementRow[]>([]);
  const [setMeta2, setSetMeta2] = useState<ApiListMeta | null>(null);
  const [setPage2, setSetPage2] = useState(1);

  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedEnt, setSelectedEnt] = useState<Set<number>>(new Set());

  const loadSummary = useCallback(async () => {
    if (!token || !allowed) return;
    try { const r = await apiFinanceSummary(token); setSummary(r.data); }
    catch (e) { if (e instanceof ApiRequestError && e.status === 403) setForbidden(true); }
  }, [token, allowed]);

  const loadEntitlements = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    try {
      const r = await apiFinanceEntitlements(token, { page: entPage, per_page: 20 });
      setEntitlements(r.data); setEntMeta(r.meta);
    } catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
  }, [token, allowed, entPage]);

  const loadSettlements = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null);
    try {
      const r = await apiFinanceSettlements(token, { page: setPage2, per_page: 20 });
      setSettlements(r.data); setSetMeta2(r.meta);
    } catch (e) { setErr(e instanceof ApiRequestError ? e.message : "Failed"); }
  }, [token, allowed, setPage2]);

  useEffect(() => { if (tab === "summary") loadSummary(); }, [tab, loadSummary]);
  useEffect(() => { if (tab === "entitlements") loadEntitlements(); }, [tab, loadEntitlements]);
  useEffect(() => { if (tab === "settlements") loadSettlements(); }, [tab, loadSettlements]);

  async function handleMarkPayable() {
    if (!token || selectedEnt.size === 0) return;
    setBusy(true);
    try { await apiMarkEntitlementsPayable(token, Array.from(selectedEnt)); setSelectedEnt(new Set()); await loadEntitlements(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleSettlementStatus(id: number, status: string) {
    if (!token) return;
    setBusy(true);
    try { await apiUpdateSettlementStatus(token, id, status); await loadSettlements(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (!allowed || forbidden) return (
    <div><h1 className="text-xl font-semibold">Finance</h1><div className="mt-4"><ForbiddenNotice /></div></div>
  );

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700"}`;

  return (
    <div>
      <h1 className="text-xl font-semibold">Finance</h1>
      <p className="mt-1 text-sm text-zinc-500">GET /api/finance/summary · entitlements · settlements</p>

      <div className="mt-4 flex gap-0 border-b border-zinc-200">
        <button type="button" className={tabCls("summary")} onClick={() => setTab("summary")}>Summary</button>
        <button type="button" className={tabCls("entitlements")} onClick={() => setTab("entitlements")}>Entitlements</button>
        <button type="button" className={tabCls("settlements")} onClick={() => setTab("settlements")}>Settlements</button>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {tab === "summary" && summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-medium uppercase text-zinc-500">{k.replace(/_/g, " ")}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
                {typeof v === "number" ? Number(v).toFixed(2) : String(v ?? "—")}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "entitlements" && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" disabled={busy || selectedEnt.size === 0} onClick={handleMarkPayable}
              className="rounded bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-40">
              Mark {selectedEnt.size > 0 ? `(${selectedEnt.size}) ` : ""}payable
            </button>
          </div>
          <div className="mt-3 overflow-x-auto rounded border border-zinc-200 bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2"><input type="checkbox" onChange={(e) => {
                    if (e.target.checked) setSelectedEnt(new Set(entitlements.map(r => r.id)));
                    else setSelectedEnt(new Set());
                  }} /></th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Booking ID</th>
                  <th className="px-3 py-2">Payable at</th>
                </tr>
              </thead>
              <tbody>
                {entitlements.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">No entitlements</td></tr>
                )}
                {entitlements.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selectedEnt.has(r.id)}
                        onChange={(e) => setSelectedEnt(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(r.id) : next.delete(r.id);
                          return next;
                        })} />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.id}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{r.currency} {Number(r.amount).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "payable" ? "bg-green-100 text-green-800" :
                        r.status === "paid" ? "bg-blue-100 text-blue-800" :
                        "bg-amber-100 text-amber-800"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.company?.name ?? r.company_id}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.booking_id ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {r.payable_at ? new Date(r.payable_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {entMeta && <PaginationBar meta={entMeta} onPage={setEntPage} />}
        </>
      )}

      {tab === "settlements" && (
        <>
          <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Settled at</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {settlements.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No settlements</td></tr>
                )}
                {settlements.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-3 py-2 tabular-nums text-zinc-500">{r.id}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">{r.currency} {Number(r.amount).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        r.status === "completed" ? "bg-green-100 text-green-800" :
                        r.status === "pending" ? "bg-amber-100 text-amber-800" :
                        "bg-zinc-100 text-zinc-700"
                      }`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2">{r.company?.name ?? r.company_id}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {r.settled_at ? new Date(r.settled_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "pending" && (
                        <button type="button" disabled={busy} onClick={() => void handleSettlementStatus(r.id, "completed")}
                          className="text-xs text-blue-700 underline disabled:opacity-40">Mark completed</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {setMeta2 && <PaginationBar meta={setMeta2} onPage={setSetPage2} />}
        </>
      )}
    </div>
  );
}
