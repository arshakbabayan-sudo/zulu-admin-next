/**
 * Car operator-form helpers — extracted from the legacy /operator/cars page so
 * the unified InventoryPage CarsPane can reuse the exact form-state ↔ API
 * mapping (advanced_options JSON v=1 + pricing-rules conditionals). Pure
 * functions, no React.
 */

import type {
  CarRow,
  CarCreatePayload,
  CarUpdatePayload,
  CarExpandedWriteFields,
  CarAdvancedOptionsRow,
  CarPricingRulesRow,
} from "@/lib/inventory-crud-api";

export type FieldErrors = Record<string, string[]>;

export const CAR_PRICING_MODES = ["per_day", "per_hour", "per_km", "fixed", "inherit_offer"] as const;
export const CAR_OPERATIONAL_STATUSES = ["draft", "published", "archived", "suspended"] as const;
export const CAR_AVAILABILITY_STATUSES = ["available", "limited", "booked", "maintenance", "inactive"] as const;
export const CAR_MILEAGE_MODES = ["unlimited", "limited"] as const;
export const CAR_CROSS_BORDER_POLICIES = ["not_allowed", "included", "surcharge_fixed", "surcharge_daily"] as const;
export const CAR_OUT_OF_RADIUS_MODES_WITH_RADIUS = ["flat_fee", "per_km", "not_allowed", "quote_only"] as const;
export const DRIVER_LANG_PRESETS = ["en", "hy", "ru", "de", "fr", "ar", "es"] as const;

export type CarFormState = {
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

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function defaultCarPricingRules(): CarPricingRulesRow {
  return {
    mileage: { mode: "unlimited", included_km_per_rental: null, extra_km_price: null },
    cross_border: { policy: "not_allowed", surcharge_amount: null },
    radius: { service_radius_km: null, out_of_radius_mode: "not_applicable", out_of_radius_flat_fee: null, out_of_radius_per_km: null },
  };
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
    ? (polRaw as CarPricingRulesRow["cross_border"]["policy"]) : "not_allowed";
  const rad = o.radius && typeof o.radius === "object" ? (o.radius as Record<string, unknown>) : {};
  const sr = numOrNull(rad.service_radius_km);
  const allOrm = ["not_applicable", ...CAR_OUT_OF_RADIUS_MODES_WITH_RADIUS];
  const ormRaw = rad.out_of_radius_mode;
  let orm: CarPricingRulesRow["radius"]["out_of_radius_mode"] = "not_applicable";
  if (typeof ormRaw === "string" && (allOrm as readonly string[]).includes(ormRaw)) {
    orm = ormRaw as CarPricingRulesRow["radius"]["out_of_radius_mode"];
  }
  if (sr == null || sr <= 0) orm = "not_applicable";
  return {
    mileage: { mode, included_km_per_rental: numOrNull(mileage.included_km_per_rental), extra_km_price: numOrNull(mileage.extra_km_price) },
    cross_border: { policy: pol, surcharge_amount: numOrNull(cb.surcharge_amount) },
    radius: { service_radius_km: sr, out_of_radius_mode: orm, out_of_radius_flat_fee: numOrNull(rad.out_of_radius_flat_fee), out_of_radius_per_km: numOrNull(rad.out_of_radius_per_km) },
  };
}

export function defaultCarAdvancedOptions(): CarAdvancedOptionsRow {
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
    child_seats: { available: Boolean(a.child_seats?.available), types: Array.isArray(a.child_seats?.types) ? [...a.child_seats.types] : [] },
    extra_luggage: {
      additional_suitcases_max: Math.max(0, Math.min(255, Number(a.extra_luggage?.additional_suitcases_max ?? 0))),
      additional_small_bags_max: Math.max(0, Math.min(255, Number(a.extra_luggage?.additional_small_bags_max ?? 0))),
      notes: a.extra_luggage?.notes ?? null,
    },
    services: Array.isArray(a.services) ? [...a.services] : [],
    driver_languages: Array.isArray(a.driver_languages) ? [...a.driver_languages] : [],
    pricing_rules: carPricingRulesFromApi(a.pricing_rules),
  };
}

export function isoToDatetimeLocal(iso: string | null | undefined): string {
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

export function emptyCarForm(): Omit<CarFormState, "offer_id" | "company_id"> {
  return {
    location_id: "", pickup_location: "", dropoff_location: "", vehicle_class: "", vehicle_type: "", brand: "", model: "",
    year: "", transmission_type: "", fuel_type: "", fleet: "", category: "", seats: "", suitcases: "", small_bag: "",
    availability_window_start: "", availability_window_end: "", pricing_mode: "", base_price: "", status: "", availability_status: "",
    advanced_options: defaultCarAdvancedOptions(), main_image: "", short_description: "", latitude: "", longitude: "",
  };
}

export function carFormFromRow(r: CarRow): CarFormState {
  const cid = r.company_id != null ? Number(r.company_id) : r.offer?.company_id != null ? Number(r.offer.company_id) : "";
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

export function validateCarForm(form: CarFormState, isCreate: boolean): FieldErrors | null {
  const e: FieldErrors = {};
  if (isCreate) {
    if (form.offer_id === "") e.offer_id = ["Select an offer."];
    if (form.company_id === "") e.company_id = ["Company is required."];
  }
  if (!form.pickup_location.trim()) e.pickup_location = ["Pickup location is required."];
  if (!form.dropoff_location.trim()) e.dropoff_location = ["Dropoff location is required."];
  if (!form.vehicle_class.trim()) e.vehicle_class = ["Vehicle class is required."];
  if (form.year !== "") { const y = Number(form.year); if (!Number.isInteger(y) || y < 1900 || y > 2100) e.year = ["Year must be between 1900 and 2100."]; }
  if (form.seats !== "") { const n = Number(form.seats); if (!Number.isInteger(n) || n < 1 || n > 255) e.seats = ["Seats must be an integer from 1 to 255."]; }
  if (form.suitcases !== "") { const n = Number(form.suitcases); if (!Number.isInteger(n) || n < 0 || n > 255) e.suitcases = ["Suitcases must be an integer from 0 to 255."]; }
  if (form.small_bag !== "") { const n = Number(form.small_bag); if (!Number.isInteger(n) || n < 0 || n > 255) e.small_bag = ["Small bags must be an integer from 0 to 255."]; }
  if (form.base_price !== "") { const n = Number(form.base_price); if (Number.isNaN(n) || n < 0) e.base_price = ["Base price must be a number ≥ 0."]; }
  const startIso = datetimeLocalToIsoOrNull(form.availability_window_start);
  const endIso = datetimeLocalToIsoOrNull(form.availability_window_end);
  if (form.availability_window_start.trim() && !startIso) e.availability_window_start = ["Enter a valid availability start date/time."];
  if (form.availability_window_end.trim() && !endIso) e.availability_window_end = ["Enter a valid availability end date/time."];
  if (startIso && endIso && new Date(endIso) < new Date(startIso)) e.availability_window_end = ["Availability end must be on or after the start."];

  const pr = form.advanced_options.pricing_rules;
  if (pr.mileage.mode === "limited") { const ik = pr.mileage.included_km_per_rental; if (ik == null || ik < 1) e.pr_included_km = ["Included km is required when mileage is limited."]; }
  if (pr.cross_border.policy === "surcharge_fixed" || pr.cross_border.policy === "surcharge_daily") { const amt = pr.cross_border.surcharge_amount; if (amt == null || amt <= 0) e.pr_surcharge = ["Surcharge amount is required for this policy."]; }
  const rkm = pr.radius.service_radius_km;
  if (rkm != null && rkm > 0) {
    if (pr.radius.out_of_radius_mode === "not_applicable") e.pr_out_mode = ["Choose out-of-radius pricing when a service radius is set."];
    const orm = pr.radius.out_of_radius_mode;
    if (orm === "flat_fee") { const ff = pr.radius.out_of_radius_flat_fee; if (ff == null || ff < 0) e.pr_flat = ["Flat fee is required (≥ 0)."]; }
    if (orm === "per_km") { const pk = pr.radius.out_of_radius_per_km; if (pk == null || pk < 0) e.pr_per_km = ["Per-km price is required (≥ 0)."]; }
  }
  return Object.keys(e).length === 0 ? null : e;
}

function sanitizeAdvancedOptionsForApi(a: CarAdvancedOptionsRow): CarAdvancedOptionsRow {
  let pr: CarPricingRulesRow = { ...a.pricing_rules };
  if (pr.mileage.mode === "unlimited") pr = { ...pr, mileage: { mode: "unlimited", included_km_per_rental: null, extra_km_price: null } };
  if (pr.cross_border.policy !== "surcharge_fixed" && pr.cross_border.policy !== "surcharge_daily") pr = { ...pr, cross_border: { ...pr.cross_border, surcharge_amount: null } };
  if (pr.radius.service_radius_km == null || pr.radius.service_radius_km <= 0) {
    pr = { ...pr, radius: { service_radius_km: null, out_of_radius_mode: "not_applicable", out_of_radius_flat_fee: null, out_of_radius_per_km: null } };
  } else {
    const mode = pr.radius.out_of_radius_mode;
    pr = { ...pr, radius: { ...pr.radius, out_of_radius_flat_fee: mode === "flat_fee" ? pr.radius.out_of_radius_flat_fee : null, out_of_radius_per_km: mode === "per_km" ? pr.radius.out_of_radius_per_km : null } };
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

export function buildCreatePayload(form: CarFormState): CarCreatePayload {
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

export function buildUpdatePayload(form: CarFormState): CarUpdatePayload {
  return {
    location_id: form.location_id === "" ? null : Number(form.location_id),
    pickup_location: form.pickup_location.trim(),
    dropoff_location: form.dropoff_location.trim(),
    vehicle_class: form.vehicle_class.trim(),
    ...(mergeExpandedFromForm(form) as CarExpandedWriteFields),
  };
}
