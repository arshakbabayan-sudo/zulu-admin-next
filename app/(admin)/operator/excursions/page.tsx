"use client";

/** Phase-2 migration to shared @/components/ui primitives. */

import { ContentLanguagePill } from "@/components/ContentLanguagePill";
import { CsvImportModal } from "@/components/CsvImportModal";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { OfferStatusBadge, isSubmittableStatus } from "@/components/OfferStatusBadge";
import { PaginationBar } from "@/components/PaginationBar";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { MainImageDescriptionFields } from "@/components/MainImageDescriptionFields";
import { LatLngFields } from "@/components/LatLngFields";
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
import { useExcursionWizardStepper } from "@/hooks/useExcursionWizardStepper";
import { ApiRequestError } from "@/lib/api-client";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  coreWritePayloadFromWizard,
  derivedLocationFromWizard,
  excursionWizardFromRow,
  emptyExcursionWizardTail,
  validateExcursionWizardFull,
  expandedPayloadFromWizard,
  type ExcursionWizardState,
  type FieldErrors,
} from "@/lib/excursions/excursion-wizard-state";
import {
  apiCompaniesList,
  apiCreateOffer,
  apiExcursions,
  apiCreateExcursion,
  apiUpdateExcursion,
  apiDeleteExcursion,
  apiOffers,
  type ExcursionRow,
  type OfferRow,
} from "@/lib/inventory-crud-api";
import {
  csvExportFilename,
  downloadCsvFile,
  excursionTemplateCsv,
  exportExcursionsCsv,
  runExcursionCsvImport,
} from "@/lib/csv-import-export";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useRef, useState } from "react";

const EXCURSION_FIELD_LABELS: Record<string, string> = {
  "": "Form",
  offer_id: "Offer",
  company_id: "Company",
  location: "Location",
  country: "Country",
  city: "City",
  general_category: "General category",
  category: "Category",
  excursion_type: "Excursion type",
  tour_name: "Tour name",
  overview: "Overview",
  duration: "Duration",
  starts_at: "Start time",
  ends_at: "End time",
  language: "Language",
  group_size: "Group size",
  ticket_max_count: "Max tickets",
  status: "Status",
  is_available: "Available",
  is_bookable: "Bookable",
  meeting_pickup: "Meeting / pickup",
  additional_info: "Additional info",
  cancellation_policy: "Cancellation policy",
  includes: "Includes",
  photos: "Photos",
  price_by_dates: "Price by dates",
  visibility_rule: "Visibility rule",
  appears_in_web: "Show on web",
  appears_in_admin: "Show in operator admin",
  appears_in_zulu_admin: "Show in Zulu admin inventory",
};

function labelForField(field: string): string {
  return EXCURSION_FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

function renderApiFieldErrors(
  errors: FieldErrors | undefined
): { title: string; items: { field: string; label: string; msg: string }[] } | null {
  if (!errors) return null;
  const items: { field: string; label: string; msg: string }[] = [];
  for (const [field, msgs] of Object.entries(errors)) {
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    for (const m of msgs) {
      const t = String(m ?? "").trim();
      if (t) items.push({ field, label: labelForField(field), msg: t });
    }
  }
  if (items.length === 0) return null;
  return { title: "Please fix the highlighted fields.", items };
}

function hasFieldErr(fieldErrs: FieldErrors | null, key: string): boolean {
  if (!fieldErrs) return false;
  if (fieldErrs[key]?.length) return true;
  const prefix = `${key}.`;
  return Object.keys(fieldErrs).some((k) => k === key || k.startsWith(prefix));
}

const STEP_TITLES = [
  "1. Country / city",
  "2. Categories / type",
  "3. Tour info, schedule & capacity",
  "4. Includes & policies",
  "5. Price by dates & visibility",
];

const EXCURSION_STEP_LABEL_KEYS: Record<number, string> = {
  0: "admin.crud.excursions.step.location",
  1: "admin.crud.excursions.step.categories",
  2: "admin.crud.excursions.step.tour_info",
  3: "admin.crud.excursions.step.policies",
  4: "admin.crud.excursions.step.pricing",
};

export default function OperatorExcursionsPage() {
  const { token } = useAdminAuth();
  const { t, contentLang } = useLanguage();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ExcursionRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<ExcursionWizardState | null>(null);
  const [excursionOffers, setExcursionOffers] = useState<OfferRow[] | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors | null>(null);
  const offersCache = useRef<OfferRow[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const { step, resetToFirstStep, goPrevious, tryAdvance } = useExcursionWizardStepper();

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiExcursions(token, { page, per_page: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page, contentLang]);

  useEffect(() => {
    void load();
  }, [load]);

  const ensureOffersLoaded = useCallback(async (): Promise<OfferRow[]> => {
    if (offersCache.current !== null) return offersCache.current;
    if (!token) return [];
    const res = await apiOffers(token, { type: "excursion" });
    offersCache.current = res.data ?? [];
    return offersCache.current;
  }, [token]);

  async function openCreate() {
    setBusy(true);
    setFormErr(null);
    setFieldErrs(null);
    let loadedOffers: OfferRow[] = [];
    try {
      loadedOffers = await ensureOffersLoaded();
      if (loadedOffers.length === 0 && token) {
        const companiesRes = await apiCompaniesList(token);
        const companies = companiesRes.data ?? [];
        if (companies.length === 0) {
          setForm(null);
          setEditId(null);
          setExcursionOffers(null);
          setFormErr(t("admin.crud.excursions.err.no_companies"));
          setBusy(false);
          return;
        }
        const companyId = Number(companies[0]!.id);
        await apiCreateOffer(token, {
          company_id: companyId,
          type: "excursion",
          title: `Excursion draft ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
          price: 0,
          currency: "USD",
        });
        offersCache.current = null;
        loadedOffers = await ensureOffersLoaded();
      }
    } catch (e) {
      setBusy(false);
      setForm(null);
      setEditId(null);
      setExcursionOffers(null);
      setFormErr(
        e instanceof ApiRequestError ? e.message || "Could not open the form (offers / companies)." : "Could not open the form."
      );
      return;
    }

    const usedOfferIds = new Set<number>();
    for (const r of rows) {
      if (r.offer_id != null) usedOfferIds.add(Number(r.offer_id));
    }
    const available = loadedOffers.find((o) => !usedOfferIds.has(o.id));

    if (!available) {
      setForm(null);
      setEditId(null);
      setExcursionOffers(null);
      if (loadedOffers.length === 0) {
        setFormErr("Could not create or find an excursion offer. Check API access (offers.create) or try again.");
      } else {
        setFormErr(
          "Every excursion offer already has details linked (one excursion per offer). Create another excursion offer or delete an existing excursion to reuse its offer."
        );
      }
      setBusy(false);
      return;
    }

    const cid = available.company_id;
    setEditId(null);
    setExcursionOffers(loadedOffers);
    setForm({
      offer_id: available.id,
      company_id: cid != null ? Number(cid) : "",
      ...emptyExcursionWizardTail(),
    });
    resetToFirstStep();
    setFormErr(null);
    setBusy(false);
  }

  function openEdit(r: ExcursionRow) {
    setEditId(r.id);
    setExcursionOffers(null);
    setForm(excursionWizardFromRow(r));
    setFormErr(null);
    setFieldErrs(null);
    resetToFirstStep();
  }

  function closeForm() {
    setForm(null);
    setEditId(null);
    setFormErr(null);
    setFieldErrs(null);
    setExcursionOffers(null);
    resetToFirstStep();
  }

  function onOfferChange(offerIdStr: string) {
    if (offerIdStr === "") {
      setForm((p) => (p ? { ...p, offer_id: "", company_id: "" } : p));
      return;
    }
    const oid = Number(offerIdStr);
    const list = excursionOffers ?? offersCache.current ?? [];
    const o = list.find((x) => x.id === oid);
    const cid = o?.company_id;
    setForm((p) =>
      p
        ? {
            ...p,
            offer_id: oid,
            company_id: cid != null ? Number(cid) : "",
          }
        : p
    );
  }

  function onTryNext() {
    if (!form) return;
    const r = tryAdvance(form, editId == null);
    if (!r.ok) {
      setFieldErrs(r.errors);
      setFormErr("Fix validation errors below.");
      return;
    }
    setFieldErrs(null);
    setFormErr(null);
  }

  async function handleSubmit() {
    if (!token || !form) return;
    setFormErr(null);
    setFieldErrs(null);
    const isCreate = editId == null;
    const local = validateExcursionWizardFull(form, isCreate);
    if (local) {
      setFieldErrs(local);
      setFormErr("Fix validation errors below.");
      return;
    }
    setBusy(true);
    try {
      const core = coreWritePayloadFromWizard(form);
      const expanded = expandedPayloadFromWizard(form);
      if (editId != null) {
        await apiUpdateExcursion(token, editId, {
          ...core,
          ...expanded,
        });
      } else {
        await apiCreateExcursion(token, {
          offer_id: Number(form.offer_id),
          company_id: Number(form.company_id),
          ...core,
          ...expanded,
        });
      }
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
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.excursions.delete_confirm", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteExcursion(token, id);
      offersCache.current = null;
      await load();
    } catch (e) {
      alert(e instanceof ApiRequestError ? e.message : "Failed");
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
      alert(e instanceof ApiRequestError ? e.message : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  if (forbidden)
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.crud.excursions.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );

  const isCreate = editId == null;
  const editRow = editId != null ? rows.find((x) => x.id === editId) : undefined;
  const fieldSummary = renderApiFieldErrors(fieldErrs ?? undefined);
  const fieldMsgs = (key: string) => (fieldErrs && Array.isArray(fieldErrs[key]) ? fieldErrs[key] : []);
  const fieldError = (key: string): string | null => {
    const msgs = fieldMsgs(key);
    return msgs.length > 0 ? msgs.join(" ") : null;
  };
  /** Used only by the dynamic-list compact inputs (photos / includes / price_by_dates). Static fields use FormField. */
  const inputClass = (key: string) =>
    `rounded border px-2 py-1.5 text-sm ${
      hasFieldErr(fieldErrs, key) ? "border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200" : "border-default"
    }`;

  function offerTitle(r: ExcursionRow): string {
    return r.offer?.title?.trim() || "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {t("admin.crud.excursions.title")}
            {form === null && <ContentLanguagePill />}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ImportExportButtons
              busy={busy || exportBusy}
              exportDisabled={!token}
              onTemplate={() => downloadCsvFile("excursions-template.csv", excursionTemplateCsv())}
              onExport={async () => {
                if (!token) return;
                setExportBusy(true);
                try {
                  const csv = await exportExcursionsCsv(token);
                  downloadCsvFile(csvExportFilename("excursions"), csv);
                } catch (e) {
                  alert(e instanceof ApiRequestError ? e.message : "Export failed");
                } finally {
                  setExportBusy(false);
                }
              }}
              onImport={() => setImportOpen(true)}
            />
            <Button size="sm" disabled={busy} onClick={() => void openCreate()}>
              {busy ? "Loading…" : t("admin.crud.excursions.new_btn")}
            </Button>
          </div>
        }
      />
      <CsvImportModal
        open={importOpen}
        title={t("admin.crud.excursions.import_title")}
        onClose={() => setImportOpen(false)}
        onRun={async (rows, rowLineNumbers) => {
          if (!token) {
            return {
              success: 0,
              failed: rows.length,
              errors: [{ rowNumber: rowLineNumbers[0] ?? 2, message: "Not signed in." }],
            };
          }
          const res = await runExcursionCsvImport(token, rows, rowLineNumbers);
          if (res.success > 0) await load();
          return res;
        }}
      />
      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}
      {formErr && !form && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{formErr}</div>
      )}
      {form && (
        <section className="admin-card p-4">
          <h2 className="mb-3 text-base font-semibold">{editId ? t("admin.crud.excursions.form_edit") : t("admin.crud.excursions.form_new")}</h2>
          <nav className="mb-4 flex flex-wrap gap-1 text-xs sm:text-sm" aria-label="Steps">
            {STEP_TITLES.map((stepTitle, i) => {
              const n = i + 1;
              const active = step === n;
              return (
                <span
                  key={stepTitle}
                  className={`rounded-md px-3 py-1.5 ${active ? "bg-primary-500 text-white" : "bg-figma-bg-1 text-fg-t6"}`}
                >
                  {t(EXCURSION_STEP_LABEL_KEYS[i] ?? "")}
                </span>
              );
            })}
          </nav>
          {fieldSummary && (
            <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">
              <div className="font-medium">{fieldSummary.title}</div>
              <ul className="mt-1 list-disc pl-5">
                {fieldSummary.items.slice(0, 20).map((it, idx) => (
                  <li key={`${it.field}-${idx}`}>
                    <span className="font-medium">{it.label}</span>: {it.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-4">
            {step === 1 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-fg-t7">{t(EXCURSION_STEP_LABEL_KEYS[0] ?? "")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MainImageDescriptionFields
                    mainImage={form.main_image}
                    shortDescription={form.short_description}
                    onMainImageChange={(v) => setForm((p) => p ? { ...p, main_image: v } : p)}
                    onShortDescriptionChange={(v) => setForm((p) => p ? { ...p, short_description: v } : p)}
                    section="excursions"
                    altText="Excursion preview"
                  />
                  <LatLngFields
                    latitude={form.latitude}
                    longitude={form.longitude}
                    onLatitudeChange={(v) => setForm((p) => p ? { ...p, latitude: v } : p)}
                    onLongitudeChange={(v) => setForm((p) => p ? { ...p, longitude: v } : p)}
                  />
                  <LocationCascadeSelect
                    token={token}
                    value={form.location_id === "" || form.location_id == null ? null : Number(form.location_id)}
                    label="Location (Country -> Region -> City)"
                    onChange={(locationId, meta) =>
                      setForm((p) =>
                        p
                          ? {
                              ...p,
                              location_id: locationId ?? "",
                              country: meta.country?.name ?? p.country,
                              city: meta.city?.name ?? meta.region?.name ?? p.city,
                            }
                          : p
                      )
                    }
                  />
                  {isCreate && excursionOffers && (
                    <FormField
                      label={t("admin.crud.excursions.field.offer_id")}
                      htmlFor="exc-offer-id"
                      error={fieldError("offer_id")}
                      className="sm:col-span-2"
                    >
                      <Select
                        id="exc-offer-id"
                        value={form.offer_id === "" ? "" : String(form.offer_id)}
                        onChange={(e) => onOfferChange(e.target.value)}
                      >
                        {excursionOffers.map((o) => {
                          const used = rows.some((r) => r.offer_id === o.id);
                          return (
                            <option key={o.id} value={o.id} disabled={used && o.id !== form.offer_id}>
                              #{o.id} — {o.title}
                              {used && o.id !== form.offer_id ? " (already has an excursion)" : ""}
                            </option>
                          );
                        })}
                      </Select>
                    </FormField>
                  )}
                  {!isCreate && (
                    <div className="text-sm sm:col-span-2">
                      <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.offer_id")} </span>
                      <span className="text-fg-t11">
                        {editRow && form.offer_id !== "" ? `#${form.offer_id} — ${offerTitle(editRow)}` : "—"}
                      </span>
                    </div>
                  )}
                  <FormField
                    label={t("admin.crud.excursions.field.company_id")}
                    htmlFor="exc-company-id"
                    error={fieldError("company_id")}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="exc-company-id"
                      readOnly
                      value={form.company_id === "" ? "" : String(form.company_id)}
                      className="bg-figma-bg-1 text-fg-t7"
                    />
                  </FormField>
                  {/* Country/city auto-filled from the LocationCascadeSelect above. */}
                  <p className="text-xs text-fg-t6 sm:col-span-2">
                    Listing location sent to API: <span className="font-mono text-fg-t7">{derivedLocationFromWizard(form)}</span>
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-fg-t7">{t(EXCURSION_STEP_LABEL_KEYS[1] ?? "")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label={t("admin.crud.excursions.field.general_category")}
                    htmlFor="exc-general-category"
                    error={fieldError("general_category")}
                  >
                    <Input
                      id="exc-general-category"
                      value={form.general_category}
                      onChange={(e) => setForm((p) => (p ? { ...p, general_category: e.target.value } : p))}
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.category")}
                    htmlFor="exc-category"
                    error={fieldError("category")}
                  >
                    <Input
                      id="exc-category"
                      value={form.category}
                      onChange={(e) => setForm((p) => (p ? { ...p, category: e.target.value } : p))}
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.excursion_type")}
                    htmlFor="exc-excursion-type"
                    error={fieldError("excursion_type")}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="exc-excursion-type"
                      value={form.excursion_type}
                      onChange={(e) => setForm((p) => (p ? { ...p, excursion_type: e.target.value } : p))}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-fg-t7">{t(EXCURSION_STEP_LABEL_KEYS[2] ?? "")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label={t("admin.crud.excursions.field.tour_name")}
                    htmlFor="exc-tour-name"
                    error={fieldError("tour_name")}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="exc-tour-name"
                      value={form.tour_name}
                      onChange={(e) => setForm((p) => (p ? { ...p, tour_name: e.target.value } : p))}
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.overview")}
                    htmlFor="exc-overview"
                    error={fieldError("overview")}
                    className="sm:col-span-2"
                  >
                    <Input
                      as="textarea"
                      id="exc-overview"
                      rows={3}
                      value={form.overview}
                      onChange={(e) => setForm((p) => (p ? { ...p, overview: e.target.value } : p))}
                    />
                  </FormField>
                  <div className="sm:col-span-2">
                    <span className="font-medium text-fg-t6 text-sm">{t("admin.crud.excursions.field.photos")}</span>
                    <div className="mt-1 space-y-2">
                      {form.photos.map((url, i) => (
                        <div key={i} className="flex flex-wrap gap-2">
                          <input
                            value={url}
                            onChange={(e) =>
                              setForm((p) => {
                                if (!p) return p;
                                const next = [...p.photos];
                                next[i] = e.target.value;
                                return { ...p, photos: next };
                              })
                            }
                            placeholder="https://…"
                            className={inputClass(`photos.${i}`)}
                          />
                          <button
                            type="button"
                            className="rounded border border-default px-2 py-1 text-xs"
                            onClick={() =>
                              setForm((p) => {
                                if (!p) return p;
                                const next = p.photos.filter((_, j) => j !== i);
                                return { ...p, photos: next };
                              })
                            }
                          >
                            Remove
                          </button>
                          {fieldMsgs(`photos.${i}`).map((m, j) => (
                            <span key={j} className="w-full text-xs text-error-600">
                              {m}
                            </span>
                          ))}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="rounded border border-default px-2 py-1 text-xs"
                        onClick={() => setForm((p) => (p ? { ...p, photos: [...p.photos, ""] } : p))}
                      >
                        + Add photo URL
                      </button>
                    </div>
                  </div>
                  <FormField
                    label={t("admin.crud.excursions.field.duration")}
                    htmlFor="exc-duration"
                    error={fieldError("duration")}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="exc-duration"
                      value={form.duration}
                      onChange={(e) => setForm((p) => (p ? { ...p, duration: e.target.value } : p))}
                      placeholder="e.g. 4h or Full day"
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.starts_at")}
                    htmlFor="exc-starts-at"
                    error={fieldError("starts_at")}
                  >
                    <Input
                      id="exc-starts-at"
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(e) => setForm((p) => (p ? { ...p, starts_at: e.target.value } : p))}
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.ends_at")}
                    htmlFor="exc-ends-at"
                    error={fieldError("ends_at")}
                  >
                    <Input
                      id="exc-ends-at"
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(e) => setForm((p) => (p ? { ...p, ends_at: e.target.value } : p))}
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.language")}
                    htmlFor="exc-language"
                    error={fieldError("language")}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="exc-language"
                      value={form.language}
                      onChange={(e) => setForm((p) => (p ? { ...p, language: e.target.value } : p))}
                      placeholder="e.g. en, hy"
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.group_size")}
                    htmlFor="exc-group-size"
                    error={fieldError("group_size")}
                  >
                    <Input
                      id="exc-group-size"
                      type="number"
                      min={1}
                      value={form.group_size === "" ? "" : String(form.group_size)}
                      onChange={(e) =>
                        setForm((p) =>
                          p ? { ...p, group_size: e.target.value ? Number(e.target.value) : "" } : p
                        )
                      }
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.ticket_max_count")}
                    htmlFor="exc-ticket-max-count"
                    error={fieldError("ticket_max_count")}
                  >
                    <Input
                      id="exc-ticket-max-count"
                      type="number"
                      min={1}
                      value={form.ticket_max_count === "" ? "" : String(form.ticket_max_count)}
                      onChange={(e) =>
                        setForm((p) =>
                          p ? { ...p, ticket_max_count: e.target.value ? Number(e.target.value) : "" } : p
                        )
                      }
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.status")}
                    htmlFor="exc-status"
                    error={fieldError("status")}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="exc-status"
                      value={form.status}
                      onChange={(e) => setForm((p) => (p ? { ...p, status: e.target.value } : p))}
                      placeholder="e.g. draft, published"
                    />
                  </FormField>
                  <div className="sm:col-span-2 flex flex-col gap-2">
                    <Checkbox
                      checked={form.is_available}
                      onChange={(e) => setForm((p) => (p ? { ...p, is_available: e.target.checked } : p))}
                      label={t("admin.crud.excursions.field.is_available")}
                    />
                    {fieldMsgs("is_available").map((m, i) => (
                      <span key={i} className="text-xs text-error-700">{m}</span>
                    ))}
                    <Checkbox
                      checked={form.is_bookable}
                      onChange={(e) => setForm((p) => (p ? { ...p, is_bookable: e.target.checked } : p))}
                      label={t("admin.crud.excursions.field.is_bookable")}
                    />
                    {fieldMsgs("is_bookable").map((m, i) => (
                      <span key={i} className="text-xs text-error-700">{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-fg-t7">{t(EXCURSION_STEP_LABEL_KEYS[3] ?? "")}</h3>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-fg-t6 text-sm">{t("admin.crud.excursions.field.includes")}</span>
                    <div className="mt-1 space-y-2">
                      {form.includes.map((line, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={line}
                            onChange={(e) =>
                              setForm((p) => {
                                if (!p) return p;
                                const next = [...p.includes];
                                next[i] = e.target.value;
                                return { ...p, includes: next };
                              })
                            }
                            className={`${inputClass("includes")} flex-1`}
                          />
                          <button
                            type="button"
                            className="rounded border border-default px-2 py-1 text-xs"
                            onClick={() =>
                              setForm((p) => {
                                if (!p) return p;
                                return { ...p, includes: p.includes.filter((_, j) => j !== i) };
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="rounded border border-default px-2 py-1 text-xs"
                        onClick={() => setForm((p) => (p ? { ...p, includes: [...p.includes, ""] } : p))}
                      >
                        + Add line
                      </button>
                    </div>
                  </div>
                  <FormField
                    label={t("admin.crud.excursions.field.meeting_pickup")}
                    htmlFor="exc-meeting-pickup"
                    error={fieldError("meeting_pickup")}
                  >
                    <Input
                      as="textarea"
                      id="exc-meeting-pickup"
                      rows={2}
                      value={form.meeting_pickup}
                      onChange={(e) => setForm((p) => (p ? { ...p, meeting_pickup: e.target.value } : p))}
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.additional_info")}
                    htmlFor="exc-additional-info"
                    error={fieldError("additional_info")}
                  >
                    <Input
                      as="textarea"
                      id="exc-additional-info"
                      rows={3}
                      value={form.additional_info}
                      onChange={(e) => setForm((p) => (p ? { ...p, additional_info: e.target.value } : p))}
                    />
                  </FormField>
                  <FormField
                    label={t("admin.crud.excursions.field.cancellation_policy")}
                    htmlFor="exc-cancellation-policy"
                    error={fieldError("cancellation_policy")}
                  >
                    <Input
                      as="textarea"
                      id="exc-cancellation-policy"
                      rows={3}
                      value={form.cancellation_policy}
                      onChange={(e) => setForm((p) => (p ? { ...p, cancellation_policy: e.target.value } : p))}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {step === 5 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-fg-t7">{t(EXCURSION_STEP_LABEL_KEYS[4] ?? "")}</h3>
                <p className="mb-2 text-xs text-fg-t6">
                  Optional per-date prices (YYYY-MM-DD). Commercial list price remains on the linked offer; these rules extend the excursion contract for dated pricing.
                </p>
                <div className="space-y-2">
                  {form.price_by_dates.map((row, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) =>
                          setForm((p) => {
                            if (!p) return p;
                            const next = [...p.price_by_dates];
                            next[i] = { ...next[i]!, date: e.target.value };
                            return { ...p, price_by_dates: next };
                          })
                        }
                        className={inputClass(`price_by_dates.${i}.date`)}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.price === "" ? "" : String(row.price)}
                        onChange={(e) =>
                          setForm((p) => {
                            if (!p) return p;
                            const next = [...p.price_by_dates];
                            const v = e.target.value;
                            next[i] = { ...next[i]!, price: v === "" ? "" : Number(v) };
                            return { ...p, price_by_dates: next };
                          })
                        }
                        placeholder="Price"
                        className={`${inputClass(`price_by_dates.${i}.price`)} w-28`}
                      />
                      <button
                        type="button"
                        className="rounded border border-default px-2 py-1 text-xs"
                        onClick={() =>
                          setForm((p) => {
                            if (!p) return p;
                            return { ...p, price_by_dates: p.price_by_dates.filter((_, j) => j !== i) };
                          })
                        }
                      >
                        Remove
                      </button>
                      {fieldMsgs(`price_by_dates.${i}`).map((m, j) => (
                        <span key={j} className="w-full text-xs text-error-600">
                          {m}
                        </span>
                      ))}
                      {fieldMsgs(`price_by_dates.${i}.date`).map((m, j) => (
                        <span key={j} className="w-full text-xs text-error-600">
                          {m}
                        </span>
                      ))}
                      {fieldMsgs(`price_by_dates.${i}.price`).map((m, j) => (
                        <span key={j} className="w-full text-xs text-error-600">
                          {m}
                        </span>
                      ))}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rounded border border-default px-2 py-1 text-xs"
                    onClick={() =>
                      setForm((p) =>
                        p ? { ...p, price_by_dates: [...p.price_by_dates, { date: "", price: "" }] } : p
                      )
                    }
                  >
                    + Add date / price
                  </button>
                </div>
                <div className="mt-6 space-y-3 border-t border-default pt-4">
                  <h4 className="text-sm font-semibold text-fg-t7">Visibility &amp; distribution</h4>
                  <p className="text-xs text-fg-t6">
                    When the platform enables excursion visibility controls, web catalog and admin lists respect these rules
                    (rollout via <code className="rounded bg-figma-bg-1 px-1">excursion_visibility_controls_enabled</code>).
                  </p>
                  <FormField
                    label={t("admin.crud.excursions.field.visibility_rule")}
                    htmlFor="exc-visibility-rule"
                    error={fieldError("visibility_rule")}
                  >
                    <Select
                      id="exc-visibility-rule"
                      value={form.visibility_rule}
                      onChange={(e) => setForm((p) => (p ? { ...p, visibility_rule: e.target.value } : p))}
                    >
                      <option value="show_all">show_all</option>
                      <option value="show_accepted_only">show_accepted_only</option>
                      <option value="hide_rejected">hide_rejected</option>
                    </Select>
                  </FormField>
                  <Checkbox
                    checked={form.appears_in_web}
                    onChange={(e) => setForm((p) => (p ? { ...p, appears_in_web: e.target.checked } : p))}
                    label={t("admin.crud.excursions.field.appears_in_web")}
                  />
                  <Checkbox
                    checked={form.appears_in_admin}
                    onChange={(e) => setForm((p) => (p ? { ...p, appears_in_admin: e.target.checked } : p))}
                    label={t("admin.crud.excursions.field.appears_in_admin")}
                  />
                  <Checkbox
                    checked={form.appears_in_zulu_admin}
                    onChange={(e) => setForm((p) => (p ? { ...p, appears_in_zulu_admin: e.target.checked } : p))}
                    label={t("admin.crud.excursions.field.appears_in_zulu_admin")}
                  />
                </div>
              </div>
            )}
          </div>
          {formErr && <p className="mt-2 text-sm text-error-700">{formErr}</p>}
          {editId !== null && (
            <div className="mt-6 rounded-zulu border border-default bg-figma-bg-1 p-3">
              <h3 className="mb-2 text-sm font-medium text-fg-t6">
                Translations <span className="text-fg-t7 font-normal">(EN-ից բացի՝ RU / HY)</span>
              </h3>
              <TranslationTabs
                entityType="excursion"
                entityId={editId}
                fields={[
                  { name: "title", label: "Title" },
                  { name: "description", label: "Description", multiline: true },
                  { name: "highlights", label: "Highlights", multiline: true },
                ]}
              />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setFieldErrs(null);
                  setFormErr(null);
                  goPrevious();
                }}
              >
                {t("common.prev")}
              </Button>
            )}
            {step < 5 && (
              <Button size="sm" disabled={busy} onClick={() => onTryNext()}>
                {t("common.next")}
              </Button>
            )}
            {step === 5 && (
              <Button size="sm" disabled={busy} onClick={() => void handleSubmit()}>
                {busy ? t("admin.crud.common.saving") : t("common.save")}
              </Button>
            )}
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
            <TH>{t("admin.crud.excursions.col.title")}</TH>
            <TH>{t("admin.crud.excursions.col.location")}</TH>
            <TH>{t("admin.crud.excursions.col.duration")}</TH>
            <TH>{t("admin.crud.excursions.col.group")}</TH>
            <TH>{t("admin.crud.excursions.col.price")}</TH>
            <TH>Status</TH>
            <TH>{t("admin.crud.common.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={8}>{t("admin.crud.excursions.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD className="font-medium">{offerTitle(r) || "-"}</TD>
              <TD>{r.location ?? "-"}</TD>
              <TD>{r.duration ?? "-"}</TD>
              <TD className="tabular-nums">{r.group_size != null ? r.group_size : "-"}</TD>
              <TD className="tabular-nums">
                {r.offer?.price != null ? `${r.offer.currency ?? ""} ${Number(r.offer.price).toFixed(2)}` : "-"}
              </TD>
              <TD>
                <OfferStatusBadge status={r.offer?.status ?? null} />
              </TD>
              <TD>
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => openEdit(r)} className="text-left text-xs text-info-700 hover:underline">
                    {t("admin.crud.common.edit")}
                  </button>
                  {r.offer?.id && isSubmittableStatus(r.offer.status) && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => void handleSubmitForReview(r.offer!.id!)}
                      className="self-start"
                    >
                      Submit for review
                    </Button>
                  )}
                  <button type="button" onClick={() => void handleDelete(r.id)} className="text-left text-xs text-error-600 hover:underline">
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
