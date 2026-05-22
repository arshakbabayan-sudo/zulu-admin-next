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
import { TranslationTabs } from "@/components/TranslationTabs";
import {
  Button,
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
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiRequestError } from "@/lib/api-client";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiCreateTransfer,
  apiDeleteTransfer,
  apiGetTransfer,
  apiTransfers,
  apiUpdateTransfer,
  type TransferRow,
} from "@/lib/inventory-crud-api";
import {
  emptyTransferOperatorForm,
  transferFormFromRow,
  type TransferFormValues,
} from "@/lib/transfers/transfer-field-adapter";
import {
  TRANSFER_FIELD_LABELS,
  TRANSFER_OPERATOR_WIZARD_STEPS,
  formatTransferApiValidationErrors,
  validateTransferOperatorForm,
  validateTransferOperatorStep,
  type TransferOperatorWizardStep,
} from "@/lib/transfers/transfer-ui";
import {
  csvExportFilename,
  downloadCsvFile,
  exportTransfersCsv,
  runTransferCsvImport,
  transferTemplateCsv,
} from "@/lib/csv-import-export";
import { useCallback, useEffect, useState } from "react";

type FieldType = "text" | "number" | "datetime-local" | "select" | "boolean" | "date" | "time";

type TransferField = {
  key: keyof TransferFormValues;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
};

const TRANSFER_TYPES = [
  "airport_transfer",
  "hotel_transfer",
  "city_transfer",
  "private_transfer",
  "shared_transfer",
  "intercity_transfer",
] as const;

const POINT_TYPES = ["airport", "hotel", "address", "station", "port", "landmark"] as const;

const VEHICLE_CATEGORIES = ["sedan", "suv", "minivan", "minibus", "bus", "luxury_car"] as const;

const PRICING_MODES = ["per_vehicle", "per_person"] as const;

const PRIVATE_OR_SHARED_OPTS = ["private", "shared"] as const;

const CANCELLATION_POLICY_TYPES = ["non_refundable", "partially_refundable", "fully_refundable"] as const;

const AVAILABILITY_STATUSES = ["available", "unavailable"] as const;

const LIFECYCLE_STATUSES = ["draft", "active", "inactive", "archived"] as const;

const VISIBILITY_RULES = ["show_all", "show_accepted_only", "hide_rejected"] as const;

const FIELDS: TransferField[] = [
  { key: "offer_id", label: TRANSFER_FIELD_LABELS.offer_id, type: "number", required: true },
  { key: "transfer_title", label: TRANSFER_FIELD_LABELS.transfer_title, type: "text", required: true },
  { key: "transfer_type", label: TRANSFER_FIELD_LABELS.transfer_type, type: "select", options: [...TRANSFER_TYPES], required: true },
  { key: "service_date", label: TRANSFER_FIELD_LABELS.service_date, type: "date", required: true },
  { key: "pickup_time", label: TRANSFER_FIELD_LABELS.pickup_time, type: "time", required: true },
  { key: "estimated_duration_minutes", label: TRANSFER_FIELD_LABELS.estimated_duration_minutes, type: "number", required: true },
  { key: "pickup_country", label: TRANSFER_FIELD_LABELS.pickup_country, type: "text", required: true },
  { key: "pickup_city", label: TRANSFER_FIELD_LABELS.pickup_city, type: "text", required: true },
  { key: "pickup_point_type", label: TRANSFER_FIELD_LABELS.pickup_point_type, type: "select", options: [...POINT_TYPES], required: true },
  { key: "pickup_point_name", label: TRANSFER_FIELD_LABELS.pickup_point_name, type: "text", required: true },
  { key: "dropoff_country", label: TRANSFER_FIELD_LABELS.dropoff_country, type: "text", required: true },
  { key: "dropoff_city", label: TRANSFER_FIELD_LABELS.dropoff_city, type: "text", required: true },
  { key: "dropoff_point_type", label: TRANSFER_FIELD_LABELS.dropoff_point_type, type: "select", options: [...POINT_TYPES], required: true },
  { key: "dropoff_point_name", label: TRANSFER_FIELD_LABELS.dropoff_point_name, type: "text", required: true },
  { key: "route_label", label: TRANSFER_FIELD_LABELS.route_label, type: "text" },
  { key: "route_distance_km", label: TRANSFER_FIELD_LABELS.route_distance_km, type: "number" },
  { key: "pickup_latitude", label: TRANSFER_FIELD_LABELS.pickup_latitude, type: "number" },
  { key: "pickup_longitude", label: TRANSFER_FIELD_LABELS.pickup_longitude, type: "number" },
  { key: "dropoff_latitude", label: TRANSFER_FIELD_LABELS.dropoff_latitude, type: "number" },
  { key: "dropoff_longitude", label: TRANSFER_FIELD_LABELS.dropoff_longitude, type: "number" },
  { key: "availability_window_start", label: TRANSFER_FIELD_LABELS.availability_window_start, type: "datetime-local" },
  { key: "availability_window_end", label: TRANSFER_FIELD_LABELS.availability_window_end, type: "datetime-local" },
  { key: "vehicle_category", label: TRANSFER_FIELD_LABELS.vehicle_category, type: "select", options: [...VEHICLE_CATEGORIES], required: true },
  { key: "vehicle_class", label: TRANSFER_FIELD_LABELS.vehicle_class, type: "text" },
  { key: "private_or_shared", label: TRANSFER_FIELD_LABELS.private_or_shared, type: "select", options: ["", ...PRIVATE_OR_SHARED_OPTS] },
  { key: "passenger_capacity", label: TRANSFER_FIELD_LABELS.passenger_capacity, type: "number", required: true },
  { key: "luggage_capacity", label: TRANSFER_FIELD_LABELS.luggage_capacity, type: "number", required: true },
  { key: "minimum_passengers", label: TRANSFER_FIELD_LABELS.minimum_passengers, type: "number", required: true },
  { key: "maximum_passengers", label: TRANSFER_FIELD_LABELS.maximum_passengers, type: "number", required: true },
  { key: "maximum_luggage", label: TRANSFER_FIELD_LABELS.maximum_luggage, type: "number" },
  { key: "child_seat_available", label: TRANSFER_FIELD_LABELS.child_seat_available, type: "boolean", required: true },
  { key: "child_seat_required_rule", label: TRANSFER_FIELD_LABELS.child_seat_required_rule, type: "text" },
  { key: "accessibility_support", label: TRANSFER_FIELD_LABELS.accessibility_support, type: "boolean", required: true },
  { key: "special_assistance_supported", label: TRANSFER_FIELD_LABELS.special_assistance_supported, type: "boolean", required: true },
  { key: "pricing_mode", label: TRANSFER_FIELD_LABELS.pricing_mode, type: "select", options: [...PRICING_MODES], required: true },
  { key: "base_price", label: TRANSFER_FIELD_LABELS.base_price, type: "number", required: true },
  { key: "free_cancellation", label: TRANSFER_FIELD_LABELS.free_cancellation, type: "boolean", required: true },
  { key: "cancellation_policy_type", label: TRANSFER_FIELD_LABELS.cancellation_policy_type, type: "select", options: [...CANCELLATION_POLICY_TYPES], required: true },
  { key: "cancellation_deadline_at", label: TRANSFER_FIELD_LABELS.cancellation_deadline_at, type: "datetime-local" },
  { key: "visibility_rule", label: TRANSFER_FIELD_LABELS.visibility_rule, type: "select", options: [...VISIBILITY_RULES], required: true },
  { key: "appears_in_web", label: TRANSFER_FIELD_LABELS.appears_in_web, type: "boolean", required: true },
  { key: "appears_in_admin", label: TRANSFER_FIELD_LABELS.appears_in_admin, type: "boolean", required: true },
  { key: "appears_in_zulu_admin", label: TRANSFER_FIELD_LABELS.appears_in_zulu_admin, type: "boolean", required: true },
  { key: "availability_status", label: TRANSFER_FIELD_LABELS.availability_status, type: "select", options: [...AVAILABILITY_STATUSES], required: true },
  { key: "bookable", label: TRANSFER_FIELD_LABELS.bookable, type: "boolean", required: true },
  { key: "is_package_eligible", label: TRANSFER_FIELD_LABELS.is_package_eligible, type: "boolean", required: true },
  { key: "status", label: TRANSFER_FIELD_LABELS.status, type: "select", options: [...LIFECYCLE_STATUSES], required: true },
];

type TransferWizardStepNonReview = Exclude<TransferOperatorWizardStep, "review">;

const STEP_FIELDS: Record<TransferWizardStepNonReview, (keyof TransferFormValues)[]> = {
  general: [
    "offer_id",
    "transfer_title",
    "transfer_type",
    "service_date",
    "pickup_time",
    "estimated_duration_minutes",
  ],
  route: [
    // pickup_country/pickup_city auto-filled from the Origin location cascade above.
    "pickup_point_type",
    "pickup_point_name",
    // dropoff_country/dropoff_city auto-filled from the Destination location cascade above.
    "dropoff_point_type",
    "dropoff_point_name",
    "route_label",
    "route_distance_km",
    "pickup_latitude",
    "pickup_longitude",
    "dropoff_latitude",
    "dropoff_longitude",
    "availability_window_start",
    "availability_window_end",
  ],
  vehicle: [
    "vehicle_category",
    "vehicle_class",
    "private_or_shared",
    "passenger_capacity",
    "luggage_capacity",
    "minimum_passengers",
    "maximum_passengers",
    "maximum_luggage",
    "child_seat_available",
    "child_seat_required_rule",
    "accessibility_support",
    "special_assistance_supported",
  ],
  pricing: [
    "pricing_mode",
    "base_price",
    "free_cancellation",
    "cancellation_policy_type",
    "cancellation_deadline_at",
  ],
  publication: [
    "visibility_rule",
    "appears_in_web",
    "appears_in_admin",
    "appears_in_zulu_admin",
    "availability_status",
    "bookable",
    "is_package_eligible",
    "status",
  ],
};

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

const TRANSFER_STEP_LABEL_KEYS: Record<string, string> = {
  general: "admin.crud.transfers.step.general",
  route: "admin.crud.transfers.step.route",
  vehicle: "admin.crud.transfers.step.vehicle",
  pricing: "admin.crud.transfers.step.pricing",
  publication: "admin.crud.transfers.step.publication",
  review: "admin.crud.transfers.step.review",
};

export default function OperatorTransfersPage() {
  const { token } = useAdminAuth();
  const { t, contentLang } = useLanguage();
  const confirm = useConfirm();
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<TransferFormValues | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors | null>(null);
  const [wizardStep, setWizardStep] = useState<TransferOperatorWizardStep>("general");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const mode = editId == null ? "create" : "edit";

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiTransfers(token, { page, per_page: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.crud.common.failed"));
    }
  }, [token, page, contentLang]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditId(null);
    setForm(emptyTransferOperatorForm());
    setFormErr(null);
    setFieldErrs(null);
    setWizardStep("general");
    setStepErrors([]);
  }

  async function openEdit(r: TransferRow) {
    if (!token) return;
    setEditId(r.id);
    setBusy(true);
    setFormErr(null);
    setFieldErrs(null);
    try {
      const res = await apiGetTransfer(token, r.id);
      const raw = (res.data ?? {}) as TransferRow;
      setForm(transferFormFromRow(raw));
      setWizardStep("general");
      setStepErrors([]);
    } catch (e) {
      setFormErr(e instanceof ApiRequestError ? e.message : t("admin.crud.common.failed"));
      setForm(null);
      setEditId(null);
    } finally {
      setBusy(false);
    }
  }

  function closeForm() {
    setForm(null);
    setEditId(null);
    setFormErr(null);
    setFieldErrs(null);
    setWizardStep("general");
    setStepErrors([]);
  }

  const fieldByKey = new Map<keyof TransferFormValues, TransferField>(FIELDS.map((f) => [f.key, f]));
  const currentStepIndex = TRANSFER_OPERATOR_WIZARD_STEPS.findIndex((s) => s.key === wizardStep);

  const fieldMsgs = (key: string) => (fieldErrs && Array.isArray(fieldErrs[key]) ? fieldErrs[key] : []);
  const fieldError = (key: string): string | null => {
    const msgs = fieldMsgs(key);
    return msgs.length > 0 ? msgs.join(" ") : null;
  };

  function renderTransferField(field: TransferField) {
    if (!form) return null;
    const disabledOffer = field.key === "offer_id" && editId != null;
    const keyStr = String(field.key);
    const inputId = `transfer-${keyStr}`;
    const labelText = t(`admin.crud.transfers.field.${keyStr}`);

    if (field.type === "select" && field.options) {
      return (
        <FormField
          key={keyStr}
          label={labelText}
          htmlFor={inputId}
          required={field.required}
          error={fieldError(keyStr)}
        >
          <Select
            id={inputId}
            value={
              field.key === "private_or_shared"
                ? String(form.private_or_shared ?? "")
                : String(form[field.key] ?? "")
            }
            disabled={disabledOffer}
            onChange={(e) => {
              const v = e.target.value;
              setForm((p) => (p ? { ...p, [field.key]: v as never } : p));
            }}
          >
            {field.key === "private_or_shared" && <option value="">(optional)</option>}
            {field.options
              .filter((opt) => opt !== "")
              .map((opt) => (
                <option key={opt} value={opt}>
                  {opt || "(optional)"}
                </option>
              ))}
          </Select>
        </FormField>
      );
    }

    if (field.type === "boolean") {
      return (
        <FormField
          key={keyStr}
          label={labelText}
          htmlFor={inputId}
          required={field.required}
          error={fieldError(keyStr)}
        >
          <Select
            id={inputId}
            value={String(Boolean(form[field.key]))}
            onChange={(e) =>
              setForm((p) => (p ? { ...p, [field.key]: e.target.value === "true" } : p))
            }
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        </FormField>
      );
    }

    if (field.type === "time") {
      const raw = String(form.pickup_time ?? "09:00:00");
      const hm = raw.slice(0, 5);
      return (
        <FormField
          key={keyStr}
          label={labelText}
          htmlFor={inputId}
          required={field.required}
          error={fieldError(keyStr)}
        >
          <Input
            id={inputId}
            type="time"
            value={hm}
            onChange={(e) => {
              const v = e.target.value;
              setForm((p) => (p ? { ...p, pickup_time: v ? `${v}:00` : "09:00:00" } : p));
            }}
          />
        </FormField>
      );
    }

    if (field.type === "date") {
      return (
        <FormField
          key={keyStr}
          label={labelText}
          htmlFor={inputId}
          required={field.required}
          error={fieldError(keyStr)}
        >
          <Input
            id={inputId}
            type="date"
            value={String(form[field.key] ?? "")}
            onChange={(e) => setForm((p) => (p ? { ...p, [field.key]: e.target.value } : p))}
          />
        </FormField>
      );
    }

    return (
      <FormField
        key={keyStr}
        label={labelText}
        htmlFor={inputId}
        required={field.required}
        error={fieldError(keyStr)}
      >
        <Input
          id={inputId}
          value={
            field.key === "offer_id"
              ? form.offer_id == null
                ? ""
                : String(form.offer_id)
              : field.type === "number"
                ? form[field.key] === "" || form[field.key] == null
                  ? ""
                  : String(form[field.key])
                : String(form[field.key] ?? "")
          }
          disabled={disabledOffer}
          onChange={(e) => {
            const v = e.target.value;
            setForm((p) => {
              if (!p) return p;
              if (field.key === "offer_id") {
                if (v === "") return { ...p, offer_id: null };
                const n = Number(v);
                return { ...p, offer_id: Number.isFinite(n) ? n : null };
              }
              if (field.type === "number") {
                if (v === "") return { ...p, [field.key]: "" as never };
                return { ...p, [field.key]: Number(v) as never };
              }
              return { ...p, [field.key]: v as never };
            });
          }}
          type={field.type === "number" ? "number" : field.type === "datetime-local" ? "datetime-local" : "text"}
        />
      </FormField>
    );
  }

  function handleNextStep() {
    if (!form) return;
    const errors = validateTransferOperatorStep(form, wizardStep, mode);
    setStepErrors(errors);
    if (errors.length > 0) return;
    setFormErr(null);
    const next = TRANSFER_OPERATOR_WIZARD_STEPS[currentStepIndex + 1];
    if (next) setWizardStep(next.key);
  }

  function handlePreviousStep() {
    const prev = TRANSFER_OPERATOR_WIZARD_STEPS[currentStepIndex - 1];
    if (prev) {
      setWizardStep(prev.key);
      setStepErrors([]);
    }
  }

  async function handleSubmit() {
    if (!token || !form) return;
    const clientErrors = validateTransferOperatorForm(form, mode);
    if (clientErrors.length > 0) {
      setFormErr(clientErrors.slice(0, 4).join(" "));
      return;
    }
    setBusy(true);
    setFormErr(null);
    setFieldErrs(null);
    try {
      if (editId != null) await apiUpdateTransfer(token, editId, form);
      else await apiCreateTransfer(token, form);
      closeForm();
      await load();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setFormErr(e.message || "Request failed.");
        setFieldErrs(e.body?.errors ?? null);
      } else {
        setFormErr(t("admin.crud.common.failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.transfers.delete_confirm", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteTransfer(token, id);
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

  if (forbidden) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">{t("admin.crud.transfers.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const fieldSummary = renderApiFieldErrors(fieldErrs ?? undefined);
  const apiErrLines = fieldErrs ? formatTransferApiValidationErrors(fieldErrs) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {t("admin.crud.transfers.title")}
            {form === null && <ContentLanguagePill />}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <Button size="sm" disabled={busy} onClick={openCreate}>
              {t("admin.crud.transfers.new_btn")}
            </Button>
          </div>
        }
      />

      <CsvImportModal
        open={importOpen}
        title={t("admin.crud.transfers.import_title")}
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

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">
          {err}
        </div>
      )}

      {form && (
        <section className="admin-card p-4">
          <h2 className="mb-3 text-base font-semibold">{editId ? t("admin.crud.transfers.form_edit") : t("admin.crud.transfers.form_new")}</h2>

          {fieldSummary && (
            <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">
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

          {apiErrLines.length > 0 && (
            <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">
              <div className="font-medium">API validation</div>
              <ul className="mt-1 list-disc pl-5">
                {apiErrLines.slice(0, 10).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <FormField label={t("admin.crud.transfers.field.currency")} htmlFor="transfer-currency">
              <Input
                id="transfer-currency"
                value={form.currency ?? ""}
                readOnly
                className="bg-figma-bg-1 text-fg-t6"
              />
            </FormField>
            <MainImageDescriptionFields
              mainImage={form.main_image}
              shortDescription={form.short_description}
              onMainImageChange={(v) => setForm((p) => p ? { ...p, main_image: v } : p)}
              onShortDescriptionChange={(v) => setForm((p) => p ? { ...p, short_description: v } : p)}
              section="transfers"
              altText={t("admin.crud.transfers.main_image_alt")}
            />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {TRANSFER_OPERATOR_WIZARD_STEPS.map((step, idx) => {
              const isActive = step.key === wizardStep;
              return (
                <Button
                  key={step.key}
                  size="sm"
                  variant={isActive ? "primary" : "outline"}
                  onClick={() => {
                    if (!form) return;
                    if (idx <= currentStepIndex) {
                      setWizardStep(step.key);
                      setStepErrors([]);
                    }
                  }}
                  disabled={idx > currentStepIndex}
                >
                  {t(TRANSFER_STEP_LABEL_KEYS[step.key] ?? step.key)}
                </Button>
              );
            })}
          </div>

          {wizardStep !== "review" ? (
            <>
              {wizardStep === "route" && (
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <LocationCascadeSelect
                    token={token}
                    value={
                      form.origin_location_id === "" || form.origin_location_id == null
                        ? null
                        : Number(form.origin_location_id)
                    }
                    label={t("admin.crud.transfers.field.origin_location")}
                    onChange={(locationId, meta) =>
                      setForm((p) =>
                        p
                          ? {
                              ...p,
                              origin_location_id: locationId ?? "",
                              pickup_country: meta.country?.name ?? p.pickup_country,
                              pickup_city: meta.city?.name ?? meta.region?.name ?? p.pickup_city,
                            }
                          : p
                      )
                    }
                  />
                  <LocationCascadeSelect
                    token={token}
                    value={
                      form.destination_location_id === "" || form.destination_location_id == null
                        ? null
                        : Number(form.destination_location_id)
                    }
                    label={t("admin.crud.transfers.field.destination_location")}
                    onChange={(locationId, meta) =>
                      setForm((p) =>
                        p
                          ? {
                              ...p,
                              destination_location_id: locationId ?? "",
                              dropoff_country: meta.country?.name ?? p.dropoff_country,
                              dropoff_city: meta.city?.name ?? meta.region?.name ?? p.dropoff_city,
                            }
                          : p
                      )
                    }
                  />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {STEP_FIELDS[wizardStep as TransferWizardStepNonReview].map((key) => {
                  const field = fieldByKey.get(key);
                  return field ? renderTransferField(field) : null;
                })}
              </div>
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-zulu border border-default px-3 py-2 text-sm">
                <div className="text-xs text-fg-t6">{TRANSFER_FIELD_LABELS.currency}</div>
                <div className="font-medium text-fg-t11">{form.currency ?? "—"}</div>
              </div>
              {FIELDS.map((field) => (
                <div key={String(field.key)} className="rounded-zulu border border-default px-3 py-2 text-sm">
                  <div className="text-xs text-fg-t6">{t(`admin.crud.transfers.field.${String(field.key)}`)}</div>
                  <div className="font-medium text-fg-t11">
                    {field.type === "boolean"
                      ? String(Boolean(form[field.key]))
                      : String(form[field.key] ?? "—")}
                  </div>
                </div>
              ))}
            </div>
          )}

          {stepErrors.length > 0 && (
            <p className="mt-2 text-sm text-error-700">{stepErrors.slice(0, 4).join(" ")}</p>
          )}
          {formErr && <p className="mt-2 text-sm text-error-700">{formErr}</p>}

          {editId !== null && (
            <div className="mt-6 rounded-zulu border border-default bg-figma-bg-1 p-3">
              <h3 className="mb-2 text-sm font-medium text-fg-t6">
                {t("admin.crud.transfers.translations_title")} <span className="text-fg-t7 font-normal">{t("admin.crud.transfers.translations_hint")}</span>
              </h3>
              <TranslationTabs
                entityType="transfer"
                entityId={editId}
                fields={[
                  { name: "title", label: t("admin.crud.transfers.field.title") },
                  { name: "description", label: t("admin.crud.transfers.field.description"), multiline: true },
                ]}
              />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousStep}
              disabled={currentStepIndex === 0 || busy}
            >
              {t("common.prev")}
            </Button>
            {wizardStep === "review" ? (
              <Button size="sm" disabled={busy} onClick={() => void handleSubmit()}>
                {busy ? t("admin.crud.common.saving") : t("admin.crud.transfers.submit")}
              </Button>
            ) : (
              <Button size="sm" disabled={busy} onClick={handleNextStep}>
                {t("common.next")}
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
            <TH>{t("admin.crud.transfers.col.title")}</TH>
            <TH>{t("admin.crud.transfers.col.vehicle")}</TH>
            <TH>{t("admin.crud.transfers.col.route")}</TH>
            <TH>{t("admin.crud.transfers.col.price")}</TH>
            <TH>{t("admin.crud.common.status")}</TH>
            <TH>{t("admin.crud.common.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>{t("admin.crud.transfers.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD className="font-medium">{r.transfer_title ?? "—"}</TD>
              <TD>{r.vehicle_category ?? "-"}</TD>
              <TD>
                {r.pickup_city ?? "-"} {" -> "} {r.dropoff_city ?? "-"}
              </TD>
              <TD className="tabular-nums">
                {r.base_price != null ? `${r.offer?.currency ?? ""} ${Number(r.base_price).toFixed(2)}` : "-"}
              </TD>
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
                      Submit for review
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
