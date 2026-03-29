"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiOffers, apiPublishOffer, apiArchiveOffer, type OfferRow } from "@/lib/inventory-crud-api";
import { useCallback, useEffect, useState } from "react";

const STATUSES = ["", "draft", "published", "archived"];

function StatusBadge({ status }: { status: string }) {
  const cls = status === "published" ? "bg-green-100 text-green-800" :
    status === "archived" ? "bg-zinc-200 text-zinc-600" :
    status === "draft" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-700";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function OperatorOffersPage() {
  const { token, user } = useAdminAuth();
  const allowed = canAccessPlatformAdminNav(user);
  const [rows, setRows] = useState<OfferRow[]>([]);
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
      const res = await apiOffers(token, { page, per_page: 20, status: statusFilter || undefined });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, allowed, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handlePublish(id: number) {
    if (!token || !window.confirm("Publish this offer?")) return;
    setBusyId(id);
    try { await apiPublishOffer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  async function handleArchive(id: number) {
    if (!token || !window.confirm("Archive this offer?")) return;
    setBusyId(id);
    try { await apiArchiveOffer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) return (
    <div><h1 className="text-xl font-semibold">Offers</h1><div className="mt-4"><ForbiddenNotice /></div></div>
  );

  return (
    <div>
      <h1 className="text-xl font-semibold">Offers</h1>
      <p className="mt-1 text-sm text-zinc-500">GET /api/offers · publish · archive</p>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-zinc-600">
          Status
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="ml-2 rounded border border-zinc-300 px-2 py-1 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </label>
        <button type="button" onClick={load} className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm">Refresh</button>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Title</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">No offers</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-2 tabular-nums text-zinc-500">{r.id}</td>
                <td className="px-3 py-2 font-medium max-w-[200px] truncate">{r.title}</td>
                <td className="px-3 py-2 text-xs">{r.type}</td>
                <td className="px-3 py-2 tabular-nums">{r.price != null ? `${r.currency ?? ""} ${Number(r.price).toFixed(2)}` : "—"}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2 text-xs">{r.company?.name ?? r.company_id ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {r.status === "draft" && (
                      <button type="button" disabled={busyId === r.id} onClick={() => void handlePublish(r.id)}
                        className="text-left text-xs text-green-700 underline disabled:opacity-40">Publish</button>
                    )}
                    {r.status === "published" && (
                      <button type="button" disabled={busyId === r.id} onClick={() => void handleArchive(r.id)}
                        className="text-left text-xs text-amber-700 underline disabled:opacity-40">Archive</button>
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
