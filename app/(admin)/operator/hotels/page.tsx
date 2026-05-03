"use client";

import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { CsvImportModal } from "@/components/CsvImportModal";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { PaginationBar } from "@/components/PaginationBar";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiHotels,
  apiGetHotel,
  apiCreateHotel,
  apiUpdateHotel,
  apiDeleteHotel,
  hotelCreateBodyFromForm,
  hotelUpdateBodyFromForm,
  hotelFormFromDetail,
  newHotelPricingFormRow,
  newHotelRoomFormRow,
  type HotelRow,
  type HotelFormPayload,
} from "@/lib/inventory-crud-api";
import { csvExportFilename, downloadCsvFile, exportHotelsCsv, hotelTemplateCsv, runHotelCsvImport } from "@/lib/csv-import-export";
import {
  HOTEL_API_STAR_RATING_KEY,
  HOTEL_AVAILABILITY_STATUSES,
  HOTEL_CANCELLATION_POLICY_PRESETS,
  HOTEL_FACILITY_AMENITY_KEYS,
  HOTEL_LIFECYCLE_STATUSES,
  HOTEL_MEAL_TYPES,
  HOTEL_POLICY_BOOLEAN_KEYS,
  HOTEL_REVIEW_LABEL_PRESETS,
  HOTEL_ROOM_INVENTORY_MODE_PRESETS,
  HOTEL_VISIBILITY_RULES,
  HOTEL_ROOM_PRICING_MODES,
  HOTEL_ROOM_PRICING_STATUSES,
  formatHotelApiValidationErrors,
  formatHotelStarRatingDisplay,
  hotelAvailabilityLabel,
  hotelLifecycleStatusLabel,
  hotelMealTypeLabel,
  hotelVisibilityRuleLabel,
  validateHotelOperatorForm,
} from "@/lib/hotel-ui";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useState } from "react";

const EMPTY: HotelFormPayload = {
  offer_id: "",
  location_id: "",
  hotel_name: "",
  property_type: "hotel",
  hotel_type: "resort",
  country: "",
  region_or_state: "",
  city: "",
  district_or_area: "",
  full_address: "",
  latitude: "",
  longitude: "",
  meal_type: "bed_and_breakfast",
  star_rating: "",
  availability_status: "available",
  status: "draft",
  bookable: true,
  is_package_eligible: false,
  visibility_rule: "show_all",
  appears_in_packages: true,
  free_wifi: false,
  parking: false,
  airport_shuttle: false,
  indoor_pool: false,
  outdoor_pool: false,
  room_service: false,
  front_desk_24h: false,
  child_friendly: false,
  accessibility_support: false,
  pets_allowed: false,
  free_cancellation: false,
  prepayment_required: false,
  cancellation_policy_type: "",
  cancellation_deadline_at: "",
  no_show_policy: "",
  review_score: "",
  review_count: "",
  review_label: "",
  room_inventory_mode: "",
  rooms: [newHotelRoomFormRow()],
};

export default function OperatorHotelsPage() {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState<HotelRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<HotelFormPayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrLines, setFormErrLines] = useState<string[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiHotels(token, { page, per_page: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setErr(null);
    setEditId(null);
    setForm({ ...EMPTY });
    setFormErrLines([]);
    setFormLoading(false);
  }

  async function openEdit(r: HotelRow) {
    if (!token) return;
    setErr(null);
    setEditId(r.id);
    setForm(null);
    setFormLoading(true);
    setFormErrLines([]);
    try {
      const res = await apiGetHotel(token, r.id);
      setForm(hotelFormFromDetail(res.data));
    } catch (e) {
      setEditId(null);
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
        setErr(formatHotelApiValidationErrors(e.body.errors).join(" "));
      } else {
        setErr(e instanceof ApiRequestError ? e.message : "Failed to load hotel");
      }
    } finally {
      setFormLoading(false);
    }
  }

  function closeForm() {
    setForm(null);
    setEditId(null);
    setFormErrLines([]);
    setFormLoading(false);
  }

  async function handleSubmit() {
    if (!token || !form) return;
    const mode = editId != null ? "edit" : "create";
    const validation = validateHotelOperatorForm(form, mode);
    if (validation.length > 0) {
      setFormErrLines(validation);
      return;
    }
    setBusy(true);
    setFormErrLines([]);
    try {
      if (editId != null) {
        await apiUpdateHotel(token, editId, hotelUpdateBodyFromForm(form));
      } else {
        await apiCreateHotel(token, hotelCreateBodyFromForm(form));
      }
      closeForm();
      await load();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
        setFormErrLines(formatHotelApiValidationErrors(e.body.errors));
      } else {
        setFormErrLines([e instanceof ApiRequestError ? e.message : "Failed"]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !window.confirm(t("admin.crud.hotels.delete_confirm"))) return;
    setBusy(true);
    try {
      await apiDeleteHotel(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (forbidden)
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.crud.hotels.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="admin-page-title">{t("admin.crud.hotels.title")}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ImportExportButtons
            busy={busy || exportBusy}
            exportDisabled={!token}
            onTemplate={() => downloadCsvFile("hotels-template.csv", hotelTemplateCsv())}
            onExport={async () => {
              if (!token) return;
              setExportBusy(true);
              try {
                const csv = await exportHotelsCsv(token);
                downloadCsvFile(csvExportFilename("hotels"), csv);
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
            onClick={openCreate}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            {t("admin.crud.hotels.new_btn")}
          </button>
        </div>
      </div>
      <CsvImportModal
        open={importOpen}
        title={t("admin.crud.hotels.import_title")}
        onClose={() => setImportOpen(false)}
        onRun={async (rows, rowLineNumbers) => {
          if (!token) {
            return {
              success: 0,
              failed: rows.length,
              errors: [{ rowNumber: rowLineNumbers[0] ?? 2, message: "Not signed in." }],
            };
          }
          const res = await runHotelCsvImport(token, rows, rowLineNumbers);
          if (res.success > 0) await load();
          return res;
        }}
      />
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      {formLoading && editId != null && !form && (
        <div className="mt-4 rounded border border-default bg-white p-4 text-sm text-fg-t6">{t("admin.crud.hotels.loading")}</div>
      )}
      {form && (
        <div className="mt-4 rounded border border-default bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? t("admin.crud.hotels.form_edit") : t("admin.crud.hotels.form_new")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {editId == null && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.offer_id")}</span>
                <input
                  type="number"
                  min={1}
                  value={form.offer_id === "" ? "" : form.offer_id}
                  onChange={(e) =>
                    setForm((p) =>
                      p
                        ? {
                            ...p,
                            offer_id: e.target.value === "" ? "" : Number(e.target.value),
                          }
                        : p
                    )
                  }
                  className="rounded border border-default px-2 py-1.5 text-sm"
                />
              </label>
            )}
            {(["hotel_name", "property_type", "hotel_type", "country", "region_or_state", "city", "district_or_area"] as const).map(
              (f) => (
                <label key={f} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-fg-t6">{t(`admin.crud.hotels.field.${f}`)}</span>
                  <input
                    value={form[f]}
                    onChange={(e) => setForm((p) => (p ? { ...p, [f]: e.target.value } : p))}
                    className="rounded border border-default px-2 py-1.5 text-sm"
                  />
                </label>
              )
            )}
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.full_address")}</span>
              <input
                value={form.full_address}
                onChange={(e) => setForm((p) => (p ? { ...p, full_address: e.target.value } : p))}
                className="rounded border border-default px-2 py-1.5 text-sm"
              />
            </label>
            <LocationCascadeSelect
              token={token}
              value={form.location_id === "" ? null : Number(form.location_id)}
              label="Location (Country -> Region -> City)"
              onChange={(locationId, meta) =>
                setForm((p) =>
                  p
                    ? {
                        ...p,
                        location_id: locationId ?? "",
                        country: meta.country?.name ?? p.country,
                        region_or_state: meta.region?.name ?? p.region_or_state,
                        city: meta.city?.name ?? p.city,
                      }
                    : p
                )
              }
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.latitude")}</span>
              <input
                value={form.latitude}
                onChange={(e) => setForm((p) => (p ? { ...p, latitude: e.target.value } : p))}
                className="rounded border border-default px-2 py-1.5 text-sm"
                placeholder="e.g. 40.1776"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.longitude")}</span>
              <input
                value={form.longitude}
                onChange={(e) => setForm((p) => (p ? { ...p, longitude: e.target.value } : p))}
                className="rounded border border-default px-2 py-1.5 text-sm"
                placeholder="e.g. 44.5126"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.meal_type")}</span>
              <select
                value={form.meal_type}
                onChange={(e) => setForm((p) => (p ? { ...p, meal_type: e.target.value } : p))}
                className="rounded border border-default px-2 py-1.5 text-sm"
              >
                {HOTEL_MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {hotelMealTypeLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.star_rating")}</span>
              <span className="text-xs text-fg-t6">
                Optional (1–5) — API field <code className="rounded bg-figma-bg-1 px-1">{HOTEL_API_STAR_RATING_KEY}</code>
              </span>
              <input
                type="number"
                min={1}
                max={5}
                value={form.star_rating === "" ? "" : form.star_rating}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          star_rating: e.target.value === "" ? "" : Number(e.target.value),
                        }
                      : p
                  )
                }
                className="rounded border border-default px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4">
            <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.availability")}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.availability_status")}</span>
                <select
                  value={form.availability_status}
                  onChange={(e) => setForm((p) => (p ? { ...p, availability_status: e.target.value } : p))}
                  className="rounded border border-default px-2 py-1.5 text-sm"
                >
                  {HOTEL_AVAILABILITY_STATUSES.map((m) => (
                    <option key={m} value={m}>
                      {hotelAvailabilityLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.status")}</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => (p ? { ...p, status: e.target.value } : p))}
                  className="rounded border border-default px-2 py-1.5 text-sm"
                >
                  {HOTEL_LIFECYCLE_STATUSES.map((m) => (
                    <option key={m} value={m}>
                      {hotelLifecycleStatusLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.room_inventory_mode")}</span>
                <input
                  value={form.room_inventory_mode}
                  onChange={(e) => setForm((p) => (p ? { ...p, room_inventory_mode: e.target.value } : p))}
                  className="rounded border border-default px-2 py-1.5 text-sm"
                  maxLength={64}
                  list="hotel-room-inventory-mode"
                  placeholder="e.g. per_room"
                />
                <datalist id="hotel-room-inventory-mode">
                  {HOTEL_ROOM_INVENTORY_MODE_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.visibility_rule")}</span>
                <select
                  value={form.visibility_rule}
                  onChange={(e) => setForm((p) => (p ? { ...p, visibility_rule: e.target.value } : p))}
                  className="rounded border border-default px-2 py-1.5 text-sm"
                >
                  {HOTEL_VISIBILITY_RULES.map((r) => (
                    <option key={r} value={r}>
                      {hotelVisibilityRuleLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.bookable}
                    onChange={(e) => setForm((p) => (p ? { ...p, bookable: e.target.checked } : p))}
                    className="rounded border border-default"
                  />
                  <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.bookable")}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_package_eligible}
                    onChange={(e) => setForm((p) => (p ? { ...p, is_package_eligible: e.target.checked } : p))}
                    className="rounded border border-default"
                  />
                  <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.is_package_eligible")}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.appears_in_packages}
                    onChange={(e) => setForm((p) => (p ? { ...p, appears_in_packages: e.target.checked } : p))}
                    className="rounded border border-default"
                  />
                  <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.appears_in_packages")}</span>
                </label>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-default pt-4">
            <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.facilities")}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {HOTEL_FACILITY_AMENITY_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((p) => (p ? { ...p, [key]: e.target.checked } : p))}
                    className="rounded border border-default"
                  />
                  <span>{t(`admin.crud.hotels.field.${key}`)}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4">
            <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.policies")}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {HOTEL_POLICY_BOOLEAN_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((p) => (p ? { ...p, [key]: e.target.checked } : p))}
                    className="rounded border border-default"
                  />
                  <span>{t(`admin.crud.hotels.field.${key}`)}</span>
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.cancellation_policy_type")}</span>
                <input
                  value={form.cancellation_policy_type}
                  onChange={(e) => setForm((p) => (p ? { ...p, cancellation_policy_type: e.target.value } : p))}
                  className="rounded border border-default px-2 py-1.5 text-sm"
                  maxLength={64}
                  list="hotel-cancellation-policy-type"
                />
                <datalist id="hotel-cancellation-policy-type">
                  {HOTEL_CANCELLATION_POLICY_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.cancellation_deadline_at")}</span>
                <input
                  type="datetime-local"
                  value={form.cancellation_deadline_at}
                  onChange={(e) =>
                    setForm((p) => (p ? { ...p, cancellation_deadline_at: e.target.value } : p))
                  }
                  className="rounded border border-default px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.no_show_policy")}</span>
                <input
                  value={form.no_show_policy}
                  onChange={(e) => setForm((p) => (p ? { ...p, no_show_policy: e.target.value } : p))}
                  className="rounded border border-default px-2 py-1.5 text-sm"
                  maxLength={255}
                  placeholder="Short no-show terms"
                />
              </label>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4">
            <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.review_data")}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.review_score")}</span>
                <span className="text-xs text-fg-t6">0–10, optional</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  value={form.review_score === "" ? "" : form.review_score}
                  onChange={(e) =>
                    setForm((p) =>
                      p
                        ? {
                            ...p,
                            review_score: e.target.value === "" ? "" : Number(e.target.value),
                          }
                        : p
                    )
                  }
                  className="rounded border border-default px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.review_count")}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.review_count === "" ? "" : form.review_count}
                  onChange={(e) =>
                    setForm((p) =>
                      p
                        ? {
                            ...p,
                            review_count: e.target.value === "" ? "" : Number(e.target.value),
                          }
                        : p
                    )
                  }
                  className="rounded border border-default px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.review_label")}</span>
                <input
                  value={form.review_label}
                  onChange={(e) => setForm((p) => (p ? { ...p, review_label: e.target.value } : p))}
                  className="rounded border border-default px-2 py-1.5 text-sm"
                  maxLength={255}
                  list="hotel-review-label"
                />
                <datalist id="hotel-review-label">
                  {HOTEL_REVIEW_LABEL_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-default pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-fg-t6">
                {t("admin.crud.hotels.section.rooms")}
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => (p ? { ...p, rooms: [...p.rooms, newHotelRoomFormRow()] } : p))
                }
                className="rounded border border-default px-2 py-1 text-xs text-fg-t7 hover:bg-figma-bg-1"
              >
                {t("admin.crud.hotels.add_room")}
              </button>
            </div>
            <p className="text-xs text-fg-t6">
              Each room needs at least one rate row. Dates use YYYY-MM-DD (optional). Edit mode replaces all rooms on
              save (sync with API).
            </p>
            {form.rooms.map((room, ri) => (
              <div key={room.clientKey} className="rounded border border-default bg-figma-bg-1/80 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-fg-t7">Room {ri + 1}</span>
                  {form.rooms.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-error-600 underline"
                      onClick={() =>
                        setForm((p) =>
                          p && p.rooms.length > 1
                            ? { ...p, rooms: p.rooms.filter((_, i) => i !== ri) }
                            : p
                        )
                      }
                    >
                      {t("admin.crud.hotels.remove_room")}
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.room_type")}</span>
                    <input
                      value={room.room_type}
                      onChange={(e) =>
                        setForm((p) => {
                          if (!p) return p;
                          const rooms = [...p.rooms];
                          rooms[ri] = { ...rooms[ri], room_type: e.target.value };
                          return { ...p, rooms };
                        })
                      }
                      className="rounded border border-default px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.room_name")}</span>
                    <input
                      value={room.room_name}
                      onChange={(e) =>
                        setForm((p) => {
                          if (!p) return p;
                          const rooms = [...p.rooms];
                          rooms[ri] = { ...rooms[ri], room_name: e.target.value };
                          return { ...p, rooms };
                        })
                      }
                      className="rounded border border-default px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.hotels.field.capacity")}</span>
                    <input
                      type="number"
                      min={1}
                      value={room.capacity === "" ? "" : room.capacity}
                      onChange={(e) =>
                        setForm((p) => {
                          if (!p) return p;
                          const rooms = [...p.rooms];
                          const v = e.target.value;
                          rooms[ri] = {
                            ...rooms[ri],
                            capacity: v === "" ? "" : Number(v),
                          };
                          return { ...p, rooms };
                        })
                      }
                      className="rounded border border-default px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-default bg-white text-left text-fg-t6">
                        <th className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.price")}</th>
                        <th className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.currency")}</th>
                        <th className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.pricing_mode")}</th>
                        <th className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.valid_from")}</th>
                        <th className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.valid_to")}</th>
                        <th className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.min_nights")}</th>
                        <th className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.pricing_status")}</th>
                        <th className="px-1 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {room.pricings.map((pr, pi) => (
                        <tr key={pi} className="border-b border-default bg-white">
                          <td className="px-1 py-1 align-top">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={pr.price}
                              onChange={(e) =>
                                setForm((p) => {
                                  if (!p) return p;
                                  const rooms = [...p.rooms];
                                  const pricings = [...rooms[ri].pricings];
                                  pricings[pi] = { ...pricings[pi], price: e.target.value };
                                  rooms[ri] = { ...rooms[ri], pricings };
                                  return { ...p, rooms };
                                })
                              }
                              className="w-full min-w-[4.5rem] rounded border border-default px-1 py-1"
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              maxLength={3}
                              value={pr.currency}
                              onChange={(e) =>
                                setForm((p) => {
                                  if (!p) return p;
                                  const rooms = [...p.rooms];
                                  const pricings = [...rooms[ri].pricings];
                                  pricings[pi] = {
                                    ...pricings[pi],
                                    currency: e.target.value.toUpperCase(),
                                  };
                                  rooms[ri] = { ...rooms[ri], pricings };
                                  return { ...p, rooms };
                                })
                              }
                              className="w-full min-w-[3rem] rounded border border-default px-1 py-1 uppercase"
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="text"
                              maxLength={32}
                              value={pr.pricing_mode}
                              onChange={(e) =>
                                setForm((p) => {
                                  if (!p) return p;
                                  const rooms = [...p.rooms];
                                  const pricings = [...rooms[ri].pricings];
                                  pricings[pi] = { ...pricings[pi], pricing_mode: e.target.value };
                                  rooms[ri] = { ...rooms[ri], pricings };
                                  return { ...p, rooms };
                                })
                              }
                              className="w-full min-w-[6rem] rounded border border-default px-1 py-1"
                              placeholder="per_night"
                              list={`hotel-pricing-mode-${room.clientKey}`}
                            />
                            <datalist id={`hotel-pricing-mode-${room.clientKey}`}>
                              {HOTEL_ROOM_PRICING_MODES.map((m) => (
                                <option key={m} value={m} />
                              ))}
                            </datalist>
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="text"
                              value={pr.valid_from}
                              onChange={(e) =>
                                setForm((p) => {
                                  if (!p) return p;
                                  const rooms = [...p.rooms];
                                  const pricings = [...rooms[ri].pricings];
                                  pricings[pi] = { ...pricings[pi], valid_from: e.target.value };
                                  rooms[ri] = { ...rooms[ri], pricings };
                                  return { ...p, rooms };
                                })
                              }
                              className="w-full min-w-[6.5rem] rounded border border-default px-1 py-1"
                              placeholder="YYYY-MM-DD"
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="text"
                              value={pr.valid_to}
                              onChange={(e) =>
                                setForm((p) => {
                                  if (!p) return p;
                                  const rooms = [...p.rooms];
                                  const pricings = [...rooms[ri].pricings];
                                  pricings[pi] = { ...pricings[pi], valid_to: e.target.value };
                                  rooms[ri] = { ...rooms[ri], pricings };
                                  return { ...p, rooms };
                                })
                              }
                              className="w-full min-w-[6.5rem] rounded border border-default px-1 py-1"
                              placeholder="YYYY-MM-DD"
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="number"
                              min={1}
                              value={pr.min_nights === "" ? "" : pr.min_nights}
                              onChange={(e) =>
                                setForm((p) => {
                                  if (!p) return p;
                                  const rooms = [...p.rooms];
                                  const pricings = [...rooms[ri].pricings];
                                  const v = e.target.value;
                                  pricings[pi] = {
                                    ...pricings[pi],
                                    min_nights: v === "" ? "" : Number(v),
                                  };
                                  rooms[ri] = { ...rooms[ri], pricings };
                                  return { ...p, rooms };
                                })
                              }
                              className="w-full min-w-[3.5rem] rounded border border-default px-1 py-1"
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="text"
                              maxLength={32}
                              value={pr.status}
                              onChange={(e) =>
                                setForm((p) => {
                                  if (!p) return p;
                                  const rooms = [...p.rooms];
                                  const pricings = [...rooms[ri].pricings];
                                  pricings[pi] = { ...pricings[pi], status: e.target.value };
                                  rooms[ri] = { ...rooms[ri], pricings };
                                  return { ...p, rooms };
                                })
                              }
                              className="w-full min-w-[4rem] rounded border border-default px-1 py-1"
                              placeholder="active"
                              list={`hotel-pricing-status-${room.clientKey}`}
                            />
                            <datalist id={`hotel-pricing-status-${room.clientKey}`}>
                              {HOTEL_ROOM_PRICING_STATUSES.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </td>
                          <td className="px-1 py-1 align-top text-right">
                            {room.pricings.length > 1 && (
                              <button
                                type="button"
                                className="text-[10px] text-error-600 underline"
                                onClick={() =>
                                  setForm((p) => {
                                    if (!p) return p;
                                    const rooms = [...p.rooms];
                                    const pricings = rooms[ri].pricings.filter((_, i) => i !== pi);
                                    rooms[ri] = { ...rooms[ri], pricings };
                                    return { ...p, rooms };
                                  })
                                }
                              >
                                {t("admin.crud.hotels.remove")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => {
                      if (!p) return p;
                      const rooms = [...p.rooms];
                      rooms[ri] = {
                        ...rooms[ri],
                        pricings: [...rooms[ri].pricings, newHotelPricingFormRow()],
                      };
                      return { ...p, rooms };
                    })
                  }
                  className="mt-2 text-xs text-info-700 underline"
                >
                  {t("admin.crud.hotels.add_rate")}
                </button>
              </div>
            ))}
          </div>
          {formErrLines.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-error-600">
              {formErrLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSubmit()}
              className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {busy ? t("admin.crud.common.saving") : t("common.save")}
            </button>
            <button type="button" onClick={closeForm} className="rounded border border-default px-4 py-1.5 text-sm">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
              <th className="px-3 py-2">{t("admin.crud.hotels.col.hotel")}</th>
              <th className="px-3 py-2">{t("admin.crud.hotels.col.city")}</th>
              <th className="px-3 py-2">{t("admin.crud.hotels.col.country")}</th>
              <th className="px-3 py-2">{t("admin.crud.hotels.col.stars")}</th>
              <th className="px-3 py-2">{t("admin.crud.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.crud.hotels.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                <td className="px-3 py-2 font-medium">{r.hotel_name ?? "-"}</td>
                <td className="px-3 py-2">{r.city ?? "-"}</td>
                <td className="px-3 py-2">{r.country ?? "-"}</td>
                <td className="px-3 py-2">{formatHotelStarRatingDisplay(r.star_rating)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void openEdit(r)}
                      className="text-xs text-info-700 underline"
                    >
                      {t("admin.crud.common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(r.id)}
                      className="text-xs text-error-600 underline"
                    >
                      {t("admin.crud.common.delete")}
                    </button>
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
