"use client";

import { CsvImportModal } from "@/components/CsvImportModal";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { PaginationBar } from "@/components/PaginationBar";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ApiRequestError } from "@/lib/api-client";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  csvExportFilename,
  downloadCsvFile,
  fetchAllListPages,
  formatImportApiError,
  stringifyCsv,
  type ImportRowError,
  type ImportRunResult,
} from "@/lib/csv-import-export";
import {
  apiVisas,
  apiGetVisa,
  apiCreateVisa,
  apiUpdateVisa,
  apiDeleteVisa,
  type VisaRow,
  type VisaPayload,
} from "@/lib/inventory-crud-api";
import {
  requiredDocumentsArrayFromText,
  requiredDocumentsLinesFromApi,
  visaMoneyCell,
  visaNumberFromApi,
  visaOfferStatusLabel,
} from "@/lib/visa-ui";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCallback, useEffect, useMemo, useState } from "react";

function visaFormFromApiRow(r: VisaRow): VisaPayload {
  const vp = r.visa_price;
  const hasVisaPrice = vp != null && Number.isFinite(Number(vp));
  const visaPrice = hasVisaPrice ? visaNumberFromApi(vp) : visaNumberFromApi(r.price);
  return {
    country: r.country ?? "",
    location_id:
      r.location_id != null && Number.isFinite(Number(r.location_id)) ? Number(r.location_id) : "",
    country_id:
      r.country_id != null && Number.isFinite(Number(r.country_id)) ? Number(r.country_id) : "",
    visa_type: r.visa_type ?? "",
    name: (r.name ?? "").trim(),
    description: (r.description ?? "").trim(),
    required_documents_text: requiredDocumentsLinesFromApi(r.required_documents),
    processing_days: visaNumberFromApi(r.processing_days),
    visa_price: visaPrice,
    offer_price: visaNumberFromApi(r.offer_price),
    currency: r.currency != null ? String(r.currency).toUpperCase().slice(0, 3) : "",
    offer_status: (r.status ?? "").trim(),
  };
}

function validateVisaForm(form: VisaPayload, isCreate: boolean): string[] {
  const lines: string[] = [];
  if (isCreate) {
    const oid = form.offer_id;
    if (oid == null || !Number.isFinite(Number(oid)) || Number(oid) <= 0) {
      lines.push("offer_id: required");
    }
  }
  if (!(form.country ?? "").trim()) lines.push("country: required");
  if (!(form.visa_type ?? "").trim()) lines.push("visa_type: required");
  const pd = form.processing_days;
  if (pd !== undefined && pd !== null && (Number.isNaN(Number(pd)) || Number(pd) < 0)) {
    lines.push("processing_days: must be >= 0");
  }
  const cid = form.country_id;
  if (cid !== "" && cid !== undefined && cid !== null) {
    const n = Number(cid);
    if (!Number.isFinite(n) || n <= 0) lines.push("country_id: must be a positive number");
  }
  const lid = form.location_id;
  if (lid !== "" && lid !== undefined && lid !== null) {
    const n = Number(lid);
    if (!Number.isFinite(n) || n <= 0) lines.push("location_id: must be a positive number");
  }
  const vPrice = form.visa_price;
  if (vPrice !== undefined && vPrice !== null && (Number.isNaN(Number(vPrice)) || Number(vPrice) < 0)) {
    lines.push("visa_price: must be >= 0");
  }
  return lines;
}

function linesFromApiErrors(errors: Record<string, string[]>): string[] {
  return Object.entries(errors).flatMap(([k, arr]) => (arr ?? []).map((msg) => `${k}: ${msg}`));
}

function fieldKeysFromFormErrLines(lines: string[]): Set<string> {
  const s = new Set<string>();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    s.add(key);
    if (key === "price") s.add("visa_price");
  }
  return s;
}

/** Import/template columns only — matches POST/PATCH body (price = visa row amount on API). */
const VISA_CSV_TEMPLATE_KEYS = [
  "id",
  "offer_id",
  "country",
  "country_id",
  "visa_type",
  "name",
  "processing_days",
  "price",
  "description",
  "required_documents",
] as const;

const VISA_REQUIRED_TEMPLATE_KEYS = new Set<string>(["offer_id", "country", "visa_type"]);

const VISA_TEMPLATE_LABELS: Record<(typeof VISA_CSV_TEMPLATE_KEYS)[number], string> = {
  id: "ID (Update Existing; leave blank to create)",
  offer_id: "Offer ID",
  country: "Country",
  country_id: "Country ID",
  visa_type: "Visa Type",
  name: "Name",
  processing_days: "Processing Days",
  price: "Visa Price",
  description: "Description",
  required_documents: "Required Documents",
};

/** Full export: template fields + offer-linked context (not in template). */
const VISA_CSV_EXPORT_HEADERS = [...VISA_CSV_TEMPLATE_KEYS, "status", "currency", "offer_price"] as const;

function normalizeVisaCsvHeader(header: string): string {
  return header.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const VISA_IMPORT_HEADER_KEY_MAP: Record<string, (typeof VISA_CSV_TEMPLATE_KEYS)[number]> = (() => {
  const map: Record<string, (typeof VISA_CSV_TEMPLATE_KEYS)[number]> = {} as Record<
    string,
    (typeof VISA_CSV_TEMPLATE_KEYS)[number]
  >;
  for (const key of VISA_CSV_TEMPLATE_KEYS) {
    map[normalizeVisaCsvHeader(key)] = key;
    map[normalizeVisaCsvHeader(VISA_TEMPLATE_LABELS[key])] = key;
  }
  return map;
})();

function normalizeVisaCsvImportRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const mapped = VISA_IMPORT_HEADER_KEY_MAP[normalizeVisaCsvHeader(header)] ?? header.trim();
    normalized[mapped] = value;
  }
  return normalized;
}

function visaTemplateCsv(): string {
  const headers = VISA_CSV_TEMPLATE_KEYS.map((key) =>
    VISA_REQUIRED_TEMPLATE_KEYS.has(key) ? `${VISA_TEMPLATE_LABELS[key]} *` : VISA_TEMPLATE_LABELS[key]
  );
  return stringifyCsv(headers, [{}]);
}

function requiredDocumentsPipeFromApi(value: string[] | null | undefined): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((s) => String(s).trim())
    .filter((l) => l.length > 0)
    .join("|");
}

function visaCsvPriceFromRow(r: VisaRow): number | "" {
  const v = r.visa_price ?? r.price;
  if (v != null && Number.isFinite(Number(v))) return Number(v);
  return "";
}

function visaRowToExportRecord(r: VisaRow): Record<string, unknown> {
  return {
    id: r.id,
    offer_id: r.offer_id ?? "",
    country: r.country ?? "",
    country_id: r.country_id ?? "",
    visa_type: r.visa_type ?? "",
    name: r.name ?? "",
    processing_days: r.processing_days ?? "",
    price: visaCsvPriceFromRow(r),
    description: r.description ?? "",
    required_documents: requiredDocumentsPipeFromApi(r.required_documents),
    status: r.status ?? "",
    currency: r.currency ?? "",
    offer_price: r.offer_price ?? "",
  };
}

async function exportAllVisasCsv(token: string): Promise<string> {
  const list = await fetchAllListPages((p) => apiVisas(token, { page: p, per_page: 50 }));
  return stringifyCsv([...VISA_CSV_EXPORT_HEADERS], list.map(visaRowToExportRecord));
}

function visaPayloadFromCsvRow(row: Record<string, string>): VisaPayload {
  const priceRaw = (row.price ?? row.visa_price ?? "").trim();
  const pdRaw = (row.processing_days ?? "").trim();
  const cidRaw = (row.country_id ?? "").trim();
  const offerRaw = (row.offer_id ?? "").trim();
  const reqPipe = (row.required_documents ?? "").trim();

  return {
    offer_id: offerRaw ? Number(offerRaw) : undefined,
    country: (row.country ?? "").trim(),
    country_id: cidRaw === "" ? "" : Number(cidRaw),
    visa_type: (row.visa_type ?? "").trim(),
    name: (row.name ?? "").trim(),
    description: (row.description ?? "").trim(),
    required_documents_text: reqPipe.split("|").join("\n"),
    processing_days: pdRaw === "" ? undefined : Number(pdRaw),
    visa_price: priceRaw === "" ? undefined : Number(priceRaw),
  };
}

async function runVisaCsvImport(
  token: string,
  dataRows: Record<string, string>[],
  rowLineNumbers: number[]
): Promise<ImportRunResult> {
  const errors: ImportRowError[] = [];
  let success = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = normalizeVisaCsvImportRow(dataRows[idx]);
    const line = rowLineNumbers[idx] ?? idx + 2;
    const idRaw = (row.id ?? "").trim();
    const form = visaPayloadFromCsvRow(row);

    if (idRaw) {
      const id = Number(idRaw);
      if (!Number.isFinite(id) || id <= 0) {
        errors.push({ rowNumber: line, message: "Invalid id." });
        continue;
      }
      const v = validateVisaForm(form, false);
      if (v.length > 0) {
        errors.push({ rowNumber: line, message: v.join(" ") });
        continue;
      }
      try {
        await apiUpdateVisa(token, id, bodyFromForm(form, "update"));
        success++;
      } catch (e) {
        errors.push({ rowNumber: line, message: formatImportApiError(e) });
      }
      continue;
    }

    const v = validateVisaForm(form, true);
    if (v.length > 0) {
      errors.push({ rowNumber: line, message: v.join(" ") });
      continue;
    }
    try {
      await apiCreateVisa(token, bodyFromForm(form, "create"));
      success++;
    } catch (e) {
      errors.push({ rowNumber: line, message: formatImportApiError(e) });
    }
  }

  return { success, failed: errors.length, errors };
}

function bodyFromForm(form: VisaPayload, mode: "create" | "update"): VisaPayload {
  const required_documents = requiredDocumentsArrayFromText(form.required_documents_text ?? "");
  const out: VisaPayload = {
    country: (form.country ?? "").trim(),
    visa_type: (form.visa_type ?? "").trim(),
    name: (form.name ?? "").trim(),
    description: (form.description ?? "").trim(),
    required_documents,
  };
  const locationId = form.location_id;
  if (locationId !== "" && locationId !== undefined && locationId !== null && Number.isFinite(Number(locationId)) && Number(locationId) > 0) {
    out.location_id = Number(locationId);
  }
  const cid = form.country_id;
  if (cid !== "" && cid !== undefined && cid !== null && Number.isFinite(Number(cid)) && Number(cid) > 0) {
    out.country_id = Number(cid);
  }
  if (form.processing_days !== undefined && form.processing_days !== null && !Number.isNaN(Number(form.processing_days))) {
    out.processing_days = Number(form.processing_days);
  }
  const vp = form.visa_price;
  if (vp !== undefined && vp !== null && !Number.isNaN(Number(vp))) {
    out.price = Number(vp);
  }
  if (mode === "create" && form.offer_id != null) {
    out.offer_id = Number(form.offer_id);
  }
  return out;
}

export default function OperatorVisasPage() {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState<VisaRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<VisaPayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErrLines, setFormErrLines] = useState<string[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const errFields = useMemo(() => fieldKeysFromFormErrLines(formErrLines), [formErrLines]);
  const inputClass = (fieldKey: string) =>
    `rounded border px-2 py-1.5 text-sm ${
      errFields.has(fieldKey)
        ? "border-red-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
        : "border-default focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
    }`;
  const labelTextClass = "text-sm font-medium text-fg-t7";
  const hintClass = "text-xs leading-snug text-fg-t6";
  const sectionTitleClass = "mb-3 text-xs font-semibold uppercase tracking-wide text-fg-t6";

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiVisas(token, { page, per_page: 20 });
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

  function openCreate() {
    setEditId(null);
    setForm({
      offer_id: undefined,
      country: "",
        location_id: "",
      country_id: "",
      visa_type: "",
      name: "",
      description: "",
      required_documents_text: "",
      processing_days: undefined,
      visa_price: undefined,
      offer_price: undefined,
      currency: "",
      offer_status: undefined,
    });
    setFormErrLines([]);
    setFormLoading(false);
  }

  async function openEdit(r: VisaRow) {
    if (!token) return;
    setEditId(r.id);
    setForm(null);
    setFormLoading(true);
    setFormErrLines([]);
    try {
      const res = await apiGetVisa(token, r.id);
      setForm(visaFormFromApiRow(res.data));
    } catch {
      setForm(visaFormFromApiRow(r));
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
    const isCreate = editId == null;
    const validation = validateVisaForm(form, isCreate);
    if (validation.length > 0) {
      setFormErrLines(validation);
      return;
    }
    setBusy(true);
    setFormErrLines([]);
    try {
      if (isCreate) {
        await apiCreateVisa(token, bodyFromForm(form, "create"));
      } else {
        await apiUpdateVisa(token, editId, bodyFromForm(form, "update"));
      }
      closeForm();
      await load();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
        setFormErrLines(linesFromApiErrors(e.body.errors));
      } else {
        setFormErrLines([e instanceof ApiRequestError ? e.message : "Failed"]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token || !window.confirm(t("admin.crud.visas.delete_confirm"))) return;
    setBusy(true);
    try {
      await apiDeleteVisa(token, id);
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
        <h1 className="admin-page-title">{t("admin.crud.visas.title")}</h1>
        <div className="mt-4">
          <ForbiddenNotice />
        </div>
      </div>
    );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="admin-page-title">{t("admin.crud.visas.title")}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ImportExportButtons
            busy={busy || exportBusy}
            exportDisabled={!token}
            onTemplate={() => downloadCsvFile("visas-template.csv", visaTemplateCsv())}
            onExport={async () => {
              if (!token) return;
              setExportBusy(true);
              try {
                const csv = await exportAllVisasCsv(token);
                downloadCsvFile(csvExportFilename("visas"), csv);
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
            disabled={busy}
            className="admin-btn-primary"
          >
            {t("admin.crud.visas.new_btn")}
          </button>
        </div>
      </div>

      <CsvImportModal
        open={importOpen}
        title={t("admin.crud.visas.import_title")}
        onClose={() => setImportOpen(false)}
        onRun={async (dataRows, rowLineNumbers) => {
          if (!token) {
            return {
              success: 0,
              failed: dataRows.length,
              errors: [{ rowNumber: rowLineNumbers[0] ?? 2, message: "Not signed in." }],
            };
          }
          const res = await runVisaCsvImport(token, dataRows, rowLineNumbers);
          if (res.success > 0) await load();
          return res;
        }}
      />

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}
      {formLoading && editId != null && !form && (
        <div className="mt-4 rounded border border-default bg-white p-4 text-sm text-fg-t6">{t("admin.crud.visas.loading")}</div>
      )}
      {form && (
        <div className="mt-4 rounded border border-default bg-white p-5">
          <h2 className="mb-4 text-base font-medium">{editId ? t("admin.crud.visas.form_edit") : t("admin.crud.visas.form_new")}</h2>

          <div className="space-y-6">
          <div>
          <h3 className={sectionTitleClass}>{t("admin.crud.visas.section.general")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <LocationCascadeSelect
              token={token}
              value={form.location_id === "" || form.location_id == null ? null : Number(form.location_id)}
              label="Location (select country/region/city)"
              onChange={(locationId, meta) =>
                setForm((p) =>
                  p
                    ? {
                        ...p,
                        location_id: locationId ?? "",
                        country: meta.country?.name ?? p.country,
                      }
                    : p
                )
              }
            />
            {editId == null && (
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className={labelTextClass}>
                  {t("admin.crud.visas.field.offer_id")} <span className="text-red-500">*</span>
                </span>
                <input
                  type="number"
                  placeholder={t("admin.crud.visas.hint.offer_id")}
                  value={form.offer_id != null && Number.isFinite(Number(form.offer_id)) ? form.offer_id : ""}
                  onChange={(e) =>
                    setForm((p) =>
                      p ? { ...p, offer_id: e.target.value ? Number(e.target.value) : undefined } : p
                    )
                  }
                  className={inputClass("offer_id")}
                />
              </label>
            )}
            {editId != null && (
              <div className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className={labelTextClass}>{t("admin.crud.visas.field.offer_status")}</span>
                <p className="rounded border border-default bg-figma-bg-1 px-2 py-1.5 text-fg-t11">
                  {(form.offer_status ?? "").trim() || "—"}
                </p>
                <p className={hintClass}>{t("admin.crud.visas.hint.offer_status")}</p>
              </div>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={labelTextClass}>
                {t("admin.crud.visas.field.country")} <span className="text-red-500">*</span>
              </span>
              <input
                value={form.country ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, country: e.target.value } : p))}
                className={inputClass("country")}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={labelTextClass}>{t("admin.crud.visas.field.country_id")}</span>
              <input
                type="number"
                min={1}
                placeholder="Optional"
                value={form.country_id !== "" && form.country_id != null ? form.country_id : ""}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          country_id: e.target.value === "" ? "" : Number(e.target.value),
                        }
                      : p
                  )
                }
                className={inputClass("country_id")}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={labelTextClass}>
                {t("admin.crud.visas.field.visa_type")} <span className="text-red-500">*</span>
              </span>
              <input
                value={form.visa_type ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, visa_type: e.target.value } : p))}
                className={inputClass("visa_type")}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className={labelTextClass}>{t("admin.crud.visas.field.name")}</span>
              <input
                value={form.name ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, name: e.target.value } : p))}
                className={inputClass("name")}
              />
            </label>
          </div>
          </div>

          <div>
          <h3 className={sectionTitleClass}>{t("admin.crud.visas.section.processing")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={labelTextClass}>{t("admin.crud.visas.field.processing_days")}</span>
              <input
                type="number"
                min={0}
                value={form.processing_days != null && !Number.isNaN(Number(form.processing_days)) ? form.processing_days : ""}
                onChange={(e) =>
                  setForm((p) =>
                    p ? { ...p, processing_days: e.target.value ? Number(e.target.value) : undefined } : p
                  )
                }
                className={inputClass("processing_days")}
              />
            </label>
          </div>
          </div>

          <div>
          <h3 className={sectionTitleClass}>{t("admin.crud.visas.section.pricing")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={labelTextClass}>{t("admin.crud.visas.field.visa_price")}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.visa_price != null && !Number.isNaN(Number(form.visa_price)) ? form.visa_price : ""}
                onChange={(e) =>
                  setForm((p) =>
                    p ? { ...p, visa_price: e.target.value === "" ? undefined : Number(e.target.value) } : p
                  )
                }
                className={inputClass("visa_price")}
              />
              <p className={hintClass}>Visa-level price you edit here. Offer price is separate and read-only.</p>
            </label>
            {editId != null && (
              <div className="flex flex-col gap-1.5 text-sm">
                <span className={labelTextClass}>{t("admin.crud.visas.field.offer_price")}</span>
                <p className="rounded border border-default bg-figma-bg-1 px-2 py-1.5 tabular-nums text-fg-t11">
                  {form.offer_price != null && !Number.isNaN(Number(form.offer_price))
                    ? visaMoneyCell(form.offer_price, form.currency)
                    : "—"}
                </p>
                <p className={hintClass}>From the linked offer; not editable on this form.</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className={labelTextClass}>{t("admin.crud.visas.field.currency")}</span>
              <p className="rounded border border-default bg-figma-bg-1 px-2 py-1.5 uppercase text-fg-t11">
                {(form.currency ?? "").trim() || "—"}
              </p>
              <p className={hintClass}>From the linked offer when present; not saved from this screen.</p>
            </div>
          </div>
          </div>

          <div>
          <h3 className={sectionTitleClass}>{t("admin.crud.visas.section.content")}</h3>
          <div className="grid gap-4 sm:grid-cols-1">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={labelTextClass}>{t("admin.crud.visas.field.description")}</span>
              <textarea
                rows={4}
                value={form.description ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, description: e.target.value } : p))}
                className={inputClass("description")}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className={labelTextClass}>{t("admin.crud.visas.field.required_documents")}</span>
              <textarea
                rows={5}
                placeholder="e.g. Passport copy"
                value={form.required_documents_text ?? ""}
                onChange={(e) => setForm((p) => (p ? { ...p, required_documents_text: e.target.value } : p))}
                className={inputClass("required_documents_text")}
              />
              <p className={hintClass}>{t("admin.crud.visas.hint.required_documents")}</p>
            </label>
          </div>
          </div>
          </div>

          {formErrLines.length > 0 && (
            <ul className="mt-4 list-inside list-disc text-sm text-error-600">
              {formErrLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSubmit()}
              className="admin-btn-primary"
            >
              {busy ? t("admin.crud.common.saving") : t("common.save")}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded border border-default bg-white px-4 py-1.5 text-sm text-fg-t11 hover:bg-figma-bg-1"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
              <th className="px-3 py-2">{t("admin.crud.visas.col.country")}</th>
              <th className="px-3 py-2">{t("admin.crud.visas.col.type")}</th>
              <th className="px-3 py-2 font-semibold text-fg-t11">{t("admin.crud.visas.col.visa_price")}</th>
              <th className="px-3 py-2 font-normal text-fg-t6">{t("admin.crud.visas.col.offer_price")}</th>
              <th className="px-3 py-2">{t("admin.crud.visas.col.processing")}</th>
              <th className="px-3 py-2">{t("admin.crud.common.status")}</th>
              <th className="px-3 py-2">{t("admin.crud.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-fg-t6">
                  {t("admin.crud.visas.empty")}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                <td className="px-3 py-2 font-medium text-fg-t11">
                  {(r.country ?? "").trim() ? r.country : "—"}
                </td>
                <td className="px-3 py-2 text-fg-t7">{(r.visa_type ?? "").trim() ? r.visa_type : "—"}</td>
                <td className="px-3 py-2 tabular-nums font-medium text-fg-t11">
                  {visaMoneyCell(r.visa_price != null ? r.visa_price : r.price ?? null, r.currency)}
                </td>
                <td className="px-3 py-2 tabular-nums text-sm text-fg-t6">
                  {visaMoneyCell(r.offer_price ?? null, r.currency)}
                </td>
                <td className="px-3 py-2 text-fg-t7">
                  {r.processing_days != null ? `${r.processing_days} days` : "—"}
                </td>
                <td className="px-3 py-2">{visaOfferStatusLabel(r)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void openEdit(r)}
                      disabled={busy}
                      className="text-xs text-info-700 underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t("admin.crud.common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(r.id)}
                      disabled={busy}
                      className="text-xs text-error-600 underline disabled:cursor-not-allowed disabled:opacity-40"
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
