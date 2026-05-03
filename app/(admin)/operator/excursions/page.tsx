"use client";

import { CsvImportModal } from "@/components/CsvImportModal";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { PaginationBar } from "@/components/PaginationBar";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useExcursionWizardStepper } from "@/hooks/useExcursionWizardStepper";
import { ApiRequestError } from "@/lib/api-client";
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
  const { t } = useLanguage();
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
  }, [token, page]);

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
        const companyId = Number(companies[0].id);
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
      company_id: cid != null && cid !== "" ? Number(cid) : "",
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
            company_id: cid != null && cid !== "" ? Number(cid) : "",
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
    if (!token || !window.confirm(t("admin.crud.excursions.delete_confirm"))) return;
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

  if (forbidden)
    return (
      <div>
        <h1 className="admin-page-title">{t("admin.crud.excursions.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );

  const isCreate = editId == null;
  const editRow = editId != null ? rows.find((x) => x.id === editId) : undefined;
  const fieldSummary = renderApiFieldErrors(fieldErrs ?? undefined);
  const fieldMsgs = (key: string) => (fieldErrs && Array.isArray(fieldErrs[key]) ? fieldErrs[key] : []);
  const inputClass = (key: string) =>
    `rounded border px-2 py-1.5 text-sm ${
      hasFieldErr(fieldErrs, key) ? "border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200" : "border-default"
    }`;

  function offerTitle(r: ExcursionRow): string {
    return r.offer?.title?.trim() || "";
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="admin-page-title">{t("admin.crud.excursions.title")}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => void openCreate()}
            disabled={busy}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-40"
          >
            {busy ? "Loading…" : t("admin.crud.excursions.new_btn")}
          </button>
        </div>
      </div>
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
      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      {formErr && !form && <p className="mt-2 text-sm text-error-600">{formErr}</p>}
      {form && (
        <div className="mt-4 rounded border border-default bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? t("admin.crud.excursions.form_edit") : t("admin.crud.excursions.form_new")}</h2>
          <nav className="mb-4 flex flex-wrap gap-1 text-xs sm:text-sm" aria-label="Steps">
            {STEP_TITLES.map((stepTitle, i) => {
              const n = i + 1;
              const active = step === n;
              return (
                <span
                  key={stepTitle}
                  className={`rounded px-2 py-1 ${active ? "bg-slate-800 text-white" : "bg-figma-bg-1 text-fg-t6"}`}
                >
                  {t(EXCURSION_STEP_LABEL_KEYS[i] ?? "")}
                </span>
              );
            })}
          </nav>
          {fieldSummary && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-error-800">
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
                    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                      <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.offer_id")}</span>
                      <select
                        value={form.offer_id === "" ? "" : String(form.offer_id)}
                        onChange={(e) => onOfferChange(e.target.value)}
                        className={inputClass("offer_id")}
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
                      </select>
                      {fieldMsgs("offer_id").map((m, i) => (
                        <span key={i} className="text-xs text-error-600">
                          {m}
                        </span>
                      ))}
                    </label>
                  )}
                  {!isCreate && (
                    <div className="text-sm sm:col-span-2">
                      <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.offer_id")} </span>
                      <span className="text-fg-t11">
                        {editRow && form.offer_id !== "" ? `#${form.offer_id} — ${offerTitle(editRow)}` : "—"}
                      </span>
                    </div>
                  )}
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.company_id")}</span>
                    <input
                      readOnly
                      value={form.company_id === "" ? "" : String(form.company_id)}
                      className="rounded border border-default bg-figma-bg-1 px-2 py-1.5 text-sm text-fg-t7"
                    />
                    {fieldMsgs("company_id").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.country")}</span>
                    <input
                      value={form.country}
                      onChange={(e) => setForm((p) => (p ? { ...p, country: e.target.value } : p))}
                      className={inputClass("country")}
                    />
                    {fieldMsgs("country").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.city")}</span>
                    <input
                      value={form.city}
                      onChange={(e) => setForm((p) => (p ? { ...p, city: e.target.value } : p))}
                      className={inputClass("city")}
                    />
                    {fieldMsgs("city").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
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
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.general_category")}</span>
                    <input
                      value={form.general_category}
                      onChange={(e) => setForm((p) => (p ? { ...p, general_category: e.target.value } : p))}
                      className={inputClass("general_category")}
                    />
                    {fieldMsgs("general_category").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.category")}</span>
                    <input
                      value={form.category}
                      onChange={(e) => setForm((p) => (p ? { ...p, category: e.target.value } : p))}
                      className={inputClass("category")}
                    />
                    {fieldMsgs("category").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.excursion_type")}</span>
                    <input
                      value={form.excursion_type}
                      onChange={(e) => setForm((p) => (p ? { ...p, excursion_type: e.target.value } : p))}
                      className={inputClass("excursion_type")}
                    />
                    {fieldMsgs("excursion_type").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-fg-t7">{t(EXCURSION_STEP_LABEL_KEYS[2] ?? "")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.tour_name")}</span>
                    <input
                      value={form.tour_name}
                      onChange={(e) => setForm((p) => (p ? { ...p, tour_name: e.target.value } : p))}
                      className={inputClass("tour_name")}
                    />
                    {fieldMsgs("tour_name").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.overview")}</span>
                    <textarea
                      rows={3}
                      value={form.overview}
                      onChange={(e) => setForm((p) => (p ? { ...p, overview: e.target.value } : p))}
                      className={inputClass("overview")}
                    />
                    {fieldMsgs("overview").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
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
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.duration")}</span>
                    <input
                      value={form.duration}
                      onChange={(e) => setForm((p) => (p ? { ...p, duration: e.target.value } : p))}
                      placeholder="e.g. 4h or Full day"
                      className={inputClass("duration")}
                    />
                    {fieldMsgs("duration").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.starts_at")}</span>
                    <input
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(e) => setForm((p) => (p ? { ...p, starts_at: e.target.value } : p))}
                      className={inputClass("starts_at")}
                    />
                    {fieldMsgs("starts_at").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.ends_at")}</span>
                    <input
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(e) => setForm((p) => (p ? { ...p, ends_at: e.target.value } : p))}
                      className={inputClass("ends_at")}
                    />
                    {fieldMsgs("ends_at").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.language")}</span>
                    <input
                      value={form.language}
                      onChange={(e) => setForm((p) => (p ? { ...p, language: e.target.value } : p))}
                      placeholder="e.g. en, hy"
                      className={inputClass("language")}
                    />
                    {fieldMsgs("language").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.group_size")}</span>
                    <input
                      type="number"
                      min={1}
                      value={form.group_size === "" ? "" : String(form.group_size)}
                      onChange={(e) =>
                        setForm((p) =>
                          p ? { ...p, group_size: e.target.value ? Number(e.target.value) : "" } : p
                        )
                      }
                      className={inputClass("group_size")}
                    />
                    {fieldMsgs("group_size").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.ticket_max_count")}</span>
                    <input
                      type="number"
                      min={1}
                      value={form.ticket_max_count === "" ? "" : String(form.ticket_max_count)}
                      onChange={(e) =>
                        setForm((p) =>
                          p ? { ...p, ticket_max_count: e.target.value ? Number(e.target.value) : "" } : p
                        )
                      }
                      className={inputClass("ticket_max_count")}
                    />
                    {fieldMsgs("ticket_max_count").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.status")}</span>
                    <input
                      value={form.status}
                      onChange={(e) => setForm((p) => (p ? { ...p, status: e.target.value } : p))}
                      placeholder="e.g. draft, published"
                      className={inputClass("status")}
                    />
                    {fieldMsgs("status").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.is_available}
                      onChange={(e) => setForm((p) => (p ? { ...p, is_available: e.target.checked } : p))}
                      className={hasFieldErr(fieldErrs, "is_available") ? "rounded border-red-400" : "rounded border-default"}
                    />
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.is_available")}</span>
                    {fieldMsgs("is_available").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.is_bookable}
                      onChange={(e) => setForm((p) => (p ? { ...p, is_bookable: e.target.checked } : p))}
                      className={hasFieldErr(fieldErrs, "is_bookable") ? "rounded border-red-400" : "rounded border-default"}
                    />
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.is_bookable")}</span>
                    {fieldMsgs("is_bookable").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
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
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.meeting_pickup")}</span>
                    <textarea
                      rows={2}
                      value={form.meeting_pickup}
                      onChange={(e) => setForm((p) => (p ? { ...p, meeting_pickup: e.target.value } : p))}
                      className={inputClass("meeting_pickup")}
                    />
                    {fieldMsgs("meeting_pickup").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.additional_info")}</span>
                    <textarea
                      rows={3}
                      value={form.additional_info}
                      onChange={(e) => setForm((p) => (p ? { ...p, additional_info: e.target.value } : p))}
                      className={inputClass("additional_info")}
                    />
                    {fieldMsgs("additional_info").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.cancellation_policy")}</span>
                    <textarea
                      rows={3}
                      value={form.cancellation_policy}
                      onChange={(e) => setForm((p) => (p ? { ...p, cancellation_policy: e.target.value } : p))}
                      className={inputClass("cancellation_policy")}
                    />
                    {fieldMsgs("cancellation_policy").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
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
                            next[i] = { ...next[i], date: e.target.value };
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
                            next[i] = { ...next[i], price: v === "" ? "" : Number(v) };
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
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.visibility_rule")}</span>
                    <select
                      value={form.visibility_rule}
                      onChange={(e) => setForm((p) => (p ? { ...p, visibility_rule: e.target.value } : p))}
                      className={inputClass("visibility_rule")}
                    >
                      <option value="show_all">show_all</option>
                      <option value="show_accepted_only">show_accepted_only</option>
                      <option value="hide_rejected">hide_rejected</option>
                    </select>
                    {fieldMsgs("visibility_rule").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.appears_in_web}
                      onChange={(e) => setForm((p) => (p ? { ...p, appears_in_web: e.target.checked } : p))}
                    />
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.appears_in_web")}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.appears_in_admin}
                      onChange={(e) => setForm((p) => (p ? { ...p, appears_in_admin: e.target.checked } : p))}
                    />
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.appears_in_admin")}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.appears_in_zulu_admin}
                      onChange={(e) => setForm((p) => (p ? { ...p, appears_in_zulu_admin: e.target.checked } : p))}
                    />
                    <span className="font-medium text-fg-t6">{t("admin.crud.excursions.field.appears_in_zulu_admin")}</span>
                  </label>
                </div>
              </div>
            )}
          </div>
          {formErr && <p className="mt-2 text-sm text-error-600">{formErr}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {step > 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setFieldErrs(null);
                  setFormErr(null);
                  goPrevious();
                }}
                className="rounded border border-default px-4 py-1.5 text-sm"
              >
                {t("common.prev")}
              </button>
            )}
            {step < 5 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onTryNext()}
                className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {t("common.next")}
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit()}
                className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {busy ? t("admin.crud.common.saving") : t("common.save")}
              </button>
            )}
            <button type="button" onClick={closeForm} className="rounded border border-default px-4 py-1.5 text-sm">
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
              <th className="px-3 py-2">{t("admin.crud.excursions.col.title")}</th>
              <th className="px-3 py-2">{t("admin.crud.excursions.col.location")}</th>
              <th className="px-3 py-2">{t("admin.crud.excursions.col.duration")}</th>
              <th className="px-3 py-2">{t("admin.crud.excursions.col.group")}</th>
              <th className="px-3 py-2">{t("admin.crud.excursions.col.price")}</th>
              <th className="px-3 py-2">{t("admin.crud.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.crud.excursions.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                <td className="px-3 py-2 font-medium">{offerTitle(r) || "-"}</td>
                <td className="px-3 py-2">{r.location ?? "-"}</td>
                <td className="px-3 py-2">{r.duration ?? "-"}</td>
                <td className="px-3 py-2 tabular-nums">{r.group_size != null ? r.group_size : "-"}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.offer?.price != null ? `${r.offer.currency ?? ""} ${Number(r.offer.price).toFixed(2)}` : "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(r)} className="text-xs text-info-700 underline">
                      {t("admin.crud.common.edit")}
                    </button>
                    <button type="button" onClick={() => void handleDelete(r.id)} className="text-xs text-error-600 underline">
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
