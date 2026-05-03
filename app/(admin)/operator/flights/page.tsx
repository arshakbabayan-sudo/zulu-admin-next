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
  exportFlightsCsv,
  flightTemplateCsv,
  runFlightCsvImport,
} from "@/lib/csv-import-export";
import {
  apiFlights, apiFlight, apiCreateFlight, apiUpdateFlight, apiDeleteFlight,
  apiFlightCabins, apiCreateFlightCabin, apiUpdateFlightCabin, apiDeleteFlightCabin,
  type FlightRow, type FlightPayload, type FlightCabinPayload, type FlightCabinRow,
} from "@/lib/inventory-crud-api";
import { BACKEND_FLIGHT_STATUSES, backendFlightStatusLabel } from "@/lib/flight-status";
import {
  FLIGHT_CABIN_CLASS_OPTIONS,
  flightCabinClassLabel,
  toCanonicalFlightCabinClass,
} from "@/lib/flight-cabin-class";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";

type FieldType = "text" | "number" | "datetime-local" | "select" | "boolean";

type FlightField = {
  key: keyof FlightPayload;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
};

type FlightWizardStep = "general" | "schedule" | "classPricing" | "policies" | "review";

const SERVICE_TYPES = ["scheduled", "charter", "package_flight", "private_special"];
const CONNECTION_TYPES = ["direct", "connected"];
const CANCELLATION_POLICY_TYPES = ["non_refundable", "partially_refundable", "fully_refundable"];
const CHANGE_POLICY_TYPES = ["not_allowed", "paid_change", "free_change"];
const STATUSES = [...BACKEND_FLIGHT_STATUSES];

const FIELDS: FlightField[] = [
  { key: "offer_id", label: "Offer ID", type: "number", required: true },
  { key: "flight_code_internal", label: "Flight Code Internal", type: "text", required: true },
  { key: "service_type", label: "Service Type", type: "select", options: SERVICE_TYPES, required: true },
  { key: "departure_country", label: "Departure Country", type: "text", required: true },
  { key: "departure_city", label: "Departure City", type: "text", required: true },
  { key: "departure_airport", label: "Departure Airport", type: "text", required: true },
  { key: "arrival_country", label: "Arrival Country", type: "text", required: true },
  { key: "arrival_city", label: "Arrival City", type: "text", required: true },
  { key: "arrival_airport", label: "Arrival Airport", type: "text", required: true },
  { key: "departure_airport_code", label: "Departure Airport Code", type: "text" },
  { key: "arrival_airport_code", label: "Arrival Airport Code", type: "text" },
  { key: "departure_terminal", label: "Departure Terminal", type: "text" },
  { key: "arrival_terminal", label: "Arrival Terminal", type: "text" },
  { key: "departure_at", label: "Departure At", type: "datetime-local", required: true },
  { key: "arrival_at", label: "Arrival At", type: "datetime-local", required: true },
  { key: "duration_minutes", label: "Duration Minutes", type: "number", required: true },
  { key: "timezone_context", label: "Timezone Context", type: "text" },
  { key: "check_in_close_at", label: "Check-in Close At", type: "datetime-local" },
  { key: "boarding_close_at", label: "Boarding Close At", type: "datetime-local" },
  { key: "connection_type", label: "Connection Type", type: "select", options: CONNECTION_TYPES, required: true },
  { key: "stops_count", label: "Stops Count", type: "number", required: true },
  { key: "connection_notes", label: "Connection Notes", type: "text" },
  { key: "layover_summary", label: "Layover Summary", type: "text" },
  {
    key: "cabin_class",
    label: "Cabin Class",
    type: "select",
    options: FLIGHT_CABIN_CLASS_OPTIONS.map((item) => item.value),
    required: true,
  },
  { key: "seat_capacity_total", label: "Seat Capacity Total", type: "number", required: true },
  { key: "seat_capacity_available", label: "Seat Capacity Available", type: "number", required: true },
  { key: "fare_family", label: "Fare Family", type: "text" },
  { key: "seat_map_available", label: "Seat Map Available", type: "boolean", required: true },
  { key: "seat_selection_policy", label: "Seat Selection Policy", type: "text" },
  { key: "adult_age_from", label: "Adult Age From", type: "number", required: true },
  { key: "child_age_from", label: "Child Age From", type: "number", required: true },
  { key: "child_age_to", label: "Child Age To", type: "number", required: true },
  { key: "infant_age_from", label: "Infant Age From", type: "number", required: true },
  { key: "infant_age_to", label: "Infant Age To", type: "number", required: true },
  { key: "adult_price", label: "Adult Price", type: "number", required: true },
  { key: "child_price", label: "Child Price", type: "number", required: true },
  { key: "infant_price", label: "Infant Price", type: "number", required: true },
  { key: "hand_baggage_included", label: "Hand Baggage Included", type: "boolean", required: true },
  { key: "checked_baggage_included", label: "Checked Baggage Included", type: "boolean", required: true },
  { key: "hand_baggage_weight", label: "Hand Baggage Weight", type: "text" },
  { key: "checked_baggage_weight", label: "Checked Baggage Weight", type: "text" },
  { key: "extra_baggage_allowed", label: "Extra Baggage Allowed", type: "boolean", required: true },
  { key: "baggage_notes", label: "Baggage Notes", type: "text" },
  { key: "reservation_allowed", label: "Reservation Allowed", type: "boolean", required: true },
  { key: "online_checkin_allowed", label: "Online Check-in Allowed", type: "boolean", required: true },
  { key: "airport_checkin_allowed", label: "Airport Check-in Allowed", type: "boolean", required: true },
  { key: "cancellation_policy_type", label: "Cancellation Policy Type", type: "select", options: CANCELLATION_POLICY_TYPES, required: true },
  { key: "change_policy_type", label: "Change Policy Type", type: "select", options: CHANGE_POLICY_TYPES, required: true },
  { key: "reservation_deadline_at", label: "Reservation Deadline At", type: "datetime-local" },
  { key: "cancellation_deadline_at", label: "Cancellation Deadline At", type: "datetime-local" },
  { key: "change_deadline_at", label: "Change Deadline At", type: "datetime-local" },
  { key: "policy_notes", label: "Policy Notes", type: "text" },
  { key: "is_package_eligible", label: "Is Package Eligible", type: "boolean", required: true },
  { key: "appears_in_web", label: "Appears In Web", type: "boolean", required: true },
  { key: "appears_in_admin", label: "Appears In Admin", type: "boolean", required: true },
  { key: "appears_in_zulu_admin", label: "Appears In Zulu Admin", type: "boolean", required: true },
  { key: "status", label: "Status", type: "select", options: STATUSES, required: true },
];

const WIZARD_STEPS: { key: FlightWizardStep; label: string }[] = [
  { key: "general", label: "1) General route/info" },
  { key: "schedule", label: "2) Schedule/duration" },
  { key: "classPricing", label: "3) Class pricing/seats" },
  { key: "policies", label: "4) Policies" },
  { key: "review", label: "5) Review/submit" },
];

const FLIGHT_STEP_LABEL_KEYS: Record<FlightWizardStep, string> = {
  general: "admin.crud.flights.step.general",
  schedule: "admin.crud.flights.step.schedule",
  classPricing: "admin.crud.flights.step.class_pricing",
  policies: "admin.crud.flights.step.policies",
  review: "admin.crud.flights.step.review",
};

const STEP_FIELDS: Record<Exclude<FlightWizardStep, "review">, (keyof FlightPayload)[]> = {
  general: [
    "offer_id",
    "flight_code_internal",
    "service_type",
    "departure_country",
    "departure_city",
    "departure_airport",
    "arrival_country",
    "arrival_city",
    "arrival_airport",
    "departure_airport_code",
    "arrival_airport_code",
    "departure_terminal",
    "arrival_terminal",
    "status",
  ],
  schedule: [
    "departure_at",
    "arrival_at",
    "duration_minutes",
    "timezone_context",
    "check_in_close_at",
    "boarding_close_at",
    "connection_type",
    "stops_count",
    "connection_notes",
    "layover_summary",
  ],
  classPricing: [
    "cabin_class",
    "seat_capacity_total",
    "seat_capacity_available",
    "fare_family",
    "seat_map_available",
    "seat_selection_policy",
    "adult_age_from",
    "child_age_from",
    "child_age_to",
    "infant_age_from",
    "infant_age_to",
    "adult_price",
    "child_price",
    "infant_price",
    "hand_baggage_included",
    "checked_baggage_included",
    "hand_baggage_weight",
    "checked_baggage_weight",
    "extra_baggage_allowed",
    "baggage_notes",
  ],
  policies: [
    "reservation_allowed",
    "online_checkin_allowed",
    "airport_checkin_allowed",
    "cancellation_policy_type",
    "change_policy_type",
    "reservation_deadline_at",
    "cancellation_deadline_at",
    "change_deadline_at",
    "policy_notes",
    "is_package_eligible",
    "appears_in_web",
    "appears_in_admin",
    "appears_in_zulu_admin",
  ],
};

const EMPTY: FlightPayload = {
  offer_id: "",
  location_id: "",
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
  duration_minutes: 0,
  timezone_context: "",
  check_in_close_at: "",
  boarding_close_at: "",
  connection_type: "direct",
  stops_count: 0,
  connection_notes: "",
  layover_summary: "",
  cabin_class: "economy",
  seat_capacity_total: 0,
  seat_capacity_available: 0,
  fare_family: "",
  seat_map_available: false,
  seat_selection_policy: "",
  adult_age_from: 12,
  child_age_from: 2,
  child_age_to: 11,
  infant_age_from: 0,
  infant_age_to: 1,
  adult_price: 1,
  child_price: 0,
  infant_price: 0,
  hand_baggage_included: false,
  checked_baggage_included: false,
  hand_baggage_weight: "",
  checked_baggage_weight: "",
  extra_baggage_allowed: false,
  baggage_notes: "",
  reservation_allowed: false,
  online_checkin_allowed: false,
  airport_checkin_allowed: false,
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
};

const EMPTY_CABIN: FlightCabinPayload = {
  cabin_class: "economy",
  seat_capacity_total: 0,
  seat_capacity_available: 0,
  adult_price: 1,
  child_price: 0,
  infant_price: 0,
  hand_baggage_included: false,
  hand_baggage_weight: "",
  checked_baggage_included: false,
  checked_baggage_weight: "",
  extra_baggage_allowed: false,
  baggage_notes: "",
  fare_family: "",
  seat_map_available: false,
  seat_selection_policy: "",
};

function normalizeDatetimeForInput(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function stripEmptyNullable(payload: FlightPayload): FlightPayload {
  const copy = { ...payload };
  const nullableKeys: (keyof FlightPayload)[] = [
    "departure_airport_code",
    "arrival_airport_code",
    "departure_terminal",
    "arrival_terminal",
    "timezone_context",
    "check_in_close_at",
    "boarding_close_at",
    "connection_notes",
    "layover_summary",
    "fare_family",
    "seat_selection_policy",
    "hand_baggage_weight",
    "checked_baggage_weight",
    "baggage_notes",
    "reservation_deadline_at",
    "cancellation_deadline_at",
    "change_deadline_at",
    "policy_notes",
  ];
  for (const key of nullableKeys) {
    if (copy[key] === "") copy[key] = null;
  }
  return copy;
}

function stripEmptyCabinNullable(payload: FlightCabinPayload): FlightCabinPayload {
  const copy = { ...payload };
  const nullableKeys: (keyof FlightCabinPayload)[] = [
    "hand_baggage_weight",
    "checked_baggage_weight",
    "baggage_notes",
    "fare_family",
    "seat_selection_policy",
  ];
  for (const key of nullableKeys) {
    if (copy[key] === "") copy[key] = null;
  }
  return copy;
}

function validateFlightForm(form: FlightPayload): string[] {
  const errors: string[] = [];
  const requiredText: { key: keyof FlightPayload; label: string }[] = [
    { key: "flight_code_internal", label: "Flight Code Internal" },
    { key: "departure_country", label: "Departure Country" },
    { key: "departure_city", label: "Departure City" },
    { key: "departure_airport", label: "Departure Airport" },
    { key: "arrival_country", label: "Arrival Country" },
    { key: "arrival_city", label: "Arrival City" },
    { key: "arrival_airport", label: "Arrival Airport" },
  ];
  for (const field of requiredText) {
    if (String(form[field.key] ?? "").trim() === "") {
      errors.push(`${field.label} is required.`);
    }
  }
  if (form.offer_id === "" || form.offer_id == null || Number(form.offer_id) <= 0) {
    errors.push("Offer ID must be a valid positive number.");
  }
  if (!form.departure_at || !form.arrival_at) {
    errors.push("Departure At and Arrival At are required.");
  } else if (new Date(form.arrival_at).getTime() <= new Date(form.departure_at).getTime()) {
    errors.push("Arrival At must be after Departure At.");
  }
  if (Number(form.adult_price ?? 0) <= 0) {
    errors.push("Adult Price must be greater than 0.");
  }

  return errors;
}

function validateFlightStep(form: FlightPayload, step: FlightWizardStep): string[] {
  if (step === "review") return validateFlightForm(form);

  const errors = validateFlightForm(form);
  const stepKeys = new Set<keyof FlightPayload>(STEP_FIELDS[step]);
  const labelByKey = new Map<keyof FlightPayload, string>(FIELDS.map((f) => [f.key, f.label]));
  return errors.filter((message) => {
    for (const key of stepKeys) {
      const label = labelByKey.get(key);
      if (label && message.includes(label)) return true;
    }
    if (step === "schedule" && message.includes("Departure At and Arrival At")) return true;
    if (step === "schedule" && message.includes("Arrival At must be after Departure At")) return true;
    return false;
  });
}

function validateCabinForm(form: FlightCabinPayload): string[] {
  const errors: string[] = [];
  if (!form.cabin_class) {
    errors.push("Cabin Class is required.");
  }
  if (Number(form.adult_price ?? 0) <= 0) {
    errors.push("Adult Price must be greater than 0.");
  }
  if (Number(form.seat_capacity_total ?? 0) < 0 || Number(form.seat_capacity_available ?? 0) < 0) {
    errors.push("Seat capacities cannot be negative.");
  }
  if (Number(form.seat_capacity_available ?? 0) > Number(form.seat_capacity_total ?? 0)) {
    errors.push("Available seats cannot exceed total seats.");
  }
  return errors;
}

export default function OperatorFlightsPage() {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [rows, setRows] = useState<FlightRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<FlightPayload | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<FlightWizardStep>("general");
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [activeCabinFlightId, setActiveCabinFlightId] = useState<number | null>(null);
  const [cabinsByFlight, setCabinsByFlight] = useState<Record<number, FlightCabinRow[]>>({});
  const [cabinForm, setCabinForm] = useState<FlightCabinPayload | null>(null);
  const [editCabinId, setEditCabinId] = useState<number | null>(null);
  const [cabinBusy, setCabinBusy] = useState(false);
  const [cabinErr, setCabinErr] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null); setForbidden(false);
    try {
      const res = await apiFlights(token, { page, per_page: 20 });
      setRows(res.data); setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : "Failed");
    }
  }, [token, page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY });
    setFormErr(null);
    setWizardStep("general");
    setStepErrors([]);
  }
  async function openEdit(r: FlightRow) {
    if (!token) return;
    setEditId(r.id);
    setBusy(true);
    setFormErr(null);
    try {
      const res = await apiFlight(token, r.id);
      const raw = (res.data ?? {}) as FlightPayload;
      const next: FlightPayload = { ...EMPTY, ...raw };
      next.cabin_class = toCanonicalFlightCabinClass(raw.cabin_class as string | null | undefined) ?? "economy";
      next.departure_at = normalizeDatetimeForInput(raw.departure_at);
      next.arrival_at = normalizeDatetimeForInput(raw.arrival_at);
      next.check_in_close_at = normalizeDatetimeForInput(raw.check_in_close_at);
      next.boarding_close_at = normalizeDatetimeForInput(raw.boarding_close_at);
      next.reservation_deadline_at = normalizeDatetimeForInput(raw.reservation_deadline_at);
      next.cancellation_deadline_at = normalizeDatetimeForInput(raw.cancellation_deadline_at);
      next.change_deadline_at = normalizeDatetimeForInput(raw.change_deadline_at);
      setForm(next);
      setWizardStep("general");
      setStepErrors([]);
    } catch (e) {
      setFormErr(e instanceof ApiRequestError ? e.message : "Failed");
      setForm({ ...EMPTY });
    } finally {
      setBusy(false);
    }
  }
  function closeForm() {
    setForm(null);
    setEditId(null);
    setFormErr(null);
    setWizardStep("general");
    setStepErrors([]);
  }

  const fieldByKey = new Map<keyof FlightPayload, FlightField>(FIELDS.map((field) => [field.key, field]));
  const currentStepIndex = WIZARD_STEPS.findIndex((item) => item.key === wizardStep);

  function renderFlightField(field: FlightField) {
    if (!form) return null;
    return (
      <label key={String(field.key)} className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-fg-t6">
          {t(`admin.crud.flights.field.${String(field.key)}`)}
          {field.required ? " *" : ""}
        </span>
        {field.type === "select" && field.options ? (
          <select
            value={String(form[field.key] ?? "")}
            onChange={(e) => setForm((p) => (p ? { ...p, [field.key]: e.target.value } : p))}
            className="rounded border border-default px-2 py-1.5 text-sm"
          >
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {field.key === "status"
                  ? backendFlightStatusLabel(opt)
                  : field.key === "cabin_class"
                    ? flightCabinClassLabel(opt)
                    : opt}
              </option>
            ))}
          </select>
        ) : field.type === "boolean" ? (
          <select
            value={String(Boolean(form[field.key]))}
            onChange={(e) => setForm((p) => (p ? { ...p, [field.key]: e.target.value === "true" } : p))}
            className="rounded border border-default px-2 py-1.5 text-sm"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            value={String(form[field.key] ?? "")}
            onChange={(e) => {
              const nextValue = field.type === "number"
                ? (e.target.value === "" ? "" : Number(e.target.value))
                : e.target.value;
              setForm((p) => (p ? { ...p, [field.key]: nextValue } : p));
            }}
            type={field.type}
            className="rounded border border-default px-2 py-1.5 text-sm"
          />
        )}
      </label>
    );
  }

  function handleNextStep() {
    if (!form) return;
    const errors = validateFlightStep(form, wizardStep);
    setStepErrors(errors);
    if (errors.length > 0) return;
    setFormErr(null);
    const nextStep = WIZARD_STEPS[currentStepIndex + 1];
    if (nextStep) setWizardStep(nextStep.key);
  }

  function handlePreviousStep() {
    const prevStep = WIZARD_STEPS[currentStepIndex - 1];
    if (prevStep) {
      setWizardStep(prevStep.key);
      setStepErrors([]);
    }
  }

  async function handleSubmit() {
    if (!token || !form) return;
    const clientErrors = validateFlightForm(form);
    if (clientErrors.length > 0) {
      setFormErr(clientErrors.slice(0, 3).join(" "));
      return;
    }
    setBusy(true); setFormErr(null);
    try {
      const payload = stripEmptyNullable({
        ...form,
        cabin_class: toCanonicalFlightCabinClass(form.cabin_class as string | null | undefined) ?? "economy",
      });
      if (editId != null) await apiUpdateFlight(token, editId, payload);
      else await apiCreateFlight(token, payload);
      closeForm(); await load();
    } catch (e) { setFormErr(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: number) {
    if (!token || !window.confirm(t("admin.crud.flights.delete_confirm"))) return;
    setBusy(true);
    try { await apiDeleteFlight(token, id); await load(); }
    catch (e) { alert(e instanceof ApiRequestError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  const loadCabins = useCallback(async (flightId: number) => {
    if (!token) return;
    setCabinBusy(true);
    setCabinErr(null);
    try {
      const res = await apiFlightCabins(token, flightId);
      setCabinsByFlight((prev) => ({ ...prev, [flightId]: res.data ?? [] }));
    } catch (e) {
      setCabinErr(e instanceof ApiRequestError ? e.message : "Failed to load cabins");
    } finally {
      setCabinBusy(false);
    }
  }, [token]);

  function openCabinManager(flightId: number) {
    setActiveCabinFlightId((prev) => prev === flightId ? null : flightId);
    setCabinForm(null);
    setEditCabinId(null);
    setCabinErr(null);
    if (activeCabinFlightId !== flightId) void loadCabins(flightId);
  }

  function openCreateCabin() {
    setEditCabinId(null);
    setCabinErr(null);
    setCabinForm({ ...EMPTY_CABIN });
  }

  function openEditCabin(cabin: FlightCabinRow) {
    setEditCabinId(cabin.id);
    setCabinErr(null);
    setCabinForm({
      cabin_class: toCanonicalFlightCabinClass(cabin.cabin_class) ?? "economy",
      seat_capacity_total: cabin.seat_capacity_total,
      seat_capacity_available: cabin.seat_capacity_available,
      adult_price: cabin.adult_price,
      child_price: cabin.child_price,
      infant_price: cabin.infant_price,
      hand_baggage_included: Boolean(cabin.hand_baggage_included),
      hand_baggage_weight: cabin.hand_baggage_weight ?? "",
      checked_baggage_included: Boolean(cabin.checked_baggage_included),
      checked_baggage_weight: cabin.checked_baggage_weight ?? "",
      extra_baggage_allowed: Boolean(cabin.extra_baggage_allowed),
      baggage_notes: cabin.baggage_notes ?? "",
      fare_family: cabin.fare_family ?? "",
      seat_map_available: Boolean(cabin.seat_map_available),
      seat_selection_policy: cabin.seat_selection_policy ?? "",
    });
  }

  function closeCabinForm() {
    setCabinForm(null);
    setEditCabinId(null);
    setCabinErr(null);
  }

  async function handleSubmitCabin() {
    if (!token || !activeCabinFlightId || !cabinForm) return;
    const clientErrors = validateCabinForm(cabinForm);
    if (clientErrors.length > 0) {
      setCabinErr(clientErrors.slice(0, 3).join(" "));
      return;
    }
    setCabinBusy(true);
    setCabinErr(null);
    try {
      const payload = stripEmptyCabinNullable({
        ...cabinForm,
        cabin_class: toCanonicalFlightCabinClass(cabinForm.cabin_class as string | null | undefined) ?? "economy",
      });
      if (editCabinId != null) {
        await apiUpdateFlightCabin(token, activeCabinFlightId, editCabinId, payload);
      } else {
        await apiCreateFlightCabin(token, activeCabinFlightId, payload);
      }
      closeCabinForm();
      await loadCabins(activeCabinFlightId);
    } catch (e) {
      setCabinErr(e instanceof ApiRequestError ? e.message : "Failed");
    } finally {
      setCabinBusy(false);
    }
  }

  async function handleDeleteCabin(cabinId: number) {
    if (!token || !activeCabinFlightId || !window.confirm(t("admin.crud.flights.cabin.delete_confirm"))) return;
    setCabinBusy(true);
    setCabinErr(null);
    try {
      await apiDeleteFlightCabin(token, activeCabinFlightId, cabinId);
      await loadCabins(activeCabinFlightId);
    } catch (e) {
      setCabinErr(e instanceof ApiRequestError ? e.message : "Failed");
    } finally {
      setCabinBusy(false);
    }
  }

  if (forbidden) return (
    <div><h1 className="admin-page-title">{t("admin.crud.flights.title")}</h1><div className="mt-4"><ForbiddenNotice /></div></div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="admin-page-title">{t("admin.crud.flights.title")}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
          <button type="button" onClick={openCreate}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700">{t("admin.crud.flights.new_btn")}</button>
        </div>
      </div>

      <CsvImportModal
        open={importOpen}
        title={t("admin.crud.flights.import_title")}
        onClose={() => setImportOpen(false)}
        onRun={async (rows, rowLineNumbers) => {
          if (!token) {
            return {
              success: 0,
              failed: rows.length,
              errors: [{ rowNumber: rowLineNumbers[0] ?? 2, message: "Not signed in." }],
            };
          }
          const res = await runFlightCsvImport(token, rows, rowLineNumbers);
          if (res.success > 0) await load();
          return res;
        }}
      />

      {err && <p className="mt-2 text-sm text-error-600">{err}</p>}

      {form && (
        <div className="mt-4 rounded border border-default bg-white p-4">
          <h2 className="mb-3 text-base font-medium">{editId ? t("admin.crud.flights.form_edit") : t("admin.crud.flights.form_new")}</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {WIZARD_STEPS.map((step, idx) => {
              const isActive = step.key === wizardStep;
              const isComplete = idx < currentStepIndex;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => {
                    if (!form) return;
                    if (idx <= currentStepIndex) {
                      setWizardStep(step.key);
                      setStepErrors([]);
                    }
                  }}
                  className={`rounded border px-2 py-1 text-xs ${
                    isActive
                      ? "border-slate-800 bg-slate-800 text-white"
                      : isComplete
                        ? "border-default bg-figma-bg-1 text-fg-t7"
                        : "border-default bg-white text-fg-t6"
                  }`}
                >
                  {t(FLIGHT_STEP_LABEL_KEYS[step.key])}
                </button>
              );
            })}
          </div>
          {wizardStep !== "review" ? (
            <>
              {wizardStep === "general" && (
                <div className="mb-3">
                  <LocationCascadeSelect
                    token={token}
                    value={form.location_id === "" || form.location_id == null ? null : Number(form.location_id)}
                    label="Main location"
                    onChange={(locationId) =>
                      setForm((p) => (p ? { ...p, location_id: locationId ?? "" } : p))
                    }
                  />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {STEP_FIELDS[wizardStep].map((key) => {
                  const field = fieldByKey.get(key);
                  return field ? renderFlightField(field) : null;
                })}
              </div>
            </>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={String(field.key)} className="rounded border border-default px-3 py-2 text-sm">
                  <div className="text-xs text-fg-t6">{t(`admin.crud.flights.field.${String(field.key)}`)}</div>
                  <div className="font-medium text-fg-t11">
                    {field.type === "boolean"
                      ? String(Boolean(form[field.key]))
                      : field.key === "cabin_class"
                        ? flightCabinClassLabel(String(form[field.key] ?? ""))
                        : field.key === "status"
                          ? backendFlightStatusLabel(String(form[field.key] ?? ""))
                          : String(form[field.key] ?? "—")}
                  </div>
                </div>
              ))}
            </div>
          )}
          {stepErrors.length > 0 && (
            <p className="mt-2 text-sm text-error-600">{stepErrors.slice(0, 3).join(" ")}</p>
          )}
          {formErr && <p className="mt-2 text-sm text-error-600">{formErr}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handlePreviousStep}
              disabled={currentStepIndex === 0 || busy}
              className="rounded border border-default px-4 py-1.5 text-sm disabled:opacity-40"
            >
              {t("common.prev")}
            </button>
            {wizardStep === "review" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmit()}
                className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {busy ? t("admin.crud.common.saving") : t("admin.crud.flights.submit")}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleNextStep}
                className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {t("common.next")}
              </button>
            )}
            <button type="button" onClick={closeForm}
              className="rounded border border-default px-4 py-1.5 text-sm">{t("common.cancel")}</button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded border border-default bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-default bg-figma-bg-1 text-xs uppercase text-fg-t7">
            <tr>
              <th className="px-3 py-2">{t("admin.crud.common.id")}</th>
              <th className="px-3 py-2">{t("admin.crud.flights.col.flight_num")}</th>
              <th className="px-3 py-2">{t("admin.crud.flights.col.airline")}</th>
              <th className="px-3 py-2">{t("admin.crud.flights.col.route")}</th>
              <th className="px-3 py-2">{t("admin.crud.flights.col.departure")}</th>
              <th className="px-3 py-2">{t("admin.crud.flights.col.arrival")}</th>
              <th className="px-3 py-2">{t("admin.crud.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-fg-t6">{t("admin.crud.flights.empty")}</td></tr>
            )}
            {rows.map((r) => (
              <Fragment key={r.id}>
              <tr className="border-b border-default hover:bg-figma-bg-1">
                <td className="px-3 py-2 tabular-nums text-fg-t7">{r.id}</td>
                <td className="px-3 py-2 font-medium">{r.flight_code_internal ?? r.flight_number ?? "-"}</td>
                <td className="px-3 py-2">{r.company?.name ?? r.airline ?? "-"}</td>
                <td className="px-3 py-2">{r.departure_city ?? r.origin ?? "-"} {"->"} {r.arrival_city ?? r.destination ?? "-"}</td>
                <td className="px-3 py-2 text-xs text-fg-t6">{r.departure_at ? new Date(r.departure_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2 text-xs text-fg-t6">{r.arrival_at ? new Date(r.arrival_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(r)}
                      className="text-xs text-info-700 underline">{t("admin.crud.common.edit")}</button>
                    <button type="button" onClick={() => openCabinManager(r.id)}
                      className="text-xs text-fg-t7 underline">{t("admin.crud.flights.cabins")}</button>
                    <Link
                      href={`/operator/flights/${r.id}/cabins`}
                      className="text-xs text-indigo-700 underline"
                    >
                      Seat map
                    </Link>
                    <button type="button" onClick={() => void handleDelete(r.id)}
                      className="text-xs text-error-600 underline">{t("admin.crud.common.delete")}</button>
                  </div>
                </td>
              </tr>
            {activeCabinFlightId === r.id && (
              <tr className="border-b border-default bg-figma-bg-1">
                <td colSpan={7} className="px-3 py-3">
                  <div className="rounded border border-default bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-fg-t11">{t("admin.crud.flights.cabins")} #{r.id}</h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={openCreateCabin}
                          className="rounded border border-default px-2 py-1 text-xs"
                        >
                          {t("admin.crud.flights.cabin.new_btn")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveCabinFlightId(null)}
                          className="rounded border border-default px-2 py-1 text-xs"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {cabinForm && (
                      <div className="mb-3 rounded border border-default p-3">
                        <h4 className="mb-2 text-sm font-medium">{editCabinId ? t("admin.crud.flights.cabin.form_edit") : t("admin.crud.flights.cabin.form_new")}</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.cabin_class")} *</span>
                            <select
                              value={String(cabinForm.cabin_class ?? "economy")}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, cabin_class: e.target.value } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            >
                              {FLIGHT_CABIN_CLASS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.seat_capacity_total")} *</span>
                            <input
                              type="number"
                              value={String(cabinForm.seat_capacity_total ?? 0)}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, seat_capacity_total: e.target.value === "" ? "" : Number(e.target.value) } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.seat_capacity_available")} *</span>
                            <input
                              type="number"
                              value={String(cabinForm.seat_capacity_available ?? 0)}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, seat_capacity_available: e.target.value === "" ? "" : Number(e.target.value) } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.adult_price")} *</span>
                            <input
                              type="number"
                              value={String(cabinForm.adult_price ?? 1)}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, adult_price: e.target.value === "" ? "" : Number(e.target.value) } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.child_price")} *</span>
                            <input
                              type="number"
                              value={String(cabinForm.child_price ?? 0)}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, child_price: e.target.value === "" ? "" : Number(e.target.value) } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.infant_price")} *</span>
                            <input
                              type="number"
                              value={String(cabinForm.infant_price ?? 0)}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, infant_price: e.target.value === "" ? "" : Number(e.target.value) } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          {[
                            "hand_baggage_included",
                            "checked_baggage_included",
                            "extra_baggage_allowed",
                            "seat_map_available",
                          ].map((key) => (
                            <label key={key} className="flex flex-col gap-1 text-sm">
                              <span className="font-medium text-fg-t6">{t(`admin.crud.flights.field.${key}`)} *</span>
                              <select
                                value={String(Boolean(cabinForm[key as keyof FlightCabinPayload]))}
                                onChange={(e) => setCabinForm((p) => p ? { ...p, [key]: e.target.value === "true" } : p)}
                                className="rounded border border-default px-2 py-1.5 text-sm"
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            </label>
                          ))}
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.hand_baggage_weight")}</span>
                            <input
                              type="text"
                              value={String(cabinForm.hand_baggage_weight ?? "")}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, hand_baggage_weight: e.target.value } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.checked_baggage_weight")}</span>
                            <input
                              type="text"
                              value={String(cabinForm.checked_baggage_weight ?? "")}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, checked_baggage_weight: e.target.value } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.fare_family")}</span>
                            <input
                              type="text"
                              value={String(cabinForm.fare_family ?? "")}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, fare_family: e.target.value } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.seat_selection_policy")}</span>
                            <input
                              type="text"
                              value={String(cabinForm.seat_selection_policy ?? "")}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, seat_selection_policy: e.target.value } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                            <span className="font-medium text-fg-t6">{t("admin.crud.flights.field.baggage_notes")}</span>
                            <input
                              type="text"
                              value={String(cabinForm.baggage_notes ?? "")}
                              onChange={(e) => setCabinForm((p) => p ? { ...p, baggage_notes: e.target.value } : p)}
                              className="rounded border border-default px-2 py-1.5 text-sm"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={cabinBusy}
                            onClick={() => void handleSubmitCabin()}
                            className="rounded bg-slate-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
                          >
                            {cabinBusy ? t("admin.crud.common.saving") : t("common.save")}
                          </button>
                          <button
                            type="button"
                            onClick={closeCabinForm}
                            className="rounded border border-default px-4 py-1.5 text-sm"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </div>
                    )}

                    {cabinErr && <p className="mb-2 text-sm text-error-600">{cabinErr}</p>}

                    <div className="overflow-x-auto rounded border border-default">
                      <table className="w-full min-w-[700px] text-left text-xs">
                        <thead className="border-b border-default bg-figma-bg-1 uppercase text-fg-t7">
                          <tr>
                            <th className="px-2 py-2">{t("admin.crud.flights.cabin.col.class")}</th>
                            <th className="px-2 py-2">{t("admin.crud.flights.cabin.col.seats")}</th>
                            <th className="px-2 py-2">{t("admin.crud.flights.cabin.col.adult")}</th>
                            <th className="px-2 py-2">{t("admin.crud.flights.cabin.col.child")}</th>
                            <th className="px-2 py-2">{t("admin.crud.flights.cabin.col.infant")}</th>
                            <th className="px-2 py-2">{t("admin.crud.common.actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cabinsByFlight[r.id] ?? []).length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-2 py-4 text-center text-fg-t6">
                                {cabinBusy ? t("admin.crud.flights.cabin.loading") : t("admin.crud.flights.cabin.empty")}
                              </td>
                            </tr>
                          )}
                          {(cabinsByFlight[r.id] ?? []).map((cabin) => (
                            <tr key={cabin.id} className="border-b border-default">
                              <td className="px-2 py-2">{flightCabinClassLabel(cabin.cabin_class)}</td>
                              <td className="px-2 py-2">{cabin.seat_capacity_available} / {cabin.seat_capacity_total}</td>
                              <td className="px-2 py-2">{cabin.adult_price}</td>
                              <td className="px-2 py-2">{cabin.child_price}</td>
                              <td className="px-2 py-2">{cabin.infant_price}</td>
                              <td className="px-2 py-2">
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditCabin(cabin)}
                                    className="text-xs text-info-700 underline"
                                  >
                                    {t("admin.crud.common.edit")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteCabin(cabin.id)}
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
                  </div>
                </td>
              </tr>
            )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}
