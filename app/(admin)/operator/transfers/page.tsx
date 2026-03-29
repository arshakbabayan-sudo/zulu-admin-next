"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import { apiTransfers, apiCreateTransfer, apiUpdateTransfer, apiDeleteTransfer, type TransferRow, type TransferPayload } from "@/lib/inventory-crud-api";
import { useCallback, useEffect, useState } from "react";

export default function OperatorTransfersPage() {
  const { token } = useAdminAuth();
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<TransferPayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try { const res = await apiTransfers(token, { page, per_page: 20 }); setRows(res.data); setMeta(res.meta); }
    catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditId(null); setForm({ vehicle_type: "", from_location: "", to_location: "", price: undefined, currency: "USD" }); setFormErr(null); }
  function openEdit(r: TransferRow) { setEditId(r.id); setForm({ vehicle_type: r.vehicle_type ?? "", from_location: r.from_location ?? "", to_location: r.to_location ?? "", price: r.price ?? undefined, currency: r.currency ?? "USD" }); setFormErr(null); }
  function closeForm() { setForm(null); setEditId(null); setFormErr(null); }

  async function handleSubmit() {
    if (!token || !form) return;
    setBusy(true); setFormErr(null);
    try {
      if (editId != null) await apiUpdateTransfer(token, editId, form);
      else await apiCreateTransfer(token, form);
      closeForm(); await load();
    } catch (e) { setFormErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: number) {
    if (!token || !window.confirm("Delete this transfer?")) return;
    setBusy(true);
    try { await apiDeleteTransfer(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (forbidden) return <div><h1 className="text-xl font-semibold">Transfers</h1><div className="mt-4"><ForbiddenNotice /></div></div>;

  const strFields: (keyof TransferPayload)[] = ["vehicle_type", "from_location", "to_location", "currency"];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Transfers</h1><p className="mt-1 text-sm text-zinc-500">GET /api/transfers · POST · PATCH · DELETE</p></div>
        <button type="button" onClick={openCreate} className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700">+ New transfer</button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {form && (
        <div className="mt-4 rounded border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? "Edit transfer" : "New transfer"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {strFields.map((f) => (
              <label key={String(f)} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-600">{String(f).replace(/_/g, " ")}</span>
                <input value={(form[f] as string) ?? ""} onChange={(e) => setForm((p) => p ? { ...p, [f]: e.target.value } : p)}
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-600">price</span>
              <input type="number" value={form.price ?? ""} onChange={(e) => setForm((p) => p ? { ...p, price: e.target.value ? Number(e.target.value) : undefined } : p)}
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
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2">Route</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-zinc-400">No transfers</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                <td className="px-3 py-2 tabular-nums text-zinc-500">{r.id}</td>
                <td className="px-3 py-2">{r.vehicle_type ?? "—"}</td>
                <td className="px-3 py-2">{r.from_location ?? "—"} → {r.to_location ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.price != null ? `${r.currency ?? ""} ${Number(r.price).toFixed(2)}` : "—"}</td>
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
