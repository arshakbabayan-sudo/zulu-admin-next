"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { MainImageDescriptionFields } from "@/components/MainImageDescriptionFields";
import { LatLngFields } from "@/components/LatLngFields";
import { OfferStatusBadge, isSubmittableStatus } from "@/components/OfferStatusBadge";
import { PaginationBar } from "@/components/PaginationBar";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
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

  function openCreate() {
    setEditId(null);
    setForm({
      package_title: "",
      package_subtitle: "",
      package_type: "multi_service",
      destination_city: "",
      destination_country: "",
      destination_location_id: null,
      duration_days: undefined,
      min_nights: null,
      adults_count: 2,
      children_count: 0,
      base_price: null,
      currency: "USD",
      main_image: "",
      short_description: "",
      is_featured: false,
      latitude: null,
      longitude: null,
    } as PackagePayload);
    setFormErr(null);
  }
  function openEdit(r: PackageRow) {
    setEditId(r.id);
    setForm({
      package_title: r.package_title ?? "",
      package_subtitle: r.package_subtitle ?? "",
      package_type: r.package_type ?? "multi_service",
      destination_city: r.destination_city ?? "",
      destination_country: r.destination_country ?? "",
      destination_location_id: (r as { destination_location_id?: number | null }).destination_location_id ?? null,
      duration_days: r.duration_days ?? undefined,
      min_nights: r.min_nights ?? null,
      adults_count: r.adults_count ?? 2,
      children_count: r.children_count ?? 0,
      base_price: r.base_price != null ? Number(r.base_price) : null,
      currency: r.currency ?? "USD",
      main_image: r.main_image ?? "",
      short_description: r.short_description ?? "",
      is_featured: r.is_featured ?? false,
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
    } as PackagePayload);
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

  async function handleSubmitForReview(offerId: number) {
    if (!token) return;
    if (!window.confirm("Submit this package for super-admin review? Once submitted, you cannot edit it until it's approved or rejected.")) return;
    setBusyId(offerId);
    try {
      await apiSubmitOfferForReview(token, offerId);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Submit failed.");
    } finally {
      setBusyId(null);
    }
  }

  if (forbidden) return <div><h1 className="admin-page-title">{t("admin.crud.packages.title")}</h1><div className="mt-4"><ForbiddenNotice /></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="admin-page-title">{t("admin.crud.packages.title")}</h1></div>
        <button type="button" onClick={openCreate} className="admin-btn-primary">{t("admin.crud.packages.new_btn")}</button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-fg-t6">
          {t("admin.crud.packages.filter.status")}
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="ml-2 rounded border border-default px-2 py-1 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s || t("admin.crud.common.all")}</option>)}
          </select>
        </label>
      </div>

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      {form && (
        <div className="mt-4 rounded border border-default bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? t("admin.crud.packages.form_edit") : t("admin.crud.packages.form_new")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.packages.field.title")}</span>
              <input value={form.package_title ?? ""} onChange={(e) => setForm((p) => p ? { ...p, package_title: e.target.value } : p)}
                className="rounded border border-default px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-fg-t6">Subtitle</span>
              <input value={form.package_subtitle ?? ""} onChange={(e) => setForm((p) => p ? { ...p, package_subtitle: e.target.value } : p)}
                placeholder="Short tagline shown under the title (e.g. 'Garni + Sevan + Tucson SUV')"
                className="rounded border border-default px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.packages.field.type")}</span>
              <select value={form.package_type ?? ""} onChange={(e) => setForm((p) => p ? { ...p, package_type: e.target.value } : p)}
                className="rounded border border-default px-2 py-1.5 text-sm">
                {PACKAGE_TYPES.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </label>
            <LocationCascadeSelect
              token={token}
              value={
                (form as { destination_location_id?: number | null }).destination_location_id ?? null
              }
              label="Destination location"
              onChange={(locationId, meta) =>
                setForm((p) =>
                  p
                    ? ({
                        ...p,
                        destination_location_id: locationId ?? null,
                        // Mirror into legacy text columns for back-compat consumers.
                        destination_country: meta.country?.name ?? p.destination_country,
                        destination_city: meta.city?.name ?? meta.region?.name ?? p.destination_city,
                      } as PackagePayload)
                    : p
                )
              }
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">Base price</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.base_price ?? ""}
                onChange={(e) => setForm((p) => p ? { ...p, base_price: e.target.value === "" ? null : Number(e.target.value) } : p)}
                placeholder="e.g. 580.00"
                className="rounded border border-default px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.packages.field.currency")}</span>
              <input value={(form["currency"] as string) ?? ""} onChange={(e) => setForm((p) => p ? { ...p, currency: e.target.value } : p)}
                className="rounded border border-default px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.packages.field.duration")}</span>
              <input type="number" min="1" value={form.duration_days ?? ""} onChange={(e) => setForm((p) => p ? { ...p, duration_days: e.target.value ? Number(e.target.value) : undefined } : p)}
                className="rounded border border-default px-2 py-1.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">Min nights</span>
              <input
                type="number"
                min="0"
                value={form.min_nights ?? ""}
                onChange={(e) => setForm((p) => p ? { ...p, min_nights: e.target.value === "" ? null : Number(e.target.value) } : p)}
                placeholder="Hotel nights included"
                className="rounded border border-default px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">Adults</span>
              <input
                type="number"
                min="1"
                value={form.adults_count ?? ""}
                onChange={(e) => setForm((p) => p ? { ...p, adults_count: e.target.value === "" ? null : Number(e.target.value) } : p)}
                className="rounded border border-default px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">Children</span>
              <input
                type="number"
                min="0"
                value={form.children_count ?? ""}
                onChange={(e) => setForm((p) => p ? { ...p, children_count: e.target.value === "" ? null : Number(e.target.value) } : p)}
                className="rounded border border-default px-2 py-1.5 text-sm"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={!!form.is_featured}
                onChange={(e) => setForm((p) => p ? { ...p, is_featured: e.target.checked } : p)}
                className="h-4 w-4"
              />
              <span className="font-medium text-fg-t6">Featured (surfaces this package on the homepage carousel)</span>
            </label>
            <MainImageDescriptionFields
              mainImage={(form.main_image as string | null | undefined) ?? ""}
              shortDescription={(form.short_description as string | null | undefined) ?? ""}
              onMainImageChange={(v) => setForm((p) => p ? { ...p, main_image: v } : p)}
              onShortDescriptionChange={(v) => setForm((p) => p ? { ...p, short_description: v } : p)}
              section="packages"
              altText="Package preview"
            />
            <LatLngFields
              latitude={form.latitude != null ? String(form.latitude) : ""}
              longitude={form.longitude != null ? String(form.longitude) : ""}
              onLatitudeChange={(v) =>
                setForm((p) =>
                  p ? { ...p, latitude: v.trim() === "" ? null : Number(v) } : p
                )
              }
              onLongitudeChange={(v) =>
                setForm((p) =>
                  p ? { ...p, longitude: v.trim() === "" ? null : Number(v) } : p
                )
              }
            />
          </div>
          {formErr && <p className="mt-2 text-sm text-error-600">{formErr}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void handleSubmit()} className="admin-btn-primary">{busy ? t("admin.crud.common.saving") : t("common.save")}</button>
            <button type="button" onClick={closeForm} className="rounded border border-default px-4 py-1.5 text-sm">{t("common.cancel")}</button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr><th className="px-3 py-2">{t("admin.crud.common.id")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.title")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.type")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.destination")}</th><th className="px-3 py-2">{t("admin.crud.packages.col.days")}</th><th className="px-3 py-2">Review status</th><th className="px-3 py-2">{t("admin.crud.packages.col.company")}</th><th className="px-3 py-2">{t("admin.crud.common.actions")}</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-fg-t6">{t("admin.crud.packages.empty")}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                <td className="px-3 py-2 font-medium max-w-[180px] truncate">{r.package_title ?? "-"}</td>
                <td className="px-3 py-2 text-xs">{r.package_type ?? "-"}</td>
                <td className="px-3 py-2 text-xs">{[r.destination_city, r.destination_country].filter(Boolean).join(", ") || "-"}</td>
                <td className="px-3 py-2 tabular-nums">{r.duration_days ?? "-"}</td>
                <td className="px-3 py-2"><OfferStatusBadge status={r.offer?.status ?? null} /></td>
                <td className="px-3 py-2 text-xs">{r.company?.name ?? r.company_id ?? "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => openEdit(r)} className="text-left text-xs text-info-700 underline">{t("admin.crud.common.edit")}</button>
                    {r.offer?.id && isSubmittableStatus(r.offer.status) && (
                      <button
                        type="button"
                        disabled={busyId === r.offer.id}
                        onClick={() => void handleSubmitForReview(r.offer!.id!)}
                        className="self-start rounded bg-primary px-2 py-0.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Submit for review
                      </button>
                    )}
                    <button type="button" disabled={busyId === r.id} onClick={() => void handleToggle(r)}
                      className={`text-left text-xs underline disabled:opacity-40 ${r.status === "active" ? "text-amber-600" : "text-success-700"}`}>
                      {r.status === "active" ? t("admin.crud.common.deactivate") : t("admin.crud.common.activate")}
                    </button>
                    <button type="button" disabled={busyId === r.id} onClick={() => void handleDelete(r.id)} className="text-left text-xs text-error-600 underline disabled:opacity-40">{t("admin.crud.common.delete")}</button>
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
