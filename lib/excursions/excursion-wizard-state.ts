import type { ExcursionExpandedWritePayload, ExcursionRow } from "@/lib/inventory-crud-api";

export type FieldErrors = Record<string, string[]>;

export const EXCURSION_WIZARD_STEP_COUNT = 5;

/** Step C3 — matches backend OfferVisibilityService::getVisibilityRules(). */
export const EXCURSION_VISIBILITY_RULES = ["show_all", "show_accepted_only", "hide_rejected"] as const;

export type PriceByDateRow = { date: string; price: number | "" };

/** Single source of truth for the operator excursion builder (Steps 1–5). */
export type ExcursionWizardState = {
  offer_id: number | "";
  company_id: number | "";
  country: string;
  city: string;
  general_category: string;
  category: string;
  excursion_type: string;
  tour_name: string;
  overview: string;
  photos: string[];
  duration: string;
  starts_at: string;
  ends_at: string;
  language: string;
  group_size: number | "";
  ticket_max_count: number | "";
  status: string;
  is_available: boolean;
  is_bookable: boolean;
  includes: string[];
  meeting_pickup: string;
  additional_info: string;
  cancellation_policy: string;
  price_by_dates: PriceByDateRow[];
  /** Step C3 — visibility / distribution. */
  visibility_rule: string;
  appears_in_web: boolean;
  appears_in_admin: boolean;
  appears_in_zulu_admin: boolean;
};

export function emptyExcursionWizardTail(): Omit<ExcursionWizardState, "offer_id" | "company_id"> {
  return {
    country: "",
    city: "",
    general_category: "",
    category: "",
    excursion_type: "",
    tour_name: "",
    overview: "",
    photos: [],
    duration: "",
    starts_at: "",
    ends_at: "",
    language: "",
    group_size: "",
    ticket_max_count: "",
    status: "",
    is_available: true,
    is_bookable: true,
    includes: [],
    meeting_pickup: "",
    additional_info: "",
    cancellation_policy: "",
    price_by_dates: [],
    visibility_rule: "show_all",
    appears_in_web: true,
    appears_in_admin: true,
    appears_in_zulu_admin: true,
  };
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parsePhotosFromRow(r: ExcursionRow): string[] {
  const p = r.photos;
  if (!Array.isArray(p)) return [];
  return p.filter((x): x is string => typeof x === "string");
}

function parseIncludesFromRow(r: ExcursionRow): string[] {
  const i = r.includes;
  if (!Array.isArray(i)) return [];
  return i.filter((x): x is string => typeof x === "string");
}

function parsePriceByDatesFromRow(r: ExcursionRow): PriceByDateRow[] {
  const raw = r.price_by_dates;
  if (!Array.isArray(raw)) return [];
  const out: PriceByDateRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const date = typeof o.date === "string" ? o.date : "";
    const price = o.price;
    if (typeof price === "number" && !Number.isNaN(price)) {
      out.push({ date, price });
    } else if (typeof price === "string" && price.trim() !== "") {
      const n = Number(price);
      if (!Number.isNaN(n)) out.push({ date, price: n });
    } else {
      out.push({ date, price: "" });
    }
  }
  return out;
}

export function excursionWizardFromRow(r: ExcursionRow): ExcursionWizardState {
  const cid =
    r.company_id != null && r.company_id !== ""
      ? Number(r.company_id)
      : r.offer?.company_id != null && r.offer.company_id !== ""
        ? Number(r.offer.company_id)
        : "";
  return {
    offer_id: r.offer_id != null ? Number(r.offer_id) : "",
    company_id: cid,
    country: r.country ?? "",
    city: r.city ?? "",
    general_category: r.general_category ?? "",
    category: r.category ?? "",
    excursion_type: r.excursion_type ?? "",
    tour_name: r.tour_name ?? "",
    overview: r.overview ?? "",
    photos: parsePhotosFromRow(r),
    duration: r.duration ?? "",
    starts_at: isoToDatetimeLocal(r.starts_at ?? undefined),
    ends_at: isoToDatetimeLocal(r.ends_at ?? undefined),
    language: r.language ?? "",
    group_size: r.group_size != null ? Number(r.group_size) : "",
    ticket_max_count: r.ticket_max_count != null ? Number(r.ticket_max_count) : "",
    status: r.status ?? "",
    is_available: r.is_available != null ? Boolean(r.is_available) : true,
    is_bookable: r.is_bookable != null ? Boolean(r.is_bookable) : true,
    includes: parseIncludesFromRow(r),
    meeting_pickup: r.meeting_pickup ?? "",
    additional_info: r.additional_info ?? "",
    cancellation_policy: r.cancellation_policy ?? "",
    price_by_dates: parsePriceByDatesFromRow(r),
    visibility_rule: r.visibility_rule ?? "show_all",
    appears_in_web: r.appears_in_web != null ? Boolean(r.appears_in_web) : true,
    appears_in_admin: r.appears_in_admin != null ? Boolean(r.appears_in_admin) : true,
    appears_in_zulu_admin: r.appears_in_zulu_admin != null ? Boolean(r.appears_in_zulu_admin) : true,
  };
}

/** Display / API `location` line from geography (core contract still requires `location`). */
export function derivedLocationFromWizard(form: ExcursionWizardState): string {
  const city = form.city.trim();
  const country = form.country.trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return "";
}

function parseLocalSchedule(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function datetimeLocalToIso(local: string): string | undefined {
  const t = local.trim();
  if (!t) return undefined;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Step-only validation (used for Next). Step index 1-based. */
export function validateExcursionWizardStep(
  step: number,
  form: ExcursionWizardState,
  isCreate: boolean
): FieldErrors | null {
  const e: FieldErrors = {};
  if (step === 1) {
    if (isCreate) {
      if (form.offer_id === "") e.offer_id = ["Select an offer."];
      if (form.company_id === "") e.company_id = ["Company is required."];
    }
    if (!form.country.trim()) e.country = ["Country is required."];
    if (!form.city.trim()) e.city = ["City is required."];
  }
  if (step === 2) {
    const g = form.general_category.trim();
    const c = form.category.trim();
    const t = form.excursion_type.trim();
    if (!g && !c && !t) {
      e.general_category = ["Enter at least one of general category, category, or type."];
    }
  }
  if (step === 3) {
    if (!form.duration.trim()) e.duration = ["Duration is required."];
    if (form.group_size === "") {
      e.group_size = ["Group size is required."];
    } else {
      const n = Number(form.group_size);
      if (!Number.isInteger(n) || n < 1) e.group_size = ["Group size must be an integer ≥ 1."];
    }
    if (!form.language.trim()) e.language = ["Language is required."];
    if (form.ticket_max_count !== "") {
      const t = Number(form.ticket_max_count);
      if (!Number.isInteger(t) || t < 1) e.ticket_max_count = ["Max tickets must be an integer ≥ 1."];
    }
    const start = parseLocalSchedule(form.starts_at);
    const end = parseLocalSchedule(form.ends_at);
    if (start && end && end < start) {
      e.ends_at = ["End time must be on or after the start time."];
    }
    for (let i = 0; i < form.photos.length; i++) {
      const u = form.photos[i]?.trim() ?? "";
      if (u && u.length > 2048) e[`photos.${i}`] = ["URL is too long."];
    }
  }
  if (step === 4) {
    // optional
  }
  if (step === 5) {
    for (let i = 0; i < form.price_by_dates.length; i++) {
      const row = form.price_by_dates[i];
      const d = row?.date?.trim() ?? "";
      const p = row?.price;
      const hasDate = Boolean(d);
      const hasPrice = p !== "" && p !== undefined && !Number.isNaN(Number(p));
      if (hasDate !== hasPrice) {
        e[`price_by_dates.${i}`] = ["Each row needs both date and price, or remove the row."];
        continue;
      }
      if (hasDate && hasPrice) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          e[`price_by_dates.${i}.date`] = ["Use YYYY-MM-DD."];
        }
        const n = Number(p);
        if (Number.isNaN(n) || n < 0) e[`price_by_dates.${i}.price`] = ["Price must be ≥ 0."];
      }
    }
  }
  return Object.keys(e).length ? e : null;
}

/** Full validation before Save (all steps). */
export function validateExcursionWizardFull(form: ExcursionWizardState, isCreate: boolean): FieldErrors | null {
  const merged: FieldErrors = {};
  for (let s = 1; s <= EXCURSION_WIZARD_STEP_COUNT; s++) {
    const part = validateExcursionWizardStep(s, form, isCreate);
    if (part) Object.assign(merged, part);
  }
  const loc = derivedLocationFromWizard(form);
  if (!loc.trim()) merged.location = ["Location (from city/country) is empty."];
  return Object.keys(merged).length ? merged : null;
}

export function expandedPayloadFromWizard(form: ExcursionWizardState): ExcursionExpandedWritePayload {
  const out: ExcursionExpandedWritePayload = {};
  const setIf = (key: keyof ExcursionExpandedWritePayload, val: string) => {
    const t = val.trim();
    if (t) (out as Record<string, unknown>)[key as string] = t;
  };
  setIf("country", form.country);
  setIf("city", form.city);
  setIf("general_category", form.general_category);
  setIf("category", form.category);
  setIf("excursion_type", form.excursion_type);
  setIf("tour_name", form.tour_name);
  const ov = form.overview.trim();
  if (ov) out.overview = ov;
  const st = datetimeLocalToIso(form.starts_at);
  if (st) out.starts_at = st;
  const en = datetimeLocalToIso(form.ends_at);
  if (en) out.ends_at = en;
  setIf("language", form.language);
  if (form.ticket_max_count !== "") {
    out.ticket_max_count = Number(form.ticket_max_count);
  }
  const status = form.status.trim();
  if (status) out.status = status;
  out.is_available = form.is_available;
  out.is_bookable = form.is_bookable;

  const includes = form.includes.map((x) => x.trim()).filter(Boolean);
  if (includes.length) out.includes = includes;

  const mp = form.meeting_pickup.trim();
  if (mp) out.meeting_pickup = mp;
  const ai = form.additional_info.trim();
  if (ai) out.additional_info = ai;
  const cp = form.cancellation_policy.trim();
  if (cp) out.cancellation_policy = cp;

  const photos = form.photos.map((x) => x.trim()).filter(Boolean);
  if (photos.length) out.photos = photos;

  const pbd: { date: string; price: number }[] = [];
  for (const row of form.price_by_dates) {
    const d = row.date.trim();
    const p = row.price;
    if (!d || p === "" || p === undefined) continue;
    const n = Number(p);
    if (!Number.isNaN(n) && n >= 0) pbd.push({ date: d, price: n });
  }
  if (pbd.length) out.price_by_dates = pbd;

  const vr = form.visibility_rule.trim();
  if (vr && EXCURSION_VISIBILITY_RULES.includes(vr as (typeof EXCURSION_VISIBILITY_RULES)[number])) {
    out.visibility_rule = vr;
  }
  out.appears_in_web = form.appears_in_web;
  out.appears_in_admin = form.appears_in_admin;
  out.appears_in_zulu_admin = form.appears_in_zulu_admin;

  return out;
}

export function coreWritePayloadFromWizard(form: ExcursionWizardState): {
  location: string;
  duration: string;
  group_size: number;
} {
  return {
    location: derivedLocationFromWizard(form),
    duration: form.duration.trim(),
    group_size: Number(form.group_size),
  };
}
