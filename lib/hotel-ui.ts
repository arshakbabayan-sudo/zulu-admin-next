import type { HotelFormPayload } from "@/lib/inventory-crud-api";

/**
 * HOTEL module — UI labels & display helpers (Step A3 / B1 / C1).
 *
 * Wire/API/storage: Laravel uses `star_rating` (1–5 int|null), `meal_type`,
 * `availability_status`, `status` as documented in HotelService validation.
 * This file never renames API keys; it only maps canonical values → user-facing strings.
 */

/** Canonical JSON/body field name for star classification (matches backend Hotel model). */
export const HOTEL_API_STAR_RATING_KEY = "star_rating" as const;

/** Select option values — must stay aligned with backend string validation. */
export const HOTEL_MEAL_TYPES = [
  "room_only",
  "breakfast",
  "bed_and_breakfast",
  "half_board",
  "full_board",
  "all_inclusive",
] as const;

export const HOTEL_AVAILABILITY_STATUSES = ["available", "limited", "sold_out", "unavailable"] as const;

export const HOTEL_LIFECYCLE_STATUSES = [
  "draft",
  "active",
  "inactive",
  "sold_out",
  "unavailable",
  "archived",
] as const;

/** User-facing labels for API fields (forms + validation error mapping). */
export const HOTEL_FIELD_LABELS: Record<string, string> = {
  "": "Form",
  offer_id: "Offer",
  hotel_name: "Hotel name",
  property_type: "Property type",
  hotel_type: "Hotel type",
  country: "Country",
  region_or_state: "Region / state",
  city: "City",
  district_or_area: "District / area",
  full_address: "Full address",
  latitude: "Latitude",
  longitude: "Longitude",
  meal_type: "Meal plan",
  star_rating: "Star rating",
  availability_status: "Availability",
  status: "Lifecycle status",
  bookable: "Bookable online",
  is_package_eligible: "Package eligible",
  visibility_rule: "Visibility rule",
  appears_in_packages: "Appears in packages",
  free_wifi: "Free Wi‑Fi",
  parking: "Parking",
  airport_shuttle: "Airport shuttle",
  indoor_pool: "Indoor pool",
  outdoor_pool: "Outdoor pool",
  room_service: "Room service",
  front_desk_24h: "24h front desk",
  child_friendly: "Child friendly",
  accessibility_support: "Accessibility support",
  pets_allowed: "Pets allowed",
  free_cancellation: "Free cancellation",
  prepayment_required: "Prepayment required",
  cancellation_policy_type: "Cancellation policy type",
  cancellation_deadline_at: "Cancellation deadline",
  no_show_policy: "No-show policy",
  review_score: "Review score",
  review_count: "Review count",
  review_label: "Review label",
  room_inventory_mode: "Room inventory mode",
  rooms: "Rooms",
  company_id: "Company",
  room_type: "Room type",
  room_name: "Room name",
  capacity: "Capacity (max guests)",
  price: "Price",
  currency: "Currency",
  pricing_mode: "Pricing mode",
  valid_from: "Valid from",
  valid_to: "Valid to",
  min_nights: "Min nights",
  pricing_status: "Pricing status",
};

/** Hotel room pricing — free string max 32 on API; common presets for selects. */
export const HOTEL_ROOM_PRICING_MODES = ["per_night", "per_stay", "per_person"] as const;

/** Pricing row lifecycle (string max 32 on API). */
export const HOTEL_ROOM_PRICING_STATUSES = ["active", "inactive"] as const;

/** Alias for form label lookups (same map as HOTEL_FIELD_LABELS). */
export const HOTEL_OPERATOR_FORM_LABELS = HOTEL_FIELD_LABELS;

const MEAL_LABELS: Record<string, string> = {
  room_only: "Room only",
  breakfast: "Breakfast",
  bed_and_breakfast: "Bed & breakfast",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "All inclusive",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Available",
  limited: "Limited",
  sold_out: "Sold out",
  unavailable: "Unavailable",
};

const LIFECYCLE_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
  sold_out: "Sold out",
  unavailable: "Unavailable",
  archived: "Archived",
};

/** User-facing label for a stored `meal_type` value. */
export function hotelMealTypeLabel(value: string): string {
  return MEAL_LABELS[value] ?? value;
}

/** User-facing label for a stored `availability_status` value. */
export function hotelAvailabilityLabel(value: string): string {
  return AVAILABILITY_LABELS[value] ?? value;
}

/** User-facing label for a stored hotel lifecycle `status` value. */
export function hotelLifecycleStatusLabel(value: string): string {
  return LIFECYCLE_LABELS[value] ?? value;
}

/** Amenity-only flags (facilities section — HotelService boolean columns). */
export const HOTEL_FACILITY_AMENITY_KEYS = [
  "free_wifi",
  "parking",
  "airport_shuttle",
  "indoor_pool",
  "outdoor_pool",
  "room_service",
  "front_desk_24h",
  "child_friendly",
  "accessibility_support",
  "pets_allowed",
] as const;

/** Policy booleans rendered in Policies section (same API keys). */
export const HOTEL_POLICY_BOOLEAN_KEYS = ["free_cancellation", "prepayment_required"] as const;

/** @deprecated Use HOTEL_FACILITY_AMENITY_KEYS + HOTEL_POLICY_BOOLEAN_KEYS */
export const HOTEL_OPERATOR_FACILITY_KEYS = [
  ...HOTEL_FACILITY_AMENITY_KEYS,
  ...HOTEL_POLICY_BOOLEAN_KEYS,
] as const;

export const HOTEL_OPERATOR_BOOKING_FLAG_KEYS = ["bookable", "is_package_eligible"] as const;

/** Step C3 visibility modes (matches backend HotelService validation). */
export const HOTEL_VISIBILITY_RULES = ["show_all", "show_accepted_only", "hide_rejected"] as const;

const HOTEL_VISIBILITY_RULE_LABELS: Record<(typeof HOTEL_VISIBILITY_RULES)[number], string> = {
  show_all: "Show all",
  show_accepted_only: "Show accepted only",
  hide_rejected: "Hide rejected",
};

export function hotelVisibilityRuleLabel(value: string): string {
  return HOTEL_VISIBILITY_RULE_LABELS[value as (typeof HOTEL_VISIBILITY_RULES)[number]] ?? value;
}

/** Availability / ops controls (mapping-driven availability section). */
export const HOTEL_AVAILABILITY_FIELD_KEYS = [
  "availability_status",
  "status",
  "bookable",
  "is_package_eligible",
  "room_inventory_mode",
] as const;

/** Review fields (Step C1). */
export const HOTEL_REVIEW_FIELD_KEYS = ["review_score", "review_count", "review_label"] as const;

/** Policy text / datetime fields (Step C1). */
export const HOTEL_POLICY_DETAIL_FIELD_KEYS = [
  "cancellation_policy_type",
  "cancellation_deadline_at",
  "no_show_policy",
] as const;

/** Presets for datalist — API allows any string ≤ 64. */
export const HOTEL_CANCELLATION_POLICY_PRESETS = [
  "flexible",
  "moderate",
  "strict",
  "non_refundable",
] as const;

export const HOTEL_ROOM_INVENTORY_MODE_PRESETS = ["per_room", "pooled", "on_request"] as const;

/** UI presets for review_label (API is free string ≤ 255). */
export const HOTEL_REVIEW_LABEL_PRESETS = [
  "excellent",
  "very_good",
  "good",
  "pleasant",
  "fair",
] as const;

/**
 * List/table display for API `star_rating` (1–5). Does not alter stored values.
 * Mapping: API field `star_rating` → human-readable text only here.
 */
export function formatHotelStarRatingDisplay(star_rating: number | null | undefined): string {
  if (star_rating == null || !Number.isFinite(Number(star_rating))) return "—";
  const n = Math.min(5, Math.max(1, Math.round(Number(star_rating))));
  return `${n} star${n === 1 ? "" : "s"}`;
}

/**
 * Rooms + pricing rows (HotelService::validateRoomsPayload / pricingRowRules).
 * Call after base hotel fields pass.
 */
export function validateHotelRoomsAndPricings(form: HotelFormPayload): string[] {
  const L = HOTEL_FIELD_LABELS;
  const errors: string[] = [];

  if (!form.rooms || form.rooms.length === 0) {
    errors.push(`${L.rooms}: Add at least one room.`);
    return errors;
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  form.rooms.forEach((room, ri) => {
    const prefix = `Room ${ri + 1}`;
    if (!room.room_type.trim()) errors.push(`${prefix}: ${L.room_type} is required.`);
    if (!room.room_name.trim()) errors.push(`${prefix}: ${L.room_name} is required.`);
    const adultsRaw = room.max_adults;
    if (adultsRaw === "" || adultsRaw == null) {
      errors.push(`${prefix}: Max adults is required.`);
    } else {
      const a = Number(adultsRaw);
      if (!Number.isFinite(a) || a < 1) {
        errors.push(`${prefix}: Max adults must be at least 1.`);
      }
    }
    const totalRaw = room.max_total_guests;
    if (totalRaw === "" || totalRaw == null) {
      errors.push(`${prefix}: Max total guests is required.`);
    } else {
      const t = Number(totalRaw);
      const a = Number(adultsRaw);
      if (!Number.isFinite(t) || t < 1) {
        errors.push(`${prefix}: Max total guests must be at least 1.`);
      } else if (Number.isFinite(a) && t < a) {
        errors.push(`${prefix}: Max total guests must be ≥ max adults.`);
      }
    }
    if (!room.pricings || room.pricings.length === 0) {
      errors.push(`${prefix}: At least one pricing row is required.`);
    } else {
      room.pricings.forEach((p, pi) => {
        const pp = `${prefix} · rate ${pi + 1}`;
        const priceNum = Number(p.price);
        if (!Number.isFinite(priceNum) || priceNum <= 0) {
          errors.push(`${pp}: ${L.price} must be greater than 0.`);
        }
        const cur = p.currency.trim().toUpperCase();
        if (cur.length !== 3) {
          errors.push(`${pp}: ${L.currency} must be exactly 3 letters (ISO).`);
        }
        if (!p.pricing_mode.trim()) {
          errors.push(`${pp}: ${L.pricing_mode} is required.`);
        } else if (p.pricing_mode.trim().length > 32) {
          errors.push(`${pp}: ${L.pricing_mode} must be at most 32 characters.`);
        }
        if (!p.status.trim()) {
          errors.push(`${pp}: ${L.pricing_status} is required.`);
        } else if (p.status.trim().length > 32) {
          errors.push(`${pp}: ${L.pricing_status} must be at most 32 characters.`);
        }
        if (p.valid_from.trim() !== "" && !dateRe.test(p.valid_from.trim())) {
          errors.push(`${pp}: ${L.valid_from} must be YYYY-MM-DD or empty.`);
        }
        if (p.valid_to.trim() !== "" && !dateRe.test(p.valid_to.trim())) {
          errors.push(`${pp}: ${L.valid_to} must be YYYY-MM-DD or empty.`);
        }
        if (p.min_nights !== "") {
          const mn = Number(p.min_nights);
          if (!Number.isFinite(mn) || mn < 1) {
            errors.push(`${pp}: ${L.min_nights} must be empty or an integer ≥ 1.`);
          }
        }
      });
    }
  });

  return errors;
}

/** Validation for operator form; uses canonical field names in `HotelFormPayload` only. */
export function validateHotelOperatorForm(form: HotelFormPayload, mode: "create" | "edit"): string[] {
  const L = HOTEL_FIELD_LABELS;
  const errors: string[] = [];
  if (mode === "create") {
    if (form.offer_id === "" || form.offer_id == null || Number(form.offer_id) <= 0) {
      errors.push(`${L.offer_id} must be a valid positive number.`);
    }
  }
  if (!form.hotel_name.trim()) errors.push(`${L.hotel_name} is required.`);
  if (!form.property_type.trim()) errors.push(`${L.property_type} is required.`);
  if (!form.hotel_type.trim()) errors.push(`${L.hotel_type} is required.`);
  if (!form.country.trim()) errors.push(`${L.country} is required.`);
  if (!form.city.trim()) errors.push(`${L.city} is required.`);
  if (!form.meal_type.trim()) errors.push(`${L.meal_type} is required.`);
  if (!form.availability_status.trim()) errors.push(`${L.availability_status} is required.`);
  if (!form.status.trim()) errors.push(`${L.status} is required.`);
  if (!HOTEL_VISIBILITY_RULES.includes(form.visibility_rule as (typeof HOTEL_VISIBILITY_RULES)[number])) {
    errors.push(`${L.visibility_rule} must be one of: ${HOTEL_VISIBILITY_RULES.join(", ")}.`);
  }
  if (typeof form.appears_in_packages !== "boolean") {
    errors.push(`${L.appears_in_packages} must be a boolean.`);
  }
  if (form.star_rating !== "" && form.star_rating != null) {
    const n = Number(form.star_rating);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      errors.push(`${L.star_rating} must be between 1 and 5, or left empty.`);
    }
  }
  if (form.latitude.trim() !== "") {
    const n = Number(form.latitude.trim());
    if (!Number.isFinite(n) || n < -90 || n > 90) {
      errors.push(`${L.latitude} must be empty or a number between -90 and 90.`);
    }
  }
  if (form.longitude.trim() !== "") {
    const n = Number(form.longitude.trim());
    if (!Number.isFinite(n) || n < -180 || n > 180) {
      errors.push(`${L.longitude} must be empty or a number between -180 and 180.`);
    }
  }
  if (form.cancellation_policy_type.trim().length > 64) {
    errors.push(`${L.cancellation_policy_type} must be at most 64 characters.`);
  }
  if (form.cancellation_deadline_at.trim() !== "") {
    const t = form.cancellation_deadline_at.trim();
    if (Number.isNaN(Date.parse(t))) {
      errors.push(`${L.cancellation_deadline_at} must be empty or a valid date/time.`);
    }
  }
  if (form.no_show_policy.length > 255) {
    errors.push(`${L.no_show_policy} must be at most 255 characters.`);
  }
  if (form.review_score !== "" && form.review_score != null) {
    const rs = Number(form.review_score);
    if (!Number.isFinite(rs) || rs < 0 || rs > 10) {
      errors.push(`${L.review_score} must be between 0 and 10, or empty.`);
    }
  }
  if (form.review_count !== "" && form.review_count != null) {
    const rc = Number(form.review_count);
    if (!Number.isFinite(rc) || rc < 0 || !Number.isInteger(rc)) {
      errors.push(`${L.review_count} must be a non-negative whole number, or empty (defaults to 0).`);
    }
  }
  if (form.review_label.length > 255) {
    errors.push(`${L.review_label} must be at most 255 characters.`);
  }
  if (form.room_inventory_mode.trim().length > 64) {
    errors.push(`${L.room_inventory_mode} must be at most 64 characters.`);
  }
  errors.push(...validateHotelRoomsAndPricings(form));
  return errors;
}

/**
 * Turns Laravel `errors` object into readable lines for the UI (field label + message).
 */
export function formatHotelApiValidationErrors(errors: Record<string, string[]>): string[] {
  const lines: string[] = [];
  for (const [key, msgs] of Object.entries(errors)) {
    const label = HOTEL_FIELD_LABELS[key] ?? key.replace(/_/g, " ");
    for (const m of msgs) {
      lines.push(`${label}: ${m}`);
    }
  }
  return lines;
}
