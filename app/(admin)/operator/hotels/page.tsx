"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ContentLanguagePill } from "@/components/ContentLanguagePill";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { ImageUploadField } from "@/components/ImageUploadField";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { OfferStatusBadge, isSubmittableStatus } from "@/components/OfferStatusBadge";
import { PaginationBar } from "@/components/PaginationBar";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { SourceLanguagePicker } from "@/components/SourceLanguagePicker";
import { TranslationTabs } from "@/components/TranslationTabs";
import {
  Button,
  Checkbox,
  FormField,
  Input,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { ApiRequestError } from "@/lib/api-client";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
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
  HOTEL_ACCOMMODATION_TYPES,
  type HotelRow,
  type HotelFormPayload,
  type HotelAccommodationType,
} from "@/lib/inventory-crud-api";
import { csvExportFilename, downloadCsvFile, exportHotelsCsv } from "@/lib/csv-import-export";
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
import { useDocumentTitle } from "@/lib/use-document-title";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

// Lazy-load the XLSX import modal вЂ” it pulls in ExcelJS (~200 KB) which is
// only needed when the operator actually clicks "Import". Module + dep
// download happens on first render of the modal (gated by importOpen).
const HotelsXlsxImportModal = dynamic(
  () => import("@/components/HotelsXlsxImportModal").then((m) => m.HotelsXlsxImportModal),
  { ssr: false },
);

const EMPTY: HotelFormPayload = {
  offer_id: "",
  location_id: "",
  source_lang: "en",
  hotel_name: "",
  property_type: "hotel",
  hotel_type: "resort",
  accommodation_type: "hotel",
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
  main_image: "",
  short_description: "",
  rooms: [newHotelRoomFormRow()],
};

export default function OperatorHotelsPage() {
  const { token } = useAdminAuth();
  const { t, contentLang } = useLanguage();
  useDocumentTitle(t("admin.operator.hotels.title"));
  const confirm = useConfirm();
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
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.crud.common.failed"));
    }
    // contentLang is intentionally in deps: changing the content preview language
    // must refetch hotel rows so the localized hotel_name / description show up.
  }, [token, page, contentLang]);

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
        setErr(e instanceof ApiRequestError ? e.message : t("admin.crud.hotels.err_load_one"));
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
        setFormErrLines([e instanceof ApiRequestError ? e.message : t("admin.crud.common.failed")]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.hotels.delete_confirm", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteHotel(token, id);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.crud.common.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitForReview(offerId: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.submit_for_review_confirm" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiSubmitOfferForReview(token, offerId);
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : t("admin.crud.hotels.err_submit_failed"));
    } finally {
      setBusy(false);
    }
  }

  if (forbidden)
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.crud.hotels.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {t("admin.crud.hotels.title")}
            {/* Pill is hidden when edit/create form is open: switching content lang
                there would either discard unsaved edits (refetch) or silently
                overwrite the EN source on save (no refetch). Use the Translations
                tabs at the bottom of the edit form instead. */}
            {form === null && <ContentLanguagePill />}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ImportExportButtons
              busy={busy || exportBusy}
              exportDisabled={!token}
              onTemplate={async () => {
                try {
                  // Lazy-load ExcelJS only when the operator asks for the template.
                  const { buildHotelsTemplateBlob, downloadBlob } = await import("@/lib/hotels-xlsx");
                  const blob = await buildHotelsTemplateBlob();
                  downloadBlob("hotels-template.xlsx", blob);
                } catch (e) {
                  alert(e instanceof Error ? e.message : t("admin.crud.hotels.err_template_failed"));
                }
              }}
              onExport={async () => {
                if (!token) return;
                setExportBusy(true);
                try {
                  const csv = await exportHotelsCsv(token);
                  downloadCsvFile(csvExportFilename("hotels"), csv);
                } catch (e) {
                  alert(e instanceof ApiRequestError ? e.message : t("admin.crud.hotels.err_export_failed"));
                } finally {
                  setExportBusy(false);
                }
              }}
              onImport={() => setImportOpen(true)}
            />
            <Button size="sm" onClick={openCreate}>
              {t("admin.crud.hotels.new_btn")}
            </Button>
          </div>
        }
      />
      {importOpen && (
        <HotelsXlsxImportModal
          open
          token={token}
          onClose={() => setImportOpen(false)}
          onSuccess={() => void load()}
        />
      )}
      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}
      {formLoading && editId != null && !form && (
        <div className="admin-card p-4 text-sm text-fg-t6">{t("admin.crud.hotels.loading")}</div>
      )}
      {form && (
        <section className="admin-card p-4">
          <h2 className="mb-3 text-base font-semibold">{editId ? t("admin.crud.hotels.form_edit") : t("admin.crud.hotels.form_new")}</h2>
          <SourceLanguagePicker
            value={form.source_lang ?? "en"}
            onChange={(next) => setForm((p) => (p ? { ...p, source_lang: next } : p))}
            locked={editId != null}
            className="mb-4"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {editId == null && (
              <FormField label={t("admin.crud.hotels.field.offer_id")} htmlFor="hotel-offer-id">
                <Input
                  id="hotel-offer-id"
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
                />
              </FormField>
            )}
            {(["hotel_name", "property_type", "hotel_type", "district_or_area"] as const).map(
              (f) => (
                <FormField key={f} label={t(`admin.crud.hotels.field.${f}`)} htmlFor={`hotel-${f}`}>
                  <Input
                    id={`hotel-${f}`}
                    value={form[f]}
                    onChange={(e) => setForm((p) => (p ? { ...p, [f]: e.target.value } : p))}
                  />
                </FormField>
              )
            )}
            <FormField label={t("admin.crud.hotels.field.accommodation_type")} htmlFor="hotel-accommodation-type">
              <Select
                id="hotel-accommodation-type"
                value={form.accommodation_type}
                onChange={(e) =>
                  setForm((p) =>
                    p ? { ...p, accommodation_type: e.target.value as HotelAccommodationType } : p
                  )
                }
              >
                {HOTEL_ACCOMMODATION_TYPES.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label={t("admin.crud.hotels.field.full_address")}
              htmlFor="hotel-full-address"
              className="sm:col-span-2"
            >
              <Input
                id="hotel-full-address"
                value={form.full_address}
                onChange={(e) => setForm((p) => (p ? { ...p, full_address: e.target.value } : p))}
              />
            </FormField>
            <ImageUploadField
              value={form.main_image}
              onChange={(v) => setForm((p) => (p ? { ...p, main_image: v } : p))}
              section="hotels"
              label={t("admin.crud.hotels.field.main_image")}
              altText={t("admin.crud.hotels.main_image_alt")}
            />
            <FormField
              label={
                <>
                  {t("admin.crud.hotels.field.short_description")}{" "}
                  <span className="text-fg-t6 font-normal">{t("admin.crud.hotels.short_description_hint")}</span>
                </>
              }
              htmlFor="hotel-short-description"
              className="sm:col-span-2"
            >
              <Input
                as="textarea"
                id="hotel-short-description"
                rows={4}
                placeholder={t("admin.crud.hotels.short_description_placeholder")}
                value={form.short_description}
                onChange={(e) => setForm((p) => (p ? { ...p, short_description: e.target.value } : p))}
              />
            </FormField>
            <LocationCascadeSelect
              token={token}
              value={form.location_id === "" ? null : Number(form.location_id)}
              label={t("admin.crud.hotels.field.location_label")}
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
            <FormField label={t("admin.crud.hotels.field.latitude")} htmlFor="hotel-latitude">
              <Input
                id="hotel-latitude"
                value={form.latitude}
                onChange={(e) => setForm((p) => (p ? { ...p, latitude: e.target.value } : p))}
                placeholder="e.g. 40.1776"
              />
            </FormField>
            <FormField label={t("admin.crud.hotels.field.longitude")} htmlFor="hotel-longitude">
              <Input
                id="hotel-longitude"
                value={form.longitude}
                onChange={(e) => setForm((p) => (p ? { ...p, longitude: e.target.value } : p))}
                placeholder="e.g. 44.5126"
              />
            </FormField>
            <FormField label={t("admin.crud.hotels.field.meal_type")} htmlFor="hotel-meal-type">
              <Select
                id="hotel-meal-type"
                value={form.meal_type}
                onChange={(e) => setForm((p) => (p ? { ...p, meal_type: e.target.value } : p))}
              >
                {HOTEL_MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {hotelMealTypeLabel(m)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label={t("admin.crud.hotels.field.star_rating")}
              htmlFor="hotel-star-rating"
              helperText={
                <>
                  {t("admin.crud.hotels.star_rating_hint")} <code className="rounded bg-figma-bg-1 px-1">{HOTEL_API_STAR_RATING_KEY}</code>
                </>
              }
            >
              <Input
                id="hotel-star-rating"
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
              />
            </FormField>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4">
            <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.availability")}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.crud.hotels.field.availability_status")} htmlFor="hotel-availability-status">
                <Select
                  id="hotel-availability-status"
                  value={form.availability_status}
                  onChange={(e) => setForm((p) => (p ? { ...p, availability_status: e.target.value } : p))}
                >
                  {HOTEL_AVAILABILITY_STATUSES.map((m) => (
                    <option key={m} value={m}>
                      {hotelAvailabilityLabel(m)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t("admin.crud.hotels.field.status")} htmlFor="hotel-status">
                <Select
                  id="hotel-status"
                  value={form.status}
                  onChange={(e) => setForm((p) => (p ? { ...p, status: e.target.value } : p))}
                >
                  {HOTEL_LIFECYCLE_STATUSES.map((m) => (
                    <option key={m} value={m}>
                      {hotelLifecycleStatusLabel(m)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t("admin.crud.hotels.field.room_inventory_mode")} htmlFor="hotel-room-inventory-mode-input">
                <Input
                  id="hotel-room-inventory-mode-input"
                  value={form.room_inventory_mode}
                  onChange={(e) => setForm((p) => (p ? { ...p, room_inventory_mode: e.target.value } : p))}
                  maxLength={64}
                  list="hotel-room-inventory-mode"
                  placeholder="e.g. per_room"
                />
                <datalist id="hotel-room-inventory-mode">
                  {HOTEL_ROOM_INVENTORY_MODE_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </FormField>
              <FormField label={t("admin.crud.hotels.field.visibility_rule")} htmlFor="hotel-visibility-rule">
                <Select
                  id="hotel-visibility-rule"
                  value={form.visibility_rule}
                  onChange={(e) => setForm((p) => (p ? { ...p, visibility_rule: e.target.value } : p))}
                >
                  {HOTEL_VISIBILITY_RULES.map((r) => (
                    <option key={r} value={r}>
                      {hotelVisibilityRuleLabel(r)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Checkbox
                  checked={form.bookable}
                  onChange={(e) => setForm((p) => (p ? { ...p, bookable: e.target.checked } : p))}
                  label={t("admin.crud.hotels.field.bookable")}
                />
                <Checkbox
                  checked={form.is_package_eligible}
                  onChange={(e) => setForm((p) => (p ? { ...p, is_package_eligible: e.target.checked } : p))}
                  label={t("admin.crud.hotels.field.is_package_eligible")}
                />
                <Checkbox
                  checked={form.appears_in_packages}
                  onChange={(e) => setForm((p) => (p ? { ...p, appears_in_packages: e.target.checked } : p))}
                  label={t("admin.crud.hotels.field.appears_in_packages")}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-default pt-4">
            <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.facilities")}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {HOTEL_FACILITY_AMENITY_KEYS.map((key) => (
                <Checkbox
                  key={key}
                  checked={form[key]}
                  onChange={(e) => setForm((p) => (p ? { ...p, [key]: e.target.checked } : p))}
                  label={t(`admin.crud.hotels.field.${key}`)}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4">
            <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.policies")}</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {HOTEL_POLICY_BOOLEAN_KEYS.map((key) => (
                <Checkbox
                  key={key}
                  checked={form[key]}
                  onChange={(e) => setForm((p) => (p ? { ...p, [key]: e.target.checked } : p))}
                  label={t(`admin.crud.hotels.field.${key}`)}
                />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.crud.hotels.field.cancellation_policy_type")} htmlFor="hotel-cancellation-policy-type-input">
                <Input
                  id="hotel-cancellation-policy-type-input"
                  value={form.cancellation_policy_type}
                  onChange={(e) => setForm((p) => (p ? { ...p, cancellation_policy_type: e.target.value } : p))}
                  maxLength={64}
                  list="hotel-cancellation-policy-type"
                />
                <datalist id="hotel-cancellation-policy-type">
                  {HOTEL_CANCELLATION_POLICY_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </FormField>
              <FormField label={t("admin.crud.hotels.field.cancellation_deadline_at")} htmlFor="hotel-cancellation-deadline">
                <Input
                  id="hotel-cancellation-deadline"
                  type="datetime-local"
                  value={form.cancellation_deadline_at}
                  onChange={(e) =>
                    setForm((p) => (p ? { ...p, cancellation_deadline_at: e.target.value } : p))
                  }
                />
              </FormField>
              <FormField
                label={t("admin.crud.hotels.field.no_show_policy")}
                htmlFor="hotel-no-show-policy"
                className="sm:col-span-2"
              >
                <Input
                  id="hotel-no-show-policy"
                  value={form.no_show_policy}
                  onChange={(e) => setForm((p) => (p ? { ...p, no_show_policy: e.target.value } : p))}
                  maxLength={255}
                  placeholder="Short no-show terms"
                />
              </FormField>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-default pt-4">
            <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.review_data")}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label={t("admin.crud.hotels.field.review_score")}
                htmlFor="hotel-review-score"
                helperText="0вЂ“10, optional"
              >
                <Input
                  id="hotel-review-score"
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
                />
              </FormField>
              <FormField label={t("admin.crud.hotels.field.review_count")} htmlFor="hotel-review-count">
                <Input
                  id="hotel-review-count"
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
                />
              </FormField>
              <FormField
                label={t("admin.crud.hotels.field.review_label")}
                htmlFor="hotel-review-label-input"
                className="sm:col-span-2"
              >
                <Input
                  id="hotel-review-label-input"
                  value={form.review_label}
                  onChange={(e) => setForm((p) => (p ? { ...p, review_label: e.target.value } : p))}
                  maxLength={255}
                  list="hotel-review-label"
                />
                <datalist id="hotel-review-label">
                  {HOTEL_REVIEW_LABEL_PRESETS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </FormField>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-default pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase text-fg-t6">
                {t("admin.crud.hotels.section.rooms")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((p) => (p ? { ...p, rooms: [...p.rooms, newHotelRoomFormRow()] } : p))
                }
              >
                {t("admin.crud.hotels.add_room")}
              </Button>
            </div>
            <p className="text-xs text-fg-t6">
              Each room needs at least one rate row. Dates use YYYY-MM-DD (optional). Edit mode replaces all rooms on
              save (sync with API).
            </p>
            {form.rooms.map((room, ri) => (
              <div key={room.clientKey} className="rounded-zulu border border-default bg-figma-bg-1/80 p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-fg-t7">Room {ri + 1}</span>
                  {form.rooms.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-error-600 hover:underline"
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
                {(() => {
                  const updateRoom = (patch: Partial<typeof room>) =>
                    setForm((p) => {
                      if (!p) return p;
                      const rooms = [...p.rooms];
                      rooms[ri] = { ...rooms[ri]!, ...patch };
                      return { ...p, rooms };
                    });
                  const numField = (
                    key: "max_adults" | "max_children" | "max_total_guests" | "bed_count" | "room_inventory_count",
                    min = 0
                  ) => (
                    <Input
                      type="number"
                      min={min}
                      value={room[key] === "" ? "" : (room[key] as number)}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateRoom({ [key]: v === "" ? "" : Number(v) } as Partial<typeof room>);
                      }}
                    />
                  );
                  const txtField = (key: "bed_type" | "room_size" | "room_view" | "view_type" | "status") => (
                    <Input
                      value={room[key]}
                      onChange={(e) => updateRoom({ [key]: e.target.value } as Partial<typeof room>)}
                    />
                  );
                  const boolField = (
                    key:
                      | "private_bathroom" | "bath" | "shower"
                      | "air_conditioning" | "wifi" | "tv" | "mini_fridge"
                      | "tea_coffee_maker" | "kettle" | "washing_machine"
                      | "soundproofing" | "terrace_or_balcony" | "patio"
                      | "smoking_allowed",
                    label: string
                  ) => (
                    <Checkbox
                      key={key}
                      checked={room[key]}
                      onChange={(e) => updateRoom({ [key]: e.target.checked } as Partial<typeof room>)}
                      label={label}
                    />
                  );
                  return (
                    <>
                      {/* Identity */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <FormField label={t("admin.crud.hotels.field.room_type")} htmlFor={`room-type-${ri}`}>
                          <Input
                            id={`room-type-${ri}`}
                            value={room.room_type}
                            onChange={(e) => updateRoom({ room_type: e.target.value })}
                            placeholder="standard / deluxe / suite"
                          />
                        </FormField>
                        <FormField label={t("admin.crud.hotels.field.room_name")} htmlFor={`room-name-${ri}`}>
                          <Input
                            id={`room-name-${ri}`}
                            value={room.room_name}
                            onChange={(e) => updateRoom({ room_name: e.target.value })}
                          />
                        </FormField>
                      </div>

                      {/* Capacity */}
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <FormField label={t("admin.crud.hotels.field.max_adults")} required>{numField("max_adults", 1)}</FormField>
                        <FormField label={t("admin.crud.hotels.field.max_children")}>{numField("max_children", 0)}</FormField>
                        <FormField label={t("admin.crud.hotels.field.max_total_guests")} required>{numField("max_total_guests", 1)}</FormField>
                      </div>

                      {/* Bed + Size */}
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <FormField label={t("admin.crud.hotels.field.bed_type")} htmlFor={`room-bed-type-${ri}`}>
                          <Input
                            id={`room-bed-type-${ri}`}
                            value={room.bed_type}
                            onChange={(e) => updateRoom({ bed_type: e.target.value })}
                            placeholder={t("admin.crud.hotels.bed_type_placeholder")}
                          />
                        </FormField>
                        <FormField label={t("admin.crud.hotels.field.bed_count")}>{numField("bed_count", 1)}</FormField>
                        <FormField label={t("admin.crud.hotels.field.room_size")}>{txtField("room_size")}</FormField>
                      </div>

                      {/* View + Inventory + Status */}
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <FormField label={t("admin.crud.hotels.field.room_view")}>{txtField("room_view")}</FormField>
                        <FormField label={t("admin.crud.hotels.field.view_type")} htmlFor={`room-view-type-${ri}`}>
                          <Input
                            id={`room-view-type-${ri}`}
                            value={room.view_type}
                            onChange={(e) => updateRoom({ view_type: e.target.value })}
                            placeholder={t("admin.crud.hotels.view_type_placeholder")}
                          />
                        </FormField>
                        <FormField label={t("admin.crud.hotels.field.inventory_count")}>{numField("room_inventory_count", 0)}</FormField>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <FormField label={t("admin.crud.common.status")} htmlFor={`room-status-${ri}`}>
                          <Input
                            id={`room-status-${ri}`}
                            value={room.status}
                            onChange={(e) => updateRoom({ status: e.target.value })}
                            placeholder={t("admin.crud.hotels.room_status_placeholder")}
                          />
                        </FormField>
                      </div>

                      {/* Bathroom */}
                      <div className="mt-4 border-t border-default pt-3">
                        <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.bathroom")}</span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {boolField("private_bathroom", t("admin.crud.hotels.amenity.private_bathroom"))}
                          {boolField("bath", t("admin.crud.hotels.amenity.bathtub"))}
                          {boolField("shower", t("admin.crud.hotels.amenity.shower"))}
                        </div>
                      </div>

                      {/* Amenities */}
                      <div className="mt-4 border-t border-default pt-3">
                        <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.in_room_amenities")}</span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {boolField("air_conditioning", t("admin.crud.hotels.amenity.air_conditioning"))}
                          {boolField("wifi", t("admin.crud.hotels.amenity.wifi"))}
                          {boolField("tv", t("admin.crud.hotels.amenity.tv"))}
                          {boolField("mini_fridge", t("admin.crud.hotels.amenity.mini_fridge"))}
                          {boolField("tea_coffee_maker", t("admin.crud.hotels.amenity.tea_coffee_maker"))}
                          {boolField("kettle", t("admin.crud.hotels.amenity.kettle"))}
                          {boolField("washing_machine", t("admin.crud.hotels.amenity.washing_machine"))}
                          {boolField("soundproofing", t("admin.crud.hotels.amenity.soundproofing"))}
                          {boolField("terrace_or_balcony", t("admin.crud.hotels.amenity.terrace_or_balcony"))}
                          {boolField("patio", t("admin.crud.hotels.amenity.patio"))}
                        </div>
                      </div>

                      {/* Policy */}
                      <div className="mt-4 border-t border-default pt-3">
                        <span className="text-xs font-semibold uppercase text-fg-t6">{t("admin.crud.hotels.section.policy")}</span>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {boolField("smoking_allowed", t("admin.crud.hotels.amenity.smoking_allowed"))}
                        </div>
                      </div>

                      {/* Images */}
                      <div className="mt-4 border-t border-default pt-3">
                        <FormField label={t("admin.crud.hotels.field.room_images")} htmlFor={`room-images-${ri}`}>
                          <Input
                            as="textarea"
                            id={`room-images-${ri}`}
                            rows={3}
                            value={room.room_images}
                            onChange={(e) => updateRoom({ room_images: e.target.value })}
                            placeholder={"https://example.com/room1.jpg\nhttps://example.com/room2.jpg"}
                            className="font-mono"
                          />
                        </FormField>
                      </div>
                    </>
                  );
                })()}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-default bg-white text-left text-fg-t6">
                        <th scope="col" className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.price")}</th>
                        <th scope="col" className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.currency")}</th>
                        <th scope="col" className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.pricing_mode")}</th>
                        <th scope="col" className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.valid_from")}</th>
                        <th scope="col" className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.valid_to")}</th>
                        <th scope="col" className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.min_nights")}</th>
                        <th scope="col" className="px-1 py-1.5 font-medium">{t("admin.crud.hotels.field.pricing_status")}</th>
                        <th scope="col" className="px-1 py-1.5" />
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
                                  const pricings = [...rooms[ri]!.pricings];
                                  pricings[pi] = { ...pricings[pi]!, price: e.target.value };
                                  rooms[ri] = { ...rooms[ri]!, pricings };
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
                                  const pricings = [...rooms[ri]!.pricings];
                                  pricings[pi] = {
                                    ...pricings[pi]!,
                                    currency: e.target.value.toUpperCase(),
                                  };
                                  rooms[ri] = { ...rooms[ri]!, pricings };
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
                                  const pricings = [...rooms[ri]!.pricings];
                                  pricings[pi] = { ...pricings[pi]!, pricing_mode: e.target.value };
                                  rooms[ri] = { ...rooms[ri]!, pricings };
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
                                  const pricings = [...rooms[ri]!.pricings];
                                  pricings[pi] = { ...pricings[pi]!, valid_from: e.target.value };
                                  rooms[ri] = { ...rooms[ri]!, pricings };
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
                                  const pricings = [...rooms[ri]!.pricings];
                                  pricings[pi] = { ...pricings[pi]!, valid_to: e.target.value };
                                  rooms[ri] = { ...rooms[ri]!, pricings };
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
                                  const pricings = [...rooms[ri]!.pricings];
                                  const v = e.target.value;
                                  pricings[pi] = {
                                    ...pricings[pi]!,
                                    min_nights: v === "" ? "" : Number(v),
                                  };
                                  rooms[ri] = { ...rooms[ri]!, pricings };
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
                                  const pricings = [...rooms[ri]!.pricings];
                                  pricings[pi] = { ...pricings[pi]!, status: e.target.value };
                                  rooms[ri] = { ...rooms[ri]!, pricings };
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
                                    const pricings = rooms[ri]!.pricings.filter((_, i) => i !== pi);
                                    rooms[ri] = { ...rooms[ri]!, pricings };
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
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setForm((p) => {
                        if (!p) return p;
                        const rooms = [...p.rooms];
                        rooms[ri] = {
                          ...rooms[ri]!,
                          pricings: [...rooms[ri]!.pricings, newHotelPricingFormRow()],
                        };
                        return { ...p, rooms };
                      })
                    }
                  >
                    {t("admin.crud.hotels.add_rate")}
                  </Button>
                </div>
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
          {editId !== null && (
            <div className="mt-6 rounded-zulu border border-default bg-figma-bg-1 p-3">
              <h3 className="mb-2 text-sm font-medium text-fg-t6">
                {t("admin.crud.hotels.translations_title")}{" "}
                <span className="text-fg-t7 font-normal">{t("admin.crud.hotels.translations_hint")}</span>
              </h3>
              <TranslationTabs
                entityType="hotel"
                entityId={editId}
                fields={[
                  { name: "hotel_name", label: t("admin.crud.hotels.field.hotel_name") },
                  { name: "short_description", label: t("admin.crud.hotels.field.short_description"), multiline: true },
                  { name: "full_address", label: t("admin.crud.hotels.field.full_address") },
                  { name: "district_or_area", label: t("admin.crud.hotels.field.district_or_area") },
                  { name: "review_label", label: t("admin.crud.hotels.field.review_label") },
                ]}
              />
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? t("admin.crud.common.saving") : t("common.save")}
            </Button>
            <Button variant="outline" size="sm" onClick={closeForm}>
              {t("common.cancel")}
            </Button>
          </div>
        </section>
      )}
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.crud.common.id")}</TH>
            <TH>{t("admin.crud.hotels.col.hotel")}</TH>
            <TH>{t("admin.crud.hotels.col.city")}</TH>
            <TH>{t("admin.crud.hotels.col.country")}</TH>
            <TH>{t("admin.crud.hotels.col.stars")}</TH>
            <TH>{t("admin.crud.common.status")}</TH>
            <TH>{t("admin.crud.common.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.crud.hotels.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD className="font-medium">{r.hotel_name ?? "-"}</TD>
              <TD>{r.city ?? "-"}</TD>
              <TD>{r.country ?? "-"}</TD>
              <TD>{formatHotelStarRatingDisplay(r.star_rating)}</TD>
              <TD>
                <OfferStatusBadge status={r.offer?.status ?? null} />
              </TD>
              <TD>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => void openEdit(r)}
                    className="text-left text-xs text-info-700 hover:underline"
                  >
                    {t("admin.crud.common.edit")}
                  </button>
                  {r.offer?.id && isSubmittableStatus(r.offer.status) && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void handleSubmitForReview(r.offer!.id!)}
                      className="self-start"
                    >
                      {t("admin.crud.common.submit_for_review")}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDelete(r.id)}
                    className="text-left text-xs text-error-600 hover:underline"
                  >
                    {t("admin.crud.common.delete")}
                  </button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
