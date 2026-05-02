"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiInvoices, apiIssueInvoice, apiCancelInvoice, type InvoiceRow } from "@/lib/invoices-api";
import { useCallback, useEffect, useState } from "react";

const STATUSES = ["", "draft", "issued", "paid", "cancelled", "overdue"];

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "paid"      ? "bg-success-50 text-success-800" :
    status === "cancelled" ? "bg-error-50 text-error-800" :
    status === "issued"    ? "bg-info-50 text-info-800" :
    status === "overdue"   ? "bg-orange-100 text-orange-800" :
    "bg-figma-bg-1 text-fg-t7";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function PlatformInvoicesPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !allowed) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiInvoices(token, { page, per_page: 20, status: statusFilter || undefined });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed to load");
    }
  }, [token, allowed, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleIssue(id: number) {
    if (!token || !window.confirm("Issue this invoice?")) return;
    setBusyId(id);
    try { await apiIssueInvoice(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  async function handleCancel(id: number) {
    if (!token || !window.confirm("Cancel this invoice?")) return;
    setBusyId(id);
    try { await apiCancelInvoice(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) return (
    <div><h1 className="text-xl font-semibold">Invoices</h1><div className="mt-4"><ForbiddenNotice /></div></div>
  );

  return (
    <div>
      <h1 className="text-xl font-semibold">Invoices</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-fg-t6">
          Status
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </label>
        <button type="button" onClick={load} className="rounded border border-default bg-white px-3 py-1 text-sm">Refresh</button>
      </div>

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Invoice #</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Issued</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-fg-t6">No invoices found</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.invoice_number ?? "-"}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2 tabular-nums font-medium">
                  {r.currency} {Number(r.total_amount).toFixed(2)}
                </td>
                <td className="px-3 py-2">{r.company?.name ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-fg-t7">
                  {r.issued_at ? new Date(r.issued_at).toLocaleDateString() : "-"}
                </td>
                <td className="px-3 py-2 text-xs text-fg-t7">
                  {r.due_date ? new Date(r.due_date).toLocaleDateString() : "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {r.status === "draft" && (
                      <button type="button" disabled={busyId === r.id} onClick={() => void handleIssue(r.id)}
                        className="text-left text-xs text-info-700 underline disabled:opacity-40">Issue</button>
                    )}
                    {(r.status === "draft" || r.status === "issued") && (
                      <button type="button" disabled={busyId === r.id} onClick={() => void handleCancel(r.id)}
                        className="text-left text-xs text-error-600 underline disabled:opacity-40">Cancel</button>
                    )}
                  </div>
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
