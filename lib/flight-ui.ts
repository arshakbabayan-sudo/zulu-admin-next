import type { FlightFormPayload, FlightCabinFormRow } from "@/lib/inventory-crud-api";

/**
 * FLIGHT module — UI labels, constants, and validators.
 *
 * Wire/API/storage: Laravel uses canonical keys documented in
 * `FlightService::flightStoreValidationRules` (departure_at / arrival_at /
 * cabin_class / seat_capacity_total / etc). This module never renames API
 * keys; it only maps canonical values → user-facing strings and runs
 * pre-flight checks before the form posts.
 *
 * Mirrors hotel-ui.ts patterns: collapsible-section layout, nested cabins
 * array on the flight form (instead of Hotels' nested rooms).
 */

export const FLIGHT_SERVICE_TYPES = [
  "scheduled",
  "charter",
  "package_flight",
  "private_special",
] as const;

export const FLIGHT_CONNECTION_TYPES = ["direct", "connected"] as const;

export const FLIGHT_CANCELLATION_POLICY_TYPES = [
  "non_refundable",
  "partially_refundable",
  "fully_refundable",
] as const;

export const FLIGHT_CHANGE_POLICY_TYPES = ["not_allowed", "paid_change", "free_change"] as const;

export const FLIGHT_LIFECYCLE_STATUSES = [
  "draft",
  "active",
  "inactive",
  "sold_out",
  "cancelled",
  "completed",
  "archived",
] as const;

export const FLIGHT_CABIN_CLASSES = [
  "economy",
  "premium_economy",
  "business",
  "first",
] as const;

export const FLIGHT_VISIBILITY_RULES = [
  "show_all",
  "show_accepted_only",
  "hide_rejected",
] as const;

/** User-facing labels for canonical API fields. */
export const FLIGHT_FIELD_LABELS: Record<string, string> = {
  "": "Form",
  offer_id: "Offer",
  flight_code_internal: "Flight code (internal)",
  service_type: "Service type",
  departure_country: "Departure country",
  departure_city: "Departure city",
  departure_airport: "Departure airport",
  departure_airport_code: "Departure airport code",
  departure_terminal: "Departure terminal",
  departure_location_id: "Departure location",
  arrival_country: "Arrival country",
  arrival_city: "Arrival city",
  arrival_airport: "Arrival airport",
  arrival_airport_code: "Arrival airport code",
  arrival_terminal: "Arrival terminal",
  arrival_location_id: "Arrival location",
  departure_at: "Departure date & time",
  arrival_at: "Arrival date & time",
  duration_minutes: "Duration (minutes)",
  timezone_context: "Timezone context",
  check_in_close_at: "Check-in closes at",
  boarding_close_at: "Boarding closes at",
  connection_type: "Connection type",
  stops_count: "Stops count",
  connection_notes: "Connection notes",
  layover_summary: "Layover summary",
  cabin_class: "Cabin class",
  seat_capacity_total: "Seats — total",
  seat_capacity_available: "Seats — available",
  adult_price: "Adult price",
  child_price: "Child price",
  infant_price: "Infant price",
  adult_age_from: "Adult age from",
  child_age_from: "Child age from",
  child_age_to: "Child age to",
  infant_age_from: "Infant age from",
  infant_age_to: "Infant age to",
  fare_family: "Fare family",
  seat_map_available: "Seat map available",
  seat_selection_policy: "Seat selection policy",
  hand_baggage_included: "Hand baggage included",
  hand_baggage_weight: "Hand baggage weight",
  checked_baggage_included: "Checked baggage included",
  checked_baggage_weight: "Checked baggage weight",
  extra_baggage_allowed: "Extra baggage allowed",
  baggage_notes: "Baggage notes",
  reservation_allowed: "Reservation allowed",
  online_checkin_allowed: "Online check-in allowed",
  airport_checkin_allowed: "Airport check-in allowed",
  cancellation_policy_type: "Cancellation policy type",
  change_policy_type: "Change policy type",
  reservation_deadline_at: "Reservation deadline",
  cancellation_deadline_at: "Cancellation deadline",
  change_deadline_at: "Change deadline",
  policy_notes: "Policy notes",
  is_package_eligible: "Package eligible",
  appears_in_web: "Appears on website",
  appears_in_admin: "Appears in admin",
  appears_in_zulu_admin: "Appears in ZULU admin",
  status: "Lifecycle status",
  main_image: "Main image URL",
  short_description: "Short description",
  cabins: "Cabin classes",
  airline: "Airline",
  aircraft: "Aircraft",
};

export function flightCabinClassLabel(value: string): string {
  const map: Record<string, string> = {
    economy: "Economy",
    premium_economy: "Premium Economy",
    business: "Business",
    first: "First",
  };
  return map[value] ?? value;
}

export function flightServiceTypeLabel(value: string): string {
  const map: Record<string, string> = {
    scheduled: "Scheduled",
    charter: "Charter",
    package_flight: "Package flight",
    private_special: "Private / special",
  };
  return map[value] ?? value;
}

export function flightCancellationPolicyLabel(value: string): string {
  const map: Record<string, string> = {
    non_refundable: "Non-refundable",
    partially_refundable: "Partially refundable",
    fully_refundable: "Fully refundable",
  };
  return map[value] ?? value;
}

export function flightChangePolicyLabel(value: string): string {
  const map: Record<string, string> = {
    not_allowed: "Changes not allowed",
    paid_change: "Paid change",
    free_change: "Free change",
  };
  return map[value] ?? value;
}

export function flightLifecycleStatusLabel(value: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    active: "Active",
    inactive: "Inactive",
    sold_out: "Sold out",
    cancelled: "Cancelled",
    completed: "Completed",
    archived: "Archived",
  };
  return map[value] ?? value;
}

export function flightVisibilityRuleLabel(value: string): string {
  const map: Record<string, string> = {
    show_all: "Show all",
    show_accepted_only: "Show accepted only",
    hide_rejected: "Hide rejected",
  };
  return map[value] ?? value;
}

/* -------------------------------------------------------------------------- */
/*  Validators                                                                 */
/* -------------------------------------------------------------------------- */

function asNumber(value: number | string | "" | null | undefined): number | null {
  if (value === "" || value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function validateFlightCabinRow(c: FlightCabinFormRow, idx: number): string[] {
  const errors: string[] = [];
  const label = `Cabin #${idx + 1}`;
  if (!c.cabin_class) errors.push(`${label}: cabin class is required`);
  const total = asNumber(c.seat_capacity_total);
  const avail = asNumber(c.seat_capacity_available);
  if (total == null || total < 0) errors.push(`${label}: seats total must be ≥ 0`);
  if (avail == null || avail < 0) errors.push(`${label}: seats available must be ≥ 0`);
  if (total != null && avail != null && avail > total) {
    errors.push(`${label}: available seats cannot exceed total`);
  }
  const adult = asNumber(c.adult_price);
  if (adult == null || adult <= 0) errors.push(`${label}: adult price must be > 0`);
  const child = asNumber(c.child_price);
  if (child == null || child < 0) errors.push(`${label}: child price must be ≥ 0`);
  const infant = asNumber(c.infant_price);
  if (infant == null || infant < 0) errors.push(`${label}: infant price must be ≥ 0`);
  return errors;
}

export function validateFlightOperatorForm(
  form: FlightFormPayload,
  mode: "create" | "edit"
): string[] {
  const errors: string[] = [];

  if (mode === "create" && (form.offer_id === "" || form.offer_id == null)) {
    errors.push("Offer ID is required.");
  }
  if (!form.flight_code_internal?.trim()) errors.push("Flight code is required.");
  if (!form.service_type?.trim()) errors.push("Service type is required.");
  if (!form.departure_airport?.trim()) errors.push("Departure airport is required.");
  if (!form.arrival_airport?.trim()) errors.push("Arrival airport is required.");
  if (!form.departure_at?.trim()) errors.push("Departure date & time is required.");
  if (!form.arrival_at?.trim()) errors.push("Arrival date & time is required.");

  const duration = asNumber(form.duration_minutes);
  if (duration == null || duration <= 0) errors.push("Duration (minutes) must be > 0.");

  if (form.departure_at && form.arrival_at) {
    const dep = new Date(form.departure_at);
    const arr = new Date(form.arrival_at);
    if (!Number.isNaN(dep.getTime()) && !Number.isNaN(arr.getTime()) && arr.getTime() <= dep.getTime()) {
      errors.push("Arrival must be after departure.");
    }
  }

  if (!form.cabins || form.cabins.length === 0) {
    errors.push("At least one cabin class is required.");
  } else {
    form.cabins.forEach((c, idx) => {
      errors.push(...validateFlightCabinRow(c, idx));
    });
    // Check duplicate cabin classes
    const seen = new Set<string>();
    for (const c of form.cabins) {
      if (c.cabin_class && seen.has(c.cabin_class)) {
        errors.push(`Duplicate cabin class: ${flightCabinClassLabel(c.cabin_class)}`);
      }
      if (c.cabin_class) seen.add(c.cabin_class);
    }
  }

  return errors;
}

/** Map Laravel validation 422 errors → human lines using FLIGHT_FIELD_LABELS. */
export function formatFlightApiValidationErrors(
  errors: Record<string, string[]>
): string[] {
  const lines: string[] = [];
  for (const [field, msgs] of Object.entries(errors)) {
    if (!Array.isArray(msgs) || msgs.length === 0) continue;
    const root = field.split(".")[0] ?? field;
    const label = FLIGHT_FIELD_LABELS[root] ?? root;
    for (const m of msgs) {
      const clean = String(m ?? "").trim();
      if (clean) lines.push(`${label}: ${clean}`);
    }
  }
  return lines.length > 0 ? lines : ["Validation failed."];
}
