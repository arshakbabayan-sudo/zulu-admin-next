"use client";

/** Phase-2 migration: page chrome (header / list table / save / cancel /
 * submit-for-review / forbidden / error banners) on design-system primitives.
 * The dense in-form fields (hundreds of inputClass usages across the multi-
 * section form for vehicle / pricing / advanced options) intentionally keep
 * their compact layout because the design-system Input primitive's 48px
 * height would break the dense column grids. Same pattern as the inner
 * sections of /operator/hotels and /operator/flights. */

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

  Table,
  TBody,
  TD,
  TEmpty,
  TH,
  THead,
  TR,
} from "@/components/ui";
import {
  PageHeader as V2PageHeader,
  V2Card,
  V2Button,
  IconButton,
} from "@/components/ui/v2";
import { InventorySectionTabs } from "@/components/inventory/InventorySectionTabs";
import { Edit3, Trash2, Send } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { userHasPermission } from "@/lib/access";
import { useConfirm } from "@/contexts/ConfirmDialogContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiRequestError } from "@/lib/api-client";
import { apiSubmitOfferForReview } from "@/lib/platform-admin-api";
import type { ApiListMeta } from "@/lib/api-envelope";
import {
  apiOffers,
  apiCompaniesList,
  apiCreateOffer,
  apiCars,
  apiCreateCar,
  apiUpdateCar,
  apiDeleteCar,
  CAR_CHILD_SEAT_TYPES,
  CAR_SERVICE_KEYS,
  type CarRow,
  type OfferRow,
  type CarCreatePayload,
  type CarUpdatePayload,
  type CarExpandedWriteFields,
  type CarAdvancedOptionsRow,
  type CarPricingRulesRow,
} from "@/lib/inventory-crud-api";
import {
  carTemplateCsv,
  csvExportFilename,
  downloadCsvFile,
  exportCarsCsv,
  runCarCsvImport,
} from "@/lib/csv-import-export";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Local i18n shim — returns `fallback` when the server translation row for
 * `key` hasn't been seeded yet (t() echoes the key on a miss).
 */
function tx(t: (k: string) => string, key: string, fallback: string): string {
  const v = t(key);
  return v === key ? fallback : v;
}

/** Aligned with `App\Models\Car::PRICING_MODES` / `OPERATIONAL_STATUSES` / `AVAILABILITY_STATUSES`. */
const CAR_PRICING_MODES = [
  "per_day",
  "per_hour",
  "per_km",
  "fixed",
  "inherit_offer",
] as const;
const CAR_OPERATIONAL_STATUSES = ["draft", "published", "archived", "suspended"] as const;
const CAR_AVAILABILITY_STATUSES = [
  "available",
  "limited",
  "booked",
  "maintenance",
  "inactive",
] as const;

const CAR_MILEAGE_MODES = ["unlimited", "limited"] as const;
const CAR_CROSS_BORDER_POLICIES = [
  "not_allowed",
  "included",
  "surcharge_fixed",
  "surcharge_daily",
] as const;
const CAR_OUT_OF_RADIUS_MODES_NO_RADIUS = ["not_applicable"] as const;
const CAR_OUT_OF_RADIUS_MODES_WITH_RADIUS = ["flat_fee", "per_km", "not_allowed", "quote_only"] as const;

function defaultCarPricingRules(): CarPricingRulesRow {
  return {
    mileage: { mode: "unlimited", included_km_per_rental: null, extra_km_price: null },
    cross_border: { policy: "not_allowed", surcharge_amount: null },
    radius: {
      service_radius_km: null,
      out_of_radius_mode: "not_applicable",
      out_of_radius_flat_fee: null,
      out_of_radius_per_km: null,
    },
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function carPricingRulesFromApi(pr: unknown): CarPricingRulesRow {
  const d = defaultCarPricingRules();
  if (!pr || typeof pr !== "object") return d;
  const o = pr as Record<string, unknown>;
  const mileage = o.mileage && typeof o.mileage === "object" ? (o.mileage as Record<string, unknown>) : {};
  const mode = mileage.mode === "limited" ? "limited" : "unlimited";
  const cb = o.cross_border && typeof o.cross_border === "object" ? (o.cross_border as Record<string, unknown>) : {};
  const polRaw = cb.policy;
  const pol = CAR_CROSS_BORDER_POLICIES.includes(polRaw as (typeof CAR_CROSS_BORDER_POLICIES)[number])
    ? (polRaw as CarPricingRulesRow["cross_border"]["policy"])
    : "not_allowed";
  const rad = o.radius && typeof o.radius === "object" ? (o.radius as Record<string, unknown>) : {};
  const sr = numOrNull(rad.service_radius_km);
  const allOrm = [...CAR_OUT_OF_RADIUS_MODES_NO_RADIUS, ...CAR_OUT_OF_RADIUS_MODES_WITH_RADIUS];
  const ormRaw = rad.out_of_radius_mode;
  let orm: CarPricingRulesRow["radius"]["out_of_radius_mode"] = "not_applicable";
  if (typeof ormRaw === "string" && (allOrm as readonly string[]).includes(ormRaw)) {
    orm = ormRaw as CarPricingRulesRow["radius"]["out_of_radius_mode"];
  }
  if (sr == null || sr <= 0) {
    orm = "not_applicable";
  }
  return {
    mileage: {
      mode,
      included_km_per_rental: numOrNull(mileage.included_km_per_rental),
      extra_km_price: numOrNull(mileage.extra_km_price),
    },
    cross_border: {
      policy: pol,
      surcharge_amount: numOrNull(cb.surcharge_amount),
    },
    radius: {
      service_radius_km: sr,
      out_of_radius_mode: orm,
      out_of_radius_flat_fee: numOrNull(rad.out_of_radius_flat_fee),
      out_of_radius_per_km: numOrNull(rad.out_of_radius_per_km),
    },
  };
}

const DRIVER_LANG_PRESETS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hy", label: "Armenian" },
  { code: "ru", label: "Russian" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" },
];

function defaultCarAdvancedOptions(): CarAdvancedOptionsRow {
  return {
    v: 1,
    child_seats: { available: false, types: [] },
    extra_luggage: { additional_suitcases_max: 0, additional_small_bags_max: 0, notes: null },
    services: [],
    driver_languages: [],
    pricing_rules: defaultCarPricingRules(),
  };
}

function carAdvancedOptionsFromRow(r: CarRow): CarAdvancedOptionsRow {
  const a = r.advanced_options;
  if (!a) return defaultCarAdvancedOptions();
  return {
    v: a.v ?? 1,
    child_seats: {
      available: Boolean(a.child_seats?.available),
      types: Array.isArray(a.child_seats?.types) ? [...a.child_seats.types] : [],
    },
    extra_luggage: {
      additional_suitcases_max: Math.max(
        0,
        Math.min(255, Number(a.extra_luggage?.additional_suitcases_max ?? 0))
      ),
      additional_small_bags_max: Math.max(
        0,
        Math.min(255, Number(a.extra_luggage?.additional_small_bags_max ?? 0))
      ),
      notes: a.extra_luggage?.notes ?? null,
    },
    services: Array.isArray(a.services) ? [...a.services] : [],
    driver_languages: Array.isArray(a.driver_languages) ? [...a.driver_languages] : [],
    pricing_rules: carPricingRulesFromApi(a.pricing_rules),
  };
}

type FieldErrors = Record<string, string[]>;

type CarFormState = {
  offer_id: number | "";
  company_id: number | "";
  location_id: number | "";
  pickup_location: string;
  dropoff_location: string;
  vehicle_class: string;
  vehicle_type: string;
  brand: string;
  model: string;
  year: number | "";
  transmission_type: string;
  fuel_type: string;
  fleet: string;
  category: string;
  seats: number | "";
  suitcases: number | "";
  small_bag: number | "";
  availability_window_start: string;
  availability_window_end: string;
  pricing_mode: string;
  base_price: number | "";
  status: string;
  availability_status: string;
  advanced_options: CarAdvancedOptionsRow;
  main_image: string;
  short_description: string;
  latitude: string;
  longitude: string;
};

function emptyCarForm(): Omit<CarFormState, "offer_id" | "company_id"> {
  return {
    location_id: "",
    pickup_location: "",
    dropoff_location: "",
    vehicle_class: "",
    vehicle_type: "",
    brand: "",
    model: "",
    year: "",
    transmission_type: "",
    fuel_type: "",
    fleet: "",
    category: "",
    seats: "",
    suitcases: "",
    small_bag: "",
    availability_window_start: "",
    availability_window_end: "",
    pricing_mode: "",
    base_price: "",
    status: "",
    availability_status: "",
    advanced_options: defaultCarAdvancedOptions(),
    main_image: "",
    short_description: "",
    latitude: "",
    longitude: "",
  };
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIsoOrNull(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function carFormFromRow(r: CarRow): CarFormState {
  const cid =
    r.company_id != null
      ? Number(r.company_id)
      : r.offer?.company_id != null
        ? Number(r.offer.company_id)
        : "";
  return {
    offer_id: r.offer_id != null ? Number(r.offer_id) : "",
    company_id: cid,
    location_id: r.location_id != null ? Number(r.location_id) : "",
    pickup_location: r.pickup_location ?? "",
    dropoff_location: r.dropoff_location ?? "",
    vehicle_class: r.vehicle_class ?? "",
    vehicle_type: r.vehicle_type ?? "",
    brand: r.brand ?? "",
    model: r.model ?? "",
    year: r.year != null ? Number(r.year) : "",
    transmission_type: r.transmission_type ?? "",
    fuel_type: r.fuel_type ?? "",
    fleet: r.fleet ?? "",
    category: r.category ?? "",
    seats: r.seats != null ? Number(r.seats) : "",
    suitcases: r.suitcases != null ? Number(r.suitcases) : "",
    small_bag: r.small_bag != null ? Number(r.small_bag) : "",
    availability_window_start: isoToDatetimeLocal(r.availability_window_start),
    availability_window_end: isoToDatetimeLocal(r.availability_window_end),
    pricing_mode: r.pricing_mode ?? "",
    base_price: r.base_price != null ? Number(r.base_price) : "",
    status: r.status ?? "",
    availability_status: r.availability_status ?? "",
    advanced_options: carAdvancedOptionsFromRow(r),
    main_image: (r as { main_image?: string | null }).main_image ?? "",
    short_description: (r as { short_description?: string | null }).short_description ?? "",
    latitude: r.latitude != null ? String(r.latitude) : "",
    longitude: r.longitude != null ? String(r.longitude) : "",
  };
}

function validateCarForm(form: CarFormState, isCreate: boolean): FieldErrors | null {
  const e: FieldErrors = {};
  if (isCreate) {
    if (form.offer_id === "") e.offer_id = ["Select an offer."];
    if (form.company_id === "") e.company_id = ["Company is required."];
    if (!form.pickup_location.trim()) e.pickup_location = ["Pickup location is required."];
    if (!form.dropoff_location.trim()) e.dropoff_location = ["Dropoff location is required."];
    if (!form.vehicle_class.trim()) e.vehicle_class = ["Vehicle class is required."];
  } else {
    if (!form.pickup_location.trim()) e.pickup_location = ["Pickup location is required."];
    if (!form.dropoff_location.trim()) e.dropoff_location = ["Dropoff location is required."];
    if (!form.vehicle_class.trim()) e.vehicle_class = ["Vehicle class is required."];
  }
  if (form.year !== "") {
    const y = Number(form.year);
    if (!Number.isInteger(y) || y < 1900 || y > 2100) {
      e.year = ["Year must be between 1900 and 2100."];
    }
  }
  if (form.seats !== "") {
    const n = Number(form.seats);
    if (!Number.isInteger(n) || n < 1 || n > 255) e.seats = ["Seats must be an integer from 1 to 255."];
  }
  if (form.suitcases !== "") {
    const n = Number(form.suitcases);
    if (!Number.isInteger(n) || n < 0 || n > 255) e.suitcases = ["Suitcases must be an integer from 0 to 255."];
  }
  if (form.small_bag !== "") {
    const n = Number(form.small_bag);
    if (!Number.isInteger(n) || n < 0 || n > 255) e.small_bag = ["Small bags must be an integer from 0 to 255."];
  }
  if (form.base_price !== "") {
    const n = Number(form.base_price);
    if (Number.isNaN(n) || n < 0) e.base_price = ["Base price must be a number ≥ 0."];
  }
  const startIso = datetimeLocalToIsoOrNull(form.availability_window_start);
  const endIso = datetimeLocalToIsoOrNull(form.availability_window_end);
  if (form.availability_window_start.trim() && !startIso) {
    e.availability_window_start = ["Enter a valid availability start date/time."];
  }
  if (form.availability_window_end.trim() && !endIso) {
    e.availability_window_end = ["Enter a valid availability end date/time."];
  }
  if (startIso && endIso && new Date(endIso) < new Date(startIso)) {
    e.availability_window_end = ["Availability end must be on or after the start."];
  }

  const pr = form.advanced_options.pricing_rules;
  if (pr.mileage.mode === "limited") {
    const ik = pr.mileage.included_km_per_rental;
    if (ik == null || ik < 1) {
      e.pr_included_km = ["Included km is required when mileage is limited."];
    }
  }
  if (pr.cross_border.policy === "surcharge_fixed" || pr.cross_border.policy === "surcharge_daily") {
    const amt = pr.cross_border.surcharge_amount;
    if (amt == null || amt <= 0) {
      e.pr_surcharge = ["Surcharge amount is required for this policy."];
    }
  }
  const rkm = pr.radius.service_radius_km;
  if (rkm != null && rkm > 0) {
    if (pr.radius.out_of_radius_mode === "not_applicable") {
      e.pr_out_mode = ["Choose out-of-radius pricing when a service radius is set."];
    }
    const orm = pr.radius.out_of_radius_mode;
    const ff = pr.radius.out_of_radius_flat_fee;
    const pk = pr.radius.out_of_radius_per_km;
    if (orm !== "flat_fee" && ff != null && ff > 0) {
      e.pr_flat = ['Clear the flat fee or switch out-of-radius mode to "Extra flat fee".'];
    }
    if (orm !== "per_km" && pk != null && pk > 0) {
      e.pr_per_km = ['Clear the per-km price or switch mode to "Extra per km".'];
    }
    if (orm === "flat_fee") {
      if (ff == null || ff < 0) e.pr_flat = ["Flat fee is required (≥ 0)."];
    }
    if (orm === "per_km") {
      if (pk == null || pk < 0) e.pr_per_km = ["Per-km price is required (≥ 0)."];
    }
  }

  return Object.keys(e).length === 0 ? null : e;
}

function sanitizeAdvancedOptionsForApi(a: CarAdvancedOptionsRow): CarAdvancedOptionsRow {
  let pr: CarPricingRulesRow = { ...a.pricing_rules };
  if (pr.mileage.mode === "unlimited") {
    pr = {
      ...pr,
      mileage: { mode: "unlimited", included_km_per_rental: null, extra_km_price: null },
    };
  }
  if (pr.cross_border.policy !== "surcharge_fixed" && pr.cross_border.policy !== "surcharge_daily") {
    pr = { ...pr, cross_border: { ...pr.cross_border, surcharge_amount: null } };
  }
  if (pr.radius.service_radius_km == null || pr.radius.service_radius_km <= 0) {
    pr = {
      ...pr,
      radius: {
        service_radius_km: null,
        out_of_radius_mode: "not_applicable",
        out_of_radius_flat_fee: null,
        out_of_radius_per_km: null,
      },
    };
  } else {
    const mode = pr.radius.out_of_radius_mode;
    pr = {
      ...pr,
      radius: {
        ...pr.radius,
        out_of_radius_flat_fee: mode === "flat_fee" ? pr.radius.out_of_radius_flat_fee : null,
        out_of_radius_per_km: mode === "per_km" ? pr.radius.out_of_radius_per_km : null,
      },
    };
  }
  return { ...a, pricing_rules: pr };
}

function mergeExpandedFromForm(form: CarFormState): Record<string, unknown> {
  const trimOrNull = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    vehicle_type: trimOrNull(form.vehicle_type),
    brand: trimOrNull(form.brand),
    model: trimOrNull(form.model),
    year: form.year === "" ? null : Number(form.year),
    transmission_type: trimOrNull(form.transmission_type),
    fuel_type: trimOrNull(form.fuel_type),
    fleet: trimOrNull(form.fleet),
    category: trimOrNull(form.category),
    seats: form.seats === "" ? null : Number(form.seats),
    suitcases: form.suitcases === "" ? null : Number(form.suitcases),
    small_bag: form.small_bag === "" ? null : Number(form.small_bag),
    availability_window_start: datetimeLocalToIsoOrNull(form.availability_window_start),
    availability_window_end: datetimeLocalToIsoOrNull(form.availability_window_end),
    pricing_mode: trimOrNull(form.pricing_mode),
    base_price: form.base_price === "" ? null : Number(form.base_price),
    status: trimOrNull(form.status),
    availability_status: trimOrNull(form.availability_status),
    advanced_options: sanitizeAdvancedOptionsForApi(form.advanced_options),
    main_image: trimOrNull(form.main_image),
    short_description: trimOrNull(form.short_description),
    latitude: form.latitude.trim() === "" ? null : Number(form.latitude),
    longitude: form.longitude.trim() === "" ? null : Number(form.longitude),
  };
}

function buildCreatePayload(form: CarFormState): CarCreatePayload {
  return {
    offer_id: Number(form.offer_id),
    location_id: form.location_id === "" ? null : Number(form.location_id),
    company_id: Number(form.company_id),
    pickup_location: form.pickup_location.trim(),
    dropoff_location: form.dropoff_location.trim(),
    vehicle_class: form.vehicle_class.trim(),
    ...(mergeExpandedFromForm(form) as CarExpandedWriteFields),
  };
}

function buildUpdatePayload(form: CarFormState): CarUpdatePayload {
  return {
    location_id: form.location_id === "" ? null : Number(form.location_id),
    pickup_location: form.pickup_location.trim(),
    dropoff_location: form.dropoff_location.trim(),
    vehicle_class: form.vehicle_class.trim(),
    ...(mergeExpandedFromForm(form) as CarExpandedWriteFields),
  };
}

function companyCell(r: CarRow): string {
  if (r.company_id != null) return String(r.company_id);
  const c = r.offer?.company_id;
  if (c != null) return String(c);
  return "—";
}

function offerTitle(r: CarRow): string {
  const t = r.offer?.title;
  return t != null && String(t) !== "" ? String(t) : "—";
}

function renderApiFieldErrors(errors: FieldErrors | undefined): { title: string; items: { field: string; msg: string }[] } | null {
  if (!errors) return null;
  const items: { field: string; msg: string }[] = [];
  for (const [field, msgs] of Object.entries(errors)) {
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    for (const m of msgs) {
      const t = String(m ?? "").trim();
      if (t) items.push({ field: field || "(form)", msg: t });
    }
  }
  if (items.length === 0) return null;
  return { title: "Please fix the highlighted fields.", items };
}

export default function OperatorCarsPage() {
  const { token, user } = useAdminAuth();
  const { t, contentLang } = useLanguage();
  const confirm = useConfirm();
  const [rows, setRows] = useState<CarRow[]>([]);
  const [meta, setMeta] = useState<ApiListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [form, setForm] = useState<CarFormState | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<FieldErrors | null>(null);
  const [carOffers, setCarOffers] = useState<OfferRow[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const offersCache = useRef<OfferRow[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    setForbidden(false);
    try {
      const res = await apiCars(token, { page, per_page: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 403) setForbidden(true);
      else setErr(e instanceof ApiRequestError ? e.message : t("admin.crud.common.failed"));
    }
  }, [token, page, contentLang]);

  useEffect(() => {
    void load();
  }, [load]);

  const ensureOffersLoaded = useCallback(async (): Promise<OfferRow[]> => {
    if (offersCache.current !== null) return offersCache.current;
    if (!token) return [];
    const res = await apiOffers(token, { type: "car" });
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
          setCarOffers(null);
          setFormErr(t("admin.crud.cars.err.no_companies"));
          setBusy(false);
          return;
        }
        const companyId = Number(companies[0]!.id);
        await apiCreateOffer(token, {
          company_id: companyId,
          type: "car",
          title: `Car rental draft ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
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
      setCarOffers(null);
      setFormErr(
        e instanceof ApiRequestError
          ? e.message || "Could not open the form (offers / companies)."
          : "Could not open the form."
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
      setCarOffers(null);
      if (loadedOffers.length === 0) {
        setFormErr(
          "Could not create or find a car offer. Check API access (offers.create) or try again."
        );
      } else {
        setFormErr(
          "Every car offer already has a vehicle linked (one car per offer). Create another car offer or delete an existing car to reuse its offer."
        );
      }
      setBusy(false);
      return;
    }

    const cid = available.company_id;
    setEditId(null);
    setCarOffers(loadedOffers);
    setForm({
      offer_id: available.id,
      company_id: cid != null ? Number(cid) : "",
      ...emptyCarForm(),
    });
    setFormErr(null);
    setBusy(false);
  }

  function openEdit(r: CarRow) {
    setEditId(r.id);
    setCarOffers(null);
    setForm(carFormFromRow(r));
    setFormErr(null);
    setFieldErrs(null);
  }

  function closeForm() {
    setForm(null);
    setEditId(null);
    setFormErr(null);
    setFieldErrs(null);
    setCarOffers(null);
  }

  function onOfferChange(offerIdStr: string) {
    if (offerIdStr === "") {
      setForm((p) => (p ? { ...p, offer_id: "", company_id: "" } : p));
      return;
    }
    const oid = Number(offerIdStr);
    const list = carOffers ?? offersCache.current ?? [];
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

  async function handleSubmit() {
    if (!token || !form) return;
    setFormErr(null);
    setFieldErrs(null);
    const isCreate = editId == null;
    const local = validateCarForm(form, isCreate);
    if (local) {
      setFieldErrs(local);
      setFormErr("Fix validation errors below.");
      return;
    }
    setBusy(true);
    try {
      if (editId != null) {
        await apiUpdateCar(token, editId, buildUpdatePayload(form));
      } else {
        await apiCreateCar(token, buildCreatePayload(form));
      }
      offersCache.current = null;
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
    const ok = await confirm({ messageKey: "admin.crud.cars.delete_confirm", variant: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      await apiDeleteCar(token, id);
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
        <h1 className="admin-page-title">{t("admin.crud.cars.title")}</h1>
        <div className="admin-card p-4">
          <ForbiddenNotice />
        </div>
      </div>
    );

  const isCreate = editId == null;
  const editRow = editId != null ? rows.find((x) => x.id === editId) : undefined;
  const fieldSummary = renderApiFieldErrors(fieldErrs ?? undefined);
  const hasFieldErr = (key: string) => Boolean(fieldErrs && Array.isArray(fieldErrs[key]) && fieldErrs[key].length > 0);
  const fieldMsgs = (key: string) => (fieldErrs && Array.isArray(fieldErrs[key]) ? fieldErrs[key] : []);
  const inputClass = (key: string) =>
    `rounded border px-2 py-1.5 text-sm ${
      hasFieldErr(key) ? "border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200" : "border-default"
    }`;

  return (
    <div>
      <V2PageHeader
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Inventory", href: "/operator/hotels" },
          { label: t("admin.crud.cars.title") },
        ]}
        title={
          <span className="inline-flex items-center gap-3">
            {t("admin.crud.cars.title")}
            {form === null && <ContentLanguagePill />}
          </span>
        }
        subtitle={tx(t, "admin.inventory.cars.subtitle", "Manage your car rental inventory")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ImportExportButtons
              busy={busy || exportBusy}
              exportDisabled={!token}
              onTemplate={() => downloadCsvFile("cars-template.csv", carTemplateCsv())}
              onExport={async () => {
                if (!token) return;
                setExportBusy(true);
                try {
                  const csv = await exportCarsCsv(token);
                  downloadCsvFile(csvExportFilename("cars"), csv);
                } catch (e) {
                  alert(e instanceof ApiRequestError ? e.message : "Export failed");
                } finally {
                  setExportBusy(false);
                }
              }}
              onImport={() => setImportOpen(true)}
            />
            {userHasPermission(user, "cars.create") && (
              <V2Button variant="primary" size="sm" disabled={busy} onClick={() => void openCreate()}>
                + {busy ? "Loading…" : t("admin.crud.cars.new_btn")}
              </V2Button>
            )}
          </div>
        }
      />

      <InventorySectionTabs activeHref="/operator/cars" activeCount={meta?.total} />
      <CsvImportModal
        open={importOpen}
        title={t("admin.crud.cars.import_title")}
        onClose={() => setImportOpen(false)}
        onRun={async (rows, rowLineNumbers) => {
          if (!token) {
            return {
              success: 0,
              failed: rows.length,
              errors: [{ rowNumber: rowLineNumbers[0] ?? 2, message: "Not signed in." }],
            };
          }
          const res = await runCarCsvImport(token, rows, rowLineNumbers);
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
          <h2 className="mb-3 text-base font-semibold">{editId ? t("admin.crud.cars.form_edit") : t("admin.crud.cars.form_new")}</h2>
          {fieldSummary && (
            <div className="mb-3 rounded-zulu border border-error-100 bg-error-50 px-3 py-2 text-sm text-error-700">
              <div className="font-medium">{fieldSummary.title}</div>
              <ul className="mt-1 list-disc pl-5">
                {fieldSummary.items.slice(0, 12).map((it, idx) => (
                  <li key={`${it.field}-${idx}`}>
                    <span className="font-medium">{it.field}</span>: {it.msg}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <MainImageDescriptionFields
              mainImage={form.main_image}
              shortDescription={form.short_description}
              onMainImageChange={(v) => setForm((p) => p ? { ...p, main_image: v } : p)}
              onShortDescriptionChange={(v) => setForm((p) => p ? { ...p, short_description: v } : p)}
              section="cars"
              altText={t("admin.crud.cars.main_image_alt")}
            />
            <LatLngFields
              latitude={form.latitude}
              longitude={form.longitude}
              onLatitudeChange={(v) => setForm((p) => p ? { ...p, latitude: v } : p)}
              onLongitudeChange={(v) => setForm((p) => p ? { ...p, longitude: v } : p)}
            />
            {isCreate && carOffers && (
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.offer_id")}</span>
                <select
                  value={form.offer_id === "" ? "" : String(form.offer_id)}
                  onChange={(e) => onOfferChange(e.target.value)}
                  className={inputClass("offer_id")}
                >
                  {carOffers.map((o) => {
                    const used = rows.some((r) => r.offer_id === o.id);
                    return (
                      <option key={o.id} value={o.id} disabled={used && o.id !== form.offer_id}>
                        #{o.id} — {o.title}
                        {used && o.id !== form.offer_id ? " (already has a car)" : ""}
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
                <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.offer_id")} </span>
                <span className="text-fg-t11">
                  {editRow && form.offer_id !== "" ? `#${form.offer_id} — ${offerTitle(editRow)}` : "—"}
                </span>
              </div>
            )}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.company_id")}</span>
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
            <LocationCascadeSelect
              token={token}
              value={form.location_id === "" ? null : Number(form.location_id)}
              label={t("admin.crud.cars.field.location")}
              onChange={(locationId) =>
                setForm((p) => (p ? { ...p, location_id: locationId ?? "" } : p))
              }
            />

            <div className="col-span-2 mt-1 border-t border-default pt-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
              {t("admin.crud.cars.section.route")}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.pickup_location")}</span>
              <input
                value={form.pickup_location}
                onChange={(e) => setForm((p) => (p ? { ...p, pickup_location: e.target.value } : p))}
                className={inputClass("pickup_location")}
              />
              {fieldMsgs("pickup_location").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.dropoff_location")}</span>
              <input
                value={form.dropoff_location}
                onChange={(e) => setForm((p) => (p ? { ...p, dropoff_location: e.target.value } : p))}
                className={inputClass("dropoff_location")}
              />
              {fieldMsgs("dropoff_location").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>

            <div className="col-span-2 mt-1 border-t border-default pt-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
              {t("admin.crud.cars.section.vehicle_info")}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.vehicle_class")}</span>
              <input
                value={form.vehicle_class}
                onChange={(e) => setForm((p) => (p ? { ...p, vehicle_class: e.target.value } : p))}
                className={inputClass("vehicle_class")}
              />
              {fieldMsgs("vehicle_class").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.vehicle_type")}</span>
              <input
                value={form.vehicle_type}
                onChange={(e) => setForm((p) => (p ? { ...p, vehicle_type: e.target.value } : p))}
                className={inputClass("vehicle_type")}
              />
              {fieldMsgs("vehicle_type").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.brand")}</span>
              <input
                value={form.brand}
                onChange={(e) => setForm((p) => (p ? { ...p, brand: e.target.value } : p))}
                className={inputClass("brand")}
              />
              {fieldMsgs("brand").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.model")}</span>
              <input
                value={form.model}
                onChange={(e) => setForm((p) => (p ? { ...p, model: e.target.value } : p))}
                className={inputClass("model")}
              />
              {fieldMsgs("model").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.year")}</span>
              <input
                type="number"
                min={1900}
                max={2100}
                value={form.year === "" ? "" : String(form.year)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) =>
                    p ? { ...p, year: v === "" ? "" : Number(v) } : p
                  );
                }}
                className={inputClass("year")}
              />
              {fieldMsgs("year").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.transmission_type")}</span>
              <input
                value={form.transmission_type}
                onChange={(e) => setForm((p) => (p ? { ...p, transmission_type: e.target.value } : p))}
                className={inputClass("transmission_type")}
              />
              {fieldMsgs("transmission_type").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.fuel_type")}</span>
              <input
                value={form.fuel_type}
                onChange={(e) => setForm((p) => (p ? { ...p, fuel_type: e.target.value } : p))}
                className={inputClass("fuel_type")}
              />
              {fieldMsgs("fuel_type").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.fleet")}</span>
              <input
                value={form.fleet}
                onChange={(e) => setForm((p) => (p ? { ...p, fleet: e.target.value } : p))}
                className={inputClass("fleet")}
              />
              {fieldMsgs("fleet").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.category")}</span>
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

            <div className="col-span-2 mt-1 border-t border-default pt-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
              {t("admin.crud.cars.section.capacity")}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.seats")}</span>
              <input
                type="number"
                min={1}
                max={255}
                value={form.seats === "" ? "" : String(form.seats)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) =>
                    p ? { ...p, seats: v === "" ? "" : Number(v) } : p
                  );
                }}
                className={inputClass("seats")}
              />
              {fieldMsgs("seats").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.suitcases")}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={form.suitcases === "" ? "" : String(form.suitcases)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) =>
                    p ? { ...p, suitcases: v === "" ? "" : Number(v) } : p
                  );
                }}
                className={inputClass("suitcases")}
              />
              {fieldMsgs("suitcases").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.small_bag")}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={form.small_bag === "" ? "" : String(form.small_bag)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) =>
                    p ? { ...p, small_bag: v === "" ? "" : Number(v) } : p
                  );
                }}
                className={inputClass("small_bag")}
              />
              {fieldMsgs("small_bag").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>

            <div className="col-span-2 mt-1 border-t border-default pt-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
              {t("admin.crud.cars.section.pricing")}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.pricing_mode")}</span>
              <select
                value={form.pricing_mode}
                onChange={(e) => setForm((p) => (p ? { ...p, pricing_mode: e.target.value } : p))}
                className={inputClass("pricing_mode")}
              >
                <option value="">—</option>
                {CAR_PRICING_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {fieldMsgs("pricing_mode").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.base_price")}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.base_price === "" ? "" : String(form.base_price)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) =>
                    p ? { ...p, base_price: v === "" ? "" : Number(v) } : p
                  );
                }}
                className={inputClass("base_price")}
              />
              {fieldMsgs("base_price").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>

            <div className="col-span-2 mt-1 border-t border-default pt-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
              {t("admin.crud.cars.section.status")}
            </div>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.availability_window_start")}</span>
              <input
                type="datetime-local"
                value={form.availability_window_start}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, availability_window_start: e.target.value } : p))
                }
                className={inputClass("availability_window_start")}
              />
              {fieldMsgs("availability_window_start").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.availability_window_end")}</span>
              <input
                type="datetime-local"
                value={form.availability_window_end}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, availability_window_end: e.target.value } : p))
                }
                className={inputClass("availability_window_end")}
              />
              {fieldMsgs("availability_window_end").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.status")}</span>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => (p ? { ...p, status: e.target.value } : p))}
                className={inputClass("status")}
              >
                <option value="">—</option>
                {CAR_OPERATIONAL_STATUSES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {fieldMsgs("status").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.availability_status")}</span>
              <select
                value={form.availability_status}
                onChange={(e) =>
                  setForm((p) => (p ? { ...p, availability_status: e.target.value } : p))
                }
                className={inputClass("availability_status")}
              >
                <option value="">—</option>
                {CAR_AVAILABILITY_STATUSES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {fieldMsgs("availability_status").map((m, i) => (
                <span key={i} className="text-xs text-error-600">
                  {m}
                </span>
              ))}
            </label>

            <div className="col-span-2 mt-1 border-t border-default pt-2 text-xs font-semibold uppercase tracking-wide text-fg-t6">
              {t("admin.crud.cars.section.advanced")}
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.advanced_options.child_seats.available}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          advanced_options: {
                            ...p.advanced_options,
                            child_seats: {
                              ...p.advanced_options.child_seats,
                              available: e.target.checked,
                            },
                          },
                        }
                      : p
                  )
                }
              />
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.child_seats_available")}</span>
            </label>
            <div className="col-span-2 flex flex-wrap gap-3 text-sm">
              <span className="w-full min-w-[8rem] font-medium text-fg-t6">{t("admin.crud.cars.field.child_seat_types")}</span>
              {CAR_CHILD_SEAT_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.advanced_options.child_seats.types.includes(t)}
                    onChange={() => {
                      setForm((p) => {
                        if (!p) return p;
                        const cur = new Set(p.advanced_options.child_seats.types);
                        if (cur.has(t)) cur.delete(t);
                        else cur.add(t);
                        const types = Array.from(cur).sort();
                        return {
                          ...p,
                          advanced_options: {
                            ...p.advanced_options,
                            child_seats: { ...p.advanced_options.child_seats, types },
                          },
                        };
                      });
                    }}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.additional_suitcases_max")}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={String(form.advanced_options.extra_luggage.additional_suitcases_max)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          advanced_options: {
                            ...p.advanced_options,
                            extra_luggage: {
                              ...p.advanced_options.extra_luggage,
                              additional_suitcases_max: v === "" ? 0 : Math.max(0, Math.min(255, Number(v))),
                            },
                          },
                        }
                      : p
                  );
                }}
                className={inputClass("additional_suitcases_max")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.additional_small_bags_max")}</span>
              <input
                type="number"
                min={0}
                max={255}
                value={String(form.advanced_options.extra_luggage.additional_small_bags_max)}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          advanced_options: {
                            ...p.advanced_options,
                            extra_luggage: {
                              ...p.advanced_options.extra_luggage,
                              additional_small_bags_max: v === "" ? 0 : Math.max(0, Math.min(255, Number(v))),
                            },
                          },
                        }
                      : p
                  );
                }}
                className={inputClass("additional_small_bags_max")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.extra_luggage_notes")}</span>
              <textarea
                rows={2}
                value={form.advanced_options.extra_luggage.notes ?? ""}
                onChange={(e) =>
                  setForm((p) =>
                    p
                      ? {
                          ...p,
                          advanced_options: {
                            ...p.advanced_options,
                            extra_luggage: {
                              ...p.advanced_options.extra_luggage,
                              notes: e.target.value.trim() === "" ? null : e.target.value.slice(0, 500),
                            },
                          },
                        }
                      : p
                  )
                }
                className={inputClass("extra_luggage_notes")}
              />
            </label>
            <div className="col-span-2 flex flex-wrap gap-3 text-sm">
              <span className="w-full min-w-[8rem] font-medium text-fg-t6">{t("admin.crud.cars.field.services")}</span>
              {CAR_SERVICE_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.advanced_options.services.includes(k)}
                    onChange={() => {
                      setForm((p) => {
                        if (!p) return p;
                        const cur = new Set(p.advanced_options.services);
                        if (cur.has(k)) cur.delete(k);
                        else cur.add(k);
                        const services = Array.from(cur).sort() as string[];
                        return {
                          ...p,
                          advanced_options: { ...p.advanced_options, services },
                        };
                      });
                    }}
                  />
                  <span>{k}</span>
                </label>
              ))}
            </div>
            <div className="col-span-2 flex flex-wrap gap-3 text-sm">
              <span className="w-full min-w-[8rem] font-medium text-fg-t6">{t("admin.crud.cars.field.driver_languages")}</span>
              {DRIVER_LANG_PRESETS.map(({ code, label }) => (
                <label key={code} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.advanced_options.driver_languages.includes(code)}
                    onChange={() => {
                      setForm((p) => {
                        if (!p) return p;
                        const cur = new Set(p.advanced_options.driver_languages);
                        if (cur.has(code)) cur.delete(code);
                        else cur.add(code);
                        const driver_languages = Array.from(cur).sort();
                        return {
                          ...p,
                          advanced_options: { ...p.advanced_options, driver_languages },
                        };
                      });
                    }}
                  />
                  <span>
                    {label} ({code})
                  </span>
                </label>
              ))}
            </div>

            <div className="col-span-2 mt-2 border-t border-default pt-3 text-xs font-semibold uppercase tracking-wide text-fg-t6">
              6b) Pricing rules (Step C2)
            </div>
            <p className="col-span-2 text-xs leading-relaxed text-fg-t6">
              Base rent is on the offer above. Here you only define add-ons and limits: mileage cap and overage,
              border policy, and an optional service radius with what happens outside it.
            </p>

            <p className="col-span-2 text-xs text-fg-t6">
              Mileage — unlimited = no cap; limited = included km per rental, optional price per extra km beyond that.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.mileage")}</span>
              <select
                value={form.advanced_options.pricing_rules.mileage.mode}
                onChange={(e) => {
                  const mode = e.target.value as CarPricingRulesRow["mileage"]["mode"];
                  setForm((p) => {
                    if (!p) return p;
                    const next: CarPricingRulesRow = {
                      ...p.advanced_options.pricing_rules,
                      mileage:
                        mode === "unlimited"
                          ? { mode: "unlimited", included_km_per_rental: null, extra_km_price: null }
                          : { ...p.advanced_options.pricing_rules.mileage, mode: "limited" },
                    };
                    return {
                      ...p,
                      advanced_options: { ...p.advanced_options, pricing_rules: next },
                    };
                  });
                }}
                className={inputClass("pr_mileage_mode")}
              >
                {CAR_MILEAGE_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m === "unlimited" ? t("admin.crud.cars.mileage.unlimited") : t("admin.crud.cars.mileage.limited")}
                  </option>
                ))}
              </select>
            </label>
            {form.advanced_options.pricing_rules.mileage.mode === "limited" && (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.included_km_per_rental")}</span>
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    value={
                      form.advanced_options.pricing_rules.mileage.included_km_per_rental ?? ""
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => {
                        if (!p) return p;
                        const n = v === "" ? null : Math.max(1, Math.min(1_000_000, Number(v)));
                        return {
                          ...p,
                          advanced_options: {
                            ...p.advanced_options,
                            pricing_rules: {
                              ...p.advanced_options.pricing_rules,
                              mileage: {
                                ...p.advanced_options.pricing_rules.mileage,
                                included_km_per_rental: n,
                              },
                            },
                          },
                        };
                      });
                    }}
                    className={inputClass("pr_included_km")}
                  />
                  {fieldMsgs("pr_included_km").map((m, i) => (
                    <span key={i} className="text-xs text-error-600">
                      {m}
                    </span>
                  ))}
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.extra_km_price")}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.advanced_options.pricing_rules.mileage.extra_km_price ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => {
                        if (!p) return p;
                        const n = v === "" ? null : Math.max(0, Number(v));
                        return {
                          ...p,
                          advanced_options: {
                            ...p.advanced_options,
                            pricing_rules: {
                              ...p.advanced_options.pricing_rules,
                              mileage: {
                                ...p.advanced_options.pricing_rules.mileage,
                                extra_km_price: n != null && Number.isFinite(n) ? n : null,
                              },
                            },
                          },
                        };
                      });
                    }}
                    className={inputClass("pr_extra_km")}
                  />
                </label>
              </>
            )}

            <p className="col-span-2 text-xs text-fg-t6">
              Cross-border — “included” allows travel without extra charge; surcharges are in offer currency (one-time vs
              per rental day).
            </p>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.cross_border")}</span>
              <select
                value={form.advanced_options.pricing_rules.cross_border.policy}
                onChange={(e) => {
                  const policy = e.target.value as CarPricingRulesRow["cross_border"]["policy"];
                  setForm((p) => {
                    if (!p) return p;
                    const surcharge =
                      policy === "surcharge_fixed" || policy === "surcharge_daily"
                        ? p.advanced_options.pricing_rules.cross_border.surcharge_amount
                        : null;
                    return {
                      ...p,
                      advanced_options: {
                        ...p.advanced_options,
                        pricing_rules: {
                          ...p.advanced_options.pricing_rules,
                          cross_border: { policy, surcharge_amount: surcharge },
                        },
                      },
                    };
                  });
                }}
                className={inputClass("pr_cross_border")}
              >
                <option value="not_allowed">Not allowed</option>
                <option value="included">Allowed (included)</option>
                <option value="surcharge_fixed">Surcharge (one-time)</option>
                <option value="surcharge_daily">Surcharge (per day)</option>
              </select>
            </label>
            {(form.advanced_options.pricing_rules.cross_border.policy === "surcharge_fixed" ||
              form.advanced_options.pricing_rules.cross_border.policy === "surcharge_daily") && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.border_surcharge_amount")}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.advanced_options.pricing_rules.cross_border.surcharge_amount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((p) => {
                      if (!p) return p;
                      const n = v === "" ? null : Math.max(0, Number(v));
                      return {
                        ...p,
                        advanced_options: {
                          ...p.advanced_options,
                          pricing_rules: {
                            ...p.advanced_options.pricing_rules,
                            cross_border: {
                              ...p.advanced_options.pricing_rules.cross_border,
                              surcharge_amount: n != null && Number.isFinite(n) ? n : null,
                            },
                          },
                        },
                      };
                    });
                  }}
                  className={inputClass("pr_surcharge")}
                />
                {fieldMsgs("pr_surcharge").map((m, i) => (
                  <span key={i} className="text-xs text-error-600">
                    {m}
                  </span>
                ))}
              </label>
            )}

            <p className="col-span-2 text-xs text-fg-t6">
              Radius — optional max distance from pickup/hub; if set, choose how trips beyond that radius are priced or
              blocked.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.service_radius_km")}</span>
              <input
                type="number"
                min={1}
                max={50000}
                placeholder={t("admin.crud.cars.radius_placeholder")}
                value={form.advanced_options.pricing_rules.radius.service_radius_km ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((p) => {
                    if (!p) return p;
                    const n = v === "" ? null : Math.max(1, Math.min(50_000, Number(v)));
                    const cleared =
                      v === "" || n == null || n <= 0
                        ? {
                            service_radius_km: null,
                            out_of_radius_mode: "not_applicable" as const,
                            out_of_radius_flat_fee: null,
                            out_of_radius_per_km: null,
                          }
                        : {
                            ...p.advanced_options.pricing_rules.radius,
                            service_radius_km: n,
                            out_of_radius_mode:
                              p.advanced_options.pricing_rules.radius.out_of_radius_mode === "not_applicable"
                                ? "not_allowed"
                                : p.advanced_options.pricing_rules.radius.out_of_radius_mode,
                          };
                    return {
                      ...p,
                      advanced_options: {
                        ...p.advanced_options,
                        pricing_rules: {
                          ...p.advanced_options.pricing_rules,
                          radius: cleared,
                        },
                      },
                    };
                  });
                }}
                className={inputClass("pr_radius_km")}
              />
            </label>
            {form.advanced_options.pricing_rules.radius.service_radius_km != null &&
              form.advanced_options.pricing_rules.radius.service_radius_km > 0 && (
                <>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.out_of_radius_mode")}</span>
                    <select
                      value={form.advanced_options.pricing_rules.radius.out_of_radius_mode}
                      onChange={(e) => {
                        const mode = e.target.value as CarPricingRulesRow["radius"]["out_of_radius_mode"];
                        setForm((p) => {
                          if (!p) return p;
                          return {
                            ...p,
                            advanced_options: {
                              ...p.advanced_options,
                              pricing_rules: {
                                ...p.advanced_options.pricing_rules,
                                radius: {
                                  ...p.advanced_options.pricing_rules.radius,
                                  out_of_radius_mode: mode,
                                  out_of_radius_flat_fee:
                                    mode === "flat_fee" ? p.advanced_options.pricing_rules.radius.out_of_radius_flat_fee : null,
                                  out_of_radius_per_km:
                                    mode === "per_km" ? p.advanced_options.pricing_rules.radius.out_of_radius_per_km : null,
                                },
                              },
                            },
                          };
                        });
                      }}
                      className={inputClass("pr_out_mode")}
                    >
                      {CAR_OUT_OF_RADIUS_MODES_WITH_RADIUS.map((m) => (
                        <option key={m} value={m}>
                          {m === "flat_fee"
                            ? t("admin.crud.cars.out_mode.flat_fee")
                            : m === "per_km"
                              ? t("admin.crud.cars.out_mode.per_km")
                              : m === "not_allowed"
                                ? t("admin.crud.cars.out_mode.not_allowed")
                                : t("admin.crud.cars.out_mode.quote_only")}
                        </option>
                      ))}
                    </select>
                    {fieldMsgs("pr_out_mode").map((m, i) => (
                      <span key={i} className="text-xs text-error-600">
                        {m}
                      </span>
                    ))}
                  </label>
                  {form.advanced_options.pricing_rules.radius.out_of_radius_mode === "flat_fee" && (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.out_of_radius_flat_fee")}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.advanced_options.pricing_rules.radius.out_of_radius_flat_fee ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((p) => {
                            if (!p) return p;
                            const n = v === "" ? null : Math.max(0, Number(v));
                            return {
                              ...p,
                              advanced_options: {
                                ...p.advanced_options,
                                pricing_rules: {
                                  ...p.advanced_options.pricing_rules,
                                  radius: {
                                    ...p.advanced_options.pricing_rules.radius,
                                    out_of_radius_flat_fee: n != null && Number.isFinite(n) ? n : null,
                                  },
                                },
                              },
                            };
                          });
                        }}
                        className={inputClass("pr_flat")}
                      />
                      {fieldMsgs("pr_flat").map((m, i) => (
                        <span key={i} className="text-xs text-error-600">
                          {m}
                        </span>
                      ))}
                    </label>
                  )}
                  {form.advanced_options.pricing_rules.radius.out_of_radius_mode === "per_km" && (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-fg-t6">{t("admin.crud.cars.field.out_of_radius_per_km")}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.advanced_options.pricing_rules.radius.out_of_radius_per_km ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((p) => {
                            if (!p) return p;
                            const n = v === "" ? null : Math.max(0, Number(v));
                            return {
                              ...p,
                              advanced_options: {
                                ...p.advanced_options,
                                pricing_rules: {
                                  ...p.advanced_options.pricing_rules,
                                  radius: {
                                    ...p.advanced_options.pricing_rules.radius,
                                    out_of_radius_per_km: n != null && Number.isFinite(n) ? n : null,
                                  },
                                },
                              },
                            };
                          });
                        }}
                        className={inputClass("pr_per_km")}
                      />
                      {fieldMsgs("pr_per_km").map((m, i) => (
                        <span key={i} className="text-xs text-error-600">
                          {m}
                        </span>
                      ))}
                    </label>
                  )}
                </>
              )}
          </div>
          {formErr && <p className="mt-2 text-sm text-error-700">{formErr}</p>}
          {editId !== null && (
            <div className="mt-6 rounded-zulu border border-default bg-figma-bg-1 p-3">
              <h3 className="mb-2 text-sm font-medium text-fg-t6">
                Translations <span className="text-fg-t7 font-normal">(EN-ից բացի՝ RU / HY)</span>
              </h3>
              <TranslationTabs
                entityType="car"
                entityId={editId}
                fields={[
                  { name: "title", label: t("admin.crud.cars.field.title") },
                  { name: "description", label: t("admin.crud.cars.field.description"), multiline: true },
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
      <V2Card>
      <Table>
        <THead>
          <TR>
            <TH>{t("admin.crud.common.id")}</TH>
            <TH>{t("admin.crud.cars.col.company")}</TH>
            <TH>{t("admin.crud.cars.col.pickup")}</TH>
            <TH>{t("admin.crud.cars.col.dropoff")}</TH>
            <TH>{t("admin.crud.cars.col.class")}</TH>
            <TH>{t("admin.crud.cars.col.offer")}</TH>
            <TH>{t("admin.crud.common.status")}</TH>
            <TH>{t("admin.crud.common.actions")}</TH>
          </TR>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <TEmpty colSpan={8}>{t("admin.crud.cars.empty")}</TEmpty>
          ) : null}
          {rows.map((r) => {
            const carInitials = String(r.vehicle_class ?? "?").slice(0, 2).toUpperCase();
            const tone = pickAvatarTone(r.id);
            return (
            <TR key={r.id}>
              <TD className="tabular-nums text-fg-t7 font-mono text-xs">#{r.id}</TD>
              <TD>
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={avatarStyle(tone)}
                    aria-hidden
                  >
                    {carInitials}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-fg-t8 truncate">{offerTitle(r)}</div>
                    <div className="text-[11px] text-fg-t6 truncate">Company #{companyCell(r)}</div>
                  </div>
                </div>
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                >
                  {r.pickup_location ?? "—"}
                </span>
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{ backgroundColor: "var(--admin-bg-tertiary)", color: "var(--admin-text-secondary)" }}
                >
                  {r.dropoff_location ?? "—"}
                </span>
              </TD>
              <TD>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3px]"
                  style={{ backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" }}
                >
                  {r.vehicle_class ?? "—"}
                </span>
              </TD>
              <TD className="text-xs text-fg-t7">{offerTitle(r)}</TD>
              <TD>
                <OfferStatusBadge status={r.offer?.status ?? null} />
              </TD>
              <TD align="right">
                <div className="flex justify-end gap-1">
                  {r.offer?.id && isSubmittableStatus(r.offer.status) && (
                    <IconButton
                      onClick={() => void handleSubmitForReview(r.offer!.id!)}
                      aria-label="Submit for review"
                    >
                      <Send />
                    </IconButton>
                  )}
                  {userHasPermission(user, "cars.update") && (
                    <IconButton onClick={() => openEdit(r)} aria-label={t("admin.crud.common.edit")}>
                      <Edit3 />
                    </IconButton>
                  )}
                  {userHasPermission(user, "cars.delete") && (
                    <IconButton onClick={() => void handleDelete(r.id)} aria-label={t("admin.crud.common.delete")}>
                      <Trash2 />
                    </IconButton>
                  )}
                </div>
              </TD>
            </TR>
            );
          })}
        </TBody>
      </Table>
      </V2Card>
      {meta && <PaginationBar meta={meta} onPage={setPage} />}
    </div>
  );
}

function pickAvatarTone(id: number | string): "purple" | "teal" | "amber" | "blue" {
  const tones: Array<"purple" | "teal" | "amber" | "blue"> = ["purple", "teal", "amber", "blue"];
  const n = typeof id === "number" ? id : id.length;
  return tones[n % tones.length]!;
}

function avatarStyle(tone: "purple" | "teal" | "amber" | "blue"): React.CSSProperties {
  const map: Record<"purple" | "teal" | "amber" | "blue", React.CSSProperties> = {
    purple: { backgroundColor: "var(--admin-primary-light)", color: "var(--admin-primary-dark)" },
    teal: { backgroundColor: "var(--admin-success-light)", color: "var(--admin-success-dark)" },
    amber: { backgroundColor: "var(--admin-warning-light)", color: "var(--admin-warning-dark)" },
    blue: { backgroundColor: "var(--admin-info-light)", color: "var(--admin-info-dark)" },
  };
  return map[tone];
}
