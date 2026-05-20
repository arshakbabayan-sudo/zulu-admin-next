"use client";

/**
 * Operator Flights — single-page CRUD with collapsible sections + nested cabins.
 * Mirrors the Hotels admin pattern (hotels/page.tsx): one form, sectioned UI,
 * adapter functions (flightCreateBodyFromForm / flightUpdateBodyFromForm /
 * flightFormFromDetail), inline child-row management (cabins ≈ rooms).
 *
 * Cabin endpoints stay separate (FlightController exposes /flights/:id/cabins);
 * `diffFlightCabins` computes add/update/delete deltas on save.
 *
 * Last synced: 2026-05-11
 */

/** Phase-2 migration: page chrome (header / list table / action buttons /
 * error banners / section card framing) on design-system primitives; the
 * dense in-form fields keep their local Field/inputCls dense layout because
 * the 8-section collapsible form intentionally renders tighter than the
 * 48px Input primitive would allow. Same pattern as the inner pricing rows
 * in /operator/hotels. */

import { ContentLanguagePill } from "@/components/ContentLanguagePill";
import { ForbiddenNotice } from "@/components/ForbiddenNotice";
import { ImageUploadField } from "@/components/ImageUploadField";
import { ImportExportButtons } from "@/components/ImportExportButtons";
import { CsvImportModal } from "@/components/CsvImportModal";
import { OfferStatusBadge, isSubmittableStatus } from "@/components/OfferStatusBadge";
import { PaginationBar } from "@/components/PaginationBar";
import { LocationCascadeSelect } from "@/components/LocationCascadeSelect";
import { TranslationTabs } from "@/components/TranslationTabs";
import {
  Button,
  PageHeader,
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
import { formatDateTime } from "@/lib/format";
import { ApiRequestError } from "@/lib/api-client";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import { csvExportFilename, downloadCsvFile } from "@/lib/csv-import-export";
import { exportFlightsCsv, flightTemplateCsv, runFlightCsvImport } from "@/lib/csv-orchestrator";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiFlights,
  apiFlight,
  apiCreateFlight,
  apiUpdateFlight,
  apiDeleteFlight,
  apiFlightCabins,
  apiCreateFlightCabin,
  apiUpdateFlightCabin,
  apiDeleteFlightCabin,
  flightFormFromDetail,
  flightCreateBodyFromForm,
  flightUpdateBodyFromForm,
  diffFlightCabins,
  newFlightCabinFormRow,
  type FlightRow,
  type FlightFormPayload,
  type FlightCabinFormRow,
  type FlightCabinRow,
} from "@/lib/inventory-crud-api";
import {
  FLIGHT_CABIN_CLASSES,
  FLIGHT_CANCELLATION_POLICY_TYPES,
  FLIGHT_CHANGE_POLICY_TYPES,
  FLIGHT_CONNECTION_TYPES,
  FLIGHT_LIFECYCLE_STATUSES,
  FLIGHT_SERVICE_TYPES,
  flightCabinClassLabel,
  flightCancellationPolicyLabel,
  flightChangePolicyLabel,
  flightLifecycleStatusLabel,
  flightServiceTypeLabel,
  formatFlightApiValidationErrors,
  validateFlightOperatorForm,
} from "@/lib/flight-ui";
import { useCallback, useEffect, useState } from "react";

const EMPTY: FlightFormPayload = {
  offer_id: "",
  departure_location_id: "",
  arrival_location_id: "",
  flight_code_internal: "",
  service_type: "scheduled",
  departure_country: "",
  departure_city: "",
  departure_airport: "",
  arrival_country: "",
  arrival_city: "",
  arrival_airport: "",
  departure_airport_code: "",
  arrival_airport_code: "",
  departure_terminal: "",
  arrival_terminal: "",
  departure_at: "",
  arrival_at: "",
  duration_minutes: "",
  timezone_context: "",
  check_in_close_at: "",
  boarding_close_at: "",
  connection_type: "direct",
  stops_count: 0,
  connection_notes: "",
  layover_summary: "",
  adult_age_from: 12,
  child_age_from: 2,
  child_age_to: 11,
  infant_age_from: 0,
  infant_age_to: 1,
  reservation_allowed: true,
  online_checkin_allowed: false,
  airport_checkin_allowed: true,
  cancellation_policy_type: "non_refundable",
  change_policy_type: "not_allowed",
  reservation_deadline_at: "",
  cancellation_deadline_at: "",
  change_deadline_at: "",
  policy_notes: "",
  is_package_eligible: true,
  appears_in_web: true,
  appears_in_admin: true,
  appears_in_zulu_admin: true,
  status: "draft",
  main_image: "",
  short_description: "",
  cabins: [newFlightCabinFormRow()],
};

type SectionKey =
  | "general"
  | "departure"
  | "arrival"
  | "schedule"
  | "ages"
  | "cabins"
  | "policies"
  | "visibility";

const SECTION_LABELS: Record<SectionKey, string> = {
  general: "1) General",
  departure: "2) Departure",
  arrival: "3) Arrival",
  schedule: "4) Schedule & route",
  ages: "5) Passenger age tiers",
  cabins: "6) Cabin classes & pricing",
  policies: "7) Booking policies",
  visibility: "8) Visibility & lifecycle",
};

function Section({
  sectionKey,
  open,
  onToggle,
  children,
}: {
  sectionKey: SectionKey;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-zulu border border-default bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-figma-bg-1/40"
      >
        <span className="text-sm font-semibold text-fg-t11">{SECTION_LABELS[sectionKey]}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {open ? <div className="border-t border-default px-4 py-4">{children}</div> : null}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-fg-t6">
        {label}
        {required ? " ★" : ""}
      </span>
      {hint ? <span className="text-xs text-fg-t7">{hint}</span> : null}
      {children}
    </label>
  );
}

const inputCls = "rounded border border-default px-2 py-1.5 text-sm";

export default function OperatorFlightsPage() {
  const { token } = useAdminAuth();
  const { t, contentLang, lang } = useLanguage();
  const confirm = useConfirm();
  const [rows, setRows] = useState<FlightRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [form, setForm] = useState<FlightFormPayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrLines, setFormErrLines] = useState<string[]>([]);
  /** Persisted cabin rows from the server when opening edit; used to diff on save. */
  const [serverCabins, setServerCabins] = useState<{ flightId: number; rows: FlightCabinRow[] } | null>(null);
  const [openSection, setOpenSection] = useState<Record<SectionKey, boolean>>({
    general: true,
    departure: true,
    arrival: true,
    schedule: true,
    ages: false,
    cabins: true,
    policies: false,
    visibility: false,
  });

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiFlights(token, { page, per_page: 20 });
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

  function openCreate() {
    setErr(null);
    setEditId(null);
    setForm({ ...EMPTY, cabins: [newFlightCabinFormRow({ cabin_class: "economy" })] });
    setServerCabins(null);
    setFormErrLines([]);
    setFormLoading(false);
  }

  async function openEdit(r: FlightRow) {
    if (!token) return;
    setErr(null);
    setEditId(r.id);
    setForm(null);
    setServerCabins(null);
    setFormErrLines([]);
    setFormLoading(true);
    try {
      const [detailRes, cabinsRes] = await Promise.all([
        apiFlight(token, r.id),
        apiFlightCabins(token, r.id),
      ]);
      const detailWithCabins = {
        ...detailRes.data,
        cabins: cabinsRes.data ?? [],
      };
      setForm(flightFormFromDetail(detailWithCabins));
      setServerCabins({ flightId: r.id, rows: cabinsRes.data ?? [] });
    } catch (e) {
      setEditId(null);
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
        setErr(formatFlightApiValidationErrors(e.body.errors).join(" "));
      } else {
        setErr(e instanceof ApiRequestError ? e.message : "Failed to load flight");
      }
    } finally {
      setFormLoading(false);
    }
  }

  function closeForm() {
    setForm(null);
    setEditId(null);
    setServerCabins(null);
    setFormErrLines([]);
    setFormLoading(false);
  }

  function updateForm<K extends keyof FlightFormPayload>(key: K, value: FlightFormPayload[K]) {
    setForm((p) => (p ? { ...p, [key]: value } : p));
  }

  function updateCabin(idx: number, patch: Partial<FlightCabinFormRow>) {
    setForm((p) => {
      if (!p) return p;
      const next = [...p.cabins];
      next[idx] = { ...next[idx], ...patch };
      return { ...p, cabins: next };
    });
  }

  function addCabin() {
    setForm((p) => {
      if (!p) return p;
      // Pick the first cabin class not already used so the operator can keep adding.
      const used = new Set(p.cabins.map((c) => c.cabin_class));
      const next = FLIGHT_CABIN_CLASSES.find((c) => !used.has(c)) ?? "economy";
      return { ...p, cabins: [...p.cabins, newFlightCabinFormRow({ cabin_class: next })] };
    });
  }

  function removeCabin(idx: number) {
    setForm((p) => {
      if (!p) return p;
      if (p.cabins.length <= 1) return p; // keep at least one
      const next = [...p.cabins];
      next.splice(idx, 1);
      return { ...p, cabins: next };
    });
  }

  async function handleSubmit() {
    if (!token || !form) return;
    const mode = editId != null ? "edit" : "create";
    const validation = validateFlightOperatorForm(form, mode);
    if (validation.length > 0) {
      setFormErrLines(validation);
      return;
    }
    setBusy(true);
    setFormErrLines([]);

    try {
      let flightId: number;
      if (editId != null) {
        const res = await apiUpdateFlight(token, editId, flightUpdateBodyFromForm(form));
        flightId = res.data?.id ?? editId;
      } else {
        const res = await apiCreateFlight(token, flightCreateBodyFromForm(form));
        flightId = res.data?.id ?? 0;
      }

      // Sync cabins via the dedicated endpoints.
      if (flightId > 0) {
        const persisted = serverCabins?.rows ?? [];
        const { toDelete, toUpdate, toCreate } = diffFlightCabins(form.cabins, persisted);

        // 1) Delete first so duplicates don't collide on create.
        for (const id of toDelete) {
          try {
            await apiDeleteFlightCabin(token, flightId, id);
          } catch {
            // best-effort; surface in subsequent fetch
          }
        }
        // 2) Updates.
        for (const u of toUpdate) {
          try {
            await apiUpdateFlightCabin(token, flightId, u.id, u.body);
          } catch (e) {
            if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
              throw e;
            }
          }
        }
        // 3) Creates.
        // Note: the legacy FlightController auto-creates a cabin from the inline
        // primary fields on POST /flights. On CREATE we therefore skip the FIRST
        // cabin (it's already represented by the inline primary) and create the
        // rest. On UPDATE, no auto-cabin is created, so we send every "create".
        const startIdx = editId == null && persisted.length === 0 ? 1 : 0;
        for (let i = startIdx; i < toCreate.length; i++) {
          try {
            await apiCreateFlightCabin(token, flightId, toCreate[i]);
          } catch (e) {
            if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
              throw e;
            }
          }
        }
      }

      closeForm();
      await load();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422 && e.body?.errors) {
        setFormErrLines(formatFlightApiValidationErrors(e.body.errors));
      } else {
        setFormErrLines([e instanceof ApiRequestError ? e.message : "Failed"]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    const ok = await confirm({ messageKey: "admin.crud.flights.delete_confirm", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteFlight(token, id);
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
        <h1 className="admin-page-title">{t("admin.crud.flights.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );
  }

  const toggleSection = (k: SectionKey) =>
    setOpenSection((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {t("admin.crud.flights.title")}
            {form === null && <ContentLanguagePill />}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ImportExportButtons
              busy={busy || exportBusy}
              exportDisabled={!token}
              onTemplate={() => downloadCsvFile("flights-template.csv", flightTemplateCsv())}
              onExport={async () => {
                if (!token) return;
                setExportBusy(true);
                try {
                  const csv = await exportFlightsCsv(token);
                  downloadCsvFile(csvExportFilename("flights"), csv);
                } catch (e) {
                  alert(e instanceof ApiRequestError ? e.message : "Export failed");
                } finally {
                  setExportBusy(false);
                }
              }}
              onImport={() => setImportOpen(true)}
            />
            <Button size="sm" onClick={openCreate}>
              {t("admin.crud.flights.new_btn")}
            </Button>
          </div>
        }
      />

      {err && (
        <div className="rounded-zulu border border-error-100 bg-error-50 px-4 py-2 text-sm text-error-700">{err}</div>
      )}

      {formLoading && editId != null && !form && (
        <div className="admin-card p-4 text-sm text-fg-t6">Loading flight…</div>
      )}

      {form && (
        <section className="admin-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {editId ? "Edit flight" : "New flight"}
            </h2>
            <Button variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
          </div>

          {/* 1 — GENERAL */}
          <Section sectionKey="general" open={openSection.general} onToggle={() => toggleSection("general")}>
            <div className="grid gap-3 sm:grid-cols-2">
              {editId == null && (
                <Field label="Offer ID" required hint="Must be an existing offer of type=flight">
                  <input
                    type="number"
                    min={1}
                    value={form.offer_id === "" ? "" : form.offer_id}
                    onChange={(e) =>
                      updateForm("offer_id", e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className={inputCls}
                  />
                </Field>
              )}
              <Field label="Flight code (internal)" required hint="e.g. SU1869 / W6361">
                <input
                  value={form.flight_code_internal}
                  onChange={(e) => updateForm("flight_code_internal", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Service type" required>
                <select
                  value={form.service_type}
                  onChange={(e) => updateForm("service_type", e.target.value)}
                  className={inputCls}
                >
                  {FLIGHT_SERVICE_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {flightServiceTypeLabel(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lifecycle status" required>
                <select
                  value={form.status}
                  onChange={(e) => updateForm("status", e.target.value)}
                  className={inputCls}
                >
                  {FLIGHT_LIFECYCLE_STATUSES.map((v) => (
                    <option key={v} value={v}>
                      {flightLifecycleStatusLabel(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <ImageUploadField
                  value={form.main_image}
                  onChange={(v) => updateForm("main_image", v)}
                  section="flights"
                  label="Main image"
                  altText="Flight preview"
                />
              </div>
              <Field
                label="Short description"
                hint="(կարճ նկարագրություն թռիչքի մասին` ցույց է տրվում card / detail էջում)"
              >
                <textarea
                  rows={3}
                  value={form.short_description}
                  onChange={(e) => updateForm("short_description", e.target.value)}
                  className={inputCls}
                  placeholder="Direct flight from Yerevan to Moscow, Aeroflot operated."
                />
              </Field>
            </div>
          </Section>

          {/* 2 — DEPARTURE */}
          <Section sectionKey="departure" open={openSection.departure} onToggle={() => toggleSection("departure")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <LocationCascadeSelect
                  token={token}
                  value={form.departure_location_id === "" ? null : Number(form.departure_location_id)}
                  label="Departure location (Country → Region → City) ★"
                  onChange={(locationId, meta) =>
                    setForm((p) =>
                      p
                        ? {
                            ...p,
                            departure_location_id: locationId ?? "",
                            departure_country: meta.country?.name ?? p.departure_country,
                            departure_city:
                              meta.city?.name ?? meta.region?.name ?? p.departure_city,
                          }
                        : p
                    )
                  }
                />
              </div>
              <Field label="Departure airport" required hint="e.g. Zvartnots International Airport">
                <input
                  value={form.departure_airport}
                  onChange={(e) => updateForm("departure_airport", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Airport IATA code" hint="e.g. EVN, SVO, DXB">
                <input
                  maxLength={8}
                  value={form.departure_airport_code}
                  onChange={(e) => updateForm("departure_airport_code", e.target.value.toUpperCase())}
                  className={inputCls}
                />
              </Field>
              <Field label="Departure terminal">
                <input
                  value={form.departure_terminal}
                  onChange={(e) => updateForm("departure_terminal", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Departure city (override)">
                <input
                  value={form.departure_city}
                  onChange={(e) => updateForm("departure_city", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Departure country (override)">
                <input
                  value={form.departure_country}
                  onChange={(e) => updateForm("departure_country", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* 3 — ARRIVAL */}
          <Section sectionKey="arrival" open={openSection.arrival} onToggle={() => toggleSection("arrival")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <LocationCascadeSelect
                  token={token}
                  value={form.arrival_location_id === "" ? null : Number(form.arrival_location_id)}
                  label="Arrival location (Country → Region → City) ★"
                  onChange={(locationId, meta) =>
                    setForm((p) =>
                      p
                        ? {
                            ...p,
                            arrival_location_id: locationId ?? "",
                            arrival_country: meta.country?.name ?? p.arrival_country,
                            arrival_city: meta.city?.name ?? meta.region?.name ?? p.arrival_city,
                          }
                        : p
                    )
                  }
                />
              </div>
              <Field label="Arrival airport" required>
                <input
                  value={form.arrival_airport}
                  onChange={(e) => updateForm("arrival_airport", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Airport IATA code">
                <input
                  maxLength={8}
                  value={form.arrival_airport_code}
                  onChange={(e) => updateForm("arrival_airport_code", e.target.value.toUpperCase())}
                  className={inputCls}
                />
              </Field>
              <Field label="Arrival terminal">
                <input
                  value={form.arrival_terminal}
                  onChange={(e) => updateForm("arrival_terminal", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Arrival city (override)">
                <input
                  value={form.arrival_city}
                  onChange={(e) => updateForm("arrival_city", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Arrival country (override)">
                <input
                  value={form.arrival_country}
                  onChange={(e) => updateForm("arrival_country", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* 4 — SCHEDULE */}
          <Section sectionKey="schedule" open={openSection.schedule} onToggle={() => toggleSection("schedule")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Departure at" required>
                <input
                  type="datetime-local"
                  value={form.departure_at}
                  onChange={(e) => updateForm("departure_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Arrival at" required>
                <input
                  type="datetime-local"
                  value={form.arrival_at}
                  onChange={(e) => updateForm("arrival_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Duration (minutes)" required>
                <input
                  type="number"
                  min={1}
                  value={form.duration_minutes === "" ? "" : form.duration_minutes}
                  onChange={(e) =>
                    updateForm("duration_minutes", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Timezone context" hint="e.g. Europe/Moscow → useful for displaying arrival in local time">
                <input
                  value={form.timezone_context}
                  onChange={(e) => updateForm("timezone_context", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Check-in closes at">
                <input
                  type="datetime-local"
                  value={form.check_in_close_at}
                  onChange={(e) => updateForm("check_in_close_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Boarding closes at">
                <input
                  type="datetime-local"
                  value={form.boarding_close_at}
                  onChange={(e) => updateForm("boarding_close_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Connection type" required>
                <select
                  value={form.connection_type}
                  onChange={(e) => updateForm("connection_type", e.target.value)}
                  className={inputCls}
                >
                  {FLIGHT_CONNECTION_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stops count" required>
                <input
                  type="number"
                  min={0}
                  value={form.stops_count === "" ? "" : form.stops_count}
                  onChange={(e) =>
                    updateForm("stops_count", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className={inputCls}
                />
              </Field>
              {form.connection_type !== "direct" && (
                <>
                  <Field label="Connection notes">
                    <input
                      value={form.connection_notes}
                      onChange={(e) => updateForm("connection_notes", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Layover summary">
                    <input
                      value={form.layover_summary}
                      onChange={(e) => updateForm("layover_summary", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </>
              )}
            </div>
          </Section>

          {/* 5 — AGE TIERS */}
          <Section sectionKey="ages" open={openSection.ages} onToggle={() => toggleSection("ages")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Adult age from" required>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={form.adult_age_from === "" ? "" : form.adult_age_from}
                  onChange={(e) => updateForm("adult_age_from", e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Child age from" required>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={form.child_age_from === "" ? "" : form.child_age_from}
                  onChange={(e) => updateForm("child_age_from", e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Child age to" required>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={form.child_age_to === "" ? "" : form.child_age_to}
                  onChange={(e) => updateForm("child_age_to", e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Infant age from" required>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={form.infant_age_from === "" ? "" : form.infant_age_from}
                  onChange={(e) => updateForm("infant_age_from", e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
              <Field label="Infant age to" required>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={form.infant_age_to === "" ? "" : form.infant_age_to}
                  onChange={(e) => updateForm("infant_age_to", e.target.value === "" ? "" : Number(e.target.value))}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* 6 — CABIN CLASSES (nested rows) */}
          <Section sectionKey="cabins" open={openSection.cabins} onToggle={() => toggleSection("cabins")}>
            <p className="mb-3 text-xs text-fg-t6">
              Add one row per cabin class (Economy, Business, …). The first row is the primary
              cabin and is shown as the default price on the card.
            </p>
            <div className="flex flex-col gap-3">
              {form.cabins.map((cabin, idx) => (
                <div key={cabin.client_key} className="rounded border border-default bg-figma-bg-1 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-fg-t6">
                      Cabin #{idx + 1}
                      {idx === 0 ? " · primary" : ""}
                    </span>
                    {form.cabins.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeCabin(idx)}
                        className="text-xs text-error-600 hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Cabin class" required>
                      <select
                        value={cabin.cabin_class}
                        onChange={(e) => updateCabin(idx, { cabin_class: e.target.value })}
                        className={inputCls}
                      >
                        {FLIGHT_CABIN_CLASSES.map((v) => (
                          <option key={v} value={v}>
                            {flightCabinClassLabel(v)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Seats total" required>
                      <input
                        type="number"
                        min={0}
                        value={cabin.seat_capacity_total === "" ? "" : cabin.seat_capacity_total}
                        onChange={(e) =>
                          updateCabin(idx, {
                            seat_capacity_total: e.target.value === "" ? "" : Number(e.target.value),
                          })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Seats available" required>
                      <input
                        type="number"
                        min={0}
                        value={cabin.seat_capacity_available === "" ? "" : cabin.seat_capacity_available}
                        onChange={(e) =>
                          updateCabin(idx, {
                            seat_capacity_available: e.target.value === "" ? "" : Number(e.target.value),
                          })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Adult price (USD)" required>
                      <input
                        type="number"
                        step="0.01"
                        min={0.01}
                        value={cabin.adult_price === "" ? "" : cabin.adult_price}
                        onChange={(e) =>
                          updateCabin(idx, { adult_price: e.target.value === "" ? "" : Number(e.target.value) })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Child price (USD)" required>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={cabin.child_price === "" ? "" : cabin.child_price}
                        onChange={(e) =>
                          updateCabin(idx, { child_price: e.target.value === "" ? "" : Number(e.target.value) })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Infant price (USD)" required>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={cabin.infant_price === "" ? "" : cabin.infant_price}
                        onChange={(e) =>
                          updateCabin(idx, { infant_price: e.target.value === "" ? "" : Number(e.target.value) })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Fare family">
                      <input
                        value={cabin.fare_family}
                        onChange={(e) => updateCabin(idx, { fare_family: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. Lite, Standard, Flex"
                      />
                    </Field>
                    <Field label="Hand baggage weight">
                      <input
                        value={cabin.hand_baggage_weight}
                        onChange={(e) => updateCabin(idx, { hand_baggage_weight: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. 8kg"
                      />
                    </Field>
                    <Field label="Checked baggage weight">
                      <input
                        value={cabin.checked_baggage_weight}
                        onChange={(e) => updateCabin(idx, { checked_baggage_weight: e.target.value })}
                        className={inputCls}
                        placeholder="e.g. 23kg"
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={cabin.hand_baggage_included}
                        onChange={(e) => updateCabin(idx, { hand_baggage_included: e.target.checked })}
                      />
                      Hand baggage included
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={cabin.checked_baggage_included}
                        onChange={(e) => updateCabin(idx, { checked_baggage_included: e.target.checked })}
                      />
                      Checked baggage included
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={cabin.extra_baggage_allowed}
                        onChange={(e) => updateCabin(idx, { extra_baggage_allowed: e.target.checked })}
                      />
                      Extra baggage allowed
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={cabin.seat_map_available}
                        onChange={(e) => updateCabin(idx, { seat_map_available: e.target.checked })}
                      />
                      Seat map available
                    </label>
                  </div>
                </div>
              ))}
              {form.cabins.length < FLIGHT_CABIN_CLASSES.length ? (
                <button
                  type="button"
                  onClick={addCabin}
                  className="self-start rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-figma-bg-1"
                >
                  + Add cabin class
                </button>
              ) : null}
            </div>
          </Section>

          {/* 7 — POLICIES */}
          <Section sectionKey="policies" open={openSection.policies} onToggle={() => toggleSection("policies")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cancellation policy" required>
                <select
                  value={form.cancellation_policy_type}
                  onChange={(e) => updateForm("cancellation_policy_type", e.target.value)}
                  className={inputCls}
                >
                  {FLIGHT_CANCELLATION_POLICY_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {flightCancellationPolicyLabel(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Change policy" required>
                <select
                  value={form.change_policy_type}
                  onChange={(e) => updateForm("change_policy_type", e.target.value)}
                  className={inputCls}
                >
                  {FLIGHT_CHANGE_POLICY_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {flightChangePolicyLabel(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reservation deadline">
                <input
                  type="datetime-local"
                  value={form.reservation_deadline_at}
                  onChange={(e) => updateForm("reservation_deadline_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Cancellation deadline">
                <input
                  type="datetime-local"
                  value={form.cancellation_deadline_at}
                  onChange={(e) => updateForm("cancellation_deadline_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Change deadline">
                <input
                  type="datetime-local"
                  value={form.change_deadline_at}
                  onChange={(e) => updateForm("change_deadline_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Policy notes">
                <textarea
                  rows={2}
                  value={form.policy_notes}
                  onChange={(e) => updateForm("policy_notes", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.reservation_allowed}
                    onChange={(e) => updateForm("reservation_allowed", e.target.checked)}
                  />
                  Reservation allowed
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.online_checkin_allowed}
                    onChange={(e) => updateForm("online_checkin_allowed", e.target.checked)}
                  />
                  Online check-in allowed
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.airport_checkin_allowed}
                    onChange={(e) => updateForm("airport_checkin_allowed", e.target.checked)}
                  />
                  Airport check-in allowed
                </label>
              </div>
            </div>
          </Section>

          {/* 8 — VISIBILITY */}
          <Section sectionKey="visibility" open={openSection.visibility} onToggle={() => toggleSection("visibility")}>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_package_eligible}
                  onChange={(e) => updateForm("is_package_eligible", e.target.checked)}
                />
                Eligible for use inside packages
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.appears_in_web}
                  onChange={(e) => updateForm("appears_in_web", e.target.checked)}
                />
                Appears on public website (zulu.am)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.appears_in_admin}
                  onChange={(e) => updateForm("appears_in_admin", e.target.checked)}
                />
                Appears in operator admin lists
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.appears_in_zulu_admin}
                  onChange={(e) => updateForm("appears_in_zulu_admin", e.target.checked)}
                />
                Appears in ZULU super-admin lists
              </label>
            </div>
          </Section>

          {formErrLines.length > 0 && (
            <div className="mt-3 rounded border border-error-200 bg-error-50 p-3 text-sm text-error-700">
              <p className="mb-1 font-semibold">Please fix the following:</p>
              <ul className="ml-4 list-disc">
                {formErrLines.slice(0, 8).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {editId !== null && (
            <div className="mt-6 rounded-zulu border border-default bg-figma-bg-1 p-3">
              <h3 className="mb-2 text-sm font-medium text-fg-t6">
                Translations <span className="text-fg-t7 font-normal">(EN-ից բացի՝ RU / HY)</span>
              </h3>
              <TranslationTabs
                entityType="flight"
                entityId={editId}
                fields={[
                  { name: "title", label: "Title" },
                  { name: "description", label: "Description", multiline: true },
                ]}
              />
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void handleSubmit()}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {/* List of flights */}
      <Table>
        <THead>
          <TR>
            <TH>ID</TH>
            <TH>Code</TH>
            <TH>Route</TH>
            <TH>Departure</TH>
            <TH>Review</TH>
            <TH>Status</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={7}>No flights yet.</TEmpty>
          ) : null}
          {rows.map((r) => (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7">{r.id}</TD>
              <TD className="font-medium">{r.flight_code_internal ?? "—"}</TD>
              <TD className="text-xs">
                {r.departure_airport_code ?? r.departure_city ?? "?"} →{" "}
                {r.arrival_airport_code ?? r.arrival_city ?? "?"}
              </TD>
              <TD className="text-xs">
                {formatDateTime(r.departure_at, lang)}
              </TD>
              <TD>
                <OfferStatusBadge status={r.offer?.status ?? null} />
              </TD>
              <TD className="text-xs">{r.status ?? "—"}</TD>
              <TD>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => void openEdit(r)}
                    className="text-left text-xs text-info-700 hover:underline"
                  >
                    Edit
                  </button>
                  {r.offer?.id && isSubmittableStatus(r.offer.status) && (
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() => void handleSubmitForReview(r.offer!.id!)}
                      className="self-start"
                    >
                      Submit for review
                    </Button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(r.id)}
                    className="text-left text-xs text-error-600 hover:underline disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
      <CsvImportModal
        open={importOpen}
        title={t("admin.crud.flights.import_title")}
        onClose={() => setImportOpen(false)}
        onRun={async (csvRows, rowLineNumbers) => {
          if (!token) {
            return {
              success: 0,
              failed: csvRows.length,
              errors: [{ rowNumber: rowLineNumbers[0] ?? 2, message: "Not signed in." }],
            };
          }
          const res = await runFlightCsvImport(token, csvRows, rowLineNumbers);
          if (res.success > 0) await load();
          return res;
        }}
      />
    </div>
  );
}
