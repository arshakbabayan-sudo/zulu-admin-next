/**
 * csv-parser.ts
 *
 * Pure CSV ↔ domain-model conversion layer: no API calls, no side effects.
 * Each module section provides:
 *   - CSV_FIELDS constant   — column order for template / export
 *   - rowToPayload / rowToFormValues / rowToWizard  — CSV row → typed payload
 *   - validate*             — lightweight pre-send validation
 *   - detailToExportRow     — API response row → flat CSV record
 *   - *TemplateCsv          — empty template string
 */

import { toCanonicalFlightCabinClass } from "@/lib/flight-cabin-class";
import {
  hotelFormFromDetail,
  newHotelPricingFormRow,
  newHotelRoomFormRow,
  type CarAdvancedOptionsRow,
  type CarCreatePayload,
  type CarRow,
  // CarUpdatePayload used by orchestrator via carCsvRowToPayload return type
  type ExcursionRow,
  type FlightPayload,
  type FlightRow,
  type HotelFormPayload,
  type TransferRow,
} from "@/lib/inventory-crud-api";
import { transferFormFromRow, type TransferFormValues } from "@/lib/transfers/transfer-field-adapter";
import { TRANSFER_FIELD_LABELS } from "@/lib/transfers/transfer-ui";
import {
  coreWritePayloadFromWizard,
  expandedPayloadFromWizard,
  validateExcursionWizardFull,
  type ExcursionWizardState,
} from "@/lib/excursions/excursion-wizard-state";
import { stringifyCsv } from "@/lib/csv-primitives";

// ─── Shared primitives ────────────────────────────────────────────────────────

export function parseBool(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

// ─── Flights ──────────────────────────────────────────────────────────────────

export const FLIGHT_CSV_FIELDS: (keyof FlightPayload)[] = [
  "offer_id", "flight_code_internal", "service_type",
  "departure_country", "departure_city", "departure_airport",
  "arrival_country", "arrival_city", "arrival_airport",
  "departure_airport_code", "arrival_airport_code",
  "departure_terminal", "arrival_terminal",
  "departure_at", "arrival_at", "duration_minutes", "timezone_context",
  "check_in_close_at", "boarding_close_at",
  "connection_type", "stops_count", "connection_notes", "layover_summary",
  "cabin_class", "seat_capacity_total", "seat_capacity_available",
  "fare_family", "seat_map_available", "seat_selection_policy",
  "adult_age_from", "child_age_from", "child_age_to",
  "infant_age_from", "infant_age_to",
  "adult_price", "child_price", "infant_price",
  "hand_baggage_included", "checked_baggage_included",
  "hand_baggage_weight", "checked_baggage_weight",
  "extra_baggage_allowed", "baggage_notes",
  "reservation_allowed", "online_checkin_allowed", "airport_checkin_allowed",
  "cancellation_policy_type", "change_policy_type",
  "reservation_deadline_at", "cancellation_deadline_at", "change_deadline_at",
  "policy_notes", "is_package_eligible",
  "appears_in_web", "appears_in_admin", "appears_in_zulu_admin",
  "status",
];

const FLIGHT_REQUIRED_TEMPLATE_FIELDS = new Set<keyof FlightPayload>([
  "offer_id",
  "flight_code_internal",
  "service_type",
  "departure_country",
  "departure_city",
  "departure_airport",
  "arrival_country",
  "arrival_city",
  "arrival_airport",
  "departure_at",
  "arrival_at",
  "duration_minutes",
  "connection_type",
  "stops_count",
  "cabin_class",
  "seat_capacity_total",
  "seat_capacity_available",
  "seat_map_available",
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
  "extra_baggage_allowed",
  "reservation_allowed",
  "online_checkin_allowed",
  "airport_checkin_allowed",
  "cancellation_policy_type",
  "change_policy_type",
  "is_package_eligible",
  "appears_in_web",
  "appears_in_admin",
  "appears_in_zulu_admin",
  "status",
]);

const FLIGHT_TEMPLATE_LABELS: Record<keyof FlightPayload, string> = {
  offer_id: "Offer ID",
  flight_code_internal: "Flight Code Internal",
  service_type: "Service Type",
  departure_country: "Departure Country",
  departure_city: "Departure City",
  departure_airport: "Departure Airport",
  arrival_country: "Arrival Country",
  arrival_city: "Arrival City",
  arrival_airport: "Arrival Airport",
  departure_airport_code: "Departure Airport Code",
  arrival_airport_code: "Arrival Airport Code",
  departure_terminal: "Departure Terminal",
  arrival_terminal: "Arrival Terminal",
  departure_at: "Departure At",
  arrival_at: "Arrival At",
  duration_minutes: "Duration Minutes",
  timezone_context: "Timezone Context",
  check_in_close_at: "Check-in Close At",
  boarding_close_at: "Boarding Close At",
  connection_type: "Connection Type",
  stops_count: "Stops Count",
  connection_notes: "Connection Notes",
  layover_summary: "Layover Summary",
  cabin_class: "Cabin Class",
  seat_capacity_total: "Seat Capacity Total",
  seat_capacity_available: "Seat Capacity Available",
  fare_family: "Fare Family",
  seat_map_available: "Seat Map Available",
  seat_selection_policy: "Seat Selection Policy",
  adult_age_from: "Adult Age From",
  child_age_from: "Child Age From",
  child_age_to: "Child Age To",
  infant_age_from: "Infant Age From",
  infant_age_to: "Infant Age To",
  adult_price: "Adult Price",
  child_price: "Child Price",
  infant_price: "Infant Price",
  hand_baggage_included: "Hand Baggage Included",
  checked_baggage_included: "Checked Baggage Included",
  hand_baggage_weight: "Hand Baggage Weight",
  checked_baggage_weight: "Checked Baggage Weight",
  extra_baggage_allowed: "Extra Baggage Allowed",
  baggage_notes: "Baggage Notes",
  reservation_allowed: "Reservation Allowed",
  online_checkin_allowed: "Online Check-in Allowed",
  airport_checkin_allowed: "Airport Check-in Allowed",
  cancellation_policy_type: "Cancellation Policy Type",
  change_policy_type: "Change Policy Type",
  reservation_deadline_at: "Reservation Deadline At",
  cancellation_deadline_at: "Cancellation Deadline At",
  change_deadline_at: "Change Deadline At",
  policy_notes: "Policy Notes",
  is_package_eligible: "Is Package Eligible",
  appears_in_web: "Appears In Web",
  appears_in_admin: "Appears In Admin",
  appears_in_zulu_admin: "Appears In Zulu Admin",
  status: "Status",
};

function normalizeCsvTemplateHeader(header: string): string {
  return header.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const FLIGHT_IMPORT_HEADER_KEY_MAP: Record<string, "id" | keyof FlightPayload> = (() => {
  const map: Record<string, "id" | keyof FlightPayload> = {
    id: "id",
    "id (update existing; leave blank to create)": "id",
  };
  for (const key of FLIGHT_CSV_FIELDS) {
    map[normalizeCsvTemplateHeader(String(key))] = key;
    map[normalizeCsvTemplateHeader(FLIGHT_TEMPLATE_LABELS[key])] = key;
  }
  return map;
})();

export function normalizeFlightCsvImportRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const mapped = FLIGHT_IMPORT_HEADER_KEY_MAP[normalizeCsvTemplateHeader(header)] ?? header.trim();
    normalized[mapped] = value;
  }
  return normalized;
}

const FLIGHT_NULLABLE: (keyof FlightPayload)[] = [
  "departure_airport_code", "arrival_airport_code",
  "departure_terminal", "arrival_terminal",
  "timezone_context", "check_in_close_at", "boarding_close_at",
  "connection_notes", "layover_summary",
  "fare_family", "seat_selection_policy",
  "hand_baggage_weight", "checked_baggage_weight", "baggage_notes",
  "reservation_deadline_at", "cancellation_deadline_at", "change_deadline_at",
  "policy_notes",
];

export function flightRowToPayload(row: Record<string, string>): FlightPayload {
  const get = (k: string) => (row[k] ?? "").trim();
  const num = (k: string): number | "" => {
    const t = get(k);
    if (t === "") return "";
    const n = Number(t);
    return Number.isFinite(n) ? n : "";
  };
  const payload: FlightPayload = {
    offer_id: num("offer_id") === "" ? "" : Number(num("offer_id")),
    flight_code_internal: get("flight_code_internal"),
    service_type: get("service_type") || "scheduled",
    departure_country: get("departure_country"),
    departure_city: get("departure_city"),
    departure_airport: get("departure_airport"),
    arrival_country: get("arrival_country"),
    arrival_city: get("arrival_city"),
    arrival_airport: get("arrival_airport"),
    departure_airport_code: get("departure_airport_code"),
    arrival_airport_code: get("arrival_airport_code"),
    departure_terminal: get("departure_terminal"),
    arrival_terminal: get("arrival_terminal"),
    departure_at: get("departure_at"),
    arrival_at: get("arrival_at"),
    duration_minutes: num("duration_minutes") === "" ? 0 : Number(num("duration_minutes")),
    timezone_context: get("timezone_context"),
    check_in_close_at: get("check_in_close_at"),
    boarding_close_at: get("boarding_close_at"),
    connection_type: get("connection_type") || "direct",
    stops_count: num("stops_count") === "" ? 0 : Number(num("stops_count")),
    connection_notes: get("connection_notes"),
    layover_summary: get("layover_summary"),
    cabin_class: toCanonicalFlightCabinClass(get("cabin_class")) ?? "economy",
    seat_capacity_total: num("seat_capacity_total") === "" ? 0 : Number(num("seat_capacity_total")),
    seat_capacity_available: num("seat_capacity_available") === "" ? 0 : Number(num("seat_capacity_available")),
    fare_family: get("fare_family"),
    seat_map_available: parseBool(get("seat_map_available")),
    seat_selection_policy: get("seat_selection_policy"),
    adult_age_from: num("adult_age_from") === "" ? 12 : Number(num("adult_age_from")),
    child_age_from: num("child_age_from") === "" ? 2 : Number(num("child_age_from")),
    child_age_to: num("child_age_to") === "" ? 11 : Number(num("child_age_to")),
    infant_age_from: num("infant_age_from") === "" ? 0 : Number(num("infant_age_from")),
    infant_age_to: num("infant_age_to") === "" ? 1 : Number(num("infant_age_to")),
    adult_price: num("adult_price") === "" ? 1 : Number(num("adult_price")),
    child_price: num("child_price") === "" ? 0 : Number(num("child_price")),
    infant_price: num("infant_price") === "" ? 0 : Number(num("infant_price")),
    hand_baggage_included: parseBool(get("hand_baggage_included")),
    checked_baggage_included: parseBool(get("checked_baggage_included")),
    hand_baggage_weight: get("hand_baggage_weight"),
    checked_baggage_weight: get("checked_baggage_weight"),
    extra_baggage_allowed: parseBool(get("extra_baggage_allowed")),
    baggage_notes: get("baggage_notes"),
    reservation_allowed: parseBool(get("reservation_allowed")),
    online_checkin_allowed: parseBool(get("online_checkin_allowed")),
    airport_checkin_allowed: parseBool(get("airport_checkin_allowed")),
    cancellation_policy_type: get("cancellation_policy_type") || "non_refundable",
    change_policy_type: get("change_policy_type") || "not_allowed",
    reservation_deadline_at: get("reservation_deadline_at"),
    cancellation_deadline_at: get("cancellation_deadline_at"),
    change_deadline_at: get("change_deadline_at"),
    policy_notes: get("policy_notes"),
    is_package_eligible: parseBool(get("is_package_eligible")),
    appears_in_web: parseBool(get("appears_in_web")),
    appears_in_admin: parseBool(get("appears_in_admin")),
    appears_in_zulu_admin: parseBool(get("appears_in_zulu_admin")),
    status: get("status") || "draft",
  };
  const copy = { ...payload };
  for (const key of FLIGHT_NULLABLE) {
    if (copy[key] === "") copy[key] = null;
  }
  return copy;
}

export function validateFlightCsvPayload(p: FlightPayload): string | null {
  const oid = Number(p.offer_id);
  if (p.offer_id === "" || p.offer_id == null || !Number.isFinite(oid) || oid <= 0) {
    return "offer_id must be a positive number.";
  }
  const req = [
    p.flight_code_internal, p.departure_country, p.departure_city,
    p.departure_airport, p.arrival_country, p.arrival_city, p.arrival_airport,
  ];
  if (req.some((x) => !String(x ?? "").trim())) return "Missing required text field(s).";
  if (!p.departure_at || !p.arrival_at) return "departure_at and arrival_at are required.";
  if (Number(p.adult_price ?? 0) <= 0) return "adult_price must be > 0.";
  return null;
}

export function flightDetailToCsvRow(f: FlightRow): Record<string, unknown> {
  const o: Record<string, unknown> = { id: f.id };
  for (const key of FLIGHT_CSV_FIELDS) {
    o[String(key)] = (f as Record<string, unknown>)[key] ?? "";
  }
  return o;
}

export function flightTemplateCsv(): string {
  const headers = [
    "ID (Update Existing; leave blank to create)",
    ...FLIGHT_CSV_FIELDS.map((key) =>
      FLIGHT_REQUIRED_TEMPLATE_FIELDS.has(key)
        ? `${FLIGHT_TEMPLATE_LABELS[key]} *`
        : FLIGHT_TEMPLATE_LABELS[key]
    ),
  ];
  return stringifyCsv(headers, [{}]);
}

// ─── Hotels (template + export shape only — no flat import) ──────────────────

export const HOTEL_CSV_FIELDS = [
  "id", "offer_id", "hotel_name", "property_type", "hotel_type",
  "country", "region_or_state", "city", "district_or_area",
  "full_address", "latitude", "longitude", "meal_type", "star_rating",
  "availability_status", "status", "bookable", "is_package_eligible",
  "visibility_rule", "appears_in_packages",
  "free_wifi", "parking", "airport_shuttle", "indoor_pool", "outdoor_pool",
  "room_service", "front_desk_24h", "child_friendly", "accessibility_support",
  "pets_allowed", "free_cancellation", "prepayment_required",
  "cancellation_policy_type", "cancellation_deadline_at", "no_show_policy",
  "review_score", "review_count", "review_label", "room_inventory_mode",
] as const;

const HOTEL_REQUIRED_TEMPLATE_FIELDS = new Set<string>([
  "offer_id",
  "hotel_name",
  "property_type",
  "hotel_type",
  "country",
  "city",
  "meal_type",
  "availability_status",
  "status",
]);

const HOTEL_TEMPLATE_LABELS: Record<string, string> = {
  id: "ID (Update Existing; leave blank to create)",
  offer_id: "Offer ID",
  hotel_name: "Hotel Name",
  property_type: "Property Type",
  hotel_type: "Hotel Type",
  country: "Country",
  region_or_state: "Region or State",
  city: "City",
  district_or_area: "District or Area",
  full_address: "Full Address",
  latitude: "Latitude",
  longitude: "Longitude",
  meal_type: "Meal Type",
  star_rating: "Star Rating",
  availability_status: "Availability Status",
  status: "Status",
  bookable: "Bookable",
  is_package_eligible: "Is Package Eligible",
  visibility_rule: "Visibility Rule",
  appears_in_packages: "Appears In Packages",
  free_wifi: "Free WiFi",
  parking: "Parking",
  airport_shuttle: "Airport Shuttle",
  indoor_pool: "Indoor Pool",
  outdoor_pool: "Outdoor Pool",
  room_service: "Room Service",
  front_desk_24h: "Front Desk 24h",
  child_friendly: "Child Friendly",
  accessibility_support: "Accessibility Support",
  pets_allowed: "Pets Allowed",
  free_cancellation: "Free Cancellation",
  prepayment_required: "Prepayment Required",
  cancellation_policy_type: "Cancellation Policy Type",
  cancellation_deadline_at: "Cancellation Deadline At",
  no_show_policy: "No-show Policy",
  review_score: "Review Score",
  review_count: "Review Count",
  review_label: "Review Label",
  room_inventory_mode: "Room Inventory Mode",
};

const HOTEL_IMPORT_HEADER_KEY_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {
    id: "id",
    "id (update existing; leave blank to create)": "id",
  };
  for (const key of HOTEL_CSV_FIELDS) {
    map[normalizeCsvTemplateHeader(String(key))] = key;
    map[normalizeCsvTemplateHeader(HOTEL_TEMPLATE_LABELS[key] ?? String(key))] = key;
  }
  return map;
})();

export function normalizeHotelCsvImportRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const mapped = HOTEL_IMPORT_HEADER_KEY_MAP[normalizeCsvTemplateHeader(header)] ?? header.trim();
    normalized[mapped] = value;
  }
  return normalized;
}

export function hotelRowToFormPayload(row: Record<string, string>): HotelFormPayload {
  const get = (k: string) => (row[k] ?? "").trim();
  const num = (k: string): number | "" => {
    const t = get(k);
    if (t === "") return "";
    const n = Number(t);
    return Number.isFinite(n) ? n : "";
  };
  const bool = (k: string, fallback = false): boolean => {
    const t = get(k);
    if (t === "") return fallback;
    return parseBool(t);
  };

  // Legacy CSV path: hotels CSV carries no per-room columns, so we fabricate
  // a single placeholder room. Real per-room data flows through the xlsx
  // import pipeline (see lib/xlsx-*).
  const room = newHotelRoomFormRow();
  room.room_type = "standard";
  room.room_name = "Standard Room";
  room.max_adults = 2;
  room.max_children = 0;
  room.max_total_guests = 2;
  room.pricings = [newHotelPricingFormRow()];
  room.pricings[0].price = "100";
  room.pricings[0].currency = "USD";
  room.pricings[0].pricing_mode = "per_night";
  room.pricings[0].status = "active";

  return {
    offer_id: num("offer_id"),
    location_id: "",
    hotel_name: get("hotel_name"),
    property_type: get("property_type") || "hotel",
    hotel_type: get("hotel_type") || "resort",
    country: get("country"),
    region_or_state: get("region_or_state"),
    city: get("city"),
    district_or_area: get("district_or_area"),
    full_address: get("full_address"),
    latitude: get("latitude"),
    longitude: get("longitude"),
    meal_type: get("meal_type") || "bed_and_breakfast",
    star_rating: num("star_rating"),
    availability_status: get("availability_status") || "available",
    status: get("status") || "draft",
    bookable: bool("bookable", true),
    is_package_eligible: bool("is_package_eligible", false),
    visibility_rule: get("visibility_rule") || "show_all",
    appears_in_packages: bool("appears_in_packages", true),
    free_wifi: bool("free_wifi", false),
    parking: bool("parking", false),
    airport_shuttle: bool("airport_shuttle", false),
    indoor_pool: bool("indoor_pool", false),
    outdoor_pool: bool("outdoor_pool", false),
    room_service: bool("room_service", false),
    front_desk_24h: bool("front_desk_24h", false),
    child_friendly: bool("child_friendly", false),
    accessibility_support: bool("accessibility_support", false),
    pets_allowed: bool("pets_allowed", false),
    free_cancellation: bool("free_cancellation", false),
    prepayment_required: bool("prepayment_required", false),
    cancellation_policy_type: get("cancellation_policy_type"),
    cancellation_deadline_at: get("cancellation_deadline_at"),
    no_show_policy: get("no_show_policy"),
    review_score: num("review_score"),
    review_count: num("review_count"),
    review_label: get("review_label"),
    room_inventory_mode: get("room_inventory_mode"),
    rooms: [room],
  };
}

export function hotelFormToFlatCsv(h: ReturnType<typeof hotelFormFromDetail>): Record<string, unknown> {
  return {
    offer_id: h.offer_id === "" ? "" : h.offer_id,
    hotel_name: h.hotel_name,
    property_type: h.property_type,
    hotel_type: h.hotel_type,
    country: h.country,
    region_or_state: h.region_or_state,
    city: h.city,
    district_or_area: h.district_or_area,
    full_address: h.full_address,
    latitude: h.latitude,
    longitude: h.longitude,
    meal_type: h.meal_type,
    star_rating: h.star_rating === "" ? "" : h.star_rating,
    availability_status: h.availability_status,
    status: h.status,
    bookable: h.bookable,
    is_package_eligible: h.is_package_eligible,
    visibility_rule: h.visibility_rule,
    appears_in_packages: h.appears_in_packages,
    free_wifi: h.free_wifi,
    parking: h.parking,
    airport_shuttle: h.airport_shuttle,
    indoor_pool: h.indoor_pool,
    outdoor_pool: h.outdoor_pool,
    room_service: h.room_service,
    front_desk_24h: h.front_desk_24h,
    child_friendly: h.child_friendly,
    accessibility_support: h.accessibility_support,
    pets_allowed: h.pets_allowed,
    free_cancellation: h.free_cancellation,
    prepayment_required: h.prepayment_required,
    cancellation_policy_type: h.cancellation_policy_type,
    cancellation_deadline_at: h.cancellation_deadline_at,
    no_show_policy: h.no_show_policy,
    review_score: h.review_score === "" ? "" : h.review_score,
    review_count: h.review_count === "" ? "" : h.review_count,
    review_label: h.review_label,
    room_inventory_mode: h.room_inventory_mode,
  };
}

export function hotelTemplateCsv(): string {
  const headers = HOTEL_CSV_FIELDS.map((key) => {
    const label = HOTEL_TEMPLATE_LABELS[key] ?? key;
    return HOTEL_REQUIRED_TEMPLATE_FIELDS.has(key) ? `${label} *` : label;
  });
  return stringifyCsv(headers, [{}]);
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export const TRANSFER_CSV_FIELDS: (keyof TransferFormValues)[] = [
  "offer_id", "currency", "visibility_rule",
  "appears_in_web", "appears_in_admin", "appears_in_zulu_admin",
  "transfer_title", "transfer_type",
  "pickup_country", "pickup_city", "pickup_point_type", "pickup_point_name",
  "dropoff_country", "dropoff_city", "dropoff_point_type", "dropoff_point_name",
  "pickup_latitude", "pickup_longitude", "dropoff_latitude", "dropoff_longitude",
  "route_distance_km", "route_label",
  "service_date", "pickup_time", "estimated_duration_minutes",
  "availability_window_start", "availability_window_end",
  "vehicle_category", "vehicle_class", "private_or_shared",
  "passenger_capacity", "luggage_capacity",
  "minimum_passengers", "maximum_passengers", "maximum_luggage",
  "child_seat_available", "child_seat_required_rule",
  "accessibility_support", "special_assistance_supported",
  "pricing_mode", "base_price",
  "free_cancellation", "cancellation_policy_type", "cancellation_deadline_at",
  "availability_status", "bookable", "is_package_eligible", "status",
];

const TRANSFER_REQUIRED_TEMPLATE_FIELDS = new Set<keyof TransferFormValues>([
  "offer_id",
  "transfer_title",
  "transfer_type",
  "service_date",
  "pickup_time",
  "estimated_duration_minutes",
  "pickup_country",
  "pickup_city",
  "pickup_point_type",
  "pickup_point_name",
  "dropoff_country",
  "dropoff_city",
  "dropoff_point_type",
  "dropoff_point_name",
  "vehicle_category",
  "passenger_capacity",
  "luggage_capacity",
  "minimum_passengers",
  "maximum_passengers",
  "child_seat_available",
  "accessibility_support",
  "special_assistance_supported",
  "pricing_mode",
  "base_price",
  "free_cancellation",
  "cancellation_policy_type",
  "visibility_rule",
  "appears_in_web",
  "appears_in_admin",
  "appears_in_zulu_admin",
  "availability_status",
  "bookable",
  "is_package_eligible",
  "status",
]);

const TRANSFER_TEMPLATE_LABELS: Record<keyof TransferFormValues, string> = {
  offer_id: "Offer ID",
  currency: "Currency",
  visibility_rule: TRANSFER_FIELD_LABELS.visibility_rule,
  appears_in_web: TRANSFER_FIELD_LABELS.appears_in_web,
  appears_in_admin: TRANSFER_FIELD_LABELS.appears_in_admin,
  appears_in_zulu_admin: TRANSFER_FIELD_LABELS.appears_in_zulu_admin,
  transfer_title: TRANSFER_FIELD_LABELS.transfer_title,
  transfer_type: TRANSFER_FIELD_LABELS.transfer_type,
  pickup_country: TRANSFER_FIELD_LABELS.pickup_country,
  pickup_city: TRANSFER_FIELD_LABELS.pickup_city,
  pickup_point_type: TRANSFER_FIELD_LABELS.pickup_point_type,
  pickup_point_name: TRANSFER_FIELD_LABELS.pickup_point_name,
  dropoff_country: TRANSFER_FIELD_LABELS.dropoff_country,
  dropoff_city: TRANSFER_FIELD_LABELS.dropoff_city,
  dropoff_point_type: TRANSFER_FIELD_LABELS.dropoff_point_type,
  dropoff_point_name: TRANSFER_FIELD_LABELS.dropoff_point_name,
  pickup_latitude: TRANSFER_FIELD_LABELS.pickup_latitude,
  pickup_longitude: TRANSFER_FIELD_LABELS.pickup_longitude,
  dropoff_latitude: TRANSFER_FIELD_LABELS.dropoff_latitude,
  dropoff_longitude: TRANSFER_FIELD_LABELS.dropoff_longitude,
  route_distance_km: TRANSFER_FIELD_LABELS.route_distance_km,
  route_label: TRANSFER_FIELD_LABELS.route_label,
  service_date: TRANSFER_FIELD_LABELS.service_date,
  pickup_time: TRANSFER_FIELD_LABELS.pickup_time,
  estimated_duration_minutes: TRANSFER_FIELD_LABELS.estimated_duration_minutes,
  availability_window_start: TRANSFER_FIELD_LABELS.availability_window_start,
  availability_window_end: TRANSFER_FIELD_LABELS.availability_window_end,
  vehicle_category: TRANSFER_FIELD_LABELS.vehicle_category,
  vehicle_class: TRANSFER_FIELD_LABELS.vehicle_class,
  private_or_shared: TRANSFER_FIELD_LABELS.private_or_shared,
  passenger_capacity: TRANSFER_FIELD_LABELS.passenger_capacity,
  luggage_capacity: TRANSFER_FIELD_LABELS.luggage_capacity,
  minimum_passengers: TRANSFER_FIELD_LABELS.minimum_passengers,
  maximum_passengers: TRANSFER_FIELD_LABELS.maximum_passengers,
  maximum_luggage: TRANSFER_FIELD_LABELS.maximum_luggage,
  child_seat_available: TRANSFER_FIELD_LABELS.child_seat_available,
  child_seat_required_rule: TRANSFER_FIELD_LABELS.child_seat_required_rule,
  accessibility_support: TRANSFER_FIELD_LABELS.accessibility_support,
  special_assistance_supported: TRANSFER_FIELD_LABELS.special_assistance_supported,
  pricing_mode: TRANSFER_FIELD_LABELS.pricing_mode,
  base_price: TRANSFER_FIELD_LABELS.base_price,
  free_cancellation: TRANSFER_FIELD_LABELS.free_cancellation,
  cancellation_policy_type: TRANSFER_FIELD_LABELS.cancellation_policy_type,
  cancellation_deadline_at: TRANSFER_FIELD_LABELS.cancellation_deadline_at,
  availability_status: TRANSFER_FIELD_LABELS.availability_status,
  bookable: TRANSFER_FIELD_LABELS.bookable,
  is_package_eligible: TRANSFER_FIELD_LABELS.is_package_eligible,
  status: TRANSFER_FIELD_LABELS.status,
};

const TRANSFER_IMPORT_HEADER_KEY_MAP: Record<string, "id" | keyof TransferFormValues> = (() => {
  const map: Record<string, "id" | keyof TransferFormValues> = {
    id: "id",
    "id (update existing; leave blank to create)": "id",
  };
  for (const key of TRANSFER_CSV_FIELDS) {
    map[normalizeCsvTemplateHeader(String(key))] = key;
    map[normalizeCsvTemplateHeader(TRANSFER_TEMPLATE_LABELS[key])] = key;
  }
  return map;
})();

export function normalizeTransferCsvImportRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const mapped = TRANSFER_IMPORT_HEADER_KEY_MAP[normalizeCsvTemplateHeader(header)] ?? header.trim();
    normalized[mapped] = value;
  }
  return normalized;
}

export function transferRowToFormValues(row: Record<string, string>, currencyDefault: string): TransferFormValues {
  const get = (k: string) => (row[k] ?? "").trim();
  const num = (k: string): number | "" => {
    const t = get(k);
    if (t === "") return "";
    const n = Number(t);
    return Number.isFinite(n) ? n : "";
  };
  const oid = get("offer_id");
  return {
    offer_id: oid === "" ? null : Number(oid),
    currency: get("currency") || currencyDefault,
    visibility_rule: get("visibility_rule") || "show_all",
    appears_in_web: parseBool(get("appears_in_web")),
    appears_in_admin: parseBool(get("appears_in_admin")),
    appears_in_zulu_admin: parseBool(get("appears_in_zulu_admin")),
    transfer_title: get("transfer_title"),
    transfer_type: get("transfer_type") || "city_transfer",
    pickup_country: get("pickup_country"),
    pickup_city: get("pickup_city"),
    pickup_point_type: get("pickup_point_type") || "address",
    pickup_point_name: get("pickup_point_name"),
    dropoff_country: get("dropoff_country"),
    dropoff_city: get("dropoff_city"),
    dropoff_point_type: get("dropoff_point_type") || "address",
    dropoff_point_name: get("dropoff_point_name"),
    pickup_latitude: num("pickup_latitude"),
    pickup_longitude: num("pickup_longitude"),
    dropoff_latitude: num("dropoff_latitude"),
    dropoff_longitude: num("dropoff_longitude"),
    route_distance_km: num("route_distance_km"),
    route_label: get("route_label"),
    service_date: get("service_date"),
    pickup_time: get("pickup_time"),
    estimated_duration_minutes: num("estimated_duration_minutes") === "" ? 60 : Number(num("estimated_duration_minutes")),
    availability_window_start: get("availability_window_start"),
    availability_window_end: get("availability_window_end"),
    vehicle_category: get("vehicle_category") || "sedan",
    vehicle_class: get("vehicle_class"),
    private_or_shared: get("private_or_shared"),
    passenger_capacity: num("passenger_capacity") === "" ? 1 : Number(num("passenger_capacity")),
    luggage_capacity: num("luggage_capacity") === "" ? 0 : Number(num("luggage_capacity")),
    minimum_passengers: num("minimum_passengers") === "" ? 1 : Number(num("minimum_passengers")),
    maximum_passengers: num("maximum_passengers"),
    maximum_luggage: num("maximum_luggage"),
    child_seat_available: parseBool(get("child_seat_available")),
    child_seat_required_rule: get("child_seat_required_rule"),
    accessibility_support: parseBool(get("accessibility_support")),
    special_assistance_supported: parseBool(get("special_assistance_supported")),
    pricing_mode: get("pricing_mode") || "per_vehicle",
    base_price: num("base_price"),
    free_cancellation: parseBool(get("free_cancellation")),
    cancellation_policy_type: get("cancellation_policy_type") || "non_refundable",
    cancellation_deadline_at: get("cancellation_deadline_at"),
    availability_status: get("availability_status") || "available",
    bookable: parseBool(get("bookable")),
    is_package_eligible: parseBool(get("is_package_eligible")),
    status: get("status") || "draft",
  };
}

export function transferDetailToCsvRow(r: TransferRow): Record<string, unknown> {
  const f = transferFormFromRow(r);
  const row: Record<string, unknown> = { id: r.id };
  for (const key of TRANSFER_CSV_FIELDS) {
    row[key] = f[key];
  }
  return row;
}

export function transferTemplateCsv(): string {
  const headers = [
    "ID (Update Existing; leave blank to create)",
    ...TRANSFER_CSV_FIELDS.map((key) =>
      TRANSFER_REQUIRED_TEMPLATE_FIELDS.has(key)
        ? `${TRANSFER_TEMPLATE_LABELS[key]} *`
        : TRANSFER_TEMPLATE_LABELS[key]
    ),
  ];
  return stringifyCsv(headers, [{}]);
}

// ─── Cars ─────────────────────────────────────────────────────────────────────

export const CAR_CSV_FIELDS = [
  "offer_id", "company_id",
  "pickup_location", "dropoff_location", "vehicle_class",
  "vehicle_type", "brand", "model", "year",
  "transmission_type", "fuel_type", "fleet", "category",
  "seats", "suitcases", "small_bag",
  "availability_window_start", "availability_window_end",
  "pricing_mode", "base_price", "status", "availability_status",
] as const;

type CarCsvField = (typeof CAR_CSV_FIELDS)[number];

const CAR_REQUIRED_TEMPLATE_FIELDS = new Set<CarCsvField>([
  "offer_id",
  "pickup_location",
  "dropoff_location",
  "vehicle_class",
]);

const CAR_TEMPLATE_LABELS: Record<CarCsvField, string> = {
  offer_id: "Offer ID",
  company_id: "Company ID",
  pickup_location: "Pickup Location",
  dropoff_location: "Drop-off Location",
  vehicle_class: "Vehicle Class",
  vehicle_type: "Vehicle Type",
  brand: "Brand",
  model: "Model",
  year: "Year",
  transmission_type: "Transmission Type",
  fuel_type: "Fuel Type",
  fleet: "Fleet",
  category: "Category",
  seats: "Seats",
  suitcases: "Suitcases",
  small_bag: "Small Bag",
  availability_window_start: "Availability Window Start",
  availability_window_end: "Availability Window End",
  pricing_mode: "Pricing Mode",
  base_price: "Base Price",
  status: "Status",
  availability_status: "Availability Status",
};

const CAR_IMPORT_HEADER_KEY_MAP: Record<string, "id" | CarCsvField> = (() => {
  const map: Record<string, "id" | CarCsvField> = {
    id: "id",
    "id (update existing; leave blank to create)": "id",
  };
  for (const key of CAR_CSV_FIELDS) {
    map[normalizeCsvTemplateHeader(String(key))] = key;
    map[normalizeCsvTemplateHeader(CAR_TEMPLATE_LABELS[key])] = key;
  }
  return map;
})();

export function normalizeCarCsvImportRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const mapped = CAR_IMPORT_HEADER_KEY_MAP[normalizeCsvTemplateHeader(header)] ?? header.trim();
    normalized[mapped] = value;
  }
  return normalized;
}

export function defaultCarAdvancedForCsv(): CarAdvancedOptionsRow {
  return {
    v: 1,
    child_seats: { available: false, types: [] },
    extra_luggage: { additional_suitcases_max: 0, additional_small_bags_max: 0, notes: null },
    services: [],
    driver_languages: [],
    pricing_rules: {
      mileage: { mode: "unlimited", included_km_per_rental: null, extra_km_price: null },
      cross_border: { policy: "not_allowed", surcharge_amount: null },
      radius: {
        service_radius_km: null,
        out_of_radius_mode: "not_applicable",
        out_of_radius_flat_fee: null,
        out_of_radius_per_km: null,
      },
    },
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

export function carDetailToCsvRow(r: CarRow): Record<string, unknown> {
  return {
    id: r.id,
    offer_id: r.offer_id ?? "",
    company_id: r.company_id ?? r.offer?.company_id ?? "",
    pickup_location: r.pickup_location ?? "",
    dropoff_location: r.dropoff_location ?? "",
    vehicle_class: r.vehicle_class ?? "",
    vehicle_type: r.vehicle_type ?? "",
    brand: r.brand ?? "",
    model: r.model ?? "",
    year: r.year ?? "",
    transmission_type: r.transmission_type ?? "",
    fuel_type: r.fuel_type ?? "",
    fleet: r.fleet ?? "",
    category: r.category ?? "",
    seats: r.seats ?? "",
    suitcases: r.suitcases ?? "",
    small_bag: r.small_bag ?? "",
    availability_window_start: isoToDatetimeLocal(r.availability_window_start),
    availability_window_end: isoToDatetimeLocal(r.availability_window_end),
    pricing_mode: r.pricing_mode ?? "",
    base_price: r.base_price ?? "",
    status: r.status ?? "",
    availability_status: r.availability_status ?? "",
  };
}

export function carCsvRowToPayload(
  row: Record<string, string>
): Omit<CarCreatePayload, "offer_id" | "company_id" | "pickup_location" | "dropoff_location" | "vehicle_class"> {
  const get = (k: string) => (row[k] ?? "").trim();
  const num = (k: string): number | null => {
    const t = get(k);
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const trimOrNull = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    vehicle_type: trimOrNull(get("vehicle_type")),
    brand: trimOrNull(get("brand")),
    model: trimOrNull(get("model")),
    year: num("year"),
    transmission_type: trimOrNull(get("transmission_type")),
    fuel_type: trimOrNull(get("fuel_type")),
    fleet: trimOrNull(get("fleet")),
    category: trimOrNull(get("category")),
    seats: num("seats"),
    suitcases: num("suitcases"),
    small_bag: num("small_bag"),
    availability_window_start: datetimeLocalToIsoOrNull(get("availability_window_start")),
    availability_window_end: datetimeLocalToIsoOrNull(get("availability_window_end")),
    pricing_mode: trimOrNull(get("pricing_mode")),
    base_price: num("base_price"),
    status: trimOrNull(get("status")),
    availability_status: trimOrNull(get("availability_status")),
    advanced_options: defaultCarAdvancedForCsv(),
  };
}

export function carTemplateCsv(): string {
  const headers = [
    "ID (Update Existing; leave blank to create)",
    ...CAR_CSV_FIELDS.map((key) =>
      CAR_REQUIRED_TEMPLATE_FIELDS.has(key)
        ? `${CAR_TEMPLATE_LABELS[key]} *`
        : CAR_TEMPLATE_LABELS[key]
    ),
  ];
  return stringifyCsv(headers, [{}]);
}

// ─── Excursions ───────────────────────────────────────────────────────────────

export const EXCURSION_CSV_FIELDS = [
  "offer_id", "company_id",
  "country", "city", "general_category", "category", "excursion_type",
  "tour_name", "overview", "duration",
  "starts_at", "ends_at", "language",
  "group_size", "ticket_max_count",
  "status", "is_available", "is_bookable",
  "meeting_pickup", "additional_info", "cancellation_policy",
  "includes_json", "photos_json",
  "visibility_rule", "appears_in_web", "appears_in_admin", "appears_in_zulu_admin",
] as const;

type ExcursionCsvField = (typeof EXCURSION_CSV_FIELDS)[number];

const EXCURSION_REQUIRED_TEMPLATE_FIELDS = new Set<ExcursionCsvField>([
  "offer_id",
  "country",
  "city",
  "duration",
  "language",
  "group_size",
]);

const EXCURSION_TEMPLATE_LABELS: Record<ExcursionCsvField, string> = {
  offer_id: "Offer ID",
  company_id: "Company ID",
  country: "Country",
  city: "City",
  general_category: "General Category",
  category: "Category",
  excursion_type: "Excursion Type",
  tour_name: "Tour Name",
  overview: "Overview",
  duration: "Duration",
  starts_at: "Starts At",
  ends_at: "Ends At",
  language: "Language",
  group_size: "Group Size",
  ticket_max_count: "Ticket Max Count",
  status: "Status",
  is_available: "Is Available",
  is_bookable: "Is Bookable",
  meeting_pickup: "Meeting / Pickup",
  additional_info: "Additional Info",
  cancellation_policy: "Cancellation Policy",
  includes_json: "Includes (JSON Array)",
  photos_json: "Photos (JSON Array)",
  visibility_rule: "Visibility Rule",
  appears_in_web: "Appears In Web",
  appears_in_admin: "Appears In Admin",
  appears_in_zulu_admin: "Appears In Zulu Admin",
};

const EXCURSION_IMPORT_HEADER_KEY_MAP: Record<string, "id" | ExcursionCsvField> = (() => {
  const map: Record<string, "id" | ExcursionCsvField> = {
    id: "id",
    "id (update existing; leave blank to create)": "id",
  };
  for (const key of EXCURSION_CSV_FIELDS) {
    map[normalizeCsvTemplateHeader(String(key))] = key;
    map[normalizeCsvTemplateHeader(EXCURSION_TEMPLATE_LABELS[key])] = key;
  }
  return map;
})();

export function normalizeExcursionCsvImportRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [header, value] of Object.entries(row)) {
    const mapped = EXCURSION_IMPORT_HEADER_KEY_MAP[normalizeCsvTemplateHeader(header)] ?? header.trim();
    normalized[mapped] = value;
  }
  return normalized;
}

function parseJsonStringArray(raw: string): string[] | null {
  const t = raw.trim();
  if (!t) return [];
  try {
    const v = JSON.parse(t) as unknown;
    if (!Array.isArray(v)) return null;
    return v.filter((x): x is string => typeof x === "string");
  } catch {
    return null;
  }
}

export function excursionRowToWizard(row: Record<string, string>, offerId: number, companyId: number): ExcursionWizardState {
  const get = (k: string) => (row[k] ?? "").trim();
  const includes = parseJsonStringArray(get("includes_json"));
  const photos = parseJsonStringArray(get("photos_json"));
  if (includes === null) throw new Error("includes_json must be valid JSON array of strings (or empty).");
  if (photos === null) throw new Error("photos_json must be valid JSON array of strings (or empty).");
  const gs = get("group_size");
  const tm = get("ticket_max_count");
  return {
    offer_id: offerId,
    company_id: companyId,
    country: get("country"),
    city: get("city"),
    general_category: get("general_category"),
    category: get("category"),
    excursion_type: get("excursion_type"),
    tour_name: get("tour_name"),
    overview: get("overview"),
    photos,
    duration: get("duration"),
    starts_at: get("starts_at"),
    ends_at: get("ends_at"),
    language: get("language"),
    group_size: gs === "" ? "" : Number(gs),
    ticket_max_count: tm === "" ? "" : Number(tm),
    status: get("status"),
    is_available: parseBool(get("is_available")),
    is_bookable: parseBool(get("is_bookable")),
    includes,
    meeting_pickup: get("meeting_pickup"),
    additional_info: get("additional_info"),
    cancellation_policy: get("cancellation_policy"),
    price_by_dates: [],
    visibility_rule: get("visibility_rule") || "show_all",
    appears_in_web: parseBool(get("appears_in_web")),
    appears_in_admin: parseBool(get("appears_in_admin")),
    appears_in_zulu_admin: parseBool(get("appears_in_zulu_admin")),
  };
}

export function validateExcursionCsvWizard(wizard: ExcursionWizardState, isCreate: boolean): string | null {
  const errors = validateExcursionWizardFull(wizard, isCreate);
  if (!errors) return null;
  const first = Object.entries(errors)[0];
  return first ? `${first[0]}: ${(first[1] ?? []).join(" ")}` : "Validation failed.";
}

export function excursionDetailToCsvRow(r: ExcursionRow): Record<string, unknown> {
  const includes = Array.isArray(r.includes) ? r.includes : [];
  const photos = Array.isArray(r.photos) ? r.photos : [];
  const cid =
    r.company_id != null && r.company_id !== ""
      ? Number(r.company_id)
      : r.offer?.company_id != null && r.offer.company_id !== ""
        ? Number(r.offer.company_id)
        : "";
  return {
    id: r.id,
    offer_id: r.offer_id ?? "",
    company_id: cid,
    country: r.country ?? "",
    city: r.city ?? "",
    general_category: r.general_category ?? "",
    category: r.category ?? "",
    excursion_type: r.excursion_type ?? "",
    tour_name: r.tour_name ?? "",
    overview: r.overview ?? "",
    duration: r.duration ?? "",
    starts_at: r.starts_at ? isoToDatetimeLocal(r.starts_at) : "",
    ends_at: r.ends_at ? isoToDatetimeLocal(r.ends_at) : "",
    language: r.language ?? "",
    group_size: r.group_size ?? "",
    ticket_max_count: r.ticket_max_count ?? "",
    status: r.status ?? "",
    is_available: r.is_available !== false,
    is_bookable: r.is_bookable !== false,
    meeting_pickup: r.meeting_pickup ?? "",
    additional_info: r.additional_info ?? "",
    cancellation_policy: r.cancellation_policy ?? "",
    includes_json: JSON.stringify(includes),
    photos_json: JSON.stringify(photos),
    visibility_rule: r.visibility_rule ?? "show_all",
    appears_in_web: r.appears_in_web !== false,
    appears_in_admin: r.appears_in_admin !== false,
    appears_in_zulu_admin: r.appears_in_zulu_admin !== false,
  };
}

export function excursionTemplateCsv(): string {
  const headers = [
    "ID (Update Existing; leave blank to create)",
    ...EXCURSION_CSV_FIELDS.map((key) =>
      EXCURSION_REQUIRED_TEMPLATE_FIELDS.has(key)
        ? `${EXCURSION_TEMPLATE_LABELS[key]} *`
        : EXCURSION_TEMPLATE_LABELS[key]
    ),
  ];
  return stringifyCsv(headers, [{}]);
}

// Re-export wizard helpers needed by orchestrator
export { coreWritePayloadFromWizard, expandedPayloadFromWizard };
