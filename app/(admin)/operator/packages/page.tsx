"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiPackages, apiCreatePackage, apiUpdatePackage, apiDeletePackage,
  apiActivatePackage, apiDeactivatePackage,
  type PackageRow, type PackagePayload,
} from "@/lib/inventory-crud-api";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const PACKAGE_TYPES = ["flight", "hotel", "transfer", "multi_service", "custom"];
const STATUSES = ["", "draft", "active", "inactive", "archived"];

function StatusBadge({ status }: { status: string }) {
  const cls = status === "active" ? "bg-green-100 text-green-800" :
    status === "inactive" ? "bg-red-100 text-red-800" :
    status === "draft" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function OperatorPackagesPage() {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<PackagePayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiPackages(token, { page, per_page: 20, status: statusFilter || undefined });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditId(null); setForm({ package_title: "", package_type: "flight", destination_city: "", destination_country: "", duration_days: undefined, currency: "USD" }); setFormErr(null); }
  function openEdit(r: PackageRow) {
    setEditId(r.id);
    setForm({ package_title: r.package_title ?? "", package_type: r.package_type ?? "flight", destination_city: r.destination_city ?? "", destination_country: r.destination_country ?? "", duration_days: r.duration_days ?? undefined, currency: r.currency ?? "USD" });
    setFormErr(null);
  }
  function closeForm() { setForm(null); setEditId(null); setFormErr(null); }

  async function handleSubmit() {
    if (!token || !form) return;
    setBusy(true); setFormErr(null);
    try {
      if (editId != null) await apiUpdatePackage(token, editId, form);
      else await apiCreatePackage(token, form);
      closeForm(); await load();
    } catch (e) { setFormErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: number) {
    if (!token || !window.confirm(t("admin.crud.packages.delete_confirm"))) return;
    setBusyId(id);
    try { await apiDeletePackage(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  async function handleToggle(r: PackageRow) {
    if (!token) return;
    const confirmMsg = r.status === "active"
      ? t("admin.crud.packages.deactivate_confirm")
      : t("admin.crud.packages.activate_confirm");
    if (!window.confirm(confirmMsg)) return;
    setBusyId(r.id);
    try {
      if (r.status === "active") await apiDeactivatePackage(token, r.id);
      else await apiActivatePackage(token, r.id);
      await load();
    } catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusyId(null); }
  }

  if (forbidden) return <div><h1 className="text-xl font-semibold">{t("admin.crud.packages.title")}</h1><div className="mt-4"><ForbiddenNotice /></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">{t("admin.crud.packages.title")}</h1></div>
        <button type="button" onClick={openCreate} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700">{t("admin.crud.packages.new_btn")}</button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-slate-600">
          {t("admin.crud.packages.filter.status")}
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s || t("admin.crud.common.all")}</option>)}
          </select>
        </label>
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

      {form && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? t("admin.crud.packages.form_edit") : t("admin.crud.packages.form_new")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">{t("admin.crud.packages.field.title")}</span>
              <input value={form.package_title ?? ""} onChange={(e) => setForm((p) => p ? { ...p, package_title: e.target.value } : p)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">{t("admin.crud.packages.field.type")}</span>
              <select value={form.package_type ?? ""} onChange={(e) => setForm((p) => p ? { ...p, package_type: e.target.value } : p)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm">
                {PACKAGE_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">{t("admin.crud.packages.field.destination_city")}</span>
              <input value={(form["destination_city"] as string) ?? ""} onChange={(e) => setForm((p) => p ? { ...p, destination_city: e.target.value } : p)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">{t("admin.crud.packages.field.destination_country")}</span>
              <input value={(form["destination_country"] as string) ?? ""} onChange={(e) => setForm((p) => p ? { ...p, destination_country: e.target.value } : p)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">{t("admin.crud.packages.field.currency")}</span>
              <input value={(form["currency"] as string) ?? ""} onChange={(e) => setForm((p) => p ? { ...p, currency: e.target.value } : p)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">{t("admin.crud.packages.field.duration")}</span>
              <input type="number" value={form.duration_days ?? ""} onChange={(e) => setForm((p) => p ? { ...p, duration_days: e.target.value ? Number(e.target.value) : undefined } : p)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
          {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void handleSubmit()} className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40">{busy ? t("admin.crud.common.saving") : t("common.save")}</button>
            <button type="button" onClick={closeForm} className="rounded border border-slate-300 px-4 py-1.5 text-sm">{t("common.cancel")}</button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-700">
            <tr><th className="px-3 py-2">{t("admin.crud.common.id")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.title")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.type")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.destination")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.days")}</th><th className="px-3 py-2">{t("admin.crud.common.status")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.company")}</th><th className="px-3 py-2">{t("admin.crud.common.actions")}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-400">{t("admin.crud.packages.empty")}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-100">
                <td className="px-3 py-2 tabular-nums text-slate-700">{r.id}</td>
                <td className="px-3 py-2 font-medium max-w-[180px] truncate">{r.package_title ?? "-"}</td>
                <td className="px-3 py-2 text-xs">{r.package_type ?? "-"}</td>
                <td className="px-3 py-2 text-xs">{[r.destination_city, r.destination_country].filter(Boolean).join(", ") || "-"}</td>
                <td className="px-3 py-2 tabular-nums">{r.duration_days ?? "-"}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2 text-xs">{r.company?.name ?? r.company_id ?? "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => openEdit(r)} className="text-left text-xs text-blue-700 underline">{t("admin.crud.common.edit")}</button>
                    <button type="button" disabled={busyId === r.id} onClick={() => void handleToggle(r)}
                      className={`text-left text-xs underline disabled:opacity-40 ${r.status === "active" ? "text-amber-600" : "text-green-700"}`}>
                      {r.status === "active" ? t("admin.crud.common.deactivate") : t("admin.crud.common.activate")}
                    </button>
                    <button type="button" disabled={busyId === r.id} onClick={() => void handleDelete(r.id)} className="text-left text-xs text-red-600 underline disabled:opacity-40">{t("admin.crud.common.delete")}</button>
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
