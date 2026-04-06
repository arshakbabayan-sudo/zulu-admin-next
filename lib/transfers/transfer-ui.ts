import type { TransferFormValues } from "@/lib/transfers/transfer-field-adapter";

export type TransferBuilderMode = "create" | "edit";

export const TRANSFER_BUILDER_STEPS = [
  "route_location",
  "vehicle_capacity",
  "pricing_policies",
  "availability_publication",
  "review_submit",
] as const;

export type TransferBuilderStep = (typeof TRANSFER_BUILDER_STEPS)[number];

export const TRANSFER_FIELD_LABELS: Record<string, string> = {
  "": "Form",
  offer_id: "Offer",
  currency: "Currency",
  visibility_rule: "Visibility rule",
  appears_in_web: "Visible on web",
  appears_in_admin: "Visible in admin",
  appears_in_zulu_admin: "Visible in Zulu admin",
  transfer_title: "Transfer title",
  transfer_type: "Transfer type",
  pickup_country: "Pickup country",
  pickup_city: "Pickup city",
  pickup_point_type: "Pickup point type",
  pickup_point_name: "Pickup point name",
  dropoff_country: "Drop-off country",
  dropoff_city: "Drop-off city",
  dropoff_point_type: "Drop-off point type",
  dropoff_point_name: "Drop-off point name",
  pickup_latitude: "Pickup latitude",
  pickup_longitude: "Pickup longitude",
  dropoff_latitude: "Drop-off latitude",
  dropoff_longitude: "Drop-off longitude",
  route_distance_km: "Route distance (km)",
  route_label: "Route label",
  service_date: "Service date",
  pickup_time: "Pickup time",
  estimated_duration_minutes: "Estimated duration (minutes)",
  availability_window_start: "Availability window start",
  availability_window_end: "Availability window end",
  vehicle_category: "Vehicle category",
  vehicle_class: "Vehicle class",
  private_or_shared: "Private/shared",
  passenger_capacity: "Passenger capacity",
  luggage_capacity: "Luggage capacity",
  minimum_passengers: "Minimum passengers",
  maximum_passengers: "Maximum passengers",
  maximum_luggage: "Maximum luggage",
  child_seat_available: "Child seat available",
  child_seat_required_rule: "Child seat rule",
  accessibility_support: "Accessibility support",
  special_assistance_supported: "Special assistance supported",
  pricing_mode: "Pricing mode",
  base_price: "Base price",
  free_cancellation: "Free cancellation",
  cancellation_policy_type: "Cancellation policy type",
  cancellation_deadline_at: "Cancellation deadline",
  availability_status: "Availability status",
  bookable: "Bookable online",
  is_package_eligible: "Package eligible",
  status: "Lifecycle status",
};

function labelFor(key: string): string {
  return TRANSFER_FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function isValidDateISO(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

function isValidTimeHmsOrHm(s: string): boolean {
  const t = s.trim();
  return /^\d{2}:\d{2}$/.test(t) || /^\d{2}:\d{2}:\d{2}$/.test(t);
}

function isValidOptionalDateTimeLocalOrIso(s: string): boolean {
  const t = s.trim();
  if (t === "") return true;
  return !Number.isNaN(Date.parse(t));
}

export function validateTransferStep(form: TransferFormValues, step: TransferBuilderStep, mode: TransferBuilderMode): string[] {
  const errs: string[] = [];

  if (mode === "create") {
    if (form.offer_id == null || !Number.isFinite(Number(form.offer_id)) || Number(form.offer_id) <= 0) {
      errs.push(`${labelFor("offer_id")} must be a valid offer id.`);
    }
  }

  if (step === "route_location") {
    if (!form.transfer_title.trim()) errs.push(`${labelFor("transfer_title")} is required.`);
    if (!form.transfer_type.trim()) errs.push(`${labelFor("transfer_type")} is required.`);

    if (!form.pickup_country.trim()) errs.push(`${labelFor("pickup_country")} is required.`);
    if (!form.pickup_city.trim()) errs.push(`${labelFor("pickup_city")} is required.`);
    if (!form.pickup_point_type.trim()) errs.push(`${labelFor("pickup_point_type")} is required.`);
    if (!form.pickup_point_name.trim()) errs.push(`${labelFor("pickup_point_name")} is required.`);

    if (!form.dropoff_country.trim()) errs.push(`${labelFor("dropoff_country")} is required.`);
    if (!form.dropoff_city.trim()) errs.push(`${labelFor("dropoff_city")} is required.`);
    if (!form.dropoff_point_type.trim()) errs.push(`${labelFor("dropoff_point_type")} is required.`);
    if (!form.dropoff_point_name.trim()) errs.push(`${labelFor("dropoff_point_name")} is required.`);

    if (!form.service_date.trim() || !isValidDateISO(form.service_date)) {
      errs.push(`${labelFor("service_date")} must be YYYY-MM-DD.`);
    }
    if (!form.pickup_time.trim() || !isValidTimeHmsOrHm(form.pickup_time)) {
      errs.push(`${labelFor("pickup_time")} must be HH:MM or HH:MM:SS.`);
    }

    if (form.estimated_duration_minutes === "" || !Number.isFinite(Number(form.estimated_duration_minutes)) || Number(form.estimated_duration_minutes) < 1) {
      errs.push(`${labelFor("estimated_duration_minutes")} must be at least 1.`);
    }

    if (!isValidOptionalDateTimeLocalOrIso(form.availability_window_start)) {
      errs.push(`${labelFor("availability_window_start")} must be a valid date/time or empty.`);
    }
    if (!isValidOptionalDateTimeLocalOrIso(form.availability_window_end)) {
      errs.push(`${labelFor("availability_window_end")} must be a valid date/time or empty.`);
    }

    const latKeys: Array<keyof TransferFormValues> = ["pickup_latitude", "dropoff_latitude"];
    for (const k of latKeys) {
      const v = form[k];
      if (v === "") continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < -90 || n > 90) errs.push(`${labelFor(String(k))} must be between -90 and 90, or empty.`);
    }

    const lngKeys: Array<keyof TransferFormValues> = ["pickup_longitude", "dropoff_longitude"];
    for (const k of lngKeys) {
      const v = form[k];
      if (v === "") continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < -180 || n > 180) errs.push(`${labelFor(String(k))} must be between -180 and 180, or empty.`);
    }

    if (form.route_distance_km !== "") {
      const n = Number(form.route_distance_km);
      if (!Number.isFinite(n) || n < 0) errs.push(`${labelFor("route_distance_km")} must be 0 or greater, or empty.`);
    }
    if (form.route_label.trim().length > 255) errs.push(`${labelFor("route_label")} must be at most 255 characters.`);
  }

  if (step === "vehicle_capacity") {
    if (!form.vehicle_category.trim()) errs.push(`${labelFor("vehicle_category")} is required.`);
    if (form.vehicle_class.trim().length > 64) errs.push(`${labelFor("vehicle_class")} must be at most 64 characters.`);

    if (form.passenger_capacity === "" || !Number.isFinite(Number(form.passenger_capacity)) || Number(form.passenger_capacity) < 1) {
      errs.push(`${labelFor("passenger_capacity")} must be at least 1.`);
    }
    if (form.luggage_capacity === "" || !Number.isFinite(Number(form.luggage_capacity)) || Number(form.luggage_capacity) < 0) {
      errs.push(`${labelFor("luggage_capacity")} must be 0 or greater.`);
    }
    if (form.minimum_passengers === "" || !Number.isFinite(Number(form.minimum_passengers)) || Number(form.minimum_passengers) < 1) {
      errs.push(`${labelFor("minimum_passengers")} must be at least 1.`);
    }
    if (form.maximum_passengers === "" || !Number.isFinite(Number(form.maximum_passengers)) || Number(form.maximum_passengers) < 1) {
      errs.push(`${labelFor("maximum_passengers")} must be at least 1.`);
    }

    const cap = form.passenger_capacity === "" ? null : Number(form.passenger_capacity);
    const minP = form.minimum_passengers === "" ? null : Number(form.minimum_passengers);
    const maxP = form.maximum_passengers === "" ? null : Number(form.maximum_passengers);
    if (minP != null && maxP != null && minP > maxP) {
      errs.push(`${labelFor("maximum_passengers")} must be greater than or equal to minimum passengers.`);
    }
    if (cap != null && maxP != null && maxP > cap) {
      errs.push(`${labelFor("maximum_passengers")} must not exceed passenger capacity.`);
    }

    if (form.maximum_luggage !== "") {
      const n = Number(form.maximum_luggage);
      if (!Number.isFinite(n) || n < 0) errs.push(`${labelFor("maximum_luggage")} must be 0 or greater, or empty.`);
    }

    if (form.child_seat_required_rule.trim().length > 64) errs.push(`${labelFor("child_seat_required_rule")} must be at most 64 characters.`);
  }

  if (step === "pricing_policies") {
    if (!form.pricing_mode.trim()) errs.push(`${labelFor("pricing_mode")} is required.`);
    if (form.base_price === "" || !Number.isFinite(Number(form.base_price)) || Number(form.base_price) < 0) {
      errs.push(`${labelFor("base_price")} must be 0 or greater.`);
    }
    if (!form.cancellation_policy_type.trim()) errs.push(`${labelFor("cancellation_policy_type")} is required.`);
    if (!isValidOptionalDateTimeLocalOrIso(form.cancellation_deadline_at)) {
      errs.push(`${labelFor("cancellation_deadline_at")} must be a valid date/time or empty.`);
    }
  }

  if (step === "availability_publication") {
    if (!form.availability_status.trim()) errs.push(`${labelFor("availability_status")} is required.`);
    if (!form.status.trim()) errs.push(`${labelFor("status")} is required.`);
    if (typeof form.bookable !== "boolean") errs.push(`${labelFor("bookable")} must be a boolean.`);
    if (typeof form.is_package_eligible !== "boolean") errs.push(`${labelFor("is_package_eligible")} must be a boolean.`);
    if (!String(form.visibility_rule ?? "").trim()) errs.push(`${labelFor("visibility_rule")} is required.`);
    if (typeof form.appears_in_web !== "boolean") errs.push(`${labelFor("appears_in_web")} must be a boolean.`);
    if (typeof form.appears_in_admin !== "boolean") errs.push(`${labelFor("appears_in_admin")} must be a boolean.`);
    if (typeof form.appears_in_zulu_admin !== "boolean") errs.push(`${labelFor("appears_in_zulu_admin")} must be a boolean.`);
  }

  if (step === "review_submit") {
    // Full validation: all previous steps
    errs.push(
      ...validateTransferStep(form, "route_location", mode),
      ...validateTransferStep(form, "vehicle_capacity", mode),
      ...validateTransferStep(form, "pricing_policies", mode),
      ...validateTransferStep(form, "availability_publication", mode)
    );
  }

  return errs;
}

export function formatTransferApiValidationErrors(errors: Record<string, string[]>): string[] {
  const lines: string[] = [];
  for (const [key, msgs] of Object.entries(errors)) {
    const label = labelFor(key);
    for (const m of msgs) lines.push(`${label}: ${m}`);
  }
  return lines;
}

/** Flights-style operator wizard steps for transfers. */
export const TRANSFER_OPERATOR_WIZARD_STEPS = [
  { key: "general", label: "1) General" },
  { key: "route", label: "2) Route & location" },
  { key: "vehicle", label: "3) Vehicle & capacity" },
  { key: "pricing", label: "4) Pricing & policies" },
  { key: "publication", label: "5) Availability & publication" },
  { key: "review", label: "6) Review" },
] as const;

export type TransferOperatorWizardStep = (typeof TRANSFER_OPERATOR_WIZARD_STEPS)[number]["key"];

function validateTransferGeneralBlock(form: TransferFormValues, mode: TransferBuilderMode): string[] {
  const errs: string[] = [];
  if (mode === "create") {
    if (form.offer_id == null || !Number.isFinite(Number(form.offer_id)) || Number(form.offer_id) <= 0) {
      errs.push(`${labelFor("offer_id")} must be a valid offer id.`);
    }
  }
  if (!form.transfer_title.trim()) errs.push(`${labelFor("transfer_title")} is required.`);
  if (!form.transfer_type.trim()) errs.push(`${labelFor("transfer_type")} is required.`);
  if (!form.service_date.trim() || !isValidDateISO(form.service_date)) {
    errs.push(`${labelFor("service_date")} must be YYYY-MM-DD.`);
  }
  if (!form.pickup_time.trim() || !isValidTimeHmsOrHm(form.pickup_time)) {
    errs.push(`${labelFor("pickup_time")} must be HH:MM or HH:MM:SS.`);
  }
  if (form.estimated_duration_minutes === "" || !Number.isFinite(Number(form.estimated_duration_minutes)) || Number(form.estimated_duration_minutes) < 1) {
    errs.push(`${labelFor("estimated_duration_minutes")} must be at least 1.`);
  }
  return errs;
}

function validateTransferRouteBlock(form: TransferFormValues): string[] {
  const errs: string[] = [];
  if (!form.pickup_country.trim()) errs.push(`${labelFor("pickup_country")} is required.`);
  if (!form.pickup_city.trim()) errs.push(`${labelFor("pickup_city")} is required.`);
  if (!form.pickup_point_type.trim()) errs.push(`${labelFor("pickup_point_type")} is required.`);
  if (!form.pickup_point_name.trim()) errs.push(`${labelFor("pickup_point_name")} is required.`);
  if (!form.dropoff_country.trim()) errs.push(`${labelFor("dropoff_country")} is required.`);
  if (!form.dropoff_city.trim()) errs.push(`${labelFor("dropoff_city")} is required.`);
  if (!form.dropoff_point_type.trim()) errs.push(`${labelFor("dropoff_point_type")} is required.`);
  if (!form.dropoff_point_name.trim()) errs.push(`${labelFor("dropoff_point_name")} is required.`);

  if (!isValidOptionalDateTimeLocalOrIso(form.availability_window_start)) {
    errs.push(`${labelFor("availability_window_start")} must be a valid date/time or empty.`);
  }
  if (!isValidOptionalDateTimeLocalOrIso(form.availability_window_end)) {
    errs.push(`${labelFor("availability_window_end")} must be a valid date/time or empty.`);
  }

  const latKeys: Array<keyof TransferFormValues> = ["pickup_latitude", "dropoff_latitude"];
  for (const k of latKeys) {
    const v = form[k];
    if (v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < -90 || n > 90) errs.push(`${labelFor(String(k))} must be between -90 and 90, or empty.`);
  }
  const lngKeys: Array<keyof TransferFormValues> = ["pickup_longitude", "dropoff_longitude"];
  for (const k of lngKeys) {
    const v = form[k];
    if (v === "") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < -180 || n > 180) errs.push(`${labelFor(String(k))} must be between -180 and 180, or empty.`);
  }
  if (form.route_distance_km !== "") {
    const n = Number(form.route_distance_km);
    if (!Number.isFinite(n) || n < 0) errs.push(`${labelFor("route_distance_km")} must be 0 or greater, or empty.`);
  }
  if (form.route_label.trim().length > 255) errs.push(`${labelFor("route_label")} must be at most 255 characters.`);
  return errs;
}

function validateTransferVehicleBlock(form: TransferFormValues): string[] {
  const errs: string[] = [];
  if (!form.vehicle_category.trim()) errs.push(`${labelFor("vehicle_category")} is required.`);
  if (form.vehicle_class.trim().length > 64) errs.push(`${labelFor("vehicle_class")} must be at most 64 characters.`);
  if (form.passenger_capacity === "" || !Number.isFinite(Number(form.passenger_capacity)) || Number(form.passenger_capacity) < 1) {
    errs.push(`${labelFor("passenger_capacity")} must be at least 1.`);
  }
  if (form.luggage_capacity === "" || !Number.isFinite(Number(form.luggage_capacity)) || Number(form.luggage_capacity) < 0) {
    errs.push(`${labelFor("luggage_capacity")} must be 0 or greater.`);
  }
  if (form.minimum_passengers === "" || !Number.isFinite(Number(form.minimum_passengers)) || Number(form.minimum_passengers) < 1) {
    errs.push(`${labelFor("minimum_passengers")} must be at least 1.`);
  }
  if (form.maximum_passengers === "" || !Number.isFinite(Number(form.maximum_passengers)) || Number(form.maximum_passengers) < 1) {
    errs.push(`${labelFor("maximum_passengers")} must be at least 1.`);
  }
  const cap = form.passenger_capacity === "" ? null : Number(form.passenger_capacity);
  const minP = form.minimum_passengers === "" ? null : Number(form.minimum_passengers);
  const maxP = form.maximum_passengers === "" ? null : Number(form.maximum_passengers);
  if (minP != null && maxP != null && minP > maxP) {
    errs.push(`${labelFor("maximum_passengers")} must be greater than or equal to minimum passengers.`);
  }
  if (cap != null && maxP != null && maxP > cap) {
    errs.push(`${labelFor("maximum_passengers")} must not exceed passenger capacity.`);
  }
  if (form.maximum_luggage !== "") {
    const n = Number(form.maximum_luggage);
    if (!Number.isFinite(n) || n < 0) errs.push(`${labelFor("maximum_luggage")} must be 0 or greater, or empty.`);
  }
  if (form.child_seat_required_rule.trim().length > 64) errs.push(`${labelFor("child_seat_required_rule")} must be at most 64 characters.`);
  return errs;
}

function validateTransferPricingBlock(form: TransferFormValues): string[] {
  const errs: string[] = [];
  if (!form.pricing_mode.trim()) errs.push(`${labelFor("pricing_mode")} is required.`);
  if (form.base_price === "" || !Number.isFinite(Number(form.base_price)) || Number(form.base_price) < 0) {
    errs.push(`${labelFor("base_price")} must be 0 or greater.`);
  }
  if (!form.cancellation_policy_type.trim()) errs.push(`${labelFor("cancellation_policy_type")} is required.`);
  if (!isValidOptionalDateTimeLocalOrIso(form.cancellation_deadline_at)) {
    errs.push(`${labelFor("cancellation_deadline_at")} must be a valid date/time or empty.`);
  }
  return errs;
}

function validateTransferPublicationBlock(form: TransferFormValues): string[] {
  const errs: string[] = [];
  if (!form.availability_status.trim()) errs.push(`${labelFor("availability_status")} is required.`);
  if (!form.status.trim()) errs.push(`${labelFor("status")} is required.`);
  if (typeof form.bookable !== "boolean") errs.push(`${labelFor("bookable")} must be a boolean.`);
  if (typeof form.is_package_eligible !== "boolean") errs.push(`${labelFor("is_package_eligible")} must be a boolean.`);
  if (!String(form.visibility_rule ?? "").trim()) errs.push(`${labelFor("visibility_rule")} is required.`);
  if (typeof form.appears_in_web !== "boolean") errs.push(`${labelFor("appears_in_web")} must be a boolean.`);
  if (typeof form.appears_in_admin !== "boolean") errs.push(`${labelFor("appears_in_admin")} must be a boolean.`);
  if (typeof form.appears_in_zulu_admin !== "boolean") errs.push(`${labelFor("appears_in_zulu_admin")} must be a boolean.`);
  return errs;
}

export function validateTransferOperatorForm(form: TransferFormValues, mode: TransferBuilderMode): string[] {
  return [
    ...validateTransferGeneralBlock(form, mode),
    ...validateTransferRouteBlock(form),
    ...validateTransferVehicleBlock(form),
    ...validateTransferPricingBlock(form),
    ...validateTransferPublicationBlock(form),
  ];
}

export function validateTransferOperatorStep(
  form: TransferFormValues,
  step: TransferOperatorWizardStep,
  mode: TransferBuilderMode
): string[] {
  if (step === "review") return validateTransferOperatorForm(form, mode);
  switch (step) {
    case "general":
      return validateTransferGeneralBlock(form, mode);
    case "route":
      return validateTransferRouteBlock(form);
    case "vehicle":
      return validateTransferVehicleBlock(form);
    case "pricing":
      return validateTransferPricingBlock(form);
    case "publication":
      return validateTransferPublicationBlock(form);
    default:
      return [];
  }
}

