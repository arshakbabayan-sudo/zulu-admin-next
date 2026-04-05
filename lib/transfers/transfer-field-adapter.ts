import type { TransferRow } from "@/lib/inventory-crud-api";

export type TransferCanonicalFields = {
  visibility_rule: string;
  appears_in_web: boolean;
  appears_in_admin: boolean;
  appears_in_zulu_admin: boolean;
  transfer_title: string;
  transfer_type: string;
  pickup_country: string;
  pickup_city: string;
  pickup_point_type: string;
  pickup_point_name: string;
  dropoff_country: string;
  dropoff_city: string;
  dropoff_point_type: string;
  dropoff_point_name: string;
  pickup_latitude: number | "";
  pickup_longitude: number | "";
  dropoff_latitude: number | "";
  dropoff_longitude: number | "";
  route_distance_km: number | "";
  route_label: string;
  service_date: string;
  pickup_time: string;
  estimated_duration_minutes: number | "";
  availability_window_start: string;
  availability_window_end: string;
  vehicle_category: string;
  vehicle_class: string;
  private_or_shared: string;
  passenger_capacity: number | "";
  luggage_capacity: number | "";
  minimum_passengers: number | "";
  maximum_passengers: number | "";
  maximum_luggage: number | "";
  child_seat_available: boolean;
  child_seat_required_rule: string;
  accessibility_support: boolean;
  special_assistance_supported: boolean;
  pricing_mode: string;
  base_price: number | "";
  free_cancellation: boolean;
  cancellation_policy_type: string;
  cancellation_deadline_at: string;
  availability_status: string;
  bookable: boolean;
  is_package_eligible: boolean;
  status: string;
};

/**
 * Operator UI form state.
 * - UI uses user-friendly labels, but the keys are canonical API/storage keys.
 * - `offer_id` is create-only; TransferController prohibits it on PATCH.
 * - `currency` is display-only (Offer::currency); backend transfer endpoints do not accept it.
 */
export type TransferFormValues = TransferCanonicalFields & {
  offer_id: number | null;
  currency: string;
};

const TRANSFER_VEHICLE_CATEGORIES = [
  "sedan",
  "suv",
  "minivan",
  "minibus",
  "bus",
  "luxury_car",
] as const;
type TransferVehicleCategory = (typeof TRANSFER_VEHICLE_CATEGORIES)[number];

const TRANSFER_TYPES = [
  "airport_transfer",
  "hotel_transfer",
  "city_transfer",
  "private_transfer",
  "shared_transfer",
  "intercity_transfer",
] as const;
type TransferType = (typeof TRANSFER_TYPES)[number];

const TRANSFER_POINT_TYPES = ["airport", "hotel", "address", "station", "port", "landmark"] as const;
type TransferPointType = (typeof TRANSFER_POINT_TYPES)[number];

const TRANSFER_PRICING_MODES = ["per_vehicle", "per_person"] as const;
type TransferPricingMode = (typeof TRANSFER_PRICING_MODES)[number];

const TRANSFER_AVAILABILITY_STATUSES = ["available", "unavailable"] as const;
type TransferAvailabilityStatus = (typeof TRANSFER_AVAILABILITY_STATUSES)[number];

const TRANSFER_STATUSES = ["draft", "active", "inactive", "archived"] as const;
type TransferStatus = (typeof TRANSFER_STATUSES)[number];

function normalizeVehicleCategory(input?: string | null): TransferVehicleCategory {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return "sedan";

  const normalized = raw
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .slice(0, 32);

  const direct = TRANSFER_VEHICLE_CATEGORIES.find((c) => c === normalized);
  if (direct) return direct;

  // Backward-compat / human-ish aliases.
  if (normalized === "van") return "minivan";
  if (normalized === "luxurycar") return "luxury_car";
  if (normalized === "luxury_car") return "luxury_car";

  // Fallback to keep payload valid even if UI entered an unexpected value.
  return "sedan";
}

function normalizeTransferType(input?: string | null): TransferType {
  const raw = (input ?? "").trim().toLowerCase();
  const direct = TRANSFER_TYPES.find((t) => t === raw);
  return direct ?? "city_transfer";
}

function normalizePointType(input?: string | null): TransferPointType {
  const raw = (input ?? "").trim().toLowerCase();
  const direct = TRANSFER_POINT_TYPES.find((t) => t === raw);
  return direct ?? "address";
}

function normalizePricingMode(input?: string | null): TransferPricingMode {
  const raw = (input ?? "").trim().toLowerCase();
  const direct = TRANSFER_PRICING_MODES.find((t) => t === raw);
  return direct ?? "per_vehicle";
}

function normalizeAvailabilityStatus(input?: string | null): TransferAvailabilityStatus {
  const raw = (input ?? "").trim().toLowerCase();
  const direct = TRANSFER_AVAILABILITY_STATUSES.find((t) => t === raw);
  return direct ?? "available";
}

function normalizeStatus(input?: string | null): TransferStatus {
  const raw = (input ?? "").trim().toLowerCase();
  const direct = TRANSFER_STATUSES.find((t) => t === raw);
  return direct ?? "draft";
}

function trimOrEmpty(s?: string | null): string {
  return (s ?? "").trim();
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeTimeToHMS(input?: string | null): string {
  const raw = trimOrEmpty(input);
  if (!raw) return "09:00:00";
  // Accept `HH:MM` from <input type="time"> or `HH:MM:SS` from API.
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return "09:00:00";
}

/** API ISO8601 datetime → `datetime-local` input value (local wall clock). */
function dateTimeLocalFromApi(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function newTransferForm(offerId: number | null, currency: string): TransferFormValues {
  return {
    offer_id: offerId,
    currency: (currency || "USD").toString(),
    visibility_rule: "show_all",
    appears_in_web: true,
    appears_in_admin: true,
    appears_in_zulu_admin: true,
    transfer_title: "",
    transfer_type: "city_transfer",
    pickup_country: "Unknown",
    pickup_city: "",
    pickup_point_type: "address",
    pickup_point_name: "Unknown",
    dropoff_country: "Unknown",
    dropoff_city: "",
    dropoff_point_type: "address",
    dropoff_point_name: "Unknown",
    pickup_latitude: "",
    pickup_longitude: "",
    dropoff_latitude: "",
    dropoff_longitude: "",
    route_distance_km: "",
    route_label: "",
    service_date: todayISO(),
    pickup_time: "09:00:00",
    estimated_duration_minutes: 60,
    availability_window_start: "",
    availability_window_end: "",
    vehicle_category: "sedan",
    vehicle_class: "",
    private_or_shared: "",
    passenger_capacity: 1,
    luggage_capacity: 0,
    minimum_passengers: 1,
    maximum_passengers: 1,
    maximum_luggage: "",
    child_seat_available: false,
    child_seat_required_rule: "",
    accessibility_support: false,
    special_assistance_supported: false,
    pricing_mode: "per_vehicle",
    base_price: "",
    free_cancellation: false,
    cancellation_policy_type: "non_refundable",
    cancellation_deadline_at: "",
    availability_status: "available",
    bookable: true,
    is_package_eligible: false,
    status: "draft",
  };
}

export function transferFormFromRow(row: TransferRow): TransferFormValues {
  return {
    offer_id: null,
    currency: row.offer?.currency ?? "USD",
    visibility_rule: (row as any).visibility_rule ?? "show_all",
    appears_in_web: (row as any).appears_in_web !== false,
    appears_in_admin: (row as any).appears_in_admin !== false,
    appears_in_zulu_admin: (row as any).appears_in_zulu_admin !== false,
    transfer_title: row.transfer_title ?? "",
    transfer_type: row.transfer_type ?? "city_transfer",
    pickup_country: row.pickup_country ?? "",
    pickup_city: row.pickup_city ?? "",
    pickup_point_type: row.pickup_point_type ?? "address",
    pickup_point_name: row.pickup_point_name ?? "",
    dropoff_country: row.dropoff_country ?? "",
    dropoff_city: row.dropoff_city ?? "",
    dropoff_point_type: row.dropoff_point_type ?? "address",
    dropoff_point_name: row.dropoff_point_name ?? "",
    pickup_latitude: row.pickup_latitude != null ? Number(row.pickup_latitude) : "",
    pickup_longitude: row.pickup_longitude != null ? Number(row.pickup_longitude) : "",
    dropoff_latitude: row.dropoff_latitude != null ? Number(row.dropoff_latitude) : "",
    dropoff_longitude: row.dropoff_longitude != null ? Number(row.dropoff_longitude) : "",
    route_distance_km: row.route_distance_km != null ? Number(row.route_distance_km) : "",
    route_label: row.route_label ?? "",
    service_date: row.service_date ?? todayISO(),
    pickup_time: normalizeTimeToHMS(row.pickup_time ?? null),
    estimated_duration_minutes:
      row.estimated_duration_minutes != null ? Number(row.estimated_duration_minutes) : 60,
    availability_window_start: dateTimeLocalFromApi(row.availability_window_start),
    availability_window_end: dateTimeLocalFromApi(row.availability_window_end),
    vehicle_category: row.vehicle_category ?? "sedan",
    vehicle_class: row.vehicle_class ?? "",
    private_or_shared: row.private_or_shared ?? "",
    passenger_capacity: row.passenger_capacity != null ? Number(row.passenger_capacity) : 1,
    luggage_capacity: row.luggage_capacity != null ? Number(row.luggage_capacity) : 0,
    minimum_passengers: row.minimum_passengers != null ? Number(row.minimum_passengers) : 1,
    maximum_passengers: row.maximum_passengers != null ? Number(row.maximum_passengers) : (row.passenger_capacity != null ? Number(row.passenger_capacity) : 1),
    maximum_luggage: row.maximum_luggage != null ? Number(row.maximum_luggage) : "",
    child_seat_available: Boolean(row.child_seat_available),
    child_seat_required_rule: row.child_seat_required_rule ?? "",
    accessibility_support: Boolean(row.accessibility_support),
    special_assistance_supported: Boolean(row.special_assistance_supported),
    pricing_mode: row.pricing_mode ?? "per_vehicle",
    base_price: row.base_price != null ? Number(row.base_price) : "",
    free_cancellation: Boolean(row.free_cancellation),
    cancellation_policy_type: row.cancellation_policy_type ?? "non_refundable",
    cancellation_deadline_at: dateTimeLocalFromApi(row.cancellation_deadline_at),
    availability_status: row.availability_status ?? "available",
    bookable: row.bookable !== false,
    is_package_eligible: Boolean(row.is_package_eligible),
    status: row.status ?? "draft",
  };
}

export function transferCreateBodyFromForm(form: TransferFormValues): Record<string, unknown> {
  const offerId = form.offer_id;
  if (offerId == null || !Number.isFinite(Number(offerId))) {
    throw new Error("Missing offer_id for transfer create.");
  }

  const pickupCity = trimOrEmpty(form.pickup_city);
  const dropoffCity = trimOrEmpty(form.dropoff_city);
  const vehicleCategory = normalizeVehicleCategory(form.vehicle_category);
  const title =
    trimOrEmpty(form.transfer_title) ||
    (pickupCity || dropoffCity
      ? `${pickupCity || "Pickup"} -> ${dropoffCity || "Drop-off"}`
      : "Transfer");

  return {
    offer_id: Number(offerId),
    visibility_rule: (form.visibility_rule || "show_all").toString(),
    appears_in_web: Boolean(form.appears_in_web),
    appears_in_admin: Boolean(form.appears_in_admin),
    appears_in_zulu_admin: Boolean(form.appears_in_zulu_admin),
    // Required by TransferService::transferCreateValidationRules
    transfer_title: title.slice(0, 255),
    transfer_type: normalizeTransferType(form.transfer_type),
    pickup_country: (trimOrEmpty(form.pickup_country) || "Unknown").slice(0, 120),
    pickup_city: pickupCity,
    pickup_point_type: normalizePointType(form.pickup_point_type),
    pickup_point_name: trimOrEmpty(form.pickup_point_name) || pickupCity || "Unknown",
    dropoff_country: (trimOrEmpty(form.dropoff_country) || "Unknown").slice(0, 120),
    dropoff_city: dropoffCity,
    dropoff_point_type: normalizePointType(form.dropoff_point_type),
    dropoff_point_name: trimOrEmpty(form.dropoff_point_name) || dropoffCity || "Unknown",
    pickup_latitude: form.pickup_latitude === "" ? null : Number(form.pickup_latitude),
    pickup_longitude: form.pickup_longitude === "" ? null : Number(form.pickup_longitude),
    dropoff_latitude: form.dropoff_latitude === "" ? null : Number(form.dropoff_latitude),
    dropoff_longitude: form.dropoff_longitude === "" ? null : Number(form.dropoff_longitude),
    route_distance_km: form.route_distance_km === "" ? null : Math.max(0, Number(form.route_distance_km)),
    route_label: trimOrEmpty(form.route_label) || null,
    service_date: trimOrEmpty(form.service_date),
    pickup_time: normalizeTimeToHMS(form.pickup_time),
    estimated_duration_minutes:
      form.estimated_duration_minutes === "" ? 60 : Math.max(1, Math.floor(Number(form.estimated_duration_minutes))),
    availability_window_start: trimOrEmpty(form.availability_window_start) || null,
    availability_window_end: trimOrEmpty(form.availability_window_end) || null,
    vehicle_category: vehicleCategory,
    vehicle_class: trimOrEmpty(form.vehicle_class) || null,
    private_or_shared: trimOrEmpty(form.private_or_shared) || null,
    // Minimal required inventory capacities (defaults handle the rest).
    passenger_capacity:
      form.passenger_capacity === "" ? 1 : Math.max(1, Math.floor(Number(form.passenger_capacity))),
    luggage_capacity:
      form.luggage_capacity === "" ? 0 : Math.max(0, Math.floor(Number(form.luggage_capacity))),
    minimum_passengers:
      form.minimum_passengers === "" ? 1 : Math.max(1, Math.floor(Number(form.minimum_passengers))),
    maximum_passengers:
      form.maximum_passengers === "" ? null : Math.max(1, Math.floor(Number(form.maximum_passengers))),
    maximum_luggage:
      form.maximum_luggage === "" ? null : Math.max(0, Math.floor(Number(form.maximum_luggage))),
    child_seat_available: Boolean(form.child_seat_available),
    child_seat_required_rule: trimOrEmpty(form.child_seat_required_rule) || null,
    accessibility_support: Boolean(form.accessibility_support),
    special_assistance_supported: Boolean(form.special_assistance_supported),
    pricing_mode: normalizePricingMode(form.pricing_mode),
    base_price: form.base_price === "" ? 0 : Math.max(0, Number(form.base_price)),
    free_cancellation: Boolean(form.free_cancellation),
    cancellation_policy_type: (trimOrEmpty(form.cancellation_policy_type) || "non_refundable").slice(0, 32),
    cancellation_deadline_at: trimOrEmpty(form.cancellation_deadline_at) || null,
    availability_status: normalizeAvailabilityStatus(form.availability_status),
    bookable: Boolean(form.bookable),
    is_package_eligible: Boolean(form.is_package_eligible),
    status: normalizeStatus(form.status),
  };
}

export function transferUpdateBodyFromForm(form: TransferFormValues): Record<string, unknown> {
  return {
    visibility_rule: (form.visibility_rule || "show_all").toString(),
    appears_in_web: Boolean(form.appears_in_web),
    appears_in_admin: Boolean(form.appears_in_admin),
    appears_in_zulu_admin: Boolean(form.appears_in_zulu_admin),
    transfer_title: trimOrEmpty(form.transfer_title).slice(0, 255),
    transfer_type: normalizeTransferType(form.transfer_type),
    pickup_country: trimOrEmpty(form.pickup_country).slice(0, 120),
    pickup_city: trimOrEmpty(form.pickup_city),
    pickup_point_type: normalizePointType(form.pickup_point_type),
    pickup_point_name: trimOrEmpty(form.pickup_point_name),
    dropoff_country: trimOrEmpty(form.dropoff_country).slice(0, 120),
    dropoff_city: trimOrEmpty(form.dropoff_city),
    dropoff_point_type: normalizePointType(form.dropoff_point_type),
    dropoff_point_name: trimOrEmpty(form.dropoff_point_name),
    pickup_latitude: form.pickup_latitude === "" ? null : Number(form.pickup_latitude),
    pickup_longitude: form.pickup_longitude === "" ? null : Number(form.pickup_longitude),
    dropoff_latitude: form.dropoff_latitude === "" ? null : Number(form.dropoff_latitude),
    dropoff_longitude: form.dropoff_longitude === "" ? null : Number(form.dropoff_longitude),
    route_distance_km: form.route_distance_km === "" ? null : Math.max(0, Number(form.route_distance_km)),
    route_label: trimOrEmpty(form.route_label) || null,
    service_date: trimOrEmpty(form.service_date),
    pickup_time: normalizeTimeToHMS(form.pickup_time),
    estimated_duration_minutes:
      form.estimated_duration_minutes === "" ? 60 : Math.max(1, Math.floor(Number(form.estimated_duration_minutes))),
    availability_window_start: trimOrEmpty(form.availability_window_start) || null,
    availability_window_end: trimOrEmpty(form.availability_window_end) || null,
    vehicle_category: normalizeVehicleCategory(form.vehicle_category),
    vehicle_class: trimOrEmpty(form.vehicle_class) || null,
    private_or_shared: trimOrEmpty(form.private_or_shared) || null,
    passenger_capacity:
      form.passenger_capacity === "" ? 1 : Math.max(1, Math.floor(Number(form.passenger_capacity))),
    luggage_capacity:
      form.luggage_capacity === "" ? 0 : Math.max(0, Math.floor(Number(form.luggage_capacity))),
    minimum_passengers:
      form.minimum_passengers === "" ? 1 : Math.max(1, Math.floor(Number(form.minimum_passengers))),
    maximum_passengers:
      form.maximum_passengers === "" ? null : Math.max(1, Math.floor(Number(form.maximum_passengers))),
    maximum_luggage:
      form.maximum_luggage === "" ? null : Math.max(0, Math.floor(Number(form.maximum_luggage))),
    child_seat_available: Boolean(form.child_seat_available),
    child_seat_required_rule: trimOrEmpty(form.child_seat_required_rule) || null,
    accessibility_support: Boolean(form.accessibility_support),
    special_assistance_supported: Boolean(form.special_assistance_supported),
    pricing_mode: normalizePricingMode(form.pricing_mode),
    base_price: form.base_price === "" ? 0 : Math.max(0, Number(form.base_price)),
    free_cancellation: Boolean(form.free_cancellation),
    cancellation_policy_type: (trimOrEmpty(form.cancellation_policy_type) || "non_refundable").slice(0, 32),
    cancellation_deadline_at: trimOrEmpty(form.cancellation_deadline_at) || null,
    availability_status: normalizeAvailabilityStatus(form.availability_status),
    bookable: Boolean(form.bookable),
    is_package_eligible: Boolean(form.is_package_eligible),
    status: normalizeStatus(form.status),
  };
}

