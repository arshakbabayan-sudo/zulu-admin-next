"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { canAccessPlatformAdminNav } from "@/lib/access";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiOffers, apiPublishOffer, apiArchiveOffer, type OfferRow } from "@/lib/inventory-crud-api";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const STATUSES = ["", "draft", "published", "archived"];

function StatusBadge({ status }: { status: string }) {
  const cls = status === "published" ? "bg-green-100 text-green-800" :
    status === "archived" ? "bg-slate-200 text-slate-600" :
    status === "draft" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function OperatorOffersPage() {
  const { token, user } = useAdminAuth();
  const { t } = useLanguage();
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
    if (!token || !window.confirm(t("admin.crud.offers.publish_confirm"))) return;
    setBusyId(id);
    try { await apiPublishOffer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  async function handleArchive(id: number) {
    if (!token || !window.confirm(t("admin.crud.offers.archive_confirm"))) return;
    setBusyId(id);
    try { await apiArchiveOffer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  if (!allowed || forbidden) return (
    <div><h1 className="text-xl font-semibold">{t("admin.crud.offers.title")}</h1><div className="mt-4"><ForbiddenNotice /></div></div>
  );

  return (
    <div>
      <h1 className="text-xl font-semibold">{t("admin.crud.offers.title")}</h1>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-slate-600">
          {t("admin.crud.offers.filter.status")}
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s || t("admin.crud.common.all")}</option>)}
          </select>
        </label>
        <button type="button" onClick={load} className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">{t("admin.crud.common.refresh")}</button>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-700">
            <tr><th className="px-3 py-2">{t("admin.crud.common.id")}</th><th className="px-3 py-2">{t("admin.crud.offers.col.title")}</th><th className="px-3 py-2">{t("admin.crud.offers.col.type")}</th><th className="px-3 py-2">{t("admin.crud.offers.col.price")}</th><th className="px-3 py-2">{t("admin.crud.common.status")}</th><th className="px-3 py-2">{t("admin.crud.offers.col.company")}</th><th className="px-3 py-2">{t("admin.crud.common.actions")}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">{t("admin.crud.offers.empty")}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-100">
                <td className="px-3 py-2 tabular-nums text-slate-700">{r.id}</td>
                <td className="px-3 py-2 font-medium max-w-[200px] truncate">{r.title}</td>
                <td className="px-3 py-2 text-xs">{r.type}</td>
                <td className="px-3 py-2 tabular-nums">{r.price != null ? `${r.currency ?? ""} ${Number(r.price).toFixed(2)}` : "-"}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2 text-xs">{r.company?.name ?? r.company_id ?? "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {r.status === "draft" && (
                      <button type="button" disabled={busyId === r.id} onClick={() => void handlePublish(r.id)}
                        className="text-left text-xs text-green-700 underline disabled:opacity-40">{t("admin.crud.common.publish")}</button>
                    )}
                    {r.status === "published" && (
                      <button type="button" disabled={busyId === r.id} onClick={() => void handleArchive(r.id)}
                        className="text-left text-xs text-amber-700 underline disabled:opacity-40">{t("admin.crud.common.archive")}</button>
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
