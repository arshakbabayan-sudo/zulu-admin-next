"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiHotels, apiCreateHotel, apiUpdateHotel, apiDeleteHotel, type HotelRow, type HotelPayload } from "@/lib/inventory-crud-api";
import { useCallback, useEffect, useState } from "react";

const EMPTY: HotelPayload = { name: "", city: "", country: "", stars: undefined };

export default function OperatorHotelsPage() {
  const { token } = useAdminAuth();
  const [rows, setRows] = useState<HotelRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<HotelPayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try { const res = await apiHotels(token, { page, per_page: 20 }); setRows(res.data); setMeta(res.meta); }
    catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditId(null); setForm({ ...EMPTY }); setFormErr(null); }
  function openEdit(r: HotelRow) { setEditId(r.id); setForm({ name: r.name ?? "", city: r.city ?? "", country: r.country ?? "", stars: r.stars ?? undefined }); setFormErr(null); }
  function closeForm() { setForm(null); setEditId(null); setFormErr(null); }

  async function handleSubmit() {
    if (!token || !form) return;
    setBusy(true); setFormErr(null);
    try {
      if (editId != null) await apiUpdateHotel(token, editId, form);
      else await apiCreateHotel(token, form);
      closeForm(); await load();
    } catch (e) { setFormErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: number) {
    if (!token || !window.confirm("Delete this hotel?")) return;
    setBusy(true);
    try { await apiDeleteHotel(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (forbidden) return <div><h1 className="text-xl font-semibold">Hotels</h1><div className="mt-4"><ForbiddenNotice /></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Hotels</h1><p className="mt-1 text-sm text-zinc-500">GET /api/hotels · POST · PATCH · DELETE</p></div>
        <button type="button" onClick={openCreate} className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700">+ New hotel</button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {form && (
        <div className="mt-4 rounded border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? "Edit hotel" : "New hotel"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["name", "city", "country"] as const).map((f) => (
              <label key={f} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-600">{f}</span>
                <input value={(form[f] as string) ?? ""} onChange={(e) => setForm((p) => p ? { ...p, [f]: e.target.value } : p)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-600">stars</span>
              <input type="number" min={1} max={5} value={form.stars ?? ""} onChange={(e) => setForm((p) => p ? { ...p, stars: e.target.value ? Number(e.target.value) : undefined } : p)}
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
          {formErr && <p className="mt-2 text-sm text-red-600">{formErr}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void handleSubmit()} className="rounded bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={closeForm} className="rounded border border-zinc-300 px-4 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">City</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Stars</th><th className="px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-400">No hotels</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-2 tabular-nums text-zinc-500">{r.id}</td>
                <td className="px-3 py-2 font-medium">{r.name ?? "—"}</td>
                <td className="px-3 py-2">{r.city ?? "—"}</td>
                <td className="px-3 py-2">{r.country ?? "—"}</td>
                <td className="px-3 py-2">{r.stars != null ? "★".repeat(r.stars) : "—"}</td>
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
