"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiVisas, apiCreateVisa, apiUpdateVisa, apiDeleteVisa, type VisaRow, type VisaPayload } from "@/lib/inventory-crud-api";
import { useCallback, useEffect, useState } from "react";

export default function OperatorVisasPage() {
  const { token } = useAdminAuth();
  const [rows, setRows] = useState<VisaRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<VisaPayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try { const res = await apiVisas(token, { page, per_page: 20 }); setRows(res.data); setMeta(res.meta); }
    catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditId(null); setForm({ offer_id: undefined, country: "", visa_type: "", processing_days: undefined }); setFormErr(null); }
  function openEdit(r: VisaRow) { setEditId(r.id); setForm({ country: r.country ?? "", visa_type: r.visa_type ?? "", processing_days: r.processing_days ?? undefined }); setFormErr(null); }
  function closeForm() { setForm(null); setEditId(null); setFormErr(null); }

  async function handleSubmit() {
    if (!token || !form) return;
    setBusy(true); setFormErr(null);
    try {
      if (editId != null) await apiUpdateVisa(token, editId, form);
      else await apiCreateVisa(token, form);
      closeForm(); await load();
    } catch (e) { setFormErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: number) {
    if (!token || !window.confirm("Delete this visa?")) return;
    setBusy(true);
    try { await apiDeleteVisa(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (forbidden) return <div><h1 className="text-xl font-semibold">Visas</h1><div className="mt-4"><ForbiddenNotice /></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Visas</h1></div>
        <button type="button" onClick={openCreate} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700">+ New visa</button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {form && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? "Edit visa" : "New visa"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {editId == null && (
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium text-slate-600">Offer ID <span className="text-red-500">*</span></span>
                <input type="number" placeholder="ID of a visa-type offer"
                  value={(form.offer_id as number | undefined) ?? ""}
                  onChange={(e) => setForm((p) => p ? { ...p, offer_id: e.target.value ? Number(e.target.value) : undefined } : p)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
            )}
            {(["country", "visa_type"] as const).map((f) => (
              <label key={f} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">{f.replace(/_/g, " ")}</span>
                <input value={(form[f] as string) ?? ""} onChange={(e) => setForm((p) => p ? { ...p, [f]: e.target.value } : p)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">processing days</span>
              <input type="number" value={(form.processing_days as number | undefined) ?? ""}
                onChange={(e) => setForm((p) => p ? { ...p, processing_days: e.target.value ? Number(e.target.value) : undefined } : p)}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
          {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void handleSubmit()} className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40">{busy ? "Saving..." : "Save"}</button>
            <button type="button" onClick={closeForm} className="rounded border border-slate-300 px-4 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-700">
            <tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Processing</th><th className="px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No visas</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-100">
                <td className="px-3 py-2 tabular-nums text-slate-700">{r.id}</td>
                <td className="px-3 py-2 font-medium">{r.country ?? "-"}</td>
                <td className="px-3 py-2">{r.visa_type ?? "-"}</td>
                <td className="px-3 py-2 tabular-nums">{r.price != null ? `${r.currency ?? ""} ${Number(r.price).toFixed(2)}` : "-"}</td>
                <td className="px-3 py-2">{r.processing_days != null ? `${r.processing_days} days` : "-"}</td>
                <td className="px-3 py-2"><div className="flex gap-2">
                  <button type="button" onClick={() => openEdit(r)} className="text-xs text-blue-700 underline">Edit</button>
                  <button type="button" onClick={() => void handleDelete(r.id)} className="text-xs text-red-600 underline">Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
