"use client";

import { CsvImportModal } from "@/components/CsvImportModal";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiOffers,
  apiTransfers,
  apiCreateTransfer,
  apiUpdateTransfer,
  apiDeleteTransfer,
  type OfferRow,
  type TransferRow,
  type TransferPayload,
} from "@/lib/inventory-crud-api";
import { newTransferForm, transferFormFromRow } from "@/lib/transfers/transfer-field-adapter";
import { TRANSFER_BUILDER_STEPS, type TransferBuilderStep, formatTransferApiValidationErrors, validateTransferStep } from "@/lib/transfers/transfer-ui";
import { useTransferBuilderForm } from "@/lib/transfers/use-transfer-builder";
import {
  csvExportFilename,
  downloadCsvFile,
  exportTransfersCsv,
  runTransferCsvImport,
  transferTemplateCsv,
} from "@/lib/csv-import-export";
import { useCallback, useEffect, useRef, useState } from "react";

type FieldErrors = Record<string, string[]>;

function renderApiFieldErrors(errors: FieldErrors | undefined): { title: string; items: { field: string; msg: string }[] } | null {
  if (!errors) return null;
  const items: { field: string; msg: string }[] = [];
  for (const [field, msgs] of Object.entries(errors)) {
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    for (const m of msgs) {
      const t = String(m ?? "").trim();
      if (t) items.push({ field, msg: t });
    }
  }
  if (items.length === 0) return null;
  return { title: "Please fix the highlighted fields.", items };
}

export default function OperatorTransfersPage() {
  const { token } = useAdminAuth();
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [seed, setSeed] = useState<TransferPayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors | null>(null);
  const [builderKey, setBuilderKey] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  // Offers are loaded lazily — only when "+ New transfer" is clicked.
  // This removes an extra API round-trip on every page mount.
  const offersCache = useRef<OfferRow[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiTransfers(token, { page, per_page: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { load(); }, [load]);

  const ensureOffersLoaded = useCallback(async (): Promise<OfferRow[]> => {
    if (offersCache.current !== null) return offersCache.current;
    if (!token) return [];
    try {
      const res = await apiOffers(token, { type: "transfer" });
      offersCache.current = res.data ?? [];
      return offersCache.current;
    } catch {
      offersCache.current = [];
      return [];
    }
  }, [token]);

  async function openCreate() {
    setBusy(true);
    const loadedOffers = await ensureOffersLoaded();
    setBusy(false);

    const usedOfferIds = new Set<number>();
    for (const r of rows) {
      if (r.offer_id != null) usedOfferIds.add(Number(r.offer_id));
    }
    const available = loadedOffers.find((o) => !usedOfferIds.has(o.id));

    if (!available) {
      setSeed(null);
      setEditId(null);
      setFormErr("No available transfer offers to create from.");
      setFieldErrs(null);
      return;
    }

    const offerId = available.id;
    const currency = (available.currency ?? "USD").toString();
    setEditId(null);
    setSeed(newTransferForm(offerId, currency));
    setBuilderKey((k) => k + 1);
    setFormErr(null);
    setFieldErrs(null);
  }

  function openEdit(r: TransferRow) {
    setEditId(r.id);
    setSeed(transferFormFromRow(r));
    setBuilderKey((k) => k + 1);
    setFormErr(null);
    setFieldErrs(null);
  }

  function closeForm() { setSeed(null); setEditId(null); setFormErr(null); setFieldErrs(null); }

  async function handleSubmit(payload: TransferPayload) {
    if (!token) return;
    setBusy(true); setFormErr(null); setFieldErrs(null);
    try {
      if (editId != null) await apiUpdateTransfer(token, editId, payload);
      else await apiCreateTransfer(token, payload);
      // Invalidate offers cache so next "New transfer" gets fresh data.
      offersCache.current = null;
      closeForm();
      await load();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setFormErr(e.message || "Request failed.");
        setFieldErrs(e.body?.errors ?? null);
      } else {
        setFormErr("Failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !window.confirm("Delete this transfer?")) return;
    setBusy(true);
    try {
      await apiDeleteTransfer(token, id);
      offersCache.current = null;
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return <div><h1 className="text-xl font-semibold">Transfers</h1><div className="mt-4"><ForbiddenNotice /></div></div>;

  const fieldSummary = renderApiFieldErrors(fieldErrs ?? undefined);
  const hasFieldErr = (key: string) => Boolean(fieldErrs && Array.isArray(fieldErrs[key]) && fieldErrs[key].length > 0);
  const fieldMsgs = (key: string) => (fieldErrs && Array.isArray(fieldErrs[key]) ? fieldErrs[key] : []);
  const inputClass = (key: string) =>
    `rounded border px-2 py-1.5 text-sm ${
      hasFieldErr(key) ? "border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200" : "border-slate-300"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Transfers</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ImportExportButtons
            busy={busy || exportBusy}
            exportDisabled={!token}
            onTemplate={() => downloadCsvFile("transfers-template.csv", transferTemplateCsv())}
            onExport={async () => {
              if (!token) return;
              setExportBusy(true);
              try {
                const csv = await exportTransfersCsv(token);
                downloadCsvFile(csvExportFilename("transfers"), csv);
              } catch (e) {
                alert(e instanceof ApiRequestError ? e.message : "Export failed");
              } finally {
                setExportBusy(false);
              }
            }}
            onImport={() => setImportOpen(true)}
          />
          <button
            type="button"
            onClick={() => void openCreate()}
            disabled={busy}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {busy ? "Loading…" : "+ New transfer"}
          </button>
        </div>
      </div>
      <CsvImportModal
        open={importOpen}
        title="Import transfers (CSV)"
        onClose={() => setImportOpen(false)}
        onRun={async (rows, rowLineNumbers) => {
          if (!token) {
            return {
              success: 0,
              failed: rows.length,
              errors: [{ rowNumber: rowLineNumbers[0] ?? 2, message: "Not signed in." }],
            };
          }
          const res = await runTransferCsvImport(token, rows, rowLineNumbers);
          if (res.success > 0) await load();
          return res;
        }}
      />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {seed && (
        <div className="mt-4 rounded border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? "Edit transfer" : "New transfer"}</h2>
          {fieldSummary && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <div className="font-medium">{fieldSummary.title}</div>
              <ul className="mt-1 list-disc pl-5">
                {fieldSummary.items.slice(0, 8).map((it, idx) => (
                  <li key={`${it.field}-${idx}`}>
                    <span className="font-medium">{it.field}</span>: {it.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <TransferBuilder
            key={builderKey}
            seed={seed}
            editId={editId}
            busy={busy}
            formErr={formErr}
            apiFieldErrs={fieldErrs}
            onClose={closeForm}
            onSubmit={(payload) => void handleSubmit(payload)}
            inputClass={inputClass}
            fieldMsgs={fieldMsgs}
            hasFieldErr={hasFieldErr}
          />
        </div>
      )}
      <div className="mt-4 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase text-slate-700">
            <tr><th className="px-3 py-2">ID</th><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2">Route</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No transfers</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-100">
                <td className="px-3 py-2 tabular-nums text-slate-700">{r.id}</td>
                <td className="px-3 py-2">{r.vehicle_category ?? "-"}</td>
                <td className="px-3 py-2">{r.pickup_city ?? "-"} {" -> "} {r.dropoff_city ?? "-"}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.base_price != null
                    ? `${r.offer?.currency ?? ""} ${Number(r.base_price).toFixed(2)}`
                    : "-"}
                </td>
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

function stepTitle(step: TransferBuilderStep): string {
  switch (step) {
    case "route_location": return "1) Route and location";
    case "vehicle_capacity": return "2) Vehicle and capacity";
    case "pricing_policies": return "3) Pricing and policies";
    case "availability_publication": return "4) Availability and publication controls";
    case "review_submit": return "5) Review and submit";
    default: return step;
  }
}

function TransferBuilder(props: {
  seed: TransferPayload;
  editId: number | null;
  busy: boolean;
  formErr: string | null;
  apiFieldErrs: FieldErrors | null;
  onClose: () => void;
  onSubmit: (payload: TransferPayload) => void;
  inputClass: (key: string) => string;
  fieldMsgs: (key: string) => string[];
  hasFieldErr: (key: string) => boolean;
}) {
  const mode = props.editId != null ? "edit" : "create";
  const b = useTransferBuilderForm(props.seed, mode);

  const stepErrs = b.stepErrors;
  const apiErrLines = props.apiFieldErrs ? formatTransferApiValidationErrors(props.apiFieldErrs) : [];

  function set<K extends keyof TransferPayload>(key: K, value: TransferPayload[K]) {
    b.setForm((p) => ({ ...p, [key]: value }));
  }

  const stepBtnClass = (active: boolean, ok: boolean) =>
    `rounded px-2 py-1 text-xs ${
      active ? "bg-slate-800 text-white" : ok ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
    }`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {TRANSFER_BUILDER_STEPS.map((s) => {
          const ok = validateTransferStep(b.form, s, mode).length === 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => b.goTo(s)}
              className={stepBtnClass(b.step === s, ok)}
            >
              {stepTitle(s)}
            </button>
          );
        })}
      </div>

      {stepErrs.length > 0 && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="font-medium">Fix these to continue.</div>
          <ul className="mt-1 list-disc pl-5">
            {stepErrs.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {apiErrLines.length > 0 && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <div className="font-medium">API validation errors</div>
          <ul className="mt-1 list-disc pl-5">
            {apiErrLines.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Shared readonly context */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600">Offer ID</span>
          <input
            value={b.form.offer_id == null ? "" : String(b.form.offer_id)}
            disabled={true}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-600"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-600">Currency (offer)</span>
          <input
            value={b.form.currency ?? ""}
            disabled={true}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-600"
          />
        </label>
      </div>

      {b.step === "route_location" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium text-slate-600">Transfer title</span>
            <input
              value={b.form.transfer_title ?? ""}
              onChange={(e) => set("transfer_title", e.target.value)}
              className={props.inputClass("transfer_title")}
            />
            {props.fieldMsgs("transfer_title").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">Transfer type</span>
            <select
              value={b.form.transfer_type ?? "city_transfer"}
              onChange={(e) => set("transfer_type", e.target.value)}
              className={props.inputClass("transfer_type")}
            >
              {[
                "airport_transfer",
                "hotel_transfer",
                "city_transfer",
                "private_transfer",
                "shared_transfer",
                "intercity_transfer",
              ].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {props.fieldMsgs("transfer_type").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">Service date</span>
            <input
              type="date"
              value={b.form.service_date ?? ""}
              onChange={(e) => set("service_date", e.target.value)}
              className={props.inputClass("service_date")}
            />
            {props.fieldMsgs("service_date").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">Pickup time</span>
            <input
              type="time"
              value={(b.form.pickup_time ?? "09:00:00").slice(0, 5)}
              onChange={(e) => set("pickup_time", e.target.value)}
              className={props.inputClass("pickup_time")}
            />
            {props.fieldMsgs("pickup_time").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-600">Estimated duration (minutes)</span>
            <input
              type="number"
              value={b.form.estimated_duration_minutes === "" ? "" : String(b.form.estimated_duration_minutes)}
              onChange={(e) => set("estimated_duration_minutes", e.target.value ? Number(e.target.value) : "")}
              className={props.inputClass("estimated_duration_minutes")}
            />
            {props.fieldMsgs("estimated_duration_minutes").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
          </label>

          <div className="sm:col-span-2 mt-2 flex flex-col gap-2 border-t border-slate-200 pt-4">
            <span className="text-xs font-semibold uppercase text-slate-500">Pickup</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Pickup country</span>
                <input value={b.form.pickup_country ?? ""} onChange={(e) => set("pickup_country", e.target.value)} className={props.inputClass("pickup_country")} />
                {props.fieldMsgs("pickup_country").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Pickup city</span>
                <input value={b.form.pickup_city ?? ""} onChange={(e) => set("pickup_city", e.target.value)} className={props.inputClass("pickup_city")} />
                {props.fieldMsgs("pickup_city").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Pickup point type</span>
                <select value={b.form.pickup_point_type ?? "address"} onChange={(e) => set("pickup_point_type", e.target.value)} className={props.inputClass("pickup_point_type")}>
                  {["airport", "hotel", "address", "station", "port", "landmark"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {props.fieldMsgs("pickup_point_type").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Pickup point name</span>
                <input value={b.form.pickup_point_name ?? ""} onChange={(e) => set("pickup_point_name", e.target.value)} className={props.inputClass("pickup_point_name")} />
                {props.fieldMsgs("pickup_point_name").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
            </div>
          </div>

          <div className="sm:col-span-2 mt-2 flex flex-col gap-2 border-t border-slate-200 pt-4">
            <span className="text-xs font-semibold uppercase text-slate-500">Drop-off</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Drop-off country</span>
                <input value={b.form.dropoff_country ?? ""} onChange={(e) => set("dropoff_country", e.target.value)} className={props.inputClass("dropoff_country")} />
                {props.fieldMsgs("dropoff_country").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Drop-off city</span>
                <input value={b.form.dropoff_city ?? ""} onChange={(e) => set("dropoff_city", e.target.value)} className={props.inputClass("dropoff_city")} />
                {props.fieldMsgs("dropoff_city").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Drop-off point type</span>
                <select value={b.form.dropoff_point_type ?? "address"} onChange={(e) => set("dropoff_point_type", e.target.value)} className={props.inputClass("dropoff_point_type")}>
                  {["airport", "hotel", "address", "station", "port", "landmark"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {props.fieldMsgs("dropoff_point_type").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Drop-off point name</span>
                <input value={b.form.dropoff_point_name ?? ""} onChange={(e) => set("dropoff_point_name", e.target.value)} className={props.inputClass("dropoff_point_name")} />
                {props.fieldMsgs("dropoff_point_name").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
            </div>
          </div>

          <div className="sm:col-span-2 mt-2 flex flex-col gap-2 border-t border-slate-200 pt-4">
            <span className="text-xs font-semibold uppercase text-slate-500">Route metadata (optional)</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Route label</span>
                <input value={b.form.route_label ?? ""} onChange={(e) => set("route_label", e.target.value)} className={props.inputClass("route_label")} />
                {props.fieldMsgs("route_label").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Route distance (km)</span>
                <input type="number" value={b.form.route_distance_km === "" ? "" : String(b.form.route_distance_km)} onChange={(e) => set("route_distance_km", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("route_distance_km")} />
                {props.fieldMsgs("route_distance_km").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Pickup lat</span>
                <input type="number" value={b.form.pickup_latitude === "" ? "" : String(b.form.pickup_latitude)} onChange={(e) => set("pickup_latitude", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("pickup_latitude")} />
                {props.fieldMsgs("pickup_latitude").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Pickup lng</span>
                <input type="number" value={b.form.pickup_longitude === "" ? "" : String(b.form.pickup_longitude)} onChange={(e) => set("pickup_longitude", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("pickup_longitude")} />
                {props.fieldMsgs("pickup_longitude").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Drop-off lat</span>
                <input type="number" value={b.form.dropoff_latitude === "" ? "" : String(b.form.dropoff_latitude)} onChange={(e) => set("dropoff_latitude", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("dropoff_latitude")} />
                {props.fieldMsgs("dropoff_latitude").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Drop-off lng</span>
                <input type="number" value={b.form.dropoff_longitude === "" ? "" : String(b.form.dropoff_longitude)} onChange={(e) => set("dropoff_longitude", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("dropoff_longitude")} />
                {props.fieldMsgs("dropoff_longitude").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
            </div>
          </div>

          <div className="sm:col-span-2 mt-2 flex flex-col gap-2 border-t border-slate-200 pt-4">
            <span className="text-xs font-semibold uppercase text-slate-500">Availability window (optional)</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Window start</span>
                <input type="datetime-local" value={b.form.availability_window_start ?? ""} onChange={(e) => set("availability_window_start", e.target.value)} className={props.inputClass("availability_window_start")} />
                {props.fieldMsgs("availability_window_start").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Window end</span>
                <input type="datetime-local" value={b.form.availability_window_end ?? ""} onChange={(e) => set("availability_window_end", e.target.value)} className={props.inputClass("availability_window_end")} />
                {props.fieldMsgs("availability_window_end").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
            </div>
          </div>
        </div>
      )}

      {b.step === "vehicle_capacity" && (
        <div className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Vehicle category</span>
              <select value={b.form.vehicle_category ?? "sedan"} onChange={(e) => set("vehicle_category", e.target.value)} className={props.inputClass("vehicle_category")}>
                {["sedan", "suv", "minivan", "minibus", "bus", "luxury_car"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              {props.fieldMsgs("vehicle_category").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Vehicle class (optional)</span>
              <input value={b.form.vehicle_class ?? ""} onChange={(e) => set("vehicle_class", e.target.value)} className={props.inputClass("vehicle_class")} placeholder="e.g. comfort / business" />
              {props.fieldMsgs("vehicle_class").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Private/shared (optional)</span>
              <select value={b.form.private_or_shared ?? ""} onChange={(e) => set("private_or_shared", e.target.value)} className={props.inputClass("private_or_shared")}>
                <option value="">(default)</option>
                {["private", "shared"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {props.fieldMsgs("private_or_shared").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Passenger capacity</span>
              <input type="number" value={b.form.passenger_capacity === "" ? "" : String(b.form.passenger_capacity)} onChange={(e) => set("passenger_capacity", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("passenger_capacity")} />
              {props.fieldMsgs("passenger_capacity").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Luggage capacity</span>
              <input type="number" value={b.form.luggage_capacity === "" ? "" : String(b.form.luggage_capacity)} onChange={(e) => set("luggage_capacity", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("luggage_capacity")} />
              {props.fieldMsgs("luggage_capacity").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Minimum passengers</span>
              <input type="number" value={b.form.minimum_passengers === "" ? "" : String(b.form.minimum_passengers)} onChange={(e) => set("minimum_passengers", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("minimum_passengers")} />
              {props.fieldMsgs("minimum_passengers").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Maximum passengers</span>
              <input type="number" value={b.form.maximum_passengers === "" ? "" : String(b.form.maximum_passengers)} onChange={(e) => set("maximum_passengers", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("maximum_passengers")} />
              {props.fieldMsgs("maximum_passengers").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <div className="sm:col-span-2 mt-2 flex flex-col gap-2 border-t border-slate-200 pt-4">
              <span className="text-xs font-semibold uppercase text-slate-500">Additional services</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(b.form.child_seat_available)} onChange={(e) => set("child_seat_available", e.target.checked)} className={`rounded border ${props.hasFieldErr("child_seat_available") ? "border-red-400" : "border-slate-300"}`} />
                    <span className="font-medium text-slate-600">Child seat available</span>
                  </label>
                  {props.fieldMsgs("child_seat_available").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
                </div>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-600">Child seat rule (optional)</span>
                  <input value={b.form.child_seat_required_rule ?? ""} onChange={(e) => set("child_seat_required_rule", e.target.value)} className={props.inputClass("child_seat_required_rule")} placeholder="e.g. required / on request" />
                  {props.fieldMsgs("child_seat_required_rule").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-600">Maximum luggage (optional)</span>
                  <input type="number" value={b.form.maximum_luggage === "" ? "" : String(b.form.maximum_luggage)} onChange={(e) => set("maximum_luggage", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("maximum_luggage")} />
                  {props.fieldMsgs("maximum_luggage").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
                </label>

                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(b.form.accessibility_support)} onChange={(e) => set("accessibility_support", e.target.checked)} className={`rounded border ${props.hasFieldErr("accessibility_support") ? "border-red-400" : "border-slate-300"}`} />
                    <span className="font-medium text-slate-600">Accessibility support</span>
                  </label>
                  {props.fieldMsgs("accessibility_support").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}

                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(b.form.special_assistance_supported)} onChange={(e) => set("special_assistance_supported", e.target.checked)} className={`rounded border ${props.hasFieldErr("special_assistance_supported") ? "border-red-400" : "border-slate-300"}`} />
                    <span className="font-medium text-slate-600">Special assistance supported</span>
                  </label>
                  {props.fieldMsgs("special_assistance_supported").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {b.step === "pricing_policies" && (
        <div className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Pricing mode</span>
              <select value={b.form.pricing_mode ?? "per_vehicle"} onChange={(e) => set("pricing_mode", e.target.value)} className={props.inputClass("pricing_mode")}>
                {["per_vehicle", "per_person"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {props.fieldMsgs("pricing_mode").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Base price</span>
              <input type="number" value={b.form.base_price === "" ? "" : String(b.form.base_price)} onChange={(e) => set("base_price", e.target.value ? Number(e.target.value) : "")} className={props.inputClass("base_price")} />
              {props.fieldMsgs("base_price").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4">
            <span className="text-xs font-semibold uppercase text-slate-500">Cancellation</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(b.form.free_cancellation)} onChange={(e) => set("free_cancellation", e.target.checked)} className={`rounded border ${props.hasFieldErr("free_cancellation") ? "border-red-400" : "border-slate-300"}`} />
                  <span className="font-medium text-slate-600">Free cancellation</span>
                </label>
                {props.fieldMsgs("free_cancellation").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Cancellation policy type</span>
                <select value={b.form.cancellation_policy_type ?? "non_refundable"} onChange={(e) => set("cancellation_policy_type", e.target.value)} className={props.inputClass("cancellation_policy_type")}>
                  {["non_refundable", "partially_refundable", "fully_refundable"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {props.fieldMsgs("cancellation_policy_type").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-600">Cancellation deadline (optional)</span>
                <input type="datetime-local" value={b.form.cancellation_deadline_at ?? ""} onChange={(e) => set("cancellation_deadline_at", e.target.value)} className={props.inputClass("cancellation_deadline_at")} />
                {props.fieldMsgs("cancellation_deadline_at").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
              </label>
            </div>
          </div>
        </div>
      )}

      {b.step === "availability_publication" && (
        <div className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Availability status</span>
              <select value={b.form.availability_status ?? "available"} onChange={(e) => set("availability_status", e.target.value)} className={props.inputClass("availability_status")}>
                {["available", "unavailable"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {props.fieldMsgs("availability_status").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Status</span>
              <select value={b.form.status ?? "draft"} onChange={(e) => set("status", e.target.value)} className={props.inputClass("status")}>
                {["draft", "active", "inactive", "archived"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {props.fieldMsgs("status").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-600">Visibility rule</span>
              <select value={b.form.visibility_rule ?? "show_all"} onChange={(e) => set("visibility_rule", e.target.value)} className={props.inputClass("visibility_rule")}>
                {["show_all", "show_accepted_only", "hide_rejected"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {props.fieldMsgs("visibility_rule").map((m, i) => <span key={i} className="text-xs text-red-700">{m}</span>)}
            </label>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(b.form.bookable)} onChange={(e) => set("bookable", e.target.checked)} className={`rounded border ${props.hasFieldErr("bookable") ? "border-red-400" : "border-slate-300"}`} />
                <span className="font-medium text-slate-600">Bookable online</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(b.form.is_package_eligible)} onChange={(e) => set("is_package_eligible", e.target.checked)} className={`rounded border ${props.hasFieldErr("is_package_eligible") ? "border-red-400" : "border-slate-300"}`} />
                <span className="font-medium text-slate-600">Package eligible</span>
              </label>

              <div className="mt-2 grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(b.form.appears_in_web)} onChange={(e) => set("appears_in_web", e.target.checked)} className={`rounded border ${props.hasFieldErr("appears_in_web") ? "border-red-400" : "border-slate-300"}`} />
                  <span className="font-medium text-slate-600">Web</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(b.form.appears_in_admin)} onChange={(e) => set("appears_in_admin", e.target.checked)} className={`rounded border ${props.hasFieldErr("appears_in_admin") ? "border-red-400" : "border-slate-300"}`} />
                  <span className="font-medium text-slate-600">Admin</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(b.form.appears_in_zulu_admin)} onChange={(e) => set("appears_in_zulu_admin", e.target.checked)} className={`rounded border ${props.hasFieldErr("appears_in_zulu_admin") ? "border-red-400" : "border-slate-300"}`} />
                  <span className="font-medium text-slate-600">Zulu admin</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {b.step === "review_submit" && (
        <div className="mt-3">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            <div className="font-medium">Review</div>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              <div><span className="font-medium">Route:</span> {b.form.pickup_city || "—"} → {b.form.dropoff_city || "—"}</div>
              <div><span className="font-medium">Vehicle:</span> {b.form.vehicle_category || "—"} · {b.form.passenger_capacity || "—"} pax</div>
              <div><span className="font-medium">Date/time:</span> {b.form.service_date || "—"} {String(b.form.pickup_time || "").slice(0, 5)}</div>
              <div><span className="font-medium">Price:</span> {b.form.currency || ""} {b.form.base_price === "" ? "—" : String(b.form.base_price)}</div>
              <div><span className="font-medium">Availability:</span> {b.form.availability_status || "—"}</div>
              <div><span className="font-medium">Status:</span> {b.form.status || "—"}</div>
            </div>
          </div>

          {props.formErr && <p className="mt-2 text-sm text-red-600">{props.formErr}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={props.busy || b.allErrors.length > 0}
              onClick={() => props.onSubmit(b.form)}
              className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {props.busy ? "Saving..." : "Submit"}
            </button>
            <button type="button" onClick={props.onClose} className="rounded border border-slate-300 px-4 py-1.5 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2 border-t border-slate-200 pt-4">
        <button type="button" onClick={b.goPrev} disabled={!b.canGoPrev || props.busy} className="rounded border border-slate-300 px-4 py-1.5 text-sm disabled:opacity-40">Back</button>
        <button type="button" onClick={b.goNext} disabled={!b.canGoNext || props.busy} className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40">Next</button>
        <div className="flex-1" />
        <button type="button" onClick={props.onClose} disabled={props.busy} className="rounded border border-slate-300 px-4 py-1.5 text-sm disabled:opacity-40">Close</button>
      </div>
    </div>
  );
}
