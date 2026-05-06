import { apiFetchJson } from "./api-client";
import type { ApiListMeta, ApiSuccessEnvelope } from "./api-envelope";
import {
  type TransferFormValues,
  transferCreateBodyFromForm,
  transferUpdateBodyFromForm,
} from "@/lib/transfers/transfer-field-adapter";

/**
 * Inventory API — admin contract (module vs offer)
 *
 * - Any `offer` nested under **module** rows (flights, transfers, cars, excursions, etc.) is
 *   {@link ModuleRowOfferSummary} only: a shallow embed for list/UI context, not full offer or module detail.
 * - Do **not** assume extra nested keys beyond that summary; the backend may slim or change embeds on list routes.
 * - **Module detail** (forms, edit screens, full fields) must be loaded from **module** endpoints only
 *   (e.g. GET `/flights/:id`, GET `/transfers/:id`). Do not use GET `/offers/:id` as the source of truth for a module.
 */

// ─── Offers ──────────────────────────────────────────────────────────────────
/**
 * Row from `/offers` (list, single, create, publish, archive) — **summary-only** per backend OfferResource.
 * Same rule as module embeds: not a substitute for loading the parent module via its own GET.
 */
export type OfferRow = {
  id: number;
  title: string;
  type: string;
  price?: number | null;
  currency?: string | null;
  status: string;
  company_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  company?: { id: number; name: string } | null;
};

/**
 * Summary-only offer object embedded on **module** list/index (and some detail) payloads.
 * Not exhaustive: the API may omit or add keys; treat as display/context only.
 */
export type ModuleRowOfferSummary = {
  id?: number;
  company_id?: number | null;
  type?: string | null;
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  status?: string | null;
};

export async function apiOffers(
  token: string,
  params: { page?: number; per_page?: number; status?: string; type?: string }
): Promise<ApiSuccessEnvelope<OfferRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  if (params.type) q.set("type", params.type);
  const qs = q.toString();
  return apiFetchJson(`/offers${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export type CompanyListRow = {
  id: number;
  name?: string | null;
};

export async function apiCompaniesList(token: string): Promise<ApiSuccessEnvelope<CompanyListRow[]>> {
  return apiFetchJson(`/companies`, { method: "GET", token });
}

export async function apiCreateOffer(
  token: string,
  body: {
    company_id: number;
    type: string;
    title: string;
    price: number;
    currency: string;
  }
): Promise<ApiSuccessEnvelope<OfferRow>> {
  return apiFetchJson(`/offers`, { method: "POST", token, body });
}

export async function apiOffer(token: string, id: number): Promise<ApiSuccessEnvelope<OfferRow>> {
  return apiFetchJson(`/offers/${id}`, { method: "GET", token });
}

export async function apiPublishOffer(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<OfferRow>> {
  return apiFetchJson(`/offers/${id}/publish`, { method: "POST", token, body: {} });
}

export async function apiArchiveOffer(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<OfferRow>> {
  return apiFetchJson(`/offers/${id}/archive`, { method: "POST", token, body: {} });
}

// ─── Flights ─────────────────────────────────────────────────────────────────
export type FlightRow = {
  id: number;
  offer_id?: number | null;
  location_id?: number | null;
  departure_location_id?: number | null;
  arrival_location_id?: number | null;
  flight_code_internal?: string | null;
  service_type?: string | null;
  departure_country?: string | null;
  departure_city?: string | null;
  departure_airport?: string | null;
  arrival_country?: string | null;
  arrival_city?: string | null;
  arrival_airport?: string | null;
  departure_airport_code?: string | null;
  arrival_airport_code?: string | null;
  departure_at?: string | null;
  arrival_at?: string | null;
  duration_minutes?: number | null;
  connection_type?: string | null;
  stops_count?: number | null;
  cabin_class?: string | null;
  seat_capacity_total?: number | null;
  seat_capacity_available?: number | null;
  adult_price?: number | null;
  child_price?: number | null;
  infant_price?: number | null;
  is_package_eligible?: boolean | null;
  appears_in_web?: boolean | null;
  appears_in_admin?: boolean | null;
  appears_in_zulu_admin?: boolean | null;
  status?: string | null;
  company_id?: number | null;
  company?: { id: number; name: string } | null;
  /** Summary-only embed; full flight detail from GET `/flights/:id`, not from offer APIs. */
  offer?: ModuleRowOfferSummary | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Backward-compatible aliases for legacy consumers.
  flight_number?: string | null;
  airline?: string | null;
  origin?: string | null;
  destination?: string | null;
};

export type FlightPayload = {
  offer_id?: number | "";
  location_id?: number | "";
  departure_location_id?: number | "";
  arrival_location_id?: number | "";
  flight_code_internal?: string;
  service_type?: string;
  departure_country?: string;
  departure_city?: string;
  departure_airport?: string;
  arrival_country?: string;
  arrival_city?: string;
  arrival_airport?: string;
  departure_airport_code?: string | null;
  arrival_airport_code?: string | null;
  departure_terminal?: string | null;
  arrival_terminal?: string | null;
  departure_at?: string;
  arrival_at?: string;
  duration_minutes?: number | "";
  timezone_context?: string | null;
  check_in_close_at?: string | null;
  boarding_close_at?: string | null;
  connection_type?: string;
  stops_count?: number | "";
  connection_notes?: string | null;
  layover_summary?: string | null;
  cabin_class?: string;
  seat_capacity_total?: number | "";
  seat_capacity_available?: number | "";
  fare_family?: string | null;
  seat_map_available?: boolean;
  seat_selection_policy?: string | null;
  adult_age_from?: number | "";
  child_age_from?: number | "";
  child_age_to?: number | "";
  infant_age_from?: number | "";
  infant_age_to?: number | "";
  adult_price?: number | "";
  child_price?: number | "";
  infant_price?: number | "";
  hand_baggage_included?: boolean;
  checked_baggage_included?: boolean;
  hand_baggage_weight?: string | null;
  checked_baggage_weight?: string | null;
  extra_baggage_allowed?: boolean;
  baggage_notes?: string | null;
  reservation_allowed?: boolean;
  online_checkin_allowed?: boolean;
  airport_checkin_allowed?: boolean;
  cancellation_policy_type?: string;
  change_policy_type?: string;
  reservation_deadline_at?: string | null;
  cancellation_deadline_at?: string | null;
  change_deadline_at?: string | null;
  policy_notes?: string | null;
  is_package_eligible?: boolean;
  appears_in_web?: boolean;
  appears_in_admin?: boolean;
  appears_in_zulu_admin?: boolean;
  status?: string;
  [key: string]: unknown;
};

export type FlightCabinRow = {
  id: number;
  cabin_class: string;
  seat_capacity_total: number;
  seat_capacity_available: number;
  adult_price: number;
  child_price: number;
  infant_price: number;
  hand_baggage_included: boolean;
  hand_baggage_weight?: string | null;
  checked_baggage_included: boolean;
  checked_baggage_weight?: string | null;
  extra_baggage_allowed: boolean;
  baggage_notes?: string | null;
  fare_family?: string | null;
  seat_map_available: boolean;
  seat_selection_policy?: string | null;
  b2c_adult_price?: number | null;
};

export type FlightCabinPayload = {
  cabin_class?: string;
  seat_capacity_total?: number | "";
  seat_capacity_available?: number | "";
  adult_price?: number | "";
  child_price?: number | "";
  infant_price?: number | "";
  hand_baggage_included?: boolean;
  hand_baggage_weight?: string | null;
  checked_baggage_included?: boolean;
  checked_baggage_weight?: string | null;
  extra_baggage_allowed?: boolean;
  baggage_notes?: string | null;
  fare_family?: string | null;
  seat_map_available?: boolean;
  seat_selection_policy?: string | null;
  [key: string]: unknown;
};

export type FlightCabinSeatStatus =
  | "available"
  | "held"
  | "booked"
  | "blocked"
  | "reserved"
  | "sold";

export type FlightCabinSeatModifierType = "none" | "fixed" | "percent";

export type FlightCabinSeatRow = {
  id?: number;
  seat_map_id?: number;
  flight_id?: number;
  flight_cabin_id?: number;
  seat_code: string;
  row_number: number;
  column_code: string;
  zone_code?: string | null;
  seat_type: string;
  status: FlightCabinSeatStatus;
  held_at?: string | null;
  booking_id?: number | null;
  price_modifier_type: FlightCabinSeatModifierType;
  price_modifier_value: number;
  currency?: string | null;
  meta?: Record<string, unknown> | null;
};

export type FlightCabinSeatMapRow = {
  id: number;
  flight_id: number;
  flight_cabin_id: number;
  version: number;
  layout_schema: Record<string, unknown> | null;
  legend_schema: Record<string, unknown> | null;
  is_active: boolean;
  seats: FlightCabinSeatRow[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type FlightCabinSeatMapPayload = {
  version: number;
  is_active?: boolean;
  layout_schema: Record<string, unknown>;
  legend_schema?: Record<string, unknown> | null;
  seats: Array<{
    seat_code: string;
    row_number: number;
    column_code: string;
    zone_code?: string | null;
    seat_type: string;
    status: FlightCabinSeatStatus;
    price_modifier_type: FlightCabinSeatModifierType;
    price_modifier_value?: number | null;
    currency?: string | null;
    meta?: Record<string, unknown> | null;
  }>;
};

export async function apiFlights(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<FlightRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/flights${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiFlight(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<FlightRow>> {
  return apiFetchJson(`/flights/${id}`, { method: "GET", token });
}

export async function apiCreateFlight(
  token: string,
  body: FlightPayload
): Promise<ApiSuccessEnvelope<FlightRow>> {
  return apiFetchJson(`/flights`, { method: "POST", token, body });
}

export async function apiUpdateFlight(
  token: string,
  id: number,
  body: FlightPayload
): Promise<ApiSuccessEnvelope<FlightRow>> {
  return apiFetchJson(`/flights/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteFlight(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/flights/${id}`, { method: "DELETE", token });
}

export async function apiFlightCabins(
  token: string,
  flightId: number
): Promise<ApiSuccessEnvelope<FlightCabinRow[]>> {
  return apiFetchJson(`/flights/${flightId}/cabins`, { method: "GET", token });
}

export async function apiCreateFlightCabin(
  token: string,
  flightId: number,
  body: FlightCabinPayload
): Promise<ApiSuccessEnvelope<FlightCabinRow>> {
  return apiFetchJson(`/flights/${flightId}/cabins`, { method: "POST", token, body });
}

export async function apiUpdateFlightCabin(
  token: string,
  flightId: number,
  cabinId: number,
  body: FlightCabinPayload
): Promise<ApiSuccessEnvelope<FlightCabinRow>> {
  return apiFetchJson(`/flights/${flightId}/cabins/${cabinId}`, { method: "PATCH", token, body });
}

export async function apiDeleteFlightCabin(
  token: string,
  flightId: number,
  cabinId: number
): Promise<ApiSuccessEnvelope<null>> {
  return apiFetchJson(`/flights/${flightId}/cabins/${cabinId}`, { method: "DELETE", token });
}

export async function apiFlightCabinSeatMap(
  token: string,
  flightId: number,
  cabinId: number
): Promise<ApiSuccessEnvelope<FlightCabinSeatMapRow | null>> {
  return apiFetchJson(`/flights/${flightId}/cabins/${cabinId}/seat-map`, { method: "GET", token });
}

export async function apiUpsertFlightCabinSeatMap(
  token: string,
  flightId: number,
  cabinId: number,
  body: FlightCabinSeatMapPayload
): Promise<ApiSuccessEnvelope<FlightCabinSeatMapRow>> {
  return apiFetchJson(`/flights/${flightId}/cabins/${cabinId}/seat-map`, { method: "PUT", token, body });
}

// ─── Hotels ──────────────────────────────────────────────────────────────────
/** List/detail row shape aligned with HotelListResource / HotelDetailResource. */
/** Room + nested pricings as returned by GET /hotels/:id (HotelDetailResource). */
export type HotelRoomDetail = {
  id: number;
  room_type?: string | null;
  room_name?: string | null;
  max_adults?: number | null;
  max_children?: number | null;
  max_total_guests?: number | null;
  bed_type?: string | null;
  bed_count?: number | null;
  room_size?: string | null;
  room_view?: string | null;
  view_type?: string | null;
  room_inventory_count?: number | null;
  room_images?: string[] | string | null;
  status?: string | null;
  private_bathroom?: boolean;
  smoking_allowed?: boolean;
  air_conditioning?: boolean;
  wifi?: boolean;
  tv?: boolean;
  mini_fridge?: boolean;
  tea_coffee_maker?: boolean;
  kettle?: boolean;
  washing_machine?: boolean;
  soundproofing?: boolean;
  terrace_or_balcony?: boolean;
  patio?: boolean;
  bath?: boolean;
  shower?: boolean;
  pricings?: HotelRoomPricingDetail[] | null;
};

export type HotelRoomPricingDetail = {
  id: number;
  price: number;
  currency: string;
  pricing_mode?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  min_nights?: number | null;
  status?: string | null;
};

export type HotelRow = {
  id: number;
  offer_id?: number | null;
  location_id?: number | null;
  hotel_name?: string | null;
  property_type?: string | null;
  hotel_type?: string | null;
  city?: string | null;
  country?: string | null;
  region_or_state?: string | null;
  district_or_area?: string | null;
  full_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  star_rating?: number | null;
  meal_type?: string | null;
  availability_status?: string | null;
  status?: string | null;
  company_id?: number | null;
  created_at?: string | null;
  bookable?: boolean;
  is_package_eligible?: boolean;
  // Step C3: visibility controls.
  visibility_rule?: string | null;
  appears_in_packages?: boolean;
  free_wifi?: boolean;
  parking?: boolean;
  airport_shuttle?: boolean;
  indoor_pool?: boolean;
  outdoor_pool?: boolean;
  room_service?: boolean;
  front_desk_24h?: boolean;
  child_friendly?: boolean;
  accessibility_support?: boolean;
  pets_allowed?: boolean;
  free_cancellation?: boolean;
  prepayment_required?: boolean;
  cancellation_policy_type?: string | null;
  cancellation_deadline_at?: string | null;
  no_show_policy?: string | null;
  review_score?: number | null;
  review_count?: number | null;
  review_label?: string | null;
  room_inventory_mode?: string | null;
  rooms?: HotelRoomDetail[] | null;
};

/** Single pricing row in operator form (hotel room). */
export type HotelPricingFormRow = {
  /** Persisted `hotel_room_pricings.id` from API; omitted for new rows (POST / PATCH create). */
  id?: number;
  price: string;
  currency: string;
  pricing_mode: string;
  valid_from: string;
  valid_to: string;
  min_nights: number | "";
  status: string;
};

/**
 * One room block: aligns with HotelService room payload + HotelRoom $fillable.
 * Mirrors HotelDetailResource.rooms[*] shape so form ↔ API ↔ DB are 1:1.
 */
export type HotelRoomFormRow = {
  clientKey: string;
  /** Persisted `hotel_rooms.id` from API; omitted for new rows (POST / PATCH create). */
  id?: number;
  room_type: string;
  room_name: string;
  // Capacity (3 separate guest counts).
  max_adults: number | "";
  max_children: number | "";
  max_total_guests: number | "";
  // Bed configuration.
  bed_type: string;
  bed_count: number | "";
  // Size / view.
  room_size: string;
  room_view: string;
  view_type: string;
  // Inventory + lifecycle.
  room_inventory_count: number | "";
  status: string;
  // Bathroom.
  private_bathroom: boolean;
  bath: boolean;
  shower: boolean;
  // In-room amenities.
  air_conditioning: boolean;
  wifi: boolean;
  tv: boolean;
  mini_fridge: boolean;
  tea_coffee_maker: boolean;
  kettle: boolean;
  washing_machine: boolean;
  soundproofing: boolean;
  terrace_or_balcony: boolean;
  patio: boolean;
  // Policy.
  smoking_allowed: boolean;
  // Images (one URL per line in the input → string[]).
  room_images: string;
  pricings: HotelPricingFormRow[];
};

/**
 * Operator form state (create + edit). Mirrors HotelService create/update validation keys.
 * `offer_id` is only sent on POST.
 */
/** Form state keys match API except `star_rating` is typed here; wire uses `star_rating` (see `lib/hotel-ui.ts`). */
export type HotelFormPayload = {
  offer_id: number | "";
  location_id: number | "";
  hotel_name: string;
  property_type: string;
  hotel_type: string;
  country: string;
  region_or_state: string;
  city: string;
  district_or_area: string;
  full_address: string;
  /** Empty string = omit/null on API */
  latitude: string;
  longitude: string;
  meal_type: string;
  star_rating: number | "";
  availability_status: string;
  status: string;
  bookable: boolean;
  is_package_eligible: boolean;
  // Step C3: visibility controls.
  visibility_rule: string;
  appears_in_packages: boolean;
  free_wifi: boolean;
  parking: boolean;
  airport_shuttle: boolean;
  indoor_pool: boolean;
  outdoor_pool: boolean;
  room_service: boolean;
  front_desk_24h: boolean;
  child_friendly: boolean;
  accessibility_support: boolean;
  pets_allowed: boolean;
  free_cancellation: boolean;
  prepayment_required: boolean;
  /** Step C1 — policy detail (nullable strings on API). */
  cancellation_policy_type: string;
  /** `datetime-local` value or empty (→ null on API). */
  cancellation_deadline_at: string;
  no_show_policy: string;
  /** 0–10 or empty → null. */
  review_score: number | "";
  review_count: number | "";
  review_label: string;
  room_inventory_mode: string;
  /** Step B3 — rooms & pricings (POST full set; PATCH sync). */
  rooms: HotelRoomFormRow[];
};

function trimOrNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

function parseCoord(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** API ISO8601 datetime → `datetime-local` input value (local wall clock). */
export function hotelCancellationDeadlineFromApi(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function newClientKey(prefix: string): string {
  if (typeof globalThis !== "undefined" && "crypto" in globalThis && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Default pricing row for new room rows (backend defaults: per_night, active). */
export function newHotelPricingFormRow(): HotelPricingFormRow {
  return {
    price: "",
    currency: "USD",
    pricing_mode: "per_night",
    valid_from: "",
    valid_to: "",
    min_nights: "",
    status: "active",
  };
}

/** Default room block for create / empty state. */
export function newHotelRoomFormRow(): HotelRoomFormRow {
  return {
    clientKey: newClientKey("room"),
    room_type: "",
    room_name: "",
    max_adults: "",
    max_children: 0,
    max_total_guests: "",
    bed_type: "",
    bed_count: 1,
    room_size: "",
    room_view: "",
    view_type: "",
    room_inventory_count: "",
    status: "active",
    private_bathroom: false,
    bath: false,
    shower: false,
    air_conditioning: false,
    wifi: false,
    tv: false,
    mini_fridge: false,
    tea_coffee_maker: false,
    kettle: false,
    washing_machine: false,
    soundproofing: false,
    terrace_or_balcony: false,
    patio: false,
    smoking_allowed: false,
    room_images: "",
    pricings: [newHotelPricingFormRow()],
  };
}

function mapDetailRoomsToForm(rooms: HotelRoomDetail[] | null | undefined): HotelRoomFormRow[] {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return [newHotelRoomFormRow()];
  }
  return rooms.map((r) => {
    const numOrEmpty = (v: number | null | undefined): number | "" =>
      v != null && Number.isFinite(Number(v)) ? Number(v) : "";
    const imagesRaw = r.room_images;
    const imagesText = Array.isArray(imagesRaw)
      ? imagesRaw.filter((x) => typeof x === "string").join("\n")
      : typeof imagesRaw === "string"
        ? imagesRaw
        : "";
    return {
      clientKey: newClientKey(`room-${r.id}`),
      ...(typeof r.id === "number" && Number.isFinite(r.id) ? { id: r.id } : {}),
      room_type: r.room_type ?? "",
      room_name: r.room_name ?? "",
      max_adults: numOrEmpty(r.max_adults),
      max_children: numOrEmpty(r.max_children),
      max_total_guests: numOrEmpty(r.max_total_guests),
      bed_type: r.bed_type ?? "",
      bed_count: numOrEmpty(r.bed_count),
      room_size: r.room_size ?? "",
      room_view: r.room_view ?? "",
      view_type: r.view_type ?? "",
      room_inventory_count: numOrEmpty(r.room_inventory_count),
      status: r.status ?? "active",
      private_bathroom: Boolean(r.private_bathroom),
      bath: Boolean(r.bath),
      shower: Boolean(r.shower),
      air_conditioning: Boolean(r.air_conditioning),
      wifi: Boolean(r.wifi),
      tv: Boolean(r.tv),
      mini_fridge: Boolean(r.mini_fridge),
      tea_coffee_maker: Boolean(r.tea_coffee_maker),
      kettle: Boolean(r.kettle),
      washing_machine: Boolean(r.washing_machine),
      soundproofing: Boolean(r.soundproofing),
      terrace_or_balcony: Boolean(r.terrace_or_balcony),
      patio: Boolean(r.patio),
      smoking_allowed: Boolean(r.smoking_allowed),
      room_images: imagesText,
      pricings:
        Array.isArray(r.pricings) && r.pricings.length > 0
          ? r.pricings.map((p) => ({
              ...(typeof p.id === "number" && Number.isFinite(p.id) ? { id: p.id } : {}),
              price: String(p.price),
              currency: (p.currency ?? "USD").toUpperCase().slice(0, 3),
              pricing_mode: p.pricing_mode ?? "per_night",
              valid_from: p.valid_from ?? "",
              valid_to: p.valid_to ?? "",
              min_nights: p.min_nights != null ? p.min_nights : "",
              status: p.status ?? "active",
            }))
          : [newHotelPricingFormRow()],
    };
  });
}

/** Map GET /hotels/:id (HotelDetailResource) into operator form state. */
export function hotelFormFromDetail(row: HotelRow): HotelFormPayload {
  const lat = row.latitude;
  const lng = row.longitude;
  return {
    offer_id: "",
    location_id:
      (row as { location_id?: number | null }).location_id != null
        ? Number((row as { location_id?: number | null }).location_id)
        : "",
    hotel_name: row.hotel_name ?? "",
    property_type: row.property_type ?? "hotel",
    hotel_type: row.hotel_type ?? "resort",
    country: row.country ?? "",
    region_or_state: row.region_or_state ?? "",
    city: row.city ?? "",
    district_or_area: row.district_or_area ?? "",
    full_address: row.full_address ?? "",
    latitude: lat != null && Number.isFinite(Number(lat)) ? String(lat) : "",
    longitude: lng != null && Number.isFinite(Number(lng)) ? String(lng) : "",
    meal_type: row.meal_type ?? "room_only",
    star_rating: row.star_rating != null ? row.star_rating : "",
    availability_status: row.availability_status ?? "available",
    status: row.status ?? "draft",
    bookable: row.bookable !== false,
    is_package_eligible: Boolean(row.is_package_eligible),
    visibility_rule: row.visibility_rule ?? "show_all",
    appears_in_packages: row.appears_in_packages ?? true,
    free_wifi: Boolean(row.free_wifi),
    parking: Boolean(row.parking),
    airport_shuttle: Boolean(row.airport_shuttle),
    indoor_pool: Boolean(row.indoor_pool),
    outdoor_pool: Boolean(row.outdoor_pool),
    room_service: Boolean(row.room_service),
    front_desk_24h: Boolean(row.front_desk_24h),
    child_friendly: Boolean(row.child_friendly),
    accessibility_support: Boolean(row.accessibility_support),
    pets_allowed: Boolean(row.pets_allowed),
    free_cancellation: Boolean(row.free_cancellation),
    prepayment_required: Boolean(row.prepayment_required),
    cancellation_policy_type: row.cancellation_policy_type ?? "",
    cancellation_deadline_at: hotelCancellationDeadlineFromApi(row.cancellation_deadline_at),
    no_show_policy: row.no_show_policy ?? "",
    review_score:
      row.review_score != null && Number.isFinite(Number(row.review_score))
        ? Number(row.review_score)
        : "",
    review_count:
      row.review_count != null && Number.isFinite(Number(row.review_count))
        ? Number(row.review_count)
        : "",
    review_label: row.review_label ?? "",
    room_inventory_mode: row.room_inventory_mode ?? "",
    rooms: mapDetailRoomsToForm(row.rooms),
  };
}

/** POST/PATCH room payload — matches HotelService::validateRoomsPayload / pricingRowRules. */
export type HotelRoomPricingApiRow = {
  /** Sent on PATCH only when present so existing rows upsert in place. */
  id?: number;
  price: number;
  currency: string;
  pricing_mode: string;
  valid_from: string | null;
  valid_to: string | null;
  min_nights: number | null;
  status: string;
};

export type HotelRoomApiBody = {
  /** Sent on PATCH only when present so existing rows upsert in place. */
  id?: number;
  room_type: string;
  room_name: string;
  max_adults: number;
  max_children: number;
  max_total_guests: number;
  bed_type: string | null;
  bed_count: number;
  room_size: string | null;
  room_view: string | null;
  view_type: string | null;
  room_inventory_count: number | null;
  status: string;
  private_bathroom: boolean;
  bath: boolean;
  shower: boolean;
  air_conditioning: boolean;
  wifi: boolean;
  tv: boolean;
  mini_fridge: boolean;
  tea_coffee_maker: boolean;
  kettle: boolean;
  washing_machine: boolean;
  soundproofing: boolean;
  terrace_or_balcony: boolean;
  patio: boolean;
  smoking_allowed: boolean;
  room_images: string[] | null;
  pricings: HotelRoomPricingApiRow[];
};

function emptyDateToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

/** Build `rooms` array for API from operator form (full HotelRoom $fillable shape). */
export function roomsPayloadFromForm(
  rooms: HotelRoomFormRow[],
  opts?: { includePersistedIds?: boolean }
): HotelRoomApiBody[] {
  const includeIds = opts?.includePersistedIds === true;
  return rooms.map((r) => {
    const adults = r.max_adults === "" ? 0 : Number(r.max_adults);
    const children = r.max_children === "" ? 0 : Number(r.max_children);
    const total =
      r.max_total_guests === "" ? Math.max(adults + children, adults) : Number(r.max_total_guests);
    const bedCount = r.bed_count === "" ? 1 : Number(r.bed_count);
    const inventory =
      r.room_inventory_count === "" ? null : Number(r.room_inventory_count);
    const images = r.room_images
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const roomId =
      includeIds && typeof r.id === "number" && Number.isFinite(r.id) ? r.id : undefined;
    return {
      ...(roomId !== undefined ? { id: roomId } : {}),
      room_type: r.room_type.trim(),
      room_name: r.room_name.trim(),
      max_adults: adults,
      max_children: children,
      max_total_guests: total,
      bed_type: trimOrNull(r.bed_type),
      bed_count: bedCount,
      room_size: trimOrNull(r.room_size),
      room_view: trimOrNull(r.room_view),
      view_type: trimOrNull(r.view_type),
      room_inventory_count: inventory,
      status: (r.status.trim() || "active").slice(0, 32),
      private_bathroom: r.private_bathroom,
      bath: r.bath,
      shower: r.shower,
      air_conditioning: r.air_conditioning,
      wifi: r.wifi,
      tv: r.tv,
      mini_fridge: r.mini_fridge,
      tea_coffee_maker: r.tea_coffee_maker,
      kettle: r.kettle,
      washing_machine: r.washing_machine,
      soundproofing: r.soundproofing,
      terrace_or_balcony: r.terrace_or_balcony,
      patio: r.patio,
      smoking_allowed: r.smoking_allowed,
      room_images: images.length > 0 ? images : null,
      pricings: r.pricings.map((p) => {
        const pricingId =
          includeIds && typeof p.id === "number" && Number.isFinite(p.id) ? p.id : undefined;
        return {
          ...(pricingId !== undefined ? { id: pricingId } : {}),
          price: Number(p.price),
          currency: p.currency.trim().toUpperCase().slice(0, 3),
          pricing_mode: (p.pricing_mode.trim() || "per_night").slice(0, 32),
          valid_from: emptyDateToNull(p.valid_from),
          valid_to: emptyDateToNull(p.valid_to),
          min_nights: p.min_nights === "" ? null : Number(p.min_nights),
          status: (p.status.trim() || "active").slice(0, 32),
        };
      }),
    };
  });
}

/** POST /hotels body (backend HotelService::create). */
export type HotelCreateApiBody = {
  offer_id: number;
  location_id: number | null;
  hotel_name: string;
  property_type: string;
  hotel_type: string;
  country: string;
  region_or_state: string | null;
  city: string;
  district_or_area: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  meal_type: string;
  availability_status: string;
  status: string;
  star_rating: number | null;
  bookable: boolean;
  is_package_eligible: boolean;
  // Step C3: visibility controls.
  visibility_rule: string;
  appears_in_packages: boolean;
  free_wifi: boolean;
  parking: boolean;
  airport_shuttle: boolean;
  indoor_pool: boolean;
  outdoor_pool: boolean;
  room_service: boolean;
  front_desk_24h: boolean;
  child_friendly: boolean;
  accessibility_support: boolean;
  pets_allowed: boolean;
  free_cancellation: boolean;
  prepayment_required: boolean;
  cancellation_policy_type: string | null;
  cancellation_deadline_at: string | null;
  no_show_policy: string | null;
  review_score: number | null;
  review_count: number;
  review_label: string | null;
  room_inventory_mode: string | null;
  rooms: HotelRoomApiBody[];
};

function hotelSharedBodyFromForm(form: HotelFormPayload): Omit<HotelCreateApiBody, "offer_id" | "rooms"> {
  const star =
    form.star_rating === "" || form.star_rating == null ? null : Number(form.star_rating);
  const lat = parseCoord(form.latitude);
  const lng = parseCoord(form.longitude);
  return {
    location_id: form.location_id === "" ? null : Number(form.location_id),
    hotel_name: form.hotel_name.trim(),
    property_type: form.property_type.trim(),
    hotel_type: form.hotel_type.trim(),
    country: form.country.trim(),
    region_or_state: trimOrNull(form.region_or_state),
    city: form.city.trim(),
    district_or_area: trimOrNull(form.district_or_area),
    full_address: trimOrNull(form.full_address),
    latitude: lat,
    longitude: lng,
    meal_type: form.meal_type.trim(),
    availability_status: form.availability_status.trim(),
    status: form.status.trim(),
    star_rating: star === null || Number.isNaN(star) ? null : star,
    bookable: form.bookable,
    is_package_eligible: form.is_package_eligible,
    visibility_rule: form.visibility_rule.trim(),
    appears_in_packages: form.appears_in_packages,
    free_wifi: form.free_wifi,
    parking: form.parking,
    airport_shuttle: form.airport_shuttle,
    indoor_pool: form.indoor_pool,
    outdoor_pool: form.outdoor_pool,
    room_service: form.room_service,
    front_desk_24h: form.front_desk_24h,
    child_friendly: form.child_friendly,
    accessibility_support: form.accessibility_support,
    pets_allowed: form.pets_allowed,
    free_cancellation: form.free_cancellation,
    prepayment_required: form.prepayment_required,
    cancellation_policy_type: trimOrNull(form.cancellation_policy_type),
    cancellation_deadline_at:
      form.cancellation_deadline_at.trim() === "" ? null : form.cancellation_deadline_at.trim(),
    no_show_policy: trimOrNull(form.no_show_policy),
    review_score:
      form.review_score === "" || form.review_score == null
        ? null
        : Number(form.review_score),
    review_count:
      form.review_count === "" || form.review_count == null
        ? 0
        : Math.max(0, Math.floor(Number(form.review_count))),
    review_label: trimOrNull(form.review_label),
    room_inventory_mode: trimOrNull(form.room_inventory_mode),
  };
}

export function hotelCreateBodyFromForm(form: HotelFormPayload): HotelCreateApiBody {
  return {
    offer_id: Number(form.offer_id),
    ...hotelSharedBodyFromForm(form),
    rooms: roomsPayloadFromForm(form.rooms),
  };
}

/** PATCH /hotels/:id — no offer_id / company_id (HotelController prohibits); includes `rooms` to sync. */
export function hotelUpdateBodyFromForm(form: HotelFormPayload): Record<string, unknown> {
  return {
    ...hotelSharedBodyFromForm(form),
    rooms: roomsPayloadFromForm(form.rooms, { includePersistedIds: true }),
  };
}

export async function apiHotels(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<HotelRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/hotels${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiGetHotel(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<HotelRow>> {
  return apiFetchJson(`/hotels/${id}`, { method: "GET", token });
}

export async function apiCreateHotel(
  token: string,
  body: HotelCreateApiBody
): Promise<ApiSuccessEnvelope<HotelRow>> {
  return apiFetchJson(`/hotels`, { method: "POST", token, body });
}

export async function apiUpdateHotel(
  token: string,
  id: number,
  body: Record<string, unknown>
): Promise<ApiSuccessEnvelope<HotelRow>> {
  return apiFetchJson(`/hotels/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteHotel(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/hotels/${id}`, { method: "DELETE", token });
}

// ─── Transfers ───────────────────────────────────────────────────────────────
export type TransferRow = {
  id: number;
  offer_id?: number | null;
  company_id?: number | null;
  visibility_rule?: string | null;
  appears_in_web?: boolean | null;
  appears_in_admin?: boolean | null;
  appears_in_zulu_admin?: boolean | null;
  created_at?: string | null;
  transfer_title?: string | null;
  transfer_type?: string | null;
  pickup_country?: string | null;
  origin_location_id?: number | null;
  vehicle_category?: string | null;
  pickup_point_type?: string | null;
  pickup_point_name?: string | null;
  pickup_city?: string | null;
  dropoff_country?: string | null;
  destination_location_id?: number | null;
  dropoff_point_type?: string | null;
  dropoff_point_name?: string | null;
  dropoff_city?: string | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  dropoff_latitude?: number | null;
  dropoff_longitude?: number | null;
  route_distance_km?: number | null;
  route_label?: string | null;
  service_date?: string | null;
  pickup_time?: string | null;
  estimated_duration_minutes?: number | null;
  availability_window_start?: string | null;
  availability_window_end?: string | null;
  vehicle_class?: string | null;
  private_or_shared?: string | null;
  passenger_capacity?: number | null;
  luggage_capacity?: number | null;
  minimum_passengers?: number | null;
  maximum_passengers?: number | null;
  maximum_luggage?: number | null;
  child_seat_available?: boolean | null;
  child_seat_required_rule?: string | null;
  accessibility_support?: boolean | null;
  special_assistance_supported?: boolean | null;
  pricing_mode?: string | null;
  availability_status?: string | null;
  status?: string | null;
  base_price?: number | null;
  free_cancellation?: boolean | null;
  cancellation_policy_type?: string | null;
  cancellation_deadline_at?: string | null;
  bookable?: boolean | null;
  is_package_eligible?: boolean | null;
  /** Summary-only embed; full transfer detail from GET `/transfers/:id`, not from offer APIs. */
  offer?: ModuleRowOfferSummary | null;
};

export type TransferPayload = TransferFormValues;

export async function apiTransfers(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<TransferRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/transfers${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiGetTransfer(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<TransferRow>> {
  return apiFetchJson(`/transfers/${id}`, { method: "GET", token });
}

export async function apiCreateTransfer(
  token: string,
  body: TransferPayload
): Promise<ApiSuccessEnvelope<TransferRow>> {
  const createBody = transferCreateBodyFromForm(body);
  return apiFetchJson(`/transfers`, { method: "POST", token, body: createBody });
}

export async function apiUpdateTransfer(
  token: string,
  id: number,
  body: TransferPayload
): Promise<ApiSuccessEnvelope<TransferRow>> {
  const updateBody = transferUpdateBodyFromForm(body);
  return apiFetchJson(`/transfers/${id}`, { method: "PATCH", token, body: updateBody });
}

export async function apiDeleteTransfer(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/transfers/${id}`, { method: "DELETE", token });
}

// ─── Cars ────────────────────────────────────────────────────────────────────
/** Step C1 — aligned with `CarAdvancedOptionsNormalizer` (v1). */
export const CAR_CHILD_SEAT_TYPES = ["infant", "toddler", "booster", "convertible"] as const;

export const CAR_SERVICE_KEYS = [
  "wifi",
  "ac",
  "gps",
  "bluetooth",
  "usb_charger",
  "dashcam",
  "child_seat_included",
  "snow_chains",
  "roof_rack",
  "winter_tires",
] as const;

/** Step C2 — aligned with `CarAdvancedOptionsNormalizer::defaultPricingRules`. */
export type CarPricingRulesRow = {
  mileage: {
    mode: "limited" | "unlimited";
    included_km_per_rental: number | null;
    extra_km_price: number | null;
  };
  cross_border: {
    policy: "not_allowed" | "included" | "surcharge_fixed" | "surcharge_daily";
    surcharge_amount: number | null;
  };
  radius: {
    service_radius_km: number | null;
    out_of_radius_mode:
      | "not_applicable"
      | "flat_fee"
      | "per_km"
      | "not_allowed"
      | "quote_only";
    out_of_radius_flat_fee: number | null;
    out_of_radius_per_km: number | null;
  };
};

export type CarAdvancedOptionsRow = {
  v: number;
  child_seats: {
    available: boolean;
    types: string[];
  };
  extra_luggage: {
    additional_suitcases_max: number;
    additional_small_bags_max: number;
    notes: string | null;
  };
  services: string[];
  driver_languages: string[];
  pricing_rules: CarPricingRulesRow;
};

/** Mirrors `CarResource` + summary-only `offer` embed from list/detail API. */
export type CarRow = {
  id: number;
  offer_id?: number | null;
  location_id?: number | null;
  company_id?: number | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  vehicle_class?: string | null;
  vehicle_type?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  transmission_type?: string | null;
  fuel_type?: string | null;
  fleet?: string | null;
  category?: string | null;
  seats?: number | null;
  suitcases?: number | null;
  small_bag?: number | null;
  availability_window_start?: string | null;
  availability_window_end?: string | null;
  pricing_mode?: string | null;
  base_price?: number | null;
  status?: string | null;
  availability_status?: string | null;
  advanced_options?: CarAdvancedOptionsRow | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Summary-only embed; full car detail from GET `/cars/:id`, not from offer APIs. */
  offer?: ModuleRowOfferSummary | null;
};

/** Expanded fields accepted by `CarService` store/update (aligned with `Car` model). */
export type CarExpandedWriteFields = {
  location_id?: number | null;
  vehicle_type?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  transmission_type?: string | null;
  fuel_type?: string | null;
  fleet?: string | null;
  category?: string | null;
  seats?: number | null;
  suitcases?: number | null;
  small_bag?: number | null;
  availability_window_start?: string | null;
  availability_window_end?: string | null;
  pricing_mode?: string | null;
  base_price?: number | null;
  status?: string | null;
  availability_status?: string | null;
  advanced_options?: CarAdvancedOptionsRow | null;
};

/** POST /cars — must match `CarController::store` validation. */
export type CarCreatePayload = {
  offer_id: number;
  company_id: number;
  pickup_location: string;
  dropoff_location: string;
  vehicle_class: string;
} & CarExpandedWriteFields;

/** PATCH /cars/{id} — `offer_id` / `company_id` are prohibited server-side. */
export type CarUpdatePayload = {
  pickup_location?: string;
  dropoff_location?: string;
  vehicle_class?: string;
} & CarExpandedWriteFields;

export async function apiCars(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<CarRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/cars${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateCar(
  token: string,
  body: CarCreatePayload
): Promise<ApiSuccessEnvelope<CarRow>> {
  return apiFetchJson(`/cars`, { method: "POST", token, body });
}

export async function apiUpdateCar(
  token: string,
  id: number,
  body: CarUpdatePayload
): Promise<ApiSuccessEnvelope<CarRow>> {
  return apiFetchJson(`/cars/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteCar(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/cars/${id}`, { method: "DELETE", token });
}

// ─── Excursions ───────────────────────────────────────────────────────────────
/** Mirrors `ExcursionResource` (commerce `/excursions`). */
export type ExcursionRow = {
  id: number;
  offer_id?: number | null;
  company_id?: number | null;
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  location?: string | null;
  location_id?: number | null;
  country?: string | null;
  city?: string | null;
  general_category?: string | null;
  category?: string | null;
  excursion_type?: string | null;
  tour_name?: string | null;
  overview?: string | null;
  duration?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  language?: string | null;
  group_size?: number | null;
  ticket_max_count?: number | null;
  status?: string | null;
  is_available?: boolean | null;
  is_bookable?: boolean | null;
  includes?: string[] | null;
  meeting_pickup?: string | null;
  additional_info?: string | null;
  cancellation_policy?: string | null;
  photos?: string[] | null;
  price_by_dates?: { date: string; price: number }[] | null;
  /** Step C3 — visibility (backend defaults when omitted). */
  visibility_rule?: string | null;
  appears_in_web?: boolean | null;
  appears_in_admin?: boolean | null;
  appears_in_zulu_admin?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Summary-only embed; full excursion detail from GET `/excursions/:id`, not from offer APIs. */
  offer?: ModuleRowOfferSummary | null;
};

/** Expanded fields optional on create (`ExcursionService::excursionStoreValidationRules`). */
export type ExcursionExpandedWritePayload = {
  location_id?: number;
  country?: string;
  city?: string;
  general_category?: string;
  category?: string;
  excursion_type?: string;
  tour_name?: string;
  overview?: string;
  starts_at?: string;
  ends_at?: string;
  language?: string;
  ticket_max_count?: number;
  status?: string;
  is_available?: boolean;
  is_bookable?: boolean;
  includes?: string[];
  meeting_pickup?: string;
  additional_info?: string;
  cancellation_policy?: string;
  photos?: string[];
  price_by_dates?: { date: string; price: number }[];
  /** Step C3 — visibility controls. */
  visibility_rule?: string;
  appears_in_web?: boolean;
  appears_in_admin?: boolean;
  appears_in_zulu_admin?: boolean;
};

/** POST /excursions — must match `ExcursionController::store` validation. */
export type ExcursionCreatePayload = {
  offer_id: number;
  company_id: number;
  location: string;
  duration: string;
  group_size: number;
} & ExcursionExpandedWritePayload;

/** PATCH /excursions/{id} — `offer_id` / `company_id` are prohibited server-side. */
export type ExcursionUpdatePayload = {
  location?: string;
  duration?: string;
  group_size?: number;
} & ExcursionExpandedWritePayload;

export async function apiExcursions(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<ExcursionRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/excursions${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreateExcursion(
  token: string,
  body: ExcursionCreatePayload
): Promise<ApiSuccessEnvelope<ExcursionRow>> {
  return apiFetchJson(`/excursions`, { method: "POST", token, body });
}

export async function apiUpdateExcursion(
  token: string,
  id: number,
  body: ExcursionUpdatePayload
): Promise<ApiSuccessEnvelope<ExcursionRow>> {
  return apiFetchJson(`/excursions/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteExcursion(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/excursions/${id}`, { method: "DELETE", token });
}

// ─── Visas ────────────────────────────────────────────────────────────────────
/**
 * List/show payload matches Laravel `VisaResource`.
 * `visa_price` is the visa row price; `offer_price` / legacy `price` may reflect the linked offer
 * for display; `currency` and `status` are typically offer-driven.
 */
export type VisaRow = {
  id: number;
  offer_id?: number | null;
  country?: string | null;
  location_id?: number | null;
  country_id?: number | null;
  visa_type?: string | null;
  name?: string | null;
  description?: string | null;
  required_documents?: string[] | null;
  visa_price?: number | null;
  offer_price?: number | null;
  /** Backward-compatible; often aligned with offer price in the resource */
  price?: number | null;
  currency?: string | null;
  processing_days?: number | null;
  company_id?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Client form state + fields mirrored for API writes where applicable.
 * Editable visa amount is `visa_price`; POST/PATCH body must send `price` = `visa_price`.
 * `offer_price`, `currency`, `offer_status` are display/prefill only — never sent.
 * `required_documents_text` is UI-only (one line per document); normalized to `required_documents` on submit.
 */
export type VisaPayload = {
  /** Required on create (POST); omit on update (PATCH — server prohibits changes). */
  offer_id?: number;
  country?: string;
  location_id?: number | "";
  country_id?: number | "";
  visa_type?: string;
  name?: string;
  description?: string;
  required_documents?: string[];
  /** Newline-separated in the form; not sent as-is; maps to API `required_documents`. */
  required_documents_text?: string;
  processing_days?: number;
  /** Editable visa row price; maps to API field `price` on write. */
  visa_price?: number;
  /** Prefill from `VisaResource.offer_price`; display only. */
  offer_price?: number;
  /** Backward-compatible typing; API responses may still include `price`. Prefer `visa_price` in forms. */
  price?: number;
  /** Prefill from resource; display only (not persisted on visa endpoints). */
  currency?: string;
  /** Prefilled from VisaResource `status` (offer); never sent in POST/PATCH body. */
  offer_status?: string;
  [key: string]: unknown;
};

export async function apiVisas(
  token: string,
  params: { page?: number; per_page?: number }
): Promise<ApiSuccessEnvelope<VisaRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  const qs = q.toString();
  return apiFetchJson(`/visas${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiGetVisa(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<VisaRow>> {
  return apiFetchJson(`/visas/${id}`, { method: "GET", token });
}

export async function apiCreateVisa(
  token: string,
  body: VisaPayload
): Promise<ApiSuccessEnvelope<VisaRow>> {
  return apiFetchJson(`/visas`, { method: "POST", token, body });
}

export async function apiUpdateVisa(
  token: string,
  id: number,
  body: VisaPayload
): Promise<ApiSuccessEnvelope<VisaRow>> {
  return apiFetchJson(`/visas/${id}`, { method: "PATCH", token, body });
}

export async function apiDeleteVisa(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/visas/${id}`, { method: "DELETE", token });
}

// ─── Packages ─────────────────────────────────────────────────────────────────
export type PackageRow = {
  id: number;
  package_title?: string | null;
  package_type?: string | null;
  destination_city?: string | null;
  destination_country?: string | null;
  destination_location_id?: number | null;
  duration_days?: number | null;
  currency?: string | null;
  status: string;
  is_public?: boolean;
  is_bookable?: boolean;
  company_id?: number | null;
  created_at?: string | null;
  company?: { id: number; name: string } | null;
};

export type PackagePayload = {
  package_title?: string;
  package_type?: string;
  destination_city?: string;
  destination_country?: string;
  destination_location_id?: number | null;
  duration_days?: number;
  currency?: string;
  [key: string]: unknown;
};

export async function apiPackages(
  token: string,
  params: { page?: number; per_page?: number; status?: string }
): Promise<ApiSuccessEnvelope<PackageRow[]> & { meta: ApiListMeta }> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.per_page != null) q.set("per_page", String(params.per_page));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetchJson(`/packages${qs ? `?${qs}` : ""}`, { method: "GET", token });
}

export async function apiCreatePackage(
  token: string,
  body: PackagePayload
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages`, { method: "POST", token, body });
}

export async function apiUpdatePackage(
  token: string,
  id: number,
  body: PackagePayload
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${id}`, { method: "PATCH", token, body });
}

export async function apiDeletePackage(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<{ id: number }>> {
  return apiFetchJson(`/packages/${id}`, { method: "DELETE", token });
}

export async function apiActivatePackage(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${id}/activate`, { method: "POST", token, body: {} });
}

export async function apiDeactivatePackage(
  token: string,
  id: number
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${id}/deactivate`, { method: "POST", token, body: {} });
}

export async function apiPackageComponents(
  token: string,
  packageId: number
): Promise<ApiSuccessEnvelope<{ id: number; component_type: string; component_id: number; sort_order?: number }[]>> {
  return apiFetchJson(`/packages/${packageId}`, { method: "GET", token });
}

export async function apiAddPackageComponent(
  token: string,
  packageId: number,
  body: { component_type: string; component_id: number }
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${packageId}/components`, { method: "POST", token, body });
}

export async function apiRemovePackageComponent(
  token: string,
  packageId: number,
  componentId: number
): Promise<ApiSuccessEnvelope<PackageRow>> {
  return apiFetchJson(`/packages/${packageId}/components/${componentId}`, { method: "DELETE", token });
}
